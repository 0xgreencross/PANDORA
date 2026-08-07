/*CORE-BEGIN*/
/* ---------- seeded RNG (mulberry32) ---------- */
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

/* ---------- seeded perlin noise (2D) ---------- */
function makePerlin(rng){
  const perm=new Uint8Array(256); for(let i=0;i<256;i++)perm[i]=i;
  for(let i=255;i>0;i--){ const j=(rng()*(i+1))|0; const t=perm[i];perm[i]=perm[j];perm[j]=t; }
  const p=new Uint8Array(512); for(let i=0;i<512;i++)p[i]=perm[i&255];
  const fade=t=>t*t*t*(t*(t*6-15)+10);
  const lerp=(a,b,t)=>a+t*(b-a);
  function grad(h,x,y){ switch(h&7){case 0:return x+y;case 1:return -x+y;case 2:return x-y;case 3:return -x-y;case 4:return x;case 5:return -x;case 6:return y;default:return -y;} }
  return function(x,y){
    const X=Math.floor(x)&255, Y=Math.floor(y)&255;
    x-=Math.floor(x); y-=Math.floor(y);
    const u=fade(x), v=fade(y);
    const aa=p[p[X]+Y], ba=p[p[X+1]+Y], ab=p[p[X]+Y+1], bb=p[p[X+1]+Y+1];
    return lerp(lerp(grad(aa,x,y),grad(ba,x-1,y),u),
                lerp(grad(ab,x,y-1),grad(bb,x-1,y-1),u),v);
  };
}

/* ---------- palettes (gradient stops + extreme/glitch colors) ---------- */
const hex = h => [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];

/* ============================================================================
   GENESIS COLORWAYS — infinite procedural neon palettes, deterministic per
   seed. Hue anchors walk the wheel by golden-ratio jumps; saturation pinned
   fluorescent-high; value ramps from void-black to white heat. No two seeds
   share a colorway.
   ========================================================================== */
function hsv2rgb(h,s,v){
  h=((h%1)+1)%1; const i=(h*6)|0, f=h*6-i;
  const p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s);
  let r,g,b;
  switch(i%6){case 0:r=v;g=t;b=p;break;case 1:r=q;g=v;b=p;break;case 2:r=p;g=v;b=t;break;
    case 3:r=p;g=q;b=v;break;case 4:r=t;g=p;b=v;break;default:r=v;g=p;b=q;}
  return [(r*255)|0,(g*255)|0,(b*255)|0];
}
const toHex=c=>'#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');
function genesisScheme(seed){
  const r=mulberry32((seed^0x5EEDC01A)>>>0);
  const GOLD=0.61803398875;
  let h=r();
  const nA=2+(r()*3|0);                        // 2-4 fluorescent anchors
  const anchors=[];
  for(let i=0;i<nA;i++){
    anchors.push(hsv2rgb(h, 0.86+r()*0.14, 0.9+r()*0.1));
    h+=GOLD+(r()-0.5)*0.12;                    // golden-ratio hue walk + jitter
  }
  const baseHue=r();
  const stops=[ toHex(hsv2rgb(baseHue,0.5+r()*0.4,0.02+r()*0.03)) ];   // tinted void
  stops.push( toHex(hsv2rgb(anchors.length?baseHue:0, 0.8, 0.10+r()*0.10)) );
  for(let i=0;i<nA;i++) stops.push(toHex(anchors[i]));
  if(r()<0.55) stops.push(toHex(hsv2rgb(h,0.55+r()*0.35,1)));           // saturated hot tip (no white)
  const glitch=anchors.map(toHex); glitch.push(toHex(hsv2rgb(h+GOLD,0.9,1))); glitch.push(stops[0]);
  return {stops, glitch, genesis:true, fam:(anchors.length?((Math.atan2(anchors[0][1]-128,anchors[0][0]-128)+4)%6|0):0)};
}
/* ============================================================================
   TIS∞ — the TIME IS SCAM generative palette rules, ported verbatim from
   timeisscam.art buildPalette(). Five families: MONO+ALARM, NEON DUO,
   SPLIT TRIO, TRIADIC ACID, ANALOGOUS RUSH. Roles: bg ink dim acc1 acc2
   alarm shade. Deterministic per seed; family = the seed's own roll.
   ========================================================================== */
function hslToRgb(h,s,l){
  h=((h%360)+360)%360; s/=100; l/=100;
  const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs(((h/60)%2)-1)), m=l-c/2;
  let r,g,b;
  if(h<60){r=c;g=x;b=0;}else if(h<120){r=x;g=c;b=0;}
  else if(h<180){r=0;g=c;b=x;}else if(h<240){r=0;g=x;b=c;}
  else if(h<300){r=x;g=0;b=c;}else{r=c;g=0;b=x;}
  return [Math.round((r+m)*255),Math.round((g+m)*255),Math.round((b+m)*255)];
}
const TIS_FAMILIES=['MONO+ALARM','NEON DUO','SPLIT TRIO','TRIADIC ACID','ANALOGOUS RUSH'];
function tisScheme(seed){
  const rr=mulberry32((seed^0x715C0DE5)>>>0);
  const n=x=>(rr()*x)|0, chance=p=>rr()*100<p;
  const fam=n(5);
  const B=n(360);
  const neon=h=>[((h%360)+360)%360, 92+n(9), 53+n(8)];
  const bone=[36+n(12), 12+n(8), 78+n(8)];
  const alarmHue=n(26);                                 // red..orange
  let acc1, acc2, alarm=neon(alarmHue);
  if(fam===0){ acc1=neon(alarmHue); acc2=[alarmHue,88,38]; }
  else if(fam===1){ acc1=neon(B); acc2=neon(B+180); }
  else if(fam===2){ acc1=neon(B); acc2=neon(B+150); alarm=neon(B+210); }
  else if(fam===3){ acc1=neon(B); acc2=neon(B+120); alarm=neon(B+240); }
  else { acc1=neon(B); acc2=neon(B+30); }
  const bg=chance(55)?[B,16,3+n(3)]:[240,10,3+n(2)];
  const dim=[bone[0],10,34+n(10)];
  const shade=[bg[0],Math.min(40,bg[1]+10),bg[2]+6];
  const roles=[bg,bone,dim,acc1,acc2,alarm,shade].map(c=>hslToRgb(c[0],c[1],c[2]));
  const lum=c=>0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
  /* doctrine gate: same sanitizer every fixed scheme passes at load — TIS's
     near-white bone ink gets pulled to its saturated identity, rules intact */
  let stops=roles.slice().sort((a,b)=>lum(a)-lum(b)).map(toHex);
  stops=stops.map((st,i)=>deWhiteHex(st, i?stops[i-1]:null));
  const glitch=[roles[3],roles[4],roles[5],roles[1],roles[0]].map(toHex)
    .map(st=>deWhiteHex(st, stops[stops.length-1]));
  return {stops, glitch, genesis:true, fam:'T'+fam, famName:TIS_FAMILIES[fam]};
}
const SCHEMES = {
  DITHERVOID:{ stops:['#050507','#0b0030','#7a0050','#ff1f9c','#19f0ff','#e8ff2e','#fbfff0'],
               glitch:['#ff1f9c','#19f0ff','#e8ff2e','#ffffff','#04030a'] },
  TOXIC:     { stops:['#02050a','#06210f','#0a5d2b','#39ff14','#b6ff3a','#eaffea'],
               glitch:['#39ff14','#b6ff3a','#00ffd5','#ffffff','#02060a'] },
  INFRARED:  { stops:['#070202','#2a0306','#7a0410','#ff2a1a','#ff7a00','#ffe08a','#fff6e8'],
               glitch:['#ff2a1a','#ff7a00','#ffd000','#ffffff','#0a0202'] },
  VAPOR:     { stops:['#0a0418','#2a0a4a','#7a1f8c','#ff5fc8','#5fd0ff','#aeffff','#fff2ff'],
               glitch:['#ff5fc8','#5fd0ff','#c08bff','#ffffff','#0a0418'] },
  ULTRAVIO:  { stops:['#030212','#170a52','#3a1fb0','#6a5cff','#19c6ff','#9bffff','#f4f0ff'],
               glitch:['#6a5cff','#19c6ff','#c64bff','#ffffff','#030212'] },
  BONE:      { stops:['#040406','#1c1c22','#42424c','#8a8a96','#c8c8d0','#ffffff'],
               glitch:['#ffffff','#c8c8d0','#000000','#9a9aa6','#1c1c22'] },
  ACIDBURN:  { stops:['#020602','#0a3300','#3fbf00','#aaff00','#eaff00','#ffff8a','#ffffe8'],
               glitch:['#aaff00','#eaff00','#39ff14','#ffffff','#020602'] },
  HOTLINE:   { stops:['#0c0212','#3a005a','#b3009c','#ff2fd6','#ff71ce','#ffb3f6','#fff0fc'],
               glitch:['#ff2fd6','#ff71ce','#b967ff','#ffffff','#0c0212'] },
  LAZER:     { stops:['#02040c','#001a66','#0044ff','#00aaff','#00ffee','#8affff','#eaffff'],
               glitch:['#00aaff','#00ffee','#0044ff','#ffffff','#02040c'] },
  NUKEGLOW:  { stops:['#060402','#4a2a00','#c66a00','#ff9500','#ffd000','#ffff2e','#fffbe0'],
               glitch:['#ff9500','#ffd000','#ffff2e','#ffffff','#060402'] },
  POISONFROG:{ stops:['#020208','#003a4a','#00c2a0','#2eff9e','#c8ff2e','#ff2fd6','#fff2ff'],
               glitch:['#2eff9e','#ff2fd6','#c8ff2e','#ffffff','#020208'] },
  BLACKLIGHT:{ stops:['#050008','#20004a','#6a00e0','#b400ff','#ff2fff','#ff9eff','#ffeaff'],
               glitch:['#b400ff','#ff2fff','#6a00e0','#ffffff','#050008'] },
  EMBERGRID: { stops:['#080202','#4a0010','#e00040','#ff2e6a','#ff7a2e','#ffe02e','#fff6e0'],
               glitch:['#ff2e6a','#ff7a2e','#ffe02e','#ffffff','#080202'] },
  CATHODE:   { stops:['#010401','#003300','#00aa00','#00ff41','#7aff9e','#e0ffe8'],
               glitch:['#00ff41','#7aff9e','#00aa00','#ffffff','#010401'] },

  /* TIME IS SCAM colorways — imported from timeisscam.art */
  KENNE:{ stops:['#000000','#1d1f2e','#690999','#e3058c','#f8057a','#4ab144'],
               glitch:['#f8057a','#e3058c','#690999','#4ab144','#000000'] },
  AIRNEON:{ stops:['#101010','#7100d9','#ff00c8','#0ea1f0','#00ff00','#5dffff'],
               glitch:['#00ff00','#ff00c8','#0ea1f0','#7100d9','#101010'] },
  DES:{ stops:['#091020','#510087','#ff00e0','#00fa00','#86ffff'],
               glitch:['#ff00e0','#00fa00','#510087','#86ffff','#091020'] },
  NEONMONY:{ stops:['#050508','#212121','#441cf4','#644aaa','#e613aa','#3ec819','#0ff107','#0dffff'],
               glitch:['#0dffff','#0ff107','#441cf4','#e613aa','#050508'] },
  MGC:{ stops:['#050508','#212121','#ff00c8','#00ff00','#5dffff'],
               glitch:['#00ff00','#ff00c8','#5dffff','#212121','#050508'] },
  POLE:{ stops:['#000000','#0926ee','#ff00ff','#ff7700','#00ff74'],
               glitch:['#00ff74','#ff7700','#ff00ff','#0926ee','#000000'] },
  FAUXRGB:{ stops:['#000000','#8700ff','#ff0085','#ff00ff','#00ff00','#00ffff'],
               glitch:['#00ffff','#00ff00','#ff00ff','#ff0085','#000000'] },
  TRUERGB:{ stops:['#060606','#0000ff','#ff0000','#00ff00'],
               glitch:['#00ff00','#ff0000','#0000ff','#060606','#060606'] },
  XPASTE:{ stops:['#020210','#09081a','#1e152b','#722fcd','#f93e9e','#99f8b5'],
               glitch:['#f93e9e','#722fcd','#99f8b5','#1e152b','#020210'] },
  DOE:{ stops:['#000000','#222c33','#c200a2','#0994ee','#00c374'],
               glitch:['#0994ee','#00c374','#c200a2','#222c33','#000000'] },
  TISNUKE:{ stops:['#050508','#292629','#5529ed','#ef472b','#f2882f','#f1da2e'],
               glitch:['#ef472b','#5529ed','#f1da2e','#f2882f','#050508'] },
};
/* NO-WHITE DOCTRINE: strip the white component from any pale stop and
   renormalize its residual hue to full saturation — ramp tops go HOT, not pale.
   (Pure greys inherit the previous stop's hue; last resort is brand magenta.) */
function deWhiteHex(h6, prevH6){
  const c=hex(h6); const m=Math.min(c[0],c[1],c[2]);
  if(m<=160)return h6;
  let sat=[c[0]-m,c[1]-m,c[2]-m];
  let mx=Math.max(sat[0],sat[1],sat[2]);
  if(mx<12&&prevH6){ const p=hex(prevH6); const pm=Math.min(p[0],p[1],p[2]);
    sat=[p[0]-pm,p[1]-pm,p[2]-pm]; mx=Math.max(sat[0],sat[1],sat[2]); }
  if(mx<12){ sat=[255,31,156]; mx=255; }
  const k=255/mx;
  return toHex(sat.map(v=>{v=(v*k)|0; return v>255?255:v;}));
}
for(const key in SCHEMES){ const sc=SCHEMES[key];
  sc.stops=sc.stops.map((st,i)=>deWhiteHex(st, i?sc.stops[i-1]:null));
  sc.glitch=sc.glitch.map(st=>deWhiteHex(st, sc.stops[sc.stops.length-1]));
}
const SCHEME_KEYS = Object.keys(SCHEMES);
const MODES = ['MOLTEN','LATHE','ENGRAVED','BROADCAST','GRID','SATELLITE','SEDIMENT','VEINED','MASS','IDOL'];

/* build a 256-entry smooth gradient LUT from stops */
function buildGradient(stops){
  const cols = stops.map(hex);
  const lut = new Uint8Array(256*3);
  const seg = cols.length-1;
  for(let i=0;i<256;i++){
    const f=i/255*seg; let a=Math.floor(f); if(a>=seg)a=seg-1; const t=f-a;
    const c0=cols[a], c1=cols[a+1];
    lut[i*3]  = (c0[0]+(c1[0]-c0[0])*t)|0;
    lut[i*3+1]= (c0[1]+(c1[1]-c0[1])*t)|0;
    lut[i*3+2]= (c0[2]+(c1[2]-c0[2])*t)|0;
  }
  return lut;
}
/* build a small power-of-two palette (gradient samples + glitch extremes) + nearest LUT */
function buildPalette(scheme, vibe){
  let grad = buildGradient(scheme.stops);
  if(vibe){                                     // per-seed tone curve on the gradient
    const g2=new Uint8Array(768), nb=vibe.gradBands;
    for(let i=0;i<256;i++){
      let j=Math.round(255*Math.pow(i/255, vibe.gradGamma));
      if(nb) j=Math.round(Math.round(j/255*(nb-1))/(nb-1)*255);
      if(j<0)j=0; if(j>255)j=255;
      g2[i*3]=grad[j*3]; g2[i*3+1]=grad[j*3+1]; g2[i*3+2]=grad[j*3+2];
    }
    grad=g2;
  }
  for(let i=0;i<256;i++){ const o=i*3;                 // NO-WHITE hard cap
    const m=Math.min(grad[o],grad[o+1],grad[o+2]);
    if(m>160){ const k=160/m;
      grad[o]=(grad[o]*k)|0; grad[o+1]=(grad[o+1]*k)|0; grad[o+2]=(grad[o+2]*k)|0; }
  }
  const pal=[];
  const N=52;                                   // gradient samples
  for(let i=0;i<N;i++){ const g=(i/(N-1)*255)|0; pal.push([grad[g*3],grad[g*3+1],grad[g*3+2]]); }
  for(const h of scheme.glitch) pal.push(hex(h));
  while(pal.length<64) pal.push(pal[pal.length-1]); // pad to 64
  if(pal.length>64) pal.length=64;
  // nearest-color LUT over 5-5-5 RGB cube for O(1) quantization
  const near=new Uint8Array(32768);
  for(let r=0;r<32;r++)for(let g=0;g<32;g++)for(let b=0;b<32;b++){
    const R=r<<3|r>>2, G=g<<3|g>>2, B=b<<3|b>>2; let best=0,bd=1e9;
    for(let i=0;i<pal.length;i++){const p=pal[i];const dr=p[0]-R,dg=p[1]-G,db=p[2]-B;const d=dr*dr+dg*dg+db*db;if(d<bd){bd=d;best=i;}}
    near[(r<<10)|(g<<5)|b]=best;
  }
  return {grad,pal,near};
}

/* ---------- Bayer 8x8 ordered dither matrix (0..63) ---------- */
const BAYER=(()=>{const m=[[0,32,8,40,2,34,10,42],[48,16,56,24,50,18,58,26],[12,44,4,36,14,46,6,38],[60,28,52,20,62,30,54,22],[3,35,11,43,1,33,9,41],[51,19,59,27,49,17,57,25],[15,47,7,39,13,45,5,37],[63,31,55,23,61,29,53,21]];const f=new Float32Array(64);for(let y=0;y<8;y++)for(let x=0;x<8;x++)f[y*8+x]=(m[y][x]/64-0.5);return f;})();

/* ============================================================================
   GIF89a ENCODER  (global palette, Netscape loop) — LZW verified pixel-exact
   streaming writer: encodes + frees each frame as it goes (low peak memory)
   ========================================================================== */
function Sink(cap){ this.b=new Uint8Array(cap||65536); this.n=0; }
Sink.prototype.u8=function(v){ if(this.n>=this.b.length){const g=new Uint8Array(this.b.length*2);g.set(this.b);this.b=g;} this.b[this.n++]=v&0xff; };
Sink.prototype.u16=function(v){ this.u8(v); this.u8(v>>8); };
Sink.prototype.str=function(s){ for(let i=0;i<s.length;i++)this.u8(s.charCodeAt(i)); };
Sink.prototype.done=function(){ return this.b.subarray(0,this.n); };

function lzwEncode(minCodeSize, data){
  const clearCode=1<<minCodeSize, eoiCode=clearCode+1;
  let codeSize=minCodeSize+1, nextCode=clearCode+2;
  const dict=new Map(); const out=new Sink(1<<16); let cur=0,curBits=0;
  const emit=code=>{ cur|=code<<curBits; curBits+=codeSize; while(curBits>=8){out.u8(cur&0xff);cur>>>=8;curBits-=8;} };
  emit(clearCode);
  if(data.length===0){ emit(eoiCode); if(curBits>0)out.u8(cur&0xff); return out.done(); }
  let prefix=data[0];
  for(let i=1;i<data.length;i++){
    const c=data[i], key=(prefix<<8)|c, v=dict.get(key);
    if(v!==undefined){ prefix=v; }
    else{
      emit(prefix);
      if(nextCode===4096){ emit(clearCode); dict.clear(); nextCode=clearCode+2; codeSize=minCodeSize+1; }
      else{ if(nextCode>=(1<<codeSize)&&codeSize<12)codeSize++; dict.set(key,nextCode); nextCode++; }
      prefix=c;
    }
  }
  emit(prefix); emit(eoiCode); if(curBits>0)out.u8(cur&0xff); return out.done();
}
function gifBegin(sink,width,height,palette,loop){
  let bits=Math.max(1,Math.ceil(Math.log2(palette.length)));
  const size=1<<bits, pal=palette.slice(); while(pal.length<size)pal.push([0,0,0]);
  sink.str('GIF89a'); sink.u16(width); sink.u16(height);
  sink.u8(0x80|((bits-1)<<4)|(bits-1)); sink.u8(0); sink.u8(0);
  for(let i=0;i<size;i++){ sink.u8(pal[i][0]); sink.u8(pal[i][1]); sink.u8(pal[i][2]); }
  sink.u8(0x21);sink.u8(0xFF);sink.u8(0x0B);sink.str('NETSCAPE2.0');sink.u8(0x03);sink.u8(0x01);sink.u16(loop|0);sink.u8(0x00);
  return Math.max(2,bits); // minCodeSize
}
function gifFrame(sink,width,height,indices,delay,minCodeSize){
  sink.u8(0x21);sink.u8(0xF9);sink.u8(0x04);sink.u8(0x00);sink.u16(delay|0);sink.u8(0x00);sink.u8(0x00);
  sink.u8(0x2C);sink.u16(0);sink.u16(0);sink.u16(width);sink.u16(height);sink.u8(0x00);
  sink.u8(minCodeSize);
  const lzw=lzwEncode(minCodeSize,indices); let p=0;
  while(p<lzw.length){const len=Math.min(255,lzw.length-p);sink.u8(len);for(let i=0;i<len;i++)sink.u8(lzw[p+i]);p+=len;}
  sink.u8(0x00);
}
function gifEnd(sink){ sink.u8(0x3B); return sink.done(); }

/* ============================================================================
   SCENE STATE  (seeded per generation)
   ========================================================================== */
function buildScene(seed, mode, dnaOnly){
  const rng=mulberry32(seed^0x9e3779b9);
  const noise=makePerlin(rng);
  const noise2=makePerlin(mulberry32(seed^0x85ebca6b));
  // interference centers
  const centers=[]; const nc=3+(rng()*3|0);
  for(let i=0;i<nc;i++)centers.push({x:.5+(rng()-.5)*.5,y:.5+(rng()-.5)*.5,r:.18+rng()*.22,k:1+(rng()*3|0),ph:rng()*6.283,freq:14+rng()*26,sp:1+(rng()*3|0)});
  // scan traces
  const traces=[]; for(let i=0;i<3;i++)traces.push({amp:.12+rng()*.18,f:2+rng()*5,k:1+(rng()*3|0),ph:rng()*6.283,col:rng()});
  // datablock events
  const blocks=[]; const nb=8+(rng()*10|0);
  for(let i=0;i<nb;i++)blocks.push({x:(rng()*W)|0,y:(rng()*H)|0,w:60+(rng()*420|0),h:18+(rng()*120|0),
    amp:30+rng()*240,k:1+(rng()*3|0),ph:rng()*6.283,chan:(rng()*3|0)});
  // pixel-sort bands
  const bands=[]; const ns=4+(rng()*6|0);
  for(let i=0;i<ns;i++)bands.push({y:(rng()*H)|0,h:20+(rng()*90|0),k:1+(rng()*3|0),ph:rng()*6.283,seg:80+(rng()*260|0)});
  // tracking tear rows
  const tears=[]; const nt=2+(rng()*4|0);
  for(let i=0;i<nt;i++)tears.push({y:rng(),k:1+(rng()*3|0),ph:rng()*6.283,amp:20+rng()*70});
  // plasma params
  const plasma={s:1.4+rng()*2.2, warp:1.2+rng()*2.0, orbit:.4+rng()*.7, rot:rng()*6.283, oct:3+(rng()*2|0)};

  // ---- heavy-corruption params (all integer-k so every envelope is 2π-periodic) ----
  const TAU=6.283185307179586;
  const waves=[]; for(let i=0;i<4;i++)waves.push({freq:0.004+rng()*0.03, amp:8+rng()*60, k:1+(rng()*3|0), ph:rng()*TAU});
  const mosh=[]; const nm=10+(rng()*14|0);
  for(let i=0;i<nm;i++)mosh.push({sx:(rng()*W)|0,sy:(rng()*H)|0,dx:(rng()*W)|0,dy:(rng()*H)|0,w:40+(rng()*220|0),h:40+(rng()*220|0),k:1+(rng()*3|0),ph:rng()*TAU});
  const invBands=[]; const ni=3+(rng()*5|0);
  for(let i=0;i<ni;i++)invBands.push({y:(rng()*H)|0,h:24+(rng()*140|0),k:1+(rng()*3|0),ph:rng()*TAU,mode:(rng()*3|0)});
  const slices=[]; const nsl=6+(rng()*10|0);
  for(let i=0;i<nsl;i++)slices.push({y:(rng()*H)|0,h:10+(rng()*70|0),amp:40+rng()*420,k:1+(rng()*3|0),ph:rng()*TAU});
  const dropouts=[]; const nd=5+(rng()*9|0);
  for(let i=0;i<nd;i++)dropouts.push({x:(rng()*W)|0,y:(rng()*H)|0,w:30+(rng()*260|0),h:14+(rng()*120|0),k:1+(rng()*3|0),ph:rng()*TAU,white:rng()<0.3});
  const ghost={dx:(rng()<.5?-1:1), dy:(rng()<.5?-1:1), k:1+(rng()*2|0), ph:rng()*TAU, amp:6+rng()*30};
  const vroll={k:1+(rng()*3|0), ph:rng()*TAU, amp:30+rng()*200};
  const melt={k:1+(rng()*2|0), ph:rng()*TAU};
  const bleed={k:1+(rng()*2|0), ph:rng()*TAU};
  const crush={k:1+(rng()*3|0), ph:rng()*TAU};
  const extra={waves,mosh,invBands,slices,dropouts,ghost,vroll,melt,bleed,crush};

  // ---- OBLIVION channels (invented) — seeded fields + integer-k phases ----
  const CF=136; const chronoField=dnaOnly?null:new Float32Array(CF*CF);
  if(!dnaOnly)for(let y=0;y<CF;y++)for(let x=0;x<CF;x++){let v=noise2(x*0.06,y*0.06); if(v>1)v=1; if(v<-1)v=-1; chronoField[y*CF+x]=v;}
  const MC=30; const metaField=dnaOnly?null:new Float32Array(MC*MC), metaGid=dnaOnly?null:new Uint8Array(MC*MC);
  for(let cy=0;cy<MC;cy++)for(let cx=0;cx<MC;cx++){
    const gv=(rng()*8)|0;                                   // rng stream preserved
    if(!dnaOnly){
      let v=noise(cx*0.33+7.7,cy*0.33+3.1)*0.5+0.5; if(v<0)v=0; if(v>1)v=1;
      metaField[cy*MC+cx]=v; metaGid[cy*MC+cx]=gv;
    }
  }
  const PL=34, TL=135;
  const tk=new Uint8Array(PL*PL), tph=new Float32Array(PL*PL);
  for(let i=0;i<PL*PL;i++){tk[i]=1+(rng()*3|0); tph[i]=rng()*TAU;}
  const extra2={
    chrono:{k:1+(rng()*2|0), ph:rng()*TAU, CF, field:chronoField},
    mirror:{fx:0.006+rng()*0.02, fy:0.006+rng()*0.02, k:1+(rng()*2|0), ph:rng()*TAU, sinX:null, cosX:null},
    flay:{k:1+(rng()*2|0), ph:rng()*TAU},
    autoph:{k:1+(rng()*2|0), ph:rng()*TAU},
    weave:{k:1+(rng()*2|0), ph:rng()*TAU},
    entropy:{k:1+(rng()*3|0), ph:rng()*TAU},
    meta:{k:1+(rng()*2|0), ph:rng()*TAU, MC, field:metaField, gid:metaGid},
    tect:{k:tk, ph:tph, PL, TL,
      pox:new Int8Array(PL*PL), poy:new Int8Array(PL*PL),
      ox:new Int8Array(TL*TL), oy:new Int8Array(TL*TL), fb:new Uint8Array(TL*TL)}
  };

  // ---- PER-SEED PERSONALITY ("vibe"): every stage draws its own waveform
  //      shape, tempo, orientation, spatial frequency and gain, so the same
  //      toggle combo reads differently on every seed. ----
  const shape4=()=>{const t=rng(); return t<0.4?0:(t<0.7?1:(t<0.9?2:3));};
  const g={};
  for(const ch of ['chroma','tracking','pixelsort','grain','blocks','wave','slice','vroll','mosh','ghost','melt','bleed','invert','crush','dropout','chrono','mirror','flay','autoph','weave','entropy','meta','tect','panes','hilb','splice','moire','braid','lungs','tunnel','kaleido','bloom','embers','runes','chimera'])
    g[ch]=0.45+rng()*1.45;
  const vibe={
    g,
    trackOn:rng()<0.88, trackF:0.008+rng()*0.085, trackK:1+(rng()*4|0), trackPh:rng()*TAU,
    trackShape:shape4(), trackMul:0.25+rng()*1.9, trackStep: rng()<0.35 ? 4+(rng()*22|0) : 0,
    agcOn:rng()<0.8, agcK:1+(rng()*3|0), agcPh:rng()*TAU, agcF:0.004+rng()*0.028,
    agcAmp:0.04+rng()*0.15, agcVert:rng()<0.3,
    chromaAng:rng()*TAU, chromaK:1+(rng()*4|0), chromaPh:rng()*TAU, chromaShape:shape4(),
    grainStat:rng()<0.25,                    // some seeds: static (per-loop frozen) grain
    gradGamma:0.6+rng()*1.1,
    gradBands: rng()<0.3 ? 3+(rng()*5|0) : 0,
    ditherMul:0.5+rng()*1.1,
    echoN:3+(rng()*4|0), echoDecay:0.45+rng()*0.35
  };
  // per-wave personality for the sync-ripple channel (orientation + waveform)
  for(const w of waves){ w.shape=shape4(); w.vert=rng()<0.32; w.harm=rng()<0.4?2+(rng()*2|0):1; }

  // ---- VALHALLA channel params ----
  // pane rapture: seeded voronoi shards, rigid drift + lift
  const PW=270, NC=14+(rng()*26|0);
  const pcx=new Float32Array(NC), pcy=new Float32Array(NC);
  const pk=new Uint8Array(NC), pph=new Float32Array(NC),
        pax=new Float32Array(NC), pay=new Float32Array(NC), plift=new Float32Array(NC);
  for(let i=0;i<NC;i++){pcx[i]=rng()*PW;pcy[i]=rng()*PW;pk[i]=1+(rng()*4|0);pph[i]=rng()*TAU;
    pax[i]=(rng()-0.5)*80;pay[i]=(rng()-0.5)*80;plift[i]=rng()*44;}
  const cellId=dnaOnly?null:new Uint8Array(PW*PW), seam=dnaOnly?null:new Uint8Array(PW*PW);
  if(!dnaOnly){
    for(let y=0;y<PW;y++)for(let x=0;x<PW;x++){
      let best=0,bd=1e9;
      for(let i=0;i<NC;i++){const dx=x-pcx[i],dy=y-pcy[i];const d=dx*dx+dy*dy;if(d<bd){bd=d;best=i;}}
      cellId[y*PW+x]=best;
    }
    for(let y=0;y<PW;y++)for(let x=0;x<PW;x++){
      const c=cellId[y*PW+x];
      if((x+1<PW&&cellId[y*PW+x+1]!==c)||(y+1<PW&&cellId[(y+1)*PW+x]!==c))seam[y*PW+x]=1;
    }
  }
  // hilbert crawl / dna splice / self-moire / time braid / raster lungs
  const lungPhase=dnaOnly?null:new Float32Array(W);
  {const f=0.004+rng()*0.02, sp=1.5+rng()*4;
   if(!dnaOnly)for(let x=0;x<W;x++){let v=noise(x*f+11.3,4.7); if(v>1)v=1; if(v<-1)v=-1; lungPhase[x]=v*sp;}}
  const valhalla={
    panes:{PW,NC,cellId,seam,pk,pph,pax,pay,plift,shape:shape4()},
    hilb:{k:1+(rng()*3|0),ph:rng()*TAU,shape:shape4(),dir:rng()<0.5?1:-1},
    splice:{k:1+(rng()*3|0),ph:rng()*TAU,shape:shape4()},
    moire:{k:1+(rng()*3|0),ph:rng()*TAU,k2:1+(rng()*2|0),ph2:rng()*TAU,thr:90+(rng()*70|0),shape:shape4()},
    braid:{k:1+(rng()*2|0),ph:rng()*TAU},
    lungs:{k:1+(rng()*3|0),ph:rng()*TAU,h0:(0.3+rng()*0.4)*H,amp:0.06+rng()*0.22,phase:lungPhase,shape:shape4()}
  };

  // ---- REV 4: motion grammar + palette strategy + composition + pass order ----
  const shuf=a=>{const r=a.slice();for(let i=r.length-1;i>0;i--){const j=(rng()*(i+1))|0;const t=r[i];r[i]=r[j];r[j]=t;}return r;};
  const strobes=[]; if(rng()<0.3){const ns=1+(rng()*2|0); for(let i=0;i<ns;i++)strobes.push({pos:rng()*TAU,type:rng()<0.5?0:1});}
  const motion={
    quant: rng()<0.25 ? 5+(rng()*9|0) : 0,             // stop-motion time steps
    tw: rng()<0.5 ? 0 : 0.25+rng()*0.6,                // time-warp depth (speed ramping)
    twk:1+(rng()*2|0), twph:rng()*TAU,
    strobes
  };
  const palRoll=rng();
  const palMode = palRoll<0.5 ? 0 : (palRoll<0.7 ? 1 : 2); // 0 gradient, 1 duotone, 2 hue-cycle
  if(palMode===1){ vibe.gradBands=2+(rng()*2|0); vibe.gradGamma*=0.8; }
  const palCycles=1+(rng()*3|0);
  const mask={
    type: rng()<0.5 ? 0 : 1+(rng()*30|0),              // 0 none | 30-shape catalog
    cx:0.3+rng()*0.4, cy:0.3+rng()*0.4, size:0.2+rng()*0.28,
    k:1+(rng()*2|0), ph:rng()*TAU, style:(rng()*20|0)  // 20-style treatment library
  };
  const lattice={gs:44+(rng()*84|0), lw:2+(rng()*5|0), thr:0.3+rng()*0.35, k:1+(rng()*3|0), sp:0.35+rng()*0.9, ph:rng()*TAU};
  const figScale = rng()<0.3 ? 0.4+rng()*0.3 : 1;   // 30% of seeds: small figure, vast void
  const orbs=[]; const nOrb=2+(rng()*7|0);            // 2-8 natural; TUNE can push to 50
  for(let i=0;i<nOrb;i++)orbs.push({ax:0.14+rng()*0.28, ay:0.14+rng()*0.28, kx:1+(rng()*3|0), ky:1+(rng()*3|0),
    phx:rng()*TAU, phy:rng()*TAU, r:(0.09+rng()*0.18)*figScale, form:(rng()*30|0)});
  const strata={bh:0.035+rng()*0.085, f:2+rng()*7, amp:0.05+rng()*0.18, k:1+(rng()*3|0)};
  const tendr={cx:0.36+rng()*0.28, cy:0.36+rng()*0.28, n:3+(rng()*7|0), k:1+(rng()*2|0), k2:1+(rng()*3|0), R0:(0.26+rng()*0.28)*figScale, m:2+(rng()*5|0)};
  const order={
    heavy:shuf(['wave','slice','vroll','mosh','ghost','melt','bleed','invert','crush','dropout']),
    obl:shuf(['weave','entropy','autoph','meta']),
    val:shuf(['panes','hilb','splice','lungs','moire'])
  };
  const rev4={motion,palMode,palCycles,mask,lattice,orbs,strata,tendr,order};

  // ---- DEMIURGE channel params (REV 6) ----
  const tunnel={rot:(rng()-0.5)*0.55, zoom:1.07+rng()*0.15, decay:0.66+rng()*0.22, taps:6};
  const kaleido={folds:3+(rng()*6|0), k:1+(rng()*2|0), ph:rng()*TAU,
    cx:W*(0.44+rng()*0.12), cy:H*(0.44+rng()*0.12)};
  const bloom={thr:140+(rng()*70|0), rad:2+(rng()*3|0), gain:0.55+rng()*0.75};
  const embersArr=[]; const nEm=350+(rng()*850|0);
  for(let i=0;i<nEm;i++){
    embersArr.push({cx:rng()*W, cy:rng()*H,
      r1:20+rng()*160, k1:1+(rng()*3|0), p1:rng()*TAU,
      r2:8+rng()*60,  k2:1+(rng()*4|0), p2:rng()*TAU,
      r3:20+rng()*160, k3:1+(rng()*3|0), p3:rng()*TAU,
      r4:8+rng()*60,  k4:1+(rng()*4|0), p4:rng()*TAU,
      col:rng(), sz:1+(rng()*2|0)});
  }
  const runeRows=[]; const nRows=1+(rng()*3|0);
  for(let i=0;i<nRows;i++){
    const len=10+(rng()*14|0), glyphs=[];
    for(let gI=0;gI<len;gI++){const bits=new Uint8Array(35);
      for(let b=0;b<35;b++)bits[b]=rng()<0.42?1:0; glyphs.push(bits);}
    runeRows.push({y:(rng()*0.85*H)|0, s:26+(rng()*40|0), speed:(1+(rng()*2|0))*(rng()<0.5?1:-1),
      glyphs, k:1+(rng()*2|0), ph:rng()*TAU});
  }
  const demi={tunnel,kaleido,bloom,embers:embersArr,runes:runeRows};

  // ---- per-seed alphabet ----
  const glyphset=makeGlyphSet(rng);

  // ---- CHIMERA: a compiled effect unique to this seed. 2-4 atomic ops, each
  //      = region selector x transform x rhythm envelope. The combination space
  //      is effectively unrepeatable; the op list IS the effect. ----
  const chimeraOps=[]; const nOps=2+(rng()*3|0);
  for(let i=0;i<nOps;i++){
    const op={ sel:(rng()*6)|0, tr:(rng()*8)|0, shape:shape4(),
      k:1+(rng()*3|0), ph:rng()*TAU, gate:0.1+rng()*0.35,
      p1:rng(), p2:rng(), p3:rng(), mask:null };
    if(op.sel===5 && !dnaOnly){                            // seeded patch mask (coarse)
      const CM=136, m=new Uint8Array(CM*CM), f=0.05+op.p1*0.08, th=op.p2*0.6-0.3;
      for(let y=0;y<CM;y++)for(let x=0;x<CM;x++)m[y*CM+x]=noise(x*f+i*13.7,y*f+i*7.1)>th?1:0;
      op.mask=m;
    }
    chimeraOps.push(op);
  }

  return {rng,noise,noise2,centers,traces,blocks,bands,tears,plasma,extra,extra2,vibe,valhalla,rev4,demi,
    glyphset, chimeraOps, seed: seed>>>0,
    mode: mode==='RANDOM' ? MODES[(rng()*MODES.length)|0] : mode };
}

