/* THE AUDIT-5 PAGE CASES (audit/wallet-5-page). Loaded by wallet.test.js (every audit5*.test.js is group @audit5). Same mocks, same fake
   chain: nothing real is touched (no wallet, no RPC, no relay).
   a5n  NONCE IDENTITY: trackTx takes a nonce only from an answer about the transaction it follows (hash, sender, nonce, and the call it
        sent), from a public reader or the wallet; a bad reader is skipped, not trusted. The replacement found in a block must hang together
        (block, transaction, receipt) before it is a verdict.
   a5m  ONE WALLET PER CONNECT ATTEMPT: once a wallet is selected, only it is asked; on a failure no other wallet is asked, and on a phone
        the page offers CHOOSE ANOTHER WALLET (the list), after which the wallet picked by hand connects.
   a5w  WITHDRAW TO ANOTHER ADDRESS: withdrawTo(address) for a wallet that cannot accept ETH.
   a5x  adjacent: the earnings copy.
   Every regression asserts that its trigger was reached (the poisoned answer was actually served, the gate was hit, the sheet shown), so a
   case cannot pass because the situation never happened. */
const H=require('./wallet.test.js');
const {T,connect,sheetOpen,sheetTitle,sheetButtons,clickSheet,disconnectUI,closeWit,openWit,sleep,DONE,A1,A2,B1}=H;
const {ethers}=require('ethers');
const one=(...a)=>H.one(...a);
const IN_APP={ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MetaMaskMobile/7.40.0',viewport:{width:390,height:844},mobile:true};
const SAFARI={ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',viewport:{width:390,height:844},mobile:true};
const NOTSENT=/Nothing was sent/i;
const hex=n=>'0x'+n.toString(16);
const H32=s=>'0x'+String(s).padEnd(64,'0');
const CONTRACT='0xCf5EBA884EFA04940d31A663bEB6D37F907d064C';
const toastsSince=async(E,n)=>(await E.toasts()).slice(n);
const reqs=(E,id,m)=>E.page.evaluate(([id,m])=>__MW.log.filter(x=>x.pid===id&&x.method===m).length,[id,m]);
const track=(E,o)=>E.page.evaluate(o=>{ Object.assign(TRACK,o); },o);
const READERS=/(publicnode\.com|mevblocker\.io|drpc\.org|blastapi\.io)/;
const hostKey=u=>/publicnode/.test(u)?'pn':/mevblocker/.test(u)?'mev':/drpc/.test(u)?'drpc':'other';

/* ════════ a5n: NONCE IDENTITY ════════
   The page's own trackTx(op, hash, tell) is driven directly (as audit 4's a4r cases do), with op as OpSigner leaves it: acct, req (the
   request sent: to, data, value), block, P (a wallet stub that answers eth_getTransactionByHash as the row says and logs every call).
   serve(E, fn): every reader request goes through fn(host, q) first: a value is that reader's answer, undefined falls through to the
   fake chain. Every request is logged per reader ({h, m, p}), so a case says which readers were asked. */
const REQ={to:CONTRACT,data:'0xabcdef0100000000000000000000000000000000000000000000000000000000000000d',value:'0x2386f26fc10000'};
async function serve(E,fn){ E.RQ=[]; await E.page.route(READERS,async route=>{ const r=route.request(), b=r.postData()||''; let q=null; try{ q=JSON.parse(b); }catch(e){}
    if(!q||Array.isArray(q)) return route.fallback();
    const h=hostKey(r.url()); E.RQ.push({h,m:q.method,p:q.params});
    const v=fn(h,q); if(v===undefined) return route.fallback();
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:q.id,result:v})}); }); }
const askedBy=(E,m,hash)=>[...new Set(E.RQ.filter(x=>x.m===m&&(!hash||(x.p&&x.p[0]===hash))).map(x=>x.h))];
async function startTrack(E,rows){ await E.page.evaluate(rows=>{ window.__R=window.__R||{}; window.__WQ=window.__WQ||{}; trackAt=0;
  rows.forEach(r=>{ const W=window.__WQ[r.hash]=[];
    const P={request:a=>{ W.push(a.method); if(a.method==='eth_getTransactionByHash') return r.wallet==='never'?new Promise(()=>{}):Promise.resolve(r.wallet===undefined?null:r.wallet); return Promise.resolve(null); }};
    const op={acct:r.acct||'0x00000000000000000000000000000000000000aa',req:r.req,block:r.block,chain:1,P};
    const R=window.__R[r.hash]={state:'pending',tells:[],t0:performance.now()};
    trackTx(op,r.hash,s=>R.tells.push(s)).then(x=>{ R.state=x.state; R.by=x.by||null; R.ms=Math.round(performance.now()-R.t0); },e=>{ R.state='threw '+e.message; }); }); },rows); }
const results=E=>E.page.evaluate(()=>window.__R);
const walletAsked=(E,h)=>E.page.evaluate(h=>(window.__WQ[h]||[]).filter(m=>m==='eth_getTransactionByHash').length,h);
/* the original (pending), as a reader would give it: the call that was sent, nonce N */
const orig=(c,h,nonce,o={})=>c.mkTx(h,Object.assign({nonce,blockHash:null,blockNumber:null,transactionIndex:null,to:REQ.to,input:REQ.data,value:REQ.value},o));
/* a mined transaction of the sender spending nonce N in block R: kind 'other' (another call), 'cancel' (0 ETH to self), 'same' (the same call) */
const spender=(c,h,nonce,R,kind)=>c.mkTx(h,Object.assign({nonce,blockNumber:hex(R)},kind==='cancel'?{to:A1,input:'0x',value:'0x0'}:kind==='same'?{to:REQ.to,input:REQ.data,value:REQ.value,gasPrice:'0x77359400',maxFeePerGas:'0x77359400'}:{to:'0x000000000000000000000000000000000000dEaD',input:'0xdeadbeef',value:'0x0'}));

/* one scenario: hash Hx (the payment being followed) is pending; the sender's nonce 7 is spent in block R by U (kind), nonce 8 is the
   payment's real nonce unless the case says otherwise. fn(h,q) is the per-reader override. Returns the state at the gate, then (if
   o.release) the state once Hx's own receipt is served.
   THE GATE (audit 5b fix: it was a fixed window, `sleep(o.ms)`, which a loaded machine could outrun before the trigger was even served):
   o.want set and not 'pending' (a verdict is expected): the tracker has decided (bounded 30 s). Otherwise: the trigger was served
   (o.trig(served,E), default: a reader override answered) and the tracker then began a LATER round (its own receipt asked again after
   that point), or it decided (a verdict ends the rounds); both bounded 30 s. The round that saw the trigger is then over: its verdict,
   if it made one, is in the state read. out.gate records both steps. */
