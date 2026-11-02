# Audit 5b — pre-fix review of 50ac8a5 (Brief V)

Branch audit/wallet-5b-review, worktree /home/claude/wt-5b-review. Branch head **8cdfbf8e024c9b6da3408dba3a06f53882429d2e**: one commit on 50ac8a5 that adds only tools/stormglass/wallet-tests/audit5review2.test.js. Not pushed. index.html and stage.js are unchanged.
Reviewed: index.html sha256 99131cd7…5ec56, test-wallet.html b1ef2db4…7de9, stage.js, policy.js and build.js at 50ac8a5.
Evidence is in /home/claude/audit5b/ev/review:
- fail-first run: failfirst.log and results-failfirst-50ac8a5.json, run 20261102T024039Z-8305-ad6014;
- fix-probe runs: probe-page.log, probe-stage.log and probe-st3.log.

New case ids: **a5v1, a5v2, a5v3**. They are not in manifest.json, so the orchestrator must add them. Run them with `CASES=a5v1,a5v2,a5v3`.

## Demonstrated defects (each fails on 50ac8a5)

### a5v1 — a stale WalletConnect request rewrites the sheet that replaced it (index.html)
**What happens:**
- On a phone, a pending WalletConnect write keeps its nudge (NUDGE) alive after another sheet replaces the shared #wsheet.
- wcNudgeSent (L888-890), on session_request_sent or the 8 s fallback, writes `#wsp` and its `n.btn` without checking that its own sheet is still the one shown.
- wcNudgeOff (L891) calls sheetOff() whenever SHEET_CLOSE still equals n.close.

**How it is reached on 50ac8a5:**
- #wtoReview behind the open CONFIRM sheet is not inert, not aria-hidden, and can take focus (Finding B). REVIEW is pressed with the Enter key.
- wtoReview sets SHEET_CLOSE=null but leaves NUDGE in place.

**Failing evidence:** after the event, the sheet is titled WITHDRAW TO ANOTHER ADDRESS. Its text is "The request is in ZERION now. Open it, check it, confirm or reject…", with buttons [SEND TO THIS ADDRESS, CANCEL]. The recipient and amount are gone while SEND stays live. The text is still wrong after the request settles.

**Limitation:** the WalletConnect side is a controlled probe, a fake _WC as in m9, with the page's own ask() and wcHook. The wallet session is the in-app mock. Focus is placed on the button by script; the activation is a real Enter key.

**Proposed fix:** the sheet gets a generation number. A nudge touches only its own sheet.
```
L855  const sheetOff=…;  + let SHEET_N=0;
L856  function sheet(…){ + SHEET_N++;  …
L885  n.close=…; SHEET_CLOSE=n.close; NUDGE=n;  + n.sg=SHEET_N;
L888  wcNudgeSent: …clearTimeout(n.timer); + if(n.sg!==SHEET_N) return;   (before n.btn / #wsp)
L891  wcNudgeOff: if(SHEET_CLOSE===n.close){ SHEET_CLOSE=null; + if(n.sg===SHEET_N) sheetOff(); }
```
The probe with this patch passes: the review text is kept and the sheet is left alone when the request settles.

Note for the modal fixer: wcConnect's onUri (L905) also writes `#wsp` directly, and wake() mutates #wsBtns directly. The same ownership check applies there.

### a5v2 — SEND TO THIS ADDRESS asks the wallet after the page itself read owed 0 (index.html)
**What happens:**
1. The review sheet opens showing 0.05 ETH and R1.
2. A refreshSeats call then reads owed 0. This runs on every tick and after every write.
3. wtoOff (L1835) hides the button and box and moves WTO.k on.
4. The sheet stays open.
5. wtoSend (L1853) checks only gen and account, so SEND still asks the wallet for withdrawTo. The contract must revert it ("nothing owed"), and the visitor pays the fee.

