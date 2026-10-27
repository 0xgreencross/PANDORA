/* THE VALIDATION RITUAL for the STORMGLASS page (CLAUDE.md): every inline <script> through `node --check`, the id audit
   ($('x') refs vs id="x"), and a vm smoke test with a Proxy-stub DOM (demo mode, no network, no wallet).
   usage: node tools/stormglass/wallet-tests/ritual.js [path/to/index.html]   (NODE_PATH must reach ethers) */
const fs=require('fs'), path=require('path'), os=require('os'), vm=require('vm'), {execFileSync}=require('child_process');
const file=process.argv[2]||path.join(__dirname,'../../../index.html');
const html=fs.readFileSync(file,'utf8');
let fail=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fail++; };

/* 1. extract every inline script and node --check it */
const blocks=[]; const re=/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g; let m;
while((m=re.exec(html))){ if(m[1]&&/\bsrc=/.test(m[1])) continue; blocks.push(m[2]); }
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ritual-'));
blocks.forEach((b,i)=>{ const f=path.join(dir,'block'+i+'.js'); fs.writeFileSync(f,b);
  try{ execFileSync(process.execPath,['--check',f],{stdio:'pipe'}); ok(true,'node --check block '+i+' ('+b.length+' bytes)'); }
  catch(e){ ok(false,'node --check block '+i+': '+String(e.stderr).slice(0,400)); } });

/* 2. the id audit: every $('x') must have an id="x" somewhere (markup, or HTML the script writes) */
const js=blocks.join('\n');
const refs=new Set([...js.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)].map(x=>x[1]));
const ids=new Set([...html.matchAll(/\bid="([A-Za-z0-9_-]+)"/g)].map(x=>x[1]));
const WHITE=new Set([]);
const missing=[...refs].filter(r=>!ids.has(r)&&!WHITE.has(r));
ok(missing.length===0,'id audit: '+refs.size+' $() refs, '+ids.size+' ids'+(missing.length?' · missing: '+missing.join(','):''));
const dup=[...html.matchAll(/<[^>]*\bid="([A-Za-z0-9_-]+)"/g)].map(x=>x[1]).filter((v,i,a)=>a.indexOf(v)!==i);
ok(true,'duplicate literal ids (informational): '+(dup.length?[...new Set(dup)].join(','):'none'));

/* 3. the vm smoke test: a Proxy-stub DOM that answers everything, demo mode, timers run once */
const UMD=(process.env.NODE_PATH||'').split(path.delimiter).filter(Boolean).concat([path.join(__dirname,'../../../node_modules'),'/home/claude/node_modules']).map(p=>path.join(p,'ethers/dist/ethers.umd.min.js')).find(f=>fs.existsSync(f));
const ethersSrc=fs.readFileSync(UMD,'utf8');
const errors=[];
function stub(name){ const f=function(){}; const kids=[];
  return new Proxy(f,{ get(t,k){ if(k===Symbol.iterator) return function*(){}; if(k===Symbol.toPrimitive) return ()=>''; if(k==='children'||k==='childNodes') return kids;
      if(k==='then') return undefined; if(k==='classList') return {add(){},remove(){},toggle(){},contains(){return false}};
      if(k==='dataset'||k==='style') return t[k]||(t[k]={}); if(k in t&&k!=='name'&&k!=='length') return t[k];
      if(k==='value'||k==='textContent'||k==='innerHTML'||k==='innerText') return t['_'+k]||'';
      if(k==='querySelectorAll') return ()=>[]; if(k==='querySelector'||k==='closest') return ()=>null; if(k==='getClientRects') return ()=>[];
      if(k==='offsetWidth'||k==='offsetHeight'||k==='clientWidth'||k==='clientHeight'||k==='scrollHeight') return 400;
      return stub(name+'.'+String(k)); },
    set(t,k,v){ if(k==='value'||k==='textContent'||k==='innerHTML'||k==='innerText') t['_'+k]=String(v); else t[k]=v; return true; },
    apply(){ return stub(name+'()'); }, construct(){ return stub('new '+name); } }); }
