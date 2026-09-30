/* WRAPGATE: does the loop close? For every subject and seed, render the plate at th=0 and at th=TAU
   (frame N of an N-frame loop) with the guest loop frozen on its first frame, and count the pixels that
   differ. A subject that closes by construction differs in ~0 pixels; a subject whose skin stands a
   fraction of a turn off shows the skin's own pixels. Then the same at th=s*TAU, s the whole-turn
   multiplier the engine will use, which must bring every subject to ~0. Env: SEEDS, SUBJ, N, R. */
const {chromium}=require('playwright');
const PATCHES={ base:[], tie:[["if(ax>=ay&&ax>=az){","if(ax>=ay*(1-1e-6)&&ax>=az*(1-1e-6)){"],["else if(ay>=az){","else if(ay>=az*(1-1e-6)){"]] };
(async()=>{
  const N=+(process.env.N||24), R=+(process.env.R||270);
  const seeds=(process.env.SEEDS||'4242,1001,7,2026').split(',').map(Number);
  const subjects=process.env.SUBJ?process.env.SUBJ.split(',').map(Number):Array.from({length:47},(_,i)=>i);
  const br=await chromium.launch({args:['--no-sandbox']});
  const pg=await (await br.newContext({viewport:{width:1300,height:900}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  const INSTALL=(PATCH)=>{
    if(PATCH&&PATCH.length){ const o=coreSrc; window.coreSrc=()=>{ let t=o(); for(const [a,b] of PATCH){ if(!t.includes(a)) throw new Error('anchor missing: '+a.slice(0,50)); t=t.split(a).join(b); } return t; }; }
    /* the whole-turn multiplier, by construction (what pass 24 will put in the engine) */
    window.__turns=(P)=>{ if(typeof turnsFor==='function') return turnsFor(P); const S=SOLIDS[P.subject]; if(S) return S.sym;
      switch(P.subject){ case 16: return 5; case 17: case 20: return 3; case 15: case 35: return 2;   /* ZERO turns half a turn too, but its ring faces the camera and the triplanar's own sign flip mirrors the face back onto itself: the gate measures it closed */
        case 13:{ for(const M of P.asm.mods) if(M.wears && M.arr===0 && M.mot===6 && M.cnt>1 && (M.rate&1)) return 2; return 1; } }
      return 1; };
    window.__guest0=(J)=>new Promise((res,rej)=>{ const url=URL.createObjectURL(new Blob([v3WorkerSrc(160)],{type:'text/javascript'})); const w=new Worker(url);
      let gp=null; w.onmessage=e=>{ const m=e.data; if(m.t==='meta'){gp=m.pal;return;} if(m.t==='err'){rej(m.msg);return;} if(m.t!=='pv')return; w.terminate(); const f=new Uint8Array(m.buf); f.gpal=gp; res(f); };
      w.onerror=e=>rej(String(e.message||e)); w.postMessage({t:'job',step:true,job:Object.assign({},J,{__i:0})}); });
    window.__plate=(P,N,W,frames,tex)=>new Promise((res,rej)=>{
      const url=URL.createObjectURL(new Blob([coreSrc()+'\n'+encSrc()+'\n'+WORKER_DRIVER],{type:'text/javascript'})); const w=new Worker(url);
      const out={};
      w.onmessage=e=>{ const m=e.data; if(m.t==='frame'){ out[m.i]=new Uint8Array(m.buf); } else if(m.t==='done'){ w.terminate(); res(out); } };
      w.onerror=e=>rej(String(e.message||e));
      w.postMessage({job:1,P,N,W,H:W,frames,print:null,tex:{W:160,N:1,frames:[tex.slice().buffer]}}); });
    window.__wrap=async(N,W)=>{ const R=resolve(), P=R.P; const s=__turns(P);
      const g=await __guest0(v3JobFor(R,N,''));
      const fr=await __plate(P,N,W,[0,N,s*N],g);
      const diff=(a,b)=>{ let d=0; for(let i=0;i<a.length;i++) if(a[i]!==b[i]) d++; return +(100*d/a.length).toFixed(2); };
      const dump=window.__DUMP?{f0:Array.from(fr[0]),fN:Array.from(fr[N]),fS:Array.from(fr[s*N]),W,pal:buildInks(P,R.scheme,g.gpal||[])}:null; return {subject:P.subject, name:SUBJECTS[P.subject], s, wrap1:diff(fr[0],fr[N]), wrapS:diff(fr[0],fr[s*N]), dump}; };
  };
  console.log('subject'.padEnd(14),'seed'.padEnd(11),'s','wrap@1turn%','wrap@s%');
  const agg={};
  for(const sj of subjects){ for(const sd of seeds){
    await pg.goto('http://127.0.0.1:'+(process.env.PORT||'8931')+'/'+(process.env.F||'workbench/v5_2/index.html')+'?seed='+sd+'&subject='+sj+'&frames='+N+'&raster='+R); await pg.waitForTimeout(500);
    if(process.env.DNA){ await pg.evaluate(d=>{ document.getElementById('dna').value=d; recall(); }, process.env.DNA); await pg.waitForTimeout(300); }
    await pg.evaluate(INSTALL, PATCHES[process.env.PATCH||'base']);
    try{ if(process.env.DUMP) await pg.evaluate(()=>{window.__DUMP=1;}); const r=await pg.evaluate(async([N,W])=>__wrap(N,W),[N,R]);
      if(r.dump){ require('fs').writeFileSync(process.env.DUMP+'/'+r.name+'_'+sd+'.json',JSON.stringify(r.dump)); delete r.dump; }
      console.log(r.name.padEnd(14), String(sd).padEnd(11), r.s, String(r.wrap1).padStart(8), String(r.wrapS).padStart(8));
      (agg[r.name]=agg[r.name]||{s:r.s,w1:[],ws:[]}); agg[r.name].w1.push(r.wrap1); agg[r.name].ws.push(r.wrapS);
    }catch(e){ console.log(sj, sd, 'ERR', String(e).slice(0,120)); }
  }}
  console.log('--- summary (max over seeds) ---');
  for(const k in agg){ const a=agg[k]; console.log(k.padEnd(14), 's='+a.s, 'wrap@1', Math.max(...a.w1).toFixed(2).padStart(6), 'wrap@s', Math.max(...a.ws).toFixed(2).padStart(6), Math.max(...a.w1)>0.05?(Math.max(...a.ws)>0.05?'  STILL OPEN':'  BREAKS -> CLOSES'):''); }
  console.log('errors:', errs.length?errs.join(' | '):'none'); await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
