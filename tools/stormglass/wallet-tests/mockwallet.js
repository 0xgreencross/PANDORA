/* Mock EIP-1193 wallets, injected before the page runs (page.addInitScript(installMock, cfg)). Each provider logs every request
   and can be steered from the test: chain, accounts, per-method delays, rejections, sync throws, malformed answers, requests
   that never answer, gates the test opens by hand, and events (accountsChanged, chainChanged, disconnect).
   cfg = { wallets:[{id,name,rdns,icon?,announce?:true,chainId:'0x1',accounts:[..],authorized?:false, ...rules}], ethereum:'A'|null, providers:['A','B']|null,
           announceTwice:'A'|null }
   rules (also settable later with __MW.P[id].set({...})): delay:{method:ms}, reject:{method:{code,message}}, throwSync:{method:true},
   never:{method:true}, malformed:{method:value}, switchReject:{code}|null, revokeUnsupported:bool, emitOnRevoke:bool, gate:{method:true} */
function installMock(cfg){
  const MW={ log:[], sends:[], P:{}, hashN:0 };
  window.__MW=MW;
  const ICON='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect width="20" height="20" fill="#c8ff3a"/></svg>');
  function make(w){
    const L={}; const st=Object.assign({chainId:'0x1',accounts:['0x00000000000000000000000000000000000000aa'],authorized:false,delay:{},reject:{},throwSync:{},never:{},malformed:{},gate:{},switchReject:null,revokeUnsupported:false,emitOnRevoke:true},w);
    const gates={};   /* method -> [resolve,...] waiting */
    const emit=(ev,...a)=>{ (L[ev]||[]).slice().forEach(f=>{ try{ f(...a); }catch(e){ console.error('listener',e); } }); };
    const p={
      request(args){
        const method=args&&args.method, params=args&&args.params;
        MW.log.push({pid:st.id,method,params:params===undefined?null:JSON.parse(JSON.stringify(params)),chain:st.chainId,t:performance.now()});
        if(st.throwSync[method]) throw new Error('sync throw from '+st.id+' '+method);
        return (async()=>{
          if(st.gate[method]){ await new Promise(r=>(gates[method]=gates[method]||[]).push(r)); }
          if(st.delay[method]) await new Promise(r=>setTimeout(r,st.delay[method]));
          if(st.never[method]) return new Promise(()=>{});
          if(st.reject[method]){ const e=new Error(st.reject[method].message||'rejected'); e.code=st.reject[method].code; throw e; }
          if(method in st.malformed) return st.malformed[method];
          switch(method){
            case 'eth_chainId': return st.chainId;
            case 'net_version': return String(parseInt(st.chainId,16));
            case 'eth_accounts': return st.authorized?st.accounts.slice():[];
            case 'eth_requestAccounts': { const was=st.authorized; st.authorized=true; if(!was) setTimeout(()=>emit('accountsChanged',st.accounts.slice()),0); return st.accounts.slice(); }
            case 'wallet_switchEthereumChain': { if(st.switchReject){ const e=new Error(st.switchReject.message||'User rejected the request.'); e.code=st.switchReject.code; throw e; }
              const c=params[0].chainId; if(c!==st.chainId){ st.chainId=c; setTimeout(()=>emit('chainChanged',c),0); } return null; }
            case 'wallet_revokePermissions': { if(st.revokeUnsupported){ const e=new Error('The method "wallet_revokePermissions" does not exist / is not available.'); e.code=-32601; throw e; }
              st.authorized=false; if(st.emitOnRevoke) setTimeout(()=>emit('accountsChanged',[]),0); return null; }
            case 'eth_estimateGas': return '0x30d40';
            case 'eth_blockNumber': return '0x1406f40';
            case 'eth_gasPrice': return '0x3b9aca00';
            case 'eth_maxPriorityFeePerGas': return '0x1';
            case 'eth_getTransactionCount': return '0x1';
            case 'eth_sendTransaction': { if(!st.authorized) { const e=new Error('Unauthorized'); e.code=4100; throw e; }
              const h='0x'+(++MW.hashN).toString(16).padStart(64,'0'); MW.sends.push({pid:st.id,chain:st.chainId,params:JSON.parse(JSON.stringify(params)),hash:h}); return h; }
            case 'eth_getTransactionByHash': { const s=MW.sends.find(x=>x.hash===params[0]); if(!s) return null; const q=s.params[0];
              return {hash:s.hash,blockHash:null,blockNumber:null,transactionIndex:null,from:q.from,to:q.to,nonce:'0x0',gas:q.gas||'0x3d090',gasPrice:'0x3b9aca00',maxFeePerGas:'0x3b9aca00',maxPriorityFeePerGas:'0x1',input:q.data||'0x',value:q.value||'0x0',type:'0x2',chainId:s.chain,accessList:[],v:'0x0',r:'0x'+'11'.repeat(32),s:'0x'+'22'.repeat(32),yParity:'0x0'}; }
            case 'eth_getTransactionReceipt': { const s=MW.sends.find(x=>x.hash===params[0]); if(!s) return null; const q=s.params[0];
              return {transactionHash:s.hash,blockHash:'0x'+'33'.repeat(32),blockNumber:'0x1406f3f',transactionIndex:'0x0',from:q.from,to:q.to,cumulativeGasUsed:'0x30d40',gasUsed:'0x30d40',effectiveGasPrice:'0x3b9aca00',contractAddress:null,logs:[],logsBloom:'0x'+'00'.repeat(256),status:'0x1',type:'0x2'}; }
            case 'eth_call': return '0x';
            case 'eth_getBlockByNumber': return {number:'0x1406f40',hash:'0x'+'44'.repeat(32),parentHash:'0x'+'55'.repeat(32),timestamp:'0x'+Math.floor(Date.now()/1000).toString(16),nonce:'0x0000000000000000',difficulty:'0x0',gasLimit:'0x1c9c380',gasUsed:'0x0',miner:'0x'+'00'.repeat(20),extraData:'0x',baseFeePerGas:'0x3b9aca00',transactions:[]};
            default: { const e=new Error('method not found '+method); e.code=-32601; throw e; }
          }
        })();
      },
      on(ev,f){ (L[ev]=L[ev]||[]).push(f); return p; },
      removeListener(ev,f){ L[ev]=(L[ev]||[]).filter(x=>x!==f); return p; },
    };
    if(st.flags) Object.assign(p,st.flags);
    MW.P[st.id]={ provider:p, st,
      set(o){ Object.assign(st,o); },
      emit,
      listeners:ev=>(L[ev]||[]).length,
      waiting:m=>(gates[m]||[]).length,
      release(m){ const g=gates[m]||[]; gates[m]=[]; g.forEach(r=>r()); return g.length; },
      count:m=>MW.log.filter(x=>x.pid===st.id&&x.method===m).length };
    return p;
  }
  const W=(cfg.wallets||[]).map(w=>({w,p:make(w)}));
  const info=w=>Object.freeze({uuid:'00000000-0000-4000-8000-'+String(w.id.charCodeAt(0)).padStart(12,'0'),name:w.name||w.id,icon:w.icon||ICON,rdns:w.rdns||('test.'+w.id.toLowerCase())});
  const announce=()=>W.forEach(({w,p})=>{ if(w.announce===false) return; const d=Object.freeze({info:info(w),provider:p});
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:d})); if(cfg.announceTwice===w.id) window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:Object.freeze({info:info(w),provider:p})})); });
  window.addEventListener('eip6963:requestProvider',announce);
  const byId=id=>{ const x=W.find(x=>x.w.id===id); return x&&x.p; };
  if(cfg.ethereum){ const e=byId(cfg.ethereum); if(cfg.providers) e.providers=cfg.providers.map(byId); window.ethereum=e; }
}
module.exports={installMock};
