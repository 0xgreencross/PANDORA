# Audit 5b — integrated fixes (Brief F) — report

Worktree /home/claude/wt-5b-fix, branch `audit/wallet-5b-fix`, from 0533881. **Not pushed.**
- **Branch head: `bce0646568c75ecc185dd10a74e40197e4f1e95a`**
- Commits on 0533881:
  - b7443f9: index.html, stage.js, tests, manifest and README.
  - f1d1552: test-wallet.html, rebuilt from b7443f9.
  - a7b8f1e: stage.js, the staging-chrome fix (§2e).
  - bce0646: test-wallet.html, rebuilt with `--candidate a7b8f1e`.
- **index.html sha256 `691687a3818d6b07ba82ca92d9ee76a854b5189bfc82a2af9e55d1d4416024ca`.** It was 8f625a31… at 0533881. Unchanged since b7443f9.
- **test-wallet.html sha256 `d38455f262f9a96a2f0f4a23e54cd0b6b8412272b0ce33b8c183fbb440e5891a`.** Built with `node tools/stormglass/staging/build.js --candidate a7b8f1e…`; `--check` OK. The candidate index.html is 691687a3 and its stamp names a7b8f1e.
- Evidence is in /home/claude/audit5b/ev/fix:
  - repro/, dev/, mut/, release/, race/
  - selftest-prod/ and selftest-staging/, plus their logs
  - contract-tests.log
  - tools/: the edit scripts, the mutant generator and the queues
- Every temporary copy has been deleted: the old pages, the mutants and the staging builds `_a5fix_*`, `tw-*`. `git status` is clean.

