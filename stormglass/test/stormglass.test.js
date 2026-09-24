const { expect } = require("chai");
const { ethers } = require("hardhat");
const H = require("./helpers");
const { ETH } = H;

const ARTIST = "0x19A84bF7b5DA2C290CB0Ca42bf691dd6C2308359";
const bal = a => ethers.provider.getBalance(a);

/* the contract may hold only what it says it holds */
async function conserved(storm, escrow = 0n) {
  const held = await bal(await storm.getAddress());
  const vault = await storm.vault(), pool = await storm.seatPool();
  expect(held).to.equal(vault + pool + escrow);
}

describe("THE CLOCK", function () {
  let storm;
  before(async () => { ({ storm } = await H.deployAll()); });
  it("4:20pm in Miami, daylight saving followed, agrees with Intl for a year and a half of afternoons", async () => {
    const t0 = Math.floor(Date.UTC(2026, 0, 1) / 1000), t1 = Math.floor(Date.UTC(2027, 6, 1) / 1000);
    let checks = 0;
    for (let t = t0; t < t1; t += 5 * 3600 + 1234) {
      const got = Number(await storm.closeAfter(t)); const want = H.closeAfterJS(t);
      if (got !== want) throw new Error(`closeAfter(${t}) = ${got}, Intl says ${want} (${new Date(t * 1000).toISOString()})`);
      checks++;
    }
    expect(checks).to.be.greaterThan(2000);
  });
  it("the transition days themselves", async () => {
    for (const iso of ["2026-03-08T06:59:00Z", "2026-03-08T07:01:00Z", "2026-03-08T21:00:00Z", "2026-11-01T05:59:00Z", "2026-11-01T06:01:00Z", "2026-11-01T20:30:00Z", "2027-03-14T12:00:00Z", "2027-11-07T12:00:00Z"]) {
      const t = Math.floor(Date.parse(iso) / 1000);
      expect(Number(await storm.closeAfter(t))).to.equal(H.closeAfterJS(t), iso);
    }
  });
});

