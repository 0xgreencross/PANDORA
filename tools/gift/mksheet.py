"""The approval sheet: tiles the EXACT files of a loop set (no re-render), each checked against its
manifest sha256, labelled id / handle / weather / bytes / sha. Over-limit or unclosed loops are shown
with a red OVER label so he sees them too.
Usage: python3 mksheet.py <set> [cell_px=240] [cols=4]
Out:   tools/gift/loops/<set>/sheet.gif (animated, 40 ms) and sheet.png (a still of frame 13).
       Both are gitignored: they are views of the set, not part of it."""
import sys, os, json, hashlib
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))


def main(setname, cell=240, cols=4):
    d = os.path.join(HERE, "loops", setname)
    man = json.load(open(os.path.join(d, "manifest.json")))
    loops = man["loops"]
    font = ImageFont.load_default()
    lab = 30
    rows = (len(loops) + cols - 1) // cols
    W, H = cols * cell + (cols - 1) * 8, rows * (cell + lab) + (rows - 1) * 8
    frames_by = []
    for e in loops:
        b = open(os.path.join(d, e["file"]), "rb").read()
        if hashlib.sha256(b).hexdigest() != e["sha256"]:
            raise SystemExit("STOP: %s does not match its manifest sha256" % e["file"])
        im = Image.open(os.path.join(d, e["file"]))
        fr = []
        for k in range(im.n_frames):
            im.seek(k)
            fr.append(im.convert("RGB").resize((cell, cell), Image.NEAREST))
        frames_by.append(fr)
    n = max(len(f) for f in frames_by)
    out = []
    for k in range(n):
        S = Image.new("RGB", (W, H), (24, 24, 28))
        dr = ImageDraw.Draw(S)
        for j, e in enumerate(loops):
            x, y = (j % cols) * (cell + 8), (j // cols) * (cell + lab + 8)
            S.paste(frames_by[j][k % len(frames_by[j])], (x, y))
            ok = e["closed"] and e["fits"]
            t1 = "#%d %s" % (e["id"], (e.get("handle") or e["holder"][:10])[:28])
            t2 = "%s %s %d B sha %s%s" % (e["wx"], e["pair"], e["bytes"], e["sha256"][:8], "" if ok else "  OVER")
            dr.text((x + 2, y + cell + 3), t1, fill=(232, 232, 236), font=font)
            dr.text((x + 2, y + cell + 16), t2, fill=(200, 255, 58) if ok else (255, 90, 90), font=font)
        out.append(S)
    out[0].save(os.path.join(d, "sheet.gif"), save_all=True, append_images=out[1:], duration=40, loop=0)
    out[min(13, n - 1)].save(os.path.join(d, "sheet.png"))
    bad = [e["id"] for e in loops if not (e["closed"] and e["fits"])]
    print("sheet", os.path.join(d, "sheet.gif"), "%d loops" % len(loops), ("OVER: %s" % bad) if bad else "all fit and close")


if __name__ == "__main__":
    a = sys.argv
    main(a[1], int(a[2]) if len(a) > 2 else 240, int(a[3]) if len(a) > 3 else 4)