/* waveform shaper: bends a signed sine into pulse / square-ish / folded rhythms.
   Pure function of its input, so periodicity (and loop seams) are preserved. */
function shp(s,t){
  if(t===1) return s*s*s;
  if(t===2){ const a=s<0?-s:s; return (s<0?-1:1)*Math.pow(a,0.35); }
  if(t===3){ const a=s<0?-s:s; return s*(1.8-1.6*a); }
  return s;
}

/* ---------- glyph atlas (5x7) for GLYPHS mode ---------- */
/* ============================================================================
   GLYPH GRAMMARS — every seed mints its own alphabet. One grammar family per
   scene (coherent script), 10-14 characters synthesized within it:
   0 GEOMETRIC (mirror-symmetric emblems)   1 CIRCUIT (orthogonal trace walks)
   2 ORGANIC (dilated blobs)                3 RELIC (spine+crossbar ornaments)
   4 DENSE (texture with symmetric voids)
   ========================================================================== */
function makeGlyph(fam,rng){
  const a=new Uint8Array(35);
  const put=(x,y)=>{ if(x>=0&&x<5&&y>=0&&y<7)a[y*5+x]=1; };
  if(fam===0){
    for(let y=0;y<7;y++)for(let x=0;x<3;x++){const v=rng()<0.45?1:0; a[y*5+x]=v; a[y*5+(4-x)]=v;}
    if(rng()<0.5)for(let y=0;y<3;y++)for(let x=0;x<5;x++)a[(6-y)*5+x]=a[y*5+x];
  } else if(fam===1){
    let x=(rng()*5)|0, y=(rng()*7)|0; put(x,y);
    const steps=10+(rng()*14|0);
    for(let i=0;i<steps;i++){
      if(rng()<0.5)x+=rng()<0.5?1:-1; else y+=rng()<0.5?1:-1;
      x=x<0?0:x>4?4:x; y=y<0?0:y>6?6:y; put(x,y);
      if(rng()<0.15)put(x+(rng()<0.5?1:-1), y);
    }
  } else if(fam===2){
    for(let i=0;i<2+(rng()*2|0);i++)put((rng()*5)|0,(rng()*7)|0);
    for(let d=0;d<2;d++){const b=a.slice();
      for(let y=0;y<7;y++)for(let x=0;x<5;x++){
        if(!b[y*5+x])continue;
        if(rng()<0.6)put(x+1,y); if(rng()<0.6)put(x-1,y);
        if(rng()<0.6)put(x,y+1); if(rng()<0.6)put(x,y-1);
      }}
  } else if(fam===3){
    const cy=1+(rng()*4|0);
    for(let y=0;y<7;y++)if(rng()<0.85)a[y*5+2]=1;
    for(let x=0;x<5;x++)if(rng()<0.85)a[cy*5+x]=1;
    for(let i=0;i<3;i++){const ox=(rng()*2)|0, oy=(rng()*7)|0; a[oy*5+ox]=1; a[oy*5+(4-ox)]=1;}
  } else {
    for(let i=0;i<35;i++)a[i]=rng()<0.78?1:0;
    for(let i=0;i<4;i++){const x=(rng()*3)|0, y=(rng()*7)|0; a[y*5+x]=0; a[y*5+(4-x)]=0;}
  }
  let c=0; for(let i=0;i<35;i++)c+=a[i];
  if(c<4){ a[12]=1;a[16]=1;a[17]=1;a[18]=1;a[22]=1; }     // never blank by accident
  return a;
}
function makeGlyphSet(rng){
  const fam=(rng()*5)|0;
  const set=[new Uint8Array(35)];                          // index 0 stays blank
  const n=9+(rng()*5|0);
  for(let g=0;g<n;g++)set.push(makeGlyph(fam,rng));
  return set;
}

/* ============================================================================
   BASE RENDER  (writes full-res rgb Uint8Array)
   ========================================================================== */
function famMat(scene){
  /* ten material dialects on one stage — the old modes reborn as surfaces */
  if(scene._fmat)return scene._fmat;
  const rng=mulberry32((scene.seed^0x7A8)>>>0);
  const m=scene.mode;
  const base={bandF:16+rng()*18, bandA:0.12, bandAxis:0, cellF:10+rng()*10, cellA:0.07,
    cellSharp:0, warp:0.4+rng()*0.8, veinA:0, scanRoll:0, sparkle:0,
    crawl:(rng()<0.5?-1:1)*(0.6+rng()*0.9), expo:1.08+rng()*0.30, fogA:0.22+rng()*0.22};
  const D={
    MOLTEN:   {warp:2.4+rng()*1.6, bandA:0.15, bandF:8+rng()*8, cellA:0.04},
    LATHE:    {bandAxis:1, bandF:22+rng()*20, bandA:0.17, cellA:0.03},
    ENGRAVED: {cellSharp:1, cellA:0.16, cellF:14+rng()*12, bandA:0.05},
    BROADCAST:{bandF:44+rng()*30, bandA:0.20, scanRoll:1, cellA:0.03},
    GRID:     {bandAxis:2, bandF:20+rng()*14, bandA:0.15, cellA:0.05},
    SATELLITE:{sparkle:0.9, bandA:0.05, cellA:0.04},
    SEDIMENT: {bandF:9+rng()*6, bandA:0.22, cellA:0.06},
    VEINED:   {veinA:0.24+rng()*0.12, bandA:0.05, cellA:0.04},
    MASS:     {},
    IDOL:     {}
  };
  return scene._fmat=Object.assign(base, D[m]||{});
}
const SW=(typeof PVSW!=='undefined'?PVSW:448), FLY=1.06;   /* preview may shrink the shading field; production is always 448 */
function sceneView(scene, theta){
  /* THE STAGE: body + mirror floor + void, marched per frame at VG,
     reflections and contact shadow included. */
  const mf=massField(scene);
  mf.mat=mf.mat||matOf(scene);
  mf.tearAmp=((scene._corr!=null?scene._corr:60)/100)*0.045;
  if(mf._svt===theta)return mf._sv;
  mf._svt=theta;
  const VG=(typeof PVVG!=='undefined'?PVVG:88), S=mf.S, sdf=mf.sdf, C=eCam(mf,theta);
  const M=VG*VG;
  const sv=mf._sv||(mf._sv={kind:new Uint8Array(M),nx:new Float32Array(M),ny:new Float32Array(M),
    nz:new Float32Array(M),px:new Float32Array(M),py:new Float32Array(M),pz:new Float32Array(M),
    dp:new Float32Array(M),ao:new Float32Array(M),rf:new Float32Array(M),VG});
  const hasFloor=mf.hasFloor;   /* decided in massField now — the camera has to respect it */
  const laz=mf.cam.lightSpin*theta+mf.lightBase+0.6;   /* lightSpin!==0 only for the LOCKED camera, where the light is what moves */
  const lx=Math.cos(0.6)*Math.cos(laz), ly=-Math.sin(0.6), lz=Math.cos(0.6)*Math.sin(laz);
  const t0=C.dist-0.95*Math.max(1,S), t1=C.dist+1.6*Math.max(1,S);
  for(let gy=0;gy<VG;gy++){
    const syc=(gy/VG-0.5)*2*C.fov;
    for(let gx=0;gx<VG;gx++){
      const gi=gy*VG+gx, sxc=(gx/VG-0.5)*2*C.fov;
      let dx=C.fx+C.rx*sxc+C.ux*syc, dy=C.fy+C.ry*sxc+C.uy*syc, dz=C.fz+C.rz*sxc+C.uz*syc;
      const dl=Math.hypot(dx,dy,dz); dx/=dl;dy/=dl;dz/=dl;
      const fold=mf.hasDrape?mf.foldAt(C.ex+dx*C.dist, C.ey+dy*C.dist, S):0;
      sv.kind[gi]=0; sv.rf[gi]=0;
      let t=t0, hit=0;
      for(let st=0;st<30;st++){
        const px=C.ex+dx*t, py=C.ey+dy*t, pz=C.ez+dz*t;
        if(py>FLY)break;
        let d=sdf(px,py,pz,S,fold);
        if(d<0.08&&mf.tearAmp) d+=surfTear(px,py,pz,theta,mf.mat,mf.tearAmp);
        if(d<0.009){
          hit=1;
          const e=0.008;
          const nx=sdf(px+e,py,pz,S,fold)-sdf(px-e,py,pz,S,fold);
          const ny=sdf(px,py+e,pz,S,fold)-sdf(px,py-e,pz,S,fold);
          const nz=sdf(px,py,pz+e,S,fold)-sdf(px,py,pz-e,S,fold);
          const nl=Math.hypot(nx,ny,nz)||1;
          sv.kind[gi]=1; sv.nx[gi]=nx/nl; sv.ny[gi]=ny/nl; sv.nz[gi]=nz/nl;
          sv.px[gi]=px; sv.py[gi]=py; sv.pz[gi]=pz; sv.dp[gi]=(t-C.dist)/Math.max(1,S);
          const dAo=sdf(px+sv.nx[gi]*0.07, py+sv.ny[gi]*0.07, pz+sv.nz[gi]*0.07, S, 0);
          sv.ao[gi]=Math.max(0.45, Math.min(1, 0.5+dAo*8));
          break;
        }
        t+=Math.max(d,0.013);
        if(t>t1)break;
      }
      if(!hit&&hasFloor&&dy>0.02){
        const tF=(FLY-C.ey)/dy;
        const fxp=C.ex+dx*tF, fzp=C.ez+dz*tF;
        if(tF>0.1&&tF<C.dist*2.4){
          sv.kind[gi]=2; sv.px[gi]=fxp; sv.py[gi]=FLY; sv.pz[gi]=fzp;
          sv.dp[gi]=(tF-C.dist)/Math.max(1,S);
          /* mirror: march the reflected ray */
          let rt=0.03, rl2=0;
          for(let st=0;st<16;st++){
            const rx2=fxp+dx*rt, ry2=FLY-dy*rt, rz2=fzp+dz*rt;
            let d2=sdf(rx2,ry2,rz2,S,fold);
            if(d2<0.09&&mf.tearAmp) d2+=surfTear(rx2,ry2,rz2,theta,mf.mat,mf.tearAmp);
            if(d2<0.012){
              const e=0.01;
              const nnx=sdf(rx2+e,ry2,rz2,S,fold)-sdf(rx2-e,ry2,rz2,S,fold);
              const nny=sdf(rx2,ry2+e,rz2,S,fold)-sdf(rx2,ry2-e,rz2,S,fold);
              const nnz=sdf(rx2,ry2,rz2+e,S,fold)-sdf(rx2,ry2,rz2-e,S,fold);
              const nl2=Math.hypot(nnx,nny,nnz)||1;
              const dif=Math.max(0,(nnx*lx+nny*ly+nnz*lz)/nl2);
              rl2=(0.18+dif*0.6)*Math.max(0.15,1-rt*0.55);
              break;
            }
            rt+=Math.max(d2,0.016);
            if(rt>2.4)break;
          }
          sv.rf[gi]=rl2;
          const dBody=sdf(fxp,FLY,fzp,S,0);
          sv.ao[gi]=Math.max(0.25, Math.min(1, dBody*4.5));
        }
      }
    }
  }
  sv.lx=lx; sv.ly=ly; sv.lz=lz; sv.hasFloor=hasFloor; sv.az=C.az;
  return sv;
}
const BAYER4=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
/* ============================================================================
   THE GRAFT — an uploaded graphic ENTERED INTO the transmission.

   The whole trick is where it happens. renderScene emits RGB, not palette
   indices; quantize() comes later and dithers the finished frame into the
   artwork's own 64-colour palette. So anything grafted in BEFORE that pass is
   dithered by the same pass that dithers the art — it is not a layer sitting
   on top of the picture, it is inside the picture's own colour physics, and
   the void carves it, the corruption chews it, the chroma cap crushes it.

   Nothing in this organ touches the distance field, so no role here can
   punch a hole in the march. Geometry roles are a separate, later organ.
   ========================================================================== */
const GBLENDN=['NORMAL','MULTIPLY','SCREEN','OVERLAY','DIFFERENCE','ADD',
               'SUBTRACT','DARKEN','LIGHTEN','XOR','HARDLIGHT','SOFTLIGHT'];
function gblend(m,a,b){
  switch(m){
    case 1:  return (a*b)/255;
    case 2:  return 255-(255-a)*(255-b)/255;
    case 3:  return a<128 ? (2*a*b)/255 : 255-2*(255-a)*(255-b)/255;
    case 4:  return a>b?a-b:b-a;
    case 5:  { const v=a+b; return v>255?255:v; }
    case 6:  { const v=a-b; return v<0?0:v; }
    case 7:  return a<b?a:b;
    case 8:  return a>b?a:b;
    case 9:  return ((a|0)^(b|0));
    case 10: return b<128 ? (2*a*b)/255 : 255-2*(255-a)*(255-b)/255;
    case 11: { const A=a/255, B=b/255;
               const D=A<=0.25?((16*A-12)*A+4)*A:Math.sqrt(A);
               const O=B<=0.5?A-(1-2*B)*A*(1-A):A+(2*B-1)*(D-A);
               return O*255; }
    default: return b;
  }
}
function buildGraft(im,c){
  const rad=(c.rot||0)*Math.PI/180, ca=Math.cos(rad), sa=Math.sin(rad);
  const sc=Math.max(0.05,(c.scale==null?100:c.scale)/100);
  const ar=(im.w/im.h)||1;
  let dx=1, dy=1;
  if(c.fit===0){ dx=ar>=1?ar:1;   dy=ar>=1?1:1/ar; }      /* COVER   */
  else if(c.fit===1){ dx=ar>=1?1:ar; dy=ar>=1?1/ar:1; }   /* CONTAIN */
  /* 2 STRETCH and 3 TILE keep 1,1 */
  const roles=c.roles||{};
  return {im:im, c:c, ca:ca, sa:sa, sc:sc, dx:dx, dy:dy, tile:(c.fit===3),
    ox:(c.offx||0)/100, oy:(c.offy||0)/100,
    op:(c.opacity==null?100:c.opacity)/100,
    amt:(c.amt==null?100:c.amt)/100,
    blend:c.blend|0, depth:c.depth|0, block:!!c.block, inv:!!c.invert,
    gam:Math.max(0.05,(c.gamma==null?100:c.gamma)/100),
    thr:(c.thresh|0)/100, roles:roles,
    _grain:null,_grainW:0,_grainH:0,_grainO:null,_wf:null};
}
const GUV=[0,0];
function graftUV(g,u,v){
  const x=u-0.5-g.ox, y=v-0.5-g.oy;
  const rx=(x*g.ca+y*g.sa)/g.sc, ry=(-x*g.sa+y*g.ca)/g.sc;
  let iu=rx/g.dx+0.5, iv=ry/g.dy+0.5;
  if(g.tile){ iu-=Math.floor(iu); iv-=Math.floor(iv); }
  else if(iu<0||iu>=1||iv<0||iv>=1) return 0;
  GUV[0]=iu; GUV[1]=iv; return 1;
}
function graftTone(g,t){
  let o=Math.pow(t<0?0:(t>1?1:t), g.gam);
  if(g.thr>0) o = o<g.thr?0:1;
  return g.inv?1-o:o;
}
function graftLum(g,u,v){
  if(!graftUV(g,u,v))return -1;
  const im=g.im, w=im.w, h=im.h; let t;
  if(g.block){
    let ix=(GUV[0]*w)|0, iy=(GUV[1]*h)|0;
    if(ix<0)ix=0; else if(ix>=w)ix=w-1;
    if(iy<0)iy=0; else if(iy>=h)iy=h-1;
    t=im.lum[iy*w+ix]/255;
  }else{
    const fx=GUV[0]*w-0.5, fy=GUV[1]*h-0.5;
    let x0=Math.floor(fx), y0=Math.floor(fy);
    const tx=fx-x0, ty=fy-y0;
    let x1=x0+1, y1=y0+1;
    if(x0<0)x0=0; if(y0<0)y0=0; if(x1<0)x1=0; if(y1<0)y1=0;
    if(x0>=w)x0=w-1; if(y0>=h)y0=h-1; if(x1>=w)x1=w-1; if(y1>=h)y1=h-1;
    const a=im.lum[y0*w+x0], b=im.lum[y0*w+x1], c2=im.lum[y1*w+x0], d=im.lum[y1*w+x1];
    const top=a+(b-a)*tx, bot=c2+(d-c2)*tx;
    t=(top+(bot-top)*ty)/255;
  }
  return graftTone(g,t);
}
const GRGB=[0,0,0];
function graftRGB(g,u,v){
  if(!graftUV(g,u,v))return 0;
  const im=g.im, w=im.w, h=im.h;
  if(g.block){
    let ix=(GUV[0]*w)|0, iy=(GUV[1]*h)|0;
    if(ix<0)ix=0; else if(ix>=w)ix=w-1;
    if(iy<0)iy=0; else if(iy>=h)iy=h-1;
    const o=(iy*w+ix)*3;
    GRGB[0]=graftTone(g,im.rgb[o]/255)*255;
    GRGB[1]=graftTone(g,im.rgb[o+1]/255)*255;
    GRGB[2]=graftTone(g,im.rgb[o+2]/255)*255;
  }else{
    const fx=GUV[0]*w-0.5, fy=GUV[1]*h-0.5;
    let x0=Math.floor(fx), y0=Math.floor(fy);
    const tx=fx-x0, ty=fy-y0;
    let x1=x0+1, y1=y0+1;
    if(x0<0)x0=0; if(y0<0)y0=0; if(x1<0)x1=0; if(y1<0)y1=0;
    if(x0>=w)x0=w-1; if(y0>=h)y0=h-1; if(x1>=w)x1=w-1; if(y1>=h)y1=h-1;
    const oA=(y0*w+x0)*3, oB=(y0*w+x1)*3, oC=(y1*w+x0)*3, oD=(y1*w+x1)*3;
    for(let q=0;q<3;q++){
      const a=im.rgb[oA+q], b=im.rgb[oB+q], c2=im.rgb[oC+q], d=im.rgb[oD+q];
      const top=a+(b-a)*tx, bot=c2+(d-c2)*tx;
      GRGB[q]=graftTone(g,(top+(bot-top)*ty)/255)*255;
    }
  }
  return 1;
}
/* the built graft is cached on the scene and keyed by the config revision,
   because the config crosses a postMessage boundary and arrives as a fresh
   object every frame — identity comparison would rebuild the grain and warp
   fields 25 times a second. */
function graftOf(scene){
  const G=scene&&scene.__graft;
  if(!G||!G.img||!G.cfg||!G.cfg.on)return null;
  const sig=G.cfg.rev|0;
  if(scene._gr&&scene._grSig===sig&&scene._grImg===G.img)return scene._gr;
  scene._grImg=G.img; scene._grSig=sig;
  return (scene._gr=buildGraft(G.img,G.cfg));
}
/* GRAIN — the graphic becomes the dither threshold itself. It is not drawn;
   it decides WHERE the ordered dither tips one way or the other, so the
   picture appears only in the texture of the halftone. */
function graftGrain(g){
  if(g._grainO&&g._grainW===W&&g._grainH===H)return g._grainO;
  const gr=new Int8Array(W*H);
  for(let y=0;y<H;y++){ const v=(y+0.5)/H;
    for(let x=0;x<W;x++){
      const L=graftLum(g,(x+0.5)/W,v);
      let s=(L<0)?0:Math.round((L-0.5)*96);
      if(s>120)s=120; else if(s<-120)s=-120;
      gr[y*W+x]=s; } }
  g._grain=gr; g._grainW=W; g._grainH=H;
  /* AMOUNT runs past 100 now; grain is a full replacement at 1 and there is
     nothing beyond full, so this one arm clamps. */
  return (g._grainO={g:gr, a:Math.min(1,g.amt)});
}
/* WARP — the graphic's luminance gradient becomes a displacement field over
   the finished frame. Frame-invariant, so it is built once at 128x128. */
const GWD=128;
function graftWarpField(g){
  if(g._wf)return g._wf;
  const L=new Float32Array(GWD*GWD), gx=new Float32Array(GWD*GWD), gy=new Float32Array(GWD*GWD);
  for(let y=0;y<GWD;y++)for(let x=0;x<GWD;x++){
    const l=graftLum(g,(x+0.5)/GWD,(y+0.5)/GWD);
    L[y*GWD+x]=(l<0)?0.5:l; }
  for(let y=0;y<GWD;y++)for(let x=0;x<GWD;x++){
    const xm=x>0?x-1:x, xp=x<GWD-1?x+1:x, ym=y>0?y-1:y, yp=y<GWD-1?y+1:y;
    gx[y*GWD+x]=L[y*GWD+xp]-L[y*GWD+xm];
    gy[y*GWD+x]=L[yp*GWD+x]-L[ym*GWD+x]; }
  return (g._wf={gx:gx, gy:gy});
}
function graftWarpPass(buf,g,theta){
  /* TAU-periodic, and deliberately never zero: the old 0.5+0.5cos put a dead
     frame at half the loop, which is exactly where a contact sheet looks. */
  const amp=g.amt*0.115*(0.60+0.40*Math.cos(theta));
  if(amp<=0.0002)return;
  const wf=graftWarpField(g);
  let tmp=graftWarpPass._t;
  if(!tmp||tmp.length!==W*H*3) tmp=graftWarpPass._t=new Uint8Array(W*H*3);
  tmp.set(buf);
  const AX=amp*W, AY=amp*H;
  for(let y=0;y<H;y++){
    const gyi=Math.min(GWD-1,(y*GWD/H)|0);
    for(let x=0;x<W;x++){
      const gi=gyi*GWD+Math.min(GWD-1,(x*GWD/W)|0);
      let sx=(x+wf.gx[gi]*AX)|0, sy=(y+wf.gy[gi]*AY)|0;
      if(sx<0)sx=0; else if(sx>=W)sx=W-1;
      if(sy<0)sy=0; else if(sy>=H)sy=H-1;
      const o=(y*W+x)*3, s=(sy*W+sx)*3;
      buf[o]=tmp[s]; buf[o+1]=tmp[s+1]; buf[o+2]=tmp[s+2];
    }
  }
}
/* OVER — the classic layer, but placed inside the signal chain. */
function graftOverPass(buf,g){
  const op=g.op*g.amt; if(op<=0)return;
  const bm=g.blend|0;
  for(let y=0;y<H;y++){ const v=(y+0.5)/H;
    for(let x=0;x<W;x++){
      if(!graftRGB(g,(x+0.5)/W,v))continue;
      const o=(y*W+x)*3;
      for(let q=0;q<3;q++){
        const a=buf[o+q];
        let r=a+(gblend(bm,a,GRGB[q])-a)*op;
        buf[o+q]= r<0?0:(r>255?255:r|0);
      }
    }
  }
}
/* STENCIL — the graphic is a hole cut through the whole transmission, and
   the hole BREATHES: the cut level swings once per revolution and closes
   exactly where it opened. */
function graftStencilPass(buf,g,theta,grad){
  /* breathes, but never fully closes — a role that is a no-op for a third of
     the loop reads as a role that does not work. */
  const cut=g.amt*(0.32+0.68*(0.5+0.5*Math.sin(theta)));
  if(cut<=0)return;
  const b0=grad[0], b1=grad[1], b2=grad[2];
  for(let y=0;y<H;y++){ const v=(y+0.5)/H;
    for(let x=0;x<W;x++){
      const L=graftLum(g,(x+0.5)/W,v);
      if(((L<0)?0:L)<cut){ const o=(y*W+x)*3; buf[o]=b0; buf[o+1]=b1; buf[o+2]=b2; }
    }
  }
}
/* SLICE — a scan head travels the frame exactly once per loop, and only the
   band behind it carries the graphic. The picture arrives as a transmission,
   line by line, and is gone by the time the head comes round again. */
