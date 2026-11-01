# Brief M: STORMGLASS wallet lifecycle coverage matrix, missing regressions, repairs: REPORT

Worktree /home/claude/wt-a3-matrix, branch audit/wallet-3-matrix (from ae9eaab). Nothing pushed. Evidence is in /home/claude/audit3/ev/matrix/. The matrix is in /home/claude/audit3/COVERAGE.md.

Baseline pages for the fail-first runs:
- f9a6f80: ev/matrix/page_f9a6f80.html, sha256 da27e818…
- ae9eaab: ev/matrix/page_ae9eaab.html, sha256 b27b94d7…

Both are outside the repo. TARGET is read with fs and served from memory, so any path works and no untracked copy sits in the worktree.

## Commits (author 0xgreencross, with the session trailers)
- **cda8599**: page repairs D1-D4 (index.html, wallet code only), audit3b.test.js u1-u14, and the @audit3b group registered in wallet.test.js.
- **d9ab802**: guards u15-u17, plus the additive `announceAfter` option in mockwallet.js (a late wallet; the defaults are unchanged) and the README groups.

Diff ae9eaab..d9ab802:
- index.html: +18/-8 lines, wallet code only.
- tests: audit3b.test.js (new), wallet.test.js (group registration), mockwallet.js (additive), README.

Not touched: contract addresses, ABIs, chain config, economics, visuals, the runner, and the harness rules. There are no CORE markers in index.html (law 15 is not affected). The ritual (node --check, id audit, vm smoke) PASSED after the page edit.

## Defects (all four reproduce on f9a6f80 and on ae9eaab)

### D1. An abandoned connection holds the write lock, and its late answer restarts the old write with another wallet
**Trigger.**
1. The visitor presses WITNESS (or COLLECT) while disconnected and chooses wallet A.
2. A never answers eth_requestAccounts. This happens, for example, when an MV3 extension restarts and drops the request.
3. After 15 s the page lets a new CONNECT replace that attempt. The visitor connects wallet B.

**Impact.**
- (a) The write kept the one-write lock forever. Every later payment was refused with "…still waiting for your wallet. Finish or cancel it there first.", and only DISCONNECT freed it, which nothing said.
- (b) When A finally answered, the old attempt wrote `stormglass.wallet=test.a` over the visitor's newer choice.
- (c) The old write then went on and asked **B** to pay the old amount: a payment prompt from a wallet the write never chose.

**Regression.** u1. Fail-before evidence (ev/matrix/u-on-ae9eaab.log; the same on u-on-f9a6f80.log): `laterPaymentSent:false, toastsOnLaterPress:["Your witness payment is still waiting…"], sends:["B 0x2386f26fc10000"] (= the old 0.01 from B), savedEnd:"test.a"`.

**Repair** (connectWallet 985, connectOnce 990-1016, send 1173, nxCollect 1510):
- connectWallet resolves `true` only when its attempt set the session.
- Replacing an attempt resolves its waiters with `false`, so they stop ("nowallet") and release the lock.
- A stale attempt returns without remembering or forgetting a choice, on both the desktop and the phone path.
- send and nxCollect go on only on `true`.

**Pass.** ev/matrix/u-on-fix1.log, and the full run.

**Adjacent checked:**
- q2 (several actions awaiting one connection), i4, p4, k2-k6 and the m-cases all pass (a23-on-fix1.log, full run).
- The phone WalletConnect path already returns when stale after wcConnect.
- Not changed: on a phone, a second wcConnect after 15 s shares the one `_WC` provider with the first (two `enable()` calls). This was not reproduced. The WalletConnect sheet is modal, so CONNECT is not reachable while it is open.

### D2. The 8 s WalletConnect fallback claims the request is in the wallet
**Trigger.** On a phone with WalletConnect, a payment is asked, and no `session_request_sent` arrives within 8 s.

**Impact.** The sheet said "The request is in ZERION now…". The page had not seen the request leave, and the visitor is sent to look for a request that may not exist.

**Regression.** u2. Fail-before: `after8s.text:"The request is in ZERION now. Open it, check it, …", claimsInWallet:true`.

**Repair** (wcNudgeSent 862). With no event: "No word yet that the request reached ZERION. Open ZERION and look: if it is waiting there, check it, confirm or reject, then come back to this page." With the event, the old text is kept. The jump without an event stays `<app>/wc`.

**Pass.** u-on-fix1.log. m9 still passes. **This is a copy change for the curator.**

### D3. The busy message does not tell a stoppable write from one in the wallet's hands
**Trigger.** A write stalls before the hand-off (the network switch is never answered, or the connection is pending), and the visitor presses again.

**Impact.** The page said "Finish or cancel it there first" in every case. Before the hand-off, nothing has been sent, and DISCONNECT is what stops it; the wallet may hold nothing. After the hand-off, only the wallet can stop it.

**Regression.** u3. Fail-before: `busyBeforeHandoff` and `busyAfterHandoff` were both "…still waiting for your wallet. Finish or cancel it there first."

**Repair** (opLock 1065). There are three wordings:
- Handed: "<X> is in your wallet now. Finish or cancel it there first."
- Before the hand-off, connected: "…still waiting for your wallet; nothing has been sent. Answer it there, or press your address and DISCONNECT to stop it."
- Connecting: "…still waiting for your wallet to connect; nothing has been sent. Answer it there first."

u3 also proves that DISCONNECT frees the stalled write, that the late switch answer sends nothing, and that a later deliberate payment goes out once. q3's busy assertion still holds.

**This is a copy change for the curator.**

