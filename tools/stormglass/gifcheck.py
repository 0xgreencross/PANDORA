#!/usr/bin/env python3
"""Decode NAME.gif (composited, as a viewer shows it) and compare every frame with the page's own index frames
NN-enlarged through the palette. Prints differing pixels per file. Usage: gifcheck.py OUT name [name...]"""
import sys, json, numpy as np
from PIL import Image, GifImagePlugin
GifImagePlugin.LOADING_STRATEGY = GifImagePlugin.LoadingStrategy.RGB_ALWAYS
out=sys.argv[1]
for name in sys.argv[2:]:
    m=json.load(open(f'{out}/{name}.json')); N,W,H=m['N'],m['W'],m['H']; pal=np.zeros((256,3),np.uint8)
    for i,c in enumerate(m['pal'][:256]): pal[i]=c[:3]
    raw=np.fromfile(f'{out}/{name}.idx',dtype=np.uint8)
    assert raw.size==N*W*H, (raw.size, N*W*H)
    fr=raw.reshape(N,H,W)
    im=Image.open(f'{out}/{name}.gif'); assert im.n_frames==N, (im.n_frames,N)
    k=im.width//W; bad=0; worst=0
    for f in range(N):
        im.seek(f); a=np.asarray(im.convert('RGB'))
        b=pal[fr[f]].repeat(k,axis=0).repeat(k,axis=1)
        d=int((a!=b).any(2).sum()); worst=max(worst,d); bad+= d>0
    print(f'{name}: {N} frames {im.width}x{im.height}, frames differing {bad}, worst frame {worst} px, {m["sub"]} turns={m.get("turns")} cam={m.get("cam")} wx={m.get("wx")}')
