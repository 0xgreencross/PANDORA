# HANDOFF — DITHERVOID / PANDORA LINEAGE
For the next Claude instance. Living document — kept cutoff-ready every session. Last updated 2026-07-19 after feedback cycle 6 (REV E5.0).
Read this whole file before touching anything.

## WHO YOU WORK FOR
Greencross (Daniel Gavilán, artist DITHERVOID), cryptoartist, Bali. Terse, allergic
to fluff and sycophancy, wants working proofs over explanations, direct correction
when wrong. His verdicts arrive as screenshots and curated vault exports. Style laws:
no em dashes in his artwork copy, no borders/outlines in DITHERVOID visuals (ask
first if one ever seems needed), terse clinical register for token/layer text.

## THE THREE BUILDS
Repo: github.com/0xgreencross/PANDORA · Live: dithervoid.art (GitHub Pages, custom domain)
- **TRUNK** `/index.html` — DITHERVOID PANDORA REV 13.0 baseline. DNA v4 (29 chars).
  Branch `rev13-baseline`, tag `v13.0-baseline`, commit fbb59895. Mainnet-ready,
  Sepolia rehearsal complete. DO NOT TOUCH except by promote ritual.
- **FORK ONE** `/f1/` — BLACKMASS // PANDORA REV 21.0 "THE ARBITER". DNA v5 (32
  chars, void/cap/locality genes). The feedback-machine instrument.
