# Audit 5 — P5 page repairs (index.html)

Branch `audit/wallet-5-page` in /home/claude/wt-a5-page (from e7149ea). Not pushed. Tests: `tools/stormglass/wallet-tests/audit5page.test.js` (group @audit5, 30 cases). Shots: `tools/stormglass/wallet-tests/audit5page-shots.js`. Evidence: /home/claude/audit5/ev/page (logs, results-*.json, mut/, shots/).
Fail-first runs used `git show 38264fc:index.html` (sha256 703602f1…, the audit-4 candidate) as untracked `_a5_old.html`, deleted before the final commit. Mutants were temporary copies `_a5_mut_*.html`, also deleted.

STATUS: see the end of this file (determinism runs and full suite).

## 1. Transaction identity before trusting a nonce (trackTx)
Defect (38264fc): `nonceOf` accepted any answer whose `from` was the sender and whose nonce parsed with `BigInt()`. It did not check that the hash was the one asked about, and a decimal `'7'`, a number or `'-1'` all counted as nonces. The public readers' answer had no validator, so one bad reader was trusted and never rotated past.
Repair:
- `txOk`: requires an object, `hash` equal to the requested hash (32 bytes, any case), `from` equal to the sender, and `nonce` a hex quantity (`qty`: 0x0 is valid). When the answer carries them, `to`, `input`/`data` (both if both are present), `value` and `chainId` must match what was sent. Checksum or upper-case spellings are accepted, and missing optional fields are not held against the answer.
- `nonceOf` uses `txOk` for the readers and for the wallet fallback.
- The readers' `eth_getTransactionByHash` now has a validator. `null` (not seen) still counts as an answer; a malformed or mismatched answer moves to the next reader, and only then to the wallet (still at most 5 asks, each bounded).
- Replacement consistency in the scan:
  - The block must say it is block b.
  - The transaction must have a 32-byte hash, and its `blockNumber`/`blockHash` (when given) must be b and 32 bytes.
  - Its receipt must come from block b and carry the `blockHash` the transaction names (`rcGood` gets `at` and `bh`).
  - Anything contradictory gives no verdict: the next reader is asked first, and the cursor stays on that block.
- Unchanged: request bounds, scan limit, cursor, lost/stop deadlines, tracking after disconnect, late receipt after unknown.
Not checked: the receipt's blockHash against the block's own `hash`. fakechain's default block hash (n padded) differs from mkTx/mkRc's default blockHash (0x…01), so that check would break existing cases. **Harness lead:** if the harness agent makes the defaults consistent, the page can add `bh` = the block's hash.
Side effect on existing cases: fakechain's default original tx (`mkTx`: input '0x', value 0) is not the call the page sent. In r5-r7 and y*, the readers' answer is therefore now refused, and the nonce comes from the mock wallet's (correct) answer. All of them still pass (full suite below).

| case | asserts | 38264fc | now |
|---|---|---|---|
| a5n1 | wrong hash, same sender (the tx that spent nonce 7): pending, mev asked, then confirmed | FAIL (replaced) | PASS |
| a5n2 | right hash, other sender: next reader asked, wallet not asked | FAIL | PASS |
| a5n3 | hash missing/null/short/number/not hex/33 bytes | FAIL (replaced) | PASS |
| a5n4 | nonce missing/null/-0x1/-1/'7'/7/'0x'/'0xzz'; nonce 0x0 valid (cancelled at 0) | FAIL | PASS |
| a5n5 | first reader invalid, second valid: its nonce decides (cancelled), wallet never asked | FAIL | PASS |
| a5n6 | every reader invalid: wallet asked, its valid nonce used | FAIL | PASS |
| a5n7 | wallet fallback invalid (other tx/sender/nonce/call/to/value/chain/data): pending, ≤5 asks, then confirmed | FAIL | PASS |
| a5n8 | poisoned nonce where nonce 7 looks like a speed-up/cancel/replacement: no verdict | FAIL | PASS |
| a5n9 | guard: legitimate speed-up/cancel/replace, legitimate representations (data, checksum, upper hash, no chainId, no optional, 0x07) | PASS | PASS |
| a5n10 | unknown at lost, late own receipt confirms | FAIL | PASS |
| a5n11 | contradictory block/tx/receipt (tx blockNumber, tx blockHash, tx hash, rc blockNumber, rc blockHash, block number): pending, then replaced once consistent | FAIL | PASS |
| a5n12 | end to end WITNESS: the first reader answers its hash with the sender's other mined tx | FAIL (false "replaced" toast) | PASS |

