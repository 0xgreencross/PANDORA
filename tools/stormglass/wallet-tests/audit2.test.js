/* THE AUDIT-2 REGRESSION CASES (fix/wallet-audit-2). Loaded by wallet.test.js, which runs them after the original 37.
   Select them alone with CASES=@audit2, the original ones with CASES=@orig. Same mocks, same fake chain: nothing real is touched.
   q  one write at a time (duplicate submissions)          r  following a submitted transaction (silent wallet, readers, outcomes)
   k  revocation and reconnect (k3-k6), m4/m5 WalletConnect h  wallet identity (shared rdns, legacy names, saved choice)
   p  the COLLECT dialog and stale callbacks               v  the last look before eth_sendTransaction    c  IME composition */
const H=require('./wallet.test.js');
const {T,connect,sheetOpen,sheetButtons,sheetTitle,clickSheet,disconnectUI,openWit,popText,closeWit,sleep,DONE,A1,A2,ETH}=H;
const one=(...a)=>H.one(...a);
const ZERO='0x0000000000000000000000000000000000000000', BUYER='0x19A84bF7b5DA2C290CB0Ca42bf691dd6C2308359';
const E_=v=>BigInt(Math.round(v*1e6))*10n**12n;
const IPHONE={ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',viewport:{width:390,height:844},mobile:true};
const NOTSENT=/Nothing was sent/i;

/* small helpers */
const track=(E,o)=>E.page.evaluate(o=>{ if(typeof TRACK!=='undefined') Object.assign(TRACK,o); },o);   /* faster polling for the tests; the old page has no TRACK */
const reqs=(E,id,m)=>E.page.evaluate(([id,m])=>__MW.log.filter(x=>x.pid===id&&x.method===m).map(x=>x.params),[id,m]);
const toastsSince=async(E,n)=>(await E.toasts()).slice(n);
async function fillWit(E,amt){ await closeWit(E.page); await openWit(E.page); await E.page.fill('#wAmt',amt); }
const pressWit=E=>E.page.click('#bWit');
async function openOpt(E,k){ await closeWit(E.page); await E.page.evaluate(k=>{ if(!NX.pop) document.getElementById('bPick').click(); document.querySelectorAll('#candGrid .card')[k].click(); },k); await E.page.waitForSelector('#ccBuy'); }
const pressCollect=E=>E.page.evaluate(()=>document.getElementById('ccBuy').click());
const ccK=E=>E.page.evaluate(()=>typeof CC!=='undefined'&&CC?CC.k:null);
const popOn=E=>E.page.evaluate(()=>!!(typeof NX!=='undefined'&&NX.pop));
const decodeBuy=(E,data)=>E.page.evaluate(d=>{ try{ const t=new ethers.Interface(['function buy(uint256,uint8) payable']).parseTransaction({data:d}); return t?[String(t.args[0]),String(t.args[1])]:null; }catch(e){ return null; } },data);
const decodeWit=(E,data)=>E.page.evaluate(d=>{ try{ return String(new ethers.Interface(['function witness(uint256) payable']).parseTransaction({data:d}).args[0]); }catch(e){ return null; } },data);
/* the next day on the fake chain: day 13 sold, day 14 open since a minute ago */
function toDay14(c){ const open=Math.floor(Date.now()/1000)-60, close=open+86400, old=c.plate;
  c.values.today=14; c.values.lastId=13; c.values.onSale=[14n,E_(1.6),BigInt(close),true];
  c.plate=id=>id===14?[777777,open,close,0n,0n,ZERO,0,false]:id===13?[396693683,open-86400,open,E_(0.7),E_(0.05),BUYER,3,true]:old(id); }
const tickNow=E=>E.page.evaluate(()=>tick(true));
const ALLWALLET={eth_getTransactionByHash:true,eth_getTransactionReceipt:true,eth_blockNumber:true,eth_chainId:true,eth_accounts:true,eth_getBlockByNumber:true,eth_call:true,eth_getTransactionCount:true};

/* ═══ q: ONE WRITE AT A TIME ═══ */
T('q1','five fast WITNESS presses while the wallet asks: one eth_sendTransaction, one payment',{wallets:[one('A',undefined,{delay:{eth_sendTransaction:1500}})],ethereum:'A'},async E=>{
  await connect(E); await fillWit(E,'0.01');
  for(let i=0;i<5;i++){ await pressWit(E); await sleep(60); }
  await E.until(async()=>(await E.sends()).length>0,8000); await sleep(2500);
  const rq=(await reqs(E,'A','eth_sendTransaction')).length, s=await E.sends(), t=await E.toasts();
  return {pass:rq===1&&s.length===1&&s[0].params[0].value===ETH(0.01), ev:{eth_sendTransaction:rq,sends:s.length,toasts:t.slice(-3)}}; });
T('q2','WITNESS twice and COLLECT while one CONNECT is pending: one connection, one eth_sendTransaction',{wallets:[one('A',undefined,{gate:{eth_requestAccounts:true}})],ethereum:'A'},async E=>{
  await fillWit(E,'0.01'); await pressWit(E); const g=await E.waitGate('A','eth_requestAccounts',5000);
  await pressWit(E); await sleep(100); await closeWit(E.page);
  await E.page.evaluate(()=>{ document.getElementById('bPick').click(); document.querySelectorAll('#candGrid .card')[3].click(); }); await E.page.waitForSelector('#ccBuy'); await pressCollect(E); await sleep(200);
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_requestAccounts');
  await E.until(async()=>(await E.sends()).length>0,8000); await sleep(3000);
  const rq=(await reqs(E,'A','eth_sendTransaction')).length, ra=(await reqs(E,'A','eth_requestAccounts')).length, s=await E.sends();
  return {pass:g&&rq===1&&s.length===1&&ra===1, ev:{gateHit:g,eth_requestAccounts:ra,eth_sendTransaction:rq,sends:s.map(x=>x.params[0].value),toasts:(await E.toasts()).slice(-3)}}; });
T('q3','redraws and presses while the wallet confirmation is open: one request; after the answer a deliberate second payment goes out',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await fillWit(E,'0.01'); await E.P('A').set({gate:{eth_sendTransaction:true}}); await pressWit(E);
  const g=await E.waitGate('A','eth_sendTransaction',6000);
  await E.page.evaluate(async()=>{ REDRAW(); REDRAW(); await tick(true); REDRAW(); });
  await pressWit(E); await sleep(150); await pressWit(E); await sleep(600);
  const during=(await reqs(E,'A','eth_sendTransaction')).length, busy=(await E.toasts()).some(x=>/still waiting|finish or cancel/i.test(x));
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_sendTransaction');
  const conf=await E.until(async()=>(await E.toasts()).some(x=>DONE.test(x)),15000);
  await E.page.fill('#wAmt','0.02'); await pressWit(E); await E.until(async()=>(await E.sends()).length>1,8000); await sleep(500);
  const s=await E.sends();
  return {pass:g&&during===1&&busy&&conf&&s.length===2&&s[0].params[0].value===ETH(0.01)&&s[1].params[0].value===ETH(0.02), ev:{gateHit:g,requestsWhileOpen:during,busyToast:busy,confirmed:conf,sends:s.map(x=>x.params[0].value),toasts:(await E.toasts()).slice(-4)}}; });
