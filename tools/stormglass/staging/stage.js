/* ═══ STORMGLASS STAGING RUNTIME — exists ONLY in test-wallet.html (inlined by tools/stormglass/staging/build.js); never in index.html.
   It runs before every page script. Two modes, chosen per tab (sessionStorage 'sg.staging.mode' or ?sgmode=sim|real), default SIMULATION:
   SIMULATION  simulated EIP-1193 wallets announced over EIP-6963 (and window.ethereum / providers[] / a simulated WalletConnect, per
               preset); real wallets are invisible; every JSON-RPC request the page makes over HTTP is answered by a simulated chain
               inside this page (no request leaves the page for Ethereum); the page's own discovery, connect, OpSigner, send() and
               trackTx run unchanged against them.
   REAL WALLET the visitor's real wallets (EIP-6963, window.ethereum, providers[], WalletConnect) — each wrapped before the page gets it.
               THE BOUNDARY (audit 5b): real providers and the real WalletConnect relay ARE contacted, for connection and session
               operations only: the allowlist (policy.js FORWARD: eth_chainId / eth_accounts checks, eth_requestAccounts and
               wallet_switchEthereumChain after the staging gate ASK MY WALLET, wallet_revokePermissions, and read-only calls), and for
               WalletConnect EthereumProvider.init (opens the relay connection and restores a stored session: on CONNECT, before the
               gate, no wallet request), enable = pairing (after the gate) and disconnect. Every payment, signature, batch, raw
               transaction and user operation stops at the wrapper (eth_sendTransaction: the intercept panel and a simulated result;
               the rest: shown and refused), and every other method is refused (4200); inside the WalletConnect bundle a belt refuses
               them too. Chain outcomes shown here stay simulated. The automated tests block every socket and outside host: that is the
               test harness, not evidence that this page cannot reach a relay.
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
  wc:'PHONE · WALLETCONNECT (simulated phone wallet)',
  phone2:'PHONE · IN A WALLET APP, TWO WALLETS (audit 5: the first fails to connect, the second is already authorised)'
};
/* the page decides "phone" from navigator.userAgent (isPhone) and "inside a wallet app" from window.ethereum's flags (inWalletApp). The phone2 preset makes a
   desktop browser a wallet-app phone: before any page script runs, navigator.userAgent reads as an iPhone in the MetaMask app (staging only, runtime only) */
const PHONE2_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MetaMaskMobile/7.40.0';
if(CONF.preset==='phone2'&&!REAL&&!/iPhone|Android/i.test(navigator.userAgent)){ try{ Object.defineProperty(navigator,'userAgent',{configurable:true,get:()=>PHONE2_UA}); }catch(e){ console.warn('staging: userAgent override unavailable',e); } }
if(!PRESETS[CONF.preset]) CONF.preset=isPhoneUA()?'wc':'desk3';
const SET=Object.assign({auto:'ask',mine:2500,readerMs:120,firstReaderDown:false,receipts:'valid',clock:'normal',wcEvent:'exact',seatsPay:false,txid:'valid',txidWallet:false,connFail:'-32603',connHow:'async',owed:0,payer:'accepts',recipient:'accepts'},CONF.set||{});
const saveConf=()=>ssSet(CONF_KEY,JSON.stringify({preset:CONF.preset,set:SET}));
const REALNOTE='REAL WALLET — CONNECTION TEST. Your real wallet (on a phone: through the real WalletConnect relay) is contacted for the connection only; connecting and switching network wait for ASK MY WALLET on this page. Payments and signatures are intercepted before your wallet; outcomes are simulated.';

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
  seats:new Map(), pending:new Map(), owed:new Map(), received:new Map(), payouts:[], plates:new Map(), bids:[], sale:'open' };
/* what the contract owes an account (owed()): the account's own entry, else the CONTROLS default (SET.owed, simulated ETH) */
const owedOf=a=>S.owed.has(a)?S.owed.get(a):eth(+SET.owed||0);
const pendOf=a=>S.pending.has(a)?S.pending.get(a):eth(0.0364);
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
    case 'seats': out=[S.seats.has(who(a[0]))?S.seats.get(who(a[0])):eth(2)]; break; case 'pending': out=[pendOf(who(a[0]))]; break; case 'owed': out=[owedOf(who(a[0]))]; break;
    case 'ownerOf': out=[lc(to)===lc(cfg('gift'))?OTHER:plate(Number(a[0])).buyer]; break; case 'tokenURI': out=['']; break; case 'witnessesOf': case 'handsOf': out=[[]]; break;
    case 'sky': out=[JSON.stringify(SKY)]; break; case 'balanceOf': case 'giftOf': out=[0n]; break; case 'isClaimed': out=[false]; break; case 'gifts': out=[79n]; break; case 'minted': out=[78n]; break; case 'gif': out=['0x']; break;
    default: return '0x'; }
  return CH.IF.encodeFunctionResult(f,out); }
const cfg=k=>{ try{ return CFG[k]; }catch(e){ return null; } };   /* the page's CFG (a global const), read at call time */
/* a simulated transaction: submitted (pending), then mined / replaced / lost by the visitor's choice */
function txSubmit(tx,who){ const from=lc(tx.from), n=CH.nonce.has(from)?CH.nonce.get(from):7; CH.nonce.set(from,n+1);
  const r={hash:rnd32(),from,to:lc(tx.to||''),data:lc(tx.data||tx.input||'0x'),value:BigInt(tx.value||0),gas:tx.gas||tx.gasLimit||'0x3d090',nonce:n,chainId:tx.chainId||'0x1',block:null,status:null,state:'pending',by:null,who,t:Date.now(),action:decode(tx).name};
  CH.txs.set(r.hash,r);
  if(SET.txid==='other-mined'||SET.txid==='first-mined'){ const u={hash:rnd32(),from,to:OTHER,data:'0x',value:0n,gas:'0x5208',nonce:n-1,chainId:'0x1',block:null,status:null,state:'mined',by:null,who:'unrelated',t:Date.now(),action:'(plain ETH transfer)',unrelated:true};   /* AN UNRELATED TRANSACTION of the same sender, mined now, while r stays pending */
    CH.txs.set(u.hash,u); mineInto(u,1); r.unrelatedHash=u.hash; logReq('staging','unrelated transaction mined',u.hash,'SIMULATED: another transaction of '+from+' (nonce '+u.nonce+') is mined in block '+u.block+'; '+r.hash.slice(0,10)+'… (nonce '+n+') stays pending'); }
  logTick(); return r; }
function mineInto(r,status){ const b=CH.head(); r.block=b; r.status=status; (CH.inBlock.get(b)||CH.inBlock.set(b,[]).get(b)).push(r); CH.spent.set(r.from,Math.max(CH.spent.get(r.from)||0,r.nonce+1)); }
const OUTCOMES={confirmed:'CONFIRMED',reverted:'REVERTED',sped:'SPED UP (same call, higher fee)',cancelled:'CANCELLED (0 ETH to yourself)',replaced:'REPLACED (another call)',replacedpaid:'REPLACED BY A WITHDRAWAL THAT PAID (the replacement withdrew what was owed)',unknown:'UNKNOWN (nonce spent, tx not found)',pending:'PENDING (decide later)'};
/* what the simulated contract does with a write that would be mined (STORMGLASS.sol: withdraw / withdrawTo require something owed and that the payee accept ETH):
   it reverts, whatever the wallet screen's button said. A reason, or null. */
function chainVerdict(r){ const a=r.action; if(a!=='withdraw'&&a!=='withdrawTo') return null; const v=owedOf(r.from); if(v===0n) return 'nothing owed (require "nothing owed")';
  if(a==='withdraw'&&SET.payer==='rejects') return 'the payer’s wallet rejects ETH (call failed)';
  if(a==='withdrawTo'){ const d=decode({data:r.data,value:r.value}); const to=lc(d.args[0]&&d.args[0].v||''); if(/^0x0{40}$/.test(to)) return 'zero address'; if(SET.recipient==='rejects') return 'the recipient rejects ETH (call failed)'; } return null; }
