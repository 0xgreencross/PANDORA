/* THE AUDIT-4 CASES (audit/wallet-4-fix). Loaded by wallet.test.js (every audit4*.test.js is group @audit4). Same mocks, same fake chain:
   nothing real is touched (no wallet, no RPC, no relay).
   a4c  FINDING A: a chainChanged event seen after the last look's chain answer, before eth_sendTransaction is handed to the wallet.
   a4w  FINDING B: WalletConnect session_request_sent events and the CONFIRM sheet's OPEN link (which request, which session).
   a4r  FINDING C: malformed or foreign receipts must never give a definitive outcome (confirmed / reverted / replaced ...).
   Every regression asserts that its gate or trigger was reached (gate hit, event emitted, receipt actually read), so a case cannot
   pass because the race never happened. */
const H=require('./wallet.test.js');
const {T,connect,sheetOpen,clickSheet,disconnectUI,openWit,closeWit,popText,sleep,DONE,A1,A2,B1}=H;
const one=(...a)=>H.one(...a);
const IPHONE={ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',viewport:{width:390,height:844},mobile:true};
const NOTSENT=/Nothing was sent/i;
const toastsSince=async(E,n)=>(await E.toasts()).slice(n);
const fillWit=async(E,amt)=>{ await closeWit(E.page); await openWit(E.page); await E.page.fill('#wAmt',amt); };
const pressWit=E=>E.page.click('#bWit');
async function openOpt(E,k){ await closeWit(E.page); await E.page.evaluate(k=>{ if(!NX.pop) document.getElementById('bPick').click(); document.querySelectorAll('#candGrid .card')[k].click(); },k); await E.page.waitForSelector('#ccBuy'); }
const pressCollect=E=>E.page.evaluate(()=>document.getElementById('ccBuy').click());
const asked=(E,id,m)=>E.page.evaluate(([id,m])=>__MW.log.filter(x=>x.pid===id&&x.method===m).map(x=>({chain:x.chain,params:x.params})),[id,m]);
const track=(E,o)=>E.page.evaluate(o=>{ Object.assign(TRACK,o); },o);
const hex=n=>'0x'+n.toString(16);

/* ════════ FINDING A: the chain in the final submission gap ════════
   armChain(E,id): wraps the mock provider's request. Once armed, after the operation's last look (opCheck asks eth_accounts, then
   eth_chainId), the chain event chosen by MODE is delivered k microtasks after that eth_chainId answer:
     base: the wallet moves to Base (its eth_chainId says 0x2105 from then on) and emits chainChanged 0x2105
     flip: chainChanged 0x2105 then 0x1 (mainnet -> Base -> mainnet; eth_chainId keeps answering 0x1)
     main: chainChanged 0x1 only (a late announcement of the operation's own switch to mainnet)
   Every eth_sendTransaction REQUEST (the mock log, not only what went through) is recorded with the row k and whether the event
   had already been delivered when the page invoked the provider. */
const armChain=(E,id)=>E.page.evaluate(id=>{ const P=__MW.P[id], p=P.provider, orig=p.request.bind(p);
  window.__C={mode:'base',k:0,armed:false,next:false,emitted:false,sent:[]};
  const fire=mode=>{ if(mode==='base'){ P.set({chainId:'0x2105'}); P.emit('chainChanged','0x2105'); } else if(mode==='flip'){ P.emit('chainChanged','0x2105'); P.emit('chainChanged','0x1'); } else P.emit('chainChanged','0x1'); };
  p.request=args=>{ const C=window.__C, m=args&&args.method;
    if(m==='eth_sendTransaction'){ const q=args.params&&args.params[0]||{}; C.sent.push({k:C.k,afterEvent:C.emitted,chainId:q.chainId,from:q.from}); }
    if(C.armed&&m==='eth_accounts') C.next=true;
    const r=orig(args);
    if(C.armed&&C.next&&m==='eth_chainId'){ C.next=false; C.armed=false; const k=C.k, mode=C.mode;
      r.then(()=>{ let q=Promise.resolve(); for(let i=0;i<k;i++) q=q.then(()=>{}); q.then(()=>{ C.emitted=true; fire(mode); }); }); }
    return r; }; },id);
/* one witness payment per row k = 0..K; the row ends when the request was made or the page said nothing was sent */
async function sweep(E,mode,K,startChain){ const rows=[];
  for(let k=0;k<=K;k++){
    if(startChain){ await E.P('A').set({chainId:startChain}); await E.P('A').emit('chainChanged',startChain); await sleep(250); }
    await E.page.evaluate(([k,mode])=>{ const C=window.__C; C.k=k; C.mode=mode; C.emitted=false; C.next=false; C.armed=true; },[k,mode]);
    const s0=await E.page.evaluate(()=>__C.sent.length), n=(await E.toasts()).length; await fillWit(E,'0.01'); await pressWit(E);
    await E.until(async()=>(await E.page.evaluate(()=>__C.sent.length))>s0||(await toastsSince(E,n)).some(x=>NOTSENT.test(x)),6000); await sleep(350);
    const C=await E.page.evaluate(()=>({emitted:__C.emitted,sent:__C.sent.length}));
    const t=await toastsSince(E,n);
    rows.push({k,emitted:C.emitted,requests:C.sent-s0,stopMsg:(t.find(x=>NOTSENT.test(x))||'').slice(0,80)});
    /* back to mainnet for the next row (an event naming mainnet) */
    await E.P('A').set({chainId:'0x1'}); await E.P('A').emit('chainChanged','0x1'); await sleep(300); }
  const C=await E.page.evaluate(()=>__C);
  /* the stop must cover every microtask up to the request: the stopped rows are exactly the ones whose event came first */
  const firstSent=rows.findIndex(r=>r.requests>0), contiguous=firstSent<0||rows.slice(firstSent).every(r=>r.requests===1);
  return {rows,C,firstSent,contiguous}; }
const rowsTxt=rows=>rows.map(r=>r.k+':'+(r.requests?'req':'stop')+(r.emitted?'':'(no event)')).join(' ');

T('a4c1','the wallet moves to Base k = 0..14 microtasks after the last look\'s chain answer: no eth_sendTransaction is requested after that event, every such row stops with "Nothing was sent"',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await armChain(E,'A'); const S=await sweep(E,'base',14);
  const bad=S.C.sent.filter(x=>x.afterEvent), stopped=S.rows.filter(r=>!r.requests);
  return {pass:bad.length===0&&S.rows.every(r=>r.emitted)&&stopped.length>0&&stopped.every(r=>r.stopMsg)&&S.contiguous&&S.C.sent.every(x=>x.chainId==='0x1'),
    ev:{requestsAfterTheEvent:bad.map(x=>x.k),rows:rowsTxt(S.rows),stopMsgs:[...new Set(stopped.map(r=>r.stopMsg))]}}; });

