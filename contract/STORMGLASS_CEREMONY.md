# STORMGLASS DEPLOY CEREMONY

The same law as before: your keys never leave your machine. The deploy page
drives everything from the browser; on mainnet MetaMask signs every step.

## What goes on the chain, in order

1. **Coats** (tiny): lays the token page on the chain, two chunks a transaction.
2. **The page, 14 chunks** (7 transactions, ~10.5M gas each, ~73M in all; mainnet
   refuses any single transaction above 16.7M gas since Fusaka): the whole
   token page (`glass/index.html`, engine, OS, print) gzipped and wrapped in three
   base64 coats so that tokenURI never encodes anything large. Coat sha256 is in
   `onchain/manifest.json`; VERIFY checks it on the chain.
3. **GLASS** (~11KB): tokenURI, the sky, the SVG card. Bound at construction to the
   STORMGLASS address predicted from the signer's next nonce.
4. **STORMGLASS** (~17KB): the ledger. Its constructor checks `GLASS.storm == this`.
   The candle starts burning the moment it lands.
5. **VERIFY**: coat sha, binding both ways, candleOpen, revealBlock, ARTIST.

Compiler, pinned: solc 0.8.24+commit.e11b9ed9, cancun, optimizer 800, viaIR
(the npm soljson build, the same commit Remix runs). Sources under
`stormglass/contracts/`. Tests: `cd stormglass && npm i && npx hardhat test`
(17 passing, including the clock against Intl for a year and a half).

## Settings set once (no dials afterwards, ever)

- ETH/USDC pool (the flood): mainnet `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640`
  (Uniswap v3, 0.05%). Sepolia: zero (the flood stays dry).
- USDC/USDT pool (the counterfeit): mainnet `0x3416cF6C708Da44DB2624D63ea0AAef7113527C6`
  (Uniswap v3, 0.01%). Sepolia: zero.
- ARTIST is a constant: greencross.eth `0x0DD399a7ED92283e4983C2974FE377070D67f4eB` (the artist, owner() for the
  marketplaces, Plate Zero if nobody bids). PAYEE is a constant: `0x19A84bF7b5DA2C290CB0Ca42bf691dd6C2308359`,
  where the seventy percent is sent (curator, Oct 2). greencross.eth deploys.
- Reserve 0.05 ETH (curator, Oct 2), halving 2.4h, candle 24h + window ≤ 6h, founders' day 24h,
  royalty 6.9% to the vault, 70/20/10.

## Sepolia first

1. Open `https://dithervoid.art/glass/deploy/` in Chrome. Network Sepolia, signer
   MetaMask (curator, Oct 2: greencross.eth signs the rehearsal and the mainnet
   deploy). CONNECT: the page asks MetaMask to stand on Sepolia and refuses to
   send anything while the wallet is on another chain. The wallet needs ~0.5
   Sepolia ETH (the deploy, then bids of 0.05 and 0.06).
2. a → b → c → d → e. Copy THE RECORD.
3. THE WALK: BID 0.05, BID 0.06 (the first is refunded at once; each bid at least 5%
   over the last), wait thirty hours (the day and the six-hour window, and revealBlock
   mined after it), SETTLE (the moment the candle went out is drawn now), PLEDGE, then
   SYNC after the next 4:20 Miami, WITNESS, BUY, READ tokenURI: the plate must render
   in the frame, from the chain alone.
4. Flip `CFG` at the top of the root `index.html` to the Sepolia record and walk
   the site.

## Mainnet (THE LEDGER)

Same page, network mainnet, signer MetaMask. Check live gas first: the whole set
is ~80M gas, no transaction above 11M. The candle starts at deploy: choose the
hour deliberately (it burns 24h, then goes out inside the next 6h). Then flip
`CFG` in the root `index.html` to the mainnet record and remove /workbench/.

## Before launch

- Remove `/workbench/` from the public site (or move it out of the repo): the
  token page at `/glass/` carries no workbench, but the folder itself is public.
- The deploy page can stay (it holds no secrets) or go.

## Decisions taken while building (each can be flipped before deploy)

- A witness's payment rides the same falling curve as the day's price (so a whale
  cannot make a day unsellable); it is added to the start price and halves with it.
- Plate Zero counts as the first sale in the median, so day one starts at four
  times the founding price and reaches it after two halvings.
- Founders' day seats are uncapped; days cap at one seat a wallet a day.
- The hour in the sky is Miami's (the collection's clock), not the viewer's.
- The image is an on-chain SVG card (title, seed); the plate lives in the
  animation. No image server, nothing to expire.
- If nobody bids, the artist takes Plate Zero and FOUNDING is the reserve.
- If nobody seals the candle for 256 blocks after the reveal block, the latest
  block hash stands in for the fixed one.
- Refunds that cannot be pushed (a contract that refuses ether) wait in `owed`
  for `withdraw()`.
