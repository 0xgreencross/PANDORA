/* ═══ STORMGLASS STAGING RUNTIME — exists ONLY in test-wallet.html (inlined by tools/stormglass/staging/build.js); never in index.html.
   It runs before every page script. Two modes, chosen per tab (sessionStorage 'sg.staging.mode' or ?sgmode=sim|real), default SIMULATION:
   SIMULATION  simulated EIP-1193 wallets announced over EIP-6963 (and window.ethereum / providers[] / a simulated WalletConnect, per
               preset); real wallets are invisible; every JSON-RPC request the page makes over HTTP is answered by a simulated chain
               inside this page (no request leaves the page for Ethereum); the page's own discovery, connect, OpSigner, send() and
               trackTx run unchanged against them.
   REAL WALLET the visitor's real wallets (EIP-6963, window.ethereum, providers[], WalletConnect) — each wrapped before the page gets it.
               A wrapper forwards only the allowlist (policy.js FORWARD), asks the visitor before eth_requestAccounts and chain
               switches, and never forwards a transaction or a signature: those stop at the wrapper (the intercept panel), and the
               visitor picks a simulated result that the simulated chain then reports to the page's tracking code.
   The page reaches providers only through three taps the build writes into it: __SG.eth() for every window.ethereum read,
   __SG.detail() for the EIP-6963 announcement, __SG.wcNS() for the WalletConnect namespace. Plus window.fetch (JSON-RPC answered
   in-page; writes refused). */
