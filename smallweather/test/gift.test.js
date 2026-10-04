const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const fs = require("fs"); const path = require("path"); const crypto = require("crypto");

/* Test loops: the exploration renders (any GIF bytes do; the contract never parses them).
   GIFT_DIR overrides; otherwise synthetic GIF-shaped bytes of the sizes that matter. */
function loops() {
  const dir = process.env.GIFT_DIR;
  if (dir && fs.existsSync(dir)) return fs.readdirSync(dir).filter(f => f.endsWith(".gif") && !f.startsWith("sheet")).sort().map(f => fs.readFileSync(path.join(dir, f)));
  return [40000, 24575, 24576, 65536, 1].map((n, i) => { const b = crypto.randomBytes(n); b.write("GIF89a", 0); return b; });
}
const sha = b => "0x" + crypto.createHash("sha256").update(b).digest("hex");
async function pad(m, args, ov = {}) {
  const g = await m.estimateGas(...args, ov);
  let L = g * 3n / 2n + 60000n; if (L < 250000n) L = 250000n; if (L > 15000000n) L = 15000000n;
  return { g, tx: await m(...args, { ...ov, gasLimit: L }) };
}
const CAP = 15000000;   // the pages' gas cap; mainnet (osaka, EIP-7825) refuses any transaction over 2^24 = 16,777,216
async function now() { return (await ethers.provider.getBlock("latest")).timestamp; }

async function setup(n = 3) {
  const sig = await ethers.getSigners();
  const artist = sig[0];
  const F = await ethers.getContractFactory("GIFT");
  const c = await F.deploy(); await c.waitForDeployment();
  const L = loops();
  const holders = sig.slice(1, 1 + n);
  for (let i = 0; i < n; i++) await (await c.setGift(holders[i].address, i + 1, L[i % L.length], { gasLimit: CAP })).wait();
  return { c, sig, artist, holders, L };
}

describe("SMALL WEATHER (GIFT.sol)", function () {
  it("is fixed to its deployer, named, and never holds ether", async () => {
    const { c, artist } = await setup(1);
    expect(await c.ARTIST()).to.equal(artist.address);
    expect(await c.owner()).to.equal(artist.address);
    expect(await c.name()).to.equal("SMALL WEATHER");
    await expect(artist.sendTransaction({ to: await c.getAddress(), value: 1 })).to.be.reverted;
  });

  it("stores every loop byte for byte, in parts, with its sha256", async () => {
    const { c, L } = await setup(Math.min(5, loops().length));
    const n = Number(await c.gifts());
    for (let id = 1; id <= n; id++) {
      const want = L[(id - 1) % L.length];
      const got = Buffer.from((await c.gif(id)).slice(2), "hex");
      expect(got.equals(want)).to.equal(true);
      expect(await c.gifHash(id)).to.equal(sha(want));
      expect((await c.parts(id)).length).to.equal(Math.ceil(want.length / 24575));
    }
  });

  it("only the artist lays loops; one gift per holder; a slot can be rebound before the seal", async () => {
    const { c, sig, holders, L } = await setup(2);
    await expect(c.connect(sig[5]).setGift(sig[5].address, 9, L[0])).to.be.revertedWithCustomError(c, "NotArtist");
    await expect(c.setGift(holders[0].address, 7, L[0])).to.be.revertedWithCustomError(c, "Bad");
    await expect(c.setGift(ethers.ZeroAddress, 7, L[0])).to.be.revertedWithCustomError(c, "Bad");
    await expect(c.setGift(sig[6].address, 0, L[0])).to.be.revertedWithCustomError(c, "Bad");
    await (await c.setGift(sig[6].address, 2, L[0], { gasLimit: CAP })).wait();     // rebind slot 2
    expect(await c.giftOf(holders[1].address)).to.equal(0n);
    expect(await c.giftOf(sig[6].address)).to.equal(2n);
    expect(await c.gifts()).to.equal(2n);
  });

  it("nothing is claimed before the seal; nothing is laid after it", async () => {
    const { c, holders, sig, L } = await setup(2);
    await expect(c.connect(holders[0]).claim()).to.be.revertedWithCustomError(c, "NotSealed");
    await expect(c.connect(sig[5]).seal((await now()) + 3600)).to.be.revertedWithCustomError(c, "NotArtist");
    await expect(c.seal(await now())).to.be.revertedWithCustomError(c, "Bad");
    await (await c.seal((await now()) + 3600)).wait();
    await expect(c.setGift(sig[7].address, 5, L[0])).to.be.revertedWithCustomError(c, "IsSealed");
    await expect(c.seal((await now()) + 7200)).to.be.revertedWithCustomError(c, "IsSealed");
  });

  it("a holder claims once; a second claim and a stranger's claim revert", async () => {
    const { c, holders, sig } = await setup(2);
    await (await c.seal((await now()) + 3600)).wait();
    const { tx } = await pad(c.connect(holders[0]).claim, []);
    const rc = await tx.wait();
    console.log("      claim gas used", rc.gasUsed.toString());
    expect(await c.ownerOf(1)).to.equal(holders[0].address);
    expect(await c.minted()).to.equal(1n);
    await expect(c.connect(holders[0]).claim()).to.be.revertedWithCustomError(c, "Claimed");
    await expect(c.connect(sig[9]).claim()).to.be.revertedWithCustomError(c, "NoGift");
  });

  it("tokenURI decodes back to the exact loop", async () => {
    const { c, holders, L } = await setup(2);
    await (await c.seal((await now()) + 3600)).wait();
    await expect(c.tokenURI(1)).to.be.reverted;                    // not yet claimed
    await (await c.connect(holders[0]).claim()).wait();
    const uri = await c.tokenURI(1);
    const gas = await ethers.provider.estimateGas({ to: await c.getAddress(), data: c.interface.encodeFunctionData("tokenURI", [1]) });
    console.log("      tokenURI view gas", gas.toString(), "uri chars", uri.length);
    expect(uri.startsWith("data:application/json;base64,")).to.equal(true);
    const j = JSON.parse(Buffer.from(uri.slice(29), "base64").toString("utf8"));
    expect(j.name).to.equal("SMALL WEATHER #1");
    expect(j.description).to.not.match(/—/);
    const img = Buffer.from(j.image.replace("data:image/gif;base64,", ""), "base64");
    expect(img.equals(L[0])).to.equal(true);
    expect(j.attributes[0].value.toLowerCase()).to.equal(holders[0].address.toLowerCase());
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
    expect((await ethers.provider.getCode(holders[0].address)).slice(0, 8)).to.equal("0xef0100");
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

  it("gas: laying a 64 KB loop fits one transaction", async () => {
    const [artist, h] = await ethers.getSigners();
    const c = await (await ethers.getContractFactory("GIFT")).deploy();
    const b = crypto.randomBytes(65536); b.write("GIF89a", 0);
    const est = await c.setGift.estimateGas(h.address, 1, b);
    const rc = await (await c.setGift(h.address, 1, b, { gasLimit: CAP })).wait();
    console.log("      setGift 64 KB: estimate", est.toString(), "used", rc.gasUsed.toString());
    expect(rc.gasUsed < 15000000n).to.equal(true);
  });
});
