const { expect } = require("chai");
const { ethers } = require("hardhat");

const FEE = ethers.parseEther("0.003");
const DNA1 = "PNDR-4M12-6KQX-4P20-ZW03-000G-1ER";
const DNA2 = "PNDR-457Z-VMHD-6NHG-ZZ40-8M04-098";
const HASH = ethers.keccak256(ethers.toUtf8Bytes("fake-gif-bytes"));

describe("LAZARUS — the corpus", () => {
  let laz, house, alice, bob, carol;

  beforeEach(async () => {
    [house, alice, bob, carol] = await ethers.getSigners();
    laz = await (await ethers.getContractFactory("Lazarus")).deploy(FEE, house.address);
  });

  const inscribe = (who, dna, kind, max, price, end, ens = "greencross.eth") =>
    laz.connect(who).inscribe(dna, "VOID*SCANS*SIGNAL*C62*F36", ens, HASH, kind, max, price, end, { value: FEE });

  it("inscription charges the flat fee, routes it to treasury, mints copy #1 to curator", async () => {
    const before = await ethers.provider.getBalance(house.address);
    await inscribe(alice, DNA1, 0, 1, 0, 0);
    expect(await laz.balanceOf(alice.address, 1)).to.equal(1n);
    expect(await ethers.provider.getBalance(house.address)).to.equal(before + FEE);
  });

  it("wrong fee refused; duplicate DNA refused", async () => {
    await expect(laz.connect(alice).inscribe(DNA1, "t", "", HASH, 0, 1, 0, 0, { value: FEE - 1n }))
      .to.be.revertedWithCustomError(laz, "WrongFee");
    await inscribe(alice, DNA1, 0, 1, 0, 0);
    await expect(inscribe(bob, DNA1, 0, 1, 0, 0)).to.be.revertedWithCustomError(laz, "DnaTaken");
  });

  it("1/1: the inscription IS the mint; nobody can collect", async () => {
    await inscribe(alice, DNA1, 0, 1, 0, 0);
    await expect(laz.connect(bob).collect(1, 1, { value: 0 }))
      .to.be.revertedWithCustomError(laz, "SoldOut");
  });

  it("LIMITED: collectors pay the curator 100%, supply enforced", async () => {
    const price = ethers.parseEther("0.01");
    await inscribe(alice, DNA1, 1, 3, price, 0);          // curator holds #1 of 3
    const before = await ethers.provider.getBalance(alice.address);
    await laz.connect(bob).collect(1, 2, { value: price * 2n });
    expect(await ethers.provider.getBalance(alice.address)).to.equal(before + price * 2n);
    expect(await laz.balanceOf(bob.address, 1)).to.equal(2n);
    await expect(laz.connect(carol).collect(1, 1, { value: price }))
      .to.be.revertedWithCustomError(laz, "SoldOut");     // 3/3 minted
  });

  it("OPEN: unlimited within the window, dead after it", async () => {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const price = ethers.parseEther("0.002");
    await inscribe(alice, DNA1, 2, 0, price, now + 3600);
    await laz.connect(bob).collect(1, 5, { value: price * 5n });
    expect(await laz.balanceOf(bob.address, 1)).to.equal(5n);
    await ethers.provider.send("evm_increaseTime", [3700]);
    await ethers.provider.send("evm_mine");
    await expect(laz.connect(carol).collect(1, 1, { value: price }))
      .to.be.revertedWithCustomError(laz, "SaleClosed");
  });

  it("OPEN window cannot exceed 30 days; edition shapes validated", async () => {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await expect(inscribe(alice, DNA1, 2, 0, 0, now + 31 * 86400))
      .to.be.revertedWithCustomError(laz, "BadEdition");
    await expect(inscribe(alice, DNA1, 1, 1, 0, 0))       // LIMITED with max 1
      .to.be.revertedWithCustomError(laz, "BadEdition");
    await expect(inscribe(alice, DNA1, 0, 2, 0, 0))       // ONE with max 2
      .to.be.revertedWithCustomError(laz, "BadEdition");
  });

  it("wrong payment rejected exactly", async () => {
    const price = ethers.parseEther("0.01");
    await inscribe(alice, DNA1, 1, 5, price, 0);
    await expect(laz.connect(bob).collect(1, 2, { value: price }))
      .to.be.revertedWithCustomError(laz, "WrongPayment");
  });

  it("fee promise: lower yes, raise never, ceiling immortal", async () => {
    await laz.lowerFee(ethers.parseEther("0.001"));
    expect(await laz.inscriptionFee()).to.equal(ethers.parseEther("0.001"));
    await expect(laz.lowerFee(ethers.parseEther("0.002")))
      .to.be.revertedWithCustomError(laz, "FeeUpOnly");
    expect(await laz.FEE_CEILING()).to.equal(FEE);
  });

  it("dual-key curation: curator hides own, house tiers any, neither blocks transfer", async () => {
    await inscribe(alice, DNA1, 0, 1, 0, 0);
    await laz.connect(alice).setCuratorHidden(1, true);
    await expect(laz.connect(bob).setCuratorHidden(1, true))
      .to.be.revertedWithCustomError(laz, "NotCurator");
    await laz.setHouseTier(1, 2);
    // hidden on every axis, yet transfers freely — credible neutrality
    await laz.connect(alice).safeTransferFrom(alice.address, bob.address, 1, 1, "0x");
    expect(await laz.balanceOf(bob.address, 1)).to.equal(1n);
  });

  it("metadata: on-chain JSON carries DNA, curator, ENS epitaph, edition", async () => {
    await inscribe(alice, DNA1, 1, 7, ethers.parseEther("0.01"), 0, "greencross.eth");
    const u = await laz.uri(1);
    expect(u.startsWith("data:application/json;base64,")).to.equal(true);
    const json = JSON.parse(Buffer.from(u.split(",")[1], "base64").toString());
    expect(json.name).to.equal("PANDORA N\u00ba1");
    expect(json.animation_url).to.equal("https://dithervoid.art/?mint=1");
    const attrs = Object.fromEntries(json.attributes.map(a => [a.trait_type, a.value]));
    expect(attrs.DNA).to.equal(DNA1);
    expect(attrs["CURATOR ENS"]).to.equal("greencross.eth");
    expect(attrs.CURATOR).to.equal(alice.address.toLowerCase());
    expect(attrs.EDITION).to.equal("LIMITED 7");
  });

  it("renderer swap: owner redirects tokenURI without touching genomes", async () => {
    await inscribe(alice, DNA1, 0, 1, 0, 0);
    const Mock = await ethers.getContractFactory("MockRenderer");
    const mock = await Mock.deploy();
    await laz.setRenderer(await mock.getAddress());
    expect(await laz.uri(1)).to.equal("resurrected:1");
    const g = await laz.genomes(1);
    expect(g.dna).to.equal(DNA1);                          // genome untouched
  });

  it("EXPLOIT DEAD: amount bomb on a free open edition is rejected", async () => {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await inscribe(alice, DNA1, 2, 0, 0, now + 3600);          // price 0, open
    await expect(laz.connect(bob).collect(1, 1n << 40n, { value: 0 }))
      .to.be.revertedWithCustomError(laz, "BadEdition");
    await laz.connect(bob).collect(1, 10000, { value: 0 });     // sane bulk still fine
    expect(await laz.balanceOf(bob.address, 1)).to.equal(10000n);
  });

  it("EXPLOIT DEAD: JSON injection in ens/traits/dna is rejected", async () => {
    await expect(laz.connect(alice).inscribe(DNA1, 't', '","pwn":"x', HASH, 0, 1, 0, 0, { value: FEE }))
      .to.be.revertedWithCustomError(laz, "BadEdition");
    await expect(laz.connect(alice).inscribe(DNA1, 'evil\\"traits', '', HASH, 0, 1, 0, 0, { value: FEE }))
      .to.be.revertedWithCustomError(laz, "BadEdition");
    await expect(laz.connect(alice).inscribe('PNDR-<script>-XX', 't', '', HASH, 0, 1, 0, 0, { value: FEE }))
      .to.be.revertedWithCustomError(laz, "BadEdition");
  });

  it("ownership transfer is two-step (no fat-finger loss)", async () => {
    await laz.transferOwnership(bob.address);
    expect(await laz.owner()).to.equal(house.address);          // not yet
    await laz.connect(bob).acceptOwnership();
    expect(await laz.owner()).to.equal(bob.address);
  });

  it("second inscription gets id 2; dna index maps both", async () => {
    await inscribe(alice, DNA1, 0, 1, 0, 0);
    await inscribe(bob, DNA2, 0, 1, 0, 0, "");
    expect(await laz.dnaToId(ethers.keccak256(ethers.toUtf8Bytes(DNA2)))).to.equal(2n);
    const u = await laz.uri(2);
    const json = JSON.parse(Buffer.from(u.split(",")[1], "base64").toString());
    const keys = json.attributes.map(a => a.trait_type);
    expect(keys.includes("CURATOR ENS")).to.equal(false);  // empty epitaph omitted cleanly
  });
});
