/* THE WALLET TESTS: the STORMGLASS page in headless Chromium with mock EIP-1193 wallets and a fake chain (fakechain.js).
   No real wallet, no real RPC, no real transaction: every outside request is answered locally or refused.
   env: PORT (the server run.sh starts), TARGET (the index.html to test, default the repo's), LABEL (name in the results),
        CASES (comma list of case ids, default all), OUT (results dir, default /tmp/claude-0/pr1test). */
const fs=require('fs'), path=require('path');
const {chromium}=require('playwright');
const {installMock}=require('./mockwallet.js');
const {makeChain,HOST}=require('./fakechain.js');
const ROOT=path.join(__dirname,'../../..');
const PORT=+process.env.PORT||8932, BASE='http://127.0.0.1:'+PORT+'/';
const TARGET=process.env.TARGET||path.join(ROOT,'index.html'), LABEL=process.env.LABEL||'worktree';
const OUT=process.env.OUT||'/tmp/claude-0/pr1test';
const UMD=(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean).concat(['/home/claude/node_modules']).map(p=>path.join(p,'ethers/dist/ethers.umd.min.js')).find(f=>fs.existsSync(f));
const PAGE=fs.readFileSync(TARGET,'utf8'), ETHERS=fs.readFileSync(UMD,'utf8');
const A1='0x00000000000000000000000000000000000000aa', A2='0x00000000000000000000000000000000000000bb', B1='0x00000000000000000000000000000000000000cc';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser;

async function boot(cfg,o={}){
  const ctx=await browser.newContext({viewport:o.viewport||{width:1440,height:900},userAgent:o.ua,deviceScaleFactor:1,isMobile:!!o.mobile,hasTouch:!!o.mobile});
  const chain=makeChain(); if(o.chain) o.chain(chain);
  const outside=[];
  await ctx.route('**/*',async route=>{ const req=route.request(); const u=new URL(req.url());
    if(u.hostname==='127.0.0.1'){
      if(u.pathname==='/'||u.pathname==='/index.html') return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:PAGE});
      if(u.pathname==='/glass/index.html') return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body class="glass"></body></html>'});
      if(u.pathname==='/wc.js'&&cfg.wc) return route.fulfill({status:404,body:''});   /* the WalletConnect mock stands in; the real bundle never loads */
      return route.continue(); }
    if(u.hostname==='cdnjs.cloudflare.com'&&/ethers\/6\.13\.2\/ethers\.umd\.min\.js$/.test(u.pathname)) return route.fulfill({status:200,contentType:'application/javascript',body:ETHERS});
    if(HOST.test(u.hostname)){ const body=req.postData(); let m0='?'; try{ const q=JSON.parse(body||'{}'); m0=Array.isArray(q)?q.map(x=>x.method).join('+'):q.method; }catch(e){}
      const hk=u.hostname+' '+m0; chain.hits[hk]=(chain.hits[hk]||0)+1;
      const mode=chain.hostMode(u.hostname,body);
      if(mode==='500') return route.fulfill({status:500,contentType:'text/plain',body:'upstream error'});
      if(mode==='rpcerror') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:1,error:{code:-32000,message:'header not found'}})});
      if(mode==='hang') return new Promise(r=>setTimeout(()=>route.abort().catch(()=>{}).then(r),20000));
      return route.fulfill({status:200,contentType:'application/json',body:chain.handle(body)}); }
    outside.push(u.hostname); return route.fulfill({status:404,body:''}); });
  await ctx.addInitScript(installMock,cfg);
  if(o.store) await ctx.addInitScript(s=>{ try{ for(const k in s) localStorage.setItem(k,s[k]); }catch(e){} },o.store);
  const page=await ctx.newPage(); const errors=[], consoleErr=[];
  page.on('pageerror',e=>errors.push(String(e).slice(0,200))); page.on('crash',()=>errors.push('page crashed'));
  page.on('console',m=>{ if(m.type()==='error') consoleErr.push(m.text().slice(0,200)); });
  await page.goto(BASE+(o.query||''));
  await page.waitForFunction(()=>typeof ST!=='undefined'&&ST&&ST.now&&document.getElementById('panel')&&document.getElementById('panel').textContent.length>10,null,{timeout:30000});
  await page.evaluate(()=>{ window.__toasts=[]; const t=document.getElementById('toast'); new MutationObserver(()=>{ if(t.textContent) window.__toasts.push(t.textContent); }).observe(t,{childList:true,characterData:true,subtree:true}); });
  await sleep(300);
  const E={ctx,page,chain,errors,consoleErr,outside};
  E.P=id=>({ set:o=>page.evaluate(([i,o])=>__MW.P[i].set(o),[id,o]), emit:(ev,...a)=>page.evaluate(([i,ev,a])=>__MW.P[i].emit(ev,...a),[id,ev,a]),
    release:m=>page.evaluate(([i,m])=>__MW.P[i].release(m),[id,m]), waiting:m=>page.evaluate(([i,m])=>__MW.P[i].waiting(m),[id,m]),
    count:m=>page.evaluate(([i,m])=>__MW.P[i].count(m),[id,m]) });
  E.sends=()=>page.evaluate(()=>__MW.sends);
  E.log=()=>page.evaluate(()=>__MW.log);
  E.toasts=()=>page.evaluate(()=>window.__toasts.slice());
  E.label=()=>page.evaluate(()=>document.getElementById('wallet').textContent);
  E.state=()=>page.evaluate(()=>({me:typeof me==='undefined'?null:me,W:typeof W==='undefined'?null:!!W,EP:typeof EP==='undefined'?null:!!EP}));
  E.until=async(fn,ms=8000,arg)=>{ const t=Date.now(); while(Date.now()-t<ms){ if(await fn(arg)) return true; await sleep(100); } return false; };
  E.waitGate=(id,m,ms=8000)=>E.until(async()=>(await E.P(id).waiting(m))>0,ms);
  E.close=()=>ctx.close();
  return E;
}
/* the dialogs, on either page: the PR's #wpick or the redesign's #wsheet */
const sheetOpen=page=>page.evaluate(()=>{ const s=document.getElementById('wsheet'), p=document.getElementById('wpick'); return !!((s&&s.classList.contains('on'))||(p&&!p.hidden)); });
const sheetTitle=page=>page.evaluate(()=>{ const s=document.getElementById('wsheet'); if(s&&s.classList.contains('on')) return document.getElementById('wsk').textContent; const p=document.getElementById('wpick'); if(p&&!p.hidden) return document.getElementById('wtitle').textContent; return ''; });
const sheetButtons=page=>page.evaluate(()=>{ const s=document.getElementById('wsheet'); const box=s&&s.classList.contains('on')?document.getElementById('wsBtns'):(document.getElementById('wpick')&&!document.getElementById('wpick').hidden?document.getElementById('wlist'):null); return box?[...box.querySelectorAll('button')].map(b=>b.textContent.trim()):[]; });
async function clickSheet(page,re){ const ok=await page.evaluate(src=>{ const re=new RegExp(src,'i'); const s=document.getElementById('wsheet'); const box=s&&s.classList.contains('on')?s:document.getElementById('wpick'); if(!box) return false; const b=[...box.querySelectorAll('button')].find(b=>re.test(b.textContent)); if(!b) return false; b.click(); return true; },re.source); if(!ok) throw new Error('no sheet button '+re); }
async function cancelSheet(page,how){ if(how==='button'){ const id=await page.evaluate(()=>document.getElementById('wsX')?'#wsX':'#wclose'); await page.click(id); }
  else if(how==='esc') await page.keyboard.press('Escape');
  else { await page.mouse.click(5,5); } }
