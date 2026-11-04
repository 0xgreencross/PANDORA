/* DITHERVOID // BLACKBOX site. Static, no build step. Query routing:
   ?view=now (default) | ?view=records | ?rec=N[&ed=M] | ?owner=0x.. or name.eth | ?view=about */
(function () {
'use strict';

var CFG = window.BBCFG || {};
var Q0 = new URLSearchParams(location.search);
var NETKEY = Q0.get('net') === 'sepolia' ? 'sepolia' : 'mainnet';
var NET = CFG[NETKEY] || {};
var SITE = 'https://dithervoid.art/blackbox/';
var OS_ASSET = NETKEY === 'sepolia' ? 'https://testnets.opensea.io/assets/sepolia/' : 'https://opensea.io/assets/ethereum/';
var GIFENC_URL = 'https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js';
var POLL_MS = 20000;
var BRAND = 'DITHERVOID // BLACKBOX';
var DEF_TITLE = 'DITHERVOID // BLACKBOX: flight records on Ethereum by GREENCROSS';
var DEF_DESC = 'Every flight GREENCROSS takes files a record on Ethereum. Editions mint only while the plane is in the air; unminted supply never exists. Fully on-chain art.';
var DEAD = '0x000000000000000000000000000000000000dEaD';

var ABI = [
  'function records(uint256) view returns (bytes32 passHash, uint64 windowOpen, uint64 deadline, uint64 landedAt, uint16 blockMinutes, uint16 cap, uint16 minted, uint128 price)',
  'function recordCount() view returns (uint256)',
  'function mint(uint256 rec) payable',
  'function tokenURI(uint256) view returns (string)',
  'function dossierOf(uint256) view returns (string)',
  'function imager() view returns (address)',
  'function auction() view returns (uint64 start, uint64 end, uint128 reserve, uint128 highBid, address highBidder, bool settled)',
  'function bid() payable',
  'function ownerOf(uint256) view returns (address)',
  'event Minted(uint256 indexed rec, uint256 tokenId, address to, uint16 index)'
];
var iface = new ethers.Interface(ABI);
var IMG = new ethers.Interface(['function render(bool sealed_, uint32 seed, uint16[] mins) view returns (bytes)']);

/* ---------- helpers ---------- */
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function p2(n) { return String(n).padStart(2, '0'); }
function p3(n) { return String(n).padStart(3, '0'); }
function short(a) { return a ? a.slice(0, 6) + '..' + a.slice(-4) : ''; }
function isMobile() {
  var ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
}
function fmtEth(wei) {
  var v = (BigInt(wei) + 500000000000n) / 1000000000000n;
  var s = v.toString().padStart(7, '0');
  return s.slice(0, -6) + '.' + s.slice(-6);
}
function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  var d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return (d ? d + 'D ' : '') + p2(h) + ':' + p2(m) + ':' + p2(s);
}
function ymdhm(d, utc) {
  var g = utc ? ['getUTCFullYear', 'getUTCMonth', 'getUTCDate', 'getUTCHours', 'getUTCMinutes'] : ['getFullYear', 'getMonth', 'getDate', 'getHours', 'getMinutes'];
  return d[g[0]]() + '-' + p2(d[g[1]]() + 1) + '-' + p2(d[g[2]]()) + ' ' + p2(d[g[3]]()) + ':' + p2(d[g[4]]());
}
function fmtWhen(ts) {
  var d = new Date(ts * 1000);
  return esc(ymdhm(d, false)) + ' LOCAL<br>' + esc(ymdhm(d, true)) + ' UTC';
}
function b64dec(s) {
  var bin = atob(s), u = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(u);
}
function pieceName(rec, idx) { return 'BLACKBOX REC ' + p3(rec) + ' // ' + p2(idx); }
function netQ() { return NETKEY === 'sepolia' ? '&net=sepolia' : ''; }
function deepLink(rec) { return SITE + '?rec=' + rec + netQ(); }
function H(q) { return '?' + q + netQ(); }
function lc(a) { return a ? String(a).toLowerCase() : ''; }
function sLS(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
function gLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function setHTML(el, h) { if (el && el._h !== h) { el._h = h; el.innerHTML = h; } }
function scanUrl(tid) { return NET.explorer + '/nft/' + NET.contract + '/' + tid; }
function osUrl(tid) { return OS_ASSET + NET.contract + '/' + tid; }
function ext(href, label, cls) { return '<a' + (cls ? ' class="' + cls + '"' : '') + ' target="_blank" rel="noopener" href="' + esc(href) + '">' + label + '</a>'; }
function nav(href, label, cls) { return '<a data-nav' + (cls ? ' class="' + cls + '"' : '') + ' href="' + esc(href) + '">' + label + '</a>'; }

/* ---------- rpc (JSON-RPC batches, 40 per request) ---------- */
async function rpcBatch(reqs) {
  var out = [];
  for (var off = 0; off < reqs.length; off += 40) out = out.concat(await rpcChunk(reqs.slice(off, off + 40)));
  return out;
}
async function rpcChunk(reqs) {
  var body = reqs.map(function (r, i) { return { jsonrpc: '2.0', id: i + 1, method: r.method, params: r.params }; });
  var res;
  try {
    var resp = await fetch(NET.rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body.length === 1 ? body[0] : body) });
    res = await resp.json();
  } catch (e) { return reqs.map(function () { return { ok: 0, e: e }; }); }
  if (!Array.isArray(res)) {
    if (reqs.length === 1) return [res.error ? { ok: 0, e: new Error(res.error.message) } : { ok: 1, v: res.result }];
    var seq = [];
    for (var k = 0; k < reqs.length; k++) seq.push((await rpcChunk([reqs[k]]))[0]);
    return seq;
  }
  var out = reqs.map(function () { return { ok: 0, e: new Error('missing') }; });
  res.forEach(function (x) { var i = x.id - 1; if (out[i]) out[i] = x.error ? { ok: 0, e: new Error(x.error.message) } : { ok: 1, v: x.result }; });
  return out;
}
async function rpc1(method, params) {
  var r = (await rpcChunk([{ method: method, params: params }]))[0];
  if (!r.ok) throw r.e;
  return r.v;
}
function mk(fn, args, gas) {
  var o = { to: NET.contract, data: iface.encodeFunctionData(fn, args) };
  if (gas) o.gas = gas;
  return { method: 'eth_call', params: [o, 'latest'], fn: fn, ifc: iface };
}
function dec(req, r) {
  if (!r.ok) throw r.e;
  return req.ifc.decodeFunctionResult(req.fn, r.v);
}
async function read(fn, args, gas) {
  var q = mk(fn, args, gas);
  return dec(q, (await rpcBatch([q]))[0]);
}

/* ---------- state ---------- */
var S = {
  recs: new Map(), count: 0, offset: 0, imager: null, auction: null, loaded: false, err: false, lastPoll: 0,
  owners: new Map(), ownersAt: 0, ens: new Map(), ensBusy: new Set(), resolved: new Map(),
  account: null, wp: null, svg: new Map(), meta: new Map(), metaOrder: [], ed: null, sk: null, mint: null, auSig: ''
};
function nowSec() { return Date.now() / 1000 + S.offset; }
/* FILED (window not open yet), INFLIGHT, CLOSED (deadline passed, landing pending), LANDED */
function phase(r, now) {
  if (r.landedAt) return 'LANDED';
  if (now < r.windowOpen) return 'FILED';
  if (now < r.deadline) return 'INFLIGHT';
  return 'CLOSED';
}
function stateWord(r, now) {
  var p = phase(r, now);
  if (p === 'LANDED') return r.minted ? 'DECLASSIFIED' : 'NO EDITIONS COLLECTED';
  if (p === 'INFLIGHT') return 'SEALED IN FLIGHT';
  if (p === 'FILED') return 'FILED, WINDOW OPENS SOON';
  return 'WINDOW CLOSED, LANDING';
}
function shortState(r, now) {
  var p = phase(r, now);
  if (p === 'LANDED') return r.minted ? 'DECLASSIFIED' : 'NO EDITIONS';
  if (p === 'INFLIGHT') return 'IN FLIGHT';
  if (p === 'FILED') return 'FILED';
  return 'CLOSED';
}
function canMint(r, now) { return phase(r, now) === 'INFLIGHT' && r.minted < r.cap; }
function dossier(r) {
  var d = (r && r.dossier || '').split('|');
  return { from: d[0] || '', to: d[1] || '', date: d[2] || '', seat: d[3] || '', min: d[4] || '', km: d[5] || '', ac: d[6] || '' };
}
function routeOf(r) { if (!r.landedAt || !r.dossier) return ''; var d = dossier(r); return d.from && d.to ? d.from + ' > ' + d.to : ''; }
function inFlightRec() {
  var now = nowSec(), ids = Array.from(S.recs.keys()).sort(function (a, b) { return b - a; });
  for (var i = 0; i < ids.length; i++) { var r = S.recs.get(ids[i]); if (phase(r, now) === 'INFLIGHT') return r; }
  return null;
}
function latestLanded() {
  var best = null;
  S.recs.forEach(function (r) { if (r.landedAt && (!best || r.rec > best.rec)) best = r; });
  return best;
}
function ownerOf(tid) { return S.owners.get(tid) || ''; }
function isMine(tid) { return !!(S.account && lc(ownerOf(tid)) === lc(S.account)); }
function landedKey(r) { return r.landedAt ? 1 : 0; }