T('q4','a refusal in the wallet (4001) says nothing was sent and frees the button: the next press asks again',{wallets:[one('A',undefined,{reject:{eth_sendTransaction:{code:4001,message:'User denied transaction signature.'}}})],ethereum:'A'},async E=>{
  await connect(E); await fillWit(E,'0.01'); await pressWit(E);
  const can=await E.until(async()=>(await E.toasts()).some(x=>/Cancelled in your wallet\. Nothing was sent\./.test(x)),6000);
  await E.P('A').set({reject:{}}); await pressWit(E); await E.until(async()=>(await E.sends()).length>0,6000);
  const rq=(await reqs(E,'A','eth_sendTransaction')).length, s=await E.sends();
  return {pass:can&&rq===2&&s.length===1, ev:{cancelToast:can,eth_sendTransaction:rq,sends:s.length}}; });
T('q5','uncertain outcome (wallet error -32603 after the hand-off): no retry, never "Nothing was sent", says to check the wallet',{wallets:[one('A',undefined,{reject:{eth_sendTransaction:{code:-32603,message:'Internal JSON-RPC error.'}}})],ethereum:'A'},async E=>{
  await connect(E); await fillWit(E,'0.01'); const t0=(await E.toasts()).length; await pressWit(E); await sleep(4000);
  const rq=(await reqs(E,'A','eth_sendTransaction')).length, t=await toastsSince(E,t0);
  return {pass:rq===1&&!t.some(x=>NOTSENT.test(x)||/Cancelled/.test(x))&&t.some(x=>/did not say whether|check your wallet/i.test(x)), ev:{eth_sendTransaction:rq,toasts:t}}; });
T('q6','uncertain outcome in COLLECT (-32603), and a malformed hash from the wallet: RESULT UNKNOWN, not NOT COLLECTED, no retry',{wallets:[one('A',undefined,{reject:{eth_sendTransaction:{code:-32603,message:'Internal JSON-RPC error.'}}})],ethereum:'A'},async E=>{
  await connect(E); await openOpt(E,3); await pressCollect(E); await sleep(3500);
  const p=await popText(E.page), rq=(await reqs(E,'A','eth_sendTransaction')).length;
  const X=await H.boot({wallets:[one('A',undefined,{malformed:{eth_sendTransaction:'0x1234'}})],ethereum:'A'}); let t2=[], rq2=0;
  try{ await connect(X); await fillWit(X,'0.01'); const n=(await X.toasts()).length; await pressWit(X); await sleep(3000); t2=await toastsSince(X,n); rq2=(await reqs(X,'A','eth_sendTransaction')).length; } finally{ await X.close().catch(()=>{}); }
  return {pass:rq===1&&!/NOT COLLECTED/.test(p)&&/UNKNOWN/i.test(p)&&rq2===1&&!t2.some(x=>NOTSENT.test(x))&&t2.some(x=>/did not say whether|check your wallet/i.test(x)), ev:{popup:p.slice(0,160),eth_sendTransaction:rq,malformed:{eth_sendTransaction:rq2,toasts:t2}}}; });

