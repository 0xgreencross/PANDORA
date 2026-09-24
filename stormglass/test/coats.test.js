const { expect } = require("chai"); const { ethers } = require("hardhat"); const fs = require("fs"); const path = require("path"); const H = require("./helpers");
describe("THE COATS", function () {
  it("lays the chunks four at a time and THE GLASS reads them back whole", async () => {
    const [d] = await ethers.getSigners();
    const C = await (await ethers.getContractFactory("Coats")).deploy();
    const dir = path.join(H.ROOT, "onchain", "chunks"); const files = fs.readdirSync(dir).filter(f => f.endsWith(".bin")).sort();
    const parts = files.map(f => fs.readFileSync(path.join(dir, f)));
    const addrs = [];
    for (let i = 0; i < parts.length; i += 4) {
      const batch = parts.slice(i, i + 4).map(b => "0x" + b.toString("hex"));
      const rc = await (await C.lay(batch, { gasLimit: 29000000 })).wait();
      const laid = rc.logs.map(l => C.interface.parseLog(l)).filter(x => x && x.name === "Laid");
      expect(laid.length).to.equal(batch.length);
      laid.forEach(l => addrs.push(String(l.args[0])));
      console.log("      batch", i / 4, "gas", rc.gasUsed.toString());
    }
    const S = await H.deployAll({ chunks: addrs });
    const coat = Buffer.from((await S.glass.coat()).slice(2), "hex");
    const man = JSON.parse(fs.readFileSync(path.join(H.ROOT, "onchain", "manifest.json")));
    expect(require("crypto").createHash("sha256").update(coat).digest("hex")).to.equal(man.coat_sha256);
    expect(coat.length).to.equal(man.coat_bytes);
  });
});