function graftSlicePass(buf,g,theta,grad){
  let p=(theta/TAU)%1; if(p<0)p+=1;
  const bh=Math.max(0.06,g.amt*0.5);
  const h0=grad[765], h1=grad[766], h2=grad[767];
  for(let y=0;y<H;y++){
    const fy=(y+0.5)/H;
    let d=fy-p; d-=Math.floor(d);
    if(d>bh)continue;
    const k=(1-d/bh)*g.op;
    for(let x=0;x<W;x++){
      if(!graftRGB(g,(x+0.5)/W,fy))continue;
      const o=(y*W+x)*3;
      buf[o]  =(buf[o]  +(GRGB[0]-buf[o]  )*k)|0;
      buf[o+1]=(buf[o+1]+(GRGB[1]-buf[o+1])*k)|0;
      buf[o+2]=(buf[o+2]+(GRGB[2]-buf[o+2])*k)|0;
      if(d<0.007){ buf[o]=h0; buf[o+1]=h1; buf[o+2]=h2; }
    }
  }
}
/* EMBOSS - the graphic as RELIEF rather than as ink. Its luminance gradient
   is struck into the picture as a bevel, lit from a direction that makes
   exactly one revolution per loop. cos/sin of theta are TAU-periodic by
   construction, so the light returns to where it started and the loop closes.
   Pixels where any of the four taps fall outside the graphic are skipped, so
   the relief stops at the graphic's edge instead of ringing against the frame. */
function graftEmbossPass(buf,g,theta){
  const amp=g.amt*g.op*190; if(amp<=0)return;
  /* THE SEAM MUST BE BIT-EXACT, NOT MERELY PERIODIC. cos/sin of theta are
     mathematically TAU-periodic but not FLOATING-POINT periodic: sin(TAU) is
     -2.45e-16, not 0, and cos(TAU) is 0.9999999999999999, not 1. That is far
     below a pixel - until the accumulation lands on an integer and the
     truncation below turns 100 into 99.999... into 99. Folding theta into
     [0,TAU) first makes the last frame's light vector the SAME FLOAT as the
     first frame's, so the seam closes exactly rather than nearly. */
  let ph=(theta/TAU)%1; if(ph<0)ph+=1; ph*=TAU;
  const lx=Math.cos(ph), ly=Math.sin(ph);
  const ex=1/W, ey=1/H;
  for(let y=0;y<H;y++){ const v=(y+0.5)/H;
    for(let x=0;x<W;x++){ const u=(x+0.5)/W;
      if(graftLum(g,u,v)<0)continue;
      const a=graftLum(g,u+ex,v), b=graftLum(g,u-ex,v);
      const c=graftLum(g,u,v+ey), d=graftLum(g,u,v-ey);
      if(a<0||b<0||c<0||d<0)continue;
      const sft=((a-b)*lx+(c-d)*ly)*amp;
      const o=(y*W+x)*3;
      /* round, do not truncate: |0 chops toward zero, so a value that differs
         by one ulp across the seam can differ by a whole index. */
      let r=Math.round(buf[o]+sft), gg=Math.round(buf[o+1]+sft), bb=Math.round(buf[o+2]+sft);
      buf[o]  = r<0?0:(r>255?255:r);
      buf[o+1]= gg<0?0:(gg>255?255:gg);
      buf[o+2]= bb<0?0:(bb>255?255:bb);
    }
  }
}
/* SILHOUETTE - the graphic as a SOLID BODY in the scene rather than a texture
   on it. Its bright region becomes an opaque form punched out of the picture in
   the artwork's own deepest tone, with a struck rim at the boundary, drifting
   across the frame exactly once per loop.
   This is not STENCIL inverted. STENCIL erases the picture where the graphic is
   DARK - the graphic acts as a mask on what survives. SILHOUETTE puts the
   graphic IN FRONT of the picture as an occluder with its own edge. */
/* THE CUT CANNOT BE A CONSTANT. The graphic is whatever the artist uploads, so
   any fixed threshold is wrong for some image: 0.13 selected every pixel of a
   mid-band test card and flood-filled the frame, 0.72 selected none of it and
   the role did nothing. Both failures came from asking an absolute question of
   a relative thing.
   So measure the image once and cut relative to its own distribution. A fixed
   64x64 sample grid keeps this deterministic - same image, same numbers, in
   both drivers - and the result is cached on g alongside the grain LUT. */
function graftLumStats(g){
  if(g._lst)return g._lst;
  let n=0,s=0,s2=0;
  for(let i=0;i<64;i++){ const v=(i+0.5)/64;
    for(let j=0;j<64;j++){
      const L=graftLum(g,(j+0.5)/64,v);
      if(L<0)continue; n++; s+=L; s2+=L*L;
    }
  }
  const m=n?s/n:0.5;
  let sd=n?Math.sqrt(Math.max(0,s2/n-m*m)):0.25;
  if(sd<0.02)sd=0.02;
  return (g._lst={m:m,sd:sd});
}
function graftSilhouettePass(buf,g,theta,grad){
  /* THE THRESHOLD AND THE FILL BOTH HAD TO MOVE. At 0.55-amt*0.42 the cut sat
     at 0.13, which on any mid-band image selects EVERY pixel - so the pass
     flood-filled the frame with grad[0..2], the exact tone STENCIL erases to,
     and the two roles rendered byte-identical frames. A silhouette that covers
     everything is not a silhouette.
     So: the cut now sits high enough to pick out a form rather than a frame,
     and the body is struck in the BRIGHT end of the ramp with a DARK rim -
     the structural inverse of STENCIL, which cannot collide with it even in
     the degenerate case where the whole image passes the test. */
  /* amt sweeps the cut from "only the brightest crown" to "a fat solid form",
     always measured against THIS image's own mean and spread. */
  const st=graftLumStats(g);
  const thr=st.m+st.sd*(1.15-g.amt*1.75);
  let p=(theta/TAU)%1; if(p<0)p+=1;
  const drift=0.18+g.amt*0.30;
  const k0=grad[765], k1=grad[766], k2=grad[767];
  const e0=grad[0], e1=grad[1], e2=grad[2];
  const ex=2/W;
  for(let y=0;y<H;y++){ const v=(y+0.5)/H;
    for(let x=0;x<W;x++){
      let u=(x+0.5)/W-p*drift; u-=Math.floor(u);
      const L=graftLum(g,u,v); if(L<thr)continue;
      let un=u+ex; un-=Math.floor(un);
      const Ln=graftLum(g,un,v);
      const o=(y*W+x)*3;
      if(Ln<thr){ buf[o]=e0; buf[o+1]=e1; buf[o+2]=e2; }
      else      { buf[o]=k0; buf[o+1]=k1; buf[o+2]=k2; }
    }
  }
}
function graftApply(buf,scene,theta,grad,phase){
  const g=graftOf(scene); if(!g)return;
  if((g.depth|0)!==(phase|0))return;
  const R=g.roles;
  if(R.warp)    graftWarpPass(buf,g,theta);
  if(R.over)    graftOverPass(buf,g);
  if(R.emboss)  graftEmbossPass(buf,g,theta);
  if(R.stencil) graftStencilPass(buf,g,theta,grad);
  if(R.slice)   graftSlicePass(buf,g,theta,grad);
  if(R.silhouette) graftSilhouettePass(buf,g,theta,grad);
}
function renderScene(rgb, scene, theta, corr, grad){
  scene._corr=corr;
  const mf=massField(scene);
  const F=famMat(scene), M=mf.mat=mf.mat||matOf(scene);
  const sv=sceneView(scene, theta);
  const VG=sv.VG;
  const fld=renderScene._f||(renderScene._f=new Float32Array(SW*SW));
  const gp=(mf.grainPh*1013)|0;
  const gh=(x,y)=>{ let h=(x*374761393+y*668265263+gp)|0; h=(h^(h>>13))*1274126177;
    return ((((h^(h>>16))>>>0)&1023)/1023)-0.5; };
  const crawlPh=Math.sin(theta)*F.crawl;
  const roll=(theta/TAU)%1;
  /* THE GRAFT, field side. UNDER lays the graphic into the empty space
     BEHIND the mass, so the body occludes it for free and it is rendered in
     the artwork's own tone ramp. FLOOR lies it flat on the mirror plane, so
     it perspective-projects and slides as the camera orbits. GOBO puts it in
     front of the LIGHT — the body is lit THROUGH the picture. */
  const GRs=graftOf(scene);
  const GRU=(GRs&&GRs.roles.under)?GRs:null;
  const GRF=(GRs&&GRs.roles.floor)?GRs:null;
  const GRG=(GRs&&GRs.roles.gobo)?GRs:null;
  /* THE FOOTPRINT. Measured, not guessed: across a spread of seeds the
     visible floor patch spans ~1.0–1.9 body-scales and the body's own extent
     in light space spans ~0.5–1.2. The old single 2.4 constant sized the
     picture to more than twice either, so the surface only ever sampled a
     20–45% crop of it and both roles read as a near-flat wash. Size each
     projection to the thing it actually lands on. */
  const GSF=1.55*Math.max(1,mf.S);   /* FLOOR — the mirror patch */
  const GSG=1.20*Math.max(1,mf.S);   /* GOBO  — the body in light space */
  const FCAP=GRF?0.72:0.55;          /* a lit graphic on the floor needs headroom */
  let gux=1,guy=0,guz=0,gwx=0,gwy=1,gwz=0;
  if(GRG){
    let ax=-sv.ly, ay=sv.lx, az=0;
    let al=Math.sqrt(ax*ax+ay*ay+az*az);
    if(al<1e-4){ ax=1; ay=0; az=0; al=1; }
    gux=ax/al; guy=ay/al; guz=az/al;
    gwx=sv.ly*guz-sv.lz*guy; gwy=sv.lz*gux-sv.lx*guz; gwz=sv.lx*guy-sv.ly*gux;
    const wl=Math.sqrt(gwx*gwx+gwy*gwy+gwz*gwz)||1; gwx/=wl; gwy/=wl; gwz/=wl;
  }
  for(let y=0;y<SW;y++){
    const gyf=y*VG/SW, gy=Math.min(VG-1,gyf|0), fy=y/SW;
    for(let x=0;x<SW;x++){
      const gxf=x*VG/SW, gx=Math.min(VG-1,gxf|0);
      const gi=gy*VG+gx, k=sv.kind[gi], i=y*SW+x;
      if(k===0){
        let bg0=0.016+0.020*(1-fy)+gh(x>>2,y>>2)*0.010;
        if(GRU){ const L=graftLum(GRU,(x+0.5)/SW,(y+0.5)/SW);
          if(L>=0){ bg0+=((L*0.78+0.010)-bg0)*GRU.amt;
            if(bg0<0)bg0=0; else if(bg0>0.92)bg0=0.92; } }
        fld[i]=bg0;
        continue;
      }
      const px=sv.px[gi], py=sv.py[gi], pz=sv.pz[gi];
      if(k===2){
        let v=0.05*sv.ao[gi] + sv.rf[gi]*0.5*Math.pow(Math.max(0,1-Math.abs(fy-0.5)),1.2);
        v*=Math.max(0.12, 1-Math.max(0,sv.dp[gi])*F.fogA*1.4);
        const bandF2=Math.sin(px*8+pz*8+crawlPh*0.5);
        if(bandF2>0.75)v+=0.015;
        if(GRF){ const L=graftLum(GRF, px/GSF+0.5, pz/GSF+0.5);
          if(L>=0){ const fade=Math.max(0.15,1-Math.max(0,sv.dp[gi])*F.fogA*1.2);
            v+=((L*0.58+0.015)-v)*GRF.amt*fade; } }
        if(GRG){ const L=graftLum(GRG,(px*gux+py*guy+pz*guz)/GSG+0.5,
                                       (px*gwx+py*gwy+pz*gwz)/GSG+0.5);
          if(L>=0){ v*=(1-GRG.amt)+GRG.amt*(0.18+1.55*L); if(v<0)v=0; } }
        fld[i]=Math.max(0.02,Math.min(FCAP,v))+gh(x,y)*0.028;
        continue;
      }
      let dif=Math.max(0, sv.nx[gi]*sv.lx+sv.ny[gi]*sv.ly+sv.nz[gi]*sv.lz);
      /* GOBO carries a second term. Attenuating the diffuse alone is invisible
         on a body that is already dim — a real gel in a real gate also THROWS
         light, so the bright parts of the picture lift the surface whether or
         not that surface happens to face the lamp. */
      let goE=0;
      if(GRG){ const L=graftLum(GRG,(px*gux+py*guy+pz*guz)/GSG+0.5,
                                     (px*gwx+py*gwy+pz*gwz)/GSG+0.5);
        if(L>=0){ dif*=(1-GRG.amt)+GRG.amt*(0.10+1.75*L); if(dif<0)dif=0;
          goE=GRG.amt*0.26*(L-0.42); } }
      const rimV=Math.pow(Math.max(0, 1 - Math.abs(sv.nx[gi]*(-Math.sin(sv.az)) + sv.nz[gi]*(-Math.cos(sv.az)))),3)*0.24;
      let v=0.07+dif*0.60*sv.ao[gi]+rimV+goE;
      if(v<0)v=0;
      /* the material dialect */
      let bc;
      if(F.bandAxis===1) bc=Math.atan2(px,pz)*4 + py*F.bandF*0.4;
      else if(F.bandAxis===2) bc=Math.min(Math.sin(px*F.bandF), Math.sin(py*F.bandF))*2;
      else bc=py*F.bandF + px*2.2*F.warp + Math.sin(px*3.1+pz*2.2)*F.warp;
      const bandV=(F.bandAxis===2)?bc:Math.sin(bc+crawlPh);
      if(bandV>0.3) v+=F.bandA*(0.4+dif);
      else if(bandV<-0.85) v-=F.bandA*0.7;
      if(F.scanRoll){ const ry=((py*0.5+0.5)-roll+2)%1; if(ry<0.05)v+=0.22; }
      const ci=(((px*F.cellF)|0)*7+((py*F.cellF)|0)*13+((pz*F.cellF)|0)*29)|0;
      const ch=(((ci*2654435761)>>>9)&255)/255;
      if(F.cellSharp){ v+=(ch>0.5?0.10:-0.10)*(F.cellA*8*(0.3+corr/150));
        const fr2=(px*F.cellF)%1; if(Math.abs(fr2)<0.06||Math.abs(fr2)>0.94)v-=0.14; }
      else v+=(ch-0.5)*F.cellA*(1+corr/100);
      if(F.veinA){ const vn=Math.abs(Math.sin(px*7+Math.sin(py*5+pz*4)*2.2+crawlPh*0.6));
        if(vn<0.12)v-=F.veinA; }
      if(F.sparkle&&ch>0.93) v+=F.sparkle*(0.5+0.5*Math.sin(theta*2+ci));
      const haze=Math.max(0,Math.min(1,(sv.dp[gi]+0.55)*F.fogA*1.6));
      v=v*(1-haze*0.55)+0.02*haze;
      v+=mf.BP[Math.min(FW*FW-1,((y*FW/SW)|0)*FW+((x*FW/SW)|0))]*(0.18+dif*0.4);
      v+=gh(x,y)*0.038;
      const cx2=x/SW-0.5;
      v*=1-0.20*(cx2*cx2+(fy-0.5)*(fy-0.5))*2.2;
      v=Math.pow(Math.max(0.001,v),F.expo);
      fld[i]=Math.max(0.02,Math.min(0.97,v));
    }
  }
  const GRN=(GRs&&GRs.roles.grain)?graftGrain(GRs):null;
  /* fine bilinear upscale + ordered dither: the new surface signature */
  let UX=renderScene._ux;
  if(!UX){ UX=renderScene._ux={x0:new Int32Array(W),x1:new Int32Array(W),tx:new Float32Array(W)};
    for(let x=0;x<W;x++){ const sx=x*SW/W; UX.x0[x]=Math.min(SW-1,sx|0);
      UX.x1[x]=Math.min(SW-1,UX.x0[x]+1); UX.tx[x]=sx-UX.x0[x]; } }
  for(let y=0;y<H;y++){
    const sy=y*SW/H, y0=Math.min(SW-1,sy|0), y1=Math.min(SW-1,y0+1), ty=sy-y0;
    const rowA=y0*SW, rowB=y1*SW, by=(y&3)*4;
    for(let x=0;x<W;x++){
      const x0=UX.x0[x], x1=UX.x1[x], tx=UX.tx[x];
      const a2=fld[rowA+x0], b2=fld[rowA+x1], c2=fld[rowB+x0], d2=fld[rowB+x1];
      const v=a2+(b2-a2)*tx + ((c2+(d2-c2)*tx)-(a2+(b2-a2)*tx))*ty;
      let dth=(BAYER4[by+(x&3)]-7.5)*1.7;
      if(GRN) dth=dth*(1-GRN.a)+GRN.g[y*W+x]*GRN.a;
      let gi2=(v*255 + dth)|0;
      if(gi2<0)gi2=0; else if(gi2>255)gi2=255;
      const o=(y*W+x)*3;
      rgb[o]=grad[gi2*3]; rgb[o+1]=grad[gi2*3+1]; rgb[o+2]=grad[gi2*3+2];
    }
  }
}
/* THE CORRUPTION LATCH — fixed.
   renderBase used to read the corruption from scene._corr, which renderScene
   itself writes on entry. On a freshly built scene that field is undefined, so
   the first frame fell back to the hardcoded 60 and then LATCHED it: every
   later frame read back the 60 renderScene had just written. The slider never
   reached the base render at all — which is why corruption "did nothing" to a
   rendered loop, and why the living preview (which sets _corr itself before
   every frame) and the GIF were two different pictures. Corruption is now an
   argument, passed down from renderSource, so every caller — preview worker,
   render worker, sequential path — is the same image by construction. */
function renderBase(rgb, scene, t, theta, grad, corr){
  const m=scene.mode;
  const CORR=(corr!=null?corr:(scene._corr!=null?scene._corr:60));
  if(m==='IDOL'){
    const field=renderBase._fi||(renderBase._fi=new Float32Array(FW*FW));
    scene._corr=CORR;
    const GRi=graftOf(scene);
    const GRNi=(GRi&&GRi.roles.grain)?graftGrain(GRi):null;
    renderIdol(field, scene, theta);
    for(let y=0;y<H;y++){
      const sy=y*FW/H, y0=Math.min(FW-1,sy|0), y1=Math.min(FW-1,y0+1), ty=sy-y0;
      for(let x=0;x<W;x++){
        const sx=x*FW/W, x0=Math.min(FW-1,sx|0), x1=Math.min(FW-1,x0+1), tx=sx-x0;
        const v=field[y0*FW+x0]*(1-tx)*(1-ty)+field[y0*FW+x1]*tx*(1-ty)
               +field[y1*FW+x0]*(1-tx)*ty+field[y1*FW+x1]*tx*ty;
        let dthi=(BAYER4[(y&3)*4+(x&3)]-7.5)*1.7;
        if(GRNi) dthi=dthi*(1-GRNi.a)+GRNi.g[y*W+x]*GRNi.a;
        let gi2=(v*255 + dthi)|0;
        if(gi2<0)gi2=0; else if(gi2>255)gi2=255;
        const o=(y*W+x)*3;
        rgb[o]=grad[gi2*3]; rgb[o+1]=grad[gi2*3+1]; rgb[o+2]=grad[gi2*3+2];
      }
    }
    return;
  }
  renderScene(rgb, scene, theta, CORR, grad);
}

function analogPass(src,dst,scene,theta,corr,fx){
  const V=scene.vibe;
  // chroma split along a seeded axis with seeded waveform + tempo
  const cMag = fx.chroma ? shp(Math.sin(theta*V.chromaK+V.chromaPh),V.chromaShape)*(3+corr*0.95)*V.g.chroma : 0;
  const chroma = Math.round(cMag*Math.cos(V.chromaAng));
  const cV     = Math.round(cMag*Math.sin(V.chromaAng)*0.35);
  const trackAmp = (fx.tracking&&V.trackOn) ? (1+corr*0.55)*V.trackMul*V.g.tracking : 0;
  const tears = scene.tears;
  const grainAmt = fx.grain ? (corr*1.9)*V.g.grain : 0;
  const seedRow = V.grainStat ? 777 : (theta*1000)|0;   // some seeds freeze the static
  // vertical AGC needs a per-column multiplier
  let colMul=null;
  if(V.agcOn&&V.agcVert){
    colMul=analogPass._cm||(analogPass._cm=new Float32Array(W));
    for(let x=0;x<W;x++)colMul[x]=1+V.agcAmp*Math.sin(theta*V.agcK+V.agcPh+x*V.agcF);
  }
  for(let y=0;y<H;y++){
    // per-row horizontal shift (tracking) — seeded frequency/waveform/tempo
    let shift = trackAmp ? shp(Math.sin(theta*V.trackK+V.trackPh + y*V.trackF),V.trackShape)*trackAmp*1.4 : 0;
    if(trackAmp){
      for(let i=0;i<tears.length;i++){const tr=tears[i];
        const dy=Math.abs(y/H - tr.y);
        if(dy<0.03){ const env=Math.max(0,Math.sin(theta*tr.k+tr.ph)); shift += (1-dy/0.03)*tr.amp*env*(0.4+corr*0.05); }
      }
      if(V.trackStep) shift=Math.round(shift/V.trackStep)*V.trackStep;  // quantized lurch, not smooth wave
    }
    const sh=Math.round(shift);
    // AGC wobble: seeded tempo/spatial frequency, horizontal or vertical, or off
    const bar = (V.agcOn&&!V.agcVert) ? 1+(V.agcAmp+corr*0.003)*Math.sin(theta*V.agcK+V.agcPh + y*V.agcF) : 1;
    const scan = (fx.scanlines&&scene.epoch===1) ? ((y&1)?0.82:1.0) : 1.0;   // classic row dim; signal era = ATTRCLASH
    const rowMul = bar*scan;
    for(let x=0;x<W;x++){
      const o=(y*W+x)*3;
      // sample R / G / B with chroma offset + tracking shift
      let xr=x - sh - chroma, xb=x - sh + chroma, xg=x - sh;
      let yr=y + cV, yb=y - cV;
      if(xr<0)xr=0; else if(xr>=W)xr=W-1;
      if(xb<0)xb=0; else if(xb>=W)xb=W-1;
      if(xg<0)xg=0; else if(xg>=W)xg=W-1;
      if(yr<0)yr=0; else if(yr>=H)yr=H-1;
      if(yb<0)yb=0; else if(yb>=H)yb=H-1;
      let R=src[(yr*W+xr)*3];
      let G=src[(y*W+xg)*3+1];
      let B=src[(yb*W+xb)*3+2];
      if(grainAmt && scene.epoch===1){
        // classic era: neutral hash grain, frame-correlated shimmer
        let n=((x*374761393+y*668265263+seedRow*982451653)>>>0); n=(n^(n>>>13))>>>0;
        const g=((n&255)/255-0.5)*grainAmt;
        R+=g; G+=g; B+=g;
      } else if(grainAmt){
        /* CRAWL — NTSC rainbow static + dot crawl (Max Capacity axis).
           Chroma-decorrelated noise (never grey grain) + a 2px checker that
           crawls along luma edges like a composite signal failing. */
        let n=((x*374761393+y*668265263+seedRow*982451653)>>>0); n=(n^(n>>>13))>>>0;
        const n2=(n*2246822519)>>>0, n3=(n*3266489917)>>>0;
        R+=((n&255)/255-0.5)*grainAmt*1.15;
        G+=(((n2>>>8)&255)/255-0.5)*grainAmt*0.85;
        B+=(((n3>>>16)&255)/255-0.5)*grainAmt*1.25;
        if(x>0){
          const eL=src[o]-src[o-3];
          const edge=eL<0?-eL:eL;
          if(edge>26){
            const crawl=(((x+y+((theta*512)|0))&2)?1:-1)*Math.min(60,edge*0.5)*(grainAmt*0.02);
            R+=crawl; B-=crawl;
          }
        }
      }
      const m = colMul ? rowMul*colMul[x] : rowMul;
      R*=m; G*=m; B*=m;
      dst[o]  = R<0?0:R>255?255:R;
      dst[o+1]= G<0?0:G>255?255:G;
      dst[o+2]= B<0?0:B>255?255:B;
    }
  }
}

/* ============================================================================
   FORK ONE — COMPOSE FIRST, CORRUPT SECOND
   One field is the single truth: the MASS form, the carved void, and the
   wound anchors all read the same organic coastline. Glitch needs order to
   violate; this is the order.
   ========================================================================== */
