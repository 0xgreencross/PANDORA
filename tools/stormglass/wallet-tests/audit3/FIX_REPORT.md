# Brief F: STORMGLASS wallet audit 3, Findings A and B (plus the z lead): FIX REPORT

Worktree /home/claude/wt-a3-fix, branch audit/wallet-3-fix (from 553222a). Nothing pushed. Evidence is in /home/claude/audit3/ev/fix/ (logs `*.log`, results `results-*.json`). Baseline page: /home/claude/audit3/baseline_index.html (= f9a6f80:index.html, sha256 da27e818…).

## Commits (author 0xgreencross, with the session trailers)
- 9980312: Finding A repair, tests x1-x6, fakechain helpers.
- 26aa0b7: Finding B repair, tests y1-y9.
- dd28a49: adjacent fixes (switch-refusal feedback, stale SWITCH callback, welcome image), tests x7, z1-z4.
- 2fc2885: Finding B follow-up (on missing data, the scan moves to the next reader), test y10.

Diff 553222a..2fc2885: index.html (wallet code only), audit3.test.js (new), fakechain.js (additive hooks only: `S.log`, `S.blockAns`, `S.topAns`; the defaults leave every answer unchanged). No contract address, ABI, chain config, economics, visuals or harness runner was touched.

Test instrument (audit3.test.js `holdLookup`): it wraps the page's contract object (`storm` or `giftC`) and holds the ANSWER of the first read made from a named page function (matched on the call stack: soldTo, failReason, txView, refreshSeats, welcome). The request still goes out at once, so this models a slow reader. Each case also asserts that the hold was hit, so a missed hold fails the case instead of letting it pass vacuously.

## Finding A: stale asynchronous error feedback (nxCollect observer)
**Trigger.** A COLLECT reverts or fails, and its explanation lookup (`soldTo()` / `failReason()`, an eth_call to onSale) is slow. While it is pending, the user closes the dialog and opens another option or another day. Or they press BACK and COLLECT again in the SAME dialog on the same option. `mine()` was checked only before the await. In the same-dialog case, dialog + option + day are identical, so even a re-check could not tell the operations apart.

**Impact.** The new dialog shows "[!!] NOT COLLECTED" with the old operation's reason. This overwrites a newer operation's "confirm in your wallet" view. The toasts were right; the dialog was wrong.

**Repair** (index.html):
- 1491/1498: an operation token (`NX.op`) is taken right after the lock, and `mine()` also requires `NX.op===tok`.
- 1506 and the error branch: the reverted and error observers resolve `soldTo(day)` / `failReason(x,day)` first, then check `if(mine())` immediately before `txView()`, with no await in between.
- 1480: `failReason(e,day)` uses the operation's day instead of `CC.day`.

**Adjacent callbacks, same pattern:**
- Seats in the done view (1478): the element is captured before the await and written only if it is still connected.
- `refreshSeats` (~1713): a sequence number drops an older answer once a newer one is shown.
- `welcome()` (779): the gift image is written only into its own element, for the account still connected.
- Inspected and already safe: success/confirmed, cancelled, replaced and unknown are synchronous behind `mine()`; connect, `nxWrong` and the closed check re-check after their awaits; `candShow` checks `CC.k`; the welcome mode reads re-check `sameAddr`.

**Regressions:**
- x1: reverted, other option.
- x2: error, other option.
- x3: reverted, other day.
- x4: error, same dialog instance, same option, newer operation; it then completes in its own view.
- x5: done-view seats, late answer vs a newer COLLECT.
- x6: refreshSeats crossing.
- x7: welcome image after an account change.

Baseline results: x1-x6 0/6 in ev/fix/x-baseline2.log. For example, x1 `after:{"k":5,"tx":"failed","acts":"[!!] NOT COLLECTEDIt reached Ethereum but failed (reverted)…"}`, x4 `after:{"tx":"failed","acts":"[!!] NOT COLLECTEDexecution revertedBACK"}`, x5 `before:"4.0000", after:"3.0000"`. x7 fails in ev/fix/x7-baseline.log (`changed:true`). All pass on the candidate (x-fix1.log, cand-audit3.log, full run).

**Decision.** Dialog identity + option + day is not enough (x4), so an operation token is needed.

## Finding B: moving replacement-scan bound (trackTx)
**Trigger.** The nonce is spent while the original receipt is not seen. `for(b=scanAt; b<=min(top, scanAt+scan-1); b++)` advances `scanAt` inside the loop, so the bound moves and one pass reads all the way to the head. More defects found while reproducing it:
- (a) a block answered null was treated as empty and skipped forever;
- (b) a matching transaction whose receipt lagged was `continue`d, then the block was skipped forever;
- (c) a head of null or garbage became 0, which immediately said "cannot confirm" (as did a head behind the send block, from a lagging reader);
- (d) deadlines (TRACK.lost/stop) were only checked after the whole pass;
- (e) after (a)/(b) were repaired, one reader that never has the block could hold the scan.

**Impact.** Unbounded request bursts. The original receipt is not re-asked for the whole pass, which delays a confirmation (y8: about 10+ s vs about 0.3 s). Replacements in a missing or lagging block were never found (y4, y6, y10: stuck on "cannot confirm"). There was a premature "cannot confirm" (y9), and the unknown/stop deadlines were overrun (y7: unknown at about 24 s with lost=2.5 s; block reads continued after stop).

