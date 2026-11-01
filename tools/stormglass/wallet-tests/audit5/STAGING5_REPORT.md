# STAGING 5 REPORT: test-wallet.html for the audit-5 candidate

- Worktree /home/claude/wt-a5-staging, branch audit/wallet-5-staging (built on 6c18095, then `git merge e665089`: no overlap with the staging files). Commit trailers follow COMMON.md (Co-Authored-By: Claude Opus 5.5); a system reminder in this session named Sonnet 5.5, which was not used. Nothing pushed. index.html never edited.
- Candidate built: **e665089 (full sha e66508991c32d3fa0734cf0efc9bebb37265eae2 = 6c18095 + review 791034b + a test-only gate)** (index.html sha256 99131cd72c8f782ea76045c2ff56e17e9897cea8e77285604f06ea119875ec56).
- Branch head: 041d2a5 (merge c36e952 of e665089 into the staging branch, then the rebuilt test-wallet.html). test-wallet.html sha256: e7afbfe238df981526d5beb69a1959df86f83fab41e0b281c0464205ee9e0535.
- Evidence: /home/claude/audit5/ev/staging/ (logs, results-*.json, mut/, shots/ with probe.json).

## 1. Verify first (before any change)
- `node tools/stormglass/staging/build.js --candidate 6c18095`: BUILD OK on the unchanged build. Taps: window.ethereum x10 (was 9), EIP-6963 x1, WalletConnect namespace x1. The literal method set is the audit-4 set: eth_accounts, eth_blobBaseFee, eth_blockNumber, eth_call, eth_chainId, eth_getBlockByNumber, eth_getTransactionByHash, eth_getTransactionCount, eth_getTransactionReceipt, eth_requestAccounts, eth_sendTransaction, eth_signTypedData_v4, personal_sign, wallet_addEthereumChain, wallet_revokePermissions, wallet_switchEthereumChain. The audit-5 repairs add no wallet or RPC method literal.
- `--candidate 38264fc` on this index.html: refused, rc 1 ("candidate 38264fc's index.html is not byte-identical to the source"). Nothing written.
- st1-st22 as they were, on the build of 6c18095: **22/22 PASS** (ev/staging/verify-6c18095.log). No anchor or tap broke.
- What passing did NOT cover (found by reading the repaired code), and what was done:
  1. **withdrawTo is a new contract WRITE** (one more `send()` call; ABI already had it). Nothing in the old build listed contract writes, so a new write would have been intercepted only because every eth_sendTransaction is. Now the build enumerates them (section 5) and st31 sends each one through the real-mode wrapper.
  2. **The intercept panel showed `withdrawTo(arg0: 0x...)`** (the page ABI has an unnamed parameter). A PAYS TO (recipient) row now shows the decoded recipient on its own line.
  3. **The simulated chain could not model the new code**: `claim` credited `owed` unconditionally, nothing settled seat earnings on buy/witness, `owed()` was always 0, readers always answered eth_getTransactionByHash truthfully, and the wallets could not fail a connect. These are the controls below.
  4. The new nonce check (`txOk`) refuses the staging chain's own answer if it is malformed: the simulated answers already carry hash, from, nonce (hex), to, input, value and chainId '0x1', so no change was needed.

## 2. Build command
    node tools/stormglass/staging/build.js --candidate <sha>     # index.html -> test-wallet.html, stamped <sha>; refuses unless <sha>:index.html is byte-identical
    node tools/stormglass/staging/build.js --check               # exit 1 unless test-wallet.html == a fresh build (reuses the stamped commit)
    node tools/stormglass/staging/build.js --patches ...         # also prints the patch list as JSON
    (mutation checks only:  --runtime FILE / --policy FILE use another stage.js / policy.js; a normal build never passes them)