async function scen(E,o){ const c=E.chain, B=c.blockNo(), R=B+2, Hx=o.hash||H32('a5'), Hu=H32('b7');
  await track(E,Object.assign({poll:250,timeout:4000,lost:600000,stop:3600000,scan:6},o.track||{}));   /* 4 s: a cold first request must not time out and move the reader cursor by itself */
  c.topAns=()=>hex(B+6); c.nonceLatest=o.latest==null?8:o.latest;
  const U=spender(c,Hu,'0x7',R,o.kind||'other');
  let released=false;
  c.tx=h=>h===Hx?orig(c,Hx,o.realNonce||'0x8'):h===Hu?U:null;
  c.blockTxs=b=>b===R?[U]:[];
  c.rc=h=>h===Hu?c.mkRc(Hu,{from:A1,to:U.to,blockNumber:hex(R),status:'0x1'}):h===Hx&&released?c.mkRc(Hx,{from:A1,to:REQ.to,blockNumber:hex(B+5),status:'0x1'}):null;
  const served={n:0}; await serve(E,(h,q)=>{ if(o.fn){ const v=o.fn(h,q,{Hx,Hu,U,c,R,B}); if(v!==undefined){ served.n++; return v; } } return undefined; });
  await startTrack(E,[{hash:Hx,block:B,req:o.req===undefined?REQ:o.req,wallet:typeof o.wallet==='function'?o.wallet({Hx,Hu,U,c}):o.wallet}]);
  const gate=await gateRound(E,Hx,o,served); const mid=(await results(E))[Hx];
  const out={gate,mid:mid.state,by:mid.by,served:served.n,byHashReaders:askedBy(E,'eth_getTransactionByHash',Hx),walletAsked:await walletAsked(E,Hx),scanned:E.RQ.filter(x=>x.m==='eth_getBlockByNumber'&&x.p&&x.p[1]===true).length};
  if(o.release){ released=true; await E.until(async()=>(await results(E))[Hx].state!=='pending',30000); out.final=(await results(E))[Hx].state; }
  return out; }
async function gateRound(E,Hx,o,served){ const decided=async()=>(await results(E))[Hx].state!=='pending';
  if(o.want&&o.want!=='pending') return {decided:await E.until(decided,30000)};
  const trig=await E.until(async()=>o.trig?await o.trig(served,E,Hx):served.n>0,30000); const k=E.RQ.length;
  const next=trig&&await E.until(async()=>await decided()||E.RQ.slice(k).some(x=>x.m==='eth_getTransactionReceipt'&&x.p&&String(x.p[0]).toLowerCase()===Hx.toLowerCase()),30000);
  return {trig,next}; }
const W1=[one('A')];

T('a5n1','a reader answers the original hash with ANOTHER transaction of the same sender (the one that spent nonce 7): not trusted, the next reader is asked; stays pending (never "replaced"), then its own receipt confirms',{wallets:W1,ethereum:'A'},async E=>{
  const r=await scen(E,{release:true,fn:(h,q,X)=>h==='pn'&&q.method==='eth_getTransactionByHash'&&q.params[0]===X.Hx?X.U:undefined});
  return {pass:r.served>0&&r.mid==='pending'&&r.byHashReaders.includes('pn')&&r.byHashReaders.includes('mev')&&r.final==='confirmed', ev:r}; });

T('a5n2','a reader answers the right hash but another sender: unusable, the next reader is asked (not the wallet first); the real nonce decides',{wallets:W1,ethereum:'A'},async E=>{
  const r=await scen(E,{release:true,fn:(h,q,X)=>h==='pn'&&q.method==='eth_getTransactionByHash'&&q.params[0]===X.Hx?orig(X.c,X.Hx,'0x7',{from:B1}):undefined});
  return {pass:r.served>0&&r.mid==='pending'&&r.byHashReaders.includes('mev')&&r.walletAsked===0&&r.final==='confirmed', ev:r}; });

/* the hash field: missing, null, short, a number, not hex, another hash; each row its own page */
const HASHROWS=[['missing',t=>{ delete t.hash; return t; }],['null',t=>Object.assign(t,{hash:null})],['short',t=>Object.assign(t,{hash:'0x1234'})],['number',t=>Object.assign(t,{hash:7})],['nothex',t=>Object.assign(t,{hash:'0x'+'zz'.repeat(32)})],['33bytes',t=>Object.assign(t,{hash:t.hash+'00'})]];
T('a5n3','the reader\'s answer has a missing or malformed hash (and nonce 7, pointing at the sender\'s other transaction): never used, the next reader is asked; pending, then confirmed',{wallets:W1,ethereum:'A'},async E=>{
  const rows=[];
  for(const [name,spoil] of HASHROWS){ const X=await H.boot({wallets:W1,ethereum:'A'}); try{
      const r=await scen(X,{release:true,fn:(h,q,Y)=>h==='pn'&&q.method==='eth_getTransactionByHash'&&q.params[0]===Y.Hx?spoil(orig(Y.c,Y.Hx,'0x7')):undefined});
      rows.push(Object.assign({name},r)); } finally{ await X.close().catch(()=>{}); } }
  return {pass:rows.every(r=>r.served>0&&r.mid==='pending'&&r.byHashReaders.includes('mev')&&r.final==='confirmed'), ev:{rows}}; });

/* the nonce field: missing, null, negative (two spellings), decimal string, a number, empty 0x, not hex. A valid 0x0 is a nonce. */
const NONCEROWS=[['missing',t=>{ delete t.nonce; return t; }],['null',t=>Object.assign(t,{nonce:null})],['neg-hex',t=>Object.assign(t,{nonce:'-0x1'})],['neg-dec',t=>Object.assign(t,{nonce:'-1'})],['decimal',t=>Object.assign(t,{nonce:'7'})],['number',t=>Object.assign(t,{nonce:7})],['empty',t=>Object.assign(t,{nonce:'0x'})],['nothex',t=>Object.assign(t,{nonce:'0xzz'})]];
T('a5n4','the reader\'s nonce is missing, negative or not a hex quantity: never used (no "replaced", no early "unknown"), the next reader is asked; a valid nonce 0x0 is used (cancelled at nonce 0)',{wallets:W1,ethereum:'A'},async E=>{
  const rows=[];
  for(const [name,spoil] of NONCEROWS){ const X=await H.boot({wallets:W1,ethereum:'A'}); try{
      const r=await scen(X,{release:true,fn:(h,q,Y)=>h==='pn'&&q.method==='eth_getTransactionByHash'&&q.params[0]===Y.Hx?spoil(orig(Y.c,Y.Hx,'0x8')):undefined});
      const tells=(await results(X))[H32('a5')].tells; rows.push(Object.assign({name,tells:tells.join(',')},r)); } finally{ await X.close().catch(()=>{}); } }
  /* nonce 0x0: the original's nonce is 0; nonce 0 is spent by a 0-ETH transaction to self: cancelled (zero must not read as "no nonce") */
  const Z=await H.boot({wallets:W1,ethereum:'A'}); let z={};
  try{ const c=Z.chain, B=c.blockNo(), R=B+2, Hx=H32('c0'), Hc=H32('c1'); await track(Z,{poll:250,timeout:4000,scan:6}); c.topAns=()=>hex(B+6); c.nonceLatest=1;
    const C=spender(c,Hc,'0x0',R,'cancel'); c.tx=h=>h===Hx?orig(c,Hx,'0x0'):h===Hc?C:null; c.blockTxs=b=>b===R?[C]:[]; c.rc=h=>h===Hc?c.mkRc(Hc,{from:A1,to:A1,blockNumber:hex(R),status:'0x1'}):null;
    await serve(Z,()=>undefined); await startTrack(Z,[{hash:Hx,block:B,req:REQ}]);
    await Z.until(async()=>(await results(Z))[Hx].state!=='pending',6000); const res=(await results(Z))[Hx]; z={state:res.state,by:res.by===Hc,walletAsked:await walletAsked(Z,Hx)}; } finally{ await Z.close().catch(()=>{}); }
  return {pass:rows.every(r=>r.served>0&&r.mid==='pending'&&!r.tells&&r.byHashReaders.includes('mev')&&r.final==='confirmed')&&z.state==='cancelled'&&z.by&&z.walletAsked===0, ev:{rows,zero:z}}; });

