/* GIF GRAB: prints a plate (DNA or Q) at 540 and writes the GIF the page encodes. FILE, DNA/Q, OUT env. */
const {chromium}=require('playwright'); const fs=require('fs');
(async()=>{
  const F=process.env.FILE||'workbench/v5_2/index.html', OUT=process.env.OUT||'/home/claude/shots/plate.gif';
  const br=await chromium.launch({args:['--no-sandbox']});
  const pg=await (await br.newContext({viewport:{width:1300,height:900}})).newPage();
  await pg.goto('http://127.0.0.1:8931/'+F+'?'+(process.env.Q||'seed=1')); await pg.waitForTimeout(800);
  if(process.env.DNA){ await pg.evaluate(d=>{ document.getElementById('dna').value=d; recall(); }, process.env.DNA); }
  await pg.evaluate(()=>{ document.getElementById('raster').value='540'; draw(true,true); });
  let ok=false; for(let i=0;i<800;i++){ await pg.waitForTimeout(250); if(await pg.evaluate(()=>{ try{ return !!(LAST&&LAST.bytes&&DONEKEY===stateKey()); }catch(e){ return false; } })) {ok=true;break;} }
  const b64=await pg.evaluate(()=>{ const b=LAST.bytes; let s=''; for(let i=0;i<b.length;i+=8192) s+=String.fromCharCode.apply(null,b.subarray(i,i+8192)); return btoa(s); });
  fs.writeFileSync(OUT, Buffer.from(b64,'base64')); console.log('gif', OUT, fs.statSync(OUT).size, ok?'ok':'TIMEOUT', await pg.evaluate(()=>document.getElementById('dna').value));
  await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
