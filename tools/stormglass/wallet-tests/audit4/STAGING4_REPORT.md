# STAGING 4 REPORT: test-wallet.html for the audit-4 candidate

- Worktree /home/claude/wt-a4-staging, branch audit/wallet-4-staging (from 30cf5d8). Nothing pushed. index.html never edited.
- Candidate built: **24cda89** (audit/wallet-4, the final audit-4 candidate: A, B, C and S1-S6 repaired) (index.html sha256 703602f19f0e9fdb3edf46e1cf5e17af5bd1e69d38a9d2a2caf62dad10fe50c5).
- Final head 4b5bd52. test-wallet.html sha256 6bf01c65830a7760e3b1709fd3ed5c60d8062bb8c80490440a2942f737953cfb.
- Evidence: /home/claude/audit4/ev/staging/ (logs, results-*.json, shots/ with probe.json).

## 1. Verify first (before any change)
- `node tools/stormglass/staging/build.js --candidate 30cf5d8`: BUILD OK. Taps unchanged: window.ethereum ×9, EIP-6963 ×1, WalletConnect namespace ×1. The method audit passes. The literal method set is the same as audit 3's d9ab802: eth_accounts, eth_blobBaseFee, eth_blockNumber, eth_call, eth_chainId, eth_getBlockByNumber, eth_getTransactionByHash, eth_getTransactionCount, eth_getTransactionReceipt, eth_requestAccounts, eth_sendTransaction, eth_signTypedData_v4, personal_sign, wallet_addEthereumChain, wallet_revokePermissions, wallet_switchEthereumChain. The repairs add no wallet method.
- `--candidate 0cd4ea4` on the 30cf5d8 index.html: refused, rc 1 ("candidate 0cd4ea4's index.html is not byte-identical to the source"). Nothing was written.
- st1-st15 as they were, on the build of 30cf5d8: **15/15 PASS** (ev/staging/verify-30cf5d8.log).
- No anchor broke. Passing did not mean the repairs were fully exercised. Two silent gaps were found by reading the repaired code:
  1. **Simulated WalletConnect (B).** It emitted `session_request_sent` as `{id:Date.now(), request:{method}}`, with no params. The repaired wcHook requires `request.params` to be the very array the page passed, so the simulated phone could never give an exact OPEN link any more; it always fell to the 8 s fallback. No test asserted the exact link, so nothing failed. Now modelled on /wc.js: `request:{...args}` (a shallow copy, so the same params array), a safe-integer id, the session topic, and a rebuilt request for a chain switch.
  2. **REAL-mode WalletConnect wrapper (B).** It exposed no `session`, so the page's `wcTopic(P)` (provider.session.topic) was always null and real-mode sheets could never correlate. It now exposes a frozen data copy (topic, and the peer's name, url and redirect strings), never the raw session (st21).
- **The final candidate 24cda89** (S1-S6 repaired on top of A, B and C) built without any change to the build: the same anchors, taps and method set. Its S5 repair (forgetting SG_WC_APP on OTHER / COPY) and its S6 repair (lock onDead) run unchanged under the simulated wallets.
- Receipt validation (C) and the chain revision (A) needed no build change. The simulated receipts were already valid: right hash, block at or after the send block, 32-byte blockHash, "0x0"/"0x1", from/to.

## 2. Build command
    node tools/stormglass/staging/build.js --candidate <sha>     # index.html -> test-wallet.html, stamped <sha>; refuses unless <sha>:index.html is byte-identical
    node tools/stormglass/staging/build.js --check               # exit 1 unless test-wallet.html == a fresh build (reuses the stamped commit)
    node tools/stormglass/staging/build.js --patches ...         # also prints the patch list as JSON (the diff summary below)
New fail-loud check: the runtime reads some page globals by name. The build now stops if any is missing in its expected shape: `const CFG`, `const ABI`, `const TRACK={rpcs:[…],…poll,lost,stop}`, `let trackAt=0`, the `(trackAt+i)%n` reader order, and `function tick(`.