/* ---------- chain reads ---------- */
async function refresh() {
  if (!NET.contract) return;
  try {
    var have = S.count;
    var reqs = [{ method: 'eth_getBlockByNumber', params: ['latest', false] }, mk('recordCount', []), mk('auction', [])];
    var hasImg = !S.imager;
    if (hasImg) reqs.push(mk('imager', []));
    var r0 = reqs.length;
    for (var i = 1; i <= Math.min(have + 1, 24); i++) reqs.push(mk('records', [i]));
    var res = await rpcBatch(reqs);
    if (res[0].ok && res[0].v && res[0].v.timestamp) S.offset = parseInt(res[0].v.timestamp, 16) - Date.now() / 1000;
    var cnt = Number(dec(reqs[1], res[1])[0]);
    try { var a = dec(reqs[2], res[2]); S.auction = { start: Number(a[0]), end: Number(a[1]), reserve: a[2], highBid: a[3], highBidder: a[4], settled: a[5] }; } catch (e) { S.auction = null; }
    if (hasImg) { try { S.imager = dec(reqs[3], res[3])[0]; } catch (e) { } }
    var recQ = reqs.slice(r0), recR = res.slice(r0);
    if (cnt > have + 1) {
      var more = [];
      for (var j = have + 2; j <= Math.min(cnt, 24); j++) more.push(mk('records', [j]));
      recQ = recQ.concat(more); recR = recR.concat(await rpcBatch(more));
    }
    recQ.forEach(function (q, k) {
      try {
        var v = dec(q, recR[k]), n = Number(q.params ? iface.decodeFunctionData('records', q.params[0].data)[0] : 0);
        if (!n || n > cnt || /^0x0+$/.test(v[0])) return;
        var old = S.recs.get(n) || {};
        S.recs.set(n, { rec: n, passHash: v[0], windowOpen: Number(v[1]), deadline: Number(v[2]), landedAt: Number(v[3]), blockMinutes: Number(v[4]), cap: Number(v[5]), minted: Number(v[6]), price: v[7], dossier: old.dossier || '' });
      } catch (e) { /* keep previous */ }
    });
    S.count = cnt;
    var need = [];
    S.recs.forEach(function (r) { if (r.landedAt && !r.dossier) need.push(r.rec); });
    if (need.length) {
      var dq = need.map(function (n) { return mk('dossierOf', [n]); });
      var dr = await rpcBatch(dq);
      need.forEach(function (n, k) { try { var s = dec(dq[k], dr[k])[0]; if (s) S.recs.get(n).dossier = s; } catch (e) { } });
    }
    await refreshOwners();
    S.loaded = true; S.err = false; S.lastPoll = Date.now();
  } catch (e) {
    console.warn('refresh failed', e);
    if (!S.loaded) S.err = true;
  }
  render();
}
async function refreshOwners() {
  var ids = [], unknown = false;
  S.recs.forEach(function (r) { for (var i = 1; i <= r.minted; i++) { var t = r.rec * 100 + i; ids.push(t); if (!S.owners.has(t)) unknown = true; } });
  if (!ids.length || (!unknown && Date.now() - S.ownersAt < 120000)) return;
  var qs = ids.map(function (t) { return mk('ownerOf', [t]); });
  var rs = await rpcBatch(qs);
  ids.forEach(function (t, k) { try { S.owners.set(t, dec(qs[k], rs[k])[0]); } catch (e) { } });
  S.ownersAt = Date.now();
}

/* ---------- thumbnails: the metadata image, rendered by the contract's imager ---------- */
function seedOf(r, idx) {
  var h = ethers.keccak256(ethers.solidityPacked(['bytes32', 'uint256'], [r.passHash, idx]));
  return Number(BigInt(h) >> 224n);
}
function svgKey(r, idx) { return (r.rec * 100 + idx) + ':' + landedKey(r); }
function thumb(r, idx, cls) {
  var k = svgKey(r, idx), src = S.svg.get(k);
  return '<img class="' + (cls || 'th') + '" alt="' + esc(pieceName(r.rec, idx)) + '" data-svg="' + k + '"' + (src ? ' src="' + src + '"' : '') + '>';
}
var thumbBusy = false, thumbAgain = false;
async function fillThumbs() {
  if (thumbBusy) { thumbAgain = true; return; }
  thumbBusy = true;
  try {
    var want = [];
    $$('img[data-svg]').forEach(function (im) {
      var k = im.getAttribute('data-svg');
      if (S.svg.has(k)) { if (im.getAttribute('src') !== S.svg.get(k)) im.src = S.svg.get(k); return; }
      var c = gLS('bb1:svg:' + k);
      if (c) { S.svg.set(k, c); im.src = c; return; }
      if (want.indexOf(k) < 0) want.push(k);
    });
    if (want.length && S.imager) {
      var qs = [], ks = [];
      want.forEach(function (k) {
        var tid = parseInt(k, 10), r = S.recs.get(Math.floor(tid / 100));
        if (!r) return;
        ks.push(k);
        qs.push({ method: 'eth_call', params: [{ to: S.imager, data: IMG.encodeFunctionData('render', [!r.landedAt, seedOf(r, tid % 100), [r.blockMinutes]]) }, 'latest'], fn: 'render', ifc: IMG });
      });
      var rs = await rpcBatch(qs);
      ks.forEach(function (k, i) {
        try {
          var src = 'data:image/svg+xml;base64,' + btoa(ethers.toUtf8String(dec(qs[i], rs[i])[0]));
          S.svg.set(k, src); sLS('bb1:svg:' + k, src);
          $$('img[data-svg="' + k + '"]').forEach(function (im) { im.src = src; });
        } catch (e) { }
      });
    }
  } finally {
    thumbBusy = false;
    if (thumbAgain) { thumbAgain = false; setTimeout(fillThumbs, 0); }
  }
}

/* ---------- names ---------- */
var ensProv = null;
function provider() {
  if (!ensProv) ensProv = new ethers.JsonRpcProvider(NET.rpc, NET.chainId, { staticNetwork: ethers.Network.from(NET.chainId), batchMaxCount: 1 });
  return ensProv;
}
function who(addr) {
  var a = lc(addr), n = S.ens.get(a);
  return '<span data-ens="' + esc(a) + '">' + esc(n || short(ethers.getAddress(addr))) + '</span>';
}
function fillEns() {
  $$('[data-ens]').forEach(function (el) {
    var a = el.getAttribute('data-ens');
    if (S.ens.has(a)) { var n = S.ens.get(a); if (n) el.textContent = n; return; }
    if (S.ensBusy.has(a) || S.ensBusy.size > 6) return;
    S.ensBusy.add(a);
    provider().lookupAddress(a).then(function (n) {
      S.ens.set(a, n || '');
      if (n) $$('[data-ens="' + a + '"]').forEach(function (e2) { e2.textContent = n; });
    }, function () { S.ens.set(a, ''); }).then(function () { S.ensBusy.delete(a); fillEns(); });
  });
}
async function resolveOwner(q) {
  q = String(q || '').trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(q)) return ethers.getAddress(q.toLowerCase());
  if (!/\./.test(q)) return null;
  var k = q.toLowerCase();
  if (S.resolved.has(k)) return S.resolved.get(k);
  var a = null;
  try { a = await provider().resolveName(k); } catch (e) { a = null; }
  S.resolved.set(k, a);
  if (a) S.ens.set(lc(a), k);
  return a;
}

/* ---------- token metadata and the live piece ---------- */
/* edition N of record rec as it will look when minted: tokenURI under a state override that
   gives the token an owner and sets minted = N. Read-only eth_call, nothing is sent. */
async function previewURI(tokenId) {
  var C = NET.contract, rec = Math.floor(tokenId / 100), idx = tokenId % 100, coder = ethers.AbiCoder.defaultAbiCoder();
  var own = ethers.keccak256(coder.encode(['uint256', 'uint256'], [tokenId, 2]));
  var base = BigInt(ethers.keccak256(coder.encode(['uint256', 'uint256'], [rec, 9])));
  var w1slot = ethers.toBeHex(base + 1n, 32);
  var w1 = BigInt(await rpc1('eth_getStorageAt', [C, w1slot, 'latest']));
  var mask = 0xffffn << 224n;
  var sd = {}; sd[own] = ethers.zeroPadValue(DEAD, 32); sd[w1slot] = ethers.toBeHex((w1 & ~mask) | (BigInt(idx) << 224n), 32);
  var ov = {}; ov[C] = { stateDiff: sd };
  var res = await rpc1('eth_call', [{ to: C, data: iface.encodeFunctionData('tokenURI', [tokenId]), gas: '0x1c9c380' }, 'latest', ov]);
  return iface.decodeFunctionResult('tokenURI', res)[0];
}
function parseMeta(uri) {
  var j, m = /^data:application\/json;base64,(.*)$/.exec(uri);
  if (m) j = JSON.parse(b64dec(m[1]));
  else if (/^data:application\/json/.test(uri)) j = JSON.parse(decodeURIComponent(uri.slice(uri.indexOf(',') + 1)));
  else throw new Error('bad tokenURI');
  var html = '', au = j.animation_url || '';
  var m2 = /^data:text\/html;base64,(.*)$/.exec(au);
  if (m2) html = b64dec(m2[1]);
  else if (/^data:text\/html/.test(au)) html = decodeURIComponent(au.slice(au.indexOf(',') + 1));
  return { name: j.name || '', image: j.image || '', html: html };
}
/* key: tokenId:landed for minted tokens, tokenId:p for the next-edition preview. Kept small: each page is ~470 KB. */
async function getMeta(tokenId, key) {
  if (S.meta.has(key)) return S.meta.get(key);
  var p = (async function () {
    var uri = /:p$/.test(key) ? await previewURI(tokenId) : (await read('tokenURI', [tokenId], '0x1c9c380'))[0];
    return parseMeta(uri);
  })();
  S.meta.set(key, p); S.metaOrder.push(key);
  while (S.metaOrder.length > 6) S.meta.delete(S.metaOrder.shift());
  p.catch(function () { S.meta.delete(key); });
  return p;
}
function mountPiece(art, meta, stale) {
  art.innerHTML = '';
  if (meta.image) { var im = document.createElement('img'); im.alt = ''; im.src = meta.image; art.appendChild(im); }
  if (!meta.html) return null;
  var f = document.createElement('iframe');
  f.setAttribute('scrolling', 'no');
  f.setAttribute('title', meta.name || 'piece');
  f.srcdoc = meta.html;
  art.appendChild(f);
  var t0 = Date.now();
  (function poll() {
    if (stale && stale()) return;
    var c = null;
    try { c = f.contentDocument && f.contentDocument.querySelector('canvas'); } catch (e) { }
    if (c && c.width > 0 && (canvasLive(c) || Date.now() - t0 > 30000)) { f.classList.add('on'); setTimeout(function () { var im2 = $('img', art); if (im2 && !(stale && stale())) im2.style.visibility = 'hidden'; }, 450); return; }
    if (Date.now() - t0 < 90000) setTimeout(poll, 250);
  })();
  return f;
}