/* ═══ r: FOLLOWING A SUBMITTED TRANSACTION ═══ */
T('r1','the wallet goes silent the moment it hands back the hash: confirmed through the HTTP readers',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await fillWit(E,'0.01'); await E.P('A').set({gate:{eth_sendTransaction:true}}); await pressWit(E); const g=await E.waitGate('A','eth_sendTransaction',6000);
  await E.P('A').set({never:ALLWALLET,gate:{}}); await E.P('A').release('eth_sendTransaction');
  const conf=await E.until(async()=>(await E.toasts()).some(x=>DONE.test(x)),20000);
  return {pass:g&&conf, ev:{gateHit:g,confirmed:conf,toasts:(await E.toasts()).slice(-3)}}; });
const fallbackCase=mode=>async E=>{ await connect(E); await track(E,{timeout:1500,poll:500});
  E.chain.holdReceipts=true; await fillWit(E,'0.01'); await pressWit(E); const sent=await E.until(async()=>(await E.sends()).length>0,8000);
  E.chain.hostMode=h=>/publicnode/.test(h)?mode:null; await sleep(800); E.chain.holdReceipts=false;
  const conf=await E.until(async()=>(await E.toasts()).some(x=>DONE.test(x)),25000);
  const fb=Object.entries(E.chain.hits).filter(([k])=>/(mevblocker|drpc).*eth_getTransactionReceipt/.test(k)).reduce((a,[,v])=>a+v,0);
  return {pass:sent&&conf&&fb>0, ev:{sent,confirmed:conf,fallbackReceiptRequests:fb,toasts:(await E.toasts()).slice(-3)}}; };
T('r2','the first reader (CFG.rpc) starts failing with HTTP 500 after submission: tracking moves to the next reader and confirms',{wallets:[one('A')],ethereum:'A'},fallbackCase('500'));
T('r3','the first reader stops answering (hangs) after submission: bounded requests, the next reader confirms',{wallets:[one('A')],ethereum:'A'},fallbackCase('hang'));
T('r4','a reverted receipt: "failed on Ethereum (reverted)", never "Nothing was sent"; COLLECT shows NOT COLLECTED with the reason',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); E.chain.rc=h=>E.chain.mkRc(h,{status:'0x0'}); await fillWit(E,'0.01'); const n=(await E.toasts()).length; await pressWit(E);
  const rev=await E.until(async()=>(await toastsSince(E,n)).some(x=>/reverted/i.test(x)),15000); const t=await toastsSince(E,n);
  await closeWit(E.page); await openOpt(E,3); await pressCollect(E); const pv=await E.until(async()=>/NOT COLLECTED/.test(await popText(E.page)),15000); const p=await popText(E.page);
  return {pass:rev&&!t.some(x=>NOTSENT.test(x)||DONE.test(x))&&pv&&/reverted|failed on Ethereum/i.test(p)&&!NOTSENT.test(p), ev:{toasts:t,popup:p.slice(0,200)}}; });
/* a second transaction from the same sender with the same nonce is mined in a later block: speed-up, cancel, or something else */
const replaceCase=(kind)=>async E=>{ await connect(E); await track(E,{poll:400}); await E.P('A').set({txNonce:'0x7'});
  const c=E.chain; let mine=null; c.tx=h=>h===mine?null:c.mkTx(h,{nonce:'0x7',blockHash:null,blockNumber:null,transactionIndex:null}); c.rc=h=>null; c.nonceLatest=7;
  await fillWit(E,'0.01'); const n=(await E.toasts()).length; await pressWit(E); await E.until(async()=>(await E.sends()).length>0,8000);
  const s=(await E.sends())[0], q=s.params[0]; await sleep(1500);
  const H2='0x'+'ab'.repeat(32), B=c.blockNo();
  const rtx=kind==='repriced'?{to:q.to,input:q.data,value:q.value}:kind==='cancelled'?{to:q.from,input:'0x',value:'0x0'}:{to:'0x000000000000000000000000000000000000dEaD',input:'0xdeadbeef',value:'0x0'};
  const tx2=c.mkTx(H2,Object.assign({from:q.from,nonce:'0x7',blockNumber:'0x'+B.toString(16),gasPrice:'0x77359400',maxFeePerGas:'0x77359400'},rtx));
  mine=s.hash; c.blockTxs=n=>n===B?[tx2]:[]; c.rc=h=>h===H2?c.mkRc(H2,{from:q.from,to:rtx.to,blockNumber:'0x'+B.toString(16),status:'0x1'}):null; c.tx=h=>h===H2?tx2:null; c.nonceLatest=8;
  const want=kind==='repriced'?DONE:kind==='cancelled'?/cancel/i:/replaced/i;
  const got=await E.until(async()=>(await toastsSince(E,n)).some(x=>want.test(x)),20000); const t=await toastsSince(E,n);
  const wrong=t.some(x=>NOTSENT.test(x)||(kind!=='repriced'&&DONE.test(x)));
  return {pass:got&&!wrong, ev:{kind,got,toasts:t}}; };
