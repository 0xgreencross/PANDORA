const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const fs = require("fs"); const path = require("path"); const crypto = require("crypto"); const vm = require("vm");

/* GIFT v2. The real set lives in tools/gift/loops/final96 (79 loops at their 96 grid, the scenes).
   Synthetic loops cover the edges (one byte, one full part, one byte over). */
const SET = path.join(__dirname, "..", "..", "tools", "gift", "loops", "final96");
const MAN = JSON.parse(fs.readFileSync(path.join(SET, "manifest.json")));
require(path.join(__dirname, "..", "..", "tools", "gift", "sw.js"));          // the published renderer (globalThis.SW)
const real = MAN.loops.map(e => ({ ...e, b: fs.readFileSync(path.join(SET, e.file)), sc: scene(e) }));
function scene(e) { return BigInt(e.sky) | BigInt(e.land) << 8n | BigInt(e.weather) << 16n | BigInt(e.pair) << 24n | BigInt(e.thin) << 32n; }
function gifOf(n) { const b = crypto.randomBytes(n); b.write("GIF89a", 0); return b; }
const sha = b => "0x" + crypto.createHash("sha256").update(b).digest("hex");
async function pad(m, args, ov = {}) {
  const g = await m.estimateGas(...args, ov);
  let L = g * 3n / 2n + 60000n; if (L < 250000n) L = 250000n; if (L > 15000000n) L = 15000000n;
  return { g, tx: await m(...args, { ...ov, gasLimit: L }) };
}
const CAP = 15000000;   // the pages' gas cap; mainnet (osaka, EIP-7825) refuses any transaction over 2^24 = 16,777,216
async function now() { return (await ethers.provider.getBlock("latest")).timestamp; }
const json = uri => { expect(uri.startsWith("data:application/json;base64,")).to.equal(true); return JSON.parse(Buffer.from(uri.slice(29), "base64").toString("utf8")); };

async function setup(n = 3) {
  const sig = await ethers.getSigners();
  const c = await (await ethers.getContractFactory("GIFT")).deploy(); await c.waitForDeployment();
  const holders = sig.slice(1, 1 + n);
  for (let i = 0; i < n; i++) await (await c.setGift(holders[i].address, i + 1, real[i].sc, real[i].b, { gasLimit: CAP })).wait();
  return { c, sig, artist: sig[0], holders };
}

