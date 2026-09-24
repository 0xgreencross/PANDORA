/* Deploys the set on hardhat, runs a candle and a day, and writes the token pages the
   contract emits (decoded animation_url) to onchain/emitted/<id>.html with their GLASS json. */
const { ethers } = require("hardhat"); const H = require("../test/helpers"); const fs = require("fs"); const path = require("path");
(async () => {
  const OUT = path.join(H.ROOT, "onchain", "emitted"); fs.mkdirSync(OUT, { recursive: true });
  const [d, a, b, c] = await ethers.getSigners();
  const S = await H.deployAll();
  await S.storm.connect(a).bid({ value: H.ETH("0.3") });
  await H.warp(24 * 3600 - 7210); await H.mine(7215); await S.storm.seal();
  await H.warpTo((await S.storm.candleClose()) + 1n); await S.storm.settleCandle();
  await S.storm.connect(b).pledge({ value: H.ETH("0.6") });
  await S.storm.connect(a).transferFrom(a.address, c.address, 0);
  const open = await S.storm.closeAfter(await S.storm.foundersEnd());
  await H.warpTo(open + 3000n); await S.storm.sync();
  await S.storm.connect(c).witness({ value: H.ETH("0.05") });
  await S.storm.connect(b).buy(11, { value: H.ETH("2") });
  for (const id of [0, 1]) {
    const dec = H.decodeURI(await S.storm.tokenURI(id));
    fs.writeFileSync(path.join(OUT, id + ".html"), dec.html);
    fs.writeFileSync(path.join(OUT, id + ".json"), JSON.stringify({ glass: dec.glass, meta: { ...dec.json, animation_url: dec.json.animation_url.slice(0, 40) + "..." } }, null, 1));
    console.log("token", id, "html bytes", dec.html.length, "GLASS", JSON.stringify(dec.glass).slice(0, 200));
  }
})().catch(e => { console.log("ERR", String(e).slice(0, 400)); process.exit(1); });
