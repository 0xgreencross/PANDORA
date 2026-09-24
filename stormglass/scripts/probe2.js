const { ethers } = require("hardhat"); const H = require("../test/helpers");
(async()=>{
  const [d]=await ethers.getSigners();
  const all=await H.deployChunks(d);
  const P=await (await ethers.getContractFactory("Probe")).deploy();
  const est=async(fn,args)=>String(await ethers.provider.estimateGas({to:await P.getAddress(), data:P.interface.encodeFunctionData(fn,args)}));
  for(const n of [1,3,6]){
    const G=await (await ethers.getContractFactory("GLASS")).deploy(d.address, all.slice(0,n));
    console.log('chunks',n,'page gas',await est('pageOnly',[await G.getAddress()]));
  }
  for(const kb of [24,72,144]){ const data='0x'+'ab'.repeat(kb*1024); console.log('b64 of',kb,'KB gas',await est('b64Of',[data]), 'packTwice', await est('packTwice',[data])); }
  console.log('rss MB',(process.memoryUsage().rss/1048576)|0);
})().catch(e=>{console.log('ERR',String(e).slice(0,300));process.exit(1)});