T('a4c2','mainnet -> Base -> mainnet k = 0..14 microtasks after the last look\'s chain answer (eth_chainId still says mainnet): no eth_sendTransaction after the events',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await armChain(E,'A'); const S=await sweep(E,'flip',14);
  const bad=S.C.sent.filter(x=>x.afterEvent), stopped=S.rows.filter(r=>!r.requests);
  return {pass:bad.length===0&&S.rows.every(r=>r.emitted)&&stopped.length>0&&stopped.every(r=>r.stopMsg)&&S.contiguous,
    ev:{requestsAfterTheEvent:bad.map(x=>x.k),rows:rowsTxt(S.rows),stopMsgs:[...new Set(stopped.map(r=>r.stopMsg))]}}; });

T('a4c3','mainnet -> Base -> mainnet while the wallet estimates gas: the payment stops before eth_sendTransaction, "Nothing was sent"',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await E.P('A').set({gate:{eth_estimateGas:true}}); const n=(await E.toasts()).length; await fillWit(E,'0.01'); await pressWit(E);
  const g=await E.waitGate('A','eth_estimateGas',6000);
  await E.P('A').emit('chainChanged','0x2105'); await E.P('A').emit('chainChanged','0x1'); await sleep(150);
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_estimateGas');
  await E.until(async()=>(await toastsSince(E,n)).some(x=>NOTSENT.test(x))||(await asked(E,'A','eth_sendTransaction')).length>0,6000); await sleep(800);
  const req=await asked(E,'A','eth_sendTransaction'), t=await toastsSince(E,n);
  return {pass:g&&req.length===0&&t.some(x=>NOTSENT.test(x))&&(await E.sends()).length===0, ev:{gateHit:g,sendRequests:req.length,toasts:t.slice(-2)}}; });

T('a4c4','the wallet moves to Base while the last look\'s eth_accounts is still unanswered (its chain answer already said mainnet): nothing is requested',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); const acc0=(await asked(E,'A','eth_accounts')).length;
  await E.P('A').set({gate:{eth_accounts:true}}); const n=(await E.toasts()).length; await fillWit(E,'0.01'); await pressWit(E);
  const g=await E.waitGate('A','eth_accounts',6000); await sleep(150);
  /* the last look's eth_chainId was asked together with eth_accounts and has been answered (mainnet) */
  const chainAnswered=await E.page.evaluate(n=>{ const L=__MW.log.filter(x=>x.pid==='A'); const i=L.map(x=>x.method).lastIndexOf('eth_accounts'); return i>=0&&L.slice(i+1).some(x=>x.method==='eth_chainId'&&x.chain==='0x1'); });
  await E.P('A').set({chainId:'0x2105'}); await E.P('A').emit('chainChanged','0x2105'); await sleep(150);
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_accounts');
  await E.until(async()=>(await toastsSince(E,n)).some(x=>NOTSENT.test(x))||(await asked(E,'A','eth_sendTransaction')).length>0,6000); await sleep(800);
  const req=await asked(E,'A','eth_sendTransaction'), t=await toastsSince(E,n), lab=await E.label();
  return {pass:g&&chainAnswered&&req.length===0&&t.some(x=>NOTSENT.test(x))&&/\[!\]/.test(lab), ev:{gateHit:g,lastLookChainAnswered:chainAnswered,sendRequests:req.map(x=>x.chain+' '+(x.params&&x.params[0]&&x.params[0].chainId)),toasts:t.slice(-2),label:lab,accountsAsked:(await asked(E,'A','eth_accounts')).length-acc0}}; });

T('a4c5','guard: chain events from the wallet used before (A, disconnected) while B\'s payment is being prepared do not stop B: one request, on mainnet, from B',{wallets:[one('A'),one('B')]},async E=>{
  await connect(E,/WALLET A/); await disconnectUI(E); await sleep(300); await connect(E,/WALLET B/);
  await E.P('B').set({gate:{eth_estimateGas:true}}); const n=(await E.toasts()).length; await fillWit(E,'0.01'); await pressWit(E);
  const g=await E.waitGate('B','eth_estimateGas',6000);
  await E.P('A').set({chainId:'0x2105'}); await E.P('A').emit('chainChanged','0x2105'); await E.P('A').emit('chainChanged','0xa4b1'); await sleep(150);
  await E.P('B').set({gate:{}}); await E.P('B').release('eth_estimateGas');
  await E.until(async()=>(await asked(E,'B','eth_sendTransaction')).length>0||(await toastsSince(E,n)).some(x=>NOTSENT.test(x)),6000); await sleep(600);
  const rb=await asked(E,'B','eth_sendTransaction'), ra=await asked(E,'A','eth_sendTransaction'), t=await toastsSince(E,n);
  return {pass:g&&rb.length===1&&ra.length===0&&rb[0].params[0].chainId==='0x1'&&(rb[0].params[0].from||'').toLowerCase()===B1&&!t.some(x=>NOTSENT.test(x)), ev:{gateHit:g,requestsB:rb.length,requestsA:ra.length,toasts:t.slice(-2)}}; });

T('a4c6','guard: the payment\'s own switch (Base -> mainnet) still goes through when its mainnet chainChanged events come late (during gas estimation, and 0..10 microtasks after the last look)',{wallets:[one('A','0x2105')],ethereum:'A'},async E=>{
  await connect(E); await armChain(E,'A');
  /* part 1: two late mainnet announcements while the wallet estimates gas */
  await E.P('A').set({gate:{eth_estimateGas:true}}); const n=(await E.toasts()).length; await fillWit(E,'0.01'); await pressWit(E);
  const g=await E.waitGate('A','eth_estimateGas',8000); await E.P('A').emit('chainChanged','0x1'); await E.P('A').emit('chainChanged','0x1'); await sleep(100);
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_estimateGas');
  await E.until(async()=>(await E.page.evaluate(()=>__C.sent.length))>0||(await toastsSince(E,n)).some(x=>NOTSENT.test(x)),6000); await sleep(500);
  const part1=await E.page.evaluate(()=>__C.sent.length), t1=await toastsSince(E,n);
  /* part 2: each row starts on Base, the page switches, and a mainnet announcement lands k microtasks after the last look */
  const sw0=(await asked(E,'A','wallet_switchEthereumChain')).length;
  const S=await sweep(E,'main',10,'0x2105');
  const sw=(await asked(E,'A','wallet_switchEthereumChain')).length-sw0, all=await asked(E,'A','eth_sendTransaction');
  return {pass:g&&part1===1&&!t1.some(x=>NOTSENT.test(x))&&S.rows.every(r=>r.emitted&&r.requests===1)&&sw===11&&all.length===12&&all.every(x=>x.params[0].chainId==='0x1'),
    ev:{gateHit:g,part1Requests:part1,part1Toasts:t1.slice(-2),rows:rowsTxt(S.rows),switchesAsked:sw,requests:all.length}}; });