(function(){
'use strict';
const STAMP=/*@@STAMP@@*/{rev:'dev',sha256:'dev',src:'dev',touched:'dev'};
/*@@POLICY@@*/
const FORWARD=new Set(Object.keys(POLICY.FORWARD)), LOCAL=new Set(Object.keys(POLICY.LOCAL)), TXM=new Set(POLICY.TX), SIGNM=new Set(POLICY.SIGN);
const GATED=new Set(['eth_requestAccounts','wallet_switchEthereumChain']);
const ssGet=k=>{ try{ return sessionStorage.getItem(k); }catch(e){ return null; } };
const ssSet=(k,v)=>{ try{ if(v==null) sessionStorage.removeItem(k); else sessionStorage.setItem(k,v); }catch(e){} };
const MODE_KEY='sg.staging.mode', CONF_KEY='sg.staging.sim', SIMLS='sgsim:';
const QS=new URLSearchParams(location.search);
let MODE=QS.get('sgmode'); if(MODE!=='sim'&&MODE!=='real') MODE=ssGet(MODE_KEY); if(MODE!=='real') MODE='sim'; ssSet(MODE_KEY,MODE);
const REAL=MODE==='real';
const isPhoneUA=()=>/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&/Macintosh/.test(navigator.userAgent));
let CONF={}; try{ CONF=JSON.parse(ssGet(CONF_KEY)||'{}')||{}; }catch(e){ CONF={}; }
const PRESETS={
  desk3:'DESKTOP · 4 EXTENSIONS (two share a name, one on Base, one asleep)',
  desk1:'DESKTOP · ONE EXTENSION',
  legacy:'DESKTOP · OLD STYLE: window.ethereum + providers[] only',
  none:'DESKTOP · NO WALLET',
  inapp:'PHONE · INSIDE A WALLET APP (window.ethereum)',
  wc:'PHONE · WALLETCONNECT (simulated phone wallet)'
};
if(!PRESETS[CONF.preset]) CONF.preset=isPhoneUA()?'wc':'desk3';
const SET=Object.assign({auto:'ask',mine:2500,readerMs:120,firstReaderDown:false,receipts:'valid',clock:'normal',wcEvent:'exact'},CONF.set||{});
const saveConf=()=>ssSet(CONF_KEY,JSON.stringify({preset:CONF.preset,set:SET}));

/* ── the log every wallet request goes through (shown under CONTROLS · LOG; read by the tests) */
const LOG=[]; let logTick=()=>{};
const brief=v=>{ try{ const s=typeof v==='string'?v:JSON.stringify(v,(k,x)=>typeof x==='bigint'?x.toString():x); return s==null?String(v):s.length>90?s.slice(0,88)+'…':s; }catch(e){ return String(v); } };
function logReq(who,method,params,route){ const e={t:Math.round(performance.now()),who,method,params:brief(params===undefined?null:params),route,result:''}; LOG.push(e); if(LOG.length>400) LOG.shift(); logTick(); return e; }
const err=(code,message)=>Object.assign(new Error(message),{code});

/* ── the simulated chain's storage for the page in SIMULATION: the page's localStorage is a per-tab copy (sessionStorage, prefix
   sgsim:) so a simulated wallet choice never lands in the live site's storage on the same origin. REAL mode keeps the real one
   (a real WalletConnect session must persist the way it does on the live site). */
if(!REAL){ try{
  const B=window.sessionStorage, keys=()=>{ const o=[]; for(let i=0;i<B.length;i++){ const k=B.key(i); if(k&&k.startsWith(SIMLS)) o.push(k.slice(SIMLS.length)); } return o; };
  const api={ getItem:k=>B.getItem(SIMLS+k), setItem:(k,v)=>B.setItem(SIMLS+k,String(v)), removeItem:k=>B.removeItem(SIMLS+k), clear:()=>keys().forEach(k=>B.removeItem(SIMLS+k)), key:i=>keys()[i]??null, get length(){ return keys().length; } };
  const shim=new Proxy(api,{ get:(t,p)=>p in t?t[p]:(typeof p==='string'?B.getItem(SIMLS+p)??undefined:undefined), set:(t,p,v)=>{ B.setItem(SIMLS+String(p),String(v)); return true; },
    ownKeys:()=>keys(), getOwnPropertyDescriptor:(t,p)=>{ const v=typeof p==='string'?B.getItem(SIMLS+p):null; return v==null?undefined:{value:v,enumerable:true,configurable:true,writable:true}; } });
  Object.defineProperty(window,'localStorage',{configurable:true,enumerable:true,get:()=>shim});
}catch(e){ console.warn('staging: localStorage copy unavailable',e); } }

/* ═══ THE SIMULATED CHAIN (both modes): sale state, plates, blocks, and every simulated transaction. Answers the page's HTTP readers. */
const E18=10n**18n, eth=x=>BigInt(Math.round(x*1e6))*10n**12n, hex=n=>'0x'+BigInt(n).toString(16), lc=a=>typeof a==='string'?a.toLowerCase():'';
const now=()=>Math.floor(Date.now()/1000);
const rnd32=()=>{ const b=new Uint8Array(32); crypto.getRandomValues(b); return '0x'+[...b].map(x=>x.toString(16).padStart(2,'0')).join(''); };
const SEEDS=/*@@SEEDS@@*/[396693683];
const SIM_ABI=[
  'function candleOpen() view returns (uint256)','function candleClose() view returns (uint256)','function candleSettled() view returns (bool)','function revealBlock() view returns (uint256)',
  'function zeroSeed() view returns (uint32)','function bidsCount() view returns (uint256)','function bids(uint256) view returns (address bidder,uint128 amount,uint64 at,uint32 seed)',
  'function FOUNDING() view returns (uint256)','function foundersEnd() view returns (uint256)','function today() view returns (uint256)','function lastId() view returns (uint256)','function dead() view returns (bool)','function tombId() view returns (uint256)',
  'function plates(uint256) view returns (uint32 seed,uint64 open,uint64 close,uint128 price,uint128 witnessed,address buyer,uint8 pick,bool sold)',
  'function onSale() view returns (uint256 id,uint256 price,uint256 close,bool open)','function startPrice(uint256) view returns (uint256)','function priceAt(uint256,uint256) view returns (uint256)','function referencePrice() view returns (uint256)','function median7() view returns (uint256)',
  'function candidates(uint256) view returns (uint32[32])','function picks(uint256) view returns (uint8)','function vault() view returns (uint256)','function seatPool() view returns (uint256)','function totalSeats() view returns (uint256)','function seats(address) view returns (uint256)','function pending(address) view returns (uint256)','function owed(address) view returns (uint256)',
  'function ownerOf(uint256) view returns (address)','function tokenURI(uint256) view returns (string)','function witnessesOf(uint256) view returns (uint32[])','function handsOf(uint256) view returns (uint32[])',
  'function sky(uint256) view returns (string)','function balanceOf(address) view returns (uint256)','function giftOf(address) view returns (uint256)','function isClaimed(uint256) view returns (bool)','function gifts() view returns (uint256)','function minted() view returns (uint256)','function gif(uint256) view returns (bytes)',
  'function bid() payable','function settleCandle()','function pledge() payable','function sync()','function buy(uint256,uint8) payable','function witness(uint256) payable','function claim()','function withdraw()','function withdrawTo(address)'
];
const OTHER='0x19a84bf7b5da2c290cb0ca42bf691dd6c2308359';
/* a simulated sky (the shape GLASS.sky() returns): the plate draws under it; every value is made up */
const SKY={gas:0.84,hunger:0.012,hour:15.4,moon:0.62,tide:0.48,wind:0.21,flood:0,peg:0.03,pulse:0,age:0,lamps:3,weight:0,witnesses:[]};
const CH={ t0:now(), block0:23700000, bt:4, txs:new Map(), nonce:new Map(), spent:new Map(), inBlock:new Map(), IF:null };
CH.head=()=>CH.block0+Math.floor((Date.now()/1000-CH.t0)/CH.bt);
CH.tsOf=n=>CH.t0+(n-CH.block0)*CH.bt;
const S={ today:13, lastId:12, settled:true, dead:false, FOUNDING:eth(0.42), foundersEnd:now()-86400*13, start:eth(1.68), ref:eth(0.42), vault:eth(1.2), seatPool:eth(0.31), totalSeats:eth(17),
  seats:new Map(), pending:new Map(), owed:new Map(), plates:new Map(), bids:[], sale:'open' };
const seedOf=id=>SEEDS[id%SEEDS.length]>>>0;
function plate(id){ let p=S.plates.get(id); if(!p){ const open=now()-3*3600-86400*(S.today-id); p={seed:seedOf(id),open,close:open+86400,price:id<S.today?eth(0.3+0.01*id):0n,witnessed:id===S.today?eth(0.05):0n,buyer:id<S.today?OTHER:'0x0000000000000000000000000000000000000000',pick:id%32,sold:id<S.today}; S.plates.set(id,p); } return p; }
const priceOf=D=>{ const dt=Math.max(0,now()-D.open); return eth(1.68*Math.pow(2,-dt/8640)); };
function seedFor(sd,k){ const E=window.ethers; return Number(BigInt(E.solidityPackedKeccak256(['uint32','uint8'],[sd>>>0,k]))&0xffffffffn); }
const SALES={open:'OPEN: day on sale, 3 h in',sold:'SOLD: today’s plate bought by someone else',waiting:'SOLD + CLOSED: the next day not opened yet',unsold:'CLOSED UNSOLD',rollover:'NEXT DAY NOW (rollover)'};
function setSale(k,hours){ const D=plate(S.today);
  if(k==='rollover'){ if(!D.sold){ D.sold=true; D.buyer=OTHER; D.price=priceOf(D); } S.today++; S.lastId=S.today-1; const n=plate(S.today); n.open=now()-60; n.close=n.open+86400; n.seed=seedOf(S.today); n.sold=false; n.buyer='0x0000000000000000000000000000000000000000'; n.witnessed=0n; n.price=0n; S.sale='open'; }
  else { const h=hours==null?3:hours; S.sale=k;
    if(k==='open'){ D.open=now()-Math.round(h*3600); D.close=D.open+86400; D.sold=false; D.buyer='0x0000000000000000000000000000000000000000'; D.price=0n; }
    if(k==='sold'){ D.open=now()-Math.round(h*3600); D.close=D.open+86400; D.sold=true; D.buyer=OTHER; D.price=priceOf(D); D.pick=17; }
    if(k==='waiting'){ D.open=now()-86400-1800; D.close=D.open+86400; D.sold=true; D.buyer=OTHER; D.price=eth(0.4); D.pick=17; }
    if(k==='unsold'){ D.open=now()-86400-3600; D.close=D.open+86400; D.sold=false; D.buyer='0x0000000000000000000000000000000000000000'; D.price=0n; } }
  S.lastId=D.sold&&S.sale!=='open'?S.today:S.today-1; repaint(); }
function repaint(){ try{ if(typeof window.tick==='function') window.tick(true); }catch(e){} }
function callSim(to,data){ const E=window.ethers; if(!CH.IF) CH.IF=new E.Interface(SIM_ABI);
  let f; try{ f=CH.IF.getFunction(data.slice(0,10)); }catch(e){ f=null; } if(!f) return '0x';
  const a=CH.IF.decodeFunctionData(f,data); const D=plate(S.today); let out;
  const who=x=>lc(String(x));
  switch(f.name){
    case 'candleOpen': out=[BigInt(S.foundersEnd-86400)]; break; case 'candleClose': out=[BigInt(S.foundersEnd-1)]; break; case 'candleSettled': out=[S.settled]; break; case 'revealBlock': out=[0n]; break;
    case 'zeroSeed': out=[313454022]; break; case 'bidsCount': out=[BigInt(S.bids.length)]; break; case 'bids': { const b=S.bids[Number(a[0])]||{bidder:'0x0000000000000000000000000000000000000000',amount:0n}; out=[b.bidder,b.amount,0n,0]; break; }
    case 'FOUNDING': out=[S.FOUNDING]; break; case 'foundersEnd': out=[BigInt(S.foundersEnd)]; break; case 'today': out=[BigInt(S.today)]; break; case 'lastId': out=[BigInt(S.lastId)]; break; case 'dead': out=[S.dead]; break; case 'tombId': out=[0n]; break;
    case 'plates': { const p=plate(Number(a[0])); out=[p.seed,BigInt(p.open),BigInt(p.close),p.price,p.witnessed,p.buyer,p.pick,p.sold]; break; }
    case 'onSale': { const open=!D.sold&&now()<D.close; out=[BigInt(S.today),open?priceOf(D):0n,BigInt(D.close),open]; break; }
    case 'startPrice': out=[S.start]; break; case 'priceAt': out=[priceOf(D)]; break; case 'referencePrice': case 'median7': out=[S.ref]; break;
    case 'candidates': { const p=plate(Number(a[0])); out=[Array.from({length:32},(_,k)=>seedFor(p.seed,k))]; break; }
    case 'picks': out=[plate(Number(a[0])).pick]; break; case 'vault': out=[S.vault]; break; case 'seatPool': out=[S.seatPool]; break; case 'totalSeats': out=[S.totalSeats]; break;
    case 'seats': out=[S.seats.has(who(a[0]))?S.seats.get(who(a[0])):eth(2)]; break; case 'pending': out=[S.pending.has(who(a[0]))?S.pending.get(who(a[0])):eth(0.0364)]; break; case 'owed': out=[S.owed.get(who(a[0]))||0n]; break;
    case 'ownerOf': out=[lc(to)===lc(cfg('gift'))?OTHER:plate(Number(a[0])).buyer]; break; case 'tokenURI': out=['']; break; case 'witnessesOf': case 'handsOf': out=[[]]; break;
    case 'sky': out=[JSON.stringify(SKY)]; break; case 'balanceOf': case 'giftOf': out=[0n]; break; case 'isClaimed': out=[false]; break; case 'gifts': out=[79n]; break; case 'minted': out=[78n]; break; case 'gif': out=['0x']; break;
    default: return '0x'; }
  return CH.IF.encodeFunctionResult(f,out); }
const cfg=k=>{ try{ return CFG[k]; }catch(e){ return null; } };   /* the page's CFG (a global const), read at call time */
/* a simulated transaction: submitted (pending), then mined / replaced / lost by the visitor's choice */
function txSubmit(tx,who){ const from=lc(tx.from), n=CH.nonce.has(from)?CH.nonce.get(from):7; CH.nonce.set(from,n+1);
  const r={hash:rnd32(),from,to:lc(tx.to||''),data:lc(tx.data||tx.input||'0x'),value:BigInt(tx.value||0),gas:tx.gas||tx.gasLimit||'0x3d090',nonce:n,chainId:tx.chainId||'0x1',block:null,status:null,state:'pending',by:null,who,t:Date.now(),action:decode(tx).name};
  CH.txs.set(r.hash,r); logTick(); return r; }
function mineInto(r,status){ const b=CH.head(); r.block=b; r.status=status; (CH.inBlock.get(b)||CH.inBlock.set(b,[]).get(b)).push(r); CH.spent.set(r.from,Math.max(CH.spent.get(r.from)||0,r.nonce+1)); }
const OUTCOMES={confirmed:'CONFIRMED',reverted:'REVERTED',sped:'SPED UP (same call, higher fee)',cancelled:'CANCELLED (0 ETH to yourself)',replaced:'REPLACED (another call)',unknown:'UNKNOWN (nonce spent, tx not found)',pending:'PENDING (decide later)'};
function txResolve(hash,outcome){ const r=CH.txs.get(hash); if(!r||r.state!=='pending'&&!(r.state==='unknown'&&outcome==='confirmed')) return false;
  if(outcome==='pending') return true;
  if(outcome==='confirmed'||outcome==='reverted'){ if(r.state==='unknown') r.late=true; mineInto(r,outcome==='confirmed'?1:0); r.state=outcome; if(outcome==='confirmed') effect(r); }
  else if(outcome==='unknown'){ r.state='unknown'; CH.spent.set(r.from,Math.max(CH.spent.get(r.from)||0,r.nonce+1)); }   /* spent by a transaction no reader can find */
  else { const x=Object.assign({},r,{hash:rnd32(),state:'mined',replaces:r.hash});
    if(outcome==='cancelled'){ x.to=r.from; x.data='0x'; x.value=0n; }
    if(outcome==='replaced'){ x.data='0x3ccfd60b'; x.value=0n; x.action='withdraw'; }   /* withdraw(): another call to the same contract */
    CH.txs.set(x.hash,x); mineInto(x,1); r.state=outcome; r.by=x.hash; if(outcome==='sped') effect(x); }
  logTick(); return true; }
function txSchedule(hash,outcome){ if(outcome==='pending') return; setTimeout(()=>txResolve(hash,outcome),Math.max(0,+SET.mine||0)); }
function decode(tx){ try{ const E=window.ethers, A=(typeof ABI!=='undefined')?ABI:SIM_ABI; const I=new E.Interface(A); const p=I.parseTransaction({data:tx.data||tx.input||'0x',value:BigInt(tx.value||0)}); return p?{name:p.name,args:p.fragment.inputs.map((x,i)=>({name:x.name||('arg'+i),type:x.type,v:String(p.args[i])})),sig:p.signature}:{name:'(no call data)',args:[]}; }catch(e){ return {name:(tx.data||'0x')==='0x'?'(plain ETH transfer)':'(not a STORMGLASS call: '+String(tx.data).slice(0,10)+')',args:[]}; } }
function effect(r){ const a=r.action, d=decode({data:r.data,value:r.value}), from=r.from;
  if(a==='buy'){ const id=Number(d.args[0]&&d.args[0].v), k=Number(d.args[1]&&d.args[1].v); const p=plate(id); p.sold=true; p.buyer=from; p.pick=k; p.price=r.value*10n/11n; if(id===S.today) S.lastId=S.today; }
  if(a==='witness'){ const p=plate(Number(d.args[0]&&d.args[0].v)); p.witnessed+=r.value; S.seats.set(from,(S.seats.has(from)?S.seats.get(from):eth(2))+r.value*E18/S.FOUNDING); }
  if(a==='claim'){ S.owed.set(from,(S.owed.get(from)||0n)+(S.pending.has(from)?S.pending.get(from):eth(0.0364))); S.pending.set(from,0n); }
  if(a==='withdraw') S.owed.set(from,0n);
  if(a==='bid') S.bids.push({bidder:from,amount:r.value}); }
function txView(h){ const r=CH.txs.get(lc(h))||CH.txs.get(h); if(!r) return null;
  return {hash:r.hash,blockHash:r.block==null?null:hex32(r.block),blockNumber:r.block==null?null:hex(r.block),transactionIndex:r.block==null?null:'0x0',from:r.from,to:r.to||null,nonce:hex(r.nonce),gas:typeof r.gas==='string'?r.gas:hex(r.gas),gasPrice:'0x3b9aca00',maxFeePerGas:'0x3b9aca00',maxPriorityFeePerGas:'0x1',input:r.data,value:hex(r.value),type:'0x2',chainId:'0x1',accessList:[],v:'0x0',r:'0x'+'11'.repeat(32),s:'0x'+'22'.repeat(32),yParity:'0x0'}; }
function rcView(h){ const r=CH.txs.get(lc(h))||CH.txs.get(h); if(!r||r.block==null) return null;
  return {transactionHash:r.hash,blockHash:hex32(r.block),blockNumber:hex(r.block),transactionIndex:'0x0',from:r.from,to:r.to||null,cumulativeGasUsed:'0x30d40',gasUsed:'0x30d40',effectiveGasPrice:'0x3b9aca00',contractAddress:null,logs:[],logsBloom:'0x'+'00'.repeat(256),status:r.status?'0x1':'0x0',type:'0x2'}; }
const hex32=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
function block(tag,full){ const n=tag==='latest'||tag==='pending'||tag==null?CH.head():Number(BigInt(tag)); if(n>CH.head()) return null;
  const txs=(CH.inBlock.get(n)||[]).map(r=>txView(r.hash));
  return {number:hex(n),hash:hex32(n),parentHash:hex32(n-1),timestamp:hex(CH.tsOf(n)),nonce:'0x0000000000000000',difficulty:'0x0',gasLimit:'0x1c9c380',gasUsed:'0x0',miner:'0x0000000000000000000000000000000000000000',extraData:'0x',baseFeePerGas:'0x3b9aca00',blobGasUsed:'0x0',excessBlobGas:'0x0',stateRoot:hex32(0),receiptsRoot:hex32(0),mixHash:hex32(0),parentBeaconBlockRoot:hex32(0),transactions:full?txs:txs.map(t=>t.hash)}; }
const READER_HITS={};
/* RECEIPT ANSWERS (CONTROLS · TRACKING): what the simulated readers say about a MINED simulated transaction. "first-*": the reader the
   page asks first in a round (its TRACK.rpcs[trackAt], read live; publicnode until a fallback has answered) answers a malformed receipt
   and the others answer the true one, so every round shows "malformed, then a valid fallback"; "all": every reader answers a
   malformed one (publicnode the wrong hash, mevblocker no status, drpc a block before the send). A transaction not mined yet is null
   on every reader (an honest "not yet"). The malformed receipts keep the status the simulated outcome gave (they claim a result). */
const RECEIPTS={valid:'VALID (every reader)','first-hash':'FIRST READER: WRONG HASH, then a valid fallback','first-status':'FIRST READER: NO STATUS, then a valid fallback','first-block':'FIRST READER: BAD BLOCK, then a valid fallback',all:'ALL READERS INVALID (wrong hash / no status / bad block)'};
const READERS=()=>{ let f=''; try{ f=new URL(cfg('rpc')).hostname; }catch(e){} return [f,'rpc.mevblocker.io','eth.drpc.org']; };
const firstReader=()=>{ try{ return new URL(TRACK.rpcs[trackAt]).hostname; }catch(e){ return READERS()[0]; } };   /* the page's own rotation (globals read at call time) */
function malform(rc,how){ const x=Object.assign({},rc);
  if(how==='hash'){ x.transactionHash=rnd32(); return {rc:x,why:'transactionHash is another transaction’s'}; }
  if(how==='status'){ delete x.status; return {rc:x,why:'no status field'}; }
  x.blockNumber='0x1'; return {rc:x,why:'blockNumber 0x1, before the transaction was sent'}; }
function receiptFor(rc,host){ const mode=SET.receipts||'valid'; if(mode==='valid') return null; const R=READERS(), i=R.indexOf(host);
  if(mode==='all') return malform(rc,i===1?'status':i===2?'block':'hash');
  if(host===firstReader()) return malform(rc,mode.slice(6)); return null; }
function rpcOne(q,host){ const ok=v=>({jsonrpc:'2.0',id:q&&q.id,result:v}), bad=(c,m)=>({jsonrpc:'2.0',id:q&&q.id,error:{code:c,message:m}}); const m=q&&q.method, p=(q&&q.params)||[];
  READER_HITS[m]=(READER_HITS[m]||0)+1;
  switch(m){
    case 'eth_chainId': return ok('0x1'); case 'net_version': return ok('1');
    case 'eth_blockNumber': return ok(hex(CH.head()));
    case 'eth_getBlockByNumber': return ok(block(p[0],!!p[1]));
    case 'eth_call': return ok(callSim((p[0]||{}).to,(p[0]||{}).data||(p[0]||{}).input||'0x'));
    case 'eth_getLogs': return ok([]); case 'eth_getCode': return ok('0x6080');
    case 'eth_gasPrice': return ok('0x3b9aca00'); case 'eth_maxPriorityFeePerGas': return ok('0x1'); case 'eth_blobBaseFee': return ok('0x1');
    case 'eth_feeHistory': return ok({oldestBlock:hex(CH.head()-1),baseFeePerGas:['0x3b9aca00','0x3b9aca00'],gasUsedRatio:[0.5],reward:[['0x1']]});
    case 'eth_getBalance': return ok('0x8ac7230489e80000');
    case 'eth_estimateGas': return ok('0x30d40');
    case 'eth_getTransactionByHash': return ok(txView(p[0]));
    case 'eth_getTransactionReceipt': { const rc=rcView(p[0]); if(!rc||host==null) return ok(rc); const b=receiptFor(rc,host);
      if(b){ logReq('reader '+host,m,p[0],'answered a MALFORMED receipt ('+b.why+')'); return ok(b.rc); }
      if(SET.receipts&&SET.receipts!=='valid') logReq('reader '+host,m,p[0],'answered the VALID receipt (status '+rc.status+')'); return ok(rc); }
    case 'eth_getTransactionCount': return ok(hex(CH.spent.get(lc(p[0]))||7));
    default: return bad(-32601,'staging simulated chain: method not available: '+m); } }
/* every JSON-RPC POST the page makes over HTTP is answered here (no request leaves the page for an Ethereum node); a JSON-RPC
   write or signature to any host is refused. REAL mode: WalletConnect's own hosts pass (the real phone connection). */
const realFetch=window.fetch.bind(window);
const WC_HOST=/(^|\.)(walletconnect\.(com|org)|reown\.com|web3modal\.(com|org))$/i;
async function bodyText(input,init){ let b=init&&init.body; if(b==null&&input&&typeof input==='object'&&'clone' in input){ try{ return await input.clone().text(); }catch(e){ return null; } }
  if(typeof b==='string') return b; if(b instanceof Uint8Array||b instanceof ArrayBuffer) return new TextDecoder().decode(b); if(b&&typeof b.text==='function') return await b.text(); return null; }
window.fetch=async function(input,init){
  let url, method='GET'; try{ url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href); method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase(); }catch(e){ return realFetch(input,init); }
  if(method==='POST'&&url.origin!==location.origin){ const txt=await bodyText(input,init); let j=null; try{ j=txt?JSON.parse(txt):null; }catch(e){}
    const list=Array.isArray(j)?j:j?[j]:[], rpc=list.length&&list.every(x=>x&&typeof x==='object'&&typeof x.method==='string');
    if(rpc){ if(list.some(x=>POLICY.HTTP_WRITE.test(x.method))){ logReq('http '+url.hostname,list.map(x=>x.method).join('+'),null,'REFUSED (a write over HTTP)');
        return new Response(JSON.stringify(Array.isArray(j)?list.map(x=>({jsonrpc:'2.0',id:x.id,error:{code:-32000,message:'staging: refused'}})):{jsonrpc:'2.0',id:j.id,error:{code:-32000,message:'staging: refused'}}),{status:200,headers:{'content-type':'application/json'}}); }
      if(!(REAL&&WC_HOST.test(url.hostname))){
        const sig=init&&init.signal||(input&&input.signal);
        await new Promise((res,rej)=>{ const t=setTimeout(res,Math.max(0,+SET.readerMs||0)); if(sig){ if(sig.aborted){ clearTimeout(t); return rej(new DOMException('aborted','AbortError')); } sig.addEventListener('abort',()=>{ clearTimeout(t); rej(new DOMException('aborted','AbortError')); },{once:true}); } });
        let first=''; try{ first=new URL(cfg('rpc')).hostname; }catch(e){}
        if(SET.firstReaderDown&&url.hostname===first) return new Response('simulated reader outage',{status:503,headers:{'content-type':'text/plain'}});
        const out=Array.isArray(j)?list.map(x=>rpcOne(x,url.hostname)):rpcOne(j,url.hostname);
        return new Response(JSON.stringify(out),{status:200,headers:{'content-type':'application/json'}}); } } }
  return realFetch(input,init); };
