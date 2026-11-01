/* THE AUDIT-3 REGRESSION CASES (audit/wallet-3-fix). Loaded by wallet.test.js after audit2.test.js; select them with CASES=@audit3.
   Same mocks, same fake chain: nothing real is touched.
   x  Finding A: a late explanation (who bought first, why it failed, the seats) from an old COLLECT never writes into a dialog,
      option, day or newer operation it does not belong to; the transaction's own toasts still report.
   y  Finding B: following a transaction whose nonce is spent: bounded scan batches, the cursor never skips a block it has not
      read, the original receipt is asked between batches, replacements found across batches, deadlines kept. */
const H=require('./wallet.test.js');
const {T,connect,popText,closeWit,openWit,sleep,DONE,A1,A2,ETH}=H;
const one=(...a)=>H.one(...a);
const ZERO='0x0000000000000000000000000000000000000000', BUYER='0x19A84bF7b5DA2C290CB0Ca42bf691dd6C2308359';
const E_=v=>BigInt(Math.round(v*1e6))*10n**12n;
const NOTSENT=/Nothing was sent/i;

/* helpers (the same moves as audit2.test.js) */
const track=(E,o)=>E.page.evaluate(o=>{ if(typeof TRACK!=='undefined') Object.assign(TRACK,o); },o);
const toastsSince=async(E,n)=>(await E.toasts()).slice(n);
async function openOpt(E,k){ await closeWit(E.page); await E.page.evaluate(k=>{ if(!NX.pop) document.getElementById('bPick').click(); document.querySelectorAll('#candGrid .card')[k].click(); },k); await E.page.waitForSelector('#ccBuy'); }
const pressCollect=E=>E.page.evaluate(()=>document.getElementById('ccBuy').click());
const ccK=E=>E.page.evaluate(()=>typeof CC!=='undefined'&&CC?CC.k:null);
const ccDay=E=>E.page.evaluate(()=>typeof CC!=='undefined'&&CC?CC.day:null);
const popOn=E=>E.page.evaluate(()=>!!(typeof NX!=='undefined'&&NX.pop));
const fillWit=async(E,amt)=>{ await closeWit(E.page); await openWit(E.page); await E.page.fill('#wAmt',amt); };
function toDay14(c){ const open=Math.floor(Date.now()/1000)-60, close=open+86400, old=c.plate;
  c.values.today=14; c.values.lastId=13; c.values.onSale=[14n,E_(1.6),BigInt(close),true];
  c.plate=id=>id===14?[777777,open,close,0n,0n,ZERO,0,false]:id===13?[396693683,open-86400,open,E_(0.7),E_(0.05),BUYER,3,true]:old(id); }
const closeX=E=>E.page.evaluate(()=>document.getElementById('ccX').click());   /* the dialog's × (works in every state; Escape is ignored while PENDING) */
const tickNow=E=>E.page.evaluate(()=>tick(true));
const HASH=n=>'0x'+n.toString(16).padStart(64,'0');   /* the mock wallet's n-th transaction hash */

/* THE LOOKUP GATE. Holds the ANSWER of one read `storm.<fn>(...)` made from inside a page function whose name matches `who`
   (read from the call stack): the request goes out at once, as it would, and its answer is handed back only when the test
   releases it, i.e. a slow reader. Only the first matching read is held; every other read passes untouched. */
const holdLookup=(E,fn,who,v='storm')=>E.page.evaluate(([fn,who,v])=>{ const real=eval(v), re=new RegExp(who); const G=window.__LK={n:0,done:0,release:null};   /* v: the page's contract variable (storm, giftC) */
  const PX=new Proxy(real,{get(t,p){ const v=Reflect.get(t,p); if(p!==fn||typeof v!=='function') return v;
    return (...a)=>{ const p0=t[fn](...a); if(G.n||!re.test(new Error().stack||'')) return p0;
      G.n++; const gate=new Promise(r=>{ G.release=r; }); G.stack=(new Error().stack||'').split('\n').slice(1,5).map(x=>x.trim()).join(' | '); return gate.then(()=>p0).then(v=>{ G.got=String(v); return v; },e=>{ G.err=String(e&&e.message||e).slice(0,120); throw e; }).finally(()=>{ G.done++; }); }; }}); eval(v+'=PX'); },[fn,who,v]);
