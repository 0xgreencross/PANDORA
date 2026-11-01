# Audit 5, H5: wallet test harness (result persistence, run identity, release manifest, watchdogs, self-tests, gated races)

Worktree /home/claude/wt-a5-harness, branch audit/wallet-5-harness (from e7149ea). index.html was never edited (sha256 703602f1…0c5 = the 38264fc candidate). Nothing was pushed. Evidence is in /home/claude/audit5/ev/harness/.
Commits (e7149ea..461b805): 9d1acc0, cd36e55, 699aa06 (WIP), 6e14c6e (hz2), 3f2302a, 9459f32 (a4h1), ae2459c (manifest + audit5page ids), 461b805 (self-test manifest independence). Head 461b805; worktree clean.

## 1. Persistence failures fail the run
- `writeResults()` writes atomically: a temp file `.results-$LABEL.json.<runId>.tmp` in the same folder, then fsync, then rename over the results file. The file is written before the first case ("starting", then "running"), after every case, and at the end.
- Any failure to write is a harness failure, and it is sticky: `PERSIST_FAILED`, `harnessFailures[]`, `persistence.failures[]`. The exit status is 1 even when every case passed, and a later good write records the failure but never clears it.
- If the results cannot be written at the start, no case runs (exit 1).
- If the final write fails, the file on disk is the previous snapshot. That snapshot says `status:"running"`, `completed:false`, so a failed final write can never look like a pass.
- **Old results cannot stand in for this run.** Before anything else, an existing `results-$LABEL.json` is renamed to `results-$LABEL.prev-<its runId>.json` (or `prev-legacy-<mtime>` for the old array format). Choice: keep the stable name that consumers and reports already use, and preserve the older evidence. A per-run file plus a pointer would have meant changing every reader.
- **Load failures end through the same path.** Before this change, a missing dependency or TARGET (or a case module that throws) crashed Node with no results and left the older file in place. Now: playwright, mockwallet, fakechain/ethers, TARGET, the ethers UMD → `harness-failure`, exit 1; a case module that throws → `registration-error`, exit 2.
- **Run identity** (schema `stormglass-wallet-results/2`, documented in README with the migration: the old array is now `j.cases`):
  - `runId`, `startedAt`, `finishedAt`, `interruptedBy`, `running`
  - `target`: path, bytes, full sha256, and `source`. `source.commit` is `git rev-parse HEAD` of the repo that holds TARGET; `source.matchesHead` compares blob hashes. An untracked copy, or a TARGET outside any repo, gets `commit:"unknown"` or `matchesHead:false` plus a `reason`.
  - `harness`: commit, tree hash of wallet-tests/, uncommitted files, and the sha256 of every file of the folder that Node loaded
  - `deps`: node; playwright and ethers as actually resolved (the first version showed the wrong playwright, 1.56.0 from NODE_PATH, while Node loads 1.64.0 from /home/claude/node_modules: fixed); the ethers UMD sha256; the chromium version
  - `env`, `mode`, `registered`, `groups`
  - `selected`, `executed`, `passed`, `failed`, `timedOut`, `unexecuted`
  - `completed`, `harnessFailures`, `persistence`, and `exit` (a number, or `"interrupted"`) together with `exitCode`
- **Consumers:** no script in the repo reads `results-*.json`. staging.test.js writes its own file and the audit reports only cite file names. The README migration note covers outside readers.

## 2. Release manifest
- `tools/stormglass/wallet-tests/manifest.json` lists 9 modules with their group and the exact ids: 191.
  - 161 already on this branch: @orig 38, @audit2 35, @audit3 21, @audit3b 17, @harness 2, @audit4 48.
  - plus audit5page.test.js @audit5, 30 ids read from audit/wallet-5 (a5n1-12, a5x1-3, a5m1-7, a5w1-8). I added no new ids: q1, i4, hz2 etc. were rewritten under their existing ids. Each case now records the module that registered it (`T.loading`), and groups are derived from the file name.
- **`RELEASE=1` refuses to start (exit 2, `manifest-mismatch`)** on any of: a listed module missing, an unlisted module present, a listed id missing, an unlisted id, a wrong group, or a count difference.
- `RELEASE=1` also refuses `CASES` and any preload in NODE_OPTIONS (exit 2, `selection-error`).
- **Adding cases is deliberate:** `node wallet.test.js --print-manifest` prints the current registration; you copy it into the manifest in the same commit. Because the manifest already lists audit5page.test.js, a RELEASE=1 run on this branch alone refuses, as designed: `manifest-mismatch`, missing module audit5page.test.js, exit 2 (release-ae2459c-branchonly.log). It is meant to be run after the merge.
- Runs without RELEASE are labelled `subset` (CASES given) or `all (not release-verified)`, and print a WARN line when the registration differs from the manifest.

## 3. No infinite waits
- **Per-case watchdog** `CASE_TIMEOUT_MS` (default 120 s):
  - the case fails with `timedOut`, its contexts are closed (bounded), and its epoch ends: a late `boot()` from the abandoned case is closed and refused, so it never leaks into the next case
  - if the case timed out or its contexts did not close, the browser must answer `newContext` within 15 s; if it does not, the whole Chromium process group is killed and the run ends `incomplete`
