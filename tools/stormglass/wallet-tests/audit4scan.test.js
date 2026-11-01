/* THE AUDIT-4 SCAN CASES (audit/wallet-4-scan). Loaded by wallet.test.js as part of group @audit4 (every audit4*.test.js).
   Same mocks, same fake chain: nothing real is touched. Ids a4s1, a4s2, ...
   a4s1      guard: every write entry point (witness, buy, bid, settle, pledge, sync, claim, withdraw) sends exactly one request,
             to the contract, from the connected account, on chain 1, with the value pressed and calldata that decodes, with the
             page's own ABI, to the function and arguments of the button pressed; its gas estimate is for that same call.
   a4s2..    regressions for defects found by the audit-4 lifecycle scan (each fails on 0cd4ea4): see SCAN_REPORT.md. */
const H=require('./wallet.test.js');
const {T,connect,openWit,closeWit,popText,sleep,A1,A2,ETH,FOUNDERS,CANDLE}=H;
const one=(...a)=>H.one(...a);
const E_=v=>BigInt(Math.round(v*1e6))*10n**12n;
const reqs=(E,id,m)=>E.page.evaluate(([id,m])=>__MW.log.filter(x=>x.pid===id&&x.method===m).map(x=>({params:x.params,chain:x.chain})),[id,m]);
async function openOpt(E,k){ await closeWit(E.page); await E.page.evaluate(k=>{ if(!NX.pop) document.getElementById('bPick').click(); document.querySelectorAll('#candGrid .card')[k].click(); },k); await E.page.waitForSelector('#ccBuy'); }
const click=(E,id)=>E.page.evaluate(id=>{ const b=document.getElementById(id); if(!b||b.disabled||!b.getClientRects().length) return false; b.click(); return true; },id);
/* decode with the page's own ABI (index.html's ABI constant), value included */
const decode=(E,tx)=>E.page.evaluate(tx=>{ try{ const t=new ethers.Interface(ABI).parseTransaction({data:tx.data,value:tx.value||'0x0'}); return t?{name:t.name,args:t.args.map(String)}:null; }catch(e){ return {err:String(e.message).slice(0,80)}; } },tx);

/* chain states that bring each button on screen */
const SETTLE={chain:c=>{ c.values.candleSettled=false; c.values.today=0; c.values.lastId=0; c.values.candleOpen=c.t0-31*3600; c.values.revealBlock=1; c.values.onSale=[0n,0n,0n,false]; }};
const UNSOLD={chain:c=>{ const close=c.t0-3600, open=close-86400; c.values.onSale=[13n,0n,BigInt(close),false]; const old=c.plate; c.plate=id=>id===13?[396693683,open,close,0n,0n,'0x0000000000000000000000000000000000000000',0,false]:old(id); }};
const OWED={chain:c=>{ c.values.owed=E_(0.0123); }};

/* one press in its own context: what the wallet was asked (eth_sendTransaction and the eth_estimateGas before it) and what it decodes to */
async function press(E,how){ await connect(E); const t=await how(E); await E.until(async()=>(await reqs(E,'A','eth_sendTransaction')).length>0,8000); await sleep(800);
  const snd=await reqs(E,'A','eth_sendTransaction'), est=await reqs(E,'A','eth_estimateGas');
  const tx=snd[0]&&snd[0].params[0], dec=tx?await decode(E,tx):null, estTx=est[0]&&est[0].params[0];
  const C=await E.page.evaluate(()=>CFG.contract.toLowerCase());
  return {pressed:t,n:snd.length,chainAtSend:snd[0]&&snd[0].chain,to:tx&&String(tx.to).toLowerCase(),C,from:tx&&String(tx.from).toLowerCase(),chainId:tx&&tx.chainId,value:tx&&tx.value,gas:tx&&tx.gas,dec,
    est:estTx?{to:String(estTx.to).toLowerCase(),data:estTx.data,value:estTx.value||null,from:String(estTx.from||'').toLowerCase()}:null,data:tx&&tx.data}; }