describe("THE CANDLE", function () {
  let storm, glass, a, b, c, d;
  beforeEach(async () => { ({ storm, glass } = await H.deployAll()); [, a, b, c, d] = await ethers.getSigners(); });

  it("refuses under the reserve and under the leader; refunds the outbid at once; rerolls the plate", async () => {
    await expect(storm.connect(a).bid({ value: ETH("0.009") })).to.be.revertedWith("bid more");
    const s0 = await storm.zeroSeed();
    await storm.connect(a).bid({ value: ETH("0.01") });
    const s1 = await storm.zeroSeed(); expect(s1).to.not.equal(s0);
    await expect(storm.connect(b).bid({ value: ETH("0.01") })).to.be.revertedWith("bid more");
    const before = await bal(a.address);
    await storm.connect(b).bid({ value: ETH("0.02") });
    expect(await bal(a.address)).to.equal(before + ETH("0.01"));           // a refunded in b's transaction
    expect(await bal(await storm.getAddress())).to.equal(ETH("0.02"));
    expect(await storm.bidsCount()).to.equal(2);
  });

  it("cannot be settled while it burns; the window escrows; the leader at the flame wins; the rest are refunded; FOUNDING is set; 70/30", async () => {
    await storm.connect(a).bid({ value: ETH("0.1") });
    await storm.connect(b).bid({ value: ETH("0.2") });
    await expect(storm.settleCandle()).to.be.revertedWith("the candle burns");
    // twenty-four hours pass, and the blocks with them
    await H.warp(24 * 3600 - 7210); await H.mine(7215);
    expect(await storm.candleClose()).to.equal(0);
    // a bid inside the window seals the candle and is escrowed (b is NOT refunded)
    const bBefore = await bal(b.address);
    await storm.connect(c).bid({ value: ETH("0.3") });
    expect(await bal(b.address)).to.equal(bBefore);
    const close = await storm.candleClose();
    const open = await storm.candleOpen();
    expect(close).to.be.gte(open + 24n * 3600n); expect(close).to.be.lt(open + 30n * 3600n);
    expect(await bal(await storm.getAddress())).to.equal(ETH("0.5"));     // b and c escrowed
    // d bids too, still inside the window? only if before close
    const t = await H.now();
    let dBid = false;
    if (BigInt(t) + 10n < close) { await storm.connect(d).bid({ value: ETH("0.4") }); dBid = true; }
    await H.warpTo(close + 1n);
    await expect(storm.connect(a).bid({ value: ETH("1") })).to.be.revertedWith("the candle is out");
    const artistBefore = await bal(ARTIST);
    const cBefore = await bal(c.address), bBefore2 = await bal(b.address);
    await storm.settleCandle();
    const winner = dBid ? d : c, winAmt = dBid ? ETH("0.4") : ETH("0.3");
    expect(await storm.ownerOf(0)).to.equal(winner.address);
    expect(await storm.FOUNDING()).to.equal(winAmt);
    expect(await bal(ARTIST)).to.equal(artistBefore + winAmt * 70n / 100n);
    expect(await storm.vault()).to.equal(winAmt - winAmt * 70n / 100n);
    expect(await bal(b.address)).to.equal(bBefore2 + ETH("0.2"));          // the pre-window leader, refunded at the end
    if (dBid) expect(await bal(c.address)).to.equal(cBefore + ETH("0.3")); // c outbid inside the window, refunded at the end
    await conserved(storm);
    const p0 = await storm.plates(0); expect(p0.sold).to.equal(true); expect(p0.buyer).to.equal(winner.address);
    expect(await storm.picksCount()).to.equal(1);
    await expect(storm.settleCandle()).to.be.revertedWith("settled");
  });

  it("nobody bids: the artist takes Plate Zero at the reserve", async () => {
    await H.warp(24 * 3600 + 5); await H.mine(7210);
    await storm.seal();
    await H.warpTo((await storm.candleClose()) + 1n);
    await storm.settleCandle();
    expect(await storm.ownerOf(0)).to.equal(ARTIST);
    expect(await storm.FOUNDING()).to.equal(ETH("0.01"));
  });

  it("a bidder that refuses ether is owed, and can withdraw", async () => {
    const R = await (await ethers.getContractFactory("Refuser")).deploy(await storm.getAddress());
    await R.bid({ value: ETH("0.05") });
    await storm.connect(a).bid({ value: ETH("0.06") });           // the refund to R fails and is owed
    expect(await storm.owed(await R.getAddress())).to.equal(ETH("0.05"));
    await expect(R.pull()).to.be.revertedWith("failed");          // it still refuses; the money waits
    await conserved(storm, ETH("0.06") + ETH("0.05"));
  });
});

/* a settled candle with FOUNDING 0.3, then founders' day */
async function founded() {
  const S = await H.deployAll(); const [, a, b, c, d, e] = await ethers.getSigners();
  await S.storm.connect(a).bid({ value: ETH("0.3") });
  await H.warp(24 * 3600 + 5); await H.mine(7210); await S.storm.seal();
  await H.warpTo((await S.storm.candleClose()) + 1n);
  await S.storm.settleCandle();
  return { ...S, a, b, c, d, e };
}

describe("FOUNDERS' DAY", function () {
  it("a pledge buys seats at the founding rate, uncapped, and notches Plate Zero; the day ends", async () => {
    const { storm, b, c } = await founded();
    await storm.connect(b).pledge({ value: ETH("0.6") });
    expect(await storm.seats(b.address)).to.equal(ETH("2"));               // two seats
    expect((await storm.witnessesOf(0)).length).to.equal(1);
    await storm.connect(c).pledge({ value: ETH("0.03") });
    expect(await storm.seats(c.address)).to.equal(ETH("0.1"));
    expect(await storm.totalSeats()).to.equal(ETH("2.1"));
    // c's 20% share went to the seats that existed (b's), b's own 20% went to the vault (no seats yet then)
    expect(await storm.pending(b.address)).to.equal(ETH("0.03") * 20n / 100n);
    await conserved(storm);
    await H.warp(24 * 3600 + 1);
    await expect(storm.connect(b).pledge({ value: ETH("0.1") })).to.be.revertedWith("not founders' day");
  });
});

