# STAGING REPORT: test-wallet.html, derived from the final candidate index.html (d9ab802)

- Worktree: /home/claude/wt-a3-staging, branch audit/wallet-3-staging. It merges audit/wallet-3 at d9ab802. Not pushed.
- index.html is not edited by anything here. It is d9ab802's index.html, sha256 3c5992e2cc5a794fc7b0475fab2d7d04ef3c7f82bffde35697ba6f8bc69b12ea.
- Evidence: /home/claude/audit3/ev/staging/.

## History (final, WIP squashed; a backup of the WIP chain is the local branch backup/staging-wip-ceb0a7a)
- cfafb3f: staging build. tools/stormglass/staging (build.js, policy.js, stage.js, stage.css) derives test-wallet.html from index.html.
- 96d3393: staging tests st1-st15 and shots.js.
- b4221af: merge of audit/wallet-3 (d9ab802, the final candidate).
- 4f49e49: `--candidate` stamping. It stamps the candidate commit, and the build verifies that this commit's index.html is byte-identical to the source. `--check` reuses the stamped commit.
- 144dea9: test-wallet.html, the build of index.html at d9ab802.

## Build

    node tools/stormglass/staging/build.js --candidate d9ab802   # index.html -> test-wallet.html, stamped d9ab802
    node tools/stormglass/staging/build.js --check               # exit 1 unless test-wallet.html == a fresh build (reuses the stamped commit)
    node tools/stormglass/staging/build.js --src X --out Y       # any other candidate file
    (without --candidate the stamp is the last commit that touched index.html: cda8599 here, same bytes as d9ab802)

The stamp carries:
- `rev`: d9ab802.
- `touched`: cda8599, the last commit that changed index.html.
- `sha256`: 3c5992e2….

The banner shows `candidate d9ab802 · sha256 3c5992e2cc5a`; the full values are in its tooltip and in a generated-file comment in `<head>`.

Nothing time-based is written, so the build is reproducible. `--check` passes on 144dea9.

Law 17 and fail-loud:
- Every patch is an anchored replacement that must match exactly once.
- Every wallet/RPC method literal in index.html must be classified in policy.js.
- Any provider read other than the tapped `window.ethereum` stops the build.
- `eip6963:announceProvider` and `@walletconnect/ethereum-provider` must each appear exactly once.
- Every inline script must still compile.
- The output is written to a .tmp file and renamed.
- index.html is only read, and its hash is checked before and after the build.

