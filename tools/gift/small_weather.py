"""SMALL WEATHER, the gift loops. Exploration build: three directions (sky, stone, term).
Seed = keccak256(holder address). Every frame is a pure function of (seed, folded phase u).
u = k/N folded into [0,1); every motion term is sin/cos(2*pi*m*u) with integer m, or an
integer number of wraps, so u=1 folds onto u=0 and the loop closes on the same bytes."""
import hashlib, math, struct
import numpy as np
from Crypto.Hash import keccak

TAU = 2 * math.pi
OUT = 480

# two-ink pairs (paper, ink) drawn from the STORMGLASS schemes; the predecessor gets two colours
PAIRS = [
    ("DITHERVOID", "#0b0030", "#19f0ff"),
    ("POISONFROG", "#020208", "#2eff9e"),
    ("INFRARED",   "#2a0306", "#ff7a00"),
    ("LAZER",      "#02040c", "#00aaff"),
    ("CATHODE",    "#010401", "#00ff41"),
    ("MGC",        "#101010", "#ff00c8"),
    ("POLE",       "#000000", "#ff7700"),
    ("TISNUKE",    "#050508", "#f1da2e"),
    ("HOTLINE",    "#0c0212", "#ff2fd6"),
    ("EMBERGRID",  "#ff2e6a", "#080202"),
]
hx = lambda h: (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))


def seed_of(addr):
    k = keccak.new(digest_bits=256)
    k.update(bytes.fromhex(addr[2:].lower()))
    return k.digest()


class Rng:
    """sha256 counter stream: platform independent, one stream per purpose."""
    def __init__(self, seed, tag):
        self.s, self.i = seed + tag.encode(), 0
    def f(self):
        h = hashlib.sha256(self.s + struct.pack(">I", self.i)).digest()
        self.i += 1
        return int.from_bytes(h[:4], "big") / 4294967296.0
    def r(self, a, b): return a + (b - a) * self.f()
    def i_(self, a, b): return a + int(self.f() * (b - a + 1))
    def pick(self, xs): return xs[int(self.f() * len(xs))]


def fold(theta):
    u = (theta / TAU) % 1.0
    return 0.0 if u > 1 - 1e-12 else u


def bayer(n):
    m = np.array([[0]])
    while m.shape[0] < n:
        m = np.block([[4 * m, 4 * m + 2], [4 * m + 3, 4 * m + 1]])
    return (m + 0.5) / m.size


B8 = bayer(8)


