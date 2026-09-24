"""THE GLASS: the token page, derived from the workbench without touching the engine.
Reads workbench/v5_2/index.html, keeps the engine script byte for byte, replaces the
workbench markup with the plate alone plus a hidden block of the bare controls the
engine addresses by id, adds the OS overlay and the glass boot, writes the page.
Usage: python3 mkglass.py <workbench index.html> <out.html>
The print gate (md5gate.js FILE=<out>) must match the workbench baseline after every run."""
import sys, re, os
SRC=sys.argv[1]; DST=sys.argv[2]
s=open(SRC).read()
CSS='''
  /* THE GLASS: the plate alone, and an OS that opens when it is touched */
  body.glass #wrap{ display:block; max-width:none; padding:0; min-height:100dvh; background:#000; }
  body.glass #stagecol{ min-height:100dvh; display:flex; align-items:center; justify-content:center; }
  body.glass #stage{ width:min(100vw, calc(100dvh * var(--arw) / var(--arh))); height:min(100dvh, calc(100vw * var(--arh) / var(--arw))); border:none; cursor:pointer; }
  body.glass[data-ar="9:16"] #stage{ max-height:none; margin:0; width:min(100vw, calc(100dvh * var(--arw) / var(--arh))); }
  body.glass #osd{ display:none; }
  body.glass #ctl{ display:none !important; }
  /* the glass's own status: on while the plate is being drawn, gone once the print is in hand */
  #gosd{ position:absolute; left:10px; bottom:8px; font-size:10px; letter-spacing:.18em; color:var(--ink); background:rgba(0,0,0,.6); padding:4px 8px; pointer-events:none; opacity:1; transition:opacity .5s ease; }
  #gosd.off{ opacity:0; }
  body.glass #prog{ opacity:.8; }
  #os{ position:fixed; inset:0; z-index:20; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,.35); }
  #os.open{ display:flex; }
  #os .win{ width:min(360px, 92vw); background:#0b0b0e; border:1px solid var(--ink); box-shadow:6px 6px 0 #000; font:12px/1.5 ui-monospace,Menlo,Consolas,monospace; color:var(--ink); }
  #os .bar{ display:flex; align-items:center; gap:8px; padding:6px 10px; border-bottom:1px solid var(--ink); letter-spacing:.2em; font-size:10px; }
  #os .bar b{ flex:1; }
  #os .bar button{ font:inherit; background:none; border:1px solid var(--ink); color:var(--ink); width:22px; height:18px; line-height:14px; padding:0; cursor:pointer; }
  #os .row{ display:flex; align-items:center; gap:8px; padding:9px 12px; border-bottom:1px solid var(--hair); cursor:pointer; user-select:none; }
  #os .row:hover{ background:#15151b; }
  #os .row span{ color:var(--mut); font-size:10px; letter-spacing:.14em; min-width:92px; }
  #os .row b{ font-weight:500; letter-spacing:.06em; }
  #os .row.dis{ opacity:.4; cursor:default; }
  #os .foot{ padding:8px 12px; font-size:10px; color:var(--mut); letter-spacing:.1em; word-break:break-all; }
  #os .seg{ display:flex; gap:6px; }
  #os .seg i{ font-style:normal; border:1px solid var(--hair); padding:2px 8px; }
  #os .seg i.on{ border-color:var(--acc); color:var(--acc); }
'''
OS='''
<div id="os" role="dialog" aria-label="GLASS OS"><div class="win">
  <div class="bar"><b>DITHERVOID // STORMGLASS</b><button id="os-x" title="close">&#215;</button></div>
  <div class="row" id="os-shape"><span>SHAPE</span><div class="seg"><i data-ar="1:1">1:1</i><i data-ar="9:16">9:16</i><i data-ar="16:9">16:9</i></div></div>
  <div class="row" id="os-gif"><span>DOWNLOAD</span><b>the loop as a GIF</b></div>
  <div class="row" id="os-full"><span>FULL SCREEN</span><b>fill the screen</b></div>
  <div class="foot" id="os-foot"></div>
</div></div>
'''
GOSD='<div id="gosd">STANDBY</div>'
BOOT='''
<script>
/* THE GLASS BOOT. The plate the token names, and nothing else on the page.
   window.GLASS (set by the contract's page, or by the site) or the URL says
   which plate: {seed, live, frames, ar, subject, cam, ...}. */
(function(){
  const G=window.GLASS||null;
  if(G){
    if(G.seed!=null) S.seed=(+G.seed)>>>0;
    for(const k of ['subject','scheme','hour','ground','dither','weather','cam']) if(G[k]!=null) S[k]=+G[k];
    if(G.frames) S.frames=+G.frames;
    if(G.live) for(const k in G.live) if(k in LIVE) LIVE[k]=G.live[k];
    if(G.ar&&window.setAspect) setAspect(G.ar);
    livePaint(); writeUI(); draw();
  }
  const os=document.getElementById('os');
  const open=(on)=>{ os.classList.toggle('open',!!on); if(on) paint(); };
  function paint(){
    os.querySelectorAll('#os-shape i').forEach(i=>i.classList.toggle('on',i.dataset.ar===S.ar));
    const ready=!!(LAST&&LAST.bytes&&DONEKEY===stateKey()); document.getElementById('os-gif').classList.toggle('dis',false);
    document.getElementById('os-gif').querySelector('b').textContent=ready?'the loop as a GIF ('+(LAST.bytes.length/1024|0)+'KB)':(RUN&&RUN.job===JOB&&!ready&&document.getElementById('osd').textContent.indexOf('%')>=0?'printing\\u2026 tap again when it is ready':'print it, then tap again');
    document.getElementById('os-foot').textContent=(document.getElementById('dna').value||'')+' \\u00b7 seed '+S.seed;
  }
  document.getElementById('stage').addEventListener('click',()=>open(!os.classList.contains('open')));
  document.getElementById('os-x').addEventListener('click',()=>open(false));
  os.addEventListener('click',e=>{ if(e.target===os) open(false); });
  os.querySelectorAll('#os-shape i').forEach(i=>i.addEventListener('click',()=>{ if(setAspect(i.dataset.ar)){ draw(); } paint(); }));
  document.getElementById('os-gif').addEventListener('click',()=>{ if(LAST&&LAST.bytes&&DONEKEY===stateKey()) saveGif(); else { doPrint(); paint(); } });
  document.getElementById('os-full').addEventListener('click',()=>{ const el=document.documentElement; const f=el.requestFullscreen||el.webkitRequestFullscreen; if(f) f.call(el); open(false); });
  setInterval(()=>{ if(os.classList.contains('open')) paint(); },800);
  /* THE STATUS. Reads what the engine writes (its OSD line and the progress
     bar) and says it with a percentage; once the print is in hand it fades. */
  const g=document.getElementById('gosd'), eo=document.getElementById('osd'), ep=document.getElementById('prog');
  let lastTxt='';
  function status(){
    const ready=!!(LAST&&LAST.bytes&&DONEKEY===stateKey());
    if(ready){ g.classList.add('off'); return; }
    g.classList.remove('off');
    const o=eo.textContent||'', pct=parseInt(ep.style.width)||0;
    let t;
    if(/^ROLLING/.test(o)) t='ROLLING THE LOOP \\u00b7 '+pct+'%';
    else if(/^DRAWING/.test(o)) t=o.replace(/\\s*\\u00b7\\s*\\d+ FRAMES$/,'')+' \\u00b7 '+pct+'%';
    else if(/^(PRINT|DRAFT)/.test(o)) t='WRITING THE PRINT\\u2026';
    else t=o||'STANDBY';
    if(t!==lastTxt){ g.textContent=t; lastTxt=t; }
  }
  setInterval(status,100); status();
  /* THE SIDE DOOR, for the site only. A parent frame may post {t:'glass', id, seed, subject, live,
     frames, raster, ar} and gets back {t:'glass', id, png} with the loop's first frame once the
     print is in hand. One at a time, in order. The engine is not touched. */
  const Q=[]; let busy=false;
  function next(){ if(busy||!Q.length) return; busy=true; const m=Q.shift();
    try{
      S.seed=(+m.seed)>>>0; S.subject=(m.subject!=null)?+m.subject:-1; S.frames=+(m.frames||24); S.raster=+(m.raster||135);
      LIVEK.forEach(k=>LIVE[k]=null); if(m.live) for(const k in m.live) if(k in LIVE) LIVE[k]=m.live[k];
      if(m.ar&&window.setAspect) setAspect(m.ar);
      livePaint(); writeUI(); document.getElementById('raster').value=String(S.raster); draw(true,true);
    }catch(e){ busy=false; (m.source||window.parent).postMessage({t:'glass',id:m.id,error:String(e)},'*'); next(); return; }
    const t0=Date.now();
    const poll=setInterval(()=>{
      const ready=!!(LAST&&LAST.bytes&&DONEKEY===stateKey());
      if(!ready&&Date.now()-t0<60000) return;
      clearInterval(poll); busy=false;
      let png=null; try{ if(ready){ paintOne(LAST.frames[0],LAST.W,LAST.H,LAST.pal); png=document.getElementById('view').toDataURL('image/png'); } }catch(e){}
      (m.source||window.parent).postMessage({t:'glass',id:m.id,png,dna:document.getElementById('dna').value,ready},'*');
      next();
    },100);
  }
  window.addEventListener('message',e=>{ const m=e.data; if(!m||m.t!=='glass'||m.seed==null) return; m.source=e.source; Q.push(m); next(); });
  if(window.parent!==window) try{ window.parent.postMessage({t:'glass',hello:true},'*'); }catch(e){}
})();
</script>
'''
def tag(rx):
    m=re.search(rx,s,re.S); assert m, rx; return m.group(0)