describe("THE DAYS", function () {
  it("day one opens at the 4:20 after founders' day; the price starts at FOUNDING and halves every 2.4 hours", async () => {
    const { storm } = await founded();
    await H.warp(24 * 3600 + 1); await storm.sync();
    expect(await storm.today()).to.equal(0);                                // not yet 4:20
    const open = await storm.closeAfter(await storm.foundersEnd());
    await H.warpTo(open); await storm.sync();
    expect(await storm.today()).to.equal(1);
    const D = await storm.plates(1);
    expect(D.open).to.equal(open); expect(D.close).to.equal(await storm.closeAfter(open));
    // Plate Zero is the first sale, so the median is FOUNDING and day one starts at four times it
    expect(await storm.priceAt(1, open)).to.equal(ETH("1.2"));
    const half = await storm.priceAt(1, open + 8640n); expect(half).to.equal(ETH("0.6"));
    const q = await storm.priceAt(1, open + 4320n);                         // a half halving: 2^-0.5 = 0.7071
    expect(Number(q) / Number(ETH("1.2"))).to.be.closeTo(0.70711, 0.0005);
    expect(await storm.priceAt(1, open + 2n * 8640n)).to.equal(ETH("0.3"));
    const late = await storm.priceAt(1, open + 24n * 3600n); expect(late).to.be.lt(ETH("0.0015"));
    expect(await storm.priceAt(1, open + 100n * 86400n)).to.equal(0);
  });

  it("the first buy wins, refunds the excess, splits 70/20/10, seats the buyer, records the pick; tomorrow's seed follows", async () => {
    const { storm, b, c } = await founded();
    await storm.connect(c).pledge({ value: ETH("0.3") });                  // one seat, so the 20% has somewhere to go
    const open = await storm.closeAfter(await storm.foundersEnd());
    await H.warpTo(open + 3600n); await storm.sync();
    const [id, price, , isOpen] = await storm.onSale(); expect(id).to.equal(1); expect(isOpen).to.equal(true);
    await expect(storm.connect(b).buy(7, { value: price / 2n })).to.be.revertedWith("the price is higher");
    const artistBefore = await bal(ARTIST), vaultBefore = await storm.vault();
    const tx = await storm.connect(b).buy(7, { value: ETH("2") });
    const rc = await tx.wait(); const paid = (await storm.plates(1)).price;
    expect(paid).to.be.lte(price); expect(paid).to.be.gt(price * 99n / 100n);   // the price at the block's own second
    const gas = rc.gasUsed * rc.gasPrice;
    expect(await storm.ownerOf(1)).to.equal(b.address);
    expect(await bal(ARTIST)).to.equal(artistBefore + paid * 70n / 100n);
    expect(await storm.vault()).to.equal(vaultBefore + (paid - paid * 70n / 100n - paid * 20n / 100n));
    expect(await storm.pending(c.address)).to.equal(paid * 20n / 100n);
    expect(await storm.seats(b.address)).to.equal(paid * ETH("1") / ETH("0.3") > ETH("1") ? ETH("1") : paid * ETH("1") / ETH("0.3"));
    await expect(storm.connect(c).buy(1, { value: ETH("1") })).to.be.revertedWith("nothing on sale");
    const cands = await storm.candidates(1);
    await H.warpTo((await storm.plates(1)).close); await storm.sync();
    expect(await storm.today()).to.equal(2);
    expect((await storm.plates(2)).seed).to.equal(cands[7]);
    expect(await storm.picksCount()).to.equal(2);
    const lin = await storm.lineageOf(2); expect(lin.length).to.equal(2); expect(Number(lin[1])).to.equal(7);
    await conserved(storm);
    // the median now has two sales (Plate Zero and day 1): tomorrow starts at max(FOUNDING, 4*median)
    const m = await storm.median7(); const start = await storm.startPrice(2);
    expect(start).to.equal(4n * m > ETH("0.3") ? 4n * m : ETH("0.3"));
  });

  it("a witness raises the price by what was paid, cuts a notch, and takes at most one seat a day", async () => {
    const { storm, b, c } = await founded();
    const open = await storm.closeAfter(await storm.foundersEnd());
    await H.warpTo(open + 600n); await storm.sync();
    const p0 = (await storm.onSale())[1];
    await storm.connect(c).witness({ value: ETH("0.1") });
    const p1 = (await storm.onSale())[1];
    const D = await storm.plates(1); const dt = Number(BigInt(await H.now()) - D.open);
    const want = 0.1 * Math.pow(2, -dt / 8640);                              // what was paid, on the same falling curve
    expect(Number(p1 - p0) / 1e18).to.be.closeTo(want, 0.0005);
    expect((await storm.witnessesOf(1)).length).to.equal(1);
    expect(await storm.seats(c.address)).to.equal(ETH("0.1") * ETH("1") / ETH("0.3"));
    await storm.connect(c).witness({ value: ETH("0.5") });                 // capped at one seat for the day
    expect(await storm.seats(c.address)).to.equal(ETH("1"));
    expect((await storm.witnessesOf(1)).length).to.equal(2);
    await conserved(storm);
  });

  it("an unsold day is bought by the vault at the reference and held forever; when the vault cannot pay, the Tombstone, and death", async () => {
    const { storm, b, c } = await founded();                                 // vault = 0.09 (30% of 0.3)
    await storm.connect(c).pledge({ value: ETH("3") });                    // no seats yet, so the seats' fifth joins the vault: +0.9 = 0.99
    const open = await storm.closeAfter(await storm.foundersEnd());
    await H.warpTo(open + 10n); await storm.sync();
    expect(await storm.vault()).to.equal(ETH("0.99"));
    expect(await storm.referencePrice()).to.equal(ETH("0.3"));            // the median so far is FOUNDING
    let vault = ETH("0.99");
    for (let k = 1; k <= 3; k++) {
      await H.warpTo((await storm.plates(k)).close); await storm.sync();
      expect(await storm.ownerOf(k)).to.equal(await storm.getAddress());
      expect((await storm.plates(k)).price).to.equal(ETH("0.3"));
      vault = vault - ETH("0.3") + ETH("0.03");                             // ten percent comes back
      expect(await storm.vault()).to.equal(vault);
      expect(await storm.today()).to.equal(k + 1);
    }
    expect(await storm.dead()).to.equal(false);
    // 0.18 < 0.3: the fourth unsold day is the death
    await H.warpTo((await storm.plates(4)).close); await storm.sync();
    expect(await storm.dead()).to.equal(true); expect(await storm.tombId()).to.equal(4);
    expect(await storm.isTomb(4)).to.equal(true);
    expect(await storm.ownerOf(4)).to.equal(await storm.getAddress());
    expect((await storm.onSale())[3]).to.equal(false);
    await expect(storm.connect(b).buy(0, { value: ETH("1") })).to.be.revertedWith("nothing on sale");
    await expect(storm.transferFrom(await storm.getAddress(), b.address, 1)).to.be.reverted;
    await conserved(storm);
    expect(await storm.totalSupply()).to.equal(5);
    expect(await storm.vault()).to.equal(ETH("0.18"));                       // the vault keeps what it has
  });

  it("days nobody visits are settled in one sync, in order", async () => {
    const { storm, b, c } = await founded();
    await storm.connect(c).pledge({ value: ETH("30") });                   // fills the vault: 10% of 30 = 3 + 0.09
    const open = await storm.closeAfter(await storm.foundersEnd());
    await H.warpTo(open + 5n * 86400n + 100n); await storm.sync();
    expect(await storm.today()).to.be.gte(6);
    for (let k = 1; k < Number(await storm.today()); k++) expect(await storm.ownerOf(k)).to.equal(await storm.getAddress());
    await conserved(storm);
  });
});

