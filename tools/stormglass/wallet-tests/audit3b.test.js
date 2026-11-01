/* THE AUDIT-3 COVERAGE-MATRIX CASES (audit/wallet-3-matrix). Loaded by wallet.test.js after audit3.test.js; select them with CASES=@audit3b.
   Same mocks, same fake chain: nothing real is touched. Each case closes one row of /home/claude/audit3/COVERAGE.md that no earlier
   case covered: either a regression for a defect found while building the matrix (fails on the earlier page) or a guard for
   behaviour the page already has but no case held (passes on both, and fails on the mutant named in the case's comment). */
const H=require('./wallet.test.js');
const {T,connect,sheetOpen,sheetButtons,sheetTitle,clickSheet,disconnectUI,openWit,closeWit,popText,sleep,DONE,A1,A2,B1,ETH}=H;
const one=(...a)=>H.one(...a);
const IPHONE={ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',viewport:{width:390,height:844},mobile:true};

const reqs=(E,id,m)=>E.page.evaluate(([id,m])=>__MW.log.filter(x=>x.pid===id&&x.method===m).map(x=>x.params),[id,m]);
const cnt=async(E,id,m)=>(await reqs(E,id,m)).length;
const toastsSince=async(E,n)=>(await E.toasts()).slice(n);
const fillWit=async(E,amt)=>{ await closeWit(E.page); await openWit(E.page); await E.page.fill('#wAmt',amt); };
const pressWit=E=>E.page.click('#bWit');
async function openOpt(E,k){ await closeWit(E.page); await E.page.evaluate(k=>{ if(!NX.pop) document.getElementById('bPick').click(); document.querySelectorAll('#candGrid .card')[k].click(); },k); await E.page.waitForSelector('#ccBuy'); }
const pressCollect=E=>E.page.evaluate(()=>document.getElementById('ccBuy').click());
const saved=E=>E.page.evaluate(()=>{ try{ return localStorage.getItem('stormglass.wallet'); }catch(e){ return 'ERR'; } });
const BUSY=/still waiting for your wallet|in your wallet now/i;

/* ═══ u1 (DEFECT D1): a connection the wallet never answers, replaced after 15 s by a new CONNECT to another wallet.
   Before: the write that started the first connection kept the one-write lock forever (every later payment was refused with
   "still waiting"), and when the first wallet finally answered, the old connection attempt overwrote the remembered choice and the
   old write went on: it asked the wallet connected meanwhile (B) to pay the old amount. */
T('u1','a write\'s connection is left unanswered and replaced by a CONNECT to another wallet: a later deliberate payment goes out; the late answer neither restarts the old write nor changes the remembered wallet',
  {wallets:[one('A',undefined,{gate:{eth_requestAccounts:true}}),one('B')]},async E=>{
  await fillWit(E,'0.01'); await pressWit(E);
  const picker=await E.until(()=>sheetOpen(E.page),4000); await clickSheet(E.page,/WALLET A/); const t0=Date.now();
  const g=await E.waitGate('A','eth_requestAccounts',5000);
  await sleep(Math.max(0,15400-(Date.now()-t0)));   /* the page lets a new attempt replace one left unanswered for 15 s */
  await closeWit(E.page); await E.page.click('#wallet'); const p2=await E.until(()=>sheetOpen(E.page),4000); if(p2) await clickSheet(E.page,/WALLET B/);
  const conB=await E.until(async()=>/00cc/i.test(await E.label()),6000); await sleep(400);
  const savedB=await saved(E);
  const n=(await E.toasts()).length; await fillWit(E,'0.02'); await pressWit(E);
  const later=await E.until(async()=>(await E.sends()).length>0,8000); const tLater=await toastsSince(E,n);
  await E.P('A').set({gate:{}}); const rel=await E.P('A').release('eth_requestAccounts'); await sleep(3500);
  const s=await E.sends(), lab=await E.label(), savedEnd=await saved(E);
  const okSends=s.length===1&&s[0].pid==='B'&&s[0].params[0].value===ETH(0.02);
  return {pass:picker&&g&&p2&&conB&&savedB==='test.b'&&later&&!tLater.some(x=>BUSY.test(x))&&rel===1&&okSends&&/00cc/i.test(lab)&&savedEnd==='test.b'&&(await cnt(E,'A','eth_sendTransaction'))===0,
    ev:{gateHit:g,connectedB:conB,savedAfterB:savedB,laterPaymentSent:later,toastsOnLaterPress:tLater,released:rel,sends:s.map(x=>x.pid+' '+x.params[0].value),want:'B '+ETH(0.02),label:lab,savedEnd}}; });

/* ═══ u2 (DEFECT D2): WalletConnect on a phone, the relay never reports the request out (no session_request_sent within 8 s).
   The OPEN button is offered anyway (the wallet lists what is waiting), but the text must not claim the request is in the wallet:
   the page has not seen it leave. The jump then has no request id (the app's own /wc). */
T('u2','WalletConnect: no session_request_sent within 8 s: OPEN is offered without a request id, and the text does not claim the request is in the wallet',{wallets:[]},async E=>{
  const page=E.page, jumps=[];
  await page.route('https://link.zerion.io/**',r=>{ jumps.push(r.request().url()); r.fulfill({status:204,body:''}); });
  const a=await page.evaluate(()=>{ localStorage.setItem('SG_WC_APP',JSON.stringify({name:'ZERION',href:'https://link.zerion.io'}));
    const ev={h:{},on(n,f){(this.h[n]=this.h[n]||[]).push(f)},emit(n,x){(this.h[n]||[]).forEach(f=>f(x))}};
    const fake={signer:{client:ev},request:()=>new Promise(r=>{ window.__answer=r; })}; window.__ev=ev; _WC=fake; wcHook(fake);
    window.__done=false; ask(fake,'eth_sendTransaction',[{}]).then(()=>{ window.__done=true; });
    const b=document.querySelector('#wsBtns button'); return {title:document.getElementById('wsk').textContent,disabled:!!(b&&b.disabled),text:document.getElementById('wsp').textContent}; });
  await sleep(8600);
  const b=await page.evaluate(()=>{ const x=document.querySelector('#wsBtns button'); return {on:document.getElementById('wsheet').classList.contains('on'),disabled:!!(x&&x.disabled),text:document.getElementById('wsp').textContent}; });
  await page.evaluate(()=>document.querySelector('#wsBtns button').click()); await E.until(async()=>jumps.length>0,3000);
  await page.evaluate(()=>window.__answer('0x'+'11'.repeat(32))); await sleep(300); const done=await page.evaluate(()=>window.__done);
  const claims=/(is|are) in (ZERION|your wallet) now|has (it|the request)/i.test(b.text);
  return {pass:/CONFIRM IN ZERION/.test(a.title)&&a.disabled&&b.on&&!b.disabled&&!claims&&b.text!==a.text&&jumps[0]==='https://link.zerion.io/wc'&&done&&E.errors.length===0,
    ev:{before:a,after8s:b,claimsInWallet:claims,jump:jumps[0]||null,answered:done}}; },IPHONE);

/* ═══ u3 (DEFECT D3, feedback): a write stalls before the hand-off (the wallet never answers the network switch). A second press
   must say that nothing has been sent and how to stop it here (DISCONNECT); DISCONNECT frees it, a later deliberate payment goes
   out, and the stalled switch answering late sends nothing. Once a write IS in the wallet's hands, the busy message says so and
   does not offer DISCONNECT as a way to stop it (the wallet may still send it). */
T('u3','a write stalled before the hand-off (switch never answered): the busy message says nothing was sent and offers DISCONNECT; DISCONNECT frees it; the late switch answer sends nothing; a handed-off write is reported as in the wallet',
  {wallets:[one('A','0x2105',{gate:{}})],ethereum:'A'},async E=>{
  await connect(E); await E.P('A').set({gate:{wallet_switchEthereumChain:true}});
  await fillWit(E,'0.01'); await pressWit(E); const g=await E.waitGate('A','wallet_switchEthereumChain',6000);
  const n=(await E.toasts()).length; await pressWit(E); await sleep(500); const busy1=(await toastsSince(E,n)).filter(x=>BUSY.test(x)).pop()||'';
  await disconnectUI(E); await sleep(500); await E.P('A').set({chainId:'0x1',gate:{eth_sendTransaction:true}});
  await connect(E); await fillWit(E,'0.02'); await pressWit(E); const g2=await E.waitGate('A','eth_sendTransaction',6000);
  const m=(await E.toasts()).length; await pressWit(E); await sleep(500); const busy2=(await toastsSince(E,m)).filter(x=>BUSY.test(x)).pop()||'';
  await E.P('A').release('wallet_switchEthereumChain'); await sleep(1500);
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_sendTransaction'); await E.until(async()=>(await E.sends()).length>0,6000); await sleep(1500);
  const s=await E.sends(), rq=await cnt(E,'A','eth_sendTransaction');
  const pre=/nothing (has been|was) sent/i.test(busy1)&&/DISCONNECT/.test(busy1), handed=/in your wallet now/i.test(busy2)&&/finish or cancel/i.test(busy2)&&!/DISCONNECT/.test(busy2);
  return {pass:g&&g2&&pre&&handed&&rq===1&&s.length===1&&s[0].params[0].value===ETH(0.02)&&s[0].chain==='0x1',
    ev:{gateHit:g,busyBeforeHandoff:busy1,busyAfterHandoff:busy2,sendRequests:rq,sends:s.map(x=>x.chain+' '+x.params[0].value)}}; });

/* ═══ u4 (guard): wallet metadata is self-reported text, never markup; the icon is used only when it is a data:image URL.
   Mutant this kills: sheet() writing the label with innerHTML, or accepting any icon URL. */
T('u4','wallet name and icon from EIP-6963 are shown as text; markup in a name is not run; only data:image icons are used; the connected sheet shows the name as text',
  {wallets:[one('X','0x1',{name:'<img src=x onerror="window.__xss=1">EVIL'+'·'.repeat(60),icon:'javascript:window.__xss=2'}),one('Y','0x1',{name:'<b>BOLD</b>',icon:'https://evil.example/i.png'}),one('Z','0x1',{name:'Zed'})]},async E=>{
  await E.page.click('#wallet'); const open=await E.until(()=>sheetOpen(E.page),4000); await sleep(300);
  const r=await E.page.evaluate(()=>{ const B=document.getElementById('wsBtns'); return {imgs:[...B.querySelectorAll('img')].map(i=>i.getAttribute('src').slice(0,24)),elements:[...B.querySelectorAll('button *')].map(x=>x.tagName),texts:[...B.querySelectorAll('button')].map(b=>b.textContent),xss:window.__xss||null}; });
  await E.page.evaluate(()=>document.querySelectorAll('#wsBtns button')[0].click()); const con=await E.until(async()=>/0x/.test(await E.label()),5000);
  await E.page.click('#wallet'); await E.until(()=>sheetOpen(E.page),3000); await sleep(200);
  const menu=await E.page.evaluate(()=>({note:document.getElementById('wsn').textContent,els:document.getElementById('wsn').children.length,xss:window.__xss||null}));
  const evil=r.texts.find(t=>/EVIL/.test(t))||'';
  return {pass:open&&r.xss===null&&menu.xss===null&&r.imgs.length===1&&/^data:image\//.test(r.imgs[0])&&r.elements.every(t=>t==='IMG')&&/^<IMG SRC=X ONERROR=/.test(evil)&&evil.length<=40&&r.texts.some(t=>t==='<B>BOLD</B>')&&con&&menu.els===0&&/<img src=x/.test(menu.note)&&E.errors.length===0,
    ev:{picker:r,connected:con,menu}}; });

/* ═══ u5 (guard): a stored WalletConnect app choice is only followed when its link is https. A tampered SG_WC_APP (javascript:, http:)
   or an old WALLETCONNECT_DEEPLINK_CHOICE carrying one is ignored: no OPEN button, no navigation; markup in a stored name is text.
   Mutant this kills: wcApp() without the https check. */
T('u5','tampered stored WalletConnect app (javascript:, http:, via SG_WC_APP or the old library key) is ignored: no OPEN button, no jump; a stored name is shown as text',{wallets:[]},async E=>{
  const page=E.page;
  const r=await page.evaluate(()=>{ const out={}; const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
    localStorage.removeItem('SG_WC_APP'); set('SG_WC_APP',{name:'EVIL',href:'javascript:window.__x=1'}); out.js=wcApp();
    set('SG_WC_APP',{name:'EVIL',href:'http://link.zerion.io'}); out.http=wcApp();
    set('SG_WC_APP',{name:'EVIL',href:' https://link.zerion.io'}); out.space=wcApp();
    localStorage.removeItem('SG_WC_APP'); set('WALLETCONNECT_DEEPLINK_CHOICE',{name:'EVIL',href:'javascript:window.__x=2'}); out.migrated=wcApp(); out.libKey=localStorage.getItem('WALLETCONNECT_DEEPLINK_CHOICE');
    const ev={h:{},on(n,f){(this.h[n]=this.h[n]||[]).push(f)},emit(n,x){(this.h[n]||[]).forEach(f=>f(x))}};
    const fake={signer:{client:ev},request:()=>new Promise(r=>{ window.__answer=r; })}; _WC=fake; wcHook(fake);
    ask(fake,'eth_sendTransaction',[{}]).catch(()=>{});
    ev.emit('session_request_sent',{id:7,topic:'t',request:{method:'eth_sendTransaction'}});
    out.sheet={title:document.getElementById('wsk').textContent,buttons:document.querySelectorAll('#wsBtns button').length,text:document.getElementById('wsp').textContent};
    window.__answer('0x'+'11'.repeat(32));
    set('SG_WC_APP',{name:'<img src=x onerror="window.__x=3">',href:'https://link.zerion.io'}); const a=wcApp();
    const fake2={signer:{client:ev},request:()=>new Promise(r=>{ window.__answer2=r; })}; _WC=fake2;
    ask(fake2,'eth_sendTransaction',[{}]).catch(()=>{}); out.named={title:document.getElementById('wsk').textContent,imgs:document.querySelectorAll('#wsheet img').length,app:!!a};
    window.__answer2('0x'+'11'.repeat(32)); return out; });
  await sleep(500); const after=await page.evaluate(()=>({x:window.__x||null,href:location.href}));
  return {pass:r.js===null&&r.http===null&&r.space===null&&r.migrated===null&&r.libKey===null&&r.sheet.title==='CONFIRM IN YOUR WALLET'&&r.sheet.buttons===0&&r.named.app&&/^CONFIRM IN <img src=x/.test(r.named.title)&&r.named.imgs===0&&after.x===null&&/^http:\/\/127\.0\.0\.1/.test(after.href)&&E.errors.length===0,
    ev:{r,after}}; },IPHONE);

/* ═══ u6 (guard): a switch the wallet says it made but did not (answers null, chain unchanged), and a 4902 (unknown chain) answer:
   the write stops at the chain check, nothing is estimated or sent; COLLECT's SWITCH stays on the wrong-network view.
   Mutant this kills: opBegin trusting the switch's answer instead of reading eth_chainId again. */
T('u6','switch falsely reported done (null, chain unchanged) and switch refused with 4902: WITNESS estimates and sends nothing; COLLECT\'s SWITCH stays on ANOTHER NETWORK',
  {wallets:[one('A','0x2105',{malformed:{wallet_switchEthereumChain:null}})],ethereum:'A'},async E=>{
  const out={};
  for(const [k,X0] of [['falseOk',E],['4902',null]]){ const X=X0||await H.boot({wallets:[one('A','0x2105',{switchReject:{code:4902,message:'Unrecognized chain ID'}})],ethereum:'A'});
    try{ await connect(X); const n=(await X.toasts()).length; await fillWit(X,'0.01'); await pressWit(X);
      const said=await X.until(async()=>(await toastsSince(X,n)).some(x=>/on another network/i.test(x)),6000); await sleep(800);
      const r={said,switchAsked:await cnt(X,'A','wallet_switchEthereumChain'),est:await cnt(X,'A','eth_estimateGas'),snd:await cnt(X,'A','eth_sendTransaction'),prompt:(await toastsSince(X,n)).some(x=>/confirm in your wallet/i.test(x))};
      if(k==='falseOk'){ await openOpt(X,3); await pressCollect(X); r.wrong=await X.until(async()=>/ANOTHER NETWORK/.test(await popText(X.page)),6000);
        await X.page.click('#nx-switch'); await sleep(1500); r.stillWrong=/ANOTHER NETWORK/.test(await popText(X.page)); r.snd2=await cnt(X,'A','eth_sendTransaction'); r.est2=await cnt(X,'A','eth_estimateGas'); }
      out[k]=r; } finally{ if(X!==E) await X.close().catch(()=>{}); } }
  const f=out.falseOk, u=out['4902'];
  return {pass:f.said&&f.switchAsked>=1&&f.est===0&&f.snd===0&&!f.prompt&&f.wrong&&f.stillWrong&&f.snd2===0&&f.est2===0&&u.said&&u.switchAsked===1&&u.est===0&&u.snd===0&&!u.prompt, ev:out}; });

/* ═══ u7 (guard): the remembered wallet is found by its key, not by its place: announced in another order, with window.ethereum
   pointing at the other wallet, the remembered one is asked directly and the other is never asked. */
T('u7','remembered wallet, announcements in another order and window.ethereum on the other wallet: the remembered one is asked directly, no list, the other never asked',
  {wallets:[one('B'),one('A')],ethereum:'A'},async E=>{
  await E.page.click('#wallet'); const con=await E.until(async()=>/0x/.test(await E.label()),5000); const picker=await sheetOpen(E.page);
  return {pass:con&&!picker&&/00cc/i.test(await E.label())&&(await cnt(E,'B','eth_requestAccounts'))===1&&(await cnt(E,'A','eth_requestAccounts'))===0, ev:{label:await E.label(),picker,rqA:await cnt(E,'A','eth_requestAccounts'),rqB:await cnt(E,'B','eth_requestAccounts')}}; },
  {store:{'stormglass.wallet':'test.b'}});

/* ═══ u8 (guard): on a computer, the chosen wallet fails to connect with an error that is not a refusal (-32603): the page reports it
   and asks no other wallet; the choice is forgotten, so the next CONNECT shows the list. Mutant this kills: falling back to the
   next wallet on the desktop path (the phone path's loop). */
T('u8','computer: the chosen wallet fails eth_requestAccounts with -32603: no other wallet is asked, the error is shown, the next CONNECT lists the wallets again',
  {wallets:[one('A',undefined,{reject:{eth_requestAccounts:{code:-32603,message:'Internal error'}}}),one('B')]},async E=>{
  await E.page.click('#wallet'); await E.until(()=>sheetOpen(E.page),4000); await clickSheet(E.page,/WALLET A/); await sleep(1500);
  const t=await E.toasts(), lab=await E.label(), sv=await saved(E);
  await E.page.click('#wallet'); const again=await E.until(()=>sheetOpen(E.page),4000);
  return {pass:(await cnt(E,'A','eth_requestAccounts'))===1&&(await cnt(E,'B','eth_requestAccounts'))===0&&!/0x/.test(lab)&&t.some(x=>/Internal error/.test(x))&&sv===null&&again,
    ev:{rqA:await cnt(E,'A','eth_requestAccounts'),rqB:await cnt(E,'B','eth_requestAccounts'),label:lab,toasts:t.slice(-2),saved:sv,listAgain:again}}; });

/* ═══ u9 (guard): an old write stopped by DISCONNECT (before the hand-off) cannot let go of the lock a newer write holds: when the
   old one's wallet call answers late and it stops, a third press while the newer one is in the wallet is still refused.
   Mutant this kills: opFree() without the identity check (OPLOCK=null for any caller). */
T('u9','an old write stopped by DISCONNECT, answering late, does not release a newer write\'s lock: a press while the newer one is in the wallet is still refused; one payment',
  {wallets:[one('A',undefined,{gate:{}})],ethereum:'A'},async E=>{
  await connect(E); await E.P('A').set({gate:{eth_estimateGas:true}}); await fillWit(E,'0.01'); await pressWit(E); const g1=await E.waitGate('A','eth_estimateGas',6000);
  await disconnectUI(E); await sleep(400); await E.P('A').set({gate:{eth_sendTransaction:true}}); await connect(E);
  await fillWit(E,'0.02'); await pressWit(E); const g2=await E.waitGate('A','eth_sendTransaction',6000);
  await E.P('A').release('eth_estimateGas'); await sleep(1500);
  const n=(await E.toasts()).length; await fillWit(E,'0.03'); await pressWit(E); await sleep(800); const t=await toastsSince(E,n), rqWhile=await cnt(E,'A','eth_sendTransaction');
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_sendTransaction'); await E.until(async()=>(await E.sends()).length>0,6000); await sleep(1000);
  const s=await E.sends();
  return {pass:g1&&g2&&rqWhile===1&&t.some(x=>BUSY.test(x))&&s.length===1&&s[0].params[0].value===ETH(0.02),
    ev:{gate1:g1,gate2:g2,requestsWhileNewerOpen:rqWhile,toasts:t,sends:s.map(x=>x.params[0].value)}}; });

/* ═══ u10 (guard): WalletConnect prompt. Closing the "confirm in your wallet" sheet cancels nothing (the request still answers and
   is used); an event for another method, or one with no topic, does not wake OPEN; an event after the request is over changes nothing. */
T('u10','WalletConnect: unrelated session_request_sent events do not wake OPEN; closing the sheet cancels nothing; a late event after the answer changes nothing',{wallets:[]},async E=>{
  const page=E.page;
  const r=await page.evaluate(async()=>{ localStorage.setItem('SG_WC_APP',JSON.stringify({name:'ZERION',href:'https://link.zerion.io'}));
    const ev={h:{},on(n,f){(this.h[n]=this.h[n]||[]).push(f)},emit(n,x){(this.h[n]||[]).forEach(f=>f(x))}};
    const fake={signer:{client:ev},request:()=>new Promise(r=>{ window.__answer=r; })}; _WC=fake; wcHook(fake);
    let got=null; ask(fake,'eth_sendTransaction',[{}]).then(h=>{ got=h; });
    const st=()=>{ const b=document.querySelector('#wsBtns button'); return {on:document.getElementById('wsheet').classList.contains('on'),disabled:b?b.disabled:null}; };
    const out={start:st()};
    ev.emit('session_request_sent',{id:1,topic:'t',request:{method:'personal_sign'}}); out.otherMethod=st();
    ev.emit('session_request_sent',{id:2,request:{method:'eth_sendTransaction'}}); out.noTopic=st();
    ev.emit('session_request_sent',{id:null,topic:'t',request:{method:'eth_sendTransaction'}}); out.noId=st();
    document.getElementById('wsX').click(); out.closed=st();
    window.__answer('0x'+'22'.repeat(32)); await new Promise(r=>setTimeout(r,50)); out.answer=got;
    ev.emit('session_request_sent',{id:3,topic:'t',request:{method:'eth_sendTransaction'}}); out.late=st(); out.lateText=document.getElementById('wsp').textContent;
    return out; });
  return {pass:r.start.on&&r.start.disabled===true&&r.otherMethod.disabled===true&&r.noTopic.disabled===true&&r.noId.disabled===true&&!r.closed.on&&r.answer==='0x'+'22'.repeat(32)&&!r.late.on&&E.errors.length===0, ev:r}; },IPHONE);

/* ═══ u11 (DEFECT D4, hardening): no gap between the last look and the hand-off. An account change that lands in the few microtasks
   between the last look's check and the eth_sendTransaction call (the await of the last look's own promise) must stop the send:
   the page re-checks the session synchronously right before invoking the captured provider. Swept over 0..14 microtask delays. */
T('u11','an account change landing between the last look and the eth_sendTransaction call (0..14 microtasks later) never lets the old account\'s request go to the wallet',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E);
  await E.page.evaluate(([A1,A2])=>{ const P=__MW.P.A, p=P.provider, orig=p.request.bind(p); window.__U={k:-1,armed:false,next:false,emitted:false,bad:[],sent:[]};
    p.request=args=>{ const U=window.__U, m=args&&args.method;
      if(m==='eth_sendTransaction'){ U.sent.push({k:U.k,afterEmit:U.emitted,from:args.params&&args.params[0]&&args.params[0].from}); if(U.emitted) U.bad.push(U.k); }
      if(U.armed&&m==='eth_accounts') U.next=true;
      const r=orig(args);
      if(U.armed&&U.next&&m==='eth_chainId'){ U.next=false; U.armed=false; const k=U.k;
        r.then(()=>{ let q=Promise.resolve(); for(let i=0;i<k;i++) q=q.then(()=>{}); q.then(()=>{ U.emitted=true; P.set({accounts:[A2,A1]}); P.emit('accountsChanged',[A2]); }); }); }
      return r; }; },[A1,A2]);
  const rows=[];
  for(let k=0;k<=14;k++){
    await E.page.evaluate(([k,A1,A2])=>{ const U=window.__U; U.k=k; U.emitted=false; U.next=false; U.armed=true; __MW.P.A.set({accounts:[A1,A2]}); },[k,A1,A2]);
    if(!/00aa/i.test(await E.label())){ await E.P('A').emit('accountsChanged',[A1]); await E.until(async()=>/00aa/i.test(await E.label()),3000); }
    const s0=(await E.sends()).length, n=(await E.toasts()).length; await fillWit(E,'0.01'); await pressWit(E);
    await E.until(async()=>(await E.sends()).length>s0||(await toastsSince(E,n)).some(x=>/changed|Nothing was sent/i.test(x)),5000); await sleep(400);
    const u=await E.page.evaluate(()=>({emitted:__U.emitted}));
    rows.push({k,emitted:u.emitted,sent:(await E.sends()).length-s0});
    await E.page.evaluate(([A1,A2])=>{ __MW.P.A.set({accounts:[A1,A2]}); },[A1,A2]); await E.P('A').emit('accountsChanged',[A1]); await E.until(async()=>/00aa/i.test(await E.label()),3000); await sleep(300); }
  const U=await E.page.evaluate(()=>__U);
  return {pass:U.bad.length===0&&rows.every(r=>r.emitted)&&E.errors.length===0, ev:{requestsAfterTheChange:U.bad,rows:rows.map(r=>r.k+':'+(r.sent?'sent':'stopped')).join(' ')}}; });