function txResolve(hash,outcome){ const r=CH.txs.get(hash); if(!r||r.state!=='pending'&&!(r.state==='unknown'&&outcome==='confirmed')) return false;
  if(outcome==='pending') return true;
  if(outcome==='confirmed'){ const why=chainVerdict(r); if(why){ r.why=why; outcome='reverted'; logReq('chain','revert',r.hash,'SIMULATED CONTRACT: '+r.action+' reverts: '+why); } }
  if(outcome==='confirmed'||outcome==='reverted'){ if(r.state==='unknown') r.late=true; mineInto(r,outcome==='confirmed'?1:0); r.state=outcome; if(outcome==='confirmed') effect(r); }
  else if(outcome==='unknown'){ r.state='unknown'; CH.spent.set(r.from,Math.max(CH.spent.get(r.from)||0,r.nonce+1)); }   /* spent by a transaction no reader can find */
  else { const x=Object.assign({},r,{hash:rnd32(),state:'mined',replaces:r.hash});
    if(outcome==='cancelled'){ x.to=r.from; x.data='0x'; x.value=0n; }
    if(outcome==='replaced'||outcome==='replacedpaid'){ x.data='0x3ccfd60b'; x.value=0n; x.action='withdraw'; }   /* withdraw(): another call to the same contract */
    /* REPLACED BY A WITHDRAWAL THAT PAID (audit 5b): the replacement is a withdraw() by the same sender that the simulated contract executes: it pays
       the sender everything owed at that moment (a revert when nothing is owed or the sender rejects ETH). The original is replaced, not mined. */
    /* audit 5b fix (a5v3): EVERY replacement that calls the contract runs on the simulated contract like any mined call: SPED UP (the same call) and
       REPLACED / REPLACED BY A WITHDRAWAL THAT PAID (withdraw()). chainVerdict decides it: a call that would revert is mined with status 0 and changes
       nothing (a sped-up withdrawTo to a recipient that rejects ETH, a withdraw() with nothing owed); one that runs has its effect (a replacement
       withdraw() pays the sender what is owed). A cancellation (0 ETH to the sender itself) calls nothing. */
    const runs=outcome!=='cancelled', why=runs?chainVerdict(x):null; if(why){ x.why=why; logReq('chain','revert',x.hash,'SIMULATED CONTRACT: the replacement '+x.action+' reverts: '+why); }
    CH.txs.set(x.hash,x); mineInto(x,why?0:1); r.state=outcome==='replacedpaid'?'replaced':outcome; r.by=x.hash; if(runs&&!why) effect(x); }
  logTick(); return true; }
function txSchedule(hash,outcome){ if(outcome==='pending') return; setTimeout(()=>txResolve(hash,outcome),Math.max(0,+SET.mine||0)); }
function decode(tx){ try{ const E=window.ethers, A=(typeof ABI!=='undefined')?ABI:SIM_ABI; const I=new E.Interface(A); const p=I.parseTransaction({data:tx.data||tx.input||'0x',value:BigInt(tx.value||0)}); return p?{name:p.name,args:p.fragment.inputs.map((x,i)=>({name:x.name||('arg'+i),type:x.type,v:String(p.args[i])})),sig:p.signature}:{name:'(no call data)',args:[]}; }catch(e){ return {name:(tx.data||'0x')==='0x'?'(plain ETH transfer)':'(not a STORMGLASS call: '+String(tx.data).slice(0,10)+')',args:[]}; } }
/* SEAT EARNINGS paid to the payer when it pays (buy, witness) or claims: _settleSeats then _pay. A wallet that accepts ETH receives them; one that
   rejects ETH leaves them in owed[] (WITHDRAW / WITHDRAW TO ANOTHER ADDRESS). Simulated amounts. */
function payTo(who,v,why){ if(v<=0n) return; S.received.set(who,(S.received.get(who)||0n)+v); S.payouts.push({to:who,v,why}); if(S.payouts.length>20) S.payouts.shift(); logReq('chain','payout',who,'SIMULATED: '+fmtEth(v)+' ETH sent to '+who+' ('+why+')'); }
function settleSeats(from){ const p=pendOf(from); S.pending.set(from,0n); if(p<=0n) return;
  if(SET.payer==='rejects'){ S.owed.set(from,owedOf(from)+p); S.payouts.push({to:from,v:p,why:'REJECTED: left in owed'}); logReq('chain','payout',from,'SIMULATED: the contract tried to send '+fmtEth(p)+' ETH of seat earnings to '+from+', the wallet rejects ETH: the amount is now OWED to it (owed[] += '+fmtEth(p)+')'); }
  else payTo(from,p,'seat earnings, the wallet accepts ETH'); }
function effect(r){ const a=r.action, d=decode({data:r.data,value:r.value}), from=r.from;
  if(a==='claim'||(SET.seatsPay&&(a==='buy'||a==='witness'))) settleSeats(from);   /* the payer's own earnings first (on the real contract buy and witness settle them too; here only after SCENARIOS 8 SET UP, so the earlier scenarios keep CLAIM available) */
  if(a==='buy'){ const id=Number(d.args[0]&&d.args[0].v), k=Number(d.args[1]&&d.args[1].v); const p=plate(id); p.sold=true; p.buyer=from; p.pick=k; p.price=r.value*10n/11n; if(id===S.today) S.lastId=S.today; }
  if(a==='witness'){ const p=plate(Number(d.args[0]&&d.args[0].v)); p.witnessed+=r.value; S.seats.set(from,(S.seats.has(from)?S.seats.get(from):eth(2))+r.value*E18/S.FOUNDING); }
  if(a==='withdraw'){ const v=owedOf(from); S.owed.set(from,0n); payTo(from,v,'withdraw: what was owed'); }
  if(a==='withdrawTo'){ const v=owedOf(from), to=lc(d.args[0]&&d.args[0].v||''); S.owed.set(from,0n); payTo(to,v,'withdrawTo: what was owed to '+from); }
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
/* TRANSACTION IDENTITY (CONTROLS · SCENARIOS 5): what the simulated readers (and, when chosen, the simulated wallet) answer to eth_getTransactionByHash about a simulated
   transaction. The page's trackTx takes the sender's nonce from that answer; it must be THIS transaction's. "other-*": an unrelated transaction of the same sender (a
   different hash; the same nonce and call, or the next nonce and a plain transfer, or a lower nonce already mined). "first-*": the reader the page asks first in a round
   answers an unusable object, and the next reader answers truly. The log lists which reader was asked and what it answered. */
const TXIDS={valid:'VALID (every reader)','other-same':'ALL READERS: ANOTHER TRANSACTION OF THE SENDER (different hash, same nonce, same call)','other-next':'ALL READERS: ANOTHER TRANSACTION OF THE SENDER (different hash, next nonce, plain transfer)','other-mined':'ALL READERS: AN UNRELATED TRANSACTION OF THE SENDER, MINED (lower nonce) while this one is pending','first-other':'FIRST READER: another transaction of the sender, then a valid fallback','first-mined':'FIRST READER: an unrelated MINED transaction of the sender, then a valid fallback','first-nohash':'FIRST READER: an answer with no hash, then a valid fallback','first-decimal':'FIRST READER: nonce as the decimal "7", then a valid fallback'};
function txAnswer(h,who,e){ const r=CH.txs.get(lc(h))||CH.txs.get(h), v=txView(h); if(!r) return v; const m=SET.txid||'valid', isW=who==null;
  const say=s=>{ if(e) e.result=s; else logReq('reader '+who,'eth_getTransactionByHash',h,s); };
  let how=null;
  if(isW){ if(SET.txidWallet&&/^(other-)/.test(m)) how=m==='other-next'?'next':m==='other-mined'?'mined':'same'; }
  else if(m==='other-same'||m==='other-next'||m==='other-mined') how=m==='other-next'?'next':m==='other-mined'?'mined':'same';
  else if(m.startsWith('first-')&&who===firstReader()) how=m==='first-other'?'same':m==='first-mined'?'mined':m==='first-nohash'?'nohash':'decimal';
  if(!how){ if(m!=='valid'&&v) say('answered the VALID transaction (hash '+v.hash.slice(0,10)+'…, nonce '+parseInt(v.nonce,16)+')'); return v; }
  let o=Object.assign({},v);
  if(how==='nohash'){ delete o.hash; say('answered a transaction with NO HASH (nonce '+parseInt(v.nonce,16)+')'); return o; }
  if(how==='decimal'){ o.nonce=String(parseInt(v.nonce,16)); say('answered with the nonce as the DECIMAL "'+o.nonce+'" (a JSON-RPC quantity must be hex)'); return o; }
  if(how==='mined'){ const u=r.unrelatedHash&&CH.txs.get(r.unrelatedHash); if(u){ o=txView(u.hash); say('answered ANOTHER transaction of the sender, MINED (hash '+o.hash.slice(0,10)+'…, nonce '+parseInt(o.nonce,16)+', block '+parseInt(o.blockNumber,16)+'), not '+v.hash.slice(0,10)+'…'); return o; } }
  o.hash=rnd32(); if(how==='next'){ o.nonce=hex(r.nonce+1); o.to=OTHER; o.input='0x'; o.value='0x0'; }
  say('answered ANOTHER transaction of the sender (hash '+o.hash.slice(0,10)+'…, nonce '+parseInt(o.nonce,16)+'), not '+v.hash.slice(0,10)+'… (nonce '+parseInt(v.nonce,16)+')'); return o; }
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
    case 'eth_getTransactionByHash': return ok(host==null?txView(p[0]):txAnswer(p[0],host));
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
    ['VALUE',fmtEth(tx.value)+' ETH'],['ACTION',d.name+(d.args.length?'('+d.args.map(a=>a.name+': '+a.v).join(', ')+')':'()')]].concat(d.name==='withdrawTo'?[['PAYS TO (recipient)',d.args[0]?d.args[0].v:'—'],['PAID FROM','what the contract owes the SENDER above; the sender’s wallet only authorises it']]:[],
    d.name==='withdrawTo'||d.name==='withdraw'?[['OWED NOW (simulated)',fmtEth(owedOf(lc(tx.from)))+' ETH: the contract pays all that is owed when the transaction executes (nothing owed: it reverts)']]:[],[['GAS LIMIT',tx.gas?String(BigInt(tx.gas)):'—']]); }