const lkHeld=E=>E.until(()=>E.page.evaluate(()=>!!(window.__LK&&window.__LK.n===1)),10000);
const lkRelease=async E=>{ await E.page.evaluate(()=>window.__LK.release()); const d=await E.until(()=>E.page.evaluate(()=>window.__LK.done===1),5000); await sleep(800); return d; };
const viewOf=E=>E.page.evaluate(()=>({k:typeof CC!=='undefined'&&CC?CC.k:null,day:typeof CC!=='undefined'&&CC?CC.day:null,tx:NX.tx,acts:(document.getElementById('ccActs')||{}).textContent||''}));

/* ═══ x: FINDING A, the late explanation ═══ */
T('x1','reverted COLLECT: its late "who bought first" lookup does not write into another option opened meanwhile; the reverted toast stands',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); E.chain.rc=h=>E.chain.mkRc(h,{status:'0x0'}); await holdLookup(E,'onSale','soldTo');
  const n=(await E.toasts()).length; await openOpt(E,3); await pressCollect(E);
  const held=await lkHeld(E); const rev=await E.until(async()=>(await toastsSince(E,n)).some(x=>/reverted/i.test(x)),8000);
  await closeX(E); await sleep(300); const closed=!(await popOn(E)); await openOpt(E,5); await sleep(300);
  const before=await viewOf(E); const rel=await lkRelease(E); const after=await viewOf(E), t=await toastsSince(E,n);
  const revN=t.filter(x=>/reverted/i.test(x)).length;
  return {pass:held&&rel&&rev&&closed&&after.k===5&&after.tx===null&&after.acts===before.acts&&/COLLECT/.test(after.acts)&&!/NOT COLLECTED|PENDING|IS YOURS/.test(after.acts)&&revN===1&&!t.some(x=>DONE.test(x)||NOTSENT.test(x)),
    ev:{held,released:rel,revertedToast:rev,closed,before:before.acts.slice(0,60),after:{k:after.k,tx:after.tx,acts:after.acts.slice(0,80)},toasts:t}}; });

T('x2','COLLECT fails before the hand-off: its late reason lookup does not write into another option opened meanwhile; the error toast stands',
  {wallets:[one('A',undefined,{reject:{eth_estimateGas:{code:-32000,message:'execution reverted'}}})],ethereum:'A'},async E=>{
  await connect(E); await holdLookup(E,'onSale','failReason');
  const n=(await E.toasts()).length; await openOpt(E,3); await pressCollect(E);
  const held=await lkHeld(E); await sleep(300); const t0=await toastsSince(E,n);
  await closeX(E); await sleep(300); const closed=!(await popOn(E)); await openOpt(E,5); await sleep(300);
  const before=await viewOf(E); const rel=await lkRelease(E); const after=await viewOf(E), t=await toastsSince(E,n), s=await E.sends();
  return {pass:held&&rel&&closed&&s.length===0&&after.k===5&&after.tx===null&&after.acts===before.acts&&/COLLECT/.test(after.acts)&&!/NOT COLLECTED/.test(after.acts)&&t0.length>=2&&!t.some(x=>DONE.test(x)),
    ev:{held,released:rel,closed,sends:s.length,before:before.acts.slice(0,60),after:{k:after.k,tx:after.tx,acts:after.acts.slice(0,80)},toasts:t}}; });

