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
      const w=new Worker(url); const frames=new Array(J.N); let k=0, i=0, pal=null;
      w.onmessage=e=>{ const m=e.data; if(m.t==='meta'){pal=m.pal;return;} if(m.t==='err'){ rej(m.msg); return; } if(m.t!=='pv') return;
        frames[m.i]=new Uint8Array(m.buf); k++; if(k>=J.N){ w.terminate(); frames.pal=pal; res(frames); return; }
        i++; w.postMessage({t:'job',step:true,job:Object.assign({},J,{__i:i})}); };
      w.onerror=e=>rej(String(e.message||e)); w.postMessage({t:'job',step:true,job:Object.assign({},J,{__i:0})}); });
    window.__stats=(fr)=>{ const pal=fr.pal, W=160,G=16,cs=W/G; const lum=pal.map(c=>(0.299*c[0]+0.587*c[1]+0.114*c[2])/255);
      const grids=fr.map(f=>{ const g=new Float32Array(G*G); for(let y=0;y<W;y++) for(let x=0;x<W;x++) g[((y/cs)|0)*G+((x/cs)|0)]+=lum[f[y*W+x]]/(cs*cs);
        let m=0; for(const v of g) m+=v; m/=g.length; let sd=0; for(const v of g) sd+=(v-m)*(v-m); sd=Math.sqrt(sd/g.length)||1e-6; for(let q=0;q<g.length;q++) g[q]=(g[q]-m)/sd; return g; });
      const Nn=fr.length, d=[]; for(let i=0;i<Nn;i++){ const a=grids[i], b=grids[(i+1)%Nn]; let s=0; for(let q=0;q<G*G;q++) s+=Math.abs(a[q]-b[q]); d.push(s/(G*G)); }
      const sd=[...d].sort((x,y)=>x-y), med=sd[(Nn/2)|0]||1e-9; let worst=0,wf=-1; for(let q=0;q<Nn-1;q++) if(d[q]>worst){worst=d[q];wf=q;}
      return {jump:+(worst/med).toFixed(2), jumpAt:wf, wrap:+(d[Nn-1]/med).toFixed(2), top:d.map((v,i)=>[v,i]).sort((a,b)=>b[0]-a[0]).slice(0,4).map(([v,i])=>i+':'+(v/med).toFixed(1)).join(' ')}; }; });
  const base=await pg.evaluate(async(N)=>{ const R=resolve(); const J=v3JobFor(R,N,''); const fr=await __render(J); const on=Object.keys(J.fx).filter(k=>J.fx[k]); return {J:{mode:J.mode,corr:J.corr,void:J.voidamt,ver:J.ver,on}, s:__stats(fr)}; }, N);
  console.log('BASE', JSON.stringify(base));
  for(const k of base.J.on){ const r=await pg.evaluate(async([N,k])=>{ const R=resolve(); const J=v3JobFor(R,N,''); J.fx=Object.assign({},J.fx,{[k]:false}); return __stats(await __render(J)); }, [N,k]); console.log('OFF', k, JSON.stringify(r)); }
  for(const v of [['void0',J=>{J.voidamt=0;}],['corr0',J=>{J.corr=0;}],['void0corr0',J=>{J.voidamt=0;J.corr=0;}],['allfxoff',J=>{for(const k in J.fx)J.fx[k]=false;}],['allfxoff_void0_corr0',J=>{for(const k in J.fx)J.fx[k]=false;J.voidamt=0;J.corr=0;}],['loc0',J=>{J.locality=0;}]]){
    const r=await pg.evaluate(async([N,src])=>{ const R=resolve(); const J=v3JobFor(R,N,''); (new Function('J',src))(J); return __stats(await __render(J)); }, [N, v[1].toString().replace(/^J=>\{|\}$/g,'')]); console.log('VAR', v[0], JSON.stringify(r)); }
  for(const c of [55,35]){ const r=await pg.evaluate(async([N,c])=>{ const R=resolve(); const J=v3JobFor(R,N,''); J.corr=Math.min(J.corr,c); return __stats(await __render(J)); }, [N,c]); console.log('CORR', c, JSON.stringify(r)); }
  console.log('errors:', errs.length?errs.join(' | '):'none'); await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