/* ---------- routing ---------- */
function route() {
  var q = new URLSearchParams(location.search);
  var rec = parseInt(q.get('rec'), 10);
  if (rec > 0) { var ed = parseInt(q.get('ed'), 10); return { v: 'rec', rec: rec, ed: ed > 0 ? ed : null }; }
  if (q.get('owner')) return { v: 'owner', owner: q.get('owner') };
  var v = q.get('view');
  if (v === 'records' || v === 'about') return { v: v };
  return { v: 'now' };
}
function go(url, replace) {
  if (replace) history.replaceState(null, '', url); else history.pushState(null, '', url);
  if (!replace) { S.ed = null; window.scrollTo(0, 0); }
  render();
}
function setMeta(title, desc) {
  document.title = title;
  var m = $('meta[name="description"]'); if (m) m.setAttribute('content', desc);
}

/* ---------- shell ---------- */
function build() {
  document.body.innerHTML =
    '<header class="hd"><div class="brand">' + nav(H('view=now'), BRAND, 'bt') +
    '<div class="by">BY GREENCROSS ' + ext('https://x.com/greencrosslive', '@GREENCROSSLIVE') + (NETKEY === 'sepolia' ? ' // SEPOLIA' : '') + '</div></div>' +
    '<nav class="nav" aria-label="MAIN">' + nav(H('view=now'), 'NOW', 'nk-now') + nav(H('view=records'), 'RECORDS', 'nk-records') + nav(H('view=about'), 'ABOUT', 'nk-about') +
    '<a data-nav class="nk-me" id="navme" hidden href="#">MY RECORDS</a></nav>' +
    '<button id="wbtn" class="wb">CONNECT</button></header>' +
    '<main id="view"></main>' +
    '<div id="toast" class="toast"></div>' +
    '<div id="actbar" class="actbar"></div>' +
    '<nav class="tabs" aria-label="TABS">' + nav(H('view=now'), 'NOW', 'nk-now') + nav(H('view=records'), 'RECORDS', 'nk-records') + nav(H('view=about'), 'ABOUT', 'nk-about') +
    '<a href="#" id="tabme" class="nk-me">ME</a></nav>' +
    '<div id="picker"><div class="box" id="pbox"></div></div>' +
    '<div id="dlg" role="dialog" aria-modal="true"><div class="in" id="dlgin"></div></div>';
  $('#wbtn').addEventListener('click', function () {
    if (S.account) go(H('owner=' + S.account));
    else connect().catch(function (e) { if (!/CANCELLED|NO WALLET/.test(e.message || '')) toast(errText(e), true); });
  });
  $('#tabme').addEventListener('click', function (e) {
    e.preventDefault();
    if (S.account) go(H('owner=' + S.account));
    else connect().then(function (a) { go(H('owner=' + a)); }, function (e2) { if (!/CANCELLED|NO WALLET/.test(e2.message || '')) toast(errText(e2), true); });
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-nav]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    var h = a.getAttribute('href');
    if (!h || h === '#') return;
    e.preventDefault(); go(h);
  });
  window.addEventListener('popstate', function () { S.ed = null; render(); });
  document.addEventListener('keydown', function (e) {
    if ($('#dlg').classList.contains('on') || $('#picker').classList.contains('on')) { if (e.key === 'Escape') { closeShare(); closePicker(); } return; }
    if (/INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '')) return;
    if (e.key === 'ArrowLeft') stepEd(-1);
    if (e.key === 'ArrowRight') stepEd(1);
  });
}
function navState(v) {
  $$('.nav a, .tabs a').forEach(function (a) { a.classList.remove('on'); });
  var me = S.account && v.v === 'owner' && lc(S.resolved.get(lc(v.owner)) || v.owner) === lc(S.account);
  var k = me ? 'me' : v.v;
  $$('.nk-' + k).forEach(function (a) { a.classList.add('on'); });
  var nm = $('#navme');
  nm.hidden = !S.account;
  if (S.account) nm.setAttribute('href', H('owner=' + S.account));
  $('#wbtn').innerHTML = S.account ? who(S.account) : 'CONNECT';
}
var toastT = null;
function toast(h, err, keep) {
  var t = $('#toast');
  t.innerHTML = h || ''; t.className = 'toast' + (h ? ' on' : '') + (err ? ' err' : '');
  clearTimeout(toastT);
  if (h && !keep) toastT = setTimeout(function () { t.className = 'toast'; }, 7000);
}
function setAct(h) {
  setHTML($('#actbar'), h);
  document.body.classList.toggle('act', !!h);
}

/* ---------- render dispatch ---------- */
function render() {
  var v = route();
  navState(v);
  if (!NET.contract) { skel('x', '<section class="pg"><h1 class="h">RECORDER NOT ARMED</h1></section>'); setAct(''); return; }
  if (!S.loaded) {
    skel('loading', '<section class="pg"><div class="dim">' + (S.err ? 'THE CHAIN COULD NOT BE READ. RETRYING.' : 'READING THE CHAIN') + '</div></section>');
    setAct(''); return;
  }
  if (v.v === 'records') renderRecords();
  else if (v.v === 'about') renderAbout();
  else if (v.v === 'owner') renderOwner(v);
  else if (v.v === 'rec') {
    var r = S.recs.get(v.rec);
    if (!r) { skel('none' + v.rec, '<section class="pg"><h1 class="h">REC ' + p3(v.rec) + '</h1><p class="dim">THIS RECORD HAS NOT BEEN FILED.</p><p>' + nav(H('view=records'), 'ALL RECORDS') + '</p></section>'); setAct(''); setMeta('REC ' + p3(v.rec) + ' // ' + BRAND, DEF_DESC); }
    else renderStage(r, v.ed, false);
  } else {
    var live = inFlightRec();
    var land = latestLanded();
    var newest = S.recs.get(S.count);
    var show = live || (newest && !newest.landedAt ? newest : null) || land || newest;
    if (!show) { skel('empty', '<section class="pg"><h1 class="h">NO RECORD FILED YET</h1><p class="dim">THE NEXT RECORD FILES AT A BOARDING CALL.</p></section>'); setAct(''); setMeta(DEF_TITLE, DEF_DESC); }
    else renderStage(show, S.ed, true);
  }
  fillThumbs(); fillEns();
}
function skel(key, html) {
  var view = $('#view');
  if (S.sk !== key) { S.sk = key; view._h = null; }
  setHTML(view, html);
  view.className = '';
}

