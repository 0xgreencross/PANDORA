const { ethers, network } = require("hardhat");
const fs = require("fs"); const path = require("path"); const zlib = require("zlib"); const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..", "..");
const CHUNK_DIR = path.join(ROOT, "onchain", "chunks");

/* SSTORE2: the data behind a STOP byte, returned by a ten-byte init. */
function sstore2Init(data) {
  const body = Buffer.concat([Buffer.from([0]), data]);
  const n = body.length;
  return "0x" + Buffer.concat([Buffer.from([0x61, (n >> 8) & 255, n & 255, 0x80, 0x60, 0x0a, 0x3d, 0x39, 0x3d, 0xf3]), body]).toString("hex");
}
async function deployChunks(signer) {
  const files = fs.readdirSync(CHUNK_DIR).filter(f => f.endsWith(".bin")).sort();
  const addrs = [];
  for (const f of files) {
    const data = fs.readFileSync(path.join(CHUNK_DIR, f));
    const tx = await signer.sendTransaction({ data: sstore2Init(data) });
    const rc = await tx.wait();
    addrs.push(rc.contractAddress);
  }
  return addrs;
}
/* the whole set: chunks, THE GLASS bound to the predicted STORMGLASS address, then STORMGLASS */
async function deployAll(opts = {}) {
  const [deployer] = await ethers.getSigners();
  const chunks = opts.chunks || await deployChunks(deployer);
  const ethPool = opts.ethPool || ethers.ZeroAddress, pegPool = opts.pegPool || ethers.ZeroAddress;
  const nonce = await deployer.getNonce();
  const predicted = ethers.getCreateAddress({ from: deployer.address, nonce: nonce + 1 });
  const Glass = await ethers.getContractFactory("GLASS");
  const glass = await Glass.deploy(predicted, chunks);
  await glass.waitForDeployment();
  const Storm = await ethers.getContractFactory("STORMGLASS");
  const storm = await Storm.deploy(await glass.getAddress(), ethPool, pegPool);
  await storm.waitForDeployment();
  if ((await storm.getAddress()) !== predicted) throw new Error("prediction failed");
  return { deployer, chunks, glass, storm };
}
async function now() { return (await ethers.provider.getBlock("latest")).timestamp; }
async function warp(seconds) { await network.provider.send("evm_increaseTime", [Number(seconds)]); await network.provider.send("evm_mine"); }
async function warpTo(ts) { const t = await now(); if (Number(ts) <= t) { await network.provider.send("evm_mine"); return; } await network.provider.send("evm_setNextBlockTimestamp", [Number(ts)]); await network.provider.send("evm_mine"); }
async function mine(n) { await network.provider.send("hardhat_mine", ["0x" + Number(n).toString(16), "0x1"]); }
const ETH = v => ethers.parseEther(String(v));
const pageSha = () => crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, "glass", "index.html"))).digest("hex");
/* decode tokenURI -> {json, html, glass, page} */
function decodeURI(uri) {
  const json = JSON.parse(Buffer.from(uri.slice("data:application/json;base64,".length), "base64").toString("utf8"));
  const html = Buffer.from(json.animation_url.slice("data:text/html;base64,".length), "base64").toString("utf8");
  const g = html.match(/window\.GLASS=(\{.*?\}) *;\n/s); const glass = JSON.parse(g[1]);
  const b = html.match(/atob\("([A-Za-z0-9+/= ]+)"\)/); const page = zlib.gunzipSync(Buffer.from(b[1], "base64"));
  return { json, html, glass, page };
}
/* 4:20pm America/New_York after t, computed with Intl, as the oracle for the clock */
function closeAfterJS(t) {
  for (let day = Math.floor(t / 86400); day < Math.floor(t / 86400) + 3; day++) {
    const noonUTC = day * 86400 + 12 * 3600;
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset", hour: "numeric" }).formatToParts(new Date(noonUTC * 1000));
    const off = parts.find(p => p.type === "timeZoneName").value;   // "GMT-4" or "GMT-5"
    const h = parseInt(off.replace("GMT", ""), 10);
    const c = day * 86400 + (16 * 3600 + 20 * 60) - h * 3600;
    if (c > t) return c;
  }
  throw new Error("clock");
}
module.exports = { deployAll, deployChunks, now, warp, warpTo, mine, ETH, pageSha, decodeURI, closeAfterJS, ROOT };
