/* THE STAGING HARNESS SELF-TESTS (audit 5b, Finding A). Each scenario runs the real entry point (run.sh with
   SCRIPT=../staging/staging.test.js) on a TEMPORARY copy of tools/stormglass/{wallet-tests,staging} and checks the exit status and the
   results file. The copy's staging.test.js gets one injected line before `module.exports` that, when SGST is set, registers temporary
   cases (zz_sgselftest.js, only in the copy: ids stz*); scenario variants of the copy (a case removed, the manifest changed) are written
   for one run and restored. Nothing in the repo is changed; the temp tree is removed at the end (KEEP=1 keeps it).
   OLD=1 runs the same scenarios against the staging runner of 50ac8a5 (git show; no runner.js, no staging manifest): the fail-first
   proof that each scenario catches what the old runner did not (expected: those scenarios report BAD).
   usage (about 5 minutes; run it in the background and poll):
     NODE_PATH=/home/claude/node_modules PORT=8905 OUT=/path/evidence node tools/stormglass/wallet-tests/selftest-staging.js [scenario,...]
   The last line is "SELFTEST-STAGING n/m passed"; the status is 0 only when every scenario behaved as expected. */
const fs=require('fs'), path=require('path'), os=require('os'), cp=require('child_process'), crypto=require('crypto');
const DIR=__dirname, SDIR=path.join(DIR,'../staging'), ROOT=path.join(DIR,'../../..');
const PORT=+process.env.PORT||8905, EVOUT=process.env.OUT||path.join(os.tmpdir(),'staging-selftest'), OLD=process.env.OLD==='1', OLDREV=process.env.OLDREV||'50ac8a5';
const TMP=fs.mkdtempSync(path.join(process.env.ST_TMPDIR||os.tmpdir(),'sg-selftest-'));
const TROOT=path.join(TMP,'root'), TDIR=path.join(TROOT,'tools/stormglass/wallet-tests'), TSDIR=path.join(TROOT,'tools/stormglass/staging');
const PAGEF=path.join(ROOT,'test-wallet.html'), PSHA=crypto.createHash('sha256').update(fs.readFileSync(PAGEF)).digest('hex');
const CAND=(()=>{ try{ return JSON.parse((/const STAMP=(\{[^}]*\})/.exec(fs.readFileSync(PAGEF,'utf8'))||[])[1]).sha256; }catch(e){ return null; } })();
const VERIFY=path.join(DIR,'verify-results.js');
fs.mkdirSync(EVOUT,{recursive:true});
const ANCHOR='module.exports={CASES,T};\n';
const INJECT='/* SELFTEST INJECTION (selftest-staging.js, temp copy only) */ if(process.env.SGST) require(\'./zz_sgselftest.js\')(T,H,CASES);\n';
let PRISTINE='', REALMAN='';
const OKIDS=['stzok','stzok2','stzlast'], ALLIDS=['stzok','stzok2','stzhang','stzcleanup','stzkill','stznoderej','stzctx2','stzlast'];

function build(){ fs.mkdirSync(TDIR,{recursive:true}); fs.mkdirSync(TSDIR,{recursive:true});
  for(const f of fs.readdirSync(ROOT)) if(f!=='tools'&&f!=='.git') fs.symlinkSync(path.join(ROOT,f),path.join(TROOT,f));
  for(const [from,to] of [[DIR,TDIR],[SDIR,TSDIR]]) for(const f of fs.readdirSync(from)) if(fs.statSync(path.join(from,f)).isFile()&&!/^zz-/.test(f)) fs.copyFileSync(path.join(from,f),path.join(to,f));
  if(OLD){ /* the unchanged runner: run.sh, wallet.test.js and staging.test.js of OLDREV; no shared runner, no staging manifest */
    for(const [rel,to] of [['tools/stormglass/wallet-tests/run.sh',TDIR],['tools/stormglass/wallet-tests/wallet.test.js',TDIR],['tools/stormglass/staging/staging.test.js',TSDIR]])
      fs.writeFileSync(path.join(to,path.basename(rel)),cp.execFileSync('git',['-C',ROOT,'show',OLDREV+':'+rel],{maxBuffer:1<<26}));
    for(const f of [path.join(TDIR,'runner.js'),path.join(TSDIR,'manifest.json')]) try{ fs.unlinkSync(f); }catch(e){} }
  let s=fs.readFileSync(path.join(TSDIR,'staging.test.js'),'utf8'); const n=s.split(ANCHOR).length-1; if(n!==1) throw new Error('anchor count '+n);
  PRISTINE=s.replace(ANCHOR,INJECT+ANCHOR); fs.writeFileSync(path.join(TSDIR,'staging.test.js'),PRISTINE);
  try{ REALMAN=fs.readFileSync(path.join(SDIR,'manifest.json'),'utf8'); }catch(e){ REALMAN=''; }
  fs.writeFileSync(path.join(TSDIR,'zz_sgselftest.js'),STCASES);
  /* SG_RUNNER=file: a mutant of runner.js for the mutation proofs (a temp file, never the repo's) */
  if(process.env.SG_RUNNER) fs.copyFileSync(process.env.SG_RUNNER,path.join(TDIR,'runner.js')); }