/* ---------- stage view: NOW and REC ---------- */
function viewable(r) {
  var l = [];
  for (var i = 1; i <= r.minted; i++) l.push(i);
  if (canMint(r, nowSec())) l.push(r.minted + 1);
  return l;
}
function defaultEd(r, isNow) {
  if (!r.minted) return 1;
  return (isNow || !r.landedAt) ? r.minted : 1;
}
var CUR = null; /* the record and edition on the stage */
function renderStage(r, edWant, isNow) {
  var now = nowSec(), ph = phase(r, now);
  var ed = edWant && edWant >= 1 && edWant <= r.cap ? edWant : defaultEd(r, isNow);
  CUR = { r: r, ed: ed, isNow: isNow };
  var key = 'stage:' + r.rec;
  var view = $('#view');
  if (S.sk !== key) {
    S.sk = key; view._h = null;
    setHTML(view,
      '<div class="sv"><section class="hero">' +
      '<div class="stage" id="stage"><div class="art" id="art"></div></div>' +
      '<div class="edrow"><button id="edprev" aria-label="PREVIOUS EDITION">PREV</button><div class="edl" id="edl"></div><button id="ednext" aria-label="NEXT EDITION">NEXT</button></div>' +
      '<div class="strip" id="strip"></div>' +
      '<div class="stat" id="stat"></div>' +
      '<div class="notice" id="notice"></div>' +
      '<div class="recrow" id="recrow"></div>' +
      '</section><aside class="panel" id="panel"></aside></div>');
    view.className = 'is-stage';
    $('#edprev').addEventListener('click', function () { stepEd(-1); });
    $('#ednext').addEventListener('click', function () { stepEd(1); });
    $('#strip').addEventListener('click', function (e) { var b = e.target.closest('[data-ed]'); if (b) pickEd(parseInt(b.getAttribute('data-ed'), 10)); });
    wireSwipe($('#stage'));
    $('#panel').addEventListener('click', function (e) {
      var b = e.target.closest('[data-copy]');
      if (b) copy(b.getAttribute('data-copy'), b);
    });
  }
  var tid = r.rec * 100 + ed, minted = ed <= r.minted, preview = !minted && canMint(r, now) && ed === r.minted + 1;
  var mine = minted && isMine(tid);

  /* hero */
  if (minted) setHero(r, ed, tid + ':' + landedKey(r));
  else if (preview) setHero(r, ed, tid + ':p');
  else {
    var msg = (ph === 'LANDED' && !r.minted) ? 'NO EDITIONS WERE COLLECTED. NONE OF THEM EXIST.'
      : ph === 'LANDED' ? 'EDITION ' + p2(ed) + ' NEVER EXISTED.'
      : 'EDITION ' + p2(ed) + ' IS NOT MINTED YET.';
    setVoid(msg);
  }

  /* edition row */
  var vl = viewable(r), pos = vl.indexOf(ed);
  $('#edprev').disabled = !vl.length || (pos === 0) || (pos < 0 && !vl.some(function (x) { return x < ed; }));
  $('#ednext').disabled = !vl.length || (pos === vl.length - 1) || (pos < 0 && !vl.some(function (x) { return x > ed; }));
  var l1, l2 = '';
  if (preview) { l1 = 'PREVIEW // EDITION ' + p2(ed); l2 = ed === 1 ? 'THE FIRST MINT RECEIVES THIS PIECE' : 'THE NEXT MINT RECEIVES THIS PIECE'; }
  else if (minted) { l1 = 'REC ' + p3(r.rec) + ' // ' + p2(ed); l2 = mine ? '<b>YOURS</b>' : (ownerOf(tid) ? 'HELD BY ' + who(ownerOf(tid)) : ''); }
  else if (ph === 'LANDED' && !r.minted) { l1 = 'REC ' + p3(r.rec); l2 = r.cap + ' EDITIONS NEVER EXISTED'; }
  else { l1 = 'REC ' + p3(r.rec) + ' // ' + p2(ed); l2 = ph === 'LANDED' ? 'NEVER EXISTED' : 'NOT MINTED YET'; }
  setHTML($('#edl'), '<div class="l1">' + l1 + '</div><div class="l2">' + l2 + '</div>');
  $('#edl').setAttribute('aria-label', preview ? 'PREVIEW // EDITION ' + p2(ed) + ' // ' + l2 : l1);

  /* strip */
  var sh = '', nextIdx = canMint(r, now) ? r.minted + 1 : 0;
  for (var i = 1; i <= r.cap; i++) {
    var t = r.rec * 100 + i, cls = 'slot' + (i === ed ? ' sel' : ''), inner, lab;
    if (i <= r.minted) { cls += ' got' + (isMine(t) ? ' mine' : ''); inner = thumb(r, i); lab = 'EDITION ' + p2(i) + (isMine(t) ? ', YOURS' : ''); }
    else if (ph === 'LANDED') { cls += ' never'; inner = '<span class="n">' + p2(i) + '</span>'; lab = 'EDITION ' + p2(i) + ', NEVER EXISTED'; }
    else if (i === nextIdx) { cls += ' next'; inner = '<span class="n lg">NEXT</span><span class="n sh">' + p2(i) + '</span>'; lab = 'EDITION ' + p2(i) + ', NEXT'; }
    else { cls += ' open'; inner = '<span class="n">' + p2(i) + '</span>'; lab = 'EDITION ' + p2(i) + ', NOT MINTED YET'; }
    sh += '<button class="' + cls + '" data-ed="' + i + '" aria-label="' + lab + '" title="' + lab + '">' + inner + '</button>';
  }
  setHTML($('#strip'), sh);
  $('#strip').style.setProperty('--n', r.cap);

  /* stat line */
  var left = shortState(r, now) + ' // ' + r.minted + '/' + r.cap, right = '';
  if (ph === 'INFLIGHT') right = 'CLOSES IN <span data-t="' + r.deadline + '">' + fmtClock(r.deadline - now) + '</span>';
  else if (ph === 'FILED') right = 'OPENS IN <span data-t="' + r.windowOpen + '">' + fmtClock(r.windowOpen - now) + '</span>';
  else if (ph === 'CLOSED') right = 'AWAITING LANDING';
  else { right = routeOf(r) || ''; }
  var neverN = ph === 'LANDED' ? r.cap - r.minted : 0;
  setHTML($('#stat'), '<span>' + left + '</span><span>' + right + '</span>');
  var notice = '';
  if (isNow && ph === 'LANDED') notice = 'THE NEXT RECORD FILES AT A BOARDING CALL';
  else if (neverN && r.minted) notice = (r.minted === 1 ? '01' : '01-' + p2(r.minted)) + ' COLLECTED // ' + (r.minted + 1 === r.cap ? p2(r.cap) : p2(r.minted + 1) + '-' + p2(r.cap)) + ' NEVER EXISTED';
  setHTML($('#notice'), notice);
  $('#notice').hidden = !notice;

  /* record row: record nav, scan, opensea */
  var prevR = S.recs.get(r.rec - 1), nextR = S.recs.get(r.rec + 1);
  var rr = '<span>' + (prevR ? nav(H('rec=' + prevR.rec), '&lt; REC ' + p3(prevR.rec)) : '<i>&lt; REC ---</i>') + '</span>' +
    '<span class="mid">' + (minted ? ext(scanUrl(tid), 'SCAN') + ext(osUrl(tid), 'OPENSEA') : '<i>SCAN</i><i>OPENSEA</i>') + '</span>' +
    '<span>' + (nextR ? nav(H('rec=' + nextR.rec), 'REC ' + p3(nextR.rec) + ' &gt;') : '<i>REC --- &gt;</i>') + '</span>';
  if (isNow) rr = rr.replace('<span class="mid">', '<span class="mid">' + nav(H('rec=' + r.rec + (minted || preview ? '&ed=' + ed : '')), 'RECORD'));
  setHTML($('#recrow'), rr);

  /* panel */
  setHTML($('#panel'), panelHtml(r, ph, now, isNow));

  /* action bar */
  var act = '';
  if (ph === 'INFLIGHT') {
    act += r.minted < r.cap ? '<button class="pri" data-a="mint">MINT ' + fmtEth(r.price) + ' ETH</button>' : '<button class="pri" disabled>ALL EDITIONS COLLECTED</button>';
    if (minted || preview) act += '<button data-a="gif">SHARE GIF</button>';
  } else {
    if (isNow && ph === 'LANDED') act += ext('https://x.com/greencrosslive', 'FOLLOW @GREENCROSSLIVE', 'btn pri');
    if (minted) act += '<button class="' + (isNow ? '' : 'pri') + '" data-a="gif">SHARE GIF</button>';
    else if (!isNow && ph === 'FILED') act += '<button class="pri" disabled>WINDOW OPENS SOON</button>';
  }
  setAct(act ? '<div class="ab" data-rec="' + r.rec + '" data-ed="' + ed + '">' + act + '</div>' : '');
  var ab = $('#actbar .ab');
  if (ab && !ab._wired) {
    ab._wired = true;
    ab.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
      var c = CUR; if (!c) return;
      if (b.getAttribute('data-a') === 'mint') doMint(c.r.rec);
      if (b.getAttribute('data-a') === 'gif') shareCurrent();
    });
  }

  /* title */
  var st = ph === 'LANDED' ? (routeOf(r) || 'DECLASSIFIED') : ph === 'INFLIGHT' ? 'IN FLIGHT' : ph === 'FILED' ? 'FILED' : 'WINDOW CLOSED';
  if (isNow && ph === 'LANDED') setMeta(DEF_TITLE, DEF_DESC);
  else setMeta('REC ' + p3(r.rec) + ' // ' + st + ' // ' + BRAND,
    ph === 'LANDED' ? 'BLACKBOX REC ' + p3(r.rec) + ', ' + (routeOf(r) || 'declassified') + '. ' + r.minted + ' of ' + r.cap + ' editions were collected in flight; the rest never existed.'
      : 'BLACKBOX REC ' + p3(r.rec) + ' is sealed in flight. ' + r.minted + ' of ' + r.cap + ' editions minted at ' + fmtEth(r.price) + ' ETH. The window closes at landing.');
}
function panelHtml(r, ph, now, isNow) {
  var d = dossier(r), h = '';
  function kv(k, v) { return '<div class="kv"><span>' + k + '</span><span>' + v + '</span></div>'; }
  if (isNow && ph === 'LANDED') {
    h += '<div class="blk"><div class="h2">NOW</div><p>THE NEXT RECORD FILES AT A BOARDING CALL.</p><p>' + ext('https://x.com/greencrosslive', 'FOLLOW @GREENCROSSLIVE') + '</p></div>';
  }
  h += '<div class="blk"><div class="h2">REC ' + p3(r.rec) + '</div>';
  h += kv('STATE', stateWord(r, now));
  h += kv('HASH', '<button class="lnk" data-copy="' + esc(r.passHash) + '" title="COPY FULL HASH">' + esc(r.passHash.slice(0, 10) + '..' + r.passHash.slice(-6)) + '</button>');
  h += kv(ph === 'FILED' ? 'WINDOW OPENS' : 'WINDOW OPENED', fmtWhen(r.windowOpen));
  if (ph === 'LANDED') h += kv('WINDOW CLOSED', fmtWhen(r.landedAt));
  else if (ph === 'INFLIGHT' || ph === 'FILED') h += kv('CLOSES IN', '<span data-t="' + r.deadline + '">' + fmtClock(r.deadline - now) + '</span><br>' + fmtWhen(r.deadline) + '<br><span class="dim">AT THE LATEST. LANDING CLOSES IT.</span>');
  else h += kv('WINDOW CLOSED', fmtWhen(r.deadline));
  h += kv('MINUTES', r.blockMinutes);
  h += kv('CAP', r.cap);
  h += kv('MINTED', r.minted);
  if (ph === 'LANDED') h += kv('NEVER EXISTED', r.cap - r.minted);
  h += kv('PRICE', fmtEth(r.price) + ' ETH');
  if (ph === 'LANDED') {
    if (d.from) h += kv('ROUTE', esc(d.from + ' > ' + d.to));
    if (d.date) h += kv('DATE', esc(d.date));
    if (d.seat) h += kv('SEAT', esc(d.seat));
    if (d.min) h += kv('FLIGHT MINUTES', esc(d.min));
    if (d.km) h += kv('KM', esc(d.km));
    if (d.ac) h += kv('AIRCRAFT', esc(d.ac));
  } else {
    h += kv('ROUTE DATE SEAT', 'SEALED UNTIL LANDING');
  }
  h += '</div>';
  h += '<div class="blk"><div class="h2">COLLECTORS</div>';
  if (!r.minted) h += '<p class="dim">' + (ph === 'LANDED' ? 'NONE. NO EDITION OF THIS RECORD EXISTS.' : 'NONE YET.') + '</p>';
  for (var i = 1; i <= r.minted; i++) {
    var t = r.rec * 100 + i, o = ownerOf(t);
    h += '<div class="kv col"><span>' + nav(H('rec=' + r.rec + '&ed=' + i), p2(i)) + '</span><span>' + (o ? nav(H('owner=' + o), who(o)) + (isMine(t) ? ' <b>YOURS</b>' : '') : '..') + '</span></div>';
  }
  h += '</div>';
  if (isNow) {
    var ids = Array.from(S.recs.keys()).sort(function (a, b) { return b - a; }).slice(0, 3);
    h += '<div class="blk"><div class="h2">LAST RECORDS</div><div class="mini">' + ids.map(function (n) { return tile(S.recs.get(n), now, true); }).join('') + '</div><p>' + nav(H('view=records'), 'ALL RECORDS') + '</p></div>';
  }
  if (isNow) h += auctionHtml(now);
  h += '<div class="blk foot">CONTRACT ' + ext(NET.explorer + '/address/' + NET.contract, esc(short(NET.contract))) + '</div>';
  return h;
}
function setHero(r, ed, key) {
  var art = $('#art'); if (!art || art._key === key) return;
  art._key = key;
  var tid = r.rec * 100 + ed;
  var sk = tid + ':' + landedKey(r), src = S.svg.get(sk);
  art.innerHTML = src ? '<img alt="" src="' + src + '">' : '<img alt="" data-svg="' + sk + '"><div class="empty">LOADING</div>';
  getMeta(tid, key).then(function (meta) {
    if (art._key !== key || !art.isConnected) return;
    var f = mountPiece(art, meta, function () { return art._key !== key || !art.isConnected; });
    if (f) f.style.pointerEvents = 'none';
  }).catch(function (e) {
    console.warn(e);
    if (art._key === key) art.innerHTML = '<div class="empty">PIECE UNAVAILABLE. RETRY LATER.</div>';
    art._key = null;
  });
}
function setVoid(msg) {
  var art = $('#art'), key = 'void:' + msg;
  if (!art || art._key === key) return;
  art._key = key;
  art.innerHTML = '<div class="empty void">' + esc(msg) + '</div>';
}
function pickEd(ed) {
  if (!CUR) return;
  if (CUR.isNow) { S.ed = ed; render(); return; }
  go(H('rec=' + CUR.r.rec + '&ed=' + ed), true);
}
function stepEd(dir) {
  if (!CUR) return;
  var vl = viewable(CUR.r), ed = CUR.ed, pos = vl.indexOf(ed), nx = null;
  if (!vl.length) return;
  if (pos >= 0) nx = vl[pos + dir];
  else nx = dir > 0 ? vl.filter(function (x) { return x > ed; })[0] : vl.filter(function (x) { return x < ed; }).pop();
  if (nx) pickEd(nx);
}
function wireSwipe(el) {
  var x0 = null, y0 = 0;
  el.addEventListener('touchstart', function (e) { if (e.touches.length === 1) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive: true });
  el.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) stepEd(dx < 0 ? 1 : -1);
  }, { passive: true });
}
function shareCurrent() {
  if (!CUR) return;
  var r = CUR.r, ed = CUR.ed, tid = r.rec * 100 + ed;
  var preview = ed > r.minted;
  if (preview && !(canMint(r, nowSec()) && ed === r.minted + 1)) return;
  openShare({ rec: r.rec, index: ed, tokenId: tid, preview: preview, mine: !preview && isMine(tid) });
}

