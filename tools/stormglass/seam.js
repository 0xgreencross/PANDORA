/* THE SEAM CHECK. The loop's last frame must step into its first the way any frame
   steps into the next: the seam difference is compared with the adjacent-frame
   differences. CASES env: JSON [[name, query], ...] (query = workbench URL params). */
const {chromium}=require('playwright');
(async()=>{
  const br=await chromium.launch({args:['--no-sandbox']});
  const pg=await (await br.newContext({viewport:{width:1300,height:900}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  let bad=0;
  for(const [name,q] of JSON.parse(process.env.CASES)){
    await pg.goto('http://127.0.0.1:8931/workbench/v5_2/index.html?'+q);
    await pg.waitForTimeout(500);
    await pg.evaluate(()=>{ document.getElementById('raster').value='135'; document.getElementById('frames').value='24'; document.getElementById('save').setAttribute('disabled',''); draw(true,true); });
    let ok=false; for(let i=0;i<400;i++){ await pg.waitForTimeout(250); if(await pg.evaluate(()=>!document.getElementById('save').hasAttribute('disabled'))) {ok=true;break;} }
    const r=await pg.evaluate(()=>{ const F=LAST.frames, N=LAST.N; const d=(a,b)=>{ let s=0; for(let i=0;i<a.length;i++) s+=Math.abs(a[i]-b[i]); return s/a.length; };
      const adj=[]; for(let k=0;k<N-1;k++) adj.push(d(F[k],F[k+1])); const seam=d(F[N-1],F[0]);
      return {seam:+seam.toFixed(3), adjMax:+Math.max(...adj).toFixed(3), adjMean:+(adj.reduce((a,b)=>a+b,0)/adj.length).toFixed(3), N, W:LAST.W}; });
    const verdict=r.seam<=r.adjMax*1.5+0.02?'ok':'SEAM?'; if(verdict!=='ok') bad++;
    console.log(name.padEnd(12), ok?'':'TIMEOUT', JSON.stringify(r), verdict);
  }
  console.log('errors: '+(errs.length?errs.join(' | '):'none'), 'bad', bad);
  await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
