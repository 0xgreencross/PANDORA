/* THE GLASS PAGE TEST: boots black with no controls, OS opens on a tap, shapes switch,
   download fires, status fades once printed, window.GLASS drives it. FILE env. */
const {chromium}=require('playwright');
(async()=>{
  const F=process.env.FILE||'glass/index.html';
  const br=await chromium.launch({args:['--no-sandbox']});
  const nojs=await (await br.newContext({viewport:{width:800,height:600},javaScriptEnabled:false})).newPage();
  await nojs.goto('http://127.0.0.1:8931/'+F+'?seed=1'); await nojs.waitForTimeout(300);
  console.log('before scripts', JSON.stringify(await nojs.evaluate(()=>({text:document.body.innerText.trim(), controls:[...document.querySelectorAll('button,input,select')].filter(e=>e.getBoundingClientRect().width>0).length}))));
  const pg=await (await br.newContext({viewport:{width:1000,height:800}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await pg.goto('http://127.0.0.1:8931/'+F+'?seed=424242&frames=24');
  let seen=[];
  for(let i=0;i<200;i++){ await pg.waitForTimeout(150); const st=await pg.evaluate(()=>({t:document.getElementById('gosd').textContent, off:document.getElementById('gosd').classList.contains('off')})); if(!seen.length||seen[seen.length-1].t!==st.t) seen.push(st); if(st.off) break; }
  console.log('status trail', seen.map(x=>x.t).filter((_,i)=>i%6===0).join(' | '), '-> off', seen[seen.length-1].off);
  await pg.click('#stage'); await pg.waitForTimeout(300);
  console.log('after tap', JSON.stringify(await pg.evaluate(()=>({open:document.getElementById('os').classList.contains('open'), gif:document.getElementById('os-gif').querySelector('b').textContent, foot:document.getElementById('os-foot').textContent.slice(0,40)}))));
  const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:5000}).catch(()=>null), pg.click('#os-gif')]);
  console.log('download', dl?dl.suggestedFilename():'none');
  await pg.click('#os-shape i[data-ar="9:16"]'); await pg.waitForTimeout(300);
  console.log('after 9:16', JSON.stringify(await pg.evaluate(()=>{const e=document.getElementById('stage').getBoundingClientRect(); return {ar:S.ar, w:e.width|0, h:e.height|0, off:document.getElementById('gosd').classList.contains('off')};})));
  for(let i=0;i<200;i++){ await pg.waitForTimeout(150); if(await pg.evaluate(()=>document.getElementById('gosd').classList.contains('off'))) break; }
  console.log('printed again', await pg.evaluate(()=>!!LAST.bytes&&document.getElementById('gosd').classList.contains('off')));
  await pg.goto('about:blank'); await pg.addInitScript(()=>{ window.GLASS={seed:777,ar:'16:9',frames:24,live:{hour:3}}; });
  await pg.goto('http://127.0.0.1:8931/'+F); await pg.waitForTimeout(1200);
  console.log('GLASS obj', JSON.stringify(await pg.evaluate(()=>({seed:S.seed, ar:S.ar, hour:LIVE.hour}))));
  console.log('errors: '+(errs.length?errs.join(' | '):'none'));
  await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
