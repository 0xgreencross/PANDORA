/* SHOT: renders plates from the workbench URL params and saves the canvas as PNG.
   JOBS env: JSON [[name, query], ...]; OUT dir. */
const {chromium}=require('playwright'); const fs=require('fs');
(async()=>{
  const OUT=process.env.OUT||'/home/claude/shots'; const F=process.env.FILE||'workbench/v5_2/index.html';
  const br=await chromium.launch({args:['--no-sandbox']});
  const pg=await (await br.newContext({viewport:{width:1300,height:900}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  for(const [name,q] of JSON.parse(process.env.JOBS)){
    await pg.goto('http://127.0.0.1:8931/'+F+'?'+q+'&frames=24');
    let ok=false; for(let i=0;i<400;i++){ await pg.waitForTimeout(250); if(await pg.evaluate(()=>!document.getElementById('save').hasAttribute('disabled'))) {ok=true;break;} }
    await pg.locator('#stage').screenshot({path:OUT+'/'+name+'.png'});
    const info=await pg.evaluate(()=>({sub:SUBJECTS[LAST.P.subject], dna:document.getElementById('dna').value, W:LAST.W, H:LAST.H, ext:LAST.P.ext, camDist:LAST.P.camDist}));
    console.log(name, ok?'ok':'TIMEOUT', JSON.stringify(info));
  }
  console.log('errors: '+(errs.length?errs.join(' | '):'none'));
  await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
