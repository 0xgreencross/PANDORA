# Brief F4: STORMGLASS wallet audit 4, Findings A, B and C: FIX REPORT

Worktree /home/claude/wt-a4-fix, branch audit/wallet-4-fix (from f1026a0 = 0cd4ea4 + the @audit4 registration). Nothing was pushed. Evidence is in /home/claude/audit4/ev/fix/. The baseline page is /home/claude/audit4/ev/fix/base_0cd4ea4.html (`git show 0cd4ea4:index.html`, sha256 8b0c08c6…, the production hash). It sits outside the repo: the runner reads TARGET with fs and serves it from memory.

## Commits (author 0xgreencross, with the session trailers)
- **d4976b6**: the repairs for A, B and C (index.html, wallet code only), plus audit4.test.js (a4c1-a4c7, a4w1-a4w10, a4r1-a4r12) and m9's fixture.
- **9ce6ffc**: the fake chain's default receipt is mined in the head block (fakechain.js, one line plus a comment; see C).
- **2deca2d**: the README describes the @audit4 group.

Diff 0cd4ea4..2deca2d:
- index.html: +63/-18, wallet code only.
- New: audit4.test.js.
- wallet.test.js: m9's fake WalletConnect provider, plus f1026a0's registration.
- fakechain.js: 1 default changed.
- README.

Not touched: contract addresses, ABIs, chain config, economics, artwork, visuals, the runner and the harness rules. index.html has no CORE markers, so law 15 does not apply. The ritual (node --check, id audit, vm smoke) PASSED after the page edit.

## Finding A: a chain change in the final submission gap. CONFIRMED.

**Trigger.** The wallet's chainChanged arrives after the last look's chain answer (opCheck), but before `ask(op.P,'eth_sendTransaction')`. follow() only set `NX.wrong` and the label. opLive checked session, provider, account and lock, but never the chain.

**Impact.** The page asked the wallet to send after it had itself shown "[!] NOT MAINNET".
- a4c4 on the baseline: `sendRequests:["0x2105 0x1"]`. The wallet was on Base, and the request carried chainId 1. Label `0x0000…00AA · [!] NOT MAINNET`, toasts "sent", "confirmed".
- a4c1 on the baseline: `requestsAfterTheEvent:[0,1,2]`. For a delay of 0-2 microtasks after the chain answer, the request went out after the event.
- a4c2 (mainnet -> Base -> mainnet): `[0,1,2]`.
- a4c3 (Base -> mainnet during gas estimation): `sendRequests:1`, "confirmed".

