"""THE GIFT DEPLOY PAGE (v2). One html file carrying the compiled GIFT artifact, the renderer (sw.js, for VERIFY only)
and a 96 set (tools/gift/loops/<set>/, built by mk96.py from the approved loops), laying them on a chain from the
browser: a burner key for a rehearsal network (Hoodi), MetaMask for mainnet (he clicks; the page never holds a mainnet key).
Usage: python3 mkdeploy.py final96     Out: gift/deploy/index.html"""
import json, os, sys, hashlib, base64
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SET = sys.argv[1]
ART = os.path.join(ROOT, 'smallweather', 'artifacts', 'contracts', 'GIFT.sol')
a = json.load(open(os.path.join(ART, 'GIFT.json')))
dbg = json.load(open(os.path.join(ART, 'GIFT.dbg.json')))
bi = json.load(open(os.path.normpath(os.path.join(ART, dbg['buildInfo']))))
assert bi['solcLongVersion'] == '0.8.24+commit.e11b9ed9', bi['solcLongVersion']
st = bi['input']['settings']; assert st['optimizer'] == {'enabled': True, 'runs': 800} and st['evmVersion'] == 'cancun' and st['viaIR'] is True
ev = bi['output']['contracts'][a['sourceName']]['GIFT']['evm']['deployedBytecode']
assert '0x' + ev['object'] == a['deployedBytecode']
imm = [[r['start'], r['length']] for refs in ev.get('immutableReferences', {}).values() for r in refs]
ART_OUT = {'abi': a['abi'], 'bytecode': a['bytecode'], 'runtime': a['deployedBytecode'], 'imm': imm}
man = json.load(open(os.path.join(HERE, 'loops', SET, 'manifest.json')))
loops = []
for e in man['loops']:
    b = open(os.path.join(HERE, 'loops', SET, e['file']), 'rb').read()
    assert hashlib.sha256(b).hexdigest() == e['sha256'], 'loop %d is not the file mk96 made' % e['id']
    assert e['closed'], 'loop %d fails closure' % e['id']
    sc = e['sky'] | e['land'] << 8 | e['weather'] << 16 | e['pair'] << 24 | e['thin'] << 32
    loops.append({'id': e['id'], 'holder': e['holder'], 'handle': e.get('handle', ''), 'sha256': e['sha256'], 'approved': e['approved_sha256'], 'scene': sc,
                  'sky': man['skies'][e['sky']], 'land': man['lands'][e['land']], 'weather': man['weathers'][e['weather']], 'pair': e['pair'], 'thin': e['thin'],
                  'bytes': len(b), 'b64': base64.b64encode(b).decode()})
SWJS = open(os.path.join(HERE, 'sw.js')).read()
assert '</script' not in SWJS.lower()
srcsha = hashlib.sha256(open(os.path.join(ROOT, 'smallweather', 'contracts', 'GIFT.sol'), 'rb').read()).hexdigest()

