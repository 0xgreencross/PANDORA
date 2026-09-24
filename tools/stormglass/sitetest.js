/* THE SITE TEST: the four demo states at desktop and phone widths, screenshots, no page errors,
   thumbnails rendered through the side door. */
const {chromium}=require('playwright');
(async()=>{
  const br=await chromium.launch({args:['--no-sandbox']});
  for(const [name,vw,vh] of [['desk',1440,900],['phone',390,844]]){
    const ctx=await br.newContext({viewport:{width:vw,height:vh},deviceScaleFactor:1}); const pg=await ctx.newPage();
    const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,160)));
    for(const phase of ['candle','founders','day','dead']){
      await pg.goto('http://127.0.0.1:8931/stormglass/local_test.html?demo='+phase); await pg.waitForTimeout(phase==='day'?45000:20000);
      const info=await pg.evaluate(()=>({state:document.getElementById('state').textContent, panel:document.getElementById('panel').innerText.replace(/\s+/g,' ').slice(0,140), cands:document.querySelectorAll('#candGrid img').length, ledger:document.querySelectorAll('#ledgerGrid img').length, scrollW:document.documentElement.scrollWidth}));
      console.log(name,phase,JSON.stringify(info));
      await pg.screenshot({path:'/home/claude/shots/site_'+name+'_'+phase+'.png',fullPage:phase==='day'});
    }
    console.log(name,'errors:',errs.length?errs.join(' | '):'none'); await ctx.close();
  }
  await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