/* THE FAST TRACKING CLOCK (staging only, CONTROLS · TRACKING): the page's own trackTx reads its deadlines from the page's TRACK object
   on every round; FAST sets them shorter on this page at run time so "cannot confirm" (TRACK.lost) and the final unknown (TRACK.stop)
   come within a minute. The code path is the page's, only the three numbers change; NORMAL puts the page's own values back. */
const CLOCKS={normal:'NORMAL (the page’s own: poll 3 s, cannot confirm at 10 min, gives up at 60 min)',fast:'FAST (staging only: poll 1.5 s, cannot confirm at 20 s, gives up at 45 s)'};
const FAST={poll:1500,lost:20000,stop:45000}; let TRACK0=null;
function applyClock(){ try{ if(typeof TRACK==='undefined'||!TRACK||typeof TRACK!=='object') return false; if(!TRACK0) TRACK0={poll:TRACK.poll,lost:TRACK.lost,stop:TRACK.stop};
  Object.assign(TRACK,SET.clock==='fast'?FAST:TRACK0); const b=document.getElementById('sg-fast'); if(b) b.hidden=SET.clock!=='fast'; return true; }catch(e){ return false; } }
const trackNow=()=>{ try{ return typeof TRACK!=='undefined'&&TRACK?{poll:TRACK.poll,lost:TRACK.lost,stop:TRACK.stop}:null; }catch(e){ return null; } };

/* ═══ THE PANELS: the wallet-confirmation / intercept chooser, the connect gate, a staging note. One modal at a time (queued). */
const Q=[]; let modalOn=null;
const el=(t,a,...k)=>{ const e=document.createElement(t); if(a) for(const x in a){ if(x==='class') e.className=a[x]; else if(x.startsWith('on')) e.addEventListener(x.slice(2),a[x]); else e.setAttribute(x,a[x]); } k.flat(Infinity).forEach(c=>{ if(c!=null) e.appendChild(typeof c==='string'?document.createTextNode(c):c); }); return e; };
/* float: the wallet's own screen is a separate window in real life, so the page stays usable behind it (races can be tried) */
function modal(build,float){ return new Promise((res,rej)=>{ Q.push({build,res,rej,float}); pump(); }); }
function pump(){ if(modalOn||!Q.length) return; if(!document.body){ document.addEventListener('DOMContentLoaded',pump,{once:true}); return; }
  const it=Q.shift(); const wrap=el('div',{id:'sg-modal',role:'dialog','aria-modal':it.float?'false':'true',class:it.float?'sg-float':''}); const box=el('div',{class:'sg-box'}); wrap.appendChild(box);
  modalOn={it,wrap,done:v=>{ if(!modalOn||modalOn.it!==it) return; wrap.remove(); modalOn=null; it.res(v); setTimeout(pump,0); }};
  try{ it.build(box,modalOn.done); }catch(e){ console.error('staging panel',e); modalOn=null; it.rej(e); setTimeout(pump,0); return; } document.body.appendChild(wrap); }
const fmtEth=v=>{ try{ return window.ethers.formatEther(BigInt(v||0)); }catch(e){ return String(v); } };
const chainName=c=>{ const n=typeof c==='string'?parseInt(c,16):Number(c); return n===1?'1 · Ethereum mainnet':n===8453?n+' · Base':n===42161?n+' · Arbitrum':String(c); };
function txRows(tx,walletChain){ const d=decode(tx), C=lc(cfg('contract')||'');
  return [['INTENDED CHAIN',tx.chainId!=null?chainName(tx.chainId):'(not set)'],['WALLET IS ON',walletChain==null?'—':chainName(walletChain)],['SENDER',tx.from||'—'],['TARGET',(tx.to||'—')+(lc(tx.to)===C?'  (the STORMGLASS contract)':'')],
    ['VALUE',fmtEth(tx.value)+' ETH'],['ACTION',d.name+(d.args.length?'('+d.args.map(a=>a.name+': '+a.v).join(', ')+')':'()')],['GAS LIMIT',tx.gas?String(BigInt(tx.gas)):'—']]; }
