/* Audit-5b screenshots + probes at the six law-8 sizes, mock wallets and the fake chain only (wallet.test.js boot()). Keyboard driven, so the
   focus ring shows where a keyboard user is:
   review_head  REVIEW pressed with Enter: the withdrawal review open, focus on its heading (ring), the page behind inert
   review_send  then Tab: focus ring on SEND TO THIS ADDRESS
   choice_head  CONNECT pressed with Enter (two wallets): CONNECT WITH open, focus on its heading
   choice_tab   then Tab: focus ring on the first wallet
   box          the recipient box: label ADDRESS TO PAY, a refused address (aria-invalid) and its message
   usage: PORT=8925 SHOTS=/dir [ONLY=review_head,box] [SIZES=1440x900,390x844] SCRIPT=audit5b-shots.js bash tools/stormglass/wallet-tests/run.sh */
const fs=require('fs'), path=require('path'); const {chromium}=require('playwright');
const {ethers}=require('ethers');
const T=require('./wallet.test.js'); const {sleep,one}=T;
const OUT=process.env.SHOTS||'/tmp/claude-0/audit5b-shots'; fs.mkdirSync(OUT,{recursive:true});
const ONLY=(process.env.ONLY||'').split(',').filter(Boolean);
const SIZES=(process.env.SIZES||'1440x900,1366x768,1280x800,1024x768,768x1024,390x844').split(',').map(s=>s.split('x').map(Number));
const PHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MetaMaskMobile/7.40.0';
const OWED={chain:c=>{ c.values.owed=ethers.parseEther('0.05'); }};
const probe=page=>page.evaluate(()=>{ const a=document.activeElement, s=document.getElementById('wsheet'), b=s.querySelector('.box').getBoundingClientRect(), r=a&&a.getBoundingClientRect(), root=document.documentElement;
  const top=[...document.body.children].filter(el=>!/^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(el.tagName)&&!['wsheet','toast','nx-tip'].includes(el.id));
  return {sheet:s.classList.contains('on'),title:document.getElementById('wsk').textContent,active:a===document.body?'BODY':a.id?'#'+a.id:a.tagName+':'+a.textContent.trim().slice(0,30),focusVisible:!!a&&a.matches(':focus-visible'),
    outline:a?getComputedStyle(a).outlineStyle+' '+getComputedStyle(a).outlineWidth:null,activeBox:r?[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]:null,
    boxInside:s.classList.contains('on')?b.left>=0&&b.top>=0&&b.right<=innerWidth+0.5&&b.bottom<=innerHeight+0.5:null,bgInert:top.every(el=>el.inert),hscroll:root.scrollWidth>innerWidth,
    invalid:document.getElementById('wtoAddr').getAttribute('aria-invalid'),text:s.classList.contains('on')?document.getElementById('wsp').textContent.slice(0,220):document.getElementById('wtoNote').textContent.slice(0,160)}; });
async function openBox(E){ await T.connect(E); await T.closeWit(E.page); await E.until(()=>E.page.evaluate(()=>document.getElementById('withdrawTo').style.display!=='none'),8000);
  await E.page.evaluate(()=>document.getElementById('withdrawTo').click()); }
async function review(E){ await openBox(E); await E.page.fill('#wtoAddr','0x52908400098527886e0f7030069857d2e4169ee7'); await E.page.focus('#wtoReview'); await E.page.keyboard.press('Enter');
  if(!(await E.until(async()=>(await T.sheetTitle(E.page))==='WITHDRAW TO ANOTHER ADDRESS',6000))) throw new Error('no review sheet'); await sleep(300); }
async function choice(E){ await E.page.focus('#wallet'); await E.page.keyboard.press('Enter'); if(!(await E.until(async()=>(await T.sheetTitle(E.page))==='CONNECT WITH',6000))) throw new Error('no wallet list'); await sleep(300); }
const STATES={
  review_head:{cfg:{wallets:[one('A')],ethereum:'A'},o:OWED,run:review},
  review_send:{cfg:{wallets:[one('A')],ethereum:'A'},o:OWED,run:async E=>{ await review(E); await E.page.keyboard.press('Tab'); await sleep(200); }},
  choice_head:{cfg:{wallets:[one('A'),one('B')],ethereum:'A'},desk:true,run:choice},   /* desk: a narrow desktop browser at 390 (a phone connects its own wallet without a list) */
  choice_tab:{cfg:{wallets:[one('A'),one('B')],ethereum:'A'},desk:true,run:async E=>{ await choice(E); await E.page.keyboard.press('Tab'); await sleep(200); }},
  box:{cfg:{wallets:[one('A')],ethereum:'A'},o:OWED,run:async E=>{ await openBox(E); await E.page.fill('#wtoAddr','vitalik.eth'); await E.page.focus('#wtoReview'); await E.page.keyboard.press('Enter'); await sleep(300);
    await E.page.focus('#wtoAddr'); await E.page.evaluate(()=>document.getElementById('wtoBox').scrollIntoView({block:'center'})); await sleep(400); }},
};
(async()=>{
  const br=await chromium.launch({args:['--no-sandbox','--disable-background-networking','--disable-component-update','--no-first-run','--webrtc-ip-handling-policy=disable_non_proxied_udp'],executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'}); T.setBrowser(br);
  const rows=[]; let bad=0;
  for(const [name,S] of Object.entries(STATES)){ if(ONLY.length&&!ONLY.includes(name)) continue;
    for(const [w,h] of SIZES){ const o=Object.assign({viewport:{width:w,height:h}},S.o||{}); if(w<=420&&!S.desk){ o.mobile=true; o.ua=PHONE; }
      let E=null, row={state:name,size:w+'x'+h};
      try{ E=await T.boot(S.cfg,o); await S.run(E); row.probe=await probe(E.page); row.pageErrors=E.errors.slice(0,3);
        await E.page.screenshot({path:path.join(OUT,name+'_'+w+'x'+h+'.png')}); }
      catch(e){ row.error=String(e&&e.message||e).slice(0,200); bad++; }
      finally{ if(E) await E.close().catch(()=>{}); }
      rows.push(row); console.log(name.padEnd(12)+' '+(w+'x'+h).padEnd(9)+' '+JSON.stringify(row.error?{error:row.error}:row.probe)); } }
  fs.writeFileSync(path.join(OUT,'probe.json'),JSON.stringify(rows,null,1)); await br.close(); console.log('SHOTS '+(bad?'FAIL '+bad:'OK')+' '+rows.length+' shots -> '+OUT); process.exit(bad?1:0);
})().catch(e=>{ console.log('SHOTS FAIL',e&&e.stack||e); process.exit(1); });
