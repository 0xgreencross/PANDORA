/* SMALL WEATHER, shared by /gift/ and /gift/all/: the chain config, the renderer glue, saving and sharing,
   and the Plate Zero line. The renderer itself is /gift/sw.js, the same bytes as tools/gift/sw.js and the
   page laid on the chain. */
const NETS={
  mainnet:{chainId:1,  contract:'', rpc:'https://ethereum-rpc.publicnode.com', name:'Ethereum'},
  sepolia:{chainId:11155111, contract:'', rpc:'https://ethereum-sepolia-rpc.publicnode.com', name:'Sepolia'},
  local:{chainId:31337, contract:'', rpc:'http://127.0.0.1:8545', name:'local'}
};
const ABI=['function giftOf(address) view returns (uint256)','function holderOf(uint256) view returns (address)','function isClaimed(uint256) view returns (bool)',
  'function ownerOf(uint256) view returns (address)','function gif(uint256) view returns (bytes)','function isSealed() view returns (bool)','function claim()',
  'function sceneOf(uint256) view returns (uint8,uint8,uint8,uint8,uint8)','function gifts() view returns (uint256)','function minted() view returns (uint256)',
  'error NotSealed()','error NoGift()','error Claimed()'];
const Q=new URLSearchParams(location.search);
const NET=NETS[Q.get('net')]?Q.get('net'):'mainnet';
const CFG={...NETS[NET]};
if(NET!=='mainnet'){ if(Q.get('c')) CFG.contract=Q.get('c'); if(Q.get('rpc')) CFG.rpc=Q.get('rpc'); }
const keep=u=>u+(NET!=='mainnet'?'?net='+NET+(CFG.contract?'&c='+CFG.contract:'')+(Q.get('rpc')?'&rpc='+encodeURIComponent(Q.get('rpc')):''):'');
const pad3=n=>('00'+n).slice(-3);
const hx3=h=>[parseInt(h.substr(1,2),16),parseInt(h.substr(3,2),16),parseInt(h.substr(5,2),16)];
function b64(u){ let s=''; for(let i=0;i<u.length;i+=0x8000) s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000)); return btoa(s); }

/* a loop's numbers, read from the chain */
async function loopInfo(c,id){
  const [s,holder]=await Promise.all([c.sceneOf(id),c.holderOf(id)]);
  const n=s.map(Number);
  return {id:Number(id),holder,sky:SW.SKIES[n[0]],land:SW.LANDS[n[1]],weather:SW.WEATHERS[n[2]],pair:n[3],thin:n[4],scene:SW.SKIES[n[0]]+' / '+SW.LANDS[n[1]]+' / '+SW.WEATHERS[n[2]]};
}
/* the loop drawn again by the renderer, at 96 x scale; the 960 one is for X (it keeps hard pixels through X's resizing) */
function drawGif(L,scale){
  const P=SW.PAIRS[L.pair];
  const fr=SW.frames(ethers.keccak256(L.holder),L.sky,L.land,L.weather,L.thin,40);
  return SW.gif(fr,[hx3(P[1]),hx3(P[2])],4,scale);
}
/* THE POST (draft, waits for his yes): no links, ever; "dithervoid dot art" spelled out */
function postText(L){ return 'my small weather from greencross\nSMALL WEATHER #'+L.id+' · '+L.scene+'\ndrawn on the chain from my address\ndithervoid dot art\n#DITHERVOID'; }
const fileName=L=>'small-weather-'+pad3(L.id)+'.gif';
/* save: the phone's share sheet when it can take a file (post straight to X, or save to Photos); otherwise a download */
async function saveGif(L,onSay){
  onSay&&onSay('Drawing #'+L.id+' at 960…');
  await new Promise(r=>setTimeout(r,30));
  const g=drawGif(L,10);
  const f=new File([g],fileName(L),{type:'image/gif'});
  if(navigator.canShare&&navigator.canShare({files:[f]})){
    try{ await navigator.share({files:[f],text:postText(L)}); onSay&&onSay('Shared.','ok'); return; }
    catch(e){ if(e&&e.name==='AbortError'){ onSay&&onSay(''); return; } }
  }
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([g],{type:'image/gif'})); a.download=fileName(L);
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  onSay&&onSay('Saved '+fileName(L)+' (960 x 960). Attach it to your post on X.','ok');
}
async function copyPost(L,onSay){
  const t=postText(L);
  try{ await navigator.clipboard.writeText(t); onSay&&onSay('Post copied. Paste it on X with the GIF.','ok'); }
  catch(e){ window.prompt('Copy the post:',t); }
}
function openX(L){ window.open('https://x.com/intent/post?text='+encodeURIComponent(postText(L)),'_blank','noopener'); }

/* PLATE ZERO. /launch.json is kept by the STORMGLASS side; these are the fallbacks (stormglass/monday_launch.md) */
const LAUNCH_DEFAULT={candleLights:'2026-10-12T20:20:00Z',candleWindow:['2026-10-13T20:20:00Z','2026-10-14T02:20:00Z'],foundersDayHours:24,state:''};
async function launch(){ try{ const r=await fetch('/launch.json',{cache:'no-store'}); if(r.ok) return {...LAUNCH_DEFAULT,...await r.json()}; }catch(e){} return LAUNCH_DEFAULT; }
function hms(s){ s=Math.max(0,Math.floor(s)); const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=s%60; return (d?d+'D ':'')+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(x).padStart(2,'0'); }
function zeroLine(J){
  const now=Date.now()/1000, lights=Date.parse(J.candleLights)/1000, wEnd=Date.parse(J.candleWindow[1])/1000, fEnd=wEnd+J.foundersDayHours*3600;
  const local=new Date(lights*1000).toLocaleString([], {weekday:'short',hour:'numeric',minute:'2-digit'});
  const st=J.state||(now<lights?'before':now<wEnd?'candle':now<fEnd?'founders':'days');
  if(st==='before') return 'PLATE ZERO · THE CANDLE LIGHTS IN <b>'+hms(lights-now)+'</b> · 4:20PM MIAMI ('+local+' YOUR TIME)';
  if(st==='candle') return 'PLATE ZERO · <b>THE CANDLE IS LIT</b> · IT GOES OUT AT A MOMENT NOBODY KNOWS';
  if(st==='founders') return "<b>FOUNDERS' DAY</b> · PAY ANY AMOUNT FOR A SEAT AND A NOTCH ON PLATE ZERO";
  return 'STORMGLASS · <b>ONE PLATE A DAY</b> · THE PRICE ONLY FALLS';
}
function remindMe(J){
  const t=new Date(J.candleLights), z=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//DITHERVOID//SMALL WEATHER//EN','BEGIN:VEVENT','UID:plate-zero-'+z(t)+'@dithervoid.art','DTSTAMP:'+z(new Date()),
    'DTSTART:'+z(t),'DTEND:'+z(new Date(t.getTime()+30*60000)),'SUMMARY:STORMGLASS · Plate Zero: the candle lights','DESCRIPTION:The first plate. dithervoid.art','URL:https://dithervoid.art/',
    'BEGIN:VALARM','TRIGGER:-PT15M','ACTION:DISPLAY','DESCRIPTION:Plate Zero lights in 15 minutes','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([ics],{type:'text/calendar'})); a.download='plate-zero.ics';
  document.body.appendChild(a); a.click(); a.remove();
}