T('a5n5','the first reader is invalid, the second valid: the second reader\'s nonce decides (a real cancellation at nonce 7 is "cancelled"); the wallet is never asked',{wallets:W1,ethereum:'A'},async E=>{
  const r=await scen(E,{kind:'cancel',want:'cancelled',fn:(h,q,X)=>h==='pn'&&q.method==='eth_getTransactionByHash'&&q.params[0]===X.Hx?orig(X.c,X.Hx,'0x7',{hash:H32('ee')}):h!=='pn'&&q.method==='eth_getTransactionByHash'&&q.params[0]===X.Hx?orig(X.c,X.Hx,'0x7'):undefined});
  return {pass:r.served>0&&r.mid==='cancelled'&&r.by===H32('b7')&&r.byHashReaders.includes('pn')&&r.byHashReaders.includes('mev')&&r.walletAsked===0, ev:r}; });

T('a5n6','every public reader answers the original hash with another transaction: none trusted; the wallet is asked and its valid answer (nonce 8) keeps it pending; then confirmed',{wallets:W1,ethereum:'A'},async E=>{
  const r=await scen(E,{release:true,trig:async(sv,E,Hx)=>sv.n>=3&&(await walletAsked(E,Hx))>=1,wallet:X=>orig(X.c,X.Hx,'0x8'),fn:(h,q,X)=>q.method==='eth_getTransactionByHash'&&q.params[0]===X.Hx?X.U:undefined});
  return {pass:r.served>=3&&r.mid==='pending'&&['pn','mev','drpc'].every(k=>r.byHashReaders.includes(k))&&r.walletAsked>=1&&r.final==='confirmed', ev:r}; });

T('a5n7','the readers have not seen it and the WALLET answers with another transaction (or another sender, a malformed nonce, another call, recipient, value or chain): not trusted, stays pending; asked at most 5 times; then confirmed',{wallets:W1,ethereum:'A'},async E=>{
  const rows=[];
  for(const [name,mk] of [['otherTx',X=>X.U],['otherSender',X=>orig(X.c,X.Hx,'0x7',{from:B1})],['badNonce',X=>orig(X.c,X.Hx,'7')],['otherCall',X=>orig(X.c,X.Hx,'0x7',{input:'0xdeadbeef'})],['otherTo',X=>orig(X.c,X.Hx,'0x7',{to:'0x000000000000000000000000000000000000dEaD'})],['otherValue',X=>orig(X.c,X.Hx,'0x7',{value:'0x0'})],['otherChain',X=>orig(X.c,X.Hx,'0x7',{chainId:'0x2105'})],['dataNotInput',X=>{ const t=orig(X.c,X.Hx,'0x7'); t.data='0xdeadbeef'; return t; }]]){
    const X=await H.boot({wallets:W1,ethereum:'A'}); try{
      const r=await scen(X,{release:true,trig:async(sv,E,Hx)=>(await walletAsked(E,Hx))>=1,wallet:mk,fn:(h,q,Y)=>q.method==='eth_getTransactionByHash'&&q.params[0]===Y.Hx?null:undefined});
      rows.push(Object.assign({name},r)); } finally{ await X.close().catch(()=>{}); } }
  return {pass:rows.every(r=>r.mid==='pending'&&r.walletAsked>=1&&r.walletAsked<=5&&r.final==='confirmed'), ev:{rows}}; });

/* poisoned nonce pointing at a transaction that LOOKS like each verdict: the same call (a speed-up), 0 ETH to self (a cancellation), another
   call (a replacement). The payment itself is still pending (its real nonce is 8, not yet used): no verdict may come from it. */
T('a5n8','a poisoned nonce (another hash, nonce 7) where nonce 7 was spent by the same call / a cancellation / another call: never confirmed, cancelled or replaced; pending until its own receipt',{wallets:W1,ethereum:'A'},async E=>{
  const rows=[];
  for(const kind of ['same','cancel','other']){ const X=await H.boot({wallets:W1,ethereum:'A'}); try{
      const r=await scen(X,{kind,release:true,fn:(h,q,Y)=>h==='pn'&&q.method==='eth_getTransactionByHash'&&q.params[0]===Y.Hx?Object.assign({},Y.U,{hash:H32('ee')}):undefined});
      rows.push(Object.assign({kind},r)); } finally{ await X.close().catch(()=>{}); } }
  return {pass:rows.every(r=>r.served>0&&r.mid==='pending'&&r.final==='confirmed'), ev:{rows}}; });

/* the legitimate verdicts, and legitimate representations of the original: 'data' in place of 'input', checksum or upper-case addresses and
   hash, no chainId, a leading-zero quantity: each still read, each verdict still right */
const REPS=[['input',t=>t],['data',t=>{ t.data=t.input; delete t.input; return t; }],['checksum',t=>Object.assign(t,{from:ethers.getAddress(t.from),to:ethers.getAddress(t.to)})],['upperhash',t=>Object.assign(t,{hash:'0x'+t.hash.slice(2).toUpperCase()})],['noChainId',t=>{ delete t.chainId; return t; }],['noOptional',t=>{ delete t.accessList; delete t.v; delete t.r; delete t.s; delete t.yParity; delete t.type; return t; }],['lead0',t=>Object.assign(t,{nonce:'0x07'})]];
T('a5n9','legitimate speed-up, cancellation and replacement are still classified right, from the public readers alone, for every legitimate representation of the original (data/input, checksum, upper-case hash, no chainId, leading zero)',{wallets:W1,ethereum:'A'},async E=>{
  const rows=[];
  for(const [kind,want] of [['same','confirmed'],['cancel','cancelled'],['other','replaced']]) for(const [rep,f] of (kind==='other'?REPS:REPS.slice(0,2))){
    const X=await H.boot({wallets:W1,ethereum:'A'}); try{
      const r=await scen(X,{kind,want,fn:(h,q,Y)=>q.method==='eth_getTransactionByHash'&&q.params[0]===Y.Hx?f(orig(Y.c,Y.Hx,'0x7')):undefined});
      rows.push({kind,rep,want,got:r.mid,by:r.by===H32('b7'),walletAsked:r.walletAsked}); } finally{ await X.close().catch(()=>{}); } }
  return {pass:rows.every(r=>r.got===r.want&&r.by&&r.walletAsked===0), ev:{rows:rows.map(r=>r.kind+'/'+r.rep+'='+r.got+(r.by?'':' (by?)')+(r.walletAsked?' wallet'+r.walletAsked:''))}}; });

T('a5n10','late original receipt after "unknown" (no reader and no wallet gives a usable transaction): unknown at TRACK.lost, then its own receipt still confirms',{wallets:W1,ethereum:'A'},async E=>{
  const r=await scen(E,{release:true,track:{lost:2000},trig:async(sv,E,Hx)=>(await results(E))[Hx].tells.includes('unknown')&&(await walletAsked(E,Hx))>=1,wallet:X=>X.U,fn:(h,q,X)=>q.method==='eth_getTransactionByHash'&&q.params[0]===X.Hx?X.U:undefined});
  const tells=(await results(E))[H32('a5')].tells;
  return {pass:r.mid==='pending'&&tells.includes('unknown')&&r.final==='confirmed'&&r.walletAsked>=1, ev:Object.assign({tells},r)}; });