def dith(d):
    G = d.shape[0]
    t = np.tile(B8, (G // 8 + 1, G // 8 + 1))[:G, :G]
    return d > t


def S(m, u, ph=0.0): return math.sin(TAU * (m * u + ph))
def C(m, u, ph=0.0): return math.cos(TAU * (m * u + ph))


# ---------------------------------------------------------------- the sky before monuments
def sky_params(seed):
    R = Rng(seed, "sky")
    P = dict(G=96)
    P["pair"] = R.i_(0, len(PAIRS) - 1)
    P["hz"] = R.r(0.56, 0.70)
    P["wx"] = R.pick(["SUN", "MOON", "CLOUD", "RAIN", "STORM", "SNOW"])
    P["cx"] = R.r(0.30, 0.70)
    P["cy"] = R.r(0.20, 0.34)
    P["r"] = R.r(0.08, 0.14)
    P["grid"] = R.i_(5, 9)
    P["balls"] = [(R.r(-0.22, 0.22), R.r(-0.05, 0.05), R.r(0.05, 0.10), R.f()) for _ in range(R.i_(4, 7))]
    P["drops"] = [(R.f(), R.f(), R.i_(1, 2)) for _ in range(R.i_(14, 22))]
    P["stars"] = [(R.f(), R.f() * 0.5, R.f(), R.i_(1, 3)) for _ in range(R.i_(14, 26))]
    P["bolt"] = [R.r(-1, 1) for _ in range(12)]
    P["flash"] = R.r(0.1, 0.8)
    return P


def ground(G, hz, grid, y, x, u, crawl):
    """the ancestor's ground: a dithered plane, furrows at hz + A/(k - crawl*u) crawling toward
    us (the set of lines at u=1 is the set at u=0, k shifted by one), rays to the vanishing point."""
    d = np.zeros((G, G))
    gy = y[:, 0]
    below = gy >= hz
    t = np.clip((gy - hz) / (G - hz), 0, 1)
    d[below, :] = (0.30 - 0.22 * t[below])[:, None]
    A = (G - hz) * 1.6
    for k in range(1, 80):
        den = k - crawl * u
        if den <= 0:                       # only at the unfolded u=1 (the seam check); that line is at infinity
            continue
        yk = hz + A / den
        if yk < G and yk - hz > 4:
            d[int(yk), :] = np.maximum(d[int(yk), :], 0.9)
    vx = G / 2
    for i in range(-grid, grid + 1):
        for yy in range(int(hz) + 2, G):
            xx = vx + i * (G / grid) * 0.9 * (yy - hz) / (G - hz)
            if 0 <= xx < G:
                d[yy, int(xx)] = 0.9
    return d


def sky_frame(P, u):
    G = P["G"]
    y, x = np.mgrid[0:G, 0:G].astype(float)
    hz = P["hz"] * G
    d = np.where(y < hz, 0.04 + 0.30 * (y / hz) ** 3, 0.0)
    d = np.maximum(d, ground(G, hz, P["grid"], y, x, u, 1))
    wx = P["wx"]
    cx, cy, r = P["cx"] * G, P["cy"] * G, P["r"] * G
    ink = np.zeros((G, G), bool)
    if wx == "SUN":
        cyb = cy + 1.2 * S(1, u)
        rr = np.hypot(x - cx, y - cyb)
        halo = 0.85 * np.exp(-(rr - r) / (r * (0.55 + 0.12 * S(1, u, 0.25)))) * (rr > r)
        d = np.maximum(d, halo * (y < hz))
        disc = rr <= r
        band = ((y - cyb + 4 * u * 4) % 4 < 1.2) & (y > cyb)   # one band slides one period per loop
        ink |= disc & ~band
    elif wx == "MOON":
        rr = np.hypot(x - cx, y - cy)
        off = r * (0.55 + 0.12 * S(1, u))
        ink |= (rr <= r) & (np.hypot(x - cx - off, y - cy + off * 0.3) > r)
        for sx, sy, ph, m in P["stars"]:
            if S(m, u, ph) > 0.2:
                ink[int(sy * hz) % G, int(sx * G) % G] = True
    if wx in ("CLOUD", "RAIN", "STORM", "SNOW"):
        f = np.zeros((G, G))
        drift = 1.5 * S(1, u)
        for bx, by, br, ph in P["balls"]:
            rad = br * G * (1 + 0.14 * S(1, u, ph))
            f += rad ** 2 / ((x - cx - bx * G - drift) ** 2 + ((y - cy - by * G) * 1.6) ** 2 + 1)
        cloud = np.clip((f - 0.55) * 1.1, 0, 1)
        d = np.where(cloud > 0, 0.08 + 0.80 * cloud, d)
        bottom = cy + 0.06 * G
        span = hz - bottom
        if wx in ("RAIN", "STORM", "SNOW"):
            for dx, dy, m in P["drops"]:
                yy = bottom + ((dy + m * u) % 1.0) * span
                xx = cx + (dx - 0.5) * G * 0.55
                if wx == "SNOW":
                    xx += 1.2 * S(1, u, dx)
                    ink[int(yy) % G, int(xx) % G] = True
                else:
                    for k in range(3):
                        ink[int(yy - k) % G, int(xx - k * 0.5) % G] = True
        if wx == "STORM":
            fl = (u - P["flash"]) % 1.0
            if fl < 0.05 or 0.10 < fl < 0.13:
                bx = cx
                n = len(P["bolt"])
                for i in range(n):
                    y0 = bottom + span * i / n
                    for j in range(int(span / n) + 1):
                        ink[int(y0 + j) % G, int(bx) % G] = True
                    bx += P["bolt"][i] * 2.5
    return np.where(ink | dith(d), 1, 0).astype(np.uint8)


# ---------------------------------------------------------------- the first stone
def stone_params(seed):
    R = Rng(seed, "stone")
    P = dict(G=96)
    P["pair"] = R.i_(0, len(PAIRS) - 1)
    P["hz"] = R.r(0.50, 0.60)
    P["w"] = R.r(0.16, 0.26)
    P["h"] = R.r(0.26, 0.44)
    P["dp"] = R.r(0.06, 0.12)
    P["lean"] = R.r(-0.06, 0.06)
    P["rough"] = [R.r(-1, 1) for _ in range(64)]
    P["arc"] = R.r(0.9, 1.3)
    P["grid"] = R.i_(5, 8)
    P["rain"] = R.f() < 0.4
    P["drops"] = [(R.f(), R.f(), R.i_(1, 2)) for _ in range(R.i_(12, 20))]
    return P


def stone_frame(P, u):
    G = P["G"]
    y, x = np.mgrid[0:G, 0:G].astype(float)
    hz = P["hz"] * G
    d = np.where(y < hz, 0.03 + 0.22 * (y / hz) ** 3, 0.0)
    d = np.maximum(d, ground(G, hz, P["grid"], y, x, u, 0))
    # the sun swings an arc over the stone (there and back: one sin per loop)
    a = math.pi / 2 + P["arc"] * S(1, u)
    sx, sy = G / 2 + math.cos(a) * G * 0.40, hz * 0.55 - math.sin(a) * hz * 0.35
    ink = np.hypot(x - sx, y - sy) <= 3.2
    base = G * 0.80
    w, h, dp = P["w"] * G, P["h"] * G, P["dp"] * G
    x0 = G / 2 - w / 2
    rough = lambda i: P["rough"][int(i) % 64] * 0.9
    # cast shadow on the ground: the sun at angle a throws it the other way
    L = h * (0.6 + 0.9 * (1 - math.sin(a)))
    sdx = -math.cos(a) * L
    sl = int(base - dp * 0.6)
    for yy in range(max(0, sl), min(G, int(base) + 2)):
        if sdx >= 0:
            xa, xb = x0 + w * 0.5, x0 + w + sdx
        else:
            xa, xb = x0 + sdx, x0 + w * 0.5
        d[yy, int(max(0, xa)):int(min(G, xb))] = 0.0
    # front face, top face (oblique), side face; each face's dither density follows the light
    lean = P["lean"]
    top = base - h
    for yy in range(G):
        if yy < top - dp or yy > base:
            continue
        sh = lean * (base - yy)
        if yy >= top:
            xl = x0 + sh + rough(yy)
            xr = x0 + w + sh + rough(yy + 31)
            front = 0.18 + 0.62 * max(0.0, math.sin(a))
            d[yy, int(max(0, xl)):int(min(G, xr))] = front
            side = 0.10 + 0.70 * max(0.0, math.cos(a))
            d[yy, int(max(0, xr)):int(min(G, xr + dp * 0.7))] = side
        else:
            k = (top - yy) / dp
            xl = x0 + lean * h + k * dp * 0.7 + rough(yy + 7)
            d[yy, int(max(0, xl)):int(min(G, xl + w))] = 0.92
    if P["rain"]:
        for dx, dy, m in P["drops"]:
            yy = ((dy + m * u) % 1.0) * base
            xx = dx * G
            for k in range(3):
                ink[int(yy - k) % G, int(xx - k * 0.5) % G] = True
    return np.where(ink | dith(np.clip(d, 0, 1)), 1, 0).astype(np.uint8)


# ---------------------------------------------------------------- the DOS weather terminal
from PIL import Image, ImageDraw, ImageFont
_FONT = None


def font():
    global _FONT
    if _FONT is None:
        _FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 10)
    return _FONT


RAMP = " .:-=+*#%@"


def term_params(seed, addr):
    R = Rng(seed, "term")
    P = dict(G=240, addr=addr)
    P["pair"] = R.i_(0, len(PAIRS) - 1)
    P["wx"] = R.pick(["RAIN", "SUN", "CLOUD", "SNOW", "STORM"])
    P["cx"] = R.r(0.35, 0.65)
    P["balls"] = [(R.r(-0.25, 0.25), R.r(-0.08, 0.08), R.r(0.07, 0.12), R.f()) for _ in range(R.i_(4, 6))]
    P["drops"] = [(R.i_(0, 29), R.f(), R.i_(1, 2)) for _ in range(R.i_(10, 16))]
    P["hpa"] = R.r(985, 1030)
    P["wind"] = R.pick(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]) + " " + str(R.i_(3, 31)) + "KT"
    return P


