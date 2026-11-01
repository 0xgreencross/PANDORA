/* THE AUDIT-4 REVIEW CASES (audit/wallet-4, second audit). Loaded by wallet.test.js as part of group @audit4 (every audit4*.test.js).
   Same mocks, same fake chain: nothing real is touched.
   a4h1      harness (G2): WebRTC cannot send UDP from a case: an RTCPeerConnection pointed at a local STUN listener gathers no
             candidate and the listener receives nothing (the runner launches Chromium with --webrtc-ip-handling-policy=disable_non_proxied_udp).
   a4v1..    regressions and guards from the second audit of the S1-S6 repairs: see /home/claude/audit4/REVIEW_REPORT.md. */
const dgram=require('dgram');
const H=require('./wallet.test.js');
const {T,sleep}=H;

T('a4h1','harness: WebRTC sends no UDP from a case (a local STUN listener receives nothing, no ICE candidate is gathered)',{wallets:[]},async E=>{
  const sock=dgram.createSocket('udp4'); let packets=0; sock.on('message',()=>packets++);
  await new Promise(r=>sock.bind(0,'127.0.0.1',r)); const port=sock.address().port;
  try{ const r=await E.page.evaluate(async port=>{ const c=[]; let err=null;
      try{ const pc=new RTCPeerConnection({iceServers:[{urls:'stun:127.0.0.1:'+port}]}); pc.onicecandidate=e=>{ if(e.candidate&&e.candidate.candidate) c.push(e.candidate.candidate.split(' ').slice(2,8).join(' ')); };
        pc.createDataChannel('x'); await pc.setLocalDescription(await pc.createOffer());
        /* barrier (audit 5): ICE gathering has finished (state "complete"; bounded 10 s), so every candidate and STUN packet it would send is out */
        var complete=await new Promise(r=>{ if(pc.iceGatheringState==='complete') return r(true); pc.onicegatheringstatechange=()=>{ if(pc.iceGatheringState==='complete') r(true); }; setTimeout(()=>r(false),10000); });
        pc.close(); }catch(e){ err=String(e).slice(0,120); }
      return {candidates:c,err,rtc:typeof RTCPeerConnection,complete:typeof complete==='undefined'?null:complete}; },port);
    await sleep(300);
    return {pass:r.rtc==='function'&&!r.err&&r.complete===true&&packets===0&&r.candidates.length===0,ev:{gatheringComplete:r.complete,udpPacketsToLocalStun:packets,candidates:r.candidates,err:r.err}}; }
  finally{ sock.close(); } });

