# Audit 5b, brief P: page (Findings B and C, request §3 and §4)

Worktree /home/claude/wt-5b-page, branch `audit/wallet-5b-page`. It is one commit on 50ac8a5 and it is **not pushed**.
- **Head:** `e0ad4f3c46780b150681f2103994bbc996f95329`
- **index.html sha256:** `8f625a3126766e5e732c149c24959dd71393b229d88978229ffb33c7282fa5ff`. It was `99131cd7…` at 50ac8a5.
- **Files in the commit:** index.html, tools/stormglass/wallet-tests/audit5b.test.js (new), audit5b-shots.js (new), manifest.json (+ audit5b.test.js, group @audit5, 22 ids) and README.md (one line).
- **Not touched:** the runner core, staging, q1/i4, the contract, ABIs and other worktrees.
- **Evidence:** /home/claude/audit5b/ev/page. It holds the logs, results-*.json, mut/ and shots/.

## 1. Reproduction

**How it was run.** Every fail-first was a full browser run. It used the real runner entry point (run.sh → wallet.test.js) with TARGET set to `git show 50ac8a5:index.html` (sha256 99131cd7…). That copy is now at /home/claude/audit5b/ev/page/_a5b_old.html. It was never committed and is not in the worktree.
- **Fail-first runs:** `results-failfirst.json` (run 20261102T024334Z-15507-5d8d75) and `results-failfirst-c.json` (20261102T024924Z-29954-c35f0c, the a5c cases after they were changed to click SEND).
- **Controlled triggers inside those browser runs:** a5b9 calls the page's own `noWalletDesk()` while the review is open. a5b10 removes the WITNESS button from the DOM, standing in for a redraw. a5b12 drives the WalletConnect CONFIRM sheet with a provider double built the way /wc.js builds it (the same method as audit 4's a4w cases).

**Finding B, reproduced on 50ac8a5:**
- After REVIEW (pressed with Enter), focus stays on `#wtoReview` behind the dialog, and nothing behind it is inert (a5b1).
- Tab moves from the open review to `DFN:wallet`, `DFN:seats` and then the manual's chapter buttons (a5b2). That is the auditor's "glossary item".
- With the review open, `el.focus()` succeeds on CLAIM, WITHDRAW, WITHDRAW TO ANOTHER ADDRESS, REVIEW, WITNESS, COLLECT and the wallet button. Enter on CLAIM then asks the wallet (eth_estimateGas, eth_sendTransaction) (a5b3).
- The wallet list, YOUR WALLET DID NOT CONNECT, CHOOSE ANOTHER WALLET's list and the WalletConnect CONFIRM sheet behave the same way: no focus move and no inert (a5b5, a5b6, a5b12).

**Finding C, reproduced on 50ac8a5:**
- The review says `The contract pays 0.05000 ETH, what it owes your connected wallet 0x0000…00AA, to this address: 0x5290…` (a5c1, a5c2).
- When owed changes after REVIEW, the old page still says `Done: paid to 0x….` and reads nothing back (a5c3).
- Replaced and cancelled outcomes say `What is owed stays in the contract.` (a5c6, a5c7).

**CLAIM wording, every place found:**
- Manual FULL RULE: `CLAIM sends everything your seats have earned to your wallet.`
- Seats note, live and demo: `(press CLAIM, or the contract tries to send it …)`. This presents CLAIM as a sure payment.
- CLAIM's confirmed toast: `Claiming your seat earnings: confirmed`. It says nothing about rejected ETH.
- The FAQ answer talks about buying, not CLAIM. "Seat holders can still claim" in the tombstone panel and the money rule ("waits … until each seat holder claims it") are accurate and were left alone.

**SWITCH with no wallet:** `switchChain()` with nobody connected, and COLLECT's SWITCH TO ETHEREUM after the wallet ended the session, both toast `Your wallet is on another network. Switch it to Ethereum mainnet.` (a5d2). No provider was asked in either case: the audit-5 a5r2 guard already holds.

**Found next to them (a5e1):** with the wallet list open over the WITNESS sheet, Escape closed both sheets, and focus fell to BODY.