New fail-loud checks (audit 5), in addition to audit 4's runtime-read checks:
- Every `send('name', ...)` in index.html must be in policy.js SEND_NAMES (bid, settle, pledge, sync, buy, witness, claim, withdraw, withdrawTo); every CONTRACT_WRITES entry must still be in the page ABI; the page may not call `.sendTransaction`, `.sendCalls`, `.signMessage`, `.signTypedData`, `.sendRawTransaction` or `.signTransaction` directly (every write goes through send()). The build prints the send names.

## 3. Staging vs production: the complete difference list
Source patches (from `--patches`; st22 undoes exactly these and gets index.html byte for byte): **unchanged from audit 4**
1. Every `window.ethereum` read becomes `__SG.eth()` (11 matches on e665089: 6 in code, 5 in comments; 10 on 6c18095), provider tap.
2. EIP-6963 listener `const d=e&&e.detail;` becomes `const d=__SG.detail(e&&e.detail);` (1x).
3. `_wcGlobal` goes through `__SG.wcNS(...)` (1x).
4. After `<head><meta charset="utf-8">`: generated-file comment, `<meta name="robots" content="noindex,nofollow">`, the inline staging runtime (stage.js + policy.js).
5. `<title>` becomes `TEST BUILD · STORMGLASS staging (not the live site)`.
6. Before `</head>`: the staging `<style>` (stage.css).
7. After `<body>`: `<div id="sg-banner">`.
The audit-5 controls are in the runtime only (item 4's script): no page source line is touched for them.

Runtime-only (no source change), new in audit 5:
- The simulated readers answer eth_getTransactionByHash by CONTROLS (TXIDS); the simulated wallet can answer the same way (and in REAL mode the staging layer answers a simulated hash itself, so the real wallet is never asked).
- The simulated wallets can fail eth_requestAccounts with a chosen error (rejected promise or synchronous throw). `phone2` preset: **the page decides "phone" from navigator.userAgent (`isPhone`) and "inside a wallet app" from window.ethereum's flags (`inWalletApp`)**; on this preset (SIMULATION only) the runtime defines `navigator.userAgent` as an iPhone + MetaMaskMobile string before any page script runs, so a desktop browser behaves as a phone in a wallet app. On a real phone nothing is overridden. MODE switch clears it (the preset is session state).
- The simulated chain models the contract's `owed()`, `withdraw()` and `withdrawTo(address)` (revert when nothing is owed, when the payee rejects ETH, or on the zero address), and seat-earnings settlement (`_settleSeats` then `_pay`): earnings go to a payer that accepts ETH, or into `owed` for one that rejects it.
- As in audit 4: `window.fetch` wrap (cross-origin JSON-RPC answered in the page, writes refused), per-tab `localStorage` copy in SIMULATION, held deep links, the FAST tracking clock (3 TRACK numbers, shown in the banner).

## 4. What is simulated and what is real, per mode
| | SIMULATION (default) | REAL WALLET: CONNECTION TEST |
|---|---|---|
| Wallets | Simulated EIP-1193 wallets (EIP-6963, window.ethereum, providers[], simulated WalletConnect phone, audit 5: phone in a wallet app with two authorised wallets). Real wallets invisible. | The visitor's real wallets, each wrapped at the provider boundary before the page receives it. |
| Connect, switch, disconnect | Simulated, with controls (audit 5: connect can fail with a chosen error). | Real. eth_requestAccounts and wallet_switchEthereumChain only after ASK MY WALLET (also for the wallet picked on CHOOSE ANOTHER WALLET). |
| Transactions (every contract write, withdrawTo included), signatures | Simulated wallet screen; every outcome selectable. | Never forwarded. Intercept panel: chain, wallet chain, sender, target, value, decoded action and args (withdrawTo: recipient on its own row), gas, "SUBMISSION INTERCEPTED". |
| Sale, blocks, receipts, transaction lookups, owed, seat earnings | Simulated chain in the page. | The same simulated chain. |
| Network contact | None. | The wallet extension; on phones the WalletConnect relay (pairing, account and network changes only). No JSON-RPC to Ethereum nodes. |

## 5. The allowlist and the write enumeration (REAL mode; default-deny at the wrapper's `request`)
Re-enumerated on 6c18095 by (a) the build's literal audit, (b) the build's new send()/ABI audit, (c) st21's enumeration, (d) st31 (the page's own ABI, each write sent through the wrapper), (e) the mock wallet logs of st7, st8, st9, st14, st15, st21, st29, st30, st31.
- **RPC methods the page can send** (literals): the 16 above, unchanged from audit 4. READER methods (eth_blobBaseFee, eth_getTransactionCount) go only to public HTTP readers (answered in the page).
- **Contract writes the page can send** (each one `eth_sendTransaction` through send(): op lock, captured provider/account/chain, gas pad, tracking): bid, settleCandle (send name `settle`), pledge, sync, buy(id,pick), witness(id), claim, withdraw, **withdrawTo(address)** (new in audit 5: pays what the contract owes the SENDER to the named address; value 0). The page ABI's non-view functions are exactly these nine (st31).
- **Forwarded to the real wallet:** eth_accounts, eth_requestAccounts (gated), eth_chainId, wallet_switchEthereumChain (gated), wallet_revokePermissions, eth_blockNumber, eth_call, eth_getBlockByNumber, eth_getLogs, eth_getTransactionReceipt, eth_getTransactionByHash (a simulated hash is answered locally, also under the audit-5 identity controls).
- **Answered by staging:** eth_estimateGas.
- **Intercepted, never forwarded:** eth_sendTransaction (all nine contract writes), wallet_sendTransaction, wallet_sendCalls, eth_sendRawTransaction, eth_signTransaction, eth_sendUserOperation, wallet_grantPermissions, eth_sign, personal_sign, eth_signTypedData (v1, v3, v4).
- Everything else: refused with 4200. The WalletConnect wrapper exposes `session` as a frozen copy; the raw provider's request/send/sendAsync/signer paths refuse writes (belt).
- policy.js is unchanged except the new CONTRACT_WRITES / SEND_NAMES lists. No method was added to FORWARD.

