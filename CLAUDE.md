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
3. THE MANIFEST (public page, locked): monitor, CORRUPTION, VOID, CHROMA
   toggle, PALETTE grid (wrapped, never past an edge), SPLICE (52px button),
   DOWNLOAD/X/GARDEN/MINT row, SEED+DNA+RESURRECT, .brand header, 
   INSTRUCTIONS modal. NOTHING else may render. Studio organs stay at /f3.
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

## Current mission order
1. PROMPT A (docs/PROMPT_A_UI_REBUILD.md): rebuild public shell from zero.
2. User approval of evidence bundle.
3. PROMPT B (docs/PROMPT_B_MAINNET.md): mainnet ceremony.
4. gardens.html + showcase.html + loop pages.
5. Feedback cycles on the renderer (f3) continue forever.

Read repo HANDOFF.md for full history and named root causes of past defects.