**Failing evidence:**
- drop row: closedByRead true, sheetStillOpen true, walletAsked true (eth_estimateGas 1, then eth_sendTransaction), sendsAfterWait 1.
- Toasts: "confirm in your wallet", then "sent (0x0000…0001)".
- Guard row, with owed unchanged: one withdrawTo is sent, on both pages.

**Proposed fix:** the review captures its WTO.k, and SEND refuses once the box has been closed since the review.
```
L1852  …sheetOff(); wtoSend(to,gen,acct,k); …          (k = the review's ++WTO.k, already in scope)
L1853  function wtoSend(to,gen,acct,rk){ …existing gen/acct check…
         + if(rk!==WTO.k){ toast('The contract owes this wallet nothing now.'); return; }
```
The toast reuses the existing note text verbatim. The page agent decides the final wording and lists it.

Better still: wtoOff (and disconnect / seatsReading) closes the review sheet when it owns it, using the same SHEET_N ownership. That also serves §3, background restored on disconnect.

The probe with the wtoSend patch passes: nothing is asked, and the guard still sends once.

### a5v3 — staging: mined replacements ignore the simulated contract (stage.js L141-144, txResolve)
**What happens:**
- **REPLACED** mines `withdraw()` from the sender with status 1, but never applies it. owed stays 0.05 and nothing is paid. The simulated chain therefore supports the page's "It did not go through: your wallet replaced it. What is owed stays in the contract.", which a replacement withdraw() makes false (request §4).
- **SPED UP** mines `withdrawTo(R1)` with status 1 and pays R1, even when CONTROLS says the recipient rejects ETH. On the real contract this reverts ("failed"). The page says "confirmed (sped up in your wallet)".

**Failing evidence:**
- replaced: [status 1, owed 0.05, sender received 0, note "…What is owed stays in the contract."]
- sped: [status 1, owed 0, R1 received 0.05, toast "confirmed (sped up in your wallet)"]

**Proposed fix (L144):**
```
- CH.txs.set(x.hash,x); mineInto(x,1); r.state=outcome; r.by=x.hash; if(outcome==='sped') effect(x); }
+ const why=chainVerdict(x); if(why) x.why=why; CH.txs.set(x.hash,x); mineInto(x,why?0:1); r.state=outcome; r.by=x.hash; if(!why&&(outcome==='sped'||outcome==='replaced')) effect(x); }
```
The probe passes: a staging build with this stage.js, through build.js --runtime, untracked and deleted afterwards. With the same build, st2 and st3 still pass (st3 needs 3 replacements).

**Limitation:** this fix changes staging behaviour, and the staging agent owns stage.js.

