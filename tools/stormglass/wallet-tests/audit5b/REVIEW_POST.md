# Audit 5b: independent review of the final integrated changes (Brief V2, request §6 second review)

Worktree /home/claude/wt-5b-review2, branch `audit/wallet-5b-review2`. **Not pushed.**
- **Branch head: `dfbe702aa1a5f989b11324328e7b61826e7a1d55`**. It is two commits on bce0646:
  - c98687e: the a5p1 fix and tests.
  - dfbe702: test-wallet.html rebuilt.
- **index.html sha256 `504fc23c849a29a46155ec194bf7e4235b5039a5ce29321341058364b2749b13`.** It was 691687a3… at bce0646. The only change is one line in `disconnect()`.
- **test-wallet.html sha256 `f443a4bd2e11efec8d7d72c0ba752055bc270383a077ee6fd6f15de4405c953c`.** Built with `build.js --candidate c98687ed963d500173b7985898861f449dfc7851`; `--check` reports OK.
- stage.js, policy.js, build.js, runner.js, verify-results.js, both self-test scripts and run.sh are byte-identical to bce0646.
- Evidence is in /home/claude/audit5b/ev/review2. Every temporary copy (the old page and both mutants) was deleted. `git status` is clean.

Method: I read the five reports only to learn what was claimed. I then checked each claim in the code (`git diff 50ac8a5 bce0646`) and by running:
- both release suites, on bce0646 and again on dfbe702;
- both self-test scripts;
- the contract suite;
- my own keyboard probes.

The machine was shared, so I raised timeouts: production CASE_TIMEOUT_MS=240000, staging 600000, RUN_TIMEOUT_MS=3300000. No wait or assertion was weakened.

## Release runs (all four were checked with the strict verifier; none used `--allow-uncommitted`)
| run | head | result | runId | verifier |
|---|---|---|---|---|
| production RELEASE=1 | bce0646 (index 691687a3) | 221/221, exit 0 | `20261102T053940Z-4119-975931` | `VERIFY OK … suite wallet mode release 221/221 passed · target sha256 691687a3818d6b07ba82ca92d9ee76a854b5189bfc82a2af9e55d1d4416024ca · manifest a08592e76c883e66` |
| staging RELEASE=1 | bce0646 (page d38455f2, candidate 691687a3 @ a7b8f1e) | 42/42, exit 0 | `20261102T053940Z-4120-5f980a` | `VERIFY OK … suite staging mode release 42/42 passed · target sha256 d38455f262f9a96a2f0f4a23e54cd0b6b8412272b0ce33b8c183fbb440e5891a · candidate 691687a3818d6b07ba82ca92d9ee76a854b5189bfc82a2af9e55d1d4416024ca (a7b8f1ecc7fb22031770d19f40c1540b89ae6921) · manifest 1767cdd482247bb0` |
| **production RELEASE=1** | **dfbe702** (index 504fc23c) | **222/222, exit 0** | **`20261102T060005Z-28817-d369dd`** | `VERIFY OK /home/claude/audit5b/ev/review2/release2-prod/results-r2b-prod.json run 20261102T060005Z-28817-d369dd suite wallet mode release 222/222 passed · target sha256 504fc23c849a29a46155ec194bf7e4235b5039a5ce29321341058364b2749b13 · manifest bf750d8d7e68a90c` |
| **staging RELEASE=1** | **dfbe702** (page f443a4bd, candidate 504fc23c @ c98687e) | **42/42, exit 0** | **`20261102T060005Z-28818-04b822`** | `VERIFY OK /home/claude/audit5b/ev/review2/release2-staging/results-r2b-staging.json run 20261102T060005Z-28818-04b822 suite staging mode release 42/42 passed · target sha256 f443a4bd2e11efec8d7d72c0ba752055bc270383a077ee6fd6f15de4405c953c · candidate 504fc23c849a29a46155ec194bf7e4235b5039a5ce29321341058364b2749b13 (c98687ed963d500173b7985898861f449dfc7851) · manifest 1767cdd482247bb0` |