## 2. Fixes (index.html at e0ad4f3)
- **L652 (markup):** `#wsheet` gets `aria-describedby="wsp"`, and its heading `#wsk` gets `tabindex="-1"`. role=dialog, aria-modal and aria-labelledby were already there.
- **L857-885, the modal sheet:**
  - `SHEET` state (opener, inert list, tag), `sheetCan`, and `sheetFallback`. The fallback is the first visible control of an open COLLECT, WITNESS, ? or plate dialog, otherwise the wallet button.
  - `sheetInert`: every top-level body child becomes `inert` except #wsheet, #toast (a live region) and #nx-tip. Only the elements it set are released.
  - `sheet()`:
    - Records the opener only when no sheet is open, so a replacement keeps the first opener.
    - Sets inert and moves focus to the heading (`preventScroll`). Focus never goes to a button.
    - Takes text as a string or as an array of lines (`span.wl`).
    - Takes an optional `tag`.
  - `sheetOff()` is the single close path for every caller: CANCEL, Escape, CLOSE, backdrop, SEND, SHEET_CLOSE callbacks, wcNudgeOff, wcConnect's finish, the chooser, revoked() and disconnect. It removes `on` and inert. If the sheet was open and focus is in it or on BODY, focus goes to the opener (still connected, visible, enabled, not inert), otherwise to the fallback.
  - A keydown handler on #wsheet cycles Tab and Shift+Tab over the sheet's visible, enabled controls.
  - SHEET_CLOSE semantics, promise settlement and the WalletConnect nudge and pairing code are unchanged: the callers still call `sheetOff()`.
- **L996:** walletMenu is tagged `'menu'`. **L1882:** the review is tagged `'wto'`. **L1011, `disconnect()`:** closes a `'wto'` or `'menu'` sheet. That covers DISCONNECT, the wallet's own disconnect, an empty account list and the end of a WalletConnect session through `disconnect`.
  - An account change does not close the review. Its SEND then says "Your wallet changed. Nothing was sent." and closes it, which keeps a5w5 unchanged.
- **L1126:** `switchChain()` with no session: `Connect a wallet first.` No provider is asked (that was already true).
- **L1569:** while the wallet sheet is open, the page's global key handler ignores every key except Escape, which closes the sheet only. **L1683, L1911:** the pcard and ?/WITNESS Escape handlers return when `e.defaultPrevented`. That is the a5e1 fix.
- **L476 (markup), L1862, L1873:**
  - The recipient box has a visible `<label for="wtoAddr">ADDRESS TO PAY</label>` and `aria-describedby="wtoNote"`.
  - `wtoNote(t,bad)` sets `aria-invalid="true"` on a refused address and removes it otherwise.
  - CSS: L253-255.
- **L1880-1885, the review:** three lines (snapshot amount, snapshot warning, full checksummed recipient). The sheet no longer says "pays X".
- **L1886-1896, outcomes:**
  - confirmed, reverted, replaced and cancelled now read `owed(acct)` again and say what was read, plus refreshSeats.
  - confirmed states no amount.
  - replaced and cancelled no longer say the owed amount stays.
  - unknown is unchanged.
- **CLAIM wording:**
  - L560: the manual sentence.
  - L1844 and L1846: the seats note, demo and live.
  - L1295: the toast after a confirmed CLAIM.

**Zero owed after REVIEW: what the page does.**
- The page does not read owed again before sending.
- If the wallet's gas estimate refuses (execution reverted: nothing owed), ethers estimates again inside the send path and stops. eth_sendTransaction is never sent, the error toast shows `execution reverted: nothing owed`, and REVIEW then says "The contract owes this wallet nothing now."
- A wallet that sends anyway gets a reverted transaction: "failed on Ethereum (reverted)", never confirmed, and the button is hidden after the owed read.
- a5c4 tests both paths. It passes on both pages: it is a guard.

