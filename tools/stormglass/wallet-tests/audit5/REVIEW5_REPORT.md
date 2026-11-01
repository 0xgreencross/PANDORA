# Audit 5 — R5 second independent review of 6c18095

Branch audit/wallet-5-review, worktree /home/claude/wt-a5-review. HEAD **791034b** (one commit on 6c18095), not pushed. index.html sha256 99131cd72c8f782ea76045c2ff56e17e9897cea8e77285604f06ea119875ec56. Evidence: /home/claude/audit5/ev/review (logs, results-*.json, mut/, selftest/).

## Checklist
1. **nonceOf / trackTx: DEFECT, fixed (a5r1).** txOk is verified (index.html ~L1213-1221): object; hash HASH32 and equal to the requested hash in any case; from equals the sender; nonce is a hex quantity (0x0 valid); to/input/data/value/chainId checked only when present. The same check applies to the readers (validator, so a bad reader rotates) and to the wallet fallback (≤5 asks, each bounded by TRACK.timeout). Bounds, scan, cursor, lost/stop and tracking after disconnect are unchanged.
   The gap is the lead the page agent left. The receipt's blockHash was compared only with the transaction's blockHash, and not at all when the transaction carried none. The block's own hash was never checked. Each of these was accepted as a replacement verdict on 6c18095:
   - a receipt naming another block;
   - a transaction and receipt agreeing on a hash that is not the block's;
   - a block with a bad hash or no hash.

   Fix:
   - The block must have a 32-byte hash.
   - x.blockHash, when given, must equal it.
   - rcGood gets `bh: blk.hash`.
   - fakechain now has one hash per block number: a tx or receipt's default blockHash is the hash of the block it names, and explicit values (null included) are kept. All 191 earlier cases still pass with it.
2. **Provider selection: verified for connect; DEFECT in switchChain, fixed (a5r2).** connectOnce has one provider per attempt on every path: desktop list, remembered choice, phone in-app, USE THIS BROWSER'S WALLET, WalletConnect, CHOOSE ANOTHER WALLET (byHand), providers[], EIP-6963. No error leads to another provider:
   - 4001, ACTION_REJECTED and -32002 throw.
   - Other codes, sync or async, end the attempt. On a phone they may offer the list, and only by hand.
   - stale(), revoked() and CONNECTING are intact.

   Defect: `switchChain` used `EP||anyWallet()`. After DISCONNECT, COLLECT's SWITCH TO ETHEREUM (still on screen) sent wallet_switchEthereumChain to window.ethereum, a wallet never chosen. Shown on 6c18095: B got `wallet_switchEthereumChain`. Now EP only, and with no session nothing is asked (the existing toast text is kept).
   Observation: bindRead/walletReads still read silently (eth_chainId/eth_call) through anyWallet(). This is unchanged and makes no prompts.
3. **withdrawTo: verified.**
   - Selector: withdrawTo(address) = 0x72b0d90c, which matches STORMGLASS.sol L406 `withdrawTo(address payable)`. a5w1 decodes it with an independent Interface.
   - Validation covers empty, short, ENS, zero, bad checksum, no 0x, the contract and self. The recipient is checksummed and captured at REVIEW, and the sheet shows it and the owed amount. SEND rechecks SES and account, then goes through send(): lock, captured provider/account/chain + CHAINREV, pad gas, trackTx, UNSURE, no retry.
   - refreshSeats runs after confirmed or reverted. A revert says it failed and the box stays usable. The button shows only while owed > 0.
4. **Every write path: verified.** witness, bid, settle, pledge, sync, buy (nxCollect: opLock, then send with the lock), claim, withdraw and withdrawTo all go through send(), opBegin/opLive/opCheck and OpSigner. The chain switch now also uses only the session's provider.
5. **Earlier repairs preserved: verified** by the full release run (all audit 2/3/4 cases).
   WalletConnect clone claim, checked against the vendored wc.js:
   - EthereumProvider.request → UniversalProvider.request `{request: wd({},e)}` (a shallow copy, so the params array is the same reference) → the eip155 provider → client.request → engine.request.
   - The engine emits `session_request_sent {topic, request: <the same object>, chainId, id}`, so `q.params===n.params` holds for eth_sendTransaction.
   - handleSwitchChain rebuilds `params:[{chainId}]`, so a switch never matches and falls back to the 8 s "open wallet only" path. The code does exactly what the comment says.