/* ---------- tiles (records grid, collector grid, last records) ---------- */
function tile(r, now, small) {
  var t = r.minted ? thumb(r, r.minted) : '<div class="blank">' + p3(r.rec) + '</div>';
  var route = routeOf(r);
  return '<a data-nav class="tile' + (small ? ' sm' : '') + '" href="' + esc(H('rec=' + r.rec)) + '"><div class="tt">' + t + '</div>' +
    '<div class="tl"><b>REC ' + p3(r.rec) + '</b><span>' + shortState(r, now) + '</span></div>' +
    '<div class="tl dim"><span>' + (route ? esc(route) : 'ROUTE SEALED') + '</span><span>' + r.minted + '/' + r.cap + '</span></div></a>';
}
function renderRecords() {
  var now = nowSec(), ids = Array.from(S.recs.keys()).sort(function (a, b) { return b - a; });
  var ed = 0, never = 0;
  S.recs.forEach(function (r) { ed += r.minted; if (r.landedAt) never += r.cap - r.minted; });
  skel('records', '<section class="pg"><h1 class="h">RECORDS</h1>' +
    '<div class="sum"><span>RECORDS ' + ids.length + '</span><span>EDITIONS MINTED ' + ed + '</span><span>EDITIONS THAT NEVER EXISTED ' + never + '</span></div>' +
    (ids.length ? '<div class="grid">' + ids.map(function (n) { return tile(S.recs.get(n), now); }).join('') + '</div>' : '<p class="dim">NO RECORD FILED YET.</p>') +
    '</section>');
  setAct('');
  setMeta('RECORDS // ' + BRAND, 'Every BLACKBOX record filed so far: ' + ids.length + ' records, ' + ed + ' editions minted, ' + never + ' editions that never existed.');
}

/* ---------- collector view ---------- */
var ownerReq = 0;
function renderOwner(v) {
  var q = v.owner, addr = /^0x[0-9a-fA-F]{40}$/.test(q) ? ethers.getAddress(q.toLowerCase()) : S.resolved.get(lc(q));
  if (addr === undefined) {
    skel('owner:' + q, '<section class="pg"><h1 class="h">' + esc(q.toUpperCase()) + '</h1><p class="dim">RESOLVING NAME</p></section>');
    setAct('');
    var my = ++ownerReq;
    resolveOwner(q).then(function () { if (my === ownerReq) render(); });
    return;
  }
  if (!addr) {
    skel('owner:' + q, '<section class="pg"><h1 class="h">' + esc(q.toUpperCase()) + '</h1><p class="dim">THIS NAME DOES NOT RESOLVE TO AN ADDRESS.</p></section>');
    setAct(''); return;
  }
  var now = nowSec(), held = [], recsFrom = new Set();
  var ids = Array.from(S.recs.keys()).sort(function (a, b) { return b - a; });
  ids.forEach(function (n) {
    var r = S.recs.get(n);
    for (var i = 1; i <= r.minted; i++) { var t = n * 100 + i; if (lc(ownerOf(t)) === lc(addr)) { held.push({ r: r, i: i, t: t }); recsFrom.add(n); } }
  });
  var mineView = S.account && lc(S.account) === lc(addr);
  var link = SITE + '?owner=' + (S.ens.get(lc(addr)) || addr) + netQ();
  var h = '<section class="pg"><div class="ownh"><h1 class="h">' + who(addr) + (mineView ? ' <b>YOURS</b>' : '') + '</h1>' +
    '<div class="dim">' + held.length + ' EDITION' + (held.length === 1 ? '' : 'S') + ' HELD // FROM ' + recsFrom.size + ' RECORD' + (recsFrom.size === 1 ? '' : 'S') + '</div>' +
    '<div class="btns"><button id="ocopy" data-copy="' + esc(link) + '">COPY LINK</button>' +
    ((!S.account || mineView) ? ext('https://x.com/intent/post?text=' + encodeURIComponent('my BLACKBOX records: ' + link), 'SHARE', 'btn') : '') +
    ext(NET.explorer + '/address/' + addr, 'SCAN', 'btn') + '</div></div>';
  if (!held.length) h += '<p class="empty-l">NO RECORDS HELD BY THIS ADDRESS.</p>';
  else h += '<div class="grid">' + held.map(function (x) {
    var route = routeOf(x.r);
    return '<a data-nav class="tile" href="' + esc(H('rec=' + x.r.rec + '&ed=' + x.i)) + '"><div class="tt">' + thumb(x.r, x.i) + '</div>' +
      '<div class="tl"><b>REC ' + p3(x.r.rec) + ' // ' + p2(x.i) + '</b><span>' + (isMine(x.t) ? 'YOURS' : '') + '</span></div>' +
      '<div class="tl dim"><span>' + shortState(x.r, now) + '</span><span>' + (route ? esc(route) : 'SEALED') + '</span></div></a>';
  }).join('') + '</div>';
  h += '</section>';
  skel('owner:' + lc(addr), h);
  var oc = $('#ocopy'); if (oc && !oc._w) { oc._w = true; oc.addEventListener('click', function () { copy(oc.getAttribute('data-copy'), oc); }); }
  setAct('');
  var nm = S.ens.get(lc(addr)) || short(addr);
  setMeta(nm.toUpperCase() + ' // COLLECTOR // ' + BRAND, held.length + ' BLACKBOX editions held by ' + nm + '.');
}

