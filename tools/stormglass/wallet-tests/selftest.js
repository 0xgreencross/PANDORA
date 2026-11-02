/* THE HARNESS SELF-TESTS (audit 5). Proves the runner reports truthfully when things go wrong: each scenario runs the real run.sh
   on a TEMPORARY copy of this folder (with a temporary case module audit5zz_selftest.test.js that exists only in the copy) and
   checks the exit status and the results file. Nothing in the repo is changed; the temp tree is removed at the end (KEEP=1 keeps it).
   usage (about 5 minutes: run it in the background and poll):
     NODE_PATH=/home/claude/node_modules PORT=8941 OUT=/path/evidence node tools/stormglass/wallet-tests/selftest.js [scenario,...]
   The last line is "SELFTEST n/m passed" and the status is 0 only when every scenario behaved as expected. */
const fs=require('fs'), path=require('path'), os=require('os'), cp=require('child_process'), crypto=require('crypto');
const DIR=__dirname, ROOT=path.join(DIR,'../../..');
const PORT=+process.env.PORT||8941, EVOUT=process.env.OUT||path.join(os.tmpdir(),'wallet-selftest');
/* ST_TMPDIR, not TMPDIR: Chromium keeps its profile (and a unix socket) under TMPDIR, and a long TMPDIR breaks its launch */
const TMP=fs.mkdtempSync(path.join(process.env.ST_TMPDIR||os.tmpdir(),'wt-selftest-'));
const TROOT=path.join(TMP,'root'), TDIR=path.join(TROOT,'tools/stormglass/wallet-tests'), TARGET=path.join(ROOT,'index.html');
const TSHA=crypto.createHash('sha256').update(fs.readFileSync(TARGET)).digest('hex');
fs.mkdirSync(EVOUT,{recursive:true});

/* the temp tree: every top-level entry of the repo linked (the page's own files), this folder's files copied (not its subfolders) */
function build(){ fs.mkdirSync(TDIR,{recursive:true});
  for(const f of fs.readdirSync(ROOT)) if(f!=='tools'&&f!=='.git') fs.symlinkSync(path.join(ROOT,f),path.join(TROOT,f));
  for(const f of fs.readdirSync(DIR)) if(fs.statSync(path.join(DIR,f)).isFile()) fs.copyFileSync(path.join(DIR,f),path.join(TDIR,f));
  /* the copy's manifest is regenerated from the copy's own registration (before the temp module exists): the release scenarios test
     the mechanism, whatever state the repo's manifest is in (e.g. a branch whose manifest already lists a module merged elsewhere) */
  const pm=cp.execFileSync(process.execPath,[path.join(TDIR,'wallet.test.js'),'--print-manifest'],{encoding:'utf8',env:Object.assign({},process.env,{TARGET}),timeout:60000});
  fs.writeFileSync(path.join(TDIR,'manifest.json'),pm);
  fs.writeFileSync(path.join(TDIR,'audit5zz_selftest.test.js'),STCASES); }
