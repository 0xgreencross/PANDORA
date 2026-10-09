# SMALL WEATHER: the mainnet runbook (v3, Oct 9 2026)

The full state lives in the project doc `stormglass/gift_drop.md`; if the two disagree, the project doc wins.

## What is on the page
- GIFT.sol v3 (audited Oct 9 by a swarm of six attackers and two skeptics; no exploit found). Runtime 10434 bytes, sha256 of the runtime `1c057344420834b8a4014333741a1f8848823f75cf40d6c68c68e8464fb356db`.
  Check: `cd smallweather && npx hardhat compile && node -e 'const a=require("./artifacts/contracts/GIFT.sol/GIFT.json");console.log(require("crypto").createHash("sha256").update(Buffer.from(a.deployedBytecode.slice(2),"hex")).digest("hex"))'`
- The set: `loops/final96` (79 loops, 96 grid, each proven from the approved 480 file). Build the page with `python3 mkdeploy.py final96`.
- Bill: 15 transactions, 142,289,109 gas (0.0142 ETH at a 0.1 gwei base, plus the 0.02 gwei tip: about 0.017 ETH). A claim costs a collector 75,776 gas.

## The ceremony (he signs every step in MetaMask; never above the base-fee guard, 0.1 gwei unless he raises it)
1. /gift/deploy/ → network Ethereum mainnet → CONNECT as greencross.eth. The fee line shows the base fee; sends are refused above the guard. Every send carries the page's own fee (maxFee = guard x 1.25 + tip): keep MetaMask's "site suggested".
2. a DEPLOY (the address is kept the moment it is sent), b SET GIFTS (13 batches; resumes; one send at a time; speed-up or cancel in MetaMask is fine), c SEAL (deadline in local time, at most 365 days; refuses a stray gift), d VERIFY must say ALL GREEN.
3. Set `NETS.mainnet.contract` in gift/shared.js, push, claim-test on /gift/, check /gift/all/.
4. Glamsterdam (EIP-8037) makes laying ~7x dearer: mainnet must be done before it forks (no mainnet date yet; Hoodi forks ~Oct 26).

## Holders (read from mainnet Oct 9)
All 79 are accounts with keys (42 plain, 37 with an EIP-7702 delegation): no contract holder. #76 has never sent a transaction and holds no ETH: it will likely need the airdrop after the deadline.