/* ═══ u12 (guard): a phone where WalletConnect cannot load (the bundle fails): the CONNECT sheet does not wait forever; within 20 s it
   offers the way out (open this page inside MetaMask's own browser, or copy the link), with a link built from this page's address. */
T('u12','phone, WalletConnect cannot load: the sheet turns into "WALLETCONNECT DID NOT ANSWER" with OPEN IN METAMASK (this page, in MetaMask\'s browser) and COPY THE LINK; no wallet is asked',{wallets:[]},async E=>{
  const page=E.page; let hit=0; await page.route('**/wc.js',r=>{ hit++; r.fulfill({status:404,body:''}); });
  await page.click('#wallet'); const s1=await E.until(()=>sheetOpen(page),4000); const t1=await sheetTitle(page);
  const dead=await E.until(async()=>/DID NOT ANSWER/.test(await sheetTitle(page)),23000); const btns=await sheetButtons(page);
  const nav=[]; await page.route('https://link.metamask.io/**',r=>{ nav.push(r.request().url()); r.fulfill({status:204,body:''}); });
  await clickSheet(page,/OPEN IN METAMASK/); await E.until(async()=>nav.length>0,3000);
  return {pass:hit>=1&&s1&&/CONNECT YOUR WALLET/.test(t1)&&dead&&btns.some(b=>/OPEN IN METAMASK/.test(b))&&btns.some(b=>/COPY THE LINK/.test(b))&&nav[0]==='https://link.metamask.io/dapp/127.0.0.1:'+new URL(page.url()).port+'/'&&!/0x/.test(await E.label()),
    ev:{wcRequests:hit,first:t1,dead,buttons:btns,jump:nav[0]||null}}; },IPHONE);

