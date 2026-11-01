# Audit 4, Part 2: STORMGLASS wallet lifecycle scan on 0cd4ea4 (before any fix): REPORT

Worktree /home/claude/wt-a4-scan, branch audit/wallet-4-scan (from f1026a0 = main 0cd4ea4 + the @audit4 registration). index.html NOT edited (sha256 8b0c08c6…f2ef in every log). Nothing pushed. New file: tools/stormglass/wallet-tests/audit4scan.test.js (a4s1-a4s7, group @audit4); no runner, mock or fake-chain change. Evidence: /home/claude/audit4/ev/scan/. Coverage delta: /home/claude/audit4/COVERAGE4.md. Harness verification: /home/claude/audit4/HARNESS4.md.

Findings A (chain change in the final gap), B (WalletConnect session_request_sent correlation) and C (malformed receipts) are being repaired in /home/claude/wt-a4-fix and are NOT duplicated here. Six other defects were found (S1-S6), each with a regression that fails on 0cd4ea4, plus one guard (a4s1) for the per-action write check the brief asked for.

## Commits
- df0070c a4s1 guard, a4s2-a4s5 regressions (WIP)
- 8938f59 a4s6, a4s7 (the branch head; the file is final)
- No test-code change after the runs below. The temporary harness self-test file (Part 1) is not in the branch; a copy is in the session scratchpad.

## a4s1 (GUARD): every write entry point sends what was pressed
Before: settle, sync and withdraw had no case; others were checked for one property at a time. a4s1 presses each of witness, buy, bid, settle (candle burnt, reveal block passed), pledge (founders' day), sync (day closed unsold), claim (pending > 0) and withdraw (owed > 0), each in its own context, and decodes what the wallet was asked with the page's own `ABI`:
exactly one eth_sendTransaction; `to` = CFG.contract; `from` = the connected account; `chainId` 0x1 and the wallet on 0x1; value = the pressed amount (buy: price(t+30 s)·1.1 inside a 10 s window; non-payables none); `gas` set; calldata = the pressed function and arguments (witness(13), buy(13,3), bid(), settleCandle(), pledge(), sync(), claim(), withdraw()); the eth_estimateGas before it asked about the same to/data/value.
Passes on 0cd4ea4 (all 8 rows good, ev/scan/results-s-dev1.json). Mutants killed (single anchored edits, copies outside the repo): settle→sync (`decoded: sync`), withdraw→claim (`decoded: claim`), pledge value ×2 (`0x6f05b59d3b20000`) (ev/scan/mut-a4s1-*.log). No bypass of send()/OpSigner found (all 9 write call sites re-grepped: 1350, 1369, 1370, 1395, 1396, 1410, 1429, 1728, 1729; the second sync rendering at 1410 is the closed-day panel a4s1 presses; withdrawTo is never called).

## Defects

### S1 (a4s2): after an account change the seats panel and CLAIM keep the previous account's values
**Trigger.** Connected with account A (seats 2, 0.0364 ETH waiting, CLAIM enabled). The wallet switches to B (accountsChanged [B]). `onAccounts` → `setSession` (1019) changes `me` and the header, then `refreshSeats()` (1723) reads B's seats; until those three reads answer, nothing in the seats view is reset. If a read fails, the old values stay until the next 30 s tick.
**Impact.** The header shows B while the panel says "You hold 2.0000 seats… Earned and waiting for you: 0.03640 ETH (press CLAIM…)", the seats board highlights A's row, and CLAIM is enabled. Pressing it sends `claim()` from B, an account with nothing to claim (a paid no-op transaction).
**Regression.** a4s2 holds B's seats reads (the requests go out; the answers wait). On 0cd4ea4: `during:{seats:"2.0000", note:"You hold 2.0000 seats… 0.03640 ETH (press CLAIM", claim:true}`, `walletAsked:[{from:"0x…00bb", data:"0x4e71d92d"}]` (claim from B); after the release the panel is right (0.0000, CLAIM off). FAIL (s-dev1.log, full run).
**Suggested repair.** When the session's account changes (setSession with a new address, or onAccounts), put the account-bound view in a neutral "reading…" state at once: hide or blank `nx-mine`, seatsNote "Reading your seats…", CLAIM disabled, WITHDRAW hidden, `markMe()`; `refreshSeats` fills it on its answer and leaves it neutral when the read fails.

### S2 (a4s3): a dead wallet used as the last-resort reader freezes the page
**Trigger.** Every public reader fails (the case for which the wallet fallback exists), and the browser's wallet does not answer eth_chainId (asleep, un-onboarded, a crashed extension: the same wallets the picker already drops after 1.5 s). `bindRead` (815) calls `walletReads()` (813), which awaits `P.request({method:'eth_chainId'})` with no time limit.
**Impact.** The first `tick()` never ends, so the boot's `await tick(); setInterval(()=>tick(),30000)` (1780) never installs the retry: the page stays on its loading chip ("READING THE CHAIN") forever, never says "CANNOT REACH ETHEREUM", and does not recover when the readers come back. With no wallet, or a wallet that answers, the same outage shows "CANNOT REACH ETHEREUM" in ~0.2 s.
**Regression.** a4s3 (dead wallet vs. no wallet, readers 500, then readers back for 36 s). On 0cd4ea4: `deadWallet:{said:false, ms:10025, chip:"READING THE CHAIN"}`, `noWallet:{said:true, ms:256}`, `recoveredWithin36sOfReadersBack:false`. FAIL.
**Suggested repair.** Give walletReads the picker's 1.5 s cut (`Promise.race` with a timer, through `ask`/`chainOf` so a sync throw or malformed answer means "no"). Optionally install the 30 s interval before the first tick.

### S3 (a4s4): an account change without an event leaves the page stuck
**Trigger.** The wallet's first account changes (or the site's permission is dropped: eth_accounts `[]`) without an accountsChanged event. The visitor presses WITNESS (any write).
**Impact.** The last look (opCheck 1096) correctly stops the write ("Your wallet changed while this was waiting. Nothing was sent."), but the page never acts on what it saw: `me` and the header keep the old address. Every later deliberate press stops the same way, forever, with a message that blames a change "while this was waiting". With the permission gone the page keeps showing itself connected. Only DISCONNECT + CONNECT (or a later event) gets out. Nothing wrong is sent (v2 still holds).
**Regression.** a4s4. On 0cd4ea4: first and second press both `["…confirm in your wallet", "Your wallet changed while this was waiting. Nothing was sent."]`, label `0x0000…00AA` both times, 0 requests; permission-gone variant: label still `0x0000…00AA`. FAIL. The case accepts either repair: follow the wallet (label shows B, the next press pays from B, never from A) or disconnect.
**Suggested repair.** In opCheck, when the op's provider is still `EP` and eth_accounts answers a different first account (or none), pass that list to `onAccounts(op.P, acc)` (empty → the existing eth_accounts double-check → disconnect; another account → setSession) before throwing STALE, and word the toast as what happened ("Your wallet is on another account now. Nothing was sent.").