T('a4c7','guard: a chain change AFTER the hand-off: the page does not claim it stopped or can cancel the request the wallet holds; it follows the transaction',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await track(E,{poll:400}); await E.P('A').set({gate:{eth_sendTransaction:true}}); const n=(await E.toasts()).length; await fillWit(E,'0.01'); await pressWit(E);
  const g=await E.waitGate('A','eth_sendTransaction',6000);
  await E.P('A').set({chainId:'0x2105'}); await E.P('A').emit('chainChanged','0x2105'); await sleep(200);
  await fillWit(E,'0.02'); await pressWit(E); await sleep(300); const busy=(await toastsSince(E,n)).slice(-1)[0]||'';
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_sendTransaction');
  const sent=await E.until(async()=>(await toastsSince(E,n)).some(x=>/: sent \(/.test(x)),6000);
  const conf=await E.until(async()=>(await toastsSince(E,n)).some(x=>DONE.test(x)),15000);
  const t=await toastsSince(E,n), req=await asked(E,'A','eth_sendTransaction');
  return {pass:g&&req.length===1&&/in your wallet now/i.test(busy)&&sent&&conf&&!t.some(x=>NOTSENT.test(x)||/stopped|cancelled/i.test(x)), ev:{gateHit:g,requests:req.length,busy,sent,confirmed:conf,toasts:t.slice(-4)}}; });

/* ════════ FINDING B: WalletConnect session_request_sent ════════
   The fake WalletConnect provider is built as the shipped /wc.js builds its objects (read in wc.js):
   - EthereumProvider.request(args) -> UniversalProvider.request: getProvider(ns).request({request:{...args}, chainId, topic:this.session.topic})
     (a shallow copy: the event's request.params IS the params array the page passed);
   - the eip155 provider hands eth_sendTransaction to client.request(e); the engine makes the id (clientRpcId) itself, publishes, then
     client.events.emit('session_request_sent',{topic,request,chainId,id});
   - wallet_switchEthereumChain goes through handleSwitchChain, which builds a NEW request object {method,params:[{chainId}]};
   - provider.session is the session (its topic); the page sees it as P.session.topic.
   Clicking OPEN navigates: the test answers the wallet link with 204 (the page stays) and records the URL. */
async function wcKit(E){ E.jumps=[];
  await E.page.route('https://link.zerion.io/**',r=>{ E.jumps.push(r.request().url()); r.fulfill({status:204,body:''}); });
  await E.page.evaluate(()=>{ localStorage.setItem('SG_WC_APP',JSON.stringify({name:'ZERION',href:'https://link.zerion.io'}));
    window.__K={
      mk(topic){ const ev={h:{},on(n,f){ (this.h[n]=this.h[n]||[]).push(f); },emit(n,x){ (this.h[n]||[]).forEach(f=>f(x)); }};
        const P={reqs:[],signer:{client:ev},request(a){ const q={a,done:false}; P.reqs.push(q); return new Promise((res,rej)=>{ q.res=v=>{ q.done=true; res(v); }; q.rej=e=>{ q.done=true; rej(e); }; }); }};
        if(topic) P.session={topic}; return P; },
      /* the event the engine emits for P's i-th request */
      ev(P,i,id,o){ return Object.assign({id,topic:P.session&&P.session.topic,request:Object.assign({},P.reqs[i].a),chainId:'eip155:1'},o||{}); },
      /* the event for a network switch: handleSwitchChain's own new request object */
      evSwitch(P,i,id){ const a=P.reqs[i].a; return {id,topic:P.session&&P.session.topic,request:{method:a.method,params:[{chainId:a.params[0].chainId}]},chainId:'eip155:1'}; },
      send(P,x){ P.signer.client.emit('session_request_sent',x); },
      ask(P,m,params){ const k={settled:false,val:null,err:null}; ask(P,m,params).then(v=>{ k.settled=true; k.val=v; },e=>{ k.settled=true; k.err=String(e&&e.message||e); }); return k; },
      st(){ const b=document.querySelector('#wsBtns button'); return {on:document.getElementById('wsheet').classList.contains('on'),disabled:b?b.disabled:null,text:document.getElementById('wsp').textContent}; },
      close(){ document.getElementById('wsX').click(); } };
  }); }
/* the URL OPEN goes to now (null when OPEN does nothing: asleep, or no sheet) */
async function openLink(E){ const n=E.jumps.length; const clicked=await E.page.evaluate(()=>{ const b=document.querySelector('#wsheet.on #wsBtns button'); if(!b||b.disabled) return false; b.click(); return true; });
  if(!clicked) return null; await E.until(async()=>E.jumps.length>n,3000); return E.jumps.length>n?E.jumps[E.jumps.length-1]:null; }
const ZL='https://link.zerion.io/wc', exact=(id,topic)=>ZL+'?requestId='+id+'&sessionTopic='+topic;
const asleep=s=>s.on&&s.disabled===true&&/one moment/.test(s.text);

T('a4w1','WalletConnect: an eth_sendTransaction event of another session (other topic) does not wake OPEN; the event of this request does, with its own id and topic',{wallets:[]},async E=>{
  await wcKit(E);
  const r=await E.page.evaluate(()=>{ const K=__K, P=K.mk('T1'); _WC=P; wcHook(P); const out={}; const k=K.ask(P,'eth_sendTransaction',[{to:'0x01'}]); out.start=K.st();
    K.send(P,{id:41,topic:'T9',request:{method:'eth_sendTransaction',params:[{to:'0x01'}]},chainId:'eip155:1'}); out.foreign=K.st();
    window.__P=P; window.__k=k; return out; });
  const linkForeign=r.foreign.disabled?null:await openLink(E);
  await E.page.evaluate(()=>__K.send(__P,__K.ev(__P,0,42))); const after=await E.page.evaluate(()=>__K.st()); const link=await openLink(E);
  return {pass:asleep(r.start)&&r.foreign.disabled===true&&linkForeign===null&&after.disabled===false&&/in ZERION now/.test(after.text)&&link===exact(42,'T1'), ev:{start:r.start,afterForeign:r.foreign,linkForeign,after,link}}; },IPHONE);

