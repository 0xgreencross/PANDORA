# STORMGLASS wallet audit 3 — working notes (ops session)

## Baseline (established Oct 31 2026 ~17:35-18:45 UTC)
- Starting main: f9a6f800a458e44a1f35d1738d012506a678d4ba (= the review baseline; main had not advanced).
- index.html sha256 da27e81851a7c1d2bf832814b74868b2d35c0a5e3f956f4d8f071f5a02eb8a89
- Main checkout /home/claude/P: pre-existing untracked test-wallet.html (old practice page left on disk after f9a6f80 removed it from the repo). Preserved, not touched.
- Other pre-existing worktrees (not touched): /home/claude/pr1-repair [repair/pr1-wallet-guards], /home/claude/practice-page [test/practice-page], /home/claude/wallet-fix2 [fix/wallet-audit-2].
- Audit worktree: /home/claude/wt-audit3, branch audit/wallet-3 (from f9a6f80).
- Node v22.22.0; Playwright 1.64.0 (/home/claude/node_modules); Chromium 141.0.7390.37 at /opt/pw-browsers/chromium -> chromium-1194/chrome-linux/chrome.
- ethers: page loads cdnjs ethers 6.13.2 ethers.umd.min.js (fakechain serves the local copy); Node tests use ethers 6.13.2 from /home/claude/node_modules.
- Runner: tools/stormglass/wallet-tests/run.sh serves the repo root on 127.0.0.1:$PORT (ThreadingTCPServer) and runs wallet.test.js; TARGET defaults to <repo>/index.html (check wallet.test.js boot()).
- Command: `PORT=8941 OUT=/home/claude/audit3/ev LABEL=baseline-f9a6f80 bash tools/stormglass/wallet-tests/run.sh` (background, CLAUDE.md law 16).
- Repo instructions read: CLAUDE.md (laws 1-17; law 1 "push in the same turn" is superseded by the user's staging/approval order; law 8 screenshot sizes; law 16 background gates; law 17 atomic scripted edits). CLAUDE.md cites TESTING.md: NOT present in the repo. No AGENTS.md anywhere. Wallet test docs: tools/stormglass/wallet-tests/README.md.

## Case registry at f9a6f80
- @orig = every case registered in wallet.test.js before audit2.test.js is required = 38 ids: the 37 original + m9 (m9 lives in wallet.test.js, so @orig now includes it).
  a1,a2,b,c,d,e,f,g,h1,h2,h3,h4,h5,i1,i2,i3,i4,j1,j2,j3,k1,k2,l1,l2,l3,l4,m1,m9,m2,m3,w1,w3,n1,n2,n3,n4,n5,n6
- @audit2 = 35: q1-q6,r1-r9,k3-k6,m4,m5,h6-h9,p1-p5,v1-v3,c1,c2
- Total 73, no duplicate ids (checked by enumeration). Note: the runner does NOT reject duplicate ids (an earlier session had two 'm5' and both ran).

## Baseline result
- 73/73 PASS on untouched f9a6f80 index.html (log ev/baseline-f9a6f80.log, ev/results-baseline-f9a6f80.json; no per-case durations in that harness version).

## Harness change 553222a (before any page change)
- Per-case duration (ms) in results and log; registers audit3.test.js as @audit3 if present. No page change. Smoke a1,m9 pass.