T('r5','sped up in the wallet (same call, higher fee, same nonce): the replacement\'s receipt counts as confirmed',{wallets:[one('A')],ethereum:'A'},replaceCase('repriced'));
T('r6','cancelled in the wallet after sending (same nonce, 0 ETH to self): says cancelled, never confirmed',{wallets:[one('A')],ethereum:'A'},replaceCase('cancelled'));
T('r7','replaced by another transaction (same nonce, other call): says replaced, never confirmed',{wallets:[one('A')],ethereum:'A'},replaceCase('replaced'));
T('r8','dropped: never seen, never mined: "cannot confirm" with the hash, never "Nothing was sent"; a late receipt still confirms',{wallets:[one('A',undefined,{malformed:{eth_getTransactionByHash:null}})],ethereum:'A'},async E=>{
  await connect(E); await track(E,{poll:400,lost:4000}); const c=E.chain; c.tx=()=>null; c.rc=()=>null;
  await fillWit(E,'0.01'); const n=(await E.toasts()).length; await pressWit(E); await E.until(async()=>(await E.sends()).length>0,8000); const h=(await E.sends())[0].hash;
  const unk=await E.until(async()=>(await toastsSince(E,n)).some(x=>/cannot confirm/i.test(x)),15000); const t=await toastsSince(E,n);
  const withHash=t.some(x=>/cannot confirm/i.test(x)&&x.includes(h.slice(0,6))&&x.includes(h.slice(-4)));
  c.rc=x=>c.mkRc(x); const late=await E.until(async()=>(await toastsSince(E,n)).some(x=>DONE.test(x)),15000);
  return {pass:unk&&withHash&&late&&!(await toastsSince(E,n)).some(x=>NOTSENT.test(x)), ev:{unknownShown:unk,withHash,lateConfirm:late,toasts:await toastsSince(E,n)}}; });
T('r9','COLLECT: the hash stays on screen while pending, through an account change and a DISCONNECT; then collected',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); E.chain.holdReceipts=true; await openOpt(E,3); await pressCollect(E);
  const pend=await E.until(async()=>/PENDING/.test(await popText(E.page)),8000); const h=(await E.sends())[0].hash;
  const link1=await E.page.evaluate(()=>{ const a=document.querySelector('#ccActs .tx a'); return a?a.href:''; });
  await E.P('A').set({accounts:[A2,A1]}); await E.P('A').emit('accountsChanged',[A2]); await sleep(800);
  const link2=await E.page.evaluate(()=>{ const a=document.querySelector('#ccActs .tx a'); return a?a.href:''; });
  await E.page.evaluate(()=>disconnect(true)); await sleep(500); E.chain.holdReceipts=false;
  const done=await E.until(async()=>/IS YOURS/.test(await popText(E.page)),15000);
  return {pass:pend&&link1.endsWith(h)&&link2.endsWith(h)&&done, ev:{pending:pend,link1,link2,done,popup:(await popText(E.page)).slice(0,80)}}; });

/* ═══ k: REVOCATION AND RECONNECT ═══ */
T('k3','revoke answering after 5 s: CONNECT waits and says so (no eth_requestAccounts), then connects and the session survives',{wallets:[one('A',undefined,{gate:{}})],ethereum:'A'},async E=>{
  await connect(E); await E.P('A').set({gate:{wallet_revokePermissions:true}}); await disconnectUI(E); const g=await E.waitGate('A','wallet_revokePermissions',3000);
  const rq0=(await reqs(E,'A','eth_requestAccounts')).length; await E.page.click('#wallet'); await sleep(6500);
  const rqWhile=(await reqs(E,'A','eth_requestAccounts')).length-rq0, title=await sheetTitle(E.page), lab=await E.label();
  await E.P('A').set({gate:{}}); await E.P('A').release('wallet_revokePermissions');
  const conn=await E.until(async()=>/0x/.test(await E.label()),6000); await sleep(2500);
  const lab2=await E.label(), st=await E.state(), acc=await E.page.evaluate(()=>__MW.P.A.provider.request({method:'eth_accounts'}));
  return {pass:g&&rqWhile===0&&/DISCONNECTING/.test(title)&&!/0x/.test(lab)&&conn&&/0x/.test(lab2)&&st.W&&acc.length>0, ev:{gateHit:g,requestAccountsWhilePending:rqWhile,sheet:title,labelWhilePending:lab,labelAfter:lab2,walletAccounts:acc}}; });
T('k4','revoke unsupported (-32601): DISCONNECT then an immediate CONNECT connects at once',{wallets:[one('A',undefined,{revokeUnsupported:true})],ethereum:'A'},async E=>{
  await connect(E); await disconnectUI(E); const t0=Date.now(); await E.page.click('#wallet'); const ok=await E.until(async()=>/0x/.test(await E.label()),4000); const ms=Date.now()-t0; await sleep(1000);
  return {pass:ok&&/0x/.test(await E.label())&&ms<2500, ev:{connected:ok,ms,label:await E.label()}}; });