/* the replacement must hang together: the block says it is block R, the transaction found in it names block R (number) and a 32-byte
   blockHash, its receipt is from block R with the blockHash the transaction names. Each contradiction: no verdict while it lasts (pending,
   the block read again), and once the answers agree: replaced. */
const CONTRA=[['txBlockNumber',(X)=>({tx:Object.assign({},X.U,{blockNumber:hex(X.R+1)})})],['txBlockHashBad',(X)=>({tx:Object.assign({},X.U,{blockHash:'0x1234'})})],['txHashBad',(X)=>({tx:Object.assign({},X.U,{hash:'0xabc'})})],
  ['rcBlockNumber',(X)=>({rc:X.c.mkRc(X.Hu,{from:A1,to:X.U.to,blockNumber:hex(X.R+1),status:'0x1'})})],['rcBlockHash',(X)=>({rc:X.c.mkRc(X.Hu,{from:A1,to:X.U.to,blockNumber:hex(X.R),blockHash:H32('99'),status:'0x1'})})],
  ['blockNumber',(X)=>({blk:hex(X.R+3)})]];
T('a5n11','a replacement whose block, transaction and receipt contradict each other (block number, blockHash, tx hash) is no proof: pending while it lasts; replaced once consistent',{wallets:W1,ethereum:'A'},async E=>{
  const rows=[];
  for(const [name,mk] of CONTRA){ const X=await H.boot({wallets:W1,ethereum:'A'}); try{
      let fixed=false, hit=0;
      const r=await scen(X,{realNonce:'0x7',trig:async()=>hit>0,fn:(h,q,Y)=>{ if(fixed) return undefined; const bad=mk(Y);
          if(bad.tx&&q.method==='eth_getBlockByNumber'&&q.params&&q.params[1]===true&&Number(q.params[0])===Y.R){ hit++; return Object.assign(blockOf(Y,Y.R),{transactions:[bad.tx]}); }
          if(bad.blk&&q.method==='eth_getBlockByNumber'&&q.params&&q.params[1]===true&&Number(q.params[0])===Y.R){ hit++; return Object.assign(blockOf(Y,Y.R),{number:bad.blk,transactions:[Y.U]}); }
          if(bad.rc&&q.method==='eth_getTransactionReceipt'&&q.params[0]===Y.Hu){ hit++; return bad.rc; }
          return undefined; }});
      fixed=true; const Hx=H32('a5'); await X.until(async()=>(await results(X))[Hx].state!=='pending',30000); const fin=(await results(X))[Hx];
      rows.push({name,hit,mid:r.mid,final:fin.state,by:fin.by===H32('b7')}); } finally{ await X.close().catch(()=>{}); } }
  return {pass:rows.every(r=>r.hit>0&&r.mid==='pending'&&r.final==='replaced'&&r.by), ev:{rows}}; });
/* a full block as the fake chain gives it (fakechain.js block(n)): number n, hash = n padded to 32 bytes */
function blockOf(Y,n){ return {number:hex(n),hash:ethers.zeroPadValue(ethers.toBeHex(n),32),parentHash:ethers.zeroPadValue(ethers.toBeHex(n-1),32),timestamp:hex(Math.floor(Date.now()/1000)),nonce:'0x0000000000000000',difficulty:'0x0',gasLimit:'0x1c9c380',gasUsed:'0x0',miner:ethers.ZeroAddress,extraData:'0x',baseFeePerGas:'0x3b9aca00',transactions:[]}; }

/* end to end through the page: a witness payment, the first reader answers its hash with the sender's other (mined) transaction */
T('a5n12','end to end: WITNESS sent, the first reader answers its hash with the sender\'s other mined transaction (nonce 7): never "replaced"/"cancelled", then "confirmed" from its own receipt',{wallets:[one('A',undefined,{txNonce:'0x8'})],ethereum:'A'},async E=>{
  await connect(E); await track(E,{poll:300,timeout:1500,scan:6}); const c=E.chain, B=c.blockNo(), R=B+5, Hu=H32('b7'); let mine=null, released=false, served=0, handed=false;
  c.topAns=()=>hex(handed?B+7:B+4); c.nonceLatest=8;   /* the page reads B+4 just before sending; the sender's other transaction is mined after that, in B+5 */
  const U=spender(c,Hu,'0x7',R,'other'); c.blockTxs=b=>b===R?[U]:[];
  c.tx=h=>h===Hu?U:h===mine?c.mkTx(h,{nonce:'0x8',blockHash:null,blockNumber:null,transactionIndex:null}):null;
  c.rc=h=>h===Hu?c.mkRc(Hu,{from:A1,to:U.to,blockNumber:hex(R),status:'0x1'}):h===mine&&released?c.mkRc(h,{blockNumber:hex(B+6)}):null;
  await serve(E,(h,q)=>{ if(h==='pn'&&q.method==='eth_getTransactionByHash'&&q.params[0]===mine){ served++; return U; } return undefined; });
  await E.P('A').set({gate:{eth_sendTransaction:true}});
  await closeWit(E.page); await openWit(E.page); await E.page.fill('#wAmt','0.01'); const n=(await E.toasts()).length; await E.page.click('#bWit');
  const g=await E.waitGate('A','eth_sendTransaction',8000); handed=true; mine='0x'+(1).toString(16).padStart(64,'0'); await E.P('A').set({gate:{}}); await E.P('A').release('eth_sendTransaction');
  await E.until(async()=>(await E.sends()).length>0,8000); mine=(await E.sends())[0].hash;
  /* gate (audit 5b fix; was sleep(3500)): the poisoned answer was served, then the tracker asked this payment's receipt again (a later round) */
  const trig=await E.until(()=>served>0,30000); const k=E.RQ.length; const next=trig&&await E.until(()=>E.RQ.slice(k).some(x=>x.m==='eth_getTransactionReceipt'&&x.p&&x.p[0]===mine),30000);
  const mid=await toastsSince(E,n); released=true;
  const conf=await E.until(async()=>(await toastsSince(E,n)).some(x=>DONE.test(x)),12000); const t=await toastsSince(E,n);
  const bad=t.some(x=>/replaced|cancelled|reverted|cannot confirm/i.test(x)||NOTSENT.test(x));
  return {pass:g&&served>0&&next&&!bad&&conf&&!mid.some(x=>DONE.test(x)), ev:{gateHit:g,served,laterRound:next,confirmed:conf,toasts:t}}; });

/* ════════ a5x: ADJACENT ════════
   a5x1 (lead from the orchestrator's baseline, a4s3 under load): with every public reader down, the ledger's background drawing awaited
   plates(id) inside an async IIFE nobody caught: "Uncaught (in promise) Error: server response 500". Made deterministic here: from the
   start, every reader answers HTTP 500 to any request that carries plates(id) for a past day (the day on sale, 13, still reads), so the
   page boots, the ledger is laid out, and each of its plate reads fails. The runner fails a case on any page error or unhandled
   rejection; the case also asserts the failing reads were actually served and the page itself still shows the day. */
