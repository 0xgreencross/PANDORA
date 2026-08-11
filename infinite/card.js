/* ════════════════════════════════════════════════════════════════════════
   INFINITE SCROLL · card.js — THE SHARED CARD
   The post anatomy: bitmap face, heart, avatar, QR, chrome composition.
   Used by the wall (feed.js) and the viewer (/i/) so a post looks the
   same wherever it appears. Extracted verbatim from feed.js @ 5a80e7c.
   Exposes window.CARDKIT.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const FONT = {
    A: [0x0E, 0x11, 0x11, 0x11, 0x1F, 0x11, 0x11], B: [0x1E, 0x11, 0x11, 0x1E, 0x11, 0x11, 0x1E],
    C: [0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E], D: [0x1C, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1C],
    E: [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F], F: [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x10],
    G: [0x0E, 0x11, 0x10, 0x10, 0x13, 0x11, 0x0F], H: [0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
    I: [0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E], J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0C],
    K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11], L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F],
    M: [0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11], N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
    O: [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E], P: [0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10],
    Q: [0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D], R: [0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11],
    S: [0x0F, 0x10, 0x10, 0x0E, 0x01, 0x01, 0x1E], T: [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
    U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E], V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
    W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0A], X: [0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11],
    Y: [0x11, 0x11, 0x0A, 0x04, 0x04, 0x04, 0x04], Z: [0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F],
    '0': [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E], '1': [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
    '2': [0x0E, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1F], '3': [0x1E, 0x01, 0x01, 0x0E, 0x01, 0x01, 0x1E],
    '4': [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02], '5': [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
    '6': [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E], '7': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
    '8': [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E], '9': [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
    ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 0x0C, 0x0C],
    ',': [0, 0, 0, 0, 0, 0x0C, 0x04], "'": [0x0C, 0x04, 0x08, 0, 0, 0, 0],
    '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04], '?': [0x0E, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
    '-': [0, 0, 0, 0x1F, 0, 0, 0], '_': [0, 0, 0, 0, 0, 0, 0x1F],
    ':': [0, 0x0C, 0x0C, 0, 0x0C, 0x0C, 0], '/': [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
    '·': [0, 0, 0x0C, 0x0C, 0, 0, 0], '+': [0, 0x04, 0x04, 0x1F, 0x04, 0x04, 0],
    '=': [0, 0, 0x1F, 0, 0x1F, 0, 0], '@': [0x0E, 0x11, 0x17, 0x15, 0x16, 0x10, 0x0E],
    '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02], ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08]
  };

  function drawText(ctx, text, x, y, scale, color) {
    ctx.fillStyle = color;
    let cx = x;
    const up = String(text).toUpperCase();
    for (const ch of up) {
      const g = FONT[ch] || FONT[' '];
      for (let r = 0; r < 7; r++) {
        const row = g[r];
        for (let c = 0; c < 5; c++) if (row & (16 >> c))
          ctx.fillRect(cx + c * scale, y + r * scale, scale, scale);
      }
      cx += 6 * scale;
    }
    return cx - x;
  }
  const textW = (t, s) => String(t).length * 6 * s - s;

  /* heart, 11 wide x 9 tall mask, scaled x2 into its 22 box */
  const HEART = ['01110001110', '11111011111', '11111111111', '11111111111',
    '01111111110', '00111111100', '00011111000', '00000100000', '00000000000'];
  function drawHeart(ctx, x, y, filled, color) {
    const s = 2;
    for (let r = 0; r < HEART.length; r++) for (let c = 0; c < 11; c++) {
      if (HEART[r][c] !== '1') continue;
      const edge = r === 0 || r === HEART.length - 1 ||
        (HEART[r - 1] && HEART[r - 1][c] !== '1') || (HEART[r + 1] && HEART[r + 1][c] !== '1') ||
        HEART[r][c - 1] !== '1' || HEART[r][c + 1] !== '1';
      if (filled || edge) { ctx.fillStyle = color; ctx.fillRect(x + c * s, y + 2 + r * s, s, s); }
    }
  }

  /* avatar: 5x5 mirrored identicon from the address seed, palette colors */
  function avatarInto(ctx, x, y, size, seed, stops, mul32) {
    const r = mul32((seed ^ 0x00A7A7) >>> 0);
    const c1 = stops[Math.min(stops.length - 1, 2 + ((r() * (stops.length - 2)) | 0))];
    const c0 = stops[1] || stops[0];
    const cell = Math.floor(size / 5);
    const pad = Math.floor((size - cell * 5) / 2);
    ctx.fillStyle = c0; ctx.fillRect(x, y, size, size);
    ctx.fillStyle = c1;
    for (let col = 0; col < 3; col++) for (let row = 0; row < 5; row++) {
      if (r() < 0.5) continue;
      ctx.fillRect(x + pad + col * cell, y + pad + row * cell, cell, cell);
      ctx.fillRect(x + pad + (4 - col) * cell, y + pad + row * cell, cell, cell);
    }
  }

  /* ── QR · version 3 (29 modules), byte mode, EC level L, best mask ──── */
  const QR = (function () {
    const GF_EXP = new Uint8Array(512), GF_LOG = new Uint8Array(256);
    (function () {
      let x = 1;
      for (let i = 0; i < 255; i++) { GF_EXP[i] = x; GF_LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
      for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
    })();
    const gmul = (a, b) => (a && b) ? GF_EXP[GF_LOG[a] + GF_LOG[b]] : 0;
    function rs(data, n) {
      let gen = [1];
      for (let i = 0; i < n; i++) {
        const next = new Array(gen.length + 1).fill(0);
        for (let j = 0; j < gen.length; j++) {
          next[j] ^= gmul(gen[j], GF_EXP[i]);
          next[j + 1] ^= gen[j];
        }
        gen = next;
      }
      gen.reverse();                      /* highest degree first */
      const res = data.concat(new Array(n).fill(0));
      for (let i = 0; i < data.length; i++) {
        const f = res[i];
        if (!f) continue;
        for (let j = 0; j < gen.length; j++) res[i + j] ^= gmul(gen[j], f);
      }
      return res.slice(data.length);
    }
    const SZ = 29, DATA_CW = 55, EC_CW = 15;
    const FMT_L = [0x77C4, 0x72F3, 0x7DAA, 0x789D, 0x662F, 0x6318, 0x6C41, 0x6976];
    function build(text) {
      const bytes = [...new TextEncoder().encode(text)];
      if (bytes.length > 53) return null;
      const bits = [];
      const push = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
      push(4, 4); push(bytes.length, 8);
      for (const b of bytes) push(b, 8);
      push(0, Math.min(4, DATA_CW * 8 - bits.length));
      while (bits.length % 8) bits.push(0);
      const data = [];
      for (let i = 0; i < bits.length; i += 8) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; data.push(v); }
      const PADS = [0xEC, 0x11];
      let p = 0; while (data.length < DATA_CW) data.push(PADS[(p++) & 1]);
      const cw = data.concat(rs(data, EC_CW));

      const M = [], F = [];                /* module value, function-pattern flag */
      for (let i = 0; i < SZ; i++) { M.push(new Uint8Array(SZ)); F.push(new Uint8Array(SZ)); }
      const setF = (r, c, v) => { if (r >= 0 && r < SZ && c >= 0 && c < SZ) { M[r][c] = v; F[r][c] = 1; } };
      const finder = (r0, c0) => {
        for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
          const rr = r0 + r, cc = c0 + c;
          if (rr < 0 || rr >= SZ || cc < 0 || cc >= SZ) continue;
          const inF = r >= 0 && r <= 6 && c >= 0 && c <= 6;
          const on = inF && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
          setF(rr, cc, on ? 1 : 0);
        }
      };
      finder(0, 0); finder(0, SZ - 7); finder(SZ - 7, 0);
      for (let i = 8; i < SZ - 8; i++) { setF(6, i, i % 2 === 0 ? 1 : 0); setF(i, 6, i % 2 === 0 ? 1 : 0); }
      for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++)     /* alignment @ (22,22) */
        setF(22 + r, 22 + c, (Math.max(Math.abs(r), Math.abs(c)) !== 1) ? 1 : 0);
      setF(SZ - 8, 8, 1);                  /* dark module */
      /* reserve format areas */
      for (let i = 0; i <= 8; i++) { if (i !== 6) { F[8][i] = 1; F[i][8] = 1; } }
      for (let i = 0; i < 8; i++) { F[8][SZ - 1 - i] = 1; F[SZ - 1 - i][8] = 1; }
      F[8][8] = 1;

      /* zigzag data placement */
      let bi = 0;
      const allBits = [];
      for (const b of cw) for (let i = 7; i >= 0; i--) allBits.push((b >> i) & 1);
      let col = SZ - 1, up = true;
      while (col > 0) {
        if (col === 6) col--;
        for (let k = 0; k < SZ; k++) {
          const r = up ? SZ - 1 - k : k;
          for (const c of [col, col - 1]) {
            if (F[r][c]) continue;
            M[r][c] = bi < allBits.length ? allBits[bi++] : 0;
          }
        }
        col -= 2; up = !up;
      }

      /* mask selection by full penalty */
      const MASKS = [
        (r, c) => (r + c) % 2 === 0, (r, c) => r % 2 === 0, (r, c) => c % 3 === 0,
        (r, c) => (r + c) % 3 === 0, (r, c) => (((r / 2) | 0) + ((c / 3) | 0)) % 2 === 0,
        (r, c) => (r * c) % 2 + (r * c) % 3 === 0, (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
        (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0
      ];
      function penalty(G) {
        let p = 0;
        for (let pass = 0; pass < 2; pass++) {
          for (let r = 0; r < SZ; r++) {
            let run = 1;
            for (let c = 1; c <= SZ; c++) {
              const cur = c < SZ ? (pass ? G[c][r] : G[r][c]) : 2;
              const prev = pass ? G[c - 1][r] : G[r][c - 1];
              if (c < SZ && cur === prev) run++;
              else { if (run >= 5) p += 3 + (run - 5); run = 1; }
            }
          }
        }
        for (let r = 0; r < SZ - 1; r++) for (let c = 0; c < SZ - 1; c++)
          if (G[r][c] === G[r][c + 1] && G[r][c] === G[r + 1][c] && G[r][c] === G[r + 1][c + 1]) p += 3;
        const P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
        for (let pass = 0; pass < 2; pass++) for (let r = 0; r < SZ; r++) for (let c = 0; c <= SZ - 11; c++) {
          let m1 = true, m2 = true;
          for (let k = 0; k < 11; k++) {
            const v = pass ? G[c + k][r] : G[r][c + k];
            if (v !== P1[k]) m1 = false; if (v !== P2[k]) m2 = false;
          }
          if (m1) p += 40; if (m2) p += 40;
        }
        let dark = 0;
        for (let r = 0; r < SZ; r++) for (let c = 0; c < SZ; c++) dark += G[r][c];
        p += 10 * Math.floor(Math.abs(dark * 100 / (SZ * SZ) - 50) / 5);
        return p;
      }
      let best = null, bestP = Infinity, bestMask = 0;
      for (let mk = 0; mk < 8; mk++) {
        const G = M.map(row => row.slice());
        for (let r = 0; r < SZ; r++) for (let c = 0; c < SZ; c++)
          if (!F[r][c] && MASKS[mk](r, c)) G[r][c] ^= 1;
        const fmt = FMT_L[mk];
        const fb = i => (fmt >> (14 - i)) & 1;
        for (let i = 0; i < 6; i++) G[8][i] = fb(i);
        G[8][7] = fb(6); G[8][8] = fb(7); G[7][8] = fb(8);
        for (let i = 9; i < 15; i++) G[14 - i][8] = fb(i);
        for (let i = 0; i < 7; i++) G[SZ - 1 - i][8] = fb(i);
        for (let i = 7; i < 15; i++) G[8][SZ - 15 + i] = fb(i);
        G[SZ - 8][8] = 1;
        const p = penalty(G);
        if (p < bestP) { bestP = p; best = G; bestMask = mk; }
      }
      return { size: SZ, grid: best, mask: bestMask };
    }
    return { build: build };
  })();

  /* Standard polarity with the wall-verified white apron (the form the
     2026-08-05 scan test proved to 2.5m): a quiet tile 2 modules wider on
     every side, black modules on it. Vertically the tile starts at the
     actions row top and rides 3px into the black gap above the title
     glyphs (they begin 6px lower); the 29² code itself sits right-aligned
     at the chrome inset, per the layout. */
  function drawQR(ctx, x, rowY, text, sPx) {
    const q = QR.build(text);
    if (!q) return;
    const s = sPx, n = q.size * s;
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 2 * s, rowY, n + 4 * s, n + 4 * s);
    ctx.fillStyle = '#000';
    for (let r = 0; r < q.size; r++) for (let c = 0; c < q.size; c++)
      if (q.grid[r][c]) ctx.fillRect(x + c * s, rowY + 2 * s + r * s, s, s);
  }

  /* full chrome pass for one card; o = { ch, R, postH, artY, post,
     streamId, qrBase, qrScale, identity, stops, likesShown, heart,
     seed, mul32 } */
  function composeChrome(ctx, o) {
    const ch = o.ch;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, o.R, o.postH);
    avatarInto(ctx, ch.inset, ((ch.header - ch.avatar) / 2) | 0, ch.avatar, o.seed, o.stops, o.mul32);
    drawText(ctx, '@' + o.identity.handle, ch.inset + ch.avatar + 6, ((ch.header - 14) / 2) | 0, 2, '#e8e8e8');
    actionsRow(ctx, o);
    const tY = ch.header + o.R + ch.actions;
    drawText(ctx, o.identity.title, ch.inset, tY + (((ch.title - 14) / 2) | 0), 2, '#ffffff');
    const cY = tY + ch.title;
    drawText(ctx, o.identity.comment, ch.inset, cY + (((ch.comment - 7) / 2) | 0), 1, '#9a9aa6');
  }

  /* the actions row alone (likes tick redraws only this) */
  function actionsRow(ctx, o) {
    const ch = o.ch;
    const aY = ch.header + o.R;
    ctx.fillStyle = '#000'; ctx.fillRect(0, aY, o.R, ch.actions);
    drawHeart(ctx, ch.inset, aY + (((ch.actions - ch.heart) / 2) | 0), o.heart, o.heart ? '#ff1f9c' : '#e8e8e8');
    const likeTxt = String(o.likesShown).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    drawText(ctx, likeTxt, ch.inset + ch.heart + 6, aY + (((ch.actions - 14) / 2) | 0), 2, '#e8e8e8');
    if (ch.qr.enabled) {
      const qs = ch.qr.modules * o.qrScale;
      drawQR(ctx, o.R - ch.inset - qs, aY, o.qrBase + '/?s=' + o.streamId + '&i=' + o.post, o.qrScale);
    }
  }

  window.CARDKIT = {
    FONT, drawText, textW, drawHeart, avatarInto, QR, drawQR,
    composeChrome, actionsRow
  };
})();