- **Files:** release{,2}-{prod,staging}/run.log, results-*.json and verify-strict.txt.
- **What the bce0646 runs cover:** they validate the candidate as it was given to me.
- **What the dfbe702 runs cover:** they are the final evidence for the branch head, which supersedes bce0646.
- **Other runs:**
  - **Self-tests (bce0646; that harness code is unchanged at dfbe702):** selftest-staging.js **22/22** (selftest-staging.log). selftest.js **31/31** (selftest-prod.log).
  - **Contract suite** (`stormglass`, `npx hardhat test`): **42 passing** (contract-tests.log). The contract source has zero diff since 50ac8a5.

## Per-item verdicts
Line numbers in index.html are as at bce0646. At dfbe702, every line after L1014 has a number one higher, because of the a5p1 line.

### 1. Finding A (shared runner): VERIFIED
- **One implementation.** `runner.js` (231 lines) is the only execution and persistence code:
  - wallet.test.js calls `R.begin`/`R.run`, with manifest.json.
  - staging.test.js calls them too (L8, L849-865), with staging/manifest.json, `servedFromDisk:true` and `stagingIdentity`.
- **RELEASE refusals.** `execute` refuses, in this order: CASES (L163), preloaded NODE_OPTIONS (L164), and a manifest mismatch (L165). `manifestDiff` also checks the manifest itself for malformed and duplicate ids (L96-L112).
- **Watchdogs:**
  - case (L184);
  - cleanup: 10 s per context and CLEANUP_TIMEOUT_MS per case (L191-L198);
  - browser health check, or kill (L200);
  - whole run (L143);
  - browser launch and final close.
- **Signals and exits.** SIGINT 130, SIGTERM 143, beforeExit, uncaughtException, and an `exit` safety net that records `aborted`.
- **Persistence:**
  - Each snapshot goes to a temp file, then fsync, then rename (L41-L46).
  - A failure is sticky through `PERSIST_FAILED` (L45, L54).
  - A failed final snapshot can never leave a success on disk (L62).
- **Retire-previous.** `setAside` (L48-L52) runs in `begin` before anything else, then the first snapshot is written (L145).
- **Identity in results.** The staging results of run …4120-5f980a contain:
  - `target.sha256 = sha256AtEnd = d38455f2…` and `matchesHead:true`;
  - `candidate {rev a7b8f1e, commit a7b8f1ec…, sha256 = gitSha256 = 691687a3…, matchesStamp:true}`;
  - `index.matchesStamp:true`;
  - `harness.dirty []`;
  - deps node v22.22.0, playwright 1.64.0, ethers 6.13.2, chromium 141.0.7390.37;
  - persistence ok, 45 snapshots.
- **Self-tests run by me:**
  - **selftest-staging 22/22:** control-release, control-subset-real, release-missing-case, release-missing-selftest-case, release-unexpected-case, duplicate-case, release-malformed-manifest, release-with-cases, initial/intermediate/final-write-fails, previous-success-then-failed-run, previous-success-then-all-writes-fail, hung-case, hung-cleanup, run-watchdog, launch-fails, browser-dies, node-rejection, second-context-page-rejection, sigterm, sigint.
  - **selftest.js 31/31.**
- **Verifier rejections I ran myself** (release-staging/verify-negatives.txt, plus a mid-run copy):
  - **A mid-run snapshot:** REJECTED. Reasons given: status "running", completed false, exit null, no finishedAt, 19 unexecuted.
  - **Wrong run id:** REJECTED.
  - **Wrong page sha (99131cd7…):** REJECTED.
  - **Wrong candidate (8f625a31…):** REJECTED.
  - **The production manifest:** REJECTED, manifest sha mismatch.
- **Note (not a defect):** `--expect-candidate` is optional for staging. `--expect-sha` of the page already pins the candidate, because the build stamp is inside the page bytes.

