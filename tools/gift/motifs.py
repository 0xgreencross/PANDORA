"""SMALL WEATHER motifs (his call, Oct 7 2026; sheet APPROVED Oct 7): keep the DITHERVOID inks, vary the scene instead.
Every holder gets a different (sky, land, weather) combination, never repeated; inks are the original
PAIRS, spread evenly. The final set uses this through `mkloops.py <set> <recipients> --motifs`; the rehearsal direction "sky" is untouched.

A scene is drawn on the same 96x96 grid as the sky direction, two colours, Bayer-dithered density `d`
plus a solid `ink` mask, and every motion term is periodic in u (the loop closes at the seam).
New per-holder values come from their own sha256 stream (Rng(seed, "motif")), never from the sky stream,
so the sky parameters (position, drops, stars, grid) stay exactly what they were.
"""
import math
import numpy as np
import small_weather as sw
from small_weather import S, C, dith, ground, Rng

TAU = 2 * math.pi

SKIES = ["SUN", "MOON", "FULL MOON", "SATURN", "ECLIPSE", "COMET", "METEORS", "TWIN SUNS", "SATELLITE", "RAINBOW", "AURORA"]
LANDS = ["GRID", "PEAKS", "VOLCANO", "SEA", "LIGHTHOUSE", "DUNES", "CITY"]
WEATHERS = ["CLEAR", "CLOUD", "RAIN", "STORM", "SNOW", "FOG", "TORNADO", "WIND", "HURRICANE", "MIRAGE"]
NIGHT = {"MOON", "FULL MOON", "SATURN", "ECLIPSE", "COMET", "METEORS", "SATELLITE", "AURORA"}
CLOUDY = {"CLOUD", "RAIN", "STORM", "SNOW", "TORNADO"}


def compatible(sky, land, wx):
    if sky == "AURORA" and wx not in ("CLEAR", "FOG", "WIND"):
        return False
    if sky == "RAINBOW" and wx not in ("CLEAR", "CLOUD", "RAIN", "FOG", "WIND"):
        return False
    if sky == "ECLIPSE" and wx not in ("CLEAR", "CLOUD", "FOG", "WIND"):
        return False
    if wx == "MIRAGE" and (sky not in ("SUN", "TWIN SUNS") or land in ("LIGHTHOUSE",)):
        return False
    if wx == "HURRICANE" and sky in ("RAINBOW", "AURORA", "ECLIPSE", "TWIN SUNS"):
        return False
    if land == "LIGHTHOUSE" and sky not in NIGHT:
        return False
    return True


COMBOS = [(s, l, w) for s in SKIES for l in LANDS for w in WEATHERS if compatible(s, l, w)]


def _shuffled(xs, tag):
    xs = list(xs)
    R = Rng(b"SMALL WEATHER motifs v1", tag)
    for j in range(len(xs) - 1, 0, -1):
        k = int(R.f() * (j + 1))
        xs[j], xs[k] = xs[k], xs[j]
    return xs


def assign(n):
    """id k (1-based) -> (sky, land, weather, pair index). Greedy over a fixed shuffle, so the first k
    assignments never depend on how many holders come after: adding a holder never moves anyone."""
    combos = _shuffled(COMBOS, "combos")
    inks = _shuffled(range(len(sw.PAIRS)), "inks")
    cs, cl, cw, ci, cis = {}, {}, {}, {}, {}
    used, out = set(), []
    for k in range(n):
        best = None
        for j, (s, l, w) in enumerate(combos):
            if (s, l, w) in used:
                continue
            score = (3 * cs.get(s, 0) + 3 * cl.get(l, 0) + 2 * cw.get(w, 0), j)
            if best is None or score < best[0]:
                best = (score, (s, l, w))
        s, l, w = best[1]
        used.add((s, l, w))
        cs[s] = cs.get(s, 0) + 1; cl[l] = cl.get(l, 0) + 1; cw[w] = cw.get(w, 0) + 1
        bi = min(inks, key=lambda i: (2 * ci.get(i, 0) + 3 * cis.get((i, s), 0), inks.index(i)))
        ci[bi] = ci.get(bi, 0) + 1; cis[(bi, s)] = cis.get((bi, s), 0) + 1
        out.append((s, l, w, bi))
    return out


