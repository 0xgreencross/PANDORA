# Wallet audit 3 (Oct 31 2026)

- Start: main f9a6f800a458e44a1f35d1738d012506a678d4ba (index.html sha256 da27e818…). Baseline 73/73 (results/results-baseline-f9a6f80.json).
- Production-form candidate: d9ab802 (index.html sha256 3c5992e2cc5a794fc7b0475fab2d7d04ef3c7f82bffde35697ba6f8bc69b12ea). Full suite 113/113: @orig 38, @audit2 35, @audit3 21, @audit3b 17, @harness 2 (results/results-merged2-d9ab802.json).
- New regressions on the baseline page: @audit3 2/21 pass (only the guards z1, z4), @audit3b 13/17 (u1, u2, u3, u11 fail) — results/*-on-*.json.
- Staging: test-wallet.html = `node tools/stormglass/staging/build.js --candidate d9ab802` (sha256 46dc473c…), staging tests st1-st15 15/15. Published to main as ca0afff (only that file).
- Reports: NOTES.md (baseline, environment), HARNESS_REPORT.md, FIX_REPORT.md (Findings A, B, z), MATRIX_REPORT.md + COVERAGE.md (lifecycle matrix, D1-D4), STAGING_REPORT.md.
- Reproduce: `PORT=8941 OUT=/tmp/out LABEL=x bash tools/stormglass/wallet-tests/run.sh` (all groups; CASES=@orig,@audit2,@audit3,@audit3b,@harness or ids), `SCRIPT=../staging/staging.test.js` for staging. Node 22.22.0, Playwright 1.64.0, Chromium 141.0.7390.37, ethers 6.13.2.

## Promotion (Nov 1 2026)
- Approved by the owner: "approve d9ab802", wording changes OK (z2, u2, u3).
- Production = d9ab802's index.html + 9c60602 (owner's order the same day: seat earnings are paid automatically inside every purchase or witness — manual SEATS note, a new FAQ entry with an example, seats board note; copy only) — index.html sha256 8b0c08c602fd651ab3168a03ed2b58234f3370f9498dee5cc7a406352e33f2ef.
- Test fix 20ea912: p5 waited a fixed 600 ms for a redraw and failed once under load (12/12 alone on both d9ab802 and 9c60602); it now waits up to 3 s for the same text.
- Full suite on 20ea912: 113/113 (results/results-prod2-20ea912.json). No staging markers in index.html (__SG, TEST BUILD, PRACTICE, practiceGuard, sg-modal, INTERCEPT, noindex, staging: 0 each).
- Upstream main since f9a6f80 (ca0afff test-wallet.html, 74431a4 prints, 24211c3 thumbnails) does not touch index.html.
