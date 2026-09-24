/* THE PRINT GATE. The same seeds must print the same bytes from any page that
   carries the engine. FILE (default workbench/v5_2/index.html), CASES JSON
   [[seed, raster, ar, weather, live], ...]. Prints one line per case. */
const {chromium}=require('playwright'); const crypto=require('crypto');
(async()=>{
  const br=await chromium.launch({args:['--no-sandbox']});
  const pg=await (await br.newContext({viewport:{width:1400,height:1000}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,180)));
  if(process.env.DATAURL){ const fs=require('fs'); const html=fs.readFileSync(process.env.DATAURL); await pg.goto('data:text/html;base64,'+html.toString('base64')); }
  else await pg.goto('http://127.0.0.1:8931/'+(process.env.FILE||'workbench/v5_2/index.html'));
  await pg.waitForTimeout(2000);
  const wait=async()=>{ for(let i=0;i<600;i++){ await pg.waitForTimeout(250);
    if(await pg.evaluate(()=>!document.getElementById('save').hasAttribute('disabled'))) return true; } return false; };
  const CASES=JSON.parse(process.env.CASES||'[["696969","270","1:1",-1,{}],["23757","270","9:16",-1,{}],["4242","135","1:1",-1,{}],["31337","135","1:1",2,{}]]');
  for(const [seed,raster,ar,weather,live] of CASES){
    const t0=Date.now();
    await pg.evaluate(([s,r,a,w,lv])=>{
      document.getElementById('seed').value=s;
      document.getElementById('raster').value=r;
      document.getElementById('frames').value='24';
      document.getElementById('weather').value=String(w);
      if(window.setAspect) window.setAspect(a);
      LIVEK.forEach(k=>LIVE[k]=null); for(const k in lv) LIVE[k]=lv[k]; livePaint();
      document.getElementById('save').setAttribute('disabled','');
      window.draw(true,true);
    },[seed,raster,ar,weather,live]);
    if(!(await wait())){ console.log('TIMEOUT '+seed); continue; }
    const ms=Date.now()-t0;
    const b64=await pg.evaluate(()=>{const b=LAST.bytes;let s='';
      for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s);});
    const buf=Buffer.from(b64,'base64');
    const md5=crypto.createHash('md5').update(buf).digest('hex');
    const dims=await pg.evaluate(()=>LAST.outW+'x'+LAST.outH+' '+WEATHERS[LAST.P.weather]);
    console.log('seed '+String(seed).padStart(10)+' raster '+String(raster).padStart(3)+' '+ar.padEnd(5)+' w'+String(weather).padStart(2)+' '+dims.padStart(18)+' '+(buf.length/1024|0)+'KB md5 '+md5+' '+ms+'ms');
  }
  console.log('errors: '+(errs.length?errs.slice(0,4).join(' | '):'none'));
  await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