### 2. Finding B (modal sheet): VERIFIED, with limitations
**Read in index.html (code unchanged at dfbe702):**
- **Dialog semantics:**
  - `#wsheet` has role=dialog, aria-modal, aria-labelledby=wsk and aria-describedby=wsp. The heading has tabindex=-1 (L651-L652).
  - `sheet()` (L874-L882) keeps the first opener on replacement, increments `SHEET.n`, sets inert on every body child except wsheet, toast and nx-tip, and moves focus to the heading, never to a button.
- **Tab trap** (L883-L885): it wraps over the visible, enabled controls.
- **Closing.** `sheetOff()` (L871-L873) is the single close path:
  - inert comes off;
  - focus goes to the opener when it is connected, visible, enabled and not inert, otherwise to the open COLLECT, WITNESS, ? or plate control, otherwise the wallet button.
  - Every close route ends there: CLOSE, Escape and the backdrop (through wsX), the button callbacks, wcNudgeOff, wcConnect finish, the chooser, revoked(), `disconnect()` (`'wto'`/`'menu'`, L1014), the owed-0 close (L1853) and replacement.
- **Escape.** It closes only the wallet sheet: the global key handler at L1572 swallows other keys, and L1686 and L1915 check `defaultPrevented`.
- **COLLECT's focusin trap** (L1568) stands down while wsheet is on.
- **Generation guard (a5v1)** is in place:
  - wcNudgeSent L916, wcNudgeOff L920;
  - wcConnect `mine()`: onUri, wake, the 20 s fallback and finish;
  - the wsX handler L955.
- **Promises.** The chooser resolves null on CLOSE, Escape and backdrop; wcConnect rejects with 4001; revoked() resolves false. All of these go through SHEET_CLOSE.
- **Recipient box:** label `for=wtoAddr`, aria-describedby=wtoNote, and aria-invalid set and cleared in `wtoNote(t,bad)` (L1865).

**My keyboard-only probes** (scratch copy of this tree, real runner, run 20261102T054858Z-19855-f00c7b; source in ev/review2/probes):
- **Focus dropped to BODY.** A mouse click on the review's own text drops focus to BODY. Then Tab ×8 and Shift+Tab ×8 never reach a control behind the sheet: they only cycle SEND, CANCEL and CLOSE, or BODY. Enter and Space then ask the wallet nothing. **PASS.**
- **Key repeat.** Enter held on REVIEW (12 repeats), then Space, while the review opens: it opens once, focus is on the heading, nothing is asked. **PASS.**
- **Network change.** The wallet moves to Base while the review is open, then SEND is pressed by keyboard. The page asks wallet_switchEthereumChain first and sends only on chain 0x1. Inert is off afterwards.
  - This is the designed opBegin path. My probe's stricter expectation ("no send at all") was wrong, so this is not a defect.
- **Background controls.** inert also blocks programmatic focus. The page has no programmatic `.click()` on a background write control: the only ones are wsX, the bar proxy, bBid and bPledge, which all need a user activation on an inert element.

**Limitations and hypotheses (no defect demonstrated):**
- **Focus returns to the write button.** When a WalletConnect CONFIRM sheet closes by itself (the request settled), focus goes back to the write button that opened it, as the WAI-ARIA pattern advises. A later Enter would start a new request. That request still needs the wallet's confirmation, and the OPLOCK refuses it while one is pending.
- **revoked()'s STILL DISCONNECTING `end()`** closes whatever sheet is on screen, with no generation check. I found no way to open another sheet over it while it is open: the connect flow is serialised and the background is inert. **Hardening proposal:** guard it with `SHEET.n`, as a5v1 does.
- **WITNESS and ? sheets are still not modal.** This is already listed in PAGE_REPORT. A wallet sheet opened from REVIEW while WITNESS is open can return focus to REVIEW under the WITNESS overlay. This is an accessibility imperfection with no write path.