## Self-contained: publishing touches no file the live site uses
- `git diff --stat d9ab802 HEAD` lists only new files: test-wallet.html and tools/stormglass/staging/* (7 files, 3208 insertions). No existing file changed.
- The staging runtime and CSS are inlined into test-wallet.html. There is no /staging-wallet/ directory and no new runtime asset.
- The set of src/href and absolute asset paths in test-wallet.html is identical to index.html's (diff empty both ways). It loads only what the live page loads: ethers 6.13.2 from cdnjs, /glass/index.html, /plates/*.gif, /icon.png, and /wc.js (real-wallet mode on phones only).
- The runtime itself fetches nothing.
- Publishing test-wallet.html adds one URL (/test-wallet.html). index.html has no link to it (st11), and it carries `noindex,nofollow`.

## Exact staging vs production differences (the build's patches)
1. After `<head><meta charset="utf-8">`: a generated-file comment, `<meta name="robots" content="noindex,nofollow">`, and the inline staging runtime `<script>`. This is the first script of the page, so it runs before every page script.
2. `<title>` becomes `TEST BUILD · STORMGLASS staging (not the live site)`.
3. A `<style>` block (stage.css) is added before `</head>`. The banner adds its height to `--head`, so the page's `100vh - var(--head)` rules still fit one viewport. The probes show no horizontal scroll at any law-8 size.
4. `<div id="sg-banner">` is added after `<body>`.
5. Every `window.ethereum` becomes `__SG.eth()`. There are 9: 5 in code (walletList, inWalletApp, walletChoices, connectOnce ×2) and 4 in comments.
6. In the EIP-6963 listener, `const d=e&&e.detail;` becomes `const d=__SG.detail(e&&e.detail);`.
7. `_wcGlobal` becomes `()=>__SG.wcNS(globalThis['@walletconnect/ethereum-provider'])`.

Runtime-only (no source change):
- `window.fetch` is wrapped. Every cross-origin JSON-RPC POST is answered in the page by the simulated chain, and a JSON-RPC write or sign to any host is refused. In real mode, WalletConnect's own hosts pass through.
- In SIMULATION, `localStorage` is a per-tab copy (sessionStorage, prefix `sgsim:`), so simulated choices never reach the live site's storage on the same origin.
- In SIMULATION, cross-origin navigations (wallet-app deep links) are held where the Navigation API exists.

Everything else is index.html byte for byte. That includes discovery, the picker, connect, opLock/opBegin/opCheck, OpSigner, send(), trackRpc/trackTx, every dialog and every text. index.html contains none of the staging marks (checked by build.js and by st11).

## Modes
- Default: SIMULATION. Mode is stored per tab (sessionStorage `sg.staging.mode`, or `?sgmode=sim|real`).
- MODE in the banner opens a chooser that explains both modes. Switching reloads with `location.replace`, so no provider reference, account, operation lock or pending operation crosses modes. The simulated storage and settings are cleared (st10).
- CONTROLS opens the staging drawer. It lists what is real and what is simulated, the sale state, the simulated wallets (simulation) or the allowlist (real), transaction settings with the in-flight list, and the log of every wallet request with its route.

| | SIMULATION (default) | REAL WALLET — CONNECTION TEST |
|---|---|---|
| Wallets | Simulated EIP-1193 providers announced over EIP-6963. The visitor's real wallets are invisible to the page (detail filter, `eth()`, and a simulated WalletConnect namespace, so /wc.js never loads). Wallet sets, which reload the page: 4 extensions (two named SIM ALPHA, one on Base, one asleep that never answers); 1 extension; old-style window.ethereum + providers[]; no wallet; phone in-app browser; phone WalletConnect (pairing approved on a panel). | The visitor's real wallets: EIP-6963 (also late announcements), window.ethereum, providers[], and on phones the real WalletConnect (/wc.js, relay). Every provider is wrapped before the page receives it, memoised per raw object so the page's "same object = same wallet" rule holds. |
| Connect, account, network, disconnect | Simulated, with controls: Mainnet/Base, switch accept/refuse, connect approve/refuse, next account, the wallet disconnects (or the phone ends the session), answer delay in ms. | Real. eth_requestAccounts, wallet_switchEthereumChain and WalletConnect pairing (enable) reach the wallet only after the visitor presses ASK MY WALLET on a staging panel. The panel says what the wallet will ask and that no payment or signature can be sent (st7, st14, st15). |
| Transactions | The simulated wallet's confirmation panel, the same panel as real mode: CONFIRMED, REVERTED, REJECTED IN WALLET, SPED UP, CANCELLED, REPLACED BY ANOTHER CALL, UNKNOWN, PENDING (decide later in CONTROLS, including a late receipt after UNKNOWN), WALLET ERROR. It can also answer automatically. The page stays usable behind the panel, as behind a wallet window, so races can be tried. | Never forwarded. The intercept panel shows intended chain, the chain the wallet is on (an eth_chainId to the wallet), sender, target (marked if it is the STORMGLASS contract), value in ETH, the action decoded with the page's own ABI, and gas limit. It states "SUBMISSION INTERCEPTED: nothing was sent to your wallet" and "This checks how the page prepares a transaction and what it shows next, not your wallet's own payment screen". The visitor then picks the same simulated results. |
| Signatures and other write methods | Shown and refused. | Shown and refused, never forwarded. Every other method is refused with 4200. |
| Sale, plates, blocks, receipts | The simulated chain in the page. Sale: OPEN / SOLD / SOLD + CLOSED / CLOSED UNSOLD / NEXT DAY (rollover) and hours since open. A simulated sky is used. Past plates use the seeds of this repo's /plates/*.gif, so the real prints show. A confirmed buy, witness, claim, withdraw or bid changes the state (the plate sold to you, seats, earnings). | The same simulated chain. The sale stays simulated: its price, day and your seats/earnings are not your mainnet state. |
| Tracking | The page's own trackTx (receipts, nonce, bounded block scan, replacement classification) on the simulated readers. Controls: mining delay, reader latency, "first reader (publicnode) down" (503). | The same, for intercepted transactions. |
| Real network contact | None: in st1, 0 outside requests, 0 sockets, 0 fake-RPC hits. Only this site's static files. | The wallet extension; on phones, the WalletConnect relay. No JSON-RPC to Ethereum nodes. |

## The allowlist (real mode; default-deny; tools/stormglass/staging/policy.js)
The list was checked against what the page calls: the build's method audit, plus the wallet request logs in st7, st8, st14 and st15, which only ever show eth_chainId, eth_requestAccounts, eth_accounts, wallet_revokePermissions and wallet_switchEthereumChain.

Forwarded:

| Method | Why the page needs it |
|---|---|
| eth_accounts | opCheck's last look, onAccounts after an empty list, ethers getSigner |
| eth_requestAccounts | CONNECT (gated) |
| eth_chainId | chainOf / alive() / nxWrong / walletReads / ethers network detection |
| wallet_switchEthereumChain | SWITCH TO ETHEREUM, opBegin (gated) |
| wallet_revokePermissions | DISCONNECT (EIP-2255) |
| eth_blockNumber, eth_call, eth_getBlockByNumber, eth_getLogs, eth_getTransactionReceipt | reads, only when the wallet becomes the read source (bindRead "wallet") |
| eth_getTransactionByHash | trackTx's nonce fallback; a simulated hash is answered locally |

Answered here, not forwarded: eth_estimateGas. The sale is simulated, so the real chain cannot estimate it. The panel's gas limit is the page's own padding of that answer (360000).

Intercepted and never forwarded: eth_sendTransaction; wallet_sendTransaction, wallet_sendCalls, eth_sendRawTransaction, eth_signTransaction, eth_sendUserOperation, wallet_grantPermissions; eth_sign, personal_sign, eth_signTypedData (all of v1, v3, v4). Anything else is refused with 4200.

Deliberately not allowed because the page never sends them: net_version, wallet_addEthereumChain (it appears only in the WC_NEEDS set), wallet_request/getPermissions, eth_getBalance, gas-price methods.

WalletConnect, defence in depth:
- The page only holds the wrapper. Its `signer` is a facade that exposes `client.on('session_request_sent')` only.
- The raw provider's own `request`/`send`/`sendAsync`, `signer.request` and `signer.client.request` are patched to refuse sends and signatures. In st9, `wcRawRequest` and `wcRawSign` are refused with 4001.

## Tests (tools/stormglass/staging/staging.test.js, st1-st15)
Command:

    PORT=8952 SCRIPT=../staging/staging.test.js bash tools/stormglass/wallet-tests/run.sh

Options: CASES, OUT and LABEL as in the wallet tests. STAGING_PAGE runs the cases on another build.

- It uses the wallet-tests harness boot(): a fresh context, service workers blocked, every WebSocket refused, outside hosts refused, public RPCs routed to the fake chain.
- In real mode, the harness mock wallet plays the visitor's wallet. Its `__MW.log` is what "reached the wallet".
- The exit rules are the same as wallet.test.js.

| id | what it proves |
|---|---|
| st1 | Boots in SIMULATION by default. Banner present. Revision = stamp, and the stamped commit's index.html is byte-identical to index.html. sha256 matches. noindex. TEST title. The mock (real) wallet is invisible. No request leaves the page. |
| st2 | Picker: the twins are told apart, the asleep wallet is left off. COLLECT shows the simulated wallet screen with buy(13,3). CONFIRMED is followed by the page's trackTx on the simulated readers. |
| st3 | Confirmed, sped up, reverted, cancelled, replaced, unknown, rejected and wallet error each give the production wording. Pending holds, then a late receipt confirms. |
| st4 | COLLECT dialog shows pending, NOT COLLECTED (reverted) and RESULT UNKNOWN. A second press while the wallet screen is open says so, and only one eth_sendTransaction is made. |
| st5 | Wallet on Base: a refused switch sends nothing; an accepted switch sends once on mainnet. |
| st6 | Account change, the wallet disconnecting, DISCONNECT (revocation) and day rollover all reach the page. |
| st7 | Real wallet: the gate comes before eth_requestAccounts; account change; DISCONNECT revokes; only allowlisted methods reach the wallet. |
| st8 | Real wallet: COLLECT, WITNESS, CLAIM, personal_sign, eth_signTypedData_v4, wallet_sendCalls, eth_sign and an unknown method never reach the wallet. The panel is right: chain 1, sender, target = contract, value 0.77 ETH, buy(arg0: 13, arg1: 3), witness(13) for 0.02 ETH, claim(). The chosen outcomes are tracked by the page. |
| st9 | A late-announced provider, window.ethereum, providers[] and a WalletConnect provider are all wrappers (none raw). Writes through each are refused, and the WalletConnect raw request paths refuse too. |
| st10 | A mode switch with a pending tx and a connection reloads clean (no EP, me, OPLOCK, txs or sim storage). The real wallet is asked nothing at boot. Back in simulation, the real wallet is invisible. |
| st11 | index.html is byte-identical before and after a build, has no staging mark or link, and is clean in git. The committed test-wallet.html equals a fresh build. `--check` OK. |
| st12 | Phone, simulated WalletConnect: pairing panel, a confirmed witness, the phone ends the session. /wc.js never loads, no sockets. |
| st13 | The build refuses a moved EIP-6963 anchor, an unclassified method, an untapped `globalThis['ethereum']`, and a doubled anchor. f9a6f80 and 553222a still build. |
| st14 | Real wallet on Base: the switch is gated. CANCEL asks the wallet nothing and sends nothing ("…another network… Nothing was sent."). ASK MY WALLET forwards the switch, then the witness is intercepted and confirmed. |
| st15 | Real wallet on a phone via WalletConnect (harness WC mock): pairing waits for the gate. COLLECT is intercepted (the phone wallet is never asked). DISCONNECT ends the session. |

### Results
- Staging suite on the final head 144dea9 (page = build of d9ab802): **15/15 PASS**. Log ev/staging/staging-144dea9.log, results ev/staging/results-staging-144dea9.json.
- Production suite against index.html (TARGET default, d9ab802's index.html) on 144dea9: **113/113 PASS**. Log ev/staging/prod-index-144dea9.log. The staging cases run separately, so the total is 113 + 15 = 128.
- The production suite was not run against test-wallet.html because it is not meaningful there. In SIMULATION its mock wallets are invisible by design; in real mode every send it expects is stopped by design. What the staging page adds is covered by st1-st15, and the unchanged production code is covered by the production suite on index.html.
- Earlier evidence:
  - 15/15 on the WIP head before the merge (staging-ceb0a7a.log).
  - 96/96 production on ae9eaab (prod-index.log).
  - The staging cases on a build of the matrix candidate cda8599, before the merge, 11/12 then 12/12 (staging-on-matrix-cda8599*.log). st4's one failure was the test's own wording: it required "still waiting for your wallet", and matrix D3 changed the busy text. Per law 14 the test was widened. One eth_sendTransaction remains the guard.
- Mutations (temporary, reverted; logs in ev/staging/):
  - The wrapper forwards every method: st8 and st9 FAIL (mut-forward-all.log).
  - The build drops the EIP-6963 tap: st1, st8, st9 and st10 FAIL (mut-no-6963-tap.log).

## Screenshots (ev/staging/shots/, probe.json; real glass and plate files; nothing outside 127.0.0.1)
31 PNGs plus probe.json, made by `PORT=8955 SCRIPT=../staging/shots.js SHOTS=… bash tools/stormglass/wallet-tests/run.sh` on 144dea9 (log ev/staging/shots.log).
- **Probes (all 31):** no horizontal page scroll; every staging panel and the drawer inside the viewport; 0 page errors; 0 outside requests or sockets refused. The banner is 30 px tall on desktop and 44 px (two lines) at 390.
- **Law-8 sizes, default state:** `banner_sim_{1440x900,1366x768,1280x800,1024x768,768x1024,390x844}`. Looked at: the striped amber TEST BUILD banner with SIMULATION, `candidate d9ab802 · sha256 3c5992e2cc5a`, CONTROLS and MODE. The page below is unchanged: the plate is square and contained, the sale panel and the sky rows read from the simulated sky.
- **At 1440x900 and 390x844 (all looked at):**
  - `mode_chooser_sim_*`: the two modes explained; changing reloads clean.
  - `controls_sim_*` and `controls_sim_with_txs_*`: what is real, the sale states, the simulated wallets with their controls, transactions with the in-flight list, the request log.
  - `sim_wallet_screen_collect_*`: the simulated wallet's confirmation panel, docked bottom-right on desktop and a bottom sheet on the phone; the COLLECT dialog stays visible.
  - `collect_pending_*`: PENDING · "Sent. Waiting for Ethereum to confirm." with the hash.
  - `collect_failed_*`: [!!] NOT COLLECTED · "It reached Ethereum but failed (reverted)…".
  - `collect_unknown_*`: [??] RESULT UNKNOWN · "…cannot confirm the result yet…".
  - `banner_real_*`: the red banner REAL WALLET — CONNECTION TEST (REAL WALLET TEST at 390) and the note on what the wallet will be asked.
  - `real_gate_connect_*`: "REAL WALLET · THIS WILL OPEN YOUR WALLET", ASK MY WALLET / CANCEL.
  - `real_intercept_collect_*`: "SUBMISSION INTERCEPTED: nothing was sent to your wallet", chain 1, sender 0x0dd3…, the STORMGLASS contract, 0.7746 ETH, buy(arg0: 13, arg1: 3), gas 360000, the nine result buttons.
  - `real_collect_confirmed_*`: [OK] DAY 13 IS YOURS, after which the page shows the day [SOLD] to that address.
  - `controls_real_*`: the allowlist as text.
- **390x844 only:** `sim_phone_walletconnect_pair_390x844`, the simulated phone wallet's pairing request over the page's CONNECT YOUR WALLET sheet.
- **What I judged on the images:** the banner never covers the page header or the art. The floating wallet panel leaves the dialog usable, and on the phone it is a scrollable sheet of at most 62% of the height. Simulation reads amber and real mode reads red throughout. Nothing overflows sideways.

## Limitations
- **The real wallet's own confirmation screen is never exercised.** That is the point of interception. Real mode validates discovery, connect, account and network changes, revocation, transaction preparation and what the page shows afterwards.
- **Real mode shows a simulated sale.** The price, day, seats and earnings are not the visitor's mainnet state. eth_estimateGas is answered by the staging layer, so a real wallet's estimate failures (for example insufficient funds) are not seen.
- **Etherscan links point at the real Etherscan.** In the pending, unknown and done views, the hash links open etherscan.io, where a simulated hash does not exist.
- **Shared origin with the live site.** test-wallet.html will be served from dithervoid.art. In real mode it shares that origin's storage with the live page: the remembered wallet (`stormglass.wallet`) and a WalletConnect session (localStorage/IndexedDB), exactly as two tabs of the live site would. A WalletConnect session paired in staging is the same session the live page would resume, and the reverse. SIMULATION uses its own per-tab copy of localStorage and never touches them.
- **WalletConnect gate and the 20 s timer.** The real-mode WalletConnect gate sits on `enable()`. While the visitor reads it, the page's own 20 s "WALLETCONNECT DID NOT ANSWER" timer keeps running.
- **Deep links in the simulated phone WalletConnect set.** A tap on a wallet-app deep link is held only where the Navigation API exists (Chromium; recent Safari). Elsewhere it leaves the page. The pairing itself is approved on the staging panel and needs no tap.
- **Real wallets were not driven here.** No real wallet, RPC or relay was contacted. Real WalletConnect over the relay and real extensions are only exercised when the owner uses the page. The tests use the harness mock wallet and WalletConnect mock as the "real" wallet.
- **Wrapping is at the page's three taps plus fetch.** Code outside index.html's scripts that reads `window.ethereum` would not be wrapped. The page's scripts have none: the build checks every spelling.
- **Simplified simulated contract.** Effects are applied for buy, witness, claim, withdraw and bid. Pledge, settle and sync have no effect. Contract rules (value too low, sale closed) are not enforced: the visitor chooses the outcome.
- **Screenshot coverage.** Law-8 sizes: the default banner state at all six sizes. The dialogs and panels at 1440x900 and 390x844 (the brief's minimum). The STANDBY/RENDERING/…/MINT-MODAL state matrix of law 8 belongs to the PANDORA box and does not apply.
