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

  window.STREAMLIB = {
    seedOf, fieldOf, preludeOf, coreEval,
    CARD_CH, OV0, GEN_MODE_W, GEN_SCHEME_W,
    genomeOf, schemeOf, jobOf
  };
})();
