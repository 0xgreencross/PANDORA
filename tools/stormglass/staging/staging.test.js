/* THE STAGING TESTS (ids st*): test-wallet.html, built from index.html by build.js, in headless Chromium.
   Same harness as the wallet tests (../wallet-tests/wallet.test.js boot(): fresh context per boot, service workers blocked, every
   WebSocket refused, outside hosts refused, the public RPCs routed to the Node fake chain). In REAL-WALLET mode the harness's mock
   wallet (mockwallet.js) plays the visitor's real wallet: its request log (__MW.log) is what "reached the wallet".
   Run: PORT=8952 SCRIPT=../staging/staging.test.js bash tools/stormglass/wallet-tests/run.sh   (CASES=st1,st3 to select; OUT, LABEL as there)
   The production suite keeps running against index.html (TARGET), not this page. */
const fs=require('fs'), path=require('path'), crypto=require('crypto'), {execFileSync}=require('child_process');
/* audit 5b: the shared runner starts first (earlier results moved aside, first snapshot, signal/error handlers) before anything can fail */
const R=require('../wallet-tests/runner.js'); R.begin(module,{suite:'staging',label:'staging',caseMs:480000});   /* st25 alone takes ~2 min on a quiet machine: 8 min per case by default */
const H=require('../wallet-tests/wallet.test.js');
const {sleep,A1,A2}=H;
const ROOT=path.join(__dirname,'../../..'), OUT=process.env.OUT||'/tmp/claude-0/pr1test', LABEL=process.env.LABEL||'staging';
/* STAGING_PAGE: another build of the staging page served from the repo root (e.g. built from a newer candidate); st1/st11 compare with this repo's index.html */
const BUILD=path.join(__dirname,'build.js'), PAGE=process.env.STAGING_PAGE||'test-wallet.html';
const POLICY=require('./policy.js');
const MARKS=['__SG','sg-banner','sg-stage','TEST BUILD','sgmode','STORMGLASS STAGING','sg.staging.mode','POLICY.FORWARD','SUBMISSION INTERCEPTED'];
const WRITE=new Set(POLICY.TX.concat(POLICY.SIGN,['eth_estimateGas']));
const CASES=[];
/* a malformed or duplicate id: under the runner collected (REGERR: exit 2 with a results file), for any other loader exit 2 at once */
const REGERR=[];
const T=(id,name,cfg,run,o)=>{ const bad=typeof id!=='string'||!/^st[0-9a-z]+$/.test(id)?'bad staging case id '+JSON.stringify(id):CASES.some(c=>c.id===id)?'duplicate case id '+id:null;
  if(bad){ if(!R.active()){ console.log('HARNESS FAIL '+bad); process.exit(2); } REGERR.push(bad+' in staging.test.js'); return; } CASES.push({id,name,cfg,run,o:o||{},file:'staging.test.js'}); };
const mock=(id,x={})=>Object.assign({id,name:'Mock '+id,rdns:'test.'+id.toLowerCase(),chainId:'0x1',accounts:[A1,A2]},x);
const q=m=>PAGE+'?sgmode='+m;
/* page helpers */
const ev=(E,f,a)=>E.page.evaluate(f,a);
const modalOpen=E=>ev(E,()=>__SG.modalOpen());
const modalText=E=>ev(E,()=>__SG.modalText());
async function waitModal(E,ms=8000){ return E.until(()=>modalOpen(E),ms); }
async function clickModal(E,sel){ if(!(await waitModal(E))) throw new Error('no staging panel for '+sel); await E.page.click('#sg-modal '+sel); await sleep(150); }
const toastHas=async(E,re)=>(await E.toasts()).some(x=>re.test(x));
const label=E=>E.label();
async function simConnect(E,pick){ await H.closeWit(E.page); await E.page.click('#wallet'); if(pick&&(await E.until(()=>H.sheetOpen(E.page),2500))) await H.clickSheet(E.page,pick);
  if(!(await E.until(async()=>/0x/.test(await label(E)),8000))) throw new Error('sim did not connect: '+await label(E)); await sleep(300); }
async function realConnect(E,pick){ await H.closeWit(E.page); await E.page.click('#wallet'); if(pick){ if(!(await E.until(()=>H.sheetOpen(E.page),4000))) throw new Error('no picker'); await H.clickSheet(E.page,pick); }
  await clickModal(E,'[data-gate=go]'); if(!(await E.until(async()=>/0x/.test(await label(E)),8000))) throw new Error('real did not connect: '+await label(E)); await sleep(300); }
const mwLog=E=>ev(E,()=>__MW.log.map(x=>({pid:x.pid,method:x.method})));
const sgLog=E=>ev(E,()=>__SG.log.map(x=>({who:x.who,method:x.method,route:x.route,result:x.result})));
const hits=E=>ev(E,()=>Object.assign({},__SG.readerHits));
const txs=E=>ev(E,()=>__SG.txs());
const shot=async(E,name)=>{ const d=process.env.SHOTS; if(d){ fs.mkdirSync(d,{recursive:true}); await E.page.screenshot({path:path.join(d,name+'.png')}); } };

/* ── st1: the page, its stamp, its marks */
T('st1','boots in SIMULATION by default: TEST banner, revision = build stamp of index.html, noindex, TEST title, mock (real) wallets invisible, no request leaves the page',{wallets:[mock('A')],ethereum:'A'},async E=>{
  const src=fs.readFileSync(path.join(ROOT,'index.html')); const sha=crypto.createHash('sha256').update(src).digest('hex');
  /* the stamped candidate must be a commit whose index.html is exactly this one (--candidate, else the last commit that touched it) */
  const shown=fs.readFileSync(path.join(ROOT,PAGE),'utf8'); const rev=(/const STAMP=\{"rev":"([^"]+)"/.exec(shown)||[])[1]||'?';
  let revOk=false; try{ revOk=execFileSync('git',['-C',ROOT,'show',rev+':./index.html'],{maxBuffer:1<<26,stdio:['ignore','pipe','ignore']}).equals(src); }catch(e){}
  await sleep(600);
  const r=await ev(E,()=>({mode:__SG.mode,stamp:__SG.stamp,banner:document.getElementById('sg-banner').textContent,bannerVisible:document.getElementById('sg-banner').getBoundingClientRect().height>=24,title:document.title,
    robots:[...document.querySelectorAll('meta[name=robots]')].map(m=>m.content),rev:document.getElementById('sg-rev').textContent,shaShown:document.getElementById('sg-sha').textContent,
    wallets:WALLETS.map(w=>w.info.rdns),ethIsSim:__SG.isWrapper(__SG.eth())&&!__SG.eth().isMetaMask,panel:document.getElementById('panel').textContent.slice(0,60),hits:Object.keys(__SG.readerHits).length}));
  const leaks=E.outside.length+Object.keys(E.chain.hits).length+E.sockets.length;
  const pass=revOk&&r.mode==='sim'&&r.stamp.rev===rev&&r.stamp.sha256===sha&&r.rev===rev&&sha.startsWith(r.shaShown)&&/TEST BUILD/.test(r.banner)&&/SIMULATION/.test(r.banner)&&r.bannerVisible&&/^TEST BUILD/.test(r.title)&&r.robots.join()==='noindex,nofollow'
    &&r.wallets.length>0&&r.wallets.every(x=>/^sim\.staging\./.test(x))&&!r.wallets.includes('test.a')&&/DAY 13/.test(r.panel)&&r.hits>0&&leaks===0;
  return {pass,ev:{want:{rev,revHasThisIndex:revOk,sha:sha.slice(0,16)},got:r,leaks:{outside:E.outside,chain:E.chain.hits,sockets:E.sockets}}}; },{query:PAGE});

/* ── st2: SIMULATION connect + collect through the production code */
T('st2','SIMULATION: the picker lists the live simulated wallets (twins told apart, the asleep one left off); COLLECT shows the simulated wallet screen; CONFIRMED is tracked by the page’s own trackTx on the simulated readers',{wallets:[mock('A')],ethereum:'A'},async E=>{
  await E.page.click('#wallet'); await E.until(()=>H.sheetOpen(E.page),5000); await sleep(1700); const btns=await H.sheetButtons(E.page);
  await H.clickSheet(E.page,/SIM ALPHA · 1/); await E.until(async()=>/0x/.test(await label(E)),8000); await sleep(300);
  const h0=await hits(E); await H.buy(E); const panel=await waitModal(E); const mt=await modalText(E); await shot(E,'sim_confirm_screen');
  await clickModal(E,'[data-out=confirmed]');
  const ok=await E.until(()=>toastHas(E,/Collecting the plate: confirmed/),15000); const pop=await H.popText(E.page); const h1=await hits(E); const t=await txs(E);
  const sold=await ev(E,()=>ST.day&&ST.day.sold);
  return {pass:btns.length===3&&btns.filter(b=>/SIM ALPHA · [12]/.test(b)).length===2&&!btns.some(b=>/ASLEEP/.test(b))&&panel&&/SIMULATED WALLET/.test(mt)&&/buy\(/.test(mt)&&ok&&/\[OK\] DAY 13 IS YOURS/.test(pop)
    &&(h1.eth_getTransactionReceipt||0)>(h0.eth_getTransactionReceipt||0)&&t.length===1&&t[0].state==='confirmed'&&t[0].from===('0x'+'a11'.padStart(40,'0'))&&E.outside.length===0&&Object.keys(E.chain.hits).length===0,
    ev:{btns,modal:mt.slice(0,160),ok,pop:pop.slice(0,80),receiptReads:[h0.eth_getTransactionReceipt||0,h1.eth_getTransactionReceipt||0],txs:t,sold}}; },{query:q('sim')});

/* ── st3: every outcome, through send() + trackTx (WITNESS, simulated wallet answering automatically) */
const OUTS=[['confirmed',/Your witness payment: confirmed$/],['sped',/confirmed \(sped up in your wallet\)/],['reverted',/failed on Ethereum \(reverted\)/],['cancelled',/cancelled in your wallet after it was sent/],
  ['replaced',/replaced it with another transaction/],['unknown',/cannot confirm it yet/],['rejected',/^Cancelled in your wallet\. Nothing was sent\./],['error',/did not say whether it sent this/]];
T('st3','SIMULATION: confirmed, sped up, reverted, cancelled, replaced, unknown, rejected, wallet error each give the production wording; pending holds until resolved, then confirms (late)',{wallets:[]},async E=>{
  await ev(E,()=>__SG.configure({mine:300,readerMs:20})); await simConnect(E,/SIM ALPHA · 1/); const res=[];
  for(const [o,re] of OUTS){ await ev(E,o=>__SG.configure({auto:o}),o); const n0=(await E.toasts()).length; await H.witness(E,'0.01');
    const ok=await E.until(async()=>(await E.toasts()).slice(n0).some(x=>re.test(x)),20000); res.push({o,ok,last:(await E.toasts()).slice(-1)[0].slice(0,70)}); await H.closeWit(E.page); await sleep(400); }
  await ev(E,()=>__SG.configure({auto:'pending'})); const n0=(await E.toasts()).length; await H.witness(E,'0.01');
  const sent=await E.until(async()=>(await E.toasts()).slice(n0).some(x=>/waiting for Ethereum to confirm/.test(x)),10000); await sleep(4000);
  const held=!(await E.toasts()).slice(n0).some(x=>/confirmed|failed|cannot confirm/.test(x)); const p=(await txs(E)).filter(x=>x.state==='pending'&&!x.replaces);
  await ev(E,h=>__SG.txResolve(h,'confirmed'),p[0]&&p[0].hash); const late=await E.until(async()=>(await E.toasts()).slice(n0).some(x=>/Your witness payment: confirmed$/.test(x)),15000);
  const h=await hits(E); const t=await txs(E);
  return {pass:res.every(r=>r.ok)&&sent&&held&&p.length===1&&late&&h.eth_getBlockByNumber>0&&h.eth_getTransactionCount>0&&t.filter(x=>x.replaces).length===3,
    ev:{res,pending:{sent,held,late},readerHits:h,replacements:t.filter(x=>x.replaces).map(x=>x.to.slice(0,8)+' '+x.action)}}; },{query:q('sim')});

/* ── st4: the COLLECT dialog states: pending, failed (reverted), unknown, and a repeated click while pending */
T('st4','SIMULATION: the COLLECT dialog shows pending, NOT COLLECTED after a revert and the unknown view; a second COLLECT while the wallet screen is open only says so',{wallets:[]},async E=>{
  await ev(E,()=>__SG.configure({mine:300,readerMs:20})); await simConnect(E,/SIM ALPHA · 1/);
  await H.witness(E,'0.01'); await waitModal(E); await E.page.click('#bWit'); await sleep(300); const twice=(await sgLog(E)).filter(x=>x.method==='eth_sendTransaction').length===1;
  const busy=(await E.toasts()).some(x=>/still waiting for your wallet|is in your wallet now|cancel it there first/i.test(x));   /* the busy wording differs between candidates (matrix D3); the one-send count is the guard */ await clickModal(E,'[data-out=rejected]'); await H.closeWit(E.page); await sleep(300);
  await H.buy(E); await waitModal(E); await shot(E,'sim_collect_wallet_open');
  await clickModal(E,'[data-out=pending]'); await E.until(async()=>/PENDING|WAITING|SENT/i.test(await H.popText(E.page)),8000); await sleep(800); const pend=await H.popText(E.page); await shot(E,'sim_collect_pending');
  const p=(await txs(E)).find(x=>x.state==='pending'); await ev(E,h=>__SG.txResolve(h,'reverted'),p.hash);
  await E.until(async()=>/NOT COLLECTED/.test(await H.popText(E.page)),15000); const failed=await H.popText(E.page); await shot(E,'sim_collect_failed');
  await ev(E,()=>{ const x=document.querySelector('#ccard .x, #ccX, #ccClose'); if(x) x.click(); }); await sleep(500);
  await H.buy(E); await clickModal(E,'[data-out=unknown]'); await E.until(async()=>/CANNOT CONFIRM|UNKNOWN|ETHERSCAN/i.test(await H.popText(E.page)),20000); const unk=await H.popText(E.page); await shot(E,'sim_collect_unknown');
  const sends=(await sgLog(E)).filter(x=>x.method==='eth_sendTransaction').length;
  return {pass:twice&&busy&&/PENDING|WAITING|SENT/i.test(pend)&&/NOT COLLECTED/.test(failed)&&/reverted/i.test(failed)&&/CANNOT CONFIRM|UNKNOWN|ETHERSCAN/i.test(unk)&&sends===3,
    ev:{busy,pending:pend.slice(0,90),failed:failed.slice(0,90),unknown:unk.slice(0,120),sends}}; },{query:q('sim')});

/* ── st5: wrong chain (simulated wallet on Base), switch refused then accepted */
T('st5','SIMULATION: wallet on Base: switch refused sends nothing; switch accepted sends once on mainnet',{wallets:[]},async E=>{
  await ev(E,()=>{ __SG.configure({auto:'confirmed',mine:200,readerMs:20}); __SG.wallet('BETA',{switch:'refuse'}); }); await simConnect(E,/SIM BETA/);
  await E.until(async()=>/NOT MAINNET|\[!\]/.test(await label(E)),4000); const wrongLabel=await label(E); await H.witness(E,'0.01'); await E.until(()=>toastHas(E,/another network/),8000); await sleep(800);
  const s1=(await sgLog(E)).filter(x=>x.method==='eth_sendTransaction').length; await H.closeWit(E.page);
  await ev(E,()=>__SG.wallet('BETA',{switch:'accept'})); await H.witness(E,'0.01'); const ok=await E.until(()=>toastHas(E,/Your witness payment: confirmed$/),15000);
  const L=await sgLog(E); const s2=L.filter(x=>x.method==='eth_sendTransaction').length; const chain=await ev(E,()=>__SG.wallet('BETA').chainId);
  return {pass:/NOT MAINNET|\[!\]/.test(wrongLabel)&&s1===0&&ok&&s2===1&&chain==='0x1',ev:{wrongLabel,s1,s2,chain,switches:L.filter(x=>x.method==='wallet_switchEthereumChain').map(x=>x.result||'ok')}}; },{query:q('sim')});

/* ── st6: account change, wallet-side disconnect, DISCONNECT, day rollover */
T('st6','SIMULATION: account change in the wallet, the wallet disconnecting, DISCONNECT, and a simulated day rollover reach the page',{wallets:[]},async E=>{
  await simConnect(E,/SIM ALPHA · 1/); const l0=await label(E);
  await ev(E,()=>__SG.wallet('ALPHA',{ai:1})); await E.until(async()=>(await label(E))!==l0,5000); const l1=await label(E);
  await ev(E,()=>__SG.walletDisconnects('ALPHA')); await E.until(async()=>/CONNECT/.test(await label(E)),5000); const l2=await label(E);
  await simConnect(E,/SIM ALPHA · 1/); await H.disconnectUI(E); await E.until(async()=>/CONNECT/.test(await label(E)),5000); const l3=await label(E);
  const revoke=(await sgLog(E)).some(x=>x.method==='wallet_revokePermissions');
  const d0=await ev(E,()=>ST.day&&ST.day.id); await ev(E,()=>__SG.setSale('rollover')); await E.until(()=>ev(E,()=>ST.day&&ST.day.id===14&&/DAY 14/.test(document.getElementById('panel').textContent)),10000); const d1=await ev(E,()=>ST.day&&ST.day.id);
  const panel=await ev(E,()=>document.getElementById('panel').textContent.slice(0,40));
  return {pass:/0x/.test(l0)&&/0x/.test(l1)&&l1!==l0&&/CONNECT/.test(l2)&&/CONNECT/.test(l3)&&revoke&&d0===13&&d1===14&&/DAY 14/.test(panel),ev:{l0,l1,l2,l3,revoke,days:[d0,d1],panel}}; },{query:q('sim')});

/* ── st7: REAL-WALLET mode: connect / account change / disconnect with the external mock wallet */
T('st7','REAL WALLET: connect asks first (gate), then reaches the wallet; account change and DISCONNECT (revocation) work; only allowlisted methods reach the wallet',{wallets:[mock('A')],ethereum:'A'},async E=>{
  const before=await mwLog(E);
  await E.page.click('#wallet'); const gate=await waitModal(E); const gt=await modalText(E); await shot(E,'real_gate');
  const askedBeforeGate=(await mwLog(E)).filter(x=>x.method==='eth_requestAccounts').length;
  await clickModal(E,'[data-gate=go]'); await E.until(async()=>/0x/.test(await label(E)),8000); const l0=await label(E);
  await E.P('A').set({accounts:[A2,A1]}); await E.P('A').emit('accountsChanged',[A2]); await E.until(async()=>(await label(E))!==l0,5000); const l1=await label(E);
  await H.disconnectUI(E); await E.until(async()=>/CONNECT/.test(await label(E)),5000); await sleep(500);
  const L=await mwLog(E); const methods=[...new Set(L.map(x=>x.method))]; const bad=methods.filter(m=>!(m in POLICY.FORWARD));
  const ep=await ev(E,()=>EP);
  return {pass:gate&&/will now ask to connect/.test(gt)&&/No payment/.test(gt)&&askedBeforeGate===0&&/0x0000…00aa/i.test(l0)&&/0x0000…00bb/i.test(l1)&&L.some(x=>x.method==='wallet_revokePermissions')&&bad.length===0&&ep===null&&before.every(x=>x.method==='eth_chainId'),
    ev:{gate,l0,l1,methods,bad,before:before.map(x=>x.method)}}; },{query:q('real')});

/* ── st8: REAL-WALLET mode: COLLECT, WITNESS, CLAIM and a signature never reach the wallet; the intercept panel is right */
T('st8','REAL WALLET: COLLECT / WITNESS / CLAIM / personal_sign / eth_signTypedData_v4 / wallet_sendCalls never reach the wallet; the intercept panel shows chain, sender, target, value, decoded call; the chosen result is tracked by the page',{wallets:[mock('A')],ethereum:'A'},async E=>{
  await ev(E,()=>__SG.configure({mine:300,readerMs:20})); await realConnect(E);
  await H.buy(E); await waitModal(E); const m1=await modalText(E); await shot(E,'real_intercept_collect');
  const price=await ev(E,()=>{ const r=[...document.querySelectorAll('#sg-modal dt')].map(d=>[d.textContent,d.nextSibling.textContent]); return Object.fromEntries(r); });
  await clickModal(E,'[data-out=confirmed]'); const c1=await E.until(()=>toastHas(E,/Collecting the plate: confirmed/),15000);
  await H.closeWit(E.page); await ev(E,()=>{ const x=document.querySelector('#ccX'); if(x) x.click(); }); await sleep(400);
  await H.witness(E,'0.02'); await waitModal(E); const m2=await modalText(E); await clickModal(E,'[data-out=reverted]'); const c2=await E.until(()=>toastHas(E,/reverted/),15000); await H.closeWit(E.page);
  await E.page.waitForSelector('#claim:not([disabled])',{timeout:8000}).catch(()=>{}); await E.page.click('#claim',{force:true}); await waitModal(E); const m3=await modalText(E); await clickModal(E,'[data-out=rejected]');
  const c3=await E.until(()=>toastHas(E,/^Cancelled in your wallet/),8000);
  const sig=await ev(E,async()=>{ const out={}; for(const [m,p] of [['personal_sign',['0x68656c6c6f','0x00000000000000000000000000000000000000aa']],['eth_signTypedData_v4',['0x00000000000000000000000000000000000000aa','{}']],['wallet_sendCalls',[{calls:[]}]],['eth_sign',['0xaa','0x00']],['foo_bar',[]]]){
      const pr=EP.request({method:m,params:p}).then(()=>'resolved',e=>'refused '+e.code); await new Promise(r=>setTimeout(r,250)); const b=document.querySelector('#sg-modal .sg-b'); if(b) b.click(); out[m]=await pr; } return out; });
  const L=await mwLog(E); const reached=L.filter(x=>WRITE.has(x.method)||!(x.method in POLICY.FORWARD)).map(x=>x.method);
  const t=await txs(E); const C=await ev(E,()=>CFG.contract.toLowerCase());
  const okPanel=/SUBMISSION INTERCEPTED: nothing was sent to your wallet/.test(m1)&&/1 · Ethereum mainnet/.test(price['INTENDED CHAIN'])&&price['SENDER'].toLowerCase()===A1&&price['TARGET'].toLowerCase().startsWith(C)
    &&/^buy\(arg0: 13, arg1: 3\)$/.test(price['ACTION'])&&+price['VALUE'].split(' ')[0]>0.5&&/witness\(arg0: 13\)/.test(m2)&&/0\.02 ETH/.test(m2)&&/claim\(\)/.test(m3);
  return {pass:okPanel&&c1&&c2&&c3&&reached.length===0&&Object.values(sig).every(v=>/^refused (4001|4200)$/.test(v))&&t.length===2&&t.every(x=>x.mode==='intercepted'&&x.from===A1),
    ev:{panel:price,c:[c1,c2,c3],sig,reached,walletMethods:[...new Set(L.map(x=>x.method))],txs:t.map(x=>x.action+' '+x.state)}}; },{query:q('real')});

/* ── st9: every provider the page can reach is a wrapper: a late EIP-6963 announcement, window.ethereum, providers[], WalletConnect */
T('st9','REAL WALLET: a late-announced provider, window.ethereum, providers[] and a WalletConnect provider are all wrapped; writes through each stop at the wrapper; WalletConnect’s own request paths refuse writes too',
  {wallets:[mock('A',{announce:false}),mock('B',{announce:false}),mock('L',{announce:false,name:'Late'})],ethereum:'A',providers:['A','B'],wc:{accounts:[A1],chainId:'0x1'}},async E=>{
  await ev(E,()=>{ const p=__MW.P.L.provider; window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:Object.freeze({info:Object.freeze({uuid:'00000000-0000-4000-8000-00000000004c',name:'Late',icon:'',rdns:'test.late'}),provider:p})})); }); await sleep(300);
  const r=await ev(E,async()=>{ const raw=new Set(Object.values(__MW.P).map(x=>x.provider)); const isW=p=>__SG.isWrapper(p)&&!raw.has(p);
    const ns=_wcGlobal(); const wcp=await ns.EthereumProvider.init({projectId:'x'});
    const all={wallets:WALLETS.map(w=>isW(w.provider)),list:walletList().map(isW),choices:walletChoices().map(w=>isW(w.provider)),eth:isW(__SG.eth()),providers:__SG.eth().providers.map(isW),wc:isW(wcp),wcNSwrapped:ns!==window['@walletconnect/ethereum-provider'],
      lateListed:WALLETS.some(w=>w.info.rdns==='test.late'),sameObject:walletList()[0]===__SG.eth()&&__SG.eth().providers[0]===__SG.eth(),rawLeak:WALLETS.some(w=>raw.has(w.provider))||raw.has(__SG.eth())};
    const tries={};
    const targets=[['late',WALLETS.find(w=>w.info.rdns==='test.late').provider],['eth',__SG.eth()],['providersB',__SG.eth().providers[1]],['wc',wcp]];
    for(const [k,p] of targets){ const pr=p.request({method:'eth_sendTransaction',params:[{from:'0x00000000000000000000000000000000000000aa',to:CFG.contract,value:'0x1',data:'0x'}]}).then(h=>'hash '+String(h).slice(0,6),e=>'refused '+e.code);
      await new Promise(r=>setTimeout(r,300)); const b=document.querySelector('#sg-modal [data-out=rejected]')||document.querySelector('#sg-modal .sg-b'); if(b) b.click(); tries[k]=await pr; }
    /* the raw WalletConnect provider's own paths (inside the bundle): belt */
    tries.wcRawRequest=await __MW.wc.provider.request({method:'eth_sendTransaction',params:[{}]}).then(()=>'resolved',e=>'refused '+e.code);
    tries.wcRawSign=await __MW.wc.provider.request({method:'personal_sign',params:['0x00','0x00']}).then(()=>'resolved',e=>'refused '+e.code);
    return {all,tries}; });
  const L=await mwLog(E); const reached=L.filter(x=>WRITE.has(x.method)).map(x=>x.pid+' '+x.method);
  const a=r.all; const flat=[...a.wallets,...a.list,...a.choices,a.eth,...a.providers,a.wc,a.wcNSwrapped];
  return {pass:flat.every(Boolean)&&a.lateListed&&a.sameObject&&!a.rawLeak&&Object.values(r.tries).every(v=>/^refused 4001$/.test(v))&&reached.length===0,ev:{wrapped:a,tries:r.tries,reached}}; },{query:q('real')});