### 3. Finding C (wording): VERIFIED; one residual fixed (a5p1); two nits proposed
**Contract** (STORMGLASS.sol):
- L406-L407: `withdrawTo` requires `to != 0`, then `_withdraw` reads `v=owed[msg.sender]`, requires v>0 ("nothing owed"), zeroes it, and sends all of v, with `require(ok,"failed")`.
- L397-L402 and L408-L411: `claim` pays min(pending, seatPool) through `_pay`. A failed push is added to `owed`.

**Page wording against the contract:**
- **The review** says "Withdraw all funds owed … when this transaction executes. Currently: X ETH.", then "This is a snapshot…", then the full checksummed recipient. This matches `_withdraw`.
- **Confirmed** says "the contract paid everything this wallet was owed when the transaction ran to {to}". This is true for a status-1 withdrawTo: v>0 was sent and the call succeeded. "Sped up" counts as confirmed only when the replacement has the same to, data and value (L1279).
- **Reverted** names the two possible reasons; the zero address cannot occur, because the page refuses it.
- **Replaced** no longer claims what is owed.
- **CLAIM** wording is accurate everywhere: the manual L560, the FAQ L599 ("tries to send"), both seats notes L1847 and L1849, and the confirmed toast L1298.
- **SWITCH with no wallet** gives "Connect a wallet first." (L1131).

**Residual overclaim (DEFECT, fixed on this branch, a5p1):**
- **What happens:** COLLECT shows the wrong-network view, then the wallet ends the session (its disconnect event) or DISCONNECT is pressed. The dialog still says "[!!] YOUR WALLET IS ON ANOTHER NETWORK · Your wallet is on another network. Switch it to Ethereum mainnet. · SWITCH TO ETHEREUM", while the header says CONNECT. This is §4's "absent wallet on another network". Only the toast had been fixed.
- **When it was introduced:** the view is from before audit 5b. a5d2 and a5r2 even relied on the stale button.

**Nits, proposed and not changed (no false certainty, just imprecise):**
- **(i) The cancelled note.** The page calls a replacement "cancelled" only when it is a 0-ETH transfer to the sender itself with no data (L1280). Such a transaction cannot withdraw, yet the note says "your wallet cancelled it with another one, which may itself have withdrawn".
  - Proposed: `This transaction did not run: your wallet cancelled it. Check your wallet.`, followed by the owed read as now.
  - a5c7 asserts the current text, so it would need to change with it.
- **(ii) The owed read after an outcome.** "Owed to your connected wallet now: X" comes from a read at `latest` on the public reader, with no blockTag. A reader behind the receipt's block could show the amount from before the withdrawal right under "Confirmed". refreshSeats has the same property.
  - Proposed: read owed with `{blockTag: rc.blockNumber}` or later, or say "read just now".
  - This is a hypothesis: I did not reproduce it with a lagging reader.

**Observation, pre-existing and not about an absent wallet:** the wrong-network view also stays when the wallet itself moves back to mainnet. SWITCH then asks for a no-op switch and collects.

### 4. Finding D (staging boundary): VERIFIED, with one hardening proposal
**`guard`** (stage.js L443-L454):
- It reads the method and params once.
- FORWARD is a string Set: a non-string method falls through to "refused", 4200.
- eth_requestAccounts and wallet_switchEthereumChain are gated.
- eth_estimateGas is answered locally.
- eth_sendTransaction goes to the intercept and a simulated hash; it is never forwarded. `raw` is asked only for eth_chainId, for the panel.
- The TX and SIGN lists (sendTransaction, sendCalls, sendRawTransaction, signTransaction, sendUserOperation, grantPermissions, every sign) are shown and refused with 4001.
- Every other method is refused with 4200.