const PLATES=ethers.id('plates(uint256)').slice(2,10), MEDIAN=ethers.id('median7()').slice(2,10);
const pastPlate=body=>{ const m=String(body||'').match(new RegExp('0x'+PLATES+'([0-9a-f]{64})','gi'))||[]; return m.some(x=>Number(BigInt('0x'+x.slice(10)))<13); };
T('a5x1','every reader fails the past plates\' reads (HTTP 500): the ledger cards stay labels, no unhandled rejection, the day still shows; the next card is still tried',{wallets:[]},async E=>{
  /* gate (audit 5b fix; was sleep(4000)): three failing plate reads were served (so the first two were handled and the next card tried) and the ledger and day are drawn */
  await E.until(()=>E.chain.fails>=3&&E.page.evaluate(()=>document.getElementById('ledgerGrid').children.length===13&&/DAY 13/.test(document.getElementById('panel').textContent)),30000);
  const r=await E.page.evaluate(()=>({cards:document.getElementById('ledgerGrid').children.length,day:/DAY 13/.test(document.getElementById('panel').textContent)}));
  return {pass:E.chain.fails>=3&&r.cards===13&&r.day&&E.errors.length===0, ev:{failedPlateRequests:E.chain.fails,ledger:r,pageErrors:E.errors}}; },
  {chain:c=>{ c.fails=0; c.hostMode=(h,body)=>{ if(pastPlate(body)){ c.fails++; return '500'; } return null; }; }});

/* a5x2 (neighbour found while fixing a5x1): renderLedger marked the ledger drawn (data-n) BEFORE awaiting median7(); one failed median7 read
   then left the ledger empty until the next day (every later tick returned early). One median7 request fails here, once: the ledger must
   be drawn by a later tick. */
T('a5x2','one failed median7() read while the ledger is first drawn: the ledger is still drawn (13 plates) once the read works, not left empty',{wallets:[]},async E=>{
  const ok=await E.until(()=>E.page.evaluate(()=>document.getElementById('ledgerGrid').children.length===13&&/median of the last seven/.test(document.getElementById('ledgerNote').textContent)),12000);
  const r=await E.page.evaluate(()=>({cards:document.getElementById('ledgerGrid').children.length,note:document.getElementById('ledgerNote').textContent.slice(0,80)}));
  return {pass:E.chain.medFails===1&&ok, ev:{medianFailedOnce:E.chain.medFails,ledger:r}}; },
  {chain:c=>{ c.medFails=0; c.hostMode=(h,body)=>{ if(c.medFails===0&&new RegExp('0x'+MEDIAN,'i').test(String(body||''))){ c.medFails++; return '500'; } return null; }; }});

/* ════════ a5m: ONE WALLET PER CONNECT ATTEMPT ════════
   A phone inside a wallet app: window.ethereum (A) is this browser's wallet and fails eth_requestAccounts; a SECOND wallet (B) is present
   and ALREADY AUTHORISED (it would connect without any prompt). B must receive nothing that connects or pays (eth_requestAccounts,
   eth_accounts, eth_sendTransaction) unless the visitor picks it by hand afterwards; then it connects. A refusal (4001) and a request
   already waiting (-32002) are answers: no offer. Every other error offers CHOOSE ANOTHER WALLET. Each code as a rejected promise and as
   a synchronous throw. */
const CODES=[4001,4100,4200,4900,4901,-32002,-32603];
const ANSWERS=new Set([4001,-32002]);
/* a synchronous throw WITH a code (the mock's throwSync has none): wraps the provider's request in the page, logged like the mock's own */
const syncThrow=(E,id,method,code)=>E.page.evaluate(([id,method,code])=>{ const p=__MW.P[id].provider, orig=p.request.bind(p);
  p.request=a=>{ if(a&&a.method===method){ __MW.log.push({pid:id,method,params:null,chain:__MW.P[id].st.chainId,t:performance.now()}); const e=new Error('sync '+code); e.code=code; throw e; } return orig(a); }; },[id,method,code]);
const B_TOUCH=async E=>({rq:await reqs(E,'B','eth_requestAccounts'),acc:await reqs(E,'B','eth_accounts'),tx:await reqs(E,'B','eth_sendTransaction')});
async function phoneRow(cfg,o,code,how,pickRe){ const X=await H.boot(cfg,o); let r0gate=false; try{
    if(how==='sync') await syncThrow(X,'A','eth_requestAccounts',code); else await X.P('A').set({reject:{eth_requestAccounts:{code,message:'wallet error '+code}}});
    if(cfg.wc){ await X.page.click('#wallet'); await X.until(async()=>(await sheetButtons(X.page)).some(b=>/USE THIS BROWSER/.test(b)),4000); await clickSheet(X.page,/USE THIS BROWSER/); }
    else await X.page.click('#wallet');
    await X.until(async()=>(await reqs(X,'A','eth_requestAccounts'))>0,4000); r0gate=await X.until(()=>X.page.evaluate(()=>CONNECTING===null),15000);   /* gate (audit 5b fix; was sleep(1500)): the connection attempt is over */
    const r={gate:r0gate,code,how,rqA:await reqs(X,'A','eth_requestAccounts'),before:await B_TOUCH(X),label:await X.label(),offer:(await sheetTitle(X.page))==='YOUR WALLET DID NOT CONNECT',btns:await sheetButtons(X.page),toast:(await X.toasts()).slice(-1)[0]||''};
    r.text=await X.page.evaluate(()=>document.getElementById('wsp').textContent);
    /* an answer (4001/-32002) is a toast; any other failure is the offer sheet, which names the error itself (no toast over it) */
    r.ok=r.gate&&r.rqA===1&&r.before.rq===0&&r.before.acc===0&&r.before.tx===0&&!/0x/.test(r.label)&&r.offer===!ANSWERS.has(code)&&(r.offer?r.text.includes(String(code))||/error/i.test(r.text):!!r.toast);
    if(r.offer){ await clickSheet(X.page,/CHOOSE ANOTHER WALLET/); const list=await X.until(async()=>(await sheetTitle(X.page))==='CONNECT WITH',4000); const lb=await sheetButtons(X.page);
      if(list) await clickSheet(X.page,pickRe); r.picked=await X.until(async()=>/00cc/i.test(await X.label()),5000); r.list=lb; r.after=await B_TOUCH(X); r.rqAafter=await reqs(X,'A','eth_requestAccounts');
      r.ok=r.ok&&list&&r.picked&&r.after.rq===1&&r.after.tx===0&&r.rqAafter===1; }
    r.errors=X.errors.slice(); r.ok=r.ok&&X.errors.length===0; return r; } finally{ await X.close().catch(()=>{}); } }
const PHONE_CFG={wallets:[one('A','0x1',{announce:false,flags:{isMetaMask:true}}),one('B','0x1',{authorized:true})],ethereum:'A'};
const rowsCase=how=>async E=>{ const rows=[]; for(const code of CODES) rows.push(await phoneRow(PHONE_CFG,IN_APP,code,how,/WALLET B/));
  return {pass:rows.every(r=>r.ok), ev:{rows:rows.map(r=>({code:r.code,ok:r.ok,rqA:r.rqA,B:r.before,offer:r.offer,picked:r.picked,Bafter:r.after,toast:r.toast.slice(0,70),errors:r.errors}))}}; };