/* ── st10: mode switch reloads into a clean state */
T('st10','switching modes reloads clean: no provider, account or pending operation crosses; the simulated storage is cleared; real wallets never reach SIMULATION',{wallets:[mock('A')],ethereum:'A'},async E=>{
  await ev(E,()=>__SG.configure({auto:'pending',mine:100,readerMs:20})); await simConnect(E,/SIM ALPHA · 1/); await H.witness(E,'0.01'); await E.until(()=>toastHas(E,/waiting for Ethereum/),10000);
  const simBefore=await ev(E,()=>({txs:__SG.txs().length,simKeys:Object.keys(sessionStorage).filter(k=>k.startsWith('sgsim:')).length}));
  await ev(E,()=>__SG.switchMode('real')); await E.page.waitForFunction(()=>window.__SG&&__SG.mode==='real'&&typeof ST!=='undefined'&&ST.now,null,{timeout:20000}); await sleep(600);
  const inReal=await ev(E,()=>({EP:EP===null,me:me===null,OPLOCK:OPLOCK===null,txs:__SG.txs().length,simKeys:Object.keys(sessionStorage).filter(k=>k.startsWith('sgsim:')||k==='sg.staging.sim').length,wallets:WALLETS.map(w=>__SG.isWrapper(w.provider)&&!__MW.log.some(()=>false)),
    rdns:WALLETS.map(w=>w.info.rdns),url:location.search,label:document.getElementById('wallet').textContent}));
  const mw1=(await mwLog(E)).map(x=>x.method);
  await ev(E,()=>__SG.switchMode('sim')); await E.page.waitForFunction(()=>window.__SG&&__SG.mode==='sim'&&typeof ST!=='undefined'&&ST.now,null,{timeout:20000}); await sleep(600);
  const inSim=await ev(E,()=>({EP:EP===null,txs:__SG.txs().length,rdns:WALLETS.map(w=>w.info.rdns),eth:__SG.eth()===window.ethereum,label:document.getElementById('wallet').textContent}));
  return {pass:simBefore.txs===1&&inReal.EP&&inReal.me&&inReal.OPLOCK&&inReal.txs===0&&inReal.simKeys===0&&inReal.rdns.join()==='test.a'&&/CONNECT/.test(inReal.label)&&mw1.every(m=>m==='eth_chainId')
    &&inSim.EP&&inSim.txs===0&&inSim.rdns.every(x=>/^sim\.staging\./.test(x))&&!inSim.eth&&/CONNECT/.test(inSim.label),ev:{simBefore,inReal,mockAskedInReal:mw1,inSim}}; },{query:q('sim')});

