/* THE SHARED RUNNER (audit 5b): the one implementation of test execution and results persistence for BOTH suites, the production
   wallet tests (wallet.test.js + its case modules, manifest.json) and the staging tests (../staging/staging.test.js, its own
   ../staging/manifest.json). Each suite's entry calls begin(module,…) first (before it loads anything that can fail) and execute(spec)
   once its cases are registered. Nothing here is suite-specific except what the spec passes in.

   begin(): only when that module is the main script (node wallet.test.js / node staging.test.js, as run.sh starts them); for any other
   loader (shots scripts, a case module) it does nothing and the suite behaves as a library. Under the runner it
     - creates the run identity (runId, startedAt, suite, label, mode from the environment),
     - installs SIGINT / SIGTERM (an "interrupted" result, exit 130 / 143), unhandled rejections (fail the case running and the run),
       uncaught exceptions, the event loop draining before the end, any other process.exit (recorded, never a success), and the
       whole-run watchdog (RUN_TIMEOUT_MS),
     - moves an earlier results file of the same name aside (results-<label>.prev-<its runId>.json) and writes this run's first
       snapshot ("starting") BEFORE any case module, dependency or page is loaded; if either fails, nothing runs (exit 1).
   execute(spec): registration and manifest checks (RELEASE=1: exact ids of the committed manifest, no CASES, no preloaded code),
   selection, browser launch, the cases (case watchdog CASE_TIMEOUT_MS, cleanup deadline CLEANUP_TIMEOUT_MS, browser loss, page errors,
   unhandled rejections), a snapshot after every case, the final snapshot and the exit status.

   Exit status: 0 only when every selected case ran and passed (pass===true), every snapshot was saved and nothing went wrong in the
   harness. 1: a case failed (assertion, exception, page error / unhandled rejection / renderer crash in any context it opened, case
   watchdog, cleanup deadline), the browser could not launch, died or stopped answering, the run stopped early (event loop drained,
   whole-run watchdog, uncaught exception), a dependency / the target could not be loaded, or a results write failed at any point
   (sticky). 2: wrong selection or registration (unknown id, zero cases, duplicate or malformed id, a case module that does not load)
   or, with RELEASE=1, a registration that differs from the manifest (or a manifest that is itself malformed), CASES or preloaded code.
   130 / 143: SIGINT / SIGTERM. Results: see README "Results file". */
'use strict';
const fs=require('fs'), path=require('path'), crypto=require('crypto'), cp=require('child_process');
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const SCHEMA='stormglass-wallet-results/2';
const ID_RE=/^[A-Za-z0-9_-]+$/;
const CTX_CLOSE_MS=10000, BROWSER_CLOSE_MS=10000, HEALTH_MS=15000, LAUNCH_MS=60000;
let S=null;   /* the run, once begin() made this process a runner */
const active=()=>!!S;

function harnessFail(msg){ msg=String(msg).slice(0,600); S.HF.push({at:new Date().toISOString(),during:S.RUNNING,msg}); console.log('HARNESS FAIL '+msg); }
function refresh(){ const {RUN,RES,SEL}=S, ex=RES.map(r=>r.id);
  Object.assign(RUN,{selected:SEL.map(c=>c.id),executed:ex,passed:RES.filter(r=>r.pass).map(r=>r.id),failed:RES.filter(r=>!r.pass).map(r=>r.id),
    timedOut:RES.filter(r=>r.ev&&r.ev.timedOut).map(r=>r.id),cleanupTimedOut:RES.filter(r=>r.ev&&(r.ev.cleanupTimedOut||r.ev.contextsDidNotClose)).map(r=>r.id),
    unexecuted:SEL.filter(c=>!ex.includes(c.id)).map(c=>c.id)}); }
/* one snapshot: a temp file beside the results, written, fsynced, renamed over. A failure is sticky: persistence.ok stays false and the
   exit status nonzero for the rest of the run (a later good write records it, never clears it). */