### S4 (a4s5): WalletConnect link after the 20 s fallback: "Tap the app" with no app to tap
**Trigger.** Phone, CONNECT, WalletConnect gives its pairing link after more than 20 s (slow relay or bundle). At 20 s the sheet becomes "WALLETCONNECT DID NOT ANSWER" (OPEN IN METAMASK, COPY THE LINK). When the link then arrives, `onUri` (874) runs `wake(true)` on the old, detached app buttons and writes "Tap the app that holds your wallet." into the sheet that is open.
**Impact.** The visitor reads "WALLETCONNECT DID NOT ANSWER / Tap the app that holds your wallet." with no app button; the pairing link that now exists cannot be used from this sheet (OPEN IN METAMASK leaves for MetaMask's own browser).
**Regression.** a4s5 (the mock's `enable` delayed 21.5 s). On 0cd4ea4: `after:{title:"WALLETCONNECT DID NOT ANSWER", text:"Tap the app that holds your wallet.", buttons:["OPEN IN METAMASK","COPY THE LINK"]}`, `liveAppButtons:0`. FAIL. It accepts either coherent outcome (the DID NOT ANSWER text kept, or the three app buttons back and live with the "Tap the app" text).
**Suggested repair.** In wcConnect, remember that the dead sheet replaced the picker; `onUri` then re-renders the CONNECT YOUR WALLET sheet (same buttons, woken) instead of writing into whatever sheet is open; keep SHEET_CLOSE pointing at `finish`.

### S5 (a4s6): a stale remembered WalletConnect app names and opens the wrong wallet
**Trigger.** Phone. SG_WC_APP holds ZERION from an earlier pairing. The visitor pairs another wallet through OTHER WALLET or COPY CONNECTION LINK (only an app button, `pick()` 876, writes SG_WC_APP), then pays.
**Impact.** Every confirmation sheet says "CONFIRM IN ZERION" and its OPEN ZERION button jumps to Zerion with this session's requestId and topic, while the session lives in another wallet: the visitor is sent to an app that has no request.
**Regression.** a4s6. On 0cd4ea4: `sheet:{title:"CONFIRM IN ZERION", buttons:["OPEN ZERION"], stored:"{\"name\":\"ZERION\",…}"}` after pairing through COPY CONNECTION LINK. FAIL.
**Suggested repair.** Tie the stored app to the pairing: clear SG_WC_APP when the pairing is made through OTHER WALLET / COPY CONNECTION LINK (or after `enable()` when no app button was tapped for this URI), and/or keep it only when the session's peer metadata (session.peer.metadata.name/redirect) matches it; otherwise use the generic "CONFIRM IN YOUR WALLET" sheet. (Different from B: B is which event arms OPEN; S5 is which app OPEN opens.)

### S6 (a4s7): COLLECT keeps "confirm in your wallet" after DISCONNECT stopped it
**Trigger.** COLLECT pressed; the write is still before the hand-off (the wallet is slow to estimate, or any earlier step). The visitor presses DISCONNECT (the u3 recovery path).
**Impact.** `disconnect()` (943-945) kills and frees the lock; nothing will be sent. The dialog still says "COLLECT DAY 13 · … Collecting the plate: confirm in your wallet" and stays so for as long as the wallet is silent; if the wallet never answers it never changes. When it answers late, the dialog turns into "NOT COLLECTED · Your wallet changed while this was waiting" (true enough).
**Regression.** a4s7. On 0cd4ea4: `afterDisconnect:"COLLECT DAY 13 · 0.7063 ETHCollecting the plate: confirm in your walletBACK"`, `lockFreed:true`, `label:"CONNECT"`, later `sendRequests:0`. FAIL.
**Suggested repair.** Let the lock carry an `onDead` callback: disconnect() calls it when it kills a not-handed lock; nxCollect registers one that, if `mine()`, shows `candActs()` or txView('failed','Stopped: you disconnected. Nothing was sent.'). The WITNESS sheet has only toasts; the same callback can toast there.

## Adjacent evidence for A, B, C (not repaired here)
- **A.** `follow()`'s chainChanged handler (971) only sets `NX.wrong` and the label; the 1 s interval (1060) adds a second chainChanged listener that calls `nxWrong()`; `opLive` (1082) checks session number, provider, account and lock, never the chain. The header's SWITCH (`#nx-chainBar` → switchChain) can be pressed while a write is prepared or handed: it takes no lock.
- **B.** wcHook (867-868) accepts any `session_request_sent` with the same method, an id and a topic; it is installed once per `signer.client` (`c.__sg`) and reads the global `NUDGE`. In wc.js the event is emitted after `sendRequest(…).catch(h)`, i.e. also when the publish failed; the request then still expires after 5 minutes (`wc_sessionRequest` ttl FIVE_MINUTES, "Request expired. Please try again."), which the page reports as UNSURE and which frees a lock held after the hand-off.
- **C.** `mined()` (truthy blockNumber) and `result()` (status === 1n, else reverted) are used for the original receipt and for the replacement found in the scan (x.hash's receipt).

## Checked, no defect
- Witness/pledge/bid on a stale day or state: the value and D are captured at the press/render; the contract refuses an old day at estimation ("that day is gone", STORMGLASS.sol 353-357), so pad's second estimate in OpSigner throws before the hand-off: an error toast, nothing paid.
- `pad()` swallows the first estimate's error and OpSigner estimates again: the wallet is asked eth_estimateGas twice on a failing call (harmless).
- Tracking: two tracked transactions at once share `trackAt` (only rotation order); confirmed/unknown toasts carry the action name, the hash only for sent/unknown.
- A stall after the hand-off on an injected wallet keeps the lock until the wallet answers (by design, audit 3); on WalletConnect it is bounded by the 5-minute request expiry (above).
- visibilitychange: no handler in index.html or wc.js (grep 0/0): limitation, not testable here.

## Runs
- Fail-first, new cases on 0cd4ea4: s-dev1.log (a4s1 PASS, a4s2/a4s3 FAIL), s-dev2.log (a4s3-a4s5 FAIL), s-dev3.log (a4s6 FAIL), s-dev4.log (a4s7 FAIL).
- **Full suite on 0cd4ea4 with @audit4 scan cases: 114/120, FAILED exactly a4s2, a4s3, a4s4, a4s5, a4s6, a4s7; rc=1** (ev/scan/full-0cd4ea4-scan.log, results-full-0cd4ea4-scan.json). All 113 earlier cases and the a4s1 guard pass: no earlier case is disturbed by the new file.
- Determinism: @audit4 run 5 times on 0cd4ea4: identical every time, a4s1 PASS and a4s2-a4s7 FAIL with the same evidence, no exception, no page error (ev/scan/rep1..rep5-audit4.log, results-rep*-audit4.json).
- Mutation proof for a4s1: ev/scan/mut-a4s1-{settle2sync,withdraw2claim,pledgeValue}.log, each FAIL.

## Stays unverified
Real wallets' behaviour on silent account changes (how often eth_accounts changes without an event), WalletConnect pairing latency over 20 s in the field, and anything iOS-specific (page freezing, universal links, return from background). Copy in S3/S4/S5/S6 repairs needs the curator.
