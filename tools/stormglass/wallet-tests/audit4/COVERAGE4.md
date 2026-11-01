# STORMGLASS wallet: lifecycle coverage matrix, audit 4 DELTA (pre-fix scan of 0cd4ea4)

Base: tools/stormglass/wallet-tests/audit3/COVERAGE.md (audit 3). This file lists, for every item of the audit-4 brief, the cases that truly cover it (case bodies read, not titles), the new audit-4 case, or the stated limitation. Rows that audit 3 already settled are repeated only by id. Line numbers: index.html at 0cd4ea4 (sha256 8b0c08c6…f2ef). New cases: tools/stormglass/wallet-tests/audit4scan.test.js (group @audit4), branch audit/wallet-4-scan.

Legend: **REG** a4s regression for a defect found by this scan (fails on 0cd4ea4: SCAN_REPORT.md). **GUARD** passes on 0cd4ea4 and kills the named single-edit mutants. **A/B/C** = the findings being repaired in /home/claude/wt-a4-fix (not duplicated here; adjacent evidence noted).

## 1. Providers and sessions
| Item | Covered by | Delta / notes |
|---|---|---|
| EIP-6963 announcements | h1, h4, h5, h6, h7, u15 | unchanged |
| window.ethereum | h2, h9, u7, u16 | unchanged |
| providers[] | h3, h8, h9 | unchanged |
| Late discovery | u15 (1.5 s late announcement; a wallet announcing > 60 ms after a CONNECT click is missed for that click) | unchanged |
| Duplicate objects | h3, h8 (object identity) | unchanged |
| Colliding metadata | h6 (shared rdns, first dead), h7 (rdns+name: "· 1/· 2"), h9 (legacy names), u4 (metadata as text) | unchanged |
| Remembered choices | i1, u7 (by key, other order) | unchanged |
| Remembered choice and rejection | i2 (4001 forgets, no other wallet), u8 (-32603 desktop), u16 (phone 4001) | unchanged |
| Remembered **WalletConnect app** | m9 (migration), u5 (tampered href) | **REG a4s6** (S5): an older SG_WC_APP survives a pairing made through OTHER WALLET / COPY CONNECTION LINK; every prompt then names and opens that other app (wcConnect 876-878 only `pick()` writes it). |
| Dead provider | h4 (never), h6, u17 ("No wallet answered") | **REG a4s3** (S2): the same dead provider used as the last-resort *reader* (walletReads 813, no timeout) hangs the first tick forever: no "CANNOT REACH ETHEREUM", no 30 s retry (1780). |
| Delayed provider | u15 (0.9 s probe) | unchanged |
| Malformed provider | h5 (eth_chainId), u14 (accounts) | unchanged |
| Throwing provider | h4 (eth_chainId), k1 (revoke), u13 (send) | unchanged |
| Account change with event | j1, e, p3, r9, u14 | unchanged |
| Account change without event | v2 (the write stops) | **REG a4s4** (S3): after that stop the page never follows what it saw (opCheck 1096 throws STALE and nothing resyncs `me`): the header keeps the old address and every later press stops again with "changed while this was waiting", forever; same with the permission dropped silently (eth_accounts `[]`): the page stays "connected". |
| Empty account lists | j1 (event + eth_accounts decides) | silent variant: a4s4 (above) |
| Revoked permissions | j1, k2, k3, k5 | silent variant: a4s4 |
| Old events | j2 (old provider), u10 (old WC event, other method) | same-method old WC event = **B** |
| Late connection responses | u1 | unchanged |
| Switching away and back, same account | u14 | unchanged |
| Switching away and back, same chain | none | = **A** (chainChanged does not invalidate the op; mainnet→other→mainnet is in the A brief) |
| Pending ops across provider replacement | c (before the hand-off), u1 (connection), k6 | after the hand-off the lock is kept on purpose (opLock 1066) |
| Account-bound display after a change | x6 (refreshSeats crossing, same account), x7 (welcome) | **REG a4s2** (S1): after an account change the seats panel, the seats-board highlight and CLAIM/WITHDRAW keep the previous account's values until the new reads answer (30 s more if they fail); CLAIM is pressable and sends claim() from the new account. |

