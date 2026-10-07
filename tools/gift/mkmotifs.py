"""Preview renderer for the motif direction (no manifest guard). The FINAL set goes through mkloops --motifs.
Usage: python3 mkmotifs.py <set> <recipients.json>
Writes loops/<set>/NNN.gif + manifest.json in the mksheet format (wx = scene label, pair = ink)."""
import sys, os, json, hashlib, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import small_weather as sw
import motifs as mo
from gifenc import encode
from mkloops import holder_ok, LIMIT, N

TAU = 2 * math.pi
hx = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def render(h, sky, land, wx, pi, thin=0):
    P, frames, closed = mo.render(h, sky, land, wx, thin, N)
    _, paper, ink = sw.PAIRS[pi]
    return P, encode(frames, [hx(paper), hx(ink)], 4), closed


def main(setname, rec_path):
    recs = sorted(json.load(open(rec_path)), key=lambda r: int(r["id"]))
    A = mo.assign(max(int(r["id"]) for r in recs))
    out = os.path.join(HERE, "loops", setname)
    os.makedirs(out, exist_ok=True)
    man = []
    for r in recs:
        i = int(r["id"]); h = holder_ok(r["holder"])
        sky, land, wx, pi = A[i - 1]
        for thin in range(4):
            P, g, closed = render(h, sky, land, wx, pi, thin)
            if len(g) <= LIMIT:
                break
        ok = closed and len(g) <= LIMIT
        fn = os.path.join(out, ("%03d.gif" if ok else "%03d.over.gif") % i)
        open(fn, "wb").write(g)
        e = dict(id=i, holder=h, handle=r.get("handle", ""), file=os.path.basename(fn), bytes=len(g),
                 sha256=hashlib.sha256(g).hexdigest(), wx="%s/%s/%s" % (sky, land, wx), pair=sw.PAIRS[pi][0],
                 sky=sky, land=land, weather=wx, thin=thin, frames=N, closed=closed, fits=len(g) <= LIMIT)
        man.append(e)
        print(json.dumps(e), flush=True)
    json.dump(dict(set=setname, renderer="tools/gift/motifs.py (draft)", frames=N, delay_ms=40, size=480,
                   limit=LIMIT, loops=man), open(os.path.join(out, "manifest.json"), "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