const {connect,openWit,closeWit,popText,A1,A2}=H;
const one=(...a)=>H.one(...a);
const IPHONE={ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',viewport:{width:390,height:844},mobile:true};
const reqs=(E,id,m)=>E.page.evaluate(([id,m])=>__MW.log.filter(x=>x.pid===id&&x.method===m).map(x=>({params:x.params,chain:x.chain})),[id,m]);
async function openOpt(E,k){ await closeWit(E.page); await E.page.evaluate(k=>{ if(!NX.pop) document.getElementById('bPick').click(); document.querySelectorAll('#candGrid .card')[k].click(); },k); await E.page.waitForSelector('#ccBuy'); }
const sheetView=page=>page.evaluate(()=>({title:document.getElementById('wsk').textContent,text:document.getElementById('wsp').textContent,buttons:[...document.querySelectorAll('#wsBtns button')].map(b=>({t:b.textContent,on:!b.disabled})),stored:localStorage.getItem('SG_WC_APP')}));
const fillPress=async(E,amt)=>{ await closeWit(E.page); await openWit(E.page); await E.page.fill('#wAmt',amt); await E.page.click('#bWit'); };
/* the same press without Playwright's actionability waits: after a jump answered 204 (the page stays) Playwright keeps waiting for that
   navigation, so a4v1/a4v7 drive the page from inside it, as m9 does */
const fillPressJs=(E,amt)=>E.page.evaluate(async amt=>{ const w=document.getElementById('nx-wit'); if(!w.classList.contains('on')) document.getElementById('nx-witBtn').click();
  for(let i=0;i<50&&!document.getElementById('wAmt');i++) await new Promise(r=>setTimeout(r,50)); const b=document.getElementById('wAmt'); b.value=amt; b.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('bWit').click(); },amt);

/* ═══ a4v1 (guard for S5): a pairing made through an app button keeps that app: every confirmation sheet names it and OPEN opens it
   (the S5 repair forgets the stored app only for a pairing made without one). */
T('a4v1','guard (S5): phone, paired through the ZERION button: the confirmation sheet says CONFIRM IN ZERION and offers OPEN ZERION',{wallets:[],wc:{accounts:[A1,A2],chainId:'0x1'}},async E=>{
  const page=E.page, jumps=[]; await page.route('https://link.zerion.io/**',r=>{ jumps.push(r.request().url()); r.fulfill({status:204,body:''}); });
  await page.evaluate(()=>localStorage.setItem('SG_WC_APP',JSON.stringify({name:'RAINBOW',href:'https://rnbwapp.com'})));   /* an older choice: replaced by the tap */
  await page.click('#wallet'); await E.until(()=>H.sheetOpen(page),4000); const ready=await E.until(()=>page.evaluate(()=>!!__MW.wc.approve),6000);
  await H.clickSheet(page,/^ZERION$/); const jumped=await E.until(async()=>jumps.length>0,3000); await page.evaluate(()=>__MW.wc.approve());
  const con=await E.until(async()=>/0x/.test(await E.label()),6000);
  await page.evaluate(()=>__MW.P.WC.set({gate:{eth_sendTransaction:true}})); await fillPressJs(E,'0.01');
  const g=await E.until(()=>page.evaluate(()=>__MW.P.WC.waiting('eth_sendTransaction')>0),8000); await sleep(300); const v=await sheetView(page);
  await page.evaluate(()=>{ __MW.P.WC.set({gate:{}}); __MW.P.WC.release('eth_sendTransaction'); }); await E.until(async()=>(await E.sends()).length>0,6000);
  return {pass:ready&&jumped&&/^https:\/\/link\.zerion\.io\/wc\?uri=wc%3A/.test(jumps[0])&&con&&g&&v.title==='CONFIRM IN ZERION'&&v.buttons.some(b=>b.t==='OPEN ZERION')&&/ZERION/.test(v.stored||''),ev:{jump:(jumps[0]||'').slice(0,60),paired:con,gateHit:g,sheet:v}}; },IPHONE);

/* ═══ a4v2 (DEFECT, found by the second audit; S2's neighbour): every public reader is down and the browser's wallet answers eth_chainId
   (mainnet) but never answers a read (eth_call): the page reads through the wallet with no time limit, so the first tick never ends,
   exactly as in S2: no CANNOT REACH ETHEREUM, no 30 s retry, no recovery when the readers come back. */
T('a4v2','all public readers down, the wallet answers eth_chainId but never a read: the page still says CANNOT REACH ETHEREUM and recovers when the readers come back',
  {wallets:[one('D','0x1',{never:{eth_call:true}})],ethereum:'D'},async E=>{
  E.chain.hostMode=()=>'500'; await E.page.reload(); const t0=Date.now();
  const said=await E.until(()=>E.page.evaluate(()=>/CANNOT REACH ETHEREUM/.test(document.getElementById('panel').textContent)),30000), ms=Date.now()-t0;
  const calls=await E.page.evaluate(()=>__MW.log.filter(x=>x.method==='eth_call').length);
  E.chain.hostMode=()=>null; const back=await E.until(()=>E.page.evaluate(()=>/DAY 13/.test(document.getElementById('panel').textContent)),40000);
  return {pass:said&&calls>0&&back,ev:{said,ms,walletEthCalls:calls,recoveredWithin40sOfReadersBack:back}}; });

/* ═══ a4v3 (guard for S2 and a4v2): the wallet fallback still works: every public reader is down, the wallet is slow (eth_chainId 1 s,
   under the 1.5 s cut) and answers reads (forwarded to the fake chain, marked so that only they get through): the page shows the day. */
T('a4v3','guard: all public readers down, a slow but answering wallet (eth_chainId in 1 s) is still used as the reader: the day is shown',
  {wallets:[one('D','0x1',{delay:{eth_chainId:1000}})],ethereum:'D'},async E=>{
  await E.ctx.addInitScript(()=>{ const P=window.__MW&&__MW.P.D; if(!P) return; const real=P.provider.request.bind(P.provider);
    P.provider.request=a=>{ const m=a&&a.method; if(['eth_chainId','eth_accounts','eth_requestAccounts','wallet_switchEthereumChain','eth_sendTransaction'].includes(m)) return real(a);
      __MW.log.push({pid:'D',method:m,params:null,chain:'0x1',t:performance.now(),forwarded:true});
      return fetch('https://eth.drpc.org',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:m,params:a.params||[],via:'wallet'})}).then(r=>r.json()).then(j=>{ if(j.error) throw Object.assign(new Error(j.error.message),{code:j.error.code}); return j.result; }); }; });
  E.chain.hostMode=(h,body)=>/"via":"wallet"/.test(body||'')?null:'500'; await E.page.reload(); const t0=Date.now();
  const day=await E.until(()=>E.page.evaluate(()=>/DAY 13/.test(document.getElementById('panel').textContent)),25000), ms=Date.now()-t0;
  const fwd=await E.page.evaluate(()=>__MW.log.filter(x=>x.forwarded).length), cannot=await E.page.evaluate(()=>/CANNOT REACH/.test(document.getElementById('panel').textContent));
  return {pass:day&&fwd>0&&!cannot,ev:{dayShown:day,ms,readsThroughWallet:fwd}}; });