**Repair** (index.html, trackTx ~1129-1158):
- The head is validated (a safe integer above 0), otherwise the round is skipped.
- `end` is computed once before the loop, so a batch reads at most TRACK.scan blocks and the original receipt is asked again at the top of the next round.
- The cursor advances only after a block is read in full. A null, hashes-only or error block, or a matching transaction without a receipt, breaks the batch, keeps the cursor on that block and rotates `trackAt` to the next reader.
- "unknown" for a spent nonce is said only after this round actually read up to the head.
- A batch breaks when the lost or stop deadline comes up mid-batch.
- The classification (sped up / cancelled / replaced) is unchanged.

**Regressions** (TRACK.scan=5 in the tests; the head is pinned through `S.topAns` so the start block B is known):
- y1: replaced at B+37 of 60. The baseline reads 38 blocks in one batch with no receipt re-check.
- y2: sped up at B+7.
- y3: cancelled at B+13.
- y4: block answers null 3 times.
- y5: block gives an RPC error on every reader, twice.
- y6: replacement receipt lags 3 times.
- y7: deadlines with 800 blocks at 25 ms each.
- y8: the original receipt appears mid-scan.
- y9: head null, then behind.
- y10: the first reader never has the block.

Each case asserts at most TRACK.scan blocks between two original-receipt requests, contiguous in-order reads starting at B, and no read past the block that holds the replacement.

Baseline: 0/9 in ev/fix/y-baseline.log (for example y1 `maxBlocksPerBatch:38,batches:1`, y2 8, y3 14). y10 fails on the baseline (ev/fix/y10-baseline.log) and on 26aa0b7 before the reader rotation (ev/fix/y10-on-26aa0b7.log). All pass on the candidate (y10-cand.log). r5-r8 still pass.

## The z lead (from the harness agent)
- **The mutant was confirmed.** Removing opBegin's wrong-chain early return survives a1, because a1's regex matches the connect toast and opCheck later throws WRONG_CHAIN. The mutant estimates gas on the wrong chain, toasts "confirm in your wallet", and then "moved to another network".
- **z1 (guard).** On a wrong chain with the switch refused, the witness asks for no eth_estimateGas, no last-look eth_accounts and no eth_sendTransaction, and the last toast is exactly "Your wallet is on another network. Switch it to Ethereum mainnet. Nothing was sent." It passes on the baseline and kills the mutant (ev/fix/z-mutant.log: `estimateGas:1, lastLookAccounts:1, toasts:[…confirm in your wallet, …moved to another network…]`).
- **The a2 toast is wrong user feedback.** Refusing SWITCH TO ETHEREUM (from the COLLECT dialog or the header bar) toasted "Cancelled in your wallet. Nothing was sent." That is errMsg's text for a cancelled payment, while the stop is a wrong-network stop. Fix (`switchChain`, 1045): the toast is decided after `nxWrong()`. A refused switch while still wrong now says "The switch was cancelled in your wallet: it is still on another network. Switch it to Ethereum mainnet." Other errors keep errMsg, and there is no toast if the wallet ended up on mainnet anyway. z2 fails on the baseline (ev/fix/z-baseline.log: both paths "Cancelled in your wallet. Nothing was sent.") and passes on the candidate. This is a copy change for the curator to approve.
- **Found while there (z3).** COLLECT's SWITCH button called `nxCollect()` on whatever dialog was open when the switch answered. Close and open another option while the switch is pending, and the page started a COLLECT and an eth_sendTransaction request for an option the user never pressed COLLECT on (baseline: `sends:1`, option 5 bought; ev/fix/z3-baseline.log). Fix (1477): it continues only if it is the same dialog, the same option, and still on the 'wrong' view. z4 (switch accepted in the same dialog, the COLLECT goes on) passes on both, which guards the happy path.

## Full suite and determinism
See the RESULTS section below. Case ids are unique: 38 @orig + 35 @audit2 + 21 @audit3 (x1-x7, y1-y10, z1-z4) = 94, with no duplicates (checked by enumeration).

## Left / notes
- y7/y8 are time-bounded with wide margins (limit 2.5 s vs about 0.3-0.5 s observed; the baseline takes 10-24 s).
- In y1-y3 the scan bound is the only baseline failure (classification was right on the baseline); y5 failed on the baseline only on the bound too (error blocks were already retried).
- README.md in wallet-tests does not mention @audit3 yet; it was left for the harness agent to avoid a merge conflict.
- 5 wallet-tests evidence logs from intermediate states are in ev/fix/stale/ (not evidence).

## RESULTS (final candidate 2fc2885)
- Full suite: **94/94 PASS**. @orig 38/38, @audit2 35/35, @audit3 21/21. Log ev/fix/full-2fc2885.log, results ev/fix/results-full-2fc2885.json. An earlier full run on 39dd7ab (A+B only) was 88/88 (ev/fix/full-39dd7ab.log).
- Determinism: @audit3 run 5 times on 2fc2885: 21/21 every time (ev/fix/rep1..5-2fc2885.log).
- @audit3 on the f9a6f80 baseline: 2/21. Every case fails except the two guards z1 and z4, which are meant to pass on both (ev/fix/audit3-on-baseline.log).
- No failures to classify in the final runs. During development, one z2 failure on my own candidate was a test error: its /Cancelled/i matched the new wording. The test was narrowed to the payment-cancel text `^Cancelled in your wallet` (law 14), not the page.
- Ritual (node --check, id audit, vm smoke): PASSED on every page edit.
- Environment note: during one poll, the agent proxy logged two failed connections to mtalk.google.com:5228. That is Chromium's own background push channel, not the page; no wallet, RPC or relay was contacted. The harness refuses every outside page request.