const kv=rows=>el('dl',{class:'sg-kv'},rows.map(([k,v])=>[el('dt',null,k),el('dd',null,v)]));
/* the chooser: REAL mode = the intercept; SIMULATION = the simulated wallet's confirmation screen. Resolves an outcome key. */
function chooser(tx,o){ if(SET.auto&&SET.auto!=='ask'&&!REAL) return Promise.resolve(SET.auto);
  return modal((box,done)=>{ box.classList.add(REAL?'sg-real':'sg-sim');
    box.append(el('div',{class:'sg-h'},REAL?'SUBMISSION INTERCEPTED: nothing was sent to your wallet':'SIMULATED WALLET · CONFIRMATION SCREEN'),
      el('p',{class:'sg-p'},REAL?'The page prepared this transaction and handed it to your wallet. The staging wrapper stopped it before your wallet: your wallet never saw it, nothing can be paid. This checks how the page prepares a transaction and what it shows next. It does not test your wallet’s own payment screen, and on a phone it does not test delivery of a payment through the WalletConnect relay.':'This stands in for the wallet’s own confirmation screen ('+(o.who||'simulated wallet')+'). Choose what the wallet and the chain do.'),
      kv(txRows(tx,o.walletChain)),
      el('div',{class:'sg-h2'},'CHOOSE THE SIMULATED RESULT'),
      el('div',{class:'sg-btns'},[['confirmed','CONFIRMED'],['reverted','REVERTED'],['rejected','REJECTED IN WALLET'],['sped','SPED UP'],['cancelled','CANCELLED'],['replaced','REPLACED BY ANOTHER CALL'],['unknown','UNKNOWN'],['pending','PENDING · DECIDE LATER'],['error','WALLET ERROR (no answer)']]
        .map(([k,t])=>el('button',{class:'sg-b'+(k==='confirmed'?' sg-prime':''),'data-out':k,onclick:()=>done(k)},t))),
      el('p',{class:'sg-n'},'Results other than REJECTED and WALLET ERROR give the page a simulated transaction hash; the page’s own tracking (receipts, nonce scan, replacement check) then reads the simulated chain. Mining delay: '+(SET.mine/1000)+' s (CONTROLS). The page stays usable behind this panel, as it does behind a wallet window.')); },true); }
async function handleSend(tx,o){ const out=await chooser(tx,o); if(o.onChoice) o.onChoice(out);
  if(out==='rejected') throw err(4001,'User rejected the request.');
  if(out==='error') throw err(-32603,'Internal JSON-RPC error (simulated: the wallet gave no clear answer).');
  const r=txSubmit(tx,o.who); r.outcome=out; r.mode=REAL?'intercepted':'simulated'; txSchedule(r.hash,out); return r.hash; }
function signPanel(method,params,who){ return modal((box,done)=>{ box.classList.add(REAL?'sg-real':'sg-sim');
  const tx=TXM.has(method);
  box.append(el('div',{class:'sg-h'},REAL?(tx?'TRANSACTION REQUEST INTERCEPTED':'SIGNATURE REQUEST INTERCEPTED')+': nothing was sent to your wallet':'SIMULATED WALLET · '+(tx?'TRANSACTION':'SIGNATURE')+' REQUEST'),
    el('p',{class:'sg-p'},'Method '+method+' from '+(who||'the page')+'. The STORMGLASS page never asks for this; this staging page never forwards it: it is refused.'),kv([['METHOD',method],['PARAMS',brief(params)]]),
    el('div',{class:'sg-btns'},el('button',{class:'sg-b sg-prime',onclick:()=>done('refused')},'CLOSE · REFUSED'))); },true); }
const ARMED=new WeakMap();
function gate(raw,who,method){ const t=ARMED.get(raw); if(method==='eth_requestAccounts'&&t&&Date.now()-t<20000) return Promise.resolve(true);
  return modal((box,done)=>{ box.classList.add('sg-real');
    const what=method==='eth_requestAccounts'||method==='enable'?'Your wallet ('+who+') will now ask to connect this site. Approve or refuse it in the wallet.':'Your wallet ('+who+') will now ask to switch to Ethereum mainnet. Approve or refuse it in the wallet.';
    box.append(el('div',{class:'sg-h'},'REAL WALLET · THIS WILL OPEN YOUR WALLET'),el('p',{class:'sg-p'},what),
      el('p',{class:'sg-p'},'No payment and no signature can be sent from this page: transactions and signatures stop at the staging wrapper before your wallet.'),
      el('div',{class:'sg-btns'},el('button',{class:'sg-b sg-prime','data-gate':'go',onclick:()=>{ if(method!=='wallet_switchEthereumChain') ARMED.set(raw,Date.now()); done(true); }},'ASK MY WALLET'),el('button',{class:'sg-b','data-gate':'no',onclick:()=>done(false)},'CANCEL'))); }); }

/* ═══ SIMULATION: the simulated wallets (EIP-1193), announced over EIP-6963; window.ethereum / providers[] / WalletConnect per preset */
const SIMP=new Set(), SW={};
const ICON=c=>'data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect width="20" height="20" fill="#111"/><path d="M4 4h12v12H4z" fill="none" stroke="'+c+'" stroke-width="2"/><text x="10" y="14" font-size="9" text-anchor="middle" fill="'+c+'" font-family="monospace">S</text></svg>');
const addr=t=>'0x'+t.padStart(40,'0');
/* LAST-MOMENT NETWORK CHANGE (CONTROLS · SCENARIOS 1), one shot per arming: once the wallet has been asked for a gas estimate (the
   write is being prepared), the next eth_accounts is the page's final check (opCheck asks eth_accounts and eth_chainId together). The
   wallet answers that eth_chainId "0x1"; once that answer is out, and before it answers eth_accounts, it announces chainChanged Base
   ("base") or Base and then mainnet again ("base-back"). The page's own last opLive runs after both answers and before the provider
   is asked to send: it must stop there, and this wallet's log must show no eth_sendTransaction. */
const LASTCHAIN={off:'OFF',base:'BASE',['base-back']:'BASE, THEN BACK TO MAINNET'};
function simWallet(c){ const L={}, st=Object.assign({chainId:'0x1',authorized:false,switch:'accept',connect:'approve',delay:0,asleep:false,ai:0,lastChain:'off',fired:0},c);
  const emit=(ev,...a)=>(L[ev]||[]).slice().forEach(f=>{ try{ f(...a); }catch(e){ console.error('listener',e); } });
  const acct=()=>st.accounts[st.ai%st.accounts.length], list=()=>st.authorized?[acct()].concat(st.accounts.filter(x=>x!==acct())):[];
  const lastMoment=async()=>{ const how=st.lastChain; st.armed=false; st.lastChain='off'; st.waitChain=true; st.chainOut=false;
    for(let i=0;i<200&&!st.chainOut;i++) await new Promise(r=>setTimeout(r,10));   /* the final check's eth_chainId has answered "0x1"… */
    await new Promise(r=>setTimeout(r,0)); st.waitChain=false;                      /* …and the page has read that answer */
    st.chainId='0x2105'; emit('chainChanged','0x2105'); if(how==='base-back'){ st.chainId='0x1'; emit('chainChanged','0x1'); }
    st.fired++; logReq(st.name,'chainChanged',how==='base-back'?['0x2105','0x1']:['0x2105'],'LAST-MOMENT NETWORK CHANGE (simulated): the final check was answered 0x1, then this was announced before the page could send'); logTick(); };
  const p={ request(args){ const method=args&&args.method, params=args&&args.params; const e=logReq(st.name,method,params,'simulated wallet');
      return (async()=>{ if(st.asleep) return new Promise(()=>{}); if(st.delay) await new Promise(r=>setTimeout(r,st.delay));
        switch(method){
          case 'eth_chainId': if(st.waitChain) st.chainOut=true; return st.chainId; case 'net_version': return String(parseInt(st.chainId,16));
          case 'eth_accounts': if(st.armed) await lastMoment(); return list();
          case 'eth_requestAccounts': { if(st.connect==='refuse'){ e.result='refused'; throw err(4001,'User rejected the request.'); } const was=st.authorized; st.authorized=true; if(!was) setTimeout(()=>emit('accountsChanged',list()),0); return list(); }
          case 'wallet_switchEthereumChain': { if(st.switch==='refuse'){ e.result='refused'; throw err(4001,'User rejected the request.'); } const c=params&&params[0]&&params[0].chainId; if(c&&c!==st.chainId){ st.chainId=c; setTimeout(()=>emit('chainChanged',c),0); } return null; }
          case 'wallet_revokePermissions': { st.authorized=false; setTimeout(()=>emit('accountsChanged',[]),0); return null; }
          case 'eth_estimateGas': if(st.lastChain==='base'||st.lastChain==='base-back'){ st.armed=true; st.chainOut=false; } return '0x30d40'; case 'eth_blockNumber': return hex(CH.head()); case 'eth_gasPrice': return '0x3b9aca00'; case 'eth_maxPriorityFeePerGas': return '0x1';
          case 'eth_getTransactionByHash': return txView(params[0]); case 'eth_getTransactionReceipt': return rcView(params[0]);
          case 'eth_call': return callSim((params[0]||{}).to,(params[0]||{}).data||'0x'); case 'eth_getBlockByNumber': return block(params[0],!!params[1]); case 'eth_getLogs': return [];
          case 'eth_sendTransaction': { if(!st.authorized) throw err(4100,'Unauthorized'); const tx=Object.assign({},params[0]); if(!tx.from) tx.from=acct();
            const h=await handleSend(tx,{who:st.name,walletChain:st.chainId,onChoice:o=>{ e.result=o; }}); e.result+=' '+h.slice(0,10); return h; }
          default: if(SIGNM.has(method)){ await signPanel(method,params,st.name); throw err(4001,'User rejected the request.'); }
            throw err(-32601,'method not found '+method); } })(); },
    on(ev,f){ (L[ev]=L[ev]||[]).push(f); return p; }, removeListener(ev,f){ L[ev]=(L[ev]||[]).filter(x=>x!==f); return p; } };
  if(st.flags) Object.assign(p,st.flags);
  SIMP.add(p); SW[st.id]={p,st,emit,acct,list,listeners:ev=>(L[ev]||[]).length};
  return p; }
