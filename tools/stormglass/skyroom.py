"""THE SKY ROOM. Every live dial as a row: the same plate rendered across the real-world range
of that dial, labelled with the value and what it does today. The curator taps where the effect
should START and where it should be FULL, or KILL, with a note. Marks live in the room's db
under sky/<dial>. Two steps: `python3 skyroom.py jobs` prints the JOBS json for shot.js;
`python3 skyroom.py build` writes the page from the rendered shots."""
import json, os, sys, base64
from PIL import Image
SHOTS='/home/claude/shots/sky'
OUT='/home/claude/P/tools/stormglass/skyroom.html'
def live(**kw): return json.dumps(kw,separators=(',',':'))
ROWS=[
 dict(key='gas', title='GAS · the base fee sets the weather', src='block.basefee, in gwei',
      now='under 0.1 snow · under 1 clear · under 10 overcast · under 30 fog · under 100 rain · above, storm',
      prop='under 0.3 snow · under 2 clear · under 8 overcast · under 20 fog · under 60 rain · above, storm',
      q='seed=9001', steps=[(0.05,'0.05 gwei · SNOW'),(0.3,'0.3 gwei · CLEAR'),(1,'1 gwei · OVERCAST'),(3,'3 gwei · OVERCAST'),(10,'10 gwei · FOG'),(30,'30 gwei · RAIN'),(100,'100 gwei · STORM')],
      lv=lambda v: live(gas=v)),
 dict(key='hunger', title='HUNGER · the blob fee corrupts the screen', src='block.blobbasefee, in gwei',
      now='a log curve: +70% of the corruption headroom near 100 gwei, nothing at 0', prop='nothing under 1 gwei, full at 30',
      q='seed=77&subject=12', steps=[(0,'0 gwei'),(1,'1 gwei'),(3,'3 gwei'),(10,'10 gwei'),(30,'30 gwei'),(100,'100 gwei'),(300,'300 gwei')],
      lv=lambda v: live(hunger=v)),
 dict(key='flood', title='FLOOD · ETH falling floods the ground', src='ETH against its own seven-day mean, from the pool',
      now='the water starts at a 20% fall and covers the base at 50%', prop='starts at 12%, covers the base at 40%',
      q='seed=424242', steps=[(0,'no fall'),(0.1,'ETH −10% vs 7d'),(0.2,'−20%'),(0.3,'−30%'),(0.4,'−40%'),(0.5,'−50%'),(0.7,'−70%')],
      lv=lambda v: live(flood=v)),
 dict(key='peg', title='PEG · the dollar off its peg prints the plate twice', src='USDC/USDT pool, percent off 1.00',
      now='nothing under 0.5% · full slip at 3%', prop='nothing under 0.3% · full at 2%',
      q='seed=77&subject=12', steps=[(0,'on peg'),(0.3,'0.3% off'),(0.5,'0.5%'),(1,'1%'),(2,'2%'),(3,'3%'),(5,'5%')],
      lv=lambda v: live(peg=v)),
 dict(key='tide', title='TIDE · the moon lifts the water on water plates', src='spring tide at new and full moon, neap at the quarters',
      now='the water rises up to 55% of the base at spring tide', prop='keep',
      q='seed=424242&ground=2', steps=[(0,'neap · 0'),(0.17,'0.17'),(0.33,'0.33'),(0.5,'0.5'),(0.67,'0.67'),(0.83,'0.83'),(1,'spring · 1')],
      lv=lambda v: live(tide=v)),
 dict(key='wind', title='WIND · the day’s roll shears the rain and drifts the fog', src='a roll fixed for the day, −1..1',
      now='full shear at ±1', prop='keep',
      q='seed=9001', steps=[(-1,'−1 west'),(-0.66,'−0.66'),(-0.33,'−0.33'),(0,'calm'),(0.33,'0.33'),(0.66,'0.66'),(1,'+1 east')],
      lv=lambda v: live(wind=v,gas=50)),
 dict(key='pulse', title='PULSE · silence ruptures the screen loop', src='hours since anyone paid anything',
      now='the rupture is complete after 24 hours of silence', prop='complete after 48 hours',
      q='seed=77&subject=12', steps=[(0,'just paid'),(0.08,'2 h'),(0.17,'4 h'),(0.33,'8 h'),(0.5,'12 h'),(0.75,'18 h'),(1,'24 h and beyond')],
      lv=lambda v: live(pulse=v)),
 dict(key='lamps', title='LAMPS · weeks held light lamps round the monument', src='weeks the owner has held the plate',
      now='one lamp a week, up to seven', prop='keep',
      q='seed=424242', steps=[(0,'0 weeks'),(1,'1 week'),(2,'2 weeks'),(3,'3 weeks'),(4,'4 weeks'),(5,'5 weeks'),(7,'7 weeks')],
      lv=lambda v: live(lamps=v)),
 dict(key='weight', title='WEIGHT · the owner’s balance clears the air', src='the owner’s ETH balance',
      now='haze thins from 0 to 10 ETH; 10 ETH is the clearest air', prop='5 ETH is the clearest',
      q='seed=9001', steps=[(0,'0 ETH'),(0.05,'0.5 ETH'),(0.1,'1 ETH'),(0.2,'2 ETH'),(0.5,'5 ETH'),(1,'10 ETH'),(1,'50 ETH (capped)')],
      lv=lambda v: live(weight=v)),
 dict(key='age', title='AGE · the horizon sinks as the collection lives', src='days since the candle',
      now='the horizon drops 0.0006 a day, floor at a year', prop='keep',
      q='seed=424242', steps=[(0,'day 0'),(30,'30 days'),(90,'90 days'),(180,'180 days'),(270,'270 days'),(365,'a year'),(365,'two years (capped)')],
      lv=lambda v: live(age=v)),
 dict(key='hour', title='HOUR · the Miami clock moves the sun', src='4:20 is the close; the sun follows the hour',
      now='sun up at 6, noon at 12, down at 18, night otherwise', prop='keep',
      q='seed=9001', steps=[(0,'midnight'),(4,'4 am'),(7,'7 am'),(12,'noon'),(16.33,'4:20 pm'),(20,'8 pm'),(23,'11 pm')],
      lv=lambda v: live(hour=v)),
 dict(key='witnesses', title='WITNESSES · notches in the accent, then the hands', src='every witness of the day, then every holder',
      now='a notch each, up to the width of the plate (about 120 at 540)', prop='keep',
      q='seed=5005', steps=[(0,'none'),(1,'1'),(3,'3'),(10,'10'),(30,'30'),(60,'60'),(120,'120')],
      lv=lambda v: live(witnesses=v,ledger=2)),
]
def jobs():
    J=[]
    for r in ROWS:
        for i,(v,lab) in enumerate(r['steps']):
            from urllib.parse import quote
            J.append([f"{r['key']}_{i}", r['q']+'&live='+quote(r['lv'](v))])
    print(json.dumps(J))