const STCASES=`/* temporary self-test cases (selftest.js): never committed */
const H=require('./wallet.test.js'); const {T,sleep}=H; const fs=require('fs'), cp=require('child_process');
const ok=async E=>({pass:true,ev:{ok:1}});
T('st_ok','passes',{wallets:[]},ok);
T('st_ok2','passes too',{wallets:[]},ok);
T('st_fail','assertion fails',{wallets:[]},async E=>({pass:false,ev:{why:'asserted false'}}));
T('st_throw','throws',{wallets:[]},async E=>{ throw new Error('st_throw boom'); });
T('st_reject','unhandled rejection in the page',{wallets:[]},async E=>{ await E.page.evaluate(()=>{ Promise.reject(new Error('st page rejection')); }); await sleep(800); return {pass:true,ev:{}}; });
T('st_noderej','unhandled rejection in Node (case code)',{wallets:[]},async E=>{ Promise.reject(new Error('st node rejection')); await sleep(300); return {pass:true,ev:{}}; });
T('st_crash','renderer crash',{wallets:[]},async E=>{ await E.page.goto('chrome://crash').catch(()=>{}); await sleep(800); return {pass:true,ev:{}}; });
T('st_kill','the browser dies during the case',{wallets:[]},async E=>{ const cdp=await E.page.context().browser().newBrowserCDPSession(); await cdp.send('Browser.crash').catch(()=>{}); await sleep(5000); return {pass:true,ev:{}}; });
T('st_hang','hangs forever',{wallets:[]},async E=>{ if(process.env.ST_MARK) fs.writeFileSync(process.env.ST_MARK,'hang'); await new Promise(()=>{}); });
T('st_freeze','the browser stops answering (SIGSTOP)',{wallets:[]},async E=>{
  const pids=cp.execFileSync('pgrep',['-P',String(process.pid)],{encoding:'utf8'}).split(/\\s+/).filter(Boolean).map(Number);
  if(process.env.ST_MARK) fs.writeFileSync(process.env.ST_MARK,JSON.stringify(pids));
  for(const p of pids) process.kill(p,'SIGSTOP');
  await E.page.evaluate(()=>1); return {pass:true,ev:{}}; });
T('st_cleanhang','passes, then its cleanup never ends (a context whose close never settles)',{wallets:[]},async E=>{ H.LIVE.push({ctx:{close:()=>new Promise(()=>{})},errors:[],outside:[],sockets:[]}); return {pass:true,ev:{}}; });
if(process.env.ST_DUP) T('st_ok','a second case under the same id',{wallets:[]},ok);
if(process.env.ST_BADID) T('bad id!','a malformed id',{wallets:[]},ok);
if(process.env.ST_LOADFAIL) throw new Error('st module load failure');
/* registered last: cases run in registration order, so st_last is always the one after the failing case */
T('st_last','passes, registered last',{wallets:[]},ok);
`;

/* one run of run.sh in the temp tree; resolves {rc,log,j (results json or null),file} */
function run(name,env,o={}){ return new Promise(res=>{
  const out=env.OUT||path.join(TMP,'out-'+name), label='st-'+name;
  const e=Object.assign({},process.env,{PORT:String(PORT),TARGET,LABEL:label,OUT:out},env);
  for(const k of Object.keys(e)) if(e[k]===null) delete e[k];
  const ch=cp.spawn('bash',[path.join(TDIR,'run.sh')],{env:e,detached:true,stdio:['ignore','pipe','pipe']});
  let log=''; ch.stdout.on('data',d=>log+=d); ch.stderr.on('data',d=>log+=d);
  const t0=Date.now(); const hard=setTimeout(()=>{ try{ process.kill(-ch.pid,'SIGKILL'); }catch(e){} },o.hardMs||170000);
  if(o.signalAfterMark){ const iv=setInterval(()=>{ if(fs.existsSync(env.ST_MARK)){ clearInterval(iv); setTimeout(()=>{ try{ o.group?process.kill(-ch.pid,o.signalAfterMark):process.kill(ch.pid,o.signalAfterMark); }catch(e){} },300); } },100); ch.on('exit',()=>clearInterval(iv)); }
  ch.on('close',(rc,sig)=>{ clearTimeout(hard); const file=path.join(out,'results-'+label+'.json'); let j=null; try{ j=JSON.parse(fs.readFileSync(file,'utf8')); }catch(e){}
    fs.writeFileSync(path.join(EVOUT,'st-'+name+'.log'),log); if(j) fs.copyFileSync(file,path.join(EVOUT,'results-st-'+name+'.json'));
    res({rc:rc==null?'signal '+sig:rc,log,j,file,out,ms:Date.now()-t0}); }); }); }

const S=[];   /* [name, fn returning {ok, ev}] */
const sc=(name,fn)=>S.push([name,fn]);
const tmpLeft=out=>{ try{ return fs.readdirSync(out).filter(f=>/\.tmp$/.test(f)); }catch(e){ return []; } };
const ident=j=>!!j&&/^\d{8}T\d{6}Z-\d+-[0-9a-f]{6}$/.test(j.runId)&&!!j.startedAt&&j.target&&j.target.sha256===TSHA&&j.target.source&&typeof j.target.source.commit==='string'
  &&j.harness&&j.harness.files&&j.harness.files['wallet.test.js']&&j.deps&&/^v22/.test(j.deps.node)&&j.deps.playwright&&j.deps.ethers&&typeof j.registered==='number';