function sanctityRGB(buf, scene, theta, frame, grad){
  if(scene.mode!=='MASS')return;
  const mf=massField(scene);
  const F=faultOf(scene);
  const faultY=((theta/TAU)*FW)|0;
  const exRow=new Uint8Array(H);
  if(scene.bands)for(const bd of scene.bands)for(let y=Math.max(0,bd.y);y<Math.min(H,bd.y+bd.h);y++)exRow[y]=1;
  const rects=scene.blocks||[];
  const cV=[grad[0],grad[1],grad[2]];
  for(let y=0;y<H;y++){
    if(exRow[y])continue;
    const cy=(y*FW/H)|0;
    let shift=0; let dy=Math.abs(cy-faultY); dy=Math.min(dy,FW-dy);
    if(dy<F.faultH) shift=Math.round(F.faultA*(1-dy/F.faultH));
    for(let x=0;x<W;x++){
      let inR=false;
      for(let r=0;r<rects.length;r++){const b2=rects[r];
        if(x>=b2.x&&x<b2.x+b2.w&&y>=b2.y&&y<b2.y+b2.h){inR=true;break;}}
      if(inR)continue;
      if(((x*7+y*13+frame*31)&15)<2)continue;
      let cx=(x*FW/W)|0; cx+=shift; if(cx>=FW)cx-=FW; if(cx<0)cx+=FW;
      const ci=cy*FW+cx;
      let c;
      if(!mf.z[ci])c=cV;
      else { const gi=Math.max(0,Math.min(255,(shadeAt(mf,ci,theta)*255)|0))*3;
        c=[grad[gi],grad[gi+1],grad[gi+2]]; }
      const o=(y*W+x)*3; buf[o]=c[0]; buf[o+1]=c[1]; buf[o+2]=c[2];
    }
  }
}
function sanctityIdx(indices, scene, frame){
  /* the third act: after every storm, the void reclaims its territory.
     ~80% of violated void pixels return to black; the survivors read as
     debris drifting in the dark — evidence of the wounds, not noise. */
  const vf=(scene.voidamt|0)/100;
  if(vf<=0&&scene.mode!=='MASS')return;
  const mf=massField(scene);
  for(let y=0;y<H;y++){const cy=((y*FW/H)|0)*FW;
    for(let x=0;x<W;x++){
      if(mf.n[cy+((x*FW/W)|0)]>=mf.q)continue;
      const o=y*W+x;
      if(indices[o]<3)continue;                                   // already dark
      if(((x*7+y*13+frame*31)&15)<3)continue;                      // ~19% debris survives
      indices[o]=0;
    }
  }
}
function faultOf(scene){
  const rng=mulberry32((scene.seed^0xB0DE)>>>0);
  return {faultH:10+((rng()*14)|0), faultA:(6+rng()*14)|0};
}
function massField(scene){
  if(scene._mf) return scene._mf;
  const rng=mulberry32((scene.seed^0x14CE55)>>>0);
  let fam=(rng()*256)|0;            // 16 skeletons x 16 vocabularies = 256 bodies
  if(scene.__wbFam!=null)fam=((scene.__wbFam&15)<<4)|(fam&15);  // workbench: skeleton by hand
  if(scene.__wbPrim!=null)fam=(fam&240)|(scene.__wbPrim&15);    // workbench: vocabulary by hand
  let vf=(scene.voidamt|0)/100;
  if(scene.mode==='MASS'&&vf<=0)vf=0.45;
  vf=Math.max(0.12,Math.min(0.88,vf));
  const target=1-vf;
  const no=scene.noise;
  const arr=fam>>4, prim=fam&15;         // 16 skeletons x 16 vocabularies = 256 bodies
  /* THE FOLD IS RETIRED - but its dice are not. This expression short-circuits,
     so it consumes a VARIABLE number of rng() draws depending on arr, and that
     draw pattern is load-bearing for every parameter rolled after it. Keep the
     expression verbatim, discard the answer. */
  const _foldRoll=(arr===1)||((arr===3||arr===2)&&rng()<0.4)
    ||((arr===9||arr===13||arr===15)&&rng()<0.35);
  const mirror=false;   /* no bilateral symmetry: no butterflies, no totems */
  const ph=rng()*90;
  const fbmA=0.02+rng()*0.035, fbmF=4+rng()*5;
  /* ---- primitive vocabulary ---- */
  const rotc=[],rots=[];
  const P=[];    // parts: [type, x,y,z, a,b,c, k(blend), rot]
  const C=[];    // carvings: spheres [x,y,z,r] subtracted
  const F=[];    // fracture planes [nx,ny,off,halfwidth]
  const pick=(base)=>{ const r=rng(); return r<0.58?base:( (base+1+((r*14)|0))&15 ); };
  /* rot may now be given explicitly — a truss bar has to point AT its node.
     Omit it and the old behaviour (a random tilt) is preserved exactly. */
  const addPart=(t,x,y,z,a,b,c,k,rot)=>{ P.push([t,x,y,z,a,b,c,k, rot==null?(rng()*0.9-0.45):rot]); };
  let hasDrape=false;
  if(arr===0){        // STACK — vertical accumulation
    let cy=0.24+rng()*0.08; const n2=3+((rng()*4)|0);
    for(let i=0;i<n2;i++){ addPart(pick(prim), (rng()-0.5)*0.14, cy, (rng()-0.5)*0.08,
      0.09+rng()*0.12, 0.07+rng()*0.09, 0.07+rng()*0.07, 0.07+rng()*0.05); cy+=0.10+rng()*0.08; }
  } else if(arr===1){ // MIRROR — bilateral figure
    const n2=2+((rng()*3)|0); let cy=0.28+rng()*0.08;
    for(let i=0;i<n2;i++){ addPart(pick(prim), 0.05+rng()*0.14, cy, (rng()-0.5)*0.06,
      0.08+rng()*0.11, 0.07+rng()*0.10, 0.06+rng()*0.06, 0.06+rng()*0.06); cy+=0.13+rng()*0.08; }
    addPart(pick(prim), 0, 0.30+rng()*0.30, 0, 0.10+rng()*0.10, 0.10+rng()*0.10, 0.07, 0.09);
  } else if(arr===2){ // ORBIT — nucleus and satellites
    addPart(pick(prim), 0, 0.46+rng()*0.08, 0, 0.15+rng()*0.09, 0.14+rng()*0.08, 0.10, 0.05);
    const sats=3+((rng()*3)|0), R=0.24+rng()*0.10, a0=rng()*TAU;
    for(let i=0;i<sats;i++){ const a=a0+i*TAU/sats;
      addPart(pick(prim), Math.cos(a)*R, 0.48+Math.sin(a)*R*0.9, (rng()-0.5)*0.1,
        0.05+rng()*0.05, 0.05+rng()*0.04, 0.04, 0.10+rng()*0.06); }
  } else if(arr===3){ // SPINE — column with limbs
    addPart(3, 0, 0.5, 0, 0.055+rng()*0.03, 0.34+rng()*0.08, 0, 0.05);
    const limbs=2+((rng()*4)|0);
    for(let i=0;i<limbs;i++){ addPart(pick(prim), (0.10+rng()*0.16), 0.24+rng()*0.5, (rng()-0.5)*0.08,
      0.05+rng()*0.08, 0.04+rng()*0.05, 0.04, 0.08+rng()*0.05); }
  } else if(arr===4){ // GATE — pillars and lintel
    const px2=0.16+rng()*0.07;
    addPart(3, px2, 0.62, 0, 0.05+rng()*0.03, 0.24+rng()*0.06, 0, 0.03);
    addPart(3,-px2, 0.62, 0, 0.05+rng()*0.03, 0.24+rng()*0.06, 0, 0.03);
    addPart(prim===2||prim===5?2:1, 0, 0.34+rng()*0.05, 0, px2+0.09, 0.06+rng()*0.03, 0.06, 0.05);
  } else if(arr===5){ // STRATA — flattened slabs, displaced
    let cy=0.26+rng()*0.06; const n2=4+((rng()*4)|0);
    for(let i=0;i<n2;i++){ addPart(1, (rng()-0.5)*0.16, cy, (rng()-0.5)*0.05,
      0.16+rng()*0.13, 0.028+rng()*0.03, 0.07, 0.02+rng()*0.02); cy+=0.075+rng()*0.05; }
  } else if(arr===6){ // MONO — one mass, wounded
    addPart(pick(prim), 0, 0.48+rng()*0.06, 0, 0.19+rng()*0.10, 0.24+rng()*0.12, 0.10, 0.03);
  } else if(arr===7){ // FIELD — drapery with buried parts
    hasDrape=true;
    const n2=1+((rng()*2)|0);
    for(let i=0;i<n2;i++) addPart(pick(prim), (rng()-0.5)*0.4, 0.3+rng()*0.4, -0.02,
      0.07+rng()*0.08, 0.06+rng()*0.07, 0.05, 0.10);
  }
  /* ─── the eight new skeletons. The first eight are the engine's whole
         history; these are the postures it never had. ─────────────────── */
  else if(arr===8){   // HELIX — a rising spiral
    const n2=5+((rng()*5)|0), R=0.13+rng()*0.12, turns=0.8+rng()*1.7, a0=rng()*TAU,
          y0=0.22+rng()*0.06, rise=0.30+rng()*0.24;
    for(let i=0;i<n2;i++){ const t=i/(n2-1||1), an=a0+t*TAU*turns;
      addPart(pick(prim), Math.cos(an)*R, y0+t*rise, Math.sin(an)*R*0.6,
        0.045+rng()*0.055, 0.045+rng()*0.05, 0.04, 0.06+rng()*0.05); }
  } else if(arr===9){ // FAN — blades thrown out of a hub
    addPart(pick(prim), 0, 0.5, 0, 0.06+rng()*0.05, 0.06+rng()*0.05, 0.055, 0.05);
    const n2=3+((rng()*5)|0), a0=rng()*TAU, L=0.15+rng()*0.15;
    for(let i=0;i<n2;i++){ const an=a0+i*TAU/n2;
      addPart(pick(prim), Math.cos(an)*L*0.72, 0.5+Math.sin(an)*L*0.72, (rng()-0.5)*0.05,
        0.028+rng()*0.045, 0.09+rng()*0.09, 0.03, 0.04+rng()*0.05, Math.PI/2-an); }
  } else if(arr===10){ // TRUSS — nodes joined by bars that actually point at them
    const n2=3+((rng()*3)|0), nodes=[];
    for(let i=0;i<n2;i++) nodes.push([(rng()-0.5)*0.34, 0.26+rng()*0.44, (rng()-0.5)*0.16]);
    for(const nd of nodes) addPart(pick(prim), nd[0],nd[1],nd[2],
      0.035+rng()*0.04, 0.035+rng()*0.04, 0.035, 0.03);
    for(let i=0;i<nodes.length;i++){ const A2=nodes[i], B2=nodes[(i+1)%nodes.length];
      const dx=B2[0]-A2[0], dy=B2[1]-A2[1];
      addPart(3, (A2[0]+B2[0])/2, (A2[1]+B2[1])/2, (A2[2]+B2[2])/2,
        0.013+rng()*0.013, Math.hypot(dx,dy)*0.5, 0, 0.02, Math.atan2(dx,dy)); }
  } else if(arr===11){ // SHARDS — slabs at every angle, no two alike
    const n2=4+((rng()*5)|0);
    for(let i=0;i<n2;i++) addPart(rng()<0.5?1:6, (rng()-0.5)*0.36, 0.24+rng()*0.48, (rng()-0.5)*0.2,
      0.05+rng()*0.13, 0.02+rng()*0.05, 0.03+rng()*0.05, 0.015+rng()*0.02, rng()*TAU);
  } else if(arr===12){ // TOWER — telescoping tiers, each smaller than the last
    let cy=0.20+rng()*0.06, w=0.19+rng()*0.09; const n2=4+((rng()*4)|0);
    for(let i=0;i<n2;i++){ addPart(pick(prim), 0, cy, 0, w, 0.045+rng()*0.05, w*0.82, 0.03+rng()*0.03);
      cy+=0.09+rng()*0.06; w*=0.62+rng()*0.24; }
  } else if(arr===13){ // ARCH — a vault carried on an arc
    const n2=5+((rng()*4)|0), R=0.22+rng()*0.12, span=1.2+rng()*1.5, a0=Math.PI/2-span/2,
          y0=0.32+rng()*0.08;
    for(let i=0;i<n2;i++){ const an=a0+span*i/(n2-1||1);
      addPart(pick(prim), Math.cos(an)*R, y0+Math.sin(an)*R, (rng()-0.5)*0.05,
        0.045+rng()*0.05, 0.045+rng()*0.04, 0.045, 0.05+rng()*0.05, Math.PI/2-an); }
  } else if(arr===14){ // CLUSTER — an accreted mass, wounded twice over
    const n2=6+((rng()*6)|0);
    for(let i=0;i<n2;i++){ const an=rng()*TAU, rr=rng()*0.16;
      addPart(pick(prim), Math.cos(an)*rr, 0.46+(rng()-0.5)*0.30, Math.sin(an)*rr,
        0.055+rng()*0.09, 0.055+rng()*0.09, 0.06, 0.10+rng()*0.08); }
  } else {             // BEAM — a long span with weight hanging off it
    const L=0.24+rng()*0.13, hy=0.52+rng()*0.16;
    addPart(1, 0, hy, 0, L, 0.028+rng()*0.03, 0.05, 0.02);
    const n2=2+((rng()*4)|0);
    for(let i=0;i<n2;i++){ const t=(i+0.5)/n2;
      addPart(pick(prim), (t-0.5)*2*L*0.85, hy-0.07-rng()*0.22, (rng()-0.5)*0.06,
        0.028+rng()*0.05, 0.05+rng()*0.09, 0.03, 0.04+rng()*0.04); }
  }
  const PB=[];
  for(const p of P){ rotc.push(Math.cos(p[8])); rots.push(Math.sin(p[8]));
    PB.push(Math.max(p[4],p[5],p[6]||0)+p[7]+0.02); }
  /* wounds in the anatomy */
  const sockets=(arr===6?2:(arr===14?3:((rng()*3)|0)));
  for(let i=0;i<sockets;i++) C.push([(rng()-0.5)*0.24, 0.3+rng()*0.35, 0.02+rng()*0.06, 0.04+rng()*0.05]);
  const fracN=(arr===6||arr===5||arr===12)?2+((rng()*2)|0):((rng()*2)|0);
  for(let i=0;i<fracN;i++){ const a=rng()*TAU;
    F.push([Math.cos(a), Math.sin(a), (rng()-0.5)*0.4, 0.004+rng()*0.006]); }
  /* ═══ THE MODIFIER — the body's second organ ═══════════════════════════
     256 bodies is still 256 silhouettes. A domain modifier bends the space the
     body is measured in, so the SAME skeleton and the SAME vocabulary come out
     twisted, tapered, terraced, hollowed or doubled. It multiplies the
     vocabulary instead of adding to it. Distorting the domain also distorts
     the distance metric, so each modifier carries a Lipschitz factor MODK and
     the march takes more steps whenever one is active — otherwise the ray
     overshoots the surface and punches holes in the body. */
  const modrng=mulberry32((scene.seed^0x30D1F1)>>>0);
  const MK0=modrng()<0.30?0:1+((modrng()*7)|0);
  const MOD={kind:MK0, amt:0.45+modrng()*1.05, freq:2+modrng()*5, ph:modrng()*TAU};
  if(scene.__wbMod!=null)MOD.kind=scene.__wbMod&7;
  const MK=MOD.kind, MA=MOD.amt, MF=MOD.freq, MP=MOD.ph;
  const MODK=(MK===1||MK===4)?0.55:(MK===2?0.62:(MK===3?0.58:(MK===5?0.72:1)));
  const MCLIP=MK?1.05:0.85, MSTEP=MK?34:22;
  const sm=(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k; return Math.min(a,b)-h*h*k*0.25;};
  const foldAt=(x,y,S)=>{
    let px=x/S, py=(y-0.5)/S+0.5;
    if(mirror)px=Math.abs(px);
    return Math.abs(no(px*3+ph, py*2.2))*0.16 + Math.abs(no(px*7, py*5+ph))*0.05;
  };
  const prSDF=(t,px,py,pz,a,b,c)=>{
    switch(t){
      case 0:{ const l=Math.sqrt((px*px)/(a*a)+(py*py)/(b*b)+(pz*pz)/(c*c||a*a)); return (l-1)*Math.min(a,b); }
      case 1:{ const qx=Math.abs(px)-a, qy=Math.abs(py)-b, qz=Math.abs(pz)-(c||0.07);
        return Math.sqrt(Math.max(qx,0)**2+Math.max(qy,0)**2+Math.max(qz,0)**2)
          +Math.min(Math.max(qx,Math.max(qy,qz)),0)-0.012; }
      case 2:{ const q=Math.sqrt(px*px+py*py)-a; return Math.sqrt(q*q+pz*pz)-Math.max(0.03,b*0.5); }
      case 3:{ const cy2=Math.max(Math.abs(py)-b,0); return Math.sqrt(px*px+pz*pz+cy2*cy2)-a; }
      case 4:{ const r=a*(1-Math.max(0,Math.min(1,(py+b)/(2*b)))*0.7);
        const dxz=Math.sqrt(px*px+pz*pz)-r; return Math.max(dxz, Math.abs(py)-b); }
      case 5:{ const q=Math.sqrt(px*px+py*py)-a;
        return Math.max(Math.sqrt(q*q+pz*pz)-Math.max(0.03,b*0.5), py); }
      case 6:{ const qx=Math.abs(px)-a, qy=Math.abs(py)-b, qz=Math.abs(pz)-0.02;
        return Math.sqrt(Math.max(qx,0)**2+Math.max(qy,0)**2+Math.max(qz,0)**2)
          +Math.min(Math.max(qx,Math.max(qy,qz)),0); }
      /* ─── the eight new vocabularies. Every one stays inside the same
             a/b/c envelope the first eight used, so the part bounding radius
             PB is still valid and the march cannot overshoot. ─────────── */
      case 8:{  /* PRISM6 — hexagonal column */
        const h=a*0.86; let qx=Math.abs(px), qz=Math.abs(pz);
        const kx=-0.8660254, ky=0.5, kz=0.57735;
        const dt=Math.min(kx*qx+ky*qz,0)*2; qx-=dt*kx; qz-=dt*ky;
        const cl=Math.max(-kz*h,Math.min(kz*h,qx));
        const d1=Math.hypot(qx-cl, qz-h)*Math.sign(qz-h), d2=Math.abs(py)-b;
        return Math.min(Math.max(d1,d2),0)+Math.hypot(Math.max(d1,0),Math.max(d2,0)); }
      case 9:{  /* SPOKE — radial blades */
        const NB=5, th=Math.max(0.012,(c||0.05)*0.42), d2=Math.abs(py)-b;
        let best=1e9;
        for(let i=0;i<NB;i++){ const an=i*Math.PI/NB, ca=Math.cos(an), sa=Math.sin(an);
          const rx=px*ca+pz*sa, rz=-px*sa+pz*ca;
          const qx=Math.abs(rx)-a, qz=Math.abs(rz)-th;
          const dd=Math.min(Math.max(qx,qz),0)+Math.hypot(Math.max(qx,0),Math.max(qz,0));
          if(dd<best)best=dd; }
        return Math.min(Math.max(best,d2),0)+Math.hypot(Math.max(best,0),Math.max(d2,0)); }
      case 10:{ /* CROSS — three bars through one another */
        const t=Math.max(0.018,Math.min(a,b)*0.40);
        const bx=(qa,qb,qc)=>{ const x=Math.abs(px)-qa, y=Math.abs(py)-qb, z=Math.abs(pz)-qc;
          return Math.min(Math.max(x,Math.max(y,z)),0)
               +Math.hypot(Math.max(x,0),Math.max(y,0),Math.max(z,0)); };
        return Math.min(bx(a,t,t), Math.min(bx(t,b,t), bx(t,t,a))); }
      case 11:{ /* WEDGE — a box cut on the diagonal */
        const cz=c||0.07, qx=Math.abs(px)-a, qy=Math.abs(py)-b, qz=Math.abs(pz)-cz;
        let d=Math.min(Math.max(qx,Math.max(qy,qz)),0)
             +Math.hypot(Math.max(qx,0),Math.max(qy,0),Math.max(qz,0));
        const L=Math.hypot(a,b)||1;
        return Math.max(d, (px*(b/L)+py*(a/L))); }
      case 12:{ /* LENS — two spheres meeting, exactly a wide and b tall */
        const bb=Math.max(0.02,b), R=(a*a+bb*bb)/(2*bb), off=R-bb;
        return Math.max(Math.hypot(px,py-off,pz)-R, Math.hypot(px,py+off,pz)-R); }
      case 13:{ /* TUBE — an open cylinder */
        const w=Math.max(0.014,Math.min(a*0.45,(c||0.03)));
        const r=Math.abs(Math.hypot(px,pz)-(a-w))-w, d2=Math.abs(py)-b;
        return Math.min(Math.max(r,d2),0)+Math.hypot(Math.max(r,0),Math.max(d2,0)); }
      case 14:{ /* PYRA — a square pyramid standing on its base */
        const H=2*b, L=Math.hypot(H,a)||1, nx=H/L, ny=a/L;
        const ax=Math.abs(px), az=Math.abs(pz), yb=py+b;
        let d=Math.max(ax*nx+yb*ny-a*nx, az*nx+yb*ny-a*nx);
        return Math.max(d, -yb); }
      case 15:{ /* OCTA — an octahedron, squashed to fit b */
        const sy=a/Math.max(0.03,b);
        return (Math.abs(px)+Math.abs(py)*sy+Math.abs(pz)-a)*0.57735/Math.max(1,sy); }
      case 7: default:{ const l=Math.sqrt((px*px)/(a*a)+(py*py)/(b*b)+(pz*pz)/(a*a)); return (l-1)*Math.min(a,b); }
    }
  };
  const sdf=(x,y,z,S,fold)=>{
    let px=x/S, py=(y-0.5)/S+0.5, pz=z/S;
    if(px>MCLIP||px<-MCLIP||py<-0.2-(MK?0.2:0)||py>1.25+(MK?0.2:0)) return 0.3;
    if(mirror)px=Math.abs(px);
    if(MK){                                  /* bend the space, not the body */
      const yy=py-0.5;
      if(MK===1){ const an=MA*1.7*yy, ca=Math.cos(an), sa=Math.sin(an);   /* TWIST */
        const tx=px*ca-pz*sa; pz=px*sa+pz*ca; px=tx; }
      else if(MK===2){ const k2=Math.max(0.28,1+MA*0.85*yy);              /* TAPER */
        px/=k2; pz/=k2; }
      else if(MK===3){ px+=MA*0.55*yy*yy-MA*0.055; }                      /* BEND  */
      else if(MK===4){ const r=Math.hypot(px,pz)||1e-6,                   /* RIPPLE*/
        w=Math.sin(py*MF*3+MP)*MA*0.032; px+=px/r*w; pz+=pz/r*w; }
      else if(MK===5){ px+=MA*0.38*yy; }                                  /* SHEAR */
      else if(MK===7){ px=Math.abs(px)-MA*0.055; }                        /* SPLIT */
    }
    let d=1e9;
    if(hasDrape){ d=pz+0.06-fold;
      const rimB=Math.max(Math.abs(px)-0.32, Math.abs(py-0.5)-0.42);
      d=Math.max(d, rimB);
    }
    for(let i=0;i<P.length;i++){ const p=P[i];
      const lx=px-p[1], ly=py-p[2], lz=pz-p[3];
      const cd=Math.sqrt(lx*lx+ly*ly+lz*lz)-PB[i];
      if(cd>0.06){ if(cd<d)d=cd; continue; }
      const rx=lx*rotc[i]-ly*rots[i], ry=lx*rots[i]+ly*rotc[i];
      d=sm(d, prSDF(p[0],rx,ry,lz,p[4],p[5],p[6]), p[7]);
    }
    for(const c2 of C){ const dx=px-c2[0],dy=py-c2[1],dz=pz-c2[2];
      d=Math.max(d, -(Math.sqrt(dx*dx+dy*dy+dz*dz)-c2[3])); }
    for(const f2 of F){ const pd=Math.abs(px*f2[0]+py*f2[1]+f2[2])-f2[3];
      d=Math.max(d,-pd); }
    if(MK===6) d=Math.abs(d)-(0.010+MA*0.016);          /* SHELL — hollow it out */
    return d*MODK;
  };
  /* --- march at half grid, area-law scale iteration --- */
  const FH=96;
  let S=1;
  const march=(px,py,S,cheap)=>{  // returns [hit, z, nx,ny,nz] via ortho ray
    let z=-0.5;
    const fold=hasDrape?foldAt(px,py,S):0;
    for(let st=0;st<MSTEP;st++){
      const d=sdf(px,py,z,S,fold);
      if(d<0.008){
        if(cheap)return [1,z,0,0,0];
        const e=0.006;
        const f2=hasDrape?foldAt(px+e,py,S):0, f3=hasDrape?foldAt(px-e,py,S):0;
        const f4=hasDrape?foldAt(px,py+e,S):0, f5=hasDrape?foldAt(px,py-e,S):0;
        const nx=sdf(px+e,py,z,S,f2)-sdf(px-e,py,z,S,f3);
        const ny=sdf(px,py+e,z,S,f4)-sdf(px,py-e,z,S,f5);
        const nz=sdf(px,py,z+e,S,fold)-sdf(px,py,z-e,S,fold);
        const l=Math.sqrt(nx*nx+ny*ny+nz*nz)||1;
        return [1, z, nx/l, ny/l, nz/l];
      }
      z+=Math.max(d,0.012);
      if(z>0.55)break;
    }
    return [0,0,0,0,0];
  };
  for(let it=0;it<2;it++){
    let solid=0, cells=0;
    for(let y=0;y<FH;y+=4)for(let x=0;x<FH;x+=4){
      cells++; if(march((x/FH)-0.5, y/FH, S, true)[0])solid++;
    }
    const fr=solid/cells;
    if(fr>0.01) S*=Math.sqrt(target/fr);
    S=Math.max(0.4,Math.min(2.6,S));
  }
  /* --- full half-grid pass: normals + depth cached --- */
  const hitH=new Uint8Array(FH*FH);
  const nxH=new Float32Array(FH*FH), nyH=new Float32Array(FH*FH),
        nzH=new Float32Array(FH*FH), dpH=new Float32Array(FH*FH), bpH=new Float32Array(FH*FH);
  for(let y=0;y<FH;y++)for(let x=0;x<FH;x++){
    const r=march((x/FH)-0.5, y/FH, S);
    const i=y*FH+x;
    hitH[i]=r[0]; dpH[i]=r[1]; nxH[i]=r[2]; nyH[i]=r[3]; nzH[i]=r[4];
    bpH[i]=r[0]?(no(x/FH*fbmF+ph, y/FH*fbmF)*fbmA*2.6):0;
  }
  /* --- upsample to FW: z mask + normal/depth fields --- */
  const n=new Float32Array(FW*FW);
  const z=new Uint8Array(FW*FW);
  const NX=new Float32Array(FW*FW), NY=new Float32Array(FW*FW),
        NZ=new Float32Array(FW*FW), DP=new Float32Array(FW*FW), BP=new Float32Array(FW*FW);
  for(let y=0;y<FW;y++){const hy=Math.min(FH-1,(y*FH/FW)|0);
    for(let x=0;x<FW;x++){const hx=Math.min(FH-1,(x*FH/FW)|0), hi=hy*FH+hx, i=y*FW+x;
      z[i]=hitH[hi]?2:0; n[i]=hitH[hi];
      NX[i]=nxH[hi]; NY[i]=nyH[hi]; NZ[i]=nzH[hi]; DP[i]=dpH[hi]; BP[i]=bpH[hi];
    }
  }
  const lightBase=rng()*TAU, grainPh=rng()*50;

  /* ═══ THE CAMERA — AN ORGAN, NOT A CONSTANT ═══════════════════════════════
     Until now every render in the engine used the SAME camera move:
        az = theta + lightBase*0.7
     so the body turned exactly ONE revolution, always the same direction,
     always at the same rate, from an elevation pinned inside an 8-degree band
     (0.20..0.344 rad — the only variance being fam%9), at a fixed distance,
     with the rim light welded to the camera's own azimuth. Sixty-four bodies,
     ONE gesture. THAT — not the body vocabulary — is why so much of the output
     reads as "another 3D thing spinning to the right." It was never a
     tendency. It was the only move the engine had.
     The camera now carries its own seeded DNA: gesture, handedness, rate,
     elevation, distance, roll. See camAt() for the loop-closure contract. */
  const hasFloor=(mulberry32((scene.seed^0xF700)>>>0)())<0.65;
  const crng=mulberry32((scene.seed^0x0CA3E4)>>>0);
  const _lspin=crng()<0.5?1:-1;              /* drawn unconditionally: keeps the stream stable */
  const CAM={
    motion:(crng()*8)|0,
    spin:  crng()<0.5?1:-1,        /* ← the handedness that never existed before */
    a0:    crng()*TAU,
    swing: 0.55+crng()*1.20,
    elAmp: 0.08+crng()*0.30,
    distK: 0.95+crng()*0.58,
    distAmp:0.06+crng()*0.15,
    roll:  crng()<0.25?(crng()*0.44-0.22):0,
    /* elevation was 0.20..0.344 for EVERY seed that ever rendered. Now a real
       range — worm's-eye through high overhead — floored by the mirror. */
    el:    hasFloor?(0.06+crng()*0.80):(-0.26+crng()*1.12),
    lightSpin:0 };
  if(scene.__wbCam!=null) CAM.motion=scene.__wbCam&7;   /* workbench: gesture by hand */
  if(CAM.motion===5) CAM.lightSpin=_lspin;   /* LOCKED camera => the LIGHT orbits instead */

  /* frame the body: probe coverage at theta=0 through the REAL camera, so the
     lens is tuned for the gesture the seed will actually perform, not for a
     turntable it may never do. */
  let fovK=0.34*Math.max(1,S);
  { const stub={cam:CAM,S:S,hasFloor:hasFloor}, A=camAt(stub,0),
          B=camBasis(A.az,A.el,A.dist,A.roll), ex=B.ex, ey=B.ey, ez=B.ez;
    for(let it=0;it<2;it++){
      let hits2=0, tot=0;
      for(let gy=0;gy<60;gy+=3)for(let gx=0;gx<60;gx+=3){ tot++;
        const sxc=(gx/60-0.5)*2*fovK, syc=(gy/60-0.5)*2*fovK;
        let dx=B.fx+B.rx*sxc+B.ux*syc, dy=B.fy+B.ry*sxc+B.uy*syc, dz=B.fz+B.rz*sxc+B.uz*syc;
        const dl=Math.hypot(dx,dy,dz); dx/=dl;dy/=dl;dz/=dl;
        let t=A.dist-0.95*Math.max(1,S);
        for(let st=0;st<22;st++){
          const d2=sdf(ex+dx*t, ey+dy*t, ez+dz*t, S, 0);
          if(d2<0.012){hits2++;break;}
          t+=Math.max(d2,0.016);
          if(t>A.dist+0.95*Math.max(1,S))break;
        }
      }
      const cov=hits2/tot;
      fovK*=Math.sqrt(Math.max(0.04,cov)/Math.max(0.15,target));
      fovK=Math.max(0.14,Math.min(1.3,fovK));
    }
  }
  scene._mf={n,q:0.5,fam,vf,z,NX,NY,NZ,DP,BP,PX:new Float32Array(FW*FW),PY:new Float32Array(FW*FW),PZ:new Float32Array(FW*FW),AO:new Float32Array(FW*FW),lightBase,grainPh,mirror,sdf,S,hasDrape,foldAt,P,rotc,rots,arr,prim,fovK,cam:CAM,hasFloor:hasFloor,mod:MOD};
  return scene._mf;
}
function matOf(scene){
  if(scene._mat)return scene._mat;
  const rng=mulberry32((scene.seed^0x7E10)>>>0);
  return scene._mat={
    bandF:14+rng()*26, bandA:0.10+rng()*0.12, bandTh:0.25+rng()*0.4,
    cellF:9+rng()*14, cellA:0.08+rng()*0.10,
    crawl:(rng()<0.5?-1:1)*(0.5+rng()*1.0),
    tearF1:17+rng()*14, tearF2:8+rng()*10, sortA:0.05+rng()*0.09,
    fogA:0.22+rng()*0.22, expo:1.10+rng()*0.35
  };
}
function surfTear(px,py,pz,theta,M,amp){
  /* the silhouette itself glitches: a periodic interference field displaces
     the surface. corruption is the amplitude of the wound in the geometry. */
  const sn=Math.sin(theta), cs=Math.cos(theta);
  const d1=Math.sin(px*M.tearF1+py*11+sn*2.4);
  const d2=Math.sin(py*M.tearF2-pz*13+cs*2.1);
  const d3=Math.sin((px+pz)*9+py*M.tearF2*0.6-sn*1.3);
  return (d1*d2+d3*0.5)*amp;
}
/* ═══ WHERE THE CAMERA IS AT A GIVEN PHASE ════════════════════════════════
   EVERY branch below is exactly TAU-periodic — built only from theta itself
   (whole revolutions) or from sin/cos of integer multiples of theta. That is
   what keeps the GIF loop seamless: at theta=TAU the camera is back where it
   started, exactly. Do not add a term here that does not close. */
function camAt(mf, theta){
  const K=mf.cam; let az=K.a0, el=K.el, dk=K.distK, roll=0;
  switch(K.motion){
    case 1: az+=K.swing*Math.sin(theta)*K.spin; break;                  /* PENDULUM — rocks, never completes */
    case 2: az+=theta*2*K.spin; break;                                  /* DOUBLE   — two revolutions per loop */
    case 3: az+=K.swing*Math.sin(theta)*K.spin;                         /* CRANE    — rocks while it descends */
            el+=K.elAmp*Math.cos(theta)-K.elAmp; break;
    case 4: dk*=1+K.distAmp*Math.cos(theta); break;                     /* DOLLY    — locked heading, breathes in */
    case 5: break;                                                      /* LOCKED   — camera still; the LIGHT orbits */
    case 6: az+=theta*K.spin; el+=K.elAmp*Math.sin(theta*2); break;     /* SPIRAL   — orbit with a vertical wobble */
    case 7: az+=K.swing*Math.sin(theta)*K.spin;                         /* SWAY     — handheld drift */
            dk*=1+K.distAmp*Math.cos(theta*2); break;
    default: az+=theta*K.spin;                                          /* TURNTABLE — the old one, now handed */
  }
  if(K.roll) roll=K.roll*Math.sin(theta);
  const dist=dk*1.25*Math.max(1,mf.S);
  /* the camera may never sink below the mirror floor, or the stage inverts */
  if(mf.hasFloor){ const lim=(0.5-(FLY-0.16))/dist;
    if(Math.sin(el)<lim) el=Math.asin(Math.max(-1,Math.min(1,lim))); }
  el=Math.max(-0.34,Math.min(1.05,el));
  return {az,el,dist,roll};
}
/* orthonormal camera basis. Identical math to the old inline block when
   roll===0, so a zero-roll camera stays directly comparable with the old one. */