## 6. How to trigger each scenario (click by click)
Open https://dithervoid.art/test-wallet.html (SIMULATION by default). CONTROLS (banner) → SCENARIOS (audit 5) has cards 5-8; each has a SET UP button, the steps and the expected result. Cards 1-4 (audit 4) are unchanged. In REAL mode cards 5, 7 and 8 and the receipts card are shown; card 6 needs the simulated wallets. After a SET UP press CLOSE.
5. **Whose transaction is this? (nonce identity).**
   - Card 5 → pick one answer: ALL READERS: ANOTHER TRANSACTION OF THE SENDER (same nonce, same call) / (next nonce, plain transfer) / AN UNRELATED TRANSACTION, MINED (lower nonce) while this one is pending; or FIRST READER: another transaction / an unrelated MINED transaction / an answer with no hash / nonce as the decimal "7", then a valid fallback. Optionally THE WALLET ANSWERS THE SAME WAY → SET UP.
   - CONNECT → SIM ALPHA · 1 → WITNESS 0.01 → in the wallet screen PENDING · DECIDE LATER.
   - Seen: "sent … waiting for Ethereum to confirm", never replaced / cancelled / confirmed. LOG (newest first) lists each reader the page asked (ethereum-rpc.publicnode.com, rpc.mevblocker.io, eth.drpc.org) with "answered ANOTHER transaction … not <your hash>" (or NO HASH / DECIMAL), then the wallet's "answered the VALID transaction". With the wallet also unrelated, the page asks it up to 5 times and stays pending (then "cannot confirm", much later).
   - TRANSACTIONS AND TRACKING → CONFIRMED on that transaction: the page confirms from its own receipt.
   - Legitimate outcomes: choose SPED UP, CANCELLED or REPLACED in the wallet screen (with FIRST READER … or ALL READERS and the wallet valid): the page reports them as before.
