const { expect } = require("chai");
const { ethers } = require("hardhat");
const H = require("./helpers");
const { ETH } = H;

/* THE HARDENING (Oct 2): one test per confirmed finding of the property suite. */
const bal = a => ethers.provider.getBalance(a);
async function burnOut() { await H.warp(30 * 3600 + 5); await H.mine(9010); }
async function conserved(storm, escrow = 0n) {
  const held = await bal(await storm.getAddress());
  expect(held).to.equal((await storm.vault()) + (await storm.seatPool()) + escrow);
}
async function founded(first = "0.3") {
  const S = await H.deployAll(); const sig = await ethers.getSigners();
  await S.storm.connect(sig[1]).bid({ value: ETH(first) });
  await burnOut(); await S.storm.settleCandle();
  return { ...S, sig };
}

describe("HARDENING", function () {
  it("bid spam before the window cannot make the settle unaffordable (only the window's bids are walked)", async () => {
    const S = await H.deployAll(); const sig = await ethers.getSigners();
    let v = ETH("0.05");
    for (let i = 0; i < 150; i++) { await S.storm.connect(sig[1 + (i % 5)]).bid({ value: v }); v = v + v / 20n + 1n; }   // 150 pre-window bids (the 5% step makes the 150th about 75 ETH), each refunded at once
    expect(await S.storm.bidsCount()).to.equal(150);
    await burnOut();
    const rc = await (await S.storm.settleCandle()).wait();
    expect(rc.gasUsed).to.be.lt(1_000_000n);
    expect(await S.storm.ownerOf(0)).to.equal(sig[1 + (149 % 5)].address);
    await conserved(S.storm);
  });

  it("inside the window each bid must climb 5%, so the bids the settle refunds stay few; 60 window bids settle well inside a block", async () => {
    const S = await H.deployAll(); const sig = await ethers.getSigners();
    await H.warp(24 * 3600 + 5);
    let v = ETH("0.05"); const before = [];
    for (let i = 0; i < 60; i++) { await S.storm.connect(sig[1 + (i % 8)]).bid({ value: v }); v = v + v / 20n; }
    await expect(S.storm.connect(sig[9]).bid({ value: v - 1n })).to.be.revertedWith("bid more");
    await H.warp(6 * 3600); await H.mine(9010);
    const rc = await (await S.storm.settleCandle()).wait();
    expect(rc.gasUsed).to.be.lt(6_000_000n);
    await conserved(S.storm);
  });

  it("the close is not known while bidding (revealBlock cannot be mined before the window ends) and a late settle cannot choose it", async () => {
    const S = await H.deployAll(); const sig = await ethers.getSigners();
    const rb = await S.storm.revealBlock(), open = await S.storm.candleOpen();
    const blk = await ethers.provider.getBlock("latest");
    expect(rb - BigInt(blk.number)).to.be.gte(BigInt((30 * 3600) / 12) - 2n);   // thirty hours of slots away
    await S.storm.connect(sig[1]).bid({ value: ETH("0.1") });
    await burnOut(); await H.mine(300);                                          // the hash of revealBlock is gone
    await S.storm.settleCandle();
    expect(await S.storm.candleClose()).to.equal(open + 30n * 3600n - 1n);        // the fixed rule, not a hash the settler picked
  });

  it("a seat holder who pays again keeps its share of its own payment; nothing is stranded in the pool", async () => {
    const { storm, sig } = await founded();
    const b = sig[2];
    await storm.connect(b).pledge({ value: ETH("0.3") });     // one seat (its own 20% went to the vault: no seats yet)
    await storm.connect(b).pledge({ value: ETH("0.3") });     // the only seat holder pays again
    // the 20% of the second pledge belongs to b's one seat and must have been paid to b
    expect(await storm.seatPool()).to.equal(0n);
    expect(await storm.pending(b.address)).to.equal(0n);
    await conserved(storm);
  });

  it("the last claimer can always claim (rounding never runs ahead of the pool)", async () => {
    const { storm, sig } = await founded();
    for (let i = 2; i < 9; i++) await storm.connect(sig[i]).pledge({ value: 3n + BigInt(i) });   // odd tiny seats
    for (let i = 2; i < 9; i++) await storm.connect(sig[i]).pledge({ value: ETH("0.0101") + BigInt(i) });
    for (let i = 2; i < 9; i++) await storm.connect(sig[i]).claim();
    await conserved(storm);
  });

  it("two hundred silent days are caught up in steps of thirty; the sale works again", async () => {
    const { storm, sig } = await founded();
    await storm.connect(sig[3]).pledge({ value: ETH("300") });   // a vault deep enough to buy two hundred unsold days
    const open = await storm.closeAfter(await storm.foundersEnd());
    await H.warpTo(open + 200n * 86400n);
    let calls = 0;
    for (;;) {
      const rc = await (await storm.sync()).wait(); calls++;
      expect(rc.gasUsed).to.be.lt(12_000_000n);
      const [, , close, isOpen] = await storm.onSale();
      expect(await storm.dead()).to.equal(false);
      if (isOpen) break;
      if (calls > 10) throw new Error("did not catch up");
    }
    expect(calls).to.be.gte(7);
    const [id, price] = await storm.onSale();
    await storm.connect(sig[4]).buy(id, 5, { value: price + price / 10n });
    expect(await storm.ownerOf(id)).to.equal(sig[4].address);
    await conserved(storm);
  });

  it("a buy or witness for a day that has closed is refused instead of landing on the next one", async () => {
    const { storm, sig } = await founded();
    await storm.connect(sig[3]).pledge({ value: ETH("10") });   // the vault buys the closed day, so the next one opens
    const open = await storm.closeAfter(await storm.foundersEnd());
    await H.warpTo(open + 100n); await storm.sync();
    const [id] = await storm.onSale();
    await H.warpTo((await storm.plates(id)).close + 1n);
    await expect(storm.connect(sig[4]).buy(id, 1, { value: ETH("5") })).to.be.revertedWith("that day is gone");
    await expect(storm.connect(sig[4]).witness(id, { value: ETH("0.1") })).to.be.revertedWith("that day is gone");
  });

  it("the price never rises: across every halving seam it only falls", async () => {
    const { storm } = await founded();
    const open = await storm.closeAfter(await storm.foundersEnd());
    await H.warpTo(open + 10n); await storm.sync();
    const D = await storm.plates(1);
    for (let k = 1; k <= 9; k++) {
      const seam = D.open + BigInt(8640 * k);
      const before = await storm.priceAt(1, seam - 1n), at = await storm.priceAt(1, seam), after = await storm.priceAt(1, seam + 1n);
      expect(at).to.be.lte(before); expect(after).to.be.lte(at);
    }
    let last = await storm.priceAt(1, D.open);
    for (let t = 0n; t < 86400n; t += 97n) { const p = await storm.priceAt(1, D.open + t); expect(p).to.be.lte(last); last = p; }
  });

  it("a bidder that answers refunds with a mountain of returned data cannot make the settle unaffordable", async () => {
    const S = await H.deployAll(); const sig = await ethers.getSigners();
    const B = await (await ethers.getContractFactory("Bomber")).deploy(await S.storm.getAddress());
    await H.warp(24 * 3600 + 5);
    let v = ETH("0.05");
    for (let i = 0; i < 40; i++) { await B.bid({ value: v }); v = v + v / 20n; }
    await S.storm.connect(sig[1]).bid({ value: v });
    await H.warp(6 * 3600); await H.mine(9010);
    const rc = await (await S.storm.settleCandle({ gasLimit: 16_777_216 })).wait();
    expect(rc.gasUsed).to.be.lt(5_000_000n);
    await conserved(S.storm);
  });

  it("a wallet that cannot take ether names where its refund goes", async () => {
    const S = await H.deployAll(); const [, a, b] = await ethers.getSigners();
    const R = await (await ethers.getContractFactory("Refuser")).deploy(await S.storm.getAddress());
    await R.bid({ value: ETH("0.05") });
    await S.storm.connect(a).bid({ value: ETH("0.06") });
    expect(await S.storm.owed(await R.getAddress())).to.equal(ETH("0.05"));
    await expect(R.pull()).to.be.revertedWith("failed");                      // it still cannot take ether itself
    const before = await bal(b.address);
    await R.pullTo(b.address);
    expect(await bal(b.address)).to.equal(before + ETH("0.05"));
    expect(await S.storm.owed(await R.getAddress())).to.equal(0n);
  });

  it("royalties go to the payee, who takes any payment; no plate can be sent to the contract", async () => {
    const { storm, sig } = await founded();
    const [rcv, amt] = await storm.royaltyInfo(0, ETH("1"));
    expect(rcv).to.equal(await storm.PAYEE()); expect(amt).to.equal(ETH("0.069"));
    await expect(storm.connect(sig[1]).transferFrom(sig[1].address, await storm.getAddress(), 0)).to.be.revertedWith("the vault takes no plates");
  });
});