- **FORK THREE** `/f3/` — EIDOLON // PANDORA REV E8.0 "THE AUTONOMOUS CANON".

  ================= PRODUCTION STATE (2026-07-23, session end) =================
  CONTRACT — DONE. PANDORA.sol (ERC-1155) 16/16 EVM tests. Sepolia:
  0x48b1A56033d0a896232001d4C7072712C36CaB83 (Sourcify+Blockscout verified,
  rehearsal token #1 minted+verified incl fee forward + wrong-fee revert).
  MAINNET: ceremony fully specified in contract/REMIX_CEREMONY.md with the
  real posters URL; run it in a FRESH SESSION only AFTER the public shell is
  approved (animation_url targets the live site). ~3.3M gas.
  SUPABASE — DONE. Tables events/garden_items/likes/showcase + vault.rev live;
  PUBLIC bucket `posters` created with anon INSERT policy (no update/delete =
  posters immutable). Project ref llirnynoyarbvtxcekwy.
  PUBLIC ROOT — FUNCTIONAL BUT REJECTED ON UX. Current index.html = E8 engine
  + transplanted trunk CSS + public layer + skin layers: cascade wars caused
  recurring defects (caption over art in RENDERED state — my centering
  !important beats engine inline hide; shell re-kidnaps organs on resize;
  studio entombed in #studiograve after .remove() broke applyCard).
  Working & proven: mint modal + hand-rolled ABI encoder (byte-identical to
  ethers), garden personal_sign save, poster upload, ?dna= deep link,
  seed watchdog, box roll fires, palette wraps in-edge, PANDORA_PUBLIC guard
  (public rolls never train canon).
  NEXT SESSION MANDATE — REBUILD, DON'T PATCH: new clean shell, author 100%
  of layout CSS, engine embedded headless (#legacy-root hidden), manifest
  controls wired by direct calls (pandorize/generate/applyCard/SCHEMES),
  STATE MATRIX verification (STANDBY/RENDERING/RENDERED/SPLICE/MINT states
  x six sizes), evidence bundle before "ready". User holds the exact prompt.
  MANIFEST (locked): monitor, corruption, void, chroma toggle, palette grid,
  SPLICE 52px, download/X/garden/mint row, seed+dna+resurrect, .brand header
  (magenta DITHER cyan VOID, harvested from /original), instructions modal.
  NOTHING else. Studio lives at /f3 only.
  THEN: gardens.html + showcase.html (plumbing exists in layer fns),
  loop pages, mainnet ceremony, flip W3 CONFIG to mainnet, ship.
  Session PAT ends …vkkBT — USER MUST REVOKE.
  ---- 2026-07-22 UPDATE (this session) ----
  SHELL REBUILT AND SHIPPED: main d076b15 (PUBLIC SHELL 1.0, clean shell,
  engine headless in #legacy-root, gate passed 6 sizes + functional walk),
  05e51e9 (X share = f3 X-SAFE TRANSMISSION verbatim). SHARING LAW: no URLs
  in tweets, ever (kills reach) — glitch-tongue + card + "dithervoid dot art"
  spelled out. /original linked from NOWHERE. ROOMS SHIPPED: gardens.html,
  showcase.html, sealed.html (THE SEALED = the marketplace room; header nav
  on the box). Likes = LOOPS everywhere (wallet+card). Every saved/minted
  loop click-resurrects via /?dna=. CONTRACT V2: PANDORA.sol grew THE SEALED
  secondary market (list/delist/buy inside the 1155, internal balance moves,
  no approvals/escrow, SELLER 100%, contract holds 0; 1/1s tradable). 34/34
  in-process EVM tests at pinned solc 0.8.24+e11b9ed9/cancun/800/viaIR.
  NEXT: v2 Sepolia rehearsal ceremony (user signs in Remix), flip W3.contract
  in index.html + sealed.html, THEN mainnet ceremony on v2. The v1 Sepolia
  0x48b1… remains rehearsal history. LOCAL SYNC LAW: every push same-turn
  syncs his PANDORA-PROJECT/repo clone (see Cowork memory).
  ---- 2026-07-23 MAINNET ----
  PANDORA v2 IS ON MAINNET: 0xe3a029de59741aa0631b83194ac1893a922296eb
  (deploy tx 0x4566c737…525e0d, block 25592810, Sourcify+Blockscout verified,
  code byte-identical to tested artifact). Site W3 flipped to mainnet
  (chainId 0x1, ethereum-rpc.publicnode.com + 1rpc.io/eth, etherscan.io).
  Ledger virgin at flip (nextId 1) — first real seed is the artist's.
  Sepolia v2 0x5fc2ea02 remains rehearsal history (token #1 + first trade).
  ==============================================================================
  The ground-up 3D rebuild and ACTIVE instrument. Same DNA v5. Approved look =
  E4.0 TABULA RASA; cycle-6 census on it: 37 keeps in one sitting, all ten
  dialects kept, "very much close to what I have envisioned". Machine settings
  = E4.0 values exactly. ORACLE_CANON = the 25 pure TABULA-RASA-era keeps.
  BREEDING IS PARKED (BREED_P=0.0 in machineRoll): when the dormant-canon bug
  was fixed in E6.0 the breeding arm woke and its hybrid children were the
  pulls he REJECTED — raise BREED_P only deliberately, with his approval
  (0.35 was the E6.0 rate). Era stamping: every vault store carries
  rev:'EIDOLON <REV_SELF>' and the EXPORT JSON carries rev per entry
  (Supabase vault table needs a nullable text column `rev`; engine falls back
  gracefully without it). E5.x lesson recorded: widening roll bands to match
  keep RANGES overfits outliers — aim at the center. Era-gate stamp-less
  legacy cards via deploy-history timestamps (audit + pure census in outputs:
  cycle6_era_audit.json, census_cycle6_pure.json).
  E7.1: TRANSMIT renders panel state exactly (no rolls — fate = box/skull/dice
  only); seg + ribbon active states solid oxide via aria-pressed; all control
  rows wrap on >=560px screens (no hidden swipe rows anywhere).
  E8.0 THE AUTONOMOUS CANON: sbEvent logs every fate pull ('roll') and gavel
  burial ('reject', optional reason BODY/PALETTE/MATERIAL/COMPO/WOUNDS) to a
  Supabase `events` table (localStorage ring 'PANDORA_EVT' fallback, both
  rev-stamped). learnFromVault() at load computes per-gene keep-rates
  (keeps+1)/(rolls+4) over dialect/palette/void-decile/corr-decile/skeleton;
  3 same-gene burials = x0.15, 6 = 0.02; reweights the CANON ARM live via
  lPick once >=30 rolls are logged; frontier arm stays wild; falls back to E4
  bands until then. HE MUST CREATE the events table: columns ts int8,
  type text, card text, reason text null, rev text null; same anon RLS as
  vault. Feedback cycles now focus on RENDERER evolution; parameter taste
  runs itself from his gavel and keeps.
Kill ritual: delete the fork dir. Promote ritual: copy fork index.html over root.
FORK.md in repo documents this.

## DEPLOYMENT MECHANICS (SACRED)
- A GitHub fine-grained PAT is provided FRESH each session (Contents R/W on PANDORA).
  NEVER store it. Remind him to REVOKE it at session end.
- Push via Contents API PUT to the file path (low-level git-data commits may not
  trigger Pages builds; Contents PUT does). Every engine change ships in the SAME turn.
- Working copies restore from /mnt/user-data/outputs/: BLACKMASS_PANDORA.html (f1),
  EIDOLON_PANDORA.html (f3), PANDORA_v13-BASELINE.html (trunk snapshot).
- Claude-side web_fetch persistently 404s /f1/ while root fetches fine; his browser
  works. Ignore it.

## VALIDATION RITUAL (NO PUSH WITHOUT IT)
1. Regenerate the engine JS from the FIRST <script> block EVERY time before testing
   (second block = UI shell, f1 only). `node --check` both.
2. id audit: every $('id') in engine must exist in markup (whitelist: mb-gal).
3. Harness: node vm with a Proxy DOM stub — stubs need `children:[]` arrays; the vm
   stub's dispatchEvent is a no-op so state-via-input-listener is UNTESTABLE there:
   test at the applyCard seam (wrap applyCard, capture the card object).
4. Prove new features with numbers (determinism, loop-seal at theta+2π, ranges).
5. Push, then present_files the outputs copy.
Container flaps sometimes: retry pings; when revived use single mega-commands.

## F1 — BLACKMASS ARCHITECTURE (REV 21.0)
- **The Perfect Machine**: PIN ledger (any control the curator touches pins; dice
  returns all pins to fate; resurrections pin everything via applyCard wrapper with
  ORACLE_APPLY guard). machineRoll(opts) rides ALL rituals: TRANSMIT, dice,
  pandorize (tap the monitor = his main slot-pull), OBLIVION (corrLo:68 corrHi:96
  canonP:0.40 = his max-hunger ritual). 60% canon / 40% frontier; 35% of fully-free
  canon rolls BREED two of ORACLE_CANON's **51 embedded bloodlines** via breedCards.
- Canon bands (from cycle-5 census): corr 45-74, void 38-58, locality 45-95, cap 12%.
  Free MASS seeds rejection-sampled 60% toward skeletons arr 5 (strata) / 7 (drape).
- Art: ATELIER SDF bodies (8 skeletons x 8 primitives = 64 classes, raymarched,
  orbiting key light), codec wounds (real 8x8 DCT ghosts, Asendorf interval sort),
  sanctityRGB, lumenPass (embers), seamRip, compositeEcho = video-feedback recursion.
- KNOWN BUG (f1 only, unfixed): worker loop applies seamRip+lumenPass TWICE
  (double-strength on masters vs previews). Fixed in f3. Backport when asked.

## F3 — EIDOLON ARCHITECTURE (REV E4.0 TABULA RASA)
The old generator is deleted. One renderer:
- `sceneView(scene,theta)`: VG=88 perspective march per frame; turntable camera
  (eCam, auto-framed lens via theta-0 coverage probe stored as mf.fovK — MUST stay
  theta-0-deterministic or worker frame-splits seam); seeded mirror floor y=FLY=1.06
  (65% of scenes) with true marched reflections + contact shadow; corr-scaled
  geometric tears (surfTear, applied only when d<0.08 for speed).
- `renderScene`: material shading at SW=448 (famMat: ten dialects), hash grain (gh),
  fog, AO, exposure grade, sacred void (<0.05), then bilinear upscale to 1080 with
  4x4 Bayer ordered dither — the chunky-pixel signature is dead by design.
- **Ten material dialects**, positionally DNA-safe rename of MODES:
  MOLTEN,LATHE,ENGRAVED,BROADCAST,GRID,SATELLITE,SEDIMENT,VEINED,MASS,IDOL.
  Old cards resurrect as sculptures wearing their mode's material.
- IDOL = polygon path (idolMesh/renderIdol at FW, bilinear+dither upscale).
- 2D storm stack: retired (PROT=true everywhere) but code dormant in file.
  fringePass (silhouette chroma fringe, reads sv.kind) + lumenPass still run.
- Frame ~1.1s in the vm harness, roughly half in-browser; workers carry masters.
- STATUS: E4/E5 approved. Continue fine-tuning per feedback cycles. He saved
  many iterations expressly so the next model can tune from evidence.

## THE FEEDBACK MACHINE (STANDING PROTOCOL — memory edit #9)
He curates loops into the shared Supabase vault, sends the export JSON. Each cycle:
1. Dedupe: sort ts desc, STOP at first previously-analyzed card. Census JSONs live
   in /mnt/user-data/outputs/ (census_cycle3/4/5.json) — keep appending.
2. Parametric census (unpackCard: mode/scheme/corr/void/locality/cap/sigils; MASS
   fam via mulberry32(seed^0x14CE55)*64) + visual study (PIL contact sheet from
   thumbs, then VIEW it with your own eyes).
3. Diagnose taste. 4. Research skills for the diagnosed gap. 5. Refine + push.
6. Grow ORACLE_CANON with the new winners. Ratio law: 60% known direction / 40% new.
Vault export: card,thumb,ts (+`rev` since E5.1) columns (timestamp column is
`ts`, NOT created_at).
ERA GATING (E5.1+): every store stamps `rev:'EIDOLON <REV_SELF>'` (graceful
fallback if the Supabase `rev` column is missing — ask him to add a nullable
text column `rev` to the vault table if exports lack it). For cards WITHOUT a
rev stamp, date them against deploy history: fetch commit timestamps for the
fork's index.html and gate card `ts` against the revision's push time
(cycle-6 audit: /mnt/user-data/outputs/cycle6_era_audit.json — 12 of 37 keeps
predated TABULA RASA and were pruned from canon; pure census in
census_cycle6_pure.json). A timestamp proves a card too OLD for a build, never
that it came from that build — the rev stamp is the only hard proof.

## THE AESTHETIC CANON (LEARNED, 71 KEEPS ACROSS 5 CYCLES)
Subject on darkness always. Void sweet spot 45-51 (one glorious keep at V70/L100).
Corr ceiling ~73. Strata + drape-field skeletons dominate MASS taste. Palettes:
GENESIS lead, POLE/AIRNEON/POISONFROG/DES rising. Favored sigils: embers, bloom,
panes, melt, ghost, invert, lungs, runes, meta, entropy, chimera, kaleido, hilb,
tunnel, chrono. Doctrine: compose first, corrupt second; glitch is a MATERIAL on a
lit 3D body, not a screen storm; capped chroma reads cohesive; codec-authentic
wounds only; the void is sacred.

## PENDING QUEUE
1. E4.0 verdict → tune materials/camera/floor, or deeper rebuild.
2. Headless renderer (promised: render frames in-sandbox, look with own eyes,
   iterate before he judges). High value, unbuilt.
3. Backport worker double seam/lumen fix to f1.
4. Next feedback cycle: dedupe vs ALL SIX uploads (PANDORA_VAULT_2026-07-16.json,
   _1, __1_, 2026-07-17, 2026-07-18, 2026-07-19__1_). Census log in outputs:
   census_cycle3/4/5/6.json.
5. MAINNET Lazarus deploy (trunk): Sepolia rehearsal done at
   0x072B09Cf9F428cd09D771a75c3b9889Ba7a3E3CD; Remix solc 0.8.24, cancun,
   optimizer 800, viaIR; fee-recipient deploy, 0.01 ETH ceiling. Check live gas
   via Etherscan before quoting costs. Sepolia faucet: sepolia-faucet.pk910.de.
6. Renderer v2 on-chain SVG poster (fixes blank marketplace thumbs) — setRenderer
   swap path exists in Lazarus, no contract change needed.
7. REVOKE the session PAT — always remind him.

## HARD LESSONS (DO NOT RELEARN THE EXPENSIVE WAY)
- Ask where his finger actually is before installing features (the dice/oblivion
  saga cost three blind cycles). His rituals: tap the monitor, or OBLIVION.
- One writer: all genome changes through applyCard. Never juggle DOM+state manually.
- buildScene must carry `seed` in the scene literal (it once didn't; everything
  seed-derived was frozen and nobody could tell why variety died).
- Data over deduction: profile before optimizing; census before refining; and when
  a test fails, suspect the test's sampling before the engine.
- He will say "negligible change" if the OUTPUT SIGNATURE (resolution, dither,
  palette mapping) stays constant — surface identity dominates perception.