sel=lambda i: tag(r'<select id="%s">.*?</select>'%i)
lv=''.join('<div>'+tag(r'<input type="range" id="lv-%s"[^>]*>'%k)+'<b id="lvv-%s"></b><i data-k="%s"></i></div>'%(k,k) for k in ['gas','hour','moon','wind','tide','ledger','lineage','lamps','weight','age','peg','flood','hunger','pulse','witnesses'])
CTL=('<div id="ctl" style="display:none">'
     '<button id="art"></button><button id="shape"></button><button id="frame"></button>'
     '<button id="new"></button><button id="draw"></button><button id="save" disabled></button><button id="copy"></button><button id="recall"></button>'
     '<input id="dna" type="text"><input id="seed" type="number" min="1" max="4294967295" step="1" value="696969"><input id="tex" type="text">'
     '<select id="subject"></select><select id="scheme"></select><select id="hour"></select><select id="ground"></select><select id="dither"></select><select id="weather"></select><select id="cam"></select>'
     +sel('raster')+sel('aspect')+sel('frameSel')+sel('frames')+
     '<button id="live-now"></button><button id="live-off"></button>'+lv+
     '<div id="stat"></div><span id="p-sub"></span><span id="p-sch"></span><span id="p-hour"></span><span id="p-gnd"></span><span id="p-dit"></span><span id="p-ink"></span>'
     '</div>')
