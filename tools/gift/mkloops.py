"""Render one SKY loop per holder into tools/gift/loops/<set>/ with a manifest.

Usage:  python3 mkloops.py <set> <recipients.json>
recipients.json: [{"id": 1, "holder": "0x...", "handle": "...", "drops": 12}]   ("drops" is optional, see below)

Rules it enforces:
- holder must be a real 20-byte address (resolve ENS first), not the zero address, and if mixed-case its
  EIP-55 checksum must be right. One loop per holder, ids unique and > 0.
- every loop must close at the seam (sw.closes: the UNFOLDED phase u=1.0 equals u=0.0 byte for byte)
  and fit LIMIT bytes. A loop that fails either is written as NNN.over.gif, never as NNN.gif, the
  manifest marks it, and the script exits 2. mkdeploy.py refuses a set with any failing loop.
- "drops": n (optional, his call only) keeps the first n of that holder's seeded rain/snow drops. It is
  the per-holder way to bring an over-limit RAIN/STORM/SNOW loop under the limit; it is recorded in the
  manifest so the render can be reproduced. It never changes any other holder.
- never replace: if loops/<set>/manifest.json already records an id, the new render for that id must
  have the same holder, the same overrides and the same sha256, whether or not the GIF file is present;
  and an id recorded there may not vanish from the recipients file. Otherwise it STOPS.
"""
import sys, os, json, hashlib, re
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import small_weather as sw
from gifenc import encode
from Crypto.Hash import keccak

# setGift costs about 222 gas per loop byte (measured under osaka: 63,000 B 14.00M, 66,500 B 14.77M,
# 67,000 B 14.88M). The pages cap a transaction at 15M, so 66,500 B keeps about 1.5% headroom.
LIMIT = 66500
N = 40
ZERO = "0x" + "0" * 40


def checksum(addr):
    a = addr[2:].lower()
    k = keccak.new(digest_bits=256); k.update(a.encode()); h = k.hexdigest()
    return "0x" + "".join(c.upper() if c.isalpha() and int(h[i], 16) >= 8 else c for i, c in enumerate(a))


def holder_ok(h):
    h = h.strip()
    if not re.fullmatch(r"0x[0-9a-fA-F]{40}", h):
        raise SystemExit("STOP: %r is not an address (resolve ENS names to 0x addresses first)" % h)
    if h.lower() == ZERO:
        raise SystemExit("STOP: the zero address cannot hold a gift")
    if h != h.lower() and h != h.upper()[:2].lower() + h[2:].upper() and h != checksum(h):
        raise SystemExit("STOP: %s fails its EIP-55 checksum (expected %s); check the address he posted" % (h, checksum(h)))
    return checksum(h)


def main(setname, rec_path):
    recs = json.load(open(rec_path))
    out = os.path.join(HERE, "loops", setname)
    os.makedirs(out, exist_ok=True)
    mpath = os.path.join(out, "manifest.json")
    old = {e["id"]: e for e in json.load(open(mpath))["loops"]} if os.path.exists(mpath) else {}
    seen_ids, seen_h = set(), set()
    man, failed = [], []
    for r in recs:
        i = int(r["id"])
        h = holder_ok(r["holder"])
        if i <= 0 or i in seen_ids:
            raise SystemExit("STOP: ids must be unique and > 0 (id %d)" % i)
        if h.lower() in seen_h:
            raise SystemExit("STOP: one loop per holder (%s appears twice)" % h)
        seen_ids.add(i); seen_h.add(h.lower())
        over, note = {}, {}
        if "drops" in r:
            P0 = sw.params("sky", h)
            n = int(r["drops"])
            if not 0 <= n <= len(P0["drops"]):
                raise SystemExit("STOP: drops for id %d must be 0..%d" % (i, len(P0["drops"])))
            over = {"drops": P0["drops"][:n]}
            note = {"drops": n}
        P, frames, pal = sw.render("sky", h, N, over)
        closed = sw.closes("sky", P)
        g = encode(frames, pal, 4)
        sha = hashlib.sha256(g).hexdigest()
        fits = len(g) <= LIMIT
        if i in old and old[i].get("closed") and old[i].get("fits"):      # a failed (.over) entry was never approvable
            o = old[i]
            if o["holder"].lower() != h.lower() or o.get("override", {}) != note or o["sha256"] != sha:
                raise SystemExit("STOP: id %d is already in %s with holder %s, override %s, sha %s; this run gives %s, %s, %s. "
                                 "An approved loop is never replaced." % (i, mpath, o["holder"], o.get("override", {}), o["sha256"][:16], h, note, sha[:16]))
        ok = closed and fits
        fn = os.path.join(out, ("%03d.gif" if ok else "%03d.over.gif") % i)
        if os.path.exists(fn):
            if hashlib.sha256(open(fn, "rb").read()).hexdigest() != sha:
                raise SystemExit("STOP: %s exists with different bytes; an approved loop is never replaced" % fn)
        else:
            tmp = fn + ".tmp"; open(tmp, "wb").write(g); os.replace(tmp, fn)
        e = dict(id=i, holder=h, handle=r.get("handle", ""), file=os.path.basename(fn), bytes=len(g), sha256=sha,
                 wx=P["wx"], pair=sw.PAIRS[P["pair"]][0], drops=len(P["drops"]), override=note,
                 frames=N, closed=closed, fits=fits)
        man.append(e)
        if not ok:
            failed.append(e)
        print(json.dumps(e), flush=True)
    gone = sorted(k for k in set(old) - seen_ids if old[k].get("closed") and old[k].get("fits"))
    if gone:
        raise SystemExit("STOP: ids %s are in the existing manifest but not in %s; an approved loop is never dropped silently" % (gone, rec_path))
    tmp = mpath + ".tmp"
    json.dump(dict(set=setname, renderer="tools/gift/small_weather.py sky", frames=N, delay_ms=40, size=480,
                   limit=LIMIT, loops=man), open(tmp, "w"), indent=1)
    os.replace(tmp, mpath)
    if failed:
        print("ATTENTION: %d loop(s) over %d B or not closed, written as NNN.over.gif: %s"
              % (len(failed), LIMIT, ", ".join("id %d %s %d B" % (e["id"], e["wx"], e["bytes"]) for e in failed)))
        print("This set cannot be deployed until he decides (see PENDING 1).")
        sys.exit(2)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