function camBasis(az, el, dist, roll){
  const ex=dist*Math.cos(el)*Math.sin(az), ey=0.5-dist*Math.sin(el), ez=dist*Math.cos(el)*Math.cos(az);
  let fx=-ex, fy=0.5-ey, fz=-ez; const fl=Math.hypot(fx,fy,fz)||1; fx/=fl;fy/=fl;fz/=fl;
  let rx=fz, ry=0, rz=-fx; const rl=Math.hypot(rx,rz)||1; rx/=rl; rz/=rl;
  let ux=-rz*fy, uy=rz*fx-rx*fz, uz=rx*fy;
  if(roll){ const c=Math.cos(roll), s=Math.sin(roll);
    const ax=rx*c+ux*s, ay=ry*c+uy*s, az2=rz*c+uz*s;
    const bx=ux*c-rx*s, by=uy*c-ry*s, bz=uz*c-rz*s;
    rx=ax; ry=ay; rz=az2; ux=bx; uy=by; uz=bz; }
  return {ex,ey,ez,fx,fy,fz,rx,ry,rz,ux,uy,uz,dist};
}
function eCam(mf, theta){
  const A=camAt(mf,theta), B=camBasis(A.az,A.el,A.dist,A.roll);
  B.fov=(mf.fovK||0.34*Math.max(1,mf.S)); B.az=A.az; B.el=A.el;
  return B;
}
function massView(scene, mf, theta){
  mf.mat=mf.mat||matOf(scene);
  mf.tearAmp=((scene._corr!=null?scene._corr:60)/100)*0.045;
  /* BLOOD A — the turntable: a perspective camera orbits the body once per
     loop. Marched fresh per frame at coarse grid; the film layer absorbs it. */
  if(mf._vt===theta)return;
  mf._vt=theta;
  const VG=(typeof PVVG!=='undefined'?PVVG:88), S=mf.S, sdf=mf.sdf, C=eCam(mf,theta);
  const hitG=new Uint8Array(VG*VG), nxG=new Float32Array(VG*VG), nyG=new Float32Array(VG*VG),
        nzG=new Float32Array(VG*VG), dpG=new Float32Array(VG*VG),
        pxG=new Float32Array(VG*VG), pyG=new Float32Array(VG*VG), pzG=new Float32Array(VG*VG);
  const aoG=new Float32Array(VG*VG);
  const t0=C.dist-0.95*Math.max(1,S), t1=C.dist+0.95*Math.max(1,S);
  for(let gy=0;gy<VG;gy++){
    const syc=(gy/VG-0.5)*2*C.fov;
    for(let gx=0;gx<VG;gx++){
      const sxc=(gx/VG-0.5)*2*C.fov;
      let dx=C.fx+C.rx*sxc+C.ux*syc, dy=C.fy+C.ry*sxc+C.uy*syc, dz=C.fz+C.rz*sxc+C.uz*syc;
      const dl=Math.hypot(dx,dy,dz); dx/=dl;dy/=dl;dz/=dl;
      const fpx=C.ex+dx*C.dist, fpy=C.ey+dy*C.dist;
      const fold=mf.hasDrape?mf.foldAt(fpx,fpy,S):0;
      let t=t0, hit=0;
      for(let st=0;st<30;st++){
        const px=C.ex+dx*t, py=C.ey+dy*t, pz=C.ez+dz*t;
        let d=sdf(px,py,pz,S,fold);
        if(d<0.08&&mf.tearAmp) d+=surfTear(px,py,pz,theta,mf.mat,mf.tearAmp);
        if(d<0.009){ hit=1;
          const e=0.008, px2=px,py2=py,pz2=pz;
          const nx=sdf(px2+e,py2,pz2,S,fold)-sdf(px2-e,py2,pz2,S,fold);
          const ny=sdf(px2,py2+e,pz2,S,fold)-sdf(px2,py2-e,pz2,S,fold);
          const nz=sdf(px2,py2,pz2+e,S,fold)-sdf(px2,py2,pz2-e,S,fold);
          const nl=Math.hypot(nx,ny,nz)||1;
          const gi=gy*VG+gx;
          nxG[gi]=nx/nl; nyG[gi]=ny/nl; nzG[gi]=nz/nl; dpG[gi]=(t-C.dist)/Math.max(1,S);
          pxG[gi]=px; pyG[gi]=py; pzG[gi]=pz;
          break;
        }
        t+=Math.max(d,0.013);
        if(t>t1)break;
      }
      hitG[gy*VG+gx]=hit;
    }
  }
  for(let y=0;y<FW;y++){const gy=Math.min(VG-1,(y*VG/FW)|0);
    for(let x=0;x<FW;x++){const gx=Math.min(VG-1,(x*VG/FW)|0), gi=gy*VG+gx, i=y*FW+x;
      mf.z[i]=hitG[gi]?2:0;
      mf.NX[i]=nxG[gi]; mf.NY[i]=nyG[gi]; mf.NZ[i]=nzG[gi]; mf.DP[i]=dpG[gi];
      mf.PX[i]=pxG[gi]; mf.PY[i]=pyG[gi]; mf.PZ[i]=pzG[gi];
    }
  }
  /* cheap ambient occlusion: one probe along the normal, at coarse grid */
  for(let gy=0;gy<VG;gy++)for(let gx=0;gx<VG;gx++){
    const gi=gy*VG+gx;
    if(!hitG[gi]){aoG[gi]=1;continue;}
    const d1=sdf(pxG[gi]+nxG[gi]*0.07, pyG[gi]+nyG[gi]*0.07, pzG[gi]+nzG[gi]*0.07, S, 0);
    aoG[gi]=Math.max(0.45, Math.min(1, 0.5+d1*8));
  }
  for(let y=0;y<FW;y++){const gy=Math.min(VG-1,(y*VG/FW)|0);
    for(let x=0;x<FW;x++){const gx=Math.min(VG-1,(x*VG/FW)|0);
      mf.AO[y*FW+x]=aoG[gy*VG+gx]; } }
}
function idolMesh(scene){
  /* BLOOD C — the idol: the same anatomy, incarnated as polygons. */
  const mf=massField(scene);
  if(mf._mesh)return mf._mesh;
  const rng=mulberry32((scene.seed^0x1D01)>>>0);
  const V=[], T=[];
  const addTri=(a,b,c)=>T.push(a,b,c);
  const emit=(lv,lt,px,py,pz,rc,rs)=>{
    const base=V.length/3;
    for(let i=0;i<lv.length;i+=3){
      const x=lv[i], y=lv[i+1], z=lv[i+2];
      V.push(px + x*rc - y*rs, py + x*rs + y*rc, pz + z);
    }
    for(const t of lt) addTri(base+t[0], base+t[1], base+t[2]);
  };
  const sphereGeo=(a,b,c)=>{ const lv=[],lt=[]; const LA=5,LO=7;
    for(let i=0;i<=LA;i++){const ph=i/LA*Math.PI;
      for(let j=0;j<LO;j++){const th=j/LO*TAU;
        lv.push(a*Math.sin(ph)*Math.cos(th), b*Math.cos(ph), (c||a)*Math.sin(ph)*Math.sin(th)); }}
    for(let i=0;i<LA;i++)for(let j=0;j<LO;j++){
      const p0=i*LO+j, p1=i*LO+(j+1)%LO, p2=(i+1)*LO+j, p3=(i+1)*LO+(j+1)%LO;
      lt.push([p0,p2,p1],[p1,p2,p3]); }
    return [lv,lt]; };
  const boxGeo=(a,b,c)=>{ const lv=[],lt=[];
    for(let i=0;i<8;i++)lv.push((i&1?a:-a),(i&2?b:-b),(i&4?(c||0.05):-(c||0.05)));
    const F=[[0,1,3,2],[4,6,7,5],[0,2,6,4],[1,5,7,3],[0,4,5,1],[2,3,7,6]];
    for(const f of F){lt.push([f[0],f[1],f[2]],[f[0],f[2],f[3]]);}
    return [lv,lt]; };
  const torusGeo=(a,b,half)=>{ const lv=[],lt=[]; const SEG=half?6:10, TU=5;
    const arc=half?Math.PI:TAU;
    for(let i=0;i<=SEG;i++){const th=i/SEG*arc;
      for(let j=0;j<TU;j++){const p2=j/TU*TAU;
        const r=a+b*Math.cos(p2);
        lv.push(r*Math.cos(th), r*Math.sin(th), b*Math.sin(p2)); }}
    for(let i=0;i<SEG;i++)for(let j=0;j<TU;j++){
      const p0=i*TU+j, p1=i*TU+(j+1)%TU, p2=(i+1)*TU+j, p3=(i+1)*TU+(j+1)%TU;
      lt.push([p0,p2,p1],[p1,p2,p3]); }
    return [lv,lt]; };
  const cylGeo=(a,b)=>{ const lv=[],lt=[]; const SEG=8;
    for(let i=0;i<SEG;i++){const th=i/SEG*TAU;
      lv.push(a*Math.cos(th), b, a*Math.sin(th));
      lv.push(a*Math.cos(th), -b, a*Math.sin(th)); }
    for(let i=0;i<SEG;i++){const p0=i*2,p1=i*2+1,p2=((i+1)%SEG)*2,p3=((i+1)%SEG)*2+1;
      lt.push([p0,p2,p1],[p1,p2,p3]); }
    const ct=lv.length/3; lv.push(0,b,0); const cb=lv.length/3; lv.push(0,-b,0);
    for(let i=0;i<SEG;i++){ lt.push([ct,((i+1)%SEG)*2,i*2]); lt.push([cb,i*2+1,((i+1)%SEG)*2+1]); }
    return [lv,lt]; };
  const coneGeo=(a,b)=>{ const lv=[],lt=[]; const SEG=8;
    for(let i=0;i<SEG;i++){const th=i/SEG*TAU; lv.push(a*Math.cos(th),-b,a*Math.sin(th));}
    const apex=lv.length/3; lv.push(0,b,0);
    const cb=lv.length/3; lv.push(0,-b,0);
    for(let i=0;i<SEG;i++){ lt.push([apex,(i+1)%SEG,i]); lt.push([cb,i,(i+1)%SEG]); }
    return [lv,lt]; };
  const drapeGeo=(a,b)=>{ const lv=[],lt=[]; const G=8;
    for(let i=0;i<=G;i++)for(let j=0;j<=G;j++){
      const x=(i/G-0.5)*2*a, y=(j/G-0.5)*2*b;
      lv.push(x, y, mf.foldAt(x, y+0.5, mf.S)*0.8); }
    for(let i=0;i<G;i++)for(let j=0;j<G;j++){
      const p0=i*(G+1)+j,p1=p0+1,p2=p0+G+1,p3=p2+1;
      lt.push([p0,p2,p1],[p1,p2,p3]); }
    return [lv,lt]; };
  const geoFor=(t,a,b,c)=>{
    switch(t){
      case 0: return sphereGeo(a,b,c);
      case 1: return boxGeo(a,b,c);
      case 2: return torusGeo(a,Math.max(0.03,b*0.5),false);
      case 3: return cylGeo(a,b);
      case 4: return coneGeo(a,b);
      case 5: return torusGeo(a,Math.max(0.03,b*0.5),true);
      case 6: return boxGeo(a,b,0.02);
      default: return drapeGeo(Math.max(a,0.25),Math.max(b,0.3));
    }
  };
  for(let i=0;i<mf.P.length;i++){ const p=mf.P[i];
    const [lv,lt]=geoFor(p[0],p[4],p[5],p[6]);
    emit(lv,lt,p[1],p[2],p[3],mf.rotc[i],mf.rots[i]);
    if(mf.mirror&&Math.abs(p[1])>0.02) emit(lv,lt,-p[1],p[2],p[3],mf.rotc[i],-mf.rots[i]);
  }
  if(mf.hasDrape){ const [lv,lt]=drapeGeo(0.34,0.42); emit(lv,lt,0,0.5,0,1,0); }
  mf._mesh={V:Float32Array.from(V), T:Uint32Array.from(T), wire:rng()<0.35, jseed:(rng()*0xffff)|0};
  return mf._mesh;
}
function renderIdol(field, scene, theta){
  const mf=massField(scene), M=idolMesh(scene), C=eCam(mf,theta);
  const corr=(scene._corr!=null?scene._corr:60);
  const M2=matOf(scene);
  /* THE GEL IN THE GATE. IDOL never went through renderScene, so UNDER and GOBO
     — the two roles that live in the lighting — simply did not exist for one seed
     in ten. They do now. FLOOR still cannot: an idol has no mirror plane to catch
     a reflection, and faking one would be a lie the rest of the frame contradicts.
     The UI availability readout is what tells you so, rather than a dead slider. */
  const GRs=graftOf(scene);
  const GRU=(GRs&&GRs.roles.under)?GRs:null;
  const GRG=(GRs&&GRs.roles.gobo)?GRs:null;
  if(GRU){
    for(let gy=0;gy<FW;gy++){ const fy=(gy+0.5)/FW;
      for(let gx=0;gx<FW;gx++){
        let b=0.022;
        const L=graftLum(GRU,(gx+0.5)/FW,fy);
        if(L>=0){ b+=((L*0.78+0.010)-b)*GRU.amt;
          if(b<0)b=0; else if(b>0.92)b=0.92; }
        field[gy*FW+gx]=b;
      } }
  } else field.fill(0.022);
  const n=M.V.length/3;
  const sx=new Float32Array(n), sy=new Float32Array(n), sz=new Float32Array(n);
  const wx=new Float32Array(n), wy=new Float32Array(n), wz=new Float32Array(n);
  for(let j=0;j<n;j++){
    let px=M.V[j*3], py=M.V[j*3+1], pz=M.V[j*3+2];
    const h=((j*2654435761)>>>0)%100;
    if(h<16){ const k=(M.jseed%5)+2;
      px+=Math.sin(theta*k+j*0.7)*corr*0.00045;
      py+=Math.cos(theta*k+j*1.3)*corr*0.00030; }
    wx[j]=px; wy[j]=py; wz[j]=pz;
    const ex=px-C.ex, ey=py-C.ey, ez=pz-C.ez;
    const xv=ex*C.rx+ey*C.ry+ez*C.rz, yv=ex*C.ux+ey*C.uy+ez*C.uz, zv=ex*C.fx+ey*C.fy+ez*C.fz;
    sz[j]=zv;
    sx[j]=(xv/Math.max(0.06,zv))/(2*C.fov)*FW+FW/2;
    sy[j]=(yv/Math.max(0.06,zv))/(2*C.fov)*FW+FW/2;
  }
  const nt=M.T.length/3, order=new Array(nt);
  for(let t=0;t<nt;t++){ const a=M.T[t*3],b=M.T[t*3+1],c=M.T[t*3+2];
    order[t]=[(sz[a]+sz[b]+sz[c])/3, t]; }
  order.sort((a,b)=>b[0]-a[0]);
  const laz=theta+mf.lightBase*0.7+0.8;
  const lx=Math.cos(0.5)*Math.sin(laz), ly=-Math.sin(0.5), lz=Math.cos(0.5)*Math.cos(laz);
  /* GOBO basis. The scale is measured, not guessed — the footprint bug cost me a
     whole role by guessing once already. Across 53 idols x 8 thetas the ratio of
     (what the light-space projection actually spans) to (the mesh's own max vertex
     radius) sits in 1.71-1.94, p50 1.83; 1.90 covers all of them. mf.S is NOT the
     unit here: the idol mesh is built in its own normalized space and the measured
     ratio has no correlation with S whatsoever. laz is theta plus a constant, so
     every axis below is exactly TAU-periodic and the loop still closes. */
  let gux=0,guy=0,guz=0,gwx=0,gwy=0,gwz=0,GSG=1;
  if(GRG){
    let mrad=0.001;
    for(let j=0;j<M.V.length;j+=3){
      const rr=Math.sqrt(M.V[j]*M.V[j]+M.V[j+1]*M.V[j+1]+M.V[j+2]*M.V[j+2]);
      if(rr>mrad)mrad=rr; }
    GSG=1.90*mrad;
    let ax=-ly, ay=lx, az=0;
    let al=Math.sqrt(ax*ax+ay*ay+az*az); if(al<1e-4){ax=1;ay=0;az=0;al=1;}
    gux=ax/al; guy=ay/al; guz=az/al;
    gwx=ly*guz-lz*guy; gwy=lz*gux-lx*guz; gwz=lx*guy-ly*gux;
    const wl=Math.sqrt(gwx*gwx+gwy*gwy+gwz*gwz)||1; gwx/=wl; gwy/=wl; gwz/=wl;
  }
  const edge=(x0,y0,x1,y1,v)=>{
    const steps=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))|0;
    for(let k=0;k<=steps;k++){ const x=(x0+(x1-x0)*k/Math.max(1,steps))|0, y=(y0+(y1-y0)*k/Math.max(1,steps))|0;
      if(x>=0&&x<FW&&y>=0&&y<FW) field[y*FW+x]=v; } };
  for(const [,t] of order){
    const a=M.T[t*3], b=M.T[t*3+1], c=M.T[t*3+2];
    if(sz[a]<0.06||sz[b]<0.06||sz[c]<0.06)continue;
    const ux2=wx[b]-wx[a], uy2=wy[b]-wy[a], uz2=wz[b]-wz[a];
    const vx2=wx[c]-wx[a], vy2=wy[c]-wy[a], vz2=wz[c]-wz[a];
    let nx=uy2*vz2-uz2*vy2, ny=uz2*vx2-ux2*vz2, nz=ux2*vy2-uy2*vx2;
    const nl=Math.hypot(nx,ny,nz)||1; nx/=nl;ny/=nl;nz/=nl;
    const facing=nx*C.fx+ny*C.fy+nz*C.fz;
    if(facing>0){nx=-nx;ny=-ny;nz=-nz;}
    const diff=Math.max(0,nx*lx+ny*ly+nz*lz);
    const cx3=(wx[a]+wx[b]+wx[c])/3, cy3=(wy[a]+wy[b]+wy[c])/3, cz3=(wz[a]+wz[b]+wz[c])/3;
    /* Parity with renderScene, not merely an effect: the gel attenuates the DIFFUSE
       term only and adds its own throw. Scaling the whole of v would eat the 0.10
       ambient floor too, and the idol would drop to black wherever the graphic is
       dark — which no other mode does. A role has to be ONE role in ten modes.
       Edges inherit v further down, so wireframe idols get gelled for free. */
    let dif2=diff, goE=0;
    if(GRG){ const L=graftLum(GRG,(cx3*gux+cy3*guy+cz3*guz)/GSG+0.5,
                                  (cx3*gwx+cy3*gwy+cz3*gwz)/GSG+0.5);
      if(L>=0){ dif2*=(1-GRG.amt)+GRG.amt*(0.10+1.75*L); if(dif2<0)dif2=0;
        goE=GRG.amt*0.26*(L-0.42); } }
    let v=0.10+dif2*0.60+Math.pow(Math.max(0,1+(nx*C.fx+ny*C.fy+nz*C.fz)),2.2)*0.20+goE;
    if(v<0)v=0;
    const bandV=Math.sin(cy3*M2.bandF+cx3*2.2+Math.sin(theta)*M2.crawl);
    if(bandV>M2.bandTh)v+=M2.bandA*0.8;
    const ci2=(((cx3*M2.cellF)|0)*7+((cy3*M2.cellF)|0)*13+((cz3*M2.cellF)|0)*29)|0;
    v+=((((ci2*2654435761)>>>9)&255)/255-0.5)*M2.cellA*1.4;
    v=Math.pow(Math.max(0.001,Math.min(0.93,v)),M2.expo);
    if(!M.wire){
      let x0=sx[a],y0=sy[a],x1=sx[b],y1=sy[b],x2=sx[c],y2=sy[c];
      if(y1<y0){[x0,x1]=[x1,x0];[y0,y1]=[y1,y0];}
      if(y2<y0){[x0,x2]=[x2,x0];[y0,y2]=[y2,y0];}
      if(y2<y1){[x1,x2]=[x2,x1];[y1,y2]=[y2,y1];}
      const yA=Math.max(0,y0|0), yB=Math.min(FW-1,y2|0);
      for(let y=yA;y<=yB;y++){
        let xl,xr;
        const t2=y2>y0?(y-y0)/(y2-y0):0; const xac=x0+(x2-x0)*t2;
        let xbc;
        if(y<y1) xbc=x0+((y1>y0)?(y-y0)/(y1-y0):0)*(x1-x0);
        else xbc=x1+((y2>y1)?(y-y1)/(y2-y1):0)*(x2-x1);
        xl=Math.min(xac,xbc); xr=Math.max(xac,xbc);
        const XA=Math.max(0,xl|0), XB=Math.min(FW-1,xr|0);
        for(let x=XA;x<=XB;x++) field[y*FW+x]=v;
      }
    }
    const ev=M.wire?0.88:Math.min(0.97,v+0.22);
    edge(sx[a],sy[a],sx[b],sy[b],ev); edge(sx[b],sy[b],sx[c],sy[c],ev); edge(sx[c],sy[c],sx[a],sy[a],ev);
  }
}
function fringePass(buf, scene, theta){
  /* the single permitted screen artifact: chromatic fringe on the silhouette.
     the body reads as a hologram whose edges cannot fully cohere. */
  const mf=scene._mf; if(!mf||!mf._sv)return;
  const sv=mf._sv, VG=sv.VG;
  const off=2+((scene._corr||60)>70?1:0);
  for(let y=1;y<H-1;y++){
    const cy=Math.min(VG-1,(y*VG/H)|0);
    for(let x=off;x<W-off;x++){
      const cx=(x*VG/W)|0, ci=cy*VG+cx;
      const zc=sv.kind[ci];
      const zl=sv.kind[cy*VG+Math.max(0,cx-1)], zr=sv.kind[cy*VG+Math.min(VG-1,cx+1)];
      if(zc!==zl||zc!==zr){
        const o=(y*W+x)*3;
        buf[o]=buf[o+off*3]||buf[o];
        buf[o+2]=buf[o+2-off*3]||buf[o+2];
      }
    }
  }
}
function depthField(field, scene, theta){
  /* BLOOD B — the deep field: every texture mode gains depth. Height from
     luminance; parallax shear breathes with the loop; fog eats the distance. */
  const rng=mulberry32((scene.seed^0x3DEE)>>>0);
  if(rng()>0.65)return;
  const fog=0.18+rng()*0.30, par=0.5+rng()*0.9, horiz=rng()<0.7, ph=rng()*TAU;
  const DW=90;
  const dep=depthField._d||(depthField._d=new Float32Array(DW*DW));
  const K=FW/DW;
  for(let gy=0;gy<DW;gy++)for(let gx=0;gx<DW;gx++){
    let a=0,c2=0;
    for(let oy=0;oy<K;oy+=2)for(let ox=0;ox<K;ox+=2){ a+=field[((gy*K+oy)|0)*FW+((gx*K+ox)|0)]; c2++; }
    dep[gy*DW+gx]=a/c2;
  }
  const snap=depthField._s||(depthField._s=new Float32Array(FW*FW));
  snap.set(field);
  const sw=Math.sin(theta+ph);
  for(let y=0;y<FW;y++){ const gy=Math.min(DW-1,(y/K)|0);
    for(let x=0;x<FW;x++){
      const d=dep[gy*DW+Math.min(DW-1,(x/K)|0)];
      const off=Math.round(par*(d-0.5)*16*sw);
      let sx2=horiz?x+off:x, sy2=horiz?y:y+off;
      if(sx2<0)sx2=0; else if(sx2>=FW)sx2=FW-1;
      if(sy2<0)sy2=0; else if(sy2>=FW)sy2=FW-1;
      field[y*FW+x]=snap[sy2*FW+sx2]*(1-fog*(1-d));
    }
  }
}
function shadeAt(mf, i, theta){
  /* THE MATERIAL — light on a glitch-textured surface:
     key + rim + occlusion, then object-space corruption bands and cells
     that ride the sculpture as it turns. */
  const M=mf.mat||{bandF:20,bandA:0.1,bandTh:0.4,cellF:12,cellA:0.08,crawl:0.8,sortA:0.06,fogA:0.3,expo:1.2};
  const az=mf.lightBase+Math.sin(theta)*0.42, el=0.62;
  const lx=Math.cos(el)*Math.cos(az), ly=-Math.sin(el), lz=Math.cos(el)*Math.sin(az);
  const diff=Math.max(0, mf.NX[i]*lx+mf.NY[i]*ly+mf.NZ[i]*lz);
  const rim=Math.pow(Math.max(0,1+mf.NZ[i]),2.2)*0.22;
  const ao=mf.AO?mf.AO[i]:1;
  let v=0.07+diff*0.62*ao+rim;
  /* object-space glitch texture: scan bands crawl along the body */
  const px=mf.PX[i], py=mf.PY[i], pz=mf.PZ[i];
  const band=Math.sin(py*M.bandF + Math.sin(px*3.1)*1.4 + theta*0)+Math.sin(theta)*0*0;
  const crawlPh=Math.sin(theta)*M.crawl;
  const bandV=Math.sin(py*M.bandF + px*2.2 + crawlPh);
  if(bandV>M.bandTh) v+=M.bandA*(0.4+diff);
  else if(bandV<-0.85) v-=M.bandA*0.7;
  /* corruption cells: block-grief welded to the surface */
  const ci=(((px*M.cellF)|0)*7+((py*M.cellF)|0)*13+((pz*M.cellF)|0)*29)|0;
  const ch=(((ci*2654435761)>>>9)&255)/255;
  v+=(ch-0.5)*M.cellA*(1+((scene_corr_g||60)/100));
  /* sorted striation: luminance ramp inside each band */
  const fr=(py*M.bandF+crawlPh)%1;
  v+=(fr<0?fr+1:fr)*M.sortA-M.sortA*0.5;
  /* atmosphere: depth fog toward the void */
  const haze=Math.max(0,Math.min(1,(mf.DP[i]+0.55)*M.fogA*1.6));
  v=v*(1-haze*0.55)+0.02*haze;
  v+=mf.BP[i]*(0.20+diff*0.5);
  v=Math.pow(Math.max(0.001,v), M.expo);
  return Math.max(0.03,Math.min(0.97,v));
}
let scene_corr_g=60;
function renderMass(field, scene, theta, mf){
  scene_corr_g=(scene._corr!=null?scene._corr:60);
  massView(scene, mf, theta);
  const no2=scene.noise2, gp=mf.grainPh;
  for(let y=0;y<FW;y++){
    const row=y*FW, fy=y/FW;
    for(let x=0;x<FW;x++){
      const i=row+x;
      if(!mf.z[i]){
        /* the void is sacred: deep, graded, barely breathing */
        const g2=0.018+0.020*(1-fy)+no2(x*0.07,y*0.07+gp)*0.008;
        field[i]=g2; continue;
      }
      let v=shadeAt(mf,i,theta);
      v+=no2(x*0.37+gp, y*0.37)*0.030;
      const fx2=x/FW-0.5;
      v*=1-0.22*(fx2*fx2+(fy-0.5)*(fy-0.5))*2.2;
      field[i]=Math.max(0.03,Math.min(0.97,v));
    }
  }
}
const DCT_C=(()=>{const c=new Float32Array(64);
  for(let u=0;u<8;u++)for(let x=0;x<8;x++)c[u*8+x]=Math.cos((2*x+1)*u*Math.PI/16)*(u===0?0.3535534:0.5);
  return c;})();
function dctGhost(buf, scene, theta, corr){
  /* authentic JPEG grief: 8x8 DCT, brutal quantization, inverse.
     Bands of macroblock rows are wounded; geometry survives in compression form. */
  if((scene.mode!=='MASS'&&scene.mode!=='IDOL')||corr<12)return;
  const rng=mulberry32((scene.seed^0xDC7)>>>0);
  const q=6+ (corr*0.9)|0;
  const bandN=1+((rng()*2)|0)+ (corr>70?1:0);
  const tmp=new Float32Array(64), tm2=new Float32Array(64);
  for(let bnd=0;bnd<bandN;bnd++){
    const y0=((rng()*H*0.85)|0)&~7, rows=(24+((rng()*80)|0))&~7;
    const drift=Math.sin(theta+bnd*2.1)*0.5+0.5;      // the wound breathes across the loop
    if(drift<0.25)continue;
    for(let ch=0;ch<3;ch++){
      for(let by=y0;by<Math.min(H-8,y0+rows);by+=8){
        for(let bx=0;bx<W-8;bx+=8){
          if(((bx>>3)+(by>>3))%3===((scene.seed>>2)%3))continue;
          for(let v=0;v<8;v++)for(let u=0;u<8;u++){
            let acc=0;
            for(let xx=0;xx<8;xx++)acc+=buf[((by+v)*W+bx+xx)*3+ch]*DCT_C[u*8+xx];
            tmp[v*8+u]=acc;
          }
          for(let u=0;u<8;u++)for(let v2=0;v2<8;v2++){
            let acc=0;
            for(let yy=0;yy<8;yy++)acc+=tmp[yy*8+u]*DCT_C[v2*8+yy];
            const Q=q*(1+(u+v2)*1.8);
            tm2[v2*8+u]=(u+v2>4+((1-drift)*4))?0:Math.round(acc/Q)*Q;
          }
          for(let v3=0;v3<8;v3++)for(let u=0;u<8;u++){
            let acc=0;
            for(let uu=0;uu<8;uu++)acc+=tm2[v3*8+uu]*DCT_C[uu*8+u];
            tmp[v3*8+u]=acc;
          }
          for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++){
            let acc=0;
            for(let vv=0;vv<8;vv++)acc+=tmp[vv*8+xx]*DCT_C[vv*8+yy];
            const o=((by+yy)*W+bx+xx)*3+ch;
            buf[o]=Math.max(0,Math.min(255,acc));
          }
        }
      }
    }
  }
}
function voidCarve(buf, scene, grad){
  const vf=(scene.voidamt|0)/100;
  if(vf<=0||scene.mode==='MASS')return;        // MASS carries its own void
  const mf=massField(scene);
  const r0=grad[0],g0=grad[1],b0=grad[2];
  for(let y=0;y<H;y++){const cy=((y*FW/H)|0)*FW;
    for(let x=0;x<W;x++){
      if(mf.n[cy+((x*FW/W)|0)]<mf.q){ const o=(y*W+x)*3; buf[o]=r0; buf[o+1]=g0; buf[o+2]=b0; }
    }
  }
}
function chromaCap(buf, scene, grad){
  if(!(scene.chromacap|0))return;
  let lut=scene._capLUT;
  if(!lut){
    const rng=mulberry32((scene.seed^0xCA9)>>>0);
    const picks=[2, 40+((rng()*60)|0), 120+((rng()*60)|0), 205+((rng()*48)|0)];
    const A=[]; for(const p of picks)A.push(grad[p*3],grad[p*3+1],grad[p*3+2]);
    lut=scene._capLUT=new Uint8Array(32768*3);
    for(let r=0;r<32;r++)for(let g=0;g<32;g++)for(let b=0;b<32;b++){
      const R=r*8+4,G=g*8+4,B=b*8+4; let bi=0,bd=1e9;
      for(let k=0;k<A.length;k+=3){
        const d=(R-A[k])*(R-A[k])+(G-A[k+1])*(G-A[k+1])+(B-A[k+2])*(B-A[k+2]);
        if(d<bd){bd=d;bi=k;}
      }
      const o=((r<<10)|(g<<5)|b)*3; lut[o]=A[bi]; lut[o+1]=A[bi+1]; lut[o+2]=A[bi+2];
    }
  }
  for(let i=0;i<buf.length;i+=3){
    const o=(((buf[i]>>3)<<10)|((buf[i+1]>>3)<<5)|(buf[i+2]>>3))*3;
    buf[i]=lut[o]; buf[i+1]=lut[o+1]; buf[i+2]=lut[o+2];
  }
}
function seatWounds(scene){
  const loc=(scene.locality|0)/100;
  if(loc<=0)return;
  const mf=massField(scene);
  if(mf.vf<=0&&scene.mode!=='MASS')return;     // locality grips the coastline; no coast, no grip
  const coast=[];
  const band=0.035;
  for(let y=2;y<FW-2;y+=2)for(let x=2;x<FW-2;x+=2){
    if(Math.abs(mf.n[y*FW+x]-mf.q)<band)coast.push((y<<16)|x);
  }
  if(!coast.length)return;
  const rng=mulberry32((scene.seed^0x77D5)>>>0);
  if(scene.blocks)for(const b of scene.blocks){
    if(rng()>loc)continue;
    const c=coast[(rng()*coast.length)|0];
    b.x=Math.max(0,Math.min(W-b.w-1, (((c&0xffff)/FW)*W - b.w/2)|0));
    b.y=Math.max(0,Math.min(H-b.h-1, (((c>>16)/FW)*H - b.h/2)|0));
  }
  if(scene.bands)for(const bd of scene.bands){
    if(rng()>loc)continue;
    const c=coast[(rng()*coast.length)|0];
    bd.y=Math.max(0,Math.min(H-4, (((c>>16)/FW)*H - bd.h/2)|0));
  }
}
/* ============================================================================
   DIGITAL PASS  (datablock displacement + pixel sort)  in-place on buf
   ========================================================================== */
function digitalPass(buf,snap,scene,theta,corr,fx){
  const g=scene.vibe.g;
  if(fx.blocks){
    const bcorr=Math.min(150,corr*g.blocks);
    snap.set(buf); // read displaced source from snapshot
    const B=scene.blocks;
    for(let i=0;i<B.length;i++){const b=B[i];
      const env=Math.sin(theta*b.k+b.ph); if(Math.abs(env)<0.12)continue;
      const off=Math.round(env*b.amp*(0.3+bcorr*0.06));
      if(off===0)continue;
      const x0=b.x, y0=b.y, w=Math.min(b.w,W-x0), h=Math.min(b.h,H-y0);
      for(let yy=0;yy<h;yy++){const ay=y0+yy;
        for(let xx=0;xx<w;xx++){
          let sx=x0+xx+off; if(sx<0)sx+=W; else if(sx>=W)sx-=W;
          const so=(ay*W+sx)*3, doff=(ay*W+x0+xx)*3;
          if(b.chan===3){ buf[doff]=snap[so];buf[doff+1]=snap[so+1];buf[doff+2]=snap[so+2]; }
          else { buf[doff+b.chan]=snap[so+b.chan]; } // single-channel tear
        }
      }
    }
  }
  if(fx.pixelsort){
    // snapshot-based luminance sort across periodic bands (clean source, no clobber)
    pixelSortCorrect(buf,snap,scene,theta,Math.min(150,corr*g.pixelsort));
  }
}
function pixelSortCorrect(buf,snap,scene,theta,corr){
  /* Asendorf grammar: intervals are defined by the image itself — runs of
     luminance inside a threshold window. The sort follows the picture's own
     anatomy, so the smear is coherent with what it destroys. */
  const Bd=scene.bands; snap.set(buf); const gate=0.25-(corr||0)*0.002;
  const rng=mulberry32((scene.seed^0x50F7)>>>0);
  const lo=40+rng()*60, hi=lo+90+rng()*90, asc=rng()<0.5;
  const lum=(o)=>snap[o]*0.299+snap[o+1]*0.587+snap[o+2]*0.114;
  const sortRun=(ay,xa,xb)=>{
    const n=xb-xa; if(n<6)return;
    const order=new Array(n);
    for(let k=0;k<n;k++)order[k]=[lum((ay*W+xa+k)*3),k];
    order.sort(asc?((a,b)=>a[0]-b[0]):((a,b)=>b[0]-a[0]));
    for(let k=0;k<n;k++){const so=(ay*W+xa+order[k][1])*3, doo=(ay*W+xa+k)*3;
      buf[doo]=snap[so];buf[doo+1]=snap[so+1];buf[doo+2]=snap[so+2];}
  };
  for(let i=0;i<Bd.length;i++){const bd=Bd[i];
    const env=Math.sin(theta*bd.k+bd.ph); if(env<gate)continue;
    const h=Math.min(bd.h,H-bd.y);
    for(let yy=0;yy<h;yy++){const ay=bd.y+yy; if(ay<0||ay>=H)continue;
      let run=-1;
      for(let x=0;x<W;x++){
        const L=lum((ay*W+x)*3);
        const inside=L>=lo&&L<=hi;
        if(inside&&run<0)run=x;
        else if(!inside&&run>=0){ sortRun(ay,run,x); run=-1; }
      }
      if(run>=0)sortRun(ay,run,W);
    }
  }
}

