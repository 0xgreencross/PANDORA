/* Audit-4 review screenshots + geometry probes at the six law-8 sizes. Mock wallets and the fake chain only (wallet.test.js boot()).
   States: picker, connected (the connected sheet), seats (the seats view reading a new account, S1), wrong (COLLECT's wrong-network
   recovery view), wc (the WalletConnect hand-off sheet, phone UA: CONFIRM IN ZERION with OPEN awake), pending, failed (DISCONNECT
   before the hand-off, S6), reverted, unknown (COLLECT dialog), amount (witness box, typed "0,05", after a redraw) and pledge (founders'
   day box, typed, after its 1 s redraw).
   usage: PORT=8945 SHOTS=/dir [ONLY=wc,pending] SCRIPT=audit4-shots.js bash tools/stormglass/wallet-tests/run.sh */
const fs=require('fs'), path=require('path'); const {chromium}=require('playwright');
const T=require('./wallet.test.js'); const {sleep,one,A1,A2}=T;
const OUT=process.env.SHOTS||'/tmp/claude-0/audit4-shots'; fs.mkdirSync(OUT,{recursive:true});
const ONLY=(process.env.ONLY||'').split(',').filter(Boolean);
const SIZES=[[1440,900],[1366,768],[1280,800],[1024,768],[768,1024],[390,844]];
const PHONE_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const PAD_UA='Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
/* geometry: the element of interest inside the viewport, page horizontal scroll, its text */
const probe=(page,sel)=>page.evaluate(sel=>{ const e=document.querySelector(sel); const r=e&&e.getBoundingClientRect(); const root=document.documentElement;
  return {sel,shown:!!e&&e.getClientRects().length>0,box:r?[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]:null,
    inside:!!r&&r.left>=0&&r.top>=0&&r.right<=innerWidth+0.5&&r.bottom<=innerHeight+0.5,hscroll:root.scrollWidth>innerWidth,scrolls:!!e&&e.scrollHeight>e.clientHeight+1,
    text:e?e.textContent.replace(/\s+/g,' ').trim().slice(0,160):null}; },sel);