let SIM_ETH=null, SIM_DETAILS=[], SIM_WC_NS=null; const HELD=[]; let NAV_HOLD=!REAL;
if(!REAL){
  const W=(id,name,rdns,color,x)=>({id,name,rdns,icon:ICON(color),accounts:[addr('a11'+id.length),addr('a12'+id.length)],...x});
  const mk=c=>({c,p:simWallet(c)});
  const pre=CONF.preset;
  let ws=[];
  if(pre==='desk3') ws=[mk(W('ALPHA','SIM ALPHA','sim.staging.alpha','#c8ff3a',{accounts:[addr('a11'),addr('a12')]})),mk(W('ALPHA2','SIM ALPHA','sim.staging.alpha-twin','#3ad1ff',{accounts:[addr('a21'),addr('a22')]})),
    mk(W('BETA','SIM BETA (on Base)','sim.staging.beta','#ff9a1f',{chainId:'0x2105',accounts:[addr('b01'),addr('b02')]})),mk(W('ASLEEP','SIM ASLEEP (never answers)','sim.staging.asleep','#777',{asleep:true,accounts:[addr('d01')]}))];
  if(pre==='desk1') ws=[mk(W('ALPHA','SIM ALPHA','sim.staging.alpha','#c8ff3a',{accounts:[addr('a11'),addr('a12')]}))];
  if(pre==='legacy') ws=[mk(W('ALPHA','SIM ALPHA','sim.staging.alpha','#c8ff3a',{announce:false,flags:{isMetaMask:true},accounts:[addr('a11'),addr('a12')]})),mk(W('BETA','SIM BETA (on Base)','sim.staging.beta','#ff9a1f',{announce:false,flags:{isRabby:true},chainId:'0x2105',accounts:[addr('b01'),addr('b02')]}))];
  if(pre==='inapp') ws=[mk(W('ALPHA','SIM ALPHA (in-app browser)','sim.staging.alpha','#c8ff3a',{flags:{isMetaMask:true},accounts:[addr('a11'),addr('a12')]}))];
  if(pre==='desk3'||pre==='desk1'||pre==='inapp') SIM_ETH=ws[0].p;
  if(pre==='legacy'){ SIM_ETH=ws[0].p; SIM_ETH.providers=ws.map(w=>w.p); }
  SIM_DETAILS=ws.filter(w=>w.c.announce!==false).map(w=>Object.freeze({info:Object.freeze({uuid:'5e5e5e5e-0000-4000-8000-'+String(w.c.id.length*1000+w.c.id.charCodeAt(0)).padStart(12,'0'),name:w.c.name,icon:w.c.icon,rdns:w.c.rdns}),provider:w.p}));
  const announce=()=>SIM_DETAILS.forEach(d=>window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:d})));
  window.addEventListener('eip6963:requestProvider',announce); setTimeout(announce,0);
  /* the simulated WalletConnect provider (phone preset): pairing shows the phone wallet's approval as a panel */
  const base=simWallet({id:'PHONE',name:'SIM PHONE WALLET (WalletConnect)',accounts:[addr('c01'),addr('c02')]}); const PS=SW.PHONE;
  /* session_request_sent, modelled on the shipped /wc.js: one event per request that goes to the phone wallet, {id (a safe integer made
     inside the engine), topic (the session's), request:{...args} (a shallow copy: request.params IS the array the page passed),
     chainId}; a chain switch is rebuilt inside wc.js (new params), so its event never carries the page's array. CONTROLS · SCENARIOS 3
     chooses what the phone's WalletConnect emits while the page's CONFIRM sheet is open (SET.wcEvent), and can emit an old or a foreign
     event on demand (__SG.wcEmit). */
  const hooks={}; let session=null, uris=0; const WCH={reqs:[],old:[],seq:0};
  const wcId=()=>Date.now()*1000+(++WCH.seq%1000);
  const wcFire=(ev,what)=>{ logReq(PS.st.name,'session_request_sent',{id:ev.id,topic:ev.topic,method:ev.request&&ev.request.method},'simulated WalletConnect event: '+what); (hooks.session_request_sent||[]).forEach(f=>{ try{ f(ev); }catch(e){} }); };
  const oldTopic=()=>WCH.old.length?WCH.old[WCH.old.length-1]:'simtopic-earlier-session';
  /* the kinds of event: this request's own (exact); an earlier request's (its own params array, id and topic); this request's params
     under an old session's topic; a foreign session's request of the same method */
  const wcEvent=(kind,rec)=>{ if(!rec) return null; const m=rec.request.method;
    if(kind==='exact') return [rec.ev,'this request’s own event'];
    if(kind==='earlier'){ const e=WCH.reqs.filter(r=>r!==rec&&r.request.method===m).pop(); return e?[e.ev,'an EARLIER request’s event (id '+e.ev.id+')']:[{id:rec.ev.id-7000,topic:rec.ev.topic,request:{method:m,params:JSON.parse(JSON.stringify(rec.args.params||[]))},chainId:rec.ev.chainId},'an earlier request’s event (same contents, another params array)']; }
    if(kind==='oldtopic') return [{id:wcId(),topic:oldTopic(),request:{...rec.args},chainId:rec.ev.chainId},'this request under an OLD session topic'];
    if(kind==='foreign') return [{id:wcId(),topic:'foreign0'+'f'.repeat(56),request:{method:m,params:JSON.parse(JSON.stringify(rec.args.params||[]))},chainId:rec.ev.chainId},'a FOREIGN session’s request'];
    return null; };
  const wcEmit=kind=>{ const rec=WCH.reqs[WCH.reqs.length-1]; const x=wcEvent(kind,rec); if(!x) return false; wcFire(x[0],x[1]); return true; };
  const WC_ASK=new Set(['eth_sendTransaction','personal_sign','eth_signTypedData_v4','wallet_switchEthereumChain']);
  const wc={ isWalletConnect:true, get accounts(){ return session?PS.list():[]; }, get session(){ return session; },
    request(args){ const m=args&&args.method; if(!session&&m!=='eth_chainId'){ logReq(PS.st.name,m,args&&args.params,'simulated wallet (no session)'); return Promise.reject(err(4100,'Please call connect() before request()')); }
      if(m==='eth_chainId'){ logReq(PS.st.name,m,null,'simulated wallet'); return Promise.resolve(parseInt(PS.st.chainId,16)); }
      if(WC_ASK.has(m)){ const req=m==='wallet_switchEthereumChain'?{method:m,params:[{chainId:(args.params&&args.params[0]&&args.params[0].chainId)||'0x1'}]}:{...args};
        const rec={args,request:req,ev:{id:wcId(),topic:session.topic,request:req,chainId:'eip155:'+parseInt(PS.st.chainId,16)}}; WCH.reqs.push(rec); if(WCH.reqs.length>40) WCH.reqs.shift();
        const k=SET.wcEvent||'exact';
        if(k==='exact') setTimeout(()=>wcFire(rec.ev,'this request’s own event'),400);
        else if(k==='earlier'||k==='foreign'){ setTimeout(()=>wcEmit(k),300); setTimeout(()=>wcFire(rec.ev,'this request’s own event (after the other one)'),1500); }
        else if(k==='oldtopic') setTimeout(()=>{ const x=wcEvent('oldtopic',rec); wcFire(x[0],x[1]); },400); }   /* 'none': no event: the page's 8 s fallback */
      /* the phone wallet shows a payment when its app is opened: with an app remembered (an OPEN button on the page's sheet) and
         results chosen by hand, the simulated wallet screen waits for the held OPEN jump, or 12 s */
      if(m==='eth_sendTransaction'&&SET.auto==='ask'&&isPhoneUA()&&(()=>{ try{ return !!localStorage.getItem('SG_WC_APP'); }catch(e){ return false; } })()){
        const h0=HELD.length; return (async()=>{ for(let i=0;i<120&&HELD.length===h0;i++) await new Promise(r=>setTimeout(r,100)); return base.request(args); })(); }
      return base.request(args); },
    on(ev,f){ base.on(ev,f); return wc; }, removeListener(ev,f){ base.removeListener(ev,f); return wc; },
    signer:{client:{on(ev,f){ (hooks[ev]=hooks[ev]||[]).push(f); }}},
    async enable(){ if(session) return wc.accounts; uris++; await new Promise(r=>setTimeout(r,Math.max(300,PS.st.delay||0)));
      PS.emit('display_uri','wc:'+('0'.repeat(63)+uris).slice(-64)+'@2?relay-protocol=irn&symKey='+'5e'.repeat(32));
      { const h0=HELD.length; for(let i=0;i<40&&HELD.length===h0;i++) await new Promise(r=>setTimeout(r,100)); }   /* the phone wallet "opens" when an app is tapped (the held jump), or after 4 s */
      const ok=await modal((box,done)=>{ box.classList.add('sg-sim'); box.append(el('div',{class:'sg-h'},'SIMULATED PHONE WALLET · CONNECTION REQUEST'),
        el('p',{class:'sg-p'},'On a real phone the wallet app opens here and asks to connect DITHERVOID // STORMGLASS. Nothing leaves this page: the pairing link above is simulated.'),
        el('div',{class:'sg-btns'},el('button',{class:'sg-b sg-prime','data-pair':'yes',onclick:()=>done(true)},'APPROVE PAIRING'),el('button',{class:'sg-b','data-pair':'no',onclick:()=>done(false)},'REJECT'))); });
      if(!ok) throw err(4001,'User rejected the pairing.');
      session={topic:('simtopic'+uris+'x'+rnd32().slice(2)).slice(0,64),peer:{metadata:{name:'SIM PHONE WALLET',description:'simulated',url:'https://sim.staging.invalid',icons:[],redirect:{}}}};
      PS.st.authorized=true; PS.emit('connect',{chainId:PS.st.chainId}); PS.emit('accountsChanged',wc.accounts); return wc.accounts; },
    async disconnect(){ if(!session) return; WCH.old.push(session.topic); session=null; PS.st.authorized=false; PS.emit('disconnect',{code:6000,message:'User disconnected.'}); } };
  PS.phoneEnds=()=>{ if(!session) return; WCH.old.push(session.topic); session=null; PS.st.authorized=false; PS.emit('disconnect',{code:6000,message:'Session deleted.'}); };
  PS.wcEmit=wcEmit; PS.wch=WCH;
  SIMP.add(wc); SW.PHONE.wc=wc;
  SIM_WC_NS=Object.freeze({EthereumProvider:Object.freeze({init:async()=>wc})});
  /* a tap that would leave for a wallet app (deep links) is held in SIMULATION, where the Navigation API allows it */
  /* each held link is written to the LOG (and __SG.held()) in full: the owner sees exactly which deep link OPEN would have opened */
  try{ if(window.navigation&&navigation.addEventListener) navigation.addEventListener('navigate',e=>{ try{ const u=new URL(e.destination.url); if(u.origin!==location.origin&&e.cancelable){ e.preventDefault(); HELD.push(u.href); logReq('page','open link',null,'HELD: deep link not opened (simulation)').params=u.href; logTick(); note('SIMULATION: the jump to '+u.href+' was held (it is in CONTROLS · LOG). On a phone this opens the wallet app; here the simulated wallet answers on this page.'); } }catch(x){} }); else NAV_HOLD=false; }catch(e){ NAV_HOLD=false; }
}