T('a5m1','phone in a wallet app, window.ethereum fails eth_requestAccounts (4001, 4100, 4200, 4900, 4901, -32002, -32603 as REJECTED PROMISES): the authorised second wallet gets nothing; an offer except for 4001/-32002; picked by hand, it connects',{wallets:[]},rowsCase('async'));
T('a5m2','the same seven errors as SYNCHRONOUS THROWS from window.ethereum.request: the authorised second wallet gets nothing; an offer except for 4001/-32002; picked by hand, it connects',{wallets:[]},rowsCase('sync'));
T('a5m3','phone in a wallet app, the second wallet only in window.ethereum.providers[] (legacy): -32603 from window.ethereum asks nobody else; CHOOSE ANOTHER WALLET lists it and it connects',{wallets:[]},async E=>{
  const r=await phoneRow({wallets:[one('A','0x1',{announce:false,flags:{isMetaMask:true}}),one('B','0x1',{announce:false,authorized:true})],ethereum:'A',providers:['A','B']},IN_APP,-32603,'async',/BROWSER WALLET/);
  return {pass:r.ok, ev:r}; });
T('a5m4','iPhone Safari, USE THIS BROWSER’S WALLET: window.ethereum fails (-32603, then 4100 as a sync throw): the authorised EIP-6963 wallet is not asked; CHOOSE ANOTHER WALLET, picked, connects',{wallets:[]},async E=>{
  const cfg={wallets:[one('A','0x1',{announce:false}),one('B','0x1',{authorized:true})],ethereum:'A',wc:{accounts:[A1],chainId:'0x1'}};
  const r1=await phoneRow(cfg,SAFARI,-32603,'async',/WALLET B/), r2=await phoneRow(cfg,SAFARI,4100,'sync',/WALLET B/);
  return {pass:r1.ok&&r2.ok, ev:{async:r1,sync:r2}}; });
T('a5m7','phone in a wallet app whose failing wallet is also the REMEMBERED choice: CHOOSE ANOTHER WALLET still shows the list (the saved choice is not used to pick for the visitor), the failed wallet is not asked again, the one picked connects',{wallets:[]},async E=>{
  const r=await phoneRow(PHONE_CFG,Object.assign({store:{'stormglass.wallet':'legacy:MetaMask'}},IN_APP),-32603,'async',/WALLET B/);
  return {pass:r.ok, ev:r}; });
T('a5m5','iPhone Safari, a WalletConnect session that fails eth_requestAccounts (-32603): no injected wallet is asked to connect; nothing connects',{wallets:[one('B','0x1',{authorized:true})],wc:{accounts:[A1],chainId:'0x1'}},async E=>{
  await E.page.evaluate(()=>{ const p=__MW.wc.provider, orig=p.request.bind(p); p.request=a=>{ if(a&&a.method==='eth_requestAccounts'&&p.session){ __MW.log.push({pid:'WC',method:'eth_requestAccounts',params:null,chain:'0x1',t:performance.now()}); const e=new Error('Internal error'); e.code=-32603; return Promise.reject(e); } return orig(a); }; });
  await E.page.click('#wallet'); const uri=await E.until(()=>E.page.evaluate(()=>!!__MW.wc.approve),6000); await E.page.evaluate(()=>__MW.wc.approve&&__MW.wc.approve());
  const wcAsked=await E.until(async()=>(await reqs(E,'WC','eth_requestAccounts'))>0,6000); const over=await E.until(()=>E.page.evaluate(()=>CONNECTING===null),15000);   /* gate (audit 5b fix; was sleep(1500)): the attempt is over */
  const b=await B_TOUCH(E), lab=await E.label();
  return {pass:uri&&wcAsked&&over&&b.rq===0&&b.acc===0&&b.tx===0&&!/0x/.test(lab), ev:{paired:uri,wcAsked,B:b,label:lab,sheet:await sheetTitle(E.page)}}; },SAFARI);
T('a5m6','computer, remembered wallet B fails (-32603) while A is authorised: A is not asked; the next CONNECT lists both; A picked by hand connects',{wallets:[one('A','0x1',{authorized:true}),one('B','0x1',{reject:{eth_requestAccounts:{code:-32603,message:'Internal error'}}})]},async E=>{
  await E.page.click('#wallet'); const asked=await E.until(async()=>(await reqs(E,'B','eth_requestAccounts'))>0,5000); const over=await E.until(()=>E.page.evaluate(()=>CONNECTING===null),15000);   /* gate (audit 5b fix; was sleep(1200)): the attempt is over */
  const a0={rq:await reqs(E,'A','eth_requestAccounts'),acc:await reqs(E,'A','eth_accounts')}, lab0=await E.label();
  await closeWit(E.page); await E.page.click('#wallet'); const list=await E.until(async()=>(await sheetTitle(E.page))==='CONNECT WITH',4000); const btns=await sheetButtons(E.page);
  if(list) await clickSheet(E.page,/WALLET A/); const con=await E.until(async()=>/00aa/i.test(await E.label()),5000);
  return {pass:asked&&over&&a0.rq===0&&a0.acc===0&&!/0x/.test(lab0)&&list&&btns.length===2&&con, ev:{asked,attemptOver:over,A:a0,label:lab0,list,btns,connectedA:con}}; },{store:{'stormglass.wallet':'test.b'}});

/* ════════ a5w: WITHDRAW TO ANOTHER ADDRESS ════════
   The contract owes the connected wallet 0.05 ETH (owed(), the fake chain). The flow: WITHDRAW TO ANOTHER ADDRESS opens a box; REVIEW checks
   the address and reads owed again; the sheet shows the full checksummed address and the amount; SEND TO THIS ADDRESS hands
   withdrawTo(that address) to the wallet through the same guarded path as every write. */
const SGI=new ethers.Interface(['function withdrawTo(address)']);
const R1L='0x52908400098527886e0f7030069857d2e4169ee7', R1=ethers.getAddress(R1L), R2=ethers.getAddress('0xde709f2102306220921060314715629080e2fb77');
const OWED={chain:c=>{ c.values.owed=ethers.parseEther('0.05'); }};
const WCFG={wallets:[one('A')],ethereum:'A'};
const shown=E=>E.page.evaluate(()=>{ const b=document.getElementById('withdrawTo'); return !!b&&b.style.display!=='none'&&b.offsetParent!==null; });
const wNote=E=>E.page.evaluate(()=>document.getElementById('wtoNote').textContent);
async function wOpen(E){ await closeWit(E.page); if(!(await E.until(()=>shown(E),8000))) throw new Error('no WITHDRAW TO ANOTHER ADDRESS button');
  if(await E.page.evaluate(()=>document.getElementById('wtoBox').hidden)) await E.page.evaluate(()=>document.getElementById('withdrawTo').click()); }
async function wReview(E,addr){ await E.page.fill('#wtoAddr',addr); await E.page.evaluate(()=>document.getElementById('wtoReview').click()); }
const wSheet=E=>E.until(async()=>(await sheetTitle(E.page))==='WITHDRAW TO ANOTHER ADDRESS',5000);
const wsp=E=>E.page.evaluate(()=>document.getElementById('wsp').textContent);
const pressSend=E=>clickSheet(E.page,/SEND TO THIS ADDRESS/);
const sentTo=s=>{ try{ return SGI.decodeFunctionData('withdrawTo',s.params[0].data)[0]; }catch(e){ return 'not withdrawTo: '+String(s.params[0].data).slice(0,10); } };

