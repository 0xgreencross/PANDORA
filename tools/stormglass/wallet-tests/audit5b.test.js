/* THE AUDIT-5b PAGE CASES (audit/wallet-5b-page). Loaded by wallet.test.js (every audit5*.test.js is group @audit5). Same mocks, same fake
   chain: nothing real is touched (no wallet, no RPC, no relay). Self-contained: helpers below are local copies, the runner is not changed.
   a5b  THE WALLET SHEET IS MODAL (Finding B): focus moves into the sheet (to its heading, never to a pay button), Tab and Shift+Tab stay in it,
        the page behind is inert (no focus, no keyboard activation, hidden from assistive technology), every close takes inert off and gives
        focus back to the opener (or a visible fallback), replacement, nested overlays, removed openers, disconnect and account change.
   a5c  WITHDRAWAL WORDING AND OUTCOMES (Finding C): the review states a snapshot, not an amount the contract pays; owed that changes after REVIEW;
        outcome messages read owed again and never assert what a replacement left.
   a5d  CLAIM wording (the contract tries to pay; rejected ETH stays owed) and SWITCH with no wallet connected.
   a5e  found next to them: an Escape the wallet sheet takes also closed the WITNESS sheet under it.
   Every case asserts that its trigger was reached (the sheet shown, the gate hit, the event seen) before it asserts the outcome. */
