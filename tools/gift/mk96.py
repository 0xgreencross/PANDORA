"""THE 96 SET (his call, Oct 9 2026): the approved final loops at their true 96x96 grid, for the on-chain SVG image.
Every loop is drawn on a 96x96 grid and enlarged 5x; the 96 GIF holds exactly the grid, nothing redrawn.
For each id in loops/final/manifest.json:
  1. re-render the holder's scene with motifs.render (the same call mkloops made),
  2. require the 480 encode to equal the APPROVED file byte for byte (sha256 from the manifest),
  3. take every 5th pixel, require the 5x enlargement to give back the 480 frames exactly,
  4. encode the 96 grid with the same encoder and palette.
Out: loops/final96/NNN.gif + manifest.json (scene indices for the on-chain renderer, both shas).
Usage: python3 mk96.py"""
import os, json, hashlib, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import motifs as mo, small_weather as sw
from gifenc import encode

SRC, DST = os.path.join(HERE, "loops", "final"), os.path.join(HERE, "loops", "final96")
man = json.load(open(os.path.join(SRC, "manifest.json")))
PI = {p[0]: i for i, p in enumerate(sw.PAIRS)}
hx = lambda c: tuple(int(c[k:k + 2], 16) for k in (1, 3, 5))
os.makedirs(DST, exist_ok=True)
out = []
for e in man["loops"]:
    sky, land, wx = e["override"]["motif"].split("/")
    thin, pi = e["override"]["thin"], PI[e["override"]["ink"]]
    approved = open(os.path.join(SRC, e["file"]), "rb").read()
    assert hashlib.sha256(approved).hexdigest() == e["sha256"], "id %d: file differs from its manifest" % e["id"]
    P, frames, closed = mo.render(e["holder"], sky, land, wx, thin, man["frames"])
    _, paper, ink = sw.PAIRS[pi]
    pal = [hx(paper), hx(ink)]
    g480 = encode(frames, pal, 4)
    if hashlib.sha256(g480).hexdigest() != e["sha256"]:
        raise SystemExit("STOP: id %d: the re-render is not the approved file" % e["id"])
    small = [f[::5, ::5].copy() for f in frames]
    for f, s in zip(frames, small):
        if not (np.kron(s, np.ones((5, 5), np.uint8)) == f).all():
            raise SystemExit("STOP: id %d: the loop is not a clean 5x enlargement of a 96 grid" % e["id"])
    g96 = encode(small, pal, 4)
    if len(g96) > 24575:
        raise SystemExit("STOP: id %d: 96 GIF is %d bytes, over one SSTORE2 part" % (e["id"], len(g96)))
    name = "%03d.gif" % e["id"]
    tmp = os.path.join(DST, name + ".tmp"); open(tmp, "wb").write(g96); os.replace(tmp, os.path.join(DST, name))
    out.append(dict(id=e["id"], holder=e["holder"], handle=e.get("handle", ""), file=name, bytes=len(g96),
                    sha256=hashlib.sha256(g96).hexdigest(), approved_sha256=e["sha256"], approved_bytes=len(approved),
                    sky=mo.SKIES.index(sky), land=mo.LANDS.index(land), weather=mo.WEATHERS.index(wx), pair=pi, thin=thin,
                    scene="%s/%s/%s" % (sky, land, wx), ink=sw.PAIRS[pi][0], seed=sw.seed_of(e["holder"]).hex(), closed=closed))
    print(e["id"], name, len(g96), "bytes", out[-1]["scene"], flush=True)
m = dict(set="final96", source="final", renderer="tools/gift/motifs.py", grid=96, scale=5, frames=man["frames"], delay_ms=man["delay_ms"],
         skies=mo.SKIES, lands=mo.LANDS, weathers=mo.WEATHERS, pairs=[p[0] for p in sw.PAIRS], loops=out)
tmp = os.path.join(DST, "manifest.json.tmp"); json.dump(m, open(tmp, "w"), indent=1); os.replace(tmp, os.path.join(DST, "manifest.json"))
print("final96:", len(out), "loops,", sum(x["bytes"] for x in out), "bytes, max", max(x["bytes"] for x in out))