def params(seed):
    P = sw.sky_params(seed)
    R = Rng(seed, "motif")
    P["m_ridge"] = [R.r(-1, 1) for _ in range(48)]
    P["m_ridge2"] = [R.r(-1, 1) for _ in range(48)]
    P["m_city"] = [(R.i_(5, 10), R.r(0.06, 0.30), R.i_(0, 2)) for _ in range(24)]
    P["m_lit"] = [R.f() for _ in range(400)]
    P["m_meteors"] = [(R.f(), R.r(0.05, 1.05), R.r(0.0, 0.45)) for _ in range(5)]
    P["m_side"] = R.f() < 0.5
    P["m_vx"] = R.r(0.35, 0.65)
    P["m_tilt"] = R.r(-0.5, 0.5)
    P["m_fog"] = [R.f() for _ in range(5)]
    P["m_wind"] = [(R.f(), R.f(), R.i_(6, 14)) for _ in range(9)]
    return P


def _noise1(pts, G, octaves=((3, 1.0), (7, 0.45), (17, 0.18))):
    out = np.zeros(G)
    n = len(pts)
    for i in range(G):
        for oc, amp in octaves:
            t = i / G * oc
            k = int(t); f = t - k; f = f * f * (3 - 2 * f)
            a = pts[(k * 5 + oc) % n]; b = pts[((k + 1) * 5 + oc) % n]
            out[i] += amp * (a + (b - a) * f)
    return out


def _stars(P, ink, hz, G, u, thresh=0.0):
    for sx, sy, ph, m in P["stars"]:
        if S(m, u, ph) > thresh:
            ink[int(sy * hz) % G, int(sx * G) % G] = True


