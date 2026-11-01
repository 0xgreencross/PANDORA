/* THE STAGING TESTS (ids st*): test-wallet.html, built from index.html by build.js, in headless Chromium.
   Same harness as the wallet tests (../wallet-tests/wallet.test.js boot(): fresh context per boot, service workers blocked, every
   WebSocket refused, outside hosts refused, the public RPCs routed to the Node fake chain). In REAL-WALLET mode the harness's mock
   wallet (mockwallet.js) plays the visitor's real wallet: its request log (__MW.log) is what "reached the wallet".
   Run: PORT=8952 SCRIPT=../staging/staging.test.js bash tools/stormglass/wallet-tests/run.sh   (CASES=st1,st3 to select; OUT, LABEL as there)
   The production suite keeps running against index.html (TARGET), not this page. */
const fs=require('fs'), path=require('path'), crypto=require('crypto'), {execFileSync}=require('child_process');
const {chromium}=require('playwright');
const H=require('../wallet-tests/wallet.test.js');
const {sleep,A1,A2}=H;
const ROOT=path.join(__dirname,'../../..'), OUT=process.env.OUT||'/tmp/claude-0/pr1test', LABEL=process.env.LABEL||'staging';
/* STAGING_PAGE: another build of the staging page served from the repo root (e.g. built from a newer candidate); st1/st11 compare with this repo's index.html */
const BUILD=path.join(__dirname,'build.js'), PAGE=process.env.STAGING_PAGE||'test-wallet.html';
const POLICY=require('./policy.js');
const MARKS=['__SG','sg-banner','sg-stage','TEST BUILD','sgmode','STORMGLASS STAGING','sg.staging.mode','POLICY.FORWARD','SUBMISSION INTERCEPTED'];
const WRITE=new Set(POLICY.TX.concat(POLICY.SIGN,['eth_estimateGas']));
const CASES=[];
const T=(id,name,cfg,run,o)=>{ if(!/^st[0-9a-z]+$/.test(id)){ console.log('HARNESS FAIL bad staging case id '+id); process.exit(2); } if(CASES.some(c=>c.id===id)){ console.log('HARNESS FAIL duplicate case id '+id); process.exit(2); } CASES.push({id,name,cfg,run,o:o||{}}); };
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
const fullLog=E=>ev(E,()=>__SG.log.map(x=>({who:x.who,method:x.method,route:x.route,result:x.result,params:x.params})));
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

module.exports={CASES,T};
/* THE RUN (same exit rules as wallet.test.js: 0 only when every selected case ran and passed; 1 on a failure; 2 on a bad selection) */
if(require.main===module){ let RUNNING='(none)'; process.on('beforeExit',()=>{ console.log('HARNESS FAIL the run stopped before it finished, in case '+RUNNING); process.exit(1); });
 (async()=>{
  const want=(process.env.CASES||'').split(',').map(x=>x.trim()).filter(Boolean); const unknown=want.filter(x=>!CASES.some(c=>c.id===x));
  if(unknown.length){ console.log('HARNESS FAIL unknown case ids in CASES: '+unknown.join(',')); process.exit(2); }
  const sel=CASES.filter(c=>!want.length||want.includes(c.id)); if(!sel.length){ console.log('HARNESS FAIL no cases selected'); process.exit(2); }
  const pg=fs.readFileSync(path.join(ROOT,PAGE)); console.log('SELECTED '+sel.length+' of '+CASES.length+': '+sel.map(c=>c.id).join(',')+' · page '+PAGE+' sha256 '+crypto.createHash('sha256').update(pg).digest('hex').slice(0,16));
  const br=await chromium.launch({args:['--no-sandbox','--disable-background-networking','--disable-component-update','--no-first-run'],executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'}); H.setBrowser(br);
  let gone=false; br.on('disconnected',()=>{ gone=true; }); const res=[];
  for(const c of sel){ RUNNING=c.id; H.LIVE.length=0; const t0=Date.now(); let r;
    try{ const E=await H.boot(c.cfg,c.o); r=await c.run(E); if(!r||typeof r!=='object') r={pass:false,ev:{bad:'case returned '+r}}; }
    catch(e){ r={pass:false,ev:{exception:String(e&&e.message||e).slice(0,300)}}; }
    finally{ for(const X of H.LIVE) await X.ctx.close().catch(()=>{}); }
    const errs=H.LIVE.flatMap(X=>X.errors), outside=H.LIVE.flatMap(X=>X.outside), sockets=H.LIVE.flatMap(X=>X.sockets); r.ev=r.ev||{};
    if(errs.length){ r.pass=false; r.ev.failedOnPageErrors=errs.slice(0,3); } if(gone){ r.pass=false; r.ev.browserGone=true; }
    const ms=Date.now()-t0; res.push({id:c.id,name:c.name,pass:r.pass===true,ms,ev:r.ev,outsideRefused:[...new Set(outside)],socketsRefused:[...new Set(sockets)]});
    console.log((r.pass===true?'PASS ':'FAIL ')+c.id.padEnd(4)+' '+c.name+' ('+ms+' ms)\n     '+JSON.stringify(r.ev).slice(0,700)+(outside.length||sockets.length?'\n     refused outside: '+JSON.stringify([...new Set(outside.concat(sockets))]).slice(0,300):''));
    if(gone) break; }
  await br.close().catch(()=>{}); fs.mkdirSync(OUT,{recursive:true}); fs.writeFileSync(path.join(OUT,'results-'+LABEL+'.json'),JSON.stringify(res,null,1));
  const failed=res.filter(r=>!r.pass); console.log('RAN '+res.length+': '+res.map(r=>r.id).join(',')); console.log(LABEL+': '+(res.length-failed.length)+'/'+sel.length+' passed'+(failed.length?' · FAILED: '+failed.map(r=>r.id).join(','):''));
  process.exit(failed.length||res.length!==sel.length?1:0); })().catch(e=>{ console.log('HARNESS FAIL',e&&e.stack||e); process.exit(1); }); }
