# STORMGLASS wallet: lifecycle coverage matrix (audit 3, Brief M)

Worktree /home/claude/wt-a3-matrix, branch audit/wallet-3-matrix. Line numbers are index.html at the matrix head (cda8599 and later; the page is unchanged after cda8599). Test files are in tools/stormglass/wallet-tests/.

I read each case body, not its title, to decide what it covers. **u-cases** are new (audit3b.test.js, group @audit3b).
- **REG**: a regression for a defect found while building this matrix. It fails on f9a6f80 and on ae9eaab.
- **GUARD**: holds behaviour the page already has. It passes on both pages, and the single-edit mutant named in its row fails it.

Case groups:
- @orig: a1-n6, w1, w3, m9 (wallet.test.js).
- @audit2: q, r, k3-k6, m4, m5, h6-h9, p, v, c1, c2.
- @audit3: x, y, z.

## 1. Provider discovery and selection
| Item | Covered by | Notes / evidence |
|---|---|---|
| EIP-6963 announcements | h1, h4, h5, h6, h7, u15 | Listener at 807; list built in walletChoices 905. |
| window.ethereum | h2, h9, u7, u16 | 911-912 |
| providers[] | h3, h8, h9 | 912 |
| Repeated announcements of the same object | h3, h8 | Deduplicated by object identity (807, 907 `seen`). |
| Distinct providers sharing name/rdns/metadata | h6 (shared rdns, first dead), h7 (shared rdns+name: both listed, told apart as "· 1/· 2") | 931 label; metadata never selects a provider. |
| Dead provider | h4 (never answers), h6 | `alive` 902: 1.5 s cut. |
| Delayed provider | u15 (probe answers in 0.9 s: listed) | GUARD. Mutant: cut 1.5 s -> 0.5 s, killed (mut-u15.log). |
| Malformed provider | h5 (malformed eth_chainId: left off) | |
| Provider that throws synchronously | h4 (eth_chainId), k1 (revoke) | `ask` 803 turns a sync throw into a rejection. |
| Late announcements | u15 (announces 1.5 s after load: listed, chosen, only it asked) | GUARD. New mock option `announceAfter` (mockwallet.js, additive). A wallet that announces more than 60 ms after the CONNECT click is missed for that click (chooseWallet 917) and listed on the next one. |
| Remembered choice after reload | i1 | |
| Remembered choice, changed announcement order | u7 (order B,A, window.ethereum = A, saved test.b: B asked directly, A never asked) | GUARD. Key match (rdns), 922. |
| Ambiguous remembered choice | h7 (shared rdns), h9 (legacy name collision) | 922: two hits means the list is shown. |
| Rejection never silently authorizes another wallet | i2 (desktop 4001), u8 (desktop -32603: no other wallet), u16 (phone in-app 4001, the other provider already authorized: never asked) | GUARD u8, u16. Mutants: desktop taking the phone loop (mut-u8), phone loop ignoring 4001 (mut-u16), both killed. **By design:** on the phone path (999-1001), a non-refusal error moves on to the next provider. The comment at 794 says this covers two extensions fighting over window.ethereum. **D1** also covered a stale attempt deciding anything (see §2). |
| Mobile fallback selects the intended provider | m2 (MetaMask in-app: window.ethereum), m1 (Safari: WalletConnect sheet, no injected wallet asked), u16 | The "USE THIS BROWSER'S WALLET" choice (889, 1003) asks walletList()[0] = window.ethereum first. |
| Metadata rendered safely | u4 (name with `<img onerror>` and `<b>`: text only, no element; icons `javascript:` and `https:` dropped, only data:image used; connected sheet note is text) | GUARD. sheet() 838 uses textContent and `/^data:image\//`. Mutant (innerHTML + any icon) killed. |
| Metadata not treated as authenticated identity | h6, h7, h9 | Selection is by provider object; rdns is only a remembered hint (921-922). |