const els=new Map(); const el=id=>{ if(!els.has(id)) els.set(id,stub('#'+id)); return els.get(id); };
const store=new Map();
const timers=[]; let tid=0;
const ctx={ console:{log(){},warn(){},error:(...a)=>errors.push('console.error: '+a.map(String).join(' ').slice(0,200)),info(){}},
  location:{search:'?demo=day',hash:'',host:'127.0.0.1',pathname:'/',origin:'http://127.0.0.1',href:'http://127.0.0.1/?demo=day',replace(){}},
  navigator:{userAgent:'Mozilla/5.0 (X11; Linux x86_64) Chrome/140',maxTouchPoints:0,clipboard:{writeText:async()=>{}}},
  localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),key:()=>null,length:0},
  matchMedia:()=>({matches:false,addEventListener(){}}), innerWidth:1440, innerHeight:900, scrollX:0, scrollY:0, devicePixelRatio:1,
  setTimeout:(f,ms)=>{ const h=setTimeout(()=>{ try{ const r=f(); if(r&&r.catch) r.catch(e=>errors.push('timer: '+String(e).slice(0,200))); }catch(e){ errors.push('timer: '+String(e).slice(0,200)); } },Math.min(ms||0,40)); h.unref(); return ++tid; }, clearTimeout(){}, setInterval:()=>++tid, clearInterval(){},
  requestAnimationFrame:f=>{ const h=setTimeout(f,16); h.unref(); return ++tid; }, cancelAnimationFrame(){},
  fetch:async u=>({ok:true,status:200,text:async()=>'<html><body class="glass"></body></html>',json:async()=>({}),arrayBuffer:async()=>new ArrayBuffer(0)}), Image:class{ set src(v){ this._s=v; } }, URL, URLSearchParams, TextEncoder, TextDecoder, Blob:class{}, Event:class{ constructor(t){ this.type=t; } }, CustomEvent:class{ constructor(t,o){ this.type=t; this.detail=o&&o.detail; } },
  NodeFilter:{SHOW_TEXT:4,FILTER_REJECT:2,FILTER_ACCEPT:1}, IntersectionObserver:class{ observe(){} }, ResizeObserver:class{ observe(){} }, MutationObserver:class{ observe(){} },
  performance:{now:()=>Date.now()}, crypto:require('crypto').webcrypto, Math, Date, JSON, Promise, BigInt, Uint8Array, ArrayBuffer, DataView, Number, String, Object, Array, Map, Set, WeakMap, WeakSet, Error, Symbol, Proxy, Reflect, RegExp, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, atob, btoa };
ctx.document=new Proxy({},{ get(t,k){ if(k==='getElementById') return el; if(k==='createElement') return n=>stub('<'+n+'>'); if(k==='createTreeWalker') return ()=>({nextNode:()=>null});
    if(k==='querySelectorAll') return ()=>[]; if(k==='querySelector') return q=>stub('document.querySelector('+q+')'); if(k==='activeElement') return null; if(k==='contains') return ()=>true;
    if(k==='addEventListener'||k==='removeEventListener') return ()=>{}; if(k==='body'||k==='documentElement'||k==='head') return el('<'+k+'>'); if(k in t) return t[k]; return stub('document.'+String(k)); } });
const L=new Map(); ctx.addEventListener=(t,f)=>{ (L.get(t)||L.set(t,[]).get(t)).push(f); }; ctx.removeEventListener=()=>{}; ctx.dispatchEvent=e=>{ (L.get(e.type)||[]).forEach(f=>f(e)); return true; };
ctx.window=ctx; ctx.globalThis=ctx; ctx.self=ctx;
vm.createContext(ctx);
const unhandled=[]; process.on('unhandledRejection',e=>unhandled.push(String(e&&e.stack||e).slice(0,300)));
try{ vm.runInContext(ethersSrc,ctx,{filename:'ethers.umd.min.js'}); ok(typeof ctx.ethers==='object'&&ctx.ethers.version==='6.13.2','vm: ethers '+(ctx.ethers&&ctx.ethers.version)+' loaded'); }catch(e){ ok(false,'vm: ethers load '+e); }
blocks.forEach((b,i)=>{ try{ vm.runInContext(b,ctx,{filename:'block'+i+'.js'}); ok(true,'vm: block '+i+' ran'); }catch(e){ ok(false,'vm: block '+i+' threw '+String(e&&e.stack||e).slice(0,300)); } });
(async()=>{
  setInterval(()=>{},1000);   /* keeps node alive while the page's unref'd timers run */
  setTimeout(()=>{ console.log('FAIL vm: timed out'); process.exit(1); },20000);
  await new Promise(r=>setTimeout(r,1500));   /* the boot: read() in demo mode, render, the timers it starts */
  const fns=vm.runInContext("['connectWallet','send','sheet','wcConnect','noWalletDesk','nxCollect','switchChain','walletLabel','disconnect','walletMenu','chooseWallet'].map(n=>{ let t; try{ t=typeof eval(n); }catch(e){ t='missing'; } return n+':'+t; }).join(' ')",ctx);
  ok(!/missing|undefined/.test(fns),'vm: wallet functions defined · '+fns);
  /* no wallet at all: a write ends at the no-wallet sheet and tells the observer, nothing throws */
  const r=await vm.runInContext("(async()=>{ const seen=[]; await send('witness',W=>{ throw new Error('must not reach the contract'); },p=>seen.push(p)); return seen.join(','); })()",ctx);
  ok(r==='nowallet','vm: send() with no wallet -> observer "'+r+'"');
  const st=vm.runInContext("typeof ST==='object'&&ST&&ST.day?('day '+ST.day.id):'no state'",ctx);
  ok(/day 12/.test(st),'vm: demo boot rendered '+st);
  const real=errors.filter(e=>!/no network in the vm/.test(e));
  ok(real.length===0,'vm: console errors '+(real.length?real.slice(0,5).join(' | '):'none'));
  ok(unhandled.length===0,'vm: unhandled rejections '+(unhandled.length?unhandled.slice(0,3).join(' | '):'none'));
  console.log(fail?('RITUAL FAILED: '+fail):'RITUAL PASSED'); process.exit(fail?1:0);
})();