const kv=rows=>el('dl',{class:'sg-kv'},rows.map(([k,v])=>[el('dt',null,k),el('dd',null,v)]));
/* the chooser: REAL mode = the intercept; SIMULATION = the simulated wallet's confirmation screen. Resolves an outcome key. */
function chooser(tx,o){ if(SET.auto&&SET.auto!=='ask'&&!REAL) return Promise.resolve(SET.auto);
  return modal((box,done)=>{ box.classList.add(REAL?'sg-real':'sg-sim');
    box.append(el('div',{class:'sg-h'},REAL?'SUBMISSION INTERCEPTED: nothing was sent to your wallet':'SIMULATED WALLET · CONFIRMATION SCREEN'),
      el('p',{class:'sg-p'},REAL?'The page prepared this transaction and handed it to your wallet. The staging wrapper stopped it before your wallet (and, on a phone, before the WalletConnect relay): your wallet never saw it, nothing can be paid. Payments and signatures are intercepted here; the result you choose below is simulated. This checks how the page prepares a transaction and what it shows next. It does not test your wallet’s own payment screen, and on a phone it does not test delivery of a payment through the WalletConnect relay (in this mode the relay carries the connection only).':'This stands in for the wallet’s own confirmation screen ('+(o.who||'simulated wallet')+'). Choose what the wallet and the chain do.'),
      kv(txRows(tx,o.walletChain)),
      el('div',{class:'sg-h2'},'CHOOSE THE SIMULATED RESULT'),
      el('div',{class:'sg-btns'},[['confirmed','CONFIRMED'],['reverted','REVERTED'],['rejected','REJECTED IN WALLET'],['sped','SPED UP'],['cancelled','CANCELLED'],['replaced','REPLACED BY ANOTHER CALL'],...(/^withdraw(To)?$/.test(decode(tx).name)?[['replacedpaid','REPLACED BY A WITHDRAWAL THAT PAID']]:[]),['unknown','UNKNOWN'],['pending','PENDING · DECIDE LATER'],['error','WALLET ERROR (no answer)']]
        .map(([k,t])=>el('button',{class:'sg-b'+(k==='confirmed'?' sg-prime':''),'data-out':k,onclick:()=>done(k)},t))),
      el('p',{class:'sg-n'},'Results other than REJECTED and WALLET ERROR give the page a simulated transaction hash; the page’s own tracking (receipts, nonce scan, replacement check) then reads the simulated chain. Mining delay: '+(SET.mine/1000)+' s (CONTROLS). The page stays usable behind this panel, as it does behind a wallet window.')); },true); }
/* OWED CHANGES AFTER REVIEW (audit 5b, CONTROLS · SCENARIOS 7). The contract's withdraw / withdrawTo pay everything owed WHEN THE TRANSACTION EXECUTES
   (STORMGLASS.sol _withdraw: amount = owed[msg.sender], then owed = 0; nothing owed: revert "nothing owed"); the amount the page showed at REVIEW is a
   snapshot. CHANGE NOW changes the simulated owed[] of the connected account at once (the page's REVIEW sheet is open: before the wallet is asked);
   ARM changes it once, at the moment the wallet screen (REAL: the intercept panel) opens for a withdraw / withdrawTo. Simulated ETH only. */
const OWEDCHG={increase:'INCREASES (+0.05 ETH)',decrease:'DECREASES (to half)',zero:'BECOMES ZERO'};
let OWED_ARM=null;
const pageMe=()=>{ try{ return typeof me==='string'&&me?lc(me):null; }catch(e){ return null; } };   /* the page's connected account (its global, read at call time) */
function owedChange(kind,who,when){ const a=lc(who||pageMe()||(typeof connAcct==='function'?connAcct():'')||''); if(!/^0x[0-9a-f]{40}$/.test(a)||!OWEDCHG[kind]) return null;
  const was=owedOf(a), now=kind==='increase'?was+eth(0.05):kind==='decrease'?was/2n:0n; S.owed.set(a,now);
  logReq('chain','owed change',a,'SIMULATED: owed['+a+'] '+fmtEth(was)+' → '+fmtEth(now)+' ETH ('+OWEDCHG[kind]+', '+when+')'); logTick(); return {account:a,was:String(was),now:String(now),kind,when}; }
async function handleSend(tx,o){ if(OWED_ARM){ const n=decode(tx).name; if(n==='withdraw'||n==='withdrawTo'){ const k=OWED_ARM.kind; OWED_ARM=null; owedChange(k,tx.from,'armed: when the wallet screen opened'); } }
  const out=await chooser(tx,o); if(o.onChoice) o.onChoice(out);
  if(out==='rejected') throw err(4001,'User rejected the request.');
  if(out==='error') throw err(-32603,'Internal JSON-RPC error (simulated: the wallet gave no clear answer).');
  const r=txSubmit(tx,o.who); r.outcome=out; r.mode=REAL?'intercepted':'simulated'; txSchedule(r.hash,out); return r.hash; }
function signPanel(method,params,who){ return modal((box,done)=>{ box.classList.add(REAL?'sg-real':'sg-sim');
  const tx=TXM.has(method);
  box.append(el('div',{class:'sg-h'},REAL?(tx?'TRANSACTION REQUEST INTERCEPTED':'SIGNATURE REQUEST INTERCEPTED')+': nothing was sent to your wallet':'SIMULATED WALLET · '+(tx?'TRANSACTION':'SIGNATURE')+' REQUEST'),
    el('p',{class:'sg-p'},'Method '+method+' from '+(who||'the page')+'. The STORMGLASS page never asks for this; this staging page never forwards it: it is refused.'),kv([['METHOD',method],['PARAMS',brief(params)]]),
    el('div',{class:'sg-btns'},el('button',{class:'sg-b sg-prime',onclick:()=>done('refused')},'CLOSE · REFUSED'))); },true); }
/* ARMED: a WalletConnect pairing the visitor allowed (ASK MY WALLET on 'enable') lets the page's own eth_requestAccounts that follows it (within 20 s)
   through without a second gate. ONE request only (audit 5b): the arming is used up by it, and only a pairing arms; before, any eth_requestAccounts of that
   wallet within 20 s of an ASK MY WALLET (a reconnect right after DISCONNECT, say) reached the wallet without the gate. */