describe("SMALL WEATHER v2 (GIFT.sol)", function () {
  it("is fixed to its deployer, named, and never holds ether", async () => {
    const { c, artist } = await setup(1);
    expect(await c.ARTIST()).to.equal(artist.address);
    expect(await c.owner()).to.equal(artist.address);
    expect(await c.name()).to.equal("SMALL WEATHER");
    expect(await c.symbol()).to.equal("WEATHER");
    await expect(artist.sendTransaction({ to: await c.getAddress(), value: 1 })).to.be.reverted;
  });

  it("stores every loop byte for byte, and the scene", async () => {
    const { c } = await setup(5);
    for (let id = 1; id <= 5; id++) {
      const e = real[id - 1];
      expect(Buffer.from((await c.gif(id)).slice(2), "hex").equals(e.b)).to.equal(true);
      expect(await c.gifHash(id)).to.equal(sha(e.b));
      expect((await c.sceneOf(id)).map(Number)).to.deep.equal([e.sky, e.land, e.weather, e.pair, e.thin]);
    }
    expect(await c.gifts()).to.equal(5n);
  });

  it("only the artist lays; bad input is refused; one gift per holder; a slot can be rebound before the seal", async () => {
    const { c, sig, holders } = await setup(2);
    const r = real[0];
    await expect(c.connect(sig[5]).setGift(sig[5].address, 9, r.sc, r.b)).to.be.revertedWithCustomError(c, "NotArtist");
    await expect(c.setGift(holders[0].address, 7, r.sc, r.b)).to.be.revertedWithCustomError(c, "Bad");          // holder has one
    await expect(c.setGift(ethers.ZeroAddress, 7, r.sc, r.b)).to.be.revertedWithCustomError(c, "Bad");
    await expect(c.setGift(sig[6].address, 0, r.sc, r.b)).to.be.revertedWithCustomError(c, "Bad");
    await expect(c.setGift(sig[6].address, 7, r.sc, "0x")).to.be.revertedWithCustomError(c, "Bad");
    await expect(c.setGift(sig[6].address, 7, r.sc, gifOf(24576), { gasLimit: CAP })).to.be.revertedWithCustomError(c, "Bad");  // over one part
    for (const bad of [11n, 7n << 8n, 10n << 16n, 10n << 24n, 6n << 32n])
      await expect(c.setGift(sig[6].address, 7, bad, r.b)).to.be.revertedWithCustomError(c, "Bad");
    await (await c.setGift(sig[6].address, 7, r.sc, gifOf(24575), { gasLimit: CAP })).wait();                    // exactly one part
    await (await c.setGift(sig[7].address, 2, real[5].sc, real[5].b, { gasLimit: CAP })).wait();                 // rebind slot 2
    expect(await c.giftOf(holders[1].address)).to.equal(0n);
    expect(await c.giftOf(sig[7].address)).to.equal(2n);
    expect(await c.holderOf(2)).to.equal(sig[7].address);
    expect(Buffer.from((await c.gif(2)).slice(2), "hex").equals(real[5].b)).to.equal(true);
    expect(await c.gifts()).to.equal(3n);
    await expect(c.gif(99)).to.be.revertedWithCustomError(c, "NoGift");
    await expect(c.sceneOf(99)).to.be.revertedWithCustomError(c, "NoGift");
  });

  it("the seal needs a gift; nothing is claimed before it, nothing is laid after it", async () => {
    const { c, holders, sig } = await setup(2);
    await expect(c.connect(holders[0]).claim()).to.be.revertedWithCustomError(c, "NotSealed");
    await expect(c.connect(sig[5]).seal((await now()) + 3600)).to.be.revertedWithCustomError(c, "NotArtist");
    await expect(c.seal(await now())).to.be.revertedWithCustomError(c, "Bad");
    await (await c.seal((await now()) + 3600)).wait();
    await expect(c.setGift(sig[7].address, 5, real[0].sc, real[0].b)).to.be.revertedWithCustomError(c, "IsSealed");
    await expect(c.seal((await now()) + 7200)).to.be.revertedWithCustomError(c, "IsSealed");
    const empty = await (await ethers.getContractFactory("GIFT")).deploy();
    await expect(empty.seal((await now()) + 3600)).to.be.revertedWithCustomError(empty, "Bad");               // no gifts
  });

  it("a holder claims once; a second claim and a stranger's claim revert", async () => {
    const { c, holders, sig } = await setup(2);
    await (await c.seal((await now()) + 3600)).wait();
    const { tx } = await pad(c.connect(holders[0]).claim, []);
    console.log("      claim gas used", (await tx.wait()).gasUsed.toString());
    expect(await c.ownerOf(1)).to.equal(holders[0].address);
    expect(await c.balanceOf(holders[0].address)).to.equal(1n);
    expect(await c.minted()).to.equal(1n);
    await expect(c.connect(holders[0]).claim()).to.be.revertedWithCustomError(c, "Claimed");
    await expect(c.connect(sig[9]).claim()).to.be.revertedWithCustomError(c, "NoGift");
  });

  it("tokenURI: the hard-pixel SVG holds the exact loop, with the scene as traits", async () => {
    const { c, holders } = await setup(2);
    await (await c.seal((await now()) + 3600)).wait();
    await expect(c.tokenURI(1)).to.be.reverted;                    // not yet claimed
    await (await c.connect(holders[0]).claim()).wait();
    const uri = await c.tokenURI(1);
    const gas = await ethers.provider.estimateGas({ to: await c.getAddress(), data: c.interface.encodeFunctionData("tokenURI", [1]) });
    console.log("      tokenURI view gas", gas.toString(), "uri chars", uri.length);
    expect(gas < 30000000n).to.equal(true);
    const j = json(uri), e = real[0];
    expect(j.name).to.equal("SMALL WEATHER #1");
    expect(j.description).to.match(/STORMGLASS/); expect(j.description).to.match(/dithervoid dot art/); expect(j.description).to.not.match(/—/);
    expect(j.image.startsWith("data:image/svg+xml;base64,")).to.equal(true);
    const svg = Buffer.from(j.image.slice(26), "base64").toString("utf8");
    expect(svg).to.match(/viewBox="0 0 96 96"/); expect(svg).to.match(/image-rendering:pixelated/);
    const g = Buffer.from(svg.match(/data:image\/gif;base64,([^"]+)"/)[1], "base64");
    expect(g.equals(e.b)).to.equal(true);
    expect(j.animation_url).to.equal(undefined);                    // the SVG is the work, everywhere
    const A = Object.fromEntries(j.attributes.map(a => [a.trait_type, a.value]));
    expect(A["MADE FOR"].toLowerCase()).to.equal(holders[0].address.toLowerCase());
    expect([A.SKY, A.LAND, A.WEATHER, A.INK]).to.deep.equal([MAN.skies[e.sky], MAN.lands[e.land], MAN.weathers[e.weather], MAN.pairs[e.pair]]);
  });

  it("THE PROOF: the chain keeps each approved loop's 96 grid; the published renderer redraws the approved 480 file from the chain's numbers", async () => {
    const sig = await ethers.getSigners();
    const c = await (await ethers.getContractFactory("GIFT")).deploy();
    const pick = [1, 2, 75, 77, 79].map(id => real.find(e => e.id === id));     // includes both new thin levels
    for (let k = 0; k < pick.length; k++) await (await c.setGift(pick[k].holder, pick[k].id, pick[k].sc, pick[k].b, { gasLimit: CAP })).wait();
    for (const e of pick) {
      const g = Buffer.from((await c.gif(e.id)).slice(2), "hex");
      const s = (await c.sceneOf(e.id)).map(Number), h = await c.holderOf(e.id);
      const P = SW.PAIRS[s[3]], pal = [hx(P[1]), hx(P[2])];
      const fr = SW.frames(ethers.keccak256(h), SW.SKIES[s[0]], SW.LANDS[s[1]], SW.WEATHERS[s[2]], s[4], 40);
      expect(sha(Buffer.from(SW.gif(fr, pal, 4, 1)))).to.equal(sha(g));                       // the stored grid
      expect(sha(Buffer.from(SW.gif(fr, pal, 4, 5)))).to.equal("0x" + e.approved_sha256);     // the approved file
      console.log("      #" + e.id, SW.SKIES[s[0]] + "/" + SW.LANDS[s[1]] + "/" + SW.WEATHERS[s[2]], "thin", s[4], ": chain grid = renderer, renderer x5 = approved 480 file");
    }
  });

  it("the airdrop waits for the deadline, is the artist's alone, and skips the claimed", async () => {
    const { c, holders, sig } = await setup(3);
    const dl = (await now()) + 3600;
    await (await c.seal(dl)).wait();
    await (await c.connect(holders[1]).claim()).wait();
    await expect(c.airdropUnclaimed([1, 2, 3])).to.be.revertedWithCustomError(c, "TooEarly");
    await network.provider.send("evm_setNextBlockTimestamp", [dl]);
    await expect(c.connect(sig[8]).airdropUnclaimed([1, 3])).to.be.revertedWithCustomError(c, "NotArtist");
    await expect(c.airdropUnclaimed([1, 99])).to.be.revertedWithCustomError(c, "NoGift");
    await (await c.airdropUnclaimed([1, 2, 3])).wait();
    for (let i = 0; i < 3; i++) expect(await c.ownerOf(i + 1)).to.equal(holders[i].address);
    expect(await c.minted()).to.equal(3n);
    await expect(c.connect(holders[0]).claim()).to.be.revertedWithCustomError(c, "Claimed");
  });

  it("an EIP-7702 smart account (like greencross.eth) claims with padded gas and receives an airdrop", async () => {
    const { c, holders } = await setup(3);
    const BURN = "0x6107005b600190038060035700";
    const impl = "0x00000000000000000000000000000000000B0B0B";
    await network.provider.send("hardhat_setCode", [impl, BURN]);
    for (const h of [holders[0], holders[2]]) await network.provider.send("hardhat_setCode", [h.address, "0xef0100" + impl.slice(2)]);
    const dl = (await now()) + 3600;
    await (await c.seal(dl)).wait();
    const { g, tx } = await pad(c.connect(holders[0]).claim, []);
    expect((await tx.wait()).status).to.equal(1);
    console.log("      7702 claim estimate", g.toString());
    expect(await c.ownerOf(1)).to.equal(holders[0].address);
    await network.provider.send("evm_setNextBlockTimestamp", [dl + 1]);
    await (await c.airdropUnclaimed([2, 3])).wait();                // _mint: no receiver hook to fail
    expect(await c.ownerOf(3)).to.equal(holders[2].address);
  });

  it("THE BILL: the whole real set (79 loops) laid in batches under the 15M cap, tokenURIs readable", async () => {
    const sig = await ethers.getSigners();
    const F = await ethers.getContractFactory("GIFT");
    const dtx = await F.getDeployTransaction(); const dg = await ethers.provider.estimateGas({ ...dtx, from: sig[0].address });
    const c = await F.deploy(); const drc = await c.deploymentTransaction().wait();
    let total = drc.gasUsed, txs = 1;
    const H = real.map(() => ethers.Wallet.createRandom().address);
    let i = 0;
    while (i < real.length) {            // greedy: as many loops as fit under 12M by estimate
      let n = 1;
      while (i + n < real.length) {
        const s = real.slice(i, i + n + 1);
        const g = await c.setGifts.estimateGas(H.slice(i, i + n + 1), s.map(e => e.id), s.map(e => e.sc), s.map(e => e.b));
        if (g > 12000000n) break; n++;
      }
      const s = real.slice(i, i + n);
      const rc = await (await c.setGifts(H.slice(i, i + n), s.map(e => e.id), s.map(e => e.sc), s.map(e => e.b), { gasLimit: CAP })).wait();
      expect(rc.gasUsed < 15000000n).to.equal(true);
      total += rc.gasUsed; txs++; i += n;
    }
    const src = await (await c.seal((await now()) + 7 * 86400)).wait(); total += src.gasUsed; txs++;
    console.log("      deploy", drc.gasUsed.toString(), "(est", dg.toString() + ") · transactions", txs, "· TOTAL GAS", total.toString(),
      "· at 0.1 gwei", ethers.formatEther(total * 100000000n), "ETH");
    expect(await c.gifts()).to.equal(BigInt(real.length));
    for (const e of real) expect(await c.gifHash(e.id)).to.equal(sha(e.b)); 
    await network.provider.send("evm_increaseTime", [7 * 86400 + 1]);
    await (await c.airdropUnclaimed(real.slice(0, 40).map(e => e.id), { gasLimit: CAP })).wait();
    await (await c.airdropUnclaimed(real.slice(40).map(e => e.id), { gasLimit: CAP })).wait();
    /* every image (svg, ~0.5M gas each) for all 79; the full tokenURI (~11M gas) only for the largest loop and the last
       thinned one: hardhat's in-process node keeps ~1.5 GB per 10M-gas call, which a real node does not */
    for (const e of real) { const g = Buffer.from((await c.svg(e.id)).match(/base64,([^"]+)"/)[1], "base64"); expect(g.equals(e.b)).to.equal(true); }
    expect(json(await c.tokenURI(77)).name).to.equal("SMALL WEATHER #77");
    const big = real.reduce((a, x) => x.b.length > a.b.length ? x : a);
    const worst = await ethers.provider.estimateGas({ to: await c.getAddress(), data: c.interface.encodeFunctionData("tokenURI", [big.id]) });
    console.log("      tokenURI view gas for the largest loop (#" + big.id + ", " + big.b.length + " bytes):", worst.toString());
    expect(worst < 30000000n).to.equal(true);
  });
});
function hx(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
