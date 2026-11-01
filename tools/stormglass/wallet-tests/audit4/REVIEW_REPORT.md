# Brief R4: STORMGLASS wallet audit 4 — S1-S6 repairs, harness gaps, second audit: REVIEW REPORT

Worktree /home/claude/wt-audit4, branch audit/wallet-4. Nothing pushed. No real wallet, RPC or relay contacted: mocks and the fake chain only, plus Chromium's WebRTC now blocked (G2). Evidence: /home/claude/audit4/ev/review/ (logs, results JSON, mut/, shots/).

## Commits (on 30cf5d8; author 0xgreencross, with the session trailers)
| commit | what |
|---|---|
| 52c5732 | index.html: S1-S6 repairs (wallet code only) |
| 1bed984 | wallet.test.js: harness gaps G1, G2, G3 (no page change) |
| 8bf8881 | second audit: audit4review.test.js (a4h1, a4v1-a4v7), index.html fixes for a4v2 and a4v4, README |
| f12cc96 | a4v8, a4v9 (S5's other paths) |
| 7865cf8 | a4v10, a4v11 (B's emitter binding and topic equality, each on its own) |
| 24cda89 | audit4-shots.js (review screenshots) — FINAL CANDIDATE |

Final index.html sha256 703602f19f0e9fdb3edf46e1cf5e17af5bd1e69d38a9d2a2caf62dad10fe50c5. Diff 30cf5d8..24cda89: index.html +38/-13 (wallet code only: no contract address, ABI, chain config, economics, artwork or visual change; no CORE markers, law 15 n/a); tests: wallet.test.js (runner + c/d/e/f/a2/l2/l3), new audit4review.test.js, new audit4-shots.js, README. Ritual PASSED on the final file (ev/review/ritual-final.log).

## PART 1 — S1-S6

Fail-first: @audit4 on 30cf5d8 = 30/36, FAILED exactly a4s2-a4s7 (ev/review/cand-30cf5d8-a4.log). After the repairs: 7/7 a4s (s-dev1.log), and in every final run.

**S1 (a4s2) seats panel keeps the old account's values.** `setSession` now remembers the old `me`; on a different address it calls `seatsReading()`: `nx-mine` hidden, seatsNote "Reading your seats…", CLAIM disabled, WITHDRAW hidden, `markMe()` (board row follows the new account). `refreshSeats` fills it on its answer; a failed read leaves it neutral until the next 30 s tick. Root cause: nothing account-bound was reset between the account change and the new reads. Evidence: during the held reads `{mineShown:false, note:"Reading your seats…", claim:false}`, no wallet request, after release 0.0000/CLAIM off. Adjacent: initial connect also passes through it (harmless: "Reading…" until the first answer); x6/x7/j1/p3 pass.

**S2 (a4s3) dead wallet as last-resort reader freezes the page.** `walletReads` now races `chainOf(P)` (a sync throw, a rejection or a malformed answer = no) against the picker's 1.5 s. Dead wallet: CANNOT REACH ETHEREUM in 1.7 s (was never), recovers when the readers return. The optional "install the interval before the first tick" was NOT done: overlapping ticks would be new behaviour, and the root cause is the unbounded await. The second audit found the same freeze one step later (a4v2, below) and fixed it too.

**S3 (a4s4) account change without an event leaves the page stuck.** In `opCheck`, when eth_accounts is a list whose first entry is another valid address, or an empty list, and the op is still current (opLive passed after the await), the page calls `onAccounts(op.P, [first])` — the same path as the event: another account → setSession; empty → the existing 1.5 s eth_accounts double-check → disconnect — and the write stops with a truthful toast. Malformed answers (not a list, or a first entry that is not an address) still stop and follow nothing (guard a4v5). Departure from the suggested repair: the first draft also followed `[null]` as "empty"; a4v5 caught that it then disconnected on a malformed answer, so malformed is now strictly "stop, follow nothing". The OTHER_ACCT wording keeps "changed" so the historical v2 (asserts /changed/) passes unchanged. Evidence: first press stops, label → B; second press sends from B; permission gone → CONNECT.

**S4 (a4s5) WalletConnect link after the 20 s sheet.** wcConnect remembers that the dead sheet replaced the picker (`gone`); `onUri` re-renders the CONNECT YOUR WALLET sheet (`pickSheet()`, same buttons/handlers) before waking it. SHEET_CLOSE still points at `finish`. Evidence: title CONNECT YOUR WALLET, 5 live buttons, "Tap the app…"; a4v7 (guard) taps RAINBOW in the restored sheet: jump `https://rnbwapp.com/wc?uri=wc%3A…`, pairing completes, RAINBOW remembered.

**S5 (a4s6) stale remembered WalletConnect app.** The stored app belongs to the pairing it was tapped for: `pick()` sets `picked`; OTHER WALLET and COPY CONNECTION LINK call `forget()` (clear `picked`, SG_WC_APP and the library key); when `enable()` completes with no app tapped, `forget()`. Peer-metadata matching was not added (names are self-reported and vary: "MetaMask Wallet", etc.; a mismatch would only disable a valid OPEN). Evidence: a4s6 sheet "CONFIRM IN YOUR WALLET", stored null; a4v8 (no tap) and a4v9 (ZERION tapped, then COPY / OTHER) fail on 30cf5d8 and pass; a4v1 guard: a ZERION-button pairing keeps CONFIRM IN ZERION + OPEN ZERION.

**S6 (a4s7) COLLECT still says "confirm in your wallet" after DISCONNECT.** `disconnect()` keeps the not-handed lock it kills and, after resetting the UI, calls its `onDead` (try/catch). nxCollect registers `onDead`: if the dialog is still this press's, it shows NOT COLLECTED "Disconnected before the payment reached your wallet. Nothing was sent."; either way the press is marked stopped (`mine()` false), so the wallet's late answer cannot overwrite the dialog. Handed locks are untouched: a4v6 (guard) disconnects after the hand-off — the dialog keeps "confirm in your wallet", the lock stays, the late hash is followed to DAY 13 IS YOURS. WITNESS/other writes have only toasts; "Disconnected." already says it, so no onDead there.

Earlier fixes preserved (all in the final full run): lock (q1-q6, u9), provider identity (c, h*, j2), delayed revocation (k3-k6), abandoned connection (u1), dialog/op tokens (p1-p5, x1-x5, z3), scan bounds and missing blocks (y1-y10), tracking after disconnect (g, r9, m5), WC fallback wording (u2, u12), A/B/C (a4c*, a4w*, a4r*).

## PART 2 — harness gaps
- **G1** (wallet.test.js): results JSON written after every case; RAN / NOT RUN / summary come from one `report()` used by the normal end and by `beforeExit`; each case races the browser's `disconnected` (one handled rejection), so a crash fails that case and the rest are listed NOT RUN; context/browser close bounded at 5 s. Proof (temporary self-test file, removed): CDP Browser.crash in zstc → `FAIL zstc {"exception":"browser disconnected during the case"}`, `RAN 2: zst1,zstc · NOT RUN: zst2`, results JSON with zst1 PASS, rc=1 (g1-crash.log); a never-settling case through beforeExit → `RAN 2 · NOT RUN: zstb`, JSON written, rc=1 (g1-beforeexit.log).
- **G2**: cheap block exists and works. `--force-webrtc-ip-handling-policy=disable_non_proxied_udp` did NOT block (4 STUN packets, a host candidate); `--webrtc-ip-handling-policy=disable_non_proxied_udp` does (0 packets, 0 candidates). The runner now launches with it; a4h1 points an RTCPeerConnection at a local STUN listener (ephemeral port) and requires 0 packets and 0 candidates. Mutant (flag removed): a4h1 FAIL with 4 packets (mut-a4h1-noflag.log). No stub was used: the page's environment is unchanged.
- **G3**: c, d, e, f now wait for the stopped write's own end — its "Nothing was sent" toast after the release AND `OPLOCK===null` — then assert, and additionally count eth_sendTransaction REQUESTS (not only broadcasts; e counts requests from the old account). a2 waits for the wrong-network view with the lock free, then for the refused switch to be over (its toast, SWITCH enabled again), and requires SWITCH to exist, then asserts no request and no send. l2/l3 count panel redraws (wrapping `morph` on #panel) and require ≥1 per wait. No assertion was removed. All seven pass on the candidate and on 0cd4ea4 (g3-cand.log, g3-base.log); non-vacuity: mutants with the redraw timer stopped fail l2 (`redrawsWhileSelected:0`) and l3 (`redraws:0`). Fixed sleeps after the barrier: 300-500 ms only. q1/i4 (delay-based) left as documented in HARNESS4.

## PART 3 — second audit (whole candidate, not only changed lines)
| check | finding |
|---|---|
| Chain invalidation vs own switch | Own switch: crev is re-read after the switch and before the final chainOf; events naming mainnet count for nothing; early/late own announcements pass (a4c6). Switch accepted then a real change: counted, MOVED (a4c3). A non-mainnet event arriving during the final read stops the write (conservative, nothing sent). Header SWITCH only ever switches to mainnet. parseInt handles "0x1", "1", numeric 1; objects count as non-mainnet (stop). No defect. |
| WC correlation leaving prompts disabled | Every path ends enabled: exact event → enabled; amb/bad id/topic → 8 s timer `wcNudgeSent(n,null)`; conflicting duplicate → enabled generic. S5 can now give the no-app sheet (no OPEN button) — the pre-existing no-app case, never a disabled one. No defect. |
| Emitter/topic bindings individually | Mutation showed `if(!own) return;` and `ev.topic!==n.topic` were only reached via the params identity in a4w1/a4w2 (both mutants survived). Not a page defect, a coverage gap: **a4v10, a4v11** (event carries this request's params) kill them. |
| Listener cleanup on reconnect / replacement | follow(): once per provider (HEARD), handlers check P===EP; CHAINREV counts per provider (harmless for old ones); NX_HOOKED interval listener calls nxWrong on the current EP; wcHook once per client; display_uri removed in finish (closing the sheet always reaches finish). No defect. |
| Receipt validation vs legitimate receipts | Hex any case for hash/blockHash/blockNumber (lc compare), leading zeros in blockNumber accepted, `to` null handled. Status is exactly "0x0"/"0x1": "0x01" is refused (pinned by a4r1). Kept deliberately: spec quantities have no leading zeros, the three readers are spec-conforming, and refusal can only delay to "cannot confirm", never mislead. Numeric status cannot arrive: trackTx reads only raw JSON-RPC (no ethers `.wait()` anywhere in the page). |
| Fallback loops / deadlines | trackRpc asks each reader at most once per call; an unusable answer never sets `ok`, so `lastOk` and t0 deadlines are not reset (a4r8). No loop. |
| Replacement scan skipping | Cursor moves only after a block is read in full; an all-unusable receipt throws out of the batch with the cursor on that block; a null receipt breaks the batch. No skip. |
| New awaits / ownership races | S1, S3 (onAccounts not awaited; its empty-list branch re-checks SES/EP after its await), S4, S5, S6 add no await to the op path; S2/cutReads only affect reads. No defect. |
| Read path through the wallet (S2's neighbour) | **DEFECT a4v2**: a wallet that answers eth_chainId but never a read (eth_call) froze the first tick exactly as S2 (no CANNOT REACH, no retry): `said:false` at 30 s, 16 eth_call hangs. Fix: the wallet reader gets the public readers' 8 s per request (`cutReads`, an EIP-1193 wrapper passing request() only). Now CANNOT REACH in 8.2 s and recovery when readers return. Guard **a4v3**: a slow (1 s eth_chainId) but answering wallet still serves as the reader while every public reader is down. |
| Observer errors | **DEFECT a4v4**: send()'s observer try/catch only caught sync throws; COLLECT's observer is async, so any rejection inside it escaped as an unhandled rejection (two page errors in the case). No natural trigger found in today's observer bodies, but the contract was wrong. Fix: a thenable result gets a rejection handler. |
| Old ops vs current UI / newer locks | opFree checks identity; onDead runs only for the lock disconnect kills (the current one); `stopped` keeps an old press away from the dialog; refreshSeats/onAccounts keep their SES checks. No defect. |
| Staging leakage | index.html carries none of the staging marks (grep 0). `build.js --src index.html --out <scratch>` builds clean from the candidate; staging tests on a temporary untracked build: **15/15 PASS** (ev/review/staging-8bf8881.log; page bytes identical to 24cda89's); test-wallet.html deleted before committing. |

## MUTATION PROOFS (temporary copies outside the repo via TARGET; deleted afterwards; ev/review/mut/)
| guard removed | regressions run | result |
|---|---|---|
| A: opLive chain-revision check | a4c1-a4c4 | 0/4 — all FAIL |
| B: emitter binding (`if(!own) return`) | a4w1, a4w2 / a4v10 | 2/2 pass (survived) / **a4v10 FAIL** |
| B: params identity | a4w3, a4w4, a4w9 | a4w3, a4w9 FAIL |
| B: topic check (whole) | a4w1, a4w2, a4w10 | a4w10 FAIL |
| B: topic equality only | a4w1, a4w2, a4w10, a4v11 | **a4v11 FAIL** |
| C: transactionHash check | a4r2, a4r9, a4r11, a4r12 | a4r2, a4r9 FAIL |
| C: status check | a4r1, a4r8 | a4r1 FAIL |
| C: blockNumber checks | a4r3 | FAIL |
| C: send-block (min) only | a4r3 | FAIL |
| S1 seatsReading | a4s2 | FAIL |
| S2 1.5 s cut | a4s3 | FAIL |
| S3 follow (onAccounts) | a4s4 | FAIL |
| S3 malformed guard | a4v5 | FAIL |
| S4 re-render | a4s5, a4v7 | both FAIL |
| S5 forget after enable | a4s6, a4v8 | a4v8 FAIL |
| S5 forget on COPY | a4s6, a4v9 | a4v9 FAIL |
| S5 forget on OTHER WALLET | a4v9 | FAIL |
| S6 onDead call | a4s7 | FAIL |
| a4v2 cutReads | a4v2 | FAIL |
| a4v4 async observer | a4v4 | FAIL |
| G2 WebRTC flag | a4h1 | FAIL (4 packets) |
| G3 l2/l3 redraw timers | l2, l3 | FAIL (0 redraws) |
Every guard is killed by at least one regression. (S5's three forget sites overlap for a4s6 alone; a4v8/a4v9 make each one killable.)

## PART 4 — final validation on 24cda89
- **Ritual** (node --check, id audit, vm smoke) on index.html of 24cda89: RITUAL PASSED (ev/review/ritual-final.log).
- **Full suite** (ev/review/full-24cda89.log, results-full-24cda89.json): **161/161 PASS, rc=0**. Historical **@orig 38, @audit2 35, @audit3 21, @audit3b 17, @harness 2 = 113/113**; **@audit4 48/48** (audit4 29, audit4scan 7, audit4review 12: a4h1, a4v1-a4v11). 0 page errors; outside traffic refused and recorded as before (the WalletConnect relay over wss in the cases that load the real wc.js). Run in parallel with rep1.
- **@audit4 x5, two runners in parallel** (rep1-rep5): 48/48, **47/48 (a4r7)**, 48/48, 48/48, 48/48. a4r7's failure is its own time bound, not its outcome: `{badFromFirstReader:1, state:"confirmed", nextReaderReceiptRequests:1, ms:1883}` against `ms<1400`. One bad answer and one request to the next reader = the same round structurally; a next-round confirmation would have asked the first reader twice. Its ms elsewhere: 24, 32, 45, 427. The delay is fetch latency through Playwright's routing (page.route -> context route -> Node) while two runners and their browsers share the machine. Judged a load flake of a tight timing assertion (law 14); the test was NOT changed. Suggested hardening for the owner: assert `bad===1&&next===1` (structural same round) next to, or instead of, the 1.4 s bound.
- **@audit4 x5, sequential** (seq1-seq5): **5 × 48/48 PASS**, identical outcomes, 0 page errors (a4r7 ms: 29, 36, 27, 27, 38).
- **Staging**: build from the candidate clean; staging tests 15/15 on the same index.html bytes (staging-8bf8881.log).
- **Screenshots** (ev/review/shots/, 66 PNG + probe.json; contact sheets in shots/sheets/): picker, connected, seats-reading (S1), wrong-network recovery, WalletConnect hand-off (phone/iPad UA), COLLECT pending / failed (S6 text) / reverted / unknown, witness amount after REDRAW (selection kept), pledge box after its 1 s redraw, at 1440x900, 1366x768, 1280x800, 1024x768, 768x1024, 390x844. Probe: every element of interest inside the viewport, no horizontal page scroll, no box scrolling, 0 page errors. LOOKED at all 66 via the sheets and the 390 WalletConnect shot full size: layouts coherent; the only issue seen is the pre-existing phone toast overlap (limitations). Script: tools/stormglass/wallet-tests/audit4-shots.js.

## WORDING FOR APPROVAL (new user-facing strings)
1. "Reading your seats…" (S1, seats note while a new account's seats are read)
2. "Your wallet changed to another account. Nothing was sent." (S3, toast / COLLECT reason)
3. "Your wallet gives this page no account now (locked or disconnected). Nothing was sent." (S3, eth_accounts empty)
4. "Disconnected before the payment reached your wallet. Nothing was sent." (S6, COLLECT dialog under NOT COLLECTED)
5. "The wallet did not answer the read in 8 seconds." (a4v2; internal error text, logged to the console only, never shown)
(plus, carried from the fix session: "Your wallet changed network while this was waiting. Nothing was sent." (A))

## Remaining limitations
- Real devices: no real wallet was used. Not verified: how often wallets change eth_accounts without an event (S3), MetaMask's locked-state eth_accounts on every version, real WalletConnect pairing latency over 20 s (S4), whether real wallets emit only the target chain during a switch (A), iOS page freezing / return from the wallet app (no visibilitychange handler in index.html or wc.js), universal-link behaviour of the OPEN/app buttons.
- S5 migration: a session paired under the old code through COPY/OTHER while another app was stored keeps that stale SG_WC_APP until the next pairing (no peer-metadata check, by choice).
- B: the exact link rests on wc.js's shallow copy of params (observed, not a documented API); a future bundle degrades to the generic link.
- C: status "0x01"-style leading zeros are refused (pending → "cannot confirm"), deliberate. One valid receipt decides; no reorg re-check.
- Visual (pre-existing, not changed here; for the curator): on phones (390x844) the toast sits mid-screen over the open sheet/dialog — in the WalletConnect hand-off the "confirm in your wallet" toast covers part of the text and the top of OPEN ZERION for its few seconds (shots/wc_390x844.png; also pending/unknown/wrong at 390). The plate area is white in shots because the harness stubs /glass.
- q1, i4 remain delay-based (HARNESS4). Chromium's own background connections (not page requests) stay outside routing.
- Unused residual: tick has no reentrancy guard; a tick longer than 30 s could overlap the next (pre-existing; now every read is bounded at 8 s per request).