const cs=(j,id)=>j&&j.cases.find(c=>c.id===id);

sc('control',async()=>{ const r=await run('control',{CASES:'st_ok,st_ok2'});
  const j=r.j; return {ok:r.rc===0&&j&&j.status==='passed'&&j.completed===true&&j.exit===0&&ident(j)&&!!j.finishedAt&&j.mode==='subset'&&j.executed.join()==='st_ok,st_ok2'&&j.unexecuted.length===0&&j.persistence.ok&&!j.harnessFailures.length&&!tmpLeft(r.out).length&&/XDONE rc=0/.test(r.log),
    ev:{rc:r.rc,status:j&&j.status,completed:j&&j.completed,exit:j&&j.exit,identity:ident(j),runId:j&&j.runId,commit:j&&j.target.source.commit,reason:j&&j.target.source.reason,harness:j&&j.harness.reason}}; });
sc('unwritable-dir',async()=>{ const f=path.join(TMP,'a-file'); fs.writeFileSync(f,'x'); const out=path.join(f,'sub');
  const r=await run('unwritable',{CASES:'st_ok',OUT:out});
  return {ok:r.rc===1&&!fs.existsSync(out)&&/results cannot be saved/.test(r.log)&&!/^PASS /m.test(r.log)&&/XDONE rc=1/.test(r.log),ev:{rc:r.rc,noCaseRan:!/^PASS /m.test(r.log),said:(r.log.match(/HARNESS FAIL.*/g)||[]).slice(0,2)}}; });
for(const [nm,fault] of [['write-fails','write:3'],['rename-fails','rename:3'],['open-fails','open:3'],['final-write-fails','write:5']]) sc(nm,async()=>{
  const r=await run(nm,{CASES:'st_ok,st_ok2',ST_FAULT:fault,NODE_OPTIONS:((process.env.NODE_OPTIONS||'')+' --require '+path.join(TDIR,'selftest-fault.js')).trim()});
  const j=r.j, final=fault==='write:5';
  /* both cases pass; the run must still fail. After a mid-run failure the later snapshots record it; after a failed FINAL write the
     file on disk is the previous snapshot: status "running", never "passed" */
  const ok=r.rc===1&&!!j&&j.executed.length===(final?2:2)&&!tmpLeft(r.out).length&&(final?(j.status==='running'&&j.completed===false&&j.exit===null)
      :(j.status==='failed'&&j.exit===1&&j.persistence.ok===false&&j.persistence.failures.length===1&&j.persistence.failures[0].snapshot===3&&j.harnessFailures.some(h=>/cannot write results/.test(h.msg))&&j.passed.length===2));
  return {ok,ev:{rc:r.rc,status:j&&j.status,exit:j&&j.exit,passed:j&&j.passed,persistence:j&&j.persistence,tmpLeft:tmpLeft(r.out)}}; });
sc('earlier-success-file',async()=>{ const out=path.join(TMP,'out-earlier'); fs.mkdirSync(out,{recursive:true}); const f=path.join(out,'results-st-earlier.json');
  /* an older successful run (new schema), then a run whose first snapshot cannot be written: the old file must not remain as the current one */
  fs.writeFileSync(f,JSON.stringify({schema:'stormglass-wallet-results/2',runId:'20200101T000000Z-1-aaaaaa',status:'passed',completed:true,exit:0,cases:[]}));
  const r=await run('earlier',{OUT:out,CASES:'st_ok',ST_FAULT:'write:1',NODE_OPTIONS:((process.env.NODE_OPTIONS||'')+' --require '+path.join(TDIR,'selftest-fault.js')).trim()});
  const moved=path.join(out,'results-st-earlier.prev-20200101T000000Z-1-aaaaaa.json');
  /* and the old array format, then a browser that cannot launch: the current file is this run's, failed */
  fs.writeFileSync(f,JSON.stringify([{id:'st_ok',pass:true}]));
  const r2=await run('earlier',{OUT:out,CASES:'st_ok',CHROMIUM:'/nonexistent/chrome'});
  const legacy=fs.readdirSync(out).filter(x=>/\.prev-legacy-/.test(x));
  return {ok:r.rc===1&&!fs.existsSync(f+'.never')&&fs.existsSync(moved)&&r2.rc===1&&!!r2.j&&r2.j.runId!=='20200101T000000Z-1-aaaaaa'&&r2.j.status==='harness-failure'&&r2.j.completed===false&&legacy.length===1&&!tmpLeft(out).length,
    ev:{first:{rc:r.rc,currentFileAfter:fs.existsSync(f)?'(rewritten by run 2)':'absent',oldMovedTo:path.basename(moved),exists:fs.existsSync(moved)},second:{rc:r2.rc,runId:r2.j&&r2.j.runId,status:r2.j&&r2.j.status,legacyMoved:legacy}}}; });
