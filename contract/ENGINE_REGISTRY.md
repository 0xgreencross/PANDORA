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


---

## THE ENGINE HAS MOVED ON (recorded 2026-08-29)

The public box now runs **EIDOLON E9.2 CHIMERA**: the full corruption stack
behind a card-version gate, image and animated-GIF grafting, and the same 37
sigil channels E4.0 had — every one of them now actually reaching the picture,
which most of them did not before.

(E9.1 NOVA briefly doubled that vocabulary to 73. The curator judged the result
and rejected it, and E9.2 returns to the CHIMERA engine byte for byte. Cards
written during those hours still decode; they simply render without the sigils
this engine does not have.)

This does NOT change what the registry should say. Registry entries are for the
engine a token was minted under, and tokens keep the engine name of their era.
E4.0 TABULA RASA remains the name to register before the first mainnet mint,
exactly as described above.

What protects the older tokens is not the registry but the version gate: a card
written before v6 renders on the engine it was written for, bit for bit. All 51
canon bloodlines are re-rendered on both engines and compared byte for byte
before any build ships (`cert.js`, 51/51 at 0.0000%). If a future build ever
fails that gate, it does not ship — the registry cannot repair a token whose
pixels moved.
