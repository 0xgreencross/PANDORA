# Audit 5 · C5 — STORMGLASS payout tests (local chain) and deployed bytecode parity

Worktree /home/claude/wt-a5-contract, branch audit/wallet-5-contract (from e7149ea). Commit **2f60373**
"audit 5 (contract): payout tests on the local chain, shadow ledger exact to the wei (test-only actor contract)",
author 0xgreencross, not pushed. Files added (tests only): `stormglass/test/payouts.test.js`,
`stormglass/contracts/test/PayoutActor.sol` (test-only contract, compiled by the existing config). No edits to
STORMGLASS.sol, GLASS.sol, Coats.sol, hardhat configs, index.html or wallet-tests. node_modules/artifacts/cache are
gitignored and not committed. Evidence: /home/claude/audit5/ev/contract/.

## Versions
Node 22.22.0 · hardhat 2.29.1 · @nomicfoundation/hardhat-toolbox 5.0.0 · solc 0.8.24+commit.e11b9ed9 (npm soljson,
pinned by hardhat.config.js subtask) · optimizer enabled, runs 800 · evmVersion cancun · viaIR true · network hardhat
(cancun), in-process, no live network, no real funds.

## Commands
```
cd /home/claude/wt-a5-contract/stormglass && npm ci                       # 642 packages
npx hardhat test                                                          # baseline (before my files)
npx hardhat test test/payouts.test.js                                     # new tests
npx hardhat test                                                          # full suite after
python3 -I /home/claude/audit5/ev/contract/mutation/mutate.py <scratchpad>      # mutation proof (temp copies)
curl -sS -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_getCode","params":["0xCf5EBA884EFA04940d31A663bEB6D37F907d064C","latest"]}' <rpc>
node /home/claude/audit5/ev/contract/parity/parity.js <stormglass dir> <glass/deploy/index.html> <getCode json>...
```

## Results
- Baseline (e7149ea): **34 passing**, 0 failing (`ev/contract/baseline_test.log`).
- New tests: **8 passing** (`npx hardhat test test/payouts.test.js`, ~15 s).
- Full suite after: **42 passing**, 0 failing (`ev/contract/full_after.log`).

### Method
A shadow ledger in JS is written from the contract's own rules: _split 70/20/10 (20 to the vault while
totalSeats == 0), accPerSeat floor at 1e18 scale, _settleSeats with its cap at seatPool, _grantSeats debt reset,
_seatForDay cap of one seat per wallet per day, and _pay falling back to owed for any payee marked refusing. After
**every** transaction the test asserts, with exact equality and no tolerance:
- vault, seatPool, totalSeats, and seats, pending and owed for every tracked address;
- held == vault + seatPool + Σowed;
- every tracked balance moved by exactly the ledger's payouts, with gas accounted, so the ether that leaves
  the contract equals the sum of payouts and each is paid once;
- the SeatsClaimed events equal the ledger's settlements in order.

Bought price/pick/buyer, Witnessed and Pledged are also checked. For buys, the price is read with
priceAt(id, t) for a fixed next-block timestamp, and the Bought event must carry that price.

PayoutActor modes: ACCEPT; REVERT; SPIN (infinite loop); HUNGRY (3 fresh SSTOREs ≈ 66k gas, which fails under the
stipend and succeeds with full gas); PROBE (logs gasleft at entry); REENTER (calls STORMGLASS again from receive and
logs ok/returndata).

### Brief items
1. **Seat earnings during buy and witness: PASS.** buy and witness settle the **payer's** existing seats before
   _seatForDay grants the day seat: the buyer gets SeatsClaimed = everything accrued + its share of its own price,
   and pending is 0 afterwards. Clarification: **only the payer** is settled. Other holders are not pushed; their
   pending grows and they take it with claim() or their own next payment, as the tests assert.