const ARMED=new WeakMap();
function gate(raw,who,method){ const t=ARMED.get(raw); if(method==='eth_requestAccounts'&&t&&Date.now()-t<20000){ ARMED.delete(raw); return Promise.resolve(true); }
  return modal((box,done)=>{ box.classList.add('sg-real');
    const what=method==='eth_requestAccounts'||method==='enable'?'Your wallet ('+who+') will now ask to connect this site. Approve or refuse it in the wallet.':'Your wallet ('+who+') will now ask to switch to Ethereum mainnet. Approve or refuse it in the wallet.';
    box.append(el('div',{class:'sg-h'},'REAL WALLET · THIS WILL OPEN YOUR WALLET'),el('p',{class:'sg-p'},what),
      el('p',{class:'sg-p','data-sg-explain':'gate'},'This is a real request to your real wallet'+(raw&&raw.isWalletConnect?', sent through the WalletConnect relay':'')+'. No payment and no signature can be sent from this page: transactions and signatures are intercepted at the staging wrapper before your wallet; their outcomes are simulated.'),
      el('div',{class:'sg-btns'},el('button',{class:'sg-b sg-prime','data-gate':'go',onclick:()=>{ if(method==='enable') ARMED.set(raw,Date.now()); done(true); }},'ASK MY WALLET'),el('button',{class:'sg-b','data-gate':'no',onclick:()=>done(false)},'CANCEL'))); }); }

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
/* the errors a wallet can answer eth_requestAccounts with (CONTROLS · SCENARIOS 6) */
const CONNERR={4001:'User rejected the request.',4100:'The requested account and/or method has not been authorized by the user.',4200:'The Provider does not support the requested method.',4900:'The Provider is disconnected from all chains.',4901:'The Provider is not connected to the requested chain.',[-32002]:'Request of type eth_requestAccounts already pending for origin. Please wait.',[-32603]:'Internal JSON-RPC error.'};
const callText=tx=>{ const d=decode(tx); return d.name+(d.args.length?'('+d.args.map(a=>a.v).join(', ')+')':'()')+' · from '+(tx.from||'—')+' · to '+(tx.to||'—')+' · value '+fmtEth(tx.value)+' ETH'+(tx.chainId!=null?' · chainId '+tx.chainId:''); };
function simWallet(c){ const L={}, st=Object.assign({chainId:'0x1',authorized:false,switch:'accept',connect:'approve',delay:0,asleep:false,ai:0,lastChain:'off',fired:0},c);
  const emit=(ev,...a)=>(L[ev]||[]).slice().forEach(f=>{ try{ f(...a); }catch(e){ console.error('listener',e); } });
  const acct=()=>st.accounts[st.ai%st.accounts.length], list=()=>st.authorized?[acct()].concat(st.accounts.filter(x=>x!==acct())):[];
  const lastMoment=async()=>{ const how=st.lastChain; st.armed=false; st.lastChain='off'; st.waitChain=true; st.chainOut=false;
    for(let i=0;i<200&&!st.chainOut;i++) await new Promise(r=>setTimeout(r,10));   /* the final check's eth_chainId has answered "0x1"… */
    await new Promise(r=>setTimeout(r,0)); st.waitChain=false;                      /* …and the page has read that answer */
    st.chainId='0x2105'; emit('chainChanged','0x2105'); if(how==='base-back'){ st.chainId='0x1'; emit('chainChanged','0x1'); }
    st.fired++; logReq(st.name,'chainChanged',how==='base-back'?['0x2105','0x1']:['0x2105'],'LAST-MOMENT NETWORK CHANGE (simulated): the final check was answered 0x1, then this was announced before the page could send'); logTick(); };
  const p={ request(args){ const method=args&&args.method, params=args&&args.params; const e=logReq(st.name,method,params,'simulated wallet');
      if(method==='eth_requestAccounts'&&st.connect==='fail'&&SET.connHow==='sync'){ const c=+SET.connFail||-32603; e.result='SYNC THROW '+c; throw err(c,CONNERR[c]||'Simulated wallet error'); }   /* a wallet that throws before it returns a promise */
      return (async()=>{ if(st.asleep) return new Promise(()=>{}); if(st.delay) await new Promise(r=>setTimeout(r,st.delay));
        switch(method){
          case 'eth_chainId': if(st.waitChain) st.chainOut=true; return st.chainId; case 'net_version': return String(parseInt(st.chainId,16));
          case 'eth_accounts': if(st.armed) await lastMoment(); return list();
          case 'eth_requestAccounts': { if(st.connect==='refuse'){ e.result='refused'; throw err(4001,'User rejected the request.'); }
            if(st.connect==='fail'){ const c=+SET.connFail||-32603; e.result='REJECTED PROMISE '+c; throw err(c,CONNERR[c]||'Simulated wallet error'); } const was=st.authorized; st.authorized=true; if(!was) setTimeout(()=>emit('accountsChanged',list()),0); return list(); }
          case 'wallet_switchEthereumChain': { if(st.switch==='refuse'){ e.result='refused'; throw err(4001,'User rejected the request.'); } const c=params&&params[0]&&params[0].chainId; if(c&&c!==st.chainId){ st.chainId=c; setTimeout(()=>emit('chainChanged',c),0); } return null; }
          case 'wallet_revokePermissions': { st.authorized=false; setTimeout(()=>emit('accountsChanged',[]),0); return null; }
          case 'eth_estimateGas': if(st.lastChain==='base'||st.lastChain==='base-back'){ st.armed=true; st.chainOut=false; } return '0x30d40'; case 'eth_blockNumber': return hex(CH.head()); case 'eth_gasPrice': return '0x3b9aca00'; case 'eth_maxPriorityFeePerGas': return '0x1';
          case 'eth_getTransactionByHash': return txAnswer(params[0],null,e); case 'eth_getTransactionReceipt': return rcView(params[0]);
          case 'eth_call': return callSim((params[0]||{}).to,(params[0]||{}).data||'0x'); case 'eth_getBlockByNumber': return block(params[0],!!params[1]); case 'eth_getLogs': return [];
          case 'eth_sendTransaction': { if(!st.authorized) throw err(4100,'Unauthorized'); const tx=Object.assign({},params[0]); if(!tx.from) tx.from=acct(); e.call=callText(tx);
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
  /* audit 5, SCENARIOS 6: a phone inside a wallet app. window.ethereum (the app's own wallet, ALPHA) fails eth_requestAccounts the way CONTROLS says; the second wallet (BETA,
     announced over EIP-6963) is ALREADY AUTHORISED, so any request that reaches it would answer without a prompt: the page must not send it one until the visitor picks it. */
  if(pre==='phone2') ws=[mk(W('ALPHA','SIM ALPHA (the app’s own wallet)','sim.staging.alpha','#c8ff3a',{announce:false,flags:{isMetaMask:true},authorized:true,connect:'fail',accounts:[addr('a11'),addr('a12')]})),mk(W('BETA','SIM BETA (a second wallet, already authorised)','sim.staging.beta','#ff9a1f',{authorized:true,accounts:[addr('b01'),addr('b02')]}))];
  if(pre==='desk3'||pre==='desk1'||pre==='inapp'||pre==='phone2') SIM_ETH=ws[0].p;
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
    if((method==='eth_getTransactionByHash'||method==='eth_getTransactionReceipt')&&params&&CH.txs.has(lc(params[0]))){ const e0=logReq(who,method,params,'answered by staging (a simulated hash)'); return method==='eth_getTransactionByHash'?txAnswer(params[0],null,e0):rcView(params[0]); }
    if(GATED.has(method)&&!(await gate(raw,who,method))){ logReq(who,method,params,'cancelled at the staging gate (wallet not asked)'); throw err(4001,'Cancelled on the staging page: your wallet was not asked.'); }
    const e=logReq(who,method,params,'FORWARDED to your wallet');
    try{ const r=await raw.request(params===undefined?{method}:{method,params}); e.result=brief(r); return r; }catch(x){ e.result='error '+(x&&x.code); throw x; } }
  if(LOCAL.has(method)){ logReq(who,method,params,'answered by staging (not forwarded)'); return '0x30d40'; }
  if(method==='eth_sendTransaction'){ const e=logReq(who,method,params,'INTERCEPTED (not forwarded)'); const tx=Object.assign({},params&&params[0]); try{ e.call=callText(tx); }catch(x){}
    let wc=null; try{ wc=await Promise.race([raw.request({method:'eth_chainId'}),new Promise(r=>setTimeout(()=>r(null),1500))]); logReq(who,'eth_chainId',null,'FORWARDED to your wallet (for the intercept panel)'); }catch(x){}
    const h=await handleSend(tx,{who,walletChain:wc,onChoice:o=>{ e.result=o; }}); e.result+=' '+h.slice(0,10); return h; }
  if(TXM.has(method)||SIGNM.has(method)){ logReq(who,method,params,'INTERCEPTED (not forwarded)'); await signPanel(method,params,who); throw err(4001,'Refused on the staging page: '+method+' is never sent to your wallet.'); }
  logReq(who,method,params,'REFUSED (not on the allowlist)'); throw err(4200,'Staging: '+method+' is not on this page’s allowlist; your wallet was not asked.'); }
function wrap(raw,who){ if(!raw||(typeof raw!=='object'&&typeof raw!=='function')) return raw; if(ISW.has(raw)) return raw; const had=WRAP.get(raw); if(had) return had;
  if(who) RAWNAME.set(raw,who); const name=()=>RAWNAME.get(raw)||(raw.isRabby?'Rabby':raw.isMetaMask?'MetaMask':raw.isWalletConnect?'WalletConnect':'browser wallet');
  const w={}; const L=new Map();
  const def=(k,v)=>Object.defineProperty(w,k,{value:v,enumerable:true});
  def('request',args=>guard(raw,name(),args));
  /* listeners run with `this` = the wrapper (audit 5b): an EventEmitter-style wallet calls a listener with this = the emitter, the RAW
     provider, which would hand page code the unguarded object. One stand-in per (listener, event), so removeListener still finds it. */
  const lis=(ev,f)=>{ if(typeof f!=='function') return f; let m=L.get(f); if(!m){ m=new Map(); L.set(f,m); } let g=m.get(ev); if(!g){ g=function(...a){ return f.apply(w,a); }; m.set(ev,g); } return g; };
  const on=k=>(ev,f)=>{ try{ (raw[k]||raw.on).call(raw,ev,lis(ev,f)); }catch(e){ console.warn('staging: wallet events',e); } return w; };
  def('on',on('on')); def('addListener',on('addListener')); def('once',on('once'));
  def('removeListener',(ev,f)=>{ try{ (raw.removeListener||raw.off).call(raw,ev,lis(ev,f)); }catch(e){} return w; }); def('off',w.removeListener);
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
    const facade={client:{on:(ev,f)=>{ if(ev!=='session_request_sent'||typeof f!=='function') return; try{ raw.signer.client.on(ev,function(...a){ return f.apply(facade.client,a); }); }catch(e){} }}}; def('signer',facade);
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
  txs:()=>[...CH.txs.values()].map(r=>({hash:r.hash,from:r.from,to:r.to,value:String(r.value),data:r.data,action:r.action,state:r.state,outcome:r.outcome||null,by:r.by,mode:r.mode||null,replaces:r.replaces||null,why:r.why||null,unrelated:!!r.unrelated,nonce:r.nonce})),
  configure(o){ Object.assign(SET,o||{}); saveConf(); if(o&&'clock' in o) applyClock(); logTick(); },
  txids:TXIDS, connErrors:CONNERR, owedOf:a=>String(owedOf(lc(a))), receivedOf:a=>String(S.received.get(lc(a))||0n), payouts:()=>S.payouts.map(p=>({to:p.to,v:String(p.v),why:p.why})),
  receipts:RECEIPTS, clocks:CLOCKS, lastChains:LASTCHAIN, track:trackNow, held:()=>HELD.slice(), navHold:()=>NAV_HOLD,
  owedArm:()=>OWED_ARM?OWED_ARM.kind:null, owedChanges:OWEDCHG, realNote:REALNOTE,
  wcEmit:k=>{ const w=SW.PHONE; return !!(w&&w.wcEmit&&w.wcEmit(k)); }, wcReqs:()=>SW.PHONE&&SW.PHONE.wch?SW.PHONE.wch.reqs.map(r=>({id:r.ev.id,topic:r.ev.topic,method:r.request.method})):[],
  /* CONTROLS · SCENARIOS: each SET UP puts the simulated wallets and the chain in the state the scenario needs (logged) */
  scenario(k,v){ let r=true;
    if(k==='lastchain'){ const how=LASTCHAIN[v]&&v!=='off'?v:'base-back'; Object.keys(SW).forEach(id=>{ const w=SW[id]; if(!w.st.asleep){ w.st.lastChain=how; w.st.armed=false; if(w.st.chainId!=='0x1') SG.wallet(id,{chainId:'0x1'}); } }); r=how; }
    else if(k==='switch'){ const id=CONF.preset==='wc'?'PHONE':SW.ALPHA?'ALPHA':Object.keys(SW)[0]; Object.values(SW).forEach(w=>{ w.st.lastChain='off'; w.st.armed=false; }); SG.wallet(id,{chainId:'0x2105',switch:'accept'}); SET.auto='ask'; saveConf(); r=id; }
    else if(k==='wc'){ SG.configure({wcEvent:['exact','earlier','oldtopic','foreign','none'].includes(v)?v:'earlier'}); r=SET.wcEvent; }
    else if(k==='receipts'){ const m=RECEIPTS[v]?v:'first-hash'; SG.configure(m==='all'?{receipts:m,clock:'fast'}:{receipts:m}); r=m; }
    else if(k==='txid'){ const m=TXIDS[v]?v:'other-same'; SG.configure({txid:m}); r=m; }
    else if(k==='owed'){ const x=+v; S.owed.clear(); S.received.clear(); S.payouts.length=0; SG.configure({owed:x>=0?x:0.05}); r=SET.owed; }
    else if(k==='payer'){ const m=v==='rejects'?'rejects':'accepts'; S.owed.clear(); S.pending.clear(); S.received.clear(); S.payouts.length=0; SG.configure({payer:m,owed:0,seatsPay:true}); r=m; }
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
/* audit 5b fix: the page's wallet sheet is modal: while it is open every other top-level element of the page is inert. The staging chrome (the
   banner with CONTROLS and MODE, the CONTROLS drawer, the note, the simulated wallet screen) is not part of the page under test: it stays usable over
   the sheet, as the scenarios need (SCENARIO 3 emits relay events from CONTROLS while the CONFIRM sheet is open; SCENARIO 7 changes the account or
   network while the withdrawal review is open). Only top-level elements whose id starts with "sg-" are released; the page's own stay inert. */
function stagingLive(){ if(stagingLive.on||!document.body) return; stagingLive.on=1;
  const free=el=>{ if(el&&el.parentNode===document.body&&/^sg-/.test(el.id||'')&&el.inert) el.inert=false; };
  new MutationObserver(rs=>rs.forEach(r=>free(r.target))).observe(document.body,{subtree:true,attributes:true,attributeFilter:['inert']});
  [...document.body.children].forEach(free); }
function ui(){ stagingLive(); const B=document.getElementById('sg-banner'); if(!B||B.dataset.on) return; B.dataset.on='1'; B.textContent=''; document.body.classList.add('sg-stage',REAL?'sg-mode-real':'sg-mode-sim');
  B.setAttribute('role','region'); B.setAttribute('aria-label','Test build');
  B.append(el('b',{class:'sg-tb'},'TEST BUILD'),el('span',{class:'sg-mode'},el('span',{class:'sg-long'},REAL?'REAL WALLET — CONNECTION TEST':'SIMULATION'),el('span',{class:'sg-short'},REAL?'REAL WALLET TEST':'SIMULATION')),(()=>{ const f=el('span',{class:'sg-fast',id:'sg-fast',title:'The tracking deadlines are shortened on this page (CONTROLS · TRACKING)'},'FAST CLOCK'); f.hidden=SET.clock!=='fast'; return f; })(),
    el('span',{class:'sg-rev',title:'candidate index.html: git '+STAMP.rev+' (index.html last changed in '+STAMP.touched+') · sha256 '+STAMP.sha256},'candidate ',el('code',{id:'sg-rev'},STAMP.rev),' · sha256 ',el('code',{id:'sg-sha'},STAMP.sha256.slice(0,12))),
    el('span',{class:'sg-sp'}),el('button',{class:'sg-bb',id:'sg-ctl',onclick:()=>drawer()},'CONTROLS'),el('button',{class:'sg-bb',id:'sg-modebtn',onclick:()=>modeSheet()},'MODE'));
  document.body.appendChild(el('div',{id:'sg-note',role:'status'}));
  if(REAL) setTimeout(()=>note(REALNOTE),400); }
function modeSheet(){ modal((box,done)=>{ box.classList.add(REAL?'sg-real':'sg-sim');
  box.append(el('div',{class:'sg-h'},'CHOOSE THE TEST MODE'),
    el('div',{class:'sg-mo'+(REAL?'':' on')},el('b',null,'SIMULATION (default)'),el('p',{'data-sg-explain':'mode-sim'},'Simulated wallets and simulated results, inside this page: no real wallet, no real provider. Your real wallet is never visible to the page, and the WalletConnect phone pairing is simulated too (no relay connection). Every result (confirmed, reverted, rejected, sped up, cancelled, replaced, unknown) and every delay can be chosen. Nothing leaves this page for Ethereum.')),
    el('div',{class:'sg-mo'+(REAL?' on':'')},el('b',null,'REAL WALLET — CONNECTION TEST'),el('p',{'data-sg-explain':'mode-real'},'Your real wallet (MetaMask, Rabby, Zerion… or WalletConnect on a phone) is contacted for real, for the connection: the page checks its account and network, your wallet asks to connect this site and maybe to switch network (each only after you press ASK MY WALLET here), and DISCONNECT reaches it. On a phone this is a real connection to the WalletConnect relay: pairing, the session, account and network changes, disconnect. Payments and signatures are intercepted: every transaction, signature, batched call, raw transaction or user operation stops at the staging wrapper, before your wallet and before the relay, and is shown to you; any other request is refused. Outcomes are simulated: you pick the result, and the sale and every transaction result come from the simulated chain. So this mode does not test your wallet’s own payment screen, nor delivery of a payment through the WalletConnect relay.')),
    el('p',{class:'sg-n'},'Changing mode reloads the page into a clean state: no wallet connection, no pending transaction and no simulated state carries over.'),
    el('div',{class:'sg-btns'},el('button',{class:'sg-b'+(REAL?'':' sg-prime'),'data-mode':'sim',onclick:()=>{ done(); if(REAL) SG.switchMode('sim'); }},REAL?'RELOAD IN SIMULATION':'STAY IN SIMULATION'),
      el('button',{class:'sg-b'+(REAL?' sg-prime':''),'data-mode':'real',onclick:()=>{ done(); if(!REAL) SG.switchMode('real'); }},REAL?'STAY IN REAL-WALLET MODE':'RELOAD IN REAL-WALLET MODE'),el('button',{class:'sg-b',onclick:()=>done()},'CLOSE'))); }); }
const s1Status=()=>{ const armed=Object.values(SW).filter(w=>w.st.lastChain&&w.st.lastChain!=='off').length; let i=-1; for(let k=LOG.length-1;k>=0;k--) if(/LAST-MOMENT/.test(LOG[k].route)){ i=k; break; }
  return (armed?'ARMED ('+armed+' wallets, one shot)':'not armed')+(i<0?'':' · last change fired; eth_sendTransaction since: '+LOG.slice(i+1).filter(e=>e.method==='eth_sendTransaction').length); };
const connAcct=()=>{ const w=Object.values(SW).find(x=>x.st.authorized); return w?w.acct():null; };
const LIVE={ owedchg:()=>{ const a=pageMe()||connAcct(); return (OWED_ARM?'ARMED: '+OWEDCHG[OWED_ARM.kind]+' · ':'')+(a?'owed now '+fmtEth(owedOf(lc(a)))+' ETH (simulated)':'not connected'); },
  owed:()=>{ const a=connAcct(); return 'owed to '+(a?a.slice(0,8)+'…':'every account')+': '+fmtEth(a?owedOf(lc(a)):eth(+SET.owed||0))+' ETH (simulated) · recipient '+(SET.recipient||'accepts')+' ETH'; },
  pay:()=>{ const a=connAcct(); const last=S.payouts.slice(-1).map(p=>'last payout '+fmtEth(p.v)+' ETH → '+p.to.slice(0,8)+'… ('+(/^REJECTED/.test(p.why)?'refused, left owed':'paid')+')').join(''); return 'payer '+(SET.payer||'accepts')+' ETH'+(a?' · owed '+fmtEth(owedOf(lc(a)))+' · received '+fmtEth(S.received.get(lc(a))||0n):'')+(last?' · '+last:''); } };
let DR=null; const SHOWP=/^(open link|session_request_sent|chainChanged|scenario |eth_getTransactionReceipt)/;
function drawer(){ if(DR){ DR.remove(); DR=null; logTick=()=>{}; return; }
  DR=el('aside',{id:'sg-drawer','aria-label':'Staging controls'}); document.body.appendChild(DR);
  const sec=(t,...k)=>el('section',{class:'sg-sec'},el('h4',null,t),...k);
  const seg=(opts,cur,fn,attr)=>el('div',{class:'sg-seg'},opts.map(([k,t])=>el('button',{class:'sg-s'+(k===cur?' on':''),[attr||'data-k']:k,onclick:e=>{ fn(k); [...e.target.parentNode.children].forEach(b=>b.classList.toggle('on',b===e.target)); }},t)));
  const num=(lab,v,fn,step)=>el('label',{class:'sg-num'},lab,el('input',{type:'number',value:String(v),step:String(step||100),min:'0',onchange:e=>fn(+e.target.value)}));
  const body=el('div',{class:'sg-db'}); DR.append(el('div',{class:'sg-dh'},el('b',null,'STAGING CONTROLS · '+(REAL?'REAL WALLET':'SIMULATION')),el('button',{class:'sg-bb',onclick:()=>drawer()},'CLOSE')),body);
  body.append(sec('WHAT IS REAL HERE',el('p',{class:'sg-n','data-sg-explain':REAL?'drawer-real':'drawer-sim'},REAL?'REAL: your wallet extension or WalletConnect phone wallet, its accounts, its network; on a phone the WalletConnect relay (opened when you press CONNECT; it carries the pairing, the session, account and network changes and disconnect); connect and network switches (each after ASK MY WALLET), disconnect / revocation, account and network changes made in the wallet. INTERCEPTED: payments and signatures: every transaction, signature, batched call, raw transaction and user operation stops at the staging wrapper; your wallet and the relay never receive one. Unknown requests are refused. SIMULATED: the sale, the plates’ chain data, every transaction outcome, gas estimates. TESTS: the automated tests run this page with every socket and outside host blocked and mocked wallets; that is the test machine, not this page: opened in a real browser, this mode does contact the WalletConnect relay.':'SIMULATED: every wallet, every account, the network each wallet is on, the WalletConnect phone pairing, the sale state, the plates’ chain data, blocks, receipts, every transaction result. REAL: the page code itself (index.html candidate '+STAMP.rev+') and the plate artwork files it loads from this site. No request leaves this page for an Ethereum node, a wallet or the WalletConnect relay.')));
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
  /* SCENARIOS (audit 5): nonce identity, explicit wallet choice on a phone, WITHDRAW TO ANOTHER ADDRESS, payout outcomes. SET UP, then the clicks on the page itself. */
  const SCN5=[];
  { const [tSeg,tV]=pickSet('txid',Object.entries(TXIDS),SET.txid||'valid'); const [wSeg,wV]=pickSet('txidwallet',[['0','THE WALLET’S OWN ANSWER IS VALID'],['1','THE WALLET ANSWERS THE SAME WAY']],SET.txidWallet?'1':'0');
    SCN5.push(scn(5,'WHOSE TRANSACTION IS THIS? (nonce identity)',el('div',null,tSeg,wSeg,el('div',{class:'sg-row'},el('button',{class:'sg-s sg-go','data-setup':'txid',onclick:()=>{ SG.configure({txidWallet:wV()==='1'}); SG.scenario('txid',tV()); }},'SET UP'),el('span',{class:'sg-st'},'now: '+(SET.txid||'valid')+(SET.txidWallet?' · wallet too':'')))),
      ['Choose what the simulated readers answer to eth_getTransactionByHash (and whether the simulated wallet, the page’s last resort, answers the same way), then SET UP.',REAL?'CONNECT your wallet (ASK MY WALLET), COLLECT or WITNESS: the payment is intercepted.':'CONNECT (SIM ALPHA · 1), COLLECT or WITNESS.','In the wallet screen choose PENDING · DECIDE LATER (or SPED UP, CANCELLED, REPLACED, CONFIRMED).','Open CONTROLS · LOG: every reader the page asked, and what it answered.','With PENDING, resolve it later in TRANSACTIONS AND TRACKING (CONFIRMED).'],
      'the page never says replaced, cancelled or confirmed on account of the sender’s other transaction: it stays pending (and “cannot confirm” much later), then confirms from its own receipt. A real SPED UP / CANCELLED / REPLACED is still recognised when a valid answer (a later reader, or the wallet) names the nonce.')); }
  if(!REAL){ const [eSeg,eV]=pickSet('connfail',Object.keys(CONNERR).map(c=>[c,c==='4001'?'4001 (refused)':c]),String(SET.connFail)); const [hSeg,hV]=pickSet('connhow',[['async','REJECTED PROMISE'],['sync','SYNCHRONOUS THROW']],SET.connHow||'async');
    SCN5.push(scn(6,'A PHONE WALLET FAILS TO CONNECT: CHOOSE ANOTHER WALLET',el('div',null,eSeg,hSeg,el('div',{class:'sg-row'},el('button',{class:'sg-s sg-go','data-setup':'phone2',onclick:()=>{ SG.configure({connFail:eV(),connHow:hV()}); SG.preset('phone2'); SG.reloadSim(); }},CONF.preset==='phone2'?'SET UP (reloads)':'SET UP (reloads as a phone in a wallet app)'),el('span',{class:'sg-st'},'wallet set: '+(PRESETS[CONF.preset]||'').slice(0,34)+'… · error '+SET.connFail+' ('+SET.connHow+')'))),
      ['SET UP: the page reloads as a phone inside a wallet app (navigator.userAgent reads iPhone + MetaMask, here only) with two simulated wallets, both already authorised: SIM ALPHA (window.ethereum) fails with the chosen error, SIM BETA is the second wallet.','Press CONNECT. SIM ALPHA fails.','The page shows YOUR WALLET DID NOT CONNECT with CHOOSE ANOTHER WALLET (not for 4001 and -32002: those are answers).','Open CONTROLS · LOG: SIM BETA shows no request. Press CHOOSE ANOTHER WALLET, then SIM BETA: only now does SIM BETA get eth_requestAccounts, and it connects.'],
      'no request reaches SIM BETA (or any wallet but SIM ALPHA) before you pick it; after the pick exactly one eth_requestAccounts reaches SIM BETA. In REAL mode the same path stops at the staging gate (ASK MY WALLET) before any other wallet is asked.')); }
  { const [oSeg,oV]=pickSet('owed',[['0','OWES NOTHING'],['0.05','OWES 0.05 ETH'],['0.5','OWES 0.5 ETH']],String(SET.owed||0)); const [rSeg2,rV2]=pickSet('recipient',[['accepts','RECIPIENT ACCEPTS ETH'],['rejects','RECIPIENT REJECTS ETH']],SET.recipient||'accepts');
    const conn=()=>Object.values(SW).find(w=>w.st.authorized);
    const [ocSeg,ocV]=pickSet('owedchg',Object.entries(OWEDCHG),'increase');
    SCN5.push(scn(7,'WITHDRAW TO ANOTHER ADDRESS',el('div',null,oSeg,rSeg2,el('div',{class:'sg-row'},el('button',{class:'sg-s sg-go','data-setup':'owed',onclick:()=>{ SG.configure({recipient:rV2()}); SG.scenario('owed',oV()); }},'SET UP'),el('span',{class:'sg-st','data-live':'owed'},'')),
        el('div',{class:'sg-row'},'before the wallet is asked: ',...(REAL?[]:[el('button',{class:'sg-s','data-act':'account',onclick:()=>{ const w=conn(); if(!w) return note('Connect a simulated wallet first.'); SG.wallet(Object.keys(SW).find(k=>SW[k]===w),{ai:w.st.ai+1}); }},'ACCOUNT CHANGES'),el('button',{class:'sg-s','data-act':'network',onclick:()=>{ const w=conn(); if(!w) return note('Connect a simulated wallet first.'); SG.wallet(Object.keys(SW).find(k=>SW[k]===w),{chainId:'0x2105',switch:'refuse'}); }},'NETWORK GOES TO BASE (and refuses to switch back)')])),
        /* audit 5b: what is owed changes after REVIEW (the review amount is a snapshot; the contract pays all owed when the transaction executes) */
        el('div',{class:'sg-row'},'after REVIEW, what is owed: ',ocSeg),
        el('div',{class:'sg-row'},el('button',{class:'sg-s','data-act':'owed-now',onclick:()=>{ const r=owedChange(ocV(),null,'now: before the wallet is asked'); if(!r) return note('Connect a wallet first: the change applies to the connected account.'); note('SIMULATED: owed '+fmtEth(BigInt(r.was))+' → '+fmtEth(BigInt(r.now))+' ETH for '+r.account.slice(0,8)+'…'); }},'CHANGE NOW (before the wallet is asked)'),
          el('button',{class:'sg-s','data-act':'owed-arm',onclick:()=>{ OWED_ARM={kind:ocV()}; logReq('staging','owed change armed',ocV(),'ARMED: '+OWEDCHG[ocV()]+', when the '+(REAL?'intercept panel':'wallet screen')+' opens for a withdrawal'); note('ARMED: what is owed '+OWEDCHG[ocV()]+', when the '+(REAL?'intercept panel':'wallet screen')+' opens.'); }},REAL?'ARM: WHEN THE INTERCEPT PANEL OPENS':'ARM: WHEN THE WALLET SCREEN OPENS'),
          el('span',{class:'sg-st','data-live':'owedchg'},''))),
      ['SET UP: the simulated contract owes every account that amount (and the recipient accepts or rejects ETH).',REAL?'CONNECT your wallet (ASK MY WALLET).':'CONNECT (SIM ALPHA · 1).','Under YOUR SEATS press WITHDRAW TO ANOTHER ADDRESS, type an address, press REVIEW. Try 0x000…0 (zero), a short string, the contract address, your own address: the page refuses each with its message.','With a valid address: REVIEW shows the sheet; for “before the wallet is asked” press ACCOUNT CHANGES or NETWORK GOES TO BASE now, then SEND TO THIS ADDRESS: nothing is sent.','Otherwise SEND TO THIS ADDRESS: the wallet screen (REAL: the intercept panel) shows withdrawTo and the recipient. CONFIRMED (REJECTS ETH turns it into a revert, as the contract would), REVERTED, REJECTED IN WALLET.',
       'What is owed changes after REVIEW: choose INCREASES, DECREASES or BECOMES ZERO; with the review sheet open press CHANGE NOW (before the wallet is asked), or press ARM before SEND TO THIS ADDRESS (it changes when the '+(REAL?'intercept panel':'wallet screen')+' opens). Then CONFIRMED. The panel’s OWED NOW row shows the amount the contract will pay.',
       'REPLACED BY A WITHDRAWAL THAT PAID (in the '+(REAL?'intercept panel':'wallet screen')+'): your wallet replaced this transaction with a withdraw() that the simulated contract executes; it pays what is owed.'],
      'one eth_sendTransaction: withdrawTo(recipient), from the connected account, to the contract, value 0. Confirmed: owed back to 0 and the button goes. Recipient rejects ETH: “Failed on Ethereum (reverted)”, the box stays for another address. Account or network change before the handoff: nothing sent. Owed changes after REVIEW: the recipient is still the one reviewed; the contract pays what is owed when it executes (more, or less, than the review said); BECOMES ZERO: it reverts (“nothing owed”), nothing is paid. Replaced by a withdrawal that paid: the page must not say the original amount is still owed (LOG: “payout”, “owed change”).')); }
  { const [pSeg,pV]=pickSet('payer',[['accepts','THE PAYER’S WALLET ACCEPTS ETH'],['rejects','THE PAYER’S WALLET REJECTS ETH']],SET.payer||'accepts');
    SCN5.push(scn(8,'SEAT EARNINGS WHEN THE PAYER PAYS: ARRIVE, OR WAIT AS OWED',el('div',null,pSeg,el('div',{class:'sg-row'},el('button',{class:'sg-s sg-go','data-setup':'payer',onclick:()=>SG.scenario('payer',pV())},'SET UP'),el('span',{class:'sg-st','data-live':'pay'},''))),
      ['SET UP: every account has seats and 0.0364 ETH of earnings pending (simulated), owes nothing, and has received nothing.',REAL?'CONNECT your wallet (ASK MY WALLET).':'CONNECT (SIM ALPHA · 1).','COLLECT (or WITNESS, or CLAIM) and choose CONFIRMED in the wallet screen.','Read the line next to SET UP and the LOG: “payout”.'],
      'ACCEPTS: the earnings arrive in the wallet (SIMULATED ETH, shown here and in the LOG) and the seats note shows nothing owed. REJECTS: the contract could not pay it; the amount is OWED, the seats note says so and WITHDRAW / WITHDRAW TO ANOTHER ADDRESS appear (WITHDRAW reverts for a wallet that rejects ETH, WITHDRAW TO ANOTHER ADDRESS to an accepting address confirms). All amounts are simulated.')); }
  body.append(sec('SCENARIOS (audit 5)',...SCN5));
  body.append(sec('SCENARIOS (audit 4)',...SCN,REAL?el('p',{class:'sg-n'},'The last-moment network change, the intended switch and the WalletConnect event scenarios need the simulated wallets: use SIMULATION (MODE). Your real wallet can of course change network itself while a payment is prepared; the page then stops before your wallet, as in simulation.'):null));
  body.append(sec('SALE (simulated chain)',seg(Object.entries(SALES).map(([k,t])=>[k,t]),S.sale,k=>setSale(k),'data-sale'),
    num('hours since the day opened (OPEN / SOLD)',3,h=>setSale(S.sale==='sold'?'sold':'open',h),0.5)));
  if(!REAL){
    const wl=el('div');
    const draw=()=>{ wl.innerHTML=''; Object.keys(SW).filter(id=>id!=='PHONE'||CONF.preset==='wc').forEach(id=>{ const w=SW[id]; if(!w) return; const s=SG.wallet(id);
      wl.append(el('div',{class:'sg-w','data-w':id},el('div',{class:'sg-wn'},s.name+' ['+id+'] · '+(s.authorized?'connected '+s.account.slice(0,8)+'…':'not connected')),
        seg([['0x1','MAINNET'],['0x2105','BASE']],s.chainId,k=>{ SG.wallet(id,{chainId:k}); draw(); },'data-chain'),
        seg([['accept','SWITCH: ACCEPT'],['refuse','SWITCH: REFUSE']],s.switch,k=>SG.wallet(id,{switch:k}),'data-switch'),
        seg([['approve','CONNECT: APPROVE'],['refuse','CONNECT: REFUSE'],['fail','CONNECT: ERROR (SCENARIOS 6)']],s.connect,k=>SG.wallet(id,{connect:k}),'data-connect'),
        el('div',{class:'sg-row'},'last-moment network change: ',seg(Object.entries(LASTCHAIN),s.lastChain||'off',k=>SG.wallet(id,{lastChain:k,armed:false}),'data-lc')),
        el('div',{class:'sg-row'},el('button',{class:'sg-s',onclick:()=>{ SG.wallet(id,{ai:(w.st.ai+1)}); draw(); }},'NEXT ACCOUNT'),el('button',{class:'sg-s',onclick:()=>{ SG.walletDisconnects(id); setTimeout(draw,50); }},'WALLET DISCONNECTS'),
          num('answer delay ms',s.delay,v=>SG.wallet(id,{delay:v}))))); }); };
    draw();
    body.append(sec('SIMULATED WALLETS',el('label',{class:'sg-num'},'set of wallets (reloads the page) ',el('select',{onchange:e=>{ SG.preset(e.target.value); SG.reloadSim(); }},Object.entries(PRESETS).map(([k,t])=>{ const o=el('option',{value:k},t); if(k===CONF.preset) o.selected=true; return o; }))),wl));
  } else {
    body.append(sec('YOUR WALLET: WHAT MAY REACH IT',el('p',{class:'sg-n'},'Forwarded (default-deny allowlist): '+[...FORWARD].join(', ')+'. eth_requestAccounts and wallet_switchEthereumChain only after you press ASK MY WALLET. Answered here, never forwarded: '+[...LOCAL].join(', ')+'. Stopped and shown, never forwarded: '+POLICY.TX.concat(POLICY.SIGN).join(', ')+'. Anything else: refused (4200), never forwarded. WalletConnect (phone): CONNECT opens the real relay connection (EthereumProvider.init; a session this site stored is restored; no request to the phone yet); the pairing waits for ASK MY WALLET; DISCONNECT ends the session; inside the WalletConnect bundle every send or sign request is refused too.')));
  }
  body.append(sec('TRANSACTIONS AND TRACKING',!REAL?el('label',{class:'sg-num'},'simulated wallet answers ',el('select',{onchange:e=>SG.configure({auto:e.target.value})},[['ask','ASK ME EACH TIME']].concat(Object.entries(OUTCOMES).map(([k,t])=>[k,'ALWAYS '+t]),[['rejected','ALWAYS REJECTED IN WALLET'],['error','ALWAYS WALLET ERROR']]).map(([k,t])=>{ const o=el('option',{value:k},t); if(k===SET.auto) o.selected=true; return o; }))):null,
    num('mining delay ms (after the result is chosen)',SET.mine,v=>SG.configure({mine:v})),num('reader latency ms (each JSON-RPC answer)',SET.readerMs,v=>SG.configure({readerMs:v}),50),
    el('div',{class:'sg-row'},'first reader (publicnode): ',seg([['up','UP'],['down','DOWN (503)']],SET.firstReaderDown?'down':'up',k=>SG.configure({firstReaderDown:k==='down'}))),
    el('label',{class:'sg-num'},'receipts the readers give ',el('select',{'data-ctl':'receipts',onchange:e=>SG.configure({receipts:e.target.value})},Object.entries(RECEIPTS).map(([k,t])=>{ const o=el('option',{value:k},t); if(k===(SET.receipts||'valid')) o.selected=true; return o; }))),
    el('div',{class:'sg-row'},'tracking clock: ',seg([['normal','NORMAL'],['fast','FAST (staging only)']],SET.clock==='fast'?'fast':'normal',k=>SG.configure({clock:k}),'data-clock')),
    el('p',{class:'sg-n'},CLOCKS.normal+'. '+CLOCKS.fast+'. FAST changes only these three numbers of the page’s own TRACK object, on this page; the tracking code is the page’s.'),
    el('div',{id:'sg-txs'})));
  body.append(sec('LOG: WALLET REQUESTS, READER RECEIPTS, EVENTS, HELD LINKS (newest first)',el('ol',{id:'sg-log',class:'sg-log'})));
  logTick=()=>{ if(!DR) return; const s1=document.getElementById('sg-s1st'); if(s1) s1.textContent=s1Status();
    DR.querySelectorAll('[data-live]').forEach(n=>{ n.textContent=LIVE[n.dataset.live]?LIVE[n.dataset.live]():''; }); const L=document.getElementById('sg-log'); if(L){ L.innerHTML=''; LOG.slice(-60).reverse().forEach(e=>L.append(el('li',{class:/INTERCEPT|REFUSED/.test(e.route)?'x':/FORWARD/.test(e.route)?'f':''},el('b',null,e.method),' · '+e.who+' · '+e.route+(e.result?' · '+e.result:'')+(e.call?' · CALL '+e.call:'')+(SHOWP.test(e.method)&&e.params&&e.params!=='null'?' · '+e.params:'')))); }
    const T=document.getElementById('sg-txs'); if(T){ T.innerHTML=''; [...CH.txs.values()].filter(r=>!r.replaces).slice(-8).reverse().forEach(r=>T.append(el('div',{class:'sg-tx'},el('code',null,r.hash.slice(0,10)+'… '+r.action+' · '+r.state+(r.by?' → '+r.by.slice(0,10)+'…':'')),
      r.state==='pending'||r.state==='unknown'?el('div',{class:'sg-row'},(r.state==='unknown'?[['confirmed','LATE RECEIPT: CONFIRMED']]:Object.entries(OUTCOMES).filter(([k])=>k!=='pending'&&(k!=='replacedpaid'||/^withdraw/.test(r.action)))).map(([k,t])=>el('button',{class:'sg-s',onclick:()=>{ txResolve(r.hash,k); }},t.split(' (')[0]))):null))); } };
  logTick(); }
const start=()=>{ ui(); pump(); applyClock(); };
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
