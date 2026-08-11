/* ════════════════════════════════════════════════════════════════════════
   INFINITE SCROLL · gif.js — the canon GIF89a encoder
   Ported VERBATIM from the public app (root index.html): Sink, lzwEncode,
   gifBegin, gifFrame, gifEnd — "LZW verified pixel-exact". The viewer
   exports the loop in the exact format the app itself writes: global
   palette, Netscape infinite loop, 25fps (DELAY=4), the canon lock.
   Exposes window.GIFKIT.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

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

  /* one loop -> one GIF: index frames + [r,g,b] palette, canon delay 4 */
  function encodeLoopGif(frames, pal, W, H) {
    const DELAY = 4;                      /* 25fps locked, as the app exports */
    const sink = new Sink(1 << 20);
    const mcs = gifBegin(sink, W, H, pal, 0);   /* loop forever */
    for (const f of frames) gifFrame(sink, W, H, f, DELAY, mcs);
    const bytes = gifEnd(sink);
    return new Blob([bytes.slice()], { type: 'image/gif' });
  }

  window.GIFKIT = { Sink, lzwEncode, gifBegin, gifFrame, gifEnd, encodeLoopGif };
})();