## 3. Staging vs production: the complete difference list
Source patches (from `--patches`; st22 undoes exactly these and gets index.html byte for byte):
1. Every `window.ethereum` read becomes `__SG.eth()` (provider tap). Anchor `window.ethereum`, matched 9× (5 in code, 4 in comments), −45 chars.
2. EIP-6963 listener: `const d=e&&e.detail;` → `const d=__SG.detail(e&&e.detail);` (provider tap). 1×, +13 chars.
3. `_wcGlobal` → `()=>__SG.wcNS(globalThis['@walletconnect/ethereum-provider'])` (provider tap). 1×, +11 chars.
4. After `<head><meta charset="utf-8">`: the generated-file comment, `<meta name="robots" content="noindex,nofollow">`, and the inline staging runtime (stage.js + policy.js). 1×, +76751 chars. This is the first script, so it runs before every page script.
5. `<title>` → `TEST BUILD · STORMGLASS staging (not the live site)`. 1×, +27 chars.
6. Before `</head>`: the staging `<style>` (stage.css). 1×, +6846 chars.
7. After `<body>`: `<div id="sg-banner">`. 1×, +77 chars.

Nothing else differs. st22 removes exactly these 7 changes from test-wallet.html and gets 24cda89's index.html byte for byte.

Runtime-only (no source change):
- `window.fetch` is wrapped. Every cross-origin JSON-RPC POST is answered in the page by the simulated chain. A JSON-RPC write or sign to any host is refused. In REAL mode, WalletConnect's own hosts pass.
- SIMULATION: `localStorage` is a per-tab copy (sessionStorage `sgsim:`). Cross-origin navigations (wallet deep links) are held through the Navigation API and written in full to the LOG.
- **New, staging only: the FAST tracking clock.** When chosen, it sets three numbers of the page's own `TRACK` object: poll 3000→1500 ms, lost 600000→20000 ms, stop 3600000→45000 ms. trackTx reads them every round, so it is the same code with shorter deadlines. NORMAL (the default) restores the page's values. A red FAST CLOCK chip shows in the banner while it is on.
- **New: the simulated readers' receipt answers** (CONTROLS · TRACKING, default VALID). Only the simulated chain's answers change.
- The runtime reads, never writes, `trackAt` (to know which reader the page asks first) and `CFG.rpc`.

## 4. What is simulated and what is real, per mode
| | SIMULATION (default) | REAL WALLET — CONNECTION TEST |
|---|---|---|
| Wallets | Simulated EIP-1193 wallets (EIP-6963, window.ethereum, providers[], a simulated WalletConnect phone wallet). The visitor's wallets are invisible. | The visitor's real wallets, each wrapped at the provider boundary before the page receives it. |
| Connect, switch, disconnect | Simulated, with controls. | Real. eth_requestAccounts and wallet_switchEthereumChain only after ASK MY WALLET. |
| Transactions, signatures | The simulated wallet's confirmation screen; every outcome can be chosen. | Never forwarded. The intercept panel shows chain, wallet chain, sender, target, value, decoded action and args, gas, and "SUBMISSION INTERCEPTED: nothing was sent to your wallet". It also states that this checks the page, not the wallet's own payment screen, and that nothing reaches a WalletConnect relay as a payment. |
| Sale, blocks, receipts | The simulated chain in the page. | The same simulated chain. |
| Tracking | The page's trackTx on the simulated readers; receipt answers and the FAST clock are selectable. | The same, for intercepted transactions. |
| Network contact | None. | The wallet extension; on phones, the WalletConnect relay (pairing, account and network changes only). No JSON-RPC to Ethereum nodes. |