6. **A phone wallet fails to connect: CHOOSE ANOTHER WALLET.**
   - Card 6 → pick the error (4001, 4100, 4200, 4900, 4901, -32002, -32603) and REJECTED PROMISE or SYNCHRONOUS THROW → SET UP (the page reloads as a phone inside a wallet app: here navigator.userAgent reads iPhone + MetaMaskMobile; two simulated wallets, both already authorised: SIM ALPHA is window.ethereum and fails, SIM BETA is announced over EIP-6963).
   - CONNECT. Seen (not for 4001 and -32002, which are answers: a toast): YOUR WALLET DID NOT CONNECT, the wallet's error, "No other wallet was asked", CHOOSE ANOTHER WALLET.
   - CONTROLS → LOG: SIM ALPHA eth_requestAccounts (REJECTED PROMISE / SYNC THROW n); SIM BETA nothing.
   - CHOOSE ANOTHER WALLET → CONNECT WITH (SIM BETA gets only a liveness eth_chainId) → SIM BETA: connects (0x…0b01); SIM BETA now has exactly one eth_requestAccounts.
   - REAL mode: a real phone in a wallet app with a failing wallet does the same, and the second wallet's request waits for the staging gate (ASK MY WALLET).
7. **WITHDRAW TO ANOTHER ADDRESS.**
   - Card 7 → OWES 0.05 ETH, RECIPIENT ACCEPTS ETH (or REJECTS) → SET UP → CLOSE → CONNECT (SIM ALPHA · 1).
   - Under YOUR SEATS the OWED figure shows and WITHDRAW TO ANOTHER ADDRESS appears. Open it and type: 0x000…000, a short string, the STORMGLASS contract address, your own address (0x…0a11): each is refused with the page's message; nothing reaches the wallet.
   - A valid address → REVIEW: the sheet shows the full checksummed recipient and 0.05 ETH. SEND TO THIS ADDRESS: the simulated wallet screen shows ACTION withdrawTo(arg0: recipient), PAYS TO (recipient), VALUE 0.0 ETH, SENDER = the connected account. LOG: `eth_sendTransaction … CALL withdrawTo(0x…) · from 0x…0a11 · to <contract> · value 0.0 ETH`.
   - CONFIRMED: owed refreshes to 0, the button goes. With RECIPIENT REJECTS ETH the chain reverts it whatever you press: "Failed on Ethereum (reverted)…", the box stays for another address (set RECIPIENT ACCEPTS, SET UP, try again). REJECTED IN WALLET: "Cancelled", the address stays.
   - Before the wallet is asked (after REVIEW, with the sheet open): press ACCOUNT CHANGES or NETWORK GOES TO BASE (card 7), or arm card 1; then SEND TO THIS ADDRESS: "Nothing was sent", no eth_sendTransaction in the LOG.
   - REAL mode: the same flow; SEND TO THIS ADDRESS opens SUBMISSION INTERCEPTED with withdrawTo, the recipient on its own PAYS TO row, value 0. Pick CONFIRMED or any result; the real wallet never sees it.
8. **Payout outcomes.**
   - Card 8 → THE PAYER'S WALLET ACCEPTS ETH → SET UP (every account: seats, 0.0364 ETH pending, nothing owed, nothing received) → CONNECT → COLLECT → CONFIRMED.
   - Seen: the line next to SET UP and the LOG "payout … 0.0364 ETH sent to 0x…0a11 (seat earnings, the wallet accepts ETH)"; the seats note shows nothing owed; no WITHDRAW buttons.
   - Card 8 → THE PAYER'S WALLET REJECTS ETH → SET UP → WITNESS 0.02 → CONFIRMED. Seen: LOG "the wallet rejects ETH: the amount is now OWED to it"; OWED 0.03640 ETH; WITHDRAW and WITHDRAW TO ANOTHER ADDRESS appear. WITHDRAW (CONFIRMED) reverts for that wallet; WITHDRAW TO ANOTHER ADDRESS to an accepting address pays it.
   - All amounts are simulated; the contract's own rule (try to send, else owed) is modelled, not run. Seat earnings are settled on buy/witness only after this card's SET UP (CLAIM settles always), so the earlier scenarios keep CLAIM available.

