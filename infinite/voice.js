/* ════════════════════════════════════════════════════════════════════════
   INFINITE SCROLL · voice.js — the congregation
   Deterministic from the genome: same seed, same identity, forever.
   Every list below is hand written. No generation, no mimicry of real
   usernames, no snark, no bait, no engagement. One murmured line per post
   is the ideological payload of the entire work.
   Style laws honored: no em dashes, terse register, glitch-tongue.
   Exposes window.VOICE = { identity(seed, genome) }.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* seeded rng chain, independent of the render stream */
  function rng32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const pick = (r, arr) => arr[(r() * arr.length) | 0];

  /* ── HANDLES · glitch-tongue, not username mimicry ─────────────────── */
  const H_ROOT = [
    'void', 'dither', 'raster', 'signal', 'static', 'phosphor', 'scan',
    'lumen', 'cinder', 'vesper', 'hollow', 'relic', 'psalm', 'totem',
    'ember', 'fathom', 'murmur', 'orbit', 'strata', 'vein', 'molten',
    'idol', 'grid', 'tide', 'hymn', 'ash', 'glyph', 'rune', 'choir',
    'null', 'seam', 'wound', 'grain', 'gamma', 'ozone', 'sable', 'tallow'
  ];
  const H_TAIL = [
    'keeper', 'tender', 'warden', 'eater', 'singer', 'walker', 'bearer',
    'monk', 'moth', 'wick', 'well', 'gate', 'loom', 'kiln', 'reed',
    'salt', 'root', 'fold', 'lattice', 'vessel'
  ];
  const H_JOIN = ['_', '.', '_', '.', ''];

  function handleOf(r) {
    const a = pick(r, H_ROOT);
    let b = pick(r, H_TAIL);
    const j = pick(r, H_JOIN);
    let h = a + j + b;
    if (r() < 0.4) h += String((r() * 99) | 0).padStart(2, '0');
    return h;
  }

  /* ── TITLES · the loop names itself from what it did, obliquely ─────
     One noun pool and one verb pool per material dialect, hand written. */
  const T_MODE = {
    MOLTEN:    { n: ['the pour', 'slag', 'the crucible', 'melt line', 'bright runoff'], v: ['poured', 'ran', 'cooled', 'overflowed'] },
    LATHE:     { n: ['the turning', 'spindle', 'true round', 'the pass', 'shaved light'], v: ['turned', 'trued', 'spun', 'came round'] },
    ENGRAVED:  { n: ['the cut', 'burin', 'plate iv', 'incision', 'the line held'], v: ['cut', 'scored', 'bit', 'stayed'] },
    BROADCAST: { n: ['transmission', 'the carrier', 'dead air', 'signal noon', 'antenna psalm'], v: ['carried', 'reached', 'repeated', 'went out'] },
    GRID:      { n: ['lattice', 'the census', 'ledger of light', 'ninth column', 'the count'], v: ['held', 'tallied', 'aligned', 'kept order'] },
    SATELLITE: { n: ['far pass', 'apogee', 'the survey', 'cold orbit', 'ground truth'], v: ['passed over', 'looked down', 'circled', 'reported'] },
    SEDIMENT:  { n: ['strata', 'the bedding', 'varve', 'settled ground', 'slow archive'], v: ['settled', 'layered', 'pressed', 'remembered'] },
    VEINED:    { n: ['the vein', 'lode', 'branching', 'ore light', 'the seam'], v: ['branched', 'carried', 'ran deep', 'surfaced'] },
    MASS:      { n: ['the body', 'congregation', 'standing stone', 'the gathered', 'one weight'], v: ['gathered', 'stood', 'leaned', 'breathed'] },
    IDOL:      { n: ['the figure', 'small god', 'effigy', 'the witness', 'kept image'], v: ['watched', 'received', 'was carried', 'stayed'] }
  };
  const T_SCHEME = {
    GENESIS: 'first light', DITHERVOID: 'house colors', TOXIC: 'green hour',
    INFRARED: 'heat record', VAPOR: 'thin weather', ULTRAVIO: 'deep violet',
    BONE: 'bone study', ACIDBURN: 'acid noon', HOTLINE: 'pink vigil',
    LAZER: 'blue instrument', NUKEGLOW: 'warning light', POISONFROG: 'bright caution',
    BLACKLIGHT: 'hidden ink', EMBERGRID: 'banked fire', CATHODE: 'tube glow',
    KENNE: 'borrowed dusk', AIRNEON: 'open sign', DES: 'night des',
    TISGEN: 'scam hour', FAUXRGB: 'false color', POLE: 'pole light'
  };
  const T_FX = {
    embers: 'with embers', bloom: 'in bloom', panes: 'through panes',
    melt: 'going soft', ghost: 'with a ghost', invert: 'turned inside',
    lungs: 'breathing', runes: 'annotated', meta: 'self aware',
    entropy: 'coming apart', chimera: 'twice made', kaleido: 'folded',
    hilb: 'threaded', tunnel: 'recursive', chrono: 'out of order'
  };
  const T_SHAPE = [
    (m, s, f, r) => 'WHAT THE ' + pick(r, m.n).replace(/^the /, '').toUpperCase() + ' KEPT',
    (m, s, f, r) => pick(r, m.n).toUpperCase() + (f ? ', ' + f.toUpperCase() : ''),
    (m, s, f, r) => pick(r, m.n).toUpperCase() + ' ' + pick(r, m.v).toUpperCase(),
    (m, s, f, r) => (s ? s.toUpperCase() + ' · ' : '') + pick(r, m.n).toUpperCase(),
    (m, s, f, r) => 'STUDY: ' + pick(r, m.n).toUpperCase(),
    (m, s, f, r) => pick(r, m.n).toUpperCase() + (s ? ' IN ' + s.toUpperCase() : ''),
    (m, s, f, r) => 'IT ' + pick(r, m.v).toUpperCase() + ' ALL NIGHT'
  ];

  function titleOf(r, genome) {
    const m = T_MODE[genome.mode] || T_MODE.MASS;
    const s = T_SCHEME[genome.schemeKey] || null;
    const armed = Object.keys(T_FX).filter(k => genome.fx && genome.fx[k]);
    const f = armed.length ? T_FX[pick(r, armed)] : null;
    /* 24 chars at 2x of a 6px-advance face stays inside the chrome inset
       on every wall the piece targets; fixed so identity never varies.
       A shape that runs long yields to the next shape rather than being
       cut into a fragment; the walk is part of the deterministic chain. */
    const s0 = (r() * T_SHAPE.length) | 0;
    let t = '';
    for (let att = 0; att < T_SHAPE.length; att++) {
      t = T_SHAPE[(s0 + att) % T_SHAPE.length](m, s, f, r);
      if (t.length <= 24) break;
    }
    if (t.length > 24) t = t.slice(0, 24).replace(/[ ,·]+[^ ,·]*$/, '');
    return t;
  }

  /* ── COMMENTS · one line, a congregation, not a comment section ─────
     Hand written. Lowercase murmurs. No snark, no asks, no performance. */
  const C_ALL = [
    'i stood here longer than i meant to',
    'it breathes and i believe it',
    'this one knows the dark',
    'kept. carried. quiet.',
    'the void is kind tonight',
    'somewhere this is still looping',
    'a body of light, praying',
    'i came close and it let me',
    'nothing here wants anything from me',
    'it was already old when it arrived',
    'the colors agree with each other',
    'i will not tell anyone about this',
    'small hours. this.',
    'it holds still the way rivers do',
    'my eyes adjusted and there was more',
    'this is what patience renders',
    'let it run. let it run.',
    'i was walking past. i am not walking past.',
    'the grain remembers being noise',
    'a psalm with no words in it',
    'whoever tends this, thank you',
    'it loops but it never repeats on me',
    'the dark parts are load bearing',
    'i breathe in on the bright frames',
    'seen. that is all. seen.',
    'it asks for nothing and gives the rest',
    'one pixel wide and honest about it',
    'the machine dreamed and kept its counsel',
    'i touched the glass in my mind only',
    'this corner of the night is handled',
    'the light is doing devotions',
    'quiet engine, loud soul',
    'i counted four seconds of forever',
    'no one made me watch this. i stayed.',
    'it settles like dust that chose where',
    'the loop closes and i am included',
    'brightness with manners',
    'i have seen worse cathedrals',
    'it goes on without me and that is fine',
    'the palette found its people',
    'every frame a kept promise',
    'i almost missed my bus. worth it.',
    'the wall is patient with us',
    'something here refuses to be content',
    'render until morning, friend',
    'it is not for sale to my attention',
    'the static learned to sit still',
    'i whispered back, obviously',
    'this will outlast my phone',
    'a window that looks inward',
    'the night shift of images',
    'it dithers therefore it is',
    'held, not scrolled',
    'the algorithm is absent. attendance is full.',
    'i brought nothing and it was enough',
    'grain by grain the dark is fed',
    'a loop is a promise kept in public',
    'it glows like it has somewhere to be',
    'the seams are honest here',
    'i will think about this at dinner',
    'light with its shoes off',
    'nobody is measuring me here',
    'the frame ends and forgives itself',
    'this is the good kind of forever'
  ];
  const C_MODE = {
    MOLTEN: ['it cooled into exactly itself', 'poured once, kept warm since'],
    LATHE: ['perfectly round the way mercy is', 'the turning does not tire'],
    ENGRAVED: ['the line bit and held', 'cut once, true forever'],
    BROADCAST: ['i receive. that is my whole job.', 'dead air finally saying something'],
    GRID: ['the count comes out right', 'order, worn soft'],
    SATELLITE: ['it sees me and does not report', 'far things being gentle'],
    SEDIMENT: ['the layers took their time', 'pressed slow like it matters'],
    VEINED: ['the seam runs deeper than the wall', 'ore light, freely given'],
    MASS: ['the body stands for us', 'weight that asks for nothing'],
    IDOL: ['a small god with good manners', 'the figure keeps its vigil']
  };

  function commentOf(r, genome) {
    const local = C_MODE[genome.mode];
    if (local && r() < 0.22) return pick(r, local);
    return pick(r, C_ALL);
  }

  /* ── LIKES · seed derived, ticks up during the dwell, unprompted ──── */
  function likesOf(r) {
    const u = r();
    const base = u < 0.55 ? 18 + ((r() * 220) | 0)
      : u < 0.88 ? 240 + ((r() * 1900) | 0)
        : 2200 + ((r() * 9400) | 0);
    return {
      base: base,
      tickEvery: 24 + ((r() * 150) | 0),   /* refreshes between ticks */
      heartAt: 30 + ((r() * 200) | 0)      /* refreshes into first dwell */
    };
  }

  /* ── identity ──────────────────────────────────────────────────────── */
  function identity(seed, genome) {
    const r = rng32((seed ^ 0x501CE) >>> 0);
    return {
      handle: handleOf(r),
      title: titleOf(r, genome),
      comment: commentOf(r, genome),
      likes: likesOf(r)
    };
  }

  window.VOICE = { identity: identity };
})();