const STCASES=`/* temporary staging self-test cases (selftest-staging.js): never committed. SGST=ok: the passing ones; all: every one; extra: st99 next to
   the real cases; dup: a second st1 */
module.exports=(T,H,CASES)=>{ const fs=require('fs'), cp=require('child_process'), {sleep}=H; const mode=process.env.SGST;
  const ok=async E=>({pass:true,ev:{ok:1}}); const Q={query:'test-wallet.html?sgmode=sim'};
  if(mode==='extra'){ T('st99','an unexpected case next to the real ones',{wallets:[]},ok,Q); return; }
  if(mode==='dup'){ T('st1','a second st1',{wallets:[]},ok,Q); return; }
  CASES.length=0;
  T('stzok','passes',{wallets:[]},ok,Q);
  T('stzok2','passes too',{wallets:[]},ok,Q);
  if(mode==='all'){
    T('stzhang','hangs forever',{wallets:[]},async E=>{ if(process.env.ST_MARK) fs.writeFileSync(process.env.ST_MARK,'hang'); await new Promise(()=>{}); },Q);
    T('stzcleanup','passes, then its cleanup never ends (a context whose close never settles)',{wallets:[]},async E=>{ H.LIVE.push({ctx:{close:()=>new Promise(()=>{})},errors:[],outside:[],sockets:[]}); return {pass:true,ev:{}}; },Q);
    T('stzkill','the browser dies during the case',{wallets:[]},async E=>{ const cdp=await E.page.context().browser().newBrowserCDPSession(); await cdp.send('Browser.crash').catch(()=>{}); await sleep(5000); return {pass:true,ev:{}}; },Q);
    T('stznoderej','unhandled rejection in Node (case code)',{wallets:[]},async E=>{ Promise.reject(new Error('stz node rejection')); await sleep(300); return {pass:true,ev:{}}; },Q);
    T('stzctx2','unhandled rejection in the page of a second context the case opened',{wallets:[]},async E=>{ const E2=await H.boot({wallets:[]},Q); await E2.page.evaluate(()=>{ Promise.reject(new Error('stz second-context rejection')); }); await sleep(800); return {pass:true,ev:{}}; },Q); }
  T('stzlast','passes, registered last',{wallets:[]},ok,Q); };
`;
const manOf=ids=>JSON.stringify({schema:1,note:'selftest',modules:{'staging.test.js':{group:'@staging',ids}}});
function setFiles(o){ fs.writeFileSync(path.join(TSDIR,'staging.test.js'),o.test||PRISTINE); if(!OLD||o.man) fs.writeFileSync(path.join(TSDIR,'manifest.json'),o.man==null?REALMAN:o.man); }

