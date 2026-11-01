const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const H = require("./helpers");
const { ETH } = H;

/* AUDIT 5 · THE PAYOUTS. Every wei that enters STORMGLASS is followed by a shadow ledger written from the
   contract's own rules (_split, _settleSeats, _grantSeats, _seatForDay, _pay), and after EVERY transaction:
     - vault, seatPool, totalSeats, seats, pending and owed equal the ledger exactly (no tolerance);
     - the contract holds exactly vault + seatPool + sum(owed);
     - every tracked balance moved by exactly what the ledger says was paid (gas accounted), so the
       ether out of the contract is the sum of the payouts, once each;
     - the SeatsClaimed events are exactly the ledger's settlements, in order.
   The only rounding the contract admits is the floor in accPerSeat and the cap in _settleSeats ("rounding can
   run a few wei ahead of the pool"); the ledger applies both, so every value is asserted exact. */

const PAYEE = "0x19A84bF7b5DA2C290CB0Ca42bf691dd6C2308359";
const ARTIST = "0x0DD399a7ED92283e4983C2974FE377070D67f4eB";
const E18 = 10n ** 18n;
const M = { ACCEPT: 0, REVERT: 1, SPIN: 2, HUNGRY: 3, PROBE: 4, REENTER: 5 };
const bal = a => ethers.provider.getBalance(a);
const lc = a => a.toLowerCase();

class Ledger {
  constructor(F) { this.F = F; this.vault = F - F * 70n / 100n; this.pool = 0n; this.total = 0n; this.acc = 0n; this.seats = {}; this.debt = {}; this.owed = {}; this.dayPaid = {}; this.daySeat = {}; this.refuse = new Set(); this.begin(); }
  begin() { this.paid = []; this.claimed = []; }
  g(m, k) { return m[lc(k)] || 0n; }
  pay(to, v) { if (v === 0n) return; if (this.refuse.has(lc(to))) this.owed[lc(to)] = this.g(this.owed, to) + v; else this.paid.push([lc(to), v]); }
  split(v) { const a = v * 70n / 100n, s = v * 20n / 100n; let r = v - a - s; if (this.total === 0n) r += s; else { this.pool += s; this.acc += s * E18 / this.total; } this.vault += r; this.pay(PAYEE, a); }
  pending(w) { return this.g(this.seats, w) * this.acc / E18 - this.g(this.debt, w); }
  settle(w) { let p = this.pending(w); if (p > this.pool) p = this.pool; this.debt[lc(w)] = this.g(this.seats, w) * this.acc / E18; if (p > 0n) { this.pool -= p; this.pay(w, p); this.claimed.push([lc(w), p]); } }
  grant(w, s) { this.seats[lc(w)] = this.g(this.seats, w) + s; this.total += s; this.debt[lc(w)] = this.seats[lc(w)] * this.acc / E18; }
  seatForDay(id, w, paid) { const k = id + ":" + lc(w); const t = (this.dayPaid[k] || 0n) + paid; this.dayPaid[k] = t; let s = t * E18 / this.F; if (s > E18) s = E18; const had = this.daySeat[k] || 0n; if (s > had) { this.daySeat[k] = s; this.grant(w, s - had); } }
  pledge(w, v) { this.split(v); this.settle(w); this.grant(w, v * E18 / this.F); }
  buy(w, id, price, value) { this.split(price); this.settle(w); this.seatForDay(id, w, price); if (value > price) this.pay(w, value - price); }
  witness(w, id, v) { this.split(v); this.settle(w); this.seatForDay(id, w, v); }
  claim(w) { this.settle(w); }
}

async function founded() {
  const S = await H.deployAll(); const sig = await ethers.getSigners();
  await S.storm.connect(sig[1]).bid({ value: ETH("0.3") });
  await H.warp(30 * 3600 + 5); await H.mine(9010); await S.storm.settleCandle();
  const Actor = await ethers.getContractFactory("PayoutActor");
  const actors = [];
  for (let i = 0; i < 4; i++) { const a = await Actor.deploy(await S.storm.getAddress()); await a.waitForDeployment(); actors.push(a); }
  return { ...S, sig, actors };
}

