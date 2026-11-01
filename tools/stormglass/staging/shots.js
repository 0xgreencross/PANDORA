/* Screenshots of the staging page (test-wallet.html) with the REAL glass and plate files of this repo (the wallet tests stub the glass).
   Nothing outside 127.0.0.1 is reachable (ethers from the local copy; every other host 404; every WebSocket refused).
   REAL-WALLET states use the harness mock wallet (mockwallet.js) as the visitor's wallet.
   Run: PORT=8955 SCRIPT=../staging/shots.js SHOTS=/home/claude/audit3/ev/staging/shots bash tools/stormglass/wallet-tests/run.sh */
const fs=require('fs'), path=require('path'); const {chromium}=require('playwright');
const {installMock}=require('../wallet-tests/mockwallet.js');
const OUT=process.env.SHOTS||'/tmp/claude-0/pr1test/staging-shots'; fs.mkdirSync(OUT,{recursive:true});
const BASE='http://127.0.0.1:'+(+process.env.PORT||8955)+'/';
const UMD=['/home/claude/node_modules'].concat((process.env.NODE_PATH||'').split(path.delimiter)).filter(Boolean).map(p=>path.join(p,'ethers/dist/ethers.umd.min.js')).find(f=>fs.existsSync(f));
const ETHERS=fs.readFileSync(UMD,'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const LAW8=[[1440,900],[1366,768],[1280,800],[1024,768],[768,1024],[390,844]];
/* flags.isMetaMask: on the phone size this is MetaMask's in-app browser (the page then uses window.ethereum, not WalletConnect) */
const REALW={wallets:[{id:'A',name:'MetaMask',rdns:'io.metamask',chainId:'0x1',accounts:['0x0dd399a7ed92283e4983c2974fe377070d67f4eb'],flags:{isMetaMask:true}}],ethereum:'A'};
let br; const rows=[], refused=[];
async function open(w,h,mode,o={}){ const phone=w<700;
  const ctx=await br.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,isMobile:phone&&!!o.ua,hasTouch:phone,userAgent:o.ua,serviceWorkers:'block'});
  await ctx.routeWebSocket(/.*/,ws=>{ refused.push(ws.url()); ws.close(); });
  await ctx.route('**/*',r=>{ const u=new URL(r.request().url()); if(u.hostname==='127.0.0.1') return r.continue();
    if(u.hostname==='cdnjs.cloudflare.com'&&/ethers\/6\.13\.2\/ethers\.umd\.min\.js$/.test(u.pathname)) return r.fulfill({status:200,contentType:'application/javascript',body:ETHERS});
    refused.push(u.hostname+u.pathname.slice(0,40)); return r.fulfill({status:404,body:''}); });
  if(o.wallet) await ctx.addInitScript(installMock,o.wallet);
  const page=await ctx.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(String(e).slice(0,160)));
  await page.goto(BASE+'test-wallet.html?sgmode='+mode); await page.waitForFunction(()=>typeof ST!=='undefined'&&ST&&ST.now,null,{timeout:30000});
  await page.evaluate(()=>__SG.configure({mine:600,readerMs:30}));
  await sleep(4500);   /* the plate print / the glass draw settle */
  return {ctx,page,errors}; }
const probe=page=>page.evaluate(()=>{ const b=document.getElementById('sg-banner').getBoundingClientRect(), m=document.querySelector('#sg-modal .sg-box'), d=document.getElementById('sg-drawer'), r=x=>x?(z=>[Math.round(z.left),Math.round(z.top),Math.round(z.width),Math.round(z.height)])(x.getBoundingClientRect()):null;
  const inside=x=>{ if(!x) return null; const z=x.getBoundingClientRect(); return z.left>=0&&z.top>=0&&z.right<=innerWidth+0.5&&z.bottom<=innerHeight+0.5; };
  return {vw:innerWidth,vh:innerHeight,hscroll:document.documentElement.scrollWidth>innerWidth,banner:[Math.round(b.height),Math.round(b.width)],bannerText:document.getElementById('sg-banner').textContent,panel:r(m),panelInside:inside(m),panelScrolls:m?m.scrollHeight>m.clientHeight:null,drawer:r(d),drawerInside:inside(d),drawerHScroll:d?(x=>x.scrollWidth>x.clientWidth+1)(d.querySelector('.sg-db')):null,bannerClipped:(x=>x.scrollHeight>x.clientHeight+1||[...x.children].some(c=>{ const z=c.getBoundingClientRect(); return z.width>0&&(z.bottom>b.bottom+0.5||z.right>b.right+0.5); }))(document.getElementById('sg-banner'))}; });