/* one run of run.sh in the temp tree; resolves {rc,log,j,file,out,ms} */
function run(name,env,o={}){ setFiles(o); return new Promise(res=>{
  const out=env.OUT||path.join(TMP,'out-'+name), label='sg-'+name;
  const e=Object.assign({},process.env,{PORT:String(PORT),LABEL:label,OUT:out,SCRIPT:'../staging/staging.test.js'},env);
  for(const k of Object.keys(e)) if(e[k]===null) delete e[k];
  const ch=cp.spawn('bash',[path.join(TDIR,'run.sh')],{env:e,detached:true,stdio:['ignore','pipe','pipe']});
  let log=''; ch.stdout.on('data',d=>log+=d); ch.stderr.on('data',d=>log+=d);
  const t0=Date.now(); let killed=false; const hard=setTimeout(()=>{ killed=true; try{ process.kill(-ch.pid,'SIGKILL'); }catch(e){} },o.hardMs||(OLD?75000:170000));
  if(o.signalAfterMark){ const iv=setInterval(()=>{ if(fs.existsSync(env.ST_MARK)){ clearInterval(iv); setTimeout(()=>{ try{ process.kill(ch.pid,o.signalAfterMark); }catch(e){} },300); } },100); ch.on('exit',()=>clearInterval(iv)); }
  ch.on('close',(rc,sig)=>{ clearTimeout(hard); const file=path.join(out,'results-'+label+'.json'); let j=null; try{ j=JSON.parse(fs.readFileSync(file,'utf8')); }catch(e){}
    fs.writeFileSync(path.join(EVOUT,(OLD?'old-':'')+'sg-'+name+'.log'),log); if(j) fs.copyFileSync(file,path.join(EVOUT,(OLD?'old-':'')+'results-sg-'+name+'.json'));
    res({rc:killed?'killed after '+(o.hardMs||(OLD?75000:170000))+' ms (hung)':rc==null?'signal '+sig:rc,log,j,file,out,ms:Date.now()-t0}); }); }); }
const verify=(file,args)=>{ const r=cp.spawnSync(process.execPath,[VERIFY,file,...args],{encoding:'utf8'}); return {rc:r.status,out:(r.stdout||'').trim().split('\n').slice(0,4).join(' | ').slice(0,400)}; };

const S=[]; const sc=(name,fn)=>S.push([name,fn]);
const FAULT=f=>({ST_FAULT:f,NODE_OPTIONS:((process.env.NODE_OPTIONS||'')+' --require '+path.join(TDIR,'selftest-fault.js')).trim()});
const tmpLeft=out=>{ try{ return fs.readdirSync(out).filter(f=>/\.tmp$/.test(f)); }catch(e){ return []; } };
const obj=j=>!!j&&!Array.isArray(j)&&typeof j==='object';
const ident=j=>obj(j)&&j.schema==='stormglass-wallet-results/2'&&j.suite==='staging'&&/^\d{8}T\d{6}Z-\d+-[0-9a-f]{6}$/.test(j.runId)&&!!j.startedAt&&j.target&&j.target.sha256===PSHA&&j.target.source&&typeof j.target.source.commit==='string'
  &&j.staging&&j.staging.stamp&&j.staging.candidate&&j.staging.candidate.matchesStamp===true&&j.staging.candidate.sha256===CAND&&/^[0-9a-f]{40}$/.test(j.staging.candidate.commit)
  &&j.harness&&j.harness.files&&j.harness.files['staging/staging.test.js']&&j.harness.files['wallet-tests/runner.js']&&j.deps&&/^v22/.test(j.deps.node)&&j.deps.playwright&&j.deps.ethers&&typeof j.registered==='number';
const cs=(j,id)=>obj(j)&&Array.isArray(j.cases)?j.cases.find(c=>c.id===id):null;
const noPass=log=>!/^PASS /m.test(log);

