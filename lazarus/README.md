# LAZARUS

The DITHERVOID // PANDORA corpus — one ERC-1155 contract, one body of work.

Curators inscribe a loop's DNA on-chain for a flat fee (immutable ceiling,
adjustable only downward). Editions: 1/1 (the inscription IS the mint),
LIMITED (fixed supply), OPEN (time window, max 30 days). Collector payments
route 100% to the curator. Zero royalties, by doctrine. Metadata is fully
on-chain JSON carrying the DNA, the curator, their ENS name frozen at
inscription, and a keccak256 commitment to the canonical GIF. tokenURI
delegates to a swappable renderer so the corpus can graduate to a fully
on-chain resurrector without migration.

## Run the suite

    npm install
    npx hardhat test        # 15 passing

## Deploy (Ethereum mainnet)

Remix or hardhat. Compiler: solc 0.8.24 · EVM cancun · optimizer on (800 runs) · viaIR on.
Constructor: `(uint256 feeWei, address treasury)` — the fee is the immutable
ceiling; `lowerFee` can only descend. Verify on Etherscan with identical settings.

The live engine: https://dithervoid.art — GREENCROSS x Claude