/* ---------- about ---------- */
var STATEMENT = [
  'I spend a lot of my life in airplanes. Hours in a seat with no signal, between one place and the next.',
  'BLACKBOX turns those hours into a record. When the gate calls my group, my boarding pass is hashed and filed on Ethereum. From that moment until the plane is down, editions of that flight can be minted. When it lands, the window closes. Whatever was not collected never existed, and it never will.',
  'A flight recorder is the part of the aircraft built to survive. Here the chain is the recorder. Every piece is drawn by code stored in the contract, from the record and nothing else. No server holds the art. If this website goes away, the pieces stay where they are.',
  'While the plane is in the air the piece is sealed: a label and a hash. At landing it declassifies. Route, date, seat and minutes in the air are written into it and stay there.',
  'The flight sets the terms. A short flight has few editions and each one costs more. A long flight has more editions and each one costs less.',
  'DEPARTURE_PROTOCOL.EXE did this with one piece per flight. Six of its ten flights were never collected. BLACKBOX keeps the rule and lets more people into each flight.',
  'After the last flight of the trip, every record is combined into one piece, THE COMPLETE JOURNEY, sold once by auction.'
];
function renderAbout() {
  var C = NET.contract;
  var h = '<section class="pg about"><h1 class="h">ABOUT</h1>' +
    '<div class="h2">STATEMENT</div><div class="prose">' + STATEMENT.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '<p class="sig">GREENCROSS</p></div>' +
    '<div class="h2">HOW IT WORKS</div><div class="prose">' +
    '<p>A record files on Ethereum at the boarding call. Before that, nothing exists.</p>' +
    '<p>Editions can be minted only while the window is open: from the filing until the record lands, and at the latest one hour after the scheduled arrival.</p>' +
    '<p>The number of editions is the scheduled flight time in hours, rounded, between 1 and 13. The price of each edition is 0.013 + 0.0536 x (13 - editions) / 12 ETH. REC 001 had 5 editions at 0.048733 ETH. REC 002 had 12 editions at 0.017467 ETH.</p>' +
    '<p>Editions are minted in order. Each edition of a flight is a different piece, drawn from the record\'s hash and the edition number.</p>' +
    '<p>In flight a piece is sealed and shows a label and the hash. After landing it is declassified and shows the route, date, seat, flight minutes and distance. Every edition updates on its own. Nobody needs to do anything.</p>' +
    '<p>Editions that were not minted never exist. There is no reserve and no later sale. The artist keeps no copies.</p>' +
    '<p>The route is announced when the record files. The flight number and the exact arrival time are never published.</p>' +
    '<p>Art and metadata are rendered on-chain by the contract. The artwork uses the PANDORA engine, already stored on Ethereum by DITHERVOID // STORMGLASS.</p>' +
    '<p>Resales carry a royalty request of 6.9% (EIP-2981). Marketplaces may ignore it. Every payment is forwarded to the artist in the same transaction. The contract keeps nothing.</p>' +
    '</div>' +
    '<div class="h2">QUESTIONS</div><div class="prose faq">' +
    '<p><b>WALLET</b>A wallet is an app that holds your Ethereum address and signs transactions. MetaMask, Rabby and Coinbase Wallet work. On a phone, open this page in the browser inside your wallet app.</p>' +
    '<p><b>COST</b>You pay the edition price plus a small network fee (gas). The network fee goes to Ethereum, not to the artist.</p>' +
    '<p><b>WHAT YOU RECEIVE</b>An ERC-721 token in your wallet. The art lives in the contract, so the token is the piece.</p>' +
    '<p><b>WHERE TO SEE IT</b>Under MY RECORDS on this site, on OpenSea and on Etherscan.</p>' +
    '</div>' +
    '<div class="h2">LINKS</div><div class="links">' +
    ext(NET.explorer + '/address/' + C + '#code', 'CONTRACT ON ETHERSCAN (VERIFIED)') +
    ext(OS_ASSET + C, 'OPENSEA') +
    ext('https://greencross.art', 'GREENCROSS.ART') +
    ext('https://x.com/greencrosslive', 'X.COM/GREENCROSSLIVE') +
    ext('https://dithervoid.art/', 'DITHERVOID // STORMGLASS') +
    '</div><p class="dim mono">' + esc(C) + '</p></section>';
  skel('about', h);
  setAct('');
  setMeta('ABOUT // ' + BRAND, DEF_DESC);
}

/* ---------- auction (the 1/1, shown on NOW once it starts) ---------- */
function bidMin(a) {
  var m = a.highBid > 0n ? a.highBid + (a.highBid + 9n) / 10n : a.reserve;
  var u = 1000000000000n;
  return ((m + u - 1n) / u) * u;
}
function auctionHtml(now) {
  var a = S.auction;
  if (!a || !a.end) return '';
  var live = !a.settled && now >= a.start && now < a.end;
  var st = a.settled ? 'SETTLED' : now < a.start ? 'NOT STARTED' : live ? 'LIVE' : 'CLOSED';
  var min = bidMin(a);
  return '<div class="blk"><div class="h2">THE COMPLETE JOURNEY // 1/1</div>' +
    '<div class="kv"><span>STATE</span><span>' + st + '</span></div>' +
    '<div class="kv"><span>HIGH BID</span><span>' + (a.highBid > 0n ? fmtEth(a.highBid) + ' ETH' : 'NONE, RESERVE ' + fmtEth(a.reserve) + ' ETH') + '</span></div>' +
    (a.highBid > 0n ? '<div class="kv"><span>BIDDER</span><span>' + who(a.highBidder) + '</span></div>' : '') +
    '<div class="kv"><span>' + (now < a.start ? 'STARTS IN' : 'ENDS IN') + '</span><span>' + (a.settled ? 'SETTLED' : '<span data-t="' + (now < a.start ? a.start : a.end) + '">--</span>') + '</span></div>' +
    '<div class="kv"><span>MIN BID</span><span>' + fmtEth(min) + ' ETH</span></div>' +
    (live ? '<div class="bidrow"><input id="bidin" inputmode="decimal" autocomplete="off" aria-label="BID IN ETH" value="' + esc(ethers.formatEther(min)) + '"><button class="pri" id="bidbtn">BID</button></div>' : '') +
    '</div>';
}
document.addEventListener('click', function (e) { if (e.target && e.target.id === 'bidbtn') doBid(); });
async function doBid() {
  var a = S.auction;
  try {
    var wei = ethers.parseEther(($('#bidin').value || '0').trim());
    if (wei < bidMin(a)) { toast('BELOW THE MINIMUM BID', true); return; }
    toast('CONNECTING', false, true);
    await connect(); await ensureChain();
    toast('CONFIRM IN WALLET', false, true);
    var hash = await S.wp.request({ method: 'eth_sendTransaction', params: [{ from: S.account, to: NET.contract, data: iface.encodeFunctionData('bid', []), value: '0x' + wei.toString(16) }] });
    toast('PENDING ' + ext(NET.explorer + '/tx/' + hash, esc(short(hash))), false, true);
    var rc = await waitReceipt(hash);
    toast(rc.status === '0x1' ? 'BID CONFIRMED' : 'BID FAILED', rc.status !== '0x1');
    refresh();
  } catch (e) { toast(esc(errText(e)), true); }
}