T('x3','reverted COLLECT on day 13: the late lookup does not write into a day 14 dialog opened after the day changed',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); E.chain.rc=h=>E.chain.mkRc(h,{status:'0x0'}); await holdLookup(E,'onSale','soldTo');
  const n=(await E.toasts()).length; await openOpt(E,3); await pressCollect(E);
  const held=await lkHeld(E); const rev=await E.until(async()=>(await toastsSince(E,n)).some(x=>/reverted/i.test(x)),8000);
  await closeX(E); await sleep(200);
  toDay14(E.chain); await tickNow(E); await sleep(400); const day=await E.page.evaluate(()=>ST.day.id);
  await openOpt(E,2); await sleep(300); const before=await viewOf(E);
  const rel=await lkRelease(E); const after=await viewOf(E), t=await toastsSince(E,n);
  return {pass:held&&rel&&rev&&day===14&&after.day===14&&after.k===2&&after.tx===null&&after.acts===before.acts&&!/NOT COLLECTED/.test(after.acts)&&t.filter(x=>/reverted/i.test(x)).length===1,
    ev:{held,released:rel,dayOnScreen:day,before:{day:before.day,acts:before.acts.slice(0,60)},after:{day:after.day,k:after.k,tx:after.tx,acts:after.acts.slice(0,80)},toasts:t}}; });

T('x4','same dialog, same option: BACK and COLLECT again while the first press\'s reason lookup is slow: the newer operation\'s view is not overwritten, and it completes in its own view',
  {wallets:[one('A',undefined,{reject:{eth_estimateGas:{code:-32000,message:'execution reverted'}}})],ethereum:'A'},async E=>{
  await connect(E); await holdLookup(E,'onSale','failReason');
  const n=(await E.toasts()).length; await openOpt(E,3); const cc0=await E.page.evaluate(()=>{ window.__cc0=CC; return true; }); await pressCollect(E);
  const held=await lkHeld(E); await sleep(300);
  const back=await E.page.evaluate(()=>{ const b=document.getElementById('nx-txBack'); if(!b) return false; b.click(); return true; }); await sleep(200);
  await E.P('A').set({reject:{},gate:{eth_sendTransaction:true}}); await pressCollect(E); const g=await E.waitGate('A','eth_sendTransaction',6000);
  const before=await viewOf(E), same=await E.page.evaluate(()=>CC===window.__cc0);
  const rel=await lkRelease(E); const after=await viewOf(E);
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_sendTransaction');
  const done=await E.until(async()=>/IS YOURS/.test(await popText(E.page)),12000); const fin=await viewOf(E), s=await E.sends();
  return {pass:cc0&&held&&back&&g&&same&&rel&&before.tx==='confirm'&&after.tx==='confirm'&&after.acts===before.acts&&!/NOT COLLECTED/.test(after.acts)&&done&&fin.k===3&&s.length===1,
    ev:{held,back,gateHit:g,sameDialog:same,released:rel,before:{tx:before.tx,acts:before.acts.slice(0,70)},after:{tx:after.tx,acts:after.acts.slice(0,80)},done,final:fin.acts.slice(0,40),sends:s.length,toasts:(await toastsSince(E,n)).slice(-4)}}; });

T('x5','the seats lookup of a finished COLLECT answers late: it does not overwrite the seats shown by a newer COLLECT\'s result',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); E.chain.values.seats=E_(3); await holdLookup(E,'seats','txView');
  await openOpt(E,3); await pressCollect(E); const d1=await E.until(async()=>/IS YOURS/.test(await popText(E.page)),12000); const held=await lkHeld(E);
  await E.page.evaluate(()=>document.getElementById('nx-txClose').click()); await sleep(300); const closed=!(await popOn(E));
  E.chain.values.seats=E_(4); await openOpt(E,3); await pressCollect(E);
  const d2=await E.until(async()=>/IS YOURS/.test(await popText(E.page))&&/4\.0000/.test(await E.page.evaluate(()=>(document.getElementById('nx-txSeats')||{}).textContent||'')),12000);
  const before=await E.page.evaluate(()=>document.getElementById('nx-txSeats').textContent);
  const rel=await lkRelease(E); const after=await E.page.evaluate(()=>(document.getElementById('nx-txSeats')||{}).textContent||null), s=await E.sends();
  return {pass:d1&&held&&closed&&d2&&rel&&before==='4.0000'&&after==='4.0000'&&s.length===2, ev:{done1:d1,held,closed,done2:d2,released:rel,before,after,sends:s.length}}; });

