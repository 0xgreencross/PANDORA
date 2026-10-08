"""THE TOKEN PAGE: token_page.html with the renderer (sw.js) inlined, as laid on the chain by setPage.
The contract appends <script>boot({...})</script> for each token.
Out: loops/final96/page.html (+ its sha256 in loops/final96/page.json).   Usage: python3 mkpage.py"""
import os, hashlib, json
HERE = os.path.dirname(os.path.abspath(__file__))
tpl = open(os.path.join(HERE, "token_page.html")).read()
sw = open(os.path.join(HERE, "sw.js")).read()
assert "</script" not in sw.lower() and tpl.count("/*RENDERER*/") == 1
page = tpl.replace("/*RENDERER*/", sw).rstrip("\n").encode("utf-8")
page.decode("utf-8")   # UTF-8 (meta charset); the contract base64-encodes the bytes as they are
dst = os.path.join(HERE, "loops", "final96", "page.html")
tmp = dst + ".tmp"; open(tmp, "wb").write(page); os.replace(tmp, dst)
json.dump({"bytes": len(page), "sha256": hashlib.sha256(page).hexdigest(), "renderer_sha256": hashlib.sha256(sw.encode()).hexdigest()},
          open(os.path.join(HERE, "loops", "final96", "page.json"), "w"), indent=1)
print("page", len(page), "bytes", hashlib.sha256(page).hexdigest()[:16])
