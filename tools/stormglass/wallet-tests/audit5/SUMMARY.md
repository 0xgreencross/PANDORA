# Wallet audit 5: summary (review branch audit-wallet-5)

Candidate: index.html sha256 99131cd72c8f782ea76045c2ff56e17e9897cea8e77285604f06ea119875ec56 (local commit e66508991c32d3fa0734cf0efc9bebb37265eae2; published review commit: see the branch head and the stamp inside test-wallet.html). Production (main f676ad1, index.html 8b0c08c6) is unchanged; nothing here is deployed except test-wallet.html.

## Starting state (Nov 1 16:44 UTC)
- main f676ad1245900229d1a3f58ebaa6815d7a610d59, index.html 8b0c08c602fd…f2ef = deployed homepage; test-wallet.html 6bf01c65 (audit-4 staging).
- Review base origin/audit-wallet-4 38264fccc302c9bcdbdcf17ec6aaaca7edbc0a1b (index 703602f1…; the local 24cda89 was never published).
- Registry 161 ids; fresh baseline 159/161 (hz2 timing, a4s3 unhandled rejection): both fixed below.

## Findings, fixes, regressions
| # | Finding | Fix | Regressions |
|---|---|---|---|
| 1 | nonceOf trusted an eth_getTransactionByHash answer without checking its hash: an unrelated transaction of the sender poisoned the nonce, the original was called "replaced" | hash, sender, nonce (0x0 valid) and present identity fields checked for public readers and the wallet; bad answer = next reader; replacement needs consistent block/tx/receipt | a5n1-a5n12 |
| 2 | (review) replacement trusted a receipt/tx blockHash that disagreed with the block's own hash | block must carry a 32-byte hash; tx and receipt blockHash must equal it | a5r1 |
| 3 | a phone connect loop moved on to another provider after an error | one selected provider per attempt; YOUR WALLET DID NOT CONNECT + CHOOSE ANOTHER WALLET | a5m1-a5m7 |
| 4 | (review) SWITCH TO ETHEREUM after DISCONNECT asked window.ethereum, a wallet never chosen | switch asks only the connected wallet | a5r2 |
| 5 | no way to recover owed ETH for a wallet that rejects ETH | WITHDRAW TO ANOTHER ADDRESS (withdrawTo, validated, recipient captured at review, same guarded path) | a5w1-a5w8 |
| 6 | earnings copy said "sends" | "tries to send; if your wallet cannot accept ETH it stays owed" | copy |
| 7 | unhandled rejection when all readers fail (a4s3 page error) | caught | a5x1 |
| 8 | median ordering | fixed | a5x2, a5x3 |
| 9 | harness: a failed results write could still exit 0; missing modules could shrink a run; no watchdog | atomic writes, schema-2 run identity, manifest + RELEASE=1, watchdogs, signals | selftest.js 30/30 |
| 10 | fixed-delay races (q1, i4, hz2, a4r10 + p4, v1-v3, z3, a4s7, a4h1) | explicit gates | mutation-proven |

## Results (final candidate e665089, index.html 99131cd7)
- RELEASE=1 full suite: 193/193 passed, completed, exit 0 (results/results-release-e665089.json; groups @orig 38, @audit2 35, @audit3 21, @audit3b 17, @harness 2, @audit4 48, @audit5 32). Earlier: 6c18095 190/191 (a4r10 fixed 1.5 s sleep under load: now gated, results-a4r10-gate.json); 791034b 193/193.
- Race/lifecycle/concurrency 5x (CASES=@audit2,@audit4,@audit5,a2,c,d,e,f,i4,l2,l3,hz2 = 124 cases; two runs in parallel on a loaded machine): 5/5 runs 124/124 (results-race5x-1..5.json). No flake.
- Harness self-tests: selftest.js 30/30 (harness agent and, independently, the reviewer on 791034b).
- Contracts (stormglass/, `npx hardhat test`, hardhat 2.29.1, solc 0.8.24, cancun, optimizer 800, viaIR): 42 passing incl. 8 new payout tests; 12/12 contract mutants caught; deployed bytecode parity with the repo build: true on 4 RPCs (12 immutables masked, identical metadata).
- Staging (tools/stormglass/staging/staging.test.js): 32/32 on the e665089 build; fail-first on the 38264fc build 1/9 new tests pass (the page-independent one); 5 mutations caught.
- Mutation proofs: page 30 killed (4 redundant survivors documented); review M1-M3, S1 killed; harness gates q1, i4, p4, v1, v2, z3, a4s7, a4h1 killed. 
Details per area: PAGE_REPORT.md, HARNESS5_REPORT.md, CONTRACT_REPORT.md, REVIEW5_REPORT.md, STAGING5_REPORT.md, NOTES.md.
