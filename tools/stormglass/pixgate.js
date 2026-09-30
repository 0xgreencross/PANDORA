/* PIXGATE: the same plates on two pages, frames [0,8,16] of 24 at raster R, guest frozen: pixels that differ. Env A,B,SEEDS,SUBJ,R,PORT */
const {chromium}=require('playwright');
(async()=>{
  const R=+(process.env.R||270), N=24, FR=[0,8,16];
  const seeds=(process.env.SEEDS||'4242,1001').split(',').map(Number);
  const subjects=process.env.SUBJ?process.env.SUBJ.split(',').map(Number):Array.from({length:47},(_,i)=>i);
  const br=await chromium.launch({args:['--no-sandbox']});
  const INSTALL=()=>{
    window.__guest0=(J)=>new Promise((res,rej)=>{ const url=URL.createObjectURL(new Blob([v3WorkerSrc(160)],{type:'text/javascript'})); const w=new Worker(url);
      w.onmessage=e=>{ const m=e.data; if(m.t==='err'){rej(m.msg);return;} if(m.t!=='pv')return; w.terminate(); res(new Uint8Array(m.buf)); };
      w.onerror=e=>rej(String(e.message||e)); w.postMessage({t:'job',step:true,job:Object.assign({},J,{__i:0})}); });
    window.__plate=(P,N,W,frames,tex)=>new Promise((res,rej)=>{
      const url=URL.createObjectURL(new Blob([coreSrc()+'\n'+encSrc()+'\n'+WORKER_DRIVER],{type:'text/javascript'})); const w=new Worker(url); const out={};
      w.onmessage=e=>{ const m=e.data; if(m.t==='frame'){ out[m.i]=Array.from(new Uint8Array(m.buf)); } else if(m.t==='done'){ w.terminate(); res(out); } };
      w.onerror=e=>rej(String(e.message||e)); w.postMessage({job:1,P,N,W,H:W,frames,print:null,tex:{W:160,N:1,frames:[tex.slice().buffer]}}); });
    window.__run=async(N,W,FR)=>{ const R=resolve(), P=R.P; const g=await __guest0(v3JobFor(R,N,'')); const t0=performance.now(); const fr=await __plate(P,N,W,FR,g); return {name:SUBJECTS[P.subject], ms:Math.round((performance.now()-t0)/FR.length), fr}; };
  };
  const get=async(F,sd,sj)=>{ const pg=await (await br.newContext()).newPage(); await pg.goto('http://127.0.0.1:'+(process.env.PORT||'8931')+'/'+F+'?seed='+sd+'&subject='+sj+'&frames='+N+'&raster='+R); await pg.waitForTimeout(400); await pg.evaluate(INSTALL); const r=await pg.evaluate(async([N,W,FR])=>__run(N,W,FR),[N,R,FR]); await pg.context().close(); return r; };
  let worst=0;
  for(const sj of subjects) for(const sd of seeds){
    try{ const a=await get(process.env.A,sd,sj), b=await get(process.env.B,sd,sj); const out=[];
      for(const f of FR){ let n=0; const x=a.fr[f], y=b.fr[f]; for(let i=0;i<x.length;i++) if(x[i]!==y[i]) n++; out.push(n); worst=Math.max(worst,n); }
      console.log(a.name.padEnd(12), String(sd).padEnd(6), 'px differing per frame', out.join(' '), '  ms A', a.ms, 'B', b.ms, 'x'+(a.ms/Math.max(1,b.ms)).toFixed(2));
    }catch(e){ console.log(sj,sd,'ERR',String(e).slice(0,150)); }
  }
  console.log('WORST', worst); await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