sc('control-release',async()=>{ const r=await run('control',{RELEASE:'1',SGST:'ok'},{man:manOf(OKIDS)}); const j=r.j;
  const ok1=r.rc===0&&obj(j)&&j.status==='passed'&&j.completed===true&&j.exit===0&&j.mode==='release'&&ident(j)&&!!j.finishedAt&&j.target.sha256AtEnd===PSHA&&j.manifest&&j.manifest.ok===true
    &&j.executed.join()===OKIDS.join()&&j.unexecuted.length===0&&j.persistence.ok&&!j.harnessFailures.length&&!tmpLeft(r.out).length&&/XDONE rc=0/.test(r.log);
  /* the verifier (consumers): accepts this run, rejects a wrong run id, artifact hash, candidate or manifest */
  const mf=path.join(TMP,'man-ok.json'), mreal=path.join(TMP,'man-real.json'); fs.writeFileSync(mf,manOf(OKIDS)); fs.writeFileSync(mreal,REALMAN||'{"modules":{}}');
  const base=j&&j.runId?['--manifest',mf,'--expect-sha',PSHA,'--expect-candidate',String(CAND),'--allow-uncommitted']:[];
  const v={ok:verify(r.file,base.concat(['--expect-run',String(j&&j.runId)])),strict:verify(r.file,['--manifest',mf,'--expect-sha',PSHA,'--expect-run',String(j&&j.runId)]),
    wrongRun:verify(r.file,base.concat(['--expect-run','20200101T000000Z-1-aaaaaa'])),wrongSha:verify(r.file,['--manifest',mf,'--expect-sha','0'.repeat(64),'--expect-run',String(j&&j.runId),'--allow-uncommitted']),
    wrongCand:verify(r.file,['--manifest',mf,'--expect-sha',PSHA,'--expect-candidate','1'.repeat(64),'--expect-run',String(j&&j.runId),'--allow-uncommitted']),
    wrongManifest:verify(r.file,['--manifest',mreal,'--expect-sha',PSHA,'--expect-run',String(j&&j.runId),'--allow-uncommitted'])};
  const ok2=v.ok.rc===0&&v.strict.rc===1&&/harness is not its commit/.test(v.strict.out)&&v.wrongRun.rc===1&&/run id/.test(v.wrongRun.out)&&v.wrongSha.rc===1&&/target sha256/.test(v.wrongSha.out)&&v.wrongCand.rc===1&&/candidate sha256/.test(v.wrongCand.out)&&v.wrongManifest.rc===1&&/manifest/.test(v.wrongManifest.out);
  return {ok:ok1&&ok2,ev:{rc:r.rc,status:j&&j.status,mode:j&&j.mode,completed:obj(j)&&j.completed,identity:ident(j),runId:j&&j.runId,candidate:obj(j)&&j.staging&&j.staging.candidate,verifier:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,x.rc+' '+x.out.slice(0,140)]))}}; });
sc('control-subset-real',async()=>{ const r=await run('real',{CASES:'st2'}); const j=r.j;
  return {ok:r.rc===0&&obj(j)&&j.status==='passed'&&j.completed===true&&j.mode==='subset'&&ident(j)&&j.executed.join()==='st2'&&j.manifest.ok===true&&j.registered===JSON.parse(REALMAN||'{"modules":{"staging.test.js":{"ids":[]}}}').modules['staging.test.js'].ids.length,
    ev:{rc:r.rc,status:j&&j.status,mode:j&&j.mode,executed:j&&j.executed,registered:j&&j.registered}}; });
sc('release-missing-case',async()=>{ const a="T('st32',"; if(PRISTINE.split(a).length!==2) return {ok:false,ev:{anchor:'st32 registration not found once'}};
  const r=await run('missing',{RELEASE:'1'},{test:PRISTINE.replace(a,"(()=>{})('st32',")}); const j=r.j;
  return {ok:r.rc===2&&obj(j)&&j.status==='manifest-mismatch'&&j.mode==='release'&&j.manifest.missingIds.join()==='staging.test.js:st32'&&j.executed.length===0&&j.completed===false&&noPass(r.log),
    ev:{rc:r.rc,status:j&&j.status,missingIds:obj(j)&&j.manifest&&j.manifest.missingIds,ran:(r.log.match(/^PASS /mg)||[]).length}}; });
sc('release-missing-selftest-case',async()=>{ /* the same check on a fast suite (the mutation proof uses it): the manifest lists stzmissing, nothing registers it */
  const r=await run('missing2',{RELEASE:'1',SGST:'ok'},{man:manOf(OKIDS.concat(['stzmissing']))}); const j=r.j;
  return {ok:r.rc===2&&obj(j)&&j.status==='manifest-mismatch'&&j.manifest.missingIds.join()==='staging.test.js:stzmissing'&&j.executed.length===0&&noPass(r.log),
    ev:{rc:r.rc,status:j&&j.status,missingIds:obj(j)&&j.manifest&&j.manifest.missingIds,ran:(r.log.match(/^PASS /mg)||[]).length}}; });
sc('release-unexpected-case',async()=>{ const r=await run('unexpected',{RELEASE:'1',SGST:'extra'}); const j=r.j;
  return {ok:r.rc===2&&obj(j)&&j.status==='manifest-mismatch'&&j.manifest.unlistedIds.join()==='staging.test.js:st99'&&j.executed.length===0&&noPass(r.log),ev:{rc:r.rc,status:j&&j.status,unlistedIds:obj(j)&&j.manifest&&j.manifest.unlistedIds,ran:(r.log.match(/^PASS /mg)||[]).length}}; });