T('k5','revoke never answers: CONNECT never claims a connection; CANCEL leaves the page disconnected; CONNECT asks again',{wallets:[one('A',undefined,{gate:{}})],ethereum:'A'},async E=>{
  await connect(E); await E.P('A').set({gate:{wallet_revokePermissions:true}}); await disconnectUI(E); const g=await E.waitGate('A','wallet_revokePermissions',3000);
  const rq0=(await reqs(E,'A','eth_requestAccounts')).length; await E.page.click('#wallet'); await sleep(7000);
  const title=await sheetTitle(E.page), lab=await E.label(), rq=(await reqs(E,'A','eth_requestAccounts')).length-rq0;
  let cancelled=false; if(/DISCONNECTING/.test(title)){ await clickSheet(E.page,/CANCEL/); await sleep(400); cancelled=!(await sheetOpen(E.page)); }
  const lab2=await E.label(); await E.page.click('#wallet'); await sleep(2500); const again=await sheetTitle(E.page);
  return {pass:g&&rq===0&&/DISCONNECTING/.test(title)&&!/0x/.test(lab)&&cancelled&&/CONNECT/.test(lab2)&&/DISCONNECTING/.test(again)&&E.errors.length===0, ev:{gateHit:g,requestAccounts:rq,sheet:title,label:lab,cancelled,labelAfterCancel:lab2,again}}; });
T('k6','independent providers: A\'s pending revoke does not hold up B, and B\'s DISCONNECT does not erase A\'s pending revoke',{wallets:[one('A',undefined,{gate:{}}),one('B')]},async E=>{
  await connect(E,/WALLET A/); await E.P('A').set({gate:{wallet_revokePermissions:true}}); await disconnectUI(E); const g=await E.waitGate('A','wallet_revokePermissions',3000);
  const t0=Date.now(); await E.page.click('#wallet'); if(await E.until(()=>sheetOpen(E.page),3000)) await clickSheet(E.page,/WALLET B/); const bOk=await E.until(async()=>/00cc/.test(await E.label()),4000); const bMs=Date.now()-t0;
  await disconnectUI(E); await sleep(800);
  const rqA0=(await reqs(E,'A','eth_requestAccounts')).length; await E.page.click('#wallet'); if(await E.until(()=>sheetOpen(E.page),3000)) await clickSheet(E.page,/WALLET A/); await sleep(3000);
  const rqAwhile=(await reqs(E,'A','eth_requestAccounts')).length-rqA0, title=await sheetTitle(E.page);
  await E.P('A').set({gate:{}}); await E.P('A').release('wallet_revokePermissions'); const aOk=await E.until(async()=>/00AA/i.test(await E.label()),6000); await sleep(2000);
  const acc=await E.page.evaluate(()=>__MW.P.A.provider.request({method:'eth_accounts'}));
  return {pass:g&&bOk&&bMs<3500&&rqAwhile===0&&/DISCONNECTING/.test(title)&&aOk&&/00AA/i.test(await E.label())&&acc.length>0, ev:{gateHit:g,bConnected:bOk,bMs,requestAccountsAWhilePending:rqAwhile,sheet:title,aConnected:aOk,label:await E.label(),walletAAccounts:acc}}; });

/* ═══ m: WALLETCONNECT (a deterministic EthereumProvider mock; the real relay is never contacted) ═══ */
const WCFG={wallets:[],wc:{accounts:[A1,A2],chainId:'0x1'}};
const wcState=E=>E.page.evaluate(()=>({enables:__MW.wc.enables,uris:__MW.wc.uris,disconnects:__MW.wc.disconnects,session:!!__MW.wc.provider.session,approveReady:!!__MW.wc.approve,init:__MW.wc.init&&{chains:__MW.wc.init.chains,showQrModal:__MW.wc.init.showQrModal}}));
async function wcPair(E){ await E.page.click('#wallet'); const sh=await E.until(()=>sheetOpen(E.page),4000); const title=await sheetTitle(E.page);
  const ready=await E.until(async()=>(await wcState(E)).approveReady,6000); const woke=await E.page.evaluate(()=>[...document.querySelectorAll('#wsBtns button')].slice(0,3).every(b=>!b.disabled));
  await E.page.evaluate(()=>__MW.wc.approve()); const conn=await E.until(async()=>/0x/.test(await E.label()),6000); return {sheet:sh,title,ready,woke,conn}; }
T('m4','WalletConnect lifecycle (mock): pair, one witness transaction on chain 1, DISCONNECT ends the session, CONNECT pairs again',WCFG,async E=>{
  const p1=await wcPair(E); await fillWit(E,'0.01'); await pressWit(E); await E.until(async()=>(await E.sends()).length>0,8000);
  const conf=await E.until(async()=>(await E.toasts()).some(x=>DONE.test(x)),15000); const s=await E.sends();
  await disconnectUI(E); await sleep(1500); const afterDisc=await wcState(E), labD=await E.label(), revokes=(await reqs(E,'WC','wallet_revokePermissions')).length;
  await E.page.click('#wallet'); await sleep(2000); const again=await wcState(E), title2=await sheetTitle(E.page), lab2=await E.label();
  let p2={conn:false}; if(again.approveReady){ await E.page.evaluate(()=>__MW.wc.approve()); p2.conn=await E.until(async()=>/0x/.test(await E.label()),6000); }
  const ok=p1.conn&&p1.woke&&/CONNECT YOUR WALLET/.test(p1.title)&&s.length===1&&s[0].pid==='WC'&&s[0].params[0].chainId==='0x1'&&conf
    &&afterDisc.disconnects===1&&!afterDisc.session&&/CONNECT/.test(labD)&&revokes===0&&again.uris===2&&/CONNECT YOUR WALLET/.test(title2)&&!/0x/.test(lab2)&&p2.conn;
  return {pass:ok, ev:{pair1:p1,send:s.map(x=>x.pid+'@'+x.params[0].chainId),confirmed:conf,afterDisconnect:afterDisc,label:labD,revokeOverRelay:revokes,reconnect:{state:again,sheet:title2,label:lab2,paired:p2.conn}}}; },IPHONE);