## 1. Reproduced on 0533881 (index.html 8f625a31; committed test-wallet.html 9ce79341)
| id | result on 0533881 | evidence |
|---|---|---|
| a5v1 (review's version) | FAIL. The trigger is not reached: since the page agent's modal fix, REVIEW behind the CONFIRM sheet is inert. focused `wsk`, reviewShown false. The nudge still rewrote its own sheet. | repro/repro-a5v-0533881.log, run 20261102T035744Z-27586-bbf514 |
| a5v2 | FAIL: closedByRead true, sheetStillOpen true, walletAsked true (eth_estimateGas 1, eth_sendTransaction 1) | same run |
| a5v3 | FAIL. replaced: status 1, owed 0.05, sender received 0, note "…What is owed stays in the contract." sped: status 1, R1 paid. | same run |
| st41, committed test-wallet.html (built from 6d9ccee) | FAIL: the old "What is owed stays in the contract" wording | repro/repro-st41-committed.log, run 20261102T035744Z-27578-479023 |
| st41, test-wallet rebuilt from 0533881's index.html | **PASS**. The page agent's wording landed, so st41 needs no fix. | repro/repro-st41-rebuilt.log, run 20261102T035744Z-27571-9ce6ed |

## 2. Fixes, regressions and classifications

### a. a5v1 and H3: sheet generation (index.html)
**Changes:**
- **L865, L880:** `SHEET.n` is incremented by every `sheet()`.
- **L912:** a nudge records `n.sg`.
- **L916, wcNudgeSent:** if `n.sg!==SHEET.n` it records the event and clears its timer, but leaves the sheet's text and buttons alone. This covers the relay event and the 8 s fallback.
- **L920, wcNudgeOff:** `sheetOff()` only when `n.sg===SHEET.n`.
- **wcConnect (L933-L947):**
  - `sg` records the generation of the connection's own sheet (pick sheet or 20 s sheet).
  - `mine()` checks that sheet is still the one on screen.
  - `onUri`, `wake`, the 20 s fallback and `finish` act only when `mine()`.
  - `finish` clears SHEET_CLOSE only if it is still its own `close`.
- **L955, CLOSE / Escape / backdrop:** after calling a SHEET_CLOSE callback, the sheet on screen is still closed if that callback did not close it. Example: a stale nudge callback under CONNECTED (H3) would otherwise leave CLOSE dead.
- The focus and inert lifecycle is unchanged: `sheet()` and `sheetOff()` remain the single open and close paths.

**Regression a5v1, rewritten.** The review's keyboard path no longer exists on the modal page. The case now has three rows and asserts each trigger:
- **review, the natural order:** REVIEW is pressed and its own owed read is held. A WalletConnect write then opens CONFIRM IN ZERION, and the read answers, so the review replaces the nudge. Then the page's own 8 s fallback (captured, run on cue), the relay event for the nudge's request, and the request settling. The review must keep its text, recipient, 0.05 and live buttons, and stay open. SEND then sends withdrawTo(R1) once.
- **menu (H3):** walletMenu() replaces a pending nudge. This is a controlled stand-in, as a5b9 uses noWalletDesk(). Fallback, event and settle leave CONNECTED as it is; CLOSE closes it. With a second pending nudge, CLOSE closes CONNECTED and the late answer reopens nothing.
- **connect:** the wcConnect sheet (fake provider) is replaced by a page `sheet()` with one disabled button. The 20 s fallback, `display_uri` and the approval must not rewrite, re-enable or close it, and the connection still resolves.

The WalletConnect side is a controlled probe (fake `_WC`, as in a4w/m9) with the page's own ask(), wcHook and wcConnect. The timers are the page's own callbacks, captured by a setTimeout wrapper that holds only the 8 s and 20 s ones. Fail-first on 0533881: **all three rows fail with trig true** (dev/dev1-old.log, run 20261102T040846Z-28918-3a0cb6):
- review: "No word yet that the request reached ZERION…" written into the review, then "The request is in ZERION now…".
- menu: the same texts in CONNECTED, and CONNECTED closed by the settling.
- connect: the probe is replaced by WALLETCONNECT DID NOT ANSWER, then "Tap the app…" with the buttons enabled, and the sheet is closed by the approval.

The fixed page passes (dev/dev1-fixed.log, run 20261102T040846Z-28912-59e840).

### b. a5v2: SEND after the page read nothing owed (index.html)
- **L1853, refreshSeats:** when it reads owed 0 and closes the box, an open withdrawal review (`SHEET.tag==='wto'`) is closed too, with the toast "The contract owes this wallet nothing now. The review was closed; nothing was sent from it."
- **L1886-L1888:** SEND passes the review's `k`. wtoSend refuses when `rk!==WTO.k` (the box was closed since this review, or a newer REVIEW replaced it), with the toast "This review is out of date. Nothing was sent."

**Account change, decided:** an account change does **not** close the review, as the page agent had it.
- SEND then says "Your wallet changed. Nothing was sent. Press REVIEW again." and closes the sheet. This keeps a5w5(a) and a5b8 unchanged, and the visitor gets an explicit reason.
- The review is also stale for `rk` after the change (seatsReading → wtoOff), so it is refused twice over.
- If the new account's first read finds nothing owed, the review closes through the new owed-0 path, which is accurate for the connected wallet.
- Disconnect still closes it (the `'wto'` tag).

**Regression a5v2, rewritten.**
- The review's trigger "sheet still open" is what the fix removes. The case now asserts that the sheet closes by the read, with its toast.
- It then presses the SEND button that very review showed. The test holds it from before the read: a press arriving as the read closes the review. The refusal toast is the barrier that the press reached wtoSend.
- Nothing must reach the wallet: eth_estimateGas 0, eth_sendTransaction 0, and 0 sends after the lock wait.
- Guard row unchanged: with owed unchanged, SEND asks once.
- Fail-first on 0533881: sheetClosedByRead false and walletAsked true (est 1, send 1), in the same run 20261102T040846Z-28918-3a0cb6.

### c. a5v3: staging replacements (stage.js L153-L158, txResolve)
**Change:**
- Every replacement that calls the contract goes through `chainVerdict`: SPED UP (the same call), REPLACED and REPLACED BY A WITHDRAWAL THAT PAID (withdraw()).
- A replacement that would revert is mined with status 0 and changes nothing. One that runs applies `effect`.
- A cancellation (0 ETH to self) calls nothing.

**Consequence for the staging behaviour:**
- REPLACED (another call) now pays the sender what is owed when something is owed, and is mined with status 0 when nothing is. Before, it was status 1 with no effect.
- It therefore behaves like REPLACED BY A WITHDRAWAL THAT PAID for withdrawals.

a5v3 passes (dev1-fixed run 20261102T040846Z-28912-59e840, then both release runs). st1-st42 are green (§5).

### d. H2, H1, H4: investigated, none is a defect
Each case passes on the fixed page (dev/dev2, dev/dev3, then release); they are registered as **a5f1-a5f3** in the new audit5fix.test.js (@audit5).

- **H2, ACCEPTABLE (documented, a5f1).**
  - **Mechanism:** CLOSE on the pairing sheet rejects wcConnect, but `p.enable()` keeps waiting. A later approval in the wallet gives the provider a session. The page stays disconnected by itself: label CONNECT, no request (absence window, after the approval is proven).
  - **Next CONNECT:** it adopts that session through `p.accounts.length`, with no new pairing (uris 1, enables 1). Nothing is sent or signed.
  - **Why acceptable:** consent was given in the wallet itself, and the visitor pressed CONNECT again. This is the same as an injected wallet that already granted the site.
  - **Residual:** between the cancel and the next CONNECT, the wallet shows a live session that the page does not show.
  - **Owner's option, not done:** /wc.js has `abortPairingAttempt()`, which could be called in the cancel path. It changes the real WalletConnect lifecycle and cannot be verified here (no relay).
- **H1, NOT A DEFECT (a5f2).**
  - **Mechanism:** the wallet-as-reader `ro=new ethers.BrowserProvider(cutReads(…),net)` has no `staticNetwork`. ethers 6.13.2 checks eth_chainId with every call (`#checkNetwork`).
  - **Test:** every reader is down and the wallet is the reader (OWED 0.05). The wallet moves to Base and answers eth_call there with 0.09 (`eth_call@0x2105` asked and answered). refreshSeats throws `network changed: 1 => 8453 (NETWORK_ERROR)` and OWED stays 0.05000.
  - The next tick's rebind re-checks the chain (walletReads).
  - **Sensitivity:** the mutant `staticnet` (adding `{staticNetwork:net}`) shows 0.09. The test detects wrong-chain reads.
- **H3:** the same root as a5v1. **Fixed** (the menu row).
- **H4, ACCEPTABLE (a5f3).**
  - **Mechanism:** a confirmed withdrawTo that leaves nothing owed shows "Confirmed: the contract paid everything…". The owed read then closes the box (nothing is owed), and the note goes with it.
  - **What remains:** the toast "Withdrawing to another address: confirmed" and OWED 0.0 ETH. Nothing claims the amount is still owed, or that the withdrawal failed.

### e. Found while verifying: the staging chrome under the modal sheet (stage.js, a7b8f1e)
- **Symptom:** the staging RELEASE on f1d1552 failed **st18** and **st27**: `page.click('#sg-ctl')` timed out.
- **Root cause:**
  - The page agent's modal sheet makes every top-level element inert, including the staging banner, the CONTROLS drawer, the note and the simulated wallet screen.
  - SCENARIO 3 emits events from CONTROLS while the CONFIRM sheet is open, and SCENARIO 7 changes the account or network while the review is open.
  - The cause is the 0533881 integration, not this fix. st18 fails identically with 0533881's index.html and stage.js:
    - dev/st18-all0533881.log, run 20261102T043916Z-19124-a82cde
    - dev/st18-idx0533881.log, run 20261102T043726Z-17850-c5673f
    - dev/st18-head.log, run 20261102T043726Z-17857-39f41f
  - Interrupted release: release/staging-release-f1d1552.log, run 20261102T043340Z-13997-fcf53c (st18, st27 FAIL).
- **Fix:** `stagingLive()` in stage.js (L538, called from `ui()`) uses a MutationObserver to release only top-level elements whose id starts with `sg-`. The page's own elements stay inert. Staging-only; no build.js patch.
- **Result:** st18 and st27 PASS (dev/st18-27-fix.log, run 20261102T044337Z-26114-dac31e). The mutant that removes the guard is byte-for-byte the pre-fix stage.js, so its failing runs are the ones above.

## 3. Checkpoints (fixed windows → explicit gates)
- **Rule:** a fixed `sleep()` before an assertion about a state the page reaches asynchronously is replaced by a gate on that state.
  - The gates use hit counters, a *later tracker round* (the payment's own receipt asked again after the trigger was served), the attempt being over (`CONNECTING===null`), or the page's own fallback having run.
  - The bounds are generous: 20-30 s, 15 s for an attempt.
  - The gate result is asserted (`gate`, `next`, `over`, `settled`).
  - Every assertion is kept. Release waits were raised from 6 s to 30 s.
- **What stays:**
  - Fixed waits used as **absence windows after a proven trigger** (nothing more is sent or asked).
  - Waits after synchronous emits or closes.
  - Waits before an action rather than before an assertion.
  - These cannot fail falsely under load, and they are listed by file at the end of this section.

| case(s) | was | gate now | proof it still fails without its guard (temp copies, intended assertion) |
|---|---|---|---|
| a5n1-a5n8, a5n10, a5n11 (scen) | `sleep(o.ms)`, 1.8-4 s | trigger served (a5n6: served≥3 and wallet asked; a5n7: wallet asked; a5n10: "unknown" told and wallet asked; a5n11: hit>0), then a later round or a decision; a5n5 and a5n9: decided | old page 111ebf7 (pre-audit-5), run 20261102T042820Z-10426-27cb2a: every case FAIL. Mostly mid replaced/cancelled/confirmed; a5n2/a5n4: the wallet asked before the next reader. |
| a5n9 (guard) | `sleep(3500)` | decided | mutant `repriced` (speed-up branch removed), run 20261102T042720Z-8863-392269: same/* = replaced |
| a5n12 | `sleep(3500)` | poison served, then a later receipt round | old page 111ebf7: "replaced it with another transaction" |
| a5x1 | `sleep(4000)` | fails≥3 and ledger 13 and day | old page 111ebf7: "Uncaught (in promise) … 500" page error |
| a5m1-a5m4, a5m7 (phoneRow) | `sleep(1500)` | `CONNECTING===null` | old page 111ebf7: B asked (rq 1, acc 2) |
| a5m5, a5m6 (guards on 111ebf7) | `sleep(1500)` / `sleep(1200)` | `CONNECTING===null` | mutant `fallback` (asks another wallet after a failure), run 20261102T043340Z-13998-eb0b65: B.rq 1 / A.rq 1 |
| a5w2 | `sleep(300)` | refusal note written | mutant `wtocheck`, run 20261102T042735Z-9330-debad8: note "Reading…", sheet opened |
| a5w4 | `sleep(800)` + `sleep(1500)` | busy toast; release answered and sends≥1, then the absence window | mutant `oplock`, run 20261102T042738Z-9468-e2332a: requests 2, busy false |
| a5w5 (a) | `sleep(800)` | NOTSENT toast | mutant `wtoboth` (gen and rk checks removed), run 20261102T042748Z-9673-a847e0: est 1 |
| a5w8 | `sleep(800)` / `sleep(300)` | button and box hidden | mutant `wtooff`, run 20261102T042754Z-9852-bcaf69: button shown, box value kept |
| a5r1 | `sleep(2200)` | hit>0, then a later round or a decision | old page 6c18095, run 20261102T042807Z-10006-a0912e: rows mid replaced; mutant `rcany`: rcVsBlock replaced |
| a4r1-a4r5 (table) | `sleep(2600)` | pending rows reads≥4, others decided | mutant `rcany` (rcGood accepts any object), run 20261102T042031Z-3206-db5316: got reverted/confirmed, gate false |
| a4r8 | `sleep(1500)` | reads≥3 (bounded by STOP) | rcany: mid reverted |
| a4r9 | `sleep(1800)` | replacement receipt read 2×, then a later round | rcany: mid replaced |
| a4r11, a4r12 | reads≥4 + `sleep(300)` | reads≥5 | rcany: "failed on Ethereum (reverted)" / NOT COLLECTED |
| a4w5, a4w9, a4w10 | `sleep(8300)` | the page's 8 s fallback text is shown | mutant `wchook` (correlation off), run 20261102T041932Z-1949-0b79b7: woke [7..13] / afterFirst woke / exact link to the wrong request |
| a4c7 | `sleep(300)` | last toast "in your wallet now" | mutant `busytext`, run 20261102T041956Z-2395-86d817: busy "…is busy." |
| a4v1, a4v8, a4v9, a4s6 | gate + `sleep(300)` | sheet title CONFIRM IN … | `pickstore` (a4v1: CONFIRM IN RAINBOW), run 20261102T042012Z-2854-9bb8ad; `forget` (a4v8, a4v9, a4s6: names ZERION), run 20261102T042006Z-2530-3afe95 |
| a4v7, a4s5 | `sleep(200/300)` | an app button awake | `gone`, run 20261102T042038Z-3439-e0dc46: a4s5 liveAppButtons 0 with "Tap the app…"; a4v7: "no sheet button /^RAINBOW$/" (thrown by clickSheet after the gate timed out: the restored app sheet is missing, which is the defect) |
| a4s2 | `sleep(800)` | seats 0.0000 and CLAIM disabled | mutant `seatsread`, run 20261102T042715Z-8684-591501: old seats 2.0000 shown during the hold, CLAIM sent |

Remaining `await sleep(` calls, all absence windows or no-ops:
- audit4: 14 (a4c sweep settle after sync emits; absence after until)
- audit4review: 4
- audit4scan: 8
- audit5b: 22 (page agent's: after a gate or a synchronous close, then FS)
- audit5page: 1 (a5w4's absence window after its barrier)
- audit5review: 1 (a5r2)

## 4. Mutation table for the new guards (temp copies built from index.html 691687a3 and stage.js b7443f9, deleted)
| mutant | guard removed | killed by | failing evidence (intended assertion) | run |
|---|---|---|---|---|
| nudgesent | `if(n.sg!==SHEET.n) return;` | a5v1 review + menu | review/CONNECTED text → "No word yet…", "The request is in ZERION now…" | 20261102T041822Z-32116-41c63e |
| nudgeoff | `if(n.sg===SHEET.n)` before sheetOff | a5v1 menu | afterSettle on:false (CONNECTED closed by the nudge settling) | 20261102T041827Z-32317-6fa128 |
| wsx | CLOSE closes the visible sheet after a stale callback | a5v1 menu | closeWhilePending: CONNECTED still on after CLOSE; still on after the late answer | 20261102T041832Z-32514-a89cf7 |
| mine | `mine()` → `true` | a5v1 connect | probe replaced by WALLETCONNECT DID NOT ANSWER, then "Tap the app…", buttons enabled | 20261102T041838Z-32703-06f63d |
| finish | `if(mine())` before finish's sheetOff | a5v1 connect | afterApproval on:false (probe closed) | 20261102T041843Z-416-5113e3 |
| closeread | review close on owed 0 | a5v2 | sheetClosedByRead false, no close toast | 20261102T041849Z-677-0d21fd |
| rk | `rk!==WTO.k` refusal | a5v2 | walletAsked true: eth_estimateGas 1, eth_sendTransaction 1 | 20261102T041900Z-1086-20b78c |
| stage verdict | `why=chainVerdict(x)` for replacements | a5v3 | sped: status 1, R1 received 0.05, "confirmed (sped up in your wallet)" | 20261102T041908Z-1437-031abc |
| stage effect | effect for REPLACED | a5v3 | replaced: status 1, owed 0.05, sender 0 | 20261102T041920Z-1740-5bb45d |
| staticnet (H1 sensitivity) | ethers' per-call network check | a5f2 | refresh ok, OWED 0.09000 | 20261102T041905Z-1281-cd7d71 |
| (staging chrome) | `stagingLive()` | st18, st27 | `#sg-ctl` never clickable (= pre-fix stage.js, §2e) | 20261102T043726Z-17857-39f41f; release 20261102T043340Z-13997-fcf53c |

## 5. Verification on the final head bce0646 (CASE_TIMEOUT raised: production 360 s, staging 600 s, RUN_TIMEOUT 3600 s; no wait weakened)
- **Production RELEASE=1: 221/221, exit 0, run `20261102T044543Z-26868-e299af`.**
  - The 193 audit-5 cases, plus 22 a5b/a5c/a5d/a5e, a5v1-a5v3 and a5f1-a5f3.
  - Verifier, strict: **VERIFY OK** (release/verify-prod-release-bce0646.txt).
  - An earlier production RELEASE on f1d1552 also passed, 221/221, run 20261102T042518Z-7186-0df68f, VERIFY OK. It is superseded because a5v3 reads test-wallet.html, which changed in bce0646.
- **Staging RELEASE=1: 42/42, exit 0, run `20261102T044543Z-26867-31e6eb`.**
  - Page d38455f2…, candidate 691687a3 (a7b8f1e).
  - Verifier, strict, with `--expect-candidate 691687a3…`: **VERIFY OK** (release/verify-staging-release-bce0646.txt).
- **Self-tests:**
  - selftest-staging.js: **22/22** (selftest-staging.log).
  - selftest.js: **31/31** (selftest-prod.log, port 8934). It was first started by mistake on port 8941, outside my range, and stopped after a few seconds; then it was rerun on 8934.
- **Race groups** `CASES=@audit2,@audit4,@audit5,a2,c,d,e,f,i4,l2,l3,hz2` ×3, sequential (152 cases each): **all three 152/152, exit 0**. Each was checked with `verify-results --cases`: **VERIFY OK** (race/verify-race-*.txt).
  - race-1: run 20261102T050347Z-17222-bd184c
  - race-2: run 20261102T051519Z-23661-a950a3
  - race-3: run 20261102T052627Z-30017-ae25ba
  - The checkpoint-rewritten cases (a5r1, a5n9, a5n11 and the rest) passed in every run.
- **Contract suite** (`cd stormglass && npx hardhat test`): **42 passing** (contract-tests.log).
- **Development runs:**
  - dev4 (@audit4,@audit5 on the edited tests, 108/108): run 20261102T041533Z-30224-4e435e.
  - The page ritual (`ritual.js index.html`) passed after each index.html edit.

## WORDING (old → new, verbatim)
1. NEW toast, index.html refreshSeats (an open withdrawal review closed by an owed-0 read): `The contract owes this wallet nothing now. The review was closed; nothing was sent from it.`
2. NEW toast, index.html wtoSend (SEND of a review the box has moved past): `This review is out of date. Nothing was sent.`
3. Staging LOG line, stage.js txResolve:
   - Old: `SIMULATED CONTRACT: the replacement withdraw reverts: <reason>`. Only REPLACED BY A WITHDRAWAL THAT PAID used it.
   - New: `SIMULATED CONTRACT: the replacement <action> reverts: <reason>`. Now for SPED UP, REPLACED and REPLACED BY A WITHDRAWAL THAT PAID; `<action>` is withdraw or withdrawTo.

No other user-facing string changed. The staging-chrome fix and the CLOSE change add no text.

## Limitations
- a5v1's WalletConnect side, and its menu and connect rows, are controlled probes: a fake provider, and page functions called as stand-ins. No real wc.js or relay is involved.
- Under the fix, a5c4 and st40 ("owed becomes zero after REVIEW") press SEND right after changing owed. If the page's 30 s tick happened to read owed 0 in that gap, the review would now close before SEND and the case would fail. The window is milliseconds, and it did not happen in any run.
- No new visuals; the changes are behaviour and toasts only. No law-8 screenshots were taken.