sc('duplicate-case',async()=>{ const r=await run('dup',{RELEASE:'1',SGST:'dup'}); const j=r.j;
  return {ok:r.rc===2&&obj(j)&&j.status==='registration-error'&&j.harnessFailures.some(h=>/duplicate case id st1/.test(h.msg))&&j.executed.length===0,ev:{rc:r.rc,status:j&&j.status,results:!!j}}; });
sc('release-malformed-manifest',async()=>{ const m=JSON.parse(REALMAN||'{"modules":{"staging.test.js":{"group":"@staging","ids":[]}}}'); m.modules['staging.test.js'].ids.push('st1','bad id!');
  const r=await run('badman',{RELEASE:'1'},{man:JSON.stringify(m)}); const j=r.j;
  return {ok:r.rc===2&&obj(j)&&j.status==='manifest-mismatch'&&j.manifest.duplicateIds.some(x=>/^st1 /.test(x))&&j.manifest.malformedIds.some(x=>/bad id!/.test(x))&&j.executed.length===0&&noPass(r.log),
    ev:{rc:r.rc,status:j&&j.status,duplicateIds:obj(j)&&j.manifest&&j.manifest.duplicateIds,malformedIds:obj(j)&&j.manifest&&j.manifest.malformedIds}}; });
sc('release-with-cases',async()=>{ const r=await run('relcases',{RELEASE:'1',CASES:'st2'}); const j=r.j;
  return {ok:r.rc===2&&obj(j)&&j.status==='selection-error'&&j.executed.length===0&&noPass(r.log),ev:{rc:r.rc,status:j&&j.status,ran:(r.log.match(/^PASS /mg)||[]).length}}; });
sc('initial-write-fails',async()=>{ const r=await run('w1',Object.assign({SGST:'all',CASES:'stzok'},FAULT('write:1')));
  /* the first snapshot fails: nothing runs; what is on disk is nothing, or this run's own failure record (the final write may succeed) */
  const j=r.j; return {ok:r.rc===1&&(!j||(obj(j)&&j.status==='harness-failure'&&j.completed===false&&j.executed.length===0&&j.persistence.ok===false))&&noPass(r.log)&&/results cannot be saved/.test(r.log)&&!tmpLeft(r.out).length,
    ev:{rc:r.rc,file:j?{status:j.status,completed:j.completed,persistence:j.persistence}:'absent',noCaseRan:noPass(r.log)}}; });
sc('intermediate-write-fails',async()=>{ const r=await run('w3',Object.assign({SGST:'all',CASES:'stzok,stzok2'},FAULT('write:3'))); const j=r.j;
  return {ok:r.rc===1&&obj(j)&&j.status==='failed'&&j.exit===1&&j.persistence.ok===false&&j.persistence.failures.length===1&&j.persistence.failures[0].snapshot===3&&j.harnessFailures.some(h=>/cannot write results/.test(h.msg))&&j.passed.length===2&&!tmpLeft(r.out).length,
    ev:{rc:r.rc,status:j&&j.status,persistence:obj(j)&&j.persistence}}; });
sc('final-write-fails',async()=>{ const r=await run('w5',Object.assign({SGST:'all',CASES:'stzok,stzok2'},FAULT('write:5'))); const j=r.j;
  return {ok:r.rc===1&&obj(j)&&j.status==='running'&&j.completed===false&&j.exit===null&&j.executed.length===2&&!tmpLeft(r.out).length,ev:{rc:r.rc,status:j&&j.status,completed:obj(j)&&j.completed,exit:obj(j)&&j.exit}}; });