function writeResults(){ const {RUN,OUT,RFILE}=S; refresh(); RUN.persistence.snapshots++; const n=RUN.persistence.snapshots;
  const tmp=path.join(OUT,'.results-'+S.LABEL+'.json.'+RUN.runId+'.tmp');
  try{ fs.mkdirSync(OUT,{recursive:true}); const fd=fs.openSync(tmp,'w');
    try{ fs.writeSync(fd,JSON.stringify(RUN,null,1)); fs.fsyncSync(fd); } finally{ fs.closeSync(fd); }
    fs.renameSync(tmp,RFILE); return true; }
  catch(e){ S.PERSIST_FAILED=true; RUN.persistence.ok=false; RUN.persistence.failures.push({snapshot:n,at:new Date().toISOString(),msg:String(e&&e.message||e).slice(0,300)});
    harnessFail('cannot write results (snapshot '+n+'): '+(e&&e.message||e)); try{ fs.unlinkSync(tmp); }catch(_){} return false; } }
/* an earlier run's file under this name is kept, renamed by its run id (or mtime for the old array format): it can never stand in for this run */
function setAside(){ const {RUN,OUT,RFILE}=S; let st; try{ st=fs.statSync(RFILE); }catch(e){ return true; }
  let id=null; try{ const j=JSON.parse(fs.readFileSync(RFILE,'utf8')); if(j&&!Array.isArray(j)&&typeof j.runId==='string'&&/^[\w.-]+$/.test(j.runId)) id=j.runId; }catch(e){}
  const dest=path.join(OUT,'results-'+S.LABEL+'.prev-'+(id||('legacy-'+st.mtime.toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z')))+'.json');
  try{ fs.renameSync(RFILE,dest); RUN.persistence.previous=dest; console.log('RESULTS an earlier file was moved aside: '+dest); return true; }
  catch(e){ S.PERSIST_FAILED=true; RUN.persistence.ok=false; harnessFail('cannot move the earlier results file aside: '+e.message); return false; } }
function exitFor(){ refresh(); const {RUN,RES,SEL}=S; return RUN.unexecuted.length===0&&RUN.failed.length===0&&RES.length===SEL.length&&SEL.length>0&&!S.HF.length&&!S.PERSIST_FAILED?0:1; }
/* the browser's own processes (Playwright starts Chromium as a child of this process, in its own process group) */
function childPids(){ try{ return cp.execFileSync('pgrep',['-P',String(process.pid)],{encoding:'utf8',timeout:5000}).split(/\s+/).filter(Boolean).map(Number); }catch(e){ return []; } }
function killBrowser(){ for(const pid of S.BROWSER_PIDS){ try{ process.kill(-pid,'SIGKILL'); }catch(e){} try{ process.kill(pid,'SIGKILL'); }catch(e){} } }
/* every way out goes through here once: final status, final snapshot, summary lines, exit */
function finish(status,code,why){ if(!S||S.FINISHED) return; S.FINISHED=true; const {RUN,RES,SEL,LABEL,RFILE}=S;
  if(why) RUN.interruptedBy=why; if(status==='interrupted'||status==='incomplete') killBrowser();
  refresh(); RUN.running=status==='interrupted'||status==='incomplete'?S.RUNNING:null;
  if(code==null){ code=exitFor(); if(status==='done') status=code===0?'passed':RUN.unexecuted.length?'incomplete':'failed'; }
  RUN.status=status; RUN.completed=RUN.unexecuted.length===0&&SEL.length>0&&status!=='interrupted'&&status!=='incomplete'&&!/error|mismatch|harness|abort/.test(status);
  RUN.exit=status==='interrupted'?'interrupted':code; RUN.exitCode=code; RUN.finishedAt=new Date().toISOString();
  if(!writeResults()&&code===0) code=1;   /* the final snapshot failed: what is on disk is an earlier one of THIS run (status starting/running), never a success */
  console.log('RAN '+RES.length+': '+RES.map(r=>r.id).join(',')+(RUN.unexecuted.length?' · NOT RUN: '+RUN.unexecuted.join(','):''));
  console.log(LABEL+': '+RUN.passed.length+'/'+SEL.length+' passed'+(RUN.failed.length?' · FAILED: '+RUN.failed.join(','):'')+(RUN.unexecuted.length?' · NOT RUN: '+RUN.unexecuted.length:'')+(S.HF.length?' · HARNESS FAILURES: '+S.HF.length:''));
  console.log('RESULTS '+RFILE+' run '+RUN.runId+' mode '+RUN.mode+' status '+status+' completed '+RUN.completed+' exit '+(status==='interrupted'?'interrupted ('+code+')':code)+(S.PERSIST_FAILED?' (persistence FAILED)':''));
  process.exit(code); }

/* what produced this run */
function git(dir,...a){ return cp.execFileSync('git',['-C',dir,...a],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000,maxBuffer:1<<26}).trim(); }
/* a file's source: the commit of the repo holding it and whether its bytes equal that commit's copy */
function fileSource(file){ let real; try{ real=fs.realpathSync(file); }catch(e){ return {commit:'unknown',reason:'not found: '+e.message}; }
  const dir=path.dirname(real); let top,head;
  try{ top=fs.realpathSync(git(dir,'rev-parse','--show-toplevel')); head=git(dir,'rev-parse','HEAD'); }catch(e){ return {commit:'unknown',reason:'not inside a git work tree ('+String(e.stderr||e.message).trim().slice(0,160)+')'}; }
  const rel=path.relative(top,real); let headBlob=null; try{ headBlob=git(top,'rev-parse','HEAD:'+rel); }catch(e){}
  let blob=null; try{ blob=git(top,'hash-object','--',rel); }catch(e){}
  const matches=!!headBlob&&blob===headBlob;
  return {commit:head,repo:top,path:rel,blob,headBlob,matchesHead:matches,
    reason:matches?null:!headBlob?'not committed in this repo (untracked copy): the commit names the repo holding it, not the source of these bytes':'differs from the file in HEAD (uncommitted change)'}; }
/* the harness that ran: commit, tree of each harness folder, uncommitted files, and the sha256 of every harness file Node loaded */
function harnessRev(home,dirs,root){ const o={dir:path.relative(root,home)||'.',commit:'unknown',tree:'unknown',trees:{},dirty:null,reason:null};
  try{ o.commit=git(home,'rev-parse','HEAD'); o.tree=git(home,'rev-parse','HEAD:./'); o.dirty=[];
    for(const d of dirs){ const rel=path.relative(home,d)||'.'; o.trees[rel]=git(d,'rev-parse','HEAD:./'); o.dirty.push(...git(d,'status','--porcelain','--untracked-files=all','--','.').split('\n').filter(Boolean)); } }
  catch(e){ o.reason='not a git work tree ('+String(e.stderr||e.message).trim().slice(0,160)+')'; }
  const files=Object.keys(require.cache).filter(f=>dirs.includes(path.dirname(f))).sort();
  o.files={}; for(const f of files) try{ o.files[path.relative(home,f)]=sha256(fs.readFileSync(f)); }catch(e){ o.files[path.relative(home,f)]='unreadable'; }
  o.contentSha256=sha256(JSON.stringify(o.files)); return o; }
function pkgAt(dir){ try{ const j=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8')); return {version:j.version,path:dir}; }catch(e){ return {version:'unknown',path:dir,reason:e.message}; } }
const umdPath=()=>(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean).concat(['/home/claude/node_modules']).map(p=>path.join(p,'ethers/dist/ethers.umd.min.js')).find(f=>fs.existsSync(f));
function deps(){ const umd=umdPath(); let pw='unknown'; try{ pw=pkgAt(path.dirname(require.resolve('playwright'))); }catch(e){ pw={version:'unknown',reason:e.message.split('\n')[0]}; }
  let us=null; try{ us=umd?sha256(fs.readFileSync(umd)):null; }catch(e){}
  return {node:process.version,playwright:pw,ethers:umd?pkgAt(path.join(path.dirname(umd),'..')):'unknown',ethersUmd:{path:umd||null,sha256:us},chromium:null,chromiumPath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'}; }

/* the committed manifest (same format for both suites): {schema:1, modules:{file:{group, ids:[…]}}}. The manifest itself is checked:
   an id that is not a string of [A-Za-z0-9_-], or listed twice (in one module or two), makes it malformed (a release run refuses it). */
function manifestDiff(mf,CASES,present,groupOf){ let want, raw;
  try{ raw=fs.readFileSync(mf); want=JSON.parse(raw).modules; if(!want||typeof want!=='object'||Array.isArray(want)) throw new Error('no "modules" object'); }
  catch(e){ return {file:mf,ok:false,error:'cannot read the manifest: '+e.message}; }
  const malformed=[], seen=new Map(), duplicateIds=[];
  for(const [f,e] of Object.entries(want)){ if(!e||!Array.isArray(e.ids)||typeof e.group!=='string'){ malformed.push(f+': needs {group, ids[]}'); continue; }
    for(const id of e.ids){ if(typeof id!=='string'||!ID_RE.test(id)){ malformed.push(f+': '+JSON.stringify(id)); continue; }
      if(seen.has(id)) duplicateIds.push(id+' ('+seen.get(id)+', '+f+')'); else seen.set(id,f); } }
  const have={}; for(const c of CASES){ const e=have[c.file]=have[c.file]||{group:groupOf(c.file),ids:[]}; e.ids.push(c.id); }
  const d={file:mf,sha256:sha256(raw),malformedIds:malformed,duplicateIds,
    missingModules:Object.keys(want).filter(f=>!present.includes(f)), unlistedModules:present.filter(f=>!(f in want)),
    modulesWithoutCases:present.filter(f=>(f in want)&&!have[f]&&want[f]&&Array.isArray(want[f].ids)&&want[f].ids.length), missingIds:[], unlistedIds:[], wrongGroup:[]};
  for(const [f,e] of Object.entries(want)){ if(!e||!Array.isArray(e.ids)) continue; const h=new Set((have[f]||{ids:[]}).ids); for(const id of e.ids) if(!h.has(id)) d.missingIds.push(f+':'+id);
    if(have[f]&&have[f].group!==e.group) d.wrongGroup.push(f+': '+have[f].group+' (manifest '+e.group+')'); }
  for(const c of CASES) if(!(c.file in want)||!(want[c.file].ids||[]).includes(c.id)) d.unlistedIds.push(c.file+':'+c.id+(seen.has(c.id)?' (listed under another module)':''));
  d.expected=seen.size; d.registered=CASES.length;
  d.ok=!malformed.length&&!duplicateIds.length&&!d.missingModules.length&&!d.unlistedModules.length&&!d.modulesWithoutCases.length&&!d.missingIds.length&&!d.unlistedIds.length&&!d.wrongGroup.length&&d.expected===d.registered;
  return d; }
function manifestOf(CASES,groupOf){ const m={}; for(const c of CASES){ const e=m[c.file]=m[c.file]||{group:groupOf(c.file),ids:[]}; e.ids.push(c.id); } return m; }

/* o: {suite, label (default LABEL), caseMs (this suite's default CASE_TIMEOUT_MS)} */
function begin(mod,o){ if(require.main!==mod) return null; if(S) return S;
  const print=process.argv.includes('--print-manifest');
  const OUT=process.env.OUT||'/tmp/claude-0/pr1test', LABEL=process.env.LABEL||o.label, RFILE=path.join(OUT,'results-'+LABEL+'.json');
  const RELEASE=process.env.RELEASE==='1', CASESENV=process.env.CASES;
  const CASE_MS=+process.env.CASE_TIMEOUT_MS||o.caseMs||120000, RUN_MS=+process.env.RUN_TIMEOUT_MS||2700000, CLEAN_MS=+process.env.CLEANUP_TIMEOUT_MS||30000;
  S={o,print,OUT,LABEL,RFILE,RELEASE,CASESENV,CASE_MS,RUN_MS,CLEAN_MS,RUNNING:'(none: before the first case)',SEL:[],RES:[],HF:[],UNHANDLED:[],PERSIST_FAILED:false,FINISHED:false,BROWSER_PIDS:[]};
  S.RUN={schema:SCHEMA,suite:o.suite,
    runId:new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z')+'-'+process.pid+'-'+crypto.randomBytes(3).toString('hex'),
    label:LABEL, mode:RELEASE?'release':(CASESENV!=null&&CASESENV.trim()!=='')?'subset':'all (not release-verified)',
    status:'starting', completed:false, exit:null, exitCode:null, startedAt:new Date().toISOString(), finishedAt:null, interruptedBy:null,
    target:null, harness:null, deps:null,
    env:{CASES:CASESENV==null?null:CASESENV,RELEASE:process.env.RELEASE||null,CASE_TIMEOUT_MS:CASE_MS,CLEANUP_TIMEOUT_MS:CLEAN_MS,RUN_TIMEOUT_MS:RUN_MS,NODE_OPTIONS:process.env.NODE_OPTIONS||null,OUT,PORT:process.env.PORT||null,STAGING_PAGE:process.env.STAGING_PAGE||null,cwd:process.cwd()},
    manifest:null, registered:null, groups:null,
    selected:[], executed:[], passed:[], failed:[], timedOut:[], cleanupTimedOut:[], unexecuted:[], running:null, harnessFailures:S.HF,
    persistence:{ok:true,snapshots:0,failures:[],file:RFILE,previous:null}, cases:S.RES};
  if(print) return S;   /* --print-manifest: registration only, no results file is touched */
  /* Node exits 0 when the event loop drains with the run still awaiting something (a promise that never settles: browser gone). */
  process.on('beforeExit',()=>{ harnessFail('the run stopped before it finished, in case '+S.RUNNING+' (a promise never settled: browser gone?)'); finish('incomplete',1,'event loop drained'); });
  process.on('SIGINT',()=>{ console.log('HARNESS FAIL interrupted (SIGINT) in case '+S.RUNNING); finish('interrupted',130,'SIGINT'); });
  process.on('SIGTERM',()=>{ console.log('HARNESS FAIL interrupted (SIGTERM) in case '+S.RUNNING); finish('interrupted',143,'SIGTERM'); });
  process.on('unhandledRejection',e=>{ const m=String(e&&e.stack||e).slice(0,300); S.UNHANDLED.push({during:S.RUNNING,msg:m}); harnessFail('unhandled rejection in Node during '+S.RUNNING+': '+m); });
  process.on('uncaughtException',e=>{ harnessFail('uncaught exception in Node during '+S.RUNNING+': '+String(e&&e.stack||e).slice(0,300)); finish(S.started?'incomplete':'harness-failure',1,'uncaught exception'); });
  /* any other process.exit (a library calling it, a registration that exits): recorded as this run's result, never a success */
  process.on('exit',code=>{ if(S.FINISHED) return; S.FINISHED=true; const c=code||1;
    S.HF.push({at:new Date().toISOString(),during:S.RUNNING,msg:'the process exited ('+code+') outside the runner'}); console.log('HARNESS FAIL the process exited ('+code+') outside the runner, in '+S.RUNNING);
    refresh(); Object.assign(S.RUN,{status:'aborted',completed:false,exit:c,exitCode:c,finishedAt:new Date().toISOString(),running:S.RUNNING}); writeResults(); process.exitCode=c; });
  setTimeout(()=>{ harnessFail('whole-run watchdog: the run took more than '+RUN_MS+' ms (RUN_TIMEOUT_MS)'); finish('interrupted',1,'run watchdog '+RUN_MS+' ms'); },RUN_MS).unref();
  /* preflight, before anything else is loaded: the earlier file moved aside and a first snapshot ("starting") written, or nothing runs */
  if(!setAside()||!writeResults()){ console.log('HARNESS FAIL the results cannot be saved in '+OUT+': no case is run'); finish('harness-failure',1); }
  return S; }

/* spec: {CASES, REGERR:[], early:()=>string|null, load:()=>void, manifest:{file, present:()=>[module files], groupOf:f=>group, note},
          target:()=>{path,bytes,sha256,source}, servedFromDisk:bool (re-hash the target at the end), extra:()=>object (merged into the results),
          harness:{home, dirs, root}, boot, LIVE, setBrowser, bumpEpoch} */
async function execute(spec){ const {RUN}=S; const {CASES}=spec;
  try{ RUN.target=spec.target(); }catch(e){ RUN.target={error:String(e&&e.message||e).slice(0,300)}; }
  if(spec.load) spec.load();
  const G={}; for(const c of CASES){ const g=spec.manifest.groupOf(c.file)||'@other'; (G[g]=G[g]||[]).push(c.id); }
  RUN.registered=CASES.length; RUN.groups=Object.fromEntries(Object.entries(G).map(([g,ids])=>[g,ids.length]));
  RUN.harness=harnessRev(spec.harness.home,spec.harness.dirs,spec.harness.root); RUN.deps=deps();
  if(spec.extra) try{ Object.assign(RUN,spec.extra()); }catch(e){ harnessFail('cannot describe the run ('+String(e&&e.message||e).slice(0,200)+')'); }
  if(S.print){ console.log(JSON.stringify({schema:1,note:spec.manifest.note,modules:manifestOf(CASES,spec.manifest.groupOf)},null,1)); process.exit(0); }
  const early=spec.early&&spec.early(); if(early){ harnessFail('cannot load '+early); return finish('harness-failure',1); }
  if(RUN.target&&RUN.target.error){ harnessFail('cannot read the target: '+RUN.target.error); return finish('harness-failure',1); }
  if(spec.REGERR.length){ for(const m of spec.REGERR) harnessFail(m); return finish('registration-error',2); }
  RUN.manifest=manifestDiff(spec.manifest.file,CASES,spec.manifest.present(),spec.manifest.groupOf);
  if(S.RELEASE){
    if(S.CASESENV!=null&&S.CASESENV.trim()!==''){ harnessFail('RELEASE=1 runs the whole manifest: CASES must not be set (got '+JSON.stringify(S.CASESENV)+')'); return finish('selection-error',2); }
    if(/(^|\s)(-r|--require|--import|--loader|--experimental-loader)\b/.test(process.env.NODE_OPTIONS||'')){ harnessFail('RELEASE=1 refuses preloaded code in NODE_OPTIONS ('+process.env.NODE_OPTIONS+')'); return finish('selection-error',2); }
    if(!RUN.manifest.ok){ const d=RUN.manifest; harnessFail('the registered cases do not match '+path.basename(spec.manifest.file)+': '+JSON.stringify({error:d.error,malformedIds:d.malformedIds,duplicateIds:d.duplicateIds,missingModules:d.missingModules,unlistedModules:d.unlistedModules,modulesWithoutCases:d.modulesWithoutCases,missingIds:d.missingIds,unlistedIds:d.unlistedIds,wrongGroup:d.wrongGroup,expected:d.expected,registered:d.registered}).slice(0,500)); return finish('manifest-mismatch',2); } }
  else if(!RUN.manifest.ok) console.log('WARN not release-verified: the registered cases differ from '+path.basename(spec.manifest.file)+' (RELEASE=1 would refuse this run): '+JSON.stringify(RUN.manifest).slice(0,300));
  const want=(S.CASESENV||'').split(',').map(x=>x.trim()).filter(Boolean).flatMap(x=>/^@/.test(x)?(G[x]||[]):[x]);
  if(S.CASESENV!=null&&S.CASESENV.trim()!==''&&!want.length){ harnessFail('CASES='+JSON.stringify(S.CASESENV)+' selects no case'); return finish('selection-error',2); }
  const known=new Set(CASES.map(c=>c.id)), unknown=want.filter(x=>!known.has(x));
  if(unknown.length){ harnessFail('unknown case ids in CASES: '+unknown.join(',')); return finish('selection-error',2); }
  const sel=S.SEL=CASES.filter(c=>!want.length||want.includes(c.id));
  if(!sel.length){ harnessFail('no cases selected'); return finish('selection-error',2); }
  const T=RUN.target||{};
  console.log('SELECTED '+sel.length+' of '+CASES.length+': '+sel.map(c=>c.id).join(',')+' · target '+T.path+' sha256 '+String(T.sha256).slice(0,16));
  console.log('RUN '+RUN.runId+' suite '+RUN.suite+' mode '+RUN.mode+' · target commit '+(T.source||{}).commit+((T.source||{}).reason?' ('+T.source.reason+')':'')+' · harness '+RUN.harness.commit.slice(0,12)+(RUN.harness.dirty&&RUN.harness.dirty.length?' +'+RUN.harness.dirty.length+' uncommitted':'')+' · results '+S.RFILE);
  RUN.status='running'; S.started=true; writeResults();
  /* --webrtc-ip-handling-policy=disable_non_proxied_udp (G2, audit 4): WebRTC gathers no UDP candidates and sends no STUN packet */
  const pre=new Set(childPids()); let browser;
  try{ const {chromium}=require('playwright');
    browser=await Promise.race([chromium.launch({args:['--no-sandbox','--disable-background-networking','--disable-component-update','--no-first-run','--webrtc-ip-handling-policy=disable_non_proxied_udp'],executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'}),
      sleep(LAUNCH_MS).then(()=>{ throw new Error('browser launch took more than '+LAUNCH_MS+' ms'); })]); }
  catch(e){ S.BROWSER_PIDS=childPids().filter(p=>!pre.has(p)); harnessFail('the browser did not launch: '+String(e&&e.message||e).split('\n')[0]); return finish('harness-failure',1); }
  S.BROWSER_PIDS=childPids().filter(p=>!pre.has(p)); RUN.deps.chromium=browser.version(); spec.setBrowser(browser);
  let browserGone=false; const goneP=new Promise(res=>browser.on('disconnected',()=>{ browserGone=true; res(); }));
  /* a case races the browser's disconnect: when the browser dies mid-case the case fails here and the rest are reported unexecuted */
  const goneErr=goneP.then(()=>{ throw new Error('browser disconnected during the case'); }); goneErr.catch(()=>{});
  const healthy=()=>Promise.race([(async()=>{ const x=await browser.newContext(); await x.close(); return true; })().catch(()=>false),sleep(HEALTH_MS).then(()=>false)]);
  const LIVE=spec.LIVE;
  for(const c of sel){ let r, timedOut=false, stuck=false, cleanupTimedOut=false; const t0=Date.now(); LIVE.length=0; let wallet=[]; S.RUNNING=c.id; const u0=S.UNHANDLED.length;
    /* the case watchdog: no result after CASE_TIMEOUT_MS fails the case; its contexts are closed and the case's epoch ends (a late boot() from it is refused) */
    let wd; const watchdog=new Promise((_,rej)=>{ wd=setTimeout(()=>rej(Object.assign(new Error('case watchdog: no result after '+S.CASE_MS+' ms'),{watchdog:true})),S.CASE_MS); });
    try{ r=await Promise.race([(async()=>{ const E=await spec.boot(c.cfg,c.o||{}); return await c.run(E); })(),goneErr,watchdog]); if(!r||typeof r!=='object') r={pass:false,ev:{bad:'case returned '+r}}; r.ev=r.ev||{}; }
    catch(e){ timedOut=!!(e&&e.watchdog); r={pass:false,ev:{exception:String(e&&e.message||e).slice(0,300)}}; if(timedOut){ r.ev.timedOut=true; spec.bumpEpoch(); } }
    clearTimeout(wd);
    /* cleanup, bounded twice: each context gets CTX_CLOSE_MS, the whole cleanup CLEANUP_TIMEOUT_MS. What each page's wallets were asked
       (eth_sendTransaction requests) vs what the mock let through (sends) is read before closing. */
    const live=LIVE.slice(); let cd;
    const cleaned=await Promise.race([(async()=>{
      for(const X of live){ try{ if(X.page&&!X.page.isClosed()) wallet.push(await Promise.race([X.page.evaluate(()=>window.__MW?{asked:__MW.log.filter(x=>x.method==='eth_sendTransaction').length,sent:__MW.sends.length}:null),sleep(3000).then(()=>'page did not answer')])); }catch(e){ wallet.push(null); } }
      for(const X of live){ const closed=await Promise.race([Promise.resolve().then(()=>X.ctx.close()).catch(()=>{}).then(()=>true),sleep(CTX_CLOSE_MS).then(()=>false)]); if(!closed) stuck=true; }
      return true; })(),new Promise(res=>{ cd=setTimeout(()=>res(false),S.CLEAN_MS); })]);
    clearTimeout(cd);
    if(!cleaned){ cleanupTimedOut=true; stuck=true; spec.bumpEpoch(); harnessFail('cleanup deadline: the contexts of case '+c.id+' were not closed within '+S.CLEAN_MS+' ms (CLEANUP_TIMEOUT_MS)'); }
    else if(stuck) harnessFail('a context of case '+c.id+' did not close within '+CTX_CLOSE_MS+' ms');
    /* a case that hung, or contexts that would not close: the browser must still answer, or it is killed and the run ends incomplete */
    if((timedOut||stuck)&&!browserGone&&!(await healthy())){ harnessFail('the browser stopped answering (case '+c.id+(timedOut?', watchdog':'')+', contexts '+(stuck?'did not close':'closed')+'): killed'); killBrowser(); browserGone=true; }
    /* page errors and crashes from every context the case opened fail the case (o.allowPageErrors to opt out) */
    const errs=live.flatMap(X=>X.errors||[]), outside=live.flatMap(X=>X.outside||[]), sockets=live.flatMap(X=>X.sockets||[]);
    r.pageErrors=errs.slice(0,3);
    if(errs.length&&!(c.o&&c.o.allowPageErrors)){ r.pass=false; r.ev.failedOnPageErrors=errs.slice(0,3); }
    if(S.UNHANDLED.length>u0){ r.pass=false; r.ev.unhandledRejection=S.UNHANDLED.slice(u0).map(x=>x.msg.slice(0,200)); }
    if(browserGone){ r.pass=false; r.ev.browserGone=true; }
    if(stuck){ r.pass=false; r.ev.contextsDidNotClose=true; } if(cleanupTimedOut) r.ev.cleanupTimedOut=true;
    const ms=Date.now()-t0; S.RES.push({id:c.id,name:c.name,file:c.file,pass:r.pass===true,ms,ev:r.ev,pageErrors:r.pageErrors,contexts:live.length,wallet,outsideRefused:[...new Set(outside)],socketsRefused:[...new Set(sockets)]});
    console.log((r.pass===true?'PASS ':'FAIL ')+c.id.padEnd(4)+' '+c.name+' ('+ms+' ms)\n     '+JSON.stringify(r.ev).slice(0,spec.logChars||400)+(outside.length||sockets.length?'\n     refused outside: '+JSON.stringify([...new Set(outside.concat(sockets))]).slice(0,300):''));
    S.RUNNING='(between cases, after '+c.id+')'; writeResults();
    if(browserGone){ harnessFail('the browser is gone (after case '+c.id+')'); break; } }
  S.RUNNING='(closing the browser)';
  if(!browserGone){ const closed=await Promise.race([browser.close().catch(()=>{}).then(()=>true),sleep(BROWSER_CLOSE_MS).then(()=>false)]);
    if(!closed) harnessFail('cleanup deadline: the browser did not close within '+BROWSER_CLOSE_MS+' ms: killed'); }
  killBrowser();
  /* a target served from disk (the staging page) must be the bytes recorded at the start */
  if(spec.servedFromDisk&&RUN.target&&RUN.target.path){ let now=null; try{ now=sha256(fs.readFileSync(RUN.target.path)); }catch(e){ now='unreadable: '+e.message; }
    RUN.target.sha256AtEnd=now; if(now!==RUN.target.sha256) harnessFail('the target changed during the run: '+RUN.target.sha256+' at the start, '+now+' at the end'); }
  finish('done'); }
function run(spec){ return execute(spec).catch(e=>{ harnessFail('runner: '+String(e&&e.stack||e).slice(0,400)); finish('harness-failure',1); }); }

module.exports={begin,run,active,fileSource,manifestDiff,git,sha256,SCHEMA,ID_RE};