T('a4w2','WalletConnect: after reconnecting, events of the old provider and of the old session (same method) do not touch the new prompt',{wallets:[]},async E=>{
  await wcKit(E);
  const r=await E.page.evaluate(()=>{ const K=__K, out={};
    /* (a) a second provider object (wcInit0's retry makes one) */
    const P1=K.mk('T1'); _WC=P1; wcHook(P1); const k1=K.ask(P1,'eth_sendTransaction',[{n:1}]); K.close();
    const P2=K.mk('T2'); _WC=P2; wcHook(P2); const k2=K.ask(P2,'eth_sendTransaction',[{n:2}]); out.p2start=K.st();
    K.send(P1,K.ev(P1,0,51)); out.afterOldProvider=K.st();
    K.send(P2,{id:52,topic:'T1',request:{method:'eth_sendTransaction',params:[{n:1}]},chainId:'eip155:1'}); out.afterOldTopic=K.st();
    window.__P=P2; window.__k1=k1; return out; });
  const linkStale=r.afterOldTopic.disabled?null:await openLink(E);
  await E.page.evaluate(()=>__K.send(__P,__K.ev(__P,0,53))); const linkA=await openLink(E);
  /* (b) the same provider object re-paired: its session topic changes; a delayed event of the request made in the old session */
  const r2=await E.page.evaluate(()=>{ const K=__K, out={}; __P.reqs[0].res('0x'+'aa'.repeat(32));
    const P=K.mk('S1'); _WC=P; wcHook(P); K.ask(P,'eth_sendTransaction',[{n:3}]); K.close(); P.session={topic:'S2'};
    K.ask(P,'eth_sendTransaction',[{n:4}]); out.start=K.st(); K.send(P,K.ev(P,0,61,{topic:'S1'})); out.afterOld=K.st(); window.__P=P; return out; });
  const linkStale2=r2.afterOld.disabled?null:await openLink(E);
  await E.page.evaluate(()=>__K.send(__P,__K.ev(__P,1,62))); const linkB=await openLink(E);
  const k1=await E.page.evaluate(()=>({settled:__k1.settled}));
  return {pass:asleep(r.p2start)&&r.afterOldProvider.disabled===true&&r.afterOldTopic.disabled===true&&linkStale===null&&linkA===exact(53,'T2')
      &&asleep(r2.start)&&r2.afterOld.disabled===true&&linkStale2===null&&linkB===exact(62,'S2')&&k1.settled===false,
    ev:{a:r,linkStale,linkA,b:r2,linkStale2,linkB,oldRequestCancelled:k1.settled}}; },IPHONE);

T('a4w3','WalletConnect: a delayed event for an earlier request (its sheet closed, still pending) while a newer eth_sendTransaction prompt is open does not wake it; the newer request\'s own event does',{wallets:[]},async E=>{
  await wcKit(E);
  const r=await E.page.evaluate(()=>{ const K=__K, P=K.mk('T'); _WC=P; wcHook(P); const out={};
    const k1=K.ask(P,'eth_sendTransaction',[{n:1}]); K.close(); out.closed=K.st();
    const k2=K.ask(P,'eth_sendTransaction',[{n:2}]); out.start=K.st();
    K.send(P,K.ev(P,0,111)); out.afterEarlier=K.st(); window.__P=P; window.__k1=k1; return out; });
  const linkEarly=r.afterEarlier.disabled?null:await openLink(E);
  await E.page.evaluate(()=>__K.send(__P,__K.ev(__P,1,222))); const link=await openLink(E);
  const k1=await E.page.evaluate(()=>({settled:__k1.settled,done:__P.reqs[0].done}));
  return {pass:!r.closed.on&&asleep(r.start)&&r.afterEarlier.disabled===true&&linkEarly===null&&link===exact(222,'T')&&!k1.settled&&!k1.done, ev:{r,linkEarly,link,firstRequest:k1}}; },IPHONE);

T('a4w4','WalletConnect: duplicate events: the same event twice keeps the link; a conflicting second event for the same request never replaces the request id',{wallets:[]},async E=>{
  await wcKit(E);
  await E.page.evaluate(()=>{ const K=__K, P=K.mk('T'); _WC=P; wcHook(P); K.ask(P,'eth_sendTransaction',[{n:1}]); const e=K.ev(P,0,5); K.send(P,e); K.send(P,e); window.__P=P; });
  const l1=await openLink(E);
  await E.page.evaluate(()=>__K.send(__P,__K.ev(__P,0,6))); const l2=await openLink(E), st=await E.page.evaluate(()=>__K.st());
  return {pass:l1===exact(5,'T')&&l2!==null&&l2!==exact(6,'T')&&(l2===exact(5,'T')||l2===ZL)&&!/in ZERION now/.test(l2===ZL?st.text:'')&&E.errors.length===0, ev:{afterDuplicate:l1,afterConflicting:l2,text:st.text}}; },IPHONE);

T('a4w5','WalletConnect: unrelated methods and malformed events never wake OPEN; after 8 s OPEN only opens the wallet (no request id) and the text does not claim the request is there',{wallets:[]},async E=>{
  await wcKit(E);
  const r=await E.page.evaluate(()=>{ const K=__K, P=K.mk('T'); _WC=P; wcHook(P); const pr=[{n:1}]; K.ask(P,'eth_sendTransaction',pr); const q=P.reqs[0].a, out={start:K.st(),woke:[]};
    const evs=[null,undefined,42,'x',{},{request:null},{id:1,topic:'T'},{id:2,topic:'T',request:{method:'personal_sign',params:q.params}},
      {id:'7',topic:'T',request:{method:'eth_sendTransaction',params:q.params}},{id:-1,topic:'T',request:{method:'eth_sendTransaction',params:q.params}},
      {id:1.5,topic:'T',request:{method:'eth_sendTransaction',params:q.params}},{id:9,topic:123,request:{method:'eth_sendTransaction',params:q.params}},
      {id:10,topic:'T',request:{method:'eth_sendTransaction',params:JSON.parse(JSON.stringify(q.params))}},{id:11,topic:'T',request:{method:'eth_sendTransaction'}}];
    evs.forEach((x,i)=>{ try{ K.send(P,x); }catch(e){ out.woke.push('throw '+i); } if(K.st().disabled!==true) out.woke.push(i); });
    window.__P=P; return out; });
  await sleep(8300); const st=await E.page.evaluate(()=>__K.st()), link=await openLink(E);
  return {pass:asleep(r.start)&&r.woke.length===0&&st.on&&st.disabled===false&&link===ZL&&/No word yet/.test(st.text)&&!/in ZERION now/.test(st.text)&&E.errors.length===0, ev:{woke:r.woke,after8s:st,link}}; },IPHONE);