STAGE=tag(r'<div id="stage">.*?</div>\n').strip().replace('<div id="osd">STANDBY</div>','<div id="osd">STANDBY</div>'+GOSD)
BODY='<body class="glass">\n<div id="wrap"><div id="stagecol">'+STAGE+'</div>'+CTL+'</div>\n'+OS
b0=s.index('<body>'); b1=s.index('<script>',b0)
s=s[:b0]+BODY+s[b1:]
s=s.replace('</style>', CSS+'</style>',1)
s=s.replace('<title>DITHERVOID // STORMGLASS · V5.2</title>','<title>DITHERVOID // STORMGLASS</title>',1)
assert s.count('</script>\n</body>')==1
s=s.replace('</script>\n</body>', '</script>\n'+BOOT+'</body>',1)
assert s.count('id="os"')==1 and 'THE GLASS BOOT' in s and s.count('id="gosd"')==1
assert 'NEW GLASS' not in s and 'id="rail"' not in s and '<header' not in s and 'id="note"' not in s
# the engine block must be byte-identical to the workbench's
eng=lambda t: t[t.index('\n<script>\n')+1:t.index('\n</script>\n')]
src=open(SRC).read()
assert eng(src)==eng(s), 'engine block differs'
tmp=DST+'.tmp'; open(tmp,'w').write(s); os.replace(tmp,DST)
print('glass written', DST, len(s), 'engine bytes', len(eng(s)))
