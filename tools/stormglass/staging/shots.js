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
  return {vw:innerWidth,vh:innerHeight,hscroll:document.documentElement.scrollWidth>innerWidth,banner:[Math.round(b.height),Math.round(b.width)],bannerText:document.getElementById('sg-banner').textContent,panel:r(m),panelInside:inside(m),panelScrolls:m?m.scrollHeight>m.clientHeight:null,drawer:r(d),drawerInside:inside(d)}; });
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
  fs.writeFileSync(path.join(OUT,'probe.json'),JSON.stringify({rows,refused:[...new Set(refused)]},null,1)); await br.close();
  console.log('refused outside:',JSON.stringify([...new Set(refused)])); console.log('SHOTS DONE '+rows.length);
})().catch(async e=>{ console.log('SHOTS FAIL',e&&e.stack||e); try{ await br.close(); }catch(x){} process.exit(1); });