T('a4w6','guard: the correct current event wakes OPEN with this request\'s id and session topic; closing the sheet cancels nothing (the request answers later)',{wallets:[]},async E=>{
  await wcKit(E);
  const r=await E.page.evaluate(()=>{ const K=__K, P=K.mk('t0pic'); _WC=P; wcHook(P); const k=K.ask(P,'eth_sendTransaction',[{n:1}]); const out={start:K.st()};
    K.send(P,K.ev(P,0,1730000000123456)); out.after=K.st(); window.__P=P; window.__k=k; return out; });
  const link=await openLink(E);
  const c=await E.page.evaluate(async()=>{ __K.close(); const closed=__K.st(); const before={settled:__k.settled,done:__P.reqs[0].done}; __P.reqs[0].res('0x'+'11'.repeat(32)); await new Promise(r=>setTimeout(r,50)); return {closed,before,val:__k.val}; });
  return {pass:asleep(r.start)&&r.after.disabled===false&&/in ZERION now/.test(r.after.text)&&link===exact(1730000000123456,'t0pic')&&!c.closed.on&&!c.before.settled&&!c.before.done&&c.val==='0x'+'11'.repeat(32), ev:{r,link,c}}; },IPHONE);

T('a4w7','WalletConnect: close and reopen: an event that arrives after its sheet was closed opens nothing; re-delivered while the next request\'s sheet is open it does not wake that one',{wallets:[]},async E=>{
  await wcKit(E);
  const r=await E.page.evaluate(()=>{ const K=__K, P=K.mk('T'); _WC=P; wcHook(P); const out={};
    K.ask(P,'eth_sendTransaction',[{n:1}]); K.close(); K.send(P,K.ev(P,0,71)); out.afterClosedEvent=K.st();
    K.ask(P,'eth_sendTransaction',[{n:2}]); out.reopened=K.st(); K.send(P,K.ev(P,0,71)); out.afterRedelivered=K.st(); window.__P=P; return out; });
  const linkOld=r.afterRedelivered.disabled?null:await openLink(E);
  await E.page.evaluate(()=>__K.send(__P,__K.ev(__P,1,72))); const link=await openLink(E);
  return {pass:!r.afterClosedEvent.on&&asleep(r.reopened)&&r.afterRedelivered.disabled===true&&linkOld===null&&link===exact(72,'T'), ev:{r,linkOld,link}}; },IPHONE);

T('a4w8','WalletConnect: an event that arrives after its request was answered changes nothing, also not the next same-method prompt',{wallets:[]},async E=>{
  await wcKit(E);
  const r=await E.page.evaluate(async()=>{ const K=__K, P=K.mk('T'); _WC=P; wcHook(P); const out={};
    const k1=K.ask(P,'eth_sendTransaction',[{n:1}]); P.reqs[0].res('0x'+'22'.repeat(32)); await new Promise(r=>setTimeout(r,30)); out.answered=K.st(); out.val=k1.val;
    K.send(P,K.ev(P,0,81)); out.afterLate=K.st();
    K.ask(P,'eth_sendTransaction',[{n:2}]); out.next=K.st(); K.send(P,K.ev(P,0,81)); out.nextAfterLate=K.st(); window.__P=P; return out; });
  const linkOld=r.nextAfterLate.disabled?null:await openLink(E);
  await E.page.evaluate(()=>__K.send(__P,__K.ev(__P,1,82))); const link=await openLink(E);
  return {pass:!r.answered.on&&r.val==='0x'+'22'.repeat(32)&&!r.afterLate.on&&asleep(r.next)&&r.nextAfterLate.disabled===true&&linkOld===null&&link===exact(82,'T'), ev:{r,linkOld,link}}; },IPHONE);

T('a4w9','WalletConnect: two network-switch requests one after the other, the first one\'s event delayed: it does not wake the second; a switch cannot be matched to its event, so OPEN after 8 s only opens the wallet',{wallets:[]},async E=>{
  await wcKit(E);
  const r=await E.page.evaluate(async()=>{ const K=__K, P=K.mk('T'); _WC=P; wcHook(P); const out={};
    const s1=K.ask(P,'wallet_switchEthereumChain',[{chainId:'0x1'}]); P.reqs[0].res(null); await new Promise(r=>setTimeout(r,30)); out.firstDone=s1.settled;
    K.ask(P,'wallet_switchEthereumChain',[{chainId:'0x1'}]); out.start=K.st();
    K.send(P,K.evSwitch(P,0,91)); out.afterFirst=K.st(); K.send(P,K.evSwitch(P,1,92)); out.afterOwn=K.st(); window.__P=P; return out; });
  const linkEarly=r.afterFirst.disabled?null:await openLink(E);
  await sleep(8300); const st=await E.page.evaluate(()=>__K.st()), link=await openLink(E);
  return {pass:r.firstDone&&asleep(r.start)&&r.afterFirst.disabled===true&&linkEarly===null&&st.disabled===false&&link===ZL&&/No word yet/.test(st.text), ev:{r,linkEarly,after8s:st,link}}; },IPHONE);

T('a4w10','WalletConnect: no session topic to check against (exact correlation cannot be established): a plausible event gives no request-specific link; after 8 s OPEN only opens the wallet, with the honest text',{wallets:[]},async E=>{
  await wcKit(E);
  const r=await E.page.evaluate(()=>{ const K=__K, P=K.mk(null); _WC=P; wcHook(P); K.ask(P,'eth_sendTransaction',[{n:1}]); const out={start:K.st()};
    K.send(P,Object.assign(K.ev(P,0,101),{topic:'T'})); out.after=K.st(); window.__P=P; return out; });
  const linkEarly=r.after.disabled?null:await openLink(E);
  await sleep(8300); const st=await E.page.evaluate(()=>__K.st()), link=await openLink(E);
  return {pass:asleep(r.start)&&r.after.disabled===true&&linkEarly===null&&link===ZL&&/No word yet that the request reached ZERION/.test(st.text), ev:{r,linkEarly,after8s:st,link}}; },IPHONE);

/* ════════ FINDING C: receipts ════════
   The page's own trackTx(op, hash, tell) is driven directly (as n6 drives parseAmount): op = {acct, req, block, P} as OpSigner leaves
   it; the mainnet readers are the fake chain (fakechain.js), whose answers the case sets per hash, per read, or per reader (route).
   A row expected 'pending' must still be pending after its malformed receipt was READ at least 3 times, and must then confirm once a
   valid receipt comes (the tracker never stopped). */
