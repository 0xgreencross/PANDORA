/* same compiler settings; the osaka hardfork (EIP-7825: 2^24 gas per transaction) and a 60M block, as on mainnet and Sepolia in 2026 */
const base = require("./hardhat.config.js");
module.exports = { ...base, networks: { hardhat: { ...base.networks.hardhat, hardfork: "osaka", blockGasLimit: 60_000_000 } } };