## 7. Tests (tools/stormglass/staging/staging.test.js)
Command: `PORT=8952 OUT=… LABEL=… SCRIPT=../staging/staging.test.js bash tools/stormglass/wallet-tests/run.sh` (CASES=st23,st26 to select; STAGING_PAGE=another page).
st1-st22: unchanged; they pass on the new build. New:
| id | what it proves |
|---|---|
| st23 | Scenario 5 from the drawer, 8 rows (other-same, other-next, other-mined, other-mined + wallet, first-other, first-mined, first-nohash, first-decimal). Each row asserts its gate (the poisoned/malformed answer was served; first-*: a valid fallback served; all-*: all three readers and the wallet asked), then: pending, "waiting for Ethereum", no replaced / cancelled / confirmed / sped / cannot-confirm toast; then CONFIRMED from the control confirms from the page's own receipt. 3 unrelated MINED transactions existed. |
| st24 | Legitimate outcomes kept: FIRST READER unrelated/mined + a real SPED UP, CANCELLED, REPLACED each reported with the production wording; all readers unrelated + wallet valid + REPLACED reported; with readers AND wallet unrelated nothing is reported (gate: the wallet was asked twice with an unrelated answer). |
| st25 | Scenario 6, 14 rows: 4001, 4100, 4200, 4900, 4901, -32002, -32603 x rejected promise / synchronous throw, each from the drawer (SET UP reloads as the phone preset): user agent iPhone, isPhone and inWalletApp true, both wallets authorised; SIM ALPHA asked once (SYNC THROW / REJECTED PROMISE logged); SIM BETA has no request until the list; offer except for 4001 / -32002 (toast); the list gives BETA only a liveness eth_chainId; the pick gives BETA exactly one eth_requestAccounts, ALPHA still one; never an eth_sendTransaction. |
| st26 | Scenario 7 from the drawer: zero / short / contract / own refused with the page's message, nothing asked of the wallet; valid recipient: sheet, then withdrawTo(recipient) (decoded from the calldata), from the connected account, to the contract, value 0; the log's CALL text; CONFIRMED: owed 0, payout to the recipient, button gone; recipient rejects ETH: reverted by the simulated contract, note "Failed on Ethereum (reverted)", box and button stay, owed kept; another address then confirms; REJECTED IN WALLET: "Cancelled", address kept, no new transaction. |
| st27 | Scenario 7 before the handoff, three boots: ACCOUNT CHANGES, NETWORK GOES TO BASE (refusing), scenario-1 last-moment change: "Nothing was sent", 0 eth_sendTransaction, no transaction. |
| st28 | Scenario 8: accepting payer: earnings received (0.0364 ETH simulated), nothing owed, no WITHDRAW buttons, one payout line; rejecting payer: owed 0.0364, both buttons shown, seats note names them; WITHDRAW reverts (payer rejects ETH); WITHDRAW TO ANOTHER ADDRESS confirmed: owed 0, recipient received. |
| st29 | REAL: the withdrawTo intercept panel (chain, sender, target, value 0.0, ACTION withdrawTo, PAYS TO = recipient); CONFIRMED tracked; a forged withdrawTo eth_sendTransaction, wallet_sendCalls and eth_sendRawTransaction refused; the external mock wallet got no write or sign method and `__MW.sends` is empty. |
| st30 | REAL on a phone (wallet-app UA): window.ethereum fails (-32603): offer; the second authorised wallet has only (before the list) nothing and (on the list) a liveness eth_chainId; picked: the staging gate opens first (B has 0 eth_requestAccounts), ASK MY WALLET gives exactly 1; A asked once. Then readers + wallet fallback unrelated: pending, no false verdict, the real wallet is not asked eth_getTransactionByHash. |
| st31 | The enumeration: every RPC method literal and every send() name classified; page ABI writes == CONTRACT_WRITES (9, withdrawTo included); no direct signer/provider write calls; in REAL mode every one of the nine writes, built from the page's own ABI, is intercepted (decoded action in the panel) and refused 4001; the wallet received none. |
| st32 | MODE switch from the phone preset with a pending withdrawTo and all audit-5 controls set: REAL has the desktop user agent, EP / me / OPLOCK null, no transactions, default controls, only the external wallet (wrapped) and no mock request but eth_chainId; back in SIMULATION: defaults, no transaction. |
Already covered and unchanged: real mode never forwards a write or sign (st8, st9, st14, st15, st21 and now st29-st31); mode switch (st10, st32); banner, revision = stamp, noindex, title (st1); index.html byte-identical and free of staging marks (st1, st11); the staging differences are exactly the 7 documented patches (st22, `--patches`); the build refuses changed shapes (st13).