## 2. Sessions and accounts
| Item | Covered by | Notes |
|---|---|---|
| Account change with event | j1, e, p3, r9 | |
| Account change without event | v2 (last look reads eth_accounts) | opCheck 1093 |
| Empty account list | j1 | onAccounts 971 asks eth_accounts first (1.5 s cap). |
| Malformed account list | u14 (`['0xnot-an-address']`, `null`: session kept while eth_accounts still lists it) | GUARD. Mutant (skip the eth_accounts check) killed. |
| Revoked account list | j1, k2, k3 | |
| Change during connection | p4 (day change), q2 | connectOnce `stale()` 991-1015 |
| Change during switching | a1/z1 (refusal); opBegin opLive after the switch 1086-1088 | |
| Change during estimation | e, p3 | |
| Change during final validation | v1, v2, **u11** | REG **D4** |
| Events from an old provider after selecting another | j2 | follow 966 `P!==EP` |
| Late connection response after a newer attempt | **u1** | REG **D1** |
| Switching away and back to the same address | u14 (A->B->A while a write waits: stopped, nothing sent; the next press pays from A) | GUARD. The session number, not the address, decides (opLive 1081). |
| Provider+account identity attached to the operation | c, e, v3 (request carries the captured `from`), u14 | opBegin 1082 captures {gen,P,acct,chain}. |
| Stale reads cannot restore a disconnected session | d, g | |
| Stale reads cannot overwrite current-account data | x6 (refreshSeats), x7 (welcome image), x5 (done-view seats) | |

## 3. Chain validation and preparation
| Item | Covered by | Notes |
|---|---|---|
| Switch accepted | b, m2, m3, z4 | |
| Switch rejected | a1, a2, z1, z2 | |
| Unsupported (4902) | u6 | GUARD |
| Stalled | u3 (never answered before the hand-off) | REG **D3** (feedback). The lock is freed by DISCONNECT (942); the late answer sends nothing. |
| Falsely reported successful | u6 (switch answers null, chain unchanged: nothing estimated or sent; COLLECT stays on ANOTHER NETWORK) | GUARD. Mutant (trust the switch answer) killed. Observed, not changed: in COLLECT, a falsely-successful switch toasts nothing (switchChain 1052 toasts only on an error); the view stays on the wrong-network screen. |
| Chain change without events | v1 | |
| Chain change during account checks | v1 (opCheck reads both in parallel, then opLive) | |
| Chain change during gas estimation | f | |
| Correct provider, session, account, chain, target, value, calldata | w1 (witness(13), 0.05, chain 1), p1/p4/p5/z4 (buy(day, option)), n1-n5 (value), v3 (from, chainId), c (provider) | |
| Explicit chainId and from in the request | v3 | OpSigner 1099-1104 |
| No app-level await between final validation and invoking the provider | **u11** (sweep of 0..14 microtasks: k=2 sent from the old account before the fix) | REG **D4**. Fix 1106: `await opCheck(op); opLive(op);` then the synchronous `ask`. |
| Every write goes through the guarded path | Inspection: every contract write is `send(name, W=>pad(W.<fn>,…))`. witness 1349, bid 1368, settle 1369, pledge 1394, sync 1395 and 1409 (two renderings), buy 1428, claim 1727, withdraw 1728. `W` there is the operation's contract (op.C) from opBegin/OpSigner. No `eth_sendTransaction` other than OpSigner 1108. withdrawTo is in the ABI, never called. Tests: w1, a1 (witness, claim), n4 (pledge), n5 (bid), m3/z4 (buy) | No bypass found. settle, sync and withdraw have no case of their own: the path is the same function (send). |
| UI tells a stoppable request from one handed to the wallet | **u3** | REG **D3**. opLock 1065: handed -> "in your wallet now. Finish or cancel it there first."; not handed -> "nothing has been sent… DISCONNECT to stop it" (or "to connect" while connecting). Copy for the curator. |

## 4. Duplicate submissions and locks
| Item | Covered by | Notes |
|---|---|---|
| Repeated clicks | q1, i4 | q1/i4 are delay-based (harness report) |
| Concurrent different actions | q2 (WITNESS + COLLECT) | One lock for all writes (opLock 1065). |
| Several actions awaiting one connection | q2 | |
| Redraws/reopened dialogs while waiting | q3, p1, p2 | |
| Rejection | q4 | |
| Malformed responses | q6 (malformed hash) | |
| Exceptions | u13 (sync throw on eth_sendTransaction: uncertain, never "Nothing was sent", no retry; a deliberate press asks again) | GUARD. Mutant (code-less error treated as not sent) killed. |
| Disconnect before the hand-off | d, u3, u9 | |
| Disconnect after the hand-off | g, r9 | |
| Old operations cannot release newer locks | u9 | GUARD. Mutant (opFree without identity check) killed: a second eth_sendTransaction while the newer one was open. |
| Stalled operations have a clear safe recovery | u3 (stall before the hand-off: message + DISCONNECT), **u1** (stalled connection replaced: the lock is freed) | REG **D1**, **D3**. A stall after the hand-off (eth_sendTransaction never answered) keeps the lock on purpose (1063 comment): the wallet may still send it. The only recovery is a page reload, which is the visitor's own choice. |
| Recovery never auto-resubmits an uncertain tx | q5, q6, u13, r8 | |
| Deliberate later actions stay possible | q3, q4, u1, u3, u13 | |