### D4. A gap between the last look and eth_sendTransaction
**Trigger.** An accountsChanged event is delivered in the microtasks between opCheck's final check and the caller resuming after `await opCheck(op)`, before `ask(op.P,'eth_sendTransaction')`.

**Impact.** The request went to the wallet with the old account's `from`, although the page had already switched session.

**Regression.** u11 sweeps delays of 0..14 microtasks. Fail-before: `requestsAfterTheChange:[2]` (k=2 sent).

**Repair** (OpSigner 1106): `await opCheck(op); opLive(op);`. Nothing is now awaited between the last check and invoking the captured provider.

**Pass.** u-on-fix1.log, full run.

## New guards (pass on both pages; each kills a single-edit mutant)
Mutant logs are ev/matrix/mut-<id>.log; every mutant FAILED its case.

| Case | What it holds | Mutant killed |
|---|---|---|
| u4 | Wallet name and icon shown as text; only data:image icons | innerHTML label + any icon |
| u5 | Tampered SG_WC_APP / old library key (javascript:, http:) ignored | no https check |
| u6 | Falsely-successful switch and 4902: nothing estimated or sent | trusting the switch answer |
| u7 | Remembered wallet by key, other order, window.ethereum on the other | (i1/h7 neighbours) |
| u8 | Desktop: a non-refusal error asks no other wallet | desktop taking the phone loop |
| u9 | An old write cannot release a newer write's lock | opFree without identity |
| u10 | WalletConnect event filtering; closing the sheet cancels nothing | no event filter |
| u12 | WalletConnect load failure gives the recovery sheet | no fallback sheet |
| u13 | Sync-throwing send: uncertain, no resend | code-less errors treated as not sent |
| u14 | Malformed account lists; A->B->A stops a waiting write | skip the eth_accounts check |
| u15 | Late announcement and slow probe | probe cut 1.5 s -> 0.5 s |
| u16 | Phone in-app: a 4001 asks no other provider | loop ignoring 4001 |
| u17 | No wallet / dead wallet sheets free the button | none named (behaviour guard) |

## Runs
- **Full suite on d9ab802: 113/113 PASS, rc=0** (ev/matrix/full-d9ab802.log, results-full-d9ab802.json).
  - @orig 38, @audit2 35, @audit3 21, @audit3b 17, @harness 2.
  - Ids are unique: the runner checks them at registration.
- **@audit3b 5x on d9ab802:** 17/17 every time (ev/matrix/rep1..rep5-d9ab802.log).
- **@audit3b on f9a6f80:** 13/17, FAILED u1, u2, u3, u11 (ev/matrix/audit3b-on-f9a6f80.log). Every guard passes there.
- @audit3b u1-u11 on ae9eaab: 7/11, FAILED u1, u2, u3, u11 (u-on-ae9eaab.log). u12-u17 on ae9eaab: all pass (u12-14-on-ae9eaab.log, u15-16-on-ae9eaab.log, u17-on-ae9eaab.log).
- Environment: during the runs, the agent proxy logged failed connections to mtalk.google.com:5228 (Chromium's own background push channel, already noted in FIX_REPORT). No wallet, RPC or relay was contacted; the harness refuses every outside page request and socket.
- One test error during development, fixed in the test and not in the page (law 14): u17 pressed a WITNESS button hidden by Escape. That first run is overwritten by the rerun log (u17-fix.log).

## COVERAGE.md summary
Every item of the brief has a row in COVERAGE.md.

**Covered by existing cases (read, not titled).** Most provider, session, revocation, tracking and collection items:
- Provider and session: a-j, h6-h9, j1-j3.
- Revocation: k1-k6.
- Tracking: r1-r9, y1-y10, q5/q6.
- Collection: p1-p5, x1-x7, z1-z4, n1-n6, l1-l4, c1/c2, w1/w3.
- WalletConnect: m1, m4, m5, m9.

**New cases.** 4 regressions (u1, u2, u3, u11) and 13 guards (u4-u10, u12-u17).

**Documented, no case:**
- Confirmation policy: 1 confirmation, the first mined receipt from any reader; the receipt hash is not checked; no reorg re-check.
- The COLLECT value is computed at the hand-off (price + 10%; the contract refunds the excess, STORMGLASS.sol:347).
- The phone path's by-design fallback on non-refusal errors (index.html 999-1001).
- A stall after the hand-off keeps the lock until the wallet answers or the page is reloaded.
- No visibilitychange handling.
- A falsely-successful switch in COLLECT toasts nothing.
- A WalletConnect load failure is reported only at 20 s, and closing that sheet says "Cancelled in your wallet".
- settle, sync and withdraw have no case of their own; they use the same send() path, verified by inspection.

**Every contract write call site was grepped.** All 10 go through send() -> opBegin/OpSigner; no bypass.

## Stays unverified
- Chromium with an iPhone UA is not iOS Safari or a wallet app. Unverified:
  - iOS page freezing on the jump;
  - universal-link handling in MetaMask, Rainbow and Zerion;
  - wc.js's own jump (hasFocus);
  - the real relay (every socket is refused);
  - return from background.
- Whether a WALLETCONNECT_DEEPLINK_CHOICE copy could live in WalletConnect's IndexedDB store. wc.js `zA()` reads localStorage, then IndexedDB; the page clears only localStorage. Nothing in the shipped path writes it.
- IME was tested with dispatched CompositionEvents, not CDP Input.imeSetComposition.
- Real wallets' error codes for refusal (4001 is assumed, as before).
- The D2 and D3 wordings need the curator's approval.