def frame(P, u):
    G = P["G"]
    y, x = np.mgrid[0:G, 0:G].astype(float)
    hz = P["hz"] * G
    sky, land, wx = P["sky"], P["land"], P["weather"]
    night = sky in NIGHT
    d = np.where(y < hz, (0.02 if night else 0.04) + (0.22 if night else 0.30) * (y / hz) ** 3, 0.0)
    ink = np.zeros((G, G), bool)
    cx, cy, r = P["cx"] * G, P["cy"] * G, P["r"] * G
    cloudy = wx in CLOUDY or wx == "HURRICANE"
    if cloudy or wx == "TORNADO":
        bcx = (0.27 if P["m_side"] else 0.73) * G     # the body steps aside for the weather
        ccx = G - bcx
    else:
        bcx, ccx = cx, cx

    # ---------------------------------------------------------------- sky
    if night and sky not in ("AURORA",):
        _stars(P, ink, hz, G, u, 0.1)
    if sky == "SUN":
        cyb = cy + 1.2 * S(1, u)
        rr = np.hypot(x - bcx, y - cyb)
        halo = 0.85 * np.exp(-(rr - r) / (r * (0.55 + 0.12 * S(1, u, 0.25)))) * (rr > r)
        d = np.maximum(d, halo * (y < hz))
        band = ((y - cyb + 4 * u * 4) % 4 < 1.2) & (y > cyb)
        ink |= (rr <= r) & ~band
    elif sky == "MOON":
        rr = np.hypot(x - bcx, y - cy)
        off = r * (0.55 + 0.12 * S(1, u))
        ink |= (rr <= r) & (np.hypot(x - bcx - off, y - cy + off * 0.3) > r)
    elif sky == "FULL MOON":
        rr = np.hypot(x - bcx, y - cy)
        rf = r * 1.1
        disc = rr <= rf
        maria = np.zeros((G, G))
        for ox, oy, rad in ((-0.40, -0.02, 0.40), (-0.05, 0.40, 0.20), (0.42, -0.42, 0.08)):
            maria = np.maximum(maria, (np.hypot(x - bcx - ox * rf, y - cy - oy * rf) < rad * rf) * 1.0)
        d = np.where(disc, np.where(maria > 0, 0.55, 0.97), d)
        halo = 0.55 * np.exp(-(rr - rf) / (rf * (0.35 + 0.08 * S(1, u)))) * (rr > rf)
        d = np.maximum(d, halo * (y < hz))
    elif sky == "SATURN":
        rp = r * 0.9
        ex, ey = x - bcx, y - cy
        a = 0.30 + 0.25 * P["m_tilt"]
        xr = ex * math.cos(a) + ey * math.sin(a)
        yr = -ex * math.sin(a) + ey * math.cos(a)
        e = np.hypot(xr / (rp * 2.15), yr / (rp * 2.15 * 0.30))
        ring = (e > 0.72) & (e < 1.0) & ~((e > 0.84) & (e < 0.88))
        planet = np.hypot(ex, ey) <= rp
        shade = 0.30 + 0.60 * np.clip((ex + rp) / (2 * rp), 0, 1)
        bands = ((yr + 5 * u * 5) % 5) < 1.2
        d = np.where(planet, np.where(bands, shade * 0.35, shade), d)
        ink |= ring & ((yr > 0) | ~planet)
        ink &= ~(planet & ring & (yr <= 0))
        d = np.where(ring & ~planet, 0.0, d)
    elif sky == "ECLIPSE":
        rr = np.hypot(x - bcx, y - cy)
        rc = r * 1.05
        th = np.arctan2(y - cy, x - bcx)
        cor = np.exp(-(rr - rc) / (rc * (0.42 + 0.10 * S(1, u)))) * (rr > rc)
        rays = 0.30 * (0.5 + 0.5 * np.cos(7 * th + TAU * u)) * cor
        d = np.maximum(d, np.clip(cor * 0.85 + rays, 0, 1) * (y < hz))
        d = np.where(rr <= rc, 0.0, d)
        ink &= ~(rr <= rc)
        ink |= (np.abs(rr - rc) < 0.6)
    elif sky == "COMET":
        hx_, hy = bcx - 0.10 * G, cy + 0.02 * G
        ang = math.radians(-24 if P["m_side"] else -156)
        dx, dy = x - hx_, y - hy
        along = dx * math.cos(ang) + dy * math.sin(ang)
        across = -dx * math.sin(ang) + dy * math.cos(ang)
        L = 0.46 * G
        w = 1.0 + along * 0.20
        fall = np.clip(1 - along / L, 0, 1)
        shimmer = 0.88 + 0.12 * np.sin(across * 1.3 + TAU * u * 2 + along * 0.12)
        tail = (along > 0) & (along < L)
        d = np.maximum(d, np.where(tail, fall ** 0.8 * shimmer * np.exp(-(across / w) ** 2), 0) * (y < hz))
        ink |= tail & (np.abs(across) < 0.5) & (along < L * 0.45)
        rr = np.hypot(dx, dy)
        ink |= rr <= 2.2
        d = np.maximum(d, 0.8 * np.exp(-(rr - 2.2) / 2.0) * (rr > 2.2) * (y < hz))
    elif sky == "METEORS":
        for ph, sx, sy in P["m_meteors"]:
            t = (u + ph) % 1.0
            if t < 0.22:
                q = t / 0.22
                hx0 = sx * G - q * 0.45 * G
                hy0 = sy * hz + q * 0.22 * G
                for k in range(9):
                    px, py = hx0 + k, hy0 - k * 0.5
                    if 0 <= px < G and 0 <= py < hz:
                        if k < 5:
                            ink[int(py), int(px)] = True
                        else:
                            d[int(py), int(px)] = max(d[int(py), int(px)], 0.5)
    elif sky == "TWIN SUNS":
        for k, (ox, oy, rf) in enumerate(((-0.11, 0.02, 0.95), (0.12, -0.05, 0.55))):
            sx_, sy_ = bcx + ox * G, cy + oy * G + 1.0 * S(1, u, 0.5 * k)
            rr = np.hypot(x - sx_, y - sy_)
            halo = 0.80 * np.exp(-(rr - r * rf) / (r * (0.45 + 0.1 * S(1, u, 0.3 * k)))) * (rr > r * rf)
            d = np.maximum(d, halo * (y < hz))
            ink |= rr <= r * rf
    elif sky == "SATELLITE":
        rr = np.hypot(x - bcx, y - cy)
        off = r * 0.62
        ink |= (rr <= r * 0.75) & (np.hypot(x - bcx - off, y - cy + off * 0.3) > r * 0.75)
        sx_ = -6 + (G + 12) * u
        sy_ = 0.12 * G + 0.10 * G * u
        if 0 <= sx_ < G:
            ix, iy = int(sx_), int(sy_)
            for ddx in range(-3, 4):
                if 0 <= ix + ddx < G:
                    ink[iy, ix + ddx] = abs(ddx) != 1
            for ddy in (-1, 1):
                ink[iy + ddy, max(0, ix - 3):min(G, ix - 1)] = True
                ink[iy + ddy, max(0, ix + 2):min(G, ix + 4)] = True
            if (u * 8) % 1 < 0.5 and iy + 2 < G:
                ink[iy + 2, ix] = True
    elif sky == "RAINBOW":
        rx, ry = bcx, hz + 2
        rr = np.hypot((x - rx) / 1.0, y - ry)
        R0 = 0.42 * G
        dens = [0.95, 0.70, 0.48, 0.30, 0.16]
        for k, de in enumerate(dens):
            band = (rr >= R0 + 2.2 * k) & (rr < R0 + 2.2 * (k + 1)) & (y < hz)
            d = np.where(band, de * (0.92 + 0.08 * S(1, u, k * 0.2)), d)
        ink |= (np.abs(rr - R0) < 0.55) & (y < hz)
        if wx not in CLOUDY:
            sun = np.hypot(x - (G - bcx), y - cy * 0.8)
            d = np.maximum(d, 0.7 * np.exp(-(sun - 3) / 3) * (sun > 3) * (y < hz))
            ink |= sun <= 3.5
    elif sky == "AURORA":
        _stars(P, ink, hz * 0.6, G, u, 0.3)
        for j in range(2):
            base = hz * (0.16 + 0.22 * j)
            xs = x[0]
            top = base + G * 0.07 * np.sin(TAU * (xs / G * (0.7 + 0.5 * j)) + 1.9 * j)
            ln = hz * (0.20 - 0.05 * j) * (0.55 + 0.45 * np.sin(xs * 0.21 + 2.1 * j) ** 2)
            for cxp in range(j, G, 2):
                t0 = top[cxp] + 0.8 * math.sin(TAU * (cxp / G * 1.5 + u) + j)
                L_ = ln[cxp] * (0.8 + 0.2 * math.sin(TAU * (u + cxp / G * 2) + j))
                y0, y1 = int(t0), int(min(t0 + L_, hz - 2))
                if y1 > y0:
                    ink[y0:y0 + max(1, (y1 - y0) // 2), cxp] = True
                    d[y0:y1, cxp] = np.maximum(d[y0:y1, cxp], np.linspace(0.6, 0.1, y1 - y0))

    # ---------------------------------------------------------------- land
    if land in ("GRID", "PEAKS", "VOLCANO", "CITY"):
        g = ground(G, hz, P["grid"], y, x, u, 1)
        d = np.where(y >= hz, g, np.maximum(d, g))
    if land == "PEAKS":
        far = hz - (0.13 + 0.07 * _noise1(P["m_ridge"], G)) * G
        near = hz - (0.05 + 0.05 * _noise1(P["m_ridge2"], G, ((4, 1.0), (11, 0.4)))) * G
        for i in range(G):
            f0, n0 = int(max(far[i], 0)), int(max(near[i], 0))
            d[f0:int(hz), i] = 0.22
            ink[f0, i] = True
            if far[i] < hz - 0.17 * G:
                ink[f0:f0 + 2, i] = True
                d[f0:f0 + 4, i] = 0.8
            d[n0:int(hz), i] = 0.0
            ink[n0:int(hz), i] = False
            ink[n0, i] = True
    elif land == "VOLCANO":
        vx = P["m_vx"] * G
        peak = hz - 0.27 * G
        cr = 0.045 * G
        top = peak + np.maximum(np.abs(x[0] - vx) - cr, 0) * 1.05
        cone = (y >= top[None, :]) & (y < hz)
        d = np.where(cone, 0.0, d)
        ink &= ~cone
        ink |= cone & (np.abs(y - top[None, :]) < 0.9)
        npf = P.get("m_puffs", 4)
        for j in range(npf):
            t = (u + j / npf) % 1.0
            px = vx + t * 8 + 2.0 * math.sin(TAU * t + j)
            py = peak - 1 - t * 0.26 * G
            rad = 1.4 + 3.4 * t
            puff = np.hypot(x - px, y - py) < rad
            d = np.where(puff & (y < peak), np.maximum(d, 0.80 * (1 - t) + 0.08), d)
        glow = (np.abs(x - vx) < cr) & (np.abs(y - peak) < 1.0)
        if S(2, u) > -0.2:
            ink |= glow
    elif land == "CITY":
        xx, i = 0, 0
        cols = []
        while xx < G and i < len(P["m_city"]):
            w, h, gap = P["m_city"][i]
            top = int(hz - h * G)
            cols.append((xx, w, top))
            xx += w + gap; i += 1
        lit = P["m_lit"]
        li = 0
        for (x0, w, top) in cols:
            d[top:int(hz), x0:x0 + w] = 0.0
            ink[top:int(hz), x0:x0 + w] = False
            ink[top, x0:min(G, x0 + w)] = True
            for wy in range(top + 2, int(hz) - 1, 3):
                for wxp in range(x0 + 1, min(x0 + w - 1, G), 2):
                    v = lit[li % len(lit)]; li += 1
                    if v < 0.30 or (v > 0.96 and S(1, u, v * 7) > 0):
                        ink[wy, wxp] = True
        tall = min(cols, key=lambda c: c[2])
        ax, at = tall[0] + tall[1] // 2, tall[2]
        ink[max(0, at - 5):at, ax] = True
        if (u * 2) % 1 < 0.5:
            ink[max(0, at - 6), ax] = True
    elif land in ("SEA", "LIGHTHOUSE"):
        d = np.where(y >= hz, 0.10 + 0.10 * ((y - hz) / (G - hz)), d)
        lit = P["m_lit"]
        for row in range(int(hz) + 2, G, 2):
            t = (row - hz) / (G - hz)
            per = int(7 + 16 * t)
            ln = 1 + int(4 * t)
            off = int(lit[row % 400] * per)
            m = ((np.arange(G) + off) % per) < ln
            # most dashes hold still; one in four breathes once per loop (a glint, not a scroll)
            ph = (np.arange(G) + off) // per
            breathe = ((ph + row) % 4 == 0)
            on = np.sin(TAU * (u + lit[(row * 7) % 400] + ph * 0.13)) > -0.2
            ink[row] |= m & (~breathe | on)
        ink[int(hz), :] = True
        gx = bcx
        for row in range(int(hz) + 2, G, 2):
            t = (row - hz) / (G - hz)
            if S(1, u, row * 0.137) > 0.1:
                xx_ = gx + (2 + 4 * t) * S(1, u, row * 0.29)
                ink[row, int(xx_) % G] = True
        if land == "LIGHTHOUSE":
            lx = (0.22 if bcx > G / 2 else 0.78) * G
            base = hz + 2
            H = 0.30 * G
            topy = base - H
            for yy in range(int(topy), int(base)):
                t = (yy - topy) / H
                hw = 1.6 + 2.0 * t
                x0_, x1_ = int(round(lx - hw)), int(round(lx + hw))
                d[yy, x0_:x1_ + 1] = 0.0
                stripe = (int((yy - topy) // 4) % 2 == 0)
                ink[yy, x0_:x1_ + 1] = stripe
                ink[yy, x0_] = True; ink[yy, x1_] = True
            ty = int(topy)
            d[ty - 5:ty, int(lx) - 3:int(lx) + 4] = 0.0
            ink[ty - 5:ty, int(lx) - 3:int(lx) + 4] = False
            ink[ty - 1, int(lx) - 3:int(lx) + 4] = True                 # gallery
            ink[ty - 5:ty - 1, int(lx) - 2] = True; ink[ty - 5:ty - 1, int(lx) + 2] = True
            ink[ty - 4:ty - 2, int(lx) - 1:int(lx) + 2] = True           # the lamp
            ink[ty - 6, int(lx) - 1:int(lx) + 2] = True; ink[ty - 7, int(lx)] = True
            rock = (np.hypot((x - lx) / 2.2, (y - base) * 1.4) < 6) & (y >= hz - 1)
            d = np.where(rock, 0.0, d); ink &= ~rock
            ink |= rock & (y < base + 1) & (np.abs(np.hypot((x - lx) / 2.2, (y - base) * 1.4) - 6) < 0.9)
            ly = ty - 3
            ba = TAU * u
            dirx = math.cos(ba)
            reach = int(0.70 * G * abs(dirx))
            sgn = 1 if dirx >= 0 else -1
            for k in range(3, reach):
                px = int(lx + sgn * k)
                if 0 <= px < G:
                    sp = 0.12 * k
                    for yy in (ly - sp, ly + sp):
                        if 0 <= yy < hz:
                            ink[int(yy), px] = True
                    if k % 2 == 0:
                        lo, hi = int(ly - sp) + 1, int(ly + sp)
                        if hi > lo:
                            d[lo:hi, px] = np.maximum(d[lo:hi, px], 0.45 * (1 - k / (reach + 1)))
    elif land == "DUNES":
        d = np.where(y >= hz, 0.10, d)
        xs = x[0] / G
        ph = P["m_ridge"]
        far = hz - 0.06 * G - 0.05 * G * np.sin(TAU * (xs * 0.9 + ph[0])) - 0.02 * G * np.sin(TAU * (xs * 2.1 + ph[1]))
        near = hz + 0.10 * G - 0.07 * G * np.sin(TAU * (xs * 0.7 + ph[2])) - 0.02 * G * np.sin(TAU * (xs * 1.7 + ph[3]))
        bf = (y >= far[None, :]) & (y < near[None, :])
        d = np.where(bf, 0.34, d)
        ink &= ~bf
        bn = y >= near[None, :]
        d = np.where(bn, 0.0, d)
        ink &= ~bn
        ink |= (np.abs(y - far[None, :]) < 0.55) | (np.abs(y - near[None, :]) < 0.55)
        # a few ripple lines on the near dune, and sand lifting off its crest
        for k in range(1, 4):
            ink |= bn & (np.abs(y - near[None, :] - 4 * k - 1.5 * np.sin(TAU * (xs * 3 + ph[4 + k]))) < 0.5) & (((x + 3 * k) % 7) < 4)
        for j in range(5):
            t = (u + j / 5) % 1.0
            px = (ph[10 + j] * 0.5 + 0.5) * G + t * 14
            if px < G:
                py = near[int(px)] - 1 - 3 * t
                if 0 <= py < G and t < 0.8:
                    ink[int(py), int(px)] = True

    # ---------------------------------------------------------------- weather
    if cloudy and wx != "HURRICANE":
        f = np.zeros((G, G))
        drift = 1.5 * S(1, u)
        for bx, by, br, ph in P["balls"]:
            rad = br * G * (1 + 0.14 * S(1, u, ph)) * (0.85 if (sky and wx != "TORNADO") else 1.0)
            sq = 3.4 if wx == "TORNADO" else 1.6
            sp = 1.9 if wx == "TORNADO" else 1.0
            f += rad ** 2 / ((x - ccx - bx * G * sp - drift) ** 2 + ((y - cy - by * G) * sq) ** 2 + 1)
        cloud = np.clip((f - 0.55) * 1.1, 0, 1)
        d = np.where(cloud > 0, 0.08 + 0.80 * cloud, d)
        ink &= ~(cloud > 0.05)
        bottom = cy + 0.06 * G
        span = hz - bottom
        if wx in ("RAIN", "STORM", "SNOW"):
            for dx, dy, m in P["drops"]:
                yy = bottom + ((dy + m * u) % 1.0) * span
                xx_ = ccx + (dx - 0.5) * G * 0.55
                if wx == "SNOW":
                    xx_ += 1.2 * S(1, u, dx)
                    ink[int(yy) % G, int(xx_) % G] = True
                else:
                    for k in range(3):
                        ink[int(yy - k) % G, int(xx_ - k * 0.5) % G] = True
        if wx == "STORM":
            fl = (u - P["flash"]) % 1.0
            if fl < 0.05 or 0.10 < fl < 0.13:
                bx = ccx
                n = len(P["bolt"])
                for i in range(n):
                    y0 = bottom + span * i / n
                    for j in range(int(span / n) + 1):
                        ink[int(y0 + j) % G, int(bx) % G] = True
                    bx += P["bolt"][i] * 2.5
        if wx == "TORNADO":
            top_, bot = cy + 0.01 * G, hz + 1
            for row in range(int(top_), int(bot)):
                t = (row - top_) / (bot - top_)
                w = (1 - t) ** 2.2 * 0.10 * G + 0.9
                sway = 3.5 * math.sin(TAU * (u + t * 0.6)) * t
                c0 = ccx + sway
                lo, hi = max(0, int(c0 - w)), min(G, int(c0 + w) + 1)
                d[row, lo:hi] = np.maximum(d[row, lo:hi], 0.55 + 0.25 * (1 - t))
                for k in range(2):
                    px = c0 + w * math.cos(TAU * (2 * u) + row * 0.55 + k * math.pi)
                    if 0 <= px < G:
                        ink[row, int(px)] = True
            for j in range(6):
                t = (u * 2 + j / 6) % 1.0
                px = ccx + 3.5 * math.sin(TAU * u) + (6 + 6 * t) * math.cos(TAU * t + j)
                py = hz - 1 - 4 * math.sin(math.pi * t)
                if 0 <= px < G and 0 <= py < G:
                    ink[int(py), int(px)] = True
    if wx == "HURRICANE":
        hx_, hy_ = ccx, cy + 0.04 * G
        dx, dy = x - hx_, (y - hy_) * 1.9
        rr = np.hypot(dx, dy)
        th = np.arctan2(dy, dx)
        Rm = 0.20 * G
        arms = 0.5 + 0.5 * np.cos(2 * (th - 0.22 * rr) + TAU * u * 1.0 / 1.0 * 2 / 2)
        body = np.clip(1 - rr / Rm, 0, 1)
        dens = body ** 0.6 * (0.25 + 0.70 * arms)
        eye = rr < 1.6
        d = np.where((dens > 0.05) & ~eye & (y < hz), np.maximum(d, dens), d)
        d = np.where(eye, 0.0, d)
        ink &= ~((dens > 0.15) & ~eye)
    if wx == "FOG":
        for j in range(4):
            yb = hz - 0.02 * G + (j - 1.2) * 0.055 * G
            ph = P["m_fog"][j]
            amp = 0.5 + 0.5 * np.sin(x / G * TAU * (1 + j % 2) + ph * TAU)
            band = np.exp(-((y - yb) / 2.6) ** 2) * amp
            d = np.maximum(d, band * 0.62)
            ink &= ~(band > 0.45)
            # the bank holds; wisps drift through it, one lap per loop
            for k in range(3):
                x0 = ((ph + k / 3 + u * (1 if j % 2 else -1)) % 1.0) * (G + 12) - 6
                for q in range(6):
                    px = int(x0 + q)
                    if 0 <= px < G and q % 3 != 2:
                        ink[int(yb), px] = True
    elif wx == "WIND":
        for sx, sy, ln in P["m_wind"][:5]:
            yy = int(sy * hz * 0.85) + 2
            x0 = (sx + u) % 1.0 * (G + 20) - 10
            for k in range(ln):
                px = int(x0 + k)
                if 0 <= px < G and yy < hz:
                    ink[yy, px] = (k % 5) != 4
            tail = int(x0) - 3
            if 0 <= tail < G and yy + 1 < hz:
                ink[yy + 1, tail] = True
    elif wx == "MIRAGE":
        band0, band1 = int(hz) - 3, min(G, int(hz) + 9)
        idx = np.where(ink | dith(d), 1, 0).astype(np.uint8)
        for row in range(band0, band1):
            sh = int(round(1.2 * S(1, u, row * 0.37)))
            if sh:
                idx[row] = np.roll(idx[row], sh)
        return idx
    return np.where(ink | dith(d), 1, 0).astype(np.uint8)


def label(P):
    return "%s / %s / %s" % (P["sky"], P["land"], P["weather"])


THIN = [1.0, 0.7, 0.5, 0.35, 0.25, 0.0]   # levels 4 and 5 added Oct 8 for ids 75/77; 0..3 unchanged


def render(addr, sky, land, wx, thin=0, N=40):
    """frames (index arrays at OUT px) and the closure check for one holder's scene. `thin` (0..5) is the
    size ladder: fewer drops, stars, wind streaks, meteors and smoke puffs, nothing else changes.
    Levels 0..3 are exactly the approved ladder; 4 and 5 only ever run when 0..3 do not fit."""
    P = params(sw.seed_of(addr))
    P.update(sky=sky, land=land, weather=wx)
    if thin and thin <= 3:
        k = THIN[thin]
        P["drops"] = P["drops"][:max(6, int(len(P["drops"]) * k))]
        P["stars"] = P["stars"][:max(6, int(len(P["stars"]) * k))]
        P["m_wind"] = P["m_wind"][:max(3, int(len(P["m_wind"]) * k))]
        P["m_meteors"] = P["m_meteors"][:max(2, int(len(P["m_meteors"]) * k))]
        if thin >= 3:
            P["m_puffs"] = 3
            P["m_wind"] = P["m_wind"][:2]
    elif thin == 4:
        P["drops"] = P["drops"][:4]
        P["stars"] = P["stars"][:4]
        P["m_wind"] = P["m_wind"][:2]
        P["m_meteors"] = P["m_meteors"][:2]
        P["m_puffs"] = 3
    elif thin >= 5:
        P["drops"] = P["drops"][:0]
        P["stars"] = P["stars"][:0]
        P["m_wind"] = P["m_wind"][:0]
        P["m_meteors"] = P["m_meteors"][:2]
        P["m_puffs"] = 1
    frames = []
    for j in range(N):
        idx = frame(P, sw.fold(TAU * j / N))
        s = sw.OUT // idx.shape[0]
        frames.append(np.kron(idx, np.ones((s, s), np.uint8)))
    closed = frame(P, 1.0).tobytes() == frame(P, 0.0).tobytes()
    return P, frames, closed