const closeWit=page=>page.evaluate(()=>{ const w=document.getElementById('nx-wit'); if(w&&w.classList.contains('on')) document.getElementById('nx-witX').click(); });
async function connect(E,pick){ await closeWit(E.page); await E.page.click('#wallet'); if(pick){ if(!(await E.until(()=>sheetOpen(E.page),4000))) throw new Error('no picker'); await clickSheet(E.page,pick); }
  if(!(await E.until(async()=>/0x/.test(await E.label()),8000))) throw new Error('did not connect: '+await E.label()); await sleep(300); }
async function disconnectUI(E){ await closeWit(E.page); await E.page.click('#wallet'); if(!(await E.until(()=>sheetOpen(E.page),3000))) throw new Error('no connected dialog'); await clickSheet(E.page,/DISCONNECT/); }
async function witness(E,amt){ const page=E.page; const hasBtn=await page.evaluate(()=>!!document.getElementById('nx-witBtn'));
  if(hasBtn){ await page.evaluate(()=>document.getElementById('nx-witBtn').click()); await page.waitForSelector('#nx-wit.on'); }
  await page.fill('#wAmt',amt); await page.click('#bWit'); }
async function buy(E){ const page=E.page; const redesign=await page.evaluate(()=>!!document.getElementById('bPick'));
  if(redesign){ await page.evaluate(()=>document.getElementById('bPick').click()); await page.waitForSelector('#ccard.on'); await page.evaluate(()=>document.querySelectorAll('#candGrid .card')[3].click()); await page.waitForSelector('#ccBuy'); await page.evaluate(()=>document.getElementById('ccBuy').click()); }
  else { await page.click('#candGrid .card >> nth=3'); await sleep(200); await page.click('#bBuy'); } }
const popText=page=>page.evaluate(()=>{ const a=document.getElementById('ccActs'); return a?a.textContent:''; });
const DONE=/confirmed|\bdone$/i;   /* the redesign says "confirmed", the PR's older page "done" */
const ETH=v=>'0x'+(BigInt(Math.round(v*1e6))*10n**12n).toString(16);

const CASES=[];
const T=(id,name,cfg,run,o)=>CASES.push({id,name,cfg,run,o});
const one=(id,ch='0x1',x={})=>Object.assign({id,name:'Wallet '+id,rdns:'test.'+id.toLowerCase(),chainId:ch,accounts:[id==='B'?B1:A1,A2]},x);

T('a1','wrong chain, switch refused: witness and claim send nothing',{wallets:[one('A','0x2105',{switchReject:{code:4001}})],ethereum:'A'},async E=>{
  await connect(E); await witness(E,'0.01'); await sleep(2500);
  await E.page.waitForSelector('#claim:not([disabled])',{timeout:8000}).catch(()=>{}); await E.page.click('#claim',{force:true}).catch(()=>{}); await sleep(2500);
  const s=await E.sends(), t=await E.toasts();
  return {pass:s.length===0&&t.some(x=>/another network|switch your wallet/i.test(x)), ev:{sends:s.map(x=>x.chain+' '+x.params[0].value),toasts:t.slice(-3)}}; });
T('a2','wrong chain, switch refused: COLLECT sends nothing',{wallets:[one('A','0x2105',{switchReject:{code:4001}})],ethereum:'A'},async E=>{
  await connect(E); await buy(E); await sleep(2500);
  const sw=await E.page.$('#nx-switch'); if(sw){ await sw.click(); await sleep(2000); }
  const s=await E.sends(), t=await E.toasts(), p=await popText(E.page);
  return {pass:s.length===0, ev:{sends:s.map(x=>x.chain),popup:p.slice(0,90),toasts:t.slice(-2)}}; });
T('b','wrong chain, switch accepted: one send, on chain 1, no "network changed"',{wallets:[one('A','0x2105')],ethereum:'A'},async E=>{
  await connect(E); await witness(E,'0.01'); await E.until(async()=>(await E.toasts()).some(x=>DONE.test(x)||/network changed/i.test(x)),12000);
  const s=await E.sends(), t=await E.toasts(); const nc=t.concat(E.consoleErr).some(x=>/network changed/i.test(x));
  return {pass:s.length===1&&s[0].chain==='0x1'&&!nc&&t.some(x=>DONE.test(x)), ev:{sends:s.map(x=>x.chain),txChainId:s[0]&&s[0].params[0].chainId,networkChanged:nc,toasts:t.slice(-2)}}; });
T('c','provider swap mid-operation: A checks mainnet, B on 8453 takes over: nothing sent on B',
  {wallets:[one('A'),one('B','0x2105')]},async E=>{
  await connect(E,/WALLET A/); await E.P('A').set({gate:{eth_chainId:true}}); await witness(E,'0.01');
  const g=await E.waitGate('A','eth_chainId',5000);
  await disconnectUI(E); await sleep(200); await E.page.click('#wallet');
  if(await E.until(()=>sheetOpen(E.page),2500)) await clickSheet(E.page,/WALLET B/).catch(()=>{});
  await E.until(async()=>/0x/.test(await E.label()),6000);
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_chainId'); await sleep(4000);
  const s=await E.sends(), t=await E.toasts();
  return {pass:g&&!s.some(x=>x.pid==='B'), ev:{gateHit:g,sends:s.map(x=>x.pid+'@'+x.chain),label:await E.label(),toasts:t.slice(-2)}}; });
T('d','disconnect while the wallet answers slowly: no send, W not restored',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await E.P('A').set({gate:{eth_accounts:true}}); await witness(E,'0.01');
  const g=await E.waitGate('A','eth_accounts',6000);
  await disconnectUI(E); await sleep(200); await E.P('A').set({gate:{}}); await E.P('A').release('eth_accounts'); await sleep(3500);
  const s=await E.sends(), st=await E.state(), lab=await E.label();
  return {pass:g&&s.length===0&&!st.W&&!st.me&&/CONNECT/.test(lab), ev:{gateHit:g,sends:s.length,state:st,label:lab}}; });
T('e','accountsChanged to another account mid-operation: no send from the old account',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); const rq0=await E.P('A').count('eth_requestAccounts'); await E.P('A').set({gate:{eth_estimateGas:true}}); await witness(E,'0.01');
  const g=await E.waitGate('A','eth_estimateGas',6000);
  await E.P('A').set({accounts:[A2,A1]}); await E.P('A').emit('accountsChanged',[A2]); await sleep(500);
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_estimateGas'); await sleep(3500);
  const s=await E.sends(); const old=s.filter(x=>(x.params[0].from||'').toLowerCase()===A1);
  return {pass:g&&old.length===0, ev:{gateHit:g,sends:s.map(x=>x.params[0].from),label:await E.label(),requestAccountsAfter:(await E.P('A').count('eth_requestAccounts'))-rq0}}; });