/* ═══ u13 (guard): eth_sendTransaction throws synchronously (the wallet's request() itself throws): the page cannot know whether
   anything left, so it says so (never "Nothing was sent"), asks nothing again by itself, and a deliberate press asks again. */
T('u13','eth_sendTransaction throws synchronously: reported as uncertain (check the wallet), never "Nothing was sent", no automatic retry; a deliberate press asks again',
  {wallets:[one('A',undefined,{throwSync:{eth_sendTransaction:true}})],ethereum:'A'},async E=>{
  await connect(E); await fillWit(E,'0.01'); const n=(await E.toasts()).length; await pressWit(E); await sleep(2500);
  const t=await toastsSince(E,n), rq1=await cnt(E,'A','eth_sendTransaction');
  await E.P('A').set({throwSync:{}}); await pressWit(E); await E.until(async()=>(await E.sends()).length>0,6000);
  const rq2=await cnt(E,'A','eth_sendTransaction');
  return {pass:rq1===1&&t.some(x=>/did not say whether|check your wallet/i.test(x))&&!t.some(x=>/Nothing was sent|^Cancelled/i.test(x))&&rq2===2&&(await E.sends()).length===1, ev:{toasts:t,requestsAfterThrow:rq1,requestsAfterDeliberatePress:rq2}}; });

