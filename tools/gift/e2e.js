/* E2E for /gift/deploy/ + /gift/ on a local chain. Needs: `npx hardhat node --config hardhat.osaka.config.js --port 8545` in smallweather/ (osaka = mainnet rules), a static server on 127.0.0.1:8765 at the repo root, and the rehearsal deploy page built (mkdeploy.py rehearsal). Run: PW=<path to playwright> OUT=<shots dir> node tools/gift/e2e.js */
const { chromium } = require(process.env.PW||'playwright');
const fs = require('fs');
const ETH = fs.readFileSync(require('path').join(__dirname,'..','..','smallweather','node_modules','ethers','dist','ethers.umd.min.js'),'utf8');
const RPC='http://127.0.0.1:8545', K0='0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const A0='0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', A1='0x70997970C51812dc3A010C7d01b50e0d17dc79C8', A2='0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const rpc=async(m,p=[])=>(await (await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:m,params:p})})).json()).result;
const out=process.env.OUT||require('os').tmpdir();
(async()=>{
  const b=await chromium.launch();
  // ---------------- the deploy page
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  await ctx.addInitScript(k=>{ try{localStorage.setItem('smallweather_burner',k);}catch(e){} }, K0);
  const p=await ctx.newPage(); p.on('dialog',d=>d.accept());
  const logs=()=>p.$eval('#log',e=>e.innerText);
  const waitLog=async(re,ms=120000)=>{ const t=Date.now(); while(Date.now()-t<ms){ const l=await logs(); if(re.test(l)) return l; if(/\n.*(Error|error|revert)/.test(l.split('\n').slice(-1)[0])) {} await p.waitForTimeout(300);} throw new Error('timeout waiting '+re+'\n'+await logs()); };
  await p.goto('http://127.0.0.1:8765/gift/deploy/'); await waitLog(/match their approved sha256/);
  await p.fill('#rpc',RPC); await p.click('#connect'); await waitLog(/connected: /);
  await p.fill('#h1',A0); await p.fill('#h2',A1); await p.fill('#h3',A2);
  await p.click('#s1'); await waitLog(/GIFT at 0x/);
  const gift=await p.inputValue('#aGift');
  await p.click('#s2'); await waitLog(/all 3 loops laid/);
  await p.click('#s3'); await waitLog(/seal mined/);
  await p.click('#s4'); await waitLog(/VERIFY: /);
  await p.click('#w1'); await waitLog(/owner of #1/);
  await p.fill('#tid','1'); await p.click('#w4'); await waitLog(/tokenURI image/);
  await p.screenshot({path:out+'/deploy_page.png',fullPage:true});
  // ---------------- the claim page, as account 1 through an injected EIP-1193 wallet
  const shots=[[1440,900],[1366,768],[1280,800],[1024,768],[768,1024],[390,844]];
  const shim=`window.ethereum={request:async({method,params})=>{ if(method==='eth_requestAccounts'||method==='eth_accounts') return ['${A1}']; if(method==='wallet_switchEthereumChain') return null;
    const r=await (await fetch('${RPC}',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:params||[]})})).json(); if(r.error) throw r.error; return r.result; }, on(){}, removeListener(){}};`;
  const c2=await b.newContext({viewport:{width:1440,height:900}});
  await c2.route(/cdnjs\.cloudflare\.com/, r=>r.fulfill({status:200,contentType:'application/javascript',body:ETH}));
  await c2.addInitScript(shim);
  const q=await c2.newPage();
  const url='http://127.0.0.1:8765/gift/?net=local&c='+gift;
  await q.goto(url); await q.waitForTimeout(800);
  for(const [w,h] of shots){ await q.setViewportSize({width:w,height:h}); await q.waitForTimeout(150); await q.screenshot({path:`${out}/idle_${w}x${h}.png`}); }
  await q.setViewportSize({width:1440,height:900});
  await q.click('#connect'); await q.waitForFunction(()=>/free, you pay/.test(document.getElementById('status').textContent),null,{timeout:30000});
  await q.screenshot({path:out+'/unclaimed_1440x900.png'});
  await q.click('#claim'); await q.waitForFunction(()=>/yours/.test(document.getElementById('status').textContent),null,{timeout:30000});
  const probe=[];
  for(const [w,h] of shots){ await q.setViewportSize({width:w,height:h}); await q.waitForTimeout(200); await q.screenshot({path:`${out}/claimed_${w}x${h}.png`});
    probe.push(await q.evaluate(([w,h])=>{ const a=document.getElementById('art').getBoundingClientRect(), z=document.getElementById('zero').getBoundingClientRect();
      return {vp:w+'x'+h, art:[Math.round(a.left),Math.round(a.top),Math.round(a.width),Math.round(a.height)], square:Math.abs(a.width-a.height)<1, centered:Math.abs((a.left+a.width/2)-w/2)<2, zeroBottom:Math.round(z.bottom), fits:z.bottom<=h&&a.top>=0, scroll:document.documentElement.scrollHeight>h||document.documentElement.scrollWidth>w}; },[w,h])); }
  console.log(JSON.stringify(probe));
  // ---------------- the airdrop after the deadline
  await rpc('evm_increaseTime',[8*86400]); await rpc('evm_mine');
  await p.click('#w2'); await waitLog(/airdropUnclaimed mined/);
  await p.click('#w3'); await p.waitForTimeout(2500);
  const L=await logs(); fs.writeFileSync(out+'/deploy_log.txt',L);
  console.log(L.split('\n').filter(l=>/VERIFY|loop \d|claim|airdrop|#\d holder|tokenURI|code on chain|ARTIST|sealed/.test(l)).join('\n'));
  await b.close();
})().catch(e=>{ console.error('FAIL',e.message.slice(0,3000)); process.exit(1); });