sc('previous-success-then-failed-run',async()=>{ const out=path.join(TMP,'out-prev');
  const r0=await run('prev',{OUT:out,SGST:'all',CASES:'stzok'}); const first=r0.j&&r0.j.runId;
  const r1=await run('prev',Object.assign({OUT:out,SGST:'all',CASES:'stzok'},FAULT('write:4'))); const j=r1.j;   /* snapshot 4 is this run's final one (1 starting, 2 running, 3 after stzok, 4 final) */
  const prevF=first&&path.join(out,'results-sg-prev.prev-'+first+'.json'); let prev=null; try{ prev=JSON.parse(fs.readFileSync(prevF,'utf8')); }catch(e){}
  /* then an earlier success and a run whose first snapshot cannot be written: no current file at all, the success kept under its run id */
  const r2=await run('prev',Object.assign({OUT:out,SGST:'all',CASES:'stzok'},FAULT('write:1')));
  const second=j&&j.runId; let cur=null; try{ cur=JSON.parse(fs.readFileSync(path.join(out,'results-sg-prev.json'),'utf8')); }catch(e){}
  return {ok:r0.rc===0&&!!first&&r1.rc===1&&obj(j)&&j.runId!==first&&j.status!=='passed'&&j.completed===false&&obj(prev)&&prev.status==='passed'&&prev.runId===first&&r2.rc===1&&(cur===null||(cur.runId!==first&&cur.runId!==second&&cur.status==='harness-failure'&&cur.completed===false))&&fs.existsSync(path.join(out,'results-sg-prev.prev-'+second+'.json')),
    ev:{first:{rc:r0.rc,runId:first},second:{rc:r1.rc,runId:second,status:j&&j.status,completed:obj(j)&&j.completed},previousKeptAs:prevF&&path.basename(prevF),previousStatus:prev&&prev.status,third:{rc:r2.rc,currentFile:cur?{runId:cur.runId,status:cur.status}:'absent'}}}; });
sc('previous-success-then-all-writes-fail',async()=>{ /* an earlier success, then a run that can write nothing at all: the earlier success must not remain the current file */
  const out=path.join(TMP,'out-prevall'); const r0=await run('prevall',{OUT:out,SGST:'all',CASES:'stzok'}); const first=r0.j&&r0.j.runId;
  const r1=await run('prevall',Object.assign({OUT:out,SGST:'all',CASES:'stzok'},FAULT('write:all'))); const cur=r1.j;
  return {ok:r0.rc===0&&!!first&&r1.rc===1&&(cur===null||(obj(cur)&&cur.runId!==first&&cur.status!=='passed'))&&fs.existsSync(path.join(out,'results-sg-prevall.prev-'+first+'.json'))&&noPass(r1.log),
    ev:{first:{rc:r0.rc,runId:first},second:{rc:r1.rc,currentFile:cur?{runId:cur.runId,status:cur.status}:'absent',noCaseRan:noPass(r1.log)},previousKept:fs.existsSync(path.join(out,'results-sg-prevall.prev-'+first+'.json'))}}; });
sc('hung-case',async()=>{ const r=await run('hang',{SGST:'all',CASES:'stzhang,stzlast',CASE_TIMEOUT_MS:'5000'}); const j=r.j, c=cs(j,'stzhang');
  return {ok:r.rc===1&&obj(j)&&j.status==='failed'&&j.timedOut.join()==='stzhang'&&c.ev.timedOut===true&&j.passed.join()==='stzlast',ev:{rc:r.rc,status:j&&j.status,hang:c&&c.ev,ms:r.ms}}; });
sc('hung-cleanup',async()=>{ const r=await run('cleanhang',{SGST:'all',CASES:'stzcleanup,stzlast',CLEANUP_TIMEOUT_MS:'4000'}); const j=r.j, c=cs(j,'stzcleanup');
  return {ok:r.rc===1&&obj(j)&&j.status==='failed'&&j.failed.join()==='stzcleanup'&&c.ev.cleanupTimedOut===true&&j.cleanupTimedOut.join()==='stzcleanup'&&j.passed.join()==='stzlast'&&j.harnessFailures.some(h=>/cleanup deadline/.test(h.msg))&&r.ms<60000,
    ev:{rc:r.rc,status:j&&j.status,c:c&&c.ev,ms:r.ms}}; });
sc('run-watchdog',async()=>{ const r=await run('runwd',{SGST:'all',CASES:'stzok,stzhang,stzlast',RUN_TIMEOUT_MS:'15000',CASE_TIMEOUT_MS:'60000'}); const j=r.j;
  return {ok:r.rc===1&&obj(j)&&j.status==='interrupted'&&j.exit==='interrupted'&&/run watchdog/.test(j.interruptedBy)&&j.completed===false&&j.passed.join()==='stzok'&&j.running==='stzhang'&&j.unexecuted.join()==='stzhang,stzlast'&&r.ms<45000,
    ev:{rc:r.rc,status:j&&j.status,interruptedBy:j&&j.interruptedBy,running:j&&j.running,ms:r.ms}}; });