- **Whole-run watchdog** `RUN_TIMEOUT_MS` (default 45 min) → `interrupted`, exit 1.
- **SIGTERM / SIGINT** → `interrupted` results, exit 143 / 130.
- **run.sh** passes signals to node and waits for it, and always stops the HTTP server.
- **Server readiness** is now a gate, not `sleep 1`: Python writes a marker file once it holds the port.
- A Node-side unhandled rejection fails the case running at the time and the run. An uncaught exception ends the run `incomplete` with results written.

## 4. Self-tests: `node tools/stormglass/wallet-tests/selftest.js` (committed, plus `selftest-fault.js`)
- **How it works:** every scenario runs the real run.sh on a temporary copy of wallet-tests/ (repo entries symlinked, plus a temporary module `audit5zz_selftest.test.js` that exists only in the copy) and checks the exit status and the results file. Write, rename and open failures come from a `--require` preload in the self-test only (RELEASE refuses preloads). The temp tree is removed at the end.
- **Result on 3f2302a: SELFTEST 30/30** (selftest-3f2302a.log, selftest-3f2302a/ with every log, results and selftest-summary.json). The scenarios and outcomes:

| Scenario | Exit status | Status in results |
|---|---|---|
| control | 0 | passed (full identity fields) |
| unwritable results dir (ENOTDIR) | 1 | no case ran, no file |
| write fails at snapshot 3 | 1 | failed (both cases passed; persistence failure recorded) |
| rename fails | 1 | failed |
| open fails (ENOSPC) | 1 | failed |
| final write fails | 1 | the file says running / completed false / exit null |
| earlier successful file, then first write fails | 1 | old file moved aside to .prev-<runId>, no current file |
| legacy array file + launch failure | 1 | file holds the new runId, harness-failure |
| browser launch fails | 1 | harness-failure, all unexecuted |
| browser dies mid-case (CDP Browser.crash) | 1 | incomplete, next case unexecuted |
| renderer crash | 1 | failed |
| page unhandled rejection | 1 | failed |
| Node unhandled rejection | 1 | failed + harnessFailure |
| case exception and assertion | 1 | failed |
| RELEASE with audit3b.test.js removed | 2 | manifest-mismatch (17 missing ids) |
| RELEASE with an unlisted module | 2 | manifest-mismatch |
| RELEASE with a listed id missing (q99) | 2 | manifest-mismatch |
| RELEASE with CASES | 2 | selection-error |
| unknown id | 2 | selection-error |
| duplicate id | 2 | registration-error |
| malformed id | 2 | registration-error |
| module throws at load | 2 | registration-error |
| empty selection (`,` and `@nogroup`) | 2 | selection-error |
| dependency missing (ethers) | 1 | harness-failure, older successful file moved aside |
| TARGET missing | 1 | harness-failure, commit unknown + reason |
| hung case (5 s watchdog) | 1 | failed, timedOut, next case passed |
| frozen browser (SIGSTOP) | 1 | incomplete, browser killed: the stopped pid is gone or a zombie (fails if still running) |
| run watchdog | 1 | interrupted |
| SIGTERM to run.sh | 143 | interrupted |
| SIGINT to run.sh | 130 | interrupted |
| SIGTERM to the process group (as `timeout` does) | 143 | interrupted |

Every scenario writes a results file except "unwritable", where no file can exist and that is asserted.
- **Two faults found while building it, both in the self-test, not the runner:** cases run in registration order, not CASES order, so the self-test now uses `st_last`; and `kill(pid,0)` reports a zombie as alive, so the check now reads the /proc state.

## 5. Gated races and neighbours
- **q1, gated.** The wallet holds the first eth_sendTransaction. Four more presses are each turned away with the busy toast (the barrier). While the request is held there is exactly 1 request, `waiting`==1, 0 sends, and OPLOCK is the witness's with `handed:true`. Then the gate is released: 1 payment of 0.01, confirmed, lock free; then a deliberate 0.02 goes out (2 requests).
  - Candidate: PASS. With the opLock guard removed (copy of the page): FAIL, 5 requests held, no busy refusal.
- **i4, gated.** The wallet holds eth_requestAccounts. After each of two more CONNECT clicks, the CONNECTING object and the session counter SES are unchanged (the click handler is synchronous, so this is a real barrier). There is 1 request, `waiting`==1. After the release: connected, CONNECTING null. Then DISCONNECT plus a deliberate CONNECT → 2 requests.
  - Candidate: PASS. With the CONNECTING join guard removed: FAIL, SES 1→2→3, 2 requests held.
- **hz2, gated** (your lead: the 38264fc baseline failed with probesWhileOpen 0). The test waits, bounded at 15 s, until ≥5 probe requests and ≥5 wallet requests have been seen while the context is open. A late 1.5 s timer is armed just before the close, then there is a 3 s quiet window. A positive control proves the next context's own probe is counted.
  - Candidate: PASS.
  - Mutant A (closing a context does nothing): FAIL, 37 probes after the close and the late probe arrives.
  - Mutant B (one context reused across cases): FAIL, localStorage "1" and the cookie leak.