HTML = r'''<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>SMALL WEATHER · DEPLOY</title>
<style>
  :root{--bg:#08080a;--ink:#e8e8ec;--mut:#8a8a94;--acc:#c8ff3a;--bad:#ff5a5a;--hair:#26262c}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:13px/1.55 ui-monospace,Menlo,Consolas,monospace;padding:20px;max-width:1080px}
  h1{font-size:14px;letter-spacing:.22em;margin:0 0 4px} h2{font-size:11px;letter-spacing:.2em;color:var(--mut);margin:26px 0 8px;border-bottom:1px solid var(--hair);padding-bottom:6px}
  button{font:inherit;background:none;color:var(--ink);border:1px solid var(--ink);padding:7px 12px;cursor:pointer;margin:4px 6px 4px 0;letter-spacing:.06em}
  button:disabled{opacity:.35;cursor:default} button.prime{border-color:var(--acc);color:var(--acc)}
  input,select{font:inherit;background:#0f0f13;color:var(--ink);border:1px solid var(--hair);padding:6px 8px;min-width:0;max-width:100%}
  label{color:var(--mut);font-size:11px;letter-spacing:.14em;display:block;margin-top:8px}
  #log{white-space:pre-wrap;background:#0f0f13;border:1px solid var(--hair);padding:10px;min-height:120px;max-height:420px;overflow:auto;font-size:12px}
  .ok{color:var(--acc)} .bad{color:var(--bad)} .row{display:flex;gap:18px;flex-wrap:wrap;align-items:end}
  textarea{width:100%;min-height:80px;font:inherit;background:#0f0f13;color:var(--ink);border:1px solid var(--hair)}
  table{border-collapse:collapse;width:100%;font-size:12px} td,th{border-bottom:1px solid var(--hair);padding:6px 6px;text-align:left;vertical-align:middle}
  th{color:var(--mut);font-weight:500;letter-spacing:.12em;font-size:10px}
  td img{width:72px;height:72px;image-rendering:pixelated;display:block}
  #shown{width:480px;max-width:100%;image-rendering:pixelated}
  td input{width:100%;min-width:300px}
  #shown{width:480px;max-width:100%;image-rendering:pixelated;display:none;margin-top:8px}
</style></head><body>
<h1>DITHERVOID // SMALL WEATHER · THE DEPLOY</h1>
<div style="color:var(--mut)">Compiler pinned: solc 0.8.24+commit.e11b9ed9 · cancun · optimizer 800 · viaIR. GIFT.sol (v2) sha256 __SRCSHA__. Loop set <b>__SET__</b>: __NLOOPS__ loops at their 96 grid, each made by mk96.py from the approved file. Each token's image is an SVG of its loop with hard pixels. VERIFY redraws every approved file with the renderer (sw.js __SWSHA__) from what the chain holds.</div>

<h2>1 · THE CHAIN AND THE SIGNER</h2>
<div class="row">
  <div><label>NETWORK</label><select id="net"><option value="hoodi">Hoodi (rehearsal, mainnet rules)</option><option value="sepolia">Sepolia (Glamsterdam rules: laying costs ~7x, use Hoodi)</option>__MAINNET_OPT__</select></div>
  <div><label>RPC (burner only)</label><input id="rpc" style="min-width:320px"></div>
</div>
<div class="row">
  <div><label>SIGNER</label><select id="signer"><option value="burner">Burner key kept in this browser (rehearsal networks only)</option><option value="mm">MetaMask (you click; the page never sees a key)</option></select></div>
  <button id="connect">CONNECT</button>
</div>
<div id="who" style="margin-top:8px;color:var(--mut)"></div>

<h2>2 · THE LOOPS AND THEIR HOLDERS</h2>
<div style="color:var(--mut)">On a rehearsal network a holder can be changed (bind a loop to the burner or to a second address of yours to test the claim). On mainnet the holders are the approved ones and cannot be edited.</div>
<div style="color:var(--mut)">On a rehearsal network bind one or two loops to the burner to walk the claim; the picture is the laid loop either way.</div>
<table><thead><tr><th>ID</th><th>LOOP</th><th>HOLDER</th><th>SCENE</th><th>BYTES</th><th>SHA256</th><th>ON CHAIN</th></tr></thead><tbody id="rows"></tbody></table>

<h2>3 · THE DEPLOY, IN ORDER</h2>
<button id="s1" class="prime">a · DEPLOY GIFT</button>
<button id="s2">b · SET GIFTS (batches under 12M gas, resumes)</button>
<div class="row"><div><label>CLAIM DEADLINE (UTC; empty = 7 days after you press SEAL; after it the airdrop of unclaimed loops opens)</label><input id="deadline" type="datetime-local"></div><button id="s3">c · SEAL</button></div>
<button id="s4">d · VERIFY</button>
<div class="row" style="margin-top:6px"><div><label>GIFT</label><input id="aGift" style="min-width:420px"></div></div>

<h2>4 · THE WALK</h2>
<div class="row">
  <button id="w1">CLAIM (as the connected signer)</button>
  <button id="w2">AIRDROP UNCLAIMED</button>
  <button id="w3">STATE</button>
  <div><label>TOKEN ID</label><input id="tid" value="1" style="width:80px"></div><button id="w4">READ tokenURI: THE IMAGE</button>
</div>
<div id="meta" style="color:var(--mut);margin-top:6px"></div>
<div class="row" style="align-items:start"><div><label>IMAGE (the SVG, as a marketplace shows it)</label><img id="shown" alt=""></div></div>

<h2>THE RECORD</h2>
<textarea id="record" placeholder="filled as things land"></textarea>
<h2>LOG</h2>
<div id="log"></div>

<script>/*ETHERS*/</script>
<script>/*SW*/</script>
<script>
const ART=__ART__;
const LOOPS=__LOOPS__;
const SET=__SETJS__;   /* the loop set this page was built from; mainnet exists only on a page built from 'final' */
const ARTIST='0x0DD399a7ED92283e4983C2974FE377070D67f4eB';
const RPC={sepolia:'https://ethereum-sepolia-rpc.publicnode.com',hoodi:'https://ethereum-hoodi-rpc.publicnode.com',mainnet:'https://ethereum-rpc.publicnode.com'};
const CHAIN={sepolia:11155111n,hoodi:560048n,mainnet:1n}, NAME={sepolia:'Sepolia',hoodi:'Hoodi',mainnet:'Ethereum mainnet'};
const $=id=>document.getElementById(id);
const log=(m,c)=>{ const e=$('log'); const d=document.createElement('div'); if(c)d.className=c; d.textContent=new Date().toISOString().slice(11,19)+'  '+m; e.appendChild(d); e.scrollTop=e.scrollHeight; };
const REC={}; const rec=(k,v)=>{ REC[k]=v; $('record').value=JSON.stringify(REC,null,1); };
const hex=u=>Array.from(u).map(b=>b.toString(16).padStart(2,'0')).join('');
const sha=async u=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',u)));
const bytesOf=L=>Uint8Array.from(atob(L.b64),c=>c.charCodeAt(0));
let provider=null, signer=null, net='hoodi', KEY=null;

/* the table */
for(const L of LOOPS){
  const tr=document.createElement('tr');
  tr.innerHTML='<td>'+L.id+'</td><td><img src="data:image/gif;base64,'+L.b64+'"></td><td><input id="h'+L.id+'" value="'+L.holder+'"><div style="color:var(--mut);font-size:10px">'+(L.handle||'')+'</div></td><td style="font-size:10px">'+L.sky+' / '+L.land+' / '+L.weather+'<br>ink '+L.pair+' · thin '+L.thin+'</td><td>'+L.bytes+'</td><td style="font-size:10px">'+L.sha256.slice(0,16)+'…</td><td id="c'+L.id+'">·</td>';
  $('rows').appendChild(tr);
}
(async()=>{ let bad=0; for(const L of LOOPS){ if(await sha(bytesOf(L))!==L.sha256){ bad++; log('loop '+L.id+' in this page does not match its sha256: do not deploy','bad'); } }
  if(!bad) log('all '+LOOPS.length+' loops match their sha256','ok'); })();
const holderOf=L=>{ const v=$('h'+L.id).value.trim(); if(!ethers.isAddress(v)) throw new Error('holder of loop '+L.id+' is not an address'); return ethers.getAddress(v); };

$('net').addEventListener('change',()=>{ net=$('net').value; $('aGift').value=''; signer=null; $('who').textContent='network changed: CONNECT';
  $('rpc').value=RPC[net];
  for(const L of LOOPS){ const i=$('h'+L.id); if(net==='mainnet'){ i.value=L.holder; i.disabled=true; } else i.disabled=false; }
  if(net==='mainnet') $('signer').value='mm'; });
$('net').dispatchEvent(new Event('change'));
/* the deadline stays empty unless he types one: SEAL then uses 7 days from the moment it is pressed */

async function connect(){
  net=$('net').value;
  if(net==='mainnet'&&SET!=='final96'){ signer=null; log('this page was built from the "'+SET+'" set: mainnet is only possible on a page built from the final96 set (mkdeploy.py final96)','bad'); return; }
  if($('signer').value==='burner'){
    if(net==='mainnet'){ log('a burner is for the rehearsal networks only','bad'); return; }
    let k=localStorage.getItem('smallweather_burner'); if(!k){ k=ethers.Wallet.createRandom().privateKey; localStorage.setItem('smallweather_burner',k); log('a burner key was made and kept in this browser'); }
    provider=new ethers.JsonRpcProvider($('rpc').value,undefined,{cacheTimeout:-1});
    const cid=(await provider.getNetwork()).chainId; if(cid!==CHAIN[net]&&cid!==31337n){ provider=null; signer=null; log('the burner is for '+NAME[net]+' and this RPC is chain '+cid+': nothing will be sent','bad'); return; }
    signer=new ethers.Wallet(k,provider);
  } else {
    if(!window.ethereum){ log('no wallet in this browser','bad'); return; }
    provider=new ethers.BrowserProvider(window.ethereum); await provider.send('eth_requestAccounts',[]);
    const want=CHAIN[net];
    if((await provider.getNetwork()).chainId!==want){
      try{ await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x'+want.toString(16)}]}); }
      catch(e){
        if(net==='hoodi'&&(e.code===4902||(e.data&&e.data.originalError&&e.data.originalError.code===4902))){   /* the wallet does not know Hoodi yet: offer it */
          try{ await window.ethereum.request({method:'wallet_addEthereumChain',params:[{chainId:'0x88bb0',chainName:'Hoodi',nativeCurrency:{name:'Hoodi ETH',symbol:'ETH',decimals:18},rpcUrls:[RPC.hoodi],blockExplorerUrls:['https://hoodi.etherscan.io']}]}); }
          catch(e2){ signer=null; log('add Hoodi to the wallet and CONNECT again','bad'); return; }
        } else { signer=null; log('switch the wallet to '+NAME[net]+' and CONNECT again','bad'); return; } }
      provider=new ethers.BrowserProvider(window.ethereum);
      if((await provider.getNetwork()).chainId!==want){ signer=null; log('the wallet is not on '+net+': nothing will be sent','bad'); return; }
    }
    signer=await provider.getSigner();
    if(!window.__chainWatch){ window.__chainWatch=1; window.ethereum.on&&window.ethereum.on('chainChanged',()=>{ signer=null; $('who').textContent='the wallet changed network: CONNECT again'; log('the wallet changed network: CONNECT again before anything else','bad'); }); }
  }
  const addr=await signer.getAddress(); const n=await provider.getNetwork(); const b=await provider.getBalance(addr);
  $('who').textContent='signer '+addr+' · chain '+n.chainId+' · balance '+ethers.formatEther(b)+' ETH';
  if(net==='mainnet'&&addr.toLowerCase()!==ARTIST.toLowerCase()) log('on mainnet the signer must be greencross.eth '+ARTIST+': DEPLOY, SET and SEAL will refuse','bad');
  rec('signer',addr); rec('chainId',String(n.chainId));
  KEY='smallweather_gift_'+SET+'_'+n.chainId; let saved=null; try{ saved=localStorage.getItem(KEY); }catch(e){}
  if(saved&&!$('aGift').value){ $('aGift').value=saved; log('restored the GIFT deployed earlier from this browser on this chain: '+saved,'ok'); }
  log('connected: '+addr+' on chain '+n.chainId+', '+ethers.formatEther(b)+' ETH','ok');
}
$('connect').addEventListener('click',()=>connect().catch(e=>log(String(e.message||e),'bad')));
const need=()=>{ if(!signer) throw new Error('CONNECT first (on the network chosen above)'); return signer; };
const G=()=>new ethers.Contract($('aGift').value,ART.abi,need());
const artistOnly=async()=>{ if(net==='mainnet'&&(await need().getAddress()).toLowerCase()!==ARTIST.toLowerCase()) throw new Error('mainnet: only greencross.eth signs this'); };
/* THE PAD: estimate x1.5 + 60k, at least 250k, at most 15M (a smart-account wallet, EIP-7702, estimates short) */
async function pad(m,args,ov={}){ const g=await m.estimateGas(...args,ov); let L=g*3n/2n+60000n; if(L<250000n) L=250000n; if(L>15000000n) L=15000000n; if(L<g) throw new Error('estimate '+g+' is over the 15M cap'); return m(...args,{...ov,gasLimit:L}); }
async function txlog(name,tx){ log(name+' sent '+tx.hash); const rc=await tx.wait(); log(name+' mined in block '+rc.blockNumber+', gas '+rc.gasUsed,'ok'); return rc; }
let BUSY=false; const BTNS=()=>Array.from(document.querySelectorAll('button'));
/* ONE ACTION AT A TIME: every button is disabled while a transaction or read is in flight, so a second click can never send a second transaction */
const act=(id,fn)=>$(id).addEventListener('click',async()=>{ if(BUSY) return; BUSY=true; BTNS().forEach(b=>b.disabled=true); try{ await fn(); }catch(e){ log(String(e.reason||e.shortMessage||e.message||e),'bad'); } finally{ BUSY=false; BTNS().forEach(b=>b.disabled=false); } });

act('s1',async()=>{ await artistOnly();
  if($('aGift').value.trim()) throw new Error('a GIFT is already set ('+$('aGift').value.trim()+'): this page will not deploy a second one; clear the GIFT field on purpose to deploy again');
  if(net==='mainnet'&&!confirm('Deploy SMALL WEATHER on Ethereum mainnet now? (loop set "'+SET+'", '+LOOPS.length+' loops)')) return;
  const f=new ethers.ContractFactory(ART.abi,ART.bytecode,need());
  const dtx=await f.getDeployTransaction(); const g=await provider.estimateGas({...dtx,from:await signer.getAddress()});
  let L=g*3n/2n+60000n; if(L<250000n) L=250000n; if(L>15000000n) L=15000000n;
  const c=await f.deploy({gasLimit:L}); log('GIFT sent '+c.deploymentTransaction().hash); await c.waitForDeployment();
  $('aGift').value=await c.getAddress(); try{ localStorage.setItem(KEY,$('aGift').value); }catch(e){} rec('gift',$('aGift').value); rec('deployTx',c.deploymentTransaction().hash); log('GIFT at '+$('aGift').value,'ok');
});
async function laidOk(c,L){ const h=holderOf(L), onH=await c.holderOf(L.id); if(onH.toLowerCase()!==h.toLowerCase()) return false;
  try{ return (await c.gifHash(L.id)).slice(2)===L.sha256 && BigInt(await sceneOf(c,L.id))===BigInt(L.scene); }catch(e){ return false; } }
async function sceneOf(c,id){ const s=await c.sceneOf(id); return BigInt(s[0])|BigInt(s[1])<<8n|BigInt(s[2])<<16n|BigInt(s[3])<<24n|BigInt(s[4])<<32n; }
act('s2',async()=>{ await artistOnly(); const c=G();
  if(await c.isSealed()) throw new Error('sealed: nothing can be laid');
  const todo=[]; for(const L of LOOPS){ if(await laidOk(c,L)){ log('loop '+L.id+' already laid: skipped'); $('c'+L.id).textContent='laid'; } else todo.push(L); }
  let i=0, nb=0;
  while(i<todo.length){
    /* the batch: as many loops as fit under 12M gas by the node's own estimate */
    let n=1; while(i+n<todo.length){ const s=todo.slice(i,i+n+1); let g;
      try{ g=await c.setGifts.estimateGas(s.map(holderOf),s.map(L=>L.id),s.map(L=>L.scene),s.map(bytesOf)); }catch(e){ break; }
      if(g>12000000n) break; n++; }
    const s=todo.slice(i,i+n); nb++;
    if(net==='mainnet'&&!confirm('Batch '+nb+': lay loops '+s.map(L=>L.id).join(', ')+' ('+s.reduce((a,L)=>a+L.bytes,0)+' bytes) for their holders?')) return;
    await txlog('setGifts ['+s.map(L=>L.id).join(',')+']',await pad(c.setGifts,[s.map(holderOf),s.map(L=>L.id),s.map(L=>L.scene),s.map(bytesOf)]));
    for(const L of s){ $('c'+L.id).textContent='laid'; rec('laid_'+L.id,holderOf(L)); }
    i+=n;
  }
  log('all '+LOOPS.length+' loops laid','ok');
});
act('s3',async()=>{ await artistOnly(); const c=G();
  const chainNow=Number((await provider.getBlock('latest')).timestamp);   /* the chain's clock, not this computer's */
  const dl=$('deadline').value?Math.floor(new Date($('deadline').value+':00Z').getTime()/1000):chainNow+7*86400; if(!(dl>chainNow+600)) throw new Error('the deadline must be at least 10 minutes after the chain\'s current time ('+new Date(chainNow*1000).toISOString()+')');
  for(const L of LOOPS){ if(!(await laidOk(c,L))) throw new Error('loop '+L.id+' is not laid (or differs): run b first'); }
  if(!confirm('SEAL: after this no loop can be added or changed. Deadline '+new Date(dl*1000).toISOString()+'. Seal now?')) return;
  await txlog('seal',await pad(c.seal,[dl])); rec('deadline',dl);
});
act('s4',async()=>{ const c=G(); let all=true;
  /* THE CODE: byte for byte the compiled code, the immutable ARTIST masked, and ARTIST read back */
  const live=ethers.getBytes(await provider.send('eth_getCode',[$('aGift').value,'latest'])), want=ethers.getBytes(ART.runtime);
  let same=live.length===want.length; if(same){ const m=new Uint8Array(live.length); for(const [st,len] of ART.imm) for(let i=st;i<st+len;i++) m[i]=1; for(let i=0;i<live.length;i++) if(!m[i]&&live[i]!==want[i]){ same=false; break; } }
  log('code on chain '+(same?'MATCHES':'DIFFERS FROM')+' the compiled code ('+live.length+' bytes)',same?'ok':'bad'); all=all&&same;
  const artist=await c.ARTIST(); log('ARTIST '+artist+(net==='mainnet'?(artist.toLowerCase()===ARTIST.toLowerCase()?' = greencross.eth':' IS NOT greencross.eth'):''),(net!=='mainnet'||artist.toLowerCase()===ARTIST.toLowerCase())?'ok':'bad');
  if(net==='mainnet') all=all&&artist.toLowerCase()===ARTIST.toLowerCase();
  /* THE RENDERER (sw.js, in this page): from the chain's scene and the real holder's seed it must redraw the approved file */
  const R=window.SW, pgOk=true;
  const hx3=h=>[parseInt(h.substr(1,2),16),parseInt(h.substr(3,2),16),parseInt(h.substr(5,2),16)];
  for(const L of LOOPS){
    const h=holderOf(L), onH=await c.holderOf(L.id);
    const got=ethers.getBytes(await c.gif(L.id)); const s=await sha(got);
    const scOk=BigInt(await sceneOf(c,L.id))===BigInt(L.scene);
    const ok=onH.toLowerCase()===h.toLowerCase()&&s===L.sha256&&scOk&&(await c.giftOf(h))===BigInt(L.id);
    let drawn='';
    if(pgOk){ const sc=await c.sceneOf(L.id), P=R.PAIRS[Number(sc[3])], pal=[hx3(P[1]),hx3(P[2])]; const fr=R.frames(ethers.keccak256(L.holder),R.SKIES[Number(sc[0])],R.LANDS[Number(sc[1])],R.WEATHERS[Number(sc[2])],Number(sc[4]),40);
      const a=await sha(R.gif(fr,pal,4,5)), b=await sha(R.gif(fr,pal,4,1)); drawn=(a===L.approved&&b===L.sha256)?' · the renderer redraws the APPROVED file':' · RENDERER DIFFERS'; all=all&&a===L.approved&&b===L.sha256; }
    log('loop '+L.id+': holder '+onH+' · scene '+(scOk?'ok':'WRONG')+' · read back '+got.length+' bytes sha '+s.slice(0,16)+(ok?' MATCHES':' DOES NOT MATCH')+drawn,ok&&!/DIFFERS/.test(drawn)?'ok':'bad');
    $('c'+L.id).textContent=ok?'verified':'MISMATCH'; all=all&&ok;
  }
  const sealed=await c.isSealed(), dl=await c.deadline(), n=await c.gifts();
  log('sealed '+sealed+' · deadline '+(dl?new Date(Number(dl)*1000).toISOString():'-')+' · gifts '+n+' (page '+LOOPS.length+') · minted '+(await c.minted()), (Number(n)===LOOPS.length)?'ok':'bad');
  all=all&&Number(n)===LOOPS.length;
  rec('verified',{code:same,loops:all,sealed}); log(all?'VERIFY: ALL GREEN':'VERIFY: SOMETHING DIFFERS, stop',all?'ok':'bad');
});
act('w1',async()=>{ const c=G(); const me=await need().getAddress(); const id=await c.giftOf(me); if(id===0n) throw new Error('no loop is bound to '+me);
  await txlog('claim #'+id,await pad(c.claim,[])); log('owner of #'+id+': '+(await c.ownerOf(id)),'ok'); });
act('w2',async()=>{ await artistOnly(); const c=G(); const ids=[]; for(const L of LOOPS){ if(!(await c.isClaimed(L.id))) ids.push(L.id); }
  if(!ids.length){ log('every loop is claimed','ok'); return; }
  if(!confirm('Airdrop '+ids.length+' unclaimed loop(s) to their holders: '+ids.join(', ')+'?')) return;
  await txlog('airdropUnclaimed',await pad(c.airdropUnclaimed,[ids])); });
act('w3',async()=>{ const c=G(); log('sealed '+(await c.isSealed())+' deadline '+(await c.deadline())+' gifts '+(await c.gifts())+' minted '+(await c.minted())+' now '+Math.floor(Date.now()/1000));
  for(const L of LOOPS){ const cl=await c.isClaimed(L.id); log('#'+L.id+' holder '+(await c.holderOf(L.id))+' · '+(cl?'claimed by '+(await c.ownerOf(L.id)):'unclaimed')); } });
act('w4',async()=>{ const uri=await G().tokenURI(BigInt($('tid').value)); const j=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(uri.slice('data:application/json;base64,'.length)),c=>c.charCodeAt(0))));
  $('meta').textContent=j.name+' · '+j.description+' · '+JSON.stringify(j.attributes);
  const svg=atob(j.image.slice('data:image/svg+xml;base64,'.length)); const g=Uint8Array.from(atob(svg.match(/base64,([^"]+)"/)[1]),c=>c.charCodeAt(0)); const s=await sha(g);
  const L=LOOPS.find(x=>x.id===Number($('tid').value)); log('tokenURI image: an SVG holding a '+g.length+'-byte GIF, sha '+s.slice(0,16)+(L&&s===L.sha256?' = the laid loop':' (no match in this page)'),L&&s===L.sha256?'ok':'bad');
  $('shown').src=j.image; $('shown').style.display='block'; rec('lastTokenURIChars',uri.length); });
</script></body></html>'''
out = HTML.replace('__ART__', json.dumps(ART_OUT)).replace('__LOOPS__', json.dumps(loops))
MAINNET_OPT = ('<option value="mainnet">Ethereum mainnet (set final96, %d loops)</option>' % len(loops)) if SET == 'final96' \
    else '<option value="mainnet" disabled>Ethereum mainnet (only on a page built from the final96 set)</option>'