const ACTIONS=[
  ['witness',{},async E=>{ await openWit(E.page); await E.page.fill('#wAmt','0.0123'); await E.page.click('#bWit'); return true; },{name:'witness',args:['13'],value:ETH(0.0123)}],
  ['buy',{},async E=>{ await openOpt(E,3); const b=await E.page.evaluate(()=>{ const D=ST.day, s=+ethers.formatEther(D.start), t=NX.now(), f=x=>{ const v=ethers.parseEther(priceNow(s,D.open,x).toFixed(18)); return (v+v/10n).toString(); }; return {hi:f(t+30),lo:f(t+40)}; });
      await E.page.evaluate(()=>document.getElementById('ccBuy').click()); return b; },{name:'buy',args:['13','3']}],
  ['bid',CANDLE,async E=>{ await E.page.waitForSelector('#bidAmt'); await E.page.fill('#bidAmt','0.06'); await E.page.click('#bBid'); return true; },{name:'bid',args:[],value:ETH(0.06)}],
  ['settle',SETTLE,async E=>{ await E.until(()=>click(E,'bSettle'),6000); return true; },{name:'settleCandle',args:[]}],
  ['pledge',FOUNDERS,async E=>{ await E.page.waitForSelector('#plAmt'); await E.page.fill('#plAmt','0.25'); await E.page.click('#bPledge'); return true; },{name:'pledge',args:[],value:ETH(0.25)}],
  ['sync',UNSOLD,async E=>{ await E.until(()=>click(E,'bSync'),6000); return true; },{name:'sync',args:[]}],
  ['claim',{},async E=>{ return await E.until(()=>click(E,'claim'),6000); },{name:'claim',args:[]}],
  ['withdraw',OWED,async E=>{ return await E.until(()=>click(E,'withdraw'),6000); },{name:'withdraw',args:[]}]];

T('a4s1','every write entry point (witness, buy, bid, settle, pledge, sync, claim, withdraw): one request to the contract, from the connected account, chain 1, the pressed value, calldata decoding (page ABI) to the pressed function and arguments; the gas estimate is for the same call',
  {wallets:[one('A')],ethereum:'A'},async E=>{
  const rows={}; let ok=true;
  for(const [name,o,how,want] of ACTIONS){ const X=name==='witness'?E:await H.boot({wallets:[one('A')],ethereum:'A'},o);
    try{ const r=await press(X,how);
      const zero=v=>v==null||BigInt(v)===0n;
      const valOk=name==='buy'?(r.value!=null&&BigInt(r.value)<=BigInt(r.pressed.hi)&&BigInt(r.value)>=BigInt(r.pressed.lo)):want.value?r.value===want.value:zero(r.value);
      const good=!!r.pressed&&r.n===1&&r.chainAtSend==='0x1'&&r.to===r.C&&r.from===A1&&r.chainId==='0x1'&&valOk&&!!r.gas&&r.dec&&r.dec.name===want.name&&JSON.stringify(r.dec.args)===JSON.stringify(want.args)
        &&!!r.est&&r.est.to===r.C&&r.est.data===r.data&&(zero(r.est.value)===zero(r.value))&&(r.est.value==null||r.est.value===r.value)&&X.errors.length===0;
      ok=ok&&good; rows[name]={good,n:r.n,to:r.to===r.C,from:r.from,chainId:r.chainId,chainAtSend:r.chainAtSend,value:r.value,valueOk:valOk,decoded:r.dec,gas:r.gas,estimateSameCall:!!r.est&&r.est.data===r.data&&r.est.to===r.C};
    } catch(e){ ok=false; rows[name]={exception:String(e.message).slice(0,120)}; }
    finally{ if(X!==E) await X.close().catch(()=>{}); } }
  return {pass:ok,ev:rows}; });

/* ═══ a4s2 (DEFECT S1): after an account change, the seats panel and the CLAIM/WITHDRAW buttons keep the previous account's numbers
   until the new account's reads answer (and for 30 s more when they fail). Meanwhile CLAIM is offered to an account with nothing
   to claim, and pressing it sends claim() from that account. The new account's reads are held (a slow reader). */