sc('launch-fails',async()=>{ const r=await run('launch',{CASES:'st_ok,st_ok2',CHROMIUM:'/nonexistent/chrome'}); const j=r.j;
  return {ok:r.rc===1&&!!j&&j.status==='harness-failure'&&j.completed===false&&j.exit===1&&j.executed.length===0&&j.unexecuted.join()==='st_ok,st_ok2'&&j.harnessFailures.some(h=>/did not launch/.test(h.msg))&&ident(j),
    ev:{rc:r.rc,status:j&&j.status,unexecuted:j&&j.unexecuted,hf:j&&j.harnessFailures.map(h=>h.msg.slice(0,80))}}; });
sc('browser-dies',async()=>{ const r=await run('dies',{CASES:'st_ok,st_kill,st_last'}); const j=r.j, k=cs(j,'st_kill');
  return {ok:r.rc===1&&!!j&&j.status==='incomplete'&&j.completed===false&&j.passed.join()==='st_ok'&&j.failed.join()==='st_kill'&&k.ev.browserGone===true&&j.unexecuted.join()==='st_last',
    ev:{rc:r.rc,status:j&&j.status,passed:j&&j.passed,failed:j&&j.failed,unexecuted:j&&j.unexecuted,kill:k&&k.ev}}; });
sc('renderer-crash',async()=>{ const r=await run('crash',{CASES:'st_crash,st_ok'}); const j=r.j, c=cs(j,'st_crash');
  return {ok:r.rc===1&&!!j&&j.status==='failed'&&j.completed===true&&j.failed.join()==='st_crash'&&j.passed.join()==='st_ok'&&/page crashed/.test(JSON.stringify(c.ev)),ev:{rc:r.rc,status:j&&j.status,crash:c&&c.ev}}; });
sc('page-rejection',async()=>{ const r=await run('prej',{CASES:'st_reject,st_ok'}); const j=r.j, c=cs(j,'st_reject');
  return {ok:r.rc===1&&!!j&&j.failed.join()==='st_reject'&&j.passed.join()==='st_ok'&&/st page rejection/.test(JSON.stringify(c.ev)),ev:{rc:r.rc,status:j&&j.status,c:c&&c.ev}}; });
sc('node-rejection',async()=>{ const r=await run('nrej',{CASES:'st_noderej,st_ok'}); const j=r.j, c=cs(j,'st_noderej');
  return {ok:r.rc===1&&!!j&&j.status==='failed'&&j.failed.join()==='st_noderej'&&/st node rejection/.test(JSON.stringify(c.ev))&&j.harnessFailures.some(h=>/unhandled rejection/.test(h.msg)),ev:{rc:r.rc,status:j&&j.status,c:c&&c.ev,hf:j&&j.harnessFailures.length}}; });
sc('case-exception-and-assertion',async()=>{ const r=await run('exc',{CASES:'st_throw,st_fail,st_ok'}); const j=r.j;
  return {ok:r.rc===1&&!!j&&j.status==='failed'&&j.completed===true&&j.failed.join()==='st_fail,st_throw'.split(',').filter(x=>j.failed.includes(x)).join()&&j.failed.length===2&&/st_throw boom/.test(JSON.stringify(cs(j,'st_throw').ev))&&j.passed.join()==='st_ok',
    ev:{rc:r.rc,failed:j&&j.failed,passed:j&&j.passed}}; });