out = out.replace('__MAINNET_OPT__', MAINNET_OPT).replace('__SETJS__', json.dumps(SET))
ETH = open(os.path.join(ROOT, 'smallweather', 'node_modules', 'ethers', 'dist', 'ethers.umd.min.js')).read()
assert '</script' not in ETH and '/*ETHERS*/' not in ETH
ver = json.load(open(os.path.join(ROOT, 'smallweather', 'node_modules', 'ethers', 'package.json')))['version']
out = out.replace('<script>/*SW*/</script>', '<script>/* the renderer, tools/gift/sw.js */\n' + SWJS + '\n</script>', 1)
out = out.replace('<script>/*ETHERS*/</script>', '<script>/* ethers ' + ver + ', pinned in the page: sha256 ' + hashlib.sha256(ETH.encode()).hexdigest() + ' */\n' + ETH + '\n</script>', 1)
out = out.replace('__SRCSHA__', srcsha[:16]).replace('__SET__', SET).replace('__NLOOPS__', str(len(loops))).replace('__SWSHA__', hashlib.sha256(SWJS.encode()).hexdigest()[:16])
dst = os.path.join(ROOT, 'gift', 'deploy', 'index.html'); os.makedirs(os.path.dirname(dst), exist_ok=True)
tmp = dst + '.tmp'; open(tmp, 'w').write(out); os.replace(tmp, dst)
print('deploy page', dst, len(out), 'bytes, set', SET, len(loops), 'loops')
