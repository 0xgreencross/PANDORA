/* THE AUDIT-5 SECOND REVIEW CASES (audit/wallet-5-review). Loaded by wallet.test.js (every audit5*.test.js is group @audit5). Same mocks,
   same fake chain: nothing real is touched (no wallet, no RPC, no relay).
   a5r  defects found by the second, independent review of the merged audit-5 candidate (6c18095), each with a fail-first regression.
   Every case asserts that its trigger was reached (the contradictory answer was actually served), so it cannot pass because the
   situation never happened. */
const H=require('./wallet.test.js');
const {T,sleep,A1}=H;
const {ethers}=require('ethers');
const one=(...a)=>H.one(...a);
const hex=n=>'0x'+n.toString(16);
const H32=s=>'0x'+String(s).padEnd(64,'0');
const CONTRACT='0xCf5EBA884EFA04940d31A663bEB6D37F907d064C';
const READERS=/(publicnode\.com|mevblocker\.io|drpc\.org|blastapi\.io)/;
const hostKey=u=>/publicnode/.test(u)?'pn':/mevblocker/.test(u)?'mev':/drpc/.test(u)?'drpc':'other';
const track=(E,o)=>E.page.evaluate(o=>{ Object.assign(TRACK,o); },o);
/* the request the followed payment sent (to, data, value), as audit5page's a5n cases use it */
const REQ={to:CONTRACT,data:'0xabcdef0100000000000000000000000000000000000000000000000000000000000000d',value:'0x2386f26fc10000'};
/* serve(E, fn): every reader request goes through fn(host, q) first; a value is that reader's answer, undefined falls through to the fake chain */
async function serve(E,fn){ await E.page.route(READERS,async route=>{ const r=route.request(), b=r.postData()||''; let q=null; try{ q=JSON.parse(b); }catch(e){}
    if(!q||Array.isArray(q)) return route.fallback();
    const v=fn(hostKey(r.url()),q); if(v===undefined) return route.fallback();
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:q.id,result:v})}); }); }
/* the page's own trackTx(op, hash, tell), driven directly (as a4r and a5n do); the wallet stub answers eth_getTransactionByHash with null */
async function startTrack(E,hash,block){ await E.page.evaluate(([hash,block,req])=>{ window.__R=window.__R||{}; trackAt=0;
    const P={request:()=>Promise.resolve(null)}, op={acct:'0x00000000000000000000000000000000000000aa',req,block,chain:1,P};
    const R=window.__R[hash]={state:'pending',tells:[]};
    trackTx(op,hash,s=>R.tells.push(s)).then(x=>{ R.state=x.state; R.by=x.by||null; },e=>{ R.state='threw '+e.message; }); },[hash,block,REQ]); }
const stateOf=(E,h)=>E.page.evaluate(h=>window.__R[h]&&{state:window.__R[h].state,by:window.__R[h].by},h);

/* ════════ a5r1: THE BLOCK'S OWN HASH ════════
   The payment Hx (nonce 7) is pending; nonce 7 is spent in block R by U, another call of the sender (a replacement once proven). The block a
   reader gives for R has its own hash; the transaction found in it and its receipt must name that same block. Each row serves, from every
   reader, one contradiction the 6c18095 page did not check (it compared the receipt's blockHash only with the transaction's blockHash,
   and only when the transaction carried one):
     rcVsBlock      the transaction carries no blockHash; its receipt names another block hash than the block's
     txVsBlock      the transaction and its receipt agree on a block hash that is not the hash of the block they were read from
     blockHashBad   the block's own hash is not 32 bytes of hex
     blockHashNone  the block has no hash at all
     txOnlyVsBlock  the transaction names another block hash; its receipt names the block's (each check stands on its own: mutation rows)
     noHashAnywhere the block has no hash and the transaction no blockHash (the receipt's blockHash then has nothing to match)
   While it lasts: no verdict (pending; the block is read again). Once the answers agree: replaced, by U.
   Guard rows (pass on both pages): the consistent block, its hash in upper case in the receipt, or the transaction without blockHash and
   the receipt naming the block's hash: replaced at once. */
const ROWS=[
  ['rcVsBlock',  X=>({tx:Object.assign({},X.U,{blockHash:undefined}),rc:Object.assign({},X.rc,{blockHash:H32('99')})})],
  ['txVsBlock',  X=>({tx:Object.assign({},X.U,{blockHash:H32('98')}),rc:Object.assign({},X.rc,{blockHash:H32('98')})})],
  ['blockHashBad',X=>({blk:{hash:'0x1234'}})],
  ['blockHashNone',X=>({blk:{hash:undefined}})],
  ['txOnlyVsBlock',X=>({tx:Object.assign({},X.U,{blockHash:H32('98')})})],
  ['noHashAnywhere',X=>({tx:Object.assign({},X.U,{blockHash:undefined}),blk:{hash:undefined}})]];