/* ============================================================================
   DITHER + QUANTIZE  -> palette indices
   ========================================================================== */
function quantize(buf,indices,near,dAmt,tect,quake){
  for(let y=0;y<H;y++){const brow=(y&7)*8, trow=(y>>3)*135;
    for(let x=0;x<W;x++){
      const o=(y*W+x)*3; let d;
      let bonus=0;
      if(tect){
        const t=trow+(x>>3);
        d=BAYER[(((y&7)+tect.oy[t])&7)*8+(((x&7)+tect.ox[t])&7)]*dAmt;
        if(tect.fb[t]&&(((x&7)===0)||((y&7)===0)))bonus=34;
      } else {
        d=BAYER[brow+(x&7)]*dAmt;
      }
      if(quake){
        const t=trow+(x>>3);
        if(quake.m[t]){
          /* DQUAKE — the dither matrix itself convulses: cells where the
             threshold geometry bit-rotates per frame and the amplitude
             multiplies. Corruption inside the color decision — unforgeable. */
          d=BAYER[(((y&7)+quake.ry[t])&7)*8+(((x&7)+quake.rx[t])&7)]*dAmt*quake.mul[t];
        }
      }
      let r=buf[o]+d+bonus, g=buf[o+1]+d+bonus, b=buf[o+2]+d+bonus;
      r=r<0?0:r>255?255:r; g=g<0?0:g>255?255:g; b=b<0?0:b>255?255:b;
      indices[y*W+x]=near[((r>>3)<<10)|((g>>3)<<5)|(b>>3)];
    }
  }
}

function buildQuake(scene,theta,corr){
  const C=corr/100;
  const q=buildQuake._q||(buildQuake._q={m:new Uint8Array(135*135),rx:new Uint8Array(135*135),ry:new Uint8Array(135*135),mul:new Float32Array(135*135)});
  const st=mulberry32((scene.seed^0xD17E)>>>0);         // static epicenter field per seed
  const fk=Math.round(theta/TAU*4096)&4095;
  const cx=st()*135, cy=st()*135, rad=(18+st()*45)*(0.5+C);
  const r2=rad*rad;
  for(let gy=0;gy<135;gy++)for(let gx=0;gx<135;gx++){
    const t=gy*135+gx, dx=gx-cx, dy=gy-cy, d2=dx*dx+dy*dy;
    if(d2<r2){
      q.m[t]=1;
      const h=((gx*73856093)^(gy*19349663)^(fk*83492791))>>>0;
      q.rx[t]=h&7; q.ry[t]=(h>>>3)&7;
      q.mul[t]=1.6+((h>>>6)&3)*1.3;
    } else q.m[t]=0;
  }
  return q;
}
/* ============================================================================
   INDEX STAGE — corruption AFTER quantization, on palette indices themselves.
   No RGB filter can imitate this: the artifacts are native to the LUT.
   CLASH (scanlines slot) · IXTEAR (ghost slot) · XSLAM (invert slot) ·
   RANSOM (mirror slot). All per-frame chaos is fkRng => loop-exact.
   ========================================================================== */
function indexPass(ind,P,scene,theta,corr,fx){
  if(scene.epoch===1)return;                      // the classic era predates index-space corruption
  const C=corr/100;
  if(fx.scanlines){
    /* ATTRCLASH — ZX Spectrum attribute clash: 8x8 cells forced to their two
       dominant palette indices; some cells corrupt and swap or drift. */
    const R=fkRng(scene,theta,0xC1A5B);
    const hist=indexPass._h||(indexPass._h=new Uint16Array(256));
    const cov=0.25+C*0.75;
    for(let cy2=0;cy2<H;cy2+=8){
      for(let cx2=0;cx2<W;cx2+=8){
        const cellH=((cx2*2654435761)^(cy2*40503)^(scene.seed))>>>0;
        if(((cellH&1023)/1024)>=cov)continue;
        hist.fill(0);
        for(let y=cy2;y<cy2+8;y++){const row=y*W;
          for(let x=cx2;x<cx2+8;x++)hist[ind[row+x]]++;}
        let a=0,b2=0,ha=-1,hb=-1;
        for(let i=0;i<P;i++){const h=hist[i];
          if(h>ha){hb=ha;b2=a;ha=h;a=i;} else if(h>hb){hb=h;b2=i;} }
        if(hb<=0)continue;
        let ia=a, ib=b2;
        if(R()<0.05*(0.5+C)){ const t=ia; ia=ib; ib=t; }          // clash cell: swap
        if(R()<0.03*(0.5+C)){ ia=(ia+((R()*P)|0))%P; }            // corrupt cell: drift
        const mid=(ia+ib)>>1;
        for(let y=cy2;y<cy2+8;y++){const row=y*W;
          for(let x=cx2;x<cx2+8;x++){const o=row+x;
            ind[o]=(Math.abs(ind[o]-ia)<=Math.abs(ind[o]-ib))?ia:ib;}}
      }
    }
  }
  if(fx.ghost){
    /* IXTEAR — the palette LUT tears: bands of indices shifted through the
       gradient with ragged per-row edges. Shapes wear the wrong band of light. */
    const R=fkRng(scene,theta,0x17EA2);
    const nB=2+((C*5)|0);
    for(let b2=0;b2<nB;b2++){
      const y0=(R()*H)|0, h=10+(R()*90)|0;
      const k=1+((R()*(P*0.4))|0);
      const x0=(R()*W*0.5)|0, len=(W*0.3+R()*W*0.7)|0;
      for(let yy=0;yy<h;yy++){const ay=y0+yy; if(ay>=H)break; const row=ay*W;
        const rag=(((ay*2654435761)^(scene.seed))>>>8)&15;       // ragged edge
        for(let x=0;x<len;x++){const ax=x0+rag+x; if(ax>=W)break;
          const o=row+ax; ind[o]=(ind[o]+k)%P;}
      }
    }
  }
  if(fx.mirror){
    /* RANSOM — crude stamped rectangles (XCOPY axis): per-frame re-rolled
       positions, each carrying its own index violence, dark punched outline. */
    const R=fkRng(scene,theta,0xFA45);
    const nR=1+((C*3)|0);
    for(let i=0;i<nR;i++){
      const w=(60+R()*260)|0, h=(50+R()*220)|0;
      const x0=(R()*(W-w))|0, y0=(R()*(H-h))|0;
      const op=(R()*3)|0, half=(P>>1)||1;
      for(let yy=0;yy<h;yy++){const row=(y0+yy)*W;
        for(let xx=0;xx<w;xx++){const o=row+x0+xx;
          if(op===0) ind[o]=P-1-ind[o];                           // negative
          else if(op===1) ind[o]=(ind[o]+half)%P;                 // half-spectrum slam
          else ind[o]=(ind[o]*3)%P;                               // LUT scramble
        }
      }                                                           // no outline — doctrine: no borders
    }
  }
  if(fx.invert){
    /* XSLAM — the strobe assault: at 2-4 seeded loop positions the whole frame
       slams to negative and the canvas jolts. One-frame violence, loop-exact. */
    const sl=mulberry32((scene.seed^0x51A3)>>>0);
    const nS=2+((sl()*3)|0);
    for(let i=0;i<nS;i++){
      const pos=sl()*TAU, jx=Math.round((sl()-0.5)*24), jy=Math.round((sl()-0.5)*16);
      let d=Math.abs(theta-pos); if(d>TAU/2)d=TAU-d;
      if(d<Math.PI/28){
        for(let q=0;q<ind.length;q++)ind[q]=P-1-ind[q];
        if(jx||jy){
          const tmp=indexPass._t&&indexPass._t.length===ind.length?indexPass._t:(indexPass._t=new Uint8Array(ind.length));
          tmp.set(ind);
          for(let y=0;y<H;y++){let sy=y+jy; sy=((sy%H)+H)%H; const row=y*W, srow=sy*W;
            for(let x=0;x<W;x++){let sx=x+jx; sx=((sx%W)+W)%W; ind[row+x]=tmp[srow+sx];}}
        }
        break;
      }
    }
  }
}
/* frame-keyed rng: chaos that re-rolls EVERY FRAME yet loops perfectly,
   because frame i always rolls frame i's dice. The XCOPY theorem. */
function fkRng(scene,theta,salt){
  const fk=Math.round(theta/TAU*4096)&4095;
  return mulberry32((scene.seed^(fk*2654435761)^salt)>>>0);
}
/* ============================================================================
   HEAVY CORRUPTION  — 10 extra effects. Every animated term uses sin/cos of an
   INTEGER multiple of theta, so each one stays 2pi-periodic => seamless loop.
   corr (0..100) drives intensity; C=corr/100.
   ========================================================================== */
function fxWave(buf,snap,scene,theta,corr){
  if(scene.epoch===1)return fxWave_classic(buf,snap,scene,theta,corr);
  /* SHRED — torn-band displacement. Smooth sync ripple is dead: bands get
     per-frame re-rolled integer offsets (hard tears, not waves), some bands
     duplicate their neighbor (smear ghost). No two frames tear alike. */
  const C=corr/100; snap.set(buf);
  const R=fkRng(scene,theta,0x5A7ED);
  const nB=3+((C*9)|0);
  for(let b2=0;b2<nB;b2++){
    const y0=(R()*H)|0, h=6+(R()*44)|0;
    const off=Math.round((R()-0.5)*2*(8+C*90));
    const dup=R()<0.28;
    if(!off&&!dup)continue;
    for(let yy=0;yy<h;yy++){const ay=y0+yy; if(ay>=H)break;
      const sy=dup?Math.min(H-1,ay+h):ay;
      const drow=ay*W*3, srow=sy*W*3;
      for(let x=0;x<W;x++){
        let sx=x+off; if(sx<0)sx+=W; else if(sx>=W)sx-=W;
        const so=srow+sx*3, doff=drow+x*3;
        buf[doff]=snap[so];buf[doff+1]=snap[so+1];buf[doff+2]=snap[so+2];
      }
    }
  }
}
function fxSlice(buf,snap,scene,theta,corr){           // 2. wrap-around slice shear
  const C=corr/100; snap.set(buf); const S=scene.extra.slices;
  for(let i=0;i<S.length;i++){const s=S[i];
    const off=Math.round(Math.sin(theta*s.k+s.ph)*s.amp*(0.3+C*1.8)); if(!off)continue;
    const h=Math.min(s.h,H-s.y);
    for(let yy=0;yy<h;yy++){const row=(s.y+yy)*W;
      for(let x=0;x<W;x++){ let sx=(x-off)%W; if(sx<0)sx+=W; const so=(row+sx)*3,o=(row+x)*3;
        buf[o]=snap[so];buf[o+1]=snap[so+1];buf[o+2]=snap[so+2]; } }
  }
}
function fxVroll(buf,snap,scene,theta,corr){           // 3. vertical hold wobble
  const C=corr/100; const v=scene.extra.vroll;
  const off=Math.round(Math.sin(theta*v.k+v.ph)*v.amp*(0.3+C*1.6)); if(!off)return;
  snap.set(buf);
  for(let y=0;y<H;y++){ let sy=((y-off)%H+H)%H; const so=sy*W*3, o=y*W*3;
    for(let i=0;i<W*3;i++) buf[o+i]=snap[so+i]; }
}
function fxMosh(buf,snap,scene,theta,corr){            // 4. macroblock teleport (datamosh)
  const C=corr/100; snap.set(buf); const M=scene.extra.mosh; const gate=0.55-C*0.5;
  for(let i=0;i<M.length;i++){const m=M[i]; if(Math.sin(theta*m.k+m.ph)<gate)continue;
    const w=Math.min(m.w,W-Math.max(m.sx,m.dx)), h=Math.min(m.h,H-Math.max(m.sy,m.dy)); if(w<=0||h<=0)continue;
    const wb=w*3;
    for(let yy=0;yy<h;yy++){ const so=((m.sy+yy)*W+m.sx)*3, dst=((m.dy+yy)*W+m.dx)*3;
      for(let xx=0;xx<wb;xx++) buf[dst+xx]=snap[so+xx]; }
  }
}
function fxGhost(buf,snap,scene,theta,corr){           // 5. spatial double-image
  const C=corr/100; snap.set(buf); const g=scene.extra.ghost;
  const dx=Math.round(g.dx*Math.sin(theta*g.k+g.ph)*g.amp*(0.5+C*2.2));
  const dy=Math.round(g.dy*Math.cos(theta*g.k+g.ph)*g.amp*(0.5+C*2.2));
  const a=0.35+C*0.45;
  for(let y=0;y<H;y++){ const sy=y-dy; if(sy<0||sy>=H)continue;
    for(let x=0;x<W;x++){ const sx=x-dx; if(sx<0||sx>=W)continue;
      const so=(sy*W+sx)*3,o=(y*W+x)*3;
      const r=snap[so]*a;   if(r>buf[o])buf[o]=r;
      const gg=snap[so+1]*a;if(gg>buf[o+1])buf[o+1]=gg;
      const bb=snap[so+2]*a;if(bb>buf[o+2])buf[o+2]=bb; }
  }
}
function fxMelt(buf,scene,theta,corr){                 // 6. vertical neon drip
  const C=corr/100; const m=scene.extra.melt;
  const env=0.5+0.5*Math.sin(theta*m.k+m.ph);
  const decay=0.85+(0.10+C*0.04)*env;
  for(let x=0;x<W;x++){ let cr=0,cg=0,cb=0;
    for(let y=0;y<H;y++){const o=(y*W+x)*3;
      cr*=decay; cg*=decay; cb*=decay;
      if(buf[o]>cr)cr=buf[o]; else buf[o]=cr;
      if(buf[o+1]>cg)cg=buf[o+1]; else buf[o+1]=cg;
      if(buf[o+2]>cb)cb=buf[o+2]; else buf[o+2]=cb; }
  }
}
function fxBleed(buf,scene,theta,corr){                // 7. horizontal chroma smear
  const C=corr/100; const b=scene.extra.bleed;
  const env=0.5+0.5*Math.sin(theta*b.k+b.ph);
  const decay=0.80+(0.10+C*0.08)*env;
  for(let y=0;y<H;y++){const row=y*W*3;
    let cr=0; for(let x=0;x<W;x++){const o=row+x*3;   cr*=decay; if(buf[o]>cr)cr=buf[o]; else buf[o]=cr;}
    let cb=0; for(let x=W-1;x>=0;x--){const o=row+x*3+2; cb*=decay; if(buf[o]>cb)cb=buf[o]; else buf[o]=cb;}
  }
}
function fxInvert(buf,scene,theta,corr){               // 8. moving negative / channel-rot bands
  const C=corr/100; const IB=scene.extra.invBands; const gate=0.3-C*0.28;
  for(let i=0;i<IB.length;i++){const b=IB[i]; const env=Math.sin(theta*b.k+b.ph); if(env<gate)continue;
    const yoff=Math.round(Math.sin(theta*b.k+b.ph)*(10+C*70));
    for(let yy=0;yy<b.h;yy++){ const ay=((b.y+yoff+yy)%H+H)%H; const row=ay*W;
      for(let x=0;x<W;x++){const o=(row+x)*3;
        if(b.mode===0){buf[o]=255-buf[o];buf[o+1]=255-buf[o+1];buf[o+2]=255-buf[o+2];}
        else if(b.mode===1){const t=buf[o];buf[o]=buf[o+1];buf[o+1]=buf[o+2];buf[o+2]=t;}
        else{buf[o]=255-buf[o];buf[o+2]=255-buf[o+2];} }
    }
  }
}
function fxCrush(buf,scene,theta,corr){                // 9. bit-crush / posterize pulse
  const C=corr/100; const cr=scene.extra.crush;
  const env=0.5+0.5*Math.sin(theta*cr.k+cr.ph);
  const levels=Math.max(2, Math.round(16-(C*env)*13));
  const step=255/(levels-1);
  for(let i=0;i<buf.length;i++){ let v=Math.round(buf[i]/step)*step; buf[i]=v>255?255:v; }
}
function fxDropout(buf,scene,theta,corr){
  if(scene.epoch===1)return fxDropout_classic(buf,scene,theta,corr);
  /* TAPROT — tape dropout the way tape actually dies (Ina Vare / Max Capacity
     axis): streaks of sparkling noise smeared with the content they're eating,
     plus a head-switch tear strip at the frame's foot. Never a flat slab. */
  const C=corr/100;
  const R=fkRng(scene,theta,0x7A9E0);
  const nS=2+((C*7)|0);
  for(let i=0;i<nS;i++){
    const y0=(R()*H)|0, h=2+(R()*13)|0;
    const x0=(R()*W*0.6)|0, len=(W*0.15+R()*W*0.8)|0;
    const drift=1+(R()*4)|0;
    for(let yy=0;yy<h;yy++){const ay=y0+yy; if(ay>=H)break; const row=ay*W;
      for(let x=0;x<len;x++){const ax=x0+x; if(ax>=W)break;
        const o=(row+ax)*3;
        const sm=(row+Math.max(0,ax-((x*drift)&31)))*3;      // horizontal luma smear
        const lum=buf[sm]*0.299+buf[sm+1]*0.587+buf[sm+2]*0.114;
        let n=((ax*374761393+ay*668265263+((theta*997)|0)*1274126177)>>>0); n=(n^(n>>>15))&255;
        const v=lum*0.45+n*0.55*(0.5+C*0.5);
        const w2=v>235?235:v;
        buf[o]=w2; buf[o+1]=w2*0.96; buf[o+2]=w2*0.88;        // warm tape sparkle
      }
    }
  }
  /* head-switch tear: bottom strip lurches per frame */
  const hs=(H*0.972)|0, off=Math.round((R()-0.5)*2*(6+C*40));
  if(off){
    for(let y=hs;y<H;y++){const row=y*W*3;
      const tmp=buf.slice(row,row+W*3);
      for(let x=0;x<W;x++){
        let sx=x+off; if(sx<0)sx+=W; else if(sx>=W)sx-=W;
        const doff=row+x*3, so=sx*3;
        buf[doff]=tmp[so];buf[doff+1]=tmp[so+1];buf[doff+2]=tmp[so+2];
      }
    }
  }
}

/* ===== CLASSIC EPOCH BODIES — resurrected verbatim from 6c0e0add ===== */
function fxWave_classic(buf,snap,scene,theta,corr){            // 1. sync ripple — seeded orientation/waveform
  const C=corr/100; snap.set(buf); const ws=scene.extra.waves;
  // horizontal-shifting waves (per row)
  let anyH=false, anyV=false;
  for(const w of ws){ if(w.vert)anyV=true; else anyH=true; }
  if(anyH){
    for(let y=0;y<H;y++){
      let s=0;
      for(let i=0;i<ws.length;i++){const w=ws[i]; if(w.vert)continue;
        s+=shp(Math.sin(y*w.freq*w.harm+theta*w.k+w.ph),w.shape)*w.amp;}
      let sh=Math.round(s*(0.3+C*1.8)); if(!sh)continue;
      const row=y*W;
      for(let x=0;x<W;x++){ let sx=(x-sh)%W; if(sx<0)sx+=W; const so=(row+sx)*3,o=(row+x)*3;
        buf[o]=snap[so];buf[o+1]=snap[so+1];buf[o+2]=snap[so+2]; }
    }
  }
  if(anyV){                                            // vertical-shifting waves (per column)
    snap.set(buf);
    const colSh=fxWave._cs||(fxWave._cs=new Int16Array(W));
    for(let x=0;x<W;x++){
      let s=0;
      for(let i=0;i<ws.length;i++){const w=ws[i]; if(!w.vert)continue;
        s+=shp(Math.sin(x*w.freq*w.harm+theta*w.k+w.ph),w.shape)*w.amp;}
      colSh[x]=Math.round(s*(0.3+C*1.8));
    }
    for(let y=0;y<H;y++){const row=y*W;
      for(let x=0;x<W;x++){const sh=colSh[x]; if(!sh)continue;
        let sy=(y-sh)%H; if(sy<0)sy+=H;
        const so=(sy*W+x)*3, o=(row+x)*3;
        buf[o]=snap[so];buf[o+1]=snap[so+1];buf[o+2]=snap[so+2]; }
    }
  }
}
function fxDropout_classic(buf,scene,theta,corr){              // 10. signal-loss blocks
  const C=corr/100; const D=scene.extra.dropouts; const gate=0.62-C*0.5;
  for(let i=0;i<D.length;i++){const d=D[i]; if(Math.sin(theta*d.k+d.ph)<gate)continue;
    const val=d.white?255:0; const w=Math.min(d.w,W-d.x),h=Math.min(d.h,H-d.y);
    for(let yy=0;yy<h;yy++){const row=(d.y+yy)*W;
      for(let x=0;x<w;x++){const o=(row+d.x+x)*3; buf[o]=val;buf[o+1]=val;buf[o+2]=val;} }
  }
}
function fxGhost_classic(buf,snap,scene,theta,corr){           // 5. spatial double-image
  const C=corr/100; snap.set(buf); const g=scene.extra.ghost;
  const dx=Math.round(g.dx*Math.sin(theta*g.k+g.ph)*g.amp*(0.5+C*2.2));
  const dy=Math.round(g.dy*Math.cos(theta*g.k+g.ph)*g.amp*(0.5+C*2.2));
  const a=0.35+C*0.45;
  for(let y=0;y<H;y++){ const sy=y-dy; if(sy<0||sy>=H)continue;
    for(let x=0;x<W;x++){ const sx=x-dx; if(sx<0||sx>=W)continue;
      const so=(sy*W+sx)*3,o=(y*W+x)*3;
      const r=snap[so]*a;   if(r>buf[o])buf[o]=r;
      const gg=snap[so+1]*a;if(gg>buf[o+1])buf[o+1]=gg;
      const bb=snap[so+2]*a;if(bb>buf[o+2])buf[o+2]=bb; }
  }
}
function fxInvert_classic(buf,scene,theta,corr){               // 8. moving negative / channel-rot bands
  const C=corr/100; const IB=scene.extra.invBands; const gate=0.3-C*0.28;
  for(let i=0;i<IB.length;i++){const b=IB[i]; const env=Math.sin(theta*b.k+b.ph); if(env<gate)continue;
    const yoff=Math.round(Math.sin(theta*b.k+b.ph)*(10+C*70));
    for(let yy=0;yy<b.h;yy++){ const ay=((b.y+yoff+yy)%H+H)%H; const row=ay*W;
      for(let x=0;x<W;x++){const o=(row+x)*3;
        if(b.mode===0){buf[o]=255-buf[o];buf[o+1]=255-buf[o+1];buf[o+2]=255-buf[o+2];}
        else if(b.mode===1){const t=buf[o];buf[o]=buf[o+1];buf[o+1]=buf[o+2];buf[o+2]=t;}
        else{buf[o]=255-buf[o];buf[o+2]=255-buf[o+2];} }
    }
  }
}
function fxCrush_classic(buf,scene,theta,corr){                // 9. bit-crush / posterize pulse
  const C=corr/100; const cr=scene.extra.crush;
  const env=0.5+0.5*Math.sin(theta*cr.k+cr.ph);
  const levels=Math.max(2, Math.round(16-(C*env)*13));
  const step=255/(levels-1);
  for(let i=0;i<buf.length;i++){ let v=Math.round(buf[i]/step)*step; buf[i]=v>255?255:v; }
}
function combineMirror_classic(a,c,scene,theta){
  const m=scene.extra2.mirror;
  if(!m.sinX){ m.sinX=new Float32Array(W); m.cosX=new Float32Array(W);
    for(let x=0;x<W;x++){m.sinX[x]=Math.sin(x*m.fx);m.cosX[x]=Math.cos(x*m.fx);} }
  for(let y=0;y<H;y++){
    const B=y*m.fy+theta*m.k+m.ph, sB=Math.sin(B), cB=Math.cos(B);
    const row=y*W*3;
    for(let x=0;x<W;x++){
      const t=0.5+0.5*(m.sinX[x]*cB+m.cosX[x]*sB);
      const o=row+x*3;
      a[o]  +=(c[o]  -a[o]  )*t;
      a[o+1]+=(c[o+1]-a[o+1])*t;
      a[o+2]+=(c[o+2]-a[o+2])*t;
    }
  }
}

/* 3. MOTION FLAY — the render is replaced by its own time-derivative: the
   difference between now and 1/8th of a loop from now, amplified. Stillness
   goes black; only change survives as electric edges. */
const HEAVY_FX={
  wave:(b,s,sc,t,c)=>fxWave(b,s,sc,t,c),   slice:(b,s,sc,t,c)=>fxSlice(b,s,sc,t,c),
  vroll:(b,s,sc,t,c)=>fxVroll(b,s,sc,t,c), mosh:(b,s,sc,t,c)=>fxMosh(b,s,sc,t,c),
  ghost:(b,s,sc,t,c)=>{if(sc.epoch===1)fxGhost_classic(b,s,sc,t,c);}, melt:(b,s,sc,t,c)=>fxMelt(b,sc,t,c),   // signal era: IXTEAR (index stage)
  bleed:(b,s,sc,t,c)=>fxBleed(b,sc,t,c),   invert:(b,s,sc,t,c)=>{if(sc.epoch===1)fxInvert_classic(b,sc,t,c);},   // signal era: XSLAM
  crush:(b,s,sc,t,c)=>{if(sc.epoch===1)fxCrush_classic(b,sc,t,c);},   dropout:(b,s,sc,t,c)=>fxDropout(b,sc,t,c) // signal era: DQUAKE
};
function heavyCorruption(buf,snap,scene,theta,corr,fx){
  const g=scene.vibe.g, cc=ch=>Math.min(150,corr*g[ch]);
  for(const name of scene.rev4.order.heavy){
    if(fx[name]) HEAVY_FX[name](buf,snap,scene,theta,cc(name));
  }
}

/* ============================================================================
   OBLIVION CHANNELS — invented for this engine. These don't imitate analog or
   codec failure; they attack parts of the pipeline glitch art normally leaves
   alone: the loop's own time axis, the dither matrix's geometry, the image's
   relationship with itself. All envelopes are integer-k periodic => seamless.
   ========================================================================== */

/* 1. CHRONOSHEAR — regions of the frame live at different moments of the same
   loop. A static field assigns each zone a time-offset; pixels are re-colored
   through the palette as if sampled earlier/later in the cycle. */
function fxChrono(buf,scene,theta,corr,grad){
  const C=corr/100, p=scene.extra2.chrono;
  const env=Math.sin(theta*p.k+p.ph);
  const amp=(40+180*C)*env;
  if(amp<1&&amp>-1)return;
  const F=p.field, CF=p.CF;
  for(let y=0;y<H;y++){const fyo=((y*CF/H)|0)*CF;
    for(let x=0;x<W;x++){
      const o=(y*W+x)*3;
      const L=buf[o]*0.299+buf[o+1]*0.587+buf[o+2]*0.114;
      let gi=(L+F[fyo+((x*CF/W)|0)]*amp)|0; gi=((gi%256)+256)%256;
      buf[o]  =(buf[o]  +2*grad[gi*3])/3;
      buf[o+1]=(buf[o+1]+2*grad[gi*3+1])/3;
      buf[o+2]=(buf[o+2]+2*grad[gi*3+2])/3;
    }
  }
}

/* 2. MIRRORTIME — the loop interferes with its own time-reversal. The frame at
   theta is blended against the frame at -theta through a drifting interference
   lattice: past and future occupying one raster. */
function combineMirror(a,c,scene,theta){
  const m=scene.extra2.mirror;
  if(!m.sinX){ m.sinX=new Float32Array(W); m.cosX=new Float32Array(W);
    for(let x=0;x<W;x++){m.sinX[x]=Math.sin(x*m.fx);m.cosX[x]=Math.cos(x*m.fx);} }
  for(let y=0;y<H;y++){
    const B=y*m.fy+theta*m.k+m.ph, sB=Math.sin(B), cB=Math.cos(B);
    const row=y*W*3;
    for(let x=0;x<W;x++){
      const t=0.5+0.5*(m.sinX[x]*cB+m.cosX[x]*sB);
      const o=row+x*3;
      a[o]  +=(c[o]  -a[o]  )*t;
      a[o+1]+=(c[o+1]-a[o+1])*t;
      a[o+2]+=(c[o+2]-a[o+2])*t;
    }
  }
}

/* 3. MOTION FLAY — the render is replaced by its own time-derivative: the
   difference between now and 1/8th of a loop from now, amplified. Stillness
   goes black; only change survives as electric edges. */
function combineFlay(a,c,scene,theta,corr){
  const C=corr/100, p=scene.extra2.flay;
  const env=0.5+0.5*Math.sin(theta*p.k+p.ph);
  const mix=env*(0.35+0.55*C), gain=2.2+C*3.5;
  for(let i=0;i<a.length;i++){
    let d=a[i]-c[i]; if(d<0)d=-d; d*=gain; if(d>255)d=255;
    a[i]+=(d-a[i])*mix;
  }
}

/* 4. AUTOPHAGY — the image eats itself: every pixel is displaced along the
   gradient of its own luminance, so bright structures cannibalize their
   surroundings and edges curl inward. */
function fxAutophagy(buf,snap,scene,theta,corr){
  const C=corr/100, p=scene.extra2.autoph;
  const env=Math.sin(theta*p.k+p.ph); const d=env*(6+26*C);
  if(d<0.5&&d>-0.5)return;
  snap.set(buf);
  for(let y=0;y<H;y++){
    const yu=y>1?y-2:y, yd=y+2<H?y+2:y;
    for(let x=0;x<W;x++){
      const xl=x>1?x-2:x, xr=x+2<W?x+2:x;
      const oL=(y*W+xl)*3,oR=(y*W+xr)*3,oU=(yu*W+x)*3,oD=(yd*W+x)*3;
      const gx=(snap[oR]*0.299+snap[oR+1]*0.587+snap[oR+2]*0.114)-(snap[oL]*0.299+snap[oL+1]*0.587+snap[oL+2]*0.114);
      const gy=(snap[oD]*0.299+snap[oD+1]*0.587+snap[oD+2]*0.114)-(snap[oU]*0.299+snap[oU+1]*0.587+snap[oU+2]*0.114);
      let sx=x+((gx/255)*d|0), sy=y+((gy/255)*d|0);
      if(sx<0)sx=0; else if(sx>=W)sx=W-1;
      if(sy<0)sy=0; else if(sy>=H)sy=H-1;
      const so=(sy*W+sx)*3, o=(y*W+x)*3;
      buf[o]=snap[so]; buf[o+1]=snap[so+1]; buf[o+2]=snap[so+2];
    }
  }
}