T('f','chainChanged to 8453 right before submit: no send',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await E.P('A').set({gate:{eth_estimateGas:true}}); await witness(E,'0.01');
  const g=await E.waitGate('A','eth_estimateGas',6000);
  await E.P('A').set({chainId:'0x2105'}); await E.P('A').emit('chainChanged','0x2105'); await sleep(200);
  await E.P('A').set({gate:{}}); await E.P('A').release('eth_estimateGas'); await sleep(3500);
  const s=await E.sends(), t=await E.toasts();
  return {pass:g&&s.length===0, ev:{gateHit:g,sends:s.map(x=>x.chain),toasts:t.slice(-2)}}; });
T('g','a submitted tx is followed after DISCONNECT; the UI stays disconnected',{wallets:[one('A',undefined,{gate:{}})],ethereum:'A'},async E=>{
  await connect(E); E.chain.holdReceipts=true; await E.P('A').set({gate:{eth_getTransactionReceipt:true}}); const rq0=await E.P('A').count('eth_requestAccounts');
  await witness(E,'0.01'); const sent=await E.until(async()=>(await E.sends()).length>0,8000); await sleep(800);
  await disconnectUI(E); await sleep(500);
  E.chain.holdReceipts=false; await E.P('A').set({gate:{}}); await E.P('A').release('eth_getTransactionReceipt');
  const conf=await E.until(async()=>(await E.toasts()).some(x=>DONE.test(x)),15000); await sleep(500);
  const st=await E.state(), lab=await E.label();
  return {pass:sent&&conf&&!st.me&&!st.W&&/CONNECT/.test(lab)&&(await E.P('A').count('eth_requestAccounts'))===rq0, ev:{sent,confirmed:conf,state:st,label:lab,toasts:(await E.toasts()).slice(-3)}}; });
T('h1','picker: two announced wallets listed; only the chosen one is asked',{wallets:[one('A'),one('B')]},async E=>{
  await E.page.click('#wallet'); const open=await E.until(()=>sheetOpen(E.page),4000); const btns=await sheetButtons(E.page);
  await clickSheet(E.page,/WALLET B/); await E.until(async()=>/0x/.test(await E.label()),6000);
  const ra=await E.P('A').count('eth_requestAccounts'), rb=await E.P('B').count('eth_requestAccounts');
  return {pass:open&&btns.filter(b=>/WALLET [AB]/i.test(b)).length===2&&ra===0&&rb===1, ev:{buttons:btns,requestAccounts:{A:ra,B:rb},label:await E.label()}}; });
T('h2','picker: an announced wallet that fails its probe does not hide a working window.ethereum',
  {wallets:[one('A','0x1',{reject:{eth_chainId:{code:-32603,message:'internal'}}}),one('L','0x1',{announce:false,flags:{isMetaMask:true}})],ethereum:'L'},async E=>{
  await E.page.click('#wallet'); await sleep(2200); const btns=(await sheetOpen(E.page))?await sheetButtons(E.page):[];
  if(btns.length) await clickSheet(E.page,/METAMASK|BROWSER|WALLET L/).catch(()=>{});
  await E.until(async()=>/0x/.test(await E.label()),4000);
  const rl=await E.P('L').count('eth_requestAccounts');
  return {pass:rl===1&&/0x/.test(await E.label()), ev:{picker:btns,requestAccounts:{L:rl,A:await E.P('A').count('eth_requestAccounts')},label:await E.label(),toasts:(await E.toasts()).slice(-2)}}; });
T('h3','picker: the same provider announced twice and also window.ethereum/providers[] is one entry',
  {wallets:[one('A'),one('B')],ethereum:'A',providers:['A','B'],announceTwice:'A'},async E=>{
  await E.page.click('#wallet'); const open=await E.until(()=>sheetOpen(E.page),4000); const btns=await sheetButtons(E.page);
  return {pass:open&&btns.length===2, ev:{buttons:btns}}; });
T('h4','picker: a probe that throws synchronously and one that never answers are isolated',
  {wallets:[one('S','0x1',{throwSync:{eth_chainId:true}}),one('N','0x1',{never:{eth_chainId:true}}),one('G')]},async E=>{
  const t0=Date.now(); await E.page.click('#wallet'); const ok=await E.until(async()=>/0x/.test(await E.label())||await sheetOpen(E.page),5000); const dt=Date.now()-t0;
  const btns=(await sheetOpen(E.page))?await sheetButtons(E.page):[]; if(btns.length) await clickSheet(E.page,/WALLET G/).catch(()=>{});
  await E.until(async()=>/0x/.test(await E.label()),4000);
  return {pass:ok&&/0x/.test(await E.label())&&(await E.P('G').count('eth_requestAccounts'))===1&&E.errors.length===0, ev:{ms:dt,picker:btns,label:await E.label(),pageErrors:E.errors,toasts:(await E.toasts()).slice(-2)}}; });
T('h5','picker: a malformed eth_chainId answer is left off the list',{wallets:[one('M','0x1',{malformed:{eth_chainId:{bogus:true}}}),one('G')]},async E=>{
  await E.page.click('#wallet'); await sleep(2000); const btns=(await sheetOpen(E.page))?await sheetButtons(E.page):[];
  return {pass:!btns.some(b=>/WALLET M/i.test(b))&&(btns.length?true:/0x/.test(await E.label())), ev:{picker:btns,label:await E.label()}}; });
T('i1','remembered choice is asked directly after a reload',{wallets:[one('A'),one('B')]},async E=>{
  await connect(E,/WALLET B/); await E.page.reload(); await E.page.waitForFunction(()=>typeof ST!=='undefined'&&ST&&ST.now,null,{timeout:30000});
  await E.page.evaluate(()=>{ window.__toasts=[]; }); await E.page.click('#wallet'); await sleep(2200);
  const picker=await sheetOpen(E.page)&&/CONNECT WITH/i.test(await sheetTitle(E.page));
  return {pass:!picker&&/0x/.test(await E.label())&&(await E.P('A').count('eth_requestAccounts'))===0, ev:{picker,label:await E.label(),rqB:await E.P('B').count('eth_requestAccounts')}}; });
T('i2','refusal (4001) forgets the choice and asks no other wallet',{wallets:[one('A'),one('B',undefined,{reject:{eth_requestAccounts:{code:4001,message:'User rejected the request.'}}})]},async E=>{
  await E.page.evaluate(()=>{ try{ localStorage.setItem('stormglass.wallet','test.b'); }catch(e){} });
  await E.page.click('#wallet'); await sleep(2500);
  const saved=await E.page.evaluate(()=>localStorage.getItem('stormglass.wallet')); const ra=await E.P('A').count('eth_requestAccounts'), rb=await E.P('B').count('eth_requestAccounts');
  const t=await E.toasts();
  await E.page.click('#wallet'); const again=await E.until(()=>sheetOpen(E.page),4000);
  return {pass:ra===0&&rb===1&&!saved&&t.some(x=>/Cancelled/i.test(x))&&again, ev:{requestAccounts:{A:ra,B:rb},saved,pickerNext:again,toasts:t.slice(-1)}}; });