## 2. Preparation and locking
| Item | Covered by | Delta / notes |
|---|---|---|
| Every write entry point: target, sender, chain, value, calldata | before: w1 (witness), p1/p4/p5/z4 (buy args), n1-n5 (value), v3 (from, chainId); settle, sync, withdraw had none | **GUARD a4s1**: each of witness, buy, bid, settle, pledge, sync, claim, withdraw pressed in its own context: exactly 1 eth_sendTransaction, `to` = CFG.contract, `from` = connected account, `chainId` 0x1 with the wallet on 0x1, value = pressed amount (buy: price(t+30 s)·1.1 within a 10 s window; non-payables none), `gas` set, calldata decoded with the page's own ABI = the pressed function and arguments, and the eth_estimateGas before it was for the same to/data/value. Mutants killed: settle→sync, withdraw→claim, pledge value ×2 (ev/scan/mut-a4s1-*.log). |
| Amount capture | l1, n1-n5 (at the press), x4 (option at the press) | COLLECT value at the hand-off by design (audit 3) |
| Option capture | p1, p2, x4 | unchanged |
| Concurrent actions | q2 | unchanged |
| Repeated clicks | q1, i4 (delay-based, HARNESS4 G3), q3 | unchanged |
| Shared connection attempts | q2, u1 | unchanged |
| Lock ownership / release | u9, q3, q4 | unchanged |
| Disconnect before the hand-off | d, u3, u9 | **REG a4s7** (S6): COLLECT keeps "confirm in your wallet" after DISCONNECT stopped its write (disconnect 943-945 frees the lock; nothing tells the dialog). |
| Disconnect after the hand-off | g, r9, m5 | unchanged |
| Stall recovery | u3 (before the hand-off), u1 | after the hand-off: lock kept until the wallet answers; on WalletConnect the library rejects the request after its 5-minute expiry (wc.js `wc_sessionRequest` ttl FIVE_MINUTES, "Request expired"), which the page reports as UNSURE and frees the lock. Not covered by a case. |
| Ambiguous submission errors | q5, q6, u13 | unchanged |
| No auto-resubmission | q5, q6, u13, r8 | unchanged |

## 3. Tracking and UI
| Item | Covered by | Delta / notes |
|---|---|---|
| Reader fallback | r2, r3, y10 | page-read fallback to the wallet: a4s3 |
| Replacement identification | r5-r7, y1-y3 | malformed replacement receipts = **C** |
| Bounded scan batches, deadlines | y1-y3, y7 | unchanged |
| Missing blocks, delayed receipts | y4-y6, y8, y10 | unchanged |
| Dropped / cancelled / reverted / replaced / unknown | r8 / r6, y3 / r4 / r7 / r8, y9 | malformed receipt → "reverted" = **C** |
| Tracking independent of the account after submission | g, r9, m5 | unchanged |
| Dialog ownership and op tokens | p1-p5, x1-x5, z3 | a4s7 (dialog after DISCONNECT) |
| Day rollover, stale purchase context | p4, p5, c1, x3 | witness/pledge/bid keep the D or state captured at render; a stale day is refused by the contract at estimation ("that day is gone", STORMGLASS.sol 353-357), so nothing is paid (inspection) |
| Delayed error / success / seat / account callbacks | x1-x7, r9 | a4s2 (seats after an account change) |
| Redraws, focus, caret, selection | l1-l3 (l2/l3 assume the redraw: HARNESS4 G3) | unchanged |
| IME | l1, c1, c2 (dispatched CompositionEvent) | unchanged |
| Recovery controls and truthful feedback | q4-q6, u3, u13, z2 | a4s4 (stuck "changed while waiting"), a4s5, a4s7 |

## 4. WalletConnect / mobile
| Item | Covered by | Delta / notes |
|---|---|---|
| Session lifecycle | m4, m5 | unchanged |
| Deep-link construction | m9 (requestId+topic), u2 (/wc), u12 (MetaMask dapp link) | request correlation = **B** |
| Stored-app handling (tampered SG_WC_APP) | u5 (javascript:, http:, leading space, migrated key) | a4s6 (stale but valid app). Not covered: an https href with a fragment or credentials (`https://x#`, `https://a@b`) passes wcApp's check; the jump then loses its path. Requires same-origin storage tampering. |
| App return / backgrounding (visibilitychange) | none | **Limitation**: neither index.html nor wc.js has a visibilitychange handler (grep: 0 and 0). Return from the app relies on the relay socket; untestable in Chromium. |
| Fallback timing and wording | u2 (8 s), u12 (20 s) | **REG a4s5** (S4): a pairing link arriving after the 20 s "DID NOT ANSWER" sheet writes "Tap the app that holds your wallet." into that sheet, which has no app buttons (onUri 874 writes into whatever sheet is open; the app buttons were in the replaced one). |
| Reconnect and stale listeners | m4 (re-pair), j2 | wcHook once per client (`c.__sg`): = **B** |
| Unsupported browsers / wallets | u12, u17 | unchanged; closing the u12 sheet still toasts "Cancelled in your wallet" (audit 3 copy note) |

## Totals
New cases: 7 in audit4scan.test.js: 1 guard (a4s1) and 6 regressions (a4s2-a4s7). Fail-first on 0cd4ea4: a4s2-a4s7 fail, a4s1 passes (SCAN_REPORT.md).