## 5. The allowlist (REAL mode; default-deny at the wrapper's `request`)
Re-enumerated on 30cf5d8: by the build's literal audit, by st21's own enumeration (every literal classified, FORWARD ∩ (TX ∪ SIGN ∪ LOCAL) = ∅), and by the mock wallet logs of st7, st8, st14, st15 and st21.
- Forwarded: eth_accounts, eth_requestAccounts (gated), eth_chainId, wallet_switchEthereumChain (gated), wallet_revokePermissions, eth_blockNumber, eth_call, eth_getBlockByNumber, eth_getLogs, eth_getTransactionReceipt, eth_getTransactionByHash (a simulated hash is answered locally).
- Answered by staging, not forwarded: eth_estimateGas.
- Intercepted, never forwarded: eth_sendTransaction, wallet_sendTransaction, wallet_sendCalls, eth_sendRawTransaction, eth_signTransaction, eth_sendUserOperation, wallet_grantPermissions, eth_sign, personal_sign, eth_signTypedData (v1, v3, v4).
- Everything else: refused with 4200, not forwarded. wallet_addEthereumChain is only in WC_NEEDS and is never sent.
- Not a method: the WalletConnect wrapper exposes `session` as a frozen copy (topic, and the peer's name, url and redirect strings). The raw provider's request, send, sendAsync, signer.request and signer.client.request refuse writes and signatures (the belt).

## 6. How to trigger each scenario (click by click)
Open https://dithervoid.art/test-wallet.html (SIMULATION by default). CONTROLS (banner) → SCENARIOS (audit 4). Each card has a SET UP button, the steps and the expected result.
1. **Network changes at the last moment.**
   - CONTROLS → card 1 → TO BASE AND BACK (or TO BASE) → SET UP → CLOSE.
   - CONNECT → SIM ALPHA · 1 → COLLECT → pick a candidate → COLLECT.
   - The simulated wallet answers the final check's eth_chainId "0x1". Once that answer is out, and before it answers eth_accounts, it announces chainChanged 0x2105 (then 0x1).
   - Seen: "[!!] NOT COLLECTED · Your wallet changed network while this was waiting. Nothing was sent." and the same toast. With TO BASE the header also shows [!] NOT MAINNET.
   - The card's status line reads "last change fired; eth_sendTransaction since: 0". LOG: `chainChanged · LAST-MOMENT NETWORK CHANGE … ["0x2105","0x1"]`, and no eth_sendTransaction.
   - WITNESS works the same way. The arming is one shot; a per-wallet switch "last-moment network change" sits in SIMULATED WALLETS.
2. **Normal collect with the intended switch.**
   - Card 2 → SET UP (SIM ALPHA goes to Base, SWITCH: ACCEPT) → CONNECT → SIM ALPHA · 1 (the label shows [!] NOT MAINNET).
   - COLLECT → pick → COLLECT. The dialog says "[!!] YOUR WALLET IS ON ANOTHER NETWORK".
   - SWITCH TO ETHEREUM: the wallet accepts, and the simulated wallet screen opens with INTENDED CHAIN and WALLET IS ON both "1 · Ethereum mainnet".
   - CONFIRMED gives [OK] DAY 13 IS YOURS. LOG: one wallet_switchEthereumChain, then one eth_sendTransaction with chainId 0x1.
3. **Old WalletConnect event during a new prompt.**
   - Needs a phone, or a tablet or phone user agent: the CONFIRM sheet exists only there. The default wallet set on a phone is the simulated WalletConnect.
   - Card 3 → pick AN EARLIER REQUEST'S EVENT, OLD SESSION TOPIC, FOREIGN SESSION, NO EVENT or ONLY THE CORRECT EVENT → SET UP. On a computer, SET UP reloads with the phone WalletConnect set.
   - CONNECT → ZERION. The jump is held and logged. APPROVE PAIRING.
   - WITNESS (or COLLECT). The page's "CONFIRM IN ZERION" sheet opens, and the simulated phone emits the chosen event while it is open. EARLIER and FOREIGN are followed by the request's own event 1.5 s later. "emit now" buttons send more events while the sheet is open.
   - Tap OPEN ZERION. The jump is held, and LOG shows the exact link under "open link"; it is also in the yellow note. The simulated wallet screen appears only then (or after 12 s), as the wallet app would.
   - Expect EARLIER and FOREIGN: `https://link.zerion.io/wc?requestId=<this request's id>&sessionTopic=<this session>`, within about 1.5 s.
   - Expect OLD SESSION TOPIC and NO EVENT: `https://link.zerion.io/wc` only, after 8 s, with "No word yet that the request reached ZERION…".
   - Expect, always: never the earlier or foreign id or topic.
4. **Receipts.** Card 4 → choose one of these → SET UP:
   - VALID;
   - FIRST READER: WRONG HASH / NO STATUS / BAD BLOCK, then a valid fallback;
   - ALL READERS INVALID. This one also turns the FAST CLOCK on.

   Then CONNECT, COLLECT or WITNESS, and choose CONFIRMED (or REVERTED).
   - VALID / FIRST READER: the chosen result. LOG shows, for example, `reader ethereum-rpc.publicnode.com · answered a MALFORMED receipt (transactionHash is another transaction's)`, then `reader rpc.mevblocker.io · answered the VALID receipt (status 0x1)`. The first reader is whichever reader the page asks first in that round, read live from `trackAt`.
   - ALL INVALID: PENDING. At about 20 s "[??] RESULT UNKNOWN · … cannot confirm the result yet". At about 45 s the final unknown toast, and the polling stops. It is never confirmed or reverted. In REAL mode, card 1 is this scenario, for intercepted payments.
   - TRANSACTIONS AND TRACKING → tracking clock NORMAL restores the page's deadlines.
5. **Existing outcomes (unchanged).** All are still there:
   - The wallet screen's CONFIRMED, REVERTED, REJECTED, SPED UP, CANCELLED, REPLACED, UNKNOWN, PENDING · DECIDE LATER (in-flight list, late receipt) and WALLET ERROR.
   - The mining delay, reader latency and first reader DOWN controls; the day rollover (SALE · NEXT DAY); NEXT ACCOUNT and WALLET DISCONNECTS.
   - Repeated clicks: the page stays usable behind the wallet panel. Dialog close and reopen.

REAL WALLET (MODE → RELOAD IN REAL-WALLET MODE) remains a separate connection test.

## 7. Tests (tools/stormglass/staging/staging.test.js)
Command: `PORT=8952 SCRIPT=../staging/staging.test.js bash tools/stormglass/wallet-tests/run.sh` (CASES, OUT, LABEL, STAGING_PAGE as before).
st1-st15: unchanged (audit 3). New:
| id | what it proves |
|---|---|
| st16 | Scenario 1 from the drawer buttons. COLLECT (to Base and back) and WITNESS (to Base) stop with "Your wallet changed network while this was waiting. Nothing was sent." Each change fires once, after the gas estimate; the wallet log has 0 eth_sendTransaction and no transaction is created. |
| st17 | Scenario 2 from the drawer. On Base, COLLECT shows the wrong-network view, then SWITCH TO ETHEREUM; the wallet screen is on mainnet; CONFIRMED gives IS YOURS. Exactly one switch before exactly one send, with chainId 0x1. |
| st18 | Scenario 3 from the drawer (390x844, iPhone UA, simulated WalletConnect). Pairing goes through ZERION, and the held pairing link is logged. Three requests: (1) an earlier request's event and then its own event: OPEN = this request's requestId and sessionTopic; (2) no own event, with the first request's real event and a foreign one emitted by hand: generic /wc after more than 5 s, "No word yet"; (3) the old session topic: generic /wc after more than 5 s. None contains an earlier id or a foreign or old topic. |
| st19 | Scenario 4 from the drawer. VALID confirms. With FIRST READER wrong hash, no status or bad block, the first answer is MALFORMED and a different reader's VALID answer decides: confirmed, and reverted when the chain says so. No opposite verdict. |
| st20 | Scenario 4 ALL INVALID + FAST CLOCK, from the drawer. TRACK goes 3000/600000/3600000 → 1500/20000/45000 and the banner chip shows. PENDING, then unknown at 17-32 s, then the second "cannot confirm" at 42-70 s; receipt polling stops after that. All three readers answered only malformed receipts. Never confirmed, reverted, IS YOURS or NOT COLLECTED. NORMAL restores the values and hides the chip. |
| st21 | REAL mode. Every method literal in index.html is classified, with no overlap between forwarded and write/sign. A malformed first reader then a valid one confirms an intercepted COLLECT. The external mock wallet received only allowlisted methods. The WalletConnect wrapper's `session` is a frozen copy: no extra fields, not the raw object, not writable. |
| st22 | Undoing exactly the documented patches of test-wallet.html gives index.html byte for byte. The undo counts are 1 each, and window.ethereum ×N equals the count in index.html. The build's `--patches` lists the same 7 patches. |

Already covered and unchanged:
- real mode never forwards a write or sign (st8, st9, st14, st15);
- a mode switch leaves no provider, account, lock or transaction (st10);
- banner, revision, stamp, noindex and title (st1);
- index.html byte-identical to its commit and free of staging marks (st1, st11);
- the build refuses changed shapes (st13).

### Results
- **Final: staging suite on 4b5bd52 (page = build of 24cda89): 22/22 PASS, rc 0.** Log: ev/staging/staging-final-24cda89.log; results: results-staging-final-24cda89.json. 0 outside requests and 0 sockets were refused in every case. st20 took 59.8 s; the full run takes about 4.5 min.
- **The scenarios reach the repaired production code.** The same cases ran on a staging build of the unrepaired production page 0cd4ea4 (ev/staging/scenarios-on-base-0cd4ea4.log): **0/4**.
  - st16: eth_sendTransaction reached the wallet after the event.
  - st18: OPEN carried the earlier event's requestId.
  - st19: a malformed receipt decided the outcome.
  - st20: a wrong-hash receipt gave "[OK] DAY 13 IS YOURS".
- **Mutations on 24cda89** (temporary, reverted, mutant pages deleted):
  - The wrapper forwards everything: st8, st9 and st21 FAIL (mut-forward-all-24cda89.log). st9 shows `reached:["L eth_sendTransaction","A eth_sen…`.
  - The build drops the EIP-6963 tap: st1, st8, st9, st10 and st21 FAIL (mut-no-6963-tap-24cda89.log). st9 shows `rawLeak:true` and `reached:["L eth_sendTransaction"]`.
  - The same two mutations on 30cf5d8: same failures (mut-forward-all.log, mut-no-6963-tap.log).
- **Earlier runs:**
  - st1-st15 as they were on 30cf5d8: 15/15 (verify-30cf5d8.log).
  - 22/22 on the staging WIP (staging-wip3.log, staging-4225da8.log).
  - Before the merge, 18/18 applicable cases on a preview build of 24cda89 (preview-wallet4-24cda89.log).
- `build.js --check` on 4b5bd52: STAGING CHECK OK (git 24cda89, sha256 703602f1…50c5). `--candidate 0cd4ea4` against this index.html is refused.
- The production suite was not rerun here. 161/161 at 24cda89 is the review's run; index.html at 4b5bd52 is byte-identical to 24cda89's.

### The page
- test-wallet.html at 4b5bd52: **sha256 6bf01c65830a7760e3b1709fd3ed5c60d8062bb8c80490440a2942f737953cfb**, 317720 bytes. Stamp: rev 24cda89, touched 8bf8881, source sha256 703602f19f0e9fdb3edf46e1cf5e17af5bd1e69d38a9d2a2caf62dad10fe50c5.
- **Self-contained.**
  - `git diff --name-status 24cda89 HEAD` lists A test-wallet.html and M for five files in tools/stormglass/staging/. No other file changed, and there is no new runtime asset: the runtime and CSS are inlined.
  - Compared with index.html, the page references exactly the same src/href and asset paths and hosts. It adds only two inert strings: the SVG namespace inside the simulated wallets' data-URI icons, and `https://sim.staging.invalid`, the simulated phone wallet's metadata URL, which is never fetched.
  - index.html has no link to the page, and the page carries `noindex,nofollow`.

### Branch (audit/wallet-4-staging, not pushed)
- a3caba5: the staging build (controls, simulated WalletConnect, session copy, patch list, runtime-read audit).
- 053a9d4: the tests st16-st22, and shots.js.
- f59a31c: merge of audit/wallet-4 at 24cda89.
- 4b5bd52: test-wallet.html, the build of 24cda89.

The WIP chain is kept as the local branch backup/a4-staging-wip (ae131ca).

## 8. Screenshots (ev/staging/shots/, probe.json)
65 PNGs plus probe.json, from `PORT=8955 SCRIPT=../staging/shots.js SHOTS=… bash tools/stormglass/wallet-tests/run.sh` on 4b5bd52 (log ev/staging/shots-24cda89.log).
- **Probes, all 65:**
  - no horizontal page scroll;
  - every panel and the drawer inside the viewport;
  - no sideways scroll inside the drawer;
  - no banner child clipped (new probe; it caught the FAST CLOCK chip at 390 in the previous round, and is clean now);
  - 0 page errors;
  - 0 outside requests or sockets refused.
- **Law-8, default state:** `banner_sim_{1440x900,1366x768,1280x800,1024x768,768x1024,390x844}`.
- **Audit 3 set, re-shot:** mode chooser, controls, wallet screen, pending, failed, unknown, real gate, real intercept (now with the relay sentence), real confirmed.
- **New, at 1440x900 and 390x844:**
  - `a4_controls_scenarios_*`, `a4_controls_scenarios_receipts_*`: the SCENARIOS cards.
  - `a4_s1_collect_stopped_*`: [!!] NOT COLLECTED · "Your wallet changed network while this was waiting. Nothing was sent."
  - `a4_s1_log_no_send_*`: the LAST-MOMENT event, with no eth_sendTransaction.
  - `a4_s2_wrong_network_*`, `a4_s2_wallet_screen_after_switch_*` (both chains mainnet), `a4_s2_confirmed_*`.
  - `a4_s3_pairing_*` (iPad UA at 1440, iPhone at 390).
  - `a4_s3_confirm_sheet_old_topic_event_*`: CONFIRM IN ZERION with OPEN disabled.
  - `a4_s3_after_8s_generic_*`: "No word yet…", OPEN enabled.
  - `a4_s3_log_held_link_*`: `open link · HELD · https://link.zerion.io/wc`, the old-topic event, then the simulated wallet screen opened by the OPEN tap.
  - `a4_s4_first_malformed_then_valid_log_*`: publicnode MALFORMED, then mevblocker VALID.
  - `a4_s4_all_invalid_{pending,cannot_confirm,final,log}_*`: PENDING; [??] RESULT UNKNOWN after about 21 s; the final unknown at 48 s; only MALFORMED answers from all three readers. The FAST CLOCK chip is on the banner's second line at 390.
  - `a4_controls_real_scenarios_*`: the receipts card in REAL mode.
- **What I judged on the images:**
  - At 390, the phone wallet screen no longer covers the page's CONFIRM sheet: it opens after OPEN, as the app would.
  - At 390 the receipt buttons wrap inside the drawer (in the previous round they were cut off).
  - Simulation reads amber and REAL reads red; FAST CLOCK reads red in both.
  - The page's own dialogs and toasts are unchanged.

## 9. Limitations
- **The real wallet's own payment screen and real WalletConnect relay delivery of a payment are never exercised.** Payments and signatures stop at the wrapper; that is the point. The intercept panel says so. Scenario 3 exists only in SIMULATION.
- **FAST CLOCK changes three page numbers at run time** (staging only, visible in the banner and in CONTROLS). It is per tab (sessionStorage), and switching MODE resets it to NORMAL.
- **The receipt scenarios change what the simulated readers answer.** Real readers' failure modes beyond the three malformations (wrong hash, no status, a block before the send) are not modelled here; the production suite's a4r* cases cover more.
- **The last-moment network change is modelled at one instant**: after the final check's chainId answer, before its eth_accounts answer. That is where repair A must hold (a4c4's model). The microtask sweep is in the production suite (a4c1/a4c2), not here.
- **Held deep links need the Navigation API.** It is present in current Chromium, Safari and Firefox. Where it is missing, a tap on OPEN or an app button leaves the page.
- **Shared origin with the live site.** A REAL-mode WalletConnect session shares the live page's storage, as two tabs of dithervoid.art would. SIMULATION uses its own per-tab copy.
- **Simplified simulated contract** (as in audit 3).
- **No real wallet, RPC or relay was contacted.** Every page request outside 127.0.0.1 was refused by the harness, with 0 refused in every run. The proxy reported failed connections to mtalk.google.com:5228 during the shot runs. These come from Chromium's own background service (GCM), not from a page; they were refused and nothing went through.