/* ═══ a4v4 (DEFECT, found by the second audit): send() wraps its observer in try/catch, but an async observer (COLLECT's is one) that
   rejects escapes as an unhandled rejection: the try/catch only sees synchronous throws. */
T('a4v4','send(): an observer that rejects (async) is contained like one that throws: no unhandled rejection',{wallets:[one('A',undefined,{reject:{eth_sendTransaction:{code:4001,message:'User rejected the request.'}}})],ethereum:'A'},async E=>{
  await connect(E);
  const r=await E.page.evaluate(async()=>{ const seen=[]; await send('claim',C=>pad(C.claim,[]),async ph=>{ seen.push(ph); await null; throw new Error('observer rejects at '+ph); }); await new Promise(r=>setTimeout(r,300)); return {seen,lock:OPLOCK===null}; });
  await sleep(500);
  return {pass:r.seen.includes('error')&&r.lock&&E.errors.length===0,ev:{observerPhases:r.seen,lockFree:r.lock,pageErrors:E.errors}}; });

/* ═══ a4v5 (guard for S3): the last look gets a malformed account list (not a list; a list whose first entry is no address): the write
   stops and the page follows nothing (still the same account); once the wallet answers properly the next press pays from it. */
T('a4v5','guard (S3): a malformed eth_accounts at the last look stops the write without changing the session; the next press pays from the same account',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); const rows=[];
  for(const bad of ['0x00000000000000000000000000000000000000bb',['nope','0x00000000000000000000000000000000000000aa'],[null]]){
    await E.P('A').set({malformed:{eth_accounts:bad}}); const n=(await E.toasts()).length; await fillPress(E,'0.01');
    const stopped=await E.until(async()=>(await E.toasts()).slice(n).some(x=>/Nothing was sent/.test(x))&&await E.page.evaluate(()=>OPLOCK===null),6000);
    rows.push({bad:JSON.stringify(bad).slice(0,30),stopped,toast:(await E.toasts()).slice(n).pop(),label:await E.label()}); }
  const asked0=(await reqs(E,'A','eth_sendTransaction')).length;
  await E.P('A').set({malformed:{}}); await fillPress(E,'0.01'); const sent=await E.until(async()=>(await E.sends()).length>0,8000);
  const s=await E.sends();
  return {pass:rows.every(r=>r.stopped&&/00aa/i.test(r.label)&&!/another account|no account/.test(r.toast))&&asked0===0&&sent&&s.length===1&&String(s[0].params[0].from).toLowerCase()===A1,ev:{rows,askedWhileMalformed:asked0,sentAfter:sent,from:s[0]&&s[0].params[0].from}}; });

/* ═══ a4v6 (guard for S6): DISCONNECT after the hand-off (the wallet holds eth_sendTransaction): the payment may still be sent, so the
   COLLECT dialog is not told it stopped (no NOT COLLECTED), the lock stays, and the late hash is followed to the end. */
T('a4v6','guard (S6): DISCONNECT after COLLECT was handed to the wallet: no "NOT COLLECTED", the lock is kept, the late answer is followed to DAY IS YOURS',{wallets:[one('A',undefined,{gate:{},revokeUnsupported:true})],ethereum:'A'},async E=>{   /* a wallet without wallet_revokePermissions: it still holds the request after DISCONNECT (the mock would otherwise refuse it as unauthorized) */
  await connect(E); await E.P('A').set({gate:{eth_sendTransaction:true}}); await openOpt(E,3); await E.page.evaluate(()=>document.getElementById('ccBuy').click());
  const g=await E.waitGate('A','eth_sendTransaction',8000); await E.page.evaluate(()=>disconnect(true)); await sleep(800);
  const p1=await popText(E.page), lock=await E.page.evaluate(()=>!!OPLOCK&&OPLOCK.handed);
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_sendTransaction');
  const done=await E.until(async()=>/IS YOURS/.test(await popText(E.page)),15000);
  return {pass:g&&!/NOT COLLECTED|Nothing was sent/i.test(p1)&&/confirm in your wallet/i.test(p1)&&lock&&done&&(await E.sends()).length===1,ev:{gateHit:g,afterDisconnect:p1.slice(0,90),lockKeptHanded:lock,done,sends:(await E.sends()).length}}; });

