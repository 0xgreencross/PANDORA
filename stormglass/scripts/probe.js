const { ethers } = require("hardhat"); const H = require("../test/helpers");
(async()=>{
  const [d]=await ethers.getSigners();
  const all=await H.deployChunks(d);
  for(const n of [13]){
    const S=await H.deployAll({chunks:all.slice(0,n)});
    await S.storm.connect(d).bid({value:H.ETH("0.3")}); await H.warp(24*3600+5); await H.mine(7210); await S.storm.seal(); await H.warpTo((await S.storm.candleClose())+1n); await S.storm.settleCandle();
    const t0=Date.now(); const u=await S.storm.tokenURI(0); const ms=Date.now()-t0;
    const gas=await ethers.provider.estimateGas({to:await S.storm.getAddress(), data:S.storm.interface.encodeFunctionData("tokenURI",[0])}).catch(e=>'est fail '+String(e).slice(0,80));
    console.log('chunks',n,'uri bytes',u.length,'ms',ms,'gas',String(gas), 'rss MB', (process.memoryUsage().rss/1048576)|0);
  }
})().catch(e=>{console.log('ERR',String(e).slice(0,300));process.exit(1)});
