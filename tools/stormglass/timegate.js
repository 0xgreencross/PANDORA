/* TIMEGATE: how long does one frame take, subject by subject. One worker, raster R, frames [0,8,16] of a 24-loop,
   guest frozen; reports ms per frame and, in a second pass with a counting patch, sceneSDF calls per frame.
   Env: SEEDS, SUBJ, R, PORT, F. */
const {chromium}=require('playwright');
(async()=>{
  const R=+(process.env.R||540), N=24;
  const seeds=(process.env.SEEDS||'4242,1001').split(',').map(Number);
  const subjects=process.env.SUBJ?process.env.SUBJ.split(',').map(Number):Array.from({length:47},(_,i)=>i);
  const br=await chromium.launch({args:['--no-sandbox']});
  const pg=await (await br.newContext({viewport:{width:1300,height:900}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  const INSTALL=()=>{
    window.__guest0=(J)=>new Promise((res,rej)=>{ const url=URL.createObjectURL(new Blob([v3WorkerSrc(160)],{type:'text/javascript'})); const w=new Worker(url);
      w.onmessage=e=>{ const m=e.data; if(m.t==='err'){rej(m.msg);return;} if(m.t!=='pv')return; w.terminate(); res(new Uint8Array(m.buf)); };
      w.onerror=e=>rej(String(e.message||e)); w.postMessage({t:'job',step:true,job:Object.assign({},J,{__i:0})}); });
    /* a worker that also reports how many times the scene was asked for its distance */
    const COUNT="let __sdf=0, __ph=0; const __c=[0,0,0,0,0,0]; const __o=sceneSDF; sceneSDF=function(P,x,y,z){ __sdf++; __c[__ph]++; return __o(P,x,y,z); }; const __wrap=(name,ph)=>{ const f=self[name]; self[name]=function(){ const p=__ph; __ph=ph; const r=f.apply(null,arguments); __ph=p; return r; }; }; self.addEventListener('message',()=>{},{once:true});";
    const WRAPS="__wrap('march',1); __wrap('normalAt',2); __wrap('shadow',3); __wrap('shadowTo',3); __wrap('occlusion',4);";
    window.__time=(P,N,W,frames,tex,count)=>new Promise((res,rej)=>{
      let src=coreSrc()+'\n'+encSrc()+'\n'+WORKER_DRIVER;
      if(count){ src=src.replace("self.onmessage=function(e){","self.onmessage=function(e){ __sdf=0;"); src=src.replace("self.postMessage({t:'done',job:J.job,W:W,H:H});","self.postMessage({t:'done',job:J.job,W:W,H:H,sdf:__sdf});"); src=COUNT+'\n'+src.replace("self.onmessage=function(e){ __sdf=0;","self.onmessage=function(e){ __sdf=0; if(!self.__wrapped){ self.__wrapped=1; "+WRAPS+" }"); src=src.replace("sdf:__sdf});","sdf:__sdf,ph:__c.slice()});"); }
      const url=URL.createObjectURL(new Blob([src],{type:'text/javascript'})); const w=new Worker(url);
      const t0=performance.now(); let got=0;
      w.onmessage=e=>{ const m=e.data; if(m.t==='frame'){ got++; } else if(m.t==='done'){ w.terminate(); res({ms:(performance.now()-t0)/frames.length, sdf:(m.sdf||0)/frames.length, ph:m.ph||[], got}); } };
      w.onerror=e=>rej(String(e.message||e));
      w.postMessage({job:1,P,N,W,H:W,frames,print:null,tex:{W:160,N:1,frames:[tex.slice().buffer]}}); });
    window.__run=async(N,W)=>{ const R=resolve(), P=R.P; const g=await __guest0(v3JobFor(R,N,''));
      const a=await __time(P,N,W,[0,8,16],g,false); const b=await __time(P,N,W,[0],g,true);
      return {subject:P.subject, name:SUBJECTS[P.subject], ms:Math.round(a.ms), sdf:Math.round(b.sdf), ph:b.ph.map(x=>Math.round(x/1000)), cam:CAMS[P.cam], wx:WEATHERS[P.weather], ground:GROUNDS[P.ground]}; };
  };
  console.log('subject'.padEnd(12),'seed'.padEnd(6),'ms/frame','sdf/frame','   cam','wx','ground');
  const agg={};
  for(const sj of subjects){ for(const sd of seeds){
    await pg.goto('http://127.0.0.1:'+(process.env.PORT||'8931')+'/'+(process.env.F||'workbench/v5_2/index.html')+'?seed='+sd+'&subject='+sj+'&frames='+N+'&raster='+R+(process.env.Q?('&'+process.env.Q):'')); await pg.waitForTimeout(400);
    await pg.evaluate(INSTALL);
    try{ const r=await pg.evaluate(async([N,W])=>__run(N,W),[N,R]);
      console.log(r.name.padEnd(12), String(sd).padEnd(6), String(r.ms).padStart(6), String(r.sdf).padStart(9), '  ', r.cam, r.wx, r.ground, 'phases k: other/skin',r.ph[0],'march',r.ph[1],'normal',r.ph[2],'shadow',r.ph[3],'occl',r.ph[4]);
      (agg[r.name]=agg[r.name]||[]).push(r.ms);
    }catch(e){ console.log(sj, sd, 'ERR', String(e).slice(0,120)); }
  }}
  console.log('--- ms per frame at '+R+', worst seed, sorted ---');
  Object.entries(agg).sort((a,b)=>Math.max(...b[1])-Math.max(...a[1])).forEach(([k,v])=>console.log(k.padEnd(12), String(Math.max(...v)).padStart(6), ' mean', Math.round(v.reduce((s,x)=>s+x,0)/v.length)));
  console.log('errors:', errs.length?errs.join(' | '):'none'); await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