T('m5','WalletConnect: the phone ends the session: the page disconnects, a submitted transaction is still followed',WCFG,async E=>{
  const p1=await wcPair(E); E.chain.holdReceipts=true; await fillWit(E,'0.01'); await pressWit(E); const sent=await E.until(async()=>(await E.sends()).length>0,8000); await sleep(500);
  await E.page.evaluate(()=>__MW.wc.phoneEnds()); await sleep(1000); const lab=await E.label(); E.chain.holdReceipts=false;
  const conf=await E.until(async()=>(await E.toasts()).some(x=>DONE.test(x)),15000);
  return {pass:p1.conn&&sent&&/CONNECT/.test(lab)&&conf, ev:{paired:p1.conn,sent,labelAfterPhoneEnds:lab,confirmed:conf}}; },IPHONE);

/* ═══ h: WALLET IDENTITY ═══ */
const MM={rdns:'io.metamask',name:'MetaMask'};
T('h6','two distinct providers announce the same rdns and the first is dead: the working one is used',{wallets:[one('D','0x1',Object.assign({never:{eth_chainId:true}},MM)),one('G','0x1',MM)]},async E=>{
  await E.page.click('#wallet'); await E.until(async()=>/0x/.test(await E.label())||await sheetOpen(E.page),5000);
  const btns=(await sheetOpen(E.page))?await sheetButtons(E.page):[]; if(btns.length) await clickSheet(E.page,/METAMASK/).catch(()=>{});
  await E.until(async()=>/0x/.test(await E.label()),4000);
  return {pass:/0x/.test(await E.label())&&(await E.P('G').count('eth_requestAccounts'))===1&&(await E.P('D').count('eth_requestAccounts'))===0, ev:{picker:btns,label:await E.label(),toasts:(await E.toasts()).slice(-2)}}; });
T('h7','two working providers share an rdns and a name: both listed, told apart; the saved rdns is ambiguous, so the list is shown again',{wallets:[one('P','0x1',MM),one('Q','0x1',MM)]},async E=>{
  await E.page.click('#wallet'); const open=await E.until(()=>sheetOpen(E.page),4000); const btns=await sheetButtons(E.page);
  if(btns.length===2) await E.page.evaluate(()=>document.querySelectorAll('#wsBtns button')[1].click());
  await E.until(async()=>/0x/.test(await E.label()),5000); const rqQ=await E.P('Q').count('eth_requestAccounts'), rqP=await E.P('P').count('eth_requestAccounts');
  await E.page.reload(); await E.page.waitForFunction(()=>typeof ST!=='undefined'&&ST&&ST.now,null,{timeout:30000});
  await E.page.click('#wallet'); await sleep(2200); const again=await sheetOpen(E.page)&&/CONNECT WITH/.test(await sheetTitle(E.page)); const btns2=await sheetButtons(E.page);
  const silent=/0x/.test(await E.label());
  return {pass:open&&btns.length===2&&new Set(btns).size===2&&rqQ===1&&rqP===0&&again&&!silent&&(await E.P('P').count('eth_requestAccounts'))===0, ev:{buttons:btns,requestAccounts:{P:rqP,Q:rqQ},afterReload:{picker:again,buttons:btns2,silentConnect:silent}}}; });
T('h8','one provider object announced twice with fresh info objects, and also window.ethereum and providers[]: one wallet, no list',{wallets:[one('A')],ethereum:'A',providers:['A'],announceTwice:'A'},async E=>{
  await E.page.click('#wallet'); await E.until(async()=>/0x/.test(await E.label())||await sheetOpen(E.page),5000);
  const picker=await sheetOpen(E.page);
  return {pass:!picker&&/0x/.test(await E.label())&&(await E.P('A').count('eth_requestAccounts'))===1, ev:{picker,label:await E.label()}}; });
T('h9','legacy name collision: providers[] holds two MetaMask-flagged wallets; choosing the second is honoured, and after a reload the first is never asked silently',
  {wallets:[one('L','0x1',{announce:false,flags:{isMetaMask:true}}),one('M','0x1',{announce:false,flags:{isMetaMask:true}})],ethereum:'L',providers:['L','M']},async E=>{
  await E.page.click('#wallet'); const open=await E.until(()=>sheetOpen(E.page),4000); const btns=await sheetButtons(E.page);
  if(btns.length===2) await E.page.evaluate(()=>document.querySelectorAll('#wsBtns button')[1].click());
  await E.until(async()=>/0x/.test(await E.label()),5000); const rqM=await E.P('M').count('eth_requestAccounts');
  await E.page.reload(); await E.page.waitForFunction(()=>typeof ST!=='undefined'&&ST&&ST.now,null,{timeout:30000});
  await E.page.click('#wallet'); await sleep(2200); const again=await sheetOpen(E.page); const rqL=await E.P('L').count('eth_requestAccounts');
  return {pass:open&&btns.length===2&&new Set(btns).size===2&&rqM===1&&again&&rqL===0, ev:{buttons:btns,requestAccountsM:rqM,afterReload:{picker:again,requestAccountsL:rqL,label:await E.label()}}}; });