## 5. Disconnect and revocation
| Item | Covered by |
|---|---|
| Revocation > 5 s | k3 |
| Never answers | k5 |
| Unsupported method | k1 (-32601), k4 |
| Synchronously throwing method | k1 |
| Independent outstanding revocations across providers | k6 |
| Late revocation cannot undo a new grant | k2, k3 |
| Cancelling a wait leaves coherent state | k5 |
| WalletConnect disconnect ends its session | m4 (provider.disconnect(), no relay revoke) |
| Wallet-initiated session end updates the page | j3 (EIP-1193 disconnect), m5 (WC phone ends) |
| Submitted txs stay tracked | g, m5, r9 |

## 6. Transaction tracking
The page follows a tx only on mainnet HTTP readers (TRACK 1122: timeout 8 s, poll 3 s, lost 10 min, stop 1 h, scan 24).

| Item | Covered by | Notes |
|---|---|---|
| Valid hash + confirmation | b, g, w1, m4 | |
| Reverted receipt | r4 | |
| Malformed hash | q6 | |
| Malformed RPC answers | y9 (null/garbage head), y4 (null block), y5 (RPC error), r2 (HTTP 500) | |
| Broadcast then ambiguous wallet error | q5, q6 | |
| Wallet silence after submission | r1 | |
| Private/delayed visibility | r8 (never seen, late receipt confirms), r1 | Nonce from the wallet when readers do not have the tx (1140), bounded by TRACK.timeout. |
| HTTP failures | r2 | |
| Hanging readers | r3 | |
| Inconsistent readers | y9, y10 | |
| Fallback | r2, r3, y10 | |
| Speed-up (same sender, nonce, target, calldata, value) | r5, y2 | |
| Cancellation | r6, y3 | |
| Replacement by another call | r7, y1 | |
| Dropped tx and late receipt | r8 | |
| Missing replacement receipts | y6 | |
| Missing block data | y4, y5, y10 | |
| Bounded request durations | r3 | |
| Bounded scan batches | y1-y3 | |
| Bounded tracking duration | y7 | |
| Reorg handling and confirmation policy | Documented, no case | **Policy:** the first receipt with a blockNumber from any reader decides (`mined` 1133). status 1 = confirmed, anything else = reverted. **1 confirmation**, no depth. The receipt is not checked against the asked hash, and is not re-checked later. A receipt that disappears after a reorg is not noticed: the page has already said "confirmed" and only refreshes the panel (tick). This is out of scope to change (UX and policy decision). |
| Uncertain outcomes never become "nothing was sent" | q5, q6, r8, u13 | |
| No automatic resend | q5, q6, u13 | |

## 7. Collection state, redraws, inputs
| Item | Covered by | Notes |
|---|---|---|
| Day rollover during connection | p4 | |
| Day rollover during estimation | p4/p5 (both ends) | The buy carries its own day (1428); the contract refuses an old day. |
| Day rollover during confirmation | p5, x3, c1 | |
| Sale closing / another buyer winning | r4, x1, x3 | soldTo 1489 |
| Choice changes during async work | p1, p2, x4 (option captured at the press: `k` 1499, passed to buy 1428) | |
| Close, reopen, back, next | p1, p2, x1, x2, z3 | |
| Old callbacks after a newer op | x4, x5, x6, z3 | |
| Amount captured at the user action | l1 (witness), n4/n5 (pledge, bid via amountOf at the press) | **By design for COLLECT:** the buy value is computed at the hand-off, `price(now+30 s) * 1.1` (1428). The contract refunds any excess (STORMGLASS.sol:347) and refuses less (:338). If a witness raised the price while connecting, the wallet shows the higher value for confirmation. Not changed (economics). |
| Exact wei and decimal comma | n1, n2, n6 | |
| Invalid/ambiguous/negative/zero/excess-precision/oversized inputs | n3, n4, n5, n6 (BAD list incl. `1e3`, 19 decimals, `-1`, `0`, `1,000.5`) | "Oversized" = any digit count is accepted as BigInt; the wallet/contract decide on balance. |
| Focus, selection, caret preserved across redraws | l1, l2, l3 | |
| IME composition across redraws | l1, c1, c2 (CompositionEvent dispatch) | The CDP Input.imeSetComposition path is not used: dispatch only. |
| Controls removed when actions become unavailable | w3, l4, c2, p4/x3 (NO LONGER ON SALE) | |
| Feedback names the right tx and paying account | r9 (hash link stays on its dialog), x5 (seats of `x.from`), r8 (hash in "cannot confirm") | |