const openOpt=async(E,k)=>{ await T.closeWit(E.page); await E.page.evaluate(k=>{ if(!NX.pop) document.getElementById('bPick').click(); document.querySelectorAll('#candGrid .card')[k].click(); },k); await E.page.waitForSelector('#ccBuy'); };
const collect=E=>E.page.evaluate(()=>document.getElementById('ccBuy').click());
const dlg='#ccard .box, #ccard';
const STATES={
  picker:{cfg:{wallets:[{id:'A',name:'MetaMask',rdns:'io.metamask',chainId:'0x1',accounts:[A1]},{id:'B',name:'Rabby Wallet',rdns:'io.rabby',chainId:'0x1',accounts:[A2]}]},
    run:async E=>{ await E.page.click('#wallet'); await E.until(()=>T.sheetOpen(E.page),4000); await sleep(400); return '#wsheet .box'; }},
  connected:{cfg:{wallets:[one('A')],ethereum:'A'},
    run:async E=>{ await T.connect(E); await E.page.click('#wallet'); await E.until(()=>T.sheetOpen(E.page),4000); await sleep(400); return '#wsheet .box'; }},
  seats:{cfg:{wallets:[one('A')],ethereum:'A'},
    run:async E=>{ await T.connect(E); await E.until(()=>E.page.evaluate(()=>document.getElementById('nx-mySeats').textContent==='2.0000'),6000);
      await E.page.evaluate(A2=>{ const real=storm; storm=new Proxy(real,{get(t,p){ const v=Reflect.get(t,p); if(typeof v!=='function'||!['seats','pending','owed'].includes(p)) return v; return (...a)=>String(a[0]).toLowerCase()===A2?new Promise(()=>{}):t[p](...a); }}); },A2);
      await E.P('A').set({accounts:[A2,A1]}); await E.P('A').emit('accountsChanged',[A2]); await sleep(500);
      await E.page.evaluate(()=>document.getElementById('seatsNote').scrollIntoView({block:'center'})); await sleep(300); return '#seatsNote'; }},
  wrong:{cfg:{wallets:[one('A','0x2105',{switchReject:{code:4001}})],ethereum:'A'},
    run:async E=>{ await T.connect(E); await openOpt(E,3); await collect(E); await E.until(()=>E.page.evaluate(()=>NX.tx==='wrong'),8000); await sleep(400); return '#ccActs'; }},
  wc:{cfg:{wallets:[],wc:{accounts:[A1,A2],chainId:'0x1'}},phone:true,
    run:async E=>{ const page=E.page; await page.route('https://link.zerion.io/**',r=>r.fulfill({status:204,body:''}));
      await page.evaluate(()=>document.getElementById('wallet').click()); await E.until(()=>page.evaluate(()=>!!__MW.wc.approve),6000);
      await page.evaluate(()=>[...document.querySelectorAll('#wsBtns button')].find(b=>b.textContent==='ZERION').click()); await sleep(300);
      await page.evaluate(()=>__MW.wc.approve()); await E.until(async()=>/0x/.test(await E.label()),6000);
          await page.evaluate(()=>__MW.P.WC.set({gate:{eth_sendTransaction:true}}));
      await page.evaluate(async()=>{ const w=document.getElementById('nx-wit'); if(!w.classList.contains('on')) (document.getElementById('nx-barWit')&&document.getElementById('nx-barWit').getClientRects().length?document.getElementById('nx-barWit'):document.getElementById('nx-witBtn')).click();
        for(let i=0;i<50&&!document.getElementById('wAmt');i++) await new Promise(r=>setTimeout(r,50)); const b=document.getElementById('wAmt'); b.value='0.01'; b.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('bWit').click(); });
      await E.until(()=>page.evaluate(()=>__MW.P.WC.waiting('eth_sendTransaction')>0),8000);
      /* the relay reports the request out: the event the shipped wc.js emits, for this request (its params array, the session topic) */
      await page.evaluate(()=>{ const n=NUDGE; const c=_WC; const ev={id:1730000000123456,topic:n.topic,request:{method:n.method,params:n.params},chainId:'eip155:1'};
        if(c&&c.signer&&c.signer.client) c.signer.client.emit('session_request_sent',ev); else wcNudgeSent(n,ev); });
      await sleep(400); return '#wsheet .box'; }},
  pending:{cfg:{wallets:[one('A')],ethereum:'A'},
    run:async E=>{ await T.connect(E); E.chain.holdReceipts=true; await openOpt(E,3); await collect(E); await E.until(()=>E.page.evaluate(()=>NX.tx==='pending'),10000); await sleep(400); return '#ccActs'; }},
  failed:{cfg:{wallets:[one('A',undefined,{gate:{}})],ethereum:'A'},
    run:async E=>{ await T.connect(E); await E.P('A').set({gate:{eth_estimateGas:true}}); await openOpt(E,3); await collect(E); await E.waitGate('A','eth_estimateGas',6000);
      await E.page.evaluate(()=>disconnect(true)); await sleep(600); return '#ccActs'; }},
  reverted:{cfg:{wallets:[one('A')],ethereum:'A'},
    run:async E=>{ await T.connect(E); E.chain.rc=h=>E.chain.mkRc(h,{status:'0x0'}); await openOpt(E,3); await collect(E); await E.until(async()=>/reverted/.test(await T.popText(E.page)),15000); await sleep(400); return '#ccActs'; }},
  unknown:{cfg:{wallets:[one('A',undefined,{reject:{eth_sendTransaction:{code:-32603,message:'Internal JSON-RPC error.'}}})],ethereum:'A'},
    run:async E=>{ await T.connect(E); await openOpt(E,3); await collect(E); await E.until(()=>E.page.evaluate(()=>NX.tx==='unknown'),10000); await sleep(400); return '#ccActs'; }},
  amount:{cfg:{wallets:[one('A')],ethereum:'A'},
    run:async E=>{ await T.openWit(E.page); await E.page.click('#wAmt'); await E.page.keyboard.type('0,05'); await E.page.evaluate(()=>{ const i=document.getElementById('wAmt'); i.setSelectionRange(2,4); REDRAW(); }); await sleep(400); return '#nx-wit .box'; }},
  pledge:{cfg:{wallets:[one('A')],ethereum:'A'},o:{chain:c=>{ c.values.today=0; c.values.lastId=0; c.values.foundersEnd=c.t0+5*3600; c.values.onSale=[0n,0n,0n,false]; }},
    run:async E=>{ await E.page.waitForSelector('#plAmt'); await E.page.click('#plAmt'); await E.page.keyboard.type('0,25'); await sleep(1300); return '#panel'; }},
};
(async()=>{
  const br=await chromium.launch({args:['--no-sandbox','--disable-background-networking','--disable-component-update','--no-first-run','--webrtc-ip-handling-policy=disable_non_proxied_udp'],executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'}); T.setBrowser(br);
  const rows=[]; let bad=0;
  for(const [name,S] of Object.entries(STATES)){ if(ONLY.length&&!ONLY.includes(name)) continue;
    for(const [w,h] of SIZES){ const o=Object.assign({viewport:{width:w,height:h}},S.o||{});
      /* phone size: the WalletConnect sheet on iPhone Safari; the picker as a narrow desktop window (phones never show it); every other
         state inside MetaMask's in-app browser (an injected wallet on a phone). Larger sizes: desktop, except the WalletConnect sheet (iPad) */
      if(S.phone){ o.mobile=true; o.ua=w<=420?PHONE_UA:PAD_UA; } else if(w<=420&&name!=='picker'){ o.mobile=true; o.ua=PHONE_UA+' MetaMaskMobile/7.40.0'; }
      let E=null, row={state:name,size:w+'x'+h};
      try{ E=await T.boot(S.cfg,o); const sel=await S.run(E); row.probe=await probe(E.page,sel); row.pageErrors=E.errors.slice(0,3);
        await E.page.screenshot({path:path.join(OUT,name+'_'+w+'x'+h+'.png')}); }
      catch(e){ row.error=String(e&&e.message||e).slice(0,200); bad++; }
      finally{ if(E) await E.close().catch(()=>{}); }
      rows.push(row); console.log(name.padEnd(9)+' '+(w+'x'+h).padEnd(9)+' '+JSON.stringify(row.error?{error:row.error}:{inside:row.probe.inside,hscroll:row.probe.hscroll,scrolls:row.probe.scrolls,box:row.probe.box,errors:row.pageErrors.length,text:row.probe.text.slice(0,90)})); } }
  fs.writeFileSync(path.join(OUT,'probe.json'),JSON.stringify(rows,null,1)); await br.close(); console.log('SHOTS '+(bad?'FAIL '+bad:'OK')+' '+rows.length+' shots -> '+OUT); process.exit(bad?1:0);
})().catch(e=>{ console.log('SHOTS FAIL',e&&e.stack||e); process.exit(1); });