/* ═══ REAL WALLET: every provider object the page can reach is a wrapper made here (memoised per raw provider: the page's
   "same object = same wallet" rule still holds). A wrapper exposes request (the guard), the event methods, the wallet-name flags
   and providers[] (wrapped). Nothing else of the raw object is reachable through it. */
const WRAP=new WeakMap(), ISW=new WeakSet(), RAWNAME=new WeakMap();
const FLAGS=['isMetaMask','isRabby','isCoinbaseWallet','isBraveWallet','isPhantom','isTrust','isTrustWallet','isZerion','isRainbow','isFrame','isOkxWallet','isTokenPocket','isWalletConnect'];
async function guard(raw,who,args){ const method=args&&args.method, params=args&&args.params;
  if(FORWARD.has(method)){
    if((method==='eth_getTransactionByHash'||method==='eth_getTransactionReceipt')&&params&&CH.txs.has(lc(params[0]))){ logReq(who,method,params,'answered by staging (a simulated hash)'); return method==='eth_getTransactionByHash'?txView(params[0]):rcView(params[0]); }
    if(GATED.has(method)&&!(await gate(raw,who,method))){ logReq(who,method,params,'cancelled at the staging gate (wallet not asked)'); throw err(4001,'Cancelled on the staging page: your wallet was not asked.'); }
    const e=logReq(who,method,params,'FORWARDED to your wallet');
    try{ const r=await raw.request(params===undefined?{method}:{method,params}); e.result=brief(r); return r; }catch(x){ e.result='error '+(x&&x.code); throw x; } }
  if(LOCAL.has(method)){ logReq(who,method,params,'answered by staging (not forwarded)'); return '0x30d40'; }
  if(method==='eth_sendTransaction'){ const e=logReq(who,method,params,'INTERCEPTED (not forwarded)'); const tx=Object.assign({},params&&params[0]);
    let wc=null; try{ wc=await Promise.race([raw.request({method:'eth_chainId'}),new Promise(r=>setTimeout(()=>r(null),1500))]); logReq(who,'eth_chainId',null,'FORWARDED to your wallet (for the intercept panel)'); }catch(x){}
    const h=await handleSend(tx,{who,walletChain:wc,onChoice:o=>{ e.result=o; }}); e.result+=' '+h.slice(0,10); return h; }
  if(TXM.has(method)||SIGNM.has(method)){ logReq(who,method,params,'INTERCEPTED (not forwarded)'); await signPanel(method,params,who); throw err(4001,'Refused on the staging page: '+method+' is never sent to your wallet.'); }
  logReq(who,method,params,'REFUSED (not on the allowlist)'); throw err(4200,'Staging: '+method+' is not on this page’s allowlist; your wallet was not asked.'); }
function wrap(raw,who){ if(!raw||(typeof raw!=='object'&&typeof raw!=='function')) return raw; if(ISW.has(raw)) return raw; const had=WRAP.get(raw); if(had) return had;
  if(who) RAWNAME.set(raw,who); const name=()=>RAWNAME.get(raw)||(raw.isRabby?'Rabby':raw.isMetaMask?'MetaMask':raw.isWalletConnect?'WalletConnect':'browser wallet');
  const w={}; const L=new Map();
  const def=(k,v)=>Object.defineProperty(w,k,{value:v,enumerable:true});
  def('request',args=>guard(raw,name(),args));
  const on=k=>(ev,f)=>{ try{ (raw[k]||raw.on).call(raw,ev,f); }catch(e){ console.warn('staging: wallet events',e); } return w; };
  def('on',on('on')); def('addListener',on('addListener')); def('once',on('once'));
  def('removeListener',(ev,f)=>{ try{ (raw.removeListener||raw.off).call(raw,ev,f); }catch(e){} return w; }); def('off',w.removeListener);
  FLAGS.forEach(k=>Object.defineProperty(w,k,{enumerable:true,get:()=>{ try{ return raw[k]===true; }catch(e){ return false; } }}));
  Object.defineProperty(w,'providers',{enumerable:true,get:()=>{ let ps=null; try{ ps=raw.providers; }catch(e){} return Array.isArray(ps)?ps.map(p=>wrap(p)):undefined; }});
  if(raw.isWalletConnect||typeof raw.enable==='function'&&raw.signer){   /* the WalletConnect EthereumProvider */
    Object.defineProperty(w,'accounts',{enumerable:true,get:()=>{ try{ return Array.isArray(raw.accounts)?raw.accounts.slice():[]; }catch(e){ return []; } }});
    def('enable',async()=>{ if(!(await gate(raw,name(),'enable'))){ logReq(name(),'enable',null,'cancelled at the staging gate'); throw err(4001,'Cancelled on the staging page.'); } logReq(name(),'enable (pairing)',null,'FORWARDED to WalletConnect'); return raw.enable(); });
    def('disconnect',()=>{ logReq(name(),'disconnect',null,'FORWARDED to WalletConnect'); return raw.disconnect(); });
    /* the session as data (the page reads session.topic to bind its CONFIRM sheet to its own request; audit-4 repair B): a frozen copy
       of the topic and the peer's name/url/redirect strings, never the raw session object */
    const str=v=>typeof v==='string'?v:undefined;
    Object.defineProperty(w,'session',{enumerable:true,get:()=>{ try{ const s=raw.session; if(!s||typeof s!=='object') return undefined; const m=(s.peer&&s.peer.metadata)||{}, r=m.redirect||{};
      return Object.freeze({topic:str(s.topic),peer:Object.freeze({metadata:Object.freeze({name:str(m.name),url:str(m.url),redirect:Object.freeze({native:str(r.native),universal:str(r.universal)})})})}); }catch(e){ return undefined; } }});
    const facade={client:{on:(ev,f)=>{ if(ev!=='session_request_sent') return; try{ raw.signer.client.on(ev,f); }catch(e){} }}}; def('signer',facade);
    beltWC(raw); }
  ISW.add(w); WRAP.set(raw,w); Object.preventExtensions(w); return w; }
/* defence in depth for WalletConnect: the raw provider's own request paths (provider.request, signer.request, the sign client's
   session request) refuse transactions and signatures too, so nothing inside the bundle can carry one to the phone either */
function beltWC(raw){ const bad=m=>TXM.has(m)||SIGNM.has(m)||/send|sign/i.test(String(m));
  const patch=(o,k,pick)=>{ try{ if(!o||typeof o[k]!=='function'||o[k].__sg) return; const f=o[k].bind(o); const g=function(...a){ const m=pick(a); if(bad(m)){ logReq('WalletConnect (inside the bundle)',m,null,'REFUSED (belt)'); return Promise.reject(err(4001,'Refused on the staging page: '+m+' is never sent.')); } return f(...a); }; g.__sg=1; o[k]=g; }catch(e){ console.warn('staging: belt',k,e); } };
  patch(raw,'request',a=>a[0]&&a[0].method); patch(raw,'sendAsync',a=>a[0]&&a[0].method); patch(raw,'send',a=>typeof a[0]==='string'?a[0]:a[0]&&a[0].method);
  try{ patch(raw.signer,'request',a=>a[0]&&a[0].method); patch(raw.signer&&raw.signer.client,'request',a=>a[0]&&a[0].request&&a[0].request.method); }catch(e){} }
const NSW=new WeakMap();
function wrapNS(ns){ if(!ns||typeof ns!=='object'&&typeof ns!=='function') return ns; const had=NSW.get(ns); if(had) return had;
  const w=Object.freeze({EthereumProvider:Object.freeze({init:async o=>{ logReq('WalletConnect','EthereumProvider.init',null,'real WalletConnect (relay connection, no request yet)'); const P=await ns.EthereumProvider.init(o); return wrap(P,'WalletConnect'); }})}); NSW.set(ns,w); return w; }

/* ═══ THE TAPS the build writes into the page */
const SG={
  mode:MODE, stamp:STAMP, policy:POLICY, log:LOG, readerHits:READER_HITS, chain:CH, state:S, set:SET, sim:SW, sales:SALES, outcomes:OUTCOMES,
  eth(){ if(!REAL) return SIM_ETH||undefined; let raw; try{ raw=window.ethereum; }catch(e){ return undefined; } return wrap(raw); },
  detail(d){ if(!d||!d.provider) return d; if(!REAL) return SIMP.has(d.provider)?d:null;
    const nm=d.info&&typeof d.info.name==='string'?d.info.name:null; return Object.freeze({info:d.info,provider:wrap(d.provider,nm)}); },
  wcNS(ns){ return REAL?wrapNS(ns):SIM_WC_NS; },
  isWrapper:p=>ISW.has(p)||SIMP.has(p),
  /* controls (the CONTROLS drawer and the tests) */
  setSale, txResolve, choose(k){ const b=document.querySelector('#sg-modal [data-out="'+k+'"]'); if(!b) return false; b.click(); return true; },
  modalOpen:()=>!!modalOn, modalText:()=>{ const m=document.getElementById('sg-modal'); return m?m.textContent:''; },
  txs:()=>[...CH.txs.values()].map(r=>({hash:r.hash,from:r.from,to:r.to,value:String(r.value),action:r.action,state:r.state,outcome:r.outcome||null,by:r.by,mode:r.mode||null,replaces:r.replaces||null})),
  configure(o){ Object.assign(SET,o||{}); saveConf(); if(o&&'clock' in o) applyClock(); logTick(); },
  receipts:RECEIPTS, clocks:CLOCKS, lastChains:LASTCHAIN, track:trackNow, held:()=>HELD.slice(), navHold:()=>NAV_HOLD,
  wcEmit:k=>{ const w=SW.PHONE; return !!(w&&w.wcEmit&&w.wcEmit(k)); }, wcReqs:()=>SW.PHONE&&SW.PHONE.wch?SW.PHONE.wch.reqs.map(r=>({id:r.ev.id,topic:r.ev.topic,method:r.request.method})):[],
  /* CONTROLS · SCENARIOS: each SET UP puts the simulated wallets and the chain in the state the scenario needs (logged) */
  scenario(k,v){ let r=true;
    if(k==='lastchain'){ const how=LASTCHAIN[v]&&v!=='off'?v:'base-back'; Object.keys(SW).forEach(id=>{ const w=SW[id]; if(!w.st.asleep){ w.st.lastChain=how; w.st.armed=false; if(w.st.chainId!=='0x1') SG.wallet(id,{chainId:'0x1'}); } }); r=how; }
    else if(k==='switch'){ const id=CONF.preset==='wc'?'PHONE':SW.ALPHA?'ALPHA':Object.keys(SW)[0]; Object.values(SW).forEach(w=>{ w.st.lastChain='off'; w.st.armed=false; }); SG.wallet(id,{chainId:'0x2105',switch:'accept'}); SET.auto='ask'; saveConf(); r=id; }
    else if(k==='wc'){ SG.configure({wcEvent:['exact','earlier','oldtopic','foreign','none'].includes(v)?v:'earlier'}); r=SET.wcEvent; }
    else if(k==='receipts'){ const m=RECEIPTS[v]?v:'first-hash'; SG.configure(m==='all'?{receipts:m,clock:'fast'}:{receipts:m}); r=m; }
    else return false;
    logReq('staging','scenario '+k,r,'SET UP'); if(DR){ const y=DR.querySelector('.sg-db').scrollTop; drawer(); drawer(); DR.querySelector('.sg-db').scrollTop=y; } note('SET UP: scenario '+k+' ('+r+'). Steps: CONTROLS · SCENARIOS.'); return r; },
  preset(k){ if(!PRESETS[k]) return false; CONF.preset=k; saveConf(); return true; },
  presets:PRESETS, preset_:()=>CONF.preset,
  wallet:(id,o)=>{ const w=SW[id]; if(!w) return null; if(o){ const was={chainId:w.st.chainId,ai:w.st.ai,authorized:w.st.authorized}; Object.assign(w.st,o);
      if(o.chainId&&o.chainId!==was.chainId) setTimeout(()=>w.emit('chainChanged',o.chainId),0);
      if(o.ai!=null&&o.ai!==was.ai&&w.st.authorized) setTimeout(()=>w.emit('accountsChanged',w.list()),0); }
    return {id,name:w.st.name,chainId:w.st.chainId,account:w.acct(),authorized:w.st.authorized,switch:w.st.switch,connect:w.st.connect,delay:w.st.delay,asleep:w.st.asleep,lastChain:w.st.lastChain,fired:w.st.fired}; },
  walletDisconnects:id=>{ const w=SW[id]; if(!w) return; if(id==='PHONE'&&w.phoneEnds) return w.phoneEnds(); w.st.authorized=false; setTimeout(()=>w.emit('accountsChanged',[]),0); },
  switchMode(m){ if(m!=='sim'&&m!=='real') return; ssSet(MODE_KEY,m); try{ const B=sessionStorage; for(let i=B.length-1;i>=0;i--){ const k=B.key(i); if(k&&(k.startsWith(SIMLS)||k===CONF_KEY)) B.removeItem(k); } }catch(e){}
    const u=new URL(location.href); u.searchParams.set('sgmode',m); location.replace(u.pathname+u.search); },
  reloadSim(){ saveConf(); const u=new URL(location.href); u.searchParams.set('sgmode','sim'); location.replace(u.pathname+u.search); }
};
Object.defineProperty(window,'__SG',{value:Object.freeze(SG),configurable:false,writable:false});