def term_frame(P, u):
    G = P["G"]
    cw, ch, cols, rows = 8, 12, 30, 20
    img = Image.new("1", (G, G), 0)
    dr = ImageDraw.Draw(img)
    dr.fontmode = "1"
    F = font()
    a = P["addr"]
    lines = {0: "SMALL WEATHER  " + a[:6] + ".." + a[-4:], 18: "", 19: ""}
    trend = "RISING " if C(1, u) > 0 else "FALLING"
    hpa = P["hpa"] + 1.5 * S(1, u)
    lines[18] = "PRESS %6.1f HPA %s" % (hpa, trend)
    lines[19] = "WIND %-6s  WX %-5s" % (P["wind"], P["wx"]) + ("_" if (u * 4) % 1 < 0.5 else " ")
    # the sky as a character field
    cx = P["cx"] * cols
    field = np.zeros((rows, cols))
    yy, xx = np.mgrid[0:rows, 0:cols].astype(float)
    if P["wx"] in ("RAIN", "CLOUD", "SNOW", "STORM"):
        f = np.zeros((rows, cols))
        for bx, by, br, ph in P["balls"]:
            rad = br * cols * (1 + 0.15 * S(1, u, ph))
            f += rad ** 2 / ((xx - cx - bx * cols - 1.2 * S(1, u)) ** 2 + ((yy - 5 - by * rows) * 1.9) ** 2 + 1)
        field = np.clip((f - 0.6) * 1.2, 0, 1)
    if P["wx"] == "SUN":
        rr = np.hypot(xx - cx, (yy - 6) * 1.5)
        field = np.clip(1.15 - rr / (4.2 + 0.6 * S(1, u)), 0, 1)
    grid = [[" "] * cols for _ in range(rows)]
    for r_ in range(2, 15):
        for c_ in range(cols):
            v = field[r_, c_]
            if v > 0.02:
                grid[r_][c_] = RAMP[min(9, int(v * 9.99))]
    if P["wx"] in ("RAIN", "STORM", "SNOW"):
        for c_, dy, m in P["drops"]:
            r_ = 8 + int(((dy + m * u) % 1.0) * 7)
            if 8 <= r_ < 15 and grid[r_][c_] == " ":
                grid[r_][c_] = "*" if P["wx"] == "SNOW" else "/"
    if P["wx"] == "STORM" and ((u * 2) % 1) < 0.08:
        for r_ in range(8, 15):
            grid[r_][int(cx) + (r_ % 2)] = "#"
    for c_ in range(cols):
        grid[15][c_] = "_"
        grid[16][c_] = "=" if (c_ + int(u * 4) * 0) % 2 == 0 else "-"
    for r_ in range(rows):
        s = lines.get(r_)
        if s is None:
            s = "".join(grid[r_])
        dr.text((0, r_ * ch - 1), s[:cols], fill=1, font=F)
    dr.line([(0, ch + 4), (G, ch + 4)], fill=1)
    dr.line([(0, 17 * ch + 4), (G, 17 * ch + 4)], fill=1)
    return np.array(img, dtype=np.uint8)


# ---------------------------------------------------------------- driver
DIRS = {"sky": (sky_params, sky_frame), "stone": (stone_params, stone_frame), "term": (None, term_frame)}


def params(direction, addr, over=None):
    seed = seed_of(addr)
    P = term_params(seed, addr) if direction == "term" else DIRS[direction][0](seed)
    P.update(over or {})
    return P


def closes(direction, P):
    """THE SEAM, checked for real: the index buffer at the UNFOLDED phase u=1.0 (one full turn of every
    motion term, computed without folding) must equal the buffer at u=0.0 byte for byte."""
    f = DIRS[direction][1]
    return f(P, 1.0).tobytes() == f(P, 0.0).tobytes()


def frame(direction, P, theta):
    idx = DIRS[direction][1](P, fold(theta))
    s = OUT // idx.shape[0]
    return np.kron(idx, np.ones((s, s), np.uint8))


def render(direction, addr, N=40, over=None):
    P = params(direction, addr, over)
    frames = [frame(direction, P, TAU * k / N) for k in range(N)]
    _, paper, ink = PAIRS[P["pair"]]
    return P, frames, [hx(paper), hx(ink)]