/* 5. RASTER WEAVE — scanlines are riffle-shuffled like a deck of cards; the
   shuffle depth breathes with the loop, so the raster braids through itself
   and unbraids back to identity. */
let WEAVE_MAPS=null;
function weaveMaps(){
  if(WEAVE_MAPS)return WEAVE_MAPS;
  const maps=[new Int32Array(H)];
  for(let y=0;y<H;y++)maps[0][y]=y;
  for(let p=1;p<=5;p++){const prev=maps[p-1], m=new Int32Array(H), half=H>>1;
    for(let y=0;y<H;y++){const src=y<half ? y*2 : (y-half)*2+1; m[y]=prev[src];}
    maps.push(m);
  }
  WEAVE_MAPS=maps; return maps;
}
function fxWeave(buf,snap,scene,theta,corr){
  const C=corr/100, p=scene.extra2.weave;
  const maxP=Math.max(1,Math.round(1+C*4));
  let pw=Math.round((0.5+0.5*Math.sin(theta*p.k+p.ph))*maxP);
  if(pw<=0)return; if(pw>5)pw=5;
  const map=weaveMaps()[pw];
  snap.set(buf);
  for(let y=0;y<H;y++){const so=map[y]*W*3, o=y*W*3; buf.set(snap.subarray(so,so+W*3),o);}
}

/* 6. ENTROPY TEAR — self-referential: each scanline measures its own visual
   roughness, and that measurement is the force that tears it sideways. Busy
   rows lurch, flat rows hold still. The image's complexity attacks it. */
function fxEntropy(buf,snap,scene,theta,corr){
  const C=corr/100, p=scene.extra2.entropy;
  const env=Math.sin(theta*p.k+p.ph);
  if(env<0.15&&env>-0.15)return;
  snap.set(buf);
  const gain=env*(0.05+C*0.5);
  for(let y=0;y<H;y++){
    const row=y*W*3; let s=0;
    for(let x=8;x<W;x+=8){const o=row+x*3, po=o-24;
      s+=Math.abs(snap[o]-snap[po])+Math.abs(snap[o+1]-snap[po+1])+Math.abs(snap[o+2]-snap[po+2]);}
    let sh=Math.round((s/(W/8))*gain);
    if(sh>200)sh=200; else if(sh<-200)sh=-200;
    if(!sh)continue;
    for(let x=0;x<W;x++){let sx=(x-sh)%W; if(sx<0)sx+=W;
      const so=row+sx*3, o=row+x*3;
      buf[o]=snap[so]; buf[o+1]=snap[so+1]; buf[o+2]=snap[so+2];}
  }
}

/* 7. GLYPH PLAGUE — an infection in the raster: as the epidemic envelope
   swells, cells succumb in order of susceptibility and are replaced by
   inverted 1-bit glyph tissue; it spreads, peaks, and recedes every loop. */
function fxMeta(buf,scene,theta,corr){
  const C=corr/100, p=scene.extra2.meta;
  const th=(0.5+0.5*Math.sin(theta*p.k+p.ph))*C;
  if(th<=0.02)return;
  const MC=p.MC, cell=(W/MC)|0;
  for(let cy=0;cy<MC;cy++)for(let cx=0;cx<MC;cx++){
    const ci=cy*MC+cx;
    if(p.field[ci]>=th)continue;
    const G=scene.glyphset[p.gid[ci]%scene.glyphset.length];
    const x0=cx*cell, y0=cy*cell;
    for(let yy=0;yy<cell;yy++){const iy=(yy*7/cell)|0, ay=y0+yy;
      for(let xx=0;xx<cell;xx++){const ix=(xx*5/cell)|0;
        const o=(ay*W+x0+xx)*3;
        if(G[iy*5+ix]){buf[o]=255-buf[o];buf[o+1]=255-buf[o+1];buf[o+2]=255-buf[o+2];}
        else{buf[o]=(buf[o]*3)>>2;buf[o+1]=(buf[o+1]*3)>>2;buf[o+2]=(buf[o+2]*3)>>2;}
      }
    }
  }
}

/* 8. DITHER TECTONICS — corruption of the quantizer itself. The Bayer matrix
   is broken into plates that drift like crust; where plates disagree, fault
   lines glow. The image is untouched — its rendering substrate is what slips. */
function buildTect(scene,theta,corr){
  const C=corr/100, p=scene.extra2.tect, PL=p.PL, TL=p.TL;
  const amp=1+3*C;
  for(let i=0;i<PL*PL;i++){
    p.pox[i]=Math.round(amp*Math.sin(theta*p.k[i]+p.ph[i]));
    p.poy[i]=Math.round(amp*Math.cos(theta*p.k[i]+p.ph[i]*1.37));
  }
  for(let ty=0;ty<TL;ty++){const py=(ty>>2)*PL;
    for(let tx=0;tx<TL;tx++){const pi=py+(tx>>2), t=ty*TL+tx;
      p.ox[t]=p.pox[pi]; p.oy[t]=p.poy[pi];}}
  for(let ty=0;ty<TL;ty++)for(let tx=0;tx<TL;tx++){
    const t=ty*TL+tx;
    const r=tx+1<TL?t+1:t, d=ty+1<TL?t+TL:t;
    p.fb[t]=(p.ox[t]!==p.ox[r]||p.oy[t]!==p.oy[r]||p.ox[t]!==p.ox[d]||p.oy[t]!==p.oy[d])?1:0;
  }
  return p;
}

const OBL_FX={
  weave:(b,s,sc,t,c)=>fxWeave(b,s,sc,t,c), entropy:(b,s,sc,t,c)=>fxEntropy(b,s,sc,t,c),
  autoph:(b,s,sc,t,c)=>fxAutophagy(b,s,sc,t,c), meta:(b,s,sc,t,c)=>fxMeta(b,sc,t,c)
};
function oblivionPixel(buf,snap,scene,theta,corr,fx){
  const g=scene.vibe.g, cc=ch=>Math.min(150,corr*g[ch]);
  for(const name of scene.rev4.order.obl){
    if(fx[name]) OBL_FX[name](buf,snap,scene,theta,cc(name));
  }
}

/* ============================================================================
   VALHALLA CHANNELS — structural corruptions. No waves, no rows: shattered
   rigid panes, space-filling-curve crawls, content-keyed column genetics,
   self-interference moiré, three-phase time braids, anatomical breathing.
   All motion is shp(sin(integer·theta)) => strictly periodic => seamless.
   ========================================================================== */

/* 1. PANE RAPTURE — the frame is tessellated into seeded voronoi shards; each
   pane drifts rigidly with its own tempo and lifts in brightness, seams stay
   dark. The image survives intact but no longer agrees on where it is. */
function fxPanes(buf,snap,scene,theta,corr){
  const C=corr/100, p=scene.valhalla.panes, PW=p.PW;
  snap.set(buf);
  const NC=p.NC;
  const dx=fxPanes._dx||(fxPanes._dx=new Int16Array(64));
  const dy=fxPanes._dy||(fxPanes._dy=new Int16Array(64));
  const lf=fxPanes._lf||(fxPanes._lf=new Float32Array(64));
  for(let i=0;i<NC;i++){
    const e=shp(Math.sin(theta*p.pk[i]+p.pph[i]),p.shape);
    dx[i]=Math.round(e*p.pax[i]*(0.25+C));
    dy[i]=Math.round(e*p.pay[i]*(0.25+C));
    lf[i]=1+Math.max(0,e)*p.plift[i]*C*0.02;
  }
  const xc=fxPanes._xc||(fxPanes._xc=new Uint16Array(W));
  if(!fxPanes._xcInit){for(let x=0;x<W;x++)xc[x]=(x*PW/W)|0; fxPanes._xcInit=true;}
  for(let y=0;y<H;y++){
    const crow=((y*PW/H)|0)*PW, row=y*W;
    for(let x=0;x<W;x++){
      const ci=crow+xc[x], id=p.cellId[ci], o=(row+x)*3;
      let sx=(x-dx[id])%W; if(sx<0)sx+=W;              // toroidal: shards wrap,
      let sy=(y-dy[id])%H; if(sy<0)sy+=H;              // no gap ever exposed
      const so=(sy*W+sx)*3, L=lf[id];
      const r=snap[so]*L, g=snap[so+1]*L, b=snap[so+2]*L;
      buf[o]=r>255?255:r; buf[o+1]=g>255?255:g; buf[o+2]=b>255?255:b;
    }
  }
}

/* 2. HILBERT CRAWL — the raster is threaded onto a generalized space-filling
   curve; tiles caterpillar along it. Displacement follows fractal adjacency,
   not rows or columns: smears fold at right angles like migrating circuitry. */
function gilbertOrder(w,h){
  const order=[];
  const sgn=v=>v<0?-1:(v>0?1:0);
  function gen(x,y,ax,ay,bx,by){
    const ww=Math.abs(ax+ay), hh=Math.abs(bx+by);
    const dax=sgn(ax),day=sgn(ay),dbx=sgn(bx),dby=sgn(by);
    if(hh===1){ for(let i=0;i<ww;i++){order.push(y*w+x); x+=dax;y+=day;} return; }
    if(ww===1){ for(let i=0;i<hh;i++){order.push(y*w+x); x+=dbx;y+=dby;} return; }
    let ax2=(ax/2)|0, ay2=(ay/2)|0, bx2=(bx/2)|0, by2=(by/2)|0;
    const w2=Math.abs(ax2+ay2), h2=Math.abs(bx2+by2);
    if(2*ww>3*hh){
      if((w2%2)&&(ww>2)){ax2+=dax;ay2+=day;}
      gen(x,y,ax2,ay2,bx,by);
      gen(x+ax2,y+ay2,ax-ax2,ay-ay2,bx,by);
    }else{
      if((h2%2)&&(hh>2)){bx2+=dbx;by2+=dby;}
      gen(x,y,bx2,by2,ax2,ay2);
      gen(x+bx2,y+by2,ax,ay,bx-bx2,by-by2);
      gen(x+(ax-dax)+(bx2-dbx), y+(ay-day)+(by2-dby), -bx2,-by2, -(ax-ax2),-(ay-ay2));
    }
  }
  if(w>=h) gen(0,0,w,0,0,h); else gen(0,0,0,h,w,0);
  return Int32Array.from(order);
}
let HILB=null;
function fxHilbert(buf,snap,scene,theta,corr){
  const C=corr/100, p=scene.valhalla.hilb, T=135, TS=8;
  if(!HILB)HILB=gilbertOrder(T,T);
  const L=HILB.length;
  const s=Math.round(shp(Math.sin(theta*p.k+p.ph),p.shape)*p.dir*C*L*0.10);
  if(!s)return;
  snap.set(buf);
  for(let i=0;i<L;i++){
    let j=(i+s)%L; if(j<0)j+=L;
    const dc=HILB[i], sc=HILB[j];
    const dx=(dc%T)*TS, dyy=((dc/T)|0)*TS, sx=(sc%T)*TS, syy=((sc/T)|0)*TS;
    for(let r=0;r<TS;r++){
      const so=((syy+r)*W+sx)*3, doo=((dyy+r)*W+dx)*3;
      buf.set(snap.subarray(so,so+TS*3),doo);
    }
  }
}

/* 3. DNA SPLICE — columns are re-ordered by a key that morphs between spatial
   position and each column's own visual roughness: the image periodically
   re-sequences itself by its own genetics, then re-assembles. */
function fxSplice(buf,snap,scene,theta,corr){
  const C=corr/100, p=scene.valhalla.splice;
  const mix=Math.max(0,shp(Math.sin(theta*p.k+p.ph),p.shape))*C;
  if(mix<0.03)return;
  snap.set(buf);
  const rough=fxSplice._r||(fxSplice._r=new Float32Array(W));
  const idx=fxSplice._i||(fxSplice._i=new Array(W));
  for(let x=0;x<W;x++){
    let s=0;
    for(let y=8;y<H;y+=16){const o=(y*W+x)*3, po=o-8*W*3;
      s+=Math.abs(snap[o]-snap[po])+Math.abs(snap[o+1]-snap[po+1]);}
    rough[x]=s; idx[x]=x;
  }
  let mn=1e9,mx=-1e9;
  for(let x=0;x<W;x++){if(rough[x]<mn)mn=rough[x];if(rough[x]>mx)mx=rough[x];}
  const span=(mx-mn)||1;
  const key=fxSplice._k||(fxSplice._k=new Float32Array(W));
  for(let x=0;x<W;x++)key[x]=x*(1-mix)+((rough[x]-mn)/span)*W*mix;
  idx.sort((a,b)=>key[a]-key[b]);
  for(let x=0;x<W;x++){
    const sxx=idx[x]; if(sxx===x)continue;
    for(let y=0;y<H;y++){const so=(y*W+sxx)*3,o=(y*W+x)*3;
      buf[o]=snap[so];buf[o+1]=snap[so+1];buf[o+2]=snap[so+2];}
  }
}

/* 4. SELF-MOIRÉ — the frame interferes with a rotated, rescaled copy of its
   own thresholded self; where the two disagree, pixels invert. Op-art fringes
   grow out of the artwork's own anatomy — no overlay, pure self-reference. */
function fxMoire(buf,snap,scene,theta,corr){
  const C=corr/100, p=scene.valhalla.moire;
  const a=shp(Math.sin(theta*p.k+p.ph),p.shape)*(0.04+0.11*C);
  const sc=1+0.05*Math.sin(theta*p.k2+p.ph2);
  snap.set(buf);
  const ca=Math.cos(a)/sc, sa=Math.sin(a)/sc, cx=(W-1)/2, cy=(H-1)/2, T=p.thr;
  for(let y=0;y<H;y++){
    const ry=y-cy;
    for(let x=0;x<W;x++){
      const rx=x-cx;
      const sx=(cx+rx*ca-ry*sa)|0, sy=(cy+rx*sa+ry*ca)|0;
      if(sx<0||sy<0||sx>=W||sy>=H)continue;
      const o=(y*W+x)*3, so=(sy*W+sx)*3;
      const L =snap[o]*0.299+snap[o+1]*0.587+snap[o+2]*0.114;
      const L2=snap[so]*0.299+snap[so+1]*0.587+snap[so+2]*0.114;
      if((L>T)!==(L2>T)){ buf[o]=255-buf[o]; buf[o+1]=255-buf[o+1]; buf[o+2]=255-buf[o+2]; }
    }
  }
}

/* 5. TIME BRAID — three phases of the loop (θ, θ+⅓, θ−⅓) coexist in one frame,
   partitioned by the image's own dominant color channel: the artwork's anatomy
   decides which parts live in which moment. (applied at source stage) */
function combineBraid(a,c1,c2,scene,theta,corr){
  const C=corr/100, p=scene.valhalla.braid;
  const mixv=(0.5+0.5*Math.sin(theta*p.k+p.ph))*(0.4+0.6*C);
  for(let i=0;i<a.length;i+=3){
    const r=a[i],g=a[i+1],b=a[i+2];
    if(g>=r&&g>=b){ a[i]+=(c1[i]-r)*mixv; a[i+1]+=(c1[i+1]-g)*mixv; a[i+2]+=(c1[i+2]-b)*mixv; }
    else if(b>=r){  a[i]+=(c2[i]-r)*mixv; a[i+1]+=(c2[i+1]-g)*mixv; a[i+2]+=(c2[i+2]-b)*mixv; }
  }
}

/* 6. RASTER LUNGS — every column breathes vertically around a seeded horizon,
   each with its own phase offset: the frame inhales and exhales anatomically
   instead of waving. */
function fxLungs(buf,snap,scene,theta,corr){
  const C=corr/100, p=scene.valhalla.lungs;
  snap.set(buf);
  const h0=p.h0;
  for(let x=0;x<W;x++){
    const sc=1+shp(Math.sin(theta*p.k+p.ph+p.phase[x]),p.shape)*p.amp*(0.4+C);
    const inv=1/sc;
    for(let y=0;y<H;y++){
      let sy=Math.round((y-h0)*inv+h0);
      if(sy<0)sy=0; else if(sy>=H)sy=H-1;
      const so=(sy*W+x)*3, o=(y*W+x)*3;
      buf[o]=snap[so]; buf[o+1]=snap[so+1]; buf[o+2]=snap[so+2];
    }
  }
}

const VAL_FX={
  panes:fxPanes, hilb:fxHilbert, splice:fxSplice, lungs:fxLungs, moire:fxMoire
};
function valhallaPixel(buf,snap,scene,theta,corr,fx){
  const g=scene.vibe.g, cc=ch=>Math.min(150,corr*g[ch]);
  for(const name of scene.rev4.order.val){
    if(fx[name]) VAL_FX[name](buf,snap,scene,theta,cc(name));
  }
}

/* source stage: base render + time-axis attacks (mirror/flay/braid) + chronoshear */
/* ============================================================================
   DEMIURGE CHANNELS — reality fabrication. Recursive light, mirrored space,
   true glow, living swarms, an alphabet that doesn't exist.
   ========================================================================== */

/* 1. FEEDBACK TUNNEL — the loop stares into itself: theta-delayed frames are
   re-projected through cumulative zoom+rotation and lighten-stacked, producing
   recursive corridors of phosphor. Finite-tap formulation + tail-primed ring
   keeps it exactly periodic. */
function compositeTunnel(buf, ring, T, corr){
  const C=Math.min(1.5,corr/100), taps=ring.length;
  const ca=compositeTunnel._ca||(compositeTunnel._ca=new Float32Array(8));
  const sa=compositeTunnel._sa||(compositeTunnel._sa=new Float32Array(8));
  const is=compositeTunnel._is||(compositeTunnel._is=new Float32Array(8));
  const wt=compositeTunnel._wt||(compositeTunnel._wt=new Float32Array(8));
  for(let k=1;k<=taps;k++){
    const ang=T.rot*k, s=Math.pow(T.zoom,k);
    ca[k-1]=Math.cos(ang)/s; sa[k-1]=Math.sin(ang)/s;
    wt[k-1]=Math.pow(T.decay,k)*(0.5+0.7*C);
  }
  const CX=W/2, CY=H/2;
  for(let y=0;y<H;y++){const dy=y-CY;
    for(let x=0;x<W;x++){const dx=x-CX; const o=(y*W+x)*3;
      let R=buf[o],G=buf[o+1],B=buf[o+2];
      for(let k=0;k<taps;k++){
        const sxf=CX+dx*ca[k]-dy*sa[k], syf=CY+dx*sa[k]+dy*ca[k];
        if(sxf<0||syf<0||sxf>=W||syf>=H)continue;
        const ci=(((syf*FW/H)|0)*FW+((sxf*FW/W)|0))*3, r=ring[taps-1-k], w=wt[k];
        const er=r[ci]*w;   if(er>R)R=er;
        const eg=r[ci+1]*w; if(eg>G)G=eg;
        const eb=r[ci+2]*w; if(eb>B)B=eb;
      }
      buf[o]=R;buf[o+1]=G;buf[o+2]=B;
    }
  }
}

/* 2. KALEIDOMANCY — space itself is folded N ways around a seeded axis and
   set spinning; the corruption stack then attacks the mirrored world. */
let KAL_R=null, KAL_B=null, KAL_COS=null, KAL_SIN=null, KAL_C=-1;
function kaleidoLUT(cx,cy){
  const sig=cx*100000+cy;
  if(KAL_R&&KAL_C===sig)return;
  KAL_C=sig;
  if(!KAL_R){KAL_R=new Float32Array(W*H); KAL_B=new Uint16Array(W*H);
    KAL_COS=new Float32Array(2048); KAL_SIN=new Float32Array(2048);
    for(let b=0;b<2048;b++){const a=b/2048*TAU; KAL_COS[b]=Math.cos(a); KAL_SIN[b]=Math.sin(a);}}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const dx=x-cx, dy=y-cy, i=y*W+x;
    KAL_R[i]=Math.sqrt(dx*dx+dy*dy);
    let a=Math.atan2(dy,dx); if(a<0)a+=TAU;
    KAL_B[i]=(a/TAU*2048)|0;
  }
}
function fxKaleido(buf,snap,scene,theta,corr){
  const K=scene.demi.kaleido;
  kaleidoLUT(K.cx,K.cy);
  snap.set(buf);
  const rot=theta*K.k+K.ph, sector=TAU/K.folds;
  const fold=fxKaleido._f||(fxKaleido._f=new Uint16Array(2048));
  for(let b=0;b<2048;b++){
    let a=(b/2048*TAU+rot)%sector; if(a<0)a+=sector;
    if(a>sector/2)a=sector-a;                      // mirror fold
    fold[b]=((a/TAU*2048)|0)&2047;
  }
  const cx=K.cx, cy=K.cy;
  for(let i=0;i<W*H;i++){
    const f=fold[KAL_B[i]], r=KAL_R[i];
    let sx=(cx+r*KAL_COS[f])|0, sy=(cy+r*KAL_SIN[f])|0;
    if(sx<0)sx=0; else if(sx>=W)sx=W-1;
    if(sy<0)sy=0; else if(sy>=H)sy=H-1;
    const so=(sy*W+sx)*3, o=i*3;
    buf[o]=snap[so]; buf[o+1]=snap[so+1]; buf[o+2]=snap[so+2];
  }
}

/* 3. PHOSPHOR BLOOM — bright signal physically bleeds light: coarse threshold,
   separable blur, additive recomposite. Neon finally glows. */
function fxBloom(buf,scene,theta,corr){
  const B=scene.demi.bloom, C=Math.min(1.5,corr/100);
  const N2=FW*FW;
  const bR=fxBloom._r||(fxBloom._r=new Float32Array(N2));
  const bG=fxBloom._g||(fxBloom._g=new Float32Array(N2));
  const bB=fxBloom._b||(fxBloom._b=new Float32Array(N2));
  const tR=fxBloom._tr||(fxBloom._tr=new Float32Array(N2));
  const tG=fxBloom._tg||(fxBloom._tg=new Float32Array(N2));
  const tB=fxBloom._tb||(fxBloom._tb=new Float32Array(N2));
  const thr=B.thr, inv=1/(255-thr);
  for(let y=0;y<FW;y++){const sy=((y*H/FW)|0)*W;
    for(let x=0;x<FW;x++){const so=(sy+((x*W/FW)|0))*3, i=y*FW+x;
      const L=buf[so]*0.299+buf[so+1]*0.587+buf[so+2]*0.114;
      const e=L>thr?(L-thr)*inv:0;
      bR[i]=buf[so]*e; bG[i]=buf[so+1]*e; bB[i]=buf[so+2]*e;
    }}
  const rad=B.rad, div=1/(rad*2+1);
  for(let y=0;y<FW;y++){const row=y*FW;              // horizontal box
    let sR=0,sG=0,sB=0;
    for(let x=-rad;x<=rad;x++){const xx=x<0?0:x; sR+=bR[row+xx];sG+=bG[row+xx];sB+=bB[row+xx];}
    for(let x=0;x<FW;x++){
      tR[row+x]=sR*div; tG[row+x]=sG*div; tB[row+x]=sB*div;
      const xo=x-rad<0?0:x-rad, xn=x+rad+1>=FW?FW-1:x+rad+1;
      sR+=bR[row+xn]-bR[row+xo]; sG+=bG[row+xn]-bG[row+xo]; sB+=bB[row+xn]-bB[row+xo];
    }}
  for(let x=0;x<FW;x++){                             // vertical box
    let sR=0,sG=0,sB=0;
    for(let y=-rad;y<=rad;y++){const yy=y<0?0:y; sR+=tR[yy*FW+x];sG+=tG[yy*FW+x];sB+=tB[yy*FW+x];}
    for(let y=0;y<FW;y++){
      bR[y*FW+x]=sR*div; bG[y*FW+x]=sG*div; bB[y*FW+x]=sB*div;
      const yo=y-rad<0?0:y-rad, yn=y+rad+1>=FW?FW-1:y+rad+1;
      sR+=tR[yn*FW+x]-tR[yo*FW+x]; sG+=tG[yn*FW+x]-tG[yo*FW+x]; sB+=tB[yn*FW+x]-tB[yo*FW+x];
    }}
  const gain=B.gain*(0.5+C);
  for(let y=0;y<H;y++){const cyo=((y*FW/H)|0)*FW;
    for(let x=0;x<W;x++){const ci=cyo+((x*FW/W)|0), o=(y*W+x)*3;
      let r=buf[o]+bR[ci]*gain, g=buf[o+1]+bG[ci]*gain, b=buf[o+2]+bB[ci]*gain;
      buf[o]=r>255?255:r; buf[o+1]=g>255?255:g; buf[o+2]=b>255?255:b;
    }}
}

/* 4. EMBER SWARM — hundreds of luminous particles on integer epicyclic orbits
   (exactly loop-periodic), each trailing a short comet streak. */
function fxEmbers(buf,scene,theta,corr,grad){
  const P=scene.demi.embers, C=Math.min(1.5,corr/100);
  const nDraw=Math.min(P.length, (P.length*(0.4+0.6*C))|0);
  for(let i=0;i<nDraw;i++){const p=P[i];
    for(let t=0;t<3;t++){                              // head + 2 trail samples
      const th=theta-t*0.09;
      const px=(p.cx+p.r1*Math.cos(th*p.k1+p.p1)+p.r2*Math.cos(th*p.k2+p.p2))|0;
      const py=(p.cy+p.r3*Math.sin(th*p.k3+p.p3)+p.r4*Math.sin(th*p.k4+p.p4))|0;
      if(px<1||py<1||px>=W-1||py>=H-1)continue;
      const gi=(p.col*255)|0, fade=t===0?1:(t===1?0.55:0.28);
      const cr=grad[gi*3]*1.25*fade, cg=grad[gi*3+1]*1.25*fade, cb=grad[gi*3+2]*1.25*fade;
      const sz=t===0?p.sz:1;
      for(let yy=0;yy<sz;yy++)for(let xx=0;xx<sz;xx++){
        const o=((py+yy)*W+px+xx)*3;
        let r=buf[o]+cr, g=buf[o+1]+cg, b=buf[o+2]+cb;
        buf[o]=r>255?255:r; buf[o+1]=g>255?255:g; buf[o+2]=b>255?255:b;
      }
    }
  }
}

/* 5. RUNE MARQUEE — scrolling bands of a seeded alphabet that has never
   existed. Integer wraps per loop => the marquee is perfectly seamless. */
function fxRunes(buf,scene,theta,corr){
  const rows=scene.demi.runes, C=Math.min(1.5,corr/100);
  for(let ri=0;ri<rows.length;ri++){const R=rows[ri];
    const env=Math.sin(theta*R.k+R.ph); if(env<0.15-C*0.3)continue;
    const s=R.s, rh=(s*1.4)|0, total=R.glyphs.length*s;
    const off=Math.round(R.speed*total*theta/TAU);
    const y1=Math.min(H,R.y+rh);
    for(let y=R.y;y<y1;y++){
      const iy=(((y-R.y)*7)/rh)|0, row=y*W;
      for(let x=0;x<W;x++){
        let gx=(x+off)%total; if(gx<0)gx+=total;
        const gi2=(gx/s)|0, ix=(((gx-gi2*s)*5)/s)|0;
        if(R.glyphs[gi2][iy*5+ix]){
          const o=(row+x)*3;
          buf[o]=255-buf[o]; buf[o+1]=255-buf[o+1]; buf[o+2]=255-buf[o+2];
        }
      }
    }
  }
}

/* ============================================================================
   CHIMERA — executes this seed's compiled effect. Region selectors:
   0 whole frame · 1 y-bands · 2 x-bands · 3 radial rings · 4 luminance-gated
   (content decides) · 5 seeded noise patches. Transforms: 0 wrap-shift ·
   1 invert · 2 channel-rotate · 3 posterize · 4 mirror-x · 5 palette remap ·
   6 directional smear · 7 pinch. All envelopes shp(sin(int·theta)) => seamless.
   ========================================================================== */
function fxChimera(buf,snap,scene,theta,corr,grad){
  const C=Math.min(1.5,corr/100), ops=scene.chimeraOps;
  for(let oi=0;oi<ops.length;oi++){
    const op=ops[oi];
    const env=shp(Math.sin(theta*op.k+op.ph),op.shape);
    const ae=env<0?-env:env; if(ae<op.gate)continue;
    const tr=op.tr;
    // region membership test
    const bh=(40+op.p3*200)|0, cxp=op.p1*W, cyp=op.p2*H, rw=(50+op.p3*160)|0, lthr=60+op.p1*140;
    const inR=(x,y,o)=>{
      switch(op.sel){
        case 0: return true;
        case 1: return (((y/bh)|0)&1)===0;
        case 2: return (((x/bh)|0)&1)===0;
        case 3: { const dx=x-cxp, dy=y-cyp;
          return ((((Math.sqrt(dx*dx+dy*dy)/rw)|0)&1)===0); }
        case 4: return (snap[o]*0.299+snap[o+1]*0.587+snap[o+2]*0.114)>lthr;
        default: return op.mask ? op.mask[((y*136/H)|0)*136+((x*136/W)|0)]===1 : true;
      }
    };
    if(tr===6){                                            // smear: row-sequential
      snap.set(buf);
      const decay=0.80+0.14*(1-ae*C);
      for(let y=0;y<H;y++){const row=y*W*3;
        let cr=0,cg=0,cb=0;
        for(let x=0;x<W;x++){const o=row+x*3;
          cr*=decay;cg*=decay;cb*=decay;
          if(!inR(x,y,o)){cr=snap[o];cg=snap[o+1];cb=snap[o+2];continue;}
          if(snap[o]>cr)cr=snap[o]; else buf[o]=cr;
          if(snap[o+1]>cg)cg=snap[o+1]; else buf[o+1]=cg;
          if(snap[o+2]>cb)cb=snap[o+2]; else buf[o+2]=cb;
        }}
      continue;
    }
    snap.set(buf);
    const dx=Math.round(env*(op.p1-0.5)*2*300*C), dy=Math.round(env*(op.p2-0.5)*2*300*C);
    const levels=Math.max(2,Math.round(9-ae*C*7)), step=255/(levels-1);
    const pinch=1+env*op.p3*0.5*C;
    for(let y=0;y<H;y++){
      for(let x=0;x<W;x++){
        const o=(y*W+x)*3;
        if(!inR(x,y,o))continue;
        switch(tr){
          case 0:{ let sx=(x-dx)%W; if(sx<0)sx+=W; let sy=(y-dy)%H; if(sy<0)sy+=H;
            const so=(sy*W+sx)*3; buf[o]=snap[so];buf[o+1]=snap[so+1];buf[o+2]=snap[so+2]; break; }
          case 1: buf[o]=255-snap[o]; buf[o+1]=255-snap[o+1]; buf[o+2]=255-snap[o+2]; break;
          case 2: buf[o]=snap[o+1]; buf[o+1]=snap[o+2]; buf[o+2]=snap[o]; break;
          case 3:{ let r=Math.round(snap[o]/step)*step, g=Math.round(snap[o+1]/step)*step, b=Math.round(snap[o+2]/step)*step;
            buf[o]=r>255?255:r; buf[o+1]=g>255?255:g; buf[o+2]=b>255?255:b; break; }
          case 4:{ const so=(y*W+(W-1-x))*3; buf[o]=snap[so];buf[o+1]=snap[so+1];buf[o+2]=snap[so+2]; break; }
          case 5:{ const L=snap[o]*0.299+snap[o+1]*0.587+snap[o+2]*0.114;
            let gi=(L*0.5+op.p1*128+env*60)|0; gi=((gi%256)+256)%256;
            buf[o]=(snap[o]+2*grad[gi*3])/3; buf[o+1]=(snap[o+1]+2*grad[gi*3+1])/3; buf[o+2]=(snap[o+2]+2*grad[gi*3+2])/3; break; }
          default:{ let sx=(cxp+(x-cxp)/pinch)|0, sy=(cyp+(y-cyp)/pinch)|0;
            if(sx<0)sx=0; else if(sx>=W)sx=W-1; if(sy<0)sy=0; else if(sy>=H)sy=H-1;
            const so=(sy*W+sx)*3; buf[o]=snap[so];buf[o+1]=snap[so+1];buf[o+2]=snap[so+2]; }
        }
      }
    }
  }
}

