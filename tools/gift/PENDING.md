# SMALL WEATHER: pending (Oct 4 2026, end of session 2)

The full state lives in the project doc `stormglass/gift_drop.md`. This file is the repo's copy of what is still open. If the two ever disagree, the project doc wins.

## His calls (ask him; nothing here is decided)
1. **Size of RAIN and STORM loops.**
   - A loop must fit one SET GIFTS transaction. `setGift` costs about 222 gas per byte (osaka: 63,000 B 14.00M, 66,500 B 14.77M). The pages cap a transaction at 15M, so `mkloops.py` caps a loop at **66,500 B**.
   - Survey (`survey_sky.json`, 300 addresses, weather as each seed picks it): SUN 39–55 KB, MOON 30–45, CLOUD 34–49, SNOW 45–61 all fit. RAIN 52–71 KB and STORM 54–72 KB do not always fit: 15 of 300 holders (about 5%; about 15% of RAIN and STORM holders) are over 66,500 B. A separate 240-seed sweep saw a STORM at 75.7 KB.
   - Options:
     - (a) Fewer drops, **only for the over-limit holders** (`"drops": n` in that holder's line of final_recipients.json; every other loop is untouched). Example: a STORM at 71,972 B fits at 65,731 B with 14 of its 21 drops.
     - (b) Raise the SET GIFTS gas cap to about 16.5M and the limit to about 73,500 B. That covers every loop in the survey, but not the far tail: mainnet refuses any transaction over 16,777,216 gas, about 75 KB.
     - (c) Fewer frames for everyone (changes every loop).
   - Recommended: (a), shown to him on the approval sheet.
2. **The horizon band.** Every SKY loop has a solid band with a lump at the horizon, where the vanishing-point rays bunch. It was in what he approved. Leave it unless he says to fix it.
3. **Symbol.** Drafted as `WEATHER`.
4. **On-chain description** (in `GIFT.sol`): "A small weather, made for one collector who answered. It came before STORMGLASS. The loop is on the chain, drawn from the hash of the address it was made for. dithervoid dot art. CC0. Greencross."
5. **Claim deadline.** If the field on the deploy page is left empty, the deadline is 7 days after SEAL is pressed, by the chain's clock. After it, AIRDROP UNCLAIMED opens.
6. **Open-claims reply:** "Your small weather is ready. Claim it at dithervoid dot art slash gift."
7. **Every string on the claim page** (site text he has not seen; approve in one pass):
   - title "DITHERVOID // SMALL WEATHER"; meta description "A small weather for each collector who answered. It came before STORMGLASS."
   - idle: "SMALL WEATHER" / "A small weather was made for each collector who answered. It came before STORMGLASS. Connect the address you posted to see yours."
   - before the deploy: "Claims are not open yet."
   - buttons: "CONNECT", "CLAIM"
   - no gift: "No small weather was made for 0x…. Connect the address you posted under the tweet."
   - reading: "Reading #N from the chain…"
   - before the seal: "SMALL WEATHER #N · made for 0x… · the claim opens soon"
   - claimable: "SMALL WEATHER #N · made for 0x… · free, you pay only the gas"
   - while claiming: "Confirm in your wallet…", "Claiming… 0x…"
   - after the claim: "SMALL WEATHER #N · made for 0x… · yours", "Plate Zero opens on founders' day. Pledge for a seat."
   - held by someone else: "SMALL WEATHER #N · made for 0x… · held by 0x…"
   - errors:
     - "No wallet in this browser."
     - "Switch your wallet to Ethereum."
     - "The wallet changed account: connect again."
     - "You declined in your wallet. Nothing was sent."
     - "The claim is not open yet."
     - "No small weather was made for this address."
     - "This small weather is already claimed."
     - "Could not reach the chain. Try again in a moment."
     - "Not enough ETH in this wallet for the gas."
8. **The post:** "N collectors, N small storms." Re-check the wording against SKY. Any new post needs his yes on the exact text and media.
9. **Sepolia rehearsal:** which second address of his to bind for the claim test, and whether he signs with MetaMask (rehearses his 7702 account) or lets the page's Sepolia burner deploy.

## Work, in order
1. Land this branch (see the project doc HANDOFF), run the checks, get his yes on the claim page copy, then push. Check that https://dithervoid.art/gift/ says "Claims are not open yet."
2. **X replies** under tweet 2106474385087566137, with the approved variants in the project doc.
   - The first reply starts the 72h cutoff.
   - Log every reply in `campaign/gift/recipients.md`.
   - Stay out of the browser during the other session's windows (UTC 20:00–21:30, 12:10–12:25, 14:05–14:45, 22:15–22:30). The windows override the one-hour reply rule; answer whatever waited as soon as a window ends.
3. **Sepolia rehearsal** on `/gift/deploy/` (rehearsal set; its mainnet option is disabled by design).
   - He signs DEPLOY, SET GIFTS and SEAL, then VERIFY must be all green.
   - Then a claim from `/gift/?net=sepolia&c=<address>` with a second address of his.
   - SEAL, AIRDROP and every mainnet button open a browser confirm. He clicks those buttons himself; the session never clicks them.
4. **At the cutoff:**
   - write `tools/gift/final_recipients.json` as `[{id, holder, handle}]`, with ENS resolved and both logged in recipients.md;
   - run `python3 mkloops.py final final_recipients.json`. If it exits 2, some loops are over the limit: ask him (call 1);
   - run `python3 mksheet.py final` and show him `loops/final/sheet.gif` (the exact files, labelled). **Stop for his yes.**
5. **Mainnet:**
   - run `python3 mkdeploy.py final`, push, hard-reload `/gift/deploy/`, and check the header says "Loop set final: N loops";
   - show him the cost: the sum of the SET GIFTS gas (about 222 gas per loop byte) plus the deploy (about 2M), times the current base fee, in ETH;
   - **stop for his green light**;
   - he signs DEPLOY, SET GIFTS and SEAL as greencross.eth, then VERIFY must be all green;
   - set `NETS.mainnet.contract` in `gift/index.html` and push;
   - open https://dithervoid.art/gift/ in his Chrome, CONNECT as greencross.eth (or any recipient address he controls), and check the page reads the mainnet contract before any reply goes out.
6. Reply to each recipient with the approved wording. Then the post, after his yes.

## Environment notes
- **Determinism guard:** `python3 mkloops.py rehearsal rehearsal_recipients.json` must exit 0 and must not STOP. Session 2 rendered on Linux, Python 3.13.16, numpy 2.5.3, Pillow 12.3.0, pycryptodome 3.23.0. If a machine renders different bytes, render in a container that matches.
- **Before `mkdeploy.py`:** run `npm ci` and `npx hardhat compile` in smallweather/. Then check the runtime hash with the command below; it must print 9eb00ffc3b105f20f2d5ffaa00984fb139f27cd6cc987abe92a4b229d358c412.
  `node -e 'const a=require("./artifacts/contracts/GIFT.sol/GIFT.json");console.log(require("crypto").createHash("sha256").update(Buffer.from(a.deployedBytecode.slice(2),"hex")).digest("hex"))'`
- **A laid slot cannot be deleted**, only rebound to another holder before SEAL. Never SEAL with a wrong slot; rebind it or redeploy.
- **tokenURI** is a view call of about 211 gas per loop byte: about 9M at 42 KB, about 14M at 66 KB.

## Proofs already in hand
- Every SKY loop closes at the seam: the frame at the UNFOLDED phase u=1.0 is byte-identical to frame 0 (`sw.closes`). Checked on 360 seeds, 60 per weather, with a negative control: u=0.5 and u=0.025 differ from u=0.
- The GIF encoder decodes pixel-exact in PIL.
- The same address gives the same sha256 across runs and machines of the session 2 stack.
- `GIFT.sol` passes 9/9 under cancun and osaka, including an EIP-7702 claimer.
- `e2e.js` on an osaka local chain:
  - deploy, lay 3 loops, seal;
  - VERIFY all green: the code matches, and every loop reads back as its approved sha256;
  - claim from the deploy page; tokenURI = the approved loop;
  - claim from `/gift/`;
  - airdrop after the deadline.
- Also checked on the pages:
  - the mainnet option is disabled on a rehearsal-built page;
  - a second DEPLOY is refused;
  - a double click on SET GIFTS sends one transaction per loop;
  - the GIFT address survives a reload;
  - a declined claim says so;
  - switching to an address with no gift clears the previous loop;
  - a dead public RPC falls back to the wallet;
  - the claim page fills the stage at 320x568 up to 3840x2160 with no scroll.