**Repair** (index.html 800-808, 994, 1108-1116):
- `CHAINREV`: for each provider, a count of the chainChanged events that name a chain other than mainnet (or nothing readable). It is counted in follow() for any provider.
- **Establishing the chain.** opBegin reads the chain. If it is wrong, it asks for the write's own switch. What the wallet announces before the final read is not held against the write.
- **Capturing validated context.** `op.crev` is the count taken just before the read that said mainnet. A non-mainnet event that lands during that read already stops the write.
- **Preparing and final validation.** opLive now also throws `MOVED()` ("Your wallet changed network while this was waiting. Nothing was sent.", code STALE) when `chainRev(op.P)!==op.crev`. It runs at every existing opLive point: in opBegin, at the start of opCheck and after its answers.
- **Invoking the captured provider.** `await opCheck(op); opLive(op);` is followed synchronously by the hand-off and the provider call. There is no async gap after the last check (unchanged).
- What does not count:
  - Events naming mainnet (the write's own switch announces mainnet, early or late).
  - Another provider's events.
  - SES is not bumped. The session did not change; only this write stops.
- The explicit chainId and from are kept. There is no automatic retry. The send() toast is that text. In COLLECT, failReason shows "Your wallet is on another network…" if it still is, and otherwise the MOVED text.
- **Copy for the curator:** "Your wallet changed network while this was waiting. Nothing was sent."

**Regressions** (each fails on 0cd4ea4 and passes on the candidate):
- a4c1: wallet -> Base, k=0..14 microtask sweep after the last chain answer (u11's model). It asserts every eth_sendTransaction REQUEST in the mock log and whether it came after the event. Candidate: `0:stop 1:stop 2:stop 3:req … 14:req` (`requestsAfterTheEvent:[]`). The stopped rows are exactly the rows that sent after the event on the baseline, so the stop reaches the microtask right before the provider call.
- a4c2: mainnet -> Base -> mainnet, same sweep. eth_chainId keeps saying mainnet.
- a4c3: Base -> mainnet during eth_estimateGas (gate asserted).
- a4c4: wallet -> Base while the last look's eth_accounts is held and its eth_chainId has already answered mainnet (both asserted).

**Guards** (pass on both; each kills an over-eager fix):
- a4c5: the previously selected wallet A emits Base and Arbitrum while B's write is held at eth_estimateGas. B sends once, on chain 1, from B.
- a4c6: the write's own switch Base -> mainnet with late mainnet announcements (two during gas estimation, and a 0..10 microtask sweep after the last look). It goes out every time: 12 requests, 11 switches, all chainId 0x1. A blind bump of SES or the count would fail it.
- a4c7: a chain change AFTER the hand-off. A second press says "…is in your wallet now". There is no "Nothing was sent"/"stopped"/"cancelled". It is followed to "confirmed".

**Adjacent checked:**
- switchChain and the header bar: not operations, unchanged.
- COLLECT's SWITCH continuation (z3/z4) starts a new operation.
- follow() is installed per provider at connect (HEARD).
- The shipped WalletConnect provider emits hex chain ids (`Cd(chainId)` in wc.js), which parse correctly.
- The 1 s NX_HOOKED listener, disconnect and accountsChanged paths are unchanged.
- f, v1-v3, u11, z1-z4, a1, b, m2 and m3 all pass.

## Finding B: WalletConnect session_request_sent is not correlated. CONFIRMED.

**What wc.js really exposes** (read in /wc.js):
- `engine.request(r)` makes `c=En()` (the clientRpcId, a number) and `l=xs().toString()` (the relayRpcId, never in the event). It publishes, and then does `this.client.events.emit("session_request_sent",{topic:s,request:i,chainId:n,id:c})`. The id exists only inside the engine, so the page cannot learn it before the emit without wrapping engine internals (not done: no API guarantee).
- The topic is the one UniversalProvider passes: `topic:this.session.topic`. The page can read it beforehand as `provider.session.topic` (EthereumProvider `get session(){return this.signer.session}`).
- `UniversalProvider.request(e)` passes `request:wd({},e)`, a shallow copy of the page's `{method,params}`. The eip155 provider hands eth_sendTransaction on with `this.client.request(e)`, so the event's `request.params` is the very array the page passed.
- `wallet_switchEthereumChain` goes through `handleSwitchChain`, which builds a NEW `{method,params:[{chainId}]}`. For chain 1, which is always approved (`chains:[1]`), it sends nothing to the wallet at all.
- The emitter is per SignClient (`on` -> `this.events.on`), one per EthereumProvider. The page keeps one `_WC`: a reconnect re-pairs the same client under a new session topic. wcInit0's retry path makes a second provider and client.
- wcHook installs one listener per client (`c.__sg`) and never removes it.
- **Also found:** the engine emits session_request_sent even when publishing failed (`.catch(h)` then emit).

**Trigger.** wcHook accepted any event whose method matched the open sheet and had an id and a topic.

**Impact.** OPEN carried another request's requestId/sessionTopic, so the wallet would be opened on a different request, or on none. Baseline evidence:
- a4w3: `linkEarly …requestId=111` (the earlier, closed request).
- a4w2: the old provider's 51.
- a4w1: a foreign session's T9.
- a4w4: a conflicting duplicate replaced 5 with 6.
- a4w5: woke on a string id and on a deep-copied request, and ended at `requestId=11`.
- a4w9: the first switch's 91.
- a4w10: an id with no session to check.

**Repair** (index.html 810-813, 869-890):
- ask() copies the params array of a request that opens the sheet, so each request has its own identity (same contents).
- wcNudge binds the sheet to the provider, the params array, the method, and the provider's session topic at request time.
- The listener accepts an event only when all of these hold:
  - it comes from the client of the sheet's provider;
  - the method matches;
  - `request.params` is the sheet's params array;
  - `topic` is the captured session topic;
  - `id` is a safe positive integer.
- A second, different event for the same request makes the link ambiguous, and OPEN falls back to the wallet only. Anything else changes nothing.
- When exact correlation cannot be established, there is no request-specific link. At 8 s OPEN goes to `<app>/wc` with the existing wording, "No word yet that the request reached ZERION…", which makes no claim. This covers a switch request, a missing session topic, a bad id or topic, and conflicting events.
- Stale listeners and events cannot touch the current sheet: wcNudgeSent takes the sheet and checks `NUDGE===n`. Closing the sheet still cancels nothing.

**Regressions** (each fails on 0cd4ea4 and passes on the candidate):
- a4w1: wrong topic.
- a4w2: old provider after reconnect, plus the same provider re-paired (old session topic).
- a4w3: an earlier request's delayed event while a newer same-method sheet is open.
- a4w4: duplicates.
- a4w5: unrelated methods and malformed fields, then the 8 s generic fallback.
- a4w7: close and reopen.
- a4w8: an event after the request settled.
- a4w9: two sequential switch requests, the first one's event delayed.
- a4w10: no session topic, then the fallback.

**Guard:** a4w6 (passes on both). The correct event gives an exact link with the right requestId and sessionTopic, and closing the sheet leaves the request pending until it answers.

**Fixture note.** m9's fake provider now models wc.js: `session:{topic}`, and the event's `request` is `{...args}` of the request it received. Its assertion is unchanged: the OPEN URL must be exactly `…/wc?requestId=1730000000123456&sessionTopic=t0pic`. m9 passes on both pages, and u2/u10 pass.

**Limit.** The identity match rests on the shipped bundle's shallow copy: observed behaviour of this /wc.js, not a documented API. If a future bundle copies params, the page degrades to the generic link, never to a wrong one.

## Finding C: malformed receipts produce definitive outcomes. CONFIRMED.

**Trigger.** trackTx took any object with a truthy blockNumber as mined: `status` 1 meant confirmed and anything else meant reverted. The receipt's hash, block and sender were never checked.

**Impact** (baseline evidence):
- The reviewer's receipt (another hash, no status) gives "reverted". a4r11: toast "…failed on Ethereum (reverted)"; a4r12: "[!!] NOT COLLECTED".
- Another hash with 0x1, a numeric 1, blockNumber "0x"/"abc"/a number/below the send block, a missing or short blockHash, and a foreign from/to all gave "confirmed" (a4r1-a4r5).
- All readers malformed gives "reverted" after one read in 16 ms (a4r8).
- In the replacement scan, the original's or a foreign receipt classified the nonce (a4r9).

**Readers' format.** trackTx reads through trackRpc, which is raw JSON-RPC over fetch, not ethers. Answers are hex strings, so numeric 0/1 are not accepted.

**Repair** (index.html 1152-1155, 1160-1179, 1185, 1203):
- `rcGood(w)` accepts a receipt only when all of these hold:
  - null counts as an answer: not mined (by that reader) yet;
  - `transactionHash` is 32-byte hex and equals the hash asked about (any case);
  - `blockNumber` is a hex quantity > 0 and at or after `op.block` (the head read just before sending), when that is known;
  - `blockHash` is 32-byte hex;
  - `status` is exactly "0x0" or "0x1";
  - `from` is the sender;
  - `to` is the address the transaction named.
- `trackRpc(method,params,use)`: an answer that fails `use` is unusable, and the next reader is asked in the same round.
- With nothing trustworthy, the payment stays pending: "cannot confirm" at TRACK.lost, unknown at TRACK.stop. It never becomes reverted or confirmed, and tracking never stops on a malformed object.
- A replacement's receipt is validated against the identified replacement transaction (its hash, from and to). If invalid on every reader, the scan cursor stays on that block.
- Request timeouts, scan bounds, the cursor, reader rotation and the deadlines are unchanged.

**Confirmation and reorg policy** (written in the code comment; a4r10 pins it):
- One valid receipt from whichever reader answered it decides.
- The readers are not cross-checked.
- Nothing is re-checked for a reorg later: "confirmed" means seen mined in one block, not final.
- A first reader that has no receipt yet keeps the payment pending (null is an answer).

**Regressions** (each fails on 0cd4ea4 and passes on the candidate):
- a4r1: status.
- a4r2: transactionHash.
- a4r3: blockNumber.
- a4r4: blockHash.
- a4r5: from/to.
- a4r6: valid after invalid ones; the invalid ones claim the opposite status.
- a4r7: a malformed first reader, then a valid fallback reader, in the same round (<1.4 s).
- a4r8: every reader malformed: pending, then "cannot confirm" at lost and unknown at stop, with receipts asked from all 3 readers until then.
- a4r9: replacement receipts (the original's, another tx's, no status, another sender).
- a4r11: WITNESS end to end.
- a4r12: COLLECT end to end.

Every "pending" row must have been read at least 3 times (gate) and then confirm on a valid receipt.

**Guard:** a4r10 (the policy).

**Fixture change, flagged.** fakechain's default receipt said `blockNumber: head-1`. That puts every transaction in a block that existed before the page read the head and sent, which no chain can do. The page now refuses that (the brief's "below the send block"), so the first default receipt was refused and confirmation came one poll later.
- n4/n5 then caught the "confirmed" toast in the middle of their bad-amount sweep. They were the only failures in the first full run (ev/fix/full-d4976b6.log, 140/142).
- Proof of cause: n4/n5 pass on the candidate with only the send-block condition removed (ev/fix/n45-probe-nomin.log, temporary copy outside the repo) and fail without that change (n45-cand.log).
- Fix: the default receipt is mined in the head block (9ce6ffc). This is a change to an existing default, not an additive helper: the brief says defaults stay unchanged, so it is called out here.
- It is neutral for the old page: 0cd4ea4 with the new fixture passes all 113 earlier cases (full-base-fixture-9ce6ffc.log).
- Classification: harness (unrealistic fixture), not a patch regression.

**Adjacent checked:**
- The nonce read (nonceOf already checks from and nonce), the head validation, block validation and the y-scan bounds are unchanged.
- r1-r9, y1-y10, g, m4, m5, q5 and q6 all pass.

## Runs
- **@audit4 on 0cd4ea4: 5/29**, FAILED a4c1-a4c4, a4w1-a4w5, a4w7-a4w10, a4r1-a4r9, a4r11, a4r12. Only the five guards a4c5, a4c6, a4c7, a4w6 and a4r10 pass, as intended. Logs: a4-on-base.log, and r-on-base.log for a4r1-a4r6 after a test fix. The same set fails in full-base-fixture-9ce6ffc.log.
- **Full suite, candidate 9ce6ffc: 142/142, rc=0** (full-9ce6ffc.log, results-full-9ce6ffc.json): @orig 38, @audit2 35, @audit3 21, @audit3b 17, @harness 2, @audit4 29. Per-case times are within about 1 s of the baseline run (y8 confirms 208 ms after its receipt; limit 2.5 s).
- **Full suite, 0cd4ea4 with the 9ce6ffc fixtures: 118/142**: all 113 earlier cases plus the 5 guards; exactly the 24 regressions fail.
- **Determinism, @audit4 ×5 on 9ce6ffc:** 29/29 every time (ev/fix/rep1..rep5-9ce6ffc.log). HEAD 2deca2d only adds the README line: the page and tests are identical to 9ce6ffc.
- **Test errors during development** (fixed in the test, not the page, per law 14):
  - a4r1-a4r5 passed fixture functions into page.evaluate.
  - a4r6 assumed one receipt read per round; the repair now asks the next reader in the same round. It was rewritten to decide by outcome: the invalid receipts claim the opposite status.
- **Environment:** no wallet, RPC or relay was contacted. The harness refuses every outside page request and socket.

## Left / notes
- **Copy for the curator:** the MOVED text (A).
- **Residual (B, pre-existing):** wc.js emits session_request_sent even after a failed publish. With an exact match, the sheet briefly says "The request is in ZERION now" until the rejection closes it.
- **Residual (C):** op.block comes from one reader's head. A reader reporting a head ahead of the canonical chain (only possible with a deep reorg) would make a valid receipt look early. It would stay pending and then say "cannot confirm", never give a false verdict.
- **Not reproduced:** a real wallet's chainChanged ordering around its own switch. Real wallets announce the target chain, which counts for nothing. A wallet that announced an intermediate non-mainnet chain after answering the switch would stop that write with the MOVED text (safe; nothing sent).
