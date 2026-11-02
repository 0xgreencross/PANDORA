/* VERIFY A RESULTS FILE (audit 5b): the one check every consumer of results-*.json runs before trusting it (reports, evidence, release
   decisions). Pure Node, no dependencies. Exit 0 only when the file is a complete, passing run of exactly what was expected:
     node tools/stormglass/wallet-tests/verify-results.js <results.json> --manifest <manifest.json> --expect-run <runId> --expect-sha <sha256>
          [--expect-candidate <sha256>]   staging: the candidate index.html the tested page was built from (stamp and git show <rev> both)
          [--cases a,b,…]                 a subset run of exactly these ids (default: a RELEASE=1 run of every manifest id)
          [--allow-uncommitted]           accept a target or harness that differs from its commit (recorded, printed as a WARN)
   Rejected (exit 1, every reason printed): not the schema-2 object (the old bare array included); another run id; status not "passed",
   not completed, exit not 0, interrupted; any harness failure or persistence failure (persistence.ok false, any failed snapshot); a target
   sha256 other than --expect-sha (or a staging page that changed during the run); a manifest whose bytes differ from the one the run
   compared against, or a run whose registration did not match it; a mode other than release (or subset with --cases); selected, executed
   or passed ids that are not exactly the expected ids, a duplicate row, any failed, unexecuted, timed-out or cleanup-timed-out case; for
   staging, a build stamp whose candidate sha256 is not what `git show <rev>:index.html` gives, or not --expect-candidate.
   Exit 2: usage error (a missing argument, an unreadable manifest). */
'use strict';
const fs=require('fs'), crypto=require('crypto');
const SCHEMA='stormglass-wallet-results/2';
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
function usage(m){ console.log('VERIFY USAGE '+m+'\n  node verify-results.js <results.json> --manifest <m> --expect-run <runId> --expect-sha <sha256> [--expect-candidate <sha256>] [--cases a,b] [--allow-uncommitted]'); process.exit(2); }
const argv=process.argv.slice(2), A={}; let file=null;
for(let i=0;i<argv.length;i++){ const a=argv[i];
  if(a==='--allow-uncommitted') A.allowUncommitted=true;
  else if(/^--(manifest|expect-run|expect-sha|expect-candidate|cases)$/.test(a)){ if(i+1>=argv.length) usage(a+' needs a value'); A[a.slice(2)]=argv[++i]; }
  else if(/^--/.test(a)) usage('unknown option '+a);
  else if(file==null) file=a; else usage('one results file only'); }
if(!file) usage('no results file'); if(!A.manifest) usage('--manifest is required'); if(!A['expect-run']) usage('--expect-run is required'); if(!A['expect-sha']) usage('--expect-sha is required');
let mraw, mods; try{ mraw=fs.readFileSync(A.manifest); mods=JSON.parse(mraw).modules; if(!mods||typeof mods!=='object') throw new Error('no "modules" object'); }catch(e){ usage('cannot read the manifest '+A.manifest+': '+e.message); }
const manIds=Object.values(mods).flatMap(e=>Array.isArray(e&&e.ids)?e.ids:[]);

