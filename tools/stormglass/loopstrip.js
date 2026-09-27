/* LOOP STRIP: draws guest-loop frames FR (comma list) side by side into a canvas and screenshots it. DNA/Q/OUT env. */
const {chromium}=require('playwright');
(async()=>{
  const F=process.env.FILE||'workbench/v5_2/index.html', OUT=process.env.OUT||'/home/claude/shots/strip.png';
  const br=await chromium.launch({args:['--no-sandbox']});
  const pg=await (await br.newContext({viewport:{width:1300,height:900}})).newPage();
  await pg.goto('http://127.0.0.1:8931/'+F+'?'+(process.env.Q||'seed=1')); await pg.waitForTimeout(800);
  if(process.env.DNA){ await pg.evaluate(d=>{ document.getElementById('dna').value=d; recall(); }, process.env.DNA); }
  for(let i=0;i<600;i++){ await pg.waitForTimeout(250); if(await pg.evaluate(()=>{ try{ return !!(LAST&&LAST.frames&&DONEKEY===stateKey()); }catch(e){ return false; } })) break; }
  await pg.evaluate(s=>{window.__SRC=s;},process.env.SRC||'tex');
  const info=await pg.evaluate((FR)=>{
    const src=(window.__SRC==='plate'); const tex=src?{frames:LAST.frames,W:LAST.W,pal:LAST.pal.map(c=>Array.isArray(c)?c:[(c>>16)&255,(c>>8)&255,c&255])}:TEXC.tex; const W=tex.W, H=tex.frames[0].length/W, pal=tex.pal;
    const c=document.createElement('canvas'); c.id='strip'; const SC=src?1:2; c.width=W*FR.length*SC; c.height=H*SC+20; c.style.cssText='position:fixed;left:0;top:0;z-index:99999;background:#000';
    document.body.appendChild(c); const g=c.getContext('2d'); g.imageSmoothingEnabled=false;
    const tmp=document.createElement('canvas'); tmp.width=W; tmp.height=H; const tg=tmp.getContext('2d');
    FR.forEach((fi,k)=>{ const fr=tex.frames[fi]; const id=tg.createImageData(W,H);
      for(let i=0;i<fr.length;i++){ const p=pal[fr[i]]||[255,0,255]; id.data[i*4]=p[0]; id.data[i*4+1]=p[1]; id.data[i*4+2]=p[2]; id.data[i*4+3]=255; }
      tg.putImageData(id,0,0); g.drawImage(tmp,k*W*SC,20,W*SC,H*SC); g.fillStyle='#fff'; g.font='14px monospace'; g.fillText('f'+fi,k*W*SC+4,14); });
    return {W,H,palLen:pal.length,pal0:pal[0]};
  }, process.env.FR.split(',').map(Number));
  await pg.locator('#strip').screenshot({path:OUT});
  console.log(JSON.stringify(info)); await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