**`wrap`** (L455-L476):
- It exposes only request, on/once/addListener/removeListener/off, boolean flags, providers[] (wrapped), and for WalletConnect: accounts as a copy, gated enable, disconnect, a frozen session, and a `signer.client.on` facade for `session_request_sent` only.
- It has no send or sendAsync and no legacy `enable` for injected wallets.
- Listeners run with `this` set to the wrapper.
- It is memoised per raw provider, so the same wrapper is reused after DISCONNECT, reconnect and re-pairing.
- `beltWC` patches the raw provider's request, sendAsync and send, plus signer.request and client.request.

**Provider acquisition, from build.js:**
- Every `window.ethereum` read (11) goes through `__SG.eth()`. Any other spelling (`globalThis`, `self`, bracket or bare `ethereum.`) stops the build.
- The single EIP-6963 listener goes through `__SG.detail()`.
- `_wcGlobal` goes through `__SG.wcNS()`.
- Any direct `.sendTransaction/.signMessage/…` call in the page stops the build.

**HTTP fetch:** a JSON-RPC write or signature to any host is refused. In REAL mode only WalletConnect's own hosts pass, and only for non-write calls.

**Coverage and claims:**
- **Release coverage:** st33-st37 cover the gate order, default-deny on 5 wrappers, all 9 writes decoded (withdrawTo with the exact recipient), no raw reference across reconnect, and WalletConnect across disconnect, re-pairing and a session ended by the phone. All pass in both staging releases.
- **SIMULATION:** `wcNS` returns the simulated namespace or null, never the real one, so no relay connection is possible.
- **Page and report texts:** STAGING_REPORT wording 1-8 matches the code. In particular, the relay connection is opened by `EthereumProvider.init` on CONNECT, before the gate, with no wallet request. The texts say the socket blocking is a property of the test machine.

**I found no path for a payment, signature, batch, raw transaction, user operation or unknown method to reach a real provider.**
- **Limitation:** REAL mode against a real relay was not exercised. Every test uses mocks.

**`stagingLive()`** (L538-L541):
- It releases from inert only body children whose id starts with `sg-`, through a MutationObserver on the `inert` attribute.
- index.html has 0 `id="sg-…"`.
- stage.js touches no page element and calls no page function; the only page state it reads is `me`, CFG, ABI and TRACK. So a staging control cannot press a page write control. The simulated wallet and intercept panels only choose simulated outcomes.
- It does not make page elements interactive behind the sheet.
- **Hardening proposal:** make build.js refuse an index.html containing `id="sg-`. A future page element with such an id would otherwise be released.

### 5. a5v1 / a5v2 / a5v3 and H1 / H2 / H4: AGREE
- **a5v1:** the generation guard is correct and complete for the nudge and wcConnect. The wsX change (the visible sheet still closes after a stale callback) is right.
- **a5v2:** right. The SEND refusal (`rk!==WTO.k`) and the review closing on an owed-0 read are both correct. Leaving the review open on an account change is acceptable: SEND then refuses with a reason, and the stale `rk` refuses it as well.
- **a5v3:** right. Replacements now go through `chainVerdict`, and a cancellation calls nothing.
- **H1: not a defect.** ethers refuses reads after a network change, and the stale value stays until the rebind.
- **H2: acceptable.** The consent was given in the wallet, and CONNECT is pressed again. The residual (a live session in the wallet that the page does not show) belongs in the owner's notes.
- **H4: acceptable.** The toast keeps the confirmation.
- **I agree with FIX_REPORT's a5c4/st40 timing limitation.**

### 6. Regression: VERIFIED
- Both full releases passed on bce0646 and again on dfbe702 (table above).
- The production suite covers provider choice, revalidation before submission, stale callbacks, WalletConnect correlation, tx identity, the write lock, redraw and IME, and payouts and owed.

## Defect fixed: a5p1 (commit c98687e)
**Fix**, in index.html `disconnect()` after the `K.onDead` line:
```
if(NX.pop&&CC&&NX.tx==='wrong') candActs();
```
The dialog shows its existing not-connected COLLECT view. No new text.

