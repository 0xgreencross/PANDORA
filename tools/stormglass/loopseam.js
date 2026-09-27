/* LOOP SEAM PROBE: for a DNA card (or seed query), measure how different consecutive frames are,
   including the wrap N-1 -> 0, for the guest loop texture (TEXC) and for the plate's own frames.
   DNA env (card) or Q env (query). A seam shows as a wrap difference far above the median step. */
const {chromium}=require('playwright');
(async()=>{
  const F=process.env.FILE||'workbench/v5_2/index.html';
  const br=await chromium.launch({args:['--no-sandbox']});
  const pg=await (await br.newContext({viewport:{width:1300,height:900}})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await pg.goto('http://127.0.0.1:8931/'+F+'?'+(process.env.Q||'seed=1'));
  await pg.waitForTimeout(800);
  if(process.env.DNA){ await pg.evaluate(d=>{ document.getElementById('dna').value=d; recall(); }, process.env.DNA); }
  let ok=false; for(let i=0;i<600;i++){ await pg.waitForTimeout(250); if(await pg.evaluate(()=>{ try{ return !!(LAST&&LAST.frames&&DONEKEY===stateKey()); }catch(e){ return false; } })) {ok=true;break;} }
  const r=await pg.evaluate(()=>{
    const diff=(a,b)=>{ let n=0; for(let i=0;i<a.length;i++) if(a[i]!==b[i]) n++; return n/a.length; };
    const series=(fr)=>{ const N=fr.length, d=[]; for(let i=0;i<N;i++) d.push(+diff(fr[i],fr[(i+1)%N]).toFixed(4)); return d; };
    const tex=TEXC.tex, plate=LAST.frames;
    const t=series(tex.frames), p=series(plate);
    const med=a=>{ const s=[...a].sort((x,y)=>x-y); return s[(s.length/2)|0]; };
    return { dna:document.getElementById('dna').value, sub:SUBJECTS[LAST.P.subject], N:tex.N,
      tex:{steps:t, wrap:t[t.length-1], median:med(t.slice(0,-1)), max:Math.max(...t.slice(0,-1))},
      plate:{steps:p, wrap:p[p.length-1], median:med(p.slice(0,-1)), max:Math.max(...p.slice(0,-1))} };
  });
  console.log(JSON.stringify(r,null,0)); console.log('done', ok, 'errors:', errs.length?errs.join(' | '):'none');
  await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
