/* THE AUDIT-5B PRE-FIX REVIEW CASES (audit/wallet-5b-review). Loaded by wallet.test.js (every audit5*.test.js is group @audit5). Same mocks,
   same fake chain: nothing real is touched (no wallet, no RPC, no relay). Registered in manifest.json (group @audit5).
   audit 5b fix: a5v1 and a5v2 were rewritten for the modal sheet and the fixes (see each case); a5v3 is unchanged.
   a5v  defects found by the independent review of candidate 50ac8a5 (index.html 99131cd7, tools/stormglass/staging/stage.js) before the
        audit-5b fixes, each written to fail on 50ac8a5. Every case asserts that its trigger was reached. */
const H=require('./wallet.test.js');
const {T,connect,sheetOpen,sheetTitle,sheetButtons,clickSheet,closeWit,sleep,A1}=H;
const {ethers}=require('ethers');
const one=(...a)=>H.one(...a);
const CONTRACT='0xCf5EBA884EFA04940d31A663bEB6D37F907d064C';
const R1L='0x52908400098527886e0f7030069857d2e4169ee7', R1=ethers.getAddress(R1L);
const IPHONE={ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',viewport:{width:390,height:844},mobile:true};
const SGI=new ethers.Interface(['function withdrawTo(address)']);
const sentTo=s=>{ try{ return SGI.decodeFunctionData('withdrawTo',s.params[0].data)[0]; }catch(e){ return 'not withdrawTo: '+String(s.params[0].data).slice(0,10); } };
const IN_APP={ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MetaMaskMobile/7.40.0',viewport:{width:390,height:844},mobile:true};
const reqs=(E,id,m)=>E.page.evaluate(([id,m])=>__MW.log.filter(x=>x.pid===id&&x.method===m).length,[id,m]);
const shown=E=>E.page.evaluate(()=>{ const b=document.getElementById('withdrawTo'); return !!b&&b.style.display!=='none'&&b.offsetParent!==null; });
async function wOpen(E){ await closeWit(E.page); if(!(await E.until(()=>shown(E),8000))) throw new Error('no WITHDRAW TO ANOTHER ADDRESS button');
  if(await E.page.evaluate(()=>document.getElementById('wtoBox').hidden)) await E.page.evaluate(()=>document.getElementById('withdrawTo').click()); }
const wSheet=E=>E.until(async()=>(await sheetTitle(E.page))==='WITHDRAW TO ANOTHER ADDRESS',5000);
const wsp=E=>E.page.evaluate(()=>document.getElementById('wsp').textContent);

/* ════════ a5v1: A PENDING WALLETCONNECT REQUEST WRITES INTO THE SHEET THAT REPLACED ITS OWN ════════
   On a phone a WalletConnect write opens the CONFIRM IN <APP> sheet (wcNudge) and later rewrites that sheet when the relay reports the
   request (wcNudgeSent: session_request_sent, or the 8 s fallback) and closes it when the request settles (wcNudgeOff). The sheet (#wsheet)
   is shared. The review's first form of this case reached the replacement through the keyboard behind the open sheet (Finding B); the
   modal sheet (audit 5b) closed that path, so the case now reaches it the ways that remain (audit 5b fix, rewritten from the review's case):
   row review  NATURAL ORDER: REVIEW is pressed (its owed read is held by the test: the page's storm.owed for the call wtoReview makes, and only
               that one), then a WalletConnect write starts (CONFIRM IN ZERION opens), then the read answers: wtoReview opens the review over
               the CONFIRM sheet. The 8 s fallback (the page's own timer, captured and run at that point) and the relay event for the nudge's
               own request must leave the review's text (recipient, amount) and buttons alone; the request settling must not close it; SEND
               in the review then sends withdrawTo(R1) once (guard).
   row menu    CONTROLLED STAND-IN (as a5b9 replaces with noWalletDesk()): walletMenu() (CONNECTED) replaces a pending CONFIRM sheet (H3). The
               fallback, the event and the settling leave CONNECTED as it is; CLOSE then closes it. A second pending request under CONNECTED:
               CLOSE closes CONNECTED (the nudge's own close callback, still registered, must not keep it open), the late answer reopens nothing.
   row connect CONTROLLED STAND-IN: the connection sheet of wcConnect (a fake provider whose pairing the test answers) is replaced by another
               sheet (the page's own sheet() with one disabled button); the 20 s fallback (captured, run), the connection link (display_uri)
               and the approval must not rewrite, re-enable or close that sheet; the connection itself still resolves.
   The WalletConnect side is a controlled probe (a fake _WC as in a4w/m9, the page's own ask(), wcHook and wcConnect); the timers are the
   page's own callbacks, captured by a setTimeout wrapper that holds only the 8 s nudge fallback and the 20 s connection fallback, run on cue
   (a gate, not a sleep). Every row asserts its trigger: the replaced sheet was the nudge's / the connection's, the replacement was on screen
   when the event, the fallback and the answer came. */
const capTimers=page=>page.evaluate(()=>{ if(window.__cap) return; const real=window.setTimeout; window.__cap={nudge:[],dead:[]};
  window.setTimeout=function(f,ms,...a){ const src=typeof f==='function'?String(f):'';
    if(ms===8000&&/wcNudgeSent/.test(src)){ window.__cap.nudge.push(f); return 0; }
    if(ms===20000&&/WALLETCONNECT DID NOT ANSWER/.test(src)){ window.__cap.dead.push(f); return 0; }
    return real.call(window,f,ms,...a); }; });
const fakeWC=page=>page.evaluate(()=>{ localStorage.setItem('SG_WC_APP',JSON.stringify({name:'ZERION',href:'https://link.zerion.io'}));
  const ev={h:{},on(n,f){(this.h[n]=this.h[n]||[]).push(f)},emit(n,x){(this.h[n]||[]).forEach(f=>f(x))}};
  const fake={session:{topic:'t0pic'},signer:{client:ev},reqs:[],request:a=>new Promise(r=>{ fake.reqs.push({a,r}); })}; window.__ev=ev; window.__fake=fake; _WC=fake; wcHook(fake); });
const nudgeOpen=page=>page.evaluate(()=>{ const k={done:false}; window.__k=window.__k||[]; window.__k.push(k); ask(window.__fake,'eth_sendTransaction',[{}]).then(()=>{ k.done=true; });
  return {title:document.getElementById('wsk').textContent,on:document.getElementById('wsheet').classList.contains('on'),live:!!NUDGE,fallbacks:window.__cap.nudge.length}; });
const nudgeEvent=(page,i)=>page.evaluate(i=>{ const q=window.__fake.reqs[i]; window.__ev.emit('session_request_sent',{id:1730000000123456+i,topic:'t0pic',request:Object.assign({},q.a),chainId:'eip155:1'}); },i);
const nudgeAnswer=(page,i)=>page.evaluate(i=>{ window.__fake.reqs[i].r('0x'+'11'.repeat(32)); },i);
const runFallbacks=(page,k)=>page.evaluate(k=>{ const L=window.__cap[k].splice(0); L.forEach(f=>f()); return L.length; },k);
const view=async page=>({on:await sheetOpen(page),title:await sheetTitle(page),text:await page.evaluate(()=>document.getElementById('wsp').textContent),btns:await sheetButtons(page),
  disabled:await page.evaluate(()=>[...document.querySelectorAll('#wsBtns button')].map(b=>b.disabled))});
const NUDGE_TEXT=/request is in|No word yet|Tap the app|Sending the request|one moment/i;
/* storm.owed held for the one call wtoReview makes (it writes its "Reading…" note first; refreshSeats writes none) */
const holdReviewRead=page=>page.evaluate(()=>{ const real=storm; window.__owed={held:0,go:null,real};
  storm=new Proxy(real,{get(t,k){ if(k==='owed'&&!window.__owed.go&&/^Reading what the contract owes/.test(document.getElementById('wtoNote').textContent))
      return a=>{ window.__owed.held++; return new Promise((res,rej)=>{ window.__owed.go=()=>t.owed(a).then(res,rej); }); };
    const v=t[k]; return typeof v==='function'?v.bind(t):v; }}); });
T('a5v1','a WalletConnect CONFIRM sheet replaced (by the withdrawal review in the natural order, by CONNECTED, and a connection sheet replaced): the late relay event, the 8 s / 20 s fallbacks, the connection link and the settling must not rewrite, re-enable or close the sheet that replaced it',
  {wallets:[one('A','0x1',{flags:{isMetaMask:true}})],ethereum:'A'},async E=>{
  const page=E.page; await connect(E); await capTimers(page); await fakeWC(page); await holdReviewRead(page);
  /* row review */
  await wOpen(E); await page.fill('#wtoAddr',R1L); await page.evaluate(()=>document.getElementById('wtoReview').click());
  const held=await E.until(()=>page.evaluate(()=>window.__owed.held===1&&!!window.__owed.go),5000);
  const nud=await nudgeOpen(page);
  await page.evaluate(()=>window.__owed.go()); const review=await wSheet(E); const before=await view(page), nudgeLive=await page.evaluate(()=>!!NUDGE);
  await page.evaluate(()=>{ storm=window.__owed.real; });
  const fb=await runFallbacks(page,'nudge'); const afterFallback=await view(page);
  await nudgeEvent(page,0); const afterEvent=await view(page);
  await nudgeAnswer(page,0); const answered=await E.until(()=>page.evaluate(()=>window.__k[0].done),3000); const settled=await view(page);
  await clickSheet(page,/SEND TO THIS ADDRESS/); const sent=await E.until(async()=>(await E.sends()).length>0,8000); const s=await E.sends();
  const keep=v=>v.on&&v.title==='WITHDRAW TO ANOTHER ADDRESS'&&v.text.includes(R1)&&/Currently: 0\.05/.test(v.text)&&v.btns.some(b=>/SEND TO THIS ADDRESS/.test(b))&&!NUDGE_TEXT.test(v.text)&&v.disabled.every(d=>d===false);
  const rowReview={trig:held&&/CONFIRM IN ZERION/.test(nud.title)&&nud.on&&nud.live&&nud.fallbacks===1&&review&&nudgeLive&&fb===1&&answered&&before.text.includes(R1),
    ok:keep(before)&&keep(afterFallback)&&keep(afterEvent)&&keep(settled)&&sent&&s.length===1&&sentTo(s[0])===R1,
    ev:{held,nudge:nud,before:before.text.slice(0,90),afterFallback:{title:afterFallback.title,text:afterFallback.text.slice(0,90),btns:afterFallback.btns},afterEvent:{title:afterEvent.title,text:afterEvent.text.slice(0,90)},settled:{on:settled.on,title:settled.title},sends:s.map(sentTo)}};
  /* row menu (H3) */
  const M=await H.boot({wallets:[one('A','0x1',{flags:{isMetaMask:true}})],ethereum:'A'},Object.assign({chain:c=>{ c.values.owed=ethers.parseEther('0.05'); }},IN_APP)); let rowMenu;
  try{ const p=M.page; await connect(M); await capTimers(p); await fakeWC(p); const me=await p.evaluate(()=>me);
    const n1=await nudgeOpen(p); await p.evaluate(()=>walletMenu()); const m1=await view(p);
    const fb1=await runFallbacks(p,'nudge'); const a1=await view(p); await nudgeEvent(p,0); const a2=await view(p);
    await nudgeAnswer(p,0); const ans=await M.until(()=>p.evaluate(()=>window.__k[0].done),3000); const a3=await view(p);
    await p.evaluate(()=>document.getElementById('wsX').click()); const x1=await view(p);
    const n2=await nudgeOpen(p); await p.evaluate(()=>walletMenu()); const m2=await view(p);
    await p.evaluate(()=>document.getElementById('wsX').click()); const x2=await view(p);
    await nudgeAnswer(p,1); const ans2=await M.until(()=>p.evaluate(()=>window.__k[1].done),3000); const x3=await view(p); const live=await p.evaluate(()=>!!NUDGE);
    const isMenu=v=>v.on&&v.title==='CONNECTED'&&v.text===me&&v.btns.length===1&&/DISCONNECT/.test(v.btns[0])&&v.disabled.every(d=>d===false);
    rowMenu={trig:/CONFIRM IN ZERION/.test(n1.title)&&n1.live&&isMenu(m1)&&fb1===1&&ans&&/CONFIRM IN ZERION/.test(n2.title)&&isMenu(m2)&&ans2,
      ok:isMenu(a1)&&isMenu(a2)&&isMenu(a3)&&!x1.on&&!x2.on&&!x3.on&&!live,
      ev:{afterFallback:{title:a1.title,text:a1.text.slice(0,80),btns:a1.btns},afterEvent:{title:a2.title,text:a2.text.slice(0,80)},afterSettle:{on:a3.on,title:a3.title},closeAfterSettle:x1.on,closeWhilePending:x2.on,afterLateAnswer:x3.on}}; }
  finally{ await M.close().catch(()=>{}); }
  /* row connect */
  const C=await H.boot({wallets:[]},IPHONE); let rowConnect;
  try{ const p=C.page; await capTimers(p);
    await p.evaluate(()=>{ const L={}; const fake={accounts:[],on(n,f){ (L[n]=L[n]||[]).push(f); return fake; },removeListener(n,f){ L[n]=(L[n]||[]).filter(x=>x!==f); return fake; },
        enable:()=>new Promise(r=>{ window.__approve=()=>{ fake.accounts=['0x00000000000000000000000000000000000000aa']; r(fake.accounts); }; }),emit:(n,x)=>(L[n]||[]).slice().forEach(f=>f(x))};
      window.__wcf=fake; _WC=fake; window.__conn={state:'pending'}; wcConnect(false).then(v=>{ window.__conn.state=v===fake?'resolved':'resolved other'; },e=>{ window.__conn.state='rejected '+e.message; }); });
    const own=await C.until(async()=>(await sheetTitle(p))==='CONNECT YOUR WALLET'&&await p.evaluate(()=>window.__cap.dead.length===1&&typeof window.__approve==='function'),5000);
    await p.evaluate(()=>{ sheet('PROBE SHEET','probe text','',[['PROBE BUTTON',()=>{}]]); document.querySelector('#wsBtns button').disabled=true; }); const r0=await view(p);
    const fbd=await runFallbacks(p,'dead'); const r1=await view(p);
    await p.evaluate(()=>window.__wcf.emit('display_uri','wc:'+'0'.repeat(63)+'1@2?relay-protocol=irn&symKey='+'11'.repeat(32))); const r2=await view(p);
    await p.evaluate(()=>window.__approve()); const res=await C.until(()=>p.evaluate(()=>window.__conn.state!=='pending'),3000); const r3=await view(p), st=await p.evaluate(()=>window.__conn.state);
    await p.evaluate(()=>document.getElementById('wsX').click()); const r4=await view(p);
    const isProbe=v=>v.on&&v.title==='PROBE SHEET'&&v.text==='probe text'&&v.btns.length===1&&v.disabled[0]===true;
    rowConnect={trig:own&&isProbe(r0)&&fbd===1&&res,ok:isProbe(r1)&&isProbe(r2)&&isProbe(r3)&&st==='resolved'&&!r4.on,
      ev:{afterFallback:{title:r1.title,text:r1.text.slice(0,60),disabled:r1.disabled},afterLink:{title:r2.title,text:r2.text.slice(0,60),disabled:r2.disabled},afterApproval:{on:r3.on,title:r3.title},connection:st,closed:!r4.on}}; }
  finally{ await C.close().catch(()=>{}); }
  const rows={review:rowReview,menu:rowMenu,connect:rowConnect};
  return {pass:Object.values(rows).every(r=>r&&r.trig&&r.ok), ev:Object.fromEntries(Object.entries(rows).map(([k,r])=>[k,{trig:r.trig,ok:r.ok,...r.ev}]))}; },
  Object.assign({chain:c=>{ c.values.owed=ethers.parseEther('0.05'); }},IN_APP));

/* ════════ a5v2: SEND TO THIS ADDRESS AFTER THE PAGE ITSELF FOUND NOTHING OWED ════════
   The review sheet is opened with owed 0.05. While it is open the page's next read (refreshSeats: every tick, after any write) finds owed 0
   and closes WITHDRAW TO ANOTHER ADDRESS (wtoOff: WTO.k moves on, the button and the box go). On 50ac8a5/0533881 the review sheet stayed
   open with SEND TO THIS ADDRESS, and wtoSend checked only the session (gen, account), so SEND still asked the wallet for a withdrawTo the
   contract must revert ("nothing owed"): only the fee is spent. (owed can fall to 0 while the review is open through a WITHDRAW in another
   tab, a payout of the same wallet, or the visitor's own earlier withdrawal confirming.)
   audit 5b fix: the read that closes the box also closes the review (a toast says so), and SEND refuses a review the box has moved past.
   The press is the visitor's SEND in that very review: the test holds the button the review showed and presses it after the read (a press
   that arrives as the read closes the review); on the fixed page it must reach wtoSend (its refusal toast is the barrier) and ask nothing.
   Trigger asserted: the sheet showed 0.05 and R1, the page then read owed 0 and hid the button/box, and SEND was pressed.
   Pass: the review closed by the read, with its toast; no eth_estimateGas / eth_sendTransaction reaches the wallet within 5 s of the press
   (an absence window, after the press is proven). Guard (passes on 50ac8a5 too): with owed unchanged, SEND does ask the wallet (one
   withdrawTo to R1). */
async function a5v2Row(E,drop){ const c=E.chain; c.values.owed=ethers.parseEther('0.05'); c.holdReceipts=true;
  await E.page.evaluate(()=>refreshSeats()); await wOpen(E); await E.page.fill('#wtoAddr',R1L); await E.page.evaluate(()=>document.getElementById('wtoReview').click());
  const sheet=await wSheet(E), text=await wsp(E); let closed=null, sheetClosed=null, closeToast=null;
  const held=await E.page.evaluate(()=>{ window.__send=[...document.querySelectorAll('#wsBtns button')].find(b=>/SEND TO THIS ADDRESS/.test(b.textContent))||null; return !!window.__send; });
  const n0=(await E.toasts()).length;
  if(drop){ c.values.owed=0n; await E.page.evaluate(()=>refreshSeats()); closed=await E.until(async()=>!(await shown(E))&&await E.page.evaluate(()=>document.getElementById('wtoBox').hidden),5000);
    sheetClosed=!(await sheetOpen(E.page)); closeToast=(await E.toasts()).slice(n0).find(x=>/owes this wallet nothing now/.test(x))||null; }
  const est0=await reqs(E,'A','eth_estimateGas'), snd0=await reqs(E,'A','eth_sendTransaction'), n1=(await E.toasts()).length;
  const pressed=await E.page.evaluate(()=>{ if(!window.__send) return false; window.__send.click(); return true; });
  const reached=drop?await E.until(async()=>(await E.toasts()).slice(n1).some(x=>/Nothing was sent/.test(x))||(await reqs(E,'A','eth_estimateGas'))>est0,5000):true;
  const asked=await E.until(async()=>(await reqs(E,'A','eth_estimateGas'))>est0||(await reqs(E,'A','eth_sendTransaction'))>snd0,5000);
  const s=await E.sends();
  return {sheet,shown005:text.includes('0.05')&&text.includes(R1),closedByRead:closed,sheetClosedByRead:sheetClosed,closeToast,held,pressed,pressReached:reached,walletAsked:asked,
    estimate:(await reqs(E,'A','eth_estimateGas'))-est0,send:(await reqs(E,'A','eth_sendTransaction'))-snd0,sends:s.length,toasts:(await E.toasts()).slice(-2)}; }
T('a5v2','the page reads owed 0 while the withdrawal review is open (button and box closed): the review closes with them, and SEND TO THIS ADDRESS pressed in it asks the wallet nothing; guard: owed unchanged, SEND asks once',
  {wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E);
  const drop=await a5v2Row(E,true);
  await E.until(async()=>(await E.sends()).length>0||!(await E.page.evaluate(()=>!!OPLOCK)),8000); drop.sendsAfterWait=(await E.sends()).length;
  /* guard in a fresh context (no write left in flight from the row above) */
  const G=await H.boot({wallets:[one('A')],ethereum:'A'},{chain:c=>{ c.values.owed=ethers.parseEther('0.05'); }}); let guard;
  try{ await connect(G); guard=await a5v2Row(G,false); await G.until(async()=>(await G.sends()).length>0,8000); guard.sends=(await G.sends()).length; } finally{ await G.close().catch(()=>{}); }
  const trig=drop.sheet&&drop.shown005&&drop.closedByRead&&drop.held&&drop.pressed&&drop.pressReached;
  return {pass:trig&&drop.sheetClosedByRead===true&&!!drop.closeToast&&!drop.walletAsked&&drop.sends===0&&drop.sendsAfterWait===0&&guard.sheet&&guard.held&&guard.walletAsked&&guard.sends===1, ev:{drop,guard}}; },
  {chain:c=>{ c.values.owed=ethers.parseEther('0.05'); }});

/* ════════ a5v3: THE STAGING CHAIN'S REPLACEMENTS DO NOT DO WHAT THEY CLAIM ════════
   test-wallet.html (built from 50ac8a5; served from the repo root by run.sh), SIMULATION. stage.js txResolve: a REPLACED outcome mines a
   replacement withdraw() call to the contract with status 1, and a SPED UP outcome mines the same call again with status 1 and applies it,
   but neither goes through chainVerdict() and a replacement's effect is never applied. So on the simulated chain:
     replaced   withdraw() of the sender is mined OK, yet owed stays 0.05 and nothing is paid: the staging page backs the claim "What is
                owed stays in the contract" that a replacement withdraw() makes false (request §4: a replacement may itself withdraw);
     sped       withdrawTo(R1) re-sent with a higher fee is mined OK and pays R1 although CONTROLS says the recipient rejects ETH: on the
                contract it reverts ("failed"); the page then says "Done: paid to R1".
   Trigger asserted: the replacement transaction exists, is a withdraw()/withdrawTo() of the sender, and is mined.
   Pass: the chain's state agrees with the mined replacement: replaced withdraw() with status 1 => owed 0 and the sender paid (or status 0
   and owed kept); sped-up withdrawTo to a rejecting recipient => status 0, owed kept, R1 paid nothing. */
async function a5v3Row(E,auto,recipient){ const acct='0x'+'a11'.padStart(40,'0');
  await E.page.evaluate(([auto,recipient])=>{ __SG.scenario('owed','0.05'); __SG.configure({auto,recipient,mine:200,readerMs:20}); },[auto,recipient]);
  await E.page.evaluate(()=>refreshSeats()); await wOpen(E); await E.page.fill('#wtoAddr',R1L); await E.page.evaluate(()=>document.getElementById('wtoReview').click());
  if(!(await wSheet(E))) throw new Error('no review sheet');
  const n0=(await E.toasts()).length; await clickSheet(E.page,/SEND TO THIS ADDRESS/);
  const word=auto==='replaced'?/replaced it with another transaction/:/confirmed \(sped up|failed on Ethereum/;
  const told=await E.until(async()=>(await E.toasts()).slice(n0).some(x=>word.test(x)),20000);
  const r=await E.page.evaluate(acct=>{ const all=[...__SG.chain.txs.values()]; const x=all.filter(t=>t.replaces).pop();
    return x?{action:x.action,from:x.from,to:x.to,block:x.block,status:x.status,state:x.state,owed:__SG.owedOf(acct),receivedSender:__SG.receivedOf(acct),receivedR1:__SG.receivedOf('0x52908400098527886e0f7030069857d2e4169ee7'),
      payouts:__SG.payouts().slice(-2)}:null; },acct);
  const note=await E.page.evaluate(()=>document.getElementById('wtoNote').textContent);
  await E.page.evaluate(()=>{ __SG.configure({auto:'ask'}); });
  return {auto,recipient,told,tx:r,note:note.slice(0,140),toast:(await E.toasts()).slice(-1)[0]}; }
T('a5v3','staging SIMULATION: a mined REPLACED withdraw() and a mined SPED UP withdrawTo must agree with the simulated contract (the replacement withdraws what is owed; a re-sent withdrawTo to a recipient that rejects ETH reverts)',{wallets:[]},async E=>{
  await E.until(()=>E.page.evaluate(()=>typeof __SG!=='undefined'),5000);
  await H.closeWit(E.page); await E.page.click('#wallet'); if(await E.until(()=>sheetOpen(E.page),4000)) await clickSheet(E.page,/SIM ALPHA · 1/);
  if(!(await E.until(async()=>/0x/.test(await E.label()),8000))) throw new Error('sim did not connect');
  const rep=await a5v3Row(E,'replaced','accepts');
  await E.until(async()=>!(await E.page.evaluate(()=>!!OPLOCK)),5000);
  const sped=await a5v3Row(E,'sped','rejects');
  const ONE5=String(ethers.parseEther('0.05'));
  const trig=rep.told&&rep.tx&&rep.tx.action==='withdraw'&&rep.tx.block!=null&&sped.told&&sped.tx&&sped.tx.action==='withdrawTo'&&sped.tx.block!=null;
  const repOk=rep.tx&&(rep.tx.status===1?(rep.tx.owed==='0'&&rep.tx.receivedSender===ONE5):(rep.tx.owed===ONE5));
  const spedOk=sped.tx&&sped.tx.status===0&&sped.tx.owed===ONE5&&sped.tx.receivedR1==='0';
  return {pass:!!(trig&&repOk&&spedOk), ev:{replaced:rep,sped}}; },{query:(process.env.A5V_STAGING||'test-wallet.html')+'?sgmode=sim'});   /* A5V_STAGING: another staging build under the served root (fix probes only) */

module.exports={};
