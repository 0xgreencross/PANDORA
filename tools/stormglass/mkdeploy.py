"""THE DEPLOY PAGE. A single html file that carries the compiled artifacts and the token page's
chunks, and lays the whole set on a chain from the browser: a burner key for Sepolia, MetaMask
for mainnet (the user clicks; nothing here ever holds a mainnet key). Out: glass/deploy/index.html"""
import json, os, hashlib
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART=os.path.join(ROOT,'stormglass','artifacts','contracts')
def art(name):
    a=json.load(open(os.path.join(ART,name+'.sol',name+'.json')))
    dbg=json.load(open(os.path.join(ART,name+'.sol',name+'.dbg.json')))
    bi=json.load(open(os.path.normpath(os.path.join(ART,name+'.sol',dbg['buildInfo']))))
    ev=bi['output']['contracts'][a['sourceName']][name]['evm']['deployedBytecode']
    assert '0x'+ev['object']==a['deployedBytecode']
    imm=[[r['start'],r['length']] for refs in ev.get('immutableReferences',{}).values() for r in refs]
    # VERIFY compares the code on the chain with this, the immutables (set at construction) masked
    return {'abi':a['abi'],'bytecode':a['bytecode'],'runtime':a['deployedBytecode'],'imm':imm}
arts={n:art(n) for n in ['Coats','GLASS','STORMGLASS']}
man=json.load(open(os.path.join(ROOT,'onchain','manifest.json')))
chunks=[open(os.path.join(ROOT,'onchain','chunks','%02d.bin'%i),'rb').read().decode('ascii') for i in range(len(man['chunks']))]
for i,c in enumerate(chunks): assert hashlib.sha256(c.encode()).hexdigest()==man['chunks'][i]['sha256']
srcsha={n:hashlib.sha256(open(os.path.join(ROOT,'stormglass','contracts',n+'.sol'),'rb').read()).hexdigest() for n in arts}
HTML=r'''<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>STORMGLASS · DEPLOY</title>
<style>
  :root{--bg:#08080a;--ink:#e8e8ec;--mut:#8a8a94;--acc:#c8ff3a;--bad:#ff5a5a;--hair:#26262c}
  body{margin:0;background:var(--bg);color:var(--ink);font:13px/1.55 ui-monospace,Menlo,Consolas,monospace;padding:20px;max-width:980px}
  h1{font-size:14px;letter-spacing:.22em;margin:0 0 4px} h2{font-size:11px;letter-spacing:.2em;color:var(--mut);margin:26px 0 8px;border-bottom:1px solid var(--hair);padding-bottom:6px}
  button{font:inherit;background:none;color:var(--ink);border:1px solid var(--ink);padding:7px 12px;cursor:pointer;margin:4px 6px 4px 0;letter-spacing:.06em}
  button:disabled{opacity:.35;cursor:default} button.prime{border-color:var(--acc);color:var(--acc)}
  input,select{font:inherit;background:#0f0f13;color:var(--ink);border:1px solid var(--hair);padding:6px 8px;min-width:280px}
  label{color:var(--mut);font-size:11px;letter-spacing:.14em;display:block;margin-top:8px}
  #log{white-space:pre-wrap;background:#0f0f13;border:1px solid var(--hair);padding:10px;min-height:120px;max-height:420px;overflow:auto;font-size:12px}
  .ok{color:var(--acc)} .bad{color:var(--bad)} .row{display:flex;gap:18px;flex-wrap:wrap;align-items:end}
  iframe{width:540px;height:540px;border:1px solid var(--hair);background:#000;display:block;margin-top:8px}
  textarea{width:100%;min-height:80px;font:inherit;background:#0f0f13;color:var(--ink);border:1px solid var(--hair)}
</style></head><body>
<h1>DITHERVOID // STORMGLASS · THE DEPLOY</h1>
<div style="color:var(--mut)">Compiler pinned: solc 0.8.24+commit.e11b9ed9 · cancun · optimizer 800 · viaIR. Page coat sha256 __COATSHA__ (__COATBYTES__ bytes, __NCHUNKS__ chunks). Sources: STORMGLASS __SHA_S__ · GLASS __SHA_G__ · Coats __SHA_C__.</div>

<h2>1 · THE CHAIN AND THE SIGNER</h2>
<div class="row">
  <div><label>NETWORK</label><select id="net"><option value="sepolia">Sepolia (rehearsal)</option><option value="mainnet">Ethereum mainnet (THE LEDGER)</option></select></div>
  <div><label>RPC (burner only)</label><input id="rpc" value="https://ethereum-sepolia-rpc.publicnode.com"></div>
</div>
<div class="row">
  <div><label>SIGNER</label><select id="signer"><option value="burner">Burner key kept in this browser (Sepolia only)</option><option value="mm">MetaMask (you click; the page never sees a key)</option></select></div>
  <button id="connect">CONNECT</button>
</div>
<div id="who" style="margin-top:8px;color:var(--mut)"></div>

<h2>2 · THE SETTINGS SET ONCE</h2>
<div class="row">
  <div><label>ETH/USDC POOL (the flood)</label><input id="ethPool"></div>
  <div><label>USDC/USDT POOL (the counterfeit)</label><input id="pegPool"></div>
</div>

<h2>3 · THE DEPLOY, IN ORDER</h2>
<button id="s1">a · COATS (the layer)</button>
<button id="s2">b · LAY THE PAGE (__NBATCH__ transactions)</button>
<button id="s3">c · THE GLASS</button>
<button id="s4" class="prime">d · STORMGLASS</button>
<button id="s5">e · VERIFY</button>
<div class="row" style="margin-top:6px">
  <div><label>COATS</label><input id="aCoats"></div>
  <div><label>GLASS</label><input id="aGlass"></div>
  <div><label>STORMGLASS</label><input id="aStorm"></div>
</div>
<label>CHUNKS (comma separated, filled by b)</label><textarea id="aChunks"></textarea>

<h2>4 · THE WALK (Sepolia)</h2>
<div class="row">
  <button id="w1">BID 0.05</button><button id="w2">BID 0.06</button><button id="w4">SETTLE THE CANDLE</button>
  <button id="w5">PLEDGE 0.005</button><button id="w6">SYNC</button><button id="w7">WITNESS 0.001</button><button id="w8">BUY (pick 7)</button><button id="w9">STATE</button>
</div>
<div class="row"><div><label>TOKEN ID</label><input id="tid" value="0" style="min-width:80px"></div><button id="w10">READ tokenURI AND SHOW THE PLATE</button></div>
<div id="meta" style="color:var(--mut);margin-top:6px"></div>
<iframe id="frame" sandbox="allow-scripts allow-downloads" style="display:none"></iframe>

<h2>THE RECORD</h2>
<textarea id="record" placeholder="filled as things land"></textarea>
<h2>LOG</h2>
<div id="log"></div>

<script>/*ETHERS*/</script>
<script>
const ARTS=__ARTS__;
const CHUNKS=__CHUNKS__;
const MAN=__MAN__;
const POOLS={mainnet:{eth:'0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',peg:'0x3416cF6C708Da44DB2624D63ea0AAef7113527C6'},sepolia:{eth:'0x0000000000000000000000000000000000000000',peg:'0x0000000000000000000000000000000000000000'}};
const $=id=>document.getElementById(id);
const log=(m,c)=>{ const e=$('log'); const d=document.createElement('div'); if(c)d.className=c; d.textContent=new Date().toISOString().slice(11,19)+'  '+m; e.appendChild(d); e.scrollTop=e.scrollHeight; };
const REC={}; const rec=(k,v)=>{ REC[k]=v; $('record').value=JSON.stringify(REC,null,1); };
let provider=null, signer=null, net='sepolia';
$('net').addEventListener('change',()=>{ net=$('net').value; $('ethPool').value=POOLS[net].eth; $('pegPool').value=POOLS[net].peg; for(const k of ['aCoats','aGlass','aStorm','aChunks']) $(k).value=''; signer=null; $('who').textContent='network changed: CONNECT'; /* audit, Oct 2: nothing from another chain carries over */ if(net==='mainnet'){ $('signer').value='mm'; $('rpc').value='https://ethereum-rpc.publicnode.com'; } else { $('rpc').value='https://ethereum-sepolia-rpc.publicnode.com'; } });
$('net').dispatchEvent(new Event('change'));
async function connect(){
  net=$('net').value;
  if($('signer').value==='burner'){
    if(net!=='sepolia'){ log('a burner is for Sepolia only','bad'); return; }
    let k=localStorage.getItem('stormglass_burner'); if(!k){ k=ethers.Wallet.createRandom().privateKey; localStorage.setItem('stormglass_burner',k); log('a burner key was made and kept in this browser'); }
    provider=new ethers.JsonRpcProvider($('rpc').value,undefined,{cacheTimeout:-1});   /* no cached nonce between back-to-back transactions */
    const cid=(await provider.getNetwork()).chainId; if(cid!==11155111n&&cid!==31337n){ provider=null; signer=null; log('the burner is for Sepolia only and this RPC is chain '+cid+': nothing will be sent','bad'); return; }
    signer=new ethers.Wallet(k,provider);
  } else {
    if(!window.ethereum){ log('no wallet in this browser','bad'); return; }
    provider=new ethers.BrowserProvider(window.ethereum); await provider.send('eth_requestAccounts',[]);
    /* THE CHAIN GUARD: the wallet must stand on the network chosen above, or nothing is sent */
    const want=net==='sepolia'?11155111n:1n;
    if((await provider.getNetwork()).chainId!==want){
      try{ await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x'+want.toString(16)}]}); }
      catch(e){ signer=null; log('switch the wallet to '+(net==='sepolia'?'Sepolia':'Ethereum mainnet')+' and CONNECT again','bad'); return; }
      provider=new ethers.BrowserProvider(window.ethereum);
      if((await provider.getNetwork()).chainId!==want){ signer=null; log('the wallet is not on '+net+': nothing will be sent','bad'); return; }
    }
    signer=await provider.getSigner();
    if(!window.__chainWatch){ window.__chainWatch=1; window.ethereum.on&&window.ethereum.on('chainChanged',()=>{ signer=null; $('who').textContent='the wallet changed network: CONNECT again'; log('the wallet changed network: CONNECT again before anything else','bad'); }); }
  }
  const addr=await signer.getAddress(); const n=await provider.getNetwork(); const b=await provider.getBalance(addr);
  $('who').textContent='signer '+addr+' · chain '+n.chainId+' · balance '+ethers.formatEther(b)+' ETH';
  rec('signer',addr); rec('chainId',String(n.chainId));
  log('connected: '+addr+' on chain '+n.chainId+', '+ethers.formatEther(b)+' ETH','ok');
}
$('connect').addEventListener('click',()=>connect().catch(e=>log(String(e.message||e),'bad')));
const need=()=>{ if(!signer) throw new Error('CONNECT first (on the network chosen above)'); return signer; };
const factory=n=>new ethers.ContractFactory(ARTS[n].abi,ARTS[n].bytecode,need());
const at=(n,a)=>new ethers.Contract(a,ARTS[n].abi,need());
async function txlog(name,tx){ log(name+' sent '+tx.hash); const rc=await tx.wait(); log(name+' mined in block '+rc.blockNumber+', gas '+rc.gasUsed,'ok'); return rc; }
$('s1').addEventListener('click',async()=>{ try{
  const c=await factory('Coats').deploy(); log('Coats sent '+c.deploymentTransaction().hash); await c.waitForDeployment();
  $('aCoats').value=await c.getAddress(); rec('coats',$('aCoats').value); log('Coats at '+$('aCoats').value,'ok');
}catch(e){ log(String(e.message||e),'bad'); } });
$('s2').addEventListener('click',async()=>{ try{
  const C=at('Coats',$('aCoats').value); const addrs=$('aChunks').value?$('aChunks').value.split(',').map(s=>s.trim()).filter(Boolean):[];
  for(let i=0;i<addrs.length;i++){ if((await provider.getCode(addrs[i])).length<=4) throw new Error('chunk '+i+' has no code on this chain: clear CHUNKS and lay again'); }
  for(let i=addrs.length;i<CHUNKS.length;i+=2){
    const batch=CHUNKS.slice(i,i+2).map(t=>'0x'+Array.from(new TextEncoder().encode(t)).map(b=>b.toString(16).padStart(2,'0')).join(''));
    const rc=await txlog('lay '+i+'..'+(i+batch.length-1), await C.lay(batch,{gasLimit:6000000*batch.length}));   /* a fixed limit: 2 chunks use 10.49M, under the 16.7M cap; a node's estimate may refuse */
    for(const l of rc.logs){ try{ const p=C.interface.parseLog(l); if(p&&p.name==='Laid') addrs.push(String(p.args[0])); }catch(_){} }
    $('aChunks').value=addrs.join(','); rec('chunks',addrs);
  }
  log('all '+addrs.length+' chunks laid','ok');
}catch(e){ log(String(e.message||e),'bad'); } });
$('s3').addEventListener('click',async()=>{ try{
  const chunks=$('aChunks').value.split(',').map(s=>s.trim()).filter(Boolean); if(chunks.length!==CHUNKS.length) throw new Error('need '+CHUNKS.length+' chunks');
  const nonce=await provider.getTransactionCount(await signer.getAddress(),'pending');
  const predicted=ethers.getCreateAddress({from:await signer.getAddress(),nonce:nonce+1});
  log('STORMGLASS will be at '+predicted+' (nonce '+(nonce+1)+'): do not send anything else from this signer until d is done','ok');
  const g=await factory('GLASS').deploy(predicted,chunks); log('GLASS sent '+g.deploymentTransaction().hash); await g.waitForDeployment();
  $('aGlass').value=await g.getAddress(); rec('glass',$('aGlass').value); rec('stormPredicted',predicted); log('GLASS at '+$('aGlass').value,'ok');
}catch(e){ log(String(e.message||e),'bad'); } });
$('s4').addEventListener('click',async()=>{ try{
  /* the page and the binding are proven BEFORE the sale exists (audit, Oct 2) */
  const G0=at('GLASS',$('aGlass').value); const coat0=ethers.getBytes(await G0.coat());
  const sha0=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',coat0))).map(b=>b.toString(16).padStart(2,'0')).join('');
  if(sha0!==MAN.coat_sha256) throw new Error('the GLASS does not hold the page (coat sha '+sha0+'): stop');
  const next=ethers.getCreateAddress({from:await signer.getAddress(),nonce:await provider.getTransactionCount(await signer.getAddress(),'pending')});
  if((await G0.storm()).toLowerCase()!==next.toLowerCase()) throw new Error('the GLASS is bound to '+(await G0.storm())+' but STORMGLASS would land at '+next+': something was sent in between; redo c');
  log('page proven ('+coat0.length+' bytes) and the GLASS waits for '+next,'ok');
  if(net==='mainnet'&&!confirm('THE LEDGER. Deploy STORMGLASS on mainnet now?')) return;
  const s=await factory('STORMGLASS').deploy($('aGlass').value,$('ethPool').value,$('pegPool').value); log('STORMGLASS sent '+s.deploymentTransaction().hash); await s.waitForDeployment();
  $('aStorm').value=await s.getAddress(); rec('storm',$('aStorm').value); rec('deployTx',s.deploymentTransaction().hash); log('STORMGLASS at '+$('aStorm').value,'ok');
}catch(e){ log(String(e.message||e),'bad'); } });
$('s5').addEventListener('click',async()=>{ try{
  const G=at('GLASS',$('aGlass').value), S=at('STORMGLASS',$('aStorm').value);
  const coat=ethers.getBytes(await G.coat()); const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',coat))).map(b=>b.toString(16).padStart(2,'0')).join('');
  log('coat on chain: '+coat.length+' bytes, sha256 '+sha+(sha===MAN.coat_sha256?' MATCHES the manifest':' DOES NOT MATCH'), sha===MAN.coat_sha256?'ok':'bad');
  const gs=await G.storm(), sg=await S.glass(); log('GLASS.storm '+gs+' / STORMGLASS.glass '+sg+((gs.toLowerCase()===$('aStorm').value.toLowerCase()&&sg.toLowerCase()===$('aGlass').value.toLowerCase())?' BOUND':' NOT BOUND'));
  log('candleOpen '+(await S.candleOpen())+' revealBlock '+(await S.revealBlock())+' zeroSeed '+(await S.zeroSeed())+' ARTIST '+(await S.ARTIST())+' PAYEE '+(await S.PAYEE()));
  /* THE CODE: what stands at each address is byte for byte the compiled code, the immutables masked */
  const same=async(n,a)=>{ const live=ethers.getBytes(await provider.send('eth_getCode',[a,'latest'])), want=ethers.getBytes(ARTS[n].runtime);
    if(live.length!==want.length) return false; const m=new Uint8Array(live.length); for(const [st,len] of ARTS[n].imm) for(let i=st;i<st+len;i++) m[i]=1;
    for(let i=0;i<live.length;i++) if(!m[i]&&live[i]!==want[i]) return false; return true; };
  const okC=await same('Coats',$('aCoats').value), okG=await same('GLASS',$('aGlass').value), okS=await same('STORMGLASS',$('aStorm').value);
  log('code on chain: Coats '+(okC?'MATCHES':'DIFFERS')+' · GLASS '+(okG?'MATCHES':'DIFFERS')+' · STORMGLASS '+(okS?'MATCHES':'DIFFERS')+' the compiled code', okC&&okG&&okS?'ok':'bad');
  rec('verified',{coatSha:sha, coatBytes:coat.length, code:okC&&okG&&okS});
}catch(e){ log(String(e.message||e),'bad'); } });
const S=()=>at('STORMGLASS',$('aStorm').value);
async function pad(m,args,ov={}){ let g=null; try{ g=await m.estimateGas(...args,ov); }catch(e){} if(g===null) return m(...args,ov); let L=g*3n/2n+60000n; if(L<250000n) L=250000n; if(L>15000000n) L=15000000n; return m(...args,{...ov,gasLimit:L}); }   /* room to spare: a smart-account wallet (EIP-7702) runs code when refunded and estimates come in short */
const walk=(id,fn)=>$(id).addEventListener('click',async()=>{ try{ await fn(); }catch(e){ log(String(e.reason||e.message||e),'bad'); } });
walk('w1',async()=>txlog('bid 0.05',await pad(S().bid,[],{value:ethers.parseEther('0.05')})));
walk('w2',async()=>txlog('bid 0.06',await pad(S().bid,[],{value:ethers.parseEther('0.06')})));
walk('w4',async()=>txlog('settleCandle',await pad(S().settleCandle,[])));
walk('w5',async()=>txlog('pledge',await pad(S().pledge,[],{value:ethers.parseEther('0.005')})));
walk('w6',async()=>txlog('sync',await pad(S().sync,[])));
walk('w7',async()=>{ const [id]=await S().onSale(); await txlog('witness',await pad(S().witness,[id],{value:ethers.parseEther('0.001')})); });
walk('w8',async()=>{ const [id,price]=await S().onSale(); log('on sale: id '+id+' price '+ethers.formatEther(price)); await txlog('buy',await pad(S().buy,[id,7],{value:price+price/20n})); });
walk('w9',async()=>{ const s=S(); const [id,price,close,open]=await s.onSale();
  log('candleClose '+(await s.candleClose())+' settled '+(await s.candleSettled())+' FOUNDING '+ethers.formatEther(await s.FOUNDING())+' foundersEnd '+(await s.foundersEnd())+' today '+(await s.today())+' onSale id '+id+' price '+ethers.formatEther(price)+' close '+close+' open '+open+' vault '+ethers.formatEther(await s.vault())+' seatPool '+ethers.formatEther(await s.seatPool())+' dead '+(await s.dead())+' block '+(await provider.getBlockNumber())+' now '+Math.floor(Date.now()/1000)); });
walk('w10',async()=>{ const uri=await S().tokenURI(BigInt($('tid').value)); const json=JSON.parse(atob(uri.slice('data:application/json;base64,'.length)));
  $('meta').textContent=json.name+' · '+JSON.stringify(json.attributes)+' · animation_url '+json.animation_url.length+' chars';
  const html=atob(json.animation_url.slice('data:text/html;base64,'.length)); const g=html.match(/window\.GLASS=(\{.*?\}) *;\n/s); log('GLASS '+(g?g[1].slice(0,400):'?'));
  $('frame').style.display='block'; $('frame').src=json.animation_url; log('the plate is in the frame','ok'); rec('lastTokenURIBytes',uri.length); });
</script></body></html>'''
out=HTML.replace('__ARTS__',json.dumps(arts)).replace('__CHUNKS__',json.dumps(chunks)).replace('__MAN__',json.dumps({k:v for k,v in man.items() if k!='chunks'}))
ETH=open(os.path.join(ROOT,'stormglass','node_modules','ethers','dist','ethers.umd.min.js')).read(); assert '</script' not in ETH and '/*ETHERS*/' not in ETH
out=out.replace('<script>/*ETHERS*/</script>','<script>/* ethers 6.17.0, pinned in the page: sha256 '+hashlib.sha256(ETH.encode()).hexdigest()+' */\n'+ETH+'\n</script>',1)
out=out.replace('__COATSHA__',man['coat_sha256']).replace('__COATBYTES__',str(man['coat_bytes'])).replace('__NCHUNKS__',str(len(chunks))).replace('__NBATCH__',str((len(chunks)+1)//2))
out=out.replace('__SHA_S__',srcsha['STORMGLASS'][:16]).replace('__SHA_G__',srcsha['GLASS'][:16]).replace('__SHA_C__',srcsha['Coats'][:16])
dst=os.path.join(ROOT,'glass','deploy','index.html'); os.makedirs(os.path.dirname(dst),exist_ok=True)
tmp=dst+'.tmp'; open(tmp,'w').write(out); os.replace(tmp,dst)
print('deploy page', dst, len(out), 'bytes')
