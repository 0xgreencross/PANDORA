"""THE PACK. glass/index.html -> gzip (deterministic) -> chunks for SSTORE2, plus the loader
the contract wraps round them, plus a test token page that carries the whole thing inline
so the print gate can be run on exactly what a marketplace would show.
Out: onchain/glass.gz, onchain/chunks/NN.bin, onchain/manifest.json, onchain/loader.html,
     onchain/test_token.html"""
import gzip, base64, hashlib, json, os, sys
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC=os.path.join(ROOT,'glass/index.html'); OUT=os.path.join(ROOT,'onchain')
os.makedirs(OUT+'/chunks',exist_ok=True)
page=open(SRC,'rb').read()
gz=gzip.compress(page,9,mtime=0)
open(OUT+'/glass.gz','wb').write(gz)
# THE THREE COATS. tokenURI must hand back base64(JSON), the JSON carries base64(HTML), the
# HTML carries base64(gzip). Base64 splits on 3-byte boundaries, so with the wrappers padded
# to multiples of three (spaces, harmless in JS, JSON and atob) the contract never encodes
# the page at all: it stores base64(base64(base64(gz))) and only concatenates. Xp is padded
# to a multiple of nine so every coat is whole.
X=base64.b64encode(gz)
X=X+b' '*((9-len(X)%9)%9); assert len(X)%9==0
W=base64.b64encode(X); assert len(W)%12==0 and b'=' not in W
V=base64.b64encode(W); assert len(V)%16==0 and b'=' not in V
CH=24000   # under the 24576 byte contract size limit, with room for the SSTORE2 STOP byte
chunks=[V[i:i+CH] for i in range(0,len(V),CH)]
for f in os.listdir(OUT+'/chunks'): os.remove(OUT+'/chunks/'+f)
for i,c in enumerate(chunks): open(OUT+'/chunks/%02d.bin'%i,'wb').write(c)
man={'page_bytes':len(page),'page_sha256':hashlib.sha256(page).hexdigest(),'gz_bytes':len(gz),'gz_sha256':hashlib.sha256(gz).hexdigest(),
     'coat_bytes':len(V),'coat_sha256':hashlib.sha256(V).hexdigest(),
     'chunks':[{'i':i,'bytes':len(c),'sha256':hashlib.sha256(c).hexdigest()} for i,c in enumerate(chunks)]}
json.dump(man,open(OUT+'/manifest.json','w'),indent=1)
# prove the coats peel: V -> W -> X -> gz -> page
assert gzip.decompress(base64.b64decode(base64.b64decode(base64.b64decode(V)).replace(b' ',b'')))==page
# THE LOADER. The contract emits: head + GLASS json + mid + base64(gz) + tail.
LOADER='''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DITHERVOID // STORMGLASS</title><style>html,body{margin:0;background:#000;height:100%}</style></head><body><script>
window.GLASS=__GLASS__;
(async()=>{var b=Uint8Array.from(atob("__B64__"),function(c){return c.charCodeAt(0)});
var d=new DecompressionStream("gzip"),w=d.writable.getWriter();w.write(b);w.close();
var h=await new Response(d.readable).text();var G=window.GLASS;document.open();document.write(h);document.close();window.GLASS=G;})();
</script></body></html>'''
open(OUT+'/loader.html','w').write(LOADER)
b64=X.decode()
test=LOADER.replace('__GLASS__',json.dumps({'seed':424242,'frames':24})).replace('__B64__',b64)
open(OUT+'/test_token.html','w').write(test)
print(json.dumps({k:v for k,v in man.items() if k!='chunks'}), 'chunks', len(chunks), 'test_token bytes', len(test))
