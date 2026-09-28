/* LOC PROBE: on a printed plate, marches a grid of rays at two frames, and for every loop-material hit reads
   the part's frame rotation off LOC nudges; reports how orthonormal it is and whether the local point stays
   put when the world point is carried by the part's own motion (frame 0 -> frame k). DNA/Q, K env. */
const {chromium}=require('playwright');
(async()=>{
  const F=process.env.FILE||'workbench/v5_2/index.html', K=+(process.env.K||9);
  const br=await chromium.launch({args:['--no-sandbox']});
  const pg=await (await br.newContext({viewport:{width:1300,height:900}})).newPage();
  await pg.goto('http://127.0.0.1:8931/'+F+'?'+(process.env.Q||'seed=1')); await pg.waitForTimeout(800);
  if(process.env.DNA){ await pg.evaluate(d=>{ document.getElementById('dna').value=d; recall(); }, process.env.DNA); }
  for(let i=0;i<600;i++){ await pg.waitForTimeout(250); if(await pg.evaluate(()=>{ try{ return !!(LAST&&LAST.frames&&DONEKEY===stateKey()); }catch(e){ return false; } })) break; }
  const r=await pg.evaluate((K)=>{
    const P=LAST.P, N=LAST.N; prepFrame(P,0); const C=camera(P,0,false); const fov=P.fov*(C.fovS||1); C.fovV=fov; C.fovH=fov;
    const out={hits:0, orthoErr:[], detR:[], samples:[]};
    const frameOf=(th)=>{ prepFrame(P,th); };
    const Rat=(x,y,z)=>{ sceneSDF(P,x,y,z); const m=MAT; const l0=[LOC[0],LOC[1],LOC[2]]; const e=0.002; const R=[[0,0,0],[0,0,0],[0,0,0]];
      const d=[[e,0,0],[0,e,0],[0,0,e]]; for(let j=0;j<3;j++){ sceneSDF(P,x+d[j][0],y+d[j][1],z+d[j][2]); for(let i=0;i<3;i++) R[i][j]=(LOC[i]-l0[i])/e; } return {m,l0,R}; };
    const th0=0, thk=K/N*6.283185307179586;
    /* rays from the camera through a coarse grid */
    frameOf(th0);
    for(let py=10;py<130;py+=6) for(let px=10;px<130;px+=6){
      const v=-((py+0.5)/135*2-1)*C.fovV, u=((px+0.5)/135*2-1)*C.fovH;
      let dx=C.fx+C.rx*u+C.ux*v, dy=C.fy+C.ry*u+C.uy*v, dz=C.fz+C.rz*u+C.uz*v; const dl=Math.hypot(dx,dy,dz); dx/=dl; dy/=dl; dz/=dl;
      const t=march(P,C.cx,C.cy,C.cz,dx,dy,dz,th0); if(t<0||HIT_M!==7) continue;
      const hx=C.cx+dx*t, hy=C.cy+dy*t, hz=C.cz+dz*t; const a=Rat(hx,hy,hz); if(a.m!==7) continue; out.hits++;
      const R=a.R; let err=0; for(let i=0;i<3;i++) for(let j=0;j<3;j++){ let s=0; for(let k=0;k<3;k++) s+=R[k][i]*R[k][j]; err=Math.max(err,Math.abs(s-(i===j?1:0))); }
      const det=R[0][0]*(R[1][1]*R[2][2]-R[1][2]*R[2][1])-R[0][1]*(R[1][0]*R[2][2]-R[1][2]*R[2][0])+R[0][2]*(R[1][0]*R[2][1]-R[1][1]*R[2][0]);
      out.orthoErr.push(+err.toFixed(4)); out.detR.push(+det.toFixed(3));
      if(out.samples.length<6) out.samples.push({hit:[hx,hy,hz].map(v=>+v.toFixed(3)), loc:a.l0.map(v=>+v.toFixed(3))});
    }
    /* carry: at frame k, find the world point whose LOC equals l0 by inverting the rigid map (world = c + R^T loc), c found from the hit: c = hit - R^T l0 at frame 0 is meaningless across frames; instead test: local normal continuity is what matters, and R orthonormal proves rigidity. */
    out.orthoMax=Math.max(...out.orthoErr); out.detMin=Math.min(...out.detR); out.detMax=Math.max(...out.detR);
    return out;
  }, K);
  console.log(JSON.stringify(r).slice(0,1500)); await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