6. **Earnings copy: verified, no defect in the new wording.** It matches STORMGLASS.sol:
   - buy and witness run _split then _settleSeats(payer) then _seatForDay. Only the payer's existing seats are paid, including their share of the payer's own payment.
   - _pay uses 60000 gas and puts the amount in owed[] on failure.
   - withdraw and withdrawTo forward all gas and revert "failed", "nothing owed" or "zero address".

   Low, pre-existing, not changed:
   - The FULL RULE says "CLAIM sends everything…", although claim also uses _pay. The next sentence covers the owed case.
   - The FAQ example ("earned 0.0012 … 0.0012 comes straight back") does not show the share of the payment being made.
   - The REVIEW sheet's amount is owed at review time; withdrawTo pays owed at execution.
7. **Harness: verified.**
   - `node selftest.js`: **SELFTEST 30/30** (ev/review/selftest.log).
   - Verified in code and by the self-tests: schema 2, atomic writes, sticky persistence failure (exit 1), RELEASE manifest refusal (exit 2), case and run watchdogs, SIGTERM/SIGINT 143/130, server-ready gate.
   - The q1, i4 and hz2 gates are asserted (gateHit, waiting==1, CONNECTING/SES unchanged, ≥5 probes seen, late probe, positive control).
   - Test diff vs 38264fc: no assertion removed or loosened; p4, v1-v3, z3, a4s7 and a4h1 only add barriers and assertions.
   - Coverage note: q1 no longer presses before the hand-off. That path stays covered by q2, audit3b BUSY and a5w4.
8. **Security: verified.**
   - No new path to a real write, signer or relay.
   - The new UI uses textContent for the recipient, errors and wallet names.
   - No secret or new address was added.
   - Release results show only refused outside hosts (relay.walletconnect.*, example.com), as in audit 4.
   - Observation: while runs were active the agent proxy logged Chromium connections to mtalk.google.com:5228 (GCM, browser-level, not page code; the source was not attributed).
9. **UI: verified from the screenshots** (wtosheet/wto 390x844, offer/wtofailed 1440x900). There is no overflow, Escape closes the sheet, the toggle has aria-expanded/controls, the note has role=status, and wsheet is a role=dialog with aria-modal.
   Low, not changed:
   - The generic sheet does not move focus into itself; this is pre-existing and shared by every sheet.
   - #wtoAddr has only a placeholder and no label.

## Fixes (commit 791034b)
| id | asserts | 6c18095 | 38264fc | 791034b | mutants |
|---|---|---|---|---|---|
| a5r1 | 6 contradiction rows: pending, then replaced once consistent. 3 guards (consistent, upper-case, no tx blockHash): replaced at once. Trigger counted. | FAIL | FAIL | PASS | M1 (rc bh = tx bh), M2 (no tx-vs-block), M3 (no block hash check): all killed |
| a5r2 | DISCONNECT then SWITCH: no wallet asked to act. Connected: only A is asked. | FAIL | FAIL | PASS | S1 (EP\|\|anyWallet): killed |

Ritual (ritual.js) passed after each page edit. `--print-manifest` equals manifest.json (193). Temp pages and mutants are deleted.

## RELEASE=1 on 791034b (CASE_TIMEOUT_MS=240000, RUN_TIMEOUT_MS=3300000; machine loaded)
**193/193 passed.** `RESULTS …/results-release-791034b.json … mode release status passed completed true exit 0`.
Per group:
| group | passed |
|---|---|
| @orig | 38 |
| @audit2 | 35 |
| @audit3 | 21 |
| @audit3b | 17 |
| @harness | 2 |
| @audit4 | 48 |
| @audit5 | 32 (audit5page 30 + audit5review 2) |

target commit 791034b, matchesHead true; slowest case 52 s.

## WORDING FOR APPROVAL
None. No new user-facing text: switchChain reuses its existing toast, "Your wallet is on another network. Switch it to Ethereum mainnet."