const H=require('./wallet.test.js');
const {T,connect,sheetOpen,sheetTitle,sheetButtons,closeWit,openWit,sleep,DONE,A1,A2,B1}=H;
const {ethers}=require('ethers');
const one=(...a)=>H.one(...a);
const IN_APP={ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MetaMaskMobile/7.40.0',viewport:{width:390,height:844},mobile:true};
const IPHONE={ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',viewport:{width:390,height:844},mobile:true};
const NOTSENT=/Nothing was sent/i;
const CONTRACT='0xCf5EBA884EFA04940d31A663bEB6D37F907d064C';
const SGI=new ethers.Interface(['function withdrawTo(address)']);
const R1L='0x52908400098527886e0f7030069857d2e4169ee7', R1=ethers.getAddress(R1L), R2=ethers.getAddress('0xde709f2102306220921060314715629080e2fb77');
const OWED={chain:c=>{ c.values.owed=ethers.parseEther('0.05'); }};
const WCFG={wallets:[one('A')],ethereum:'A'};
const TWO={wallets:[one('A'),one('B')],ethereum:'A'};
const toastsSince=async(E,n)=>(await E.toasts()).slice(n);
const reqs=(E,id,m)=>E.page.evaluate(([id,m])=>__MW.log.filter(x=>x.pid===id&&x.method===m).length,[id,m]);
const allReqs=(E,ms,b=0)=>E.page.evaluate(([ms,b])=>__MW.log.slice(b).filter(x=>ms.includes(x.method)).map(x=>x.pid+':'+x.method),[ms,b]);   /* b: from this log position (base(E)) */
const base=E=>E.page.evaluate(()=>__MW.log.length);
const WRITES=['eth_sendTransaction','eth_estimateGas','eth_requestAccounts','wallet_switchEthereumChain','personal_sign','eth_signTypedData_v4'];
const sentTo=s=>{ try{ return SGI.decodeFunctionData('withdrawTo',s.params[0].data)[0]; }catch(e){ return 'not withdrawTo: '+String(s.params[0].data).slice(0,10); } };

/* the focus/modal state of the page, read in one go */
const FS=E=>E.page.evaluate(()=>{ const s=document.getElementById('wsheet'), a=document.activeElement;
  const desc=el=>!el?null:el===document.body?'BODY':el.id?'#'+el.id:(el.tagName+':'+(el.textContent||'').trim().slice(0,30));
  const top=[...document.body.children].filter(el=>!/^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(el.tagName)&&!['wsheet','toast','nx-tip'].includes(el.id));
  const lab=s.getAttribute('aria-labelledby'), L=lab&&document.getElementById(lab);
  const vis=el=>!!el&&el!==document.body&&el.getClientRects().length>0;
  return {on:s.classList.contains('on'),title:document.getElementById('wsk').textContent,active:desc(a),activeVisible:vis(a),inSheet:s.contains(a),heading:a===document.getElementById('wsk'),
    activeIsButton:!!a&&a.tagName==='BUTTON',role:s.getAttribute('role'),modal:s.getAttribute('aria-modal'),name:L?L.textContent:(s.getAttribute('aria-label')||''),
    bgInert:top.length>0&&top.every(el=>el.inert),bgNotInert:top.filter(el=>!el.inert).map(desc),anyInert:[...document.querySelectorAll('[inert]')].map(desc),
    overlays:[...document.querySelectorAll('#wsheet.on,.nx-sheet.on,#ccard.on,#pcard.on')].map(desc),dialogsOn:document.querySelectorAll('#wsheet.on').length}; });
const modalOk=s=>s.on&&s.role==='dialog'&&s.modal==='true'&&!!s.name&&s.inSheet&&s.heading&&s.bgInert;           /* open, named, focus on its heading, page behind inert */
const closedOk=(s,want)=>!s.on&&s.anyInert.length===0&&s.activeVisible&&!s.inSheet&&(!want||s.active===want);  /* closed, nothing inert, focus on a visible control */
/* keyboard walk: n presses, the focused element after each */
async function walk(E,n,key){ const out=[]; for(let i=0;i<n;i++){ await E.page.keyboard.press(key); out.push(await E.page.evaluate(()=>{ const a=document.activeElement;
  return {inSheet:document.getElementById('wsheet').contains(a),d:a===document.body?'BODY':a.id?'#'+a.id:(a.tagName+':'+(a.textContent||'').trim().slice(0,26)),glossary:!!(a.closest&&a.closest('dfn,#glossary,#nx-man'))}; })); } return out; }
/* Tab until the focused element's text matches re (inside the sheet), at most n presses; true when reached */
async function tabTo(E,re,n=8){ for(let i=0;i<n;i++){ await E.page.keyboard.press('Tab'); const t=await E.page.evaluate(()=>{ const a=document.activeElement; return document.getElementById('wsheet').contains(a)?(a.textContent||'').trim():null; }); if(t!=null&&re.test(t)) return true; } return false; }

const shown=E=>E.page.evaluate(()=>{ const b=document.getElementById('withdrawTo'); return !!b&&b.style.display!=='none'&&b.offsetParent!==null; });
const wNote=E=>E.page.evaluate(()=>document.getElementById('wtoNote').textContent);
const wsp=E=>E.page.evaluate(()=>document.getElementById('wsp').textContent);
async function wOpen(E){ await closeWit(E.page); if(!(await E.until(()=>shown(E),8000))) throw new Error('no WITHDRAW TO ANOTHER ADDRESS button');
  if(await E.page.evaluate(()=>document.getElementById('wtoBox').hidden)) await E.page.evaluate(()=>document.getElementById('withdrawTo').click()); }
const wSheet=E=>E.until(async()=>(await sheetTitle(E.page))==='WITHDRAW TO ANOTHER ADDRESS',5000);
/* REVIEW pressed from the keyboard: focus on REVIEW, Enter */
async function kReview(E,addr){ await E.page.fill('#wtoAddr',addr); await E.page.focus('#wtoReview'); await E.page.keyboard.press('Enter'); return wSheet(E); }
const clickBtn=(E,re)=>E.page.evaluate(src=>{ const b=[...document.querySelectorAll('#wsBtns button')].find(b=>new RegExp(src).test(b.textContent)); if(!b) return false; b.click(); return true; },re.source);

/* ════════ a5b: THE WALLET SHEET IS MODAL ════════ */
T('a5b1','withdrawal review opened from the keyboard: a named modal dialog; focus moves to its heading (not REVIEW behind it, not SEND); the page behind is inert; Enter and Space on the initial focus send nothing',WCFG,async E=>{
  await connect(E); await wOpen(E); const b0=await base(E); const sh=await kReview(E,R1L); const s=await FS(E);
  await E.page.keyboard.press('Enter'); await E.page.keyboard.press('Space'); await sleep(600);
  const after=await FS(E), w=await allReqs(E,WRITES,b0);
  return {pass:sh&&modalOk(s)&&s.name==='WITHDRAW TO ANOTHER ADDRESS'&&!s.activeIsButton&&after.on&&after.title==='WITHDRAW TO ANOTHER ADDRESS'&&w.length===0, ev:{sheet:sh,state:s,afterKeys:{on:after.on,active:after.active},walletWrites:w}}; },OWED);

T('a5b2','Tab and Shift+Tab cycle inside the review: 9 presses each way never reach the glossary or any control behind; SEND, CANCEL and CLOSE are each reached and the cycle wraps',WCFG,async E=>{
  await connect(E); await wOpen(E); const b0=await base(E); const sh=await kReview(E,R1L);
  const fw=await walk(E,9,'Tab'), bw=await walk(E,9,'Shift+Tab'), s=await FS(E);
  const names=fw.map(x=>x.d), every=fw.concat(bw).every(x=>x.inSheet&&!x.glossary);
  const reach=['SEND TO THIS ADDRESS','CANCEL','#wsX'].every(t=>names.some(n=>n.includes(t))), wraps=names.filter(n=>n.includes('SEND TO THIS ADDRESS')).length>=2;
  return {pass:sh&&every&&reach&&wraps&&s.on&&(await allReqs(E,WRITES,b0)).length===0, ev:{sheet:sh,forward:names,backward:bw.map(x=>x.d),outside:fw.concat(bw).filter(x=>!x.inSheet||x.glossary)}}; },OWED);

T('a5b3','while the review owns focus no write control behind it can be focused or activated by keyboard (CLAIM, WITHDRAW, WITHDRAW TO ANOTHER ADDRESS, REVIEW, WITNESS, COLLECT, the wallet button, the bar): nothing asked of the wallet, no other dialog opens',WCFG,async E=>{
  await connect(E); await wOpen(E); await E.until(()=>E.page.evaluate(()=>!document.getElementById('claim').disabled),5000); const b0=await base(E); const sh=await kReview(E,R1L);
  const IDS=['claim','withdraw','withdrawTo','wtoReview','wtoAddr','bWitCta','nx-witBtn','bPick','nx-barBtn','nx-barWit','wallet','nx-glBtn','nx-manAll'];
  const rows=[]; for(const id of IDS){ const r=await E.page.evaluate(id=>{ const el=document.getElementById(id); if(!el||!el.getClientRects().length) return null; el.focus(); return {focused:document.activeElement===el}; },id);
    if(!r) continue; await E.page.keyboard.press('Enter'); await E.page.keyboard.press('Space'); rows.push(Object.assign({id},r)); }
  await sleep(1200); const s=await FS(E), w=await allReqs(E,WRITES,b0);
  const claimTried=rows.some(r=>r.id==='claim');
  return {pass:sh&&claimTried&&rows.length>=6&&rows.every(r=>!r.focused)&&w.length===0&&s.on&&s.title==='WITHDRAW TO ANOTHER ADDRESS'&&s.overlays.length===1&&s.inSheet, ev:{sheet:sh,rows,walletWrites:w,overlays:s.overlays,active:s.active}}; },OWED);

T('a5b4','every close path of the review (CANCEL by keyboard, Escape, CLOSE by keyboard, the backdrop, SEND by keyboard) takes inert off and gives focus back to REVIEW; SEND sends once',WCFG,async E=>{
  await connect(E); await wOpen(E); const rows={};
  for(const how of ['cancel','escape','close','backdrop','send']){ const sh=await kReview(E,R1L); const open=await FS(E); let reached=true;
    if(how==='cancel') reached=await tabTo(E,/^CANCEL$/); else if(how==='close') reached=await tabTo(E,/^CLOSE$/); else if(how==='send') reached=await tabTo(E,/SEND TO THIS ADDRESS/);
    if(how==='escape') await E.page.keyboard.press('Escape'); else if(how==='backdrop') await E.page.mouse.click(4,4); else await E.page.keyboard.press('Enter');
    await E.until(async()=>!(await sheetOpen(E.page)),3000); const s=await FS(E);
    rows[how]={sheet:sh,openOk:modalOk(open),reached,closed:closedOk(s,'#wtoReview'),active:s.active,inert:s.anyInert}; }
  const sent=await E.until(async()=>(await E.sends()).length>0,8000); await sleep(500); const s=await E.sends();
  return {pass:Object.values(rows).every(r=>r.sheet&&r.openOk&&r.reached&&r.closed)&&sent&&s.length===1&&sentTo(s[0])===R1, ev:{rows,sends:s.map(sentTo)}}; },OWED);

T('a5b5','the wallet list (CONNECT WITH, two wallets) from the keyboard: modal, focus on its heading, Tab stays inside; Escape answers nothing (no wallet asked) and focus returns to CONNECT; picked by keyboard, that wallet connects, inert off, focus on the wallet button',TWO,async E=>{
  await E.page.focus('#wallet'); await E.page.keyboard.press('Enter'); const l1=await E.until(async()=>(await sheetTitle(E.page))==='CONNECT WITH',5000);
  const s1=await FS(E), w1=await walk(E,6,'Tab'); await E.page.keyboard.press('Escape'); await E.until(async()=>!(await sheetOpen(E.page)),3000); await sleep(400);
  const c1=await FS(E), asked1=(await reqs(E,'A','eth_requestAccounts'))+(await reqs(E,'B','eth_requestAccounts'));
  await E.page.focus('#wallet'); await E.page.keyboard.press('Enter'); const l2=await E.until(async()=>(await sheetTitle(E.page))==='CONNECT WITH',5000); const s2=await FS(E);
  const reached=await tabTo(E,/WALLET B/); await E.page.keyboard.press('Enter');
  const conn=await E.until(async()=>/00cc/i.test(await E.label()),6000); await sleep(400); const c2=await FS(E);
  return {pass:l1&&modalOk(s1)&&w1.every(x=>x.inSheet)&&closedOk(c1,'#wallet')&&asked1===0&&l2&&modalOk(s2)&&reached&&conn&&closedOk(c2,'#wallet')&&(await reqs(E,'A','eth_requestAccounts'))===0,
    ev:{list:l1,open:s1,tab:w1.map(x=>x.d),afterEscape:{active:c1.active,inert:c1.anyInert,asked:asked1},second:{list:l2,open:modalOk(s2),reached,connected:conn,active:c2.active,inert:c2.anyInert}}}; });

const PHONE_CFG={wallets:[one('A','0x1',{announce:false,flags:{isMetaMask:true},reject:{eth_requestAccounts:{code:-32603,message:'wallet error -32603'}}}),one('B','0x1',{authorized:true})],ethereum:'A'};
T('a5b6','CHOOSE ANOTHER WALLET (phone, this browser\'s wallet failed): the offer sheet and then the list are each modal with focus on the heading; chosen and picked by keyboard; inert off and focus on the wallet button at the end',{wallets:[]},async E0=>{
  const E=await H.boot(PHONE_CFG,IN_APP); try{
    await E.page.focus('#wallet'); await E.page.keyboard.press('Enter'); const o=await E.until(async()=>(await sheetTitle(E.page))==='YOUR WALLET DID NOT CONNECT',6000); const s1=await FS(E);
    const r1=await tabTo(E,/CHOOSE ANOTHER WALLET/); await E.page.keyboard.press('Enter');
    const l=await E.until(async()=>(await sheetTitle(E.page))==='CONNECT WITH',6000); const s2=await FS(E);
    const r2=await tabTo(E,/WALLET B/); await E.page.keyboard.press('Enter'); const conn=await E.until(async()=>/00cc/i.test(await E.label()),6000); await sleep(400); const s3=await FS(E);
    const errs=E.errors.slice();
    return {pass:o&&modalOk(s1)&&r1&&l&&modalOk(s2)&&s2.dialogsOn===1&&r2&&conn&&closedOk(s3,'#wallet')&&(await reqs(E,'A','eth_requestAccounts'))===1&&errs.length===0,
      ev:{offer:o,offerState:{heading:s1.heading,bgInert:s1.bgInert,active:s1.active},list:l,listState:{heading:s2.heading,bgInert:s2.bgInert,active:s2.active},reached:[r1,r2],connected:conn,end:{active:s3.active,inert:s3.anyInert},errors:errs}}; }
  finally{ await E.close().catch(()=>{}); } });

T('a5b7','disconnect while a sheet is open: the wallet ends the session during the withdrawal review, and during the CONNECTED dialog: the sheet closes, inert comes off, focus lands on a visible control, nothing is asked of the wallet',WCFG,async E=>{
  await connect(E); await wOpen(E); const sh=await kReview(E,R1L); const open=await FS(E);
  await E.P('A').set({authorized:false}); await E.P('A').emit('accountsChanged',[]);
  const gone=await E.until(async()=>/CONNECT/.test(await E.label())&&!/0x/.test(await E.label()),5000); await E.until(async()=>!(await sheetOpen(E.page)),3000); await sleep(300); const a=await FS(E);
  /* the CONNECTED dialog, then the wallet's own disconnect event */
  const X=await H.boot(WCFG,OWED); let b; try{ await connect(X); await X.page.focus('#wallet'); await X.page.keyboard.press('Enter'); const m=await X.until(async()=>(await sheetTitle(X.page))==='CONNECTED',4000); const mo=await FS(X);
    await X.P('A').emit('disconnect',{code:4900}); const g=await X.until(async()=>!/0x/.test(await X.label()),5000); await X.until(async()=>!(await sheetOpen(X.page)),3000); await sleep(300); const ms=await FS(X);
    b={menu:m,open:modalOk(mo),eventSeen:g,closed:closedOk(ms,'#wallet'),active:ms.active,inert:ms.anyInert,on:ms.on}; } finally{ await X.close().catch(()=>{}); }
  const w=await allReqs(E,['eth_sendTransaction','eth_estimateGas']);
  return {pass:sh&&modalOk(open)&&gone&&closedOk(a)&&a.active!=='BODY'&&w.length===0&&b.menu&&b.open&&b.eventSeen&&b.closed, ev:{review:{sheet:sh,open:modalOk(open),disconnected:gone,on:a.on,active:a.active,inert:a.anyInert,walletWrites:w},menu:b}}; },OWED);

T('a5b8','account change while the review is open: still one modal dialog with focus inside and the page behind inert; SEND then sends nothing ("Your wallet changed"), the sheet closes, inert comes off, focus lands on a visible control',WCFG,async E=>{
  await connect(E); await wOpen(E); const sh=await kReview(E,R1L);
  await E.P('A').emit('accountsChanged',[A2]); const moved=await E.until(async()=>/00bb/i.test(await E.label()),5000); await sleep(400); const s=await FS(E);
  const n=(await E.toasts()).length; const r=await tabTo(E,/SEND TO THIS ADDRESS/); await E.page.keyboard.press('Enter');
  const said=await E.until(async()=>(await toastsSince(E,n)).some(x=>/Your wallet changed\. Nothing was sent\./.test(x)),5000); await sleep(400); const c=await FS(E);
  const w=await allReqs(E,['eth_sendTransaction','eth_estimateGas']);
  return {pass:sh&&moved&&s.on&&s.dialogsOn===1&&s.inSheet&&s.bgInert&&r&&said&&closedOk(c)&&c.active!=='BODY'&&w.length===0, ev:{sheet:sh,moved,whileOpen:{on:s.on,inSheet:s.inSheet,bgInert:s.bgInert,active:s.active},reached:r,said,after:{active:c.active,inert:c.anyInert,on:c.on},walletWrites:w}}; },OWED);

T('a5b9','a sheet that replaces the open review (the page\'s own noWalletDesk() called while it is open): one dialog, the review\'s buttons gone, inert still on, focus on the new heading; closing it restores focus to REVIEW, the first opener',WCFG,async E=>{
  await connect(E); await wOpen(E); const b0=await base(E); const sh=await kReview(E,R1L); const s0=await FS(E);
  await E.page.evaluate(()=>noWalletDesk()); const s=await FS(E), btns=await sheetButtons(E.page);
  await E.page.keyboard.press('Escape'); await E.until(async()=>!(await sheetOpen(E.page)),3000); await sleep(200); const c=await FS(E);
  return {pass:sh&&modalOk(s0)&&s.title==='NO WALLET IN THIS BROWSER'&&s.dialogsOn===1&&!btns.some(b=>/SEND/.test(b))&&modalOk(s)&&closedOk(c,'#wtoReview')&&(await allReqs(E,WRITES,b0)).length===0,
    ev:{sheet:sh,replaced:{title:s.title,dialogs:s.dialogsOn,buttons:btns,heading:s.heading,bgInert:s.bgInert,active:s.active},closed:{active:c.active,inert:c.anyInert}}}; },OWED);

/* the wallet list opened over the WITNESS sheet by its WITNESS button (no wallet connected, two wallets) */
async function witList(E){ await openWit(E.page); await E.page.fill('#wAmt','0.01'); await E.page.focus('#bWit'); await E.page.keyboard.press('Enter');
  return E.until(async()=>(await sheetTitle(E.page))==='CONNECT WITH',6000); }
const witOn=E=>E.page.evaluate(()=>document.getElementById('nx-wit').classList.contains('on'));
T('a5b10','the opener is removed while the sheet is open (WITNESS button taken out of the WITNESS sheet, as a redraw would, by a controlled DOM removal): Escape closes the list, inert comes off, focus goes to a visible control of the WITNESS sheet still open, no error, nothing asked',TWO,async E=>{
  const l=await witList(E); const s=await FS(E); const gone=await E.page.evaluate(()=>{ const b=document.getElementById('bWit'); if(!b) return false; b.remove(); return !document.getElementById('bWit'); });
  await E.page.keyboard.press('Escape'); await E.until(async()=>!(await sheetOpen(E.page)),3000); await sleep(300); const c=await FS(E), wit=await witOn(E);
  const inWit=await E.page.evaluate(()=>document.getElementById('nx-wit').contains(document.activeElement));
  return {pass:l&&modalOk(s)&&gone&&closedOk(c)&&wit&&inWit&&E.errors.length===0&&(await allReqs(E,WRITES)).length===0, ev:{list:l,open:{heading:s.heading,bgInert:s.bgInert},removed:gone,after:{active:c.active,inert:c.anyInert,witnessSheet:wit,focusInWitness:inWit},errors:E.errors}}; });

T('a5b11','the recipient box has a persistent visible label and its message is linked: label ADDRESS TO PAY, aria-describedby the note, aria-invalid on a refused address and cleared on a good one',WCFG,async E=>{
  await connect(E); await wOpen(E);
  const a=await E.page.evaluate(()=>{ const i=document.getElementById('wtoAddr'); const L=[...(i.labels||[])]; return {labels:L.map(l=>l.textContent),labelVisible:L.some(l=>l.getClientRects().length>0),describedby:i.getAttribute('aria-describedby')||''}; });
  const byLabel=await E.page.getByLabel('ADDRESS TO PAY',{exact:true}).count();
  await E.page.fill('#wtoAddr','vitalik.eth'); await E.page.evaluate(()=>document.getElementById('wtoReview').click()); await sleep(300);
  const bad=await E.page.evaluate(()=>({invalid:document.getElementById('wtoAddr').getAttribute('aria-invalid'),note:document.getElementById('wtoNote').textContent}));
  const sh=await kReview(E,R1L); const good=await E.page.evaluate(()=>document.getElementById('wtoAddr').getAttribute('aria-invalid'));
  return {pass:a.labels.includes('ADDRESS TO PAY')&&a.labelVisible&&byLabel===1&&a.describedby.split(/\s+/).includes('wtoNote')&&bad.invalid==='true'&&/not a full Ethereum address/.test(bad.note)&&sh&&good===null, ev:{a,byLabel,bad,sheet:sh,afterGood:good}}; },OWED);

/* WalletConnect's CONFIRM sheet (phone): driven as audit 4's a4w cases drive it: a provider built as wc.js builds it, set as the page's _WC */
async function wcKit(E){ E.jumps=[];
  await E.page.route('https://link.zerion.io/**',r=>{ E.jumps.push(r.request().url()); r.fulfill({status:204,body:''}); });
  await E.page.evaluate(()=>{ localStorage.setItem('SG_WC_APP',JSON.stringify({name:'ZERION',href:'https://link.zerion.io'}));
    window.__K={ mk(topic){ const ev={h:{},on(n,f){ (this.h[n]=this.h[n]||[]).push(f); },emit(n,x){ (this.h[n]||[]).forEach(f=>f(x)); }};
        const P={reqs:[],signer:{client:ev},request(a){ const q={a,done:false}; P.reqs.push(q); return new Promise((res,rej)=>{ q.res=v=>{ q.done=true; res(v); }; q.rej=e=>{ q.done=true; rej(e); }; }); }};
        if(topic) P.session={topic}; return P; },
      ask(P,m,params){ const k={settled:false}; ask(P,m,params).then(()=>{ k.settled=true; },()=>{ k.settled=true; }); return k; } }; }); }
T('a5b12','WalletConnect CONFIRM sheet (phone): modal with focus on its heading, not on OPEN; when the request ends (the session rejects it) the sheet closes, inert off, focus back on the opener; closed by hand while the request is pending, inert off at once, the late answer reopens nothing',{wallets:[]},async E0=>{
  const E=await H.boot({wallets:[]},IPHONE); try{ await wcKit(E);
    await E.page.evaluate(()=>{ const P=__K.mk('T1'); _WC=P; wcHook(P); window.__P=P; document.getElementById('wallet').focus(); window.__k1=__K.ask(P,'eth_sendTransaction',[{to:'0x01'}]); });
    const s1=await FS(E), b1=await E.page.evaluate(()=>{ const b=document.querySelector('#wsBtns button'); return b?b.textContent:null; });
    await E.page.evaluate(()=>__P.reqs[0].rej(Object.assign(new Error('session ended'),{code:6000}))); const c1ok=await E.until(async()=>!(await sheetOpen(E.page)),3000); await sleep(200); const c1=await FS(E);
    await E.page.evaluate(()=>{ document.getElementById('wallet').focus(); window.__k2=__K.ask(__P,'eth_sendTransaction',[{to:'0x02'}]); }); const s2=await FS(E);
    await E.page.evaluate(()=>document.getElementById('wsX').click()); await sleep(200); const c2=await FS(E), pend=await E.page.evaluate(()=>!__k2.settled);
    await E.page.evaluate(()=>__P.reqs[1].res('0x'+'12'.repeat(32))); await E.until(()=>E.page.evaluate(()=>__k2.settled),3000); await sleep(200); const c3=await FS(E);
    return {pass:/CONFIRM IN ZERION/.test(s1.title)&&modalOk(s1)&&/OPEN ZERION/.test(b1||'')&&c1ok&&closedOk(c1,'#wallet')&&modalOk(s2)&&closedOk(c2,'#wallet')&&pend&&!c3.on&&c3.anyInert.length===0&&E.errors.length===0,
      ev:{open:{title:s1.title,heading:s1.heading,bgInert:s1.bgInert,active:s1.active,firstButton:b1},afterReject:{active:c1.active,inert:c1.anyInert},second:{heading:s2.heading},closedByHand:{active:c2.active,inert:c2.anyInert,stillPending:pend},afterLate:{on:c3.on,inert:c3.anyInert},errors:E.errors}}; }
  finally{ await E.close().catch(()=>{}); } });

/* ════════ a5c: WITHDRAWAL WORDING AND OUTCOMES ════════
   SEND is clicked here (the keyboard path is a5b's), so the unfixed page reaches each outcome and is judged on its wording. */
T('a5c1','the review says what withdrawTo does: all funds owed when the transaction executes, the current amount as a snapshot that can change, the full checksummed recipient; never "The contract pays X ETH"',WCFG,async E=>{
  await connect(E); await wOpen(E); const sh=await kReview(E,R1L); const t=await wsp(E);
  return {pass:sh&&/Withdraw all funds owed to your connected wallet 0x\S+ when this transaction executes\. Currently: 0\.05\d* ETH\./.test(t)&&/This is a snapshot: the amount can change before the transaction runs\./.test(t)&&t.includes('Paid to this address: '+R1)&&!/The contract pays/.test(t), ev:{sheet:sh,text:t}}; },OWED);

T('a5c2','owed rises after REVIEW (0.05 -> 0.08) and the box is edited to another address: the wallet gets withdrawTo(the reviewed address) with no amount in the call (36 bytes) and value 0; confirmed; no message ever states 0.05 as paid',{wallets:[one('A',undefined,{gate:{eth_sendTransaction:true}})],ethereum:'A'},async E=>{
  await connect(E); await wOpen(E); const c=E.chain; const sh=await kReview(E,R1L); const t=await wsp(E); const n=(await E.toasts()).length;
  c.values.owed=ethers.parseEther('0.08'); await E.page.evaluate(v=>{ document.getElementById('wtoAddr').value=v; },R2);
  await clickBtn(E,/SEND TO THIS ADDRESS/); const g=await E.waitGate('A','eth_sendTransaction',8000);
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_sendTransaction'); await E.until(async()=>(await E.sends()).length>0,8000); const s=(await E.sends())[0]||{params:[{}]}, q=s.params[0];
  c.values.owed=0n; const conf=await E.until(async()=>(await toastsSince(E,n)).some(x=>/Withdrawing to another address: confirmed/.test(x)),12000); await sleep(400);
  const said=(await toastsSince(E,n)).concat([await wNote(E)]);
  return {pass:sh&&/Currently: 0\.05/.test(t)&&!/pays/.test(t)&&g&&sentTo(s)===R1&&(q.data||'').length===2+8+64&&(q.value==null||BigInt(q.value)===0n)&&conf&&!said.some(x=>/0\.05/.test(x)), ev:{text:t,gateHit:g,to:sentTo(s),dataLen:(q.data||'').length,value:q.value||null,confirmed:conf,messages:said}}; },OWED);

T('a5c3','owed falls after REVIEW (0.05 -> 0.02) and new earnings leave 0.01 owed after it runs: the outcome says it paid what was owed when it ran (no amount) and reads owed again: "Owed to your connected wallet now: 0.01 ETH"; never 0.05 or 0.02',WCFG,async E=>{
  await connect(E); await wOpen(E); const c=E.chain; c.holdReceipts=true; const sh=await kReview(E,R1L); c.values.owed=ethers.parseEther('0.02');
  await clickBtn(E,/SEND TO THIS ADDRESS/); const sent=await E.until(async()=>(await E.sends()).length>0,8000);
  c.values.owed=ethers.parseEther('0.01'); c.holdReceipts=false;
  const done=await E.until(async()=>/Owed to your connected wallet now: 0\.01/.test(await wNote(E)),15000); const note=await wNote(E);
  return {pass:sh&&sent&&done&&new RegExp('^Confirmed: the contract paid everything this wallet was owed when the transaction ran to '+R1+'\\. Owed to your connected wallet now: 0\\.01\\d* ETH\\.$').test(note)&&!/0\.05|0\.02/.test(note), ev:{sheet:sh,sent,note}}; },OWED);

T('a5c4','owed becomes zero after REVIEW. What the page does: it does not read owed again before sending. (a) The wallet\'s gas estimate refuses (execution reverted: nothing owed): ethers estimates again and stops, eth_sendTransaction is never sent, the error is shown, never confirmed; REVIEW then says nothing is owed (no sheet). (b) A wallet that sends anyway: mined reverted, "failed on Ethereum (reverted)", never confirmed; owed read again (0) and WITHDRAW TO ANOTHER ADDRESS hidden',WCFG,async E=>{
  await connect(E); await wOpen(E); const c=E.chain; const sh=await kReview(E,R1L); c.values.owed=0n;
  await E.P('A').set({reject:{eth_estimateGas:{code:3,message:'execution reverted: nothing owed'}}}); let n=(await E.toasts()).length;
  await clickBtn(E,/SEND TO THIS ADDRESS/);
  const err=await E.until(async()=>(await toastsSince(E,n)).some(x=>/nothing owed/.test(x))&&await E.page.evaluate(()=>OPLOCK===null),10000); await sleep(500);
  const a={est:await reqs(E,'A','eth_estimateGas'),send:await reqs(E,'A','eth_sendTransaction'),toasts:await toastsSince(E,n)};
  await E.page.evaluate(()=>document.getElementById('wtoReview').click()); const said=await E.until(async()=>/The contract owes this wallet nothing now\./.test(await wNote(E)),6000); a.again={said,sheet:await sheetOpen(E.page)};
  /* (b) */
  const X=await H.boot(WCFG,OWED); let b; try{ await connect(X); await wOpen(X); const x=X.chain; const sh2=await kReview(X,R1L); x.values.owed=0n; x.rc=h=>x.mkRc(h,{status:'0x0'}); const m=(await X.toasts()).length;
    await clickBtn(X,/SEND TO THIS ADDRESS/);
    const rev=await X.until(async()=>(await toastsSince(X,m)).some(t=>/Withdrawing to another address: sent, but it failed on Ethereum \(reverted\)/.test(t)),15000);
    const hidden=await X.until(async()=>!(await shown(X)),6000); const t=await toastsSince(X,m);
    b={sheet:sh2,send:await reqs(X,'A','eth_sendTransaction'),reverted:rev,hidden,confirmed:t.some(y=>/confirmed/.test(y)),toasts:t}; } finally{ await X.close().catch(()=>{}); }
  return {pass:sh&&err&&a.est>=1&&a.send===0&&!a.toasts.some(x=>/confirmed/.test(x))&&a.again.said&&!a.again.sheet&&b.sheet&&b.send===1&&b.reverted&&b.hidden&&!b.confirmed, ev:{estimateRefused:a,sentAnyway:b}}; },OWED);

T('a5c5','the recipient refuses ETH (reverted): the note says it did not accept or nothing was owed, owed stays in the contract, and reads owed again (0.05); the box stays and REVIEW opens the review again (modal)',WCFG,async E=>{
  await connect(E); await wOpen(E); const c=E.chain; c.rc=h=>c.mkRc(h,{status:'0x0'}); const sh=await kReview(E,R1L);
  await clickBtn(E,/SEND TO THIS ADDRESS/);
  const done=await E.until(async()=>/Owed to your connected wallet now: 0\.05/.test(await wNote(E)),15000); const note=await wNote(E);
  const box=await E.page.evaluate(()=>!document.getElementById('wtoBox').hidden); c.rc=h=>c.mkRc(h); const again=await kReview(E,R2.toLowerCase()); const s=await FS(E);
  return {pass:sh&&done&&/^Failed on Ethereum \(reverted\): 0x\S+ did not accept the ETH, or nothing was owed any more\. What is owed stays in the contract\. You can try another address\. Owed to your connected wallet now: 0\.05\d* ETH\.$/.test(note)&&box&&again&&modalOk(s), ev:{sheet:sh,note,boxOpen:box,reviewAgain:again,modal:modalOk(s)}}; },OWED);

/* a replacement found by the page's own scan (audit 2's replaceCase, for withdrawTo): nonce 7, a mined transaction of the sender with nonce 7 */
const replaced=kind=>async E=>{ await connect(E); await E.page.evaluate(()=>{ Object.assign(TRACK,{poll:400}); }); await E.P('A').set({txNonce:'0x7'});
  const c=E.chain; let mine=null; c.tx=h=>h===mine?null:c.mkTx(h,{nonce:'0x7',blockHash:null,blockNumber:null,transactionIndex:null}); c.rc=h=>null; c.nonceLatest=7;
  await wOpen(E); const sh=await kReview(E,R1L); const n=(await E.toasts()).length; await clickBtn(E,/SEND TO THIS ADDRESS/);
  await E.until(async()=>(await E.sends()).length>0,8000); const s=(await E.sends())[0], q=s.params[0]; await sleep(1500);
  const H2='0x'+'ab'.repeat(32), B=c.blockNo();
  const rtx=kind==='cancelled'?{to:q.from,input:'0x',value:'0x0'}:{to:'0x000000000000000000000000000000000000dEaD',input:'0xdeadbeef',value:'0x0'};
  const tx2=c.mkTx(H2,Object.assign({from:q.from,nonce:'0x7',blockNumber:'0x'+B.toString(16),gasPrice:'0x77359400',maxFeePerGas:'0x77359400'},rtx));
  mine=s.hash; c.blockTxs=x=>x===B?[tx2]:[]; c.rc=h=>h===H2?c.mkRc(H2,{from:q.from,to:rtx.to,blockNumber:'0x'+B.toString(16),status:'0x1'}):null; c.tx=h=>h===H2?tx2:null; c.nonceLatest=8;
  c.values.owed=ethers.parseEther('0.03');
  const seen=await E.until(async()=>(await toastsSince(E,n)).some(x=>new RegExp(kind==='cancelled'?'cancel':'replaced','i').test(x)),20000);
  const done=await E.until(async()=>/Owed to your connected wallet now: 0\.03/.test(await wNote(E)),8000); const note=await wNote(E);
  return {pass:sh&&seen&&done&&new RegExp('^This transaction did not run: your wallet '+(kind==='cancelled'?'cancelled it':'replaced it with another one, which may itself have withdrawn')+'\\. Check your wallet\\. Owed to your connected wallet now: 0\\.03\\d* ETH\\.$').test(note)&&!/stays in the contract/.test(note), ev:{kind,sheet:sh,outcomeSeen:seen,note,toasts:await toastsSince(E,n)}}; };
T('a5c6','replaced in the wallet by another transaction: the note does not say what is owed stays (the replacement may itself have withdrawn); it says so, and reads owed again (0.03)',WCFG,replaced('replaced'),OWED);
T('a5c7','cancelled in the wallet after it was sent (0 ETH to itself, no data: it cannot have withdrawn): the note says only that it was cancelled, no claim that the owed amount stayed and no claim that the cancellation withdrew; owed read again (0.03)',WCFG,replaced('cancelled'),OWED);

/* ════════ a5d: CLAIM and SWITCH wording ════════ */
T('a5d1','CLAIM everywhere says the contract TRIES to pay and ETH a wallet rejects stays owed: the manual rule, the seats note (live; the demo text in the page source), and the toast after a confirmed CLAIM; "CLAIM sends everything" is gone',WCFG,async E=>{
  await connect(E); await E.until(()=>E.page.evaluate(()=>/press CLAIM/.test(document.getElementById('seatsNote').textContent)),6000);
  const r=await E.page.evaluate(()=>{ const all=document.body.textContent.replace(/\s+/g,' '); const note=document.getElementById('seatsNote').textContent;
    return {rule:/CLAIM: the contract tries to pay your wallet everything your seats have earned; if your wallet rejects the ETH, it stays in the contract, owed to your wallet \(see below\)\./.test(all),
      old:/CLAIM sends everything|press CLAIM, or the contract tries/.test(all+note+refreshSeats.toString()), note,
      noteOk:/press CLAIM, or wait for the next time this wallet collects a plate or witnesses: either way the contract tries to send it to you in that transaction, and ETH your wallet rejects stays owed to it, for WITHDRAW/.test(note),
      demoOk:(refreshSeats.toString().match(/either way the contract tries to send it to you in that transaction, and ETH your wallet rejects stays owed to it, for WITHDRAW/g)||[]).length===2}; });
  const n=(await E.toasts()).length; await E.page.evaluate(()=>document.getElementById('claim').click());
  const t=await E.until(async()=>(await toastsSince(E,n)).some(x=>/Claiming your seat earnings: confirmed\. The contract tried to send your earnings to your wallet: anything your wallet rejected is owed to it now \(OWED, WITHDRAW\)\./.test(x)),12000);
  return {pass:r.rule&&!r.old&&r.noteOk&&r.demoOk&&t, ev:{r,claimToast:t,toasts:await toastsSince(E,n)}}; },{chain:c=>{ c.values.owed=0n; }});

T('a5d2','SWITCH with no wallet connected: "Connect a wallet first." (never that an absent wallet is on another network) and no provider is asked to switch: switchChain() with nobody connected, and COLLECT\'s SWITCH TO ETHEREUM after the wallet ended the session',{wallets:[one('A','0x2105')],ethereum:'A'},async E=>{
  let n=(await E.toasts()).length; const r0=await E.page.evaluate(()=>switchChain()); await sleep(300); const t0=await toastsSince(E,n);
  await connect(E); await closeWit(E.page); await E.page.evaluate(()=>{ if(!NX.pop) document.getElementById('bPick').click(); document.querySelectorAll('#candGrid .card')[3].click(); }); await E.page.waitForSelector('#ccBuy');
  await E.page.evaluate(()=>document.getElementById('ccBuy').click()); const wrong=await E.until(()=>E.page.evaluate(()=>!!document.getElementById('nx-switch')),8000);
  await E.page.evaluate(()=>{ window.__a5d2sw=document.getElementById('nx-switch'); });   /* held from before the session ends: since a5p1 the stale view (and its button) goes with the wallet */
  await E.P('A').emit('disconnect',{code:4900}); const gone=await E.until(async()=>!/0x/.test(await E.label()),5000);
  const sw0=await reqs(E,'A','wallet_switchEthereumChain'); n=(await E.toasts()).length; const has=await E.page.evaluate(()=>{ const b=window.__a5d2sw; if(!b) return false; b.click(); return true; });
  const said=await E.until(async()=>(await toastsSince(E,n)).length>0,4000); await sleep(400); const t1=await toastsSince(E,n);
  const sw=await allReqs(E,['wallet_switchEthereumChain']);
  return {pass:r0===false&&t0.length===1&&t0[0]==='Connect a wallet first.'&&wrong&&gone&&has&&said&&t1[0]==='Connect a wallet first.'&&!t1.some(x=>/another network/i.test(x))&&sw.length===0&&sw0===0,
    ev:{direct:{ret:r0,toasts:t0},wrongView:wrong,disconnected:gone,switchButton:has,toasts:t1,switchRequests:sw}}; });

/* ════════ a5e: found next to them ════════ */
T('a5e1','nested: the wallet list opened by WITNESS over the WITNESS sheet; Escape closes the list only (the WITNESS sheet stays open; it closed both), inert comes off and focus returns to WITNESS; nothing asked',TWO,async E=>{
  const l=await witList(E); const s=await FS(E), under=await witOn(E);
  await E.page.keyboard.press('Escape'); await E.until(async()=>!(await sheetOpen(E.page)),3000); await sleep(300); const c=await FS(E), wit=await witOn(E);
  return {pass:l&&under&&modalOk(s)&&wit&&closedOk(c,'#bWit')&&(await allReqs(E,WRITES)).length===0, ev:{list:l,witnessUnder:under,open:{heading:s.heading,bgInert:s.bgInert},afterEscape:{witnessSheet:wit,active:c.active,inert:c.anyInert}}}; });

module.exports={};
