/* THE AUDIT-5B FIX CASES (audit/wallet-5b-fix): the pre-fix review's hypotheses H1, H2 and H4, each investigated in the page and classified
   (report: FIX_REPORT.md). Loaded by wallet.test.js (every audit5*.test.js is group @audit5). Same mocks, same fake chain: nothing real is
   touched (no wallet, no RPC, no relay). These cases record behaviour that was found NOT to be a defect; each asserts its trigger.
   a5f1 H2: a WalletConnect pairing cancelled with CLOSE and later approved in the wallet: the page stays disconnected by itself; the next
        CONNECT (the visitor's own act) adopts that approved session without a new pairing. Acceptable (documented): consent was given in the
        wallet and CONNECT is pressed again; nothing is sent or signed.
   a5f2 H1: the wallet as the last-resort reader, then the wallet moves to another network: the reads made through it after the move are
        refused by ethers' own per-call network check (the page's BrowserProvider is built with the mainnet network and no staticNetwork),
        so no number from the other chain is shown, even when the wallet answers eth_call there. Not a defect.
   a5f3 H4: a confirmed WITHDRAW TO ANOTHER ADDRESS that leaves nothing owed: the box (and its "Confirmed…" note) closes with the owed read,
        the confirmation stays in the toast and OWED reads 0; nothing says the amount is still owed or that it failed. Acceptable. */