T('a4s2','account change: while the new account\'s seats are being read, the panel does not show the old account\'s seats and earnings, and CLAIM is not offered on them',
  {wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); const shown=await E.until(()=>E.page.evaluate(()=>document.getElementById('nx-mySeats').textContent==='2.0000'&&!document.getElementById('claim').disabled),6000);
  const before=await E.page.evaluate(()=>({seats:document.getElementById('nx-mySeats').textContent,note:document.getElementById('seatsNote').textContent.slice(0,90),claim:!document.getElementById('claim').disabled}));
  /* hold every seats read for the second account (the request goes out; its answer waits), and give that account nothing */
  await E.page.evaluate(A2=>{ const real=storm, G=window.__SH={held:0,q:[]};
    storm=new Proxy(real,{get(t,p){ const v=Reflect.get(t,p); if(typeof v!=='function'||!['seats','pending','owed'].includes(p)) return v;
      return (...a)=>{ const r=t[p](...a); if(String(a[0]).toLowerCase()!==A2) return r; G.held++; return new Promise(res=>G.q.push(()=>res(r))); }; }}); },A2);
  E.chain.values.seats=0n; E.chain.values.pending=0n;
  await E.P('A').set({accounts:[A2,A1]}); await E.P('A').emit('accountsChanged',[A2]);
  const held=await E.until(()=>E.page.evaluate(()=>__SH.held>=3),5000); const lab=await E.label();
  const during=await E.page.evaluate(()=>({seats:document.getElementById('nx-mySeats').textContent,mineShown:!document.getElementById('nx-mine').hidden,note:document.getElementById('seatsNote').textContent.slice(0,90),claim:!document.getElementById('claim').disabled}));
  const claimPressed=await click(E,'claim'); await sleep(1500);
  const asked=(await reqs(E,'A','eth_sendTransaction')).map(x=>({from:x.params[0].from,data:x.params[0].data.slice(0,10)}));
  await E.page.evaluate(()=>{ __SH.q.forEach(f=>f()); }); await sleep(800);
  const after=await E.page.evaluate(()=>({seats:document.getElementById('nx-mySeats').textContent,claim:!document.getElementById('claim').disabled}));
  const oldShown=(during.mineShown&&during.seats==='2.0000')||/0\.0364/.test(during.note);
  return {pass:shown&&held&&/00bb/i.test(lab)&&!oldShown&&!during.claim&&asked.length===0&&after.seats==='0.0000'&&!after.claim,
    ev:{before,label:lab,heldReads:held,during,claimPressedDuringHold:claimPressed,walletAsked:asked,after}}; });

/* ═══ a4s3 (DEFECT S2): the last-resort reader is the visitor's wallet. When every public reader fails and the browser's wallet does
   not answer eth_chainId (asleep, wedged: the picker already leaves such wallets off after 1.5 s), walletReads() waits forever: the
   first tick never ends, so the page never says it cannot reach Ethereum and its 30 s retry is never installed. Control: the same
   page with no wallet says "CANNOT REACH ETHEREUM" at once. */
T('a4s3','all public readers down and a wallet that never answers eth_chainId: the page still says CANNOT REACH ETHEREUM and keeps retrying (as it does with no wallet)',
  {wallets:[one('D','0x1',{never:{eth_chainId:true}})],ethereum:'D'},async E=>{
  const run=async X=>{ X.chain.hostMode=()=>'500'; await X.page.reload(); const t0=Date.now();
    const said=await X.until(()=>X.page.evaluate(()=>/CANNOT REACH ETHEREUM/.test(document.getElementById('panel').textContent)),10000);
    return {said,ms:Date.now()-t0,chip:await X.page.evaluate(()=>document.getElementById('state').textContent)}; };
  const dead=await run(E);
  const C=await H.boot({wallets:[]}); let ctl; try{ ctl=await run(C); } finally{ await C.close().catch(()=>{}); }
  const asked=await E.page.evaluate(()=>__MW.log.filter(x=>x.method==='eth_chainId').length);
  /* the readers come back: a page that retries (every 30 s) shows the day again */
  E.chain.hostMode=()=>null; const back=await E.until(()=>E.page.evaluate(()=>/DAY 13/.test(document.getElementById('panel').textContent)),36000);
  return {pass:ctl.said&&dead.said&&back,ev:{deadWallet:dead,noWallet:ctl,walletChainIdAsks:asked,recoveredWithin36sOfReadersBack:back}}; });

/* ═══ a4s4 (DEFECT S3): the wallet changes account (or drops this site) without an accountsChanged event. The last look stops the
   write (v2), but the page never follows what it saw: the header keeps the old address, and every later deliberate press stops the
   same way ("Your wallet changed while this was waiting"), forever. Expected: after the stop the page shows the account the wallet
   really has (a later press pays from it, never from the old one), or, with no account left, shows itself disconnected. */
