# ENGINE REGISTRY CEREMONY — EIDOLON E4.0 TABULA RASA

The public box runs EIDOLON E4.0 TABULA RASA — chosen by the curator's eye
in the taste trial of 2026-07-24, the engine of the golden 07-19 sitting.
The registry is append-only and built for exactly this. Before the first
mainnet mint, the owner signs two calls:

1. `addEngine("EIDOLON E4.0", "https://dithervoid.art/?dna=")`
2. `setCurrentEngine("EIDOLON E4.0")`

How: Remix → PANDORA at 0xe3a029de59741aa0631b83194ac1893a922296eb
(Deployed Contracts, MetaMask on MAINNET chainId 0x1, owner wallet
0x0dd399a7ed92283e4983c2974fe377070d67f4eb) → addEngine with the two
strings, sign → setCurrentEngine, sign.

NOTE: an earlier staging of addEngine("BLACKMASS 21.0", …) was prepared but
NEVER signed — that name must not enter the registry. If a Remix tab still
shows those fields, they will be replaced before signing.

Until the two calls are signed, mints stamp "EIDOLON E8.0" (the deploy-time
constructor value). E8.0 and E4.0 are generatively identical builds of the
same engine; the E4.0 entry records the curator-approved revision. Registry
entries live forever: tokens keep the engine name of their era.