const GUARDS=[
  ['consistent', X=>({})],
  ['upperInRc',  X=>({rc:Object.assign({},X.rc,{blockHash:'0x'+X.bh.slice(2).toUpperCase()})})],
  ['txNoBlockHash',X=>({tx:Object.assign({},X.U,{blockHash:undefined})})]];
async function row(spoil,guard){ const E=await H.boot({wallets:[one('A')],ethereum:'A'});
  try{ const c=E.chain, B=c.blockNo(), R=B+2, Hx=H32('a5'), Hu=H32('b7'), bh=c.blockHash(R);
    await track(E,{poll:250,timeout:4000,lost:600000,stop:3600000,scan:6}); c.topAns=()=>hex(B+6); c.nonceLatest=8;
    /* U: the sender's other call, nonce 7, mined in block R; its default blockHash is the fake chain's hash of block R */
    const U=c.mkTx(Hu,{from:A1,nonce:'0x7',blockNumber:hex(R),to:'0x000000000000000000000000000000000000dEaD',input:'0xdeadbeef',value:'0x0'});
    const rc=c.mkRc(Hu,{from:A1,to:U.to,blockNumber:hex(R),status:'0x1'});
    c.tx=h=>h===Hx?c.mkTx(Hx,{from:A1,nonce:'0x7',blockHash:null,blockNumber:null,transactionIndex:null,to:REQ.to,input:REQ.data,value:REQ.value}):h===Hu?U:null;
    c.blockTxs=b=>b===R?[U]:[]; c.rc=h=>h===Hu?rc:null;
    const bad=spoil({U,rc,R,bh,c}); let fixed=false; const hit={blk:0,rc:0}, seen=[];
    const strip=o=>JSON.parse(JSON.stringify(o));   /* a field set to undefined is left out of the answer, as a reader that does not send it */
    await serve(E,(h,q)=>{ seen.push({m:q.method,p0:q.params&&q.params[0]}); if(fixed) return undefined;
      if(q.method==='eth_getBlockByNumber'&&q.params&&q.params[1]===true&&Number(q.params[0])===R&&(bad.tx||bad.blk)){ hit.blk++;
        const b=Object.assign({number:hex(R),hash:bh,parentHash:c.blockHash(R-1),timestamp:hex(Math.floor(Date.now()/1000)),transactions:[bad.tx||U]},bad.blk||{}); return strip(b); }
      if(q.method==='eth_getTransactionReceipt'&&q.params[0]===Hu&&bad.rc){ hit.rc++; return strip(bad.rc); }
      return undefined; });
    await startTrack(E,Hx,B);
    let mid;
    if(guard){ await E.until(async()=>(await stateOf(E,Hx)).state!=='pending',30000); mid=await stateOf(E,Hx); return {mid:mid.state,by:mid.by===Hu,hit,final:mid.state}; }
    /* gate (audit 5b fix; was sleep(2200)): the contradictory answer was served, then the tracker asked Hx's own receipt again (a later round:
       the round that saw the contradiction is over), or it decided; both bounded 30 s */
    const trig=await E.until(()=>hit.blk+hit.rc>0,30000); const k=seen.length;
    const next=trig&&await E.until(async()=>(await stateOf(E,Hx)).state!=='pending'||seen.slice(k).some(x=>x.m==='eth_getTransactionReceipt'&&x.p0===Hx),30000);
    mid=await stateOf(E,Hx);
    fixed=true; await E.until(async()=>(await stateOf(E,Hx)).state!=='pending',30000); const fin=await stateOf(E,Hx);
    return {gate:{trig,next},mid:mid.state,hit,final:fin.state,by:fin.by===Hu}; }
  finally{ await E.close().catch(()=>{}); } }

T('a5r1','a replacement whose receipt or transaction names another block than the block it was read from (or a block with no valid hash) is no proof: pending while it lasts, replaced once consistent; consistent answers (any case, no tx blockHash) replaced at once',{wallets:[one('A')],ethereum:'A'},async E=>{
  const rows=[], guards=[];
  for(const [name,mk] of ROWS) rows.push(Object.assign({name},await row(mk,false)));
  for(const [name,mk] of GUARDS) guards.push(Object.assign({name},await row(mk,true)));
  const reached=r=>r.hit.blk+r.hit.rc>0;
  return {pass:rows.every(r=>reached(r)&&r.gate.next&&r.mid==='pending'&&r.final==='replaced'&&r.by)&&guards.every(g=>g.final==='replaced'&&g.by)&&reached(guards[1])&&reached(guards[2]),
    ev:{rows,guards}}; });

