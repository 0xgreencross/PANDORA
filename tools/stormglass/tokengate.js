/* THE TOKEN GATE. The page a token emits, loaded as a data: URL, must print the same bytes as the
   workbench given the same seed, subject, frames and sky. TOKENS env: list of onchain/emitted ids. */
const {chromium}=require('playwright'); const crypto=require('crypto'); const fs=require('fs');
(async()=>{
  const br=await chromium.launch({args:['--no-sandbox']});
  const ctx=await br.newContext({viewport:{width:1200,height:900}});
  const md5=async(pg)=>{ for(let i=0;i<800;i++){ await pg.waitForTimeout(250); if(await pg.evaluate(()=>{ try{ return !!(LAST&&LAST.bytes&&DONEKEY===stateKey()); }catch(e){ return false; } })) break; }
    const b64=await pg.evaluate(()=>{const b=LAST.bytes;let s='';for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s);});
    return crypto.createHash('md5').update(Buffer.from(b64,'base64')).digest('hex'); };
  let bad=0;
  for(const id of (process.env.TOKENS||'0,1').split(',')){
    const html=fs.readFileSync(process.env.DIR+'/'+id+'.html'); const G=JSON.parse(fs.readFileSync(process.env.DIR+'/'+id+'.json')).glass;
    const t=await ctx.newPage(); const errs=[]; t.on('pageerror',e=>errs.push(String(e).slice(0,120)));
    await t.goto('data:text/html;base64,'+html.toString('base64'));
    const a=await md5(t); const dims=await t.evaluate(()=>LAST.outW+'x'+LAST.outH+' N'+LAST.N+' '+SUBJECTS[LAST.P.subject]);
    const w=await ctx.newPage();
    const q=new URLSearchParams({seed:String(G.seed),frames:String(G.frames),live:JSON.stringify(G.live)}); if(G.subject!=null) q.set('subject',String(G.subject));
    await w.goto('http://127.0.0.1:8931/workbench/v5_2/index.html?'+q.toString()); await w.waitForTimeout(500);
    await w.evaluate(()=>{ document.getElementById('raster').value='540'; draw(true,true); });
    const b=await md5(w);
    const ok=a===b; if(!ok) bad++;
    console.log('token',id,dims,'token md5',a,'workbench md5',b,ok?'IDENTICAL':'DIFFERENT', errs.length?('errors: '+errs.join('|')):'');
    await t.close(); await w.close();
  }
  console.log('bad',bad); await br.close(); process.exit(bad?1:0);
})().catch(e=>{console.log('FAIL',String(e&&e.stack||e).slice(0,600));process.exit(1);});
