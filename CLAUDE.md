# CLAUDE.md — standing instructions for DITHERVOID // PANDORA

## Who you work for
GREENCROSS (Daniel), cryptoartist. Terse. Wants working proofs, not
explanations. Direct feedback. Will reject anything that fails his eye —
his eye is the spec. Never call something "ready" without evidence.

## Prime laws
1. REPO = TRUTH. github.com/0xgreencross/PANDORA, branch main. Pushing
   index.html deploys dithervoid.art (GitHub Pages). Push in the SAME turn
   as any approved change.
2. NEVER touch /f3 (his private studio), /f1 (historical), /original
   (aesthetic source of truth) unless explicitly ordered.
3. THE MANIFEST (public page, locked; amended by curator 2026-07-22):
   monitor, CORRUPTION, VOID, CHROMA toggle, PALETTE grid (wrapped, never
   past an edge), SPLICE (52px button), DOWNLOAD/X/GARDEN/MINT row,
   SEED+DNA+RESURRECT, .brand header with ROOMS NAV (GARDENS · SHOWCASE ·
   THE SEALED) next to INSTRUCTIONS, INSTRUCTIONS modal, X-SAFE TRANSMISSION
   modal (f3 behavior verbatim). NOTHING else may render. Studio stays at /f3.
   /original is linked from NOWHERE (dir stays, no UI path to it).
4. LAYOUT LAWS: app frame, one viewport, zero page scroll, 320px→4K.
   Art is king: largest, square, centered, contained at every size.
5. PANDORA_PUBLIC guard: public rolls/gavels NEVER train the canon.
   Curator-only learning (his /f3 sessions).
6. Contract compiler is PINNED: solc 0.8.24+commit.e11b9ed9, cancun,
   optimizer 800, viaIR. Never "upgrade" it. Bytecode identity is sacred.
7. Wallet boundary: Claude drives IDEs/browsers; the USER clicks
   Deploy/Transact and signs. Claude never touches MetaMask.
8. UI verdicts require EVIDENCE: screenshots at 1440x900, 1366x768,
   1280x800, 1024x768, 768x1024, 390x844 + state matrix
   (STANDBY/RENDERING/RENDERED/SPLICE/MINT-MODAL) + probe JSON,
   LOOKED at before reporting. Probes measure geometry; only eyes
   judge composition.

## Validation rituals (before ANY engine push)
Extract first <script> block → node --check → id audit ($('x') refs vs
id="x" in markup; whitelist mb-gal, gavel, chipstrip) → vm smoke test with
Proxy-stub DOM (see TESTING.md). For the contract: full in-process EVM
suite (see TESTING.md). No ritual, no push.

## Key constants
Artist wallet: 0x19A84bF7b5DA2C290CB0Ca42bf691dd6C2308359
Sepolia contract: 0x48b1A56033d0a896232001d4C7072712C36CaB83
Supabase: https://llirnynoyarbvtxcekwy.supabase.co (anon key in engine SB
config; RLS is the lock). Posters bucket: public, anon INSERT only.
Fees: UNIQUE 0.01 ETH, LIMITED/OPEN 0.001 ETH, auto-forwarded in-tx.

## Sharing law (permanent)
X transmissions NEVER contain URLs — links kill post reach. Format is canon:
glitch-tongue phrase + DNA card + "dithervoid dot art" spelled out + runes +
#DITHERVOID. Applies to every current and future share feature.

## THE ROOMS (shipped 2026-07-22)
gardens.html — every wallet a shelf; tap loop → /?dna= resurrection; likes.
showcase.html — works made with loops; submit form; source-loop resurrect.
sealed.html — THE SEALED: all minted loops; editions collect at creator price;
v2 secondary market (list/delist/buy incl. 1/1s, SELLER 100%) feature-detects
the v2 contract and awakens on deployment. Likes attach to LOOPS everywhere.

## Current mission order
1. DONE: public shell rebuilt (d076b15), X share f3-port (05e51e9),
   rooms + contract v2 (this push).
2. Sepolia rehearsal of PANDORA.sol v2 (Remix ceremony, user signs), then
   flip W3.contract in index.html + sealed.html to the v2 address.
3. PROMPT B (docs/PROMPT_B_MAINNET.md): mainnet ceremony ON V2.
4. Feedback cycles on the renderer (f3) continue forever.

Read repo HANDOFF.md for full history and named root causes of past defects.