def build():
    rows=[]
    for r in ROWS:
        tiles=[]
        for i,(v,lab) in enumerate(r['steps']):
            p=f"{SHOTS}/{r['key']}_{i}.png"
            im=Image.open(p).convert('RGB'); im=im.resize((240,240)); im=im.quantize(colors=64)
            import io; b=io.BytesIO(); im.save(b,'PNG',optimize=True)
            tiles.append({'k':i,'label':lab,'src':'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()})
        rows.append({'key':r['key'],'title':r['title'],'src':r['src'],'now':r['now'],'prop':r['prop'],'tiles':tiles})
    html=TEMPLATE.replace('__ROWS__',json.dumps(rows))
    open(OUT,'w').write(html); print('sky room',OUT,len(html))
TEMPLATE=r'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sky Room</title>
<meta name="description" content="Every live dial of the STORMGLASS sky across its real range: tap where each effect should start and where it should be full.">
<style>
  :root{--bg:#050506;--ink:#e8e8ec;--mut:#7d7d88;--acc:#c8ff3a;--bad:#ff5a5a;--hair:#1e1e24;--pane:#0b0b0e;--on:#c8ff3a}
  @media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){--bg:#050506} } :root[data-theme="dark"]{--bg:#050506}
  *{box-sizing:border-box} html,body{margin:0;background:var(--bg);color:var(--ink);font:13px/1.5 ui-monospace,Menlo,Consolas,monospace}
  header{padding:14px 16px;border-bottom:1px solid var(--hair);position:sticky;top:0;background:rgba(5,5,6,.94);z-index:3}
  header b{letter-spacing:.22em;font-size:12px;font-weight:600} header p{margin:6px 0 0;color:var(--mut);font-size:11px;max-width:900px}
  #sync{font-size:10px;letter-spacing:.14em;color:var(--acc);margin-top:6px} #sync.bad{color:var(--bad)}
  section{padding:14px 16px 6px;border-bottom:1px solid var(--hair)}
  h2{font-size:12px;letter-spacing:.2em;margin:0 0 4px;font-weight:600} .meta{color:var(--mut);font-size:11px;line-height:1.55;max-width:900px}
  .meta i{font-style:normal;color:var(--ink)}
  .strip{display:flex;gap:6px;overflow-x:auto;padding:10px 0 6px;-webkit-overflow-scrolling:touch}
  .tile{flex:0 0 auto;width:150px;background:var(--pane);border:1px solid var(--hair)}
  .tile img{width:150px;height:150px;display:block;image-rendering:pixelated;background:#000}
  .tile .lab{font-size:10px;letter-spacing:.06em;padding:4px 6px;color:var(--mut);min-height:30px}
  .tile .acts{display:flex} .tile .acts button{flex:1;font:inherit;font-size:10px;letter-spacing:.14em;background:none;color:var(--mut);border:0;border-top:1px solid var(--hair);padding:7px 0;cursor:pointer}
  .tile .acts button+button{border-left:1px solid var(--hair)} .tile .acts button.on{color:#000;background:var(--acc)}
  .tile.start{border-color:var(--acc)} .tile.full{border-color:var(--acc)}
  .row{display:flex;gap:8px;align-items:center;padding:4px 0 10px;flex-wrap:wrap}
  .row input{flex:1;min-width:220px;font:inherit;background:var(--pane);color:var(--ink);border:1px solid var(--hair);padding:7px 9px}
  .row button{font:inherit;font-size:11px;letter-spacing:.14em;background:none;color:var(--ink);border:1px solid var(--ink);padding:7px 12px;cursor:pointer}
  .row button.kill.on{background:var(--bad);border-color:var(--bad);color:#000}
  .row .verdict{font-size:10px;letter-spacing:.14em;color:var(--mut)}
  section.dead .strip{opacity:.35}
  footer{padding:16px;color:var(--mut);font-size:11px}
  textarea{width:100%;min-height:70px;font:inherit;font-size:10px;background:var(--pane);color:var(--mut);border:1px solid var(--hair)}
</style></head><body>
<header><b>DITHERVOID // STORMGLASS · THE SKY ROOM</b>
<p>Every live dial across its real range, on one plate each. Tap <i>START</i> on the frame where the effect should begin and <i>FULL</i> where it should be at full strength. Tap <i>KILL</i> to remove an effect. Untouched rows count as accepted as they are. One note per row if a word is needed. Marks save on every tap.</p>
<div id="sync">reading the marks…</div></header>
<div id="rooms"></div>
<footer>Marks as JSON (kept here too, in case the store is out of reach):<textarea id="json" readonly></textarea></footer>
<script>
const ROWS=__ROWS__;
const marks={}; let db=null, dirty={}, timer=null;
const $=id=>document.getElementById(id);
function verdict(m){ if(!m) return 'as it is'; if(m.kill) return 'KILLED'; const a=[]; if(m.start!=null) a.push('starts at '+m.start); if(m.full!=null) a.push('full at '+m.full); return a.length?a.join(' · '):'as it is'; }
function render(){
  const root=$('rooms'); root.innerHTML='';
  for(const r of ROWS){ const m=marks[r.key]||{}; const s=document.createElement('section'); s.id='row-'+r.key; s.className=m.kill?'dead':'';
    s.innerHTML='<h2>'+r.title+'</h2><div class="meta">from <i>'+r.src+'</i><br>today: '+r.now+'<br>proposed: <i>'+r.prop+'</i></div>'
      +'<div class="strip">'+r.tiles.map(t=>'<div class="tile'+(m.start===t.k?' start':'')+(m.full===t.k?' full':'')+'" data-k="'+t.k+'"><img src="'+t.src+'" alt=""><div class="lab">'+t.label+'</div><div class="acts"><button data-a="start" class="'+(m.start===t.k?'on':'')+'">START</button><button data-a="full" class="'+(m.full===t.k?'on':'')+'">FULL</button></div></div>').join('')+'</div>'
      +'<div class="row"><button class="kill '+(m.kill?'on':'')+'">KILL</button><input class="note" placeholder="a word, if needed" value="'+(m.note||'').replace(/"/g,'&quot;')+'"><span class="verdict">'+verdict(m)+'</span></div>';
    s.querySelectorAll('.tile .acts button').forEach(b=>b.onclick=()=>{ const k=+b.closest('.tile').dataset.k, a=b.dataset.a; const cur=Object.assign({},marks[r.key]||{}); cur[a]=(cur[a]===k)?null:k; set(r.key,cur); });
    s.querySelector('.kill').onclick=()=>{ const cur=Object.assign({},marks[r.key]||{}); cur.kill=!cur.kill; set(r.key,cur); };
    const inp=s.querySelector('.note'); let t; const save=()=>{ const cur=Object.assign({},marks[r.key]||{}); if((cur.note||'')!==inp.value){ cur.note=inp.value; set(r.key,cur); } };
    inp.oninput=()=>{ clearTimeout(t); t=setTimeout(save,900); }; inp.onblur=save; inp.onkeydown=e=>{ if(e.key==='Enter'){ save(); inp.blur(); } };
    root.appendChild(s); }
  $('json').value=JSON.stringify(marks);
}
function applyMarks(){ for(const r of ROWS){ const s=$('row-'+r.key); if(!s) continue; const m=marks[r.key]||{}; s.className=m.kill?'dead':'';
    s.querySelectorAll('.tile').forEach(t=>{ const k=+t.dataset.k; t.classList.toggle('start',m.start===k); t.classList.toggle('full',m.full===k); t.querySelector('[data-a=start]').classList.toggle('on',m.start===k); t.querySelector('[data-a=full]').classList.toggle('on',m.full===k); });
    s.querySelector('.kill').classList.toggle('on',!!m.kill); const inp=s.querySelector('.note'); if(document.activeElement!==inp&&inp.value!==(m.note||'')) inp.value=m.note||''; s.querySelector('.verdict').textContent=verdict(m); }
  $('json').value=JSON.stringify(marks); }
function set(key,m){ m.t=Date.now(); marks[key]=m; dirty[key]=true; applyMarks(); try{ localStorage.setItem('skyroom',JSON.stringify(marks)); }catch(e){} clearTimeout(timer); timer=setTimeout(flush,600); }
let writing=false;
async function flush(){ if(!db||writing) return; writing=true;
  for(const k of Object.keys(dirty)){ delete dirty[k]; try{ await db.doc('sky/'+k).set(marks[k]); $('sync').textContent='marks saved · '+new Date().toLocaleTimeString(); $('sync').className=''; }
    catch(e){ dirty[k]=true; $('sync').textContent='could not save ('+(e&&e.code||'error')+'); will retry'; $('sync').className='bad'; } }
  writing=false; if(Object.keys(dirty).length) timer=setTimeout(flush,2000); }
try{ const l=JSON.parse(localStorage.getItem('skyroom')||'null'); if(l) Object.assign(marks,l); }catch(e){}
render();
(async()=>{ try{ db=await claude.use('db'); }catch(e){ db=null; }
  if(!db){ $('sync').textContent='the store is out of reach in this view: marks stay on this device (the JSON box below)'; $('sync').className='bad'; return; }
  db.collection('sky').onSnapshot(s=>{ for(const d of s.docs){ const b=d.data(); const a=marks[d.id]; if(!a||(b.t||0)>=(a.t||0)) marks[d.id]=b; } applyMarks(); }, e=>{ $('sync').textContent='store error: '+e.code; $('sync').className='bad'; });
  $('sync').textContent='marks sync to the store on every tap'; if(Object.keys(dirty).length) flush(); })();
</script></body></html>'''
if __name__=='__main__':
    {'jobs':jobs,'build':build}[sys.argv[1]]()