const H=require('./wallet.test.js');
const {T,connect,sheetOpen,sheetTitle,closeWit,A1,A2}=H;
const {ethers}=require('ethers');
const one=(...a)=>H.one(...a);
const IPHONE={ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',viewport:{width:390,height:844},mobile:true};
const R1L='0x52908400098527886e0f7030069857d2e4169ee7', R1=ethers.getAddress(R1L);
const WRITES=['eth_sendTransaction','personal_sign','eth_signTypedData_v4','wallet_switchEthereumChain'];
const reqs=(E,id,m)=>E.page.evaluate(([id,m])=>__MW.log.filter(x=>x.pid===id&&x.method===m).length,[id,m]);
const wcState=E=>E.page.evaluate(()=>({enables:__MW.wc.enables,uris:__MW.wc.uris,session:!!__MW.wc.provider.session,approveReady:!!__MW.wc.approve}));

T('a5f1','H2: a WalletConnect pairing cancelled with CLOSE, then approved in the wallet: the page stays disconnected by itself; the next CONNECT adopts the approved session (no new pairing link), nothing is sent or signed',
  {wallets:[],wc:{accounts:[A1,A2],chainId:'0x1'}},async E=>{
  const page=E.page; await page.click('#wallet'); const sh=await E.until(()=>sheetOpen(page),4000); const title=await sheetTitle(page);
  const ready=await E.until(async()=>(await wcState(E)).approveReady,6000);
  await page.evaluate(()=>document.getElementById('wsX').click()); const closed=await E.until(async()=>!(await sheetOpen(page)),3000); const lab0=await E.label();
  await page.evaluate(()=>__MW.wc.approve()); const approved=await E.until(async()=>(await wcState(E)).session,3000); const w0=await wcState(E);
  const selfConnected=await E.until(async()=>/0x/.test(await E.label()),1500);   /* absence window, after the approval is proven */
  await page.click('#wallet'); const adopted=await E.until(async()=>/0x/.test(await E.label()),6000); const w1=await wcState(E), lab=await E.label();
  const writes=await page.evaluate(ms=>__MW.log.filter(x=>ms.includes(x.method)).map(x=>x.pid+':'+x.method),WRITES);
  return {pass:sh&&/CONNECT YOUR WALLET/.test(title)&&ready&&closed&&!/0x/.test(lab0)&&approved&&!selfConnected&&adopted&&w0.uris===1&&w1.uris===1&&w1.enables===1&&writes.length===0&&E.errors.length===0,
    ev:{sheet:title,cancelled:closed,approvedLate:approved,selfConnected,adoptedOnNextConnect:adopted,label:lab,wcAfterApproval:w0,wcAfterConnect:w1,writes}}; },IPHONE);

T('a5f2','H1: every public reader down, the wallet is the reader (mainnet); the wallet then moves to Base and answers eth_call there with other numbers: the page\'s reads through it are refused (network changed), OWED never shows the other chain\'s value',
  {wallets:[one('A')],ethereum:'A'},async E=>{
  const page=E.page, c=E.chain; c.hostMode=(h,body)=>/"id":"wallet-/.test(body||'')?null:'500';   /* after the page booted: the readers go down */
  /* the wallet answers eth_call from the fake chain (a request marked "wallet-…" passes the readers' outage); every public reader answers 500 */
  await page.evaluate(()=>{ const P=__MW.P.A.provider, orig=P.request.bind(P); let n=0;
    P.request=a=>{ if(a&&a.method==='eth_call'){ __MW.log.push({pid:'A',method:'eth_call',params:null,chain:__MW.P.A.st.chainId,t:performance.now()});
        return fetch('https://ethereum-rpc.publicnode.com/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'wallet-'+(++n),method:'eth_call',params:a.params})}).then(r=>r.json()).then(j=>{ if(j.error) throw new Error(j.error.message); return j.result; }); }
      return orig(a); }; });
  await connect(E);
  await page.evaluate(async()=>{ rpcAt=READ_RPCS.indexOf('wallet'); await bindRead(); });
  const bound=await page.evaluate(()=>ro instanceof ethers.BrowserProvider);
  const r0=await page.evaluate(async()=>{ try{ await refreshSeats(); return 'ok'; }catch(e){ return 'threw: '+(e&&e.message); } });
  const owed0=await page.evaluate(()=>document.getElementById('nx-myOwed').textContent);
  /* the wallet moves to Base; there the same call answers 0.09 */
  const n0=await page.evaluate(()=>__MW.log.length);
  c.values.owed=ethers.parseEther('0.09'); await E.P('A').set({chainId:'0x2105'}); await E.P('A').emit('chainChanged','0x2105');
  const r1=await page.evaluate(async()=>{ try{ await refreshSeats(); return 'ok'; }catch(e){ return 'threw: '+(e&&e.message); } });
  const after=await page.evaluate(n0=>__MW.log.slice(n0).filter(x=>x.pid==='A').map(x=>x.method+'@'+x.chain),n0);
  const owed1=await page.evaluate(()=>document.getElementById('nx-myOwed').textContent);
  const askedThere=after.includes('eth_chainId@0x2105');
  return {pass:bound&&r0==='ok'&&/^0\.05/.test(owed0)&&askedThere&&/network changed/i.test(r1)&&!/0\.09/.test(owed1),
    ev:{walletIsReader:bound,before:{refresh:r0,owed:owed0},afterMove:{refresh:r1,owed:owed1,walletRequests:after.slice(0,12)}}}; },
  {chain:c=>{ c.values.owed=ethers.parseEther('0.05'); }});

T('a5f3','H4: a confirmed withdrawal to another address that leaves nothing owed: the "Confirmed" note goes with the box (closed by the owed read), the toast keeps the confirmation, OWED reads 0, nothing says it is still owed or failed',
  {wallets:[one('A')],ethereum:'A'},async E=>{
  const page=E.page, c=E.chain; await connect(E); await page.evaluate(()=>refreshSeats());
  await closeWit(page); const btn=await E.until(()=>page.evaluate(()=>document.getElementById('withdrawTo').style.display!=='none'),8000);
  await page.evaluate(()=>{ window.__notes=[]; new MutationObserver(()=>window.__notes.push(document.getElementById('wtoNote').textContent)).observe(document.getElementById('wtoNote'),{childList:true,characterData:true,subtree:true});
    if(document.getElementById('wtoBox').hidden) document.getElementById('withdrawTo').click(); });
  await page.fill('#wtoAddr',R1L); c.holdReceipts=true; await page.evaluate(()=>document.getElementById('wtoReview').click());
  const review=await E.until(async()=>(await sheetTitle(page))==='WITHDRAW TO ANOTHER ADDRESS',5000); const n=(await E.toasts()).length;
  await H.clickSheet(page,/SEND TO THIS ADDRESS/); const sent=await E.until(async()=>(await E.sends()).length>0,8000);
  c.values.owed=0n; c.holdReceipts=false;
  const conf=await E.until(async()=>(await E.toasts()).slice(n).some(x=>/Withdrawing to another address: confirmed/.test(x)),15000);
  const closedBox=await E.until(()=>page.evaluate(()=>document.getElementById('wtoBox').hidden&&document.getElementById('withdrawTo').style.display==='none'&&/^0(\.0+)?\s/.test(document.getElementById('nx-myOwed').textContent)),8000);
  const st=await page.evaluate(()=>({note:document.getElementById('wtoNote').textContent,notes:window.__notes.slice(),owed:document.getElementById('nx-myOwed').textContent}));
  const t=(await E.toasts()).slice(n), all=t.concat(st.notes).join(' | ');
  return {pass:btn&&review&&sent&&conf&&closedBox&&st.note===''&&st.notes.some(x=>/^Confirmed: the contract paid everything/.test(x))&&!/stays in the contract|still owed|failed|reverted/i.test(all)&&(await E.sends()).length===1,
    ev:{confirmedToast:conf,boxClosed:closedBox,noteNow:st.note,notesShown:st.notes.filter(Boolean).map(x=>x.slice(0,70)),owed:st.owed,toasts:t}}; },
  {chain:c=>{ c.values.owed=ethers.parseEther('0.05'); }});

module.exports={};