T('i3','picker cancel by CLOSE, Esc and backdrop resolves; a later CONNECT opens it again',{wallets:[one('A'),one('B')]},async E=>{
  const r={};
  for(const how of ['button','esc','backdrop']){ await E.page.click('#wallet'); const o=await E.until(()=>sheetOpen(E.page),4000); await cancelSheet(E.page,how); await sleep(300); r[how]={opened:o,closed:!(await sheetOpen(E.page))}; }
  await E.page.click('#wallet'); const again=await E.until(()=>sheetOpen(E.page),4000);
  const rq=(await E.P('A').count('eth_requestAccounts'))+(await E.P('B').count('eth_requestAccounts'));
  return {pass:Object.values(r).every(x=>x.opened&&x.closed)&&again&&rq===0&&E.errors.length===0, ev:{r,again,requestAccounts:rq,pageErrors:E.errors}}; });
T('i4','double-click CONNECT: one eth_requestAccounts',{wallets:[one('A',undefined,{delay:{eth_requestAccounts:600}})],ethereum:'A'},async E=>{
  await E.page.click('#wallet'); await sleep(40); await E.page.click('#wallet'); await sleep(40); await E.page.click('#wallet');
  await E.until(async()=>/0x/.test(await E.label()),6000); await sleep(800);
  const n=await E.P('A').count('eth_requestAccounts');
  return {pass:n===1, ev:{eth_requestAccounts:n,label:await E.label()}}; });
T('j1',"accountsChanged([]) disconnects; accountsChanged([other]) follows without eth_requestAccounts",{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); const rq0=await E.P('A').count('eth_requestAccounts');
  await E.P('A').set({accounts:[A2,A1]}); await E.P('A').emit('accountsChanged',[A2]); await sleep(1500);
  const lab2=await E.label(); const rq1=await E.P('A').count('eth_requestAccounts');
  await E.P('A').set({authorized:false}); await E.P('A').emit('accountsChanged',[]); await sleep(1500); const lab3=await E.label();
  return {pass:/0x0000…00bb/i.test(lab2)&&rq1===rq0&&/CONNECT/.test(lab3), ev:{afterOther:lab2,extraRequestAccounts:rq1-rq0,afterEmpty:lab3}}; });
T('j2',"events from the old wallet are ignored after switching wallets",{wallets:[one('A'),one('B')]},async E=>{
  await connect(E,/WALLET A/); await disconnectUI(E); await sleep(300); await E.page.click('#wallet');
  if(await E.until(()=>sheetOpen(E.page),3000)) await clickSheet(E.page,/WALLET B/); await E.until(async()=>/0x/.test(await E.label()),6000);
  const before=await E.label();
  await E.P('A').emit('accountsChanged',[A2]); await E.P('A').emit('accountsChanged',[]); await E.P('A').emit('disconnect',{code:4900}); await E.P('A').emit('chainChanged','0x2105'); await sleep(1500);
  const after=await E.label(), st=await E.state();
  return {pass:before===after&&/0x0000…00cc/i.test(after)&&!!st.W, ev:{before,after,rqA:await E.P('A').count('eth_requestAccounts')}}; });
T('j3',"the provider's 'disconnect' event disconnects the page",{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await E.P('A').emit('disconnect',{code:4900,message:'disconnected'}); await sleep(1500);
  const st=await E.state(), lab=await E.label();
  return {pass:/CONNECT/.test(lab)&&!st.me, ev:{label:lab,state:st}}; });
T('k1','DISCONNECT when wallet_revokePermissions is unsupported (rejects, or throws)',{wallets:[one('A',undefined,{revokeUnsupported:true}),one('B',undefined,{throwSync:{wallet_revokePermissions:true}})]},async E=>{
  const r={};
  for(const id of ['A','B']){ await connect(E,new RegExp('WALLET '+id)); await E.page.evaluate(()=>{ window.__toasts=[]; }); await disconnectUI(E); await sleep(800); r[id]={label:await E.label(),toast:(await E.toasts()).slice(-1)[0],state:await E.state()}; }
  return {pass:Object.values(r).every(x=>/CONNECT/.test(x.label)&&!x.state.me&&/disconnected/i.test(x.toast||''))&&E.errors.length===0, ev:{r,pageErrors:E.errors}}; });
T('k2','revoke answering after an immediate reconnect leaves the new session intact',{wallets:[one('A',undefined,{gate:{}})],ethereum:'A'},async E=>{
  await connect(E); await E.P('A').set({gate:{wallet_revokePermissions:true}}); await disconnectUI(E);
  const g=await E.waitGate('A','wallet_revokePermissions',3000);
  await E.page.click('#wallet'); await sleep(500); await E.P('A').set({gate:{}}); await E.P('A').release('wallet_revokePermissions');
  await sleep(3000); const lab=await E.label(), st=await E.state();
  const acc=await E.page.evaluate(()=>__MW.P.A.provider.request({method:'eth_accounts'}));
  return {pass:g&&/0x/.test(lab)&&!!st.W&&acc.length>0, ev:{gateHit:g,label:lab,state:st,walletAccounts:acc}}; });
T('l1','witness box: select all, clock redraw, type: replaced; selection and direction kept; snapshot at click',{wallets:[one('A')],ethereum:'A'},async E=>{
  const page=E.page; const hasBtn=await page.evaluate(()=>!!document.getElementById('nx-witBtn'));
  if(hasBtn){ await page.evaluate(()=>document.getElementById('nx-witBtn').click()); await page.waitForSelector('#nx-wit.on'); }
  await page.click('#wAmt'); await page.keyboard.type('0.05'); await page.evaluate(()=>{ const i=document.getElementById('wAmt'); i.select(); window.__node=i; });
  await page.evaluate(()=>REDRAW()); await page.keyboard.type('7'); const v1=await page.inputValue('#wAmt');
  await page.fill('#wAmt','0.123'); await page.evaluate(()=>{ const i=document.getElementById('wAmt'); i.focus(); i.setSelectionRange(1,4,'backward'); });
  await page.evaluate(()=>REDRAW()); const sel=await page.evaluate(()=>{ const i=document.getElementById('wAmt'); return {s:i.selectionStart,e:i.selectionEnd,d:i.selectionDirection,focus:document.activeElement===i}; });
  const kept=await page.evaluate(()=>{ window.__node=document.getElementById('wAmt'); document.getElementById('wAmt').dispatchEvent(new CompositionEvent('compositionstart',{data:''})); REDRAW(); return document.getElementById('wAmt')===window.__node; });
  await page.evaluate(()=>document.getElementById('wAmt').dispatchEvent(new CompositionEvent('compositionend',{data:''})));
  /* snapshot: click WITNESS with 0.05, change the box while the wallet thinks, the clicked amount goes out */
  await connect(E); if(hasBtn&&!(await page.$('#nx-wit.on'))){ await page.evaluate(()=>document.getElementById('nx-witBtn').click()); await page.waitForSelector('#nx-wit.on'); }
  await E.P('A').set({gate:{eth_chainId:true,eth_estimateGas:true}}); await page.fill('#wAmt','0.05'); await page.click('#bWit');
  const gl=await E.until(async()=>(await E.P('A').waiting('eth_chainId'))+(await E.P('A').waiting('eth_estimateGas'))>0,4000);
  await page.fill('#wAmt','9'); await E.P('A').set({gate:{}}); await E.P('A').release('eth_chainId'); await sleep(300); await E.P('A').release('eth_estimateGas');
  await E.until(async()=>(await E.sends()).length>0,6000); const s=await E.sends();
  const val=s[0]&&s[0].params[0].value;
  return {pass:gl&&v1==='7'&&sel.s===1&&sel.e===4&&sel.d==='backward'&&sel.focus&&kept&&val===ETH(0.05), ev:{gateHit:gl,afterSelectAllRedrawType:v1,selection:sel,nodeKeptWhileComposing:kept,sentValue:val,want:ETH(0.05)}}; });
