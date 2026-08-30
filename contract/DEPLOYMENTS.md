# PANDORA DEPLOYMENTS

## Sepolia (rehearsal) — 2026-07-22
- Contract: 0x48b1A56033d0a896232001d4C7072712C36CaB83
- Deploy tx: 0x4ddfdcd3dcb0031caff131a62b9813af9e519630a03e9e15d6bb79d47107a5b6 (block 11324009)
- Deployer/owner: 0x0dd399a7ed92283e4983c2974fe377070d67f4eb
- Compiler: 0.8.24+commit.e11b9ed9, cancun, optimizer 800, viaIR — deployed code 14,287 bytes (byte-identical size to the locally tested artifact)
- Source verified: Sourcify + Blockscout (auto, via Remix)
- Constructor: "EIDOLON E8.0" / "https://dithervoid.art/?dna=" / imageBase placeholder (REPLACE-ME)
- Rehearsal mint: token #1, seed 1234, PNDR-REHEARSAL-0001, UNIQUE — all traits verified on-chain; wrong-fee guard proven live; 0.01 fee auto-forwarded to artist wallet; contract holds 0.

## Sepolia v2 (THE SEALED) — 2026-07-23 — **ACTIVE, wired into the site**
- Contract: 0x5fc2ea02a6b7fb686ba691d84f9e07856e26e257
- Deploy tx: 0x338be0081ca793e186437b1554409bd08bf8ad96d035f6eb18eb6a3e0848eed8 (block 11330870, gas 3,842,325)
- Deployer/owner: 0x0dd399a7ed92283e4983c2974fe377070d67f4eb
- Compiler: 0.8.24+commit.e11b9ed9, cancun, optimizer 800, viaIR — deployed code 16,619 bytes,
  SHA-256 of code body byte-identical to the locally tested artifact
- Source verified: Sourcify (auto, via Remix)
- Constructor: "EIDOLON E8.0" / "https://dithervoid.art/?dna=" / posters bucket public URL
- Rehearsal: token #1 = seed 1270055651, card PNDR-AJXK-GBHT-8CJ8-ZZ00-5R48-0222-000B-9Y0M,
  UNIQUE, POLE, corr 50, void 45, CHROMA FULL SPECTRUM (new trait live on-chain);
  0.01 fee auto-forwarded to artist. THE SEALED first trade: listed 0.05 ETH →
  bought cross-wallet (0x6963c5…63ea) → seller credited exactly 0.05 in-tx,
  listing self-cleared, contract holds 0 wei.

## MAINNET — 2026-07-23 — **THE LEDGER. Wired into the site.**
- Contract: 0xe3a029de59741aa0631b83194ac1893a922296eb
- Deploy tx: 0x4566c7373914eb5628b3f53b9d07826806200d6805f5069f1792919a93525e0d (block 25592810, gas 3,842,325, ~0.0004 ETH at 0.095 gwei)
- Deployer/owner: 0x0dd399a7ed92283e4983c2974fe377070d67f4eb
- Compiler: 0.8.24+commit.e11b9ed9, cancun, optimizer 800, viaIR — deployed code 16,619 bytes;
  code-body SHA-256 byte-identical to the tested artifact AND the Sepolia v2 deploy
- Source verified: Sourcify + Blockscout (auto, via Remix)
- Constructor: "EIDOLON E8.0" / "https://dithervoid.art/?dna=" / posters bucket public URL
- On-chain state verified post-deploy: owner, ARTIST, FEE_UNIQUE 0.01, FEE_EDITION 0.001,
  currentEngine, engineRenderer, imageBase, listings() live
- nextId = 1 at flip: NO test mint — the first real seed is the artist's, chosen deliberately.


---

## A NOTE ON THE ENGINE STRING (added 2026-08-29)

All three deploys above carry the constructor value `"EIDOLON E8.0"`. That
string is the ledger's record of the era, not a claim about what the site is
running today — the site now runs **EIDOLON E9.2 CHIMERA**. The two are meant to
diverge: registry entries live forever and tokens keep the engine name of their
era, while the box keeps growing.

The thing that actually protects an older token is not the string but the card
version gate in the engine: a card minted before v6 renders on the engine it was
minted under, bit for bit, and all 51 canon bloodlines are re-rendered on both
engines and compared byte for byte before any build ships. Registry names are
bookkeeping; the gate is the promise.

See contract/ENGINE_REGISTRY.md for what should be signed before the first
mainnet mint. Nothing about the E9.x work changes that ceremony.