/* ═══ THE BANNER AND THE CONTROLS */
let noteT=null;
function note(t){ const n=document.getElementById('sg-note'); if(!n) return; n.textContent=t; n.classList.add('on'); clearTimeout(noteT); noteT=setTimeout(()=>n.classList.remove('on'),6000); }
function ui(){ const B=document.getElementById('sg-banner'); if(!B||B.dataset.on) return; B.dataset.on='1'; B.textContent=''; document.body.classList.add('sg-stage',REAL?'sg-mode-real':'sg-mode-sim');
  B.setAttribute('role','region'); B.setAttribute('aria-label','Test build');
  B.append(el('b',{class:'sg-tb'},'TEST BUILD'),el('span',{class:'sg-mode'},el('span',{class:'sg-long'},REAL?'REAL WALLET — CONNECTION TEST':'SIMULATION'),el('span',{class:'sg-short'},REAL?'REAL WALLET TEST':'SIMULATION')),(()=>{ const f=el('span',{class:'sg-fast',id:'sg-fast',title:'The tracking deadlines are shortened on this page (CONTROLS · TRACKING)'},'FAST CLOCK'); f.hidden=SET.clock!=='fast'; return f; })(),
    el('span',{class:'sg-rev',title:'candidate index.html: git '+STAMP.rev+' (index.html last changed in '+STAMP.touched+') · sha256 '+STAMP.sha256},'candidate ',el('code',{id:'sg-rev'},STAMP.rev),' · sha256 ',el('code',{id:'sg-sha'},STAMP.sha256.slice(0,12))),
    el('span',{class:'sg-sp'}),el('button',{class:'sg-bb',id:'sg-ctl',onclick:()=>drawer()},'CONTROLS'),el('button',{class:'sg-bb',id:'sg-modebtn',onclick:()=>modeSheet()},'MODE'));
  document.body.appendChild(el('div',{id:'sg-note',role:'status'}));
  if(REAL) setTimeout(()=>note('REAL WALLET — CONNECTION TEST. Your wallet is asked only to connect, switch network or disconnect, and only after you confirm on this page. Payments and signatures stop before your wallet.'),400); }
function modeSheet(){ modal((box,done)=>{ box.classList.add(REAL?'sg-real':'sg-sim');
  box.append(el('div',{class:'sg-h'},'CHOOSE THE TEST MODE'),
    el('div',{class:'sg-mo'+(REAL?'':' on')},el('b',null,'SIMULATION (default)'),el('p',null,'Simulated wallets and a simulated chain inside this page. Your real wallet is never visible to the page. Every result (confirmed, reverted, rejected, sped up, cancelled, replaced, unknown) and every delay can be chosen. Nothing leaves this page for Ethereum.')),
    el('div',{class:'sg-mo'+(REAL?' on':'')},el('b',null,'REAL WALLET — CONNECTION TEST'),el('p',null,'Your real wallet (MetaMask, Rabby, Zerion… or WalletConnect on a phone) connects to this page for real: your wallet will ask to connect this site, and later maybe to switch network. No payment and no signature can be sent from this page: each one is stopped before your wallet and shown to you; you then pick a simulated result. So this mode does not test your wallet’s own payment screen, nor delivery of a payment through the WalletConnect relay. The sale shown stays simulated.')),
    el('p',{class:'sg-n'},'Changing mode reloads the page into a clean state: no wallet connection, no pending transaction and no simulated state carries over.'),
    el('div',{class:'sg-btns'},el('button',{class:'sg-b'+(REAL?'':' sg-prime'),'data-mode':'sim',onclick:()=>{ done(); if(REAL) SG.switchMode('sim'); }},REAL?'RELOAD IN SIMULATION':'STAY IN SIMULATION'),
      el('button',{class:'sg-b'+(REAL?' sg-prime':''),'data-mode':'real',onclick:()=>{ done(); if(!REAL) SG.switchMode('real'); }},REAL?'STAY IN REAL-WALLET MODE':'RELOAD IN REAL-WALLET MODE'),el('button',{class:'sg-b',onclick:()=>done()},'CLOSE'))); }); }
const s1Status=()=>{ const armed=Object.values(SW).filter(w=>w.st.lastChain&&w.st.lastChain!=='off').length; let i=-1; for(let k=LOG.length-1;k>=0;k--) if(/LAST-MOMENT/.test(LOG[k].route)){ i=k; break; }
  return (armed?'ARMED ('+armed+' wallets, one shot)':'not armed')+(i<0?'':' · last change fired; eth_sendTransaction since: '+LOG.slice(i+1).filter(e=>e.method==='eth_sendTransaction').length); };