T('l2','pledge box (founders day, redrawn every second): select all, wait, type: replaced; caret kept',{wallets:[one('A')],ethereum:'A'},async E=>{
  const page=E.page; await page.waitForSelector('#plAmt'); await page.click('#plAmt'); await page.keyboard.type('0.25');
  await page.evaluate(()=>document.getElementById('plAmt').select()); await sleep(1300); await page.keyboard.type('9'); const v=await page.inputValue('#plAmt');
  await page.fill('#plAmt','0.25'); await page.evaluate(()=>{ const i=document.getElementById('plAmt'); i.focus(); i.setSelectionRange(2,2); }); await sleep(1300);
  const c=await page.evaluate(()=>{ const i=document.getElementById('plAmt'); return {s:i.selectionStart,e:i.selectionEnd,focus:document.activeElement===i}; });
  return {pass:v==='9'&&c.s===2&&c.e===2&&c.focus, ev:{value:v,caret:c}}; },
  {chain:c=>{ c.values.today=0; c.values.lastId=0; c.values.foundersEnd=c.t0+5*3600; c.values.onSale=[0n,0n,0n,false]; }});
T('l3','bid box (the candle, redrawn every 5 s): selection direction kept, node kept',{wallets:[one('A')],ethereum:'A'},async E=>{
  const page=E.page; await page.waitForSelector('#bidAmt'); await page.click('#bidAmt'); await page.keyboard.type('0.123');
  await page.evaluate(()=>{ const i=document.getElementById('bidAmt'); i.setSelectionRange(1,4,'backward'); window.__node=i; }); await sleep(5600);
  const c=await page.evaluate(()=>{ const i=document.getElementById('bidAmt'); return {v:i.value,s:i.selectionStart,e:i.selectionEnd,d:i.selectionDirection,focus:document.activeElement===i,same:i===window.__node}; });
  return {pass:c.v==='0.123'&&c.s===1&&c.e===4&&c.d==='backward'&&c.focus, ev:c}; },
  {chain:c=>{ c.values.candleSettled=false; c.values.today=0; c.values.lastId=0; c.values.candleOpen=c.t0-2*3600; c.values.onSale=[0n,0n,0n,false]; }});
T('l4','founders day ends while typing: the page moves on without errors',{wallets:[one('A')],ethereum:'A'},async E=>{
  const page=E.page; const had=await page.$('#plAmt'); if(had){ await page.click('#plAmt'); await page.keyboard.type('0.2'); }
  await sleep(5000); const after=await page.evaluate(()=>({pl:!!document.getElementById('plAmt'),panel:document.getElementById('panel').textContent.slice(0,60)}));
  return {pass:!!had&&!after.pl&&E.errors.length===0, ev:{hadPledgeBox:!!had,after,pageErrors:E.errors}}; },
  {chain:c=>{ c.values.today=0; c.values.lastId=0; c.values.foundersEnd=c.t0+4; c.values.onSale=[0n,0n,0n,false]; }});
