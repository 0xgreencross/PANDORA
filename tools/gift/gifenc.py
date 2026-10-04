"""SMALL WEATHER: a minimal deterministic GIF89a encoder.
Frame 0 is written whole; every later frame is the changed rectangle only, unchanged
pixels inside it set to the transparent index, disposal 1 (leave in place).
Palette indices only; no dithering or quantizing happens here."""
import struct


def _lzw(px, mcs):
    clear, eoi = 1 << mcs, (1 << mcs) + 1
    size, nxt, table = mcs + 1, eoi + 1, {}
    out, acc, nbits = bytearray(), 0, 0

    def emit(code, sz):
        nonlocal acc, nbits
        acc |= code << nbits
        nbits += sz
        while nbits >= 8:
            out.append(acc & 0xFF)
            acc >>= 8
            nbits -= 8

    emit(clear, size)
    w = px[0]
    for k in px[1:]:
        key = (w, k)
        c = table.get(key)
        if c is not None:
            w = c
            continue
        emit(w, size)
        if nxt < 4096:
            table[key] = nxt
            nxt += 1
            if nxt > (1 << size) and size < 12:
                size += 1
        else:
            emit(clear, size)
            table.clear()
            size, nxt = mcs + 1, eoi + 1
        w = k
    emit(w, size)
    emit(eoi, size)
    if nbits:
        out.append(acc & 0xFF)
    return bytes(out)


def _blocks(data):
    b = bytearray()
    for i in range(0, len(data), 255):
        ch = data[i:i + 255]
        b.append(len(ch))
        b += ch
    b.append(0)
    return bytes(b)


def encode(frames, palette, delay_cs=4, transparent=None):
    """frames: list of 2D numpy uint8 index arrays (H, W), all same shape.
    palette: list of (r,g,b); padded to a power of two. transparent: spare index for deltas."""
    import numpy as np
    H, W = frames[0].shape
    pal = list(palette)
    if transparent is None:
        transparent = len(pal)
        pal.append((0, 0, 0))
    n = 2
    while n < len(pal):
        n *= 2
    pal += [(0, 0, 0)] * (n - len(pal))
    bits = n.bit_length() - 1          # palette size = 2^bits
    mcs = max(2, bits)
    g = bytearray(b"GIF89a")
    g += struct.pack("<HHBBB", W, H, 0x80 | 0x70 | (bits - 1), 0, 0)
    for c in pal:
        g += bytes(c)
    g += b"\x21\xFF\x0BNETSCAPE2.0\x03\x01\x00\x00\x00"
    prev = None
    for f in frames:
        if prev is None:
            x0, y0, x1, y1, img, tflag = 0, 0, W, H, f, 0
        else:
            d = f != prev
            if not d.any():                # identical frame: a 1x1 transparent patch
                x0, y0, x1, y1 = 0, 0, 1, 1
                img, tflag = np.full((1, 1), transparent, np.uint8), 1
            else:
                ys, xs = np.nonzero(d)
                y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
                img = f[y0:y1, x0:x1].copy()
                img[~d[y0:y1, x0:x1]] = transparent
                tflag = 1
        g += b"\x21\xF9\x04" + bytes([(1 << 2) | tflag]) + struct.pack("<H", delay_cs) + bytes([transparent if tflag else 0]) + b"\x00"
        g += b"\x2C" + struct.pack("<HHHHB", int(x0), int(y0), int(x1 - x0), int(y1 - y0), 0)
        g.append(mcs)
        g += _blocks(_lzw(img.astype(np.uint8).ravel().tolist(), mcs))
        prev = f
    g.append(0x3B)
    return bytes(g)