T('x6','two seat refreshes for the same account cross: the older answer arriving last does not overwrite the newer one',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await sleep(1500); E.chain.values.seats=E_(3); await holdLookup(E,'seats','refreshSeats');
  const c0=E.chain.calls.filter(x=>x==='seats').length; await E.page.evaluate(()=>{ refreshSeats().catch(()=>{}); }); const held=await lkHeld(E);
  const asked=await E.until(async()=>E.chain.calls.filter(x=>x==='seats').length>c0,5000); E.chain.values.seats=E_(4);   /* the held read has reached the chain (answer: 3) */ await E.page.evaluate(()=>refreshSeats());
  const before=await E.page.evaluate(()=>document.getElementById('nx-mySeats').textContent);
  const rel=await lkRelease(E); const after=await E.page.evaluate(()=>document.getElementById('nx-mySeats').textContent);
  const lk=await E.page.evaluate(()=>({stack:__LK.stack,got:__LK.got,err:__LK.err}));
  return {pass:held&&asked&&rel&&before==='4.0000'&&after==='4.0000', ev:{held,asked,released:rel,before,after,lk}}; });

T('x7','the SMALL WEATHER welcome: the first account\'s gift image answers late, after the wallet moved to a second holder: the second account\'s image stays',{wallets:[one('A')],ethereum:'A'},async E=>{
  const c=E.chain; c.values.giftOf=5n; c.values.isClaimed=true; c.values.ownerOf=A1; c.values.gif='0x4749463839610101';
  await E.page.evaluate(()=>giftRead()); await holdLookup(E,'gif','welcome','giftC');
  await connect(E); const held=await lkHeld(E); const asked=await E.until(async()=>c.calls.filter(x=>x==='gif').length>0,5000);
  c.values.ownerOf=A2; c.values.gif='0x474946383961020202';
  await E.P('A').set({accounts:[A2,A1]}); await E.P('A').emit('accountsChanged',[A2]);
  const second=await E.until(()=>E.page.evaluate(A=>!!(typeof me==='string'&&me.toLowerCase()===A&&document.getElementById('swImg')&&/^blob:/.test(document.getElementById('swImg').src)),A2),8000);
  const before=await E.page.evaluate(()=>document.getElementById('swImg').src);
  const rel=await lkRelease(E); const after=await E.page.evaluate(()=>{ const i=document.getElementById('swImg'); return i?i.src:null; });
  return {pass:held&&asked&&second&&rel&&!!before&&after===before, ev:{held,asked,secondShown:second,released:rel,changed:after!==before}}; });

/* ═══ y: FINDING B, the replacement scan ═══
   A witness payment (nonce 7) is pending; then the chain head jumps GAP blocks and the nonce is spent. The head is pinned by the test
   (S.topAns) so the block the tracker starts from (op.block, read when it sent) is known: B. What spent the nonce sits in block B+at.
   Read from S.log: the full-block requests between two receipt requests for the original hash (one batch), the order blocks are read. */