describe("THE SEATS AND THE LEDGER", function () {
  it("seat earnings accrue pro rata, claim pays, a later payment auto-claims", async () => {
    const { storm, b, c, d } = await founded();
    await storm.connect(b).pledge({ value: ETH("0.3") });                  // 1 seat
    await storm.connect(c).pledge({ value: ETH("0.9") });                  // 3 seats; b earns 20% of 0.9 = 0.18
    expect(await storm.pending(b.address)).to.equal(ETH("0.18"));
    expect(await storm.pending(c.address)).to.equal(0);
    await storm.connect(d).pledge({ value: ETH("0.4") });                  // 0.08 to seats: b 0.02, c 0.06
    expect(await storm.pending(b.address)).to.equal(ETH("0.2"));
    expect(await storm.pending(c.address)).to.equal(ETH("0.06"));
    const before = await bal(b.address);
    const rc = await (await storm.connect(b).claim()).wait();
    expect(await bal(b.address)).to.equal(before + ETH("0.2") - rc.gasUsed * rc.gasPrice);
    expect(await storm.pending(b.address)).to.equal(0);
    expect(await storm.seatPool()).to.equal(ETH("0.06"));
    await conserved(storm);
  });

  it("every transfer cuts a hand on the plate; approvals work; the receiver check holds; royalties are 6.9% to the vault", async () => {
    const { storm, a, b, c } = await founded();                             // a owns Plate Zero
    await storm.connect(a).transferFrom(a.address, b.address, 0);
    await storm.connect(b).approve(c.address, 0);
    await storm.connect(c)["safeTransferFrom(address,address,uint256)"](b.address, c.address, 0);
    expect(await storm.ownerOf(0)).to.equal(c.address);
    expect((await storm.handsOf(0)).length).to.equal(2);
    await expect(storm.connect(a).transferFrom(c.address, a.address, 0)).to.be.revertedWith("not authorized");
    await expect(storm.connect(c)["safeTransferFrom(address,address,uint256)"](c.address, await storm.getAddress(), 0)).to.be.revertedWith("receiver rejected");
    const [rcv, amt] = await storm.royaltyInfo(0, ETH("1"));
    expect(rcv).to.equal(await storm.getAddress()); expect(amt).to.equal(ETH("0.069"));
    for (const i of ["0x01ffc9a7", "0x80ac58cd", "0x5b5e139f", "0x2a55205a"]) expect(await storm.supportsInterface(i)).to.equal(true);
    expect(await storm.supportsInterface("0xffffffff")).to.equal(false);
    // a royalty payment lands in the vault
    const v = await storm.vault();
    await a.sendTransaction({ to: await storm.getAddress(), value: ETH("0.069") });
    expect(await storm.vault()).to.equal(v + ETH("0.069"));
    await conserved(storm);
  });
});