/* ════════ a5r2: SWITCH TO ETHEREUM ASKS ONLY THE CONNECTED WALLET ════════
   switchChain() took EP||anyWallet(): with no session it asked whatever wallet the browser lists first (window.ethereum), a wallet the
   visitor never chose. Reached here: on a computer with two wallets, Wallet A (chosen on the list, announced by EIP-6963, on Base, it
   refuses the switch) and Wallet B (window.ethereum, already authorised, on mainnet). COLLECT shows the wrong-network view with SWITCH TO
   ETHEREUM; the visitor presses DISCONNECT, then that SWITCH button. Neither wallet may be asked anything (no switch, no account request,
   no transaction): the page is disconnected. The trigger is asserted: the wrong view was shown, the session was gone and the button was
   still there and pressed. Guard: while connected, SWITCH asks the connected wallet A (and only A). */
const pressCollect=E=>E.page.evaluate(()=>document.getElementById('ccBuy').click());
const popText=E=>E.page.evaluate(()=>{ const a=document.getElementById('ccActs'); return a?a.textContent:''; });
const cnt=(E,id,m)=>E.page.evaluate(([id,m])=>__MW.log.filter(x=>x.pid===id&&(!m||x.method===m)).length,[id,m]);
async function openOpt(E,k){ await H.closeWit(E.page); await E.page.evaluate(k=>{ if(!NX.pop) document.getElementById('bPick').click(); document.querySelectorAll('#candGrid .card')[k].click(); },k); await E.page.waitForSelector('#ccBuy'); }
T('a5r2','SWITCH TO ETHEREUM after DISCONNECT asks no wallet (never window.ethereum, a wallet the visitor did not choose); while connected it asks only the connected wallet',
  {wallets:[one('A','0x2105',{switchReject:{code:4001}}),one('B','0x1',{authorized:true})],ethereum:'B'},async E=>{
  await H.connect(E,/WALLET A/); const who=await E.label();
  await openOpt(E,3); await pressCollect(E); const wrong=await E.until(async()=>/ANOTHER NETWORK/.test(await popText(E))&&await E.page.evaluate(()=>OPLOCK===null),8000);
  /* guard: connected, the button asks A */
  const a0=await cnt(E,'A','wallet_switchEthereumChain'), b0=await cnt(E,'B');
  await E.page.evaluate(()=>document.getElementById('nx-switch').click());
  const askedA=await E.until(async()=>(await cnt(E,'A','wallet_switchEthereumChain'))===a0+1&&!(await E.page.evaluate(()=>document.getElementById('nx-switch').disabled)),6000);
  const bWhileConnected=(await cnt(E,'B'))-b0;
  /* disconnect, then the same button */
  await E.page.evaluate(()=>{ window.__a5r2sw=document.getElementById('nx-switch'); });   /* held from before DISCONNECT: since a5p1 the stale wrong-network view (and its button) goes with the wallet; the press below is one arriving as the session ends */
  await E.page.evaluate(()=>disconnect(true));   /* DISCONNECT's own call (as a4s7): the dialog covers the header button */
  const off=await E.until(async()=>/CONNECT/.test(await E.label())&&await E.page.evaluate(()=>!me&&!EP),5000);
  const a1=await cnt(E,'A'), b1=await cnt(E,'B');
  const still=await E.page.evaluate(()=>{ const b=window.__a5r2sw; return !!b&&!b.disabled; });
  if(still) await E.page.evaluate(()=>window.__a5r2sw.click());
  await E.until(async()=>(await cnt(E,'B','wallet_switchEthereumChain'))>0,2500); await sleep(800);
  /* what each wallet was ASKED to do (a prompt, an account, a transaction, a switch); silent reads (eth_chainId, eth_call) are not counted,
     nor A's own revocation (DISCONNECT) */
  const ACT=/^(wallet_switchEthereumChain|wallet_addEthereumChain|wallet_requestPermissions|eth_requestAccounts|eth_sendTransaction|eth_sign|personal_sign|eth_signTypedData.*)$/;
  const after={A:await E.page.evaluate(a1=>__MW.log.filter(x=>x.pid==='A').slice(a1).map(x=>x.method),a1),
    B:await E.page.evaluate(b1=>__MW.log.filter(x=>x.pid==='B').slice(b1).map(x=>x.method),b1)};
  after.A=after.A.filter(m=>ACT.test(m)); after.B=after.B.filter(m=>ACT.test(m));
  const s=await E.sends();
  return {pass:/00aa/i.test(who)&&wrong&&askedA&&bWhileConnected===0&&off&&still&&after.A.length===0&&after.B.length===0&&s.length===0,
    ev:{connectedAs:who,wrongView:wrong,guardAskedA:askedA,bWhileConnected,disconnected:off,buttonStillThere:still,askedAfterDisconnect:after,sends:s.length,label:await E.label(),toasts:(await E.toasts()).slice(-3)}}; });

module.exports={};