## 2. No silent provider fallback (connect)
Defect (38264fc): on a phone, `connectOnce` looped over `walletList()`. After any error other than 4001/-32002 it sent `eth_requestAccounts` to the next provider, which an already-authorised wallet answers with no prompt.
Repair: one wallet per attempt.
- On a phone (wallet-app browser, or USE THIS BROWSER'S WALLET) it is this browser's own wallet, `window.ethereum`.
- On a computer it is the list's or the remembered choice.
- A WalletConnect session, or an existing EP, is used as is.
On failure the attempt ends:
- Computer: the choice is forgotten, so the next CONNECT lists the wallets (as before, guarded by u8).
- Phone, failure other than 4001/ACTION_REJECTED/-32002, other wallets present: the sheet YOUR WALLET DID NOT CONNECT names the error and offers CHOOSE ANOTHER WALLET. That button opens the list (`chooseWallet(byHand)`: always the list, the remembered choice not used), and only the wallet picked there is asked.
Unchanged: cancellation, stale-attempt isolation (SES), outstanding revocation wait (`revoked`). The u/k/h/i guards pass.

| case | asserts | 38264fc | now |
|---|---|---|---|
| a5m1 | in-app, 4001/4100/4200/4900/4901/-32002/-32603 as rejected promises: authorised B gets no eth_requestAccounts/eth_accounts/tx; offer except 4001/-32002; picked B connects; A not asked again | FAIL | PASS |
| a5m2 | same seven as sync throws | FAIL | PASS |
| a5m3 | B only in `ethereum.providers[]` | FAIL | PASS |
| a5m4 | iPhone Safari, USE THIS BROWSER'S WALLET (-32603 async, 4100 sync) | FAIL | PASS |
| a5m5 | guard: a WalletConnect session failing: no injected wallet asked | PASS | PASS |
| a5m6 | guard: computer, remembered B fails: A not asked, next CONNECT lists both, A picked connects | PASS | PASS |
| a5m7 | failing wallet is also the remembered choice: CHOOSE ANOTHER WALLET still shows the list | FAIL | PASS |

## 3. WITHDRAW TO ANOTHER ADDRESS (withdrawTo)
The page ABI already had `function withdrawTo(address)` (matches STORMGLASS.sol L406), so no ABI or contract change.
Flow:
1. The button appears only while `owed > 0` (refreshSeats). It is hidden, and the box is closed and cleared, on DISCONNECT, on another account, and at owed 0.
2. REVIEW checks the address: trimmed; 0x + 40 hex; a mixed-case address must carry a valid checksum. It refuses the zero address, the STORMGLASS contract (the ETH would become a vault gift) and the connected wallet itself (use WITHDRAW).
3. REVIEW then reads `owed` again and shows a sheet with the full checksummed recipient, the amount, and the fact that the connected wallet authorises withdrawing its own owed amount (0 ETH, fee only).
4. SEND TO THIS ADDRESS uses the address captured when REVIEW drew that sheet (the box is not read again). It sends nothing if the session (SES and account) changed since REVIEW.
5. It runs through `send('withdrawTo', …)`: op lock, captured provider/account/chain incl. CHAINREV, gas pad, tracking, unknown/unsure handling, no retry.
6. After confirmed or reverted, owed and pending are read again (refreshSeats, plus tick).
7. A revert says "Failed on Ethereum (reverted)" and the box stays open for another address.

| case | asserts | 38264fc | now |
|---|---|---|---|
| a5w1 | sheet shows checksummed address + 0.05 before any wallet request; one tx: withdrawTo(R1), from A1, to the contract, value 0, chainId 0x1; confirmed; owed read again; button gone | FAIL | PASS |
| a5w2 | empty/short/ENS/zero/bad checksum/no 0x/contract/self refused, no sheet, no wallet request | FAIL | PASS |
| a5w3 | box edited after REVIEW and after SEND: the address sent is the reviewed one | FAIL | PASS |
| a5w4 | SEND ×3 at once, then REVIEW+SEND while the wallet holds the first: one request, busy toast | FAIL | PASS |
| a5w5 | account change after REVIEW / chainChanged during gas / DISCONNECT during the last look: nothing sent | FAIL | PASS |
| a5w6 | 4001: "Cancelled", box keeps the address, a second deliberate send goes once | FAIL | PASS |
| a5w7 | recipient refuses ETH (reverted): failed, never "Nothing was sent"; box stays; another address confirms | FAIL | PASS |
| a5w8 | button only while owed > 0; hidden on another account and DISCONNECT | FAIL | PASS |

Earnings copy (a5x3, FAIL on 38264fc, PASS now): manual FULL RULE, FAQ, seats note (live and demo). See WORDING.

## 4. Adjacent
- **a5x1 (orchestrator lead, a4s3 under load).** With every reader failing, renderLedger's background IIFE awaited `getPlate()` with no catch, giving "Uncaught (in promise) Error: server response 500 … publicnode". Now deterministic: readers answer 500 to any request carrying `plates(id<13)`, with no load and no timing involved. The 38264fc page shows the same uncaught rejection, and its card loop stops at the first failure (1 plate request); now every card is tried and caught (13 requests, no page error). The two neighbouring IIFEs (the options' thumbnails and the work glass) also got a `.catch`.
- **a5x2 (found next to it).** renderLedger set `data-n` before awaiting `median7()`, so one failed read left the ledger empty until the next day. median7 is now read first. 38264fc: empty ledger. Now: drawn on the retry.
- Checked, no change needed:
  - trackTx is the only user of `nonceOf` and the tracking readers.
  - `switchChain`/`nxWrong` only reach a provider once `me` is set (EP).
  - `bindRead` uses `anyWallet()` only for read-only eth_chainId/eth_call (no connect).
  - Every write goes through `send()`.