const H32=i=>'0x'+('ab'+i.toString(16)).padEnd(64,'0');
const STUB={request:()=>Promise.resolve(null)};
async function startTrack(E,rows){ await E.page.evaluate(rows=>{ window.__R=window.__R||{}; trackAt=0;
  rows.forEach(r=>{ const op={acct:r.acct||'0x00000000000000000000000000000000000000aa',req:{to:CFG.contract,data:'0x',value:'0x0'},block:r.block,P:{request:()=>Promise.resolve(null)}};
    const R=window.__R[r.hash]={state:'pending',tells:[],t0:performance.now()};
    trackTx(op,r.hash,s=>R.tells.push(s)).then(x=>{ R.state=x.state; R.by=x.by||null; R.ms=Math.round(performance.now()-R.t0); },e=>{ R.state='threw '+e.message; }); }); },rows); }
const results=E=>E.page.evaluate(()=>window.__R);
const reads=(E,h)=>E.chain.log.filter(x=>x.m==='eth_getTransactionReceipt'&&x.p&&x.p[0]===h).length;
const drop=(o,...ks)=>{ ks.forEach(k=>delete o[k]); return o; };
/* a table case: each row's receipt (a function of the hash) is served; the expected 'pending' rows then get a valid one */
const table=(mk)=>async E=>{
  await track(E,{poll:200,timeout:1500,lost:600000,stop:3600000}); const c=E.chain, B=c.blockNo();
  const good=h=>c.mkRc(h,{blockNumber:hex(B+1),status:'0x1'});
  const rows=mk({c,B,good}).map((r,i)=>Object.assign({hash:r.hash||H32(i+1),block:B},r));
  const F=new Map(rows.map(r=>[r.hash.toLowerCase(),r]));
  c.rc=h=>{ const r=F.get(String(h).toLowerCase()); if(!r) return null; return r.fixed?good(h):r.rc(h); };
  await startTrack(E,rows.map(r=>({hash:r.hash,block:r.block}))); await sleep(2600);
  const first=await results(E), out=[];
  for(const r of rows){ const R=first[r.hash]; out.push({row:r.name,want:r.want,got:R.state,reads:reads(E,r.hash)}); }
  rows.filter(r=>r.want==='pending').forEach(r=>{ r.fixed=true; });
  await E.until(async()=>{ const R=await results(E); return rows.filter(r=>r.want==='pending').every(r=>R[r.hash].state!=='pending'); },6000);
  const fin=await results(E);
  out.forEach((o,i)=>{ const r=rows[i]; o.later=fin[r.hash].state; o.tells=fin[r.hash].tells.join(','); });
  const ok=out.every(o=>o.want==='pending'?o.got==='pending'&&o.reads>=3&&o.later==='confirmed'&&!o.tells:o.got===o.want);
  return {pass:ok&&E.errors.length===0, ev:{wrong:out.filter(o=>!(o.want==='pending'?o.got==='pending'&&o.reads>=3&&o.later==='confirmed'&&!o.tells:o.got===o.want)),rows:out.map(o=>o.row+'='+o.got+(o.want==='pending'?'>'+o.later+'('+o.reads+')':''))}}; };

T('a4r1','receipt status: missing, 0x2, "ok", 2, 1, 0 (numbers), 0x01 or no receipt keep it pending (then a valid one confirms); exactly 0x1 confirms and 0x0 reverts',{wallets:[one('A')],ethereum:'A'},table(({good})=>[
  {name:'null',rc:()=>null,want:'pending'},
  {name:'missing',rc:h=>drop(good(h),'status'),want:'pending'},
  {name:'0x2',rc:h=>Object.assign(good(h),{status:'0x2'}),want:'pending'},
  {name:'ok',rc:h=>Object.assign(good(h),{status:'ok'}),want:'pending'},
  {name:'num2',rc:h=>Object.assign(good(h),{status:2}),want:'pending'},
  {name:'num1',rc:h=>Object.assign(good(h),{status:1}),want:'pending'},
  {name:'num0',rc:h=>Object.assign(good(h),{status:0}),want:'pending'},
  {name:'0x01',rc:h=>Object.assign(good(h),{status:'0x01'}),want:'pending'},
  {name:'0x1',rc:h=>good(h),want:'confirmed'},
  {name:'0x0',rc:h=>Object.assign(good(h),{status:'0x0'}),want:'reverted'}]));

T('a4r2','receipt transactionHash: missing, another transaction\'s (with status 0x1, with 0x0, and with no status: the reviewer\'s case), malformed or null keep it pending; the same hash in capitals counts',{wallets:[one('A')],ethereum:'A'},table(({good})=>[
  {name:'missing',rc:h=>drop(good(h),'transactionHash'),want:'pending'},
  {name:'other+0x1',rc:h=>Object.assign(good(h),{transactionHash:'0x'+'ef'.repeat(32)}),want:'pending'},
  {name:'other+0x0',rc:h=>Object.assign(good(h),{transactionHash:'0x'+'ef'.repeat(32),status:'0x0'}),want:'pending'},
  {name:'other+nostatus',rc:h=>drop(Object.assign(good(h),{transactionHash:'0x'+'ef'.repeat(32)}),'status'),want:'pending'},
  {name:'short',rc:h=>Object.assign(good(h),{transactionHash:h.slice(0,20)}),want:'pending'},
  {name:'null',rc:h=>Object.assign(good(h),{transactionHash:null}),want:'pending'},
  {name:'capitals',rc:h=>Object.assign(good(h),{transactionHash:'0x'+h.slice(2).toUpperCase()}),want:'confirmed'}]));

T('a4r3','receipt blockNumber: missing, null, "0x", "abc", a number, 0x0, or below the block the payment was sent at keep it pending; the send block itself and later count',{wallets:[one('A')],ethereum:'A'},table(({good,B})=>[
  {name:'missing',rc:h=>drop(good(h),'blockNumber'),want:'pending'},
  {name:'null',rc:h=>Object.assign(good(h),{blockNumber:null}),want:'pending'},
  {name:'0x',rc:h=>Object.assign(good(h),{blockNumber:'0x'}),want:'pending'},
  {name:'abc',rc:h=>Object.assign(good(h),{blockNumber:'abc'}),want:'pending'},
  {name:'number',rc:h=>Object.assign(good(h),{blockNumber:B+1}),want:'pending'},
  {name:'0x0',rc:h=>Object.assign(good(h),{blockNumber:'0x0'}),want:'pending'},
  {name:'below',rc:h=>Object.assign(good(h),{blockNumber:hex(B-1)}),want:'pending'},
  {name:'sendBlock',rc:h=>Object.assign(good(h),{blockNumber:hex(B)}),want:'confirmed'},
  {name:'later',rc:h=>Object.assign(good(h),{blockNumber:hex(B+5)}),want:'confirmed'}]));