/* ═══ u14 (guard): malformed account lists and a round trip away and back. accountsChanged with no valid address (garbage, null) is
   not a disconnect while the wallet's own eth_accounts still lists the account; a switch to another account and back while a write
   waits stops that write (the session changed, even though the address is the same again); a new press then pays from it. */
T('u14','accountsChanged(garbage | null) keeps the session while eth_accounts still has the account; A->B->A while a write waits stops it (nothing sent); the next press pays from A',
  {wallets:[one('A',undefined,{gate:{}})],ethereum:'A'},async E=>{
  await connect(E); const lab0=await E.label();
  await E.P('A').emit('accountsChanged',['0xnot-an-address']); await sleep(800); const lab1=await E.label();
  await E.P('A').emit('accountsChanged',null); await sleep(800); const lab2=await E.label();
  await E.P('A').set({gate:{eth_estimateGas:true}}); await fillWit(E,'0.01'); const n=(await E.toasts()).length; await pressWit(E); const g=await E.waitGate('A','eth_estimateGas',6000);
  await E.P('A').set({accounts:[A2,A1]}); await E.P('A').emit('accountsChanged',[A2]); await sleep(300);
  await E.P('A').set({accounts:[A1,A2]}); await E.P('A').emit('accountsChanged',[A1]); await sleep(300); const lab3=await E.label();
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_estimateGas'); await sleep(2500); const s1=(await E.sends()).length, t=await toastsSince(E,n);
  await fillWit(E,'0.02'); await pressWit(E); await E.until(async()=>(await E.sends()).length>0,6000); const s=await E.sends();
  return {pass:/00aa/i.test(lab0)&&lab1===lab0&&lab2===lab0&&g&&/00aa/i.test(lab3)&&s1===0&&t.some(x=>/changed/i.test(x))&&s.length===1&&String(s[0].params[0].from).toLowerCase()===A1&&s[0].params[0].value===ETH(0.02),
    ev:{labels:[lab0,lab1,lab2,lab3],gateHit:g,sendsAfterRoundTrip:s1,toasts:t,final:s.map(x=>x.params[0].from+' '+x.params[0].value)}}; });