### Results (final candidate e665089, rebuilt after the review commit 791034b)
- **Full staging suite on the build of the final candidate e665089: 32/32 PASS, rc 0** (ev/staging/full-e665089.log, results-full-e665089.json; about 9.5 min). Also 32/32 on the interim build of 6c18095 (full-6c18095.log). 0 outside requests and 0 sockets refused in every case.
- Verify-first run, st1-st22 on the build of 6c18095 before any change: 22/22 (verify-6c18095.log).
- **What the review changes (791034b, index.html sha256 99131cd7…) mean for staging:** nonceOf now requires the block's own 32-byte hash and the tx/receipt blockHash to equal it; switchChain asks only the connected wallet (`EP`), nothing when disconnected. Checked: the simulated eth_getBlockByNumber returns `hash` = hex32(n) and every simulated tx/receipt names `blockHash` = hex32(its block), so they agree; no staging scenario used a block without a hash. The SWITCH button (st5, st14, st17) is only used connected. No simulation change was needed, no assertion was touched, and no control for a hashless block was added (the production suite's audit5review.test.js covers it). The window.ethereum tap count is now 11 (the review comment in index.html contains the text); st22 reverses it byte for byte.
- **Fail-first (the scenarios must reach the repaired production code), run on the interim 6c18095 build** (the review commit does not touch these paths). The same new cases on a staging build of the audit-4 candidate 38264fc's index.html (built from `git show 38264fc:index.html` under an untracked name, deleted): **1/9 pass** (failfirst-38264fc.log; the one pass, st31, runs its page-independent checks against the repo's index.html and the wrapper):
  - st23: the page asked only the first reader and trusted its unrelated answer; with an unrelated MINED transaction of the sender it said "your wallet replaced it with another transaction" (rows other-mined, other-mined + wallet, first-mined), a false verdict.
  - st25: SIM BETA received eth_requestAccounts, eth_accounts and eth_chainId with no prompt after SIM ALPHA failed (4100/4200/4900/4901/-32603); no CHOOSE ANOTHER WALLET.
  - st26-st29: no WITHDRAW TO ANOTHER ADDRESS button at all (the flow does not exist on 38264fc).
  - st30: no CHOOSE ANOTHER WALLET sheet.
  - st24 fails on its gate (the wallet fallback is never asked once the first reader's unrelated answer is trusted).
- **Mutations on the e665089 staging build** (temporary builds with `--runtime`, or the generated page edited; deleted after; logs mut-*.log in ev/staging/mut/, the same five on 6c18095 kept as mut-*.6c18095.log; identical outcomes):
  - Wrapper forwards everything (`if(FORWARD.has(method))` → `if(true)`): **st8, st9, st21, st29, st31 FAIL** (mut-forward-all.log).
  - withdrawTo forwarded in real mode (an `eth_sendTransaction` whose calldata starts with the withdrawTo selector 0x72b0d90c is sent to the real wallet): **st29 and st31 FAIL; st8, st9, st21 PASS** (mut-forward-withdrawTo.log). This is the mutation only the new tests can catch.
  - Dropped EIP-6963 tap (`__SG.detail(e&&e.detail)` back to `e&&e.detail`): **st1, st8, st9, st10, st21, st29, st30, st31 FAIL** (mut-no-6963-tap.log).
  - Gate bypass (no GATED methods: eth_requestAccounts forwarded without asking): **st7, st14, st30 FAIL** (mut-gate-bypass.log). st30 is the CHOOSE ANOTHER WALLET path in real mode.
  - The identity control stops serving unrelated answers (every reader valid): **st23 FAIL** on its gate (mut-sim-no-unrelated.log): a scenario cannot pass because the situation never happened.
- `build.js --check`: STAGING CHECK OK (e665089). `--candidate 38264fc` against this index.html is refused (rc 1).
- Not rerun here: the production suite (the release run on e665089 is the orchestrator's). index.html on this branch is byte-identical to e665089's (sha256 99131cd7…ec56).

### The page
- `test-wallet.html` (generated, committed): stamped candidate **e665089**, index.html sha256 99131cd72c8f782ea76045c2ff56e17e9897cea8e77285604f06ea119875ec56, 346,645 bytes, built with `node tools/stormglass/staging/build.js --candidate e665089` (taps: window.ethereum x11, EIP-6963 x1, WalletConnect x1). Banner (SIMULATION and REAL WALLET TEST): `candidate e665089 · sha256 99131cd72c8f`; st1 asserts it equals the embedded stamp.
- Contract writes the page sends (build output): bid, buy, claim, pledge, settle, sync, withdraw, withdrawTo, witness.

## 8. Screenshots (ev/staging/shots/, probe.json, probe-a5.json)
- 105 screenshots on the e665089 build, probe.json (rows: viewport, banner, horizontal scroll, panel and drawer inside the viewport, banner clipped, page errors; **0 problems in 105 rows**, 0 refused requests, 0 page errors). The law-8 default state at all six sizes (banner_sim_1440x900, 1366x768, 1280x800, 1024x768, 768x1024, 390x844: banner 30 px high on desktop, 44 px on the phone, never clipped, no horizontal scroll).
- Audit 3 and 4 shots (a3_*, a4_*) at 1440x900 and 390x844 are unchanged in layout. Audit 5 (a5_*): the four control cards, the nonce LOG with each reader's answer, the pending state, the phone offer (YOUR WALLET DID NOT CONNECT / CHOOSE ANOTHER WALLET), the wallet list, the second wallet connected, the withdrawTo review sheet, wallet screen, LOG call line, CONFIRMED, REVERTED (recipient rejects), refused zero address, the REAL withdrawTo intercept panel and the payer accepts / rejects pages, each at 1440x900 and 390x844.
- **I looked at** (not just probed) the default state at 1440, 768 and 390, and at 390 or 1440 the nonce LOG, the phone offer, the REAL withdrawTo intercept, the payer-rejects page with the new payout status line (`last payout 0.0364 ETH → 0x000000… (refused, left owed)`), and the earlier-run views of the withdrawTo sheet / wallet screen / reverted note / s8 pages. Nothing overlaps or clips; the intercept panel scrolls inside the viewport on the phone.

## 9. Limitations (what staging cannot prove)
- **Real wallet payment screens and real WalletConnect relay delivery are never exercised.** Payments and signatures stop at the wrapper; the intercept panel says so. withdrawTo is no different: a real wallet's own handling of a withdrawTo request (what it shows for an unnamed address argument, whether it simulates it as safe) is not tested here.
- **The wallet's own errors are modelled by code only.** Scenario 6 makes a simulated wallet answer eth_requestAccounts with a chosen JSON-RPC code, as a rejected promise or a synchronous throw. Real wallets' messages, extra fields (`data`, nested `error`), their behaviour on repeated requests, and an EIP-6963 wallet that throws on announcement are not modelled. The phone is a user-agent override on whatever browser opens the page: iOS Safari's backgrounding, app switching and deep-link return are not exercised (the Navigation-API hold, from audit 4, only shows the link).
- **The identity controls change only what the simulated readers and the simulated wallet answer to eth_getTransactionByHash.** A real reader's other failure modes (stale cache, a reorged block, rate limits, a node that lies consistently across all three readers and the wallet) are not modelled. In REAL mode the page never asks the real wallet about a simulated hash (the staging layer answers it), so how a real wallet answers eth_getTransactionByHash is not tested.
- **The simulated contract is simplified.** It models owed(), withdraw(), withdrawTo(address) (revert when nothing is owed, when the payee rejects ETH, on the zero address) and a flat 0.0364 ETH of pending earnings per account; seat accounting, the 70/20/10 split, the real gas cost and a real contract's receive() behaviour (a smart wallet that spends more than 60,000 gas, as `_pay` limits) are not run. Whether a payee "rejects ETH" is a switch, not a computation. Seat earnings settle on buy/witness only after card 8's SET UP.
- **FAST CLOCK and the receipt controls change what the staging page's tracking sees**, as in audit 4; an audit-5 row ends at the first poll rounds (the pending window is under 20 s).
- **Staging patches the page's provider reads.** The staging page differs from the candidate by the seven patches above (and the runtime); st22 undoes them exactly. A path the build does not tap (a provider obtained some other way) is refused by the build (st13), not silently allowed.
- **Shared origin with the live site.** A REAL-mode WalletConnect session shares the live page's storage, as two tabs of dithervoid.art would. SIMULATION uses its own per-tab copy.
- **No real wallet, RPC or relay was contacted.** Every page request outside 127.0.0.1 was refused by the harness (0 refused in every run). The proxy may report failed connections to mtalk.google.com:5228 from Chromium's own background service; they were refused.
- The staging page's own wording (cards, intercept rows) was written for the owner and the reviewers; it is not shipped to visitors.

## 10. WORDING FOR APPROVAL (staging page only; the production page's wording is the page agent's list)
CONTROLS · SCENARIOS (audit 5), headings and buttons: `5. WHOSE TRANSACTION IS THIS? (nonce identity)` · `6. A PHONE WALLET FAILS TO CONNECT: CHOOSE ANOTHER WALLET` · `7. WITHDRAW TO ANOTHER ADDRESS` · `8. SEAT EARNINGS WHEN THE PAYER PAYS: ARRIVE, OR WAIT AS OWED`; the option labels in TXIDS (e.g. `ALL READERS: AN UNRELATED TRANSACTION OF THE SENDER, MINED (lower nonce) while this one is pending`), `THE WALLET’S OWN ANSWER IS VALID` / `THE WALLET ANSWERS THE SAME WAY`, `REJECTED PROMISE` / `SYNCHRONOUS THROW`, `OWES NOTHING` / `OWES 0.05 ETH` / `OWES 0.5 ETH`, `RECIPIENT ACCEPTS ETH` / `RECIPIENT REJECTS ETH`, `ACCOUNT CHANGES`, `NETWORK GOES TO BASE (and refuses to switch back)`, `THE PAYER’S WALLET ACCEPTS ETH` / `REJECTS ETH`, `CONNECT: ERROR (SCENARIOS 6)`, `SET UP (reloads as a phone in a wallet app)`; each card's steps and EXPECT text (in stage.js).
Intercept panel and wallet screen: new rows `PAYS TO (recipient)` and `PAID FROM` = `what the contract owes the SENDER above; the sender’s wallet only authorises it`. Preset name `PHONE · IN A WALLET APP, TWO WALLETS (audit 5: the first fails to connect, the second is already authorised)`. LOG lines: `unrelated transaction mined`, `revert`, `payout` and the reader answers (`answered ANOTHER transaction of the sender … not …`).
No visitor-facing wording of the production page is added or changed by the staging build.