/* ── st11: the build never touches index.html; index.html carries no staging mark; the committed page is the build */
T('st11','index.html is byte-identical before and after the build and carries no staging mark or link; test-wallet.html = build(index.html)',{wallets:[]},async E=>{
  const f=path.join(ROOT,'index.html'); const sha=()=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const s0=sha(); const tmp=path.join(OUT,'st11-test-wallet.html'); fs.mkdirSync(OUT,{recursive:true});
  const cand=(/const STAMP=\{"rev":"([0-9a-f]+)"/.exec(fs.readFileSync(path.join(ROOT,PAGE),'utf8'))||[])[1];
  const out=execFileSync('node',[BUILD,'--out',tmp].concat(cand?['--candidate',cand]:[]),{encoding:'utf8'}); const s1=sha();
  const same=fs.readFileSync(tmp).equals(fs.readFileSync(path.join(ROOT,PAGE)));
  let check='?'; try{ check=execFileSync('node',[BUILD,'--check'],{encoding:'utf8'}).trim(); }catch(e){ check='FAIL '+String(e.stdout||e.message).trim(); }
  const src=fs.readFileSync(f,'utf8'); const marks=MARKS.filter(m=>src.includes(m)); const link=/test-wallet|staging-wallet/.test(src);
  const gitClean=execFileSync('git',['-C',ROOT,'status','--porcelain','--','index.html'],{encoding:'utf8'}).trim();
  fs.unlinkSync(tmp);
  return {pass:s0===s1&&same&&/^STAGING CHECK OK/.test(check)&&!marks.length&&!link&&gitClean==='',ev:{sha:s0.slice(0,16),unchanged:s0===s1,sameAsCommitted:same,check:check.slice(0,120),marks,link,gitClean,build:out.trim().slice(0,100)}}; });

/* ── st12: phone, WalletConnect (simulated): pairing on the panel, a transaction, the phone ending the session; /wc.js never loads */
T('st12','SIMULATION on a phone: the simulated WalletConnect pairs, collects (confirmed) and follows the phone ending the session; the real WalletConnect bundle never loads',{wallets:[]},async E=>{
  await ev(E,()=>__SG.configure({auto:'confirmed',mine:200,readerMs:20}));
  await E.page.click('#wallet'); await E.until(()=>H.sheetOpen(E.page),5000); const pair=await waitModal(E); const pt=await modalText(E); await shot(E,'sim_phone_pair');
  await clickModal(E,'[data-pair=yes]'); const conn=await E.until(async()=>/0x/.test(await label(E)),8000);
  await H.witness(E,'0.01'); const ok=await E.until(()=>toastHas(E,/Your witness payment: confirmed$/),15000);
  await ev(E,()=>__SG.walletDisconnects('PHONE')); const gone=await E.until(async()=>/CONNECT/.test(await label(E)),5000);
  const wcjs=await ev(E,()=>[...document.scripts].some(s=>/\/wc\.js/.test(s.src)));
  return {pass:pair&&/SIMULATED PHONE WALLET/.test(pt)&&conn&&ok&&gone&&!wcjs&&E.sockets.length===0,ev:{pair,conn,ok,gone,wcjs,sockets:E.sockets}}; },
  {query:q('sim'),viewport:{width:390,height:844},mobile:true,ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'});

/* ── st14: REAL WALLET on another network: the switch is asked only after the visitor confirms; CANCEL leaves the wallet alone */
T('st14','REAL WALLET on Base: a WITNESS asks before the network switch; CANCEL on the staging gate asks the wallet nothing and sends nothing; ASK MY WALLET forwards the switch, then the payment is intercepted',{wallets:[mock('A',{chainId:'0x2105'})],ethereum:'A'},async E=>{
  await ev(E,()=>__SG.configure({mine:200,readerMs:20})); await realConnect(E);
  const sw0=await E.P('A').count('wallet_switchEthereumChain'); await H.witness(E,'0.01'); await waitModal(E); const g1=await modalText(E);
  await clickModal(E,'[data-gate=no]'); await E.until(()=>toastHas(E,/another network/),6000); await sleep(500); const sw1=await E.P('A').count('wallet_switchEthereumChain'); const t1=(await E.toasts()).slice(-1)[0];
  await H.closeWit(E.page); await H.witness(E,'0.01'); await clickModal(E,'[data-gate=go]'); await waitModal(E); const m2=await modalText(E); const sw2=await E.P('A').count('wallet_switchEthereumChain');
  await clickModal(E,'[data-out=confirmed]'); const ok=await E.until(()=>toastHas(E,/Your witness payment: confirmed$/),15000);
  const L=await mwLog(E); const reached=L.filter(x=>WRITE.has(x.method)).map(x=>x.method);
  return {pass:/switch to Ethereum mainnet/.test(g1)&&sw0===0&&sw1===0&&/another network/.test(t1)&&sw2===1&&/SUBMISSION INTERCEPTED/.test(m2)&&/witness\(arg0: 13\)/.test(m2)&&ok&&reached.length===0,ev:{gate:g1.slice(0,90),switches:[sw0,sw1,sw2],afterCancel:t1,ok,reached}}; },{query:q('real')});

/* ── st15: REAL WALLET on a phone with WalletConnect (the harness's deterministic WalletConnect mock plays the phone wallet) */
T('st15','REAL WALLET on a phone via WalletConnect: pairing waits for the staging gate; a COLLECT stops at the wrapper (the phone wallet is never asked); DISCONNECT ends the session',{wallets:[],wc:{accounts:[A1],chainId:'0x1'}},async E=>{
  await ev(E,()=>__SG.configure({mine:200,readerMs:20}));
  await E.page.click('#wallet'); const g=await waitModal(E); const gt=await modalText(E); const enables0=await ev(E,()=>__MW.wc.enables);
  await clickModal(E,'[data-gate=go]'); await E.until(()=>ev(E,()=>!!__MW.wc.approve),6000); await ev(E,()=>__MW.wc.approve()); const conn=await E.until(async()=>/0x/.test(await label(E)),8000);
  await H.buy(E); await waitModal(E); const m=await modalText(E); await clickModal(E,'[data-out=confirmed]'); const ok=await E.until(()=>toastHas(E,/Collecting the plate: confirmed/),15000);
  await H.closeWit(E.page); await ev(E,()=>{ const x=document.getElementById('ccX'); if(x) x.click(); }); await sleep(300); await H.disconnectUI(E); const gone=await E.until(async()=>/CONNECT/.test(await label(E)),5000);
  const w=await ev(E,()=>({enables:__MW.wc.enables,disconnects:__MW.wc.disconnects,init:!!__MW.wc.init,wrapped:__SG.isWrapper(_WC)&&_WC!==__MW.wc.provider}));
  const L=await mwLog(E); const reached=L.filter(x=>WRITE.has(x.method)).map(x=>x.method);
  return {pass:g&&/will now ask to connect/.test(gt)&&enables0===0&&conn&&/SUBMISSION INTERCEPTED/.test(m)&&/buy\(arg0: 13/.test(m)&&ok&&gone&&w.enables===1&&w.disconnects===1&&w.wrapped&&reached.length===0,ev:{gate:g,enables0,conn,ok,gone,w,walletMethods:[...new Set(L.map(x=>x.method))],reached}}; },
  {query:q('real'),viewport:{width:390,height:844},mobile:true,ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'});

/* ── st13: the build fails loudly when index.html changes shape (law 17): a moved anchor, an unclassified wallet method, an untapped provider read */
T('st13','the build refuses a changed index.html: a moved EIP-6963 anchor, an unclassified wallet method, an ethereum read it does not tap, a doubled anchor; the earlier candidates f9a6f80 and 553222a still build',{wallets:[]},async E=>{
  const dir=path.join(OUT,'st13'); fs.mkdirSync(dir,{recursive:true}); const src=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const run=(name,txt)=>{ const f=path.join(dir,name+'.html'); fs.writeFileSync(f,txt); try{ const o=execFileSync('node',[BUILD,'--src',f,'--out',path.join(dir,name+'.out.html')],{encoding:'utf8',stdio:['ignore','pipe','pipe']}); return {rc:0,msg:o.trim().slice(0,90)}; }catch(e){ return {rc:e.status,msg:String(e.stderr||'').trim().slice(0,150)}; } };
  const one=(s,a,b)=>{ if(s.split(a).length!==2) throw new Error('fixture anchor '+a); return s.replace(a,b); };
  const r={
    moved6963:run('moved6963',one(src,'const d=e&&e.detail;','const d=e.detail;')),
    method:run('method',one(src,"ask(P,'wallet_revokePermissions'","ask(P,'wallet_disconnect'")),
    untapped:run('untapped',one(src,'eth=window.ethereum;',"eth=globalThis['ethereum'];")),
    doubled:run('doubled',src.replace('</head>','<script>/* const _wcGlobal=()=>globalThis[\'@walletconnect/ethereum-provider\']; */</script></head>')),
    f9a6f80:run('f9a6f80',execFileSync('git',['-C',ROOT,'show','f9a6f80:index.html'],{encoding:'utf8',maxBuffer:1<<26})),
    c553222a:run('553222a',execFileSync('git',['-C',ROOT,'show','553222a:index.html'],{encoding:'utf8',maxBuffer:1<<26})) };
  fs.rmSync(dir,{recursive:true,force:true});
  return {pass:r.moved6963.rc===1&&/EIP-6963/.test(r.moved6963.msg)&&r.method.rc===1&&/wallet_disconnect/.test(r.method.msg)&&r.untapped.rc===1&&/does not tap/.test(r.untapped.msg)&&r.doubled.rc===1&&r.f9a6f80.rc===0&&r.c553222a.rc===0,ev:r}; });

/* ═══ AUDIT 4 SCENARIOS (st16+): driven from CONTROLS (the drawer's own buttons), answered by the page's production code */
const fullLog=E=>ev(E,()=>__SG.log.map(x=>({who:x.who,method:x.method,route:x.route,result:x.result,params:x.params,call:x.call})));
async function drawerOpen(E,on){ const is=await ev(E,()=>!!document.getElementById('sg-drawer')); if(is!==on){ await E.page.click('#sg-ctl'); await sleep(250); } }
async function ctl(E,sel){ await drawerOpen(E,true); const n=await E.page.locator('#sg-drawer '+sel).count(); if(n!==1) throw new Error('control '+sel+' found '+n+' times'); await E.page.locator('#sg-drawer '+sel).scrollIntoViewIfNeeded(); await E.page.click('#sg-drawer '+sel); await sleep(200); }
const PHONE={viewport:{width:390,height:844},mobile:true,ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'};
const sends=L=>L.filter(x=>x.method==='eth_sendTransaction');

/* ── st16: scenario 1, the network changes at the last moment (to Base and back, from COLLECT; to Base, from WITNESS) */
T('st16','SCENARIO 1 from CONTROLS: the simulated wallet answers the final check 0x1, then announces Base (and back) before the page sends: COLLECT and WITNESS stop with the changed-network message; the wallet log has no eth_sendTransaction',{wallets:[]},async E=>{
  await ev(E,()=>__SG.configure({mine:300,readerMs:20}));
  await ctl(E,'[data-lastchain=base-back]'); await ctl(E,'[data-setup=lastchain]'); const armed=await ev(E,()=>__SG.wallet('ALPHA').lastChain); await drawerOpen(E,false);
  await simConnect(E,/SIM ALPHA · 1/); const n0=(await E.toasts()).length;
  await H.buy(E); const stop1=await E.until(async()=>/changed network|another network/i.test(await H.popText(E.page)),15000); await sleep(600);
  const pop1=await H.popText(E.page); const t1=(await E.toasts()).slice(n0); const modal1=await modalOpen(E); await shot(E,'s1_collect_stopped');
  const L1=await fullLog(E); const ev1=L1.filter(x=>x.method==='chainChanged'&&/LAST-MOMENT/.test(x.route)); const lab1=await label(E);
  await ev(E,()=>{ const x=document.getElementById('ccX'); if(x) x.click(); }); await sleep(400);
  await ctl(E,'[data-lastchain=base]'); await ctl(E,'[data-setup=lastchain]'); await drawerOpen(E,false); const n1=(await E.toasts()).length;
  await H.witness(E,'0.01'); const stop2=await E.until(async()=>(await E.toasts()).slice(n1).some(x=>/changed network|another network/i.test(x)),15000); await sleep(800);
  const t2=(await E.toasts()).slice(n1); const L2=await fullLog(E); const lab2=await label(E); const fired=await ev(E,()=>__SG.wallet('ALPHA').fired);
  const est=L2.filter(x=>x.method==='eth_estimateGas').length;
  return {pass:armed==='base-back'&&stop1&&/Nothing was sent/i.test(pop1+t1.join('|'))&&!modal1&&ev1.length===1&&/0x2105.*0x1/.test(ev1[0].params)&&/0x/.test(lab1)&&!/NOT MAINNET/.test(lab1)
    &&stop2&&t2.some(x=>/Nothing was sent/.test(x))&&/NOT MAINNET|\[!\]/.test(lab2)&&fired===2&&est>=2&&sends(L2).length===0&&(await txs(E)).length===0,
    ev:{armed,collect:{pop:pop1.slice(0,120),toasts:t1,label:lab1,event:ev1.map(x=>x.params)},witness:{toasts:t2,label:lab2},fired,estimates:est,sendTransaction:sends(L2).length}}; },{query:q('sim')});

/* ── st17: scenario 2, the ordinary path: the wallet starts on Base, COLLECT asks for the switch, it is accepted, the purchase goes on */
T('st17','SCENARIO 2 from CONTROLS: wallet on Base, COLLECT, the switch is accepted, the purchase goes on mainnet and is confirmed (one switch, one send, chainId 0x1)',{wallets:[]},async E=>{
  await ev(E,()=>__SG.configure({mine:300,readerMs:20})); await ctl(E,'[data-setup=switch]'); const w0=await ev(E,()=>__SG.wallet('ALPHA')); await drawerOpen(E,false);
  await simConnect(E,/SIM ALPHA · 1/); await E.until(async()=>/NOT MAINNET|\[!\]/.test(await label(E)),4000); const lab0=await label(E);
  await H.buy(E); const wrongView=await E.until(async()=>/ANOTHER NETWORK/.test(await H.popText(E.page)),10000); const wv=await H.popText(E.page); await shot(E,'s2_wrong_network_dialog');
  await E.page.click('#nx-switch'); const m=await waitModal(E,12000); const mt=await modalText(E); await shot(E,'s2_after_switch_wallet_screen');
  await clickModal(E,'[data-out=confirmed]'); const ok=await E.until(()=>toastHas(E,/Collecting the plate: confirmed/),15000); await sleep(500); const pop=await H.popText(E.page);
  const L=await fullLog(E); const iSw=L.findIndex(x=>x.method==='wallet_switchEthereumChain'), iTx=L.findIndex(x=>x.method==='eth_sendTransaction');
  const w1=await ev(E,()=>__SG.wallet('ALPHA'));
  return {pass:w0.chainId==='0x2105'&&w0.switch==='accept'&&/NOT MAINNET|\[!\]/.test(lab0)&&wrongView&&/SWITCH TO ETHEREUM/.test(wv)&&m&&/WALLET IS ON1 · Ethereum mainnet/.test(mt)&&/INTENDED CHAIN1 · Ethereum mainnet/.test(mt)&&ok&&/IS YOURS/.test(pop)
    &&L.filter(x=>x.method==='wallet_switchEthereumChain').length===1&&sends(L).length===1&&iSw>=0&&iSw<iTx&&/"chainId":"0x1"/.test(sends(L)[0].params)&&w1.chainId==='0x1',
    ev:{w0,lab0,wrongView:wv.slice(0,80),modal:mt.slice(0,200),ok,pop:pop.slice(0,60),order:[iSw,iTx],send:sends(L).map(x=>x.params)}}; },{query:q('sim')});

/* ── st18: scenario 3, old / foreign WalletConnect events while the new CONFIRM sheet is open (phone, simulated WalletConnect) */
T('st18','SCENARIO 3 from CONTROLS (phone, simulated WalletConnect): an earlier request’s event, a foreign session’s and an old session topic while the CONFIRM sheet is open never reach OPEN; the held deep link is in the log; only this request’s own event gives requestId+sessionTopic',{wallets:[]},async E=>{
  await ev(E,()=>__SG.configure({mine:300,readerMs:20}));
  await ctl(E,'[data-wcevent=earlier]'); await ctl(E,'[data-setup=wc]'); await drawerOpen(E,false);
  await E.page.click('#wallet'); await E.until(()=>H.sheetOpen(E.page),5000); await E.until(()=>ev(E,()=>[...document.querySelectorAll('#wsheet button')].some(b=>/ZERION/.test(b.textContent)&&!b.disabled)),6000);
  await H.clickSheet(E.page,/ZERION/); await clickModal(E,'[data-pair=yes]'); const conn=await E.until(async()=>/0x/.test(await label(E)),8000);
  const pairLink=(await ev(E,()=>__SG.held())).slice(-1)[0]||'';
  const openBtn=()=>ev(E,()=>{ const s=document.getElementById('wsheet'); if(!s||!s.classList.contains('on')) return null; const b=[...s.querySelectorAll('button')].find(b=>/^OPEN /.test(b.textContent)); return b?{t:b.textContent,on:!b.disabled}:null; });
  const tapOpen=()=>ev(E,()=>{ const b=[...document.querySelectorAll('#wsheet button')].find(b=>/^OPEN /.test(b.textContent)); b.click(); });
  const run=async(kind,manual)=>{ if(kind){ await ctl(E,'[data-wcevent='+kind+']'); await ctl(E,'[data-setup=wc]'); await drawerOpen(E,false); }
    await E.until(async()=>!(await openBtn()),5000); const h0=(await ev(E,()=>__SG.held())).length; await H.witness(E,'0.01'); await E.until(async()=>!!(await openBtn())&&/Sending the request/.test(await ev(E,()=>document.getElementById('wsp').textContent)),6000); const sheet=await ev(E,()=>document.getElementById('wsheet').textContent);
    if(manual){ await drawerOpen(E,true); for(const k of manual) await ctl(E,'[data-emit='+k+']'); await drawerOpen(E,false); }
    const t0=Date.now(); await E.until(async()=>(await openBtn()||{}).on,12000); const ms=Date.now()-t0; const said=await ev(E,()=>document.getElementById('wsp').textContent); await shot(E,'s3_'+(kind||'earlier'));
    await tapOpen(); await sleep(300); const link=(await ev(E,()=>__SG.held())).slice(h0).pop()||null; const reqs=await ev(E,()=>__SG.wcReqs()); const own=reqs[reqs.length-1];
    await clickModal(E,'[data-out=rejected]'); await sleep(600); await H.closeWit(E.page);
    return {sheet:sheet.slice(0,40),ms,said:said.slice(0,60),link,own,earlier:reqs.slice(0,-1).map(r=>r.id)}; };
  const r1=await run(null);                       /* earlier request's event (made up: the first request has no predecessor) at 0.3 s, its own at 1.5 s */
  const r2=await run('none',['earlier','foreign']);  /* no own event; the FIRST request's real event and a foreign one, emitted by hand */
  const r3=await run('oldtopic');                 /* this request's params under the earlier session's topic */
  const L=await fullLog(E); const evs=L.filter(x=>x.method==='session_request_sent').map(x=>x.route.replace('simulated WalletConnect event: ',''));
  const exact=(r,o)=>r.link==='https://link.zerion.io/wc?requestId='+o.id+'&sessionTopic='+encodeURIComponent(o.topic);
  const generic=r=>r.link==='https://link.zerion.io/wc';
  const noOld=r=>r.earlier.every(id=>!String(r.link).includes(String(id)))&&!/foreign|simtopic-earlier/.test(String(r.link));
  return {pass:conn&&/^https:\/\/link\.zerion\.io\/wc\?uri=wc%3A/.test(pairLink)&&/CONFIRM IN ZERION/.test(r1.sheet)&&exact(r1,r1.own)&&r1.ms<3000&&/is in ZERION now/.test(r1.said)
    &&generic(r2)&&noOld(r2)&&r2.ms>5000&&/No word yet/.test(r2.said)&&generic(r3)&&noOld(r3)&&r3.ms>5000&&/No word yet/.test(r3.said)&&noOld(r1)
    &&evs.some(x=>/EARLIER request/.test(x))&&evs.some(x=>/FOREIGN/.test(x))&&evs.some(x=>/OLD session/.test(x))&&sends(L).length===3&&E.sockets.length===0,
    ev:{conn,pairLink:pairLink.slice(0,50),r1,r2,r3,events:evs}}; },Object.assign({query:q('sim')},PHONE));

/* ── st19: scenario 4, receipts: valid; a malformed first reader (wrong hash / no status / bad block) and a valid fallback reader */
T('st19','SCENARIO 4 from CONTROLS: valid receipts confirm; a malformed first-reader receipt (wrong hash, no status, a block before the send) is skipped and the fallback reader’s valid receipt decides (confirmed, and reverted when the chain says so)',{wallets:[]},async E=>{
  await ev(E,()=>__SG.configure({mine:300,readerMs:20,auto:'confirmed'})); await simConnect(E,/SIM ALPHA · 1/); const res=[];
  for(const [mode,out,re] of [['valid','confirmed',/Your witness payment: confirmed$/],['first-hash','confirmed',/Your witness payment: confirmed$/],['first-status','reverted',/failed on Ethereum \(reverted\)/],['first-block','confirmed',/Your witness payment: confirmed$/]]){
    await ctl(E,'[data-receipts='+mode+']'); await ctl(E,'[data-setup=receipts]'); await drawerOpen(E,false); await ev(E,o=>__SG.configure({auto:o}),out);
    const n0=(await E.toasts()).length, l0=(await fullLog(E)).length; await H.witness(E,'0.01');
    const ok=await E.until(async()=>(await E.toasts()).slice(n0).some(x=>re.test(x)),15000); await sleep(300);
    const t=(await E.toasts()).slice(n0); const L=(await fullLog(E)).slice(l0).filter(x=>x.method==='eth_getTransactionReceipt'&&/^reader/.test(x.who));
    res.push({mode,ok,set:await ev(E,()=>__SG.set.receipts),wrongVerdict:t.some(x=>out==='confirmed'?/reverted/.test(x):/: confirmed/.test(x)),answers:L.map(x=>x.who.replace('reader ','')+': '+x.route.replace(/^answered (a |the )?/,'').slice(0,40))});
    await H.closeWit(E.page); await sleep(300); }
  const good=r=>r.ok&&!r.wrongVerdict&&r.set===r.mode&&(r.mode==='valid'?r.answers.length===0:r.answers.length>=2&&/MALFORMED/.test(r.answers[0])&&r.answers.some(a=>/VALID/.test(a)&&a.split(':')[0]!==r.answers[0].split(':')[0]));
  return {pass:res.every(good),ev:{res}}; },{query:q('sim')});

/* ── st20: scenario 4, every reader invalid, with the FAST CLOCK: pending, then "cannot confirm" (TRACK.lost), then unknown (TRACK.stop); never confirmed or reverted */
T('st20','SCENARIO 4 from CONTROLS: ALL READERS INVALID with the FAST CLOCK (staging only, shown in the banner): the payment stays pending, says cannot confirm at 20 s and RESULT UNKNOWN to the end (45 s), never confirmed or reverted; NORMAL restores the page’s deadlines',{wallets:[]},async E=>{
  const t0k=await ev(E,()=>__SG.track()); await ev(E,()=>__SG.configure({mine:300,readerMs:20}));
  await ctl(E,'[data-receipts=all]'); await ctl(E,'[data-setup=receipts]'); await drawerOpen(E,false);
  const fast=await ev(E,()=>({track:__SG.track(),set:[__SG.set.receipts,__SG.set.clock],chip:!document.getElementById('sg-fast').hidden&&document.getElementById('sg-fast').getBoundingClientRect().width>0}));
  await simConnect(E,/SIM ALPHA · 1/); await H.buy(E); await clickModal(E,'[data-out=confirmed]'); const tS=Date.now();
  await E.until(async()=>/PENDING/i.test(await H.popText(E.page)),8000); const pend=await H.popText(E.page);
  const atLost=await E.until(async()=>/UNKNOWN|CANNOT CONFIRM/i.test(await H.popText(E.page)),30000); const msLost=Date.now()-tS; const unk=await H.popText(E.page); await shot(E,'s4_all_invalid_unknown');
  const before=(await fullLog(E)).filter(x=>x.method==='eth_getTransactionReceipt'&&/^reader/.test(x.who)).length;
  await E.until(async()=>(await E.toasts()).filter(x=>/cannot confirm it yet/.test(x)).length>=2,40000); const msStop=Date.now()-tS; await sleep(4000);
  const L=(await fullLog(E)).filter(x=>x.method==='eth_getTransactionReceipt'&&/^reader/.test(x.who)); const after=L.length; await sleep(4000); const later=(await fullLog(E)).filter(x=>x.method==='eth_getTransactionReceipt'&&/^reader/.test(x.who)).length;
  const toasts=await E.toasts(); const verdict=toasts.some(x=>/: confirmed|reverted/.test(x)); const pop=await H.popText(E.page);
  const hosts=[...new Set(L.map(x=>x.who))]; const allBad=L.every(x=>/MALFORMED/.test(x.route));
  await ctl(E,'[data-clock=normal]'); const back=await ev(E,()=>({track:__SG.track(),chip:document.getElementById('sg-fast').hidden}));
  return {pass:t0k.lost===600000&&t0k.stop===3600000&&t0k.poll===3000&&fast.track.lost===20000&&fast.track.stop===45000&&fast.track.poll===1500&&fast.set.join()==='all,fast'&&fast.chip
    &&/PENDING/i.test(pend)&&atLost&&msLost>=17000&&msLost<32000&&/UNKNOWN|CANNOT CONFIRM/i.test(unk)&&msStop>=42000&&msStop<70000&&after===later&&before<after&&!verdict&&!/IS YOURS|NOT COLLECTED/.test(pop)
    &&hosts.length===3&&allBad&&back.track.lost===600000&&back.track.stop===3600000&&back.track.poll===3000&&back.chip,
    ev:{page:t0k,fast,pend:pend.slice(0,60),msLost,unk:unk.slice(0,80),msStop,receiptAnswers:[before,after,later],hosts,allBad,verdict,pop:pop.slice(0,60),back,cannot:toasts.filter(x=>/cannot confirm/.test(x)).length}}; },{query:q('sim')});

/* ── st21: REAL WALLET: the method list re-enumerated against policy.js; the receipt controls and the fast clock act on intercepted payments; the external wallet never receives a write or a signature; the WalletConnect wrapper's session is a frozen copy */
T('st21','REAL WALLET: every method literal in index.html is classified (no overlap between forwarded and write/sign); a malformed first reader then a valid one confirms an intercepted COLLECT; the external wallet receives only allowlisted methods (no write, no signature); session is a frozen copy on the WalletConnect wrapper',
  {wallets:[mock('A')],ethereum:'A',wc:{accounts:[A1],chainId:'0x1'}},async E=>{
  const src=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'); const lits=[...new Set([...src.matchAll(/['"`]((?:eth|wallet|net|personal|web3)_[A-Za-z0-9_]+)['"`]/g)].map(m=>m[1]))].sort();
  const F=Object.keys(POLICY.FORWARD), W=new Set(POLICY.TX.concat(POLICY.SIGN)); const known=new Set([...F,...Object.keys(POLICY.LOCAL),...POLICY.TX,...POLICY.SIGN,...POLICY.READER,...POLICY.KNOWN_UNUSED]);
  const unclassified=lits.filter(m=>!known.has(m)), overlap=F.filter(m=>W.has(m)||m in POLICY.LOCAL), sentByPage=lits.filter(m=>!POLICY.READER.includes(m));
  await ev(E,()=>__SG.configure({mine:300,readerMs:20})); await ctl(E,'[data-receipts=first-hash]'); await ctl(E,'[data-setup=receipts]'); await drawerOpen(E,false);
  await realConnect(E); await H.buy(E); await waitModal(E); const m=await modalText(E); await clickModal(E,'[data-out=confirmed]');
  const ok=await E.until(()=>toastHas(E,/Collecting the plate: confirmed/),15000); const L=await fullLog(E); const rc=L.filter(x=>x.method==='eth_getTransactionReceipt'&&/^reader/.test(x.who)).map(x=>x.who+' '+x.route.slice(0,30));
  const wcs=await ev(E,async()=>{ const p=await _wcGlobal().EthereumProvider.init({projectId:'x'}); const s0=p.session; return {wrapped:__SG.isWrapper(p),raw:p===__MW.wc.provider,before:s0===undefined}; });
  const wcs2=await ev(E,async()=>{ __MW.wc.provider.session={topic:'t0pic',peer:{metadata:{name:'Phone',url:'https://x.invalid',redirect:{native:'phone://'}}},secret:{k:1}}; const p=await _wcGlobal().EthereumProvider.init({projectId:'x'}); const s=p.session;
    let wrote=false; try{ s.topic='other'; wrote=s.topic==='other'; }catch(e){} return {topic:s.topic,name:s.peer.metadata.name,native:s.peer.metadata.redirect.native,frozen:Object.isFrozen(s)&&Object.isFrozen(s.peer.metadata),secret:'secret' in s,notRaw:s!==__MW.wc.provider.session,wrote}; });
  const MW=await mwLog(E); const reached=[...new Set(MW.map(x=>x.method))]; const bad=reached.filter(x=>!F.includes(x)||W.has(x));
  return {pass:!unclassified.length&&!overlap.length&&sentByPage.every(x=>known.has(x))&&/SUBMISSION INTERCEPTED/.test(m)&&/does not test your wallet’s own payment screen/.test(m)&&/WalletConnect relay/.test(m)&&ok&&rc.length>=2&&/MALFORMED/.test(rc[0])&&/VALID/.test(rc[rc.length-1])
    &&wcs.wrapped&&!wcs.raw&&wcs.before&&wcs2.topic==='t0pic'&&wcs2.name==='Phone'&&wcs2.native==='phone://'&&wcs2.frozen&&!wcs2.secret&&wcs2.notRaw&&!wcs2.wrote&&!bad.length,
    ev:{methods:lits,forwarded:F,overlap,unclassified,ok,receipts:rc,wc:[wcs,wcs2],walletReceived:reached,bad}}; },{query:q('real')});

/* ── st22: the staging page differs from index.html by exactly the build's documented patches (undo them and the bytes are index.html's) */
T('st22','test-wallet.html minus the documented patches (head insert, title, style, banner, the three provider taps) is index.html byte for byte; the build prints the same patch list',{wallets:[]},async E=>{
  const src=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'), pg=fs.readFileSync(path.join(ROOT,PAGE),'utf8'), css=fs.readFileSync(path.join(__dirname,'stage.css'),'utf8');
  const cnt=(s,a)=>s.split(a).length-1; let u=pg; const undo=[];
  const cut=(label,re,want)=>{ const m=u.match(re); const n=m?1:0; undo.push({label,n}); if(m) u=u.replace(re,want); };
  cut('head insert (generated comment, robots noindex, staging runtime script)',/^([\s\S]*?<head><meta charset="utf-8">)\n<!-- TEST BUILD [^\n]*-->\n<meta name="robots" content="noindex,nofollow">\n<script>\n[\s\S]*?\n<\/script>/,'$1');
  cut('title',/<title>TEST BUILD · STORMGLASS staging \(not the live site\)<\/title>/,'<title>DITHERVOID // STORMGLASS</title>');
  const st='<style>\n'+css+'</style>\n</head>'; undo.push({label:'stage.css before </head>',n:cnt(u,st)}); u=u.split(st).join('</head>');
  cut('banner after <body>',/<body>\n<div id="sg-banner">TEST BUILD · not the live site · candidate [0-9a-f+mod]+<\/div>/,'<body>');
  const tap=(label,a,b)=>{ undo.push({label,n:cnt(u,a)}); u=u.split(a).join(b); };
  tap('EIP-6963 detail tap','const d=__SG.detail(e&&e.detail);','const d=e&&e.detail;');
  tap('WalletConnect namespace tap',"const _wcGlobal=()=>__SG.wcNS(globalThis['@walletconnect/ethereum-provider']);","const _wcGlobal=()=>globalThis['@walletconnect/ethereum-provider'];");
  tap('window.ethereum taps','__SG.eth()','window.ethereum');
  const same=u===src; const marks=MARKS.filter(x=>u.includes(x));
  let rep=null; try{ rep=JSON.parse(execFileSync('node',[BUILD,'--patches','--out',path.join(OUT,'st22.html')].concat((/const STAMP=\{"rev":"([0-9a-f]+)"/.exec(pg)||[])[1]?['--candidate',(/const STAMP=\{"rev":"([0-9a-f]+)"/.exec(pg)||[])[1]]:[]),{encoding:'utf8'}).split('\n').find(l=>l.startsWith('{'))); }catch(e){ rep={error:String(e.message).slice(0,200)}; }
  try{ fs.unlinkSync(path.join(OUT,'st22.html')); }catch(e){}
  const nEth=cnt(src,'window.ethereum');
  const okCounts=undo.every(x=>x.label==='window.ethereum taps'?x.n===nEth:x.n===1);
  const okRep=rep&&Array.isArray(rep.patches)&&rep.patches.length===7&&rep.patches.find(p=>/window\.ethereum/.test(p.label)).count===nEth&&rep.patches.every(p=>p.count>=1);
  return {pass:same&&!marks.length&&okCounts&&okRep,ev:{same,firstDiff:same?null:[...u].findIndex((c,i)=>c!==src[i]),marks,undo,patches:rep&&rep.patches}}; });

/* ═══ AUDIT 5 (st23+): nonce identity, explicit wallet choice on a phone, WITHDRAW TO ANOTHER ADDRESS, payout outcomes, the write enumeration.
   Every case is driven from CONTROLS (the drawer's own buttons) and answered by the page's production code. */
const {ethers}=require('ethers');
const IN_APP={ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MetaMaskMobile/7.40.0',viewport:{width:390,height:844},mobile:true};
const ctlJS=async(E,sel)=>{ await drawerOpen(E,true); const ok=await ev(E,s=>{ const b=document.querySelector('#sg-drawer '+s); if(!b) return false; b.click(); return true; },sel); if(!ok) throw new Error('control '+sel+' not found'); await sleep(200); };
const toastsOn=E=>ev(E,()=>{ window.__toasts=[]; const t=document.getElementById('toast'); new MutationObserver(()=>{ if(t.textContent) window.__toasts.push(t.textContent); }).observe(t,{childList:true,characterData:true,subtree:true}); });
const afterReload=async E=>{ await E.page.waitForFunction(()=>window.__SG&&typeof ST!=='undefined'&&ST&&ST.now&&document.getElementById('panel')&&document.getElementById('panel').textContent.length>10,null,{timeout:30000}); await toastsOn(E); await sleep(600); };
const wlog=(L,re)=>L.filter(x=>re.test(x.who));
const R1L='0x52908400098527886e0f7030069857d2e4169ee7', R1=ethers.getAddress(R1L), R2L='0xde709f2102306220921060314715629080e2fb77', R2=ethers.getAddress(R2L);
const SGI=new ethers.Interface(['function withdrawTo(address)']);
const ALPHA1='0x'+'a11'.padStart(40,'0');

/* ── st23: scenario 5, whose transaction is this? */
const idToasts=(E,n0)=>E.toasts().then(t=>t.slice(n0));
const FALSE_VERDICT=/replaced it|cancelled in your wallet after|: confirmed|failed on Ethereum|sped up|cannot confirm/i;
async function idRow(E,mode,wallet,auto){
  await ev(E,a=>__SG.configure({mine:300,readerMs:20,auto:a}),auto||'pending');
  await ctl(E,'[data-txid="'+mode+'"]'); await ctl(E,'[data-txidwallet="'+(wallet?1:0)+'"]'); await ctl(E,'[data-setup=txid]'); await drawerOpen(E,false);
  const set=await ev(E,()=>[__SG.set.txid,__SG.set.txidWallet]);
  if(!/0x/.test(await label(E))) await simConnect(E,/SIM ALPHA · 1/); const n0=(await E.toasts()).length; const l0=(await fullLog(E)).length; await H.witness(E,'0.01');
  const sent=await E.until(async()=>(await txs(E)).some(x=>x.action==='witness'&&!x.unrelated&&x.state==='pending'),10000);
  const byHash=async()=>(await fullLog(E)).slice(l0).filter(x=>x.method==='eth_getTransactionByHash');
  const firstMode=/^first-/.test(mode);
  /* the gate: the trigger really happened (a reader or the wallet served the poisoned / malformed answer, and, for first-*, the fallback served the true one) */
  const gate=await E.until(async()=>{ const L=await byHash(); const bad=L.filter(x=>/ANOTHER|NO HASH|DECIMAL/.test(x.route+x.result)); const good=L.filter(x=>/VALID/.test(x.route+x.result));
    if(firstMode) return bad.length>=1&&good.length>=1&&(await hits(E)).eth_getTransactionCount>=1;
    return new Set(L.filter(x=>/^reader/.test(x.who)&&/ANOTHER/.test(x.route)).map(x=>x.who)).size>=3&&wlog(L,/^SIM/).length>=(wallet?2:1); },25000);
  const lg=await byHash(); const readers=[...new Set(lg.filter(x=>/^reader/.test(x.who)).map(x=>x.who.replace('reader ','')))];
  if(!firstMode) await E.until(async()=>(await byHash()).filter(x=>/^SIM/.test(x.who)).length>=(wallet?2:1),12000);
  const wAsks=(await byHash()).filter(x=>/^SIM/.test(x.who)); const rounds=wallet?true:await E.until(async()=>(await hits(E)).eth_getTransactionCount>=3,12000);   /* a nonce known: the page counts the sender's transactions every round and finds nothing spent */
  const ts=await idToasts(E,n0); const pend=(await txs(E)).filter(x=>x.action==='witness'&&!x.unrelated).slice(-1)[0];
  return {n0,mode,wallet:!!wallet,set,sent,gate,rounds,readers,readerAnswers:lg.filter(x=>/^reader/.test(x.who)).slice(0,4).map(x=>x.who.replace('reader ','')+': '+x.route.slice(0,70)),walletAsks:wAsks.map(x=>x.result.slice(0,50)),toasts:ts.map(x=>x.slice(0,60)),falseVerdict:ts.some(x=>FALSE_VERDICT.test(x)),waiting:ts.some(x=>/waiting for Ethereum/.test(x)),pend:pend&&pend.state}; }
T('st23','SCENARIO 5 from CONTROLS: an unrelated transaction of the same sender (another hash; same, next or a lower, mined nonce) or an unusable answer from the first reader never makes the page say replaced, cancelled or confirmed: it stays pending, asks the next reader and then the wallet, and confirms from its own receipt; the log lists the readers asked',{wallets:[]},async E=>{
  const rows=[]; for(const [m,w] of [['other-same',false],['other-next',false],['other-mined',false],['other-mined',true],['first-other',false],['first-mined',false],['first-nohash',false],['first-decimal',false]]){
    rows.push(await idRow(E,m,w)); const p=(await txs(E)).find(x=>x.action==='witness'&&x.state==='pending'&&!x.unrelated);
    if(p){ await ev(E,h=>__SG.txResolve(h,'confirmed'),p.hash); rows[rows.length-1].late=await E.until(async()=>(await idToasts(E,rows[rows.length-1].n0)).some(x=>/Your witness payment: confirmed$/.test(x)),15000); } await H.closeWit(E.page); await sleep(300); }
  const unrel=(await txs(E)).filter(x=>x.unrelated).length;
  const good=r=>r.sent&&r.gate&&r.rounds&&!r.falseVerdict&&r.waiting&&r.pend==='pending'&&r.late&&(r.mode.startsWith('first-')?r.readers.length>=2:r.readers.length===3);
  return {pass:rows.every(good)&&unrel>=3,ev:{rows,unrelatedMined:unrel}}; },{query:q('sim')});

/* the real outcomes still work: a SPED UP / CANCELLED / REPLACED transaction is recognised when a valid answer (the next reader, or the wallet) names the nonce */
T('st24','SCENARIO 5 keeps the legitimate outcomes: with a bad first reader (or every reader unrelated and the wallet valid) a real SPED UP, CANCELLED or REPLACED is still reported; with every reader AND the wallet unrelated nothing is reported but pending',{wallets:[]},async E=>{
  const WORDS={sped:/confirmed \(sped up in your wallet\)/,cancelled:/cancelled in your wallet after it was sent/,replaced:/replaced it with another transaction/}; const rows=[];
  for(const [mode,wallet,out] of [['first-other',false,'sped'],['first-other',false,'cancelled'],['first-other',false,'replaced'],['other-same',false,'replaced'],['first-mined',false,'sped']]){
    await ev(E,()=>__SG.configure({mine:300,readerMs:20})); await ctl(E,'[data-txid="'+mode+'"]'); await ctl(E,'[data-txidwallet="'+(wallet?1:0)+'"]'); await ctl(E,'[data-setup=txid]'); await drawerOpen(E,false);
    if(!/0x/.test(await label(E))) await simConnect(E,/SIM ALPHA · 1/); await ev(E,o=>__SG.configure({auto:o}),out); const n0=(await E.toasts()).length; await H.witness(E,'0.01');
    const ok=await E.until(async()=>(await idToasts(E,n0)).some(x=>WORDS[out].test(x)),30000); const ts=await idToasts(E,n0);
    rows.push({mode,out,ok,wrongVerdict:ts.some(x=>out!=='sped'&&/: confirmed$/.test(x)),last:ts.slice(-1)[0]}); await H.closeWit(E.page); await sleep(300); }
  /* every reader and the wallet unrelated, the original REPLACED for real: no verdict from an answer that is not about this transaction */
  await ev(E,()=>__SG.configure({mine:300,readerMs:20})); await ctl(E,'[data-txid="other-same"]'); await ctl(E,'[data-txidwallet="1"]'); await ctl(E,'[data-setup=txid]'); await drawerOpen(E,false);
  await ev(E,()=>__SG.configure({auto:'replaced'})); const n1=(await E.toasts()).length; const l1=(await fullLog(E)).length; await H.witness(E,'0.01');
  const gate=await E.until(async()=>(await fullLog(E)).slice(l1).filter(x=>/^SIM/.test(x.who)&&x.method==='eth_getTransactionByHash'&&/ANOTHER/.test(x.result)).length>=2,20000); const ts=await idToasts(E,n1);
  return {pass:rows.every(r=>r.ok&&!r.wrongVerdict)&&gate&&!ts.some(x=>/replaced it|cancelled|: confirmed|sped/.test(x)),ev:{rows,allUnrelated:{gate,toasts:ts.map(x=>x.slice(0,70))}}}; },{query:q('sim')});

/* ── st25: scenario 6, a phone wallet fails to connect: CHOOSE ANOTHER WALLET, and nobody else is asked until the visitor picks */
const NOOFFER=new Set([4001,-32002]);
async function phoneRow(code,how){
  const E=await H.boot({wallets:[]},{query:q('sim')});
  try{ await ev(E,()=>__SG.configure({mine:300,readerMs:20}));
    await ctl(E,'[data-connfail="'+code+'"]'); await ctl(E,'[data-connhow='+how+']'); await ctl(E,'[data-setup=phone2]'); await afterReload(E);
    const env=await ev(E,()=>({ua:/iPhone/.test(navigator.userAgent),phone:isPhone(),app:inWalletApp(),preset:__SG.preset_(),wallets:Object.keys(__SG.sim).filter(k=>k!=='PHONE'),authorized:['ALPHA','BETA'].map(k=>__SG.sim[k].st.authorized)}));
    const nB0=wlog(await fullLog(E),/SIM BETA/).length, l0=(await fullLog(E)).length;
    await E.page.click('#wallet'); const settled=await E.until(async()=>{ const t=await H.sheetOpen(E.page)?await ev(E,()=>document.getElementById('wsk').textContent):''; return /DID NOT CONNECT/.test(t)||(await E.toasts()).length>0; },8000); await sleep(1200);
    const title=(await H.sheetOpen(E.page))?await ev(E,()=>document.getElementById('wsk').textContent):''; const sheetText=(await H.sheetOpen(E.page))?await ev(E,()=>document.getElementById('wsheet').textContent):''; const toasts=await E.toasts();
    const L1=(await fullLog(E)).slice(l0); const A=wlog(L1,/SIM ALPHA/), Bpre=wlog(L1,/SIM BETA/);
    const r={code,how,env,settled,offered:/DID NOT CONNECT/.test(title),sheet:sheetText.slice(0,160),toast:toasts.slice(-1)[0]||null,alphaAsk:A.filter(x=>x.method==='eth_requestAccounts').length,alphaResult:(A.find(x=>x.method==='eth_requestAccounts')||{}).result,betaBeforePick:Bpre.map(x=>x.method),
      connected:/0x/.test(await label(E))};
    if(r.offered){ await H.clickSheet(E.page,/CHOOSE ANOTHER WALLET/); r.list=await E.until(async()=>(await H.sheetOpen(E.page))&&(await ev(E,()=>document.getElementById('wsk').textContent))==='CONNECT WITH',4000); r.buttons=await H.sheetButtons(E.page); await sleep(300);
      r.betaListed=(wlog((await fullLog(E)).slice(l0),/SIM BETA/)).map(x=>x.method);
      await H.clickSheet(E.page,/SIM BETA/); r.picked=await E.until(async()=>/0b01/i.test(await label(E)),6000); const L2=(await fullLog(E)).slice(l0);
      r.betaAsk=wlog(L2,/SIM BETA/).filter(x=>x.method==='eth_requestAccounts').length; r.alphaAskAfter=wlog(L2,/SIM ALPHA/).filter(x=>x.method==='eth_requestAccounts').length; }
    r.sends=sends(await fullLog(E)).length; r.errors=E.errors.slice(); return r;
  } finally{ await E.close().catch(()=>{}); } }
T('st25','SCENARIO 6 from CONTROLS (a phone inside a wallet app, two authorised wallets): the first wallet fails eth_requestAccounts (4001, 4100, 4200, 4900, 4901, -32002, -32603; rejected promise or synchronous throw): the page offers CHOOSE ANOTHER WALLET (not for 4001 and -32002), the second wallet’s log shows no request before the pick except the liveness ping on the list, and the pick connects with exactly one request',{wallets:[]},async E=>{
  const rows=[]; for(const code of [4001,4100,4200,4900,4901,-32002,-32603]) for(const how of ['async','sync']) rows.push(await phoneRow(code,how));
  const ok=r=>r.env.ua&&r.env.phone&&r.env.app&&r.env.preset==='phone2'&&r.env.authorized.every(Boolean)&&r.settled&&r.alphaAsk===1&&new RegExp(r.how==='sync'?'SYNC THROW':'REJECTED PROMISE').test(r.alphaResult||'')&&r.betaBeforePick.length===0&&!r.connected&&r.sends===0&&r.errors.length===0
    &&(NOOFFER.has(r.code)?(!r.offered&&!!r.toast):(r.offered&&r.list&&r.betaListed.every(m=>m==='eth_chainId')&&r.picked&&r.betaAsk===1&&r.alphaAskAfter===1));
  return {pass:rows.every(ok),ev:{rows:rows.map(r=>({code:r.code,how:r.how,ok:ok(r),offered:r.offered,alpha:r.alphaResult,betaBefore:r.betaBeforePick,betaOnList:r.betaListed,betaAsk:r.betaAsk,picked:r.picked,toast:r.toast&&r.toast.slice(0,50)}))}}; },{query:q('sim')});

/* ── st26: scenario 7, WITHDRAW TO ANOTHER ADDRESS: refusals, confirmed, recipient rejects, user rejects */
const wShown=E=>ev(E,()=>{ const b=document.getElementById('withdrawTo'); return !!b&&b.style.display!=='none'&&b.offsetParent!==null; });
const wsp=E=>ev(E,()=>document.getElementById('wsp').textContent);
const wNote=E=>ev(E,()=>document.getElementById('wtoNote').textContent);
async function wOpen(E){ await H.closeWit(E.page); await ev(E,()=>refreshSeats()).catch(()=>{}); if(!(await E.until(()=>wShown(E),15000))) throw new Error('no WITHDRAW TO ANOTHER ADDRESS button: '+JSON.stringify(await ev(E,()=>({label:document.getElementById('wallet').textContent,wt:document.getElementById('withdrawTo').style.display,note:document.getElementById('seatsNote').textContent.slice(0,120),owed:__SG.set.owed,rect:document.getElementById('withdrawTo').getBoundingClientRect().height,op:!!document.getElementById('withdrawTo').offsetParent})))); if(await ev(E,()=>document.getElementById('wtoBox').hidden)) await ev(E,()=>document.getElementById('withdrawTo').click()); }
async function wReview(E,a){ await E.page.fill('#wtoAddr',a); await ev(E,()=>document.getElementById('wtoReview').click()); }
const wSheet=E=>E.until(async()=>(await H.sheetTitle(E.page))==='WITHDRAW TO ANOTHER ADDRESS',6000);
const pressSend=E=>H.clickSheet(E.page,/SEND TO THIS ADDRESS/);
const decodeTo=t=>{ try{ return SGI.decodeFunctionData('withdrawTo',t.data)[0]; }catch(e){ return null; } };
const setupOwed=async(E,owed,rec)=>{ await ctl(E,'[data-owed="'+owed+'"]'); await ctl(E,'[data-recipient='+rec+']'); await ctl(E,'[data-setup=owed]'); await drawerOpen(E,false); };
T('st26','SCENARIO 7 from CONTROLS: with 0.05 ETH owed, the zero, malformed, contract and own addresses are refused with the page’s messages and nothing reaches the wallet; a valid recipient gives withdrawTo(recipient) from the connected account, value 0, to the contract; CONFIRMED refreshes owed to 0; a recipient that rejects ETH reverts and the flow stays usable; REJECTED IN WALLET leaves it as it was',{wallets:[]},async E=>{
  await ev(E,()=>__SG.configure({mine:300,readerMs:20})); await setupOwed(E,'0.05','accepts'); await simConnect(E,/SIM ALPHA · 1/); await wOpen(E); const C=(await ev(E,()=>CFG.contract)).toLowerCase();
  const owed0=await ev(E,a=>__SG.owedOf(a),ALPHA1); const rows=[];
  for(const [name,v] of [['zero','0x0000000000000000000000000000000000000000'],['short','0x1234'],['contract',C],['own',ALPHA1]]){ await ev(E,()=>{ document.getElementById('wtoNote').textContent=''; }); await wReview(E,v); await sleep(350); rows.push({name,note:(await wNote(E)).slice(0,70),sheet:await H.sheetOpen(E.page)}); }
  const s0=sends(await fullLog(E)).length, est0=(await fullLog(E)).filter(x=>x.method==='eth_estimateGas').length;
  /* a valid recipient, confirmed */
  await wReview(E,'  '+R1L+' '); const sh=await wSheet(E); const sheetText=await wsp(E); await pressSend(E); await waitModal(E); const mt=await modalText(E); await shot(E,'a5_withdrawto_wallet_screen');
  await clickModal(E,'[data-out=confirmed]'); const conf=await E.until(()=>toastHas(E,/Withdrawing to another address: confirmed/),15000); const gone=await E.until(async()=>!(await wShown(E)),15000);
  const t1=(await txs(E)).filter(x=>x.action==='withdrawTo'); const L1=await fullLog(E); const sd=sends(L1).slice(-1)[0]||{};
  const owedAfter=await ev(E,a=>__SG.owedOf(a),ALPHA1); const pays=await ev(E,()=>__SG.payouts());
  /* the recipient rejects ETH */
  await setupOwed(E,'0.05','rejects'); await wOpen(E); await wReview(E,R1L); await wSheet(E); await pressSend(E); await waitModal(E); await clickModal(E,'[data-out=confirmed]');
  const rev=await E.until(async()=>/reverted/i.test(await wNote(E)),15000); const revText=await wNote(E); const boxOpen=await ev(E,()=>!document.getElementById('wtoBox').hidden); const stillShown=await wShown(E);
  const t2=(await txs(E)).filter(x=>x.action==='withdrawTo').slice(-1)[0]; const owedKept=await ev(E,a=>__SG.owedOf(a),ALPHA1); const Lr=await fullLog(E);
  await setupOwed(E,'0.05','accepts'); await wOpen(E); await wReview(E,R2L); await wSheet(E); await pressSend(E); await waitModal(E); await clickModal(E,'[data-out=confirmed]');
  const conf2=await E.until(async()=>(await E.toasts()).filter(x=>/Withdrawing to another address: confirmed/.test(x)).length>=2,15000); const t3=(await txs(E)).filter(x=>x.action==='withdrawTo').slice(-1)[0];
  /* the user rejects in the wallet */
  await setupOwed(E,'0.05','accepts'); await wOpen(E); await wReview(E,R1L); await wSheet(E); const n0=(await E.toasts()).length; const nTx=(await txs(E)).length; await pressSend(E); await waitModal(E); await clickModal(E,'[data-out=rejected]');
  const canc=await E.until(async()=>(await idToasts(E,n0)).some(x=>/Cancelled/.test(x)),8000); const keep=await ev(E,()=>document.getElementById('wtoAddr').value); const usable=await wShown(E);
  const okRows=rows.every(r=>r.note&&!/Reading/.test(r.note)&&!r.sheet);
  return {pass:owed0==='50000000000000000'&&okRows&&s0===0&&est0===0&&sh&&sheetText.includes(R1)&&sheetText.includes('0.05')&&/withdrawTo\(arg0: /.test(mt)&&mt.includes(R1)&&/PAYS TO \(recipient\)/.test(mt)&&conf&&gone&&t1.length===1&&decodeTo(t1[0])===R1&&t1[0].from===ALPHA1&&t1[0].to===C&&t1[0].value==='0'
    &&/withdrawTo\(0x5290/i.test(sd.call||'')&&/from 0x0000000000000000000000000000000000000a11/.test(sd.call||'')&&/value 0\.0 ETH/.test(sd.call||'')&&owedAfter==='0'&&pays.some(p=>p.to===R1L&&p.v==='50000000000000000')
    &&rev&&/did not accept the ETH/.test(revText)&&boxOpen&&stillShown&&t2.state==='reverted'&&/rejects ETH/.test(t2.why||'')&&owedKept==='50000000000000000'&&Lr.some(x=>x.method==='revert')&&conf2&&t3.state==='confirmed'
    &&canc&&keep===R1L&&usable&&(await txs(E)).length===nTx&&E.errors.length===0,
    ev:{owed0,rows,asked:[s0,est0],sheet:sheetText.slice(0,150),modal:mt.slice(0,260),conf,gone,tx:t1.map(t=>({to:decodeTo(t),from:t.from,target:t.to,value:t.value,state:t.state})),call:sd.call,owedAfter,pays,
      reverted:{rev,revText:revText.slice(0,150),boxOpen,stillShown,state:t2&&t2.state,why:t2&&t2.why,owedKept},second:{conf2,state:t3&&t3.state},rejected:{canc,keep,usable}}}; },{query:q('sim')});

/* ── st27: scenario 7, an account or network change before the handoff: nothing is sent */
async function beforeHandoff(kind){
  const E=await H.boot({wallets:[]},{query:q('sim')});
  try{ await ev(E,()=>__SG.configure({mine:300,readerMs:20})); await setupOwed(E,'0.05','accepts');
    if(kind==='lastchain'){ await ctl(E,'[data-lastchain=base-back]'); await ctl(E,'[data-setup=lastchain]'); await drawerOpen(E,false); }
    await simConnect(E,/SIM ALPHA · 1/); await wOpen(E); await wReview(E,R1L); const sh=await wSheet(E); const n0=(await E.toasts()).length; const l0=(await fullLog(E)).length;
    if(kind==='account') await ctlJS(E,'[data-act=account]'); if(kind==='network') await ctlJS(E,'[data-act=network]'); await drawerOpen(E,false);
    const moved=kind==='account'?await E.until(async()=>/0a12/i.test(await label(E)),5000):kind==='network'?await E.until(async()=>/NOT MAINNET|\[!\]/.test(await label(E)),5000):true;
    await pressSend(E); const stop=await E.until(async()=>(await idToasts(E,n0)).some(x=>/Nothing was sent/i.test(x)),12000); await sleep(600);
    const L=(await fullLog(E)).slice(l0); const r={kind,sh,moved,stop,toasts:(await idToasts(E,n0)).map(x=>x.slice(0,90)),sends:sends(L).length,txs:(await txs(E)).length,modal:await modalOpen(E),fired:kind==='lastchain'?await ev(E,()=>__SG.wallet('ALPHA').fired):null,errors:E.errors.slice()}; return r;
  } finally{ await E.close().catch(()=>{}); } }
T('st27','SCENARIO 7 from CONTROLS: after REVIEW, an account change, the wallet going to Base (refusing to switch back) and the last-moment network change (scenario 1) each end SEND with “Nothing was sent”: the simulated wallet log has no eth_sendTransaction and no transaction exists',{wallets:[]},async E=>{
  const rows=[]; for(const k of ['account','network','lastchain']) rows.push(await beforeHandoff(k));
  return {pass:rows.every(r=>r.sh&&r.moved&&r.stop&&r.sends===0&&r.txs===0&&!r.modal&&r.errors.length===0)&&rows[2].fired>=1,ev:{rows}}; },{query:q('sim')});

/* ── st28: scenario 8, payout outcomes */
T('st28','SCENARIO 8 from CONTROLS: a COLLECT by a payer with seats whose wallet accepts ETH sends the earnings to it (simulated ETH, nothing owed, no WITHDRAW); a payer whose wallet rejects ETH leaves them owed, WITHDRAW and WITHDRAW TO ANOTHER ADDRESS appear, WITHDRAW reverts for that wallet and WITHDRAW TO another address pays',{wallets:[]},async E=>{
  await ev(E,()=>__SG.configure({mine:300,readerMs:20,auto:'confirmed'}));
  await ctl(E,'[data-payer=accepts]'); await ctl(E,'[data-setup=payer]'); await drawerOpen(E,false); await simConnect(E,/SIM ALPHA · 1/);
  const p0=await ev(E,a=>({owed:__SG.owedOf(a),rec:__SG.receivedOf(a)}),ALPHA1); await H.buy(E); const c1=await E.until(()=>toastHas(E,/Collecting the plate: confirmed/),15000); await sleep(1500);
  const acc=await ev(E,a=>({owed:__SG.owedOf(a),rec:__SG.receivedOf(a),pays:__SG.payouts(),w:getComputedStyle(document.getElementById('withdraw')).display,wt:getComputedStyle(document.getElementById('withdrawTo')).display,note:document.getElementById('seatsNote').textContent.slice(0,200)}),ALPHA1);
  const logAcc=(await fullLog(E)).filter(x=>x.method==='payout').map(x=>x.route.slice(0,170));
  await H.closeWit(E.page); await ev(E,()=>{ const x=document.getElementById('ccX'); if(x) x.click(); }); await sleep(300);
  await ctl(E,'[data-payer=rejects]'); await ctl(E,'[data-setup=payer]'); await drawerOpen(E,false); await H.witness(E,'0.02'); const c2=await E.until(()=>toastHas(E,/Your witness payment: confirmed$/),15000);
  const shown=await E.until(()=>wShown(E),25000); await sleep(500);
  const rej=await ev(E,a=>({owed:__SG.owedOf(a),rec:__SG.receivedOf(a),pays:__SG.payouts(),w:getComputedStyle(document.getElementById('withdraw')).display,wt:getComputedStyle(document.getElementById('withdrawTo')).display,note:document.getElementById('seatsNote').textContent.slice(0,260)}),ALPHA1);
  await shot(E,'a5_payer_rejects_owed'); await H.closeWit(E.page);
  /* WITHDRAW reverts for a wallet that rejects ETH; WITHDRAW TO ANOTHER ADDRESS pays an accepting address */
  await ev(E,()=>__SG.configure({auto:'ask'})); await E.page.waitForSelector('#withdraw:not([disabled])',{timeout:8000}).catch(()=>{}); const n0=(await E.toasts()).length; await ev(E,()=>document.getElementById('withdraw').click()); await waitModal(E); await clickModal(E,'[data-out=confirmed]');
  const wRev=await E.until(async()=>(await idToasts(E,n0)).some(x=>/failed on Ethereum \(reverted\)/i.test(x)),15000); const tw=(await txs(E)).filter(x=>x.action==='withdraw').slice(-1)[0];
  await wOpen(E); await wReview(E,R1L); await wSheet(E); await pressSend(E); await waitModal(E); await clickModal(E,'[data-out=confirmed]'); const wtoOk=await E.until(()=>toastHas(E,/Withdrawing to another address: confirmed/),15000);
  const fin=await ev(E,a=>({owed:__SG.owedOf(a),r1:__SG.receivedOf('0x52908400098527886e0f7030069857d2e4169ee7')}),ALPHA1);
  return {pass:p0.owed==='0'&&p0.rec==='0'&&c1&&acc.owed==='0'&&acc.rec==='36400000000000000'&&acc.pays.length===1&&acc.pays[0].to===ALPHA1&&acc.w==='none'&&acc.wt==='none'&&logAcc.length===1&&/accepts ETH|wallet accepts/.test(logAcc[0])
    &&c2&&shown&&rej.owed==='36400000000000000'&&rej.rec==='0'&&rej.w!=='none'&&rej.wt!=='none'&&/WITHDRAW/.test(rej.note)&&wRev&&tw.state==='reverted'&&/rejects ETH/.test(tw.why||'')&&wtoOk&&fin.owed==='0'&&fin.r1==='36400000000000000'&&E.errors.length===0,
    ev:{before:p0,accepts:{...acc,log:logAcc},c1,rejects:rej,c2,withdraw:{wRev,state:tw&&tw.state,why:tw&&tw.why},withdrawTo:{wtoOk},final:fin}}; },{query:q('sim')});

/* ── st29: REAL WALLET: withdrawTo is a write: intercepted like every write, never forwarded; the intercept panel decodes the recipient */
T('st29','REAL WALLET: WITHDRAW TO ANOTHER ADDRESS stops at the wrapper: the intercept panel shows chain, sender, target, value 0 and withdrawTo with the recipient decoded; the external wallet receives no write and no signature (a forged withdrawTo, a raw eth_sendTransaction and wallet_sendCalls included)',{wallets:[mock('A')],ethereum:'A'},async E=>{
  await ev(E,()=>__SG.configure({mine:300,readerMs:20})); await setupOwed(E,'0.05','accepts'); await realConnect(E); await wOpen(E); await wReview(E,R1L); const sh=await wSheet(E); const mw0=(await mwLog(E)).length;
  await pressSend(E); await waitModal(E); const mt=await modalText(E); await shot(E,'a5_real_withdrawto_intercept');
  const rows=await ev(E,()=>Object.fromEntries([...document.querySelectorAll('#sg-modal dt')].map(d=>[d.textContent,d.nextSibling.textContent])));
  await clickModal(E,'[data-out=confirmed]'); const conf=await E.until(()=>toastHas(E,/Withdrawing to another address: confirmed/),15000);
  const forged=await ev(E,async([r,A,C])=>{ const out={}; const data=new ethers.Interface(['function withdrawTo(address)']).encodeFunctionData('withdrawTo',[r]);
    for(const [k,m,p] of [['eth_sendTransaction','eth_sendTransaction',[{from:A,to:C,data,value:'0x0'}]],['wallet_sendCalls','wallet_sendCalls',[{calls:[{to:C,data}]}]],['eth_sendRawTransaction','eth_sendRawTransaction',['0x02']]]){
      const pr=EP.request({method:m,params:p}).then(()=>'resolved',e=>'refused '+e.code); await new Promise(r=>setTimeout(r,300)); const b=document.querySelector('#sg-modal [data-out=rejected]')||document.querySelector('#sg-modal .sg-b'); if(b) b.click(); out[k]=await pr; } return out; },[R1,A1,await ev(E,()=>CFG.contract)]);
  const L=await mwLog(E); const reached=L.filter(x=>WRITE.has(x.method)||!(x.method in POLICY.FORWARD)).map(x=>x.method); const mwSends=await ev(E,()=>__MW.sends.length);
  const t=(await txs(E)).filter(x=>x.action==='withdrawTo');
  return {pass:sh&&/SUBMISSION INTERCEPTED/.test(mt)&&/withdrawTo\(arg0: /.test(mt)&&rows['PAYS TO (recipient)']===R1&&rows['SENDER'].toLowerCase()===A1&&/1 · Ethereum mainnet/.test(rows['INTENDED CHAIN'])&&/^0\.0 ETH$/.test(rows['VALUE'])&&/STORMGLASS contract/.test(rows['TARGET'])
    &&conf&&t.length===1&&t[0].mode==='intercepted'&&decodeTo(t[0])===R1&&Object.values(forged).every(v=>/^refused (4001|4200)$/.test(v))&&reached.length===0&&mwSends===0&&mw0>=0,
    ev:{rows,confirmed:conf,forged,reached,walletReceived:[...new Set(L.map(x=>x.method))],mwSends,tx:t.map(x=>({mode:x.mode,to:decodeTo(x),state:x.state}))}}; },{query:q('real')});

/* ── st30: REAL WALLET on a phone: the first wallet fails; CHOOSE ANOTHER WALLET; the second wallet is asked only after the visitor picks it AND confirms the staging gate. Also: nonce identity in REAL mode (the wallet fallback answers locally, never forwarded) */
T('st30','REAL WALLET on a phone in a wallet app: window.ethereum fails (-32603); the second, authorised wallet gets nothing (but a liveness ping on the list) until the visitor picks it, and its eth_requestAccounts waits for the staging gate; with the readers and the wallet fallback unrelated, an intercepted payment stays pending and the real wallet is not asked about it',
  {wallets:[mock('A',{announce:false,flags:{isMetaMask:true},reject:{eth_requestAccounts:{code:-32603,message:'Internal error'}}}),mock('B',{authorized:true})],ethereum:'A'},async E=>{
  const cnt=(id,m)=>ev(E,([i,m])=>__MW.log.filter(x=>x.pid===i&&x.method===m).length,[id,m]);
  await ev(E,()=>__SG.configure({mine:300,readerMs:20}));
  await E.page.click('#wallet'); const g1=await waitModal(E); const gt=await modalText(E); await clickModal(E,'[data-gate=go]');
  const offer=await E.until(async()=>(await H.sheetOpen(E.page))&&/DID NOT CONNECT/.test(await ev(E,()=>document.getElementById('wsk').textContent)),8000); await sleep(1000);
  const Bpre=(await mwLog(E)).filter(x=>x.pid==='B').map(x=>x.method); const gateOpenForB=await modalOpen(E);
  await H.clickSheet(E.page,/CHOOSE ANOTHER WALLET/); const list=await E.until(async()=>(await ev(E,()=>document.getElementById('wsk').textContent))==='CONNECT WITH',4000); await sleep(300);
  const Blist=(await mwLog(E)).filter(x=>x.pid==='B').map(x=>x.method); await H.clickSheet(E.page,/MOCK B/); const g2=await waitModal(E); const gt2=await modalText(E); await sleep(500);
  const bAtGate=await cnt('B','eth_requestAccounts'); await clickModal(E,'[data-gate=go]'); const conn=await E.until(async()=>/0x/.test(await label(E)),8000);
  const bAfter=await cnt('B','eth_requestAccounts'), aAsk=await cnt('A','eth_requestAccounts');
  /* nonce identity, REAL mode: every reader and the staging-answered wallet fallback unrelated */
  await ctlJS(E,'[data-txid="other-same"]'); await ctlJS(E,'[data-txidwallet="1"]'); await ctlJS(E,'[data-setup=txid]'); await drawerOpen(E,false);
  await ev(E,()=>__SG.configure({auto:'pending'})); const n0=(await E.toasts()).length; const l0=(await fullLog(E)).length; const mw0=(await mwLog(E)).length;
  await ev(E,()=>{ const b=document.getElementById('nx-witBtn'); if(b) b.click(); }); await E.page.waitForSelector('#nx-wit.on'); await E.page.fill('#wAmt','0.01'); await E.page.click('#bWit'); await clickModal(E,'[data-out=pending]');
  const gate=await E.until(async()=>(await fullLog(E)).slice(l0).filter(x=>x.method==='eth_getTransactionByHash'&&/ANOTHER/.test(x.result+x.route)).length>=8,25000); const ts=await idToasts(E,n0);
  const mwNew=(await mwLog(E)).slice(mw0).map(x=>x.method); const reached=(await mwLog(E)).filter(x=>WRITE.has(x.method)).map(x=>x.method);
  return {pass:g1&&/will now ask to connect/.test(gt)&&offer&&!gateOpenForB&&Bpre.every(m=>m==='eth_chainId')&&list&&Blist.every(m=>m==='eth_chainId')&&g2&&/will now ask to connect/.test(gt2)&&bAtGate===0&&conn&&bAfter===1&&aAsk===1
    &&gate&&!ts.some(x=>FALSE_VERDICT.test(x))&&ts.some(x=>/waiting for Ethereum/.test(x))&&!mwNew.includes('eth_getTransactionByHash')&&reached.length===0,
    ev:{gate1:g1,offer,BbeforePick:Bpre,gateOpenForB,list,BonList:Blist,gate2:g2,bAtGate,conn,bAfter,aAsk,identity:{gate,toasts:ts.map(x=>x.slice(0,60)),mwNew,reached}}}; },Object.assign({query:q('real')},IN_APP));

/* ── st31: the enumeration: every RPC method literal and every contract write index.html can send is classified; each write is intercepted in REAL mode */
T('st31','the write enumeration: every method literal and every send(name) of index.html is classified by policy.js; the page ABI’s writes equal the listed CONTRACT_WRITES (withdrawTo included); in REAL mode each contract write, built from the page’s own ABI, stops at the wrapper (decoded in the panel) and the wallet receives none',{wallets:[mock('A')],ethereum:'A'},async E=>{
  const src=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'); const lits=[...new Set([...src.matchAll(/['"`]((?:eth|wallet|net|personal|web3)_[A-Za-z0-9_]+)['"`]/g)].map(m=>m[1]))].sort();
  const known=new Set([...Object.keys(POLICY.FORWARD),...Object.keys(POLICY.LOCAL),...POLICY.TX,...POLICY.SIGN,...POLICY.READER,...POLICY.KNOWN_UNUSED]); const unclassified=lits.filter(m=>!known.has(m));
  const sendNames=[...new Set([...src.matchAll(/\bsend\('([A-Za-z]+)'/g)].map(m=>m[1]))].sort(); const abi=(/const ABI=\[[\s\S]*?\];/.exec(src)||[''])[0];
  const abiWrites=[...abi.matchAll(/'function ([A-Za-z0-9_]+)\(([^)]*)\)([^']*)'/g)].filter(m=>!/\b(view|pure)\b/.test(m[3])).map(m=>m[1]).sort(); const listed=Object.keys(POLICY.CONTRACT_WRITES).sort();
  const direct=[...src.matchAll(/\.(sendTransaction|sendCalls|signMessage|signTypedData|sendRawTransaction|signTransaction)\s*\(/g)].map(m=>m[1]);
  await ev(E,()=>__SG.configure({mine:200,readerMs:20})); await realConnect(E);
  const r=await ev(E,async A=>{ const C=CFG.contract, I=new ethers.Interface(ABI), out={}; const args={buy:[13,3],witness:[13],withdrawTo:['0x52908400098527886e0f7030069857d2e4169ee7']};
    for(const n of A){ const data=I.encodeFunctionData(n,args[n]||[]); const pr=EP.request({method:'eth_sendTransaction',params:[{from:'0x00000000000000000000000000000000000000aa',to:C,data,value:'0x0'}]}).then(()=>'resolved',e=>'refused '+e.code);
        await new Promise(r=>setTimeout(r,350)); const t=__SG.modalText(); const b=document.querySelector('#sg-modal [data-out=rejected]'); if(b) b.click(); out[n]={result:await pr,panel:/SUBMISSION INTERCEPTED/.test(t),decoded:t.includes(n+'(')}; }
    return out; },abiWrites);
  const L=await mwLog(E); const reached=L.filter(x=>WRITE.has(x.method)).map(x=>x.method); const mwSends=await ev(E,()=>__MW.sends.length);
  return {pass:!unclassified.length&&sendNames.every(n=>POLICY.SEND_NAMES.includes(n))&&POLICY.SEND_NAMES.every(n=>sendNames.includes(n))&&JSON.stringify(abiWrites)===JSON.stringify(listed)&&listed.includes('withdrawTo')&&!direct.length
    &&Object.values(r).every(x=>x.result==='refused 4001'&&x.panel&&x.decoded)&&Object.keys(r).length===listed.length&&reached.length===0&&mwSends===0,
    ev:{methods:lits,unclassified,sendNames,abiWrites,listed,direct,intercepted:r,reached}}; },{query:q('real')});

/* ── st32: a mode switch leaves nothing of the audit-5 scenarios behind (phone user agent, controls, a pending withdrawTo, the txid / owed / payer settings) */
T('st32','switching modes clears the audit-5 state: from the phone-in-a-wallet-app set with a pending withdrawTo and unrelated-transaction answers, REAL mode has the desktop user agent, no provider, session or pending operation, default controls and only the external wallet; back in SIMULATION the controls are defaults again',{wallets:[mock('A')],ethereum:'A'},async E=>{
  await ev(E,()=>__SG.configure({mine:200,readerMs:20,auto:'pending'}));
  await ctl(E,'[data-connfail="4100"]'); await ctl(E,'[data-setup=phone2]'); await afterReload(E);
  await ev(E,()=>__SG.configure({auto:'pending',mine:200,readerMs:20})); await setupOwed(E,'0.05','rejects'); await ctl(E,'[data-txid="other-same"]'); await ctl(E,'[data-setup=txid]'); await ctl(E,'[data-payer=rejects]'); await ctl(E,'[data-setup=payer]'); await drawerOpen(E,false);
  await ev(E,()=>__SG.configure({owed:0.05}));
  /* connect through the offer: ALPHA fails 4100, pick BETA */
  await E.page.click('#wallet'); await E.until(async()=>(await H.sheetOpen(E.page))&&/DID NOT CONNECT/.test(await ev(E,()=>document.getElementById('wsk').textContent)),8000); await H.clickSheet(E.page,/CHOOSE ANOTHER WALLET/); await E.until(()=>H.sheetOpen(E.page),4000); await sleep(300); await H.clickSheet(E.page,/SIM BETA/);
  await E.until(async()=>/0b01/i.test(await label(E)),6000); await wOpen(E); await wReview(E,R1L); await wSheet(E); await pressSend(E); await E.until(async()=>(await txs(E)).some(x=>x.action==='withdrawTo'&&x.state==='pending'),8000);
  const simBefore=await ev(E,()=>({ua:/iPhone/.test(navigator.userAgent),pending:__SG.txs().filter(x=>x.state==='pending').length,set:[__SG.set.txid,__SG.set.owed,__SG.set.payer,__SG.set.recipient,__SG.set.connFail],preset:__SG.preset_()}));
  await ev(E,()=>__SG.switchMode('real')); await E.page.waitForFunction(()=>window.__SG&&__SG.mode==='real'&&typeof ST!=='undefined'&&ST.now,null,{timeout:20000}); await sleep(600);
  const inReal=await ev(E,()=>({ua:/iPhone/.test(navigator.userAgent),EP:EP===null,me:me===null,OPLOCK:OPLOCK===null,txs:__SG.txs().length,rdns:WALLETS.map(w=>w.info.rdns),wrapped:WALLETS.every(w=>__SG.isWrapper(w.provider)),
    set:[__SG.set.txid,__SG.set.owed,__SG.set.payer,__SG.set.recipient,__SG.set.connFail,__SG.set.connHow],preset:__SG.preset_(),label:document.getElementById('wallet').textContent,wto:document.getElementById('withdrawTo').style.display}));
  const mw=(await mwLog(E)).map(x=>x.method);
  await ev(E,()=>__SG.switchMode('sim')); await E.page.waitForFunction(()=>window.__SG&&__SG.mode==='sim'&&typeof ST!=='undefined'&&ST.now,null,{timeout:20000}); await sleep(600);
  const inSim=await ev(E,()=>({ua:/iPhone/.test(navigator.userAgent),EP:EP===null,txs:__SG.txs().length,set:[__SG.set.txid,__SG.set.owed,__SG.set.payer,__SG.set.recipient,__SG.set.connFail,__SG.set.connHow],preset:__SG.preset_(),rdns:WALLETS.map(w=>w.info.rdns)}));
  return {pass:simBefore.ua&&simBefore.pending===1&&simBefore.preset==='phone2'&&simBefore.set.join()==='other-same,0.05,rejects,rejects,4100'
    &&!inReal.ua&&inReal.EP&&inReal.me&&inReal.OPLOCK&&inReal.txs===0&&inReal.rdns.join()==='test.a'&&inReal.wrapped&&inReal.set.join()==='valid,0,accepts,accepts,-32603,async'&&inReal.preset==='desk3'&&/CONNECT/.test(inReal.label)&&inReal.wto==='none'&&mw.every(m=>m==='eth_chainId')
    &&!inSim.ua&&inSim.EP&&inSim.txs===0&&inSim.set.join()==='valid,0,accepts,accepts,-32603,async'&&inSim.preset==='desk3'&&inSim.rdns.every(x=>/^sim\.staging\./.test(x)),ev:{simBefore,inReal,mockAsked:mw,inSim}}; },{query:q('sim')});

/* ═══ AUDIT 5b (st33+): THE STAGING BOUNDARY (Finding D) and OWED CHANGES AFTER REVIEW (request §4, staging side).
   Boundary: REAL mode contacts real providers and (on a phone) the real WalletConnect relay for connection / session operations only; every
   payment, signature, batch, raw transaction, user operation and unknown method stops at the wrapper; outcomes stay simulated. These cases run
   with the harness's mocks and with every socket and outside host blocked: they prove the wrapper, not real relay delivery.
   Page-wording independence: the withdrawal cases (st39-st41) match outcome CATEGORIES (the simulated transaction's state, the payout, toasts
   matched loosely) and the recipient decoded from the calldata; they never match the review sheet's or the status line's exact copy (the page is
   changing it in parallel), and they drive CONTROLS by JavaScript clicks so a focus trap / inert background on the page cannot hide them. */
const b5ctl=async(E,sel)=>{ const ok=await ev(E,s=>{ if(!document.getElementById('sg-drawer')) document.getElementById('sg-ctl').click(); const b=document.querySelector('#sg-drawer '+s); if(!b) return false; b.click(); return true; },sel); if(!ok) throw new Error('control '+sel+' not found'); await sleep(150); };
const b5drawerOff=E=>ev(E,()=>{ if(document.getElementById('sg-drawer')) document.getElementById('sg-ctl').click(); });
const b5gateMethods=E=>mwLog(E).then(L=>L.map(x=>x.method));
const b5raw=E=>ev(E,()=>{ const s=new Set(Object.values(__MW.P).map(x=>x.provider)); if(__MW.wc) s.add(__MW.wc.provider); if(window.__RAWP) s.add(window.__RAWP); return s.size; });
/* every provider reference the page holds is a staging wrapper, never a raw (mock) provider */
const b5refs=E=>ev(E,()=>{ const raw=new Set(Object.values(__MW.P).map(x=>x.provider)); if(__MW.wc) raw.add(__MW.wc.provider); if(window.__RAWP) raw.add(window.__RAWP);
  const ok=p=>p==null||(__SG.isWrapper(p)&&!raw.has(p)); const eth=__SG.eth();
  const all={EP:ok(EP),WC:ok(typeof _WC==='undefined'?null:_WC),eth:ok(eth),providers:eth&&Array.isArray(eth.providers)?eth.providers.every(ok):true,wallets:WALLETS.every(w=>ok(w.provider)),list:walletList().every(ok),choices:walletChoices().every(w=>ok(w.provider))};
  return Object.assign(all,{allOk:Object.values(all).every(Boolean),EPset:EP!=null}); });
/* a request on a wrapper; an intercept / signature panel that opens is answered REJECTED (or CLOSE · REFUSED) */
const b5ask=(E,where,list)=>ev(E,async([where,list])=>{ const P=where==='EP'?EP:where==='eth'?__SG.eth():where==='prov1'?__SG.eth().providers[1]:where==='wc'?_WC:where==='late'?WALLETS.find(w=>w.info.rdns==='test.emitter').provider:WALLETS.find(w=>w.info.rdns==='test.b').provider;
  const out={}; for(const [k,m,params] of list){ const mm=m==='@obj'?{toString(){ return 'eth_chainId'; }}:m;
    const pr=Promise.resolve().then(()=>P.request(params===undefined?{method:mm}:{method:mm,params})).then(v=>'resolved '+String(v).slice(0,12),e=>'refused '+(e&&e.code));
    for(let i=0;i<40;i++){ const done=await Promise.race([pr.then(()=>true),new Promise(r=>setTimeout(()=>r(false),25))]); if(done) break; const b=document.querySelector('#sg-modal [data-out=rejected]')||document.querySelector('#sg-modal .sg-b'); if(b){ out[k+'#panel']=__SG.modalText().slice(0,60); b.click(); } }
    out[k]=await pr; } return out; },[where,list]);
/* connect in REAL mode; returns whether the staging gate opened before the wallet was asked (it must, for every connection: audit 5b made the
   one ASK MY WALLET count for one request) */
async function b5connect(E,pick){ await H.closeWit(E.page); const n0=await ev(E,()=>__MW.log.filter(x=>x.method==='eth_requestAccounts').length); await E.page.click('#wallet');
  if(pick){ if(!(await E.until(()=>H.sheetOpen(E.page),4000))) throw new Error('no picker'); await H.clickSheet(E.page,pick); }
  const gate=await E.until(()=>modalOpen(E),4000); const asked=await ev(E,()=>__MW.log.filter(x=>x.method==='eth_requestAccounts').length)-n0; if(gate) await clickModal(E,'[data-gate=go]');
  const conn=await E.until(async()=>/0x/.test(await label(E)),8000); await sleep(300); return {gate,askedBeforeGate:asked,conn}; }
const PHONE5={viewport:{width:390,height:844},mobile:true,ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'};

/* ── st33: the permitted connection operations follow the staging gate */
T('st33','REAL WALLET: permitted connection operations follow the staging gate: before ASK MY WALLET the wallet gets only the eth_chainId liveness check (no eth_requestAccounts); CANCEL asks nothing; ASK MY WALLET forwards exactly one; a network switch asked by the page waits for its own gate (CANCEL: none, ASK: one); DISCONNECT forwards wallet_revokePermissions; on a phone the WalletConnect relay connection (init) comes first but the pairing (enable) and, for a restored stored session, eth_requestAccounts wait for the gate; everything the wallets received is on the allowlist',{wallets:[mock('A')],ethereum:'A'},async E=>{
  const cnt=(m,pid)=>ev(E,([m,pid])=>__MW.log.filter(x=>x.method===m&&(!pid||x.pid===pid)).length,[m,pid]);
  await ev(E,()=>__SG.configure({mine:200,readerMs:20}));
  await E.page.click('#wallet'); const g1=await waitModal(E); const gt=await modalText(E); const before=await b5gateMethods(E); const req0=await cnt('eth_requestAccounts');
  await clickModal(E,'[data-gate=no]'); await sleep(600); const reqCancel=await cnt('eth_requestAccounts'); const lCancel=await label(E);
  await E.page.click('#wallet'); await waitModal(E); await clickModal(E,'[data-gate=go]'); const conn=await E.until(async()=>/0x/.test(await label(E)),8000); const reqGo=await cnt('eth_requestAccounts');
  /* a switch the page asks (SWITCH TO ETHEREUM / opBegin go through ask(EP,'wallet_switchEthereumChain')) waits for its own gate */
  const sw=async go=>{ await ev(E,()=>{ window.__sw=Promise.resolve().then(()=>EP.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x1'}]})).then(()=>'ok',e=>'refused '+e.code); }); const g=await waitModal(E); const t=await modalText(E); const n0=await cnt('wallet_switchEthereumChain');
    await clickModal(E,go?'[data-gate=go]':'[data-gate=no]'); const r=await ev(E,()=>window.__sw); return {g,switchText:/switch to Ethereum mainnet/.test(t),atGate:n0,result:r,after:await cnt('wallet_switchEthereumChain')}; };
  const s1=await sw(false), s2=await sw(true);
  await H.disconnectUI(E); await E.until(async()=>/CONNECT/.test(await label(E)),5000); const revoke=await cnt('wallet_revokePermissions');
  const again=await b5connect(E); await H.disconnectUI(E); await E.until(async()=>/CONNECT/.test(await label(E)),5000);   /* within seconds of the first ASK MY WALLET: the gate again */
  const L=await mwLog(E); const notAllowed=[...new Set(L.map(x=>x.method))].filter(m=>!(m in POLICY.FORWARD)||WRITE.has(m));
  /* a phone with WalletConnect (the harness's mock plays the relay and the phone wallet): fresh pairing, then a stored session restored at init */
  const wcRow=async stored=>{ const P=await H.boot({wallets:[],wc:{accounts:[A1],chainId:'0x1'}},Object.assign({query:q('real')},PHONE5));
    try{ await ev(P,()=>__SG.configure({mine:200,readerMs:20})); if(stored) await ev(P,()=>{ __MW.wc.provider.session={topic:'stored-topic',peer:{metadata:{name:'Phone'}}}; });
      await P.page.click('#wallet'); const g=await P.until(()=>ev(P,()=>__SG.modalOpen()),8000); await sleep(400);
      const at=await ev(P,()=>({init:!!__MW.wc.init,enables:__MW.wc.enables,req:__MW.log.filter(x=>x.method==='eth_requestAccounts').length,gateText:__SG.modalText().slice(0,400),label:document.getElementById('wallet').textContent}));
      await P.page.click('#sg-modal [data-gate=go]'); if(!stored){ await P.until(()=>ev(P,()=>!!__MW.wc.approve),6000); await ev(P,()=>__MW.wc.approve()); }
      const c=await P.until(async()=>/0x/.test(await ev(P,()=>document.getElementById('wallet').textContent)),8000);
      const after=await ev(P,()=>({enables:__MW.wc.enables,req:__MW.log.filter(x=>x.method==='eth_requestAccounts').length,methods:[...new Set(__MW.log.map(x=>x.method))]}));
      return {stored,gate:g,at,conn:c,after,errors:P.errors.slice()}; } finally{ await P.close().catch(()=>{}); } };
  const w1=await wcRow(false), w2=await wcRow(true);
  const wcOk=r=>r.gate&&r.at.init&&r.at.enables===0&&r.at.req===0&&/CONNECT/.test(r.at.label)&&/will now ask to connect/.test(r.at.gateText)&&/WalletConnect relay/.test(r.at.gateText)&&r.conn&&r.after.methods.every(m=>m in POLICY.FORWARD&&!WRITE.has(m))&&r.errors.length===0
    &&(r.stored?(r.after.req===1&&r.after.enables===0):(r.after.enables===1));
  return {pass:g1&&/will now ask to connect/.test(gt)&&before.every(m=>m==='eth_chainId')&&req0===0&&reqCancel===0&&/CONNECT/.test(lCancel)&&conn&&reqGo===1
    &&s1.g&&s1.switchText&&s1.atGate===0&&s1.result==='refused 4001'&&s1.after===0&&s2.g&&s2.atGate===0&&s2.result==='ok'&&s2.after===1&&revoke===1&&again.gate&&again.askedBeforeGate===0&&again.conn&&!notAllowed.length&&wcOk(w1)&&wcOk(w2),
    ev:{beforeGate:before,req:[req0,reqCancel,reqGo],reconnectSoonAfter:again,switchCancel:s1,switchGo:s2,revoke,notAllowed,walletConnect:[w1,w2]}}; },{query:q('real')});

/* ── st34: default-deny: every payment / signature / batch / raw / user-operation method and every unknown method is stopped at every wrapper */
const B5_INTERCEPT=['eth_sendTransaction','eth_sendUserOperation','wallet_sendCalls','wallet_sendTransaction','eth_sendRawTransaction','eth_signTransaction','wallet_grantPermissions','eth_sign','personal_sign','eth_signTypedData','eth_signTypedData_v1','eth_signTypedData_v3','eth_signTypedData_v4'];
const B5_UNKNOWN=['stormglass_madeUpMethod','wallet_madeUpWrite','wallet_addEthereumChain','wallet_watchAsset','wallet_requestPermissions','wallet_getCapabilities','wallet_getCallsStatus','wallet_showCallsStatus','eth_getEncryptionPublicKey','eth_decrypt','eth_subscribe','eth_coinbase','ETH_SENDTRANSACTION','eth_sendtransaction',' eth_chainId','@obj'];
const B5_PARAMS={eth_sendTransaction:[{from:'0x00000000000000000000000000000000000000aa',to:'0x00000000000000000000000000000000000000bb',value:'0x1',data:'0x'}],eth_sendUserOperation:[{sender:'0x00000000000000000000000000000000000000aa',callData:'0x'},'0x0000000071727De22E5E9d8BAf0edAc6f37da032'],wallet_sendCalls:[{version:'1.0',chainId:'0x1',from:'0x00000000000000000000000000000000000000aa',calls:[{to:'0x00000000000000000000000000000000000000bb',value:'0x1',data:'0x'}]}],
  eth_sendRawTransaction:['0x02f8'],personal_sign:['0x68656c6c6f','0x00000000000000000000000000000000000000aa'],eth_sign:['0x00000000000000000000000000000000000000aa','0x68656c6c6f']};
T('st34','REAL WALLET default-deny: on the EIP-6963 wallet, window.ethereum, providers[] and the WalletConnect wrapper (and on the connected EP), the 13 payment / signature / batch / raw / user-operation methods are intercepted (4001) and 16 unknown or unlisted methods (a made-up name, wallet_addEthereumChain, wallet_getCapabilities, a case variant, a padded name, a non-string method…) are refused (4200); a method name that changes between reads is read once; none of them reaches any mock wallet; inside the WalletConnect bundle the belt refuses eth_sendUserOperation and wallet_sendCalls',
  {wallets:[mock('A',{announce:false}),mock('B')],ethereum:'A',providers:['A','B'],wc:{accounts:[A1],chainId:'0x1'}},async E=>{
  await ev(E,()=>__SG.configure({mine:200,readerMs:20})); await ev(E,async()=>{ window.__WCW=await _wcGlobal().EthereumProvider.init({projectId:'x'}); });
  const list=B5_INTERCEPT.map(m=>['x:'+m,m,B5_PARAMS[m]||[]]).concat(B5_UNKNOWN.map(m=>['u:'+m,m,[]]));
  const res={}; for(const w of ['eth','prov1','b6963']) res[w]=await b5ask(E,w,list);
  res.wc=await ev(E,async list=>{ const P=window.__WCW, out={}; for(const [k,m,params] of list){ const mm=m==='@obj'?{toString(){ return 'eth_chainId'; }}:m; const pr=Promise.resolve().then(()=>P.request({method:mm,params})).then(()=>'resolved',e=>'refused '+(e&&e.code));
      for(let i=0;i<40;i++){ const done=await Promise.race([pr.then(()=>true),new Promise(r=>setTimeout(()=>r(false),25))]); if(done) break; const b=document.querySelector('#sg-modal [data-out=rejected]')||document.querySelector('#sg-modal .sg-b'); if(b) b.click(); } out[k]=await pr; } return out; },list);
  await realConnect(E,/MOCK B/).catch(async()=>{ await realConnect(E); }); res.EP=await b5ask(E,'EP',list);
  /* a method name that reads eth_chainId first and eth_sendTransaction after: the wrapper reads it once */
  const toctou=await ev(E,async()=>{ let n=0; const args={get method(){ return n++?'eth_sendTransaction':'eth_chainId'; },params:[{from:'0x00000000000000000000000000000000000000aa',to:'0x00000000000000000000000000000000000000bb',value:'0x1'}]}; const r=await EP.request(args).then(v=>'resolved '+v,e=>'refused '+e.code); return {r,reads:n}; });
  const belt=await ev(E,async()=>{ const out={}; for(const m of ['eth_sendUserOperation','wallet_sendCalls','eth_sendRawTransaction']) out[m]=await __MW.wc.provider.request({method:m,params:[{}]}).then(()=>'resolved',e=>'refused '+e.code); return out; });
  const L=await ev(E,()=>__MW.log.map(x=>({pid:x.pid,method:typeof x.method==='string'?x.method:'(non-string method: '+typeof x.method+')'}))); const names=new Set(B5_INTERCEPT.concat(B5_UNKNOWN.filter(x=>x!=='@obj'))); const reached=L.filter(x=>names.has(x.method)||/^\(non-string/.test(x.method)||WRITE.has(x.method)).map(x=>x.pid+' '+x.method); const mwSends=await ev(E,()=>__MW.sends.length);
  const bad=[]; for(const [w,r] of Object.entries(res)) for(const [k] of list){ const want=k.startsWith('x:')?'refused 4001':'refused 4200'; if(r[k]!==want) bad.push(w+' '+k+' = '+r[k]); }
  return {pass:!bad.length&&toctou.r==='resolved 0x1'&&toctou.reads===1&&Object.values(belt).every(v=>v==='refused 4001')&&!reached.length&&mwSends===0,
    ev:{bad:bad.slice(0,20),counts:Object.fromEntries(Object.entries(res).map(([w,r])=>[w,list.filter(([k])=>r[k]===(k.startsWith('x:')?'refused 4001':'refused 4200')).length+'/'+list.length])),sample:res.EP,toctou,belt,reached,mwSends,walletReceived:[...new Set(L.map(x=>x.pid+' '+x.method))]}}; },{query:q('real')});

/* ── st35: every supported contract write, sent by the page's own send(), is intercepted with its decoded action; withdrawTo's recipient decoded exactly; before and after DISCONNECT → reconnect */
const B5_R='0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359';   /* EIP-55 mixed-case, checksummed */
T('st35','REAL WALLET: each supported contract write (bid, settle, pledge, sync, buy, witness, claim, withdraw, withdrawTo), sent through the page’s own send(), stops at the wrapper with its decoded action and the STORMGLASS target; withdrawTo shows and carries the exact checksummed recipient (decoded from the calldata of the simulated transaction); after DISCONNECT and a new connection the same holds; the mock wallet receives no write and no signature',{wallets:[mock('A')],ethereum:'A'},async E=>{
  await ev(E,()=>__SG.configure({mine:200,readerMs:20})); await realConnect(E);
  const C=(await ev(E,()=>CFG.contract)).toLowerCase();
  const writes=[['bid','bid',[],'0x2386f26fc10000'],['settle','settleCandle',[]],['pledge','pledge',[],'0x2386f26fc10000'],['sync','sync',[]],['buy','buy',[13,3],'0x2386f26fc10000'],['witness','witness',[13],'0x2386f26fc10000'],['claim','claim',[]],['withdraw','withdraw',[]],['withdrawTo','withdrawTo',[B5_R]]];
  const round=async(tag,pick)=>{ const out={}; for(const [name,fn,args,val] of (pick?writes.filter(w=>pick.includes(w[0])):writes)){
      const r=await ev(E,async([name,fn,args,val])=>{ const p=send(name,W=>pad(W[fn],args,val?{value:BigInt(val)}:{})); let rows=null;
        for(let i=0;i<200&&!rows;i++){ await new Promise(r=>setTimeout(r,25)); if(__SG.modalOpen()&&document.querySelector('#sg-modal [data-out]')) rows=Object.fromEntries([...document.querySelectorAll('#sg-modal dt')].map(d=>[d.textContent,d.nextSibling.textContent])); }
        const head=__SG.modalText().slice(0,60); const b=document.querySelector('#sg-modal [data-out=rejected]'); if(b) b.click(); await Promise.race([p,new Promise(r=>setTimeout(r,4000))]); for(let i=0;i<40&&OPLOCK;i++) await new Promise(r=>setTimeout(r,50)); return {rows,head,lock:OPLOCK===null}; },[name,fn,args,val||null]);
      out[name]=r; } return out; };
  const r1=await round('first');
  /* withdrawTo once more, CONFIRMED: the simulated transaction's calldata names the exact recipient */
  await ev(E,()=>__SG.configure({owed:0.05}));
  const conf=await ev(E,async R=>{ const p=send('withdrawTo',W=>pad(W.withdrawTo,[R])); for(let i=0;i<200&&!document.querySelector('#sg-modal [data-out=confirmed]');i++) await new Promise(r=>setTimeout(r,25)); document.querySelector('#sg-modal [data-out=confirmed]').click(); await Promise.race([p,new Promise(r=>setTimeout(r,8000))]); for(let i=0;i<100&&__SG.txs().some(t=>t.action==='withdrawTo'&&t.state==='pending');i++) await new Promise(r=>setTimeout(r,50)); return __SG.txs().filter(t=>t.action==='withdrawTo').map(t=>({data:t.data,from:t.from,to:t.to,value:t.value,state:t.state,mode:t.mode})); },B5_R);
  await H.disconnectUI(E); await E.until(async()=>/CONNECT/.test(await label(E)),5000); const ep0=await ev(E,()=>EP===null);
  const rc=await b5connect(E); const refs=await b5refs(E); const r2=await round('after reconnect',['witness','withdrawTo','claim']);
  const L=await mwLog(E); const reached=L.filter(x=>WRITE.has(x.method)||!(x.method in POLICY.FORWARD)).map(x=>x.method); const mwSends=await ev(E,()=>__MW.sends.length);
  const okRow=(name,fn,r)=>r&&r.rows&&/SUBMISSION INTERCEPTED/.test(r.head)&&(r.rows.ACTION||'').startsWith(fn+'(')&&(r.rows.TARGET||'').toLowerCase().startsWith(C)&&/STORMGLASS contract/.test(r.rows.TARGET)&&(r.rows.SENDER||'').toLowerCase()===A1&&r.lock
    &&(name!=='withdrawTo'||(r.rows['PAYS TO (recipient)']===B5_R&&r.rows.ACTION.includes(B5_R)&&/^0\.0 ETH$/.test(r.rows.VALUE)));
  const bad=writes.filter(([n,f])=>!okRow(n,f,r1[n])).map(w=>w[0]).concat(['witness','withdrawTo','claim'].filter(n=>!okRow(n,writes.find(w=>w[0]===n)[1],r2[n])).map(n=>'after:'+n));
  const dec=conf.map(t=>decodeTo(t)); const last=conf[conf.length-1]||{};
  return {pass:!bad.length&&conf.length===1&&dec[0]===B5_R&&last.state==='confirmed'&&last.mode==='intercepted'&&last.from===A1&&last.to===C&&last.value==='0'&&ep0&&rc.gate&&rc.askedBeforeGate===0&&rc.conn&&refs.allOk&&refs.EPset&&!reached.length&&mwSends===0,
    ev:{bad,reconnect:rc,first:Object.fromEntries(Object.entries(r1).map(([k,v])=>[k,v.rows&&v.rows.ACTION])),withdrawToRows:r1.withdrawTo&&r1.withdrawTo.rows,afterReconnect:Object.fromEntries(Object.entries(r2).map(([k,v])=>[k,v.rows&&v.rows.ACTION])),confirmed:{decoded:dec,last},refs,reached,mwSends}}; },{query:q('real')});

/* ── st36: no raw provider reference reaches the page, before and after DISCONNECT → reconnect; listeners run with the wrapper as `this` */
T('st36','REAL WALLET, computer: an EventEmitter-style wallet (its listeners are called with this = the emitter) announced over EIP-6963, plus window.ethereum and providers[]: every provider the page holds is a wrapper; a listener added through the wrapper runs with this = the wrapper, never the raw provider, and removeListener still removes it; the page follows its account change; a WITNESS is intercepted; after DISCONNECT and a new connection the page holds the same wrapper and a WITNESS, personal_sign and wallet_sendCalls are again stopped: the raw wallet receives no write and no signature',
  {wallets:[mock('A',{announce:false}),mock('B',{announce:false})],ethereum:'A',providers:['A','B']},async E=>{
  await ev(E,()=>{ const L={}, log=window.__RAWLOG=[]; let acc=['0x00000000000000000000000000000000000000ee','0x00000000000000000000000000000000000000ef']; let auth=false;
    const P=window.__RAWP={ isEmitter:true,
      request({method,params}){ log.push(method); switch(method){ case 'eth_chainId': return Promise.resolve('0x1'); case 'eth_accounts': return Promise.resolve(auth?acc.slice():[]); case 'eth_requestAccounts': auth=true; return Promise.resolve(acc.slice());
        case 'wallet_revokePermissions': auth=false; return Promise.resolve(null); case 'eth_sendTransaction': return Promise.resolve('0x'+'ab'.repeat(32)); case 'personal_sign': case 'wallet_sendCalls': return Promise.resolve('0x'+'cd'.repeat(65)); default: return Promise.reject(Object.assign(new Error('unsupported '+method),{code:4200})); } },
      on(ev,f){ (L[ev]=L[ev]||[]).push(f); return P; }, removeListener(ev,f){ L[ev]=(L[ev]||[]).filter(x=>x!==f); return P; },
      emit(ev,...a){ (L[ev]||[]).slice().forEach(f=>f.apply(P,a)); }, count:ev=>(L[ev]||[]).length, swap(){ acc=[acc[1],acc[0]]; P.emit('accountsChanged',acc.slice()); } };
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:Object.freeze({info:Object.freeze({uuid:'00000000-0000-4000-8000-0000000000ee',name:'Emitter',icon:'',rdns:'test.emitter'}),provider:P})})); });
  await ev(E,()=>__SG.configure({mine:200,readerMs:20})); await sleep(300);
  await realConnect(E,/EMITTER/); const l0=await label(E); const refs1=await b5refs(E);
  const lt=await ev(E,()=>{ const seen=[]; const f=function(c){ seen.push(this); }; EP.on('chainChanged',f); __RAWP.emit('chainChanged','0x1'); const n1=seen.length; EP.removeListener('chainChanged',f); __RAWP.emit('chainChanged','0x1');
    return {delivered:n1,thisIsWrapper:seen[0]===EP,thisIsRaw:seen[0]===__RAWP,afterRemove:seen.length}; });
  await ev(E,()=>__RAWP.swap()); const moved=await E.until(async()=>/00ef/i.test(await label(E)),5000);
  const wit=async()=>{ await H.closeWit(E.page); await H.witness(E,'0.01'); const p=await waitModal(E); if(!p) return false; const t=await modalText(E); await clickModal(E,'[data-out=rejected]'); await E.until(()=>ev(E,()=>OPLOCK===null),8000); return p&&/SUBMISSION INTERCEPTED/.test(t)&&/witness\(arg0: 13\)/.test(t); };
  const w1=await wit(); const EP1=await ev(E,()=>{ window.__EP1=EP; return __SG.isWrapper(EP); });
  await H.disconnectUI(E); await E.until(async()=>/CONNECT/.test(await label(E)),5000); const revoked=await ev(E,()=>__RAWLOG.includes('wallet_revokePermissions'));
  const rc=await b5connect(E,/EMITTER/); const refs2=await b5refs(E); const same=await ev(E,()=>EP===window.__EP1&&EP!==__RAWP);
  const w2=await wit(); const sig=await b5ask(E,'EP',[['ps','personal_sign',B5_PARAMS.personal_sign],['sc','wallet_sendCalls',B5_PARAMS.wallet_sendCalls],['raw','eth_sendRawTransaction',['0x02']]]);
  const lt2=await ev(E,()=>{ const seen=[]; const f=function(){ seen.push(this); }; EP.on('chainChanged',f); __RAWP.emit('chainChanged','0x1'); EP.removeListener('chainChanged',f); return seen[0]===EP&&seen[0]!==__RAWP; });
  const rawLog=await ev(E,()=>__RAWLOG.slice()); const rawWrites=rawLog.filter(m=>WRITE_LIST.includes(m)); const L=await mwLog(E); const reached=L.filter(x=>WRITE.has(x.method)).map(x=>x.pid+' '+x.method);
  return {pass:/00ee/i.test(l0)&&refs1.allOk&&refs1.EPset&&lt.delivered===1&&lt.thisIsWrapper&&!lt.thisIsRaw&&lt.afterRemove===1&&moved&&w1&&EP1&&revoked&&rc.gate&&rc.askedBeforeGate===0&&rc.conn&&refs2.allOk&&same&&w2&&Object.values(sig).filter(v=>/^refused/.test(v)).length===3&&sig.ps==='refused 4001'&&sig.sc==='refused 4001'&&lt2&&!rawWrites.length&&!reached.length&&E.errors.length===0,
    ev:{label:l0,refs1,listenerThis:lt,reconnect:rc,moved,witness:[w1,w2],revoked,refs2,sameWrapper:same,sig,listenerThisAfterReconnect:lt2,rawLog:[...new Set(rawLog)],rawWrites,reached}}; },{query:q('real')});
const WRITE_LIST=POLICY.TX.concat(POLICY.SIGN);

/* ── st37: WalletConnect (mocked phone wallet): disconnect, a new pairing (a replaced session), the phone ending the session: the wrapper boundary holds */
T('st37','REAL WALLET on a phone via WalletConnect (the harness mock plays the relay and the phone wallet): a COLLECT is intercepted; DISCONNECT, a new pairing (new session topic) through the gate, a WITNESS intercepted again; the phone ends the session, a third pairing, again intercepted; personal_sign, wallet_sendCalls and eth_sendUserOperation refused on the wrapper and by the belt inside the bundle; the page holds the same wrapper (never the raw provider), its session is a frozen copy carrying the new topic; the mock receives no write or signature',
  {wallets:[],wc:{accounts:[A1],chainId:'0x1'}},async E=>{
  await ev(E,()=>__SG.configure({mine:200,readerMs:20}));
  const pair=async()=>{ await H.closeWit(E.page); await E.page.click('#wallet'); const g=await waitModal(E); const e0=await ev(E,()=>__MW.wc.enables); await clickModal(E,'[data-gate=go]'); await E.until(()=>ev(E,()=>!!__MW.wc.approve),6000); await ev(E,()=>__MW.wc.approve());
    const c=await E.until(async()=>/0x/.test(await label(E)),8000); return {gate:g,enablesAtGate:e0,conn:c,topic:await ev(E,()=>_WC.session&&_WC.session.topic),frozen:await ev(E,()=>Object.isFrozen(_WC.session)),raw:await ev(E,()=>_WC===__MW.wc.provider)}; };
  const stop=async how=>{ if(how==='buy') await H.buy(E); else await H.witness(E,'0.01'); const p=await waitModal(E); if(!p){ await H.closeWit(E.page); return false; } const t=await modalText(E); await clickModal(E,'[data-out=rejected]'); await E.until(()=>ev(E,()=>OPLOCK===null),8000); await H.closeWit(E.page); await ev(E,()=>{ const x=document.getElementById('ccX'); if(x) x.click(); }); return p&&/SUBMISSION INTERCEPTED/.test(t); };
  const p1=await pair(); const W1=await ev(E,()=>{ window.__WC1=_WC; return __SG.isWrapper(_WC); }); const s1=await stop('buy');
  await H.disconnectUI(E); const d1=await E.until(async()=>/CONNECT/.test(await label(E)),5000);
  const p2=await pair(); const s2=await stop('witness');
  await ev(E,()=>__MW.wc.phoneEnds()); const d2=await E.until(async()=>/CONNECT/.test(await label(E)),5000);
  const p3=await pair(); const s3=await stop('witness'); const refs=await b5refs(E); const same=await ev(E,()=>_WC===window.__WC1&&EP===_WC);
  const sig=await b5ask(E,'wc',[['ps','personal_sign',B5_PARAMS.personal_sign],['sc','wallet_sendCalls',B5_PARAMS.wallet_sendCalls],['uo','eth_sendUserOperation',B5_PARAMS.eth_sendUserOperation],['mu','wallet_madeUpWrite',[]]]);
  const belt=await ev(E,async()=>{ const o={}; for(const m of ['personal_sign','wallet_sendCalls','eth_sendUserOperation','eth_sendTransaction']) o[m]=await __MW.wc.provider.request({method:m,params:[{}]}).then(()=>'resolved',e=>'refused '+e.code); return o; });
  const w=await ev(E,()=>({enables:__MW.wc.enables,disconnects:__MW.wc.disconnects}));
  const L=await mwLog(E); const reached=L.filter(x=>WRITE.has(x.method)||!(x.method in POLICY.FORWARD)).map(x=>x.method);
  const okP=p=>p.gate&&p.enablesAtGate===w.enables-(p===p1?2:p===p2?1:0)-1&&p.conn&&p.frozen&&!p.raw;
  return {pass:okP(p1)&&okP(p2)&&okP(p3)&&new Set([p1.topic,p2.topic,p3.topic]).size===3&&W1&&s1&&s2&&s3&&d1&&d2&&refs.allOk&&same&&sig.ps==='refused 4001'&&sig.sc==='refused 4001'&&sig.uo==='refused 4001'&&sig.mu==='refused 4200'
    &&Object.values(belt).every(v=>v==='refused 4001')&&w.enables===3&&w.disconnects===1&&!reached.length&&E.errors.length===0,
    ev:{pairings:[p1,p2,p3],intercepted:[s1,s2,s3],disconnected:[d1,d2],refs,sameWrapper:same,sig,belt,w,reached,walletReceived:[...new Set(L.map(x=>x.method))]}}; },Object.assign({query:q('real')},PHONE5));

/* ── st38: the page and the staging report describe both modes accurately */
const B5_RELAY=/WalletConnect relay/, B5_PAYINT=/payments? and signatures?[^.]{0,40}intercepted|intercepted[^.]{0,20}payments? and signatures?|INTERCEPTED: payments and signatures/i, B5_SIMOUT=/outcomes? (are |stay |is )?simulated|every transaction outcome|outcome[^.]{0,30}simulated/i, B5_NEVER=/never reach/i;
T('st38','the staging page and the staging report describe both modes accurately: REAL WALLET (mode chooser, CONTROLS, the opening note, the gate, the intercept panel) says the real wallet and, on a phone, the WalletConnect relay are contacted for the connection, that payments and signatures are intercepted and that outcomes are simulated; SIMULATION says simulated wallets and results and no relay; nothing says “never reaches”; the report separates the modes and calls socket blocking a property of the test environment',{wallets:[mock('A')],ethereum:'A'},async E=>{
  const real=await ev(E,async()=>{ const g=s=>{ const n=document.querySelector(s); return n?n.textContent:''; };
    document.getElementById('sg-modebtn').click(); await new Promise(r=>setTimeout(r,200)); const modeReal=g('#sg-modal [data-sg-explain=mode-real]'), modeSim=g('#sg-modal [data-sg-explain=mode-sim]'); const modeAll=__SG.modalText();
    const c=[...document.querySelectorAll('#sg-modal button')].find(b=>/^CLOSE$/.test(b.textContent)); if(c) c.click(); await new Promise(r=>setTimeout(r,150));
    document.getElementById('sg-ctl').click(); await new Promise(r=>setTimeout(r,200)); const drawer=g('#sg-drawer [data-sg-explain=drawer-real]'), drawerAll=g('#sg-drawer'); document.getElementById('sg-ctl').click();
    return {modeReal,modeSim,modeAll,drawer,drawerAll,note:__SG.realNote}; });
  await E.page.click('#wallet'); await waitModal(E); const gate=await ev(E,()=>{ const n=document.querySelector('#sg-modal [data-sg-explain=gate]'); return {p:n?n.textContent:'',all:__SG.modalText()}; }); await clickModal(E,'[data-gate=go]'); await E.until(async()=>/0x/.test(await label(E)),8000);
  await ev(E,()=>__SG.configure({mine:200,readerMs:20})); await H.witness(E,'0.01'); await waitModal(E); const icp=await modalText(E); await clickModal(E,'[data-out=rejected]');
  /* SIMULATION, in a fresh context */
  const S=await H.boot({wallets:[]},{query:q('sim')}); let sim;
  try{ sim=await ev(S,async()=>{ const g=s=>{ const n=document.querySelector(s); return n?n.textContent:''; }; document.getElementById('sg-modebtn').click(); await new Promise(r=>setTimeout(r,200)); const modeSim=g('#sg-modal [data-sg-explain=mode-sim]'), all=__SG.modalText();
      const c=[...document.querySelectorAll('#sg-modal button')].find(b=>/^CLOSE$/.test(b.textContent)); if(c) c.click(); await new Promise(r=>setTimeout(r,150)); document.getElementById('sg-ctl').click(); await new Promise(r=>setTimeout(r,200)); const drawer=g('#sg-drawer [data-sg-explain=drawer-sim]'), drawerAll=g('#sg-drawer'); document.getElementById('sg-ctl').click(); return {modeSim,all,drawer,drawerAll}; }); } finally{ await S.close().catch(()=>{}); }
  const rep=fs.readFileSync(path.join(ROOT,'tools/stormglass/wallet-tests/audit5/STAGING5_REPORT.md'),'utf8'); const sec=(rep.split(/^## /m).find(s=>/^4b?\. .*boundary/i.test(s))||'');
  const realOk=t=>B5_RELAY.test(t)&&/connect/i.test(t)&&B5_PAYINT.test(t)&&B5_SIMOUT.test(t)&&!B5_NEVER.test(t);
  const checks={modeReal:realOk(real.modeReal),drawer:realOk(real.drawer),note:B5_RELAY.test(real.note)&&/connection/i.test(real.note)&&/intercepted/i.test(real.note)&&/outcomes are simulated/i.test(real.note)&&!B5_NEVER.test(real.note),
    gate:/real request to your real wallet/.test(gate.p)&&/intercepted/.test(gate.p)&&/simulated/.test(gate.p)&&/will now ask to connect/.test(gate.all)&&!B5_NEVER.test(gate.all),
    intercept:/SUBMISSION INTERCEPTED/.test(icp)&&/Payments and signatures are intercepted/.test(icp)&&/simulated/.test(icp)&&/WalletConnect relay/.test(icp)&&!B5_NEVER.test(icp),
    simInReal:/Simulated wallets and simulated results/.test(real.modeSim)&&/no relay connection/.test(real.modeSim),
    sim:/Simulated wallets and simulated results/.test(sim.modeSim)&&/no relay connection/.test(sim.modeSim)&&/WalletConnect relay/.test(sim.drawer)&&/SIMULATED/.test(sim.drawer)&&!B5_NEVER.test(sim.all+sim.drawerAll),
    noNeverAnywhere:!B5_NEVER.test(real.modeAll+real.drawerAll),
    report:/audit 5b/i.test(sec)&&B5_RELAY.test(sec)&&/intercepted/i.test(sec)&&/simulated/i.test(sec)&&/test environment/i.test(sec)&&/not evidence|never proof|is not proof/i.test(sec)&&/EthereumProvider\.init/.test(sec)&&!/never reaches the (real )?(WalletConnect )?relay/i.test(rep)};
  return {pass:Object.values(checks).every(Boolean),ev:{checks,modeReal:real.modeReal.slice(0,200),drawer:real.drawer.slice(0,200),note:real.note,gate:gate.p,intercept:icp.slice(0,300),sim:sim.modeSim.slice(0,160),reportSection:sec.slice(0,200)}}; },{query:q('real')});

/* ── st39-st41: SCENARIOS 7, what is owed changes after REVIEW (SIMULATION). The simulated contract pays all that is owed at execution. */
async function b5withdraw(E,o){   /* o: {kind, when:'now'|'wallet', choose:'confirmed'|'replacedpaid', owed:'0.05'} */
  await setupOwed(E,o.owed||'0.05','accepts'); await b5drawerOff(E);
  if(!/0x/.test(await label(E))) await simConnect(E,/SIM ALPHA · 1/);
  await wOpen(E); const n0=(await E.toasts()).length; const l0=(await fullLog(E)).length; const t0=(await txs(E)).length;
  if(o.kind&&o.when==='wallet'){ await b5ctl(E,'[data-owedchg="'+o.kind+'"]'); await b5ctl(E,'[data-act=owed-arm]'); await b5drawerOff(E); }
  await wReview(E,R1L); const sh=await E.until(async()=>/WITHDRAW/i.test(await H.sheetTitle(E.page)),6000); const sheet=await ev(E,()=>document.getElementById('wsheet').textContent);
  if(o.kind&&o.when==='now'){ await b5ctl(E,'[data-owedchg="'+o.kind+'"]'); await b5ctl(E,'[data-act=owed-now]'); await b5drawerOff(E); }
  const owedAtSend=await ev(E,a=>__SG.owedOf(a),ALPHA1);
  /* every text the status line and the seats note show from here on (a sentence later cleared by a refresh still counts) */
  await ev(E,()=>{ const h=window.__b5hist=[]; for(const id of ['wtoNote','seatsNote']){ const n=document.getElementById(id); if(!n) continue; new MutationObserver(()=>{ if(n.textContent) h.push(id+': '+n.textContent); }).observe(n,{childList:true,characterData:true,subtree:true}); } });
  const pressed=await ev(E,()=>{ const b=[...document.querySelectorAll('#wsBtns button')].find(b=>/SEND|WITHDRAW|CONFIRM/i.test(b.textContent)&&!/CANCEL/i.test(b.textContent)); if(!b) return false; b.click(); return true; });
  const wallet=await E.until(()=>modalOpen(E),8000); let panel=null, owedAtWallet=null;
  if(wallet){ panel=await ev(E,()=>Object.fromEntries([...document.querySelectorAll('#sg-modal dt')].map(d=>[d.textContent,d.nextSibling.textContent]))); owedAtWallet=await ev(E,a=>__SG.owedOf(a),ALPHA1); await clickModal(E,'[data-out='+(o.choose||'confirmed')+']'); }
  const settled=wallet?await E.until(async()=>{ const t=(await txs(E)).slice(t0).find(x=>x.action==='withdrawTo'); return !!t&&t.state!=='pending'&&(await ev(E,()=>OPLOCK===null)); },15000):await E.until(()=>ev(E,()=>OPLOCK===null),8000);
  const FINAL=/: confirmed|reverted|failed|replaced|cancelled|cannot confirm|nothing was sent/i;
  const verdict=await E.until(async()=>(await idToasts(E,n0)).some(x=>FINAL.test(x)),20000); await sleep(1200);
  const T1=(await txs(E)).slice(t0); const tx=T1.find(x=>x.action==='withdrawTo')||null; const rep=T1.find(x=>x.replaces)||null; const L=(await fullLog(E)).slice(l0);
  return {kind:o.kind,when:o.when,choose:o.choose||'confirmed',verdict,sheet:sh,sheetHasRecipient:sheet.includes(R1),pressed,wallet,panelOwed:panel&&panel['OWED NOW (simulated)'],panelPaysTo:panel&&panel['PAYS TO (recipient)'],owedAtSend,owedAtWallet,settled,
    tx:tx&&{state:tx.state,why:tx.why,to:decodeTo(tx),from:tx.from},replacement:rep&&{action:rep.action,state:rep.state},sends:sends(L).length,payouts:L.filter(x=>x.method==='payout').map(x=>x.route.slice(0,120)),owedAfter:await ev(E,a=>__SG.owedOf(a),ALPHA1),
    received:await ev(E,()=>__SG.receivedOf('0x52908400098527886e0f7030069857d2e4169ee7')),receivedSelf:await ev(E,a=>__SG.receivedOf(a),ALPHA1),toasts:await idToasts(E,n0),note:await wNote(E).catch(()=>''),hist:await ev(E,()=>window.__b5hist.slice()),changes:L.filter(x=>x.method==='owed change').map(x=>x.route)}; }
const b5gwei=v=>BigInt(v);
T('st39','SCENARIO 7 (audit 5b) from CONTROLS: after REVIEW what is owed INCREASES or DECREASES, at the review sheet before the wallet is asked (CHANGE NOW) and when the wallet screen opens (ARM): the transaction names the reviewed recipient, the outcome is confirmed and the simulated contract pays everything owed at execution (0.10 or 0.025 ETH, not the reviewed 0.05), owed back to 0',{wallets:[]},async E=>{
  await ev(E,()=>__SG.configure({mine:300,readerMs:20})); const rows=[];
  for(const [kind,when] of [['increase','now'],['decrease','wallet'],['increase','wallet'],['decrease','now']]){ const r=await b5withdraw(E,{kind,when}); const want=kind==='increase'?100000000000000000n:25000000000000000n;
    r.paid=b5gwei(r.received); r.want=String(want);   /* SET UP clears the received totals */
    r.ok=r.sheet&&r.sheetHasRecipient&&r.pressed&&r.wallet&&r.settled&&r.tx&&r.tx.state==='confirmed'&&r.tx.to===R1&&r.tx.from===ALPHA1&&r.panelPaysTo===R1&&r.paid===want&&r.owedAfter==='0'&&r.sends===1&&r.changes.length===1
      &&(when==='now'?r.owedAtSend===String(want):r.owedAtSend==='50000000000000000'&&r.owedAtWallet===String(want)&&new RegExp('^'+(Number(want)/1e18).toString().replace('.','\\.')).test(r.panelOwed||''))
      &&r.toasts.some(x=>/confirmed/i.test(x))&&!r.toasts.some(x=>/reverted|failed/i.test(x));
    rows.push(r); await H.closeWit(E.page); }
  return {pass:rows.every(r=>r.ok)&&E.errors.length===0,ev:{rows:rows.map(r=>Object.assign({},r,{paid:String(r.paid)}))}}; },{query:q('sim')});
T('st40','SCENARIO 7 (audit 5b) from CONTROLS: what is owed BECOMES ZERO after REVIEW: when the wallet screen opens, the confirmed choice reverts on the simulated contract (“nothing owed”), nothing is paid and the page reports a failure, never a payment; at the review sheet before the wallet is asked, either the page stops before the wallet (nothing sent) or the transaction reverts the same way; the recipient sent is the reviewed one',{wallets:[]},async E=>{
  await ev(E,()=>__SG.configure({mine:300,readerMs:20})); const rows=[];
  for(const when of ['wallet','now']){ const r=await b5withdraw(E,{kind:'zero',when});
    const reverted=r.wallet&&r.tx&&r.tx.state==='reverted'&&/nothing owed/.test(r.tx.why||'')&&r.tx.to===R1&&r.sends===1&&(r.toasts.some(x=>/reverted|failed/i.test(x))||/reverted|failed/i.test(r.note));
    const stopped=!r.wallet&&r.sends===0&&!r.tx;   /* a page that reads owed again before asking the wallet (allowed; not required) */
    r.ok=r.sheet&&r.sheetHasRecipient&&r.pressed&&r.settled&&r.owedAfter==='0'&&r.received==='0'&&r.payouts.length===0&&!r.toasts.some(x=>/: confirmed/i.test(x))&&!/^Done/i.test(r.note)
      &&(when==='wallet'?reverted&&r.owedAtSend==='50000000000000000'&&r.owedAtWallet==='0'&&/^0\.0 ETH/.test(r.panelOwed||''):(reverted||stopped)&&r.owedAtSend==='0');
    r.how=reverted?'reverted':stopped?'stopped before the wallet':'?'; rows.push(r); await H.closeWit(E.page); }
  return {pass:rows.every(r=>r.ok)&&E.errors.length===0,ev:{rows}}; },{query:q('sim')});
const B5_STILL_OWED=/stays in the contract|still owed|remains? owed|is still (owed|in the contract)|still holds|remains in the contract/i;
T('st41','SCENARIO 7 (audit 5b): the wallet REPLACES the withdrawTo with a withdraw() that itself pays what was owed (simulated): the page reports the replacement, does not say the original amount is still owed, and its seats view refreshes to nothing owed; the simulated chain shows the original replaced, the replacement mined and the payout to the sender',{wallets:[]},async E=>{
  await ev(E,()=>__SG.configure({mine:300,readerMs:20}));
  const r=await b5withdraw(E,{choose:'replacedpaid'});
  const refreshed=await E.until(()=>ev(E,()=>{ const b=document.getElementById('withdrawTo'); const o=document.getElementById('nx-myOwed'); return (b&&b.style.display==='none')||(!!o&&/^0(\.0+)?\s/.test(o.textContent)); }),15000);
  const allText=r.toasts.join(' | ')+' | '+r.note+' | '+r.hist.join(' | ');
  const ok=r.wallet&&r.tx&&r.tx.state==='replaced'&&r.tx.to===R1&&r.replacement&&r.replacement.action==='withdraw'&&r.replacement.state==='mined'&&r.owedAfter==='0'&&r.receivedSelf==='50000000000000000'&&r.received==='0'
    &&r.toasts.some(x=>/replaced/i.test(x))&&!B5_STILL_OWED.test(allText)&&refreshed;
  return {pass:ok&&E.errors.length===0,ev:{r,refreshed,claimsStillOwed:B5_STILL_OWED.test(allText),text:allText.slice(0,300)}}; },{query:q('sim')});

/* ── st42: the owed controls in REAL mode act on the simulated chain behind the intercept panel */
T('st42','REAL WALLET, SCENARIO 7 (audit 5b): ARM “INCREASES” then WITHDRAW TO ANOTHER ADDRESS: the intercept panel opens with OWED NOW 0.1 ETH, CONFIRMED pays the reviewed recipient everything owed at execution (simulated), and the external wallet receives no write',{wallets:[mock('A')],ethereum:'A'},async E=>{
  await ev(E,()=>__SG.configure({mine:300,readerMs:20})); await setupOwed(E,'0.05','accepts'); await realConnect(E); await wOpen(E);
  await b5ctl(E,'[data-owedchg=increase]'); await b5ctl(E,'[data-act=owed-arm]'); await b5drawerOff(E);
  await wReview(E,R1L); await E.until(async()=>/WITHDRAW/i.test(await H.sheetTitle(E.page)),6000);
  await ev(E,()=>{ const b=[...document.querySelectorAll('#wsBtns button')].find(b=>/SEND|WITHDRAW|CONFIRM/i.test(b.textContent)&&!/CANCEL/i.test(b.textContent)); if(b) b.click(); });
  await waitModal(E); const rows=await ev(E,()=>Object.fromEntries([...document.querySelectorAll('#sg-modal dt')].map(d=>[d.textContent,d.nextSibling.textContent]))); const head=await modalText(E);
  await clickModal(E,'[data-out=confirmed]'); const done=await E.until(async()=>(await txs(E)).some(x=>x.action==='withdrawTo'&&x.state==='confirmed'),15000);
  const t=(await txs(E)).find(x=>x.action==='withdrawTo'); const recv=await ev(E,()=>__SG.receivedOf('0x52908400098527886e0f7030069857d2e4169ee7')); const owed=await ev(E,a=>__SG.owedOf(a),A1);
  const L=await mwLog(E); const reached=L.filter(x=>WRITE.has(x.method)||!(x.method in POLICY.FORWARD)).map(x=>x.method);
  return {pass:/SUBMISSION INTERCEPTED/.test(head)&&/^0\.1 ETH/.test(rows['OWED NOW (simulated)']||'')&&rows['PAYS TO (recipient)']===R1&&done&&t.mode==='intercepted'&&decodeTo(t)===R1&&recv==='100000000000000000'&&owed==='0'&&!reached.length&&E.errors.length===0,
    ev:{rows,done,tx:t&&{state:t.state,mode:t.mode,to:decodeTo(t)},received:recv,owed,reached}}; },{query:q('real')});

module.exports={CASES,T};
/* THE RUN (audit 5b): the shared runner (../wallet-tests/runner.js), the same execution, watchdogs, persistence and exit statuses as the
   production suite, with this suite's own committed manifest (manifest.json beside this file; RELEASE=1 runs exactly its ids). The
   results also identify the staging page tested (full sha256, re-hashed at the end, its commit) and the candidate index.html it was built
   from (the build stamp's sha256 and rev, and whether `git show <rev>:index.html` has exactly that sha256). */
function stagingIdentity(pf){ const html=fs.readFileSync(pf,'utf8'); let stamp=null; try{ stamp=JSON.parse((/const STAMP=(\{[^}]*\})/.exec(html)||[])[1]); }catch(e){}
  const src=R.fileSource(pf), repo=src.repo||ROOT, o={page:path.relative(ROOT,pf),stagingPageEnv:process.env.STAGING_PAGE||null,stamp,candidate:null,index:null};
  if(stamp&&/^[0-9a-f]{7,40}$/.test(stamp.rev)){ try{ const commit=R.git(repo,'rev-parse',stamp.rev+'^{commit}');
      const sha=R.sha256(execFileSync('git',['-C',repo,'show',commit+':'+(stamp.src||'index.html')],{maxBuffer:1<<26,stdio:['ignore','pipe','ignore']}));
      o.candidate={rev:stamp.rev,commit,repo,file:stamp.src||'index.html',sha256:stamp.sha256,gitSha256:sha,matchesStamp:sha===stamp.sha256}; }
    catch(e){ o.candidate={rev:stamp.rev,commit:'unknown',sha256:stamp.sha256,matchesStamp:false,reason:'the stamp rev is not a commit of '+repo+' with '+(stamp.src||'index.html')}; } }
  else o.candidate={rev:stamp?stamp.rev:null,commit:'unknown',sha256:stamp?stamp.sha256:null,matchesStamp:false,reason:stamp?'the build stamp names no commit (rev '+stamp.rev+')':'no build stamp in the page'};
  const ix=path.join(ROOT,'index.html'); try{ const sha=R.sha256(fs.readFileSync(ix)); o.index={path:'index.html',sha256:sha,matchesStamp:!!stamp&&sha===stamp.sha256,source:R.fileSource(ix)}; }catch(e){ o.index={path:'index.html',error:e.message}; }
  return o; }
if(require.main===module){ const PF=path.join(ROOT,PAGE);
  R.run({CASES,REGERR,early:()=>H.earlyError(),
    target:()=>{ const b=fs.readFileSync(PF); return {path:PF,bytes:b.length,sha256:R.sha256(b),source:R.fileSource(PF)}; },servedFromDisk:true,
    extra:()=>({staging:stagingIdentity(PF)}),
    manifest:{file:path.join(__dirname,'manifest.json'),present:()=>['staging.test.js'],groupOf:f=>f==='staging.test.js'?'@staging':null,
      note:'Every staging case id a RELEASE=1 staging run must register. Adding a case means adding its id here in the same commit (node staging.test.js --print-manifest prints the current registration).'},
    harness:{home:path.join(__dirname,'..'),dirs:[__dirname,path.join(__dirname,'../wallet-tests')],root:ROOT},
    boot:H.boot,LIVE:H.LIVE,setBrowser:H.setBrowser,bumpEpoch:H.bumpEpoch,logChars:700}); }