T('a4r4','receipt blockHash: missing, null, short, not hex, or without 0x keep it pending; a 32-byte hash counts',{wallets:[one('A')],ethereum:'A'},table(({good})=>[
  {name:'missing',rc:h=>drop(good(h),'blockHash'),want:'pending'},
  {name:'null',rc:h=>Object.assign(good(h),{blockHash:null}),want:'pending'},
  {name:'short',rc:h=>Object.assign(good(h),{blockHash:'0x1234'}),want:'pending'},
  {name:'nothex',rc:h=>Object.assign(good(h),{blockHash:'0x'+'zz'.repeat(32)}),want:'pending'},
  {name:'no0x',rc:h=>Object.assign(good(h),{blockHash:'33'.repeat(32)}),want:'pending'},
  {name:'valid',rc:h=>Object.assign(good(h),{blockHash:'0x'+'33'.repeat(32)}),want:'confirmed'}]));

T('a4r5','receipt identity: a from or to that contradicts the payment, or a missing from/to, keeps it pending; the same addresses in another case count',{wallets:[one('A')],ethereum:'A'},table(({good})=>[
  {name:'fromOther',rc:h=>Object.assign(good(h),{from:B1}),want:'pending'},
  {name:'toOther',rc:h=>Object.assign(good(h),{to:'0x000000000000000000000000000000000000dEaD'}),want:'pending'},
  {name:'fromMissing',rc:h=>drop(good(h),'from'),want:'pending'},
  {name:'toMissing',rc:h=>drop(good(h),'to'),want:'pending'},
  {name:'checksummed',rc:h=>Object.assign(good(h),{from:'0x00000000000000000000000000000000000000AA',to:'0xcf5eba884efa04940d31a663beb6d37f907d064c'}),want:'confirmed'}]));

T('a4r6','invalid receipts first (3 with no status / a bad block number, then 3 with another hash), each claiming the OPPOSITE status, then a valid one: only the valid one decides (confirmed for 0x1, reverted for 0x0)',{wallets:[one('A')],ethereum:'A'},async E=>{
  await track(E,{poll:200,timeout:1500,lost:600000,stop:3600000}); const c=E.chain, B=c.blockNo();
  const good=(h,s)=>c.mkRc(h,{blockNumber:hex(B+1),status:s}), Ha=H32(1), Hb=H32(2), seen={};
  /* Ha: valid 0x1, invalid ones say 0x0 or nothing (an early verdict would be "reverted"); Hb: valid 0x0, invalid ones say 0x1 (an
     early verdict would be "confirmed") */
  c.rc=h=>{ const k=seen[h]=(seen[h]||0)+1; if(h!==Ha&&h!==Hb) return null; const s=h===Ha?'0x1':'0x0', wrongS=h===Ha?'0x0':'0x1';
    if(k<=3) return h===Ha?drop(good(h,s),'status'):Object.assign(good(h,wrongS),{blockNumber:'abc'});
    if(k<=6) return Object.assign(good(h,wrongS),{transactionHash:'0x'+'ef'.repeat(32)}); return good(h,s); };
  await startTrack(E,[{hash:Ha,block:B},{hash:Hb,block:B}]);
  await E.until(async()=>{ const R=await results(E); return R[Ha].state!=='pending'&&R[Hb].state!=='pending'; },8000);
  const R=await results(E);
  return {pass:R[Ha].state==='confirmed'&&R[Hb].state==='reverted'&&seen[Ha]>=7&&seen[Hb]>=7&&!R[Ha].tells.length&&!R[Hb].tells.length, ev:{a:R[Ha].state,b:R[Hb].state,servedA:seen[Ha],servedB:seen[Hb]}}; });

T('a4r7','the first reader answers a malformed receipt (another hash, status 0x0), the next reader a valid one (0x1): confirmed, in the same round, from the next reader',{wallets:[one('A')],ethereum:'A'},async E=>{
  await track(E,{poll:1500,timeout:1500,lost:600000,stop:3600000}); const c=E.chain, B=c.blockNo(), Hx=H32(7); let bad=0;
  await E.page.route(/publicnode\.com/,async route=>{ const b=route.request().postData()||''; let q=null; try{ q=JSON.parse(b); }catch(e){}
    if(q&&!Array.isArray(q)&&q.method==='eth_getTransactionReceipt'&&q.params&&q.params[0]===Hx){ bad++; return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:q.id,result:c.mkRc('0x'+'ef'.repeat(32),{blockNumber:hex(B+1),status:'0x0'})})}); }
    return route.fallback(); });
  c.rc=h=>h===Hx?c.mkRc(h,{blockNumber:hex(B+1),status:'0x1'}):null;
  await startTrack(E,[{hash:Hx,block:B}]); await E.until(async()=>(await results(E))[Hx].state!=='pending',6000);
  const R=(await results(E))[Hx], next=Object.entries(c.hits).filter(([k])=>/(mevblocker|drpc).*eth_getTransactionReceipt/.test(k)).reduce((a,[,v])=>a+v,0);
  return {pass:bad>=1&&R.state==='confirmed'&&R.ms<1400&&next>=1, ev:{badFromFirstReader:bad,state:R.state,ms:R.ms,nextReaderReceiptRequests:next}}; });

T('a4r8','every reader answers a malformed receipt (another hash, no status) for good: never confirmed or reverted; "cannot confirm" at TRACK.lost, unknown at TRACK.stop, receipts asked until then',{wallets:[one('A')],ethereum:'A'},async E=>{
  const LOST=2500, STOP=5000; await track(E,{poll:200,timeout:1500,lost:LOST,stop:STOP}); const c=E.chain, B=c.blockNo(), Hx=H32(8);
  c.rc=h=>h===Hx?drop(c.mkRc('0x'+'ef'.repeat(32),{blockNumber:hex(B+1)}),'status'):null;
  await startTrack(E,[{hash:Hx,block:B}]); await sleep(1500); const mid=(await results(E))[Hx];
  await E.until(async()=>(await results(E))[Hx].state!=='pending',STOP+4000); const R=(await results(E))[Hx];
  const per=['publicnode','mevblocker','drpc'].map(h=>Object.entries(c.hits).filter(([k])=>k.includes(h)&&k.includes('eth_getTransactionReceipt')).reduce((a,[,v])=>a+v,0));
  return {pass:mid.state==='pending'&&R.state==='unknown'&&R.tells.includes('unknown')&&R.ms>=STOP&&reads(E,Hx)>=10&&per.every(x=>x>0), ev:{mid:mid.state,state:R.state,tells:R.tells,ms:R.ms,receiptReads:reads(E,Hx),perReader:per}}; });