T('a5w1','valid recipient: the sheet shows the full checksummed address and 0.05 ETH before the wallet is asked; one eth_sendTransaction: withdrawTo(recipient) to the contract, from the connected account, value 0, chain 1; after confirmation owed is read again and the button goes',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await wOpen(E); const c=E.chain; c.holdReceipts=true; await wReview(E,'  '+R1L+' ');
  const sh=await wSheet(E), text=await wsp(E), asked0=await reqs(E,'A','eth_sendTransaction');
  await pressSend(E); const sent=await E.until(async()=>(await E.sends()).length>0,8000); const s=(await E.sends())[0]||{params:[{}]}, q=s.params[0];
  const owedReads0=c.calls.filter(x=>x==='owed').length; c.values.owed=0n; c.values.pending=0n; c.holdReceipts=false;
  const n=(await E.toasts()).length; const conf=await E.until(async()=>(await E.toasts()).some(x=>/Withdrawing to another address: confirmed/.test(x)),12000);
  const gone=await E.until(async()=>!(await shown(E))&&/^0(\.0*)? /.test(await E.page.evaluate(()=>document.getElementById('nx-myOwed').textContent)),5000);
  const r={sheet:sh,text,askedBeforeSend:asked0,sent,to:sentTo(s),from:q.from,contract:q.to,value:q.value||null,chainId:q.chainId,sends:(await E.sends()).length,confirmed:conf,owedReadAgain:c.calls.filter(x=>x==='owed').length>owedReads0,buttonGone:gone};
  return {pass:sh&&text.includes(R1)&&text.includes('0.05')&&asked0===0&&sent&&r.to===R1&&(q.from||'').toLowerCase()===A1&&(q.to||'').toLowerCase()===CONTRACT.toLowerCase()&&(q.value==null||BigInt(q.value)===0n)&&q.chainId==='0x1'&&r.sends===1&&conf&&r.owedReadAgain&&gone, ev:r}; },OWED);

const BAD=[['empty',''],['short','0x1234'],['ens','vitalik.eth'],['zero','0x0000000000000000000000000000000000000000'],['badChecksum','0x52908400098527886E0F7030069857D2E4169Ee7'],['noPrefix','52908400098527886e0f7030069857d2e4169ee7'],['contract',CONTRACT.toLowerCase()],['self',A1]];
T('a5w2','empty, malformed, ENS, zero, a bad checksum, no 0x, the STORMGLASS contract and the connected wallet itself are refused with a reason: no sheet, nothing asked of the wallet',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await wOpen(E); const rows=[];
  for(const [name,v] of BAD){ await E.page.evaluate(()=>{ document.getElementById('wtoNote').textContent=''; }); await wReview(E,v); await E.until(async()=>(await wNote(E))!=='',3000);   /* gate (audit 5b fix; was sleep(300)): REVIEW has answered */
    rows.push({name,note:(await wNote(E)).slice(0,60),sheet:await sheetOpen(E.page)}); }
  const asked={est:await reqs(E,'A','eth_estimateGas'),send:await reqs(E,'A','eth_sendTransaction')};
  return {pass:rows.every(r=>r.note&&!/Reading/.test(r.note)&&!r.sheet)&&asked.est===0&&asked.send===0, ev:{rows,asked}}; },OWED);

T('a5w3','the recipient is the one shown at confirmation: edits to the box after REVIEW, and after SEND, do not change the address sent',{wallets:[one('A',undefined,{gate:{eth_sendTransaction:true}})],ethereum:'A'},async E=>{
  await connect(E); await wOpen(E); await wReview(E,R1L); const sh=await wSheet(E);
  await E.page.evaluate(v=>{ document.getElementById('wtoAddr').value=v; },R2); await pressSend(E);
  const g=await E.waitGate('A','eth_sendTransaction',8000); await E.page.fill('#wtoAddr',R2); await E.P('A').set({gate:{}}); await E.P('A').release('eth_sendTransaction');
  await E.until(async()=>(await E.sends()).length>0,8000); const s=await E.sends();
  return {pass:sh&&g&&s.length===1&&sentTo(s[0])===R1, ev:{sheet:sh,gateHit:g,sent:s.map(sentTo)}}; },OWED);

T('a5w4','repeated clicks: SEND pressed twice at once, then REVIEW + SEND again while the wallet holds the first: one request; the second says it is waiting',{wallets:[one('A',undefined,{gate:{eth_sendTransaction:true}})],ethereum:'A'},async E=>{
  await connect(E); await wOpen(E); await wReview(E,R1L); await wSheet(E);
  await E.page.evaluate(()=>{ const b=[...document.querySelectorAll('#wsBtns button')].find(b=>/SEND TO THIS ADDRESS/.test(b.textContent)); b.click(); b.click(); b.click(); });
  const g=await E.waitGate('A','eth_sendTransaction',8000); const n=(await E.toasts()).length;
  await wReview(E,R2L()); const sh2=await wSheet(E); await pressSend(E);
  await E.until(async()=>(await toastsSince(E,n)).some(x=>/in your wallet now|still waiting/i.test(x)),6000);   /* gate (audit 5b fix; was sleep(800)) */
  const busy=(await toastsSince(E,n)).some(x=>/in your wallet now|still waiting/i.test(x));
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_sendTransaction'); const settled=await E.until(async()=>(await E.P('A').answered('eth_sendTransaction'))>=1&&(await E.sends()).length>=1,8000); await sleep(1500);   /* barrier: the held request answered; then an absence window (no second request) */
  return {pass:g&&sh2&&busy&&settled&&(await reqs(E,'A','eth_sendTransaction'))===1&&(await E.sends()).length===1, ev:{gateHit:g,secondSheet:sh2,busy,requests:await reqs(E,'A','eth_sendTransaction'),toasts:await toastsSince(E,n)}}; },OWED);
function R2L(){ return R2.toLowerCase(); }

T('a5w5','account change between REVIEW and SEND, a network change before the hand-off, and DISCONNECT before the hand-off: nothing is sent',{wallets:[one('A')],ethereum:'A'},async E=>{
  const out={};
  /* a: another account after REVIEW */
  await connect(E); await wOpen(E); await wReview(E,R1L); await wSheet(E); await E.P('A').emit('accountsChanged',[A2]);
  const moved=await E.until(async()=>/00bb/i.test(await E.label()),5000); const n=(await E.toasts()).length; await pressSend(E); await E.until(async()=>(await toastsSince(E,n)).some(x=>NOTSENT.test(x)),6000);   /* gate (audit 5b fix; was sleep(800)) */
  out.account={moved,toasts:await toastsSince(E,n),est:await reqs(E,'A','eth_estimateGas'),send:await reqs(E,'A','eth_sendTransaction')};
  /* b: network change after the chain check, while gas is estimated */
  const X=await H.boot(WCFG,OWED); try{ await connect(X); await wOpen(X); await wReview(X,R1L); await wSheet(X); await X.P('A').set({gate:{eth_estimateGas:true}}); const m=(await X.toasts()).length; await pressSend(X);
    const g=await X.waitGate('A','eth_estimateGas',8000); await X.P('A').set({chainId:'0x2105',gate:{}}); await X.P('A').emit('chainChanged','0x2105'); await X.P('A').release('eth_estimateGas');
    const ended=await X.until(async()=>(await toastsSince(X,m)).some(x=>NOTSENT.test(x)||/another network/i.test(x))&&await X.page.evaluate(()=>OPLOCK===null),8000);
    out.network={gateHit:g,ended,send:await reqs(X,'A','eth_sendTransaction'),toasts:await toastsSince(X,m)}; } finally{ await X.close().catch(()=>{}); }
  /* c: DISCONNECT during the last look */
  const Y=await H.boot(WCFG,OWED); try{ await connect(Y); await wOpen(Y); await wReview(Y,R1L); await wSheet(Y); await Y.P('A').set({gate:{eth_accounts:true}}); const m=(await Y.toasts()).length; await pressSend(Y);
    const g=await Y.waitGate('A','eth_accounts',8000); await disconnectUI(Y); await Y.P('A').set({gate:{}}); await Y.P('A').release('eth_accounts');
    const ended=await Y.until(async()=>(await toastsSince(Y,m)).some(x=>NOTSENT.test(x))&&await Y.page.evaluate(()=>OPLOCK===null),8000);
    out.disconnect={gateHit:g,ended,send:await reqs(Y,'A','eth_sendTransaction'),boxHidden:await Y.page.evaluate(()=>document.getElementById('wtoBox').hidden&&document.getElementById('withdrawTo').style.display==='none')}; } finally{ await Y.close().catch(()=>{}); }
  const a=out.account, b=out.network, d=out.disconnect;
  return {pass:a.moved&&a.toasts.some(x=>NOTSENT.test(x))&&a.est===0&&a.send===0&&b.gateHit&&b.ended&&b.send===0&&d.gateHit&&d.ended&&d.send===0&&d.boxHidden, ev:out}; },OWED);