/* one transaction, checked against the ledger: balances, events, state, holdings */
async function step(C, { from, payer, value = 0n, send, apply, reverts }) {
  const L = C.L; const storm = C.storm; const sAddr = lc(await storm.getAddress());
  const track = [...new Set([...C.tracked.map(lc), sAddr, lc(from.address), ...(payer ? [lc(payer)] : [])])];
  const before = {}; for (const a of track) before[a] = await bal(a);
  if (reverts) {
    await expect(send()).to.be.revertedWith(reverts);
    for (const a of track) if (a !== lc(from.address)) expect(await bal(a), "balance moved on a reverted call: " + a).to.equal(before[a]);
    await checkState(C);
    return null;
  }
  L.begin(); apply && apply(L);
  const rc = await (await send()).wait();
  expect(rc.status).to.equal(1);
  const want = {}; for (const a of track) want[a] = before[a];
  want[lc(from.address)] -= rc.gasUsed * rc.gasPrice + value;     // the signer pays the value (passed through a payer contract if any) and the gas
  want[sAddr] += value;
  let out = 0n;
  for (const [to, v] of L.paid) { expect(track, "an untracked payee " + to).to.include(to); want[to] += v; want[sAddr] -= v; out += v; }
  for (const a of track) expect(await bal(a), "balance of " + a).to.equal(want[a]);
  const claims = rc.logs.filter(l => lc(l.address) === sAddr).map(l => storm.interface.parseLog(l)).filter(e => e && e.name === "SeatsClaimed").map(e => [lc(e.args.who), e.args.amount]);
  expect(claims).to.deep.equal(L.claimed);
  await checkState(C);
  return { rc, out, events: rc.logs.filter(l => lc(l.address) === sAddr).map(l => storm.interface.parseLog(l)).filter(Boolean) };
}
async function checkState(C) {
  const { storm, L } = C;
  expect(await storm.vault(), "vault").to.equal(L.vault);
  expect(await storm.seatPool(), "seatPool").to.equal(L.pool);
  expect(await storm.totalSeats(), "totalSeats").to.equal(L.total);
  let owedSum = 0n;
  for (const a of C.tracked) {
    expect(await storm.seats(a), "seats " + a).to.equal(L.g(L.seats, a));
    expect(await storm.pending(a), "pending " + a).to.equal(L.pending(a));
    expect(await storm.owed(a), "owed " + a).to.equal(L.g(L.owed, a));
    owedSum += L.g(L.owed, a);
  }
  // every owed key the ledger knows is tracked, so the sum is the whole of owed[]
  for (const k of Object.keys(L.owed)) expect(C.tracked.map(lc)).to.include(k);
  expect(await bal(await storm.getAddress()), "held = vault + seatPool + owed").to.equal(L.vault + L.pool + owedSum);
}

async function setup() {
  const F = await loadFixture(founded);
  const C = { ...F, L: new Ledger(await F.storm.FOUNDING()) };
  C.tracked = [...F.sig.slice(1, 8).map(s => s.address), ...(await Promise.all(F.actors.map(a => a.getAddress()))), PAYEE, ARTIST];
  expect(C.L.F).to.equal(ETH("0.3"));
  await checkState(C);
  return C;
}
const pledge = (C, s, v) => step(C, { from: s, value: v, send: () => C.storm.connect(s).pledge({ value: v }), apply: L => L.pledge(s.address, v) });
const witness = (C, s, id, v) => step(C, { from: s, value: v, send: () => C.storm.connect(s).witness(id, { value: v }), apply: L => L.witness(s.address, BigInt(id), v) });
const claim = (C, s) => step(C, { from: s, send: () => C.storm.connect(s).claim(), apply: L => L.claim(s.address) });
async function actorDo(C, A, fn, args, value = 0n, applyFn) {
  const who = await A.getAddress();
  return step(C, { from: C.sig[0], payer: who, value, send: () => A.connect(C.sig[0])[fn](...args, { value }), apply: L => applyFn && applyFn(L, who) });
}
async function setMode(C, A, m) { await A.setMode(m); const a = lc(await A.getAddress()); if (m === M.REVERT || m === M.SPIN || m === M.HUNGRY) C.L.refuse.add(a); else C.L.refuse.delete(a); }
async function openDay1(C) { await H.warpTo((await C.storm.closeAfter(await C.storm.foundersEnd())) + 10n); await C.storm.sync(); const [id, , , open] = await C.storm.onSale(); expect(open).to.equal(true); expect(id).to.equal(1n); return id; }
/* a buy at a chosen second, the price read for that second beforehand; the Bought event must carry it */
async function buyAt(C, s, id, pick, extra, actor) {
  const t = (await H.now()) + 37;
  const price = await C.storm.priceAt(id, t);
  await network.provider.send("evm_setNextBlockTimestamp", [t]);
  const value = price + extra;
  let r;
  if (actor) r = await actorDo(C, actor, "buy", [id, pick], value, (L, w) => L.buy(w, id, price, value));
  else r = await step(C, { from: s, value, send: () => C.storm.connect(s).buy(id, pick, { value }), apply: L => L.buy(s.address, id, price, value) });
  const b = r.events.find(e => e.name === "Bought");
  expect(b.args.id).to.equal(id); expect(b.args.price).to.equal(price); expect(b.args.pick).to.equal(BigInt(pick));
  expect(b.args.buyer).to.equal(actor ? await actor.getAddress() : s.address);
  return { price, value, r };
}
const reason = ret => { expect(ret.slice(0, 10)).to.equal("0x08c379a0"); return ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + ret.slice(10))[0]; };
const logsOf = async (A, rc, name) => { const a = lc(await A.getAddress()); return rc.logs.filter(l => lc(l.address) === a).map(l => A.interface.parseLog(l)).filter(e => e && e.name === name); };