/* ═══ a4v7 (guard for S4): the pairing link comes after the 20 s sheet; the app buttons come back live, and tapping one opens that app
   with this link and remembers it (the re-rendered sheet is the real one, not a picture of it). */
T('a4v7','guard (S4): link after the 20 s sheet: RAINBOW in the restored sheet opens Rainbow with this link and is remembered',{wallets:[],wc:{accounts:[A1,A2],chainId:'0x1'}},async E=>{
  const page=E.page, jumps=[]; await page.route('https://rnbwapp.com/**',r=>{ jumps.push(r.request().url()); r.fulfill({status:204,body:''}); });
  await page.evaluate(()=>{ const w=__MW.wc.provider, orig=w.enable.bind(w); w.enable=async()=>{ await new Promise(r=>setTimeout(r,21500)); return orig(); }; });
  await page.click('#wallet'); const dead=await E.until(async()=>/DID NOT ANSWER/.test(await H.sheetTitle(page)),23000);
  const uri=await E.until(()=>page.evaluate(()=>!!__MW.wc.approve),5000); await sleep(200);
  const link=await page.evaluate(()=>__MW.wc.uris); await H.clickSheet(page,/^RAINBOW$/); const jumped=await E.until(async()=>jumps.length>0,3000);
  await page.evaluate(()=>__MW.wc.approve()); const con=await E.until(async()=>/0x/.test(await E.label()),6000); const stored=await page.evaluate(()=>localStorage.getItem('SG_WC_APP'));
  return {pass:dead&&uri&&jumped&&/^https:\/\/rnbwapp\.com\/wc\?uri=wc%3A/.test(jumps[0])&&con&&/RAINBOW/.test(stored||''),ev:{deadSheet:dead,linkArrived:uri,links:link,jump:(jumps[0]||'').slice(0,60),paired:con,stored}}; },IPHONE);

/* ═══ a4v8, a4v9 (S5, the other ways in): a pairing that completes with no app button tapped (the link reached the wallet some other
   way) forgets the older app; an app tapped first and then abandoned for COPY CONNECTION LINK or OTHER WALLET is not kept either. */
async function wcPayView(E){ const page=E.page; await page.evaluate(()=>__MW.P.WC.set({gate:{eth_sendTransaction:true}})); await fillPressJs(E,'0.01');
  const g=await E.until(()=>page.evaluate(()=>__MW.P.WC.waiting('eth_sendTransaction')>0),8000); await sleep(300); const v=await sheetView(page);
  await page.evaluate(()=>{ __MW.P.WC.set({gate:{}}); __MW.P.WC.release('eth_sendTransaction'); }); await E.until(async()=>(await E.sends()).length>0,6000); return Object.assign(v,{gateHit:g}); }
T('a4v8','phone, an older app (ZERION) stored, the pairing completes with no app button tapped: the confirmation sheet neither names nor opens ZERION',{wallets:[],wc:{accounts:[A1,A2],chainId:'0x1'}},async E=>{
  const page=E.page; await page.evaluate(()=>localStorage.setItem('SG_WC_APP',JSON.stringify({name:'ZERION',href:'https://link.zerion.io'})));
  await page.click('#wallet'); await E.until(()=>H.sheetOpen(page),4000); const ready=await E.until(()=>page.evaluate(()=>!!__MW.wc.approve),6000);
  await page.evaluate(()=>__MW.wc.approve()); const con=await E.until(async()=>/0x/.test(await E.label()),6000); const v=await wcPayView(E);
  return {pass:ready&&con&&v.gateHit&&!/ZERION/.test(v.title)&&!v.buttons.some(b=>/ZERION/.test(b.t))&&v.stored===null,ev:{paired:con,sheet:v}}; },IPHONE);
