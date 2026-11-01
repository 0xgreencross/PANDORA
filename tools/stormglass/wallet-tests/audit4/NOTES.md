# STORMGLASS wallet audit 4 — working notes (ops session)

## Baseline (Nov 1 2026, ~10:45 UTC)
- Starting main: 0cd4ea45d9bd8ae05903d61181be98e1b4bec913 (= the review baseline; main had not advanced). index.html sha256 8b0c08c602fd651ab3168a03ed2b58234f3370f9498dee5cc7a406352e33f2ef (= documented production hash).
- Main checkout /home/claude/P: clean (no pre-existing changes). Other worktrees from earlier audits left untouched.
- Audit worktree: /home/claude/wt-audit4, branch audit/wallet-4 (from 0cd4ea4). Harness-only commit f1026a0: every audit4*.test.js registers as group @audit4.
- Node v22.22.0; Playwright 1.64.0 (/home/claude/node_modules); Chromium 141.0.7390.37 (/opt/pw-browsers/chromium -> chromium-1194). Page ethers: cdnjs 6.13.2 ethers.umd.min.js (fakechain serves the local copy); Node ethers 6.13.2.
- Repo instructions: CLAUDE.md (laws 1-17; law 1 superseded by the staging/approval order; laws 8, 14, 16, 17 apply). TESTING.md cited by CLAUDE.md does not exist. No AGENTS.md. Wallet test docs: tools/stormglass/wallet-tests/README.md; staging: tools/stormglass/staging/ (build.js, policy.js, stage.js, stage.css, staging.test.js, shots.js); audit 3 reports in tools/stormglass/wallet-tests/audit3/.
- Registry at 0cd4ea4: 113 ids, no duplicates: wallet.test.js 38 (@orig: 37 original + m9), audit2 35, audit3 21 (x1-x7, y1-y10, z1-z4), audit3b 17 (u1-u17), harness 2 (hz1, hz2).
- Baseline command: `PORT=8951 OUT=/home/claude/audit4/ev LABEL=baseline-0cd4ea4 bash tools/stormglass/wallet-tests/run.sh` (background).
- Baseline result: 113/113 PASS on untouched 0cd4ea4 (ev/baseline-0cd4ea4.log, ev/results-baseline-0cd4ea4.json, per-case ms).
