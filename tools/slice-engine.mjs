#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   slice-engine.mjs — THE LOCK
   Reads workbench/index.html and cuts the engine between the EXISTING
   markers (CORE-BEGIN..CORE-END, CORE2-BEGIN..CORE2-END) plus the
   WB_PV_DRIVER template literal — the very same cut wbPvSrc() makes at
   runtime — and emits engine/core.<commit>.js.

   The emitted file F is EXACTLY:  core + '\n' + core2 + '\n' + DRIVER
   so that            prelude + F === wbPvSrc(res, outd)
   byte for byte, where prelude is the one-line const header wbPvSrc
   prefixes. The piece imports F and never reads workbench/index.html
   again.

   Usage:  node tools/slice-engine.mjs [--commit d682012] [--check]
     --check  do not write; just print lengths + sha256 (CI/gate use)
   ════════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const args = process.argv.slice(2);
const commit = (() => {
  const i = args.indexOf('--commit');
  return i >= 0 ? args[i + 1] : 'd682012';
})();
const CHECK = args.includes('--check');
const src = (() => {
  const i = args.indexOf('--src');
  return i >= 0 ? args[i + 1] : 'workbench/index.html';
})();

const srcPath = join(repoRoot, src);
const html = readFileSync(srcPath, 'utf8');

/* ── the same script lookup wbPvSrc performs ──────────────────────────────
   wbPvSrc: [...document.querySelectorAll('script:not([src])')]
              .map(el=>el.textContent).find(t=>t.includes(M('-BEGIN')))
   <script> is a raw-text element, so textContent === the literal bytes
   between the tags; a regex extraction is exact. */
const M = n => '/*CORE' + n + '*/';
const scripts = [];
const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m;
while ((m = scriptRe.exec(html)) !== null) {
  if (!/\bsrc\s*=/i.test(m[1])) scripts.push(m[2]);
}
const sc = scripts.find(t => t.includes(M('-BEGIN')));
if (!sc) { console.error('FATAL: no inline script contains ' + M('-BEGIN')); process.exit(1); }

/* ── the cut, verbatim from wbPvSrc ─────────────────────────────────────── */
const core  = sc.slice(sc.indexOf(M('-BEGIN')),  sc.indexOf(M('-END')));
const core2 = sc.slice(sc.indexOf(M('2-BEGIN')), sc.indexOf(M('2-END')));
if (!core.startsWith(M('-BEGIN')))  { console.error('FATAL: CORE cut misaligned');  process.exit(1); }
if (!core2.startsWith(M('2-BEGIN'))) { console.error('FATAL: CORE2 cut misaligned'); process.exit(1); }

/* ── WB_PV_DRIVER — the worker driver wbPvSrc appends ─────────────────────
   Extracted as the template literal's source text and cooked through eval
   so escape semantics match the runtime string exactly. The literal must
   contain no interpolation; assert it. */
const dTag = 'const WB_PV_DRIVER=`';
const dsc = scripts.find(t => t.includes(dTag));      // lives in a later script block than CORE
if (!dsc) { console.error('FATAL: WB_PV_DRIVER literal not found'); process.exit(1); }
const litStart = dsc.indexOf(dTag) + dTag.length - 1; // at the opening backtick
let i = litStart + 1;
while (i < dsc.length && dsc[i] !== '`') {
  if (dsc[i] === '\\') i++;                           // skip escaped char
  i++;
}
if (i >= dsc.length) { console.error('FATAL: WB_PV_DRIVER literal unterminated'); process.exit(1); }
const litSrc = dsc.slice(litStart, i + 1);
if (litSrc.includes('${')) { console.error('FATAL: WB_PV_DRIVER contains interpolation; slice model invalid'); process.exit(1); }
const DRIVER = (0, eval)(litSrc);                     // cook escapes exactly as JS does

/* ── assemble: byte layout identical to wbPvSrc minus its prelude ───────── */
const out = core + '\n' + core2 + '\n' + DRIVER;

const sha = b => createHash('sha256').update(b).digest('hex');
const outPath = join(repoRoot, 'engine', 'core.' + commit + '.js');

console.log('slice-engine · ' + src + ' @ ' + commit);
console.log('  core   ' + core.length + ' bytes  sha256 ' + sha(core));
console.log('  core2  ' + core2.length + ' bytes  sha256 ' + sha(core2));
console.log('  driver ' + DRIVER.length + ' bytes  sha256 ' + sha(DRIVER));
console.log('  FILE   ' + out.length + ' bytes  sha256 ' + sha(out));

/* prelude reference (what the importer must prefix, from wbPvSrc):
   '"use strict";const W='+res+',H='+res+',FW=360,PVSW='+sw+',PVVG='+vg
   +',OUTD='+(outd|0)+';const TAU=6.283185307179586;\n'                  */

if (!CHECK) {
  mkdirSync(join(repoRoot, 'engine'), { recursive: true });
  writeFileSync(outPath, out);
  console.log('  wrote  engine/core.' + commit + '.js');
}