**New test:** `tools/stormglass/wallet-tests/audit5post.test.js`, case a5p1 (@audit5). It is registered in manifest.json and noted in the README. It has two rows, each a fresh context:
- the wallet's own `disconnect` event;
- DISCONNECT (`disconnect(true)`).

Each row asserts its trigger first (the wrong-network view shown, then the page disconnected). It then asserts: no "another network" text, no SWITCH, the COLLECT view present, `NX.tx===null`, no switch request and no page error.

**Edits to two existing tests.** a5d2 and a5r2 pressed the stale SWITCH button after the session ended, and a5r2's `still` required it to remain visible. Both now press the button held from before the session ends, which is a press arriving as it ends.
- Their assertions are unchanged: the toast "Connect a wallet first." and no wallet asked to switch.
- The only part dropped is a5r2's `offsetParent` visibility check on that button. The button is now detached by design.

**Proofs.** All are full browser runs through run.sh and wallet.test.js; the old page and the mutants were untracked copies, now deleted. Evidence is in ev/review2/a5p1/.

| run | target | result | runId |
|---|---|---|---|
| fail-first | `git show bce0646:index.html` (691687a3) | **a5p1 FAIL**: redrawn false, view "[!!] YOUR WALLET IS ON ANOTHER NETWORK…SWITCH TO ETHEREUM", label CONNECT, in both rows. a5d2 and a5r2 PASS with the held press. | 20261102T055759Z-27925-904a14 |
| mutant `cond` (`NX.tx==='wrongX'`) | 4b49d5a3… | **a5p1 FAIL** on the same assertion | 20261102T055759Z-27923-a1397a |
| mutant `switchany` (switchChain `const P=EP\|\|anyWallet()`: the a5r2 guard) | 0305d637… | **a5r2 FAIL** through the held press: B asked `wallet_switchEthereumChain`. **a5d2 FAIL**: A asked. So the edited tests still catch what they were written for. | 20261102T055759Z-27942-92792e |
| fixed | index.html 504fc23c | a5p1, a5d2 and a5r2 PASS | 20261102T055759Z-27924-d1399b |

The mutant that removes the whole guard line is byte-identical to the fail-first page.

**Other checks:**
- `ritual.js index.html`: RITUAL PASSED.
- The edit was scripted (ev/review2/a5p1/edit_a5p1.py): every anchor count is asserted equal to 1, and every write is atomic.
- Commit author: 0xgreencross.

## Proposed, not changed
1. **Cancelled note wording** (§3, nit i). a5c7 changes with it.
2. **Owed read at or after the receipt block** (§3, hypothesis ii).
3. **`revoked()` end:** guard it with `SHEET.n` (§2).
4. **build.js:** refuse `id="sg-` in index.html (§4).

## WORDING
**No new or changed user-facing string.** a5p1 shows an existing view (the not-connected COLLECT: "COLLECT TODAY'S PLATE · {price} ETH · YOU PICK #{k} FOR TOMORROW") instead of the stale wrong-network view after the wallet leaves.

**Proposed only (not applied):** cancelled note
- Old: `This transaction did not run: your wallet cancelled it with another one, which may itself have withdrawn. Check your wallet.`
- New: `This transaction did not run: your wallet cancelled it. Check your wallet.`

## What this invalidates and what was rerun
c98687e and dfbe702 changed index.html, test-wallet.html and four test or doc files. Both release suites were rerun on dfbe702 and verified strictly.

The self-tests and the contract suite were not rerun after the change. They do not depend on it:
- runner.js, verify-results.js, both self-test scripts, run.sh, stage.js, policy.js and build.js are byte-identical to bce0646.
- The contract is unchanged.

The owner's approval of the candidate must now name **index.html 504fc23c (c98687e)**, not 691687a3.

**Branch head: `dfbe702aa1a5f989b11324328e7b61826e7a1d55`** (not pushed).