function demiurgePixel(buf,snap,scene,theta,corr,fx,grad){
  const g=scene.vibe.g, cc=ch=>Math.min(150,corr*g[ch]);
  if(fx.chimera)fxChimera(buf,snap,scene,theta,cc('chimera'),grad);
  if(fx.embers)fxEmbers(buf,scene,theta,cc('embers'),grad);
  if(fx.runes) fxRunes(buf,scene,theta,cc('runes'));
  if(fx.bloom) fxBloom(buf,scene,theta,cc('bloom'));
}

/* composition mask v2 — 30-shape catalog x 20-style treatment library.
   Shapes 0-20 are direct cartesian tests; 21-28 are polar figures (foils,
   stars, gears) via a per-scene polar LUT + per-frame 1024-bin edge table,
   rotating with the loop. Shape 29 is a vertical lens. */
let MSK_R=null, MSK_B=null, MSK_C=-1;
function maskLUT(cx,cy){
  const sig=cx*131071+cy;
  if(MSK_R&&MSK_C===sig)return;
  MSK_C=sig;
  if(!MSK_R){MSK_R=new Float32Array(W*H);MSK_B=new Uint16Array(W*H);}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const dx=x-cx, dy=y-cy, i=y*W+x;
    MSK_R[i]=Math.sqrt(dx*dx+dy*dy);
    let a=Math.atan2(dy,dx); if(a<0)a+=TAU;
    MSK_B[i]=((a/TAU*1024)|0)&1023;
  }
}
const MASK_POLAR=[[3,0.55],[4,0.5],[5,-0.5],[6,0.45],[8,-0.32],[12,-0.4],[3,0.22],[16,-0.22]]; // shapes 21-28
function fxMaskComp(buf,scene,theta){
  const M=scene.rev4.mask; if(!M.type)return;
  const shape=M.type-1;
  /* ORNAMENT PURGE. 21-28 is the polar rosette family - FOIL3, FOIL4, STAR5,
     FLWR6 (the six-petal flower), GEAR8, STR12, BLOB, SUN16 - and 18 is DOTS9,
     the polka grid. Returning here removes the motif without touching one byte
     of the wire format: MASK_NAMES keeps all thirty entries, MASK_POLAR keeps
     all eight slots, OV.maskType keeps its five bits and its numbering, and the
     seeded mask block keeps its rng() draws. An old card carrying maskType 26
     still decodes to 26 - it just paints nothing.
     This also retires a loop-closure defect: FOIL3, STAR5 and BLOB at k===1
     advance their rotation by a half-integer multiple of TAU and do not close. */
  if(shape===18||(shape>=21&&shape<=28))return;
  const s=M.size*(1+0.12*Math.sin(theta*M.k+M.ph));
  const cx=M.cx*W, cy=M.cy*H, sPix=s*W;
  let edge=null;
  if(shape>=21&&shape<=28){
    maskLUT(cx,cy);
    const [n,a]=MASK_POLAR[shape-21], rot=theta*M.k*0.5+M.ph;
    edge=fxMaskComp._e||(fxMaskComp._e=new Float32Array(1024));
    for(let b2=0;b2<1024;b2++)edge[b2]=sPix*(1+a*Math.cos(n*(b2/1024*TAU+rot)));
  }
  const inside=(x,y,dx,dy,adx,ady,i,scl)=>{
    const S2=sPix*scl, r2=S2*S2;
    switch(shape){
      case 0: return dx*dx+dy*dy<r2;
      case 1: return (adx+ady)<S2*1.2;
      case 2: return ady<S2*0.5;
      case 3: {const d2=dx*dx+dy*dy; return d2<r2&&d2>r2*0.5;}
      case 4: return adx<S2*0.5;
      case 5: return adx<S2*0.85&&ady<S2*0.85;
      case 6: {const mM=Math.max(adx,ady); return mM<S2*0.85&&mM>S2*0.6;}
      case 7: return (ady<S2*0.28&&adx<S2)||(adx<S2*0.28&&ady<S2);
      case 8: return Math.abs(adx-ady)<S2*0.24&&adx<S2&&ady<S2;
      case 9: return dy>-S2*0.8&&dy<S2*0.8&&adx<(S2*0.8-dy)*0.62;
      case 10: return dy>-S2*0.8&&dy<S2*0.8&&adx<(S2*0.8+dy)*0.62;
      case 11: {const p=adx*0.5+ady*0.866; return adx<S2*0.87&&p<S2*0.87&&(adx*0.5+ady*0.866)<S2*0.87&&ady<S2*0.87;}
      case 12: return ((dx-S2*0.4)*(dx-S2*0.4)+dy*dy<r2)&&((dx+S2*0.4)*(dx+S2*0.4)+dy*dy<r2);
      case 13: return (dx*dx+dy*dy<r2)&&!((dx-S2*0.45)*(dx-S2*0.45)+dy*dy<r2*0.92);
      case 14: {const cxr=dx<-S2*0.5?-S2*0.5:(dx>S2*0.5?S2*0.5:dx); return (dx-cxr)*(dx-cxr)+dy*dy<r2*0.2;}
      case 15: return Math.abs(dx-dy)<S2*0.4;
      case 16: return Math.abs(dx+dy)<S2*0.4;
      case 17: return adx>S2*0.45&&ady>S2*0.45&&adx<S2&&ady<S2;
      case 18: {const g=S2*0.7; if(adx>S2||ady>S2)return false;
        const ux=((dx+S2)%g)-g/2, uy=((dy+S2)%g)-g/2; return ux*ux+uy*uy<g*g*0.09;}
      case 19: return adx<S2&&ady<S2&&(((x/(S2*0.34))|0)&1)===0;
      case 20: return adx<S2&&ady<S2&&(((y/(S2*0.34))|0)&1)===0;
      case 29: return ((dy-S2*0.4)*(dy-S2*0.4)+dx*dx<r2)&&((dy+S2*0.4)*(dy+S2*0.4)+dx*dx<r2);
      default: return MSK_R[i]<edge[MSK_B[i]]*scl;      // polar family
    }
  };
  const st=M.style, needBand=(st===9||st===12||st===13);
  let snap2=null;
  if(st===14||st===15){ snap2=fxMaskComp._s||(fxMaskComp._s=new Uint8Array(W*H*3)); snap2.set(buf); }
  for(let y=0;y<H;y++){const dy=y-cy, ady=dy<0?-dy:dy;
    for(let x=0;x<W;x++){const dx=x-cx, adx=dx<0?-dx:dx;
      const i=y*W+x, o=i*3;
      const IN=inside(x,y,dx,dy,adx,ady,i,1);
      const band=needBand?(IN&&!inside(x,y,dx,dy,adx,ady,i,0.8)):false;
      switch(st){
        case 0: if(!IN){buf[o]=(buf[o]*42)>>8;buf[o+1]=(buf[o+1]*42)>>8;buf[o+2]=(buf[o+2]*42)>>8;} break;
        case 1: if(IN){buf[o]=255-buf[o];buf[o+1]=255-buf[o+1];buf[o+2]=255-buf[o+2];} break;
        case 2: if(!IN){buf[o]=(buf[o]*13)>>8;buf[o+1]=(buf[o+1]*13)>>8;buf[o+2]=(buf[o+2]*13)>>8;} break;
        case 3: if(!IN){buf[o]=255-buf[o];buf[o+1]=255-buf[o+1];buf[o+2]=255-buf[o+2];} break;
        case 4: if(IN){buf[o]=(buf[o]*42)>>8;buf[o+1]=(buf[o+1]*42)>>8;buf[o+2]=(buf[o+2]*42)>>8;} break;
        case 5: if(IN){buf[o]=(buf[o]&0xC0)+24;buf[o+1]=(buf[o+1]&0xC0)+24;buf[o+2]=(buf[o+2]&0xC0)+24;} break;
        case 6: if(!IN){buf[o]=(buf[o]&0xC0)+24;buf[o+1]=(buf[o+1]&0xC0)+24;buf[o+2]=(buf[o+2]&0xC0)+24;} break;
        case 7: if(IN){const t=buf[o];buf[o]=buf[o+1];buf[o+1]=buf[o+2];buf[o+2]=t;} break;
        case 8: if(!IN){const t=buf[o];buf[o]=buf[o+1];buf[o+1]=buf[o+2];buf[o+2]=t;} break;
        case 9: if(band){buf[o]=255-buf[o];buf[o+1]=255-buf[o+1];buf[o+2]=255-buf[o+2];} break;
        case 10: if(IN){buf[o]+=(255-buf[o])>>1;buf[o+1]+=(255-buf[o+1])>>1;buf[o+2]+=(255-buf[o+2])>>1;} break;
        case 11: if(!IN){buf[o]+=(255-buf[o])>>1;buf[o+1]+=(255-buf[o+1])>>1;buf[o+2]+=(255-buf[o+2])>>1;} break;
        case 12: if(band){buf[o]=(buf[o]*13)>>8;buf[o+1]=(buf[o+1]*13)>>8;buf[o+2]=(buf[o+2]*13)>>8;} break;
        case 13: if(band){let r=buf[o]*1.9,g=buf[o+1]*1.9,bb=buf[o+2]*1.9;
          buf[o]=r>255?255:r;buf[o+1]=g>255?255:g;buf[o+2]=bb>255?255:bb;} break;
        case 14: if(IN){const so=(((y/24)|0)*24*W+((x/24)|0)*24)*3;
          buf[o]=snap2[so];buf[o+1]=snap2[so+1];buf[o+2]=snap2[so+2];} break;
        case 15: if(!IN){const so=(((y/24)|0)*24*W+((x/24)|0)*24)*3;
          buf[o]=snap2[so];buf[o+1]=snap2[so+1];buf[o+2]=snap2[so+2];} break;
        case 16: if(IN&&((y>>2)&1)){buf[o]=(buf[o]*64)>>8;buf[o+1]=(buf[o+1]*64)>>8;buf[o+2]=(buf[o+2]*64)>>8;} break;
        case 17: if(!IN&&((y>>2)&1)){buf[o]=(buf[o]*64)>>8;buf[o+1]=(buf[o+1]*64)>>8;buf[o+2]=(buf[o+2]*64)>>8;} break;
        case 18: if(IN){buf[o]=255-buf[o];buf[o+1]=255-buf[o+1];buf[o+2]=255-buf[o+2];}
                 else{buf[o]=(buf[o]*100)>>8;buf[o+1]=(buf[o+1]*100)>>8;buf[o+2]=(buf[o+2]*100)>>8;} break;
        default: if(IN){buf[o]=(buf[o]*13)>>8;buf[o+1]=(buf[o+1]*13)>>8;buf[o+2]=(buf[o+2]*13)>>8;}
      }
    }
  }
}

function renderSource(rgbA,rgbC,scene,i,theta,grad,fx,corr){
  renderBase(rgbA,scene,i,theta,grad,corr);
  if(fx.flay){   renderBase(rgbC,scene,i,theta+TAU/8,grad,corr); combineFlay(rgbA,rgbC,scene,theta,corr); }
  if(fx.braid){
    const rgbD=renderSource._d||(renderSource._d=new Uint8Array(W*H*3));
    renderBase(rgbC,scene,i,theta+TAU/3,grad,corr);
    renderBase(rgbD,scene,i,theta-TAU/3,grad,corr);
    combineBraid(rgbA,rgbC,rgbD,scene,theta,Math.min(150,corr*scene.vibe.g.braid));
  }
  if(fx.chrono)  fxChrono(rgbA,scene,theta,Math.min(150,corr*scene.vibe.g.chrono),grad);
  fxMaskComp(rgbA,scene,theta);
  /* KALEIDO IS RETIRED. The radial mandala fold was the most recognisable
     ornament in the engine and the curator asked for it gone. The dispatch is
     what is removed - fxKaleido, its LUT, its four rng() draws in buildScene,
     its CORR_LADDER rung and its DNA bit 32 in CARD_CH all remain exactly
     where they were, because every one of them is positional. Old cards with
     bit 32 set still decode identically; they simply render unfolded. */
  graftApply(rgbA, scene, theta, grad, 0);   /* WITHIN — before the void bites */
  voidCarve(rgbA, scene, grad);
  chromaCap(rgbA, scene, grad);
  dctGhost(rgbA, scene, theta, corr);
  graftApply(rgbA, scene, theta, grad, 1);   /* ABOVE — after everything */
}

/* ============================================================================
   ECHO TRAIL  (phosphor persistence) — lighten-blend theta-delayed copies.
   History is coarse (FW²) so trails read as soft bloom; current frame stays
   sharp. Seamless because the ring is primed with the loop's tail frames.
   ========================================================================== */
function downsampleCoarse(full, coarse){
  for(let y=0;y<FW;y++){ const sy=((y*H/FW)|0)*W;
    for(let x=0;x<FW;x++){ const sx=(x*W/FW)|0; const so=(sy+sx)*3, o=(y*FW+x)*3;
      coarse[o]=full[so]; coarse[o+1]=full[so+1]; coarse[o+2]=full[so+2]; }
  }
}
function lumenPass(buf, scene, theta, grad){
  /* NEW BLOOD: luminous particulate — the curator kept embers/bloom in nearly
     half his winners; lumen amplifies that taste into a dedicated organ.
     Sparks rise off the composition's coastline, breathing with the loop. */
  const rng=mulberry32((scene.seed^0x10E5)>>>0);
  if(rng()>0.45)return;
  const N=40+((rng()*100)|0);
  let coast=null;
  if(scene.mode==='MASS'&&scene._mf){
    coast=[]; const z=scene._mf.z;
    for(let y=2;y<FW-2;y+=2)for(let x=2;x<FW-2;x+=2){
      if(z[y*FW+x]&&(!z[y*FW+x-2]||!z[y*FW+x+2]||!z[(y-2)*FW+x]||!z[(y+2)*FW+x]))coast.push((y<<16)|x);
    }
    if(!coast.length)coast=null;
  }
  const hot=[]; for(let k=0;k<3;k++){const gi=(226+((rng()*28)|0))*3; hot.push([grad[gi],grad[gi+1],grad[gi+2]]);}
  for(let p=0;p<N;p++){
    let ax,ay;
    if(coast){ const c=coast[(rng()*coast.length)|0]; ax=((c&0xffff)/FW)*W; ay=((c>>16)/FW)*H; }
    else { ax=rng()*W; ay=H*0.25+rng()*H*0.7; }
    const ph2=rng()*TAU, amp=8+rng()*46, rise=14+rng()*60, sz=rng()<0.75?1:2;
    const x=(ax+Math.sin(theta+ph2)*amp)|0;
    const y=(ay-((theta/TAU+p*0.13)%1)*rise)|0;
    const pulse=0.35+0.65*(0.5+0.5*Math.sin(theta*2+ph2));
    const c2=hot[p%3];
    for(let dy=-sz;dy<=sz;dy++)for(let dx=-sz;dx<=sz;dx++){
      const px2=x+dx, py2=y+dy;
      if(px2<0||px2>=W||py2<0||py2>=H)continue;
      if(dx*dx+dy*dy>sz*sz)continue;
      const o=(py2*W+px2)*3;
      buf[o]=Math.min(255,buf[o]+c2[0]*pulse);
      buf[o+1]=Math.min(255,buf[o+1]+c2[1]*pulse);
      buf[o+2]=Math.min(255,buf[o+2]+c2[2]*pulse);
    }
  }
}
function seamRip(buf, scene, theta, grad){
  /* NEW BLOOD: one great gesture — a single tear through the image, lips
     displaced apart, hot fringe on the wound. The aperture breathes. */
  const rng=mulberry32((scene.seed^0x5EAA)>>>0);
  if(rng()>0.30)return;
  const segs=3+((rng()*4)|0);
  const xs=[]; let sx=W*(0.30+rng()*0.40);
  for(let i=0;i<=segs;i++){ xs.push(sx); sx+=(rng()-0.5)*W*0.18; }
  const maxD=(10+rng()*30)|0;
  const breathe=0.55+0.45*Math.sin(theta+rng()*TAU);
  const D=(maxD*breathe)|0; if(D<2)return;
  const gi=(236+((rng()*18)|0))*3;
  const fr=grad[gi],fg=grad[gi+1],fb2=grad[gi+2];
  const row=new Uint8Array(W*3);
  for(let y=0;y<H;y++){
    const t=y/H*segs, i0=Math.min(segs-1,t|0), ft=t-i0;
    const cxx=(xs[i0]*(1-ft)+xs[i0+1]*ft)|0;
    const o0=y*W*3;
    row.set(buf.subarray(o0,o0+W*3));
    for(let x=0;x<W;x++){
      const o=o0+x*3;
      if(x<cxx){ const srcX=Math.min(W-1,x+D); const so=(srcX)*3;
        buf[o]=row[so];buf[o+1]=row[so+1];buf[o+2]=row[so+2]; }
      else { const srcX=Math.max(0,x-D); const so=(srcX)*3;
        buf[o]=row[so];buf[o+1]=row[so+1];buf[o+2]=row[so+2]; }
    }
    const fw2=1+((D>16)?1:0);
    for(let f2=-fw2;f2<=fw2;f2++){ const fx2=cxx+f2; if(fx2<0||fx2>=W)continue;
      const o=o0+fx2*3; buf[o]=fr;buf[o+1]=fg;buf[o+2]=fb2; }
  }
}
function fbOf(scene){
  if(scene._fb)return scene._fb;
  const rng=mulberry32((scene.seed^0xF8FB)>>>0);
  const dA=(rng()<0.5?-1:1)*(0.05+rng()*0.17);          // tilt: the spiral's handedness
  const sc=rng()<0.6?(0.90+rng()*0.07):(1.04+rng()*0.07); // zoom out = nesting, in = eruption
  const px=FW*(0.30+rng()*0.40), py=FW*(0.30+rng()*0.40); // off-center pivot: asymmetric arms
  return scene._fb={dA,sc,px,py};
}
function compositeEcho(buf, ring, weights, scene){
  /* video feedback, simulated honestly: each older frame re-enters rotated and
     rescaled about a seeded pivot. Recursion breeds spiral tunnels from trails. */
  const n=ring.length;
  const fb=scene?fbOf(scene):{dA:0,sc:1,px:FW/2,py:FW/2};
  const cosA=[],sinA=[],scl=[];
  for(let e=0;e<n;e++){ const t=(e+1)*fb.dA, z=Math.pow(fb.sc,e+1);
    cosA.push(Math.cos(t)); sinA.push(Math.sin(t)); scl.push(z); }
  for(let y=0;y<H;y++){ const cy=(y*FW/H)|0;
    for(let x=0;x<W;x++){ const cx=(x*FW/W)|0; const o=(y*W+x)*3;
      let R=buf[o],G=buf[o+1],B=buf[o+2];
      const dx=cx-fb.px, dy=cy-fb.py;
      for(let e=0;e<n;e++){ const w=weights[e]; if(w<=0.02)continue;
        const sx=(fb.px + (dx*cosA[e]-dy*sinA[e])*scl[e])|0;
        const sy=(fb.py + (dx*sinA[e]+dy*cosA[e])*scl[e])|0;
        if(sx<0||sx>=FW||sy<0||sy>=FW)continue;
        const co=(sy*FW+sx)*3, r=ring[e];
        const er=r[co]*w;   if(er>R)R=er;
        const eg=r[co+1]*w; if(eg>G)G=eg;
        const eb=r[co+2]*w; if(eb>B)B=eb;
      }
      buf[o]=R; buf[o+1]=G; buf[o+2]=B;
    }
  }
}


/* ============================================================================
   GENERATION ORCHESTRATION
   ========================================================================== */

/*CORE2-BEGIN*/
const q2f=(q,lo,hi)=>lo+(q/31)*(hi-lo);
const f2q=(f,lo,hi)=>Math.max(0,Math.min(31,Math.round((f-lo)/(hi-lo)*31)));
function synthOrbs(seed, seedOrbs, nSel, formSel){
  const n=nSel||seedOrbs.length;
  const r=mulberry32((seed^0x0B0D1E5)>>>0);
  const out=[];
  for(let i=0;i<n;i++){
    const b=i<seedOrbs.length ? {...seedOrbs[i]} : {
      ax:0.14+r()*0.30, ay:0.14+r()*0.30, kx:1+(r()*3|0), ky:1+(r()*3|0),
      phx:r()*TAU, phy:r()*TAU, r:(n>12?0.05:0.09)+r()*(n>12?0.10:0.18), form:(r()*30|0)};
    if(formSel>=1&&formSel<=30)b.form=formSel-1;
    else if(formSel===31)b.form=(mulberry32((seed^(i*2654435761))>>>0)()*30)|0;
    out.push(b);
  }
  return out;
}
function applyOverridesPure(scene, seed, ov){
  if(ov.maskType===1) scene.rev4.mask={...scene.rev4.mask, type:0};
  else if(ov.maskType>=2) scene.rev4.mask={...scene.rev4.mask,
    type:ov.maskType-1, style:ov.maskStyle,                 // shapes 1-30, styles 0-19
    cx:q2f(ov.cx,0.05,0.95), cy:q2f(ov.cy,0.05,0.95), size:q2f(ov.size,0.10,0.55)};
  if(ov.n>0||ov.form>0)
    scene.rev4.orbs=synthOrbs(seed, scene.rev4.orbs, ov.n, ov.form);
}


let GRAFTIMG=null;
let CUR=null, SC=null, sceneKey='', running=false, t0=0, lastStart=0;
let gate=true, tok=0, armed=false;
/* THE TRUTH TAP. The GIF is rasterised at 1080² from a 448² shading field
   and then POINT-SAMPLED down. A native small raster is a DIFFERENT picture,
   not a smaller one — same mathematics, different relationship between field
   and pixel grid, which is why the shapes always agreed and the texture never
   did. Given OUTD this worker rasterises at full production size and hands
   back the exact index buffer the encoder itself would see. OUTD unset = the
   fast tuning rungs, untouched. */
const OW=(typeof OUTD!=='undefined'&&OUTD>0)?OUTD:W;
const FREE=[];
function take(){ return FREE.pop()||new Uint8Array(OW*OW); }
function schedule(ms){ if(armed)return; armed=true; setTimeout(function(){ armed=false; loop(); }, ms|0); }
function release(){ if(gate)return; gate=true; schedule(Math.max(0, 40-(Date.now()-lastStart))); }
const rgbA=new Uint8Array(W*H*3), rgbB=new Uint8Array(W*H*3), rgbC=new Uint8Array(W*H*3);
const idx=new Uint8Array(W*H);
function skey(J){ return JSON.stringify([J.seed,J.mode,J.voidamt,J.locality,J.chromacap,
  J.epoch,J.ov,J.scheme,J.wb&&J.wb.fam,J.wb&&J.wb.prim,J.wb&&J.wb.cam,J.wb&&J.wb.mod]); }
function buildSC(J){
  const scene=buildScene(J.seed,J.mode);
  /* seated BEFORE seatWounds — it builds and caches the mass field */
  if(J.wb){ scene.__wbFam=J.wb.fam; scene.__wbPrim=J.wb.prim; scene.__wbCam=J.wb.cam; scene.__wbMod=J.wb.mod; }
  scene.__graft=(J.gr&&J.gr.on&&GRAFTIMG&&GRAFTIMG.id===J.gr.id)?{img:GRAFTIMG,cfg:J.gr}:null;
  scene.voidamt=J.voidamt|0; scene.locality=J.locality|0; scene.chromacap=J.chromacap|0; seatWounds(scene);
  scene.epoch=J.epoch|0;
  applyOverridesPure(scene,J.seed,J.ov);
  const pack=buildPalette(J.scheme,scene.vibe);
  const gBase=Object.assign({},scene.vibe.g);
  const MV=Object.assign({},scene.rev4.motion,{quant:0,strobes:[]});
  const tEff=function(th){let t=th; if(MV.tw)t=t+MV.tw*Math.sin(t*MV.twk+MV.twph); return t;};
  const gradR=scene.rev4.palMode===2?new Uint8Array(768):null;
  const gradFor=function(th){ if(!gradR)return pack.grad;
    const shift=Math.round(256*scene.rev4.palCycles*th/TAU)%256;
    for(let i=0;i<256;i++){const j=((i+shift)&255)*3,k=i*3;
      gradR[k]=pack.grad[j];gradR[k+1]=pack.grad[j+1];gradR[k+2]=pack.grad[j+2];}
    return gradR; };
  let ring2=null, coarse2=null;
  /* WHICH ROLES CAN ACTUALLY LAND ON THIS SEED? Measured here, on the same seated
     scene that is about to be rendered, because a slider that silently does nothing
     gets blamed on the app rather than on the seed. IDOL has no mirror plane at all;
     roughly half of the other seeds have no floor either. */
  const AV={over:1,under:1,floor:1,gobo:1,stencil:1,slice:1,warp:1,grain:1,palette:1,
    emboss:1,silhouette:1};   /* both read only the graphic - always available */
  if(scene.mode==='IDOL'){ AV.floor=0; }
  else { try{ const sv0=sceneView(scene,0); let c0=0,c1=0,c2=0;
      for(let q=0;q<sv0.kind.length;q++){ const kk=sv0.kind[q];
        if(kk===0)c0++; else if(kk===1)c1++; else c2++; }
      if(c2<40)AV.floor=0; if(c0<40)AV.under=0; if(c1<40)AV.gobo=0;
    }catch(e){} }
  /* THE PROBE MUST LEAVE NO TRACE. sceneView memoises its march on
     mf._svt/mf._sv, and the probe above ran BEFORE loop() sets scene._corr
     and applies the gain multipliers — so it just cached a frame built from
     a corruption of 60 and unscaled gains. On the seeds whose twist term is
     zero, tEff(0) is exactly 0 and frame 0 would serve that stale march
     instead of marching itself: the render and the preview then disagree on
     frame 0 and on nothing else. NaN never equals a theta, so this forces
     the next sceneView to be honest. */
  try{ const _mfp=massField(scene); if(_mfp)_mfp._svt=NaN; }catch(e){}
  self.postMessage({t:'meta', pal:pack.pal, mode:scene.mode, avail:AV});
  return {scene, grad:pack.grad, pal:pack.pal, near:pack.near, gBase, tEff, gradFor,
    get ring2(){return ring2;}, set ring2(v){ring2=v;},
    get coarse2(){return coarse2;}, set coarse2(v){coarse2=v;}};
}
function loop(){
  if(!running||!gate)return;
  const J=CUR, start=Date.now(); lastStart=start;
  try{
    const k=skey(J);
    if(!SC||sceneKey!==k){ SC=buildSC(J); sceneKey=k; t0=Date.now(); }
    const scene=SC.scene;
    /* re-seated every frame: a graft config change must land instantly,
       without rebuilding the scene (that is what the rev counter is for) */
    scene.__graft=(J.gr&&J.gr.on&&GRAFTIMG&&GRAFTIMG.id===J.gr.id)?{img:GRAFTIMG,cfg:J.gr}:null;
    for(const g in SC.gBase){ const m=J.wb&&J.wb.gain?J.wb.gain[g]:null;
      scene.vibe.g[g]=SC.gBase[g]*((m==null?100:m)/100); }
    scene._corr=J.corr;
    const N=J.N, i=(J.__i!=null)?((((J.__i|0)%N)+N)%N)  /* truth pass: named frame */
      :((((Date.now()-t0)/40)|0)%N+N)%N;                 /* live: the GIF's own clock */
    const raw=i/N*TAU, theta=SC.tEff(raw);
    renderSource(rgbA,rgbC,scene,i,theta,SC.gradFor(raw),J.fx,J.corr);
    if(J.fx.tunnel){ const T=scene.demi.tunnel;
      if(!SC.ring2){ SC.ring2=[]; for(let q=0;q<T.taps;q++)SC.ring2.push(new Uint8Array(FW*FW*3));
        SC.coarse2=new Uint8Array(FW*FW*3); }
      downsampleCoarse(rgbA,SC.coarse2);
      compositeTunnel(rgbA,SC.ring2,T,Math.min(150,J.corr*scene.vibe.g.tunnel));
      const rec=SC.ring2.shift(); SC.ring2.push(SC.coarse2); SC.coarse2=rec;
    } else SC.ring2=null;
    rgbB.set(rgbA);
    fringePass(rgbB,scene,theta);
    lumenPass(rgbB,scene,theta,SC.grad);
    quantize(rgbB,idx,SC.near,(14+J.corr*0.20)*scene.vibe.ditherMul,
      J.fx.tect?buildTect(scene,theta,J.corr):null,
      (J.fx.crush&&scene.epoch!==1)?buildQuake(scene,theta,J.corr):null);
    if(scene.mode!=='MASS'&&scene.mode!=='IDOL') indexPass(idx,SC.pal.length,scene,theta,J.corr,J.fx);
    sanctityIdx(idx,scene,i);
    /* BACKPRESSURE. The worker used to free-run: it posted a frame every
       max(40ms, render) regardless of whether the main thread had drawn the
       last one. On a slow device that queues frames the compositor never
       shows and the picture falls further behind reality every second — the
       eye reads it as a stall, not as a slow render. Now it posts ONE frame
       and waits for the ack, which hands the buffer straight back for reuse
       (zero per-frame allocation, zero GC sawtooth). A watchdog opens the
       gate if an ack is ever lost. The playhead stays wall-clock derived, so
       a slow device DROPS frames and keeps the GIF's true 25fps timing. */
    const out=take();
    if(OW!==W){ for(let y=0;y<OW;y++){ const sy=((y*H/OW)|0)*W, row=y*OW;
        for(let x=0;x<OW;x++) out[row+x]=idx[sy+((x*W/OW)|0)]; } }
    else out.set(idx);
    const ms=Date.now()-start;
    gate=false; const my=++tok;
    self.postMessage({t:'pv', i:i, N:N, ms:ms, buf:out},[out.buffer]);
    if(J.__i==null)setTimeout(function(){ if(!gate&&tok===my)release(); },500);
  }catch(err){ running=false; self.postMessage({t:'err', msg:String(err&&err.stack||err).slice(0,300)}); }
}
self.onmessage=function(e){ const m=e.data;
  if(m.t==='graft'){ GRAFTIMG=m.g; return; }
  if(m.t==='job'){ CUR=m.job;
    if(m.buf&&m.buf.byteLength===OW*OW)FREE.push(new Uint8Array(m.buf));
    if(m.step){ running=true; gate=true; schedule(0); }
    else if(!running){ running=true; gate=true; schedule(0); } }
  else if(m.t==='ack'){ if(m.buf&&m.buf.byteLength===OW*OW)FREE.push(new Uint8Array(m.buf)); release(); }
  else if(m.t==='pause'){ running=false; }
};