/* ═══ p: THE COLLECT DIALOG: a callback only updates the dialog it belongs to ═══ */
T('p1','close and reopen on another option while the wallet confirms: the new dialog is not touched by the old buy',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await E.P('A').set({gate:{eth_sendTransaction:true}}); await openOpt(E,3); await pressCollect(E); const g=await E.waitGate('A','eth_sendTransaction',6000);
  await E.page.keyboard.press('Escape'); await sleep(300); const closed=!(await popOn(E)); await openOpt(E,5);
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_sendTransaction'); await E.until(async()=>(await E.toasts()).some(x=>DONE.test(x)),12000); await sleep(800);
  const p=await popText(E.page), k=await ccK(E), s=await E.sends(), arg=s[0]&&await decodeBuy(E,s[0].params[0].data);
  return {pass:g&&closed&&k===5&&!/PENDING|IS YOURS|NOT COLLECTED/.test(p)&&/COLLECT/.test(p)&&s.length===1&&arg&&arg[1]==='3', ev:{gateHit:g,closed,dialogOption:k,popup:p.slice(0,90),buy:arg}}; });
T('p2','BACK and NEXT to another option while the wallet confirms: the other option\'s dialog is not touched',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await E.P('A').set({gate:{eth_sendTransaction:true}}); await openOpt(E,3); await pressCollect(E); const g=await E.waitGate('A','eth_sendTransaction',6000);
  await E.page.evaluate(()=>document.getElementById('nx-txBack').click()); await E.page.evaluate(()=>document.getElementById('ccNext').click()); await sleep(300); const k0=await ccK(E);
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_sendTransaction'); await E.until(async()=>(await E.toasts()).some(x=>DONE.test(x)),12000); await sleep(800);
  const p=await popText(E.page);
  return {pass:g&&k0===4&&!/PENDING|IS YOURS/.test(p)&&/COLLECT/.test(p), ev:{gateHit:g,dialogOption:k0,popup:p.slice(0,90)}}; });
T('p3','account changes while the wallet is asked (before the hand-off): nothing sent, this dialog says so',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await E.P('A').set({gate:{eth_estimateGas:true}}); await openOpt(E,3); await pressCollect(E); const g=await E.waitGate('A','eth_estimateGas',6000);
  await E.P('A').set({accounts:[A2,A1]}); await E.P('A').emit('accountsChanged',[A2]); await sleep(500); await E.P('A').set({gate:{}}); await E.P('A').release('eth_estimateGas');
  const f=await E.until(async()=>/NOT COLLECTED/.test(await popText(E.page)),6000); const p=await popText(E.page), s=await E.sends();
  return {pass:g&&f&&/changed/i.test(p)&&s.length===0, ev:{gateHit:g,popup:p.slice(0,140),sends:s.length}}; });
T('p4','the day changes while CONNECT is pending: nothing is bought on the new day with the old day\'s option',{wallets:[one('A',undefined,{gate:{eth_requestAccounts:true}})],ethereum:'A'},async E=>{
  await openOpt(E,3); await pressCollect(E); const g=await E.waitGate('A','eth_requestAccounts',6000);
  toDay14(E.chain); await tickNow(E); await sleep(300); const day=await E.page.evaluate(()=>ST.day.id);
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_requestAccounts'); await E.until(async()=>/0x/.test(await E.label()),6000); await sleep(3000);
  const s=await E.sends(), args=[]; for(const x of s) args.push(await decodeBuy(E,x.params[0].data)); const p=await popText(E.page);
  return {pass:g&&day===14&&s.length===0&&/NO LONGER ON SALE/.test(p), ev:{gateHit:g,dayOnScreen:day,buys:args,popup:p.slice(0,80)}}; });
T('p5','the day changes while the wallet confirms: the day 13 buy is followed in its own dialog; the dialog no longer offers day 14\'s price as day 13',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await E.P('A').set({gate:{eth_sendTransaction:true}}); await openOpt(E,3); await pressCollect(E); const g=await E.waitGate('A','eth_sendTransaction',6000);
  toDay14(E.chain); await tickNow(E); await sleep(600); const hdr=await E.page.evaluate(()=>document.getElementById('nx-pfPrice').textContent);
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_sendTransaction');
  const done=await E.until(async()=>/IS YOURS|NOT COLLECTED/.test(await popText(E.page)),12000); const s=await E.sends(), arg=s[0]&&await decodeBuy(E,s[0].params[0].data);
  return {pass:g&&done&&arg&&arg[0]==='13'&&arg[1]==='3'&&/DAY 13 IS NO LONGER ON SALE/.test(hdr), ev:{gateHit:g,header:hdr,buy:arg,popup:(await popText(E.page)).slice(0,60)}}; });