const bad=[], warn=[]; const no=m=>bad.push(m);
let j=null; try{ j=JSON.parse(fs.readFileSync(file,'utf8')); }catch(e){ no('cannot read '+file+': '+e.message); }
const same=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const dups=a=>a.filter((x,i)=>a.indexOf(x)!==i);
if(j&&(Array.isArray(j)||typeof j!=='object')) no('not a schema-2 results object ('+(Array.isArray(j)?'the old bare array of case rows: no run id, no completion record':typeof j)+')'), j=null;
if(j){
  if(j.schema!==SCHEMA) no('schema '+JSON.stringify(j.schema)+', want '+SCHEMA);
  if(j.runId!==A['expect-run']) no('run id '+JSON.stringify(j.runId)+', want '+A['expect-run']);
  if(j.status!=='passed') no('status '+JSON.stringify(j.status)+' (not passed)');
  if(j.completed!==true) no('completed is '+JSON.stringify(j.completed));
  if(j.exit!==0||j.exitCode!==0) no('exit '+JSON.stringify(j.exit)+' / exitCode '+JSON.stringify(j.exitCode));
  if(!j.finishedAt) no('no finishedAt: the final snapshot of this run is missing');
  if(j.interruptedBy) no('interrupted by '+j.interruptedBy);
  const hf=Array.isArray(j.harnessFailures)?j.harnessFailures:null; if(!hf) no('no harnessFailures list'); else if(hf.length) no(hf.length+' harness failure(s): '+hf.map(h=>h.msg).join(' | ').slice(0,400));
  const p=j.persistence||{}; if(p.ok!==true) no('persistence.ok is '+JSON.stringify(p.ok)); if(!Array.isArray(p.failures)||p.failures.length) no('persistence failures: '+JSON.stringify(p.failures).slice(0,300));
  const t=j.target||{}; if(t.sha256!==A['expect-sha']) no('target sha256 '+JSON.stringify(t.sha256)+', want '+A['expect-sha']);
  if('sha256AtEnd' in t&&t.sha256AtEnd!==t.sha256) no('the target changed during the run (at the end '+t.sha256AtEnd+')');
  const m=j.manifest||{}; const msha=sha256(mraw);
  if(m.sha256!==msha) no('the run compared against a manifest with sha256 '+JSON.stringify(m.sha256)+', this manifest is '+msha);
  if(m.ok!==true) no('the registration did not match the manifest: '+JSON.stringify(m).slice(0,300));
  const want=A.cases?A.cases.split(',').map(x=>x.trim()).filter(Boolean):manIds;
  if(A.cases){ if(j.mode!=='subset') no('mode '+JSON.stringify(j.mode)+', want subset for --cases'); const extra=want.filter(x=>!manIds.includes(x)); if(extra.length) no('--cases not in the manifest: '+extra.join(',')); }
  else if(j.mode!=='release') no('mode '+JSON.stringify(j.mode)+', want release (RELEASE=1)');
  if(dups(manIds).length) no('the manifest lists ids twice: '+dups(manIds).join(','));
  for(const k of ['selected','executed','passed']){ const v=Array.isArray(j[k])?j[k]:null; if(!v){ no('no '+k+' list'); continue; }
    if(dups(v).length) no(k+' has duplicates: '+dups(v).join(','));
    if(!same(v,want)) no(k+' is not exactly the expected ids (missing '+want.filter(x=>!v.includes(x)).join(',')+'; unexpected '+v.filter(x=>!want.includes(x)).join(',')+')'); }
  for(const k of ['failed','unexecuted','timedOut','cleanupTimedOut']){ const v=j[k]; if(k==='cleanupTimedOut'&&v==null) continue; if(!Array.isArray(v)) no('no '+k+' list'); else if(v.length) no(k+': '+v.join(',')); }
  const rows=Array.isArray(j.cases)?j.cases:null; if(!rows) no('no cases rows');
  else { const ids=rows.map(r=>r.id); if(dups(ids).length) no('case rows twice: '+dups(ids).join(',')); if(!same(ids,want)) no('the case rows are not exactly the expected ids');
    const f=rows.filter(r=>r.pass!==true).map(r=>r.id); if(f.length) no('rows not passing: '+f.join(',')); }
  const src=t.source||{};
  if(src.matchesHead!==true){ const m2='the target is not the committed file ('+(src.reason||'commit '+src.commit)+')'; A.allowUncommitted?warn.push(m2):no(m2+'; --allow-uncommitted to accept'); }
  const h=j.harness||{}; if(!Array.isArray(h.dirty)||h.dirty.length){ const m2='the harness is not its commit ('+(h.reason||JSON.stringify(h.dirty).slice(0,200))+')'; A.allowUncommitted?warn.push(m2):no(m2+'; --allow-uncommitted to accept'); }
  if(j.suite==='staging'){ const s=j.staging||{}, c=s.candidate||{};
    if(c.matchesStamp!==true) no('the staging page\'s build stamp does not match its candidate commit ('+(c.reason||'git show '+c.rev+':index.html has sha256 '+c.gitSha256+', the stamp says '+c.sha256)+')');
    if(A['expect-candidate']&&(c.sha256!==A['expect-candidate']||c.gitSha256!==A['expect-candidate'])) no('candidate sha256 '+JSON.stringify(c.sha256)+' (git '+JSON.stringify(c.gitSha256)+'), want '+A['expect-candidate']); }
  else if(A['expect-candidate']) no('--expect-candidate given but this is a '+JSON.stringify(j.suite)+' run, not staging');
}
for(const w of warn) console.log('VERIFY WARN '+w);
if(bad.length){ console.log('VERIFY REJECTED '+file); for(const b of bad) console.log('  - '+b); process.exit(1); }
console.log('VERIFY OK '+file+' run '+j.runId+' suite '+j.suite+' mode '+j.mode+' '+j.passed.length+'/'+j.selected.length+' passed · target sha256 '+j.target.sha256+(j.suite==='staging'?' · candidate '+j.staging.candidate.sha256+' ('+j.staging.candidate.commit+')':'')+' · manifest '+sha256(mraw).slice(0,16));
process.exit(0);
