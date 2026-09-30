/* GIFGATE: prints a plate and saves BOTH the GIF bytes and the raw index frames + palette, so the file can be
   decoded outside and compared pixel for pixel with what the page drew. JOBS=[[name,F,Q,DNA|null,raster]] OUT= */
const {chromium}=require('playwright'); const fs=require('fs');
(async()=>{
  const OUT=process.env.OUT; fs.mkdirSync(OUT,{recursive:true});
  const br=await chromium.launch({args:['--no-sandbox']});
  for(const [name,F,Q,DNA,R] of JSON.parse(process.env.JOBS)){
    const pg=await (await br.newContext({viewport:{width:1300,height:900}})).newPage();
    const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,160)));
    const t0=Date.now();
    try{
      await pg.goto('http://127.0.0.1:'+(process.env.PORT||'8931')+'/'+F+'?'+(Q||'seed=1')); await pg.waitForTimeout(800);
      if(DNA){ await pg.evaluate(d=>{ document.getElementById('dna').value=d; recall(); }, DNA); await pg.waitForTimeout(300); }
      await pg.evaluate((R)=>{ const r=document.getElementById('raster'); if(r){ r.value=String(R); } draw(true,true); }, R||540);
      let ok=false; for(let i=0;i<2400;i++){ await pg.waitForTimeout(250); if(await pg.evaluate(()=>{ try{ return !!(LAST&&LAST.bytes&&DONEKEY===stateKey()); }catch(e){ return false; } })) {ok=true;break;} }
      const b64=await pg.evaluate(()=>{ const b=LAST.bytes; let s=''; for(let i=0;i<b.length;i+=8192) s+=String.fromCharCode.apply(null,b.subarray(i,i+8192)); return btoa(s); });
      fs.writeFileSync(OUT+'/'+name+'.gif', Buffer.from(b64,'base64'));
      const meta=await pg.evaluate(()=>({N:LAST.N, W:LAST.W, H:LAST.H, pal:LAST.pal, sub:SUBJECTS[LAST.P.subject], dna:document.getElementById('dna').value, turns:(typeof turnsFor==='function')?turnsFor(LAST.P):1, cam:CAMS[LAST.P.cam], wx:WEATHERS[LAST.P.weather]}));
      fs.writeFileSync(OUT+'/'+name+'.json', JSON.stringify(meta));
      /* the raw frames, in slabs of 20 to keep each evaluate small */
      const fd=fs.openSync(OUT+'/'+name+'.idx','w');
      for(let a=0;a<meta.N;a+=20){
        const s=await pg.evaluate(([a,b])=>{ let s=''; for(let f=a;f<Math.min(b,LAST.N);f++){ const fr=LAST.frames[f]; for(let i=0;i<fr.length;i+=8192) s+=String.fromCharCode.apply(null,fr.subarray(i,i+8192)); } return btoa(s); },[a,a+20]);
        fs.writeSync(fd, Buffer.from(s,'base64'));
      }
      fs.closeSync(fd);
      console.log(name, ok?'ok':'TIMEOUT', fs.statSync(OUT+'/'+name+'.gif').size+'B', JSON.stringify({N:meta.N,W:meta.W,sub:meta.sub,turns:meta.turns,cam:meta.cam,wx:meta.wx}), ((Date.now()-t0)/1000|0)+'s', errs.length?('ERR '+errs[0]):'');
    }catch(e){ console.log(name,'FAIL',String(e).slice(0,200)); }
    await pg.context().close();
  }
  await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