2. **Share of own payment (split before settle): PASS, exact.** Test 1 computes the amount independently:
   `seats·(acc + (price·20/100)·1e18/total)/1e18 − debt`. In the worked case, the only holder of exactly 1 seat
   pledges 1 ETH and receives exactly 0.2 ETH. With 4.333… seats, a 0.03 ETH witness returns 0.006 ETH − 3 wei; the
   3 wei stays in seatPool. That is the contract's documented floor rounding ("a few wei"), and seatPool == 3 wei is
   asserted exactly.
3. **No retroactive earnings: PASS.** At the grant, pending(new) == 0. A first claim emits no event and moves
   nothing. The next distribution pays exactly `seats·(acc+Δ)/1e18 − seats·acc/1e18`. After every holder claims,
   seatPool < 10 wei (floor dust only).
4. **Rejected ETH goes to owed[]: PASS.** REVERT, SPIN and HUNGRY holders: the claim is credited to owed and the
   SeatsClaimed amount is still emitted. An overpaid buy by a REVERT actor puts the refund and earnings in owed. A
   SPIN payee costs the tx < 200k gas, because it only ever gets 60000. PAYEE given reverting code
   (hardhat_setCode, test only) gets its 70% into owed[PAYEE] (0.7 ETH of 1 ETH). The HUNGRY wallet then takes its
   owed itself with withdraw(), which forwards full gas. Stipend measured (4b): gasleft at the payee's entry is
   > 60000 and ≤ 62300 (60000 + the EVM's 2300 value stipend). Under withdraw it is > 1,000,000 (all gas).
5. **No loss, no double count: PASS.** A whole run combines pledges (including 7 wei and odd amounts), witnesses
   (including 11 wei), an overpaid buy, a refusing actor, claims and second claims. At the end,
   held == h0 + Σin − Σout and every second claim pays 0.
6. **withdrawTo to an accepting recipient: PASS.** To an EOA and to an ACCEPT contract, the exact owed is paid
   and owed becomes 0.
7. **Rejected alternate recipient: PASS.** withdrawTo to a REVERT or SPIN contract reverts "failed", and so does
   withdraw by the refusing wallet itself. withdrawTo(0) reverts "zero address". owed is preserved exactly and no
   tracked balance moves.
8. **Second withdrawal: PASS.** A second withdrawTo or withdraw reverts "nothing owed".
9. **Unauthorised callers: PASS.** The ABI's only exits are claim(), withdraw() and withdrawTo(address), all keyed
   on msg.sender. A stranger and a holder with owed 0 get "nothing owed" from both withdraw functions while others
   are owed. R2.withdrawTo(attacker-chosen) pays only R2's own 0.2.
10. **Reentrancy: PASS.**
    - From the 60000-gas push in claim(), re-entering claim, withdraw, withdrawTo, buy and witness is refused with
      Error("reentrant"), decoded from the returndata.
    - From an overpaid buy's refund, re-entering claim is refused the same way.
    - From inside withdraw() and withdrawTo(), which forward all gas (> 1M at entry), all five re-entries are
      refused with "reentrant".
    - Each balance is paid exactly once (ledger + balances), and owed is 0 after.
    - Defence in depth: _withdraw zeroes owed before the call (CEI); the M7/M11 mutants show that without the guard
      the re-entry meets "nothing owed" instead.

### Mutation proof
Twelve contract mutants were run as temp copies under the scratchpad and deleted afterwards; the worktree was never
edited. **All 12 are caught** by payouts.test.js (`ev/contract/mutation/mutation_results.json`, one log per mutant).

| Mutant | What changed | Tests that fail |
|---|---|---|
| M1 | buy: settle before split | 1, 4, 5, 10 |
| M2 | buy: day seat before settle | 1, 4, 5, 10 |
| M3 | witness: settle before split | 1, 2, 5, 10 |
| M4 | _pay drops owed on failure | 4, 4b, 5, 6-9, 10 |
| M5 | _withdraw does not zero owed | 4, 4b, 6-9, 10 |
| M6 | _withdraw ignores a failed send | 6-9 |
| M7 | withdraw without nonReentrant | 10 |
| M8 | _pay forwards all gas, not 60000 | 4, 4b, 10 |
| M9 | settle without the debt update | 3, 4, 4b, 5, 6-9, 10 |
| M10 | grant without the debt update | all 8 |
| M11 | withdrawTo without nonReentrant | 10 |
| M12 | claim without nonReentrant | 10 |

## Deployed bytecode parity (mainnet, read-only)
- **Fetch:** eth_getCode(0xCf5EBA884EFA04940d31A663bEB6D37F907d064C, latest) was read from four public RPCs:
  ethereum-rpc.publicnode.com, eth.drpc.org, rpc.flashbots.net and eth-mainnet.public.blastapi.io. All returned
  19585 bytes, sha256 3d2d5e6c28445bcc370c0eecb97548ed66c4c2f4880e13bb3d5a57da9d21a1e6.
  cloudflare-eth returned an internal error, ankr needs a key, llamarpc returned 525, and 1rpc returned a short
  error. The chain head was 0x191a13d at 16:47 UTC.
- **Build:** repo deployedBytecode is 19585 bytes, sha256 816683…67b7. STORMGLASS.sol source sha256 is
  17c031de5bef15d30bb414be71d254fba37f0801e19d8ccd4ea09c7dd8ffce0b. The build is unchanged after adding the test
  contract; parity was re-run after the commit with the same result.
- **Result:**
  - 12 immutable references (glass×2, ethPool×2, pegPool×1, revealBlock×3, candleOpen×4), taken from the build-info
    immutableReferences, are masked.
  - **0 unmasked byte differences.** The 53-byte CBOR metadata tail is **identical**: ipfs hash
    b1eb5c22…8faa, solc 0.8.24. Identical metadata means identical source and settings. **PARITY: true** on all 4.
  - Each immutable's copies agree.
- **Live immutables:**

| Immutable | Live value |
|---|---|
| glass | 0xf125024a394c0518d85d7a416cc9df96177107f4 |
| ethPool | 0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640 (Uniswap v3 USDC/ETH) |
| pegPool | 0x3416cf6c708da44db2624d63ea0aaef7113527c6 (USDC/USDT) |
| revealBlock | 0x18f97f1 |
| candleOpen | 0x6acd41bb |

- **Existing tool reused:** the repo's verify step (glass/deploy/index.html, step s5, `same()`: equal length, ARTS
  imm ranges masked) uses the same method. Its embedded ARTS.STORMGLASS.runtime and imm ranges are **equal to the
  build's**.