/* ═══ u15 (guard): a wallet that arrives late (announces itself 1.5 s after the page loaded) and one whose probe answers slowly (0.9 s,
   under the 1.5 s cut) are both on the list; the late one, chosen, is the only one asked. */
T('u15','late announcement (1.5 s after load) and a slow probe (0.9 s): both listed; choosing the late wallet asks only it',
  {wallets:[one('A','0x1',{delay:{eth_chainId:900}}),one('B','0x1',{announceAfter:1500})]},async E=>{
  await sleep(1600); await E.page.click('#wallet'); const open=await E.until(()=>sheetOpen(E.page),5000); const btns=await sheetButtons(E.page);
  if(btns.some(b=>/WALLET B/.test(b))) await clickSheet(E.page,/WALLET B/); const con=await E.until(async()=>/00cc/i.test(await E.label()),5000);
  return {pass:open&&btns.some(b=>/WALLET A/.test(b))&&btns.some(b=>/WALLET B/.test(b))&&con&&(await cnt(E,'A','eth_requestAccounts'))===0&&(await cnt(E,'B','eth_requestAccounts'))===1, ev:{buttons:btns,connected:con,label:await E.label()}}; });

/* ═══ u16 (guard): phone, inside a wallet app (no list there: window.ethereum is asked): a refusal (4001) is the answer; another
   provider the page can see (already authorized, so it would connect without a prompt) is never asked. Mutant this kills: the phone
   loop treating 4001 like any other error. By design a non-refusal error there moves on to the next provider (index.html, connectOnce). */
