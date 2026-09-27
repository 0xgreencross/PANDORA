/* FX CLASS: for each seed in SEEDS, renders the bare source, then the source with each effect alone
   (corr 50), and reports the structural step ratio (max step / median step) and the wrap ratio.
   Effects that jump are the ones that cut. */
const {chromium}=require('playwright');
(async()=>{
  const F=process.env.FILE||'workbench/v5_2/index.html', N=+(process.env.N||36), CORR=+(process.env.CORR||50);
  const br=await chromium.launch({args:['--no-sandbox']});
  const pg=await (await br.newContext({viewport:{width:1300,height:900}})).newPage();
  await pg.goto('http://127.0.0.1:8931/'+F+'?seed=1'); await pg.waitForTimeout(1000);
  await pg.evaluate(()=>{ window.__render=(J)=>new Promise((res,rej)=>{ const url=URL.createObjectURL(new Blob([v3WorkerSrc(160)],{type:'text/javascript'}));
      const w=new Worker(url); const frames=new Array(J.N); let k=0,i=0;
      w.onmessage=e=>{ const m=e.data; if(m.t==='err'){rej(m.msg);return;} if(m.t!=='pv')return; frames[m.i]=new Uint8Array(m.buf); k++; if(k>=J.N){ w.terminate(); res(frames); return; } i++; w.postMessage({t:'job',step:true,job:Object.assign({},J,{__i:i})}); };
      w.postMessage({t:'job',step:true,job:Object.assign({},J,{__i:0})}); });
    window.__struct=(fr)=>{ const W=160,G=16,cs=W/G; const cnt=new Map(); for(const v of fr[0]) cnt.set(v,(cnt.get(v)||0)+1); let bg=0,bc=0; for(const [k,v] of cnt) if(v>bc){bc=v;bg=k;}
      const grids=fr.map(f=>{ const g=new Float32Array(G*G); for(let y=0;y<W;y++) for(let x=0;x<W;x++) if(f[y*W+x]!==bg) g[((y/cs)|0)*G+((x/cs)|0)]+=1/(cs*cs); return g; });
      const Nn=fr.length, d=[]; for(let i=0;i<Nn;i++){ const a=grids[i], b=grids[(i+1)%Nn]; let s=0; for(let q=0;q<G*G;q++) s+=Math.abs(a[q]-b[q]); d.push(s/(G*G)); }
      const sd=[...d].sort((x,y)=>x-y), med=sd[(Nn/2)|0]||1e-9; let mx=0,mi=-1; for(let i=0;i<Nn;i++) if(d[i]>mx){mx=d[i];mi=i;}
      return {max:+(mx/med).toFixed(1), at:mi, wrap:+(d[Nn-1]/med).toFixed(1), med:+med.toFixed(4)}; }; });
  for(const seed of process.env.SEEDS.split(',')){
    const r=await pg.evaluate(async([seed,N,CORR])=>{ S.seed=+seed; const R=resolve(); const J=v3JobFor(R,N,''); const off=Object.fromEntries(Object.keys(J.fx).map(k=>[k,false]));
      const out={mode:J.mode}; out.bare=__struct(await __render(Object.assign({},J,{corr:0,voidamt:0,fx:off})));
      out.bareC=__struct(await __render(Object.assign({},J,{corr:CORR,voidamt:0,fx:off})));
      for(const k of CARD_CH){ out[k]=__struct(await __render(Object.assign({},J,{corr:CORR,voidamt:0,fx:Object.assign({},off,{[k]:true})}))); }
      return out; }, [seed,N,CORR]);
    console.log('seed',seed,JSON.stringify(r));
  }
  await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