## 3. Regression cases (tools/stormglass/wallet-tests/audit5b.test.js, @audit5)
| id | asserts | 50ac8a5 | e0ad4f3 |
|---|---|---|---|
| a5b1 | review opened by Enter: named modal, focus on the heading (not a button), page behind inert; Enter and Space then send nothing | FAIL (focus #wtoReview, bgInert false) | PASS |
| a5b2 | Tab ×9 and Shift+Tab ×9 stay in the sheet, never reach the glossary; SEND, CANCEL and CLOSE are reached; the cycle wraps | FAIL (DFN:wallet, DFN:seats, manual) | PASS |
| a5b3 | while open, CLAIM/WITHDRAW/WITHDRAW TO…/REVIEW/box/WITNESS/COLLECT/bar/wallet/manual cannot take focus; Enter and Space ask the wallet nothing; no other dialog | FAIL (all focusable; CLAIM sent) | PASS |
| a5b4 | CANCEL (keyboard), Escape, CLOSE (keyboard), backdrop, SEND (keyboard): closed, no inert, focus on REVIEW; SEND sends once withdrawTo(R1) | FAIL | PASS |
| a5b5 | wallet list from Enter on CONNECT: modal, Tab inside; Escape asks no wallet, focus on CONNECT; WALLET B picked by keyboard connects, focus on the wallet button | FAIL | PASS |
| a5b6 | phone: YOUR WALLET DID NOT CONNECT, then CHOOSE ANOTHER WALLET (keyboard), then the list: one dialog, modal each time; B picked; focus on the wallet button at the end | FAIL | PASS |
| a5b7 | the wallet ends the session during the review, and during CONNECTED (disconnect event): the sheet closes, no inert, focus on a visible control, no write request | FAIL (sheets stay open) | PASS |
| a5b8 | account change while the review is open: one modal dialog, focus inside; SEND gives "Your wallet changed. Nothing was sent.", the sheet closes, no inert, visible focus, no request | FAIL | PASS |
| a5b9 | replacement (noWalletDesk() over the review): one dialog, SEND gone, inert on, focus on the new heading; Escape restores focus to REVIEW (the first opener) | FAIL | PASS |
| a5b10 | opener removed while open (bWit removed from the WITNESS sheet): Escape: no inert, focus on a visible WITNESS control, no error | FAIL (focus BODY, WITNESS closed) | PASS |
| a5b11 | recipient box: visible label ADDRESS TO PAY, getByLabel finds it, aria-describedby wtoNote, aria-invalid true on a refusal and cleared on a valid REVIEW | FAIL | PASS |
| a5b12 | WalletConnect CONFIRM (phone): modal, focus on the heading not OPEN ZERION; the request rejected: closed, no inert, focus on the opener; closed by hand while pending: no inert; the late answer reopens nothing | FAIL | PASS |
| a5c1 | review text: "Withdraw all funds owed … when this transaction executes. Currently: 0.05… ETH." + snapshot line + "Paid to this address: <checksummed>"; no "The contract pays" | FAIL | PASS |
| a5c2 | owed 0.05→0.08 after REVIEW, box edited to R2: gate hit; calldata withdrawTo(R1), 36 bytes (no amount), value 0; confirmed; no message says 0.05 | FAIL (review text) | PASS |
| a5c3 | owed 0.05→0.02 after REVIEW, 0.01 after it ran: note exactly "Confirmed: … paid everything this wallet was owed when the transaction ran to R1. Owed to your connected wallet now: 0.01… ETH." | FAIL ("Done: paid to …") | PASS |
| a5c4 | owed 0 after REVIEW: (a) estimate refused: no eth_sendTransaction, error shown, REVIEW then says nothing owed; (b) sent anyway: reverted, never confirmed, button hidden | PASS (guard) | PASS |
| a5c5 | recipient refuses ETH: reverted note + "Owed to your connected wallet now: 0.05… ETH."; box stays; REVIEW opens a modal review again | FAIL | PASS |
| a5c6 | replaced (page's own scan, nonce 7): note "This transaction did not run: your wallet replaced it with another one, which may itself have withdrawn. Check your wallet. Owed … now: 0.03… ETH."; no "stays in the contract" | FAIL | PASS |
| a5c7 | the same for cancelled | FAIL | PASS |
| a5d1 | CLAIM: manual rule, live seats note, demo note in the source (×2), the confirmed toast say "tries"/"rejected … owed"; "CLAIM sends everything" gone | FAIL | PASS |
| a5d2 | no wallet: switchChain() and COLLECT's SWITCH after the wallet's disconnect: toast exactly "Connect a wallet first.", no wallet_switchEthereumChain to any provider | FAIL (wording; no request on either) | PASS |
| a5e1 | wallet list over the WITNESS sheet: Escape closes the list only; WITNESS stays open; focus on WITNESS; nothing asked | FAIL (both closed, focus BODY) | PASS |

Fixed runs: `results-new2.json` and `results-new-c.json`, both on sha 8f625a31.

## 4. Mutation proofs
Temporary copies `_a5b_mut_*.html` were made by /home/claude/audit5b/ev/page/mut/make.py, which asserts each anchor occurs exactly once. They were deleted after the runs. Summary: mut/summary.txt. All 15 mutants are killed, each on the intended assertion:

| mutant | guard removed | killed by | the failing evidence |
|---|---|---|---|
| focus | heading focus in sheet() | a5b1 | active BODY, heading false |
| safe | initial focus on the first button | a5b1 | active SEND; Enter sent: walletWrites [estimateGas, sendTransaction] |
| trap | Tab handler | a5b2 | Tab sequence reaches BODY |
| inertset | sheetInert(true) | a5b3 | every background control focusable |
| inertoff | sheetInert(false) in sheetOff | a5b4 | after CANCEL, inert left on header/main/… |
| disc | disconnect() closing the account's sheet | a5b7 | review still on after disconnect |
| tag | 'wto' tag on the review | a5b7 | the same |
| opener | opener restore | a5b4 | focus #wallet, not #wtoReview |
| fallback | sheetFallback | a5b7, a5b10 | active BODY |
| replace | first-opener kept on replacement | a5b9 | focus #wallet after closing the replacement |
| switchmsg | "Connect a wallet first." | a5d2 | toast "Your wallet is on another network…" |
| switchany | `const P=EP` (no other provider) | a5d2 | switchRequests ["A:wallet_switchEthereumChain"] |
| escape | `e.defaultPrevented` in the WITNESS/? Escape handler | a5e1 | witnessSheet false, focus BODY |
| invalid | aria-invalid | a5b11 | invalid null after a refusal |
| owednow | owed read after the outcome | a5c3, a5c5, a5c6 | notes end without "Owed … now" |

Not given its own mutant: the L1569 change (no background keys while the sheet is open). On 50ac8a5 the background arrows are already blocked once COLLECT has started (`NX.tx`), so no failing scenario was found. It is hardening.

## 5. @audit5 ×5 and the release run
The first five @audit5 runs (54 cases each) ran in parallel with the release run, on a machine shared by four agents (load average 20-31). CASE_TIMEOUT_MS was raised to 240000.

| run | runId | result | failed |
|---|---|---|---|
| r1 | 20261102T025145Z-1424-d100bf | 53/54 | a5r1 |
| r2 | 20261102T030245Z-23551-f28aa8 | 54/54 | none |
| r3 | 20261102T031344Z-11434-336915 | 53/54 | a5n11 |
| r4 | 20261102T025145Z-1431-c32c97 | 54/54 | none |
| r5 | 20261102T030253Z-23858-a1cf27 | 52/54 | a5n9, a5n11 |

- **My 22 cases passed in all five runs.**
- **The failures were all in older trackTx cases.** The failed cases are a5r1 (audit5review.test.js) and a5n9/a5n11 (audit5page.test.js). They exercise `trackTx` directly, which this commit does not touch. Each failed because its trigger was not reached inside a **fixed** observation window: `await sleep(2200)` in a5r1's row(), with `hit:{blk:0,rc:0}`; `hit:0` in a5n11; and `other/input=pending` in a5n9.
- **Lead for their owners:** replace those sleeps with a gate on the hit counter, as COMMON requires. I did not edit those files.
- **Second series:** 5 @audit5 runs one after another, nothing else of mine running (load average 3-10). All passed 54/54 with exit 0, target 8f625a31. The a5n9, a5n11 and a5r1 cases passed in all of them.

| run | runId | time (Z) |
|---|---|---|
| s1 | 20261102T032347Z-30669-2dea53 | 03:23:47-03:30:21 |
| s2 | 20261102T033022Z-7751-05250c | 03:30:22-03:36:44 |
| s3 | 20261102T033645Z-13682-8c96c9 | 03:36:45-03:42:54 |
| s4 | 20261102T034254Z-20546-b68a1c | 03:42:54-03:48:46 |
| s5 | 20261102T034846Z-23800-166386 | 03:48:46-03:54:36 |

**Production release run:** `RELEASE=1 CASE_TIMEOUT_MS=240000 RUN_TIMEOUT_MS=3300000`.
- runId 20261102T025145Z-1418-fdab9f.
- Status passed, completed, exit 0.
- 215/215: the 193 audit-5 cases plus 22 a5b/a5c/a5d/a5e. Manifest matched.
- Target sha256 8f625a31…, commit e0ad4f3 (matchesHead).
- Started 02:51:45Z, finished 03:23:18Z.
- Results: /home/claude/audit5b/ev/page/results-release.json.

## 6. Screenshots (LOOKED at)
`audit5b-shots.js` at the six law-8 sizes, keyboard driven: /home/claude/audit5b/ev/page/shots/*.png plus probe.json. The 390x844 wallet-list shots were retaken as a narrow desktop window, because a phone connects its own wallet without a list. The probes show:
- **review_head:** focus on the heading with a visible 2px accent ring. The box sits inside the viewport at every size, the background is inert and there is no horizontal scroll.
- **review_send:** the ring is on SEND, outset from the filled button. The full recipient `0x52908400098527886E0F7030069857D2E4169EE7` is visible: it wraps at 390.
- **choice_head / choice_tab:** the heading ring, then the WALLET A ring.
- **box:** the ADDRESS TO PAY label is visible, with a refused address and its message (aria-invalid true).

From looking at the images:
- The snapshot line sits between the amount and the recipient.
- At 390 the sheet fills the bottom of the screen with SEND, CANCEL and CLOSE all visible.
- Nothing overlaps.
- The visuals are otherwise unchanged.

## WORDING (every changed or new user-facing string, old → new)
1. **Review sheet text (#wsp), one string → three lines:**
   - Old: `The contract pays {amount} ETH, what it owes your connected wallet {0x1234…abcd}, to this address: {checksummed address}`
   - New:
     - `Withdraw all funds owed to your connected wallet {0x1234…abcd} when this transaction executes. Currently: {amount} ETH.`
     - `This is a snapshot: the amount can change before the transaction runs.`
     - `Paid to this address: {checksummed address}`
   - The title, the note and the SEND/CANCEL buttons are unchanged.
2. **Confirmed note:**
   - Old: `Done: paid to {address}.`
   - New: `Confirmed: the contract paid everything this wallet was owed when the transaction ran to {address}. Reading what is owed now…`
   - Then that last sentence becomes `Owed to your connected wallet now: {amount} ETH.`, or `What is owed now could not be read: see OWED above.`
3. **Reverted note:** the existing text `Failed on Ethereum (reverted): {address} did not accept the ETH, or nothing was owed any more. What is owed stays in the contract. You can try another address.` now ends with ` Reading what is owed now…`, then ` Owed to your connected wallet now: {amount} ETH.` or the could-not-read sentence.
4. **Cancelled or replaced note:**
   - Old: `It did not go through: your wallet {cancelled|replaced} it. What is owed stays in the contract.`
   - New: `This transaction did not run: your wallet {cancelled|replaced} it with another one, which may itself have withdrawn. Check your wallet. Reading what is owed now…`
   - The ending becomes the owed-now or could-not-read sentence, as in 2.
5. **New label above the recipient box:** `ADDRESS TO PAY`
6. **Manual FULL RULE:**
   - Old: `CLAIM sends everything your seats have earned to your wallet.`
   - New: `CLAIM: the contract tries to pay your wallet everything your seats have earned; if your wallet rejects the ETH, it stays in the contract, owed to your wallet (see below).`
7. **Seats note (live and demo):**
   - Old: `(press CLAIM, or the contract tries to send it to you in the same transaction the next time this wallet collects a plate or witnesses)`
   - New: `(press CLAIM, or wait for the next time this wallet collects a plate or witnesses: either way the contract tries to send it to you in that transaction, and ETH your wallet rejects stays owed to it, for WITHDRAW)`
8. **Toast after a confirmed CLAIM:**
   - Old: `Claiming your seat earnings: confirmed`
   - New: `Claiming your seat earnings: confirmed. The contract tried to send your earnings to your wallet: anything your wallet rejected is owed to it now (OWED, WITHDRAW).`
9. **SWITCH with no wallet connected:**
   - Old: `Your wallet is on another network. Switch it to Ethereum mainnet.`
   - New: `Connect a wallet first.`

## Limitations
- **Other dialogs are unchanged.** The ? sheet (#nx-sheet) and the WITNESS sheet (#nx-wit) are separate dialogs. They are still not focus-managed or inert-backed. This brief covers the wallet sheet; they now behave correctly underneath it (a5e1, a5b10).
- **Elements added later are not made inert.** Inert covers the body children present when the sheet opens or is replaced. An element appended to body while a sheet is open would not be inert. None is appended by the page today.
- **An account change does not close the review.** It stays open, and SEND sends nothing. This is deliberate, to keep a5w5 unchanged.
- **The WalletConnect session end is tested as a rejection.** a5b12 tests the end of a session as the provider rejecting the pending request, which settles it and closes the sheet through wcNudgeOff. No real relay is involved.
- **Older trackTx cases flake under load.** The a5n9, a5n11 and a5r1 failures under load come from those cases' fixed sleeps, not from this change (§5).