T('m1','phone (iPhone Safari): the WalletConnect sheet, no picker, no wallet asked',{wallets:[one('A'),one('B')]},async E=>{
  await E.page.click('#wallet'); await E.until(()=>sheetOpen(E.page),4000); const title=await sheetTitle(E.page), btns=await sheetButtons(E.page);
  await sleep(500); const rq=(await E.P('A').count('eth_requestAccounts'))+(await E.P('B').count('eth_requestAccounts'));
  return {pass:/CONNECT YOUR WALLET/.test(title)&&btns.some(b=>/METAMASK/.test(b))&&rq===0, ev:{title,buttons:btns,requestAccounts:rq}}; },
  {ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',viewport:{width:390,height:844},mobile:true});
T('m9','phone WalletConnect buy: no jump before the request is out; the OPEN button carries requestId+topic; the sheet closes on the answer',{wallets:[]},async E=>{
  const page=E.page, jumps=[];
  await page.route('https://link.zerion.io/**',r=>{ jumps.push(r.request().url()); r.fulfill({status:204,body:''}); });
  const a=await page.evaluate(()=>{ localStorage.setItem('WALLETCONNECT_DEEPLINK_CHOICE',JSON.stringify({name:'ZERION',href:'https://link.zerion.io'})); localStorage.removeItem('SG_WC_APP');
    const app=wcApp(); const ev={h:{},on(n,f){(this.h[n]=this.h[n]||[]).push(f)},emit(n,x){(this.h[n]||[]).forEach(f=>f(x))}};
    const fake={signer:{client:ev},request:()=>new Promise(r=>{ window.__answer=r; })}; window.__ev=ev; _WC=fake; wcHook(fake);
    window.__done=false; ask(fake,'eth_sendTransaction',[{}]).then(()=>{ window.__done=true; });
    const b=document.querySelector('#wsBtns button');
    return {app, libKey:localStorage.getItem('WALLETCONNECT_DEEPLINK_CHOICE'), title:document.getElementById('wsk').textContent, on:document.getElementById('wsheet').classList.contains('on'), btn:b&&b.textContent, disabled:!!(b&&b.disabled)}; });
  await page.evaluate(()=>document.querySelector('#wsBtns button').click()); await sleep(300); const early=jumps.length;
  await page.evaluate(()=>window.__ev.emit('session_request_sent',{id:1730000000123456,topic:'t0pic',request:{method:'eth_sendTransaction'},chainId:'eip155:1'}));
  const b=await page.evaluate(()=>{ const x=document.querySelector('#wsBtns button'); return {disabled:x.disabled,text:document.getElementById('wsp').textContent}; });
  await page.evaluate(()=>document.querySelector('#wsBtns button').click()); await E.until(async()=>jumps.length>0,3000);
  await page.evaluate(()=>window.__answer('0x'+'11'.repeat(32))); await sleep(300);
  const c=await page.evaluate(()=>({on:document.getElementById('wsheet').classList.contains('on'),done:window.__done}));
  const url=jumps[0]||'';
  return {pass:a.app&&a.app.name==='ZERION'&&a.libKey===null&&/CONFIRM IN ZERION/.test(a.title)&&a.on&&a.disabled&&early===0&&!b.disabled&&/in ZERION now/.test(b.text)
      &&url==='https://link.zerion.io/wc?requestId=1730000000123456&sessionTopic=t0pic'&&!c.on&&c.done&&E.errors.length===0,
    ev:{a,early,b,url,c,errors:E.errors}}; },
  {ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',viewport:{width:390,height:844},mobile:true});
T('m2','phone in MetaMask: COLLECT on the wrong chain, SWITCH, the buy goes out once on chain 1',{wallets:[one('A','0x2105',{flags:{isMetaMask:true}})],ethereum:'A'},async E=>{
  await connect(E); await buy(E); const wrong=await E.until(async()=>/ANOTHER NETWORK/.test(await popText(E.page)),6000);
  if(await E.page.$('#nx-switch')) await E.page.evaluate(()=>document.getElementById('nx-switch').click());
  const done=await E.until(async()=>/IS YOURS|NOT COLLECTED/.test(await popText(E.page)),15000);
  const s=await E.sends(), p=await popText(E.page);
  const old=!(await E.page.$('#ccard')); const t=await E.toasts();
  return {pass:(old||wrong)&&s.length===1&&s[0].chain==='0x1'&&(old?t.some(x=>DONE.test(x)):/IS YOURS/.test(p)), ev:{oldPage:old,wrongView:wrong,sends:s.map(x=>x.chain),popup:p.slice(0,80),toasts:t.slice(-2)}}; },
  {ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MetaMaskMobile/7.40.0',viewport:{width:390,height:844},mobile:true});
T('m3','computer: COLLECT on the wrong chain, SWITCH, the buy goes out once on chain 1, no "network changed"',{wallets:[one('A','0x2105')],ethereum:'A'},async E=>{
  await connect(E); await buy(E); const wrong=await E.until(async()=>/ANOTHER NETWORK/.test(await popText(E.page)),6000);
  if(await E.page.$('#nx-switch')) await E.page.evaluate(()=>document.getElementById('nx-switch').click());
  const done=await E.until(async()=>/IS YOURS|NOT COLLECTED/.test(await popText(E.page)),15000);
  const s=await E.sends(), p=await popText(E.page);
  const old=!(await E.page.$('#ccard')); const t=await E.toasts();
  return {pass:s.length===1&&s[0].chain==='0x1'&&(old?t.some(x=>DONE.test(x)):/IS YOURS/.test(p)), ev:{oldPage:old,wrongView:wrong,sends:s.map(x=>x.chain),popup:p.slice(0,90),toasts:t.slice(-2)}}; });

/* THE WITNESS CALL-TO-ACTION (a quiet second button under the main buy button: the panel on a computer, the bottom bar on a phone).
   witGeo reads where it is: the buttons that are shown, whether they sit inside the screen, the gap under the main button, the tap size, and whether the page scrolls sideways. */
const witGeo=page=>page.evaluate(()=>{ const R=e=>{ if(!e) return null; const b=e.getBoundingClientRect(); return {l:b.left,t:b.top,r:b.right,b:b.bottom,w:b.width,h:b.height}; };
  const shown=e=>!!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';
  const bar=getComputedStyle(document.getElementById('nx-bar')).display!=='none'&&innerWidth<=699;
  const prim=document.getElementById(bar?'nx-barBtn':'bPick'), wit=document.getElementById(bar?'nx-barWit':'bWitCta');
  const inside=e=>{ if(!shown(e)) return false; const b=e.getBoundingClientRect(); return b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight; };
  const hit=e=>{ if(!shown(e)) return false; const b=e.getBoundingClientRect(); const x=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2); return !!x&&(x===e||e.contains(x)); };
  const p=R(prim), w=R(wit);
  return {bar,vw:innerWidth,vh:innerHeight,primaryText:prim&&prim.textContent.trim().slice(0,30),primaryInside:inside(prim),primaryHit:hit(prim),witShown:shown(wit),witText:wit&&wit.textContent.trim(),witInside:inside(wit),witHit:hit(wit),
    tap:w&&Math.round(w.h),gap:p&&w?Math.round(w.t-p.b):null,hscroll:document.documentElement.scrollWidth>innerWidth,line:(document.querySelector(bar?'#nx-barWc span':'#panel .nx-wc span')||{}).textContent||null,
    barRowShown:shown(document.getElementById('nx-barWc')),panelCta:!!document.getElementById('bWitCta'),hasw:document.body.classList.contains('nx-hasw')}; });
const witPass=g=>g.witShown&&g.witInside&&g.witHit&&g.primaryInside&&g.primaryHit&&g.tap>=44&&g.gap>=0&&g.gap<=60&&!g.hscroll&&g.witText==='WITNESS · ANY AMOUNT'&&g.line==='Want a cut of every future sale instead?';
async function witClick(page){ const id=await page.evaluate(()=>getComputedStyle(document.getElementById('nx-bar')).display!=='none'&&innerWidth<=699?'nx-barWit':'bWitCta'); await page.evaluate(i=>document.getElementById(i).click(),id); return id; }
const witSheet=page=>page.evaluate(()=>({on:document.getElementById('nx-wit').classList.contains('on'),title:(document.getElementById('nx-witK')||{}).textContent,box:!!document.getElementById('wAmt'),btn:!!document.getElementById('bWit')}));
const witOk=s=>s.on&&s.title==='WITNESS THIS DAY'&&s.box&&s.btn;
T('w1','open sale: WITNESS CTA is visible next to COLLECT at 1440x900 and 390x844 (320x640 too), tap >= 44, opens the sheet; then goes through send(witness) once, on chain 1',{wallets:[one('A')],ethereum:'A'},async E=>{
  const page=E.page, out={};
  for(const [w,h] of [[1440,900],[390,844],[320,640]]){ await page.setViewportSize({width:w,height:h}); await sleep(500); const g=await witGeo(page); const id=await witClick(page); await sleep(300); const sh=await witSheet(page); await closeWit(page); await sleep(150);
    out[w+'x'+h]={pass:witPass(g)&&witOk(sh)&&(w<=699?g.bar&&g.barRowShown&&g.hasw:!g.bar&&g.panelCta),g,opened:id,sheet:sh}; }
  await page.setViewportSize({width:1440,height:900}); await sleep(400); await connect(E);
  await witClick(page); await page.waitForSelector('#nx-wit.on'); await page.fill('#wAmt','0.05'); await page.click('#bWit');
  await E.until(async()=>(await E.sends()).length>0,8000); await sleep(400); const s=await E.sends();
  const name=s.length?await page.evaluate(d=>new ethers.Interface(['function witness(uint256) payable']).parseTransaction({data:d}).name,s[0].params[0].data):null;
  const arg=s.length?await page.evaluate(d=>String(new ethers.Interface(['function witness(uint256) payable']).parseTransaction({data:d}).args[0]),s[0].params[0].data):null;
  const sent={n:s.length,chain:s[0]&&s[0].chain,name,day:arg,value:s[0]&&s[0].params[0].value,want:ETH(0.05)};
  return {pass:Object.values(out).every(x=>x.pass)&&sent.n===1&&sent.chain==='0x1'&&sent.name==='witness'&&sent.day==='13'&&sent.value===sent.want&&E.errors.length===0, ev:{sizes:Object.fromEntries(Object.entries(out).map(([k,v])=>[k,{pass:v.pass,tap:v.g.tap,gap:v.g.gap,inside:v.g.witInside,sheet:v.sheet.on}])),sent,pageErrors:E.errors}}; });
const E_=v=>BigInt(Math.round(v*1e6))*10n**12n;
const soldChain=c=>{ const BUYER='0x19A84bF7b5DA2C290CB0Ca42bf691dd6C2308359', close=c.t0+8*3600, open=close-86400;
  c.values.onSale=[13n,0n,BigInt(close),false];
  c.plate=id=>[(396693683*(id+3))>>>0,open-86400*(13-id),close-86400*(13-id),E_(0.3),0n,BUYER,id%32,true]; };
const none=async page=>page.evaluate(()=>({panelCta:!!document.getElementById('bWitCta'),barRow:(()=>{ const e=document.getElementById('nx-barWc'); return e.getClientRects().length>0; })(),hasw:document.body.classList.contains('nx-hasw'),sheetOn:document.getElementById('nx-wit').classList.contains('on'),btn:(document.querySelector('#panel .nx-cta')||{}).textContent||'',hint:document.getElementById('nx-chip').textContent.trim()}));
T('w3','no CTA when nothing is on sale: day sold, day closed unsold, founders\' day, the candle; nothing shows at 1440x900 or 390x844',{wallets:[one('A')],ethereum:'A'},async E=>{
  const cases={ sold:{chain:soldChain}, unsold:{chain:c=>{ const close=c.t0-3600, open=close-86400; c.values.onSale=[13n,0n,BigInt(close),false]; c.plate=id=>id===13?[396693683,open,close,0n,0n,'0x0000000000000000000000000000000000000000',0,false]:[(396693683*(id+3))>>>0,open-86400*(13-id),close-86400*(13-id),E_(0.3),0n,'0x19A84bF7b5DA2C290CB0Ca42bf691dd6C2308359',id%32,true]; c.values.today=13; }},
    founders:{chain:c=>{ c.values.today=0; c.values.lastId=0; c.values.foundersEnd=c.t0+5*3600; c.values.onSale=[0n,0n,0n,false]; }},
    candle:{chain:c=>{ c.values.candleSettled=false; c.values.today=0; c.values.lastId=0; c.values.candleOpen=c.t0-2*3600; c.values.onSale=[0n,0n,0n,false]; }} };
  const res={}; let ok=true;
  for(const [k,o] of Object.entries(cases)){ const X=k==='sold'?E:await boot({wallets:[one('A')],ethereum:'A'},o);
    const r={}; for(const [w,h] of [[1440,900],[390,844]]){ await X.page.setViewportSize({width:w,height:h}); await sleep(600); r[w]=await none(X.page); }
    const good=Object.values(r).every(x=>!x.panelCta&&!x.barRow&&!x.hasw&&!x.sheetOn); ok=ok&&good; res[k]={good,chip:r[1440].hint,btn:r[1440].btn.slice(0,24)}; if(X!==E) await X.close(); }
  return {pass:ok&&E.errors.length===0, ev:{res,pageErrors:E.errors}}; },{chain:soldChain});


/* ═══ typed amounts: a comma-locale phone types 0,001 (the decimal keypad), and ethers.parseEther rejects the comma ═══ */
const AMT_HINT='Type an amount like 0.01';
const FOUNDERS={chain:c=>{ c.values.today=0; c.values.lastId=0; c.values.foundersEnd=c.t0+5*3600; c.values.onSale=[0n,0n,0n,false]; }};
const CANDLE={chain:c=>{ c.values.candleSettled=false; c.values.today=0; c.values.lastId=0; c.values.candleOpen=c.t0-2*3600; c.values.onSale=[0n,0n,0n,false]; }};
const openWit=async page=>{ if(await page.evaluate(()=>!!document.getElementById('nx-witBtn'))&&!(await page.$('#nx-wit.on'))){ await page.evaluate(()=>document.getElementById('nx-witBtn').click()); await page.waitForSelector('#nx-wit.on'); } };
/* type text into box, press btn; wait for a send (or none): returns {sent:[new sends], toasts:[new toasts], value:box text after} */
async function typeAndPress(E,box,btn,text,pre){ const page=E.page; if(pre) await pre(page);
  const s0=(await E.sends()).length, t0=(await E.toasts()).length;
  await page.fill(box,text); await page.click(btn);
  await E.until(async()=>(await E.sends()).length>s0||(await E.toasts()).length>t0,3000); await sleep(600);
  const sends=(await E.sends()).slice(s0), toasts=(await E.toasts()).slice(t0), value=await page.inputValue(box);
  return {sends,toasts,value}; }
const sendName=(page,tx)=>page.evaluate(d=>{ const I=new ethers.Interface(['function witness(uint256) payable','function pledge() payable','function bid() payable']); try{ return I.parseTransaction({data:d}).name; }catch(e){ return null; } },tx.params[0].data);
const BAD=['1,000.5','1.000,5','0,0,1','1..5','1.2.3','abc','0.01 eth','',' ','0','0,0','0.0','.',',','-1','+1','1e3','0.0000000000000000001','0,0000000000000000001','٠٫٠١'];

T('n1','witness "0,001" (comma decimal): one send of exactly 0.001 ETH, the box text left alone',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await openWit(E.page);
  const r=await typeAndPress(E,'#wAmt','#bWit','0,001'); const name=r.sends[0]&&await sendName(E.page,r.sends[0]);
  return {pass:r.sends.length===1&&r.sends[0].params[0].value===ETH(0.001)&&name==='witness'&&r.value==='0,001'&&r.toasts.every(t=>t!==AMT_HINT)&&E.errors.length===0,
    ev:{sends:r.sends.length,value:r.sends[0]&&r.sends[0].params[0].value,want:ETH(0.001),name,boxAfter:r.value,toasts:r.toasts,pageErrors:E.errors}}; });

T('n2','witness " 0.001 ", "0,0010", NBSP and narrow NBSP around it, ".001", "1 000,5" parse: each sends the right value',{wallets:[one('A')],ethereum:'A'},async E=>{
  const rows=[[' 0.001 ',0.001],['0,0010',0.001],[' 0.001 ',0.001],['.001',0.001],['0.001',0.001],['0 ,001',0.001]]; const out=[]; let ok=true;
  for(const [text,v] of rows){ const X=await boot({wallets:[one('A')],ethereum:'A'}); try{ await connect(X); await openWit(X.page);
      const r=await typeAndPress(X,'#wAmt','#bWit',text); const good=r.sends.length===1&&r.sends[0].params[0].value===ETH(v)&&r.toasts.every(t=>t!==AMT_HINT)&&X.errors.length===0; ok=ok&&good;
      out.push({text:JSON.stringify(text),n:r.sends.length,value:r.sends[0]&&r.sends[0].params[0].value,good}); } finally{ await X.close().catch(()=>{}); } }
  return {pass:ok,ev:{rows:out,want:ETH(0.001)}}; });

T('n3','witness bad amounts send nothing and say "Type an amount like 0.01" (two separators, letters, empty, zero, sign, 19 decimals...)',{wallets:[one('A')],ethereum:'A'},async E=>{
  await connect(E); await openWit(E.page); const out=[]; let ok=true;
  for(const text of BAD){ const r=await typeAndPress(E,'#wAmt','#bWit',text); const good=r.sends.length===0&&r.toasts.length>=1&&r.toasts[r.toasts.length-1]===AMT_HINT&&r.value===text; ok=ok&&good; if(!good) out.push({text,sends:r.sends.length,toasts:r.toasts,box:r.value}); }
  const total=(await E.sends()).length;
  return {pass:ok&&total===0&&E.errors.length===0,ev:{cases:BAD.length,failures:out,totalSends:total,pageErrors:E.errors}}; });

const boxCase=(box,btn,name,okRows)=>async E=>{
  await connect(E); await E.page.waitForSelector(box); const out=[]; let ok=true;
  for(const [text,v] of okRows){ const r=await typeAndPress(E,box,btn,text); const nm=r.sends[0]&&await sendName(E.page,r.sends[0]);
    const good=r.sends.length===1&&r.sends[0].params[0].value===ETH(v)&&nm===name&&r.value===text&&r.toasts.every(t=>t!==AMT_HINT); ok=ok&&good; out.push({text,sent:r.sends.length,value:r.sends[0]&&r.sends[0].params[0].value,name:nm,good});
    if(!good) break;
    await E.until(async()=>true,10); await sleep(200); }
  const bad=[]; const s0=(await E.sends()).length;
  for(const text of BAD){ const r=await typeAndPress(E,box,btn,text); const good=r.sends.length===0&&r.toasts.length>=1&&r.toasts[r.toasts.length-1]===AMT_HINT&&r.value===text; ok=ok&&good; if(!good) bad.push({text,sends:r.sends.length,toasts:r.toasts,box:r.value}); }
  const extra=(await E.sends()).length-s0;
  return {pass:ok&&extra===0&&E.errors.length===0,ev:{accepted:out,rejected:BAD.length,failures:bad,sendsDuringRejects:extra,pageErrors:E.errors}}; };
T('n4','pledge box (founders day): "0,25" sends 0.25 ETH once; every bad amount sends nothing and shows the hint',{wallets:[one('A')],ethereum:'A'},boxCase('#plAmt','#bPledge','pledge',[['0,25',0.25]]),FOUNDERS);
T('n5','bid box (the candle): "0,06" sends 0.06 ETH once; every bad amount sends nothing and shows the hint',{wallets:[one('A')],ethereum:'A'},boxCase('#bidAmt','#bBid','bid',[['0,06',0.06]]),CANDLE);

T('n6','parseAmount table (in the page): wei exact, 18 decimals ok, 19 rejected, one comma = decimal point',{wallets:[one('A')],ethereum:'A'},async E=>{
  const rows=await E.page.evaluate(()=>{ const t=x=>{ try{ return parseAmount(x).toString(); }catch(e){ return 'ERR:'+e.message; } };
    return [['0,001','1000000000000000'],['0.001','1000000000000000'],[' 0,0010 ','1000000000000000'],['1','1000000000000000000'],['1,','1000000000000000000'],['12.5','12500000000000000000'],['1,000','1000000000000000000'],['0.000000000000000001','1'],['0,000000000000000001','1'],['0.0000000000000000001','ERR:Type an amount like 0.01'],
      ['1,000.5','ERR:Type an amount like 0.01'],['1.000,5','ERR:Type an amount like 0.01'],['0,0,1','ERR:Type an amount like 0.01'],['-1','ERR:Type an amount like 0.01'],['abc','ERR:Type an amount like 0.01'],['','ERR:Type an amount like 0.01'],['0','ERR:Type an amount like 0.01'],[null,'ERR:Type an amount like 0.01'],[undefined,'ERR:Type an amount like 0.01']].map(([i,w])=>({i:String(i),got:t(i),want:w})); });
  const bad=rows.filter(r=>r.got!==r.want);
  return {pass:bad.length===0,ev:{n:rows.length,bad}}; });

module.exports={boot,connect,sheetOpen,sheetButtons,setBrowser:b=>{ browser=b; },sleep,one:(...a)=>one(...a),witGeo,witPass,witClick,witSheet,witOk,closeWit,ETH,
  T,CASES,clickSheet,sheetTitle,cancelSheet,disconnectUI,witness,buy,popText,openWit,typeAndPress,sendName,DONE,A1,A2,B1,FOUNDERS,CANDLE};
/* THE RUN. Exit status: 0 only when every selected case passed. A case fails on its own assertion, on an exception, or on any
   uncaught page error or page crash (o.allowPageErrors to opt out). CASES must name known cases (or the groups @orig, @audit2);
   an unknown id, or a selection of zero cases, is a harness failure (exit 2). */
if(require.main===module) (async()=>{
  const ORIG=CASES.map(c=>c.id);
  require('./audit2.test.js');
  const AUDIT=CASES.map(c=>c.id).filter(id=>!ORIG.includes(id));
  const want=(process.env.CASES||'').split(',').map(x=>x.trim()).filter(Boolean).flatMap(x=>x==='@orig'?ORIG:x==='@audit2'?AUDIT:[x]);
  if(process.env.CASES!=null&&process.env.CASES.trim()!==''&&!want.length){ console.log('HARNESS FAIL CASES='+JSON.stringify(process.env.CASES)+' selects no case'); process.exit(2); }
  const known=new Set(CASES.map(c=>c.id)), unknown=want.filter(x=>!known.has(x));
  if(unknown.length){ console.log('HARNESS FAIL unknown case ids in CASES: '+unknown.join(',')); process.exit(2); }
  const sel=CASES.filter(c=>!want.length||want.includes(c.id));
  if(!sel.length){ console.log('HARNESS FAIL no cases selected'); process.exit(2); }
  browser=await chromium.launch({args:['--no-sandbox','--disable-background-networking','--disable-component-update','--no-first-run'],executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium'});
  const res=[];
  for(const c of sel){ let E=null, r;
    try{ E=await boot(c.cfg,c.o||{}); r=await c.run(E); if(!r||typeof r!=='object') r={pass:false,ev:{bad:'case returned '+r}}; r.ev=r.ev||{}; r.pageErrors=E.errors.slice(0,3);
      if(E.errors.length&&!(c.o&&c.o.allowPageErrors)){ r.pass=false; r.ev.failedOnPageErrors=E.errors.slice(0,3); } }
    catch(e){ r={pass:false,ev:{exception:String(e&&e.message||e).slice(0,300)}}; }
    finally{ if(E) await E.close().catch(()=>{}); }
    res.push({id:c.id,name:c.name,pass:r.pass===true,ev:r.ev,pageErrors:r.pageErrors});
    console.log((r.pass===true?'PASS ':'FAIL ')+c.id.padEnd(3)+' '+c.name+'\n     '+JSON.stringify(r.ev).slice(0,400)); }
  await browser.close();
  fs.mkdirSync(OUT,{recursive:true}); fs.writeFileSync(path.join(OUT,'results-'+LABEL+'.json'),JSON.stringify(res,null,1));
  const failed=res.filter(r=>!r.pass);
  console.log(LABEL+': '+(res.length-failed.length)+'/'+res.length+' passed'+(failed.length?' · FAILED: '+failed.map(r=>r.id).join(','):''));
  process.exit(failed.length?1:0);
})().catch(e=>{ console.log('HARNESS FAIL',e&&e.stack||e); process.exit(1); });