## Mutation proofs (temporary copies, deleted; /home/claude/audit5/ev/page/mut/summary.txt)
Killed (the named case fails on the mutant):
- n-from (a5n2), n-hash (a5n8), n-nonceqty (a5n4), n-to / n-input / n-dataonly / n-value / n-chain (a5n7), n-use (a5n2).
- n-rcat, n-rcbh, n-txblock, n-blknum (a5n11).
- m-fallback (a5m1/2/4), m-nooffer (a5m1-4), m-answers (a5m1/2), m-byhand (a5m7).
- w-zero, w-contract, w-self, w-checksum (a5w2); w-reread (a5w3); w-gen (a5w5); w-show (a5w8); w-disc (a5w5/8); w-label (a5w1/7).
- x-card (a5x1), x-median (a5x2).

Survived, redundant by design (another guard catches the same input):
- n-txhash and n-txbh: rcGood already requires the receipt's transactionHash/blockHash to match exactly, so no verdict comes either way.
- w-disabled: opLock already makes extra presses busy.
- x-outer: the per-card try already catches everything.
- n-hash survives a5n1, because to/input/value reject that answer too; a5n8 kills it.

## WORDING FOR APPROVAL
Seats board (new):
- Button: `WITHDRAW TO ANOTHER ADDRESS`
- Box: `If this wallet cannot accept ETH, the contract can pay what it owes this wallet to another address you name. Only your connected wallet can ask for it, and only its own owed amount moves.`
- Placeholder `0x… the address to pay`, button `REVIEW`.
- Refusals:
  - `Type the address to pay: 0x followed by 40 characters.`
  - `That is not a full Ethereum address (0x followed by 40 characters; mixed case must match its checksum). Names like .eth are not accepted here.`
  - `Not the zero address: the contract refuses it.`
  - `That is the STORMGLASS contract: the ETH would stay in the vault as a gift and never reach you.`
  - `That is your connected wallet. To pay it there, press WITHDRAW.`
- `Reading what the contract owes this wallet…` · `Could not read it from Ethereum. Press REVIEW again.` · `The contract owes this wallet nothing now.`
- Sheet:
  - Title `WITHDRAW TO ANOTHER ADDRESS`.
  - Text `The contract pays {amount} ETH, what it owes your connected wallet {0x1234…abcd}, to this address: {full checksummed address}`.
  - Note `Your connected wallet sends a transaction that asks for it: 0 ETH, only the network fee. Check every character of the address: a payment to a wrong address cannot be undone.`
  - Buttons `SEND TO THIS ADDRESS`, `CANCEL`.
