/* ════════════════════════════════════════════════════════════════════════
   INFINITE SCROLL · stream.js — THE SHARED STREAM
   The deterministic spine, factored out so the wall (feed.js) and the
   viewer (/i/) run the SAME address math, the SAME genome roller, the
   SAME worker source. Any change here changes both; they cannot drift.
   Extracted verbatim from feed.js @ 5a80e7c; only closures became
   parameters. Exposes window.STREAMLIB.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function seedOf(streamId, i) {
    const s = streamId + ':' + i;
    let h = 0x811C9DC5;
    for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }

  function fieldOf(r) {
    return {
      sw: Math.max(160, Math.min(448, r)),
      vg: Math.max(56, Math.min(88, Math.round(88 * Math.min(1, r / 448))))
    };
  }

  function preludeOf(FW, R, outd) {
    const F = fieldOf(R);
    return '"use strict";const W=' + R + ',H=' + R + ',FW=' + FW +
      ',PVSW=' + F.sw + ',PVVG=' + F.vg + ',OUTD=' + (outd | 0) +
      ';const TAU=6.283185307179586;\n';
  }

  /* evaluate the CORE slice of the pinned engine on the main thread to
     borrow its constants and scheme builders for job construction */
  function coreEval(engineText, R, FW) {
    const F = fieldOf(R);
    const coreOnly = engineText.slice(0, engineText.indexOf('/*CORE2-BEGIN*/'));
    return new Function('W', 'H', 'FW', 'PVSW', 'PVVG', 'OUTD', 'TAU',
      coreOnly + '\nreturn {SCHEMES:SCHEMES,SCHEME_KEYS:SCHEME_KEYS,MODES:MODES,' +
      'mulberry32:mulberry32,genesisScheme:genesisScheme,tisScheme:tisScheme};')(
      R, R, FW, F.sw, F.vg, 0, 6.283185307179586);
  }

  const CARD_CH = ['chroma', 'tracking', 'pixelsort', 'grain', 'blocks', 'scanlines', 'echo',
    'wave', 'slice', 'vroll', 'mosh', 'ghost', 'melt', 'bleed', 'invert', 'crush', 'dropout',
    'chrono', 'mirror', 'flay', 'autoph', 'weave', 'entropy', 'meta', 'tect',
    'panes', 'hilb', 'splice', 'moire', 'braid', 'lungs',
    'tunnel', 'kaleido', 'bloom', 'embers', 'runes', 'chimera'];
  const FX_FAV = new Set(['embers', 'bloom', 'panes', 'melt', 'ghost', 'invert', 'lungs', 'runes', 'meta', 'entropy', 'chimera', 'kaleido', 'hilb', 'tunnel', 'chrono']);
  const FX_PILL = new Set(['chroma', 'tracking', 'pixelsort', 'grain', 'blocks', 'scanlines', 'echo']);
  const GEN_MODE_W = [['MASS', 18], ['IDOL', 14], ['SEDIMENT', 11], ['VEINED', 10], ['LATHE', 9], ['BROADCAST', 9], ['MOLTEN', 8], ['ENGRAVED', 8], ['GRID', 7], ['SATELLITE', 6]];
  const GEN_SCHEME_W = [['GENESIS', 18], ['POLE', 9], ['POISONFROG', 9], ['AIRNEON', 8], ['DES', 8], ['FAUXRGB', 6], ['TISGEN', 6], ['BONE', 4]];
  const OV0 = { maskType: 0, maskStyle: 0, cx: 16, cy: 16, size: 16, n: 0, form: 0 };

  function wpick(R, pairs) {
    let t = 0; for (const q of pairs) t += q[1];
    let r = R() * t;
    for (const q of pairs) { r -= q[1]; if (r <= 0) return q[0]; }
    return pairs[0][0];
  }
  function rollFx2(R, pill, fav, oth, rad) {
    const fx = {};
    for (const k of CARD_CH)
      fx[k] = rad ? R() < 0.30 : FX_PILL.has(k) ? R() < pill : R() < (FX_FAV.has(k) ? fav : oth);
    return fx;
  }

  function genomeOf(CORE, seed) {
    const R = CORE.mulberry32((seed ^ 0x0D17E5C0) >>> 0);
    const canon = R() < 0.60;
    let mode = canon ? wpick(R, GEN_MODE_W) : CORE.MODES[(R() * CORE.MODES.length) | 0];
    let engineSeed = seed >>> 0;
    if (mode === 'MASS' && R() < 0.60) {           /* the strata/drape steer */
      for (let t2 = 0; t2 < 12; t2++) {
        const f2 = (CORE.mulberry32((engineSeed ^ 0x14CE55) >>> 0)() * 64) | 0;
        if (((f2 >> 3) === 5) || ((f2 >> 3) === 7)) break;
        engineSeed = (R() * 0xFFFFFFFF) >>> 0;
      }
    }
    const ss = Object.keys(CORE.SCHEMES);
    const schemeKey = canon && R() < 0.48 ? wpick(R, GEN_SCHEME_W) : ss[(R() * ss.length) | 0];
    return {
      seed: engineSeed, mode: mode, schemeKey: schemeKey,
      corr: canon ? 45 + ((R() * 30) | 0) : 20 + ((R() * 81) | 0),
      voidamt: canon ? 38 + ((R() * 21) | 0) : (R() * 80) | 0,
      locality: canon ? 45 + ((R() * 51) | 0) : (R() * 101) | 0,
      chromacap: R() < (canon ? 0.12 : 0.25) ? 1 : 0,
      fx: canon ? rollFx2(R, 0.88, 0.30, 0.08, false) : rollFx2(R, 0.70, 0.22, 0.22, R() < 0.20),
      canon: canon
    };
  }

  function schemeOf(CORE, g) {
    if (g.schemeKey === 'GENESIS') return CORE.genesisScheme(g.seed);
    if (g.schemeKey === 'TISGEN') return CORE.tisScheme(g.seed);
    return CORE.SCHEMES[g.schemeKey];
  }

  function jobOf(CORE, cfg, streamId, i, N) {
    const seed = seedOf(streamId, i);
    const g = genomeOf(CORE, seed);
    const sch = schemeOf(CORE, g);
    return {
      index: i, addrSeed: seed, genome: g,
      job: {
        seed: g.seed, mode: g.mode, voidamt: g.voidamt, locality: g.locality,
        chromacap: g.chromacap, scheme: { stops: sch.stops, glitch: sch.glitch },
        corr: g.corr, N: N, fx: Object.assign({}, g.fx), ov: Object.assign({}, OV0),
        epoch: 0, wb: {
          fam: cfg.wb.fam, prim: cfg.wb.prim, cam: cfg.wb.cam,
          mod: cfg.wb.mod, gain: Object.assign({}, cfg.wb.gain)
        }, gr: null
      }
    };
  }


  /* ── DNA CARD PACKER ──────────────────────────────────────────────────
     A pure port of the public app's packCard() (root index.html): the
     bridge from a stream address to the app's own resurrection door.
     The wall genome always has no override and epoch 0, so cards come
     out v2, or v5 when forked (voidamt/locality/chromacap/MASS), exactly
     as the app itself would pack them. Round-tripped against the root's
     unpackCard in the gate. */
  const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function crc8(bytes) {
    let c = 0;
    for (const b of bytes) { c ^= b; for (let i = 0; i < 8; i++) c = (c & 0x80) ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff; }
    return c;
  }
  function packCardOf(CORE, g, frames) {
    const CARD_SCHEMES = [...CORE.SCHEME_KEYS.slice(0, 14), 'GENESIS', ...CORE.SCHEME_KEYS.slice(14), 'TISGEN'];
    const si = CARD_SCHEMES.indexOf(g.schemeKey), mi = CORE.MODES.indexOf(g.mode);
    if (si < 0 || mi < 0) return '';
    const forked = (g.voidamt | 0) > 0 || (g.locality | 0) > 0 || (g.chromacap | 0) === 1 || g.mode === 'MASS';
    let v = 0n;
    const push = (val, bits) => { v = (v << BigInt(bits)) | (BigInt(val) & ((1n << BigInt(bits)) - 1n)); };
    push(forked ? 5 : 2, 4);
    push(g.seed >>> 0, 32); push(si, 5); push(mi, 4); push(g.corr, 7); push(frames, 7); push(0, 2);
    for (const ch of CARD_CH) push(g.fx[ch] ? 1 : 0, 1);
    let nBytes = 13, pad = 6n;
    if (forked) {
      push(0, 5); push(0, 5); push(16, 5); push(16, 5); push(16, 5); push(0, 6); push(0, 5);
      push(0, 1);
      push(Math.min(100, g.voidamt | 0), 7);
      push(g.chromacap ? 1 : 0, 1);
      push(Math.min(100, g.locality | 0), 7);
      nBytes = 19; pad = 2n;
    }
    v <<= pad;
    const bytes = [];
    for (let i = nBytes - 1; i >= 0; i--) bytes[nBytes - 1 - i] = Number((v >> BigInt(i * 8)) & 0xffn);
    bytes.push(crc8(bytes));
    let bv = 0n; for (const b of bytes) bv = (bv << 8n) | BigInt(b);
    const nChars = Math.ceil(bytes.length * 8 / 5);
    bv <<= BigInt(nChars * 5 - bytes.length * 8);
    let out = '';
    for (let i = nChars - 1; i >= 0; i--) out += B32[Number((bv >> BigInt(i * 5)) & 31n)];
    let grp = ''; for (let i = 0; i < out.length; i += 4) grp += (i ? '-' : '') + out.slice(i, i + 4);
    return 'PNDR-' + grp;
  }

  window.STREAMLIB = {
    seedOf, fieldOf, preludeOf, coreEval,
    CARD_CH, OV0, GEN_MODE_W, GEN_SCHEME_W,
    genomeOf, schemeOf, jobOf, packCardOf
  };
})();