## 8. Mobile WalletConnect handoff
Inspected: index.html 822-900 and the shipped /wc.js.

| Item | Covered by | Notes |
|---|---|---|
| App selection | m1 (sheet + METAMASK/RAINBOW/ZERION), m4 (pair) | pick 875 stores SG_WC_APP. |
| Stored-choice migration | m9 (WALLETCONNECT_DEEPLINK_CHOICE -> SG_WC_APP, library key removed), u5 | wcApp 850 |
| Request dispatch precedes the open-wallet instruction | m9 (OPEN disabled until session_request_sent) | **wc.js:** `session_request_sent` is emitted right after `sendRequest(…).catch(h)`, so also when the publish failed. The page then wakes OPEN, and the request's rejection closes the sheet (wcNudgeOff in ask's finally). |
| session_request_sent matched to the intended operation | m9 (requestId+topic in the jump), u10 | Filter 868: same method, id, topic. |
| Unrelated/late events cannot arm the wrong prompt | u10 (other method, no topic, no id, after the answer) | GUARD. Mutant (no filter) killed. **Not checked:** two requests with the same method where an older one's event arrives during a newer one. In wc.js the event follows the request's own publish, before its response, so this ordering was not found reachable. |
| Closing the sheet does not imply cancellation | u10 (close, then the answer is still used) | 858 copy says so. |
| Event never arrives (8 s fallback) | **u2** | REG **D2**. The text no longer claims the request is in the wallet (862-863). The jump has no request id. Copy for the curator. |
| Return from the app, backgrounding (visibilitychange) | Not covered: index.html has no visibilitychange handler | The relay reconnection on return is the library's (unverified, see below). |
| Repeated taps | Inspected | OPEN: `go()` returns while disabled (855), and repeated taps only navigate again. App buttons (875) do the same. |
| Reconnect | m4 | |
| Deep-link formats | m9 (`https://link.zerion.io/wc?requestId=…&sessionTopic=…`), u2 (`/wc`) | Same format as wc.js `FA()` (`${href}/wc?requestId=${id}&sessionTopic=${topic}`). Pairing link (875): `${href}/wc?uri=…`. |
| Safe handling of stored URLs | u5 (SG_WC_APP `javascript:`, `http:`, leading space; a migrated old key with `javascript:`: ignored, no OPEN, no navigation; a markup name is text) | GUARD. Mutant (no https check) killed. |
| Clear recovery for unsupported browser/wallet | u12 (wc.js fails: "WALLETCONNECT DID NOT ANSWER" with OPEN IN METAMASK -> `https://link.metamask.io/dapp/<host><path>`, COPY THE LINK), u17 (computer: NO WALLET sheet; dead wallet: "No wallet answered") | GUARD. Observed, not changed: a bundle that fails to load is reported only at the 20 s timer (wcConnect's catch 896 finishes only when a URI exists). Closing that sheet toasts errMsg 4001 "Cancelled in your wallet. Nothing was sent.", although no wallet was involved (minor copy). |

**Stays unverified** (Chromium with an iPhone UA is not iOS Safari or a wallet app):
- iOS freezing the page on the jump, and whether the relay publish finishes before it.
- Universal-link handling by the MetaMask, Rainbow and Zerion apps.
- `document.hasFocus()` gating in wc.js's own jump.
- The real relay (every socket refused).
- The library's behaviour on return from background.
- Whether a WALLETCONNECT_DEEPLINK_CHOICE copy could exist in WalletConnect's IndexedDB store. wc.js `zA()` reads localStorage first, then core.storage (IndexedDB WALLET_CONNECT_V2_INDEXED_DB); the page removes only the localStorage key. If such a copy exists, the library's own jump would fire. Nothing in the shipped path writes the key.
