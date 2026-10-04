"""EXPLORATION ONLY: renders fixed TEST seeds per direction (not anyone's gift) and tiles them.
For the approval sheet of a real loop set use mksheet.py <set>, which tiles the exact approved files."""
import sys, os, json, hashlib, math
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import small_weather as sw
from gifenc import encode
from PIL import Image

OUT = sys.argv[1]
DIRS_ = sys.argv[2].split(",")
PER = int(sys.argv[3]) if len(sys.argv) > 3 else 2
N = int(sys.argv[4]) if len(sys.argv) > 4 else 40
os.makedirs(OUT, exist_ok=True)
ADDRS = ["0x0DD399a7ED92283e4983C2974FE377070D67f4eB"] + [
    "0x" + hashlib.sha256(b"small weather test %d" % i).hexdigest()[:40] for i in range(1, 12)]

log, cells = [], []
for d in DIRS_:
    for i in range(PER):
        a = ADDRS[(i + DIRS_.index(d) * PER) % len(ADDRS)] if d != "sky" or i else ADDRS[0]
        OV = json.loads(os.environ.get("OVER", "{}")).get(d, [None] * PER)
        P, frames, pal = sw.render(d, a, N, OV[i])
        # loop closure: frame at raw theta = TAU (unfolded input) against frame 0, byte for byte
        closed = sw.closes(d, P)   # the unfolded phase u=1.0 against u=0.0
        g = encode(frames, pal, 4)
        name = "%s_%d" % (d, i)
        open(os.path.join(OUT, name + ".gif"), "wb").write(g)
        # decode back with PIL and compare to the index buffers
        im = Image.open(os.path.join(OUT, name + ".gif"))
        ok = True
        for k in range(N):
            im.seek(k)
            rgb = np.array(im.convert("RGB"))
            want = np.array(pal, np.uint8)[frames[k]]
            ok &= bool((rgb == want).all())
        moving = sum(int((frames[k] != frames[k - 1]).any()) for k in range(1, N))
        log.append(dict(name=name, addr=a, wx=P.get("wx"), pair=sw.PAIRS[P["pair"]][0], bytes=len(g),
                        closed=closed, decode_exact=ok, moving_frames=moving,
                        sha256=hashlib.sha256(g).hexdigest()))
        cells.append((name, frames, pal))
        print(json.dumps(log[-1]))
json.dump(log, open(os.path.join(OUT, "log.json"), "w"), indent=1)

# animated contact sheet: cells at 240px (nearest), 3 columns
cs, cols = 240, 3
rows = (len(cells) + cols - 1) // cols
sheet = []
for k in range(N):
    S = Image.new("RGB", (cols * cs + (cols - 1) * 8, rows * cs + (rows - 1) * 8), (40, 40, 40))
    for j, (name, frames, pal) in enumerate(cells):
        im = Image.fromarray(np.array(pal, np.uint8)[frames[k]]).resize((cs, cs), Image.NEAREST)
        S.paste(im, ((j % cols) * (cs + 8), (j // cols) * (cs + 8)))
    sheet.append(S)
sheet[0].save(os.path.join(OUT, "sheet.gif"), save_all=True, append_images=sheet[1:], duration=40, loop=0)
sheet[N // 3].save(os.path.join(OUT, "sheet_still.png"))