async function snap(S,name){ const p=await probe(S.page); await S.page.screenshot({path:path.join(OUT,name+'.png')}); rows.push({name,...p,errors:S.errors.slice()}); console.log(name,JSON.stringify({banner:p.banner,hscroll:p.hscroll,panel:p.panel,inside:p.panelInside,scrolls:p.panelScrolls,drawer:p.drawer,errors:S.errors.length})); }
const buy=async page=>{ await page.evaluate(()=>{ const w=document.getElementById('nx-wit'); if(w&&w.classList.contains('on')) document.getElementById('nx-witX').click(); document.getElementById('bPick').click(); }); await page.waitForSelector('#ccard.on');
  await page.evaluate(()=>document.querySelectorAll('#candGrid .card')[3].click()); await page.waitForSelector('#ccBuy'); await sleep(1500); await page.evaluate(()=>document.getElementById('ccBuy').click()); };
const until=async(page,fn,ms=15000)=>{ const t=Date.now(); while(Date.now()-t<ms){ if(await page.evaluate(fn)) return true; await sleep(150); } return false; };
const pop=page=>page.evaluate(()=>(document.getElementById('ccActs')||{}).textContent||'');
async function simConnect(page){ await page.click('#wallet'); await sleep(1800); await page.evaluate(()=>{ const b=[...document.querySelectorAll('#wsBtns button')].find(b=>/SIM ALPHA · 1|SIM ALPHA/.test(b.textContent)); if(b) b.click(); }); await until(page,()=>/0x/.test(document.getElementById('wallet').textContent),8000); await sleep(400); }
(async()=>{
  br=await chromium.launch({args:['--no-sandbox','--disable-background-networking','--disable-component-update','--no-first-run'],executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'});
  for(const [w,h] of LAW8){ const S=await open(w,h,'sim'); await snap(S,'banner_sim_'+w+'x'+h); await S.ctx.close(); }
  for(const [w,h] of [[1440,900],[390,844]]){ const sz=w+'x'+h, ua=w<700?IPHONE:undefined;
    /* SIMULATION */
    let S=await open(w,h,'sim',{ua:w<700?undefined:undefined}); await S.page.click('#sg-modebtn'); await sleep(300); await snap(S,'mode_chooser_sim_'+sz); await S.page.click('#sg-modal [data-mode=sim]'); await sleep(200);
    await S.page.click('#sg-ctl'); await sleep(300); await snap(S,'controls_sim_'+sz); await S.page.click('#sg-ctl');
    await simConnect(S.page); await buy(S.page); await until(S.page,()=>__SG.modalOpen(),8000); await sleep(400); await snap(S,'sim_wallet_screen_collect_'+sz);
    await S.page.click('#sg-modal [data-out=pending]'); await until(S.page,()=>/PENDING/.test((document.getElementById('ccActs')||{}).textContent||''),10000); await sleep(600); await snap(S,'collect_pending_'+sz);
    const hsh=(await S.page.evaluate(()=>__SG.txs().find(x=>x.state==='pending'))).hash; await S.page.evaluate(h=>__SG.txResolve(h,'reverted'),hsh);
    await until(S.page,()=>/NOT COLLECTED/.test((document.getElementById('ccActs')||{}).textContent||''),15000); await sleep(400); await snap(S,'collect_failed_'+sz);
    await S.page.evaluate(()=>{ const x=document.getElementById('ccX'); if(x) x.click(); }); await sleep(500); await buy(S.page); await until(S.page,()=>__SG.modalOpen(),8000);
    await S.page.click('#sg-modal [data-out=unknown]'); await until(S.page,()=>/UNKNOWN/.test((document.getElementById('ccActs')||{}).textContent||''),20000); await sleep(600); await snap(S,'collect_unknown_'+sz);
    await S.page.click('#sg-ctl'); await sleep(300); await snap(S,'controls_sim_with_txs_'+sz); await S.ctx.close();
    /* REAL WALLET (the mock plays the visitor's wallet) */
    S=await open(w,h,'real',{wallet:REALW,ua}); await snap(S,'banner_real_'+sz);
    await S.page.click('#wallet'); await until(S.page,()=>__SG.modalOpen(),8000); await sleep(300); await snap(S,'real_gate_connect_'+sz); await S.page.click('#sg-modal [data-gate=go]');
    await until(S.page,()=>/0x/.test(document.getElementById('wallet').textContent),8000); await sleep(800);
    await buy(S.page); await until(S.page,()=>__SG.modalOpen(),8000); await sleep(500); await snap(S,'real_intercept_collect_'+sz);
    await S.page.click('#sg-modal [data-out=confirmed]'); await until(S.page,()=>/IS YOURS/.test((document.getElementById('ccActs')||{}).textContent||''),15000); await sleep(800); await snap(S,'real_collect_confirmed_'+sz);
    await S.page.evaluate(()=>{ const x=document.getElementById('ccX'); if(x) x.click(); }); await sleep(400);
    await S.page.click('#sg-ctl'); await sleep(300); await snap(S,'controls_real_'+sz); await S.ctx.close();
    if(w<700){ S=await open(w,h,'sim',{ua:IPHONE}); await S.page.click('#wallet'); await until(S.page,()=>__SG.modalOpen(),8000); await sleep(400); await snap(S,'sim_phone_walletconnect_pair_'+sz); await S.ctx.close(); } }
  /* ═══ AUDIT 4: the scenario controls and their outcomes, at 1440x900 and 390x844 (WalletConnect: an iPad UA at 1440, the CONFIRM sheet exists only on phones/tablets) */
  const IPAD='Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const dOpen=async(page,on)=>{ const is=await page.evaluate(()=>!!document.getElementById('sg-drawer')); if(is!==on){ await page.click('#sg-ctl'); await sleep(300); } };
  const dClick=async(page,sel)=>{ await dOpen(page,true); await page.locator('#sg-drawer '+sel).scrollIntoViewIfNeeded(); await page.click('#sg-drawer '+sel); await sleep(250); };
  const dTo=async(page,sel)=>{ await dOpen(page,true); await page.evaluate(s=>{ const e=document.querySelector('#sg-drawer '+s), b=document.querySelector('#sg-drawer .sg-db'); if(e&&b) b.scrollTop=e.offsetTop-b.offsetTop-4; },sel); await sleep(250); };
  const witness=async page=>{ await page.evaluate(()=>{ const b=document.getElementById('nx-witBtn'); if(b) b.click(); }); await page.waitForSelector('#nx-wit.on'); await page.fill('#wAmt','0.01'); await page.click('#bWit'); };
  for(const [w,h] of [[1440,900],[390,844]]){ const sz=w+'x'+h, ua=w<700?IPHONE:undefined;
    /* the SCENARIOS section */
    let S=await open(w,h,'sim',{ua}); await dOpen(S.page,true); await dTo(S.page,'.sg-scn[data-scn="1"]'); await snap(S,'a4_controls_scenarios_'+sz);
    await dTo(S.page,'.sg-scn[data-scn="4"]'); await snap(S,'a4_controls_scenarios_receipts_'+sz); await dOpen(S.page,false); await S.ctx.close();
    /* 1. last-moment network change (to Base and back) */
    S=await open(w,h,'sim',{ua:undefined}); await dClick(S.page,'[data-lastchain=base-back]'); await dClick(S.page,'[data-setup=lastchain]'); await dOpen(S.page,false);
    await simConnect(S.page); await buy(S.page); await until(S.page,()=>/changed network/i.test((document.getElementById('ccActs')||{}).textContent||''),15000); await sleep(700); await snap(S,'a4_s1_collect_stopped_'+sz);
    await dTo(S.page,'#sg-log'); await snap(S,'a4_s1_log_no_send_'+sz); await S.ctx.close();
    /* 2. on Base, the intended switch, the purchase goes on */
    S=await open(w,h,'sim',{ua:undefined}); await dClick(S.page,'[data-setup=switch]'); await dOpen(S.page,false); await simConnect(S.page); await buy(S.page);
    await until(S.page,()=>/ANOTHER NETWORK/.test((document.getElementById('ccActs')||{}).textContent||''),10000); await sleep(500); await snap(S,'a4_s2_wrong_network_'+sz);
    await S.page.click('#nx-switch'); await until(S.page,()=>__SG.modalOpen(),10000); await sleep(400); await snap(S,'a4_s2_wallet_screen_after_switch_'+sz);
    await S.page.click('#sg-modal [data-out=confirmed]'); await until(S.page,()=>/IS YOURS/.test((document.getElementById('ccActs')||{}).textContent||''),15000); await sleep(700); await snap(S,'a4_s2_confirmed_'+sz); await S.ctx.close();
    /* 3. WalletConnect: an earlier request's event, then the old-topic event (phone / tablet) */
    S=await open(w,h,'sim',{ua:w<700?IPHONE:IPAD}); await dClick(S.page,'[data-wcevent=oldtopic]'); await dClick(S.page,'[data-setup=wc]'); await dOpen(S.page,false);
    await S.page.click('#wallet'); await until(S.page,()=>[...document.querySelectorAll('#wsheet button')].some(b=>/ZERION/.test(b.textContent)&&!b.disabled),8000);
    await S.page.evaluate(()=>[...document.querySelectorAll('#wsheet button')].find(b=>/ZERION/.test(b.textContent)).click()); await until(S.page,()=>__SG.modalOpen(),8000); await sleep(300); await snap(S,'a4_s3_pairing_'+sz);
    await S.page.click('#sg-modal [data-pair=yes]'); await until(S.page,()=>/0x/.test(document.getElementById('wallet').textContent),8000); await sleep(600);
    await witness(S.page); await until(S.page,()=>{ const s=document.getElementById('wsheet'); return s&&s.classList.contains('on')&&/CONFIRM IN/.test(s.textContent); },8000); await sleep(1200); await snap(S,'a4_s3_confirm_sheet_old_topic_event_'+sz);
    await until(S.page,()=>{ const b=[...document.querySelectorAll('#wsheet.on button')].find(b=>/^OPEN /.test(b.textContent)); return b&&!b.disabled; },12000); await sleep(300); await snap(S,'a4_s3_after_8s_generic_'+sz);
    await S.page.evaluate(()=>[...document.querySelectorAll('#wsheet.on button')].find(b=>/^OPEN /.test(b.textContent)).click()); await sleep(600); await dTo(S.page,'#sg-log'); await snap(S,'a4_s3_log_held_link_'+sz); await S.ctx.close();
    /* 4. receipts: first reader malformed then a valid fallback; all readers invalid with the fast clock */
    S=await open(w,h,'sim',{ua:undefined}); await dClick(S.page,'[data-receipts=first-hash]'); await dClick(S.page,'[data-setup=receipts]'); await dOpen(S.page,false);
    await simConnect(S.page); await buy(S.page); await until(S.page,()=>__SG.modalOpen(),8000); await S.page.click('#sg-modal [data-out=confirmed]');
    await until(S.page,()=>/IS YOURS/.test((document.getElementById('ccActs')||{}).textContent||''),15000); await sleep(500); await dTo(S.page,'#sg-log'); await snap(S,'a4_s4_first_malformed_then_valid_log_'+sz); await S.ctx.close();
    S=await open(w,h,'sim',{ua:undefined}); await dClick(S.page,'[data-receipts=all]'); await dClick(S.page,'[data-setup=receipts]'); await dOpen(S.page,false);
    await simConnect(S.page); await buy(S.page); await until(S.page,()=>__SG.modalOpen(),8000); await S.page.click('#sg-modal [data-out=confirmed]'); const t0=Date.now();
    await until(S.page,()=>/PENDING/.test((document.getElementById('ccActs')||{}).textContent||''),10000); await sleep(1500); await snap(S,'a4_s4_all_invalid_pending_'+sz);
    await until(S.page,()=>/UNKNOWN/.test((document.getElementById('ccActs')||{}).textContent||''),30000); await sleep(500); await snap(S,'a4_s4_all_invalid_cannot_confirm_'+sz); console.log('  unknown after',Date.now()-t0,'ms');
    while(Date.now()-t0<48000) await sleep(1000); await snap(S,'a4_s4_all_invalid_final_'+sz); await dTo(S.page,'#sg-log'); await snap(S,'a4_s4_all_invalid_log_'+sz); await S.ctx.close();
    /* REAL WALLET: the scenarios section there (receipts only) */
    S=await open(w,h,'real',{wallet:REALW,ua}); await dTo(S.page,'.sg-scn[data-scn="1"]'); await snap(S,'a4_controls_real_scenarios_'+sz); await S.ctx.close(); }
  fs.writeFileSync(path.join(OUT,'probe.json'),JSON.stringify({rows,refused:[...new Set(refused)]},null,1)); await br.close();
  console.log('refused outside:',JSON.stringify([...new Set(refused)])); console.log('SHOTS DONE '+rows.length);
})().catch(async e=>{ console.log('SHOTS FAIL',e&&e.stack||e); try{ await br.close(); }catch(x){} process.exit(1); });