const READERS=/(publicnode\.com|mevblocker\.io|drpc\.org|blastapi\.io)/;
async function spent(E,o){ const c=E.chain, scan=o.scan||5; let TOP=c.blockNo(); const B=TOP; c.topAns=()=>o.top?o.top(TOP,B):'0x'+TOP.toString(16);
  await connect(E); await track(E,Object.assign({poll:300,scan},o.track||{})); await E.P('A').set({txNonce:'0x7'});
  c.tx=h=>c.mkTx(h,{nonce:'0x7',blockHash:null,blockNumber:null,transactionIndex:null}); c.rc=()=>null; c.nonceLatest=7;
  if(o.delay) await E.page.route(READERS,async route=>{ const b=route.request().postData()||''; if(/eth_getBlockByNumber/.test(b)&&/,true\]/.test(b)) await sleep(o.delay); return route.fallback(); });
  await fillWit(E,'0.01'); const n=(await E.toasts()).length; const tSend=Date.now(); await E.page.click('#bWit');
  const sent=await E.until(async()=>(await E.sends()).length>0,8000); const s=(await E.sends())[0], q=s.params[0], hash=s.hash;
  const nonceRead=await E.until(async()=>c.log.some(x=>x.m==='eth_getTransactionCount'),8000); await sleep(300);
  const H2='0x'+'ab'.repeat(32), R=B+(o.at==null?-1:o.at);
  const rtx=o.kind==='repriced'?{to:q.to,input:q.data,value:q.value}:o.kind==='cancelled'?{to:q.from,input:'0x',value:'0x0'}:{to:'0x000000000000000000000000000000000000dEaD',input:'0xdeadbeef',value:'0x0'};
  const tx2=c.mkTx(H2,Object.assign({from:q.from,nonce:'0x7',blockNumber:'0x'+R.toString(16),gasPrice:'0x77359400',maxFeePerGas:'0x77359400'},rtx));
  const rc2=c.mkRc(H2,{from:q.from,to:rtx.to,blockNumber:'0x'+R.toString(16),status:'0x1'});
  if(o.at!=null){ c.blockTxs=b=>b===R?[tx2]:[]; c.rc=h=>h===H2?(o.rc2?o.rc2(rc2):rc2):null; }
  if(o.blockAns) c.blockAns=b=>o.blockAns(b,R);
  const tJump=Date.now(), iJump=c.log.length; TOP=B+o.gap; c.nonceLatest=8;
  const X={c,B,R,H2,hash,n,tSend,tJump,iJump,sent,nonceRead,scan};
  X.blocks=()=>c.log.slice(iJump).filter(x=>x.m==='eth_getBlockByNumber'&&Array.isArray(x.p)&&x.p[1]===true&&x.p[0]!=='latest');
  X.batches=()=>{ let cur=new Set(), max=0, nb=0; for(const x of c.log.slice(iJump)){
      if(x.m==='eth_getTransactionReceipt'&&x.p&&x.p[0]===hash){ if(cur.size) nb++; cur=new Set(); }
      else if(x.m==='eth_getBlockByNumber'&&x.p&&x.p[1]===true&&x.p[0]!=='latest'){ cur.add(Number(x.p[0])); max=Math.max(max,cur.size); } }
    return {max,batches:nb+(cur.size?1:0)}; };
  /* the blocks in the order first read: B, B+1, ... with no gap and none read twice out of order */
  X.order=()=>{ const seen=[]; for(const x of X.blocks()){ const b=Number(x.p[0]); if(!seen.includes(b)) seen.push(b); } let ok=seen.length>0&&seen[0]===B; for(let i=1;i<seen.length;i++) ok=ok&&seen[i]===seen[i-1]+1; return {ok,first:seen[0]-B,last:seen[seen.length-1]-B,n:seen.length}; };
  X.toasts=()=>toastsSince(E,n);
  X.setTop=v=>{ TOP=v; };
  return X; }