T('a4v9','phone, ZERION tapped first, then COPY CONNECTION LINK (or OTHER WALLET) and the pairing completes: the sheet neither names nor opens ZERION',{wallets:[],wc:{accounts:[A1,A2],chainId:'0x1'}},async E=>{
  const rows={};
  for(const way of ['COPY CONNECTION LINK','OTHER WALLET']){ const X=way==='OTHER WALLET'?await H.boot({wallets:[],wc:{accounts:[A1,A2],chainId:'0x1'}},IPHONE):E;
    try{ const page=X.page, jumps=[]; await page.route('https://link.zerion.io/**',r=>{ jumps.push(r.request().url()); r.fulfill({status:204,body:''}); });
      await page.evaluate(()=>{ window.__nav=[]; });
      await page.evaluate(()=>document.getElementById('wallet').click()); await X.until(()=>H.sheetOpen(page),4000); const ready=await X.until(()=>page.evaluate(()=>!!__MW.wc.approve),6000);
      await page.evaluate(()=>[...document.querySelectorAll('#wsBtns button')].find(b=>b.textContent==='ZERION').click()); const jumped=await X.until(async()=>jumps.length>0,3000);
      await page.evaluate(w=>[...document.querySelectorAll('#wsBtns button')].find(b=>b.textContent===w).click(),way); await sleep(300);
      await page.evaluate(()=>__MW.wc.approve()); const con=await X.until(async()=>/0x/.test(await X.label()),6000); const v=await wcPayView(X);
      rows[way]={ready,jumpedToZerionFirst:jumped,paired:con,good:ready&&jumped&&con&&v.gateHit&&!/ZERION/.test(v.title)&&!v.buttons.some(b=>/ZERION/.test(b.t)),sheet:v}; }
    finally{ if(X!==E) await X.close().catch(()=>{}); } }
  return {pass:Object.values(rows).every(r=>r.good),ev:rows}; },IPHONE);

/* ═══ a4v10, a4v11 (B, each binding on its own): the scan of mutants showed the emitter binding and the topic equality are only
   reached by a4w cases through other bindings (a foreign event there also carries foreign params). Here the event carries THIS
   request's params array, so only the binding under test can refuse it. Fake providers as in audit4.test.js (wc.js's shapes). */
async function wcMini(E){ await E.page.evaluate(()=>{ localStorage.setItem('SG_WC_APP',JSON.stringify({name:'ZERION',href:'https://link.zerion.io'}));
  window.__M={ mk(topic){ const ev={h:{},on(n,f){ (this.h[n]=this.h[n]||[]).push(f); },emit(n,x){ (this.h[n]||[]).forEach(f=>f(x)); }};
      const P={reqs:[],signer:{client:ev},request(a){ P.reqs.push({a}); return new Promise(()=>{}); }}; P.session={topic}; return P; },
    ev(P,i,id,o){ return Object.assign({id,topic:P.session.topic,request:Object.assign({},P.reqs[i].a),chainId:'eip155:1'},o||{}); },
    st(){ const b=document.querySelector('#wsBtns button'); return {disabled:b?b.disabled:null,ev:NUDGE&&NUDGE.ev?{id:NUDGE.ev.id,topic:NUDGE.ev.topic}:null,text:document.getElementById('wsp').textContent.slice(0,40)}; } }; }); }
T('a4v10','WalletConnect: an event from ANOTHER provider\'s client that carries this request\'s params and topic does not wake OPEN; this provider\'s own event then gives the exact link',{wallets:[]},async E=>{
  await wcMini(E);
  const r=await E.page.evaluate(()=>{ const M=__M, P1=M.mk('T2'), P2=M.mk('T2'); wcHook(P1); _WC=P2; wcHook(P2); ask(P2,'eth_sendTransaction',[{n:2}]); const out={start:M.st()};
    P1.signer.client.emit('session_request_sent',M.ev(P2,0,61)); out.afterForeignClient=M.st();
    P2.signer.client.emit('session_request_sent',M.ev(P2,0,62)); out.afterOwn=M.st(); return out; });
  return {pass:r.start.disabled===true&&r.afterForeignClient.disabled===true&&r.afterForeignClient.ev===null&&r.afterOwn.disabled===false&&!!r.afterOwn.ev&&r.afterOwn.ev.id===62&&r.afterOwn.ev.topic==='T2',ev:r}; },IPHONE);
T('a4v11','WalletConnect: this request\'s params from its own client but another session topic does not wake OPEN (no request-specific link)',{wallets:[]},async E=>{
  await wcMini(E);
  const r=await E.page.evaluate(()=>{ const M=__M, P=M.mk('T1'); _WC=P; wcHook(P); ask(P,'eth_sendTransaction',[{n:1}]); const out={start:M.st()};
    P.signer.client.emit('session_request_sent',M.ev(P,0,71,{topic:'T9'})); out.afterOtherTopic=M.st(); return out; });
  return {pass:r.start.disabled===true&&r.afterOtherTopic.disabled===true&&r.afterOtherTopic.ev===null,ev:r}; },IPHONE);