sc('release-missing-module',async()=>{ /* a release run with audit3b.test.js gone (and the temp module set aside): exit 2, nothing run */
  fs.renameSync(path.join(TDIR,'audit5zz_selftest.test.js'),path.join(TMP,'st.hold')); fs.renameSync(path.join(TDIR,'audit3b.test.js'),path.join(TMP,'a3b.hold'));
  let r; try{ r=await run('rel-missing',{RELEASE:'1'}); } finally{ fs.renameSync(path.join(TMP,'a3b.hold'),path.join(TDIR,'audit3b.test.js')); fs.renameSync(path.join(TMP,'st.hold'),path.join(TDIR,'audit5zz_selftest.test.js')); }
  const j=r.j; return {ok:r.rc===2&&!!j&&j.status==='manifest-mismatch'&&j.mode==='release'&&j.manifest.missingModules.join()==='audit3b.test.js'&&j.manifest.missingIds.length===17&&j.executed.length===0&&j.completed===false&&!/^PASS /m.test(r.log),
    ev:{rc:r.rc,status:j&&j.status,missingModules:j&&j.manifest.missingModules,missingIds:j&&j.manifest.missingIds.length}}; });
sc('release-unlisted-module',async()=>{ const r=await run('rel-extra',{RELEASE:'1'}); const j=r.j;
  return {ok:r.rc===2&&!!j&&j.status==='manifest-mismatch'&&j.manifest.unlistedModules.join()==='audit5zz_selftest.test.js'&&j.manifest.unlistedIds.length>=10&&j.executed.length===0,ev:{rc:r.rc,unlistedModules:j&&j.manifest.unlistedModules,unlistedIds:j&&j.manifest.unlistedIds.length}}; });
sc('release-missing-id',async()=>{ /* the manifest lists an id no module registers (a case deleted or renamed) */
  const mf=path.join(TDIR,'manifest.json'), orig=fs.readFileSync(mf,'utf8'); const m=JSON.parse(orig); m.modules['audit2.test.js'].ids.push('q99');
  m.modules['audit5zz_selftest.test.js']={group:'@audit5',ids:['st_ok','st_ok2','st_fail','st_throw','st_reject','st_noderej','st_crash','st_kill','st_hang','st_freeze','st_cleanhang','st_last']};
  fs.writeFileSync(mf,JSON.stringify(m)); let r; try{ r=await run('rel-id',{RELEASE:'1'}); } finally{ fs.writeFileSync(mf,orig); }
  const j=r.j; return {ok:r.rc===2&&!!j&&j.status==='manifest-mismatch'&&j.manifest.missingIds.join()==='audit2.test.js:q99'&&j.manifest.unlistedModules.length===0,ev:{rc:r.rc,missingIds:j&&j.manifest.missingIds}}; });
sc('release-with-cases',async()=>{ const r=await run('rel-cases',{RELEASE:'1',CASES:'st_ok'}); const j=r.j;
  return {ok:r.rc===2&&!!j&&j.status==='selection-error'&&j.executed.length===0,ev:{rc:r.rc,status:j&&j.status,hf:j&&j.harnessFailures.map(h=>h.msg.slice(0,90))}}; });
sc('unknown-id',async()=>{ const r=await run('unknown',{CASES:'st_ok,zz9'}); const j=r.j;
  return {ok:r.rc===2&&!!j&&j.status==='selection-error'&&j.harnessFailures.some(h=>/unknown case ids in CASES: zz9/.test(h.msg))&&j.executed.length===0&&j.completed===false,ev:{rc:r.rc,status:j&&j.status}}; });
sc('duplicate-id',async()=>{ const r=await run('dup',{CASES:'st_ok',ST_DUP:'1'}); const j=r.j;
  return {ok:r.rc===2&&!!j&&j.status==='registration-error'&&j.harnessFailures.some(h=>/duplicate case id st_ok/.test(h.msg))&&j.executed.length===0,ev:{rc:r.rc,status:j&&j.status}}; });
