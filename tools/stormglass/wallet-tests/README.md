# STORMGLASS wallet tests

Run from the repo root (Node with `playwright` and `ethers` 6.13.2 on `NODE_PATH`, Chromium at `/opt/pw-browsers/chromium` or `$CHROMIUM`):

    NODE_PATH=/home/claude/node_modules node tools/stormglass/wallet-tests/ritual.js index.html      # node --check, id audit, vm smoke test
    PORT=8932 bash tools/stormglass/wallet-tests/run.sh                                                # all wallet cases against index.html
    PORT=8932 TARGET=/path/other_index.html LABEL=main CASES=a1,b bash tools/stormglass/wallet-tests/run.sh
    PORT=8932 SCRIPT=shots.js bash tools/stormglass/wallet-tests/run.sh                                # picker + connected dialog at the six law-8 sizes
    PORT=8932 SCRIPT=witness-shots.js PREFIX=index bash tools/stormglass/wallet-tests/run.sh          # open sale with the WITNESS button at the six law-8 sizes + 320x640 (SHOTS=dir, QUERY=?practice=1 CLOSED=1 for the practice page)

The full run takes about four minutes: start it in the background (`(setsid nohup timeout 900 bash run.sh > log 2>&1 &)`) and poll the log.

- `mockwallet.js`: mock EIP-1193 wallets (EIP-6963 announcements, `window.ethereum`, `providers[]`), every request logged; chain, accounts, delays, rejections, sync throws, malformed answers, never-answering calls, gates the test opens, and events.
- `fakechain.js`: answers the public RPCs the page reads (`eth_call` for the STORMGLASS / GLASS / SMALL WEATHER ABIs, blocks, receipts). Every other outside request is refused; ethers is served from the local copy of the cdnjs file.
- `wallet.test.js`: cases a-m (wrong chain, races, picker, remembered choice, events, revoke, amount boxes, phone path) and w1, w3 (the WITNESS call-to-action under COLLECT: visible, big enough, opens the sheet, sends once; absent when nothing is on sale). n1-n6 (typed amounts: `0,001` from a comma-locale keypad sends exactly 0.001 ETH in the witness, pledge and bid boxes; ambiguous or bad amounts send nothing and toast "Type an amount like 0.01"; a table of `parseAmount`). Results go to `$OUT/results-$LABEL.json` (default `/tmp/claude-0/pr1test`).

- `audit2.test.js` (loaded by `wallet.test.js`): the audit-2 regression cases. q1-q6 one write at a time (fast presses, presses while a connection or a wallet confirmation is pending, refusal, an unknown outcome after the hand-off); r1-r9 following a submitted transaction on the mainnet HTTP readers (silent wallet, a failing or hanging first reader, reverted, sped up, cancelled, replaced, dropped); k3-k6 revocation and reconnect (> 5 s, unsupported, never answered, two wallets); m4-m5 a deterministic WalletConnect provider mock (pair, a transaction, DISCONNECT ends the session, the phone ends it); h6-h9 wallet identity (shared rdns, dead first provider, legacy name collisions, ambiguous saved choice); p1-p5 the COLLECT dialog against stale callbacks (close/reopen, another option, account change, a new day while connecting or confirming); v1-v3 the last look before `eth_sendTransaction`; c1-c2 IME composition across redraws and day changes.

Exit status: 0 only when every selected case passed; 1 when a case fails (its assertion, an exception, or any uncaught page error or page crash) or the harness cannot start; 2 for an unknown id in `CASES` or a selection of zero cases. `run.sh` passes Node's status through. Groups: `CASES=@orig` (the 37), `CASES=@audit2`.

No real wallet, no real RPC, no real transaction is involved.
