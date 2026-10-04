require("@nomicfoundation/hardhat-toolbox");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");
/* THE COMPILER IS PINNED: solc 0.8.24+commit.e11b9ed9, cancun, optimizer 800, viaIR. Bytecode identity is sacred.
   The build comes from the npm solc package (soljson, the same commit Remix runs), so no download is needed. */
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, hre, runSuper) => {
  if (args.solcVersion === "0.8.24") {
    return { compilerPath: require.resolve("solc/soljson.js"), isSolcJs: true, version: "0.8.24", longVersion: "0.8.24+commit.e11b9ed9" };
  }
  return runSuper();
});
module.exports = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 800 }, evmVersion: "cancun", viaIR: true } },
  networks: { hardhat: { hardfork: "cancun" } },
  mocha: { timeout: 900000 }
};
