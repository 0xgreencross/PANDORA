/* ════════════════════════════════════════════════════════════════════════
   INFINITE SCROLL · feed.js
   A faux social feed on an outdoor LED wall. Every post is a DITHERVOID
   loop generated live by the pinned engine (engine/core.d682012.js),
   full bleed, 1:1, one art pixel one LED. It scrolls itself with a human
   swipe and stop rhythm, forever, in silence.

   LAWS HONORED HERE
   · R = wall width, read from config.json at boot, ONCE. Never governed.
   · Art draws at R x R, 1:1, full bleed. Nothing scales, ever.
   · THE FRAME CLOCK LAW: the choreography counts refreshes. Nothing in
     the CHOREOGRAPHY section reads any wall clock.
   · translateY at integer pixel offsets only.
   · PANDORA_PUBLIC = true. Unwitnessed rolls never train the canon.
   · The wall never shows an empty card, a spinner, or an error.
   · No literal wall numbers in this file: everything derives from config.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ═══ 0 · BOOT ═════════════════════════════════════════════════════════ */

  if (window.PANDORA_PUBLIC !== true) {
    /* the guard is set by index.html before any script; a missing guard is
       a broken install and the wall shows nothing rather than something */
    console.error('INFINITE SCROLL: PANDORA_PUBLIC is not true; refusing to run');
    return;
  }
  if (window.devicePixelRatio !== 1) {
    console.error('INFINITE SCROLL: devicePixelRatio=' + window.devicePixelRatio +
      ' (need 1, native mode, --force-device-scale-factor=1); refusing to run');
    return;
  }

  const S = {                    /* the one shared state object */
    cfg: null, R: 0, wallH: 0, postH: 0, artY: 0, frameDiv: 0,
    engineText: '', CORE: null, started: false
  };

  async function sha256hex(text) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function boot() {
    const cfg = await (await fetch('config.json', { cache: 'no-store' })).json();
    S.cfg = cfg;

    /* R IS THE WALL WIDTH. Set once, from config, at boot. */
    S.R = cfg.wall.width | 0;
    S.wallH = cfg.wall.height | 0;
    S.postH = (cfg.chrome.header + cfg.chrome.actions + cfg.chrome.title + cfg.chrome.comment + S.R) | 0;
    S.artY = cfg.chrome.header | 0;
    S.frameDiv = Math.round(cfg.wall.refreshHz / cfg.wall.playFps);
    if (S.frameDiv * cfg.wall.playFps !== cfg.wall.refreshHz) {
      console.error('INFINITE SCROLL: playback fps must divide refresh exactly'); return;
    }

    /* THE LOCK: fetch the sha'd engine, verify the sha, never look back */
    S.engineText = await (await fetch(cfg.engine.file, { cache: 'no-store' })).text();
    const got = await sha256hex(S.engineText);
    if (cfg.engine.sha256 && got !== cfg.engine.sha256) {
      console.error('INFINITE SCROLL: engine sha mismatch ' + got + ' != ' + cfg.engine.sha256 + '; refusing to run');
      return;
    }

    /* evaluate the CORE slice on the main thread once, to borrow the pinned
       engine's own constants and scheme builders for job construction; the
       prelude mirrors the worker's, so the mathematics is the same object */
    S.CORE = window.STREAMLIB.coreEval(S.engineText, S.R, cfg.engine.preludeFW);
    for (const k of GEN_SCHEME_W.map(p => p[0]))
      if (k !== 'GENESIS' && k !== 'TISGEN' && !S.CORE.SCHEMES[k])
        console.error('INFINITE SCROLL: canon scheme ' + k + ' missing from engine');

    const q = new URLSearchParams(location.search);
    STREAM.id = q.get('s') || cfg.stream.id;
    /* ?i= pins the entry point (QR resolution, reload-at-position).
       Without it, every boot enters the infinite stream at a random
       index: the run is always fresh, while every post keeps its
       permanent deterministic address. Boot-time randomness only —
       the choreography still counts refreshes, and each beat's plan
       is keyed to its post index. */
    const qi = q.get('i');
    if (qi != null) STREAM.start = Math.max(0, parseInt(qi, 10) || 0);
    else {
      const u = new Uint32Array(1); crypto.getRandomValues(u);
      STREAM.start = u[0] % 100000000;
    }
    CH.post = STREAM.start;
    CH.origin = STREAM.start;   /* coordinates start at zero, whatever the index */
    CH.base = 0;
    CH.y = 0;

    /* the flick generator must reproduce the spec's baked table exactly */
    const specSum = FLICK_SPEC.reduce((a, b) => a + b, 0);
    const gen = flickTable(specSum, FLICK_SPEC.length);
    if (gen.join(',') !== FLICK_SPEC.join(','))
      console.error('INFINITE SCROLL: flick generator disagrees with the baked table');

    buildStage();
    applyY();
    FARM.spawn();
    PLAYER.start();
    MAINT.start();
    S.started = true;
  }

  /* ═══ 1 · DETERMINISM ══════════════════════════════════════════════════
     seed_i = fnv1a32(streamId ':' i). Every post has a permanent address;
     the QR needs only ?s=<stream>&i=<index>.                              */

  const STREAM = { id: 'A', start: 0 };

  const seedOf = (sid, i) => window.STREAMLIB.seedOf(sid, i);

  /* the engine's own rasterField(field:true) formula, mirrored for the
     worker prelude; the byte-identity gate proves the mirror is exact */
  const fieldOf = r => window.STREAMLIB.fieldOf(r);
  function preludeOf(R, outd) { return window.STREAMLIB.preludeOf(S.cfg.engine.preludeFW, R, outd); }

  function workerSrc() { return preludeOf(S.R, 0) + S.engineText; }

  /* ═══ 2 · GENOME ═══════════════════════════════════════════════════════
     A deterministic port of machineRoll()@d682012 (workbench line ~6880),
     free-roll path (no PIN, no ORACLE_CANON so the BREED arm is dormant,
     exactly as machineRoll itself behaves when ORACLE_CANON is undefined).
     Math.random is replaced by the stream RNG so that seed -> genome is
     permanent. Weights, bands and channel lists are copied verbatim.     */

  /* shared with the viewer: window.STREAMLIB (infinite/stream.js) holds
     the genome roller, weights and job builder — one source, no drift */
  const OV0 = window.STREAMLIB.OV0;
  const GEN_SCHEME_W = window.STREAMLIB.GEN_SCHEME_W;
  function genomeOf(seed) { return window.STREAMLIB.genomeOf(S.CORE, seed); }
  function schemeOf(g) { return window.STREAMLIB.schemeOf(S.CORE, g); }
  function jobOf(i, N) { return window.STREAMLIB.jobOf(S.CORE, S.cfg, STREAM.id, i, N); }

  /* ═══ 3 · THE FARM ═════════════════════════════════════════════════════
     Worker pool from the sliced engine, driven through the driver's own
     truth pass exactly as the workbench drives it (__i names each frame,
     each pv is answered with the next step job; one frame in flight is
     the backpressure). The transferable-buffer economy of wbPvSpawn's
     ack rides the job message itself: the driver FREE-pools any buffer a
     job carries, so every received frame is paid for with a recycled
     one. Zero per-frame allocation at steady state, no wall clock.      */

  const LE = (function () { const b = new ArrayBuffer(4); new Uint32Array(b)[0] = 1; return new Uint8Array(b)[0] === 1; })();

  const FARM = {
    slots: [], nextIndex: 0, ready: new Map(), bad: new Set(), requeue: [],
    pool: [], N: 0, loopsDone: 0, msLog: [], lastDoneRef: 0,
    spawn() {
      this.N = S.cfg.frames.N;
      this.nextIndex = STREAM.start;
      /* config wins: browsers with fingerprint shields lie about
         hardwareConcurrency and would silently shrink the farm */
      const n = (S.cfg.farm && S.cfg.farm.workers) ? (S.cfg.farm.workers | 0)
        : Math.max(1, (navigator.hardwareConcurrency || 4) - 2);
      for (let k = 0; k < n; k++) this.slots.push(this.mkSlot(k));
      this.fill();
    },
    mkSlot(id) {
      const slot = { id: id, w: null, cur: null, loops: 0 };
      this.hire(slot);
      return slot;
    },
    hire(slot) {
      if (slot.w) { try { slot.w.terminate(); } catch (e) { } }
      const url = URL.createObjectURL(new Blob([workerSrc()], { type: 'text/javascript' }));
      slot.w = new Worker(url);
      URL.revokeObjectURL(url);
      slot.w.onmessage = e => this.onmsg(slot, e.data);
      slot.w.onerror = e => { GOV.log('worker-onerror slot ' + slot.id); this.fail(slot, true); };
    },
    takeBuf() { return this.pool.pop() || new Uint8Array(S.R * S.R); },
    onmsg(slot, m) {
      const cur = slot.cur;
      if (!cur) return;
      if (m.t === 'meta') { cur.pal = m.pal; cur.mode = m.mode; return; }
      if (m.t === 'err') { GOV.log('engine err i=' + cur.index + ' ' + m.msg); this.fail(slot); return; }
      if (m.t !== 'pv') return;
      cur.frames[m.i] = m.buf;                    /* keep the transferred buffer */
      cur.ms += m.ms;
      const next = m.i + 1;
      if (next < cur.N) {
        cur.job.job.__i = next;
        const back = this.takeBuf();              /* pay with a recycled buffer */
        slot.w.postMessage({ t: 'job', job: cur.job.job, step: true, buf: back.buffer }, [back.buffer]);
      } else {
        slot.w.postMessage({ t: 'pause' });
        this.finish(slot);
      }
    },
    finish(slot) {
      const cur = slot.cur; slot.cur = null;
      slot.loops++; this.loopsDone++; this.lastDoneRef = CH.ref;
      this.msLog.push(cur.ms); if (this.msLog.length > 400) this.msLog.shift();
      const lut = new Uint32Array(256);
      for (let q = 0; q < 256; q++) {
        const c = cur.pal[q] || [0, 0, 0];
        lut[q] = LE ? (((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0)
          : (((c[0] << 24) | (c[1] << 16) | (c[2] << 8) | 255) >>> 0);
      }
      this.ready.set(cur.index, {
        index: cur.index, addrSeed: cur.addrSeed, genome: cur.genome,
        frames: cur.frames, N: cur.N, pal: cur.pal, lut: lut, mode: cur.mode,
        ms: cur.ms, live: true
      });
      if (slot.loops >= S.cfg.maintenance.workerRecycleLoops) {
        slot.loops = 0; this.hire(slot); GOV.log('worker recycled slot ' + slot.id);
      }
      this.fill();
    },
    fail(slot, transient) {
      const cur = slot.cur; slot.cur = null;
      if (cur) {
        if (transient) this.requeue.push(cur.index);   /* lost, not cursed */
        else this.bad.add(cur.index);                  /* deterministic engine err */
      }
      this.hire(slot);
      this.fill();
    },
    fill() {
      if (!S.started && !S.cfg) return;
      const ahead = S.cfg.queue.ahead;
      for (const slot of this.slots) {
        if (slot.cur) continue;
        if (this.ready.size + this.slots.filter(s => s.cur).length >= ahead) break;
        const i = this.requeue.length ? this.requeue.shift() : this.nextIndex++;
        const spec = jobOf(i, this.N);
        slot.cur = {
          index: i, addrSeed: spec.addrSeed, genome: spec.genome, job: spec,
          frames: new Array(this.N), N: this.N, pal: null, mode: '', ms: 0
        };
        spec.job.__i = 0;
        const prime = this.takeBuf();
        slot.w.postMessage({ t: 'job', job: spec.job, step: true, buf: prime.buffer }, [prime.buffer]);
      }
    },
    /* a card asks for post i: live queue first; if the farm is already on
       it, wait; only a loop the farm does not have coming pulls from the
       reservoir, silently */
    async claim(i) {
      if (this.ready.has(i)) { const l = this.ready.get(i); this.ready.delete(i); this.fill(); return l; }
      if (this.slots.some(s => s.cur && s.cur.index === i) || this.requeue.includes(i)) return null;
      if (RESERVOIR.missAt.has(i) && CH.ref - RESERVOIR.missAt.get(i) < 120) return null;
      const r = await RESERVOIR.pull(i);
      if (r) { GOV.log('reservoir served i=' + i); return r; }
      RESERVOIR.missAt.set(i, CH.ref);
      return null;
    },
    free(loop) {
      if (!loop || !loop.frames) return;
      for (const f of loop.frames) if (f) this.pool.push(f);
      loop.frames = null;                          /* null the buffers explicitly */
      if (this.pool.length > 24 * (S.cfg ? S.cfg.frames.N : 60)) this.pool.length = 12 * S.cfg.frames.N;
    },
    depth() { return this.ready.size; },
    hasOrWill(i) { return this.ready.has(i) || this.slots.some(s => s.cur && s.cur.index === i); }
  };

  /* ═══ 4 · THE RESERVOIR ════════════════════════════════════════════════
     Lives on the laptop at a gitignored path; format ISRV1: magic, ver,
     u32 N, u32 R, 768B palette, N*R*R index frames, gzipped. It is
     regenerable from the stream at any time. Misses are silent: the
     choreography's dwell-extension guard is the real never-empty law.   */

  const RESERVOIR = {
    missAt: new Map(),
    async pull(i) {
      try {
        const res = await fetch(S.cfg.reservoir.base + STREAM.id + '/' + i + '.bin', { cache: 'no-store' });
        if (!res.ok || typeof DecompressionStream === 'undefined') return null;
        const ds = res.body.pipeThrough(new DecompressionStream('gzip'));
        const buf = new Uint8Array(await new Response(ds).arrayBuffer());
        if (String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) !== 'ISRV' || buf[4] !== 1) return null;
        const dv = new DataView(buf.buffer);
        const N = dv.getUint32(5, true), R = dv.getUint32(9, true);
        if (R !== S.R) return null;                /* a different artwork; refuse */
        const pal = [];
        for (let q = 0; q < 256; q++) pal.push([buf[13 + q * 3], buf[14 + q * 3], buf[15 + q * 3]]);
        const frames = [];
        let off = 13 + 768;
        for (let f = 0; f < N; f++) { frames.push(buf.slice(off, off + R * R)); off += R * R; }
        const seed = seedOf(STREAM.id, i);
        const lut = new Uint32Array(256);
        for (let q = 0; q < 256; q++) {
          const c = pal[q];
          lut[q] = LE ? (((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0)
            : (((c[0] << 24) | (c[1] << 16) | (c[2] << 8) | 255) >>> 0);
        }
        return { index: i, addrSeed: seed, genome: genomeOf(seed), frames, N, pal, lut, mode: '', ms: 0, live: false };
      } catch (e) { return null; }
    }
  };

  /* ═══ 5 · TYPE, ICONS, QR ══════════════════════════════════════════════
     Bitmap 5x7 face, integer scales only, no antialiasing, no subpixel.
     2x is shouted (across the street), 1x is murmured (walk up close).  */

  /* shared with the viewer: window.CARDKIT (infinite/card.js) holds the
     bitmap face, heart, avatar, QR and the chrome composition */
  const drawText = window.CARDKIT.drawText;

  /* ═══ 6 · CARDS ════════════════════════════════════════════════════════
     DOM ring of 4 canvases, recycled, never appended past boot. One
     canvas per post: art blitted 1:1 at (0, artY), chrome drawn as
     pixels. imageSmoothingEnabled false on every context, every time.  */

  const CARDS = { ring: [], track: null, stage: null };

  function buildStage() {
    const cfg = S.cfg;
    const stage = document.createElement('div');
    stage.id = 'stage';
    stage.style.cssText = 'position:fixed;left:0;top:0;width:' + S.R + 'px;height:' + S.wallH +
      'px;overflow:hidden;background:#000;';
    const track = document.createElement('div');
    track.style.cssText = 'position:absolute;left:0;top:0;will-change:transform;';
    stage.appendChild(track);
    document.body.appendChild(stage);
    CARDS.stage = stage; CARDS.track = track;
    for (let k = 0; k < 4; k++) {
      const cv = document.createElement('canvas');
      cv.width = S.R; cv.height = S.postH;
      cv.style.cssText = 'position:absolute;left:0;width:' + S.R + 'px;height:' + S.postH + 'px;';
      track.appendChild(cv);
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const img = ctx.createImageData(S.R, S.R);
      CARDS.ring.push({
        cv, ctx, post: -1, loop: null, anchor: 0, img: img,
        u32: new Uint32Array(img.data.buffer),
        vid: null, likesShown: 0, heart: false, lastFi: -1
      });
    }
  }

  function cardFor(post) { return CARDS.ring.find(c => c.post === post) || null; }

  function assignCard(card, post, loop) {
    if (card.loop) FARM.free(card.loop);
    card.post = post; card.loop = loop; card.anchor = CH.ref;
    card.vid = window.VOICE.identity(loop.addrSeed, loop.genome);
    card.likesShown = card.vid.likes.base; card.heart = false;
    card.cv.style.top = ((post - CH.origin) * S.postH) + 'px';
    drawChrome(card);
    blitFrame(card, 0);
  }

  function cardO(card) {
    const ch = S.cfg.chrome;
    return {
      ch: ch, R: S.R, postH: S.postH, artY: S.artY, post: card.post,
      streamId: STREAM.id, qrBase: ch.qr.base, qrScale: ch.qr.scalePx,
      identity: card.vid, stops: schemeOf(card.loop.genome).stops,
      likesShown: card.likesShown, heart: card.heart,
      seed: card.loop.addrSeed, mul32: S.CORE.mulberry32
    };
  }
  function drawChrome(card) { window.CARDKIT.composeChrome(card.ctx, cardO(card)); }
  function drawActions(card) { window.CARDKIT.actionsRow(card.ctx, cardO(card)); }

  function blitFrame(card, fi) {
    const loop = card.loop;
    if (!loop || !loop.frames) return;
    const f = loop.frames[fi];
    if (!f) return;
    const u = card.u32;
    const lut = loop.lut, n = S.R * S.R;
    for (let q = 0; q < n; q++) u[q] = lut[f[q]];
    card.ctx.putImageData(card.img, 0, S.artY);
    card.lastFi = fi;
  }

  /* ═══ 7 · CHOREOGRAPHY ═════════════════════════════════════════════════
     THE FRAME CLOCK LAW. Everything below counts refreshes. There is no
     wall clock of any kind in this section: not now(), not timestamps,
     not the rAF argument. One refresh = one rAF fire at the display's
     own rate. One loop frame every frameDiv refreshes. A dwell is a
     whole number of loop cycles. A flick is a fixed frame count with
     precomputed integer deltas. translateY at integer offsets only.    */

  /* the spec's canonical flick: 20 frames, cubic ease-out, sums exactly
     to one post height at the 3x3 wall. Baked. For any other post height
     the same generator reproduces the law: round-half-even cumulative
     cubic ease-out, verified at boot against this very table.           */
  const FLICK_SPEC = [59, 54, 48, 42, 37, 33, 29, 24, 21, 17, 14, 11, 9, 7, 5, 3, 2, 1, 0, 0];

  function rhe(x) {                        /* round half to even */
    const f = Math.floor(x), d = x - f;
    if (d > 0.5) return f + 1;
    if (d < 0.5) return f;
    return (f % 2 === 0) ? f : f + 1;
  }
  function flickTable(dist, frames) {
    const out = []; let prev = 0;
    for (let k = 1; k <= frames; k++) {
      const t = k / frames;
      const c = rhe(dist * (1 - Math.pow(1 - t, 3)));
      out.push(c - prev); prev = c;
    }
    return out;
  }

  /* settle: 4-7 frames, 2-6px micro-overshoot, integer, sums to zero */
  const SETTLES = [
    [1, 1, -1, -1],
    [2, 1, -1, -2],
    [3, 1, -2, -1, -1],
    [2, 2, 1, -2, -2, -1],
    [4, 2, -2, -2, -1, -1],
    [3, 2, 1, -2, -2, -1, -1]
  ];

  const CH = {
    ref: 0,                     /* the refresh counter: the only clock */
    state: 'PRIME', sRef: 0, k: 0, step: 0, hold: 0,
    post: 0, base: 0, y: 0,
    /* THE COORDINATE ORIGIN. Card tops and the track offset are measured
       relative to CH.origin, not from post 0: absolute post*postH breaks
       layout at large indexes (Blink clamps lengths around 2^25 px), and
       an infinite run reaches that in days even from index 0. The origin
       rebases forward every rebasePx of travel, between beats, with every
       card and the track shifted in the same tick — invisible. */
    origin: 0, rebasePx: 1048576, rebases: 0,
    beat: 0, plan: null,
    log: [], starve: 0
  };

  function beatRng(beatNo) { return S.CORE.mulberry32(seedOf(STREAM.id, 'beat:' + beatNo)); }

  function planBeat() {
    const cfg = S.cfg.choreo;
    const r = beatRng(CH.beat);
    const focused = cardFor(CH.post);
    const N = focused && focused.loop ? focused.loop.N : FARM.N;
    const cycle = N * S.frameDiv;
    let cycles;
    const vLong = r() < cfg.variance.longDwell;
    if (vLong) cycles = cfg.longDwellCycles[0] + ((r() * (cfg.longDwellCycles[1] - cfg.longDwellCycles[0] + 1)) | 0);
    else {
      let t = 0; for (const w of cfg.dwellWeights) t += w;
      let x = r() * t; cycles = cfg.dwellCycles[0];
      for (let i = 0; i < cfg.dwellCycles.length; i++) { x -= cfg.dwellWeights[i]; if (x <= 0) { cycles = cfg.dwellCycles[i]; break; } }
    }
    const vDouble = !vLong && r() < cfg.variance.doubleFlick;
    const vBack = !vLong && !vDouble && r() < cfg.variance.backScroll;
    const vHes = r() < cfg.variance.hesitate;
    const flick = S.postH === FLICK_SPEC.reduce((a, b) => a + b, 0) && cfg.flickFrames === FLICK_SPEC.length
      ? FLICK_SPEC : flickTable(S.postH, cfg.flickFrames);
    const back = vBack ? flickTable(rhe(S.postH * cfg.backScrollFracN / cfg.backScrollFracD), 14) : null;
    return {
      dwellRefs: cycles * cycle, cycles: cycles, N: N,
      kind: vDouble ? 'double' : vBack ? 'back' : vLong ? 'long' : 'normal',
      flick: flick, back: back,
      settle: SETTLES[(r() * SETTLES.length) | 0],
      hesitateAt: vHes ? 5 + ((r() * 10) | 0) : -1,
      hesitateRefs: 6 + ((r() * 9) | 0),
      seq: null, flicked: 0
    };
  }

  function logBeat(p, extra) {
    CH.log.push(Object.assign({
      beat: CH.beat, post: CH.post, kind: p.kind, N: p.N,
      dwellRefs: p.dwellRefs, cycles: p.cycles,
      flickSum: p.flick.reduce((a, b) => a + b, 0),
      settle: p.settle.join(','), hesitateAt: p.hesitateAt
    }, extra || {}));
    if (CH.log.length > 400) CH.log.shift();
  }

  /* build the state sequence for one beat from its plan */
  function seqOf(p) {
    const seq = [];
    if (p.kind === 'back') {
      seq.push(['DWELL', p.dwellRefs]);
      seq.push(['MOVE', p.back.map(d => -d), 0]);
      seq.push(['DWELL', p.N * S.frameDiv]);
      seq.push(['MOVE', p.back.slice(), 0]);
      seq.push(['DWELL', p.N * S.frameDiv]);
      seq.push(['FLICK', p.flick, p.hesitateAt, p.hesitateRefs]);
      seq.push(['SETTLE', p.settle]);
    } else if (p.kind === 'double') {
      seq.push(['DWELL', p.dwellRefs]);
      seq.push(['FLICK', p.flick, p.hesitateAt, p.hesitateRefs]);
      seq.push(['SETTLE', p.settle]);
      seq.push(['PAUSE', 24]);
      seq.push(['FLICK', p.flick, -1, 0]);
      seq.push(['SETTLE', p.settle]);
    } else {
      seq.push(['DWELL', p.dwellRefs]);
      seq.push(['FLICK', p.flick, p.hesitateAt, p.hesitateRefs]);
      seq.push(['SETTLE', p.settle]);
    }
    return seq;
  }

  function choreoStep() {
    if (CH.state === 'PRIME') {
      /* wait, blit-only, until the first two posts exist */
      if (cardFor(CH.post) && cardFor(CH.post + 1)) {
        CH.plan = planBeat(); CH.plan.seq = seqOf(CH.plan);
        CH.state = 'RUN'; CH.sRef = CH.ref; CH.k = 0; CH.step = 0; CH.hold = 0;
        logBeat(CH.plan);
      }
      return;
    }
    if (CH.state !== 'RUN') return;
    const p = CH.plan;
    const st = p.seq[CH.step];
    if (!st) {                             /* beat complete */
      CH.beat++;
      if (CH.base >= CH.rebasePx) {        /* shift the origin; nothing moves on screen */
        const d = (CH.post - CH.origin) * S.postH;
        CH.origin = CH.post; CH.base -= d; CH.y -= d; CH.rebases++;
        for (const card of CARDS.ring) if (card.post >= 0)
          card.cv.style.top = ((card.post - CH.origin) * S.postH) + 'px';
        applyY();
      }
      CH.plan = planBeat(); CH.plan.seq = seqOf(CH.plan);
      CH.step = 0; CH.k = 0; CH.hold = 0; CH.sRef = CH.ref;
      logBeat(CH.plan);
      return;
    }
    const kind = st[0];
    if (kind === 'DWELL' || kind === 'PAUSE') {
      /* NEVER SHOW AN EMPTY CARD: the flick that would reveal an unready
         post is postponed by whole loop cycles. Silence, not spinners. */
      const need = CH.post + 1;
      if (CH.ref - CH.sRef >= st[1]) {
        const nextIsMove = p.seq[CH.step + 1] && p.seq[CH.step + 1][0] === 'FLICK';
        if (nextIsMove && !cardFor(need)) {
          CH.sRef = CH.ref; st[1] = p.N * S.frameDiv;   /* one more cycle */
          CH.starve++; logBeat(p, { extended: true });
          return;
        }
        CH.step++; CH.k = 0; CH.sRef = CH.ref; CH.hold = 0;
      }
      return;
    }
    if (kind === 'MOVE' || kind === 'FLICK') {
      const tab = st[1];
      if (kind === 'FLICK' && CH.k === st[2] && CH.hold < st[3]) { CH.hold++; return; }
      if (CH.k < tab.length) { CH.y += tab[CH.k]; CH.k++; applyY(); return; }
      if (kind === 'FLICK') { CH.post++; CH.base += S.postH; onPostAdvance(); }
      else if (tab[0] < 0) { /* back-scroll excursion done */ }
      CH.step++; CH.k = 0; CH.sRef = CH.ref; CH.hold = 0;
      return;
    }
    if (kind === 'SETTLE') {
      const tab = st[1];
      if (CH.k < tab.length) { CH.y += tab[CH.k]; CH.k++; applyY(); return; }
      CH.step++; CH.k = 0; CH.sRef = CH.ref;
      return;
    }
  }

  function applyY() {
    CARDS.track.style.transform = 'translateY(' + (-CH.y | 0) + 'px)';
  }

  /* likes tick during the dwell; the heart fills unprompted */
  function likesStep() {
    const card = cardFor(CH.post);
    if (!card || !card.vid) return;
    const age = CH.ref - card.anchor;
    let dirty = false;
    if (!card.heart && age >= card.vid.likes.heartAt) { card.heart = true; dirty = true; }
    const shown = card.vid.likes.base + ((age / card.vid.likes.tickEvery) | 0) + (card.heart ? 1 : 0);
    if (shown !== card.likesShown) { card.likesShown = shown; dirty = true; }
    if (dirty) drawActions(card);
  }

  /* ═══ 8 · PLAYER ═══════════════════════════════════════════════════════
     One requestAnimationFrame drives everything: the choreography step,
     every live card's blit, the likes. Frame index derives from the
     refresh counter alone.                                              */

  const PLAYER = {
    start() {
      const tick = () => {
        CH.ref++;
        choreoStep();
        ringStep();
        for (const card of CARDS.ring) {
          if (card.post < 0 || !card.loop || !card.loop.frames) continue;
          const fi = (((CH.ref - card.anchor) / S.frameDiv) | 0) % card.loop.N;
          if (fi !== card.lastFi) blitFrame(card, fi);
        }
        likesStep();
        GOV.beatWatch();
        window.__isHeartbeat = CH.ref;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  };

  /* the DOM ring: keep cards for posts post-1 .. post+2; recycle beyond */
  let pendingClaims = new Set();
  function ringStep() {
    const lo = Math.max(0, CH.post - 1), hi = CH.post + 2;
    for (const card of CARDS.ring) {
      if (card.post >= 0 && (card.post < lo || card.post > hi)) {
        FARM.free(card.loop); card.loop = null; card.post = -1;
      }
    }
    for (let p = lo; p <= hi; p++) {
      if (p < STREAM.start) continue;
      if (cardFor(p) || pendingClaims.has(p)) continue;
      if (FARM.bad.has(p)) continue;
      const free = CARDS.ring.find(c => c.post < 0);
      if (!free) break;
      pendingClaims.add(p);
      FARM.claim(p).then(loop => {
        pendingClaims.delete(p);
        if (loop) {
          const slot = CARDS.ring.find(c => c.post < 0);
          if (slot) assignCard(slot, p, loop); else FARM.free(loop);
        }
      });
    }
  }

  function onPostAdvance() { GOV.check(); }

  /* ═══ 9 · GOVERNOR ═════════════════════════════════════════════════════
     Watches queue depth, not fps. Queue < low: drop N one ladder step
     (the cycle length changes; dwell refresh counts derive from the
     focused loop's own N, so they recompute themselves). Past that, the
     reservoir carries it. IT NEVER TOUCHES R. Every intervention logged. */

  const GOV = {
    entries: [], calmBeats: 0,
    log(msg) {
      this.entries.push({ ref: CH.ref, beat: CH.beat, msg: msg });
      if (this.entries.length > 500) this.entries.shift();
      try { console.log('[GOV ' + CH.ref + '] ' + msg); } catch (e) { }
    },
    check() {
      const depth = FARM.depth();
      const lad = S.cfg.frames.ladder;
      const at = lad.indexOf(FARM.N);
      if (depth < S.cfg.queue.low && at >= 0 && at < lad.length - 1) {
        FARM.N = lad[at + 1];
        this.calmBeats = 0;
        this.log('queue ' + depth + ' < ' + S.cfg.queue.low + ' -> N drops to ' + FARM.N + ' (R untouched)');
      } else if (depth >= S.cfg.queue.ahead - 2 && at > 0) {
        if (++this.calmBeats >= 50) {
          FARM.N = lad[at - 1]; this.calmBeats = 0;
          this.log('queue healthy 50 beats -> N recovers to ' + FARM.N);
        }
      } else this.calmBeats = 0;
    },
    beatWatch() { /* heartbeat marker consumed by MAINT via window */ }
  };

  /* ═══ 10 · MAINTENANCE ═════════════════════════════════════════════════
     The only section allowed a wall clock. Watchdog (no heartbeat 10s ->
     respawn the farm; 60s -> reload at position), scheduled 24h reload
     at a dead hour at position via URL, hourly RSS to a rotating ring,
     worker recycling is in the farm. The engine's visibilitychange
     player pause is not imported and nothing here binds one.            */

  const MAINT = {
    lastRef: 0, stalledS: 0,
    start() {
      const cfg = S.cfg.maintenance;
      setInterval(() => {
        if (CH.ref === this.lastRef) {
          this.stalledS += 5;
          if (this.stalledS >= cfg.watchdogReloadS) this.reloadAtPosition();
          else if (this.stalledS >= cfg.watchdogRespawnS) {
            GOV.log('watchdog: no heartbeat ' + this.stalledS + 's, farm respawn');
            for (const slot of FARM.slots) FARM.fail(slot, true);
          }
        } else this.stalledS = 0;
        this.lastRef = CH.ref;
      }, 5000);
      setInterval(() => {
        try {
          const mem = performance.memory ? performance.memory.usedJSHeapSize : 0;
          const ring = JSON.parse(localStorage.getItem('IS_RSS') || '[]');
          ring.push({ t: Date.now(), heap: mem, ref: CH.ref, beat: CH.beat, N: FARM.N, depth: FARM.depth() });
          while (ring.length > 168) ring.shift();
          localStorage.setItem('IS_RSS', JSON.stringify(ring));
          console.log('[RSS] heap ' + (mem / 1048576).toFixed(1) + 'MB beat ' + CH.beat);
        } catch (e) { }
      }, cfg.rssLogMinutes * 60000);
      /* invisible scheduled reload at a dead hour, at position */
      const now = new Date();
      const next = new Date(now);
      next.setHours(cfg.reloadHourLocal, 0, 0, 0);
      if (next <= now || (next - now) < 3600000) next.setDate(next.getDate() + 1);
      setTimeout(() => this.reloadAtPosition(), next - now);
    },
    reloadAtPosition() {
      location.replace(location.pathname + '?s=' + encodeURIComponent(STREAM.id) + '&i=' + CH.post);
    }
  };

  /* ═══ 11 · PROBE ═══════════════════════════════════════════════════════
     Invisible instrumentation. Renders nothing, changes nothing.        */

  window.__FEED = {
    S: S, CH: CH, FARM: FARM, GOV: GOV, CARDS: CARDS, STREAM: STREAM,
    seedOf, genomeOf, jobOf, fieldOf, preludeOf, workerSrc, flickTable, rhe,
    FLICK_SPEC, SETTLES, QR: window.CARDKIT.QR,
    phase() {
      const st = CH.plan && CH.plan.seq ? CH.plan.seq[CH.step] : null;
      return {
        state: CH.state, kind: st ? st[0] : 'PRIME', k: CH.k,
        refsIn: CH.ref - CH.sRef, beat: CH.beat, post: CH.post,
        y: CH.y, base: CH.base, ref: CH.ref
      };
    },
    probe() {
      const art = CARDS.ring.filter(c => c.post >= 0).map(c => ({
        post: c.post, top: (c.post - CH.origin) * S.postH, artX: 0, artY: S.artY,
        artW: S.R, artH: S.R, smoothing: c.ctx.imageSmoothingEnabled,
        canvasW: c.cv.width, styleW: c.cv.style.width, frame: c.lastFi, N: c.loop ? c.loop.N : 0
      }));
      return {
        R: S.R, RSource: 'config.wall.width', wall: [S.R, S.wallH],
        postPitch: S.postH, devicePixelRatio: window.devicePixelRatio,
        state: CH.state, post: CH.post, y: CH.y, ref: CH.ref, beat: CH.beat,
        N: FARM.N, queueDepth: FARM.depth(), cardsAlive: CARDS.ring.filter(c => c.post >= 0).length,
        loopsRendered: FARM.loopsDone, starveExtends: CH.starve,
        pandoraPublic: window.PANDORA_PUBLIC === true, cards: art
      };
    },
    renderDirect(index, cb) {
      /* render post <index>'s loop with a throwaway worker, for proofs */
      const spec = jobOf(index, FARM.N);
      const url = URL.createObjectURL(new Blob([workerSrc()], { type: 'text/javascript' }));
      const w = new Worker(url);
      URL.revokeObjectURL(url);
      const frames = [], out = { pal: null };
      w.onmessage = e => {
        const m = e.data;
        if (m.t === 'meta') { out.pal = m.pal; return; }
        if (m.t === 'err') { w.terminate(); cb(null, m.msg); return; }
        if (m.t !== 'pv') return;
        frames[m.i] = m.buf;
        if (m.i + 1 < spec.job.N) {
          spec.job.__i = m.i + 1;
          w.postMessage({ t: 'job', job: spec.job, step: true });
        } else {
          w.postMessage({ t: 'pause' });
          w.terminate();
          cb({ index, seed: spec.addrSeed, genome: spec.genome, pal: out.pal, frames, N: spec.job.N });
        }
      };
      spec.job.__i = 0;
      w.postMessage({ t: 'job', job: spec.job, step: true });
    }
  };

  boot().catch(e => { console.error('INFINITE SCROLL boot failed', e); });
})();
