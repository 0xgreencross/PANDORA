/* LOOP SURVEY: for SEEDS (comma list), the guest loop's wrap step against its median step, its
   worst single-frame jump, and the emptiest frame (share of pixels on the background ink). */
const {chromium}=require('playwright');
(async()=>{
  const F=process.env.FILE||'workbench/v5_2/index.html';
  const br=await chromium.launch({args:['--no-sandbox']});
  const pg=await (await br.newContext({viewport:{width:1300,height:900}})).newPage();
  for(const seed of process.env.SEEDS.split(',')){
    await pg.goto('http://127.0.0.1:8931/'+F+'?seed='+seed+(process.env.EXTRA||''));
    let ok=false; for(let i=0;i<600;i++){ await pg.waitForTimeout(250); if(await pg.evaluate(()=>{ try{ return !!(LAST&&LAST.frames&&DONEKEY===stateKey()); }catch(e){ return false; } })) {ok=true;break;} }
    const r=await pg.evaluate(()=>{
      const diff=(a,b)=>{ let n=0; for(let i=0;i<a.length;i++) if(a[i]!==b[i]) n++; return n/a.length; };
      const fr=TEXC.tex.frames, N=fr.length; const d=[]; for(let i=0;i<N;i++) d.push(diff(fr[i],fr[(i+1)%N]));
      const inner=d.slice(0,-1).sort((x,y)=>x-y), med=inner[(inner.length/2)|0];
      /* background ink: the most common index of frame 0 */
      const cnt=new Map(); for(const v of fr[0]) cnt.set(v,(cnt.get(v)||0)+1); let bg=0,bc=0; for(const [k,v] of cnt) if(v>bc){bc=v;bg=k;}
      let emptiest=1, ef=-1; const cover=[]; for(let i=0;i<N;i++){ let n=0; for(const v of fr[i]) if(v!==bg) n++; const c=n/fr[i].length; cover.push(+c.toFixed(3)); if(c<emptiest){emptiest=c;ef=i;} }
      let worst=0, wf=-1; for(let i=0;i<N-1;i++) if(d[i]>worst){worst=d[i];wf=i;}
      return {N, sub:SUBJECTS[LAST.P.subject], wrap:+d[N-1].toFixed(3), med:+med.toFixed(3), wrapRatio:+(d[N-1]/med).toFixed(2), worstStep:+worst.toFixed(3), worstAt:wf, emptiest:+emptiest.toFixed(3), emptiestAt:ef, medianCover:+cover.slice().sort((a,b)=>a-b)[(N/2)|0].toFixed(3)};
    });
    console.log('seed',seed,ok?'ok':'TIMEOUT',JSON.stringify(r));
  }
  await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