describe("AUDIT 5 · PAYOUTS (shadow ledger, exact to the wei)", function () {

  it("1+2. a buy pays the buyer's EXISTING seats what they earned, including their share of the buyer's own price, before the new seat is granted; a witness does the same", async () => {
    const C = await setup(); const [, , a, b, c] = C.sig;
    await pledge(C, a, ETH("0.15"));           // the first seats: their 20% goes to the vault (no seats yet)
    expect(C.L.vault).to.equal(ETH("0.09") + ETH("0.15") - ETH("0.105"));
    await pledge(C, b, ETH("0.3"));            // b's 20% (0.06) goes to a's half seat, which is the only seat
    expect(await C.storm.pending(a.address)).to.equal(ETH("0.06"));
    const id = await openDay1(C);
    await witness(C, c, id, ETH("0.01"));      // a stranger witnesses: its 20% goes to a and b pro rata
    const pa = C.L.pending(a.address), pb = C.L.pending(b.address);
    expect(pa).to.be.gt(ETH("0.06")); expect(pb).to.be.gt(0n);
    // a buys with 0.02 too much: split(price) then settle(a) then a's day seat, then the overpayment back
    const L0 = { acc: C.L.acc, total: C.L.total, seatsA: C.L.g(C.L.seats, a.address), debtA: C.L.g(C.L.debt, a.address) };
    const { price, r } = await buyAt(C, a, id, 7, ETH("0.02"));
    const shareOwn = L0.seatsA * (L0.acc + (price * 20n / 100n) * E18 / L0.total) / E18 - L0.debtA;   // computed independently of the ledger
    expect(r.events.filter(e => e.name === "SeatsClaimed").map(e => e.args.amount)).to.deep.equal([shareOwn]);
    expect(shareOwn).to.be.gt(pa);                                                                 // more than before the buy: its share of its own price
    expect(await C.storm.seats(a.address)).to.equal(L0.seatsA + E18);                              // price >= FOUNDING here: a whole day seat
    expect(await C.storm.pending(a.address)).to.equal(0n);                                         // the new seat did not earn the price it was bought with
    expect(await C.storm.pending(b.address)).to.be.gt(pb);                                         // b was not paid in a's buy; it accrued
    // b witnesses day 2 and is paid in the same transaction: everything accrued + its share of its own witness
    await H.warpTo((await C.storm.plates(id)).close + 5n);
    const before = C.L.pending(b.address);
    const r2 = await witness(C, b, 2n, ETH("0.05"));
    const got = r2.events.find(e => e.name === "SeatsClaimed").args.amount;
    expect(got).to.be.gt(before);
    expect(r2.events.find(e => e.name === "Witnessed").args.amount).to.equal(ETH("0.05"));
    expect(await C.storm.pending(b.address)).to.equal(0n);
  });

  it("2. the payer's share of its own payment, worked by hand: the only seat holder pays 1 ETH and gets back exactly 0.2 ETH of it", async () => {
    const C = await setup(); const [, , a] = C.sig;
    await pledge(C, a, ETH("0.3"));            // exactly one seat, the only seat
    const r = await pledge(C, a, ETH("1"));
    expect(r.events.find(e => e.name === "SeatsClaimed").args.amount).to.equal(ETH("0.2"));
    expect(r.events.find(e => e.name === "Pledged").args.seats).to.equal(ETH("1") * E18 / ETH("0.3"));
    expect(await C.storm.seatPool()).to.equal(0n);
    const id = await openDay1(C);
    const want = C.L.g(C.L.seats, a.address) * (C.L.acc + ETH("0.006") * E18 / C.L.total) / E18 - C.L.g(C.L.debt, a.address);
    const r2 = await witness(C, a, id, ETH("0.03"));    // still the only holder: 20% of 0.03 comes back, less the accumulator's floor
    const got = r2.events.find(e => e.name === "SeatsClaimed").args.amount;
    expect(got).to.equal(want);
    expect(ETH("0.006") - got).to.be.gte(0n); expect(ETH("0.006") - got).to.be.lte(3n);   // 4.333.. seats: the floor keeps 3 wei in the pool
    expect(await C.storm.seatPool()).to.equal(ETH("0.006") - got);
    expect(await C.storm.seats(a.address)).to.equal(ETH("1.3") * E18 / ETH("0.3") + ETH("0.03") * E18 / ETH("0.3"));   // a tenth of a day seat
  });

  it("3. a new seat does not earn what was distributed before it: pending is zero at the grant, the first claim pays nothing, later earnings are its share only", async () => {
    const C = await setup(); const [, , a, b, c, d] = C.sig;
    await pledge(C, a, ETH("0.3")); await pledge(C, b, ETH("0.6")); await pledge(C, c, ETH("0.9"));
    const poolBefore = C.L.pool; expect(poolBefore).to.be.gt(0n);
    await pledge(C, d, ETH("0.3"));            // d's own payment is split before d holds seats: none of it is d's
    expect(await C.storm.pending(d.address)).to.equal(0n);
    const r = await claim(C, d);              // nothing to take: no event, no transfer
    expect(r.events.filter(e => e.name === "SeatsClaimed")).to.have.length(0); expect(r.out).to.equal(0n);
    const accBefore = C.L.acc, seatsD = C.L.g(C.L.seats, d.address), total = C.L.total;
    await pledge(C, b, ETH("0.003"));          // one more distribution: d earns its share of 0.0006 and no more
    const want = seatsD * (accBefore + ETH("0.0006") * E18 / total) / E18 - seatsD * accBefore / E18;
    expect(await C.storm.pending(d.address)).to.equal(want);
    expect(want).to.be.lte(ETH("0.0006") * seatsD / total);
    const r2 = await claim(C, d);
    expect(r2.events.find(e => e.name === "SeatsClaimed").args.amount).to.equal(want);
    for (const s of [a, b, c, d]) await claim(C, s);   // and every holder can still take what it is owed
    expect(await C.storm.seatPool()).to.be.lt(10n);   // only the accumulator's floor dust stays behind
  });

  it("4. a payee that refuses ether (reverting receive, gas-burning receive, a receive that needs more than 60000 gas, or the PAYEE itself) is credited in owed[], never lost", async () => {
    const C = await setup(); const [R, S, Hg] = C.actors; const [, , a] = C.sig;
    await setMode(C, R, M.REVERT); await setMode(C, S, M.SPIN); await setMode(C, Hg, M.HUNGRY);
    for (const A of [R, S, Hg]) await actorDo(C, A, "pledge", [], ETH("0.3"), (L, w) => L.pledge(w, ETH("0.3")));
    await pledge(C, a, ETH("0.9"));            // earnings for the three contract holders
    for (const A of [R, S, Hg]) {
      const w = await A.getAddress(); const p = C.L.pending(w); expect(p).to.be.gt(0n);
      const r = await actorDo(C, A, "claim", [], 0n, (L, x) => L.claim(x));
      expect(await C.storm.owed(w)).to.be.gte(p);                              // credited, the event still names the amount
      expect(r.events.find(e => e.name === "SeatsClaimed").args.amount).to.equal(p);
      if (A === S) expect(r.rc.gasUsed).to.be.lt(200000n);                     // the spinner only ever got 60000 gas to burn
    }
    // the PAYEE refusing: its seventy percent waits in owed[PAYEE]
    await network.provider.send("hardhat_setCode", [PAYEE, "0x60006000fd"]);   // PUSH1 0 PUSH1 0 REVERT
    C.L.refuse.add(lc(PAYEE));
    await pledge(C, a, ETH("1"));
    expect(await C.storm.owed(PAYEE)).to.equal(ETH("0.7"));
    await network.provider.send("hardhat_setCode", [PAYEE, "0x"]); C.L.refuse.delete(lc(PAYEE));
    // an overpaid buy whose refund and earnings both bounce
    const id = await openDay1(C);
    const oR = C.L.g(C.L.owed, await R.getAddress());
    const { price, value } = await buyAt(C, null, id, 3, ETH("0.123"), R);
    expect(await C.storm.owed(await R.getAddress()) - oR).to.be.gte(value - price);
    expect(await C.storm.owed(PAYEE)).to.equal(ETH("0.7"));
    // the HUNGRY wallet can take its ether itself with withdraw(), which forwards all gas
    const w = await Hg.getAddress(); const v = C.L.g(C.L.owed, w);
    const b0 = await bal(w);
    await actorDo(C, Hg, "withdraw", [], 0n, L => { L.owed[lc(w)] = 0n; L.paid.push([lc(w), v]); });
    expect(await bal(w)).to.equal(b0 + v);
  });

  it("4b. the stipend is 60000 gas (+ the 2300 the EVM adds to a value call); withdraw/withdrawTo forward all gas", async () => {
    const C = await setup(); const [P] = C.actors; const [, , a] = C.sig;
    await setMode(C, P, M.PROBE);
    await actorDo(C, P, "pledge", [], ETH("0.3"), (L, w) => L.pledge(w, ETH("0.3")));
    await pledge(C, a, ETH("0.3"));
    const r = await actorDo(C, P, "claim", [], 0n, (L, w) => L.claim(w));
    const [e] = await logsOf(P, r.rc, "Entered");
    expect(e.args.value).to.equal(ETH("0.06"));
    expect(e.args.gasAtEntry).to.be.lte(62300n); expect(e.args.gasAtEntry).to.be.gt(60000n);   // 60000 + 2300 stipend less a few opcodes
    // an owed balance taken with withdraw(): no cap
    await setMode(C, P, M.REVERT); await pledge(C, a, ETH("0.3")); await actorDo(C, P, "claim", [], 0n, (L, w) => L.claim(w));
    await setMode(C, P, M.PROBE);
    const w = await P.getAddress(), v = C.L.g(C.L.owed, w); expect(v).to.be.gt(0n);
    const r2 = await actorDo(C, P, "withdraw", [], 0n, L => { L.owed[lc(w)] = 0n; L.paid.push([lc(w), v]); });
    const [e2] = await logsOf(P, r2.rc, "Entered");
    expect(e2.args.value).to.equal(v); expect(e2.args.gasAtEntry).to.be.gt(1_000_000n);
  });

  it("5. claim, refunds and earnings over a whole run: no loss, no double count; out == sum of payouts at every step, held == vault + seatPool + owed", async () => {
    const C = await setup(); const [, , a, b, c, d, e] = C.sig; const [R, , , Acc] = C.actors;
    await setMode(C, R, M.REVERT);
    let out = 0n, inn = 0n;
    const t = async (p, v = 0n) => { const r = await p; inn += v; if (r) out += r.out; };
    const h0 = await bal(await C.storm.getAddress());
    await t(pledge(C, a, ETH("0.31")), ETH("0.31")); await t(pledge(C, b, 7n), 7n); await t(pledge(C, c, ETH("0.0101") + 3n), ETH("0.0101") + 3n);
    await t(actorDo(C, R, "pledge", [], ETH("0.2"), (L, w) => L.pledge(w, ETH("0.2"))), ETH("0.2"));
    await t(actorDo(C, Acc, "pledge", [], ETH("0.4"), (L, w) => L.pledge(w, ETH("0.4"))), ETH("0.4"));
    const id = await openDay1(C);
    for (const [s, v] of [[d, ETH("0.02")], [a, 11n], [e, ETH("0.5")], [d, ETH("0.4")]]) await t(witness(C, s, id, v), v);
    await t(actorDo(C, R, "witness", [id], ETH("0.05"), (L, w) => L.witness(w, id, ETH("0.05"))), ETH("0.05"));
    const B = await buyAt(C, c, id, 9, ETH("0.777")); out += B.r.out; inn += B.value;
    for (const s of [a, b, c, d, e]) await t(claim(C, s));
    await t(actorDo(C, R, "claim", [], 0n, (L, w) => L.claim(w)));
    await t(actorDo(C, Acc, "claim", [], 0n, (L, w) => L.claim(w)));
    // the second claim of each pays nothing
    for (const s of [a, b, c, d, e]) { const r = await claim(C, s); expect(r.out).to.equal(0n); }
    const held = await bal(await C.storm.getAddress());
    expect(held).to.equal(h0 + inn - out);
    expect(C.L.g(C.L.owed, await R.getAddress())).to.be.gt(0n);
  });

  it("6-9. withdrawTo pays an accepting recipient once; a refusing recipient reverts the whole call and owed survives; a second withdrawal finds nothing owed; nobody can take another's balance", async () => {
    const C = await setup(); const [R1, R2, Bad, Ok] = C.actors; const [, , a, , , , x] = C.sig;
    await setMode(C, R1, M.REVERT); await setMode(C, R2, M.REVERT);
    // R1 and R2 are each owed a refund they could not take (an overpaid pledge cannot happen; use earnings)
    await actorDo(C, R1, "pledge", [], ETH("0.3"), (L, w) => L.pledge(w, ETH("0.3")));
    await actorDo(C, R2, "pledge", [], ETH("0.6"), (L, w) => L.pledge(w, ETH("0.6")));
    await pledge(C, a, ETH("1.5"));
    await actorDo(C, R1, "claim", [], 0n, (L, w) => L.claim(w)); await actorDo(C, R2, "claim", [], 0n, (L, w) => L.claim(w));
    const w1 = await R1.getAddress(), w2 = await R2.getAddress();
    const o1 = C.L.g(C.L.owed, w1), o2 = C.L.g(C.L.owed, w2);
    expect(o1).to.equal(ETH("0.12") + ETH("0.1")); expect(o2).to.equal(ETH("0.2"));   // R1 alone took R2's 20%; then 0.3 split 1:2
    // 9. no function names another account: the only ways out of owed[] are withdraw() and withdrawTo(to), both keyed on msg.sender
    const outFns = C.storm.interface.fragments.filter(f => f.type === "function" && /withdraw|claim/i.test(f.name)).map(f => f.format());
    expect(outFns.sort()).to.deep.equal(["claim()", "withdraw()", "withdrawTo(address)"]);
    for (const s of [x, a]) {
      await step(C, { from: s, send: () => C.storm.connect(s).withdraw(), reverts: "nothing owed" });
      await step(C, { from: s, send: () => C.storm.connect(s).withdrawTo(s.address), reverts: "nothing owed" });
    }
    // 7. a refusing alternate recipient: the whole call reverts and owed stays
    await setMode(C, Bad, M.REVERT);
    await step(C, { from: C.sig[0], send: () => R1.withdrawTo(Bad.getAddress()), reverts: "failed" });
    await setMode(C, Bad, M.SPIN);
    await step(C, { from: C.sig[0], send: () => R1.withdrawTo(Bad.getAddress(), { gasLimit: 3_000_000 }), reverts: "failed" });
    await step(C, { from: C.sig[0], send: () => R1.withdraw(), reverts: "failed" });           // itself: still refuses
    await step(C, { from: C.sig[0], send: () => R1.withdrawTo(ethers.ZeroAddress), reverts: "zero address" });
    expect(await C.storm.owed(w1)).to.equal(o1);
    // 6. an accepting alternate: an EOA, then a contract
    await step(C, { from: C.sig[0], send: () => R1.withdrawTo(x.address), apply: L => { L.owed[lc(w1)] = 0n; L.paid.push([lc(x.address), o1]); } });
    await setMode(C, Ok, M.ACCEPT);
    await step(C, { from: C.sig[0], send: () => R2.withdrawTo(Ok.getAddress()), apply: L => { L.owed[lc(w2)] = 0n; L.paid.push([lc(Ok.target), o2]); } });
    // 8. the same balance cannot be paid twice
    await step(C, { from: C.sig[0], send: () => R1.withdrawTo(x.address), reverts: "nothing owed" });
    await step(C, { from: C.sig[0], send: () => R2.withdraw(), reverts: "nothing owed" });
    expect(await C.storm.owed(w1)).to.equal(0n); expect(await C.storm.owed(w2)).to.equal(0n);
  });

  it("10. re-entry from a payee is refused: claim, withdraw, withdrawTo, buy and witness all answer 'reentrant' from inside _pay (60000 gas) and from inside a withdrawal (all gas); each balance is paid once", async () => {
    const C = await setup(); const [X] = C.actors; const [, , a] = C.sig;
    const w = await X.getAddress(); const S = C.storm.interface;
    await setMode(C, X, M.ACCEPT);
    await actorDo(C, X, "pledge", [], ETH("0.3"), (L, x) => L.pledge(x, ETH("0.3")));
    await pledge(C, a, ETH("0.6"));
    let id = await openDay1(C);
    const fresh = async v => { let [d, , , open] = await C.storm.onSale(); if (!open) { await H.warpTo((await C.storm.plates(await C.storm.today())).close + 5n); d = (await C.storm.today()) + 1n; } return witness(C, a, d, v); };
    const calls = { claim: S.encodeFunctionData("claim"), withdraw: S.encodeFunctionData("withdraw"), withdrawTo: S.encodeFunctionData("withdrawTo", [w]), buy: S.encodeFunctionData("buy", [id, 1]), witness: S.encodeFunctionData("witness", [id]) };
    const seen = [];
    // (a) from the 60000-gas push: each re-entry is tried while seat earnings are paid out by claim()
    for (const [name, data] of Object.entries(calls)) {
      await setMode(C, X, M.ACCEPT); await fresh(ETH("0.03"));                // fresh earnings to push
      await setMode(C, X, M.REENTER); await X.setAgain(data);
      const r = await actorDo(C, X, "claim", [], 0n, (L, x) => L.claim(x));
      const [e] = await logsOf(X, r.rc, "Reentered");
      expect(e, name).to.not.equal(undefined);
      expect(e.args.ok, name).to.equal(false); expect(reason(e.args.ret), name).to.equal("reentrant");
      expect(e.args.gasAtEntry).to.be.lte(62300n);
      seen.push("push:" + name);
    }
    // (b) from an overpaid buy's refund (60000 gas): the re-entry into claim is refused, the refund lands once
    await X.setAgain(calls.claim);
    const B = await buyAt(C, null, id, 4, ETH("0.0042"), X);
    const [eb] = await logsOf(X, B.r.rc, "Reentered");
    expect(eb.args.ok).to.equal(false); expect(reason(eb.args.ret)).to.equal("reentrant");
    // (c) from a withdrawal, which forwards all gas: only the guard stands in the way, and it holds
    for (const [name, data] of Object.entries(calls)) {
      await setMode(C, X, M.REVERT); await fresh(ETH("0.03")); await actorDo(C, X, "claim", [], 0n, (L, x) => L.claim(x));
      const v = C.L.g(C.L.owed, w); expect(v).to.be.gt(0n);
      await setMode(C, X, M.REENTER); await X.setAgain(data);
      for (const via of ["withdraw", "withdrawTo"]) {
        if (via === "withdrawTo" && C.L.g(C.L.owed, w) === 0n) { await setMode(C, X, M.REVERT); await fresh(ETH("0.03")); await actorDo(C, X, "claim", [], 0n, (L, x) => L.claim(x)); await setMode(C, X, M.REENTER); }
        const vv = C.L.g(C.L.owed, w);
        const r = await actorDo(C, X, via, via === "withdrawTo" ? [w] : [], 0n, L => { L.owed[lc(w)] = 0n; L.paid.push([lc(w), vv]); });
        const [e] = await logsOf(X, r.rc, "Reentered");
        expect(e.args.ok, via + ">" + name).to.equal(false); expect(reason(e.args.ret), via + ">" + name).to.equal("reentrant");
        expect(e.args.gasAtEntry, "all gas forwarded").to.be.gt(1_000_000n);
        expect(await C.storm.owed(w)).to.equal(0n);
        seen.push(via + ":" + name);
      }
    }
    expect(seen).to.have.length(5 + 10);
  });
});