const want={repriced:/confirmed \(sped up/i,cancelled:/cancelled in your wallet/i,replaced:/replaced it with another/i};
const classCase=(kind,gap,at)=>async E=>{ const X=await spent(E,{kind,gap,at});
  const got=await E.until(async()=>(await X.toasts()).some(x=>want[kind].test(x)),25000); await sleep(500);
  const t=await X.toasts(), b=X.batches(), ord=X.order(), past=X.blocks().filter(x=>Number(x.p[0])>X.R).length;
  const wrong=t.some(x=>NOTSENT.test(x)||/cannot confirm/i.test(x)||(kind!=='repriced'&&DONE.test(x)));
  return {pass:X.sent&&X.nonceRead&&got&&!wrong&&b.max<=X.scan&&b.batches>=Math.ceil((at+1)/X.scan)&&ord.ok&&ord.last===at&&past===0,
    ev:{kind,gap,at,scan:X.scan,got,maxBlocksPerBatch:b.max,batches:b.batches,order:ord,readPastIt:past,toasts:t}}; };
T('y1','nonce spent 60 blocks later, replaced in block +37: batches of at most TRACK.scan blocks, the original receipt asked between them, every block read in order; says replaced',{wallets:[one('A')],ethereum:'A'},classCase('replaced',60,37));
T('y2','sped up (same sender, nonce, to, data, value) in block +7, past the first batch: counted as confirmed (sped up), batches bounded',{wallets:[one('A')],ethereum:'A'},classCase('repriced',20,7));
T('y3','cancelled (0 ETH to self) in block +13, in the third batch: says cancelled, never confirmed, batches bounded',{wallets:[one('A')],ethereum:'A'},classCase('cancelled',20,13));

const retryCase=(what)=>async E=>{ let k=0;
  const o={kind:'replaced',gap:20,at:8};
  if(what==='null') o.blockAns=(b,R)=>b===R&&k++<3?'null':undefined;          /* the reader has not got block R yet: answers null three times */
  if(what==='error') o.blockAns=(b,R)=>b===R&&k++<6?'error':undefined;        /* block R fails on every reader, twice over */
  if(what==='receipt') o.rc2=rc=>k++<3?null:rc;                                /* the replacement's receipt lags behind its block */
  const X=await spent(E,o);
  const got=await E.until(async()=>(await X.toasts()).some(x=>want.replaced.test(x)),25000); await sleep(500);
  const t=await X.toasts(), b=X.batches(), ord=X.order(), past=X.blocks().filter(x=>Number(x.p[0])>X.R).length, asksR=X.blocks().filter(x=>Number(x.p[0])===X.R).length;
  return {pass:X.sent&&X.nonceRead&&got&&k>=(what==='error'?6:3)&&past===0&&ord.ok&&b.max<=X.scan&&!t.some(x=>NOTSENT.test(x)||DONE.test(x)),
    ev:{what,got,missesServed:k,blockRRequests:asksR,readPastIt:past,order:ord,maxBlocksPerBatch:b.max,toasts:t}}; };
T('y4','block +8 (holding the replacement) is answered null three times: the cursor stays on it, reads it again, finds the replacement, never reads past it',{wallets:[one('A')],ethereum:'A'},retryCase('null'));
T('y5','block +8 fails on every reader (RPC error) twice: retried, not skipped; the replacement is found',{wallets:[one('A')],ethereum:'A'},retryCase('error'));
T('y6','the replacement is in block +8 but its receipt lags (null three times): the block is read again until the receipt comes; says replaced',{wallets:[one('A')],ethereum:'A'},retryCase('receipt'));

T('y10','the first reader never has block +8 (answers null for it, forever); the other readers have it: the scan moves to them and finds the replacement, never reading past it',{wallets:[one('A')],ethereum:'A'},async E=>{
  let k=0, R=null;   /* set right after the jump (no await in between), before any scan request is answered */
  await E.page.route(/publicnode\.com/,async route=>{ const b=route.request().postData()||''; let q=null; try{ q=JSON.parse(b); }catch(e){}
    if(q&&!Array.isArray(q)&&q.method==='eth_getBlockByNumber'&&q.params&&Number(q.params[0])===R){ k++; return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:q.id,result:null})}); }
    return route.fallback(); });
  const X=await spent(E,{kind:'replaced',gap:20,at:8}); R=X.R;
  const got=await E.until(async()=>(await X.toasts()).some(x=>want.replaced.test(x)),20000); await sleep(500);
  const t=await X.toasts(), past=X.blocks().filter(x=>Number(x.p[0])>X.R).length;
  return {pass:X.sent&&X.nonceRead&&got&&k>=1&&past===0&&X.order().ok&&!t.some(x=>NOTSENT.test(x)||DONE.test(x)), ev:{got,nullsFromFirstReader:k,readPastIt:past,order:X.order(),toasts:t}}; });
T('y7','800 blocks to look through, 25 ms each: "cannot confirm" comes at TRACK.lost (within a batch), and the tracker stops at TRACK.stop, reading no block after',{wallets:[one('A')],ethereum:'A'},async E=>{
  const LOST=2500, STOP=6000; const X=await spent(E,{gap:800,delay:25,track:{lost:LOST,stop:STOP}});
  const unk=await E.until(async()=>(await X.toasts()).some(x=>/cannot confirm/i.test(x)),30000); const tUnk=Date.now()-X.tSend;
  const wait=X.tSend+STOP+3500-Date.now(); if(wait>0) await sleep(wait);
  const late=X.blocks().filter(x=>x.t>X.tSend+STOP+1500).length, b=X.batches();
  return {pass:X.sent&&X.nonceRead&&unk&&tUnk<=LOST+2500&&late===0&&b.max<=X.scan, ev:{unknownAfterMs:tUnk,limitMs:LOST+2500,blocksReadAfterStop:late,maxBlocksPerBatch:b.max,blocksRead:X.blocks().length}}; });

