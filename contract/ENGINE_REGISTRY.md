# ENGINE REGISTRY CEREMONY — BLACKMASS 21.0

The public box now runs BLACKMASS // PANDORA REV 21.0. The contract's
engine registry is append-only and built for exactly this moment.
Before the first mainnet mint, the owner signs two calls so every token
is stamped with the engine that actually birthed it:

1. `addEngine("BLACKMASS 21.0", "https://dithervoid.art/?dna=")`
2. `setCurrentEngine("BLACKMASS 21.0")`

How: Remix → load PANDORA.sol at 0xe3a029de59741aa0631b83194ac1893a922296eb
(At Address, MetaMask on MAINNET chainId 0x1, owner wallet
0x0dd399a7ed92283e4983c2974fe377070d67f4eb) → call addEngine with the two
strings, sign → call setCurrentEngine, sign. Two small transactions.

Until this is signed, mints would be stamped "EIDOLON E8.0" — wrong for
BLACKMASS loops. The ledger is virgin; sign this before the first seed.

Registry stays append-only: "EIDOLON E8.0" remains registered forever, so
if EIDOLON returns as the public engine one day, one setCurrentEngine
flips the stamp back. Tokens keep the engine of their era.