- Toast `Your wallet changed. Nothing was sent. Press REVIEW again.`
- Status lines:
  - `Confirm in your wallet: pay to {addr}.`
  - `Sent ({hash}), waiting for Ethereum to confirm.`
  - `Done: paid to {addr}.`
  - `Failed on Ethereum (reverted): {addr} did not accept the ETH, or nothing was owed any more. What is owed stays in the contract. You can try another address.`
  - `Sent, but this page cannot confirm it yet. Look it up on Etherscan before trying again.`
  - `It did not go through: your wallet cancelled|replaced it. What is owed stays in the contract.`
- Toast label: `Withdrawing to another address` (e.g. `Withdrawing to another address: confirmed`).

Connect (new):
- Sheet title `YOUR WALLET DID NOT CONNECT`.
- Text `{Wallet name} did not connect: {the wallet's error}`.
- Note `No other wallet was asked. This browser has another wallet: you can choose it.`
- Button `CHOOSE ANOTHER WALLET`.
- Removed: `(more than one wallet extension is installed: turn off the others and reload the page)`.

Earnings copy (changed):
- Manual FULL RULE:
  - `the contract first sends you everything` → `the contract first tries to send you everything`.
  - `WITHDRAW appears only if the contract once tried to send you ETH and your wallet could not accept it: that amount then waits in the contract until you withdraw it.` → `If your wallet cannot accept ETH, nothing is lost: the amount stays in the contract, owed to your wallet, and WITHDRAW appears (or WITHDRAW TO ANOTHER ADDRESS, to have it paid to an address you name).`
- FAQ "DO I HAVE TO CLAIM…":
  - `the contract sends you everything` → `the contract tries to send you everything`.
  - Added at the end: `If your wallet cannot accept ETH, the amount stays in the contract for you: WITHDRAW, or WITHDRAW TO ANOTHER ADDRESS.`
- Seats note (live and demo):
  - `(press CLAIM, or it is sent to you automatically, in the same transaction, the next time …)` → `(press CLAIM, or the contract tries to send it to you in the same transaction the next time this wallet collects a plate or witnesses)`.
  - Owed: `…: press WITHDRAW.` → `…: press WITHDRAW, or WITHDRAW TO ANOTHER ADDRESS if this wallet cannot accept ETH.`

## Law-8 evidence
`audit5page-shots.js` captures four states at 1440x900, 1366x768, 1280x800, 1024x768, 768x1024 and 390x844 (24 PNGs plus probe.json in /home/claude/audit5/ev/page/shots):
- wto: the box with a refusal.
- wtosheet: the confirmation sheet.
- wtofailed: after a revert.
- offer: YOUR WALLET DID NOT CONNECT.

Probe results: every element is inside the viewport, there is no horizontal scroll, and no page errors. I looked at 390 and 1440. The first offer shots had the error toast drawn over the sheet text; that was fixed (the sheet now carries the error and no toast is shown) and re-shot.

## STATUS (17:55 UTC): complete
- @audit5, 5 runs, all 30/30, on this machine while other agents were also running:
  - Runs 1-3 (commit 8728686) and runs 4-5 (final test file, 4ceae9f; the page is identical).
  - Logs: ev/page/audit5-run{1..5}.log.
- Fail-first summary on 38264fc:
  - a5n: 2/12 passed (both guards).
  - a5m: 2/7 passed (both guards).
  - a5w + a5x3: 0/9 passed.
  - a5x1/a5x2: 0/2 passed.
- Full suite, all groups, on the final page (index.html sha256 98b3d537…): **191/191 passed, rc=0** (label final-full, log ev/page/final-full.log). All audit-2/3/4 cases (r*, y*, u*, k*, a4*) and the harness cases pass with the repairs. An earlier full run on the 16:51 WIP code passed 159/161; c2 and x3 failed while five runs shared the machine, and both pass in isolation on 38264fc and on the new page.
- Final: branch audit/wallet-5-page at 4ceae9f; index.html sha256 98b3d5375f60b65bf9ccd1373df7f0d73ced90afb1fab7c5886ab38347d4f8a1. Not pushed.