## Per-area verdicts
| area | verdict |
|---|---|
| Provider selection, explicit wallet choice | Verified: one provider per attempt; switchChain uses EP only (a5r2). Observation only: bindRead/walletReads/nxWrong read silently via anyWallet(). |
| Account/chain revalidation before submission (incl. withdrawTo, claim) | Verified: send()→opBegin captures the session synchronously; opCheck plus a final opLive before eth_sendTransaction; wtoSend checks gen/account. Defect a5v2 is outside this check (the owed state). |
| Disconnect, stale async callbacks | DEFECT a5v1 (stale nudge). refreshSeats, wtoReview, nxWrong, onAccounts and welcome have gen guards: verified. |
| WalletConnect pairing, correlation, lifecycle | Correlation verified (own client, same params array, topic, numeric id). Lifecycle: a5v1. Hypothesis H2 below. |
| Tx hash, sender, nonce, receipt, replacement validation | Verified (txOk, rcGood with block hash, scan). Replacement *wording* for withdrawTo is Finding C/§4 (see the list for fixers). |
| Concurrent write locking | Verified: one OPLOCK; SEND during another write gives a busy toast and clears the note. |
| Redraw, input, IME (#wtoAddr) | Verified: only cleared on owed 0, account change or disconnect (intended); refreshSeats does not touch the input otherwise. |
| Seat earnings, failed payouts, owed, alternate withdrawal | a5v2. Copy matches the contract except the items in the A-D list below. |
| Staging interception | Verified by reading: default-deny guard; TX/SIGN never forwarded; the WalletConnect belt on raw.request, signer.request and client.request; taps for window.ethereum (11), EIP-6963 and wcNS, enforced by build.js. Not re-run in REAL mode. |
| Staging result integrity | DEFECT a5v3 (simulated chain). The runner is Finding A, owned by others. |

## Hypotheses (reasoned, not reproduced)
- **H1.** When every public reader fails, bindRead uses the wallet as reader (`ro`, through anyWallet()) after checking chain 1 once. If the wallet later moves network, seats, owed and pending are read from that other chain until the next rebind. Reads only; the displayed amounts could be wrong. Not tested.
- **H2.** A WalletConnect pairing cancelled with X (finish → reject) is never aborted. p.enable() keeps waiting. If the visitor later approves in the wallet app, the next CONNECT adopts that session (`p.accounts.length` → resolve) without a new prompt. This is probably acceptable, since the user approved in the wallet, but it is undocumented.
- **H3.** The same root as a5v1, through walletMenu (L969). It does not touch SHEET_CLOSE, so a nudge's close can shut the CONNECTED sheet, and wcNudgeSent can write into it. Low impact.
- **H4.** Observation, shown in the a5v3 evidence: after a confirmed withdrawTo, the note "Done: paid to …" is wiped at once. refreshSeats reads owed 0, then wtoOff runs, so only the toast remains. The note was empty in the sped row.

## For the A-D fixers (things easy to miss)
- **Sheet paths that bypass sheet()/sheetOff():**
  - wcConnect onUri writes `#wsp` and wake() writes #wsBtns (L905, L915).
  - wcNudgeSent writes `#wsp` and `n.btn`.
  - Backdrop click → wsX (L926).
  - Escape for wsheet is a separate handler (L1540).
  - sheetOff() is called directly by every button callback: chooser rows, walletMenu DISCONNECT, CHOOSE ANOTHER WALLET, wto SEND/CANCEL, revoked end, wcNudgeOff and wcConnect finish. Focus restore and inert removal must live in sheetOff/sheet itself, not in wsX.
  - Openers can disappear: #wtoReview is hidden by wtoOff; #wallet text changes.
  - Sheets are replaced without close: nudge → review (a5v1); 20 s WalletConnect sheet → pickSheet; otherWallet and wtoReview set SHEET_CLOSE=null.
- **The review sheet survives DISCONNECT and account change:** it stays open and actionable; SEND only toasts. It should close (§3).
- **Claims the contract does not guarantee:**
  - wtoReview: "The contract pays X ETH" (C).
  - wtoSend cancelled/replaced: "It did not go through… What is owed stays in the contract." A replacement may withdraw (§4); a5v3 shows staging currently backs the false version.
  - CLAIM: toast "Claiming your seat earnings: confirmed", although _pay may have put it in owed (§4).
  - seatsNote "Earned and waiting for you: p ETH": claim pays min(p, seatPool); off by a few wei only.
  - Generic send() replaced toast "so this one did not go through": true for that hash only.
  - The demo seats text (CFG.demo branch) repeats the same claim wording.

## Limitations
- a5v1 is a controlled WalletConnect probe, not the real wc.js.
- REAL-mode staging and the relay were only read, not exercised.
- No full release suite was run, because the new module is not in the manifest.
- The fix probes are temporary copies (scratch index-fix.html, stage-fix.js, test-wallet-a5v.html), all deleted. They show the tests can pass; they are not the fixes.

## WORDING
None. No user-facing string was changed. The a5v2 proposal reuses "The contract owes this wallet nothing now." verbatim as a toast; the page agent must list it if adopted.