T('a5w6','refused in the wallet (4001): "Cancelled", nothing sent, the box keeps the address; REVIEW + SEND again sends once',{wallets:[one('A',undefined,{reject:{eth_sendTransaction:{code:4001,message:'User rejected the request.'}}})],ethereum:'A'},async E=>{
  await connect(E); await wOpen(E); await wReview(E,R1L); await wSheet(E); const n=(await E.toasts()).length; await pressSend(E);
  const can=await E.until(async()=>(await toastsSince(E,n)).some(x=>/Cancelled in your wallet\. Nothing was sent\./.test(x)),8000);
  const kept=await E.page.evaluate(()=>!document.getElementById('wtoBox').hidden&&document.getElementById('wtoAddr').value);
  await E.P('A').set({reject:{}}); await E.page.evaluate(()=>document.getElementById('wtoReview').click()); await wSheet(E); await pressSend(E);
  const sent=await E.until(async()=>(await E.sends()).length>0,8000); const s=await E.sends();
  return {pass:can&&kept===R1L&&sent&&s.length===1&&sentTo(s[0])===R1&&(await reqs(E,'A','eth_sendTransaction'))===2, ev:{cancelled:can,boxKept:kept,sends:s.map(sentTo)}}; },OWED);

T('a5w7','the recipient refuses ETH (withdrawTo reverts): shown as failed (reverted), never "Nothing was sent" or confirmed; the button and box stay; another address then goes through',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); const c=E.chain; c.rc=h=>c.mkRc(h,{status:'0x0'}); await wOpen(E); await wReview(E,R1L); await wSheet(E); const n=(await E.toasts()).length; await pressSend(E);
  const rev=await E.until(async()=>/Failed on Ethereum \(reverted\)/.test(await wNote(E)),12000); const t=await toastsSince(E,n);
  const still={button:await shown(E),box:await E.page.evaluate(()=>!document.getElementById('wtoBox').hidden)};
  c.rc=h=>c.mkRc(h); await wReview(E,R2L()); await wSheet(E); await pressSend(E);
  const conf=await E.until(async()=>(await toastsSince(E,n)).some(x=>/Withdrawing to another address: confirmed/.test(x)),12000); const s=await E.sends();
  return {pass:rev&&!t.some(x=>NOTSENT.test(x)||/confirmed/.test(x))&&t.some(x=>/reverted/.test(x))&&still.button&&still.box&&conf&&s.length===2&&sentTo(s[1])===R2, ev:{revertedNote:rev,toasts:t,still,secondConfirmed:conf,sends:s.map(sentTo)}}; },OWED);

T('a5w8','the button appears only while owed > 0: hidden at owed 0; shown once owed is read > 0; hidden again on DISCONNECT and on another account until read for it',{wallets:[one('A')],ethereum:'A'},async E=>{
  const c=E.chain; c.values.owed=0n; await connect(E); await E.until(()=>E.page.evaluate(()=>!document.getElementById('nx-mine').hidden),6000); const atZero=await shown(E);
  c.values.owed=ethers.parseEther('0.05'); await E.page.evaluate(()=>refreshSeats()); const atOwed=await E.until(()=>shown(E),5000);
  await wOpen(E); await E.page.fill('#wtoAddr',R1L);
  c.values.owed=0n; await E.P('A').emit('accountsChanged',[A2]); await E.until(async()=>/00bb/i.test(await E.label()),5000); await E.until(async()=>!(await shown(E))&&await E.page.evaluate(()=>document.getElementById('wtoBox').hidden),5000);   /* gate (audit 5b fix; was sleep(800)) */
  const other={button:await shown(E),box:await E.page.evaluate(()=>({hidden:document.getElementById('wtoBox').hidden,value:document.getElementById('wtoAddr').value}))};
  c.values.owed=ethers.parseEther('0.05'); await E.page.evaluate(()=>refreshSeats()); const back=await E.until(()=>shown(E),5000);
  await disconnectUI(E); await E.until(async()=>!(await shown(E)),5000); const afterDisc=await shown(E);   /* gate (audit 5b fix; was sleep(300)) */
  return {pass:!atZero&&atOwed&&!other.button&&other.box.hidden&&other.box.value===''&&back&&!afterDisc, ev:{atZero,atOwed,otherAccount:other,back,afterDisconnect:afterDisc}}; });

/* a5x3: the earnings copy says what the contract does: it TRIES to send in the same transaction; a wallet that cannot accept ETH keeps the
   amount recoverable (WITHDRAW, or WITHDRAW TO ANOTHER ADDRESS). The old absolute "is sent to you automatically" / "sends you" are gone. */
T('a5x3','the earnings copy (manual rule, FAQ, seats note): "tries to send", recoverable by WITHDRAW or WITHDRAW TO ANOTHER ADDRESS; no unconditional "sent automatically"',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await E.until(()=>E.page.evaluate(()=>/WITHDRAW TO ANOTHER ADDRESS/.test(document.getElementById('seatsNote').textContent)),6000);
  const r=await E.page.evaluate(()=>{ const all=document.body.textContent.replace(/\s+/g,' '), note=document.getElementById('seatsNote').textContent;
    const faq=[...document.querySelectorAll('details.nx-faq')].map(d=>d.textContent).find(t=>/CLAIM MY SEAT EARNINGS BEFORE I BUY/.test(t))||'';
    return {note,faq:faq.slice(-260),faqOk:/tries to send you everything/.test(faq)&&/If your wallet cannot accept ETH, the amount stays in the contract for you: WITHDRAW, or WITHDRAW TO ANOTHER ADDRESS\./.test(faq),rule:/first tries to send you everything/.test(all)&&/If your wallet cannot accept ETH, nothing is lost: the amount stays in the contract, owed to your wallet, and WITHDRAW appears \(or WITHDRAW TO ANOTHER ADDRESS/.test(all),
      old:/it is sent to you automatically|the contract first sends you everything|the contract sends you everything your seats/.test(all+note)}; });
  return {pass:r.rule&&!r.old&&r.faqOk&&/the contract tries to send it to you/.test(r.note)&&/WITHDRAW TO ANOTHER ADDRESS if this wallet cannot accept ETH/.test(r.note), ev:r}; },{chain:c=>{ c.values.owed=ethers.parseEther('0.01'); }});

module.exports={};