/* ═══ v: THE LAST LOOK before eth_sendTransaction (no events: the wallet is asked directly) ═══ */
T('v1','the wallet moves to Base without a chainChanged event right before the send: nothing sent',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await fillWit(E,'0.01'); await E.P('A').set({gate:{eth_estimateGas:true}}); await pressWit(E); const g=await E.waitGate('A','eth_estimateGas',6000);
  await E.P('A').set({chainId:'0x2105',gate:{}}); await E.P('A').release('eth_estimateGas'); await sleep(3000);
  const s=await E.sends(), rq=(await reqs(E,'A','eth_sendTransaction')).length, t=await E.toasts();
  return {pass:g&&s.length===0&&rq===0&&t.some(x=>/another network/i.test(x)), ev:{gateHit:g,sends:s.length,requests:rq,toasts:t.slice(-2)}}; });
T('v2','the wallet\'s first account changes without an accountsChanged event right before the send: nothing sent',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await fillWit(E,'0.01'); await E.P('A').set({gate:{eth_estimateGas:true}}); await pressWit(E); const g=await E.waitGate('A','eth_estimateGas',6000);
  await E.P('A').set({accounts:[A2,A1],gate:{}}); await E.P('A').release('eth_estimateGas'); await sleep(3000);
  const s=await E.sends(), rq=(await reqs(E,'A','eth_sendTransaction')).length, t=await E.toasts();
  return {pass:g&&s.length===0&&rq===0&&t.some(x=>/changed/i.test(x)), ev:{gateHit:g,sends:s.length,requests:rq,toasts:t.slice(-2)}}; });
T('v3','the chain changes while the wallet confirmation is open: the request carries chainId 0x1 and the captured sender; a wallet that checks it refuses',{wallets:[one('A',undefined,{enforceChainId:true})],ethereum:'A'},async E=>{
  await connect(E); await fillWit(E,'0.01'); await E.P('A').set({gate:{eth_sendTransaction:true}}); await pressWit(E); const g=await E.waitGate('A','eth_sendTransaction',6000);
  await E.P('A').set({chainId:'0x2105',gate:{}}); await E.P('A').emit('chainChanged','0x2105'); await E.P('A').release('eth_sendTransaction'); await sleep(2500);
  const r=await reqs(E,'A','eth_sendTransaction'), s=await E.sends(), t=await E.toasts();
  return {pass:g&&r.length===1&&r[0][0].chainId==='0x1'&&String(r[0][0].from).toLowerCase()===A1&&s.length===0&&!t.some(x=>DONE.test(x)), ev:{gateHit:g,request:r[0]&&{chainId:r[0][0].chainId,from:r[0][0].from},sends:s.length,toasts:t.slice(-2)}}; });

/* ═══ c: IME COMPOSITION across redraws and day transitions ═══ */
T('c1','composition in the witness box spans redraws and a day 13 -> day 14 change: same node, same text; WITNESS then pays for the day on screen',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await fillWit(E,''); await E.page.click('#wAmt'); await E.page.keyboard.type('0.0');
  await E.page.evaluate(()=>{ const i=document.getElementById('wAmt'); window.__node=i; i.dispatchEvent(new CompositionEvent('compositionstart',{data:''})); REDRAW(); REDRAW(); });
  toDay14(E.chain); await tickNow(E); await sleep(400);
  const mid=await E.page.evaluate(()=>{ const i=document.getElementById('wAmt'); return {same:i===window.__node,v:i.value,focus:document.activeElement===i,sheet:document.getElementById('nx-wit').classList.contains('on'),day:ST.day.id}; });
  await E.page.evaluate(()=>document.getElementById('wAmt').dispatchEvent(new CompositionEvent('compositionend',{data:''}))); await E.page.keyboard.type('3');
  await pressWit(E); await E.until(async()=>(await E.sends()).length>0,8000); const s=await E.sends(); const day=s[0]&&await decodeWit(E,s[0].params[0].data);
  return {pass:mid.same&&mid.v==='0.0'&&mid.focus&&mid.sheet&&mid.day===14&&s.length===1&&s[0].params[0].value===ETH(0.03)&&day==='14', ev:{mid,sent:s.length&&s[0].params[0].value,witnessDay:day}}; });
T('c2','composition in the pledge box when founders\' day ends: the PLEDGE box and button go (no stale PLEDGE), no errors',{wallets:[one('A')],ethereum:'A'},async E=>{
  const page=E.page; await page.waitForSelector('#plAmt'); await page.click('#plAmt'); await page.keyboard.type('0.2');
  await page.evaluate(()=>document.getElementById('plAmt').dispatchEvent(new CompositionEvent('compositionstart',{data:''})));
  await sleep(6000);
  const after=await page.evaluate(()=>({pledgeBox:!!document.getElementById('plAmt'),pledgeBtn:!!document.getElementById('bPledge'),bar:document.getElementById('nx-barBtn').textContent,label:(document.querySelector('#panel .nx-lab')||{}).textContent}));
  return {pass:!after.pledgeBox&&!after.pledgeBtn&&!/PLEDGE/.test(after.bar)&&/DAY ONE/.test(after.label||'')&&E.errors.length===0, ev:{after,pageErrors:E.errors}}; },
  {chain:c=>{ c.values.today=0; c.values.lastId=0; c.values.foundersEnd=c.t0+4; c.values.onSale=[0n,0n,0n,false]; }});