- **Checker mutation proof:** flipping a code byte gives PARITY false; flipping a byte inside an immutable is
  masked and stays true; flipping a metadata byte gives false (`parity/mutation_proof.txt`). Script and outputs:
  `ev/contract/parity/` (parity.js, parity_result.json, parity_result_after_tests.json, the RPC JSONs).

**Conclusion:** the deployed STORMGLASS runtime is the repository contract byte for byte, immutables aside, so the
local-chain results above apply to the deployed contract.

## Findings and notes (no defects found)
- No payout defect was found. Every invariant held exactly; the only residue is accPerSeat floor dust (a few wei)
  left in seatPool, as the contract documents.
- buy and witness settle only the payer's seats. Wallet/UI wording that implies all holders are paid on every sale
  would be wrong.
- withdraw and withdrawTo forward all gas. Safety there rests on nonReentrant plus owed being zeroed first, and
  both are proven. _pay caps at 60000 (+2300), and any payee needing more is credited to owed.
- receive() is unguarded and only adds to the vault. A payee re-entering it just gifts; conservation still holds.
- Read-only mainnet observation: PAYEE 0x19A8…8359 has no code (plain EOA), so it accepts every push. ARTIST
  greencross.eth 0x0DD3…f4eB has an EIP-7702 delegation (0xef0100 63c0c19a282a1b52b07dd5a65b58948a07dae32b). ARTIST
  receives no ether from the contract by rule. If it ever pays as buyer, witness or pledger, its refunds and earnings
  run through the delegate's receive under the 60000 cap and would fall back to owed if that costs more.

## WORDING FOR APPROVAL
None (no user-facing text added).