T('a4s4','account changed (or permission dropped) without an event: the stopped write leaves the page on the wallet\'s real account (or disconnected), and a later deliberate press is not stopped again for the same reason',
  {wallets:[one('A')],ethereum:'A'},async E=>{
  const fillPress=async X=>{ await closeWit(X.page); await openWit(X.page); await X.page.fill('#wAmt','0.01'); await X.page.click('#bWit'); };
  await connect(E); await E.P('A').set({accounts:[A2,A1]});   /* no event */
  let n=(await E.toasts()).length; await fillPress(E); await E.until(async()=>(await E.toasts()).slice(n).some(x=>/changed/i.test(x)),6000); await sleep(600);
  const t1=(await E.toasts()).slice(n), lab1=await E.label();
  n=(await E.toasts()).length; await fillPress(E); await E.until(async()=>(await E.sends()).length>0||(await E.toasts()).slice(n).some(x=>/changed/i.test(x)),6000); await sleep(600);
  const t2=(await E.toasts()).slice(n), lab2=await E.label(), asked=(await reqs(E,'A','eth_sendTransaction')).map(x=>String(x.params[0].from).toLowerCase());
  const followed=/00bb/i.test(lab1)&&asked.length===1&&asked[0]===A2, dropped=/CONNECT/.test(lab1)&&asked.length===0;
  /* the same with the site's permission gone (eth_accounts answers []) and no event */
  const X=await H.boot({wallets:[one('A')],ethereum:'A'}); let r2={};
  try{ await connect(X); await X.P('A').set({authorized:false}); const m=(await X.toasts()).length; await fillPress(X);
    await X.until(async()=>(await X.toasts()).slice(m).some(x=>/changed|Nothing was sent/i.test(x)),6000); await sleep(600);
    r2={label:await X.label(),toasts:(await X.toasts()).slice(m),asked:(await reqs(X,'A','eth_sendTransaction')).length}; } finally{ await X.close().catch(()=>{}); }
  return {pass:!asked.includes(A1)&&(followed||dropped)&&!/0x/.test(r2.label)&&r2.asked===0,
    ev:{firstPress:{toasts:t1,label:lab1},secondPress:{toasts:t2,label:lab2},askedFrom:asked,permissionGone:r2}}; });

/* ═══ a4s5 (DEFECT S4): phone, WalletConnect slow to give its pairing link (> 20 s). The sheet turns into "WALLETCONNECT DID NOT
   ANSWER" (OPEN IN METAMASK, COPY THE LINK); when the link then arrives, the page writes "Tap the app that holds your wallet." into
   that sheet, which has no app to tap: the app buttons were left behind in the old sheet. Expected: the sheet stays coherent (either
   the DID NOT ANSWER text, or the app buttons back and live with the "Tap the app" text). */
