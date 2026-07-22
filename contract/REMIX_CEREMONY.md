# PANDORA DEPLOY CEREMONY
Same ritual as the Lazarus Sepolia rehearsal. Your keys never leave your machine.

## Compiler settings (Remix → Solidity Compiler)
- Compiler: 0.8.24
- EVM version: cancun
- Optimization: ON, runs 800
- Advanced: via-IR ON
Paste PANDORA.sol, compile, zero errors expected.

## Constructor arguments (Deploy panel)
1. _engineVersion:  EIDOLON E8.0
2. _rendererBase:   https://dithervoid.art/?dna=
3. _imageBase:      https://llirnynoyarbvtxcekwy.supabase.co/storage/v1/object/public/posters/
   (bucket created PUBLIC 2026-07-22, anon INSERT policy live; verified)

## Order of operations
1. SEPOLIA FIRST. Deploy, then in Remix call:
   - mintUnique(1234, "PNDR-TEST", "GREENCROSS", "POLE", 55, 48) with value 0.01 ETH
   - confirm the artist wallet received the fee, seedToToken(1234) == 1,
     uri(1) opens as valid JSON (paste the base64 into a decoder).
2. MAINNET. Check live gas on Etherscan first. Deploy cost observed in
   simulation: ~3.28M gas (≈0.016 ETH at 5 gwei). Deploy from any wallet;
   fees route to the hardcoded artist address regardless.
3. Send me the deployed address — I wire it into the site.

## Owner powers (and their limits)
- addEngine(version, base): register a NEW engine. Existing versions can
  NEVER be overwritten (append-only, enforced on-chain).
- setCurrentEngine(version): new mints stamp this version.
- setImageBase(base): move poster storage if ever needed.
- transferOwnership(addr).
The owner can never touch funds (none are held), never edit minted loops,
never unlock a seed.