T('y8','the original\'s own receipt appears while 400 blocks remain to be read: confirmed within a batch, not after the whole scan',{wallets:[one('A')],ethereum:'A'},async E=>{
  const X=await spent(E,{gap:400,delay:25}); await sleep(600);
  const tRel=Date.now(); X.c.rc=h=>h===X.hash?X.c.mkRc(h,{status:'0x1'}):null;
  const conf=await E.until(async()=>(await X.toasts()).some(x=>DONE.test(x)),20000); const ms=Date.now()-tRel;
  return {pass:X.sent&&X.nonceRead&&conf&&ms<=2500, ev:{confirmed:conf,msAfterReceipt:ms,limitMs:2500,blocksRead:X.blocks().length,maxBlocksPerBatch:X.batches().max}}; });

T('y9','a reader whose head is missing (null) or behind the send block: no premature "cannot confirm"; once the head is real the replacement is found',{wallets:[one('A')],ethereum:'A'},async E=>{
  let phase='real'; const X=await spent(E,{kind:'replaced',gap:12,at:3,top:(TOP,B)=>phase==='null'?null:phase==='behind'?'0x'+(B-5).toString(16):'0x'+TOP.toString(16)}); phase='null';   /* no await between the jump and this */
  await sleep(1500); const t1=await X.toasts(); phase='behind'; await sleep(1500); const t2=await X.toasts(); phase='real';
  const got=await E.until(async()=>(await X.toasts()).some(x=>want.replaced.test(x)),15000); const t=await X.toasts();
  return {pass:X.sent&&X.nonceRead&&got&&!t.some(x=>/cannot confirm/i.test(x))&&X.order().ok, ev:{got,unknownWhileNull:t1.some(x=>/cannot confirm/i.test(x)),unknownWhileBehind:t2.some(x=>/cannot confirm/i.test(x)),order:X.order(),toasts:t}}; });

/* ═══ z: further lifecycle cases ═══ */
const reqsOf=(E,id,m)=>E.page.evaluate(([id,m])=>__MW.log.filter(x=>x.pid===id&&x.method===m).length,[id,m]);
T('z1','wrong chain, switch refused, WITNESS: the operation stops at the chain check (no gas estimate, no last look, no send) and says the wallet is on another network',
  {wallets:[one('A','0x2105',{switchReject:{code:4001}})],ethereum:'A'},async E=>{
  await connect(E); const n=(await E.toasts()).length, sw0=await reqsOf(E,'A','wallet_switchEthereumChain'), ac0=await reqsOf(E,'A','eth_accounts');
  await fillWit(E,'0.01'); await E.page.click('#bWit');
  const said=await E.until(async()=>(await toastsSince(E,n)).some(x=>/on another network/i.test(x)),8000); await sleep(1500);
  const t=await toastsSince(E,n), sw=(await reqsOf(E,'A','wallet_switchEthereumChain'))-sw0, est=await reqsOf(E,'A','eth_estimateGas'), snd=await reqsOf(E,'A','eth_sendTransaction'), acc=(await reqsOf(E,'A','eth_accounts'))-ac0;
  const last=t[t.length-1]||'';
  return {pass:said&&sw===1&&est===0&&snd===0&&acc===0&&/^Your wallet is on another network\. Switch it to Ethereum mainnet\. Nothing was sent\.$/.test(last)&&!t.some(x=>/moved to another network|network changed/i.test(x)||/^Cancelled in your wallet/.test(x)),
    ev:{switchAsked:sw,estimateGas:est,sendTransaction:snd,lastLookAccounts:acc,toasts:t}}; });