sc('malformed-id',async()=>{ const r=await run('badid',{CASES:'st_ok',ST_BADID:'1'}); const j=r.j;
  return {ok:r.rc===2&&!!j&&j.status==='registration-error'&&j.harnessFailures.some(h=>/bad case id/.test(h.msg)),ev:{rc:r.rc,status:j&&j.status}}; });
sc('module-load-fails',async()=>{ const r=await run('loadfail',{CASES:'st_ok',ST_LOADFAIL:'1'}); const j=r.j;
  return {ok:r.rc===2&&!!j&&j.status==='registration-error'&&j.harnessFailures.some(h=>/did not load/.test(h.msg)),ev:{rc:r.rc,status:j&&j.status}}; });
sc('empty-selection',async()=>{ const r=await run('empty',{CASES:','}), r2=await run('empty2',{CASES:'@nogroup'});
  return {ok:r.rc===2&&r2.rc===2&&r.j&&r.j.status==='selection-error'&&r2.j&&r2.j.status==='selection-error',ev:{rc:[r.rc,r2.rc]}}; });
sc('dependency-missing',async()=>{ /* playwright and ethers cannot be found: an earlier successful file is moved aside and this run says harness-failure */
  const out=path.join(TMP,'out-dep'), empty=path.join(TMP,'empty-node-path'); fs.mkdirSync(out,{recursive:true}); fs.mkdirSync(empty,{recursive:true});
  fs.writeFileSync(path.join(out,'results-st-dep.json'),JSON.stringify({schema:'stormglass-wallet-results/2',runId:'20200101T000000Z-2-bbbbbb',status:'passed',completed:true,exit:0,cases:[]}));
  const r=await run('dep',{OUT:out,CASES:'st_ok',NODE_PATH:empty}); const j=r.j;
  return {ok:r.rc===1&&!!j&&j.status==='harness-failure'&&j.completed===false&&j.runId!=='20200101T000000Z-2-bbbbbb'&&j.harnessFailures.some(h=>/cannot load (playwright|fakechain\.js \(needs ethers\))/.test(h.msg))&&fs.existsSync(path.join(out,'results-st-dep.prev-20200101T000000Z-2-bbbbbb.json')),
    ev:{rc:r.rc,status:j&&j.status,hf:j&&j.harnessFailures.map(h=>h.msg.slice(0,100))}}; });
sc('target-missing',async()=>{ const r=await run('target',{CASES:'st_ok',TARGET:path.join(TMP,'no-such-index.html')}); const j=r.j;
  return {ok:r.rc===1&&!!j&&j.status==='harness-failure'&&j.target.source.commit==='unknown'&&j.harnessFailures.some(h=>/cannot load TARGET/.test(h.msg))&&j.executed.length===0,ev:{rc:r.rc,status:j&&j.status,source:j&&j.target.source}}; });
sc('hung-case',async()=>{ const r=await run('hang',{CASES:'st_hang,st_last',CASE_TIMEOUT_MS:'5000'}); const j=r.j, c=cs(j,'st_hang');
  return {ok:r.rc===1&&!!j&&j.status==='failed'&&j.completed===true&&j.timedOut.join()==='st_hang'&&c.ev.timedOut===true&&j.passed.join()==='st_last',ev:{rc:r.rc,status:j&&j.status,hang:c&&c.ev,ms:c&&c.ms}}; });
sc('hung-cleanup',async()=>{ /* audit 5b: the cleanup deadline (CLEANUP_TIMEOUT_MS): a case whose contexts never close fails, the run goes on and ends nonzero */
  const r=await run('cleanhang',{CASES:'st_cleanhang,st_last',CLEANUP_TIMEOUT_MS:'4000'}); const j=r.j, c=cs(j,'st_cleanhang');
  return {ok:r.rc===1&&!!j&&j.status==='failed'&&j.failed.join()==='st_cleanhang'&&c.ev.cleanupTimedOut===true&&j.cleanupTimedOut.join()==='st_cleanhang'&&j.passed.join()==='st_last'&&j.harnessFailures.some(h=>/cleanup deadline/.test(h.msg))&&r.ms<60000,
    ev:{rc:r.rc,status:j&&j.status,c:c&&c.ev,ms:r.ms}}; });