const IPHONE={ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',viewport:{width:390,height:844},mobile:true};
T('a4s5','phone, WalletConnect link arrives after the 20 s "DID NOT ANSWER" sheet: the sheet never says "Tap the app" without app buttons to tap',{wallets:[],wc:{accounts:[A1,A2],chainId:'0x1'}},async E=>{
  const page=E.page;
  await page.evaluate(()=>{ const w=__MW.wc.provider, orig=w.enable.bind(w); w.enable=async()=>{ await new Promise(r=>setTimeout(r,21500)); return orig(); }; });
  await page.click('#wallet'); const s1=await E.until(()=>H.sheetOpen(page),4000);
  const dead=await E.until(async()=>/DID NOT ANSWER/.test(await H.sheetTitle(page)),23000);
  const uri=await E.until(()=>page.evaluate(()=>!!__MW.wc.approve),5000); await sleep(300);
  const v=await page.evaluate(()=>({title:document.getElementById('wsk').textContent,text:document.getElementById('wsp').textContent,buttons:[...document.querySelectorAll('#wsBtns button')].map(b=>({t:b.textContent,on:!b.disabled}))}));
  const apps=v.buttons.filter(b=>/^(METAMASK|RAINBOW|ZERION)$/.test(b.t)&&b.on).length;
  const coherent=(/DID NOT ANSWER/.test(v.title)&&/blocking it/.test(v.text))||(apps===3&&/Tap the app/.test(v.text));
  return {pass:s1&&dead&&uri&&coherent,ev:{sheetFirst:s1,deadSheet:dead,linkArrived:uri,after:v,liveAppButtons:apps}}; },IPHONE);

/* ═══ a4s6 (DEFECT S5): the WalletConnect app remembered from an earlier pairing (SG_WC_APP = ZERION) is kept when the visitor pairs
   another wallet through OTHER WALLET or COPY CONNECTION LINK (only an app button rewrites it). Every confirmation sheet then says
   "CONFIRM IN ZERION" and its OPEN ZERION button jumps to Zerion with this session's request id and topic, for a session that lives in
   another wallet. Expected: a pairing not made through an app button does not name or open the old app. */
T('a4s6','phone, WalletConnect paired through COPY CONNECTION LINK while an older app choice (ZERION) is stored: the confirmation sheet neither names nor opens ZERION',{wallets:[],wc:{accounts:[A1,A2],chainId:'0x1'}},async E=>{
  const page=E.page;
  await page.evaluate(()=>localStorage.setItem('SG_WC_APP',JSON.stringify({name:'ZERION',href:'https://link.zerion.io'})));
  await page.click('#wallet'); await E.until(()=>H.sheetOpen(page),4000); const ready=await E.until(()=>page.evaluate(()=>!!__MW.wc.approve),6000);
  await H.clickSheet(page,/COPY CONNECTION LINK/); await sleep(300); await page.evaluate(()=>__MW.wc.approve());
  const con=await E.until(async()=>/0x/.test(await E.label()),6000);
  await page.evaluate(()=>__MW.P.WC.set({gate:{eth_sendTransaction:true}}));
  await openWit(page); await page.fill('#wAmt','0.01'); await page.click('#bWit');
  const g=await E.until(()=>page.evaluate(()=>__MW.P.WC.waiting('eth_sendTransaction')>0),8000); await sleep(300);
  const v=await page.evaluate(()=>({title:document.getElementById('wsk').textContent,buttons:[...document.querySelectorAll('#wsBtns button')].map(b=>b.textContent),stored:localStorage.getItem('SG_WC_APP')}));
  await page.evaluate(()=>{ __MW.P.WC.set({gate:{}}); __MW.P.WC.release('eth_sendTransaction'); }); await E.until(async()=>(await E.sends()).length>0,6000);
  return {pass:ready&&con&&g&&!/ZERION/.test(v.title)&&!v.buttons.some(b=>/ZERION/.test(b)),ev:{paired:con,gateHit:g,sheet:v}}; },IPHONE);

/* ═══ a4s7 (DEFECT S6, feedback): COLLECT is waiting before the hand-off (the wallet is slow to estimate) and the visitor presses
   DISCONNECT. The write is stopped at once (its lock is freed, nothing will be sent), but the dialog keeps saying "confirm in your
   wallet" for as long as the wallet stays silent: it describes an operation that no longer exists. Expected: once DISCONNECT has
   stopped it, the dialog no longer asks the visitor to confirm in the wallet. */
T('a4s7','COLLECT stopped by DISCONNECT before the hand-off: the dialog stops saying "confirm in your wallet"; nothing is sent when the wallet answers late',{wallets:[one('A',undefined,{gate:{}})],ethereum:'A'},async E=>{
  await connect(E); await E.P('A').set({gate:{eth_estimateGas:true}}); await openOpt(E,3); await E.page.evaluate(()=>document.getElementById('ccBuy').click());
  const g=await E.waitGate('A','eth_estimateGas',6000); const p0=await popText(E.page);
  await E.page.evaluate(()=>disconnect(true)); await sleep(1000);
  const p1=await popText(E.page), lock=await E.page.evaluate(()=>OPLOCK===null), lab=await E.label();
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_estimateGas');
  /* barrier (audit 5): the late estimateGas answer has reached the page, the lock is free; then a settle window */
  const answered=await E.until(async()=>(await E.P('A').answered('eth_estimateGas'))>=1&&await E.page.evaluate(()=>OPLOCK===null),8000); await sleep(1500);
  const asked=(await reqs(E,'A','eth_sendTransaction')).length, p2=await popText(E.page);
  return {pass:g&&answered&&/confirm in your wallet/i.test(p0)&&lock&&/CONNECT/.test(lab)&&!/confirm in your wallet/i.test(p1)&&asked===0,ev:{gateHit:g,before:p0.slice(0,90),afterDisconnect:p1.slice(0,90),lockFreed:lock,label:lab,afterLateAnswer:p2.slice(0,120),sendRequests:asked}}; });