T('u16','phone in a wallet app: window.ethereum refuses (4001): no other provider is asked, nothing connects, says cancelled',
  {wallets:[one('A','0x1',{announce:false,flags:{isMetaMask:true},reject:{eth_requestAccounts:{code:4001,message:'User rejected the request.'}}}),one('B','0x1',{authorized:true})],ethereum:'A'},async E=>{
  await E.page.click('#wallet'); await sleep(2000); const t=await E.toasts();
  return {pass:(await cnt(E,'A','eth_requestAccounts'))===1&&(await cnt(E,'B','eth_requestAccounts'))===0&&!/0x/.test(await E.label())&&t.some(x=>/Cancelled/i.test(x)), ev:{rqA:await cnt(E,'A','eth_requestAccounts'),rqB:await cnt(E,'B','eth_requestAccounts'),label:await E.label(),toasts:t.slice(-1)}}; },
  {ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MetaMaskMobile/7.40.0',viewport:{width:390,height:844},mobile:true});

/* ═══ u17 (guard): a computer with no wallet, and one whose only wallet never answers: CONNECT and WITNESS say so (the no-wallet sheet;
   "No wallet answered"), nothing is asked, and the write lets go: a second WITNESS press is not refused as busy. */
T('u17','computer, no wallet: CONNECT and WITNESS show NO WALLET IN THIS BROWSER and free the button; only wallet dead: "No wallet answered", nothing asked',{wallets:[]},async E=>{
  await E.page.click('#wallet'); const s1=await E.until(async()=>/NO WALLET/.test(await sheetTitle(E.page)),4000); await E.page.keyboard.press('Escape'); await sleep(200);
  await fillWit(E,'0.01'); await pressWit(E); const s2=await E.until(async()=>/NO WALLET/.test(await sheetTitle(E.page)),4000); await E.page.keyboard.press('Escape'); await sleep(300);
  await fillWit(E,'0.01'); const n=(await E.toasts()).length; await pressWit(E); const s3=await E.until(async()=>/NO WALLET/.test(await sheetTitle(E.page)),4000); const busy=(await toastsSince(E,n)).some(x=>BUSY.test(x));
  const X=await H.boot({wallets:[one('D','0x1',{never:{eth_chainId:true}})]}); let dead={};
  try{ await X.page.click('#wallet'); dead.toast=await X.until(async()=>(await X.toasts()).some(x=>/No wallet answered/.test(x)),5000); dead.rq=await cnt(X,'D','eth_requestAccounts'); dead.label=await X.label(); } finally{ await X.close().catch(()=>{}); }
  return {pass:s1&&s2&&s3&&!busy&&dead.toast&&dead.rq===0&&/CONNECT/.test(dead.label)&&E.errors.length===0, ev:{connectSheet:s1,witnessSheet:s2,secondPress:s3,busy,dead}}; });