let DR=null; const SHOWP=/^(open link|session_request_sent|chainChanged|scenario |eth_getTransactionReceipt)/;
function drawer(){ if(DR){ DR.remove(); DR=null; logTick=()=>{}; return; }
  DR=el('aside',{id:'sg-drawer','aria-label':'Staging controls'}); document.body.appendChild(DR);
  const sec=(t,...k)=>el('section',{class:'sg-sec'},el('h4',null,t),...k);
  const seg=(opts,cur,fn,attr)=>el('div',{class:'sg-seg'},opts.map(([k,t])=>el('button',{class:'sg-s'+(k===cur?' on':''),[attr||'data-k']:k,onclick:e=>{ fn(k); [...e.target.parentNode.children].forEach(b=>b.classList.toggle('on',b===e.target)); }},t)));
  const num=(lab,v,fn,step)=>el('label',{class:'sg-num'},lab,el('input',{type:'number',value:String(v),step:String(step||100),min:'0',onchange:e=>fn(+e.target.value)}));
  const body=el('div',{class:'sg-db'}); DR.append(el('div',{class:'sg-dh'},el('b',null,'STAGING CONTROLS · '+(REAL?'REAL WALLET':'SIMULATION')),el('button',{class:'sg-bb',onclick:()=>drawer()},'CLOSE')),body);
  body.append(sec('WHAT IS REAL HERE',el('p',{class:'sg-n'},REAL?'REAL: your wallet extension or WalletConnect phone wallet, its accounts, its network, connect / disconnect / revocation, account and network changes made in the wallet. SIMULATED: the sale, the plates’ chain data, every transaction result (your wallet never receives a transaction or a signature), gas estimates.':'SIMULATED: every wallet, every account, the network each wallet is on, the sale state, the plates’ chain data, blocks, receipts, every transaction result. REAL: the page code itself (index.html candidate '+STAMP.rev+') and the plate artwork files it loads from this site. No request leaves this page for an Ethereum node or a wallet.')));
  /* SCENARIOS: one SET UP per scenario, then the steps to click on the page itself (the production code does the rest) */
  const scn=(n,title,ctl,steps,expect)=>el('div',{class:'sg-scn','data-scn':n},el('div',{class:'sg-wn'},n+'. '+title),ctl,el('ol',{class:'sg-steps'},steps.map(t=>el('li',null,t))),el('p',{class:'sg-n'},'EXPECT: '+expect));
  const pickSet=(name,opts,cur)=>{ let v=cur; return [seg(opts,cur,k=>{ v=k; },'data-'+name),()=>v]; };
  const SCN=[];
  if(!REAL){
    const [lcSeg,lcV]=pickSet('lastchain',[['base','TO BASE'],['base-back','TO BASE AND BACK']],'base-back');
    const armed=Object.values(SW).filter(w=>w.st.lastChain&&w.st.lastChain!=='off').length;
    SCN.push(scn(1,'NETWORK CHANGES AT THE LAST MOMENT',el('div',null,lcSeg,el('div',{class:'sg-row'},el('button',{class:'sg-s sg-go','data-setup':'lastchain',onclick:()=>SG.scenario('lastchain',lcV())},'SET UP'),el('span',{class:'sg-st',id:'sg-s1st'},s1Status()))),
      ['SET UP (every simulated wallet goes to mainnet and is armed once).','CONNECT, pick SIM ALPHA · 1 (on a phone: approve the pairing).','Press COLLECT under the plate, pick a candidate, press COLLECT in the dialog (or press WITNESS).','In the simulated wallet screen nothing needs to be chosen: the wallet answers the page’s final check “0x1”, then announces Base (and back) before the page can send.'],
      'the dialog / toast says the wallet changed network and nothing was sent; LOG (below) shows “chainChanged · LAST-MOMENT NETWORK CHANGE” and no eth_sendTransaction after it.'));
    SCN.push(scn(2,'NORMAL COLLECT WITH THE INTENDED SWITCH',el('div',{class:'sg-row'},el('button',{class:'sg-s sg-go','data-setup':'switch',onclick:()=>SG.scenario('switch')},'SET UP')),
      ['SET UP (SIM ALPHA, or the phone wallet, goes to Base with SWITCH: ACCEPT).','CONNECT, pick SIM ALPHA · 1: the wallet button shows [!] NOT MAINNET.','COLLECT, pick a candidate, COLLECT: the dialog says YOUR WALLET IS ON ANOTHER NETWORK.','Press SWITCH TO ETHEREUM: the wallet accepts, the collect goes on and the simulated wallet screen opens on mainnet (WITNESS instead switches by itself).','Press CONFIRMED.'],
      'one wallet_switchEthereumChain, then one eth_sendTransaction with chainId 0x1, then [OK] DAY … IS YOURS.'));
    const [wcSeg,wcV]=pickSet('wcevent',[['earlier','AN EARLIER REQUEST’S EVENT'],['oldtopic','OLD SESSION TOPIC'],['foreign','FOREIGN SESSION'],['none','NO EVENT'],['exact','ONLY THE CORRECT EVENT']],SET.wcEvent==='exact'?'earlier':SET.wcEvent);
    SCN.push(scn(3,'OLD WALLETCONNECT EVENT DURING A NEW PROMPT (phone)',el('div',null,wcSeg,el('div',{class:'sg-row'},el('button',{class:'sg-s sg-go','data-setup':'wc',onclick:()=>{ if(CONF.preset!=='wc'){ SG.configure({wcEvent:wcV()}); SG.preset('wc'); SG.reloadSim(); return; } SG.scenario('wc',wcV()); }},CONF.preset==='wc'?'SET UP':'SET UP (reloads with the phone WalletConnect set)'),
        el('span',{class:'sg-st'},'now: '+(SET.wcEvent||'exact'))),
        el('div',{class:'sg-row'},'emit now: ',[['earlier','EARLIER REQUEST'],['oldtopic','OLD TOPIC'],['foreign','FOREIGN'],['exact','CORRECT']].map(([k,t])=>el('button',{class:'sg-s','data-emit':k,onclick:()=>{ if(!SG.wcEmit(k)) note('No WalletConnect request yet: press COLLECT first.'); }},t)))),
      ['On a phone (or a phone-sized window with a phone user agent): the CONFIRM sheet exists only there.','SET UP, then CONNECT, tap ZERION (the jump is held and logged), APPROVE PAIRING.','COLLECT, pick, COLLECT: the page’s CONFIRM IN ZERION sheet opens; the simulated phone emits the chosen old event first (and, for EARLIER/FOREIGN, its own event 1.5 s later). EMIT NOW sends one more while the sheet is open.','Tap OPEN ZERION (enabled on the right event, or after 8 s). The jump is held: LOG shows the exact link under “open link”.','Answer the simulated wallet screen as you like.'],
      'OPEN never carries the old id or topic: with EARLIER or FOREIGN it carries this request’s own requestId and sessionTopic; with OLD TOPIC or NO EVENT it opens …/wc only, after 8 s, and the sheet says “No word yet…”.'));
  }
  { const [rSeg,rV]=pickSet('receipts',Object.entries(RECEIPTS),SET.receipts||'valid');
    SCN.push(scn(REAL?1:4,'RECEIPTS: VALID, MALFORMED FIRST READER, ALL INVALID',el('div',null,rSeg,el('div',{class:'sg-row'},el('button',{class:'sg-s sg-go','data-setup':'receipts',onclick:()=>SG.scenario('receipts',rV())},'SET UP'),el('span',{class:'sg-st'},'now: '+(SET.receipts||'valid')+' · clock '+(SET.clock||'normal')))),
      ['Choose the readers’ answer and SET UP (ALL READERS INVALID also turns the FAST CLOCK on, see TRACKING below).',REAL?'CONNECT your wallet (ASK MY WALLET), then COLLECT or WITNESS: the payment is intercepted.':'CONNECT (SIM ALPHA · 1), then COLLECT or WITNESS.','In the wallet screen choose CONFIRMED (or REVERTED).','Watch the dialog and the LOG: each reader’s receipt answer is listed.'],
      'VALID and FIRST READER …: the result you chose (the malformed first answer is skipped, the next reader’s valid one decides in the same round). ALL INVALID: pending, then “cannot confirm” at 20 s, then RESULT UNKNOWN at 45 s (FAST CLOCK); never confirmed or reverted.')); }
  body.append(sec('SCENARIOS (audit 4)',...SCN,REAL?el('p',{class:'sg-n'},'The last-moment network change, the intended switch and the WalletConnect event scenarios need the simulated wallets: use SIMULATION (MODE). Your real wallet can of course change network itself while a payment is prepared; the page then stops before your wallet, as in simulation.'):null));
  body.append(sec('SALE (simulated chain)',seg(Object.entries(SALES).map(([k,t])=>[k,t]),S.sale,k=>setSale(k),'data-sale'),
    num('hours since the day opened (OPEN / SOLD)',3,h=>setSale(S.sale==='sold'?'sold':'open',h),0.5)));
  if(!REAL){
    const wl=el('div');
    const draw=()=>{ wl.innerHTML=''; Object.keys(SW).filter(id=>id!=='PHONE'||CONF.preset==='wc').forEach(id=>{ const w=SW[id]; if(!w) return; const s=SG.wallet(id);
      wl.append(el('div',{class:'sg-w','data-w':id},el('div',{class:'sg-wn'},s.name+' ['+id+'] · '+(s.authorized?'connected '+s.account.slice(0,8)+'…':'not connected')),
        seg([['0x1','MAINNET'],['0x2105','BASE']],s.chainId,k=>{ SG.wallet(id,{chainId:k}); draw(); },'data-chain'),
        seg([['accept','SWITCH: ACCEPT'],['refuse','SWITCH: REFUSE']],s.switch,k=>SG.wallet(id,{switch:k}),'data-switch'),
        seg([['approve','CONNECT: APPROVE'],['refuse','CONNECT: REFUSE']],s.connect,k=>SG.wallet(id,{connect:k}),'data-connect'),
        el('div',{class:'sg-row'},'last-moment network change: ',seg(Object.entries(LASTCHAIN),s.lastChain||'off',k=>SG.wallet(id,{lastChain:k,armed:false}),'data-lc')),
        el('div',{class:'sg-row'},el('button',{class:'sg-s',onclick:()=>{ SG.wallet(id,{ai:(w.st.ai+1)}); draw(); }},'NEXT ACCOUNT'),el('button',{class:'sg-s',onclick:()=>{ SG.walletDisconnects(id); setTimeout(draw,50); }},'WALLET DISCONNECTS'),
          num('answer delay ms',s.delay,v=>SG.wallet(id,{delay:v}))))); }); };
    draw();
    body.append(sec('SIMULATED WALLETS',el('label',{class:'sg-num'},'set of wallets (reloads the page) ',el('select',{onchange:e=>{ SG.preset(e.target.value); SG.reloadSim(); }},Object.entries(PRESETS).map(([k,t])=>{ const o=el('option',{value:k},t); if(k===CONF.preset) o.selected=true; return o; }))),wl));
  } else {
    body.append(sec('YOUR WALLET: WHAT MAY REACH IT',el('p',{class:'sg-n'},'Forwarded (default-deny allowlist): '+[...FORWARD].join(', ')+'. eth_requestAccounts and wallet_switchEthereumChain only after you press ASK MY WALLET. Answered here, never forwarded: '+[...LOCAL].join(', ')+'. Stopped and shown, never forwarded: '+POLICY.TX.concat(POLICY.SIGN).join(', ')+'. Anything else: refused.')));
  }
  body.append(sec('TRANSACTIONS AND TRACKING',!REAL?el('label',{class:'sg-num'},'simulated wallet answers ',el('select',{onchange:e=>SG.configure({auto:e.target.value})},[['ask','ASK ME EACH TIME']].concat(Object.entries(OUTCOMES).map(([k,t])=>[k,'ALWAYS '+t]),[['rejected','ALWAYS REJECTED IN WALLET'],['error','ALWAYS WALLET ERROR']]).map(([k,t])=>{ const o=el('option',{value:k},t); if(k===SET.auto) o.selected=true; return o; }))):null,
    num('mining delay ms (after the result is chosen)',SET.mine,v=>SG.configure({mine:v})),num('reader latency ms (each JSON-RPC answer)',SET.readerMs,v=>SG.configure({readerMs:v}),50),
    el('div',{class:'sg-row'},'first reader (publicnode): ',seg([['up','UP'],['down','DOWN (503)']],SET.firstReaderDown?'down':'up',k=>SG.configure({firstReaderDown:k==='down'}))),
    el('label',{class:'sg-num'},'receipts the readers give ',el('select',{'data-ctl':'receipts',onchange:e=>SG.configure({receipts:e.target.value})},Object.entries(RECEIPTS).map(([k,t])=>{ const o=el('option',{value:k},t); if(k===(SET.receipts||'valid')) o.selected=true; return o; }))),
    el('div',{class:'sg-row'},'tracking clock: ',seg([['normal','NORMAL'],['fast','FAST (staging only)']],SET.clock==='fast'?'fast':'normal',k=>SG.configure({clock:k}),'data-clock')),
    el('p',{class:'sg-n'},CLOCKS.normal+'. '+CLOCKS.fast+'. FAST changes only these three numbers of the page’s own TRACK object, on this page; the tracking code is the page’s.'),
    el('div',{id:'sg-txs'})));
  body.append(sec('LOG: WALLET REQUESTS, READER RECEIPTS, EVENTS, HELD LINKS (newest first)',el('ol',{id:'sg-log',class:'sg-log'})));
  logTick=()=>{ if(!DR) return; const s1=document.getElementById('sg-s1st'); if(s1) s1.textContent=s1Status(); const L=document.getElementById('sg-log'); if(L){ L.innerHTML=''; LOG.slice(-60).reverse().forEach(e=>L.append(el('li',{class:/INTERCEPT|REFUSED/.test(e.route)?'x':/FORWARD/.test(e.route)?'f':''},el('b',null,e.method),' · '+e.who+' · '+e.route+(e.result?' · '+e.result:'')+(SHOWP.test(e.method)&&e.params&&e.params!=='null'?' · '+e.params:'')))); }
    const T=document.getElementById('sg-txs'); if(T){ T.innerHTML=''; [...CH.txs.values()].filter(r=>!r.replaces).slice(-8).reverse().forEach(r=>T.append(el('div',{class:'sg-tx'},el('code',null,r.hash.slice(0,10)+'… '+r.action+' · '+r.state+(r.by?' → '+r.by.slice(0,10)+'…':'')),
      r.state==='pending'||r.state==='unknown'?el('div',{class:'sg-row'},(r.state==='unknown'?[['confirmed','LATE RECEIPT: CONFIRMED']]:Object.entries(OUTCOMES).filter(([k])=>k!=='pending')).map(([k,t])=>el('button',{class:'sg-s',onclick:()=>{ txResolve(r.hash,k); }},t.split(' (')[0]))):null))); } };
  logTick(); }
const start=()=>{ ui(); pump(); applyClock(); };
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
