# Wallet audit 5b: summary (review branch audit-wallet-5)

Final candidate: commit 5b6257dd22c91b803b659e4052b0a24ffe90049d, index.html sha256 a870ac02cad516c5fb436f29629986925648140aa7bee002bf1b990332ed3e0a. Staging test-wallet.html (built from it, commit 04ddf4932e791667747791105a4af15e6a450d49): sha256 47d1aec0959941862ebb4140502e1038134cf2bc409ac6eebe7b09e5dff7e6e1. Production (main 2808906, index.html 8b0c08c6…f2ef) unchanged.

Start state (Nov 2 02:27 UTC): main 2808906 (= f676ad1 + test-wallet.html b1ef2db4), review head 50ac8a5 (candidate 6d9ccee, index 99131cd7), live homepage 8b0c08c6. Nothing changed independently on main during the work.

## Findings and fixes
| # | Finding | Fix (file) | Regressions |
|---|---|---|---|
| A | Staging runner: own inventory, no manifest, no watchdogs, results only at the end, no run identity, old success survives a failed write (reproduced: 31/31 exit 0 with st32 removed under RELEASE=1, full run; old success file kept after an injected write failure, real runner) | One shared runner (tools/stormglass/wallet-tests/runner.js) for both suites; staging manifest (tools/stormglass/staging/manifest.json); verify-results.js for consumers | selftest-staging.js 22 (0/22 on the old runner), selftest.js 31 |
| B | Wallet sheet: no focus management, background reachable (Enter on CLAIM behind the review asked the wallet) | index.html sheet()/sheetOff(): dialog semantics, focus to heading, Tab trap, background inert, single close path restores focus and removes inert, sheet generations; recipient label + aria-describedby + aria-invalid | a5b1-a5b12, a5e1 |
| C | Review said "The contract pays X ETH"; the contract pays all owed at execution | "Withdraw all funds owed … when this transaction executes. Currently: X ETH." + snapshot line; outcomes re-read owed and claim nothing unknown; CLAIM wording; SWITCH with no wallet | a5c1-a5c7, a5d1-a5d2 |
| D | Report said staging never reaches the real relay | Accurate mode texts (page + STAGING5_REPORT §4b); one-shot connection gate; listener `this` no longer the raw provider | st33-st42 |
| R1 | (pre-review) stale WalletConnect nudge overwrote a newer sheet | sheet generation guard | a5v1 |
| R2 | (pre-review) SEND still asked the wallet after the page read nothing owed | review closes on owed 0; SEND refuses an outdated review | a5v2 |
| R3 | (pre-review) staging replacements ignored the simulated contract | stage.js txResolve via chainVerdict | a5v3 |
| R4 | (fix round) staging CONTROLS inert behind a sheet | stagingLive() releases only sg- elements | st18, st27 |
| R5 | (post-review) COLLECT kept "YOUR WALLET IS ON ANOTHER NETWORK" after disconnect | disconnect() redraws the not-connected view | a5p1 |
| R6 | (post-review) cancelled note said the cancellation "may itself have withdrawn" | separate cancelled wording | a5c7 |
| G | fixed windows in tracking/race cases (a5n*, a5m*, a5w*, a5r1, a4r*, a4w*, a4v*, a4s*) | explicit gates | FIX_REPORT §3 |
H1 (wallet-as-reader after a chain change): not a defect (a5f2). H2 (cancelled WalletConnect pairing later approved in the wallet is adopted by the next CONNECT): acceptable, consent given in the wallet (a5f1). H4 (confirmed note disappears with the box when nothing is owed): acceptable (a5f3).

Details: RUNNER_REPORT.md, PAGE_REPORT.md, STAGING_REPORT.md, REVIEW_PRE.md, FIX_REPORT.md, REVIEW_POST.md; results/ holds the final run files.

## Final evidence (all on the published review commit 04ddf4932e791667747791105a4af15e6a450d49 = candidate 5b6257d + its test-wallet.html)
| check | result | run id | verifier |
|---|---|---|---|
| Production RELEASE=1 | 222/222, exit 0 | 20261102T062653Z-13539-3bb37e | VERIFY OK (strict; target a870ac02…, manifest bf750d8d…) |
| Staging RELEASE=1 (test-wallet.html 47d1aec0…) | 42/42, exit 0 | 20261102T062653Z-13538-ede62e | VERIFY OK (strict; candidate a870ac02… = 5b6257d, manifest 1767cdd4…) |
| Race / lifecycle / modal / concurrency x3 (CASES=@audit2,@audit4,@audit5,a2,c,d,e,f,i4,l2,l3,hz2 = 153) | 153/153 each | 20261102T064615Z-3413-6091c5, 20261102T065917Z-16129-13685f, 20261102T064615Z-3412-fe2f50 | VERIFY OK (--cases) |
| selftest.js (production runner) | 31/31 | selftest-prod.log | real run.sh on temp copies |
| selftest-staging.js (staging runner) | 22/22 | selftest-staging.log | real run.sh on temp copies |
| Contract suite (stormglass/, npx hardhat test) | 42 passing | contract-04ddf49.log | contract source unchanged since 50ac8a5 |
| Staging patch list | 7 documented patches (provider taps x3, head runtime, title, stylesheet, banner) | patches.json | build --check OK |
| a5c7 cancelled wording | fails on dfbe702's page, passes on the candidate | 20261102T062037Z-12672-190cb3 / -12666-a2831c | |
| build.js refuses an index.html with id="sg-" | rc=1 | build-sg-guard.txt | controlled probe |
Mutation proofs: RUNNER_REPORT §8 (M1-M5), PAGE_REPORT (15 mutants), STAGING_REPORT (m1-m5), FIX_REPORT §4 (11), REVIEW_POST (a5p1 cond, switchany). They ran on the agents' branches before the final integration; the guards they target are unchanged in the final candidate except where a later fix replaced them (documented in FIX_REPORT/REVIEW_POST).

## Staging publication
main d618858348cb337afa4133a527367d199004336a = 2808906 + test-wallet.html only (`git diff --name-status` shows exactly `M test-wallet.html`; index.html on main still 8b0c08c6…). Live https://dithervoid.art/test-wallet.html sha256 47d1aec0959941862ebb4140502e1038134cf2bc409ac6eebe7b09e5dff7e6e1 (equal to the reviewed build, stamp "candidate 5b6257d", sha256 a870ac02…). Live homepage sha256 8b0c08c602fd651ab3168a03ed2b58234f3370f9498dee5cc7a406352e33f2ef before and after. No candidate production code promoted.