T('z2','wrong chain: the switch is refused in the wallet (4001) from COLLECT\'s SWITCH button and from the header bar: says it is still on another network, never "Cancelled in your wallet"',
  {wallets:[one('A','0x2105',{switchReject:{code:4001}})],ethereum:'A'},async E=>{
  await connect(E); await openOpt(E,3); await pressCollect(E); const wrong=await E.until(async()=>/ANOTHER NETWORK/.test(await popText(E.page)),8000);
  const n=(await E.toasts()).length; await E.page.click('#nx-switch'); const s1=await E.until(async()=>(await toastsSince(E,n)).length>0,6000); await sleep(800);
  const t1=await toastsSince(E,n), view=await popText(E.page);
  await closeX(E); await sleep(200); const m=(await E.toasts()).length; await E.page.evaluate(()=>document.getElementById('nx-chainBar').click());
  const s2=await E.until(async()=>(await toastsSince(E,m)).length>0,6000); await sleep(800); const t2=await toastsSince(E,m), s=await E.sends();
  const ok=t=>t.length>0&&!t.some(x=>/^Cancelled in your wallet/.test(x))&&/still on another network/i.test(t[t.length-1]);
  return {pass:wrong&&s1&&s2&&ok(t1)&&ok(t2)&&/ANOTHER NETWORK/.test(view)&&s.length===0, ev:{wrongView:wrong,fromCollect:t1,fromHeader:t2,view:view.slice(0,60),sends:s.length}}; });
T('z3','COLLECT\'s SWITCH TO ETHEREUM is answered after the dialog moved to another option: the switch does not start a COLLECT there (nothing asked, nothing sent)',
  {wallets:[one('A','0x2105')],ethereum:'A'},async E=>{
  await connect(E); await openOpt(E,3); await pressCollect(E); const wrong=await E.until(async()=>/ANOTHER NETWORK/.test(await popText(E.page)),8000);
  await E.P('A').set({gate:{wallet_switchEthereumChain:true}}); await E.page.click('#nx-switch'); const g=await E.waitGate('A','wallet_switchEthereumChain',5000);
  await closeX(E); await sleep(200); await openOpt(E,5); await sleep(200); const before=await viewOf(E);
  await E.P('A').set({gate:{}}); await E.P('A').release('wallet_switchEthereumChain');
  /* barrier (audit 5): the switch has been answered and the page has seen mainnet (chainChanged handled, no [!] in the header) with no
     write in progress; then a settle window for anything the late answer could start */
  const settled=await E.until(async()=>(await E.P('A').answered('wallet_switchEthereumChain'))>=1&&!/\[!\]/.test(await E.label())&&await E.page.evaluate(()=>OPLOCK===null),8000); await sleep(1500);
  const after=await viewOf(E), s=await E.sends(), est=await reqsOf(E,'A','eth_estimateGas'), rq=await reqsOf(E,'A','eth_sendTransaction');
  return {pass:wrong&&g&&settled&&after.k===5&&after.tx===null&&after.acts===before.acts&&s.length===0&&rq===0&&est===0&&/COLLECT/.test(after.acts),
    ev:{wrongView:wrong,gateHit:g,after:{k:after.k,tx:after.tx,acts:after.acts.slice(0,70)},sends:s.length,sendRequests:rq,estimateGas:est,toasts:(await E.toasts()).slice(-3)}}; });
T('z4','COLLECT on the wrong chain, SWITCH TO ETHEREUM accepted in the same dialog: the COLLECT goes on there (one send, the chosen option, on chain 1)',
  {wallets:[one('A','0x2105')],ethereum:'A'},async E=>{
  await connect(E); await openOpt(E,3); await pressCollect(E); const wrong=await E.until(async()=>/ANOTHER NETWORK/.test(await popText(E.page)),8000);
  await E.page.click('#nx-switch'); const done=await E.until(async()=>/IS YOURS/.test(await popText(E.page)),12000);
  const s=await E.sends(), arg=s[0]&&await E.page.evaluate(d=>{ try{ return String(new ethers.Interface(['function buy(uint256,uint8) payable']).parseTransaction({data:d}).args[1]); }catch(e){ return null; } },s[0].params[0].data);
  return {pass:wrong&&done&&s.length===1&&s[0].chain==='0x1'&&arg==='3', ev:{wrongView:wrong,done,sends:s.map(x=>x.chain),option:arg,popup:(await popText(E.page)).slice(0,40)}}; });
