/* Audit-5 page screenshots + geometry probes at the six law-8 sizes. Mock wallets and the fake chain only (wallet.test.js boot()).
   States: wto (the WITHDRAW TO ANOTHER ADDRESS box open under the seats, a refused address and its reason), wtosheet (the confirmation
   sheet: full checksummed address and amount), wtofailed (the box after the recipient refused ETH: reverted), offer (a wallet app's own
   wallet failed to connect: YOUR WALLET DID NOT CONNECT with CHOOSE ANOTHER WALLET; phone/tablet wallet-app browser at every size).
   usage: PORT=8925 SHOTS=/dir [ONLY=wto,offer] SCRIPT=audit5page-shots.js bash tools/stormglass/wallet-tests/run.sh */
const fs=require('fs'), path=require('path'); const {chromium}=require('playwright');
const {ethers}=require('ethers');
const T=require('./wallet.test.js'); const {sleep,one,A1}=T;
const OUT=process.env.SHOTS||'/tmp/claude-0/audit5page-shots'; fs.mkdirSync(OUT,{recursive:true});
const ONLY=(process.env.ONLY||'').split(',').filter(Boolean);
const SIZES=[[1440,900],[1366,768],[1280,800],[1024,768],[768,1024],[390,844]];
const PHONE_APP='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MetaMaskMobile/7.40.0';
const PAD_APP='Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MetaMaskMobile/7.40.0';
const probe=(page,sel)=>page.evaluate(sel=>{ const e=document.querySelector(sel); const r=e&&e.getBoundingClientRect(); const root=document.documentElement;
  return {sel,shown:!!e&&e.getClientRects().length>0,box:r?[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]:null,
    inside:!!r&&r.left>=0&&r.top>=0&&r.right<=innerWidth+0.5&&r.bottom<=innerHeight+0.5,hscroll:root.scrollWidth>innerWidth,
    text:e?e.textContent.replace(/\s+/g,' ').trim().slice(0,200):null}; },sel);
const OWED={chain:c=>{ c.values.owed=ethers.parseEther('0.05'); }};
async function box(E,addr){ await T.connect(E); await T.closeWit(E.page); await E.until(()=>E.page.evaluate(()=>document.getElementById('withdrawTo').style.display!=='none'),8000);
  await E.page.evaluate(()=>document.getElementById('withdrawTo').click()); await E.page.fill('#wtoAddr',addr); await E.page.evaluate(()=>document.getElementById('wtoReview').click()); }
const view=async(E,sel)=>{ await E.page.evaluate(sel=>{ const e=document.querySelector(sel); if(e) e.scrollIntoView({block:'center'}); },sel); await sleep(500); return sel; };
const STATES={
  wto:{cfg:{wallets:[one('A')],ethereum:'A'},o:OWED,run:async E=>{ await box(E,'0x0000000000000000000000000000000000000000'); await sleep(300); return view(E,'#wtoNote'); },sel:'#wtoBox'},
  wtosheet:{cfg:{wallets:[one('A')],ethereum:'A'},o:OWED,run:async E=>{ await box(E,'0x52908400098527886e0f7030069857d2e4169ee7'); await E.until(()=>T.sheetOpen(E.page),5000); await sleep(400); return '#wsheet .box'; }},
  wtofailed:{cfg:{wallets:[one('A')],ethereum:'A'},o:OWED,run:async E=>{ E.chain.rc=h=>E.chain.mkRc(h,{status:'0x0'}); await box(E,'0x52908400098527886e0f7030069857d2e4169ee7');
    await E.until(()=>T.sheetOpen(E.page),5000); await T.clickSheet(E.page,/SEND TO THIS ADDRESS/); await E.until(()=>E.page.evaluate(()=>/reverted/.test(document.getElementById('wtoNote').textContent)),15000); return view(E,'.nx-seatBtns'); },sel:'#wtoBox'},
  offer:{cfg:{wallets:[one('A','0x1',{announce:false,flags:{isMetaMask:true},reject:{eth_requestAccounts:{code:-32603,message:'Internal JSON-RPC error.'}}}),one('B','0x1',{authorized:true})],ethereum:'A'},app:true,
    run:async E=>{ await E.page.click('#wallet'); await E.until(async()=>(await T.sheetTitle(E.page))==='YOUR WALLET DID NOT CONNECT',6000); await sleep(400); return '#wsheet .box'; }},
};
(async()=>{
  const br=await chromium.launch({args:['--no-sandbox','--disable-background-networking','--disable-component-update','--no-first-run','--webrtc-ip-handling-policy=disable_non_proxied_udp'],executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'}); T.setBrowser(br);
  const rows=[]; let bad=0;
  for(const [name,S] of Object.entries(STATES)){ if(ONLY.length&&!ONLY.includes(name)) continue;
    for(const [w,h] of SIZES){ const o=Object.assign({viewport:{width:w,height:h}},S.o||{});
      if(S.app){ o.mobile=true; o.ua=w<=420?PHONE_APP:PAD_APP; } else if(w<=420){ o.mobile=true; o.ua=PHONE_APP; }
      let E=null, row={state:name,size:w+'x'+h};
      try{ E=await T.boot(S.cfg,o); const sel=await S.run(E); row.probe=await probe(E.page,S.sel||sel); row.pageErrors=E.errors.slice(0,3);
        await E.page.screenshot({path:path.join(OUT,name+'_'+w+'x'+h+'.png')}); }
      catch(e){ row.error=String(e&&e.message||e).slice(0,200); bad++; }
      finally{ if(E) await E.close().catch(()=>{}); }
      rows.push(row); console.log(name.padEnd(9)+' '+(w+'x'+h).padEnd(9)+' '+JSON.stringify(row.error?{error:row.error}:{inside:row.probe.inside,hscroll:row.probe.hscroll,box:row.probe.box,errors:row.pageErrors.length,text:row.probe.text.slice(0,120)})); } }
  fs.writeFileSync(path.join(OUT,'probe.json'),JSON.stringify(rows,null,1)); await br.close(); console.log('SHOTS '+(bad?'FAIL '+bad:'OK')+' '+rows.length+' shots -> '+OUT); process.exit(bad?1:0);
})().catch(e=>{ console.log('SHOTS FAIL',e&&e.stack||e); process.exit(1); });
