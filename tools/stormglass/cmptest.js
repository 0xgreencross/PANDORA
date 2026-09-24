const {chromium}=require('playwright');
(async()=>{ const br=await chromium.launch({args:['--no-sandbox']}); const pg=await (await br.newContext({viewport:{width:1200,height:900}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,120)));
  await pg.goto('http://127.0.0.1:8931/workbench/compare/?seeds=123456789,9001'); await pg.waitForTimeout(40000);
  const st=[]; for(const f of pg.frames()){ if(f===pg.mainFrame()) continue; try{ st.push({url:f.url().slice(0,60), gosd:await f.evaluate(()=>document.getElementById('gosd')&&document.getElementById('gosd').classList.contains('off')), title:await f.title()}); }catch(e){ st.push({url:f.url().slice(0,60), err:String(e).slice(0,60)}); } }
  console.log(JSON.stringify(st)); console.log('errors', errs.join('|')||'none');
  await pg.screenshot({path:'/home/claude/shots/compare.png'}); await br.close(); })();