- **The mock now records settled requests** (`__MW.done`, `E.P(id).answered(m)`). It only observes; the page receives the same promise. A "nothing sent" can now wait for the late answer instead of a fixed time.
- **Neighbours hardened.** Each one fails with its guard removed (on a copy of the page) and passes on the candidate:

| Case | Before | Now | Mutant result |
|---|---|---|---|
| p4 | sleep 3 s | waits for NO LONGER ON SALE + lock free | FAIL, buys day 14 |
| v1 | sleep 3 s | waits for the stop toast + lock free | FAIL, 1 send |
| v2 | sleep 3 s | waits for the stop toast + lock free | FAIL, 1 send |
| v3 | sleep 2.5 s | waits for the lock free after the wallet's refusal | not mutated (the guard is the request's chainId, checked by the assertion itself) |
| z3 | sleep 3 s | waits for the switch answered + page sees mainnet + lock free, then a 1.5 s settle | FAIL, COLLECT on the other option sent (switch-continuation guard narrowed to `ok&&NX.pop`) |
| a4s7 | sleep 2 s | waits for the late estimateGas answered + lock free, then 1.5 s | FAIL with the onDead guard removed |
| a4h1 | 3 s | waits for ICE gathering "complete" (bounded 10 s) | FAIL on a runner without the WebRTC flag: 6 UDP packets, gathering not complete within 10 s |

  - Note on a4s7: its "nothing sent" part survives removing opLive entirely. Other layers (dialog ownership, the revoked wallet) also stop that send, so that part is defense in depth.
- **Re-verified (audit 4's barriers still hold):** c, d, e, f, a2 (stop toast + OPLOCK null) and l2, l3 (redraw counts asserted). nbr-cand: 16/16 PASS (a2, c, d, e, f, i4, l2, l3, q1, p4, v1, v2, v3, z3, hz2, a4s7).
- **Reviewed and left as they are:**
  - a1, p3, z1, z2, a4c3, a4c4, a4v5: they wait for their terminal toast or view first
  - l1, c1, c2, q3: they call REDRAW themselves
  - x2: gated with lkHeld/lkRelease
  - a4s2: the claim press is on a button asserted disabled
  - hz1: its 500 ms announcement window is a negative with no mock installed, and the CDP target list covers extensions
  - y7, y8, u2, u12, k3, k5, a4s5: the timers are inherent to what they test and are asserted

## Final runs
- **RELEASE=1, 9459f32** (161-id manifest, before the audit5page ids were added): **161/161 PASS, rc 0, status passed, completed true**.
  - Results file: target commit 9459f32 with matchesHead true; harness commit 9459f32 with nothing uncommitted.
  - Groups: @orig 38, @audit2 35, @audit3 21, @audit3b 17, @harness 2, @audit4 48. Slowest case 39.6 s.
  - Files: release-9459f32.log, results-release-9459f32.json. Ran next to a second suite.
- **RELEASE=1, 3f2302a: 161/161 PASS, rc 0** (release-3f2302a.log, results-release-3f2302a.json).
- **Trial merge** (scratch copy, not a worktree): `git archive audit/wallet-5` with this branch's wallet-tests files laid on top.
  - `--print-manifest` gives exactly manifest.json (191).
  - **RELEASE=1: 191/191 PASS, rc 0** on the merged index.html (sha256 98b3d537…). Groups: @orig 38, @audit2 35, @audit3 21, @audit3b 17, @harness 2, @audit4 48, @audit5 30. 18 min, slowest 49.0 s.
  - Files: release-mergecheck.log, results-release-mergecheck.json. The copy is deleted. Its target and harness commits read "unknown (not a git work tree)", as the reason field says.
  - Your merge: audit/wallet-5 changed no harness file (only added audit5page.test.js and audit5page-shots.js), so it should be conflict-free.
- **Self-tests on head content: SELFTEST 30/30** (selftest-final.log, selftest-final/). Also 30/30 on 3f2302a.
- **Baseline before any change** (e7149ea, old runner): 161/161 (baseline-e7149ea.log).
- **Cleanup:** the mutated pages, mutant harness copies and temp self-test trees are deleted. No untracked file is in the worktree. index.html is untouched.

## Notes for the orchestrator
- **Exit statuses:** 0 pass; 1 case/harness/persistence failure or an incomplete run; 2 selection, registration or manifest problem; 130/143 interrupted. A log without `XDONE rc=` means run.sh itself was killed.
- **Release verification:** use `RELEASE=1` and check the `RESULTS … status passed completed true exit 0` line, or `j.status==='passed'&&j.completed&&j.mode==='release'` in the results file.
- **Results readers:** the old array is now `j.cases`.
- **Default timeouts** (raise them on a heavily loaded machine if needed): `CASE_TIMEOUT_MS` 120 s; `RUN_TIMEOUT_MS` 45 min. The merged 191-case run took 18 min alongside one other suite.

## WORDING FOR APPROVAL
None: no user-facing wording changed (index.html untouched; only test/harness text).