sc('launch-fails',async()=>{ const r=await run('launch',{SGST:'all',CASES:'stzok,stzok2',CHROMIUM:'/nonexistent/chrome'}); const j=r.j;
  return {ok:r.rc===1&&obj(j)&&j.status==='harness-failure'&&j.completed===false&&j.executed.length===0&&j.unexecuted.join()==='stzok,stzok2'&&j.harnessFailures.some(h=>/did not launch/.test(h.msg))&&ident(j),
    ev:{rc:r.rc,status:j&&j.status,results:!!j}}; });
sc('browser-dies',async()=>{ const r=await run('dies',{SGST:'all',CASES:'stzok,stzkill,stzlast'}); const j=r.j, k=cs(j,'stzkill');
  return {ok:r.rc===1&&obj(j)&&j.status==='incomplete'&&j.completed===false&&j.passed.join()==='stzok'&&j.failed.join()==='stzkill'&&k.ev.browserGone===true&&j.unexecuted.join()==='stzlast',
    ev:{rc:r.rc,status:j&&j.status,failed:j&&j.failed,unexecuted:j&&j.unexecuted}}; });
sc('node-rejection',async()=>{ const r=await run('nrej',{SGST:'all',CASES:'stznoderej,stzlast'}); const j=r.j, c=cs(j,'stznoderej');
  return {ok:r.rc===1&&obj(j)&&j.status==='failed'&&j.failed.join()==='stznoderej'&&/stz node rejection/.test(JSON.stringify(c.ev))&&j.passed.join()==='stzlast',ev:{rc:r.rc,status:j&&j.status,c:c&&c.ev}}; });
sc('second-context-page-rejection',async()=>{ const r=await run('ctx2',{SGST:'all',CASES:'stzctx2,stzlast'}); const j=r.j, c=cs(j,'stzctx2');
  return {ok:r.rc===1&&obj(j)&&j.failed.join()==='stzctx2'&&/stz second-context rejection/.test(JSON.stringify(c.ev))&&c.contexts===2&&j.passed.join()==='stzlast',ev:{rc:r.rc,status:j&&j.status,c:c&&c.ev,contexts:c&&c.contexts}}; });
for(const [nm,sig,code] of [['sigterm','SIGTERM',143],['sigint','SIGINT',130]]) sc(nm,async()=>{
  const mark=path.join(TMP,nm+'.mark'); const r=await run(nm,{SGST:'all',CASES:'stzok,stzhang,stzlast',ST_MARK:mark},{signalAfterMark:sig}); const j=r.j;
  return {ok:r.rc===code&&obj(j)&&j.status==='interrupted'&&j.exit==='interrupted'&&j.exitCode===code&&j.interruptedBy===sig&&j.completed===false&&j.passed.join()==='stzok'&&j.running==='stzhang'&&j.unexecuted.join()==='stzhang,stzlast'&&/XDONE rc=/.test(r.log),
    ev:{rc:r.rc,status:j&&j.status,exitCode:obj(j)&&j.exitCode,interruptedBy:obj(j)&&j.interruptedBy,running:obj(j)&&j.running}}; });

(async()=>{ build(); const only=(process.argv[2]||'').split(',').filter(Boolean); let n=0, ok=0; const rows=[];
  for(const [name,fn] of S){ if(only.length&&!only.includes(name)) continue; n++; let r;
    try{ r=await fn(); }catch(e){ r={ok:false,ev:{selftestError:String(e&&e.stack||e).slice(0,300)}}; }
    if(r.ok) ok++; rows.push({name,ok:r.ok,ev:r.ev}); console.log((r.ok?'OK   ':'BAD  ')+name+'  '+JSON.stringify(r.ev).slice(0,600)); }
  fs.writeFileSync(path.join(EVOUT,(OLD?'old-':'')+'selftest-staging-summary.json'),JSON.stringify({at:new Date().toISOString(),old:OLD?OLDREV:null,tmp:TMP,page:PSHA,ok,n,rows},null,1));
  if(process.env.KEEP!=='1') fs.rmSync(TMP,{recursive:true,force:true});
  console.log('SELFTEST-STAGING '+ok+'/'+n+' passed'+(OLD?' (against the OLD runner of '+OLDREV+')':'')+(process.env.KEEP==='1'?' (temp tree kept: '+TMP+')':' (temp tree removed)')); process.exit(ok===n&&n>0?0:1); })();
