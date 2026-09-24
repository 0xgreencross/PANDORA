/* THE LOOP DIFF: renders the guest loop (the screen's texture) for seeds on two pages and
   reports how much the frames differ. SEEDS env comma list. */
const {chromium}=require('playwright');
(async()=>{
  const br=await chromium.launch({args:['--no-sandbox']});
  const ctx=await br.newContext({viewport:{width:1000,height:800}});
  const get=async(file,seed)=>{ const pg=await ctx.newPage(); await pg.goto('http://127.0.0.1:8931/'+file+'?seed='+seed+'&frames=8'); await pg.waitForTimeout(400);
    await pg.evaluate(()=>{ document.getElementById('raster').value='135'; draw(true,true); });
    for(let i=0;i<300;i++){ await pg.waitForTimeout(200); if(await pg.evaluate(()=>!!(TEXC&&TEXC.tex&&TEXC.tex.frames&&TEXC.tex.frames.length===8&&LAST.bytes))) break; }
    const r=await pg.evaluate(()=>({frames:TEXC.tex.frames.map(f=>Array.from(f)), W:TEXC.tex.W, mode:(function(){ try{ return v3JobFor(resolve(),8,'').mode; }catch(e){ return '?'; } })(), ver:(function(){ try{ return v3JobFor(resolve(),8,'').ver; }catch(e){ return '?'; } })() }));
    await pg.close(); return r; };
  for(const seed of (process.env.SEEDS||'424242,9001,77,31337').split(',')){
    const a=await get('workbench/v5_2/index.html',seed), b=await get('workbench/v5_3/index.html',seed);
    let diff=0, n=0; for(let f=0;f<8;f++){ const x=a.frames[f], y=b.frames[f]; for(let i=0;i<x.length;i++){ if(x[i]!==y[i]) diff++; n++; } }
    console.log('seed',seed,'mode',a.mode,'ver',a.ver,'->',b.ver,'texels differing',(100*diff/n).toFixed(1)+'%');
  }
  await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,500));process.exit(1);});