T('a4r9','replacement: the receipt for the transaction that spent the nonce belongs to the original, to another tx, has no status, or another sender: no verdict; once valid: "replaced"',{wallets:[one('A')],ethereum:'A'},async E=>{
  await track(E,{poll:200,timeout:1500,lost:600000,stop:3600000,scan:5}); const c=E.chain, B=c.blockNo(), out=[];
  const rtx={to:'0x000000000000000000000000000000000000dEaD',input:'0xdeadbeef',value:'0x0'};
  const bads={belongsToOriginal:(rc,h)=>Object.assign(rc,{transactionHash:h}),anotherTx:rc=>Object.assign(rc,{transactionHash:'0x'+'ef'.repeat(32)}),noStatus:rc=>drop(rc,'status'),otherSender:rc=>Object.assign(rc,{from:B1})};
  let i=0;
  for(const [name,spoil] of Object.entries(bads)){ i++; const Hx=H32(0x90+i), H2='0x'+('cd'+i).padEnd(64,'0'), R=B+2+i; let fixed=false;
    c.topAns=()=>hex(B+12); c.nonceLatest=8;
    c.tx=h=>h===Hx?c.mkTx(h,{nonce:'0x7',blockHash:null,blockNumber:null,transactionIndex:null}):h===H2?c.mkTx(H2,Object.assign({from:A1,nonce:'0x7',blockNumber:hex(R)},rtx)):null;
    c.blockTxs=b=>b===R?[c.mkTx(H2,Object.assign({from:A1,nonce:'0x7',blockNumber:hex(R)},rtx))]:[];
    c.rc=h=>{ if(h!==H2) return null; const rc=c.mkRc(H2,{from:A1,to:rtx.to,blockNumber:hex(R),status:'0x1'}); return fixed?rc:spoil(rc,Hx); };
    await startTrack(E,[{hash:Hx,block:B}]); await sleep(1800);
    const mid=(await results(E))[Hx].state, rd=reads(E,H2); fixed=true;
    await E.until(async()=>(await results(E))[Hx].state!=='pending',6000); const fin=(await results(E))[Hx];
    out.push({name,mid,replacementReceiptReads:rd,final:fin.state,by:fin.by===H2}); }
  return {pass:out.every(o=>o.mid==='pending'&&o.replacementReceiptReads>=2&&o.final==='replaced'&&o.by), ev:{rows:out}}; });

T('a4r10','guard, the documented policy (one valid receipt from the reader asked, no cross-check, no reorg re-check): the first reader\'s valid 0x0 decides even if another reader says 0x1; a first reader that has no receipt yet keeps it pending',{wallets:[one('A')],ethereum:'A'},async E=>{
  await track(E,{poll:300,timeout:1500,lost:600000,stop:3600000}); const c=E.chain, B=c.blockNo(), Ha=H32(0xa1), Hb=H32(0xa2); let firstB=0;
  await E.page.route(/publicnode\.com/,async route=>{ const b=route.request().postData()||''; let q=null; try{ q=JSON.parse(b); }catch(e){}
    if(q&&!Array.isArray(q)&&q.method==='eth_getTransactionReceipt'&&q.params&&(q.params[0]===Ha||q.params[0]===Hb)){ const h=q.params[0]; if(h===Hb) firstB++;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:q.id,result:h===Ha?c.mkRc(h,{blockNumber:hex(B+1),status:'0x0'}):null})}); }
    return route.fallback(); });
  c.rc=h=>h===Ha||h===Hb?c.mkRc(h,{blockNumber:hex(B+1),status:'0x1'}):null;
  await startTrack(E,[{hash:Ha,block:B}]); await E.until(async()=>(await results(E))[Ha].state!=='pending',5000);
  await startTrack(E,[{hash:Hb,block:B}]); await sleep(1500);
  const R=await results(E);
  return {pass:R[Ha].state==='reverted'&&R[Hb].state==='pending'&&firstB>=3, ev:{a:R[Ha].state,b:R[Hb].state,firstReaderAskedForB:firstB}}; });

T('a4r11','the page itself (WITNESS): the reviewer\'s receipt (another transaction\'s hash, no status) is never "reverted"; the payment stays pending, then a valid receipt confirms it',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await track(E,{poll:300}); const c=E.chain; let valid=false;
  c.rc=h=>valid?c.mkRc(h,{blockNumber:hex(c.blockNo()+1),status:'0x1'}):drop(c.mkRc('0x'+'ef'.repeat(32),{}),'status');
  const n=(await E.toasts()).length; await fillWit(E,'0.01'); await pressWit(E);
  const sent=await E.until(async()=>(await E.sends()).length>0,8000); const h=sent?(await E.sends())[0].hash:'';
  await E.until(async()=>reads(E,h)>=4,8000); await sleep(300);
  const t1=await toastsSince(E,n), r1=reads(E,h); valid=true;
  const conf=await E.until(async()=>(await toastsSince(E,n)).some(x=>DONE.test(x)),10000); const t=await toastsSince(E,n);
  return {pass:sent&&r1>=4&&!t1.some(x=>/reverted|failed|confirmed/i.test(x))&&conf&&!t.some(x=>/reverted/i.test(x)), ev:{sent,readsWhileMalformed:r1,toastsWhileMalformed:t1.slice(-2),confirmed:conf,toasts:t.slice(-2)}}; });

T('a4r12','COLLECT: the reviewer\'s receipt keeps the dialog on PENDING (never NOT COLLECTED); a valid receipt then shows IS YOURS',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await track(E,{poll:300}); const c=E.chain; let valid=false;
  c.rc=h=>valid?c.mkRc(h,{blockNumber:hex(c.blockNo()+1),status:'0x1'}):drop(c.mkRc('0x'+'ef'.repeat(32),{}),'status');
  await openOpt(E,3); await pressCollect(E);
  const pend=await E.until(async()=>/PENDING/.test(await popText(E.page)),8000); const h=(await E.sends()).length?(await E.sends())[0].hash:'';
  await E.until(async()=>reads(E,h)>=4,8000); await sleep(300); const p1=await popText(E.page), r1=reads(E,h); valid=true;
  const done=await E.until(async()=>/IS YOURS/.test(await popText(E.page)),10000);
  return {pass:pend&&r1>=4&&/PENDING/.test(p1)&&!/NOT COLLECTED/.test(p1)&&done, ev:{pending:pend,readsWhileMalformed:r1,popupWhileMalformed:p1.slice(0,80),collected:done}}; });
