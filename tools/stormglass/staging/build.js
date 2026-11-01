#!/usr/bin/env node
/* THE STAGING BUILD: test-wallet.html is DERIVED from index.html, never hand-edited.
     node tools/stormglass/staging/build.js                      # index.html -> test-wallet.html (repo root)
     node tools/stormglass/staging/build.js --check              # rebuild in memory, exit 1 unless test-wallet.html is byte-identical
     node tools/stormglass/staging/build.js --src X --out Y      # another candidate (e.g. a copy of another worktree's index.html)
     node tools/stormglass/staging/build.js --candidate d9ab802  # stamp the candidate commit (its index.html must be byte-identical to the source)
   Every patch is an anchored, counted replacement (CLAUDE.md law 17): an anchor found 0 or 2+ times stops the build (exit 1) and
   says which. The method audit stops the build when index.html uses a wallet/RPC method the staging policy does not classify.
   index.html is only read. The output is written to a .tmp and renamed. The stamp (git short sha of the commit that last touched the
   source, "+mod" when the file differs from that commit, and the sha256 of the source bytes) goes into the page; nothing time-based
   is written, so the same index.html always gives the same test-wallet.html. */
const fs=require('fs'), path=require('path'), crypto=require('crypto'), vm=require('vm'), {execFileSync}=require('child_process');
const HERE=__dirname, ROOT=path.resolve(HERE,'../../..');
const arg=k=>{ const i=process.argv.indexOf(k); return i>0?process.argv[i+1]:null; };
const SRC=path.resolve(arg('--src')||path.join(ROOT,'index.html')), OUT=path.resolve(arg('--out')||path.join(ROOT,'test-wallet.html')), CHECK=process.argv.includes('--check');
const die=m=>{ console.error('STAGING BUILD FAIL '+m); process.exit(1); };
/* the marks that exist only in the staging output (index.html must contain none of them; staging.test.js checks the same list) */
const MARKS=['__SG','sg-banner','sg-stage','TEST BUILD','sgmode','STORMGLASS STAGING','sg.staging.mode','POLICY.FORWARD','SUBMISSION INTERCEPTED'];

/* rev: the candidate commit (--candidate REF, verified: REF's index.html is byte-identical to the source; --check reuses the rev the
   page already carries), else the last commit that touched the file. touched: that last commit. +mod: the file differs from it. */