/* ---------- wallet ---------- */
var found = [];
window.addEventListener('eip6963:announceProvider', function (e) {
  if (e.detail && e.detail.info && !found.some(function (p) { return p.info.uuid === e.detail.info.uuid; })) found.push(e.detail);
});
function discover() { window.dispatchEvent(new Event('eip6963:requestProvider')); }
function walletList() {
  var l = found.slice();
  if (!l.length && window.ethereum) l = [{ info: { name: 'BROWSER WALLET', uuid: 'inj' }, provider: window.ethereum }];
  return l;
}
function errText(e) {
  var m = (e && (e.shortMessage || e.message || e.reason)) || String(e);
  if (e && (e.code === 4001 || e.code === 'ACTION_REJECTED')) return 'REJECTED IN WALLET';
  if (/insufficient funds/i.test(m)) return 'NOT ENOUGH ETH IN THIS WALLET';
  return String(m).slice(0, 120).toUpperCase();
}
function closePicker() { $('#picker').classList.remove('on'); if (pickRej) { var r = pickRej; pickRej = null; r(new Error('CANCELLED')); } }
var pickRej = null;
function chooseWallet(list) {
  return new Promise(function (resolve, reject) {
    pickRej = reject;
    var box = $('#pbox');
    box.innerHTML = '<div class="h2">CONNECT A WALLET</div>';
    list.forEach(function (w) {
      var b = document.createElement('button');
      b.className = 'wopt';
      b.innerHTML = (w.info.icon ? '<img alt="" src="' + esc(w.info.icon) + '">' : '') + esc(String(w.info.name || 'WALLET').toUpperCase());
      b.addEventListener('click', function () { pickRej = null; $('#picker').classList.remove('on'); resolve(w); });
      box.appendChild(b);
    });
    var c = document.createElement('button'); c.textContent = 'CANCEL';
    c.addEventListener('click', closePicker);
    box.appendChild(c);
    $('#picker').classList.add('on');
  });
}
function noWallet() {
  var u = location.href, hp = location.host + location.pathname + location.search;
  var box = $('#pbox');
  box.innerHTML = '<div class="h2">NO WALLET IN THIS BROWSER</div>' +
    (isMobile()
      ? '<p class="dim">OPEN THIS PAGE IN YOUR WALLET APP.</p>' +
        '<a class="btn" href="https://metamask.app.link/dapp/' + esc(hp) + '">OPEN IN METAMASK</a>' +
        '<a class="btn" href="https://go.cb-w.com/dapp?cb_url=' + encodeURIComponent(u) + '">OPEN IN COINBASE WALLET</a>' +
        '<a class="btn" href="https://rabby.io" target="_blank" rel="noopener">GET RABBY</a>'
      : '<p class="dim">INSTALL A WALLET EXTENSION SUCH AS METAMASK, RABBY OR COINBASE WALLET, THEN RELOAD.</p>' +
        ext('https://metamask.io/download/', 'METAMASK', 'btn') + ext('https://rabby.io', 'RABBY', 'btn') + ext('https://www.coinbase.com/wallet/downloads', 'COINBASE WALLET', 'btn')) +
    '<button id="pclose">CLOSE</button>';
  $('#pclose').addEventListener('click', closePicker);
  $('#picker').classList.add('on');
}
async function connect() {
  if (S.account && S.wp) return S.account;
  discover(); await sleep(80);
  var list = walletList();
  if (!list.length) { noWallet(); throw new Error('NO WALLET FOUND'); }
  var w = await chooseWallet(list);
  var accts = await w.provider.request({ method: 'eth_requestAccounts' });
  if (!accts || !accts[0]) throw new Error('NO ACCOUNT');
  useWallet(w.provider, accts[0]);
  return S.account;
}
function useWallet(p, a) {
  S.wp = p; S.account = ethers.getAddress(a);
  if (p.on && !p._bbw) {
    p._bbw = true;
    p.on('accountsChanged', function (x) {
      if (S.wp !== p) return;
      S.account = x && x[0] ? ethers.getAddress(x[0]) : null; if (!S.account) S.wp = null;
      render();
    });
  }
  render();
}
async function silentConnect() {
  discover(); await sleep(300);
  var l = walletList();
  for (var i = 0; i < l.length && !S.account; i++) {
    try { var a = await l[i].provider.request({ method: 'eth_accounts' }); if (a && a[0]) useWallet(l[i].provider, a[0]); } catch (e) { }
  }
}
async function ensureChain() {
  var want = '0x' + NET.chainId.toString(16);
  var cur = await S.wp.request({ method: 'eth_chainId' });
  if (parseInt(cur, 16) === NET.chainId) return;
  try {
    await S.wp.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: want }] });
  } catch (e) {
    if (e && e.code === 4902 && NETKEY === 'sepolia') {
      await S.wp.request({ method: 'wallet_addEthereumChain', params: [{ chainId: want, chainName: 'Sepolia', nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: [NET.rpc], blockExplorerUrls: [NET.explorer] }] });
    } else throw e;
  }
}
async function waitReceipt(hash) {
  for (var i = 0; i < 400; i++) {
    var r = (await rpcBatch([{ method: 'eth_getTransactionReceipt', params: [hash] }]))[0];
    if (r.ok && r.v) return r.v;
    await sleep(3000);
  }
  throw new Error('RECEIPT TIMEOUT');
}
var minting = false;
async function doMint(rec) {
  var r = S.recs.get(rec);
  if (!r || minting) return;
  minting = true;
  try {
    toast('CONNECTING', false, true);
    await connect(); await ensureChain();
    r = S.recs.get(rec);
    if (!canMint(r, nowSec())) { toast('THE WINDOW IS CLOSED OR ALL EDITIONS ARE COLLECTED.', true); return; }
    toast('CONFIRM IN WALLET', false, true);
    var hash = await S.wp.request({ method: 'eth_sendTransaction', params: [{ from: S.account, to: NET.contract, data: iface.encodeFunctionData('mint', [rec]), value: '0x' + r.price.toString(16) }] });
    toast('PENDING ' + ext(NET.explorer + '/tx/' + hash, esc(short(hash))), false, true);
    var rc = await waitReceipt(hash);
    if (rc.status !== '0x1') { toast('FAILED. THE WINDOW MAY HAVE CLOSED.', true); return; }
    var tokenId = null, idx = null;
    (rc.logs || []).forEach(function (lg) {
      if (tokenId !== null || !lg.address || lg.address.toLowerCase() !== NET.contract.toLowerCase()) return;
      try { var p = iface.parseLog({ topics: lg.topics, data: lg.data }); if (p && p.name === 'Minted') { tokenId = Number(p.args.tokenId); idx = Number(p.args.index); } } catch (e) { }
    });
    if (tokenId === null) { toast('CONFIRMED. TOKEN ID NOT FOUND IN THE RECEIPT.'); refresh(); return; }
    S.owners.set(tokenId, S.account);
    toast('CONFIRMED // ' + esc(pieceName(rec, idx)));
    await refresh();
    if (CUR && CUR.r.rec === rec) pickEd(idx);
    openShare({ rec: rec, index: idx, tokenId: tokenId, mine: true });
  } catch (e) {
    if (/CANCELLED|NO WALLET/.test((e && e.message) || '')) toast('');
    else toast(esc(errText(e)), true);
  } finally { minting = false; }
}

/* ---------- tweets ---------- */
var POOLS = {
  liveWhen: ['while the plane was still in the air', 'before the plane landed', 'mid flight', 'at altitude', 'while the window was open', 'somewhere over the ocean'],
  doneWhen: ['after the plane landed', 'from a finished flight', 'once the window closed', 'after declassification', 'from a completed route'],
  liveState: ['sealed until landing', 'still sealed', 'sealed in flight', 'unreadable until touchdown'],
  doneState: ['declassified at landing', 'declassified', 'route and seat now public', 'filed and landed'],
  verb: ['just collected', 'just minted', 'picked up', 'claimed', 'logged', 'secured'],
  noun: ['flight recorder entry', 'flight record', 'black box entry', 'boarding record', 'ledger entry'],
  tail: ['rendered entirely from the chain.', 'every flight writes a record.', 'unminted supply never exists.', 'one window per flight.', 'the plane is the clock.', 'no landing, no edition.'],
  tag: ['#ethereum', '#onchain', '#nft']
};
var TEMPLATES = [
  '{verb} {name} by @greencrosslive {when}. {tag}{phrase} {link}',
  'a {noun}, {state}: {name} by @greencrosslive. {tag}{phrase} {link}',
  '{name} by @greencrosslive. {tail} {tag}{phrase} {link}',
  '{verb} a {noun} {when}. {name} by @greencrosslive. {tag}{phrase} {link}',
  '{noun}, {state}. {name} by @greencrosslive. {tail} {tag}{phrase} {link}',
  'filed on ethereum {when}: {name} by @greencrosslive. {tag}{phrase} {link}',
  '{tail} {name} by @greencrosslive, {state}. {tag}{phrase} {link}',
  '{verb} {name} by @greencrosslive. {state}. {tag}{phrase} {link}',
  'one more record in the black box. {name} by @greencrosslive, {when}. {tag}{phrase} {link}',
  'flight record in hand, {state}: {name} by @greencrosslive. {tail} {tag}{phrase} {link}'
];
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function tweetLen(text, link) { return text.split(link).join('x'.repeat(23)).length; }
function makeTweet(ctx, seen) {
  var link = deepLink(ctx.rec), name = pieceName(ctx.rec, ctx.index);
  var phrase = ctx.open ? 'currently minting at:' : 'recorded at:';
  var out = null;
  var tpls = ctx.mine ? TEMPLATES : TEMPLATES.filter(function (t) { return t.indexOf('{verb}') < 0 && t.indexOf('in hand') < 0; });
  for (var tries = 0; tries < 400; tries++) {
    var tpl = pick(tpls);
    var tag = Math.random() < 0.22 ? pick(POOLS.tag) + ' ' : '';
    var text = tpl
      .replace('{verb}', pick(POOLS.verb)).replace('{noun}', pick(POOLS.noun)).replace('{tail}', pick(POOLS.tail))
      .replace('{when}', pick(ctx.open ? POOLS.liveWhen : POOLS.doneWhen)).replace('{state}', pick(ctx.open ? POOLS.liveState : POOLS.doneState))
      .replace('{name}', name).replace('{tag}', tag).replace('{phrase}', phrase).replace('{link}', link);
    if (tweetLen(text, link) > 280) continue;
    if (seen && seen.has(text)) continue;
    out = text; break;
  }
  if (!out) out = 'BLACKBOX: ' + name + ' by @greencrosslive. ' + phrase + ' ' + link;
  if (seen) seen.add(out);
  return { text: out, body: out.split(link).join('').replace(/\s+$/, ''), link: link, name: name, len: tweetLen(out, link) };
}

