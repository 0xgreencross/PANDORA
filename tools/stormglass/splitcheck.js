/* SPLIT CHECK: the guest loop drawn by four workers (frames dealt round-robin) against the same loop drawn by one worker, frame by frame. Q env. */
const {chromium}=require('playwright');
(async()=>{
  const F=process.env.FILE||'workbench/v5_2/index.html';
  const br=await chromium.launch({args:['--no-sandbox']});
  const md5s=async(file)=>{
    const pg=await (await br.newContext({viewport:{width:1300,height:900}})).newPage();
    await pg.goto('http://127.0.0.1:8931/'+file+'?'+(process.env.Q||'seed=1'));
    for(let i=0;i<600;i++){ await pg.waitForTimeout(250); if(await pg.evaluate(()=>{ try{ return !!(LAST&&LAST.frames&&DONEKEY===stateKey()); }catch(e){ return false; } })) break; }
    const r=await pg.evaluate(()=>{ const fr=TEXC.tex.frames; const h=fr.map(f=>{ let a=2166136261; for(let i=0;i<f.length;i++){ a^=f[i]; a=Math.imul(a,16777619); } return (a>>>0).toString(16); }); return {h, fx:Object.keys((window.__J||{}).fx||{}), fail:window.__nwfail||null, nw:NW}; });
    await pg.close(); return r; };
  const a=await md5s('workbench/v5_2/index.html'), b=await md5s('workbench/sketch/nw1.html');
  let diff=0; for(let i=0;i<a.h.length;i++) if(a.h[i]!==b.h[i]) diff++;
  console.log(JSON.stringify({N:a.h.length, differing:diff, nwA:a.nw, nwB:b.nw, fail:a.fail||b.fail}));
  await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
