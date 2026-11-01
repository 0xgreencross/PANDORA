/* THE HARNESS PROBES (group @harness): the harness itself, not the page. Loaded by wallet.test.js after the audit cases.
   hz1 nothing real can be reached: a write to a public RPC is answered by the fake chain, the WalletConnect relay (https and wss)
       and any other outside host are refused and recorded, no wallet exists unless the test makes one, no browser extension is loaded.
   hz2 isolation: a context that keeps firing requests and timers is closed; nothing from it arrives afterwards, and a new context
       starts with empty storage and a fresh mock wallet log. */
const H=require('./wallet.test.js');
const {T,sleep,one}=H;

T('hz1','probe: no real wallet, RPC write, relay or outside host is reachable from a case',{wallets:[]},async E=>{
  const page=E.page;
  const r=await page.evaluate(async()=>{
    const out={};
    const post=async(url,body)=>{ try{ const x=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); return {status:x.status,text:(await x.text()).slice(0,160)}; }catch(e){ return {err:String(e).slice(0,120)}; } };
    out.drpcWrite=await post('https://eth.drpc.org',{jsonrpc:'2.0',id:1,method:'eth_sendRawTransaction',params:['0x02f8']});
    out.publicnodeWrite=await post('https://ethereum-rpc.publicnode.com',{jsonrpc:'2.0',id:2,method:'eth_sendRawTransaction',params:['0x02f8']});
    out.relayHttps=await post('https://relay.walletconnect.org/',{});
    out.relayHttpsCom=await post('https://relay.walletconnect.com/',{});
    out.other=await post('https://example.com/',{});
    out.ws=await new Promise(res=>{ let ws; try{ ws=new WebSocket('wss://relay.walletconnect.org/?projectId=9204f8b0f71b2868dece0e6e57a2950a'); }catch(e){ return res({err:String(e)}); }
      let opened=false, got=null; ws.onopen=()=>{ opened=true; }; ws.onmessage=m=>{ got=String(m.data).slice(0,80); };
      ws.onclose=e=>res({opened,got,code:e.code}); ws.onerror=()=>{}; setTimeout(()=>res({opened,got,timeout:true}),5000); });
    out.ethereum=typeof window.ethereum;
    out.announced=await new Promise(res=>{ const seen=[]; const f=e=>seen.push(e.detail&&e.detail.info&&e.detail.info.rdns); window.addEventListener('eip6963:announceProvider',f);
      window.dispatchEvent(new Event('eip6963:requestProvider')); setTimeout(()=>{ window.removeEventListener('eip6963:announceProvider',f); res(seen); },500); });
    return out; });
  /* extensions: no extension target (background page / service worker under chrome-extension://) in this browser */
  const cdp=await page.context().browser().newBrowserCDPSession(); const {targetInfos}=await cdp.send('Target.getTargets'); await cdp.detach();
  const ext=targetInfos.filter(t=>/^chrome-extension:/.test(t.url)||/extension/i.test(t.type)).map(t=>t.type+' '+t.url);
  const fakeAnswer=x=>x&&x.status===200&&/method not found: eth_sendRawTransaction/.test(x.text);
  const refused=x=>x&&x.status===404&&x.text==='';
  const hitsWrite=Object.keys(E.chain.hits).filter(k=>/eth_sendRawTransaction/.test(k));
  const pass=fakeAnswer(r.drpcWrite)&&fakeAnswer(r.publicnodeWrite)&&refused(r.relayHttps)&&refused(r.relayHttpsCom)&&refused(r.other)
    &&!r.ws.opened&&r.ws.got===null&&E.sockets.some(u=>/relay\.walletconnect\.org/.test(u))
    &&E.outside.some(u=>/relay\.walletconnect\.org/.test(u))&&E.outside.some(u=>/relay\.walletconnect\.com/.test(u))&&E.outside.some(u=>/example\.com/.test(u))
    &&hitsWrite.length===2&&r.ethereum==='undefined'&&r.announced.length===0&&ext.length===0;
  return {pass,ev:{probe:r,fakeChainWrites:hitsWrite,outsideRefused:E.outside,socketsRefused:E.sockets,extensions:ext,targets:targetInfos.length}}; });

/* hz2 (gated, audit 5): the noisy context must be SEEN sending (at least 5 probe requests and 5 wallet requests counted while open,
   bounded wait) before it is closed: on a loaded machine a fixed 600 ms could close it before its first probe, and "nothing after
   the close" would then prove nothing. A late timer is armed just before the close. After the close: no probe for 3 s (past the late
   timer), while the same probe sent by the next context IS counted (the counting path still works). */
T('hz2','isolation: a closed context sends nothing more; the next context has empty storage and a fresh wallet log',{wallets:[one('A')],ethereum:'A'},async E=>{
  /* E is the noisy one: storage written, a request every 100 ms, a wallet request every 100 ms */
  await E.page.evaluate(()=>{ localStorage.setItem('z2.leak','1'); sessionStorage.setItem('z2.leak','1'); document.cookie='z2leak=1';
    setInterval(()=>{ fetch('https://eth.drpc.org',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:9,method:'z2_leak_probe',params:[]})}).catch(()=>{}); window.__MW.P.A.provider.request({method:'eth_chainId'}).catch(()=>{}); },100); });
  const seen=await E.until(async()=>(H.ALLHITS.z2_leak_probe||0)>=5&&(await E.page.evaluate(()=>__MW.log.filter(x=>x.method==='eth_chainId').length))>=5,15000);
  const live=H.ALLHITS.z2_leak_probe||0;
  await E.page.evaluate(()=>{ setTimeout(()=>{ fetch('https://eth.drpc.org',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:9,method:'z2_late_probe',params:[]})}).catch(()=>{}); },1500); });
  await E.ctx.close(); const atClose=H.ALLHITS.z2_leak_probe||0, lateAtClose=H.ALLHITS.z2_late_probe||0;
  const X=await H.boot({wallets:[one('A')],ethereum:'A'});
  await sleep(3000);   /* the silence window after the close (plus X's boot): well past the 1.5 s late timer */
  const after=H.ALLHITS.z2_leak_probe||0, lateAfter=H.ALLHITS.z2_late_probe||0;
  const st=await X.page.evaluate(async()=>({ls:localStorage.getItem('z2.leak'),ss:sessionStorage.getItem('z2.leak'),cookie:document.cookie,
    log:__MW.log.length,chainIdCalls:__MW.log.filter(x=>x.method==='eth_chainId').length,sends:__MW.sends.length,
    sw:navigator.serviceWorker?(await navigator.serviceWorker.getRegistrations()).length:-1}));
  const xHits=X.chain.hits['eth.drpc.org z2_leak_probe']||0;
  /* positive control: the next context's own probe is counted */
  await X.page.evaluate(()=>fetch('https://eth.drpc.org',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:9,method:'z2_leak_probe',params:[]})}).then(r=>r.text()).catch(()=>{}));
  const control=await E.until(async()=>(X.chain.hits['eth.drpc.org z2_leak_probe']||0)===1,5000);
  return {pass:seen&&live>=5&&after===atClose&&lateAtClose===0&&lateAfter===0&&xHits===0&&control&&st.ls===null&&st.ss===null&&!/z2leak/.test(st.cookie)&&st.sends===0&&st.chainIdCalls<20,
    ev:{seenWhileOpen:seen,probesWhileOpen:live,probesAtClose:atClose,probesAfterClose:after-atClose,lateProbe:{atClose:lateAtClose,after:lateAfter},probesSeenByNextContextBeforeControl:xHits,controlCounted:control,next:st}}; });
