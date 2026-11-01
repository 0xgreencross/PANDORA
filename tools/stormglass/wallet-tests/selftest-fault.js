/* Fault injection for selftest.js ONLY (preloaded with NODE_OPTIONS=--require; a RELEASE=1 run refuses any preload).
   ST_FAULT=write:N   the N-th write of a results temp file (.results-*.tmp) fails with EIO (N may be "all")
   ST_FAULT=rename:N  the N-th rename of a results temp file over the results fails with EIO
   ST_FAULT=open:N    the N-th open of a results temp file fails with ENOSPC */
const fs=require('fs');
const [kind,nth]=(process.env.ST_FAULT||'').split(':');
const TMP=/[\\/]\.results-.*\.tmp$/;
const fds=new Set(); const seen={write:0,rename:0,open:0};
const hit=k=>{ seen[k]++; return kind===k&&(nth==='all'||seen[k]===+nth); };
const err=(code,what)=>Object.assign(new Error(code+': injected by selftest-fault.js, '+what),{code});
const open0=fs.openSync, write0=fs.writeSync, close0=fs.closeSync, rename0=fs.renameSync;
fs.openSync=function(p,...a){ if(typeof p==='string'&&TMP.test(p)){ if(hit('open')) throw err('ENOSPC','open '+p); const fd=open0.call(fs,p,...a); fds.add(fd); return fd; } return open0.call(fs,p,...a); };
fs.writeSync=function(fd,...a){ if(fds.has(fd)&&hit('write')) throw err('EIO','write #'+seen.write); return write0.call(fs,fd,...a); };
fs.closeSync=function(fd){ fds.delete(fd); return close0.call(fs,fd); };
fs.renameSync=function(a,b){ if(typeof a==='string'&&TMP.test(a)&&hit('rename')) throw err('EIO','rename #'+seen.rename); return rename0.call(fs,a,b); };
