/* GUEST STRIP: renders the seed's guest job with a JS mutation (MUT env, body acting on J) and draws frames FR. Q, N, OUT env. */
const {chromium}=require('playwright');
(async()=>{
  const F=process.env.FILE||'workbench/v5_2/index.html', N=+(process.env.N||36), OUT=process.env.OUT||'/home/claude/shots/seam/guest.png';
  const br=await chromium.launch({args:['--no-sandbox']});
  const pg=await (await br.newContext({viewport:{width:1300,height:900}})).newPage();
  await pg.goto('http://127.0.0.1:8931/'+F+'?'+(process.env.Q||'seed=1')); await pg.waitForTimeout(1200);
  const info=await pg.evaluate(async([N,mut,FR])=>{
    const render=(J)=>new Promise((res,rej)=>{ const url=URL.createObjectURL(new Blob([v3WorkerSrc(160)],{type:'text/javascript'}));
      const w=new Worker(url); const frames=new Array(J.N); let pal=null,k=0,i=0;
      w.onmessage=e=>{ const m=e.data; if(m.t==='meta'){pal=m.pal;return;} if(m.t==='err'){rej(m.msg);return;} if(m.t!=='pv')return;
        frames[m.i]=new Uint8Array(m.buf); k++; if(k>=J.N){ w.terminate(); res({frames,pal}); return; } i++; w.postMessage({t:'job',step:true,job:Object.assign({},J,{__i:i})}); };
      w.postMessage({t:'job',step:true,job:Object.assign({},J,{__i:0})}); });
    const R=resolve(); const J=v3JobFor(R,N,''); (new Function('J',mut))(J); const {frames,pal}=await render(J);
    const W=160,H=160; const c=document.createElement('canvas'); c.id='strip'; c.width=W*FR.length*2; c.height=H*2+20; c.style.cssText='position:fixed;left:0;top:0;z-index:99999;background:#000'; document.body.appendChild(c);
    const g=c.getContext('2d'); g.imageSmoothingEnabled=false; const tmp=document.createElement('canvas'); tmp.width=W; tmp.height=H; const tg=tmp.getContext('2d');
    FR.forEach((fi,k)=>{ const fr=frames[fi]; const id=tg.createImageData(W,H); for(let i=0;i<fr.length;i++){ const p=pal[fr[i]]||[255,0,255]; id.data[i*4]=p[0]; id.data[i*4+1]=p[1]; id.data[i*4+2]=p[2]; id.data[i*4+3]=255; } tg.putImageData(id,0,0); g.drawImage(tmp,k*W*2,20,W*2,H*2); g.fillStyle='#fff'; g.font='14px monospace'; g.fillText('f'+fi,k*W*2+4,14); });
    return {mode:J.mode, corr:J.corr, ver:J.ver};
  }, [N, process.env.MUT||'', process.env.FR.split(',').map(Number)]);
  await pg.locator('#strip').screenshot({path:OUT}); console.log(JSON.stringify(info)); await br.close();
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