sc('frozen-browser',async()=>{ const mark=path.join(TMP,'freeze.mark'); const r=await run('freeze',{CASES:'st_freeze,st_last',CASE_TIMEOUT_MS:'5000',ST_MARK:mark}); const j=r.j;
  let pids=[]; try{ pids=JSON.parse(fs.readFileSync(mark,'utf8')); }catch(e){} /* gone, or a zombie waiting for init to reap it (state Z): either way no longer running */
  const alive=pids.filter(p=>{ try{ return !/^\d+ \(.*\) Z/.test(fs.readFileSync('/proc/'+p+'/stat','utf8')); }catch(e){ return false; } });
  return {ok:r.rc===1&&!!j&&j.status==='incomplete'&&j.completed===false&&j.timedOut.join()==='st_freeze'&&j.unexecuted.join()==='st_last'&&j.harnessFailures.some(h=>/stopped answering/.test(h.msg))&&pids.length>0&&alive.length===0&&r.ms<60000,
    ev:{rc:r.rc,status:j&&j.status,unexecuted:j&&j.unexecuted,stoppedPids:pids,stillAlive:alive,ms:r.ms}}; });
sc('run-watchdog',async()=>{ const r=await run('runwd',{CASES:'st_ok,st_hang,st_last',RUN_TIMEOUT_MS:'12000',CASE_TIMEOUT_MS:'60000'}); const j=r.j;
  return {ok:r.rc===1&&!!j&&j.status==='interrupted'&&j.exit==='interrupted'&&/run watchdog/.test(j.interruptedBy)&&j.completed===false&&j.passed.join()==='st_ok'&&j.running==='st_hang'&&j.unexecuted.join()==='st_hang,st_last'&&r.ms<40000,
    ev:{rc:r.rc,status:j&&j.status,interruptedBy:j&&j.interruptedBy,running:j&&j.running,ms:r.ms}}; });
for(const [nm,sig,code,group] of [['sigterm','SIGTERM',143,false],['sigint','SIGINT',130,false],['sigterm-group','SIGTERM',143,true]]) sc(nm,async()=>{
  const mark=path.join(TMP,nm+'.mark'); const r=await run(nm,{CASES:'st_ok,st_hang,st_last',ST_MARK:mark},{signalAfterMark:sig,group}); const j=r.j;
  return {ok:(group?true:r.rc===code)&&!!j&&j.status==='interrupted'&&j.exit==='interrupted'&&j.exitCode===code&&j.interruptedBy===sig&&j.completed===false&&j.passed.join()==='st_ok'&&j.running==='st_hang'&&j.unexecuted.join()==='st_hang,st_last'&&(group||/XDONE rc=/.test(r.log)),
    ev:{rc:r.rc,status:j&&j.status,exitCode:j&&j.exitCode,interruptedBy:j&&j.interruptedBy,running:j&&j.running,unexecuted:j&&j.unexecuted,xdone:(r.log.match(/XDONE rc=\d+/)||[null])[0]}}; });

(async()=>{ build(); const only=(process.argv[2]||'').split(',').filter(Boolean); let n=0, ok=0; const rows=[];
  for(const [name,fn] of S){ if(only.length&&!only.includes(name)) continue; n++; let r;
    try{ r=await fn(); }catch(e){ r={ok:false,ev:{selftestError:String(e&&e.stack||e).slice(0,300)}}; }
    if(r.ok) ok++; rows.push({name,ok:r.ok,ev:r.ev}); console.log((r.ok?'OK   ':'BAD  ')+name+'  '+JSON.stringify(r.ev).slice(0,500)); }
  fs.writeFileSync(path.join(EVOUT,'selftest-summary.json'),JSON.stringify({at:new Date().toISOString(),tmp:TMP,ok,n,rows},null,1));
  if(process.env.KEEP!=='1') fs.rmSync(TMP,{recursive:true,force:true});
  console.log('SELFTEST '+ok+'/'+n+' passed'+(process.env.KEEP==='1'?' (temp tree kept: '+TMP+')':' (temp tree removed)')); process.exit(ok===n&&n>0?0:1); })();
