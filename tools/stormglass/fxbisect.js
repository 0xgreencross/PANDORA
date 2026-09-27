/* FX BISECT: renders the guest loop for a seed with the roll's own job, then with each active effect
   switched off in turn (and with a corr cap), and reports per variant the worst single-frame jump
   (max step / median step) and the emptiest frame (min cover / median cover). Q env (seed=..), N env. */
const {chromium}=require('playwright');
(async()=>{
  const F=process.env.FILE||'workbench/v5_2/index.html', N=+(process.env.N||36);
  const br=await chromium.launch({args:['--no-sandbox']});
  const pg=await (await br.newContext({viewport:{width:1300,height:900}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await pg.goto('http://127.0.0.1:8931/'+F+'?'+(process.env.Q||'seed=1')); await pg.waitForTimeout(1200);
  await pg.evaluate(()=>{ window.__render=(J)=>new Promise((res,rej)=>{
      const url=URL.createObjectURL(new Blob([v3WorkerSrc(160)],{type:'text/javascript'}));
      const w=new Worker(url); const frames=new Array(J.N); let k=0, i=0;
      w.onmessage=e=>{ const m=e.data; if(m.t==='err'){ rej(m.msg); return; } if(m.t!=='pv') return;
        frames[m.i]=new Uint8Array(m.buf); k++; if(k>=J.N){ w.terminate(); res(frames); return; }
        i++; w.postMessage({t:'job',step:true,job:Object.assign({},J,{__i:i})}); };
      w.onerror=e=>rej(String(e.message||e)); w.postMessage({t:'job',step:true,job:Object.assign({},J,{__i:0})}); });
    window.__stats=(fr)=>{ const Nn=fr.length; const diff=(a,b)=>{ let n=0; for(let q=0;q<a.length;q++) if(a[q]!==b[q]) n++; return n/a.length; };
      const d=[]; for(let q=0;q<Nn;q++) d.push(diff(fr[q],fr[(q+1)%Nn])); const sd=[...d].sort((a,b)=>a-b), med=sd[(Nn/2)|0];
      const cnt=new Map(); for(const v of fr[0]) cnt.set(v,(cnt.get(v)||0)+1); let bg=0,bc=0; for(const [kk,v] of cnt) if(v>bc){bc=v;bg=kk;}
      const cov=fr.map(f=>{ let n=0; for(const v of f) if(v!==bg) n++; return n/f.length; }); const sc=[...cov].sort((a,b)=>a-b), mc=sc[(Nn/2)|0];
      let worst=0,wf=-1; for(let q=0;q<Nn;q++) if(d[q]>worst){worst=d[q];wf=q;} let emp=1,ef=-1; for(let q=0;q<Nn;q++) if(cov[q]<emp){emp=cov[q];ef=q;}
      return {jump:+(worst/med).toFixed(2), jumpAt:wf, wrap:+(d[Nn-1]/med).toFixed(2), empty:+(emp/(mc||1)).toFixed(2), emptyAt:ef}; }; });
  const base=await pg.evaluate(async(N)=>{ const R=resolve(); const J=v3JobFor(R,N,''); const fr=await __render(J); const on=Object.keys(J.fx).filter(k=>J.fx[k]); return {J:{mode:J.mode,corr:J.corr,void:J.voidamt,ver:J.ver,on}, s:__stats(fr)}; }, N);
  console.log('BASE', JSON.stringify(base));
  for(const k of base.J.on){ const r=await pg.evaluate(async([N,k])=>{ const R=resolve(); const J=v3JobFor(R,N,''); J.fx=Object.assign({},J.fx,{[k]:false}); return __stats(await __render(J)); }, [N,k]); console.log('OFF', k, JSON.stringify(r)); }
  for(const v of [['void0',J=>{J.voidamt=0;}],['corr0',J=>{J.corr=0;}],['void0corr0',J=>{J.voidamt=0;J.corr=0;}],['allfxoff',J=>{for(const k in J.fx)J.fx[k]=false;}],['allfxoff_void0_corr0',J=>{for(const k in J.fx)J.fx[k]=false;J.voidamt=0;J.corr=0;}],['loc0',J=>{J.locality=0;}]]){
    const r=await pg.evaluate(async([N,src])=>{ const R=resolve(); const J=v3JobFor(R,N,''); (new Function('J',src))(J); return __stats(await __render(J)); }, [N, v[1].toString().replace(/^J=>\{|\}$/g,'')]); console.log('VAR', v[0], JSON.stringify(r)); }
  for(const c of [55,35]){ const r=await pg.evaluate(async([N,c])=>{ const R=resolve(); const J=v3JobFor(R,N,''); J.corr=Math.min(J.corr,c); return __stats(await __render(J)); }, [N,c]); console.log('CORR', c, JSON.stringify(r)); }
  console.log('errors:', errs.length?errs.join(' | '):'none'); await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
