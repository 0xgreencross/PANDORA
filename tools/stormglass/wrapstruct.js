/* WRAP STRUCT: a structural seam test for the guest loop. Each frame is reduced to a 16x16 grid of
   ink coverage; the L1 distance between neighbouring grids is the step. Reports the wrap step against
   the median step and the two largest steps, for the plate's own job and for the bare source (fx off,
   corr 0). SEEDS env, N env. */
const {chromium}=require('playwright');
(async()=>{
  const F=process.env.FILE||'workbench/v5_2/index.html', N=+(process.env.N||36);
  const br=await chromium.launch({args:['--no-sandbox']});
  const pg=await (await br.newContext({viewport:{width:1300,height:900}})).newPage();
  await pg.goto('http://127.0.0.1:8931/'+F+'?seed=1'); await pg.waitForTimeout(1000);
  await pg.evaluate(()=>{ window.__render=(J)=>new Promise((res,rej)=>{ const url=URL.createObjectURL(new Blob([v3WorkerSrc(160)],{type:'text/javascript'}));
      const w=new Worker(url); const frames=new Array(J.N); let k=0,i=0,pal=null;
      w.onmessage=e=>{ const m=e.data; if(m.t==='meta'){pal=m.pal;return;} if(m.t==='err'){rej(m.msg);return;} if(m.t!=='pv')return; frames[m.i]=new Uint8Array(m.buf); k++; if(k>=J.N){ w.terminate(); frames.pal=pal; res(frames); return; } i++; w.postMessage({t:'job',step:true,job:Object.assign({},J,{__i:i})}); };
      w.postMessage({t:'job',step:true,job:Object.assign({},J,{__i:0})}); });
    window.__struct=(fr,pal)=>{ const W=160,G=16,cs=W/G; const lum=pal.map(c=>(0.299*c[0]+0.587*c[1]+0.114*c[2])/255);
      /* a grid of cell luminance, each frame normalised to zero mean and unit spread, so a palette that
         breathes does not count and a layout that jumps does */
      const grids=fr.map(f=>{ const g=new Float32Array(G*G); for(let y=0;y<W;y++) for(let x=0;x<W;x++) g[((y/cs)|0)*G+((x/cs)|0)]+=lum[f[y*W+x]]/(cs*cs);
        let m=0; for(const v of g) m+=v; m/=g.length; let sd=0; for(const v of g) sd+=(v-m)*(v-m); sd=Math.sqrt(sd/g.length)||1e-6; for(let q=0;q<g.length;q++) g[q]=(g[q]-m)/sd; return g; });
      const Nn=fr.length, d=[]; for(let i=0;i<Nn;i++){ const a=grids[i], b=grids[(i+1)%Nn]; let s=0; for(let q=0;q<G*G;q++) s+=Math.abs(a[q]-b[q]); d.push(s/(G*G)); }
      const sd=[...d].sort((x,y)=>x-y), med=sd[(Nn/2)|0]||1e-9; const idx=d.map((v,i)=>[v,i]).sort((a,b)=>b[0]-a[0]);
      return {wrap:+(d[Nn-1]/med).toFixed(2), med:+med.toFixed(4), top:idx.slice(0,3).map(([v,i])=>i+':'+(v/med).toFixed(1)).join(' ')}; }; });
  for(const seed of process.env.SEEDS.split(',')){
    const r=await pg.evaluate(async([seed,N])=>{ S.seed=+seed; const R=resolve(); const J=v3JobFor(R,N,''); const on=Object.keys(J.fx).filter(k=>J.fx[k]);
      const fa=await __render(J); const a=__struct(fa,fa.pal); const J2=Object.assign({},J,{corr:0,voidamt:0,fx:Object.fromEntries(Object.keys(J.fx).map(k=>[k,false]))}); const fb=await __render(J2); const b=__struct(fb,fb.pal);
      return {mode:J.mode,corr:J.corr,on:on.length,full:a,bare:b}; }, [seed,N]);
    console.log('seed',seed,JSON.stringify(r));
  }
  await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
