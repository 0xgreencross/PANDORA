/* ════════════════════════════════════════════════════════════════════════
   INFINITE SCROLL · viewer.js — one post, resolved
   Runs the identical pinned engine (sha-verified against config), the
   identical stream math (STREAMLIB) and the identical card anatomy
   (CARDKIT) as the wall. ?s and ?i address the post; the same address
   always returns the same work.

   Phones cannot show one art pixel per LED, so the card renders at the
   wall's own raster into a backing canvas and is upscaled by an INTEGER
   device-pixel factor with nearest-neighbour sampling. Never fractional,
   never smoothed.

   No spinners, no errors on screen: the art appears as soon as frame 0
   exists and begins to move when the loop is complete.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (window.PANDORA_PUBLIC !== true) {
    console.error('INFINITE SCROLL viewer: PANDORA_PUBLIC is not true; refusing to run');
    return;
  }

  const V = {
    cfg: null, CORE: null, engineText: '', R: 0, postH: 0, artY: 0,
    streamId: 'A', index: 0, pinned: false,
    frames: [], N: 0, pal: null, lut: null, complete: false,
    identity: null, genome: null, seed: 0,
    ctx: null, img: null, u32: null, t0: 0, lastFi: -1,
    likesShown: 0, heart: false, worker: null
  };

  const LE = (function () { const b = new ArrayBuffer(4); new Uint32Array(b)[0] = 1; return new Uint8Array(b)[0] === 1; })();

  async function sha256hex(text) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function randomIndex() {
    const u = new Uint32Array(1); crypto.getRandomValues(u);
    return u[0] % 100000000;
  }

  async function boot() {
    const cfg = await (await fetch('../infinite/config.json', { cache: 'no-store' })).json();
    V.cfg = cfg;
    V.R = cfg.wall.width | 0;
    V.postH = (cfg.chrome.header + cfg.chrome.actions + cfg.chrome.title + cfg.chrome.comment + V.R) | 0;
    V.artY = cfg.chrome.header | 0;

    /* THE LOCK, same as the wall: sha-verified pinned engine */
    const engineName = cfg.engine.file.split('/').pop();
    V.engineText = await (await fetch('../engine/' + engineName, { cache: 'no-store' })).text();
    const got = await sha256hex(V.engineText);
    if (cfg.engine.sha256 && got !== cfg.engine.sha256) {
      console.error('INFINITE SCROLL viewer: engine sha mismatch; refusing to run');
      return;
    }
    V.CORE = window.STREAMLIB.coreEval(V.engineText, V.R, cfg.engine.preludeFW);

    const q = new URLSearchParams(location.search);
    V.streamId = q.get('s') || cfg.stream.id;
    const qi = q.get('i');
    V.pinned = qi != null;
    V.index = V.pinned ? Math.max(0, parseInt(qi, 10) || 0) : randomIndex();
    if (!V.pinned) history.replaceState(null, '', '?s=' + encodeURIComponent(V.streamId) + '&i=' + V.index);

    const cv = document.getElementById('card');
    cv.width = V.R; cv.height = V.postH;
    V.ctx = cv.getContext('2d');
    V.ctx.imageSmoothingEnabled = false;
    V.img = V.ctx.createImageData(V.R, V.R);
    V.u32 = new Uint32Array(V.img.data.buffer);
    fit();
    addEventListener('resize', fit);
    addEventListener('orientationchange', fit);

    /* tap: an unpinned viewer deals another post from the stream */
    if (!V.pinned) cv.addEventListener('click', () => {
      V.index = randomIndex();
      history.replaceState(null, '', '?s=' + encodeURIComponent(V.streamId) + '&i=' + V.index);
      render();
    });

    render();
    requestAnimationFrame(tick);
  }

  /* integer device-pixel upscale; never fractional, never smoothed */
  function fit() {
    const cv = document.getElementById('card');
    const dpr = window.devicePixelRatio || 1;
    const availW = window.innerWidth * dpr, availH = window.innerHeight * dpr;
    const k = Math.max(1, Math.min(Math.floor(availW / V.R), Math.floor(availH / V.postH)));
    cv.style.width = (V.R * k / dpr) + 'px';
    cv.style.height = (V.postH * k / dpr) + 'px';
  }

  function render() {
    if (V.worker) { try { V.worker.terminate(); } catch (e) { } V.worker = null; }
    const cfg = V.cfg;
    V.N = cfg.frames.N;
    V.frames = new Array(V.N); V.pal = null; V.lut = null;
    V.complete = false; V.lastFi = -1; V.heart = false;

    V.seed = window.STREAMLIB.seedOf(V.streamId, V.index);
    V.genome = window.STREAMLIB.genomeOf(V.CORE, V.seed);
    V.identity = window.VOICE.identity(V.seed, V.genome);
    V.likesShown = V.identity.likes.base;
    drawChrome();

    const spec = window.STREAMLIB.jobOf(V.CORE, cfg, V.streamId, V.index, V.N);
    const src = window.STREAMLIB.preludeOf(cfg.engine.preludeFW, V.R, 0) + V.engineText;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const w = V.worker = new Worker(url);
    URL.revokeObjectURL(url);
    w.onmessage = e => {
      const m = e.data;
      if (w !== V.worker) return;
      if (m.t === 'meta') {
        V.pal = m.pal;
        const lut = V.lut = new Uint32Array(256);
        for (let q2 = 0; q2 < 256; q2++) {
          const c = m.pal[q2] || [0, 0, 0];
          lut[q2] = LE ? (((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0)
            : (((c[0] << 24) | (c[1] << 16) | (c[2] << 8) | 255) >>> 0);
        }
        return;
      }
      if (m.t === 'err') { console.error('INFINITE SCROLL viewer: engine err ' + m.msg); w.terminate(); return; }
      if (m.t !== 'pv') return;
      V.frames[m.i] = m.buf;
      if (m.i === 0) { blit(0); V.t0 = performance.now(); }   /* the art appears */
      if (m.i + 1 < V.N) {
        spec.job.__i = m.i + 1;
        w.postMessage({ t: 'job', job: spec.job, step: true });
      } else {
        w.postMessage({ t: 'pause' });
        w.terminate(); if (w === V.worker) V.worker = null;
        V.complete = true; V.t0 = performance.now();          /* it begins to move */
      }
    };
    spec.job.__i = 0;
    w.postMessage({ t: 'job', job: spec.job, step: true });
  }

  function cardO() {
    const ch = V.cfg.chrome;
    return {
      ch: ch, R: V.R, postH: V.postH, artY: V.artY, post: V.index,
      streamId: V.streamId, qrBase: ch.qr.base, qrScale: ch.qr.scalePx,
      identity: V.identity, stops: window.STREAMLIB.schemeOf(V.CORE, V.genome).stops,
      likesShown: V.likesShown, heart: V.heart,
      seed: V.seed, mul32: V.CORE.mulberry32
    };
  }
  function drawChrome() { window.CARDKIT.composeChrome(V.ctx, cardO()); }
  function drawActions() { window.CARDKIT.actionsRow(V.ctx, cardO()); }

  function blit(fi) {
    const f = V.frames[fi];
    if (!f) return;
    const u = V.u32, lut = V.lut, n = V.R * V.R;
    if (!lut) return;
    for (let q2 = 0; q2 < n; q2++) u[q2] = lut[f[q2]];
    V.ctx.putImageData(V.img, 0, V.artY);
    V.lastFi = fi;
  }

  /* playback at the wall's own frame rate; likes tick and the heart
     fills on the same seeded schedule as the wall, refreshes mapped to
     the wall's refresh rate */
  function tick(now) {
    if (V.identity && V.t0) {
      const refs = ((now - V.t0) / 1000) * V.cfg.wall.refreshHz;
      if (V.complete) {
        const fi = (Math.floor((now - V.t0) / (1000 / V.cfg.wall.playFps))) % V.N;
        if (fi !== V.lastFi) blit(fi);
      }
      let dirty = false;
      if (!V.heart && refs >= V.identity.likes.heartAt) { V.heart = true; dirty = true; }
      const shown = V.identity.likes.base + Math.floor(refs / V.identity.likes.tickEvery) + (V.heart ? 1 : 0);
      if (shown !== V.likesShown) { V.likesShown = shown; dirty = true; }
      if (dirty) drawActions();
    }
    requestAnimationFrame(tick);
  }

  window.__VIEWER = V;
  boot().catch(e => { console.error('INFINITE SCROLL viewer boot failed', e); });
})();