function stampOf(file,bytes,cand){ const sha256=crypto.createHash('sha256').update(bytes).digest('hex'); let rev='nogit';
  try{ const dir=path.dirname(file), base=path.basename(file);
    rev=execFileSync('git',['-C',dir,'log','-1','--format=%h','--',base],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()||'untracked';
    if(rev!=='untracked'){ const head=execFileSync('git',['-C',dir,'show',rev+':./'+base],{stdio:['ignore','pipe','ignore'],maxBuffer:1<<26});
      if(!head.equals(bytes)) rev+='+mod'; } }catch(e){ if(rev==='nogit') rev='nogit'; }
  const touched=rev;
  if(cand){ const dir=path.dirname(file), base=path.basename(file); let c, blob;
    try{ c=execFileSync('git',['-C',dir,'rev-parse','--short',cand+'^{commit}'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); blob=execFileSync('git',['-C',dir,'show',c+':./'+base],{stdio:['ignore','pipe','ignore'],maxBuffer:1<<26}); }catch(e){ die('candidate '+cand+' is not a commit with '+base); }
    if(!blob.equals(bytes)) die('candidate '+cand+'’s '+base+' is not byte-identical to the source: rebuild from that commit'); rev=c; }
  return {rev,sha256,src:path.basename(file),touched}; }
function once(s,anchor,repl,label){ const n=s.split(anchor).length-1; if(n!==1) die('anchor "'+label+'" found '+n+' times (expected exactly 1): index.html changed shape here: '+JSON.stringify(anchor.slice(0,90)));
  return s.replace(anchor,()=>repl); }
function build(src,stamp){
  const POLICY=require('./policy.js');
  for(const m of MARKS) if(src.includes(m)) die('index.html already contains the staging mark '+JSON.stringify(m)+' (staging code must never reach production)');
  /* 1. METHOD AUDIT: every wallet / JSON-RPC method literal in index.html must be classified by the staging policy */
  const known=new Set([...Object.keys(POLICY.FORWARD),...Object.keys(POLICY.LOCAL),...POLICY.TX,...POLICY.SIGN,...POLICY.READER,...POLICY.KNOWN_UNUSED]);
  const lits=[...new Set([...src.matchAll(/['"`]((?:eth|wallet|net|personal|web3)_[A-Za-z0-9_]+)['"`]/g)].map(m=>m[1]))].sort();
  const unk=lits.filter(m=>!known.has(m)); if(unk.length) die('index.html uses wallet/RPC methods the staging policy does not classify: '+unk.join(', ')+' (classify them in tools/stormglass/staging/policy.js)');
  /* 2. PROVIDER TAPS: the only places the page obtains a provider */
  let out=src;
  const nEth=out.split('window.ethereum').length-1; if(nEth<1) die('no window.ethereum read found: index.html changed shape (the wallet discovery moved?)');
  out=out.split('window.ethereum').join('__SG.eth()');
  const left=[...out.matchAll(/(?:\bwindow|\bglobalThis|\bself|\btop|\bparent)\s*(?:\.\s*ethereum\b|\[\s*['"`]ethereum['"`]\s*\])|(?<![\w.@\/'"-])ethereum\s*\./g)].map(m=>m[0]);
  if(left.length) die('an ethereum provider is read in a way the build does not tap: '+left.join(' | '));
  const n6963=out.split('eip6963:announceProvider').length-1; if(n6963!==1) die('eip6963:announceProvider appears '+n6963+' times (expected 1 listener): discovery changed shape');
  out=once(out,"window.addEventListener('eip6963:announceProvider',e=>{ const d=e&&e.detail;","window.addEventListener('eip6963:announceProvider',e=>{ const d=__SG.detail(e&&e.detail);",'EIP-6963 announcement listener');
  const nWC=out.split('@walletconnect/ethereum-provider').length-1; if(nWC!==1) die('@walletconnect/ethereum-provider appears '+nWC+' times (expected 1: _wcGlobal)');
  out=once(out,"const _wcGlobal=()=>globalThis['@walletconnect/ethereum-provider'];","const _wcGlobal=()=>__SG.wcNS(globalThis['@walletconnect/ethereum-provider']);",'WalletConnect namespace (_wcGlobal)');
  /* 3. THE STAGING RUNTIME, CSS, BANNER, TITLE, ROBOTS */
  const pdir=fs.existsSync(path.join(path.dirname(SRC),'plates'))?path.join(path.dirname(SRC),'plates'):path.join(ROOT,'plates');
  const seeds=fs.readdirSync(pdir).map(f=>/^(\d+)\.gif$/.exec(f)).filter(Boolean).map(m=>+m[1]).sort((a,b)=>a-b);
  let rt=fs.readFileSync(path.join(HERE,'stage.js'),'utf8');
  const pol=fs.readFileSync(path.join(HERE,'policy.js'),'utf8').replace(/\nif\(typeof module[^\n]*\n?$/,'\n');
  rt=once(rt,"/*@@STAMP@@*/{rev:'dev',sha256:'dev',src:'dev',touched:'dev'}",JSON.stringify(stamp),'runtime stamp');
  rt=once(rt,'/*@@POLICY@@*/',pol,'runtime policy');
  rt=once(rt,'/*@@SEEDS@@*/[396693683]',JSON.stringify(seeds.length?seeds:[396693683]),'runtime seeds');
  const css=fs.readFileSync(path.join(HERE,'stage.css'),'utf8');
  for(const [t,s] of [['runtime',rt],['css',css]]) if(/<\/script|<\/style|<!--/i.test(s)) die(t+' contains a closing tag or comment opener');
  try{ new vm.Script(rt,{filename:'stage.js'}); }catch(e){ die('runtime does not compile: '+e.message); }
  const gen='<!-- TEST BUILD of the STORMGLASS page. GENERATED by tools/stormglass/staging/build.js from '+stamp.src+' (git '+stamp.rev+', sha256 '+stamp.sha256+'). Do not edit: rebuild. Not linked from the live site. -->';
  out=once(out,'<head><meta charset="utf-8">','<head><meta charset="utf-8">\n'+gen+'\n<meta name="robots" content="noindex,nofollow">\n<script>\n'+rt+'\n</script>','head start');
  out=once(out,'<title>DITHERVOID // STORMGLASS</title>','<title>TEST BUILD · STORMGLASS staging (not the live site)</title>','title');
  out=once(out,'</head>','<style>\n'+css+'</style>\n</head>','head end');
  out=once(out,'<body>','<body>\n<div id="sg-banner">TEST BUILD · not the live site · candidate '+stamp.rev+'</div>','body start');
  /* 4. every inline script of the output still compiles */
  let k=0; for(const m of out.matchAll(/<script>([\s\S]*?)<\/script>/g)){ k++; try{ new vm.Script(m[1],{filename:'inline-'+k}); }catch(e){ die('inline script '+k+' does not compile after patching: '+e.message); } }
  return {out,report:{taps:{windowEthereum:nEth,eip6963:1,walletconnect:1},methods:lits,seeds:seeds.length,scripts:k}}; }

const srcBytes=fs.readFileSync(SRC); const before=crypto.createHash('sha256').update(srcBytes).digest('hex');
let cand=arg('--candidate');
if(CHECK&&!cand){ try{ const m=/const STAMP=\{"rev":"([0-9a-f]{4,40})"/.exec(fs.readFileSync(OUT,'utf8')); if(m) cand=m[1]; }catch(e){} }
const stamp=stampOf(SRC,srcBytes,cand);
const {out,report}=build(srcBytes.toString('utf8'),stamp);
if(crypto.createHash('sha256').update(fs.readFileSync(SRC)).digest('hex')!==before) die('the source changed during the build');
if(CHECK){ let cur=null; try{ cur=fs.readFileSync(OUT,'utf8'); }catch(e){}
  if(cur!==out){ console.log('STAGING CHECK FAIL '+path.relative(ROOT,OUT)+' is not the build of '+path.relative(ROOT,SRC)+' (git '+stamp.rev+', sha256 '+stamp.sha256.slice(0,16)+'): rebuild'); process.exit(1); }
  console.log('STAGING CHECK OK '+path.relative(ROOT,OUT)+' = build(' +path.relative(ROOT,SRC)+') · git '+stamp.rev+' · sha256 '+stamp.sha256); process.exit(0); }
const tmp=OUT+'.tmp'; fs.writeFileSync(tmp,out); fs.renameSync(tmp,OUT);
console.log('STAGING BUILD OK '+path.relative(process.cwd(),OUT)+' from '+path.relative(process.cwd(),SRC)+' · git '+stamp.rev+' · sha256 '+stamp.sha256+' · '+out.length+' bytes · taps '+JSON.stringify(report.taps)+' · methods '+report.methods.join(',')+' · plate seeds '+report.seeds);