describe("THE GLASS", function () {
  it("tokenURI carries the plate's seed, the sky, and the whole page: byte for byte the page on the site", async () => {
    const { storm, glass, a, b, c } = await founded();
    await storm.connect(b).pledge({ value: ETH("0.3") });
    await storm.connect(a).transferFrom(a.address, c.address, 0);
    const uri = await storm.tokenURI(0);
    const { json, glass: G, page } = H.decodeURI(uri);
    expect(json.name).to.equal("DITHERVOID // STORMGLASS · PLATE ZERO");
    expect(json.attributes.find(x => x.trait_type === "PLATE").value).to.equal("PLATE ZERO");
    expect(json.attributes.find(x => x.trait_type === "PRICE").value).to.equal("0.3000 ETH");
    expect(json.attributes.find(x => x.trait_type === "WITNESSES").value).to.equal(1);
    expect(json.image.startsWith("data:image/svg+xml;base64,")).to.equal(true); const svg=Buffer.from(json.image.slice(26),"base64").toString(); expect(svg).to.include("PLATE ZERO"); expect(svg).to.include("<svg");
    const skyNow = JSON.parse(await glass.sky(0)); expect(skyNow.witnesses.length).to.equal(1); expect(JSON.parse(await glass.sky(7)).hands.length).to.equal(0);
    expect(G.subject).to.equal(44); expect(G.frames).to.equal(36);
    expect(G.seed).to.equal(Number((await storm.plates(0)).seed));
    const L = G.live;
    for (const k of ["gas", "hunger", "hour", "moon", "tide", "wind", "flood", "peg", "pulse", "age", "lamps", "weight", "witnesses", "hands", "lineage"]) expect(L, k).to.have.property(k);
    expect(L.witnesses.length).to.equal(1); expect(L.hands.length).to.equal(1); expect(L.lineage.length).to.equal(0);
    expect(L.hour).to.be.gte(0); expect(L.hour).to.be.lt(24); expect(L.moon).to.be.gte(0); expect(L.moon).to.be.lt(1);
    expect(Math.abs(L.wind)).to.be.lte(1); expect(L.flood).to.equal(0); expect(L.peg).to.equal(0);
    const sha = require("crypto").createHash("sha256").update(page).digest("hex");
    expect(sha).to.equal(H.pageSha());
    expect(page.length).to.equal(require("fs").statSync(require("path").join(H.ROOT, "glass", "index.html")).size);
    await expect(storm.tokenURI(9)).to.be.revertedWith("no such plate");
  });

  it("a day's plate and the Tombstone say what they are; the flood and the peg read the pools", async () => {
    // pools: ETH sqrt price rises by 30% (ETH falls ~41%); USDT per USDC at 0.985 (1.5% off)
    const Pool = await ethers.getContractFactory("MockPool");
    const SP0 = (1n << 96n) * 1000n / 1000n;                                   // some sqrt price
    const ethPool = await Pool.deploy(SP0 / 1000n * 40n);                     // arbitrary scale
    const pegPool = await Pool.deploy(BigInt(Math.floor(Math.sqrt(0.985) * 2 ** 40)) << 56n);
    const S = await H.deployAll({ ethPool: await ethPool.getAddress(), pegPool: await pegPool.getAddress() });
    const [, a, b] = await ethers.getSigners();
    await S.storm.connect(a).bid({ value: ETH("0.3") });
    await H.warp(24 * 3600 + 5); await H.mine(7210); await S.storm.seal();
    await H.warpTo((await S.storm.candleClose()) + 1n); await S.storm.settleCandle();
    const open = await S.storm.closeAfter(await S.storm.foundersEnd());
    await H.warpTo(open + 100n); await S.storm.sync();                         // samples the pool once
    await S.storm.connect(b).buy(3, { value: ETH("2") });
    let d = H.decodeURI(await S.storm.tokenURI(1));
    expect(d.json.name).to.equal("DITHERVOID // STORMGLASS · DAY 1");
    expect(d.glass.subject).to.equal(undefined);
    expect(d.glass.live.flood).to.equal(0);
    expect(d.glass.live.peg).to.be.closeTo(1.5, 0.01);
    expect(d.glass.live.lineage).to.deep.equal([Number(await S.storm.picks(0))]);
    // ETH falls: the pool's sqrt price rises 30%
    await ethPool.set(SP0 / 1000n * 52n);
    d = H.decodeURI(await S.storm.tokenURI(1));
    expect(d.glass.live.flood).to.be.closeTo(1 - (40 / 52) ** 2, 0.001);
    // let it die: no buys, the vault pays 0.03 a day from 0.19 (0.09 + 10% of the 1-ETH... no: of the day-1 price)
    for (let k = 0; k < 40 && !(await S.storm.dead()); k++) { await H.warpTo((await S.storm.plates(await S.storm.today())).close); await S.storm.sync(); }
    expect(await S.storm.dead()).to.equal(true);
    const tomb = await S.storm.tombId();
    d = H.decodeURI(await S.storm.tokenURI(tomb));
    expect(d.json.name).to.equal("DITHERVOID // STORMGLASS · THE TOMBSTONE");
    expect(d.glass.subject).to.equal(45);
    expect(d.json.attributes.find(x => x.trait_type === "HELD BY THE VAULT").value).to.equal("YES");
  });
});
