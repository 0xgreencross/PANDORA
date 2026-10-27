/* Screenshots + geometry probes of an OPEN SALE with the WITNESS call-to-action, at the six law-8 sizes plus 320x640.
   Mock wallets and the fake chain only. env: PREFIX (file name start, default 'witness'), QUERY (e.g. ?practice=1), CLOSED=1 (fake chain with nothing on sale,
   for the practice page), SHOTS (dir, default /tmp/claude-0/witness), TARGET (the page, via wallet.test.js).
   usage: PORT=8932 TARGET=/path/index.html PREFIX=index SCRIPT=witness-shots.js bash run.sh */
const fs=require('fs'), path=require('path'); const {chromium}=require('playwright'); const {ethers}=require('ethers');
const T=require('./wallet.test.js'); const {sleep,one}=T;
const OUT=process.env.SHOTS||'/tmp/claude-0/witness'; fs.mkdirSync(OUT,{recursive:true});
const PREFIX=process.env.PREFIX||'witness', QUERY=process.env.QUERY||'';
const SIZES=[[1440,900],[1366,768],[1280,800],[1024,768],[768,1024],[390,844],[320,640]];
const closed=c=>{ const BUYER='0x19A84bF7b5DA2C290CB0Ca42bf691dd6C2308359', close=c.t0+8*3600, open=close-86400;
  c.values.onSale=[13n,0n,BigInt(close),false];
  c.plate=id=>[(396693683*(id+3))>>>0,open-86400*(13-id),close-86400*(13-id),ethers.parseEther('0.3'),0n,BUYER,id%32,true]; };
const probe=page=>page.evaluate(()=>{
  const R=e=>{ if(!e) return null; const b=e.getBoundingClientRect(); return {l:Math.round(b.left),t:Math.round(b.top),r:Math.round(b.right),b:Math.round(b.bottom),w:Math.round(b.width),h:Math.round(b.height)}; };
  const shown=e=>!!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';
  const inside=e=>{ if(!shown(e)) return false; const b=e.getBoundingClientRect(); return b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight; };
  const hit=e=>{ if(!shown(e)) return false; const b=e.getBoundingClientRect(); const x=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2); return !!x&&(x===e||e.contains(x)); };
  const phone=innerWidth<=699&&getComputedStyle(document.getElementById('nx-bar')).display!=='none';
  const prim=phone?document.getElementById('nx-barBtn'):document.getElementById('bPick');
  const wit=phone?document.getElementById('nx-barWit'):document.getElementById('bWitCta');
  const hero=document.querySelector('main.hero'), sky=document.getElementById('nx-skyRows'), bar=document.getElementById('nx-bar'), pb=document.getElementById('plateBox');
  const root=document.documentElement;
  return {vw:innerWidth,vh:innerHeight,phone,hscroll:root.scrollWidth>innerWidth,docH:root.scrollHeight,
    heroBottom:Math.round(hero.getBoundingClientRect().bottom),heroFits:phone?null:hero.getBoundingClientRect().bottom<=innerHeight+1,
    primary:{text:prim&&prim.textContent.trim().slice(0,40),rect:R(prim),inside:inside(prim),hit:hit(prim)},
    witness:{present:!!wit,text:wit&&wit.textContent.trim(),rect:R(wit),inside:inside(wit),hit:hit(wit),tapOK:!!wit&&wit.getBoundingClientRect().height>=44},
    line:(()=>{ const s=phone?document.querySelector('#nx-barWc span'):document.querySelector('#panel .nx-wc span'); return s?{text:s.textContent,clipped:s.scrollHeight>s.clientHeight+1,rect:R(s)}:null; })(),
    bar:phone?{rect:R(bar),barVar:getComputedStyle(document.body).getPropertyValue('--bar').trim(),bodyPad:getComputedStyle(document.body).paddingBottom}:null,
    plate:R(pb),skyRows:sky?{h:Math.round(sky.clientHeight),scrolls:sky.scrollHeight>sky.clientHeight+1}:null,
    panelBox:R(document.getElementById('panel'))}; });
(async()=>{
  const br=await chromium.launch({args:['--no-sandbox','--disable-background-networking','--disable-component-update','--no-first-run'],executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'}); T.setBrowser(br);
  const rows=[];
  for(const [w,h] of SIZES){
    const phone=w<=420; const o={viewport:{width:w,height:h},query:QUERY}; if(phone){ o.mobile=true; o.ua='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'; }
    if(process.env.CLOSED) o.chain=closed;
    const E=await T.boot({wallets:[one('A')],ethereum:'A'},o);
    await sleep(2500);
    const p=await probe(E.page); const name=PREFIX+'_'+w+'x'+h;
    await E.page.screenshot({path:path.join(OUT,name+'.png')});
    let sheet=null;
    const trig=await E.page.evaluate(()=>{ const b=innerWidth<=699&&getComputedStyle(document.getElementById('nx-bar')).display!=='none'?document.getElementById('nx-barWit'):document.getElementById('bWitCta'); if(!b||!b.getClientRects().length) return false; b.click(); return true; });
    if(trig){ await sleep(500); sheet=await E.page.evaluate(()=>{ const s=document.getElementById('nx-wit'), b=s.querySelector('.box').getBoundingClientRect(); return {on:s.classList.contains('on'),inside:b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight+1,title:document.getElementById('nx-witK').textContent,amtBox:!!document.getElementById('wAmt'),btn:!!document.getElementById('bWit')}; });
      await E.page.screenshot({path:path.join(OUT,name+'_sheet.png')}); }
    rows.push({size:w+'x'+h,probe:p,sheet,pageErrors:E.errors});
    console.log(w+'x'+h,JSON.stringify({prim:p.primary.inside&&p.primary.hit,wit:{present:p.witness.present,inside:p.witness.inside,hit:p.witness.hit,h:p.witness.rect&&p.witness.rect.h},hscroll:p.hscroll,heroFits:p.heroFits,bar:p.bar&&p.bar.rect&&p.bar.rect.h,plate:p.plate&&p.plate.w,sky:p.skyRows,sheet,errors:E.errors.length}));
    await E.close(); }
  fs.writeFileSync(path.join(OUT,PREFIX+'_probe.json'),JSON.stringify(rows,null,1)); await br.close();
})().catch(e=>{ console.log('SHOTS FAIL',e&&e.stack||e); process.exit(1); });
