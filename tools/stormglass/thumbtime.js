const {chromium}=require('playwright');
(async()=>{ const br=await chromium.launch({args:['--no-sandbox']}); const pg=await (await br.newContext({viewport:{width:1440,height:900}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await pg.goto('http://127.0.0.1:8931/stormglass/local_test.html?demo=day'); const t0=Date.now();
  for(let i=0;i<120;i++){ await pg.waitForTimeout(1000); const n=await pg.evaluate(()=>document.querySelectorAll('#candGrid img').length); if(n>=32) break; }
  console.log('32 candidates in', ((Date.now()-t0)/1000)|0, 's; imgs', await pg.evaluate(()=>document.querySelectorAll('#candGrid img').length), 'errors', errs.join('|')||'none');
  await pg.screenshot({path:'/home/claude/shots/site_cands.png',fullPage:true}); await br.close(); })();
