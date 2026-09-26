const {chromium}=require('playwright');
(async()=>{ const br=await chromium.launch({args:['--no-sandbox']}); const pg=await (await br.newContext()).newPage();
  for(const seed of [1001,2002,3003,4004,5005,6006]){
    await pg.goto('http://127.0.0.1:8931/workbench/v5_2/index.html?seed='+seed+'&subject=46&frames=8'); await pg.waitForTimeout(600);
    const r=await pg.evaluate(()=>{ const R=resolve(); const P=R.P; prepFrame(P,0); const C=camera(P,0,false); const c0=FR.c[0], s0=FR.s[0];
      const lz=-s0*C.cx+c0*C.cz, lx=c0*C.cx+s0*C.cz; return {camAz:+(P.camAz*180/Math.PI).toFixed(0), yaw:+(P.gold.yaw*180/Math.PI).toFixed(0), cam:[+C.cx.toFixed(2),+C.cy.toFixed(2),+C.cz.toFixed(2)], camLocal:[+lx.toFixed(2),+lz.toFixed(2)], sunAz:+(P.sunAz*180/Math.PI).toFixed(0)}; });
    console.log(seed, JSON.stringify(r));
  } await br.close(); })();
