const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const H = require("./helpers");
const { ETH } = H;

/* THE SMART ACCOUNT (Oct 3, found on the Sepolia rehearsal): greencross.eth is an EIP-7702 account
   (MetaMask's delegator), so the refund to an outbid leader runs code. A bid sent with the wallet's
   bare estimate ran out of gas on Sepolia (limit 123,230; needed ~126k at the node, 197k used at 200k).
   The site and the deploy page now pad every transaction (estimate x1.5 + 60k, at least 250k).
   This proves the padded bid pushes the refund to a code-running leader, and that nothing is ever lost:
   whatever path a refund takes, the ether is in the leader's hands or in owed[] for withdraw(). */
const BURN = "0x6107005b600190038060035700";   // runtime: count down 0x700 and stop (~46k gas on receive)

async function pad(m, args, ov = {}) {
  const g = await m.estimateGas(...args, ov);
  let L = g * 3n / 2n + 60000n; if (L < 250000n) L = 250000n;
  return { g, tx: await m(...args, { ...ov, gasLimit: L }) };
}

describe("SMART ACCOUNT BIDDERS (EIP-7702)", function () {
  it("a padded bid refunds an outbid leader whose account runs code on receive; the bare estimate never loses ether", async () => {
    const S = await H.deployAll(); const sig = await ethers.getSigners();
    const impl = "0x00000000000000000000000000000000000B0B0B";
    await network.provider.send("hardhat_setCode", [impl, BURN]);
    const leader = sig[1];
    await network.provider.send("hardhat_setCode", [leader.address, "0xef0100" + impl.slice(2)]);
    expect((await ethers.provider.getCode(leader.address)).slice(0, 8)).to.equal("0xef0100");

    await (await S.storm.connect(leader).bid({ value: ETH("0.05") })).wait();
    const before = await ethers.provider.getBalance(leader.address);
    const { g, tx } = await pad(S.storm.connect(sig[2]).bid, [], { value: ETH("0.06") });
    const rc = await tx.wait();
    expect(rc.status).to.equal(1);
    expect(await S.storm.owed(leader.address)).to.equal(0n);                       // pushed, not parked
    expect((await ethers.provider.getBalance(leader.address)) - before).to.equal(ETH("0.05"));
    console.log("      estimate", g.toString(), "used", rc.gasUsed.toString());

    // the bare estimate: whatever happens, the ether is either refunded or owed, never lost
    const third = sig[3]; await network.provider.send("hardhat_setCode", [sig[2].address, "0xef0100" + impl.slice(2)]);
    const e = await S.storm.connect(third).bid.estimateGas({ value: ETH("0.07") });
    const b2 = await ethers.provider.getBalance(sig[2].address);
    let ok = true;
    try { await (await S.storm.connect(third).bid({ value: ETH("0.07"), gasLimit: e })).wait(); } catch (x) { ok = false; }
    const got = (await ethers.provider.getBalance(sig[2].address)) - b2 + (await S.storm.owed(sig[2].address));
    if (ok) expect(got).to.equal(ETH("0.06")); else expect(await S.storm.bidsCount()).to.equal(2n);
    console.log("      bare estimate", e.toString(), ok ? "succeeded" : "reverted (the bidder keeps the leader's place; nothing moved)");
  });
});
