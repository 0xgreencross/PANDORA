/* Screenshots of the wallet picker and the connected dialog at the six law-8 sizes, with geometry probes.
   Mock wallets and the fake chain only. Writes PNGs and probe JSON to $SHOTS (default /tmp/claude-0/pr1test/shots). */
const fs=require('fs'), path=require('path'); const {chromium}=require('playwright');
const T=require('./wallet.test.js');
const OUT=process.env.SHOTS||'/tmp/claude-0/pr1test/shots'; fs.mkdirSync(OUT,{recursive:true});
const SIZES=[[1440,900],[1366,768],[1280,800],[1024,768],[768,1024],[390,844]];
const probe=page=>page.evaluate(()=>{ const s=document.getElementById('wsheet'); const b=s.querySelector('.box').getBoundingClientRect(); const box=s.querySelector('.box');
  return {vw:innerWidth,vh:innerHeight,pageScrollX:document.documentElement.scrollWidth>innerWidth,boxInside:b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight,boxScrolls:box.scrollHeight>box.clientHeight,box:[Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)],
    buttons:[...s.querySelectorAll('#wsBtns button')].map(x=>{ const r=x.getBoundingClientRect(); return {t:x.textContent,h:Math.round(r.height),icon:!!x.querySelector('img')}; }),title:document.getElementById('wsk').textContent}; });
(async()=>{
  const br=await chromium.launch({args:['--no-sandbox','--disable-background-networking','--disable-component-update','--no-first-run'],executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'}); T.setBrowser(br);
  const rows=[];
  for(const [w,h] of SIZES){
    const E=await T.boot({wallets:[{id:'A',name:'MetaMask',rdns:'io.metamask',chainId:'0x1',accounts:['0x19a84bf7b5da2c290cb0ca42bf691dd6c2308359']},{id:'B',name:'Rabby Wallet',rdns:'io.rabby',chainId:'0x1',accounts:['0x0dd399a7ed92283e4983c2974fe377070d67f4eb']}]},{viewport:{width:w,height:h}});
    await E.page.click('#wallet'); await E.until(()=>T.sheetOpen(E.page),4000); await T.sleep(400);
    const p1=await probe(E.page); await E.page.screenshot({path:path.join(OUT,'picker_'+w+'x'+h+'.png')});
    await E.page.evaluate(()=>[...document.querySelectorAll('#wsBtns button')].find(b=>/METAMASK/.test(b.textContent)).click());
    await E.until(async()=>/0x/.test(await E.label()),6000); await T.sleep(400);
    await E.page.click('#wallet'); await E.until(()=>T.sheetOpen(E.page),4000); await T.sleep(400);
    const p2=await probe(E.page); await E.page.screenshot({path:path.join(OUT,'connected_'+w+'x'+h+'.png')});
    rows.push({size:w+'x'+h,picker:p1,connected:p2,pageErrors:E.errors}); console.log(w+'x'+h,JSON.stringify({picker:{inside:p1.boxInside,scroll:p1.boxScrolls,hscroll:p1.pageScrollX,box:p1.box},connected:{inside:p2.boxInside,scroll:p2.boxScrolls,hscroll:p2.pageScrollX,box:p2.box},errors:E.errors.length}));
    await E.close(); }
  fs.writeFileSync(path.join(OUT,'probe.json'),JSON.stringify(rows,null,1)); await br.close();
})().catch(e=>{ console.log('SHOTS FAIL',e&&e.stack||e); process.exit(1); });
