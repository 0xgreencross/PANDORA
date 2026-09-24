/* THE DEPLOY PAGE TEST: drives glass/deploy (local copy with ethers from node_modules) against a
   hardhat node on 8545 with the burner signer, runs the full deploy, verifies, walks the candle,
   reads a token and screenshots the plate in the frame. */
const {chromium}=require('playwright');
const rpc=async(m,p=[])=>{ const r=await fetch('http://127.0.0.1:8545',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:m,params:p})}); return (await r.json()).result; };
(async()=>{
  const br=await chromium.launch({args:['--no-sandbox']});
  const pg=await (await br.newContext({viewport:{width:1100,height:1400}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await pg.goto('http://127.0.0.1:8931/glass/deploy/local_test.html'); await pg.waitForTimeout(800);
  await pg.fill('#rpc','http://127.0.0.1:8545');
  await pg.click('#connect'); await pg.waitForTimeout(1500);
  const who=await pg.textContent('#who'); console.log(who);
  const addr=who.match(/0x[0-9a-fA-F]{40}/)[0];
  await rpc('hardhat_setBalance',[addr,'0x'+(10n**21n).toString(16)]);
  await pg.click('#connect'); await pg.waitForTimeout(1000); console.log(await pg.textContent('#who'));
  const step=async(id,waitFor)=>{ await pg.click(id); for(let i=0;i<200;i++){ await pg.waitForTimeout(500); const t=await pg.textContent('#log'); if(t.includes(waitFor)) return; if(/bad/.test(await pg.evaluate(()=>[...document.querySelectorAll('#log .bad')].map(x=>x.textContent).join('|')))) break; } throw new Error('step '+id+' did not reach: '+waitFor+'\n'+(await pg.textContent('#log')).slice(-600)); };
  await step('#s1','Coats at');
  await step('#s2','all 13 chunks laid');
  await step('#s3','GLASS at');
  await step('#s4','STORMGLASS at');
  await step('#s5','MATCHES the manifest');
  console.log((await pg.textContent('#log')).split('\n').filter(l=>/BOUND|MATCHES|gas/.test(l)).join('\n'));
  await step('#w1','bid 0.01 mined'); await step('#w2','bid 0.02 mined');
  await rpc('evm_increaseTime',[24*3600-7210]); await rpc('hardhat_mine',['0x1c2f','0x1']);
  await step('#w3','seal mined');
  const st=await pg.evaluate(()=>JSON.parse(document.getElementById('record').value));
  const close=Number(await (async()=>{ const r=await fetch('http://127.0.0.1:8545',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_call',params:[{to:st.storm,data:'0x'+'e3b9d4f4'},'latest']})}); return 0; })());
  await rpc('evm_increaseTime',[6*3600+10]); await rpc('evm_mine');
  await step('#w4','settleCandle mined');
  await step('#w5','pledge mined');
  await pg.click('#w9'); await pg.waitForTimeout(1500);
  await pg.fill('#tid','0'); await pg.click('#w10'); await pg.waitForTimeout(1500);
  console.log(await pg.textContent('#meta'));
  // wait for the plate in the frame to print
  await pg.waitForTimeout(25000);
  await pg.screenshot({path:'/home/claude/shots/deploy_page.png',fullPage:true});
  const frame=pg.frames().find(f=>f.url().startsWith('data:'));
  const status=frame?await frame.evaluate(()=>({gosd:document.getElementById('gosd')&&document.getElementById('gosd').textContent, off:document.getElementById('gosd')&&document.getElementById('gosd').classList.contains('off'), dna:document.getElementById('dna')&&document.getElementById('dna').value})).catch(e=>String(e)):'no frame';
  console.log('frame', JSON.stringify(status));
  console.log('record', JSON.stringify(st).slice(0,300));
  console.log('errors: '+(errs.length?errs.join(' | '):'none'));
  await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,1200));process.exit(1);});
