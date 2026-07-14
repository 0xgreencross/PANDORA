require("@nomicfoundation/hardhat-toolbox");
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 800 }, evmVersion: "cancun", viaIR: true },
  },
};
