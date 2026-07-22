# PANDORA v2 DEPLOY CEREMONY — THE SEALED EDITION
Same ritual as before. Your keys never leave your machine.

## Compiler settings (Remix → Solidity Compiler)
- Compiler: 0.8.24 (0.8.24+commit.e11b9ed9)
- EVM version: cancun
- Optimization: ON, runs 800
- Advanced: via-IR ON
Paste contract/PANDORA.sol (v2 — has THE SEALED market + CHROMA trait),
compile, zero errors expected. Deployed size must read ~16,619 bytes.

## Constructor arguments (Deploy panel)
1. _engineVersion:  EIDOLON E8.0
2. _rendererBase:   https://dithervoid.art/?dna=
3. _imageBase:      https://llirnynoyarbvtxcekwy.supabase.co/storage/v1/object/public/posters/

## Order of operations
1. SEPOLIA FIRST. Two funded wallets (A = you, B = second; faucet:
   sepolia-faucet.pk910.de). Deploy from A, verify via Sourcify (Remix auto).
2. REHEARSAL WALK (in Remix, wallet A unless noted):
   a. mintUnique(4321, "PNDR-V2-REHEARSAL", "GREENCROSS", "POLE", 55, 48, true)
      with value 0.01 ETH → artist wallet receives fee; seedToToken(4321)==1.
   b. uri(1) → base64-decode → CHROMA trait must read "CAPPED".
   c. list(1, 1, <price wei>) → listings(1, A) shows price+qty.
   d. WALLET B: buy(1, A, 1) with exact value → A receives 100%,
      balanceOf(B,1)==1, listing cleared.
   e. delist test: A mintLimited(5555, "PNDR-V2-ED", "GREENCROSS", "VAPOR",
      50, 40, false, 5, <price>) value 0.001 → B collect(2,1) with value →
      A paid; B list(2,1,<price>) → B delist(2) → listings cleared.
   f. Contract balance must read 0 the whole way.
3. Send me the deployed address — I flip W3.contract in index.html +
   sealed.html the same turn; THE SEALED's listings awaken; we walk the full
   trade on the live site.
4. MAINNET (PROMPT B): check live gas first (~3.70M gas to deploy). Same
   ceremony, same constructor args. Then I flip W3 to mainnet
   (chainId 0x1, explorer etherscan.io) and we ship.

## Owner powers (and their limits)
- addEngine / setCurrentEngine / setImageBase / transferOwnership.
The owner can never touch funds (none are ever held), never edit minted
loops, never unlock a seed, never touch listings — only sellers can.