/* ---------- share dialog ---------- */
var SH = null;
function openShare(p) {
  var r = S.recs.get(p.rec);
  var open = r ? phase(r, nowSec()) === 'INFLIGHT' : true;
  SH = { rec: p.rec, index: p.index, tokenId: p.tokenId, open: open, mine: !!p.mine, preview: !!p.preview, seen: new Set(), saved: false, file: null, busy: false, tw: null };
  var name = pieceName(p.rec, p.index);
  var dl = $('#dlgin');
  dl.innerHTML =
    '<div class="top"><span class="h2">SHARE</span><button id="shx" aria-label="CLOSE">CLOSE</button></div>' +
    '<div class="dim">' + esc(name) + (p.preview ? ' // PREVIEW' : '') + '</div>' +
    '<div class="art" id="shart"><div class="empty">LOADING</div></div>' +
    '<div class="step"><div class="h">STEP 1</div><button class="pri" id="shdl">DOWNLOAD GIF</button><div class="prog" id="shprog"><i></i></div><div class="msg" id="shnote"></div></div>' +
    '<div class="step"><div class="h">STEP 2</div><button class="pri" id="shx2" disabled>SHARE TO X</button><div class="dim" id="shlock">SAVE THE GIF FIRST, THEN ATTACH IT IN X</div></div>' +
    '<div class="step"><div class="h">TEXT</div><div class="tw" id="shtw"></div><div class="grid2"><button id="shre">NEW TEXT</button><button id="shct">COPY TEXT</button></div></div>' +
    '<div class="step"><div class="h">OTHER</div><div class="grid2"><button id="shcl">COPY LINK</button><a id="shfc" class="btn" target="_blank" rel="noopener">FARCASTER</a><a id="shtg" class="btn" target="_blank" rel="noopener">TELEGRAM</a>' +
    (navigator.share ? '<button id="shns">MORE</button>' : '') + '</div></div>';
  $('#dlg').classList.add('on');
  document.body.classList.add('modal');
  $('#shx').addEventListener('click', closeShare);
  $('#shdl').addEventListener('click', onDownload);
  $('#shx2').addEventListener('click', onShareX);
  $('#shre').addEventListener('click', function () { newTweet(); });
  $('#shct').addEventListener('click', function () { copy(SH.tw.text, this); });
  $('#shcl').addEventListener('click', function () { copy(SH.tw.link, this); });
  if ($('#shns')) $('#shns').addEventListener('click', function () { navigator.share({ text: SH.tw.body, url: SH.tw.link }).catch(function () { }); });
  newTweet();
  var key = p.tokenId + ':' + (p.preview ? 'p' : (r && r.landedAt ? 1 : 0));
  var shid = SH;
  getMeta(p.tokenId, key).then(function (meta) {
    if (SH !== shid) return;
    shid.iframe = mountPiece($('#shart'), meta, function () { return SH !== shid; });
  }).catch(function () { if (SH !== shid) return; $('#shart').innerHTML = '<div class="empty">PIECE UNAVAILABLE</div>'; $('#shnote').textContent = 'THE PIECE COULD NOT BE LOADED'; });
}
function closeShare() {
  $('#dlg').classList.remove('on');
  $('#dlgin').innerHTML = '';
  document.body.classList.remove('modal');
  SH = null;
}
function newTweet() {
  var t = makeTweet({ rec: SH.rec, index: SH.index, open: SH.open, mine: SH.mine }, SH.seen);
  SH.tw = t;
  $('#shtw').textContent = t.text;
  $('#shfc').href = 'https://farcaster.xyz/~/compose?text=' + encodeURIComponent(t.body) + '&embeds[]=' + encodeURIComponent(t.link);
  $('#shtg').href = 'https://t.me/share/url?url=' + encodeURIComponent(t.link) + '&text=' + encodeURIComponent(t.body);
}
async function copy(txt, btn) {
  var ok = false;
  try { await navigator.clipboard.writeText(txt); ok = true; } catch (e) {
    try { var ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (e2) { }
  }
  if (!btn) return;
  var old = btn.getAttribute('data-l') || btn.innerHTML;
  btn.setAttribute('data-l', old);
  btn.textContent = ok ? 'COPIED' : 'COPY FAILED';
  setTimeout(function () { btn.innerHTML = old; }, 1600);
}
function onShareX() {
  if (!SH || !SH.saved) return;
  var url = 'https://x.com/intent/post?text=' + encodeURIComponent(SH.tw.text);
  if (isMobile()) location.href = url; else window.open(url, '_blank', 'noopener');
}
function markSaved() {
  SH.saved = true;
  $('#shx2').disabled = false;
  $('#shlock').textContent = 'GIF SAVED. ATTACH IT IN THE X COMPOSER.';
  $('#shdl').textContent = 'DOWNLOAD GIF AGAIN';
}
async function waitCanvas(f, ms) {
  var t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { var c = f.contentDocument && f.contentDocument.querySelector('canvas'); if (c && c.width > 0) return c; } catch (e) { }
    await sleep(150);
  }
  throw new Error('NO CANVAS');
}
function canvasLive(c) {
  try {
    var t = document.createElement('canvas'); t.width = t.height = 32;
    var x = t.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, 32, 32);
    var d = x.getImageData(0, 0, 32, 32).data, first = d[0] + ',' + d[1] + ',' + d[2];
    for (var i = 4; i < d.length; i += 4) if ((d[i] + ',' + d[i + 1] + ',' + d[i + 2]) !== first) return true;
  } catch (e) { return true; }
  return false;
}
function setProg(p, txt) {
  $('#shprog').style.display = 'block';
  $('#shprog i').style.width = Math.round(p * 100) + '%';
  if (txt) $('#shnote').textContent = txt;
}
/* The scene loop is 288 frames at 40 ms, driven by Date.now(). Pinning the iframe's clock and stepping
   80 ms per frame gives 144 frames that close the loop exactly. Frames are encoded as they are drawn. */
async function onDownload() {
  if (!SH || SH.busy) return;
  if (SH.file) { deliver(SH.file); return; }
  var shid = SH; SH.busy = true;
  var btn = $('#shdl'); btn.disabled = true; btn.textContent = 'WORKING';
  try {
    var f = shid.iframe;
    if (!f) { setProg(0, 'WAITING FOR THE PIECE'); for (var k = 0; k < 600 && !shid.iframe && SH === shid; k++) await sleep(100); f = shid.iframe; }
    if (!f) throw new Error('PIECE NOT LOADED');
    setProg(0, 'WAITING FOR THE RENDER');
    var canvas = await waitCanvas(f, 90000);
    for (var w = 0; w < 100 && !canvasLive(canvas); w++) await sleep(150);
    var N = 144, SZ = isMobile() ? 360 : 480, iw = f.contentWindow;
    var mod = await import(GIFENC_URL);
    var enc = mod.GIFEncoder();
    var off = document.createElement('canvas'); off.width = off.height = SZ;
    var ox = off.getContext('2d', { willReadFrequently: true }); ox.imageSmoothingEnabled = false;
    var realNow = iw.Date.now, T0 = iw.Date.now(), T = T0;
    function raf() { return Promise.race([new Promise(function (r) { iw.requestAnimationFrame(function () { r(); }); }), sleep(250)]); }
    iw.Date.now = function () { return T; };
    try {
      for (var i = 0; i < N; i++) {
        if (SH !== shid) return;
        T = T0 + i * 80;
        await raf(); await raf();
        ox.drawImage(canvas, 0, 0, SZ, SZ);
        var px = ox.getImageData(0, 0, SZ, SZ).data;
        var palette = mod.quantize(px, 256);
        enc.writeFrame(mod.applyPalette(px, palette), SZ, SZ, { palette: palette, delay: 80, repeat: 0 });
        setProg((i + 1) / N, 'RENDERING ' + (i + 1) + '/' + N);
      }
    } finally { iw.Date.now = realNow; }
    enc.finish();
    var bytes = enc.bytes();
    window.BB.lastGif = bytes;
    var fname = 'blackbox_rec' + p3(shid.rec) + '_' + p2(shid.index) + '.gif';
    var file = new File([bytes], fname, { type: 'image/gif' });
    if (SH !== shid) return;
    shid.file = file;
    setProg(1, 'GIF READY');
    deliver(file, true);
  } catch (e) {
    if (SH === shid) $('#shnote').textContent = 'FAILED: ' + errText(e);
  } finally {
    if (SH === shid) { SH.busy = false; var b = $('#shdl'); b.disabled = false; if (!SH.saved) b.textContent = SH.file ? 'SAVE GIF' : 'DOWNLOAD GIF'; }
  }
}
async function deliver(file, auto) {
  var shid = SH;
  var url = URL.createObjectURL(file);
  var mobile = isMobile();
  if (mobile && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); if (SH === shid) markSaved(); }
    catch (e) {
      if (SH !== shid) return;
      $('#shnote').textContent = (e && e.name === 'AbortError') ? 'NOT SAVED. TAP SAVE GIF TO TRY AGAIN.' : 'TAP SAVE GIF TO CONTINUE.';
      $('#shdl').textContent = 'SAVE GIF';
    }
    return;
  }
  if (mobile) {
    var w = window.open(url, '_blank');
    if (w) { $('#shnote').textContent = 'LONG PRESS TO SAVE'; markSaved(); }
    else { $('#shnote').textContent = 'LONG PRESS TO SAVE'; $('#shdl').textContent = 'SAVE GIF'; if (!auto) location.href = url; }
    return;
  }
  var a = document.createElement('a');
  a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  markSaved();
  $('#shnote').textContent = 'SAVED ' + file.name.toUpperCase();
}

/* ---------- clock ---------- */
var lastPh = '';
function tick() {
  var now = nowSec();
  $$('[data-t]').forEach(function (el) { el.textContent = fmtClock(parseInt(el.getAttribute('data-t'), 10) - now); });
  var sig = '';
  S.recs.forEach(function (r) { sig += r.rec + phase(r, now); });
  if (S.loaded && sig !== lastPh) { var first = !lastPh; lastPh = sig; if (!first) { render(); setTimeout(refresh, 2500); } }
}

/* ---------- init ---------- */
function init() {
  build();
  render();
  if (!NET.contract) return;
  refresh();
  silentConnect();
  setInterval(refresh, POLL_MS);
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - S.lastPoll > POLL_MS) refresh(); });
}

window.BB = { tweet: makeTweet, tweetLen: tweetLen, pieceName: pieceName, deepLink: deepLink, state: S, openShare: openShare, previewURI: previewURI, TEMPLATES: TEMPLATES, lastGif: null };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
