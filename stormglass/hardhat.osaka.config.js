/* same compiler settings; only the local chain's rules change: the osaka hardfork, whose
   EIP-7825 per-transaction gas cap (2^24) EDR enforces, and a 60M block as on mainnet in 2026 */
const base = require("./hardhat.config.js");
module.exports = { ...base, networks: { hardhat: { ...base.networks.hardhat, hardfork: "osaka", blockGasLimit: 60_000_000 } } };
