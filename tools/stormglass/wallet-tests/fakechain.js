/* A deterministic fake of the public Ethereum RPCs the page reads from (publicnode, mevblocker, drpc, blastapi).
   It answers eth_call for the STORMGLASS, GLASS and SMALL WEATHER ABIs with a day on sale, and answers every tx hash with a
   mined receipt unless the test holds receipts. Nothing here ever reaches a real network. */
const {ethers}=require('ethers');
const ABI=[
  'function candleOpen() view returns (uint256)','function candleClose() view returns (uint256)','function candleSettled() view returns (bool)','function revealBlock() view returns (uint256)',
  'function zeroSeed() view returns (uint32)','function bidsCount() view returns (uint256)','function bids(uint256) view returns (address bidder,uint128 amount,uint64 at,uint32 seed)',
  'function FOUNDING() view returns (uint256)','function foundersEnd() view returns (uint256)','function today() view returns (uint256)','function lastId() view returns (uint256)','function dead() view returns (bool)','function tombId() view returns (uint256)',
  'function plates(uint256) view returns (uint32 seed,uint64 open,uint64 close,uint128 price,uint128 witnessed,address buyer,uint8 pick,bool sold)',
  'function onSale() view returns (uint256 id,uint256 price,uint256 close,bool open)','function startPrice(uint256) view returns (uint256)','function priceAt(uint256,uint256) view returns (uint256)','function referencePrice() view returns (uint256)','function median7() view returns (uint256)',
  'function candidates(uint256) view returns (uint32[32])','function picks(uint256) view returns (uint8)','function vault() view returns (uint256)','function seatPool() view returns (uint256)','function totalSeats() view returns (uint256)','function seats(address) view returns (uint256)','function pending(address) view returns (uint256)','function owed(address) view returns (uint256)',
  'function ownerOf(uint256) view returns (address)','function tokenURI(uint256) view returns (string)','function witnessesOf(uint256) view returns (uint32[])','function handsOf(uint256) view returns (uint32[])',
  'function sky(uint256) view returns (string)',
  'function balanceOf(address) view returns (uint256)','function giftOf(address) view returns (uint256)','function isClaimed(uint256) view returns (bool)','function gifts() view returns (uint256)','function minted() view returns (uint256)','function gif(uint256) view returns (bytes)'
];
const IF=new ethers.Interface(ABI);
const E=v=>ethers.parseEther(String(v));
const HOST=/(publicnode\.com|mevblocker\.io|drpc\.org|blastapi\.io)/;
function makeChain(){
  const t0=Math.floor(Date.now()/1000), open=t0-3*3600, close=open+86400, BUYER='0x19A84bF7b5DA2C290CB0Ca42bf691dd6C2308359';
  const S={ calls:[], holdReceipts:false, receiptsAsked:0, block0:21000000, t0,
    values:{ candleOpen:t0-86400*14, candleClose:t0-86400*13, candleSettled:true, revealBlock:0, zeroSeed:313454022, bidsCount:0, FOUNDING:E('0.42'), foundersEnd:t0-86400*13, today:13, lastId:12, dead:false, tombId:0,
      onSale:[13n,E('0.70'),BigInt(close),true], startPrice:E('1.68'), priceAt:E('0.7'), referencePrice:E('0.42'), median7:E('0.42'), picks:0, vault:E('1.2'), seatPool:E('0.31'), totalSeats:E('17'),
      seats:E('2'), pending:E('0.0364'), owed:0n, ownerOf:BUYER, tokenURI:'', witnessesOf:[], handsOf:[], sky:'{}', balanceOf:0n, giftOf:0n, isClaimed:false, gifts:79n, minted:78n, gif:'0x' },
    plate:id=>id===13?[396693683,open,close,0n,E('0.05'),ethers.ZeroAddress,0,false]:[(396693683*(id+3))>>>0,open-86400*(13-id),close-86400*(13-id),E('0.3'),0n,BUYER,id%32,true],
    cands:()=>Array.from({length:32},(_,k)=>((396693683*(k+7)+k*7919)>>>0)) };
  const blockNo=()=>S.block0+Math.floor((Date.now()/1000-t0)/2);
  const block=n=>({number:ethers.toQuantity(n),hash:ethers.zeroPadValue(ethers.toBeHex(n),32),parentHash:ethers.zeroPadValue(ethers.toBeHex(n-1),32),timestamp:ethers.toQuantity(Math.floor(Date.now()/1000)),nonce:'0x0000000000000000',difficulty:'0x0',gasLimit:'0x1c9c380',gasUsed:'0x0',miner:ethers.ZeroAddress,extraData:'0x',baseFeePerGas:'0x3b9aca00',blobGasUsed:'0x0',excessBlobGas:'0x0',transactions:[],stateRoot:ethers.ZeroHash,receiptsRoot:ethers.ZeroHash,mixHash:ethers.ZeroHash,parentBeaconBlockRoot:ethers.ZeroHash});
  const txOf=h=>({hash:h,blockHash:ethers.zeroPadValue('0x01',32),blockNumber:ethers.toQuantity(blockNo()-1),transactionIndex:'0x0',from:'0x00000000000000000000000000000000000000aa',to:'0xCf5EBA884EFA04940d31A663bEB6D37F907d064C',nonce:'0x0',gas:'0x3d090',gasPrice:'0x3b9aca00',maxFeePerGas:'0x3b9aca00',maxPriorityFeePerGas:'0x1',input:'0x',value:'0x0',type:'0x2',chainId:'0x1',accessList:[],v:'0x0',r:ethers.zeroPadValue('0x01',32),s:ethers.zeroPadValue('0x01',32),yParity:'0x0'});
  const rcOf=h=>({transactionHash:h,blockHash:ethers.zeroPadValue('0x01',32),blockNumber:ethers.toQuantity(blockNo()-1),transactionIndex:'0x0',from:'0x00000000000000000000000000000000000000aa',to:'0xCf5EBA884EFA04940d31A663bEB6D37F907d064C',cumulativeGasUsed:'0x30d40',gasUsed:'0x30d40',effectiveGasPrice:'0x3b9aca00',contractAddress:null,logs:[],logsBloom:'0x'+'00'.repeat(256),status:'0x1',type:'0x2'});
  function call(data){
    const sel=data.slice(0,10); let f; try{ f=IF.getFunction(sel); }catch(e){ f=null; } if(!f) return '0x';
    const args=IF.decodeFunctionData(f,data); let out;
    if(f.name==='plates') out=S.plate(Number(args[0]));
    else if(f.name==='candidates') out=[S.cands()];
    else if(f.name==='bids') out=[ethers.ZeroAddress,0n,0n,0];
    else { const v=S.values[f.name]; out=f.outputs.length===1?[v]:v; }
    S.calls.push(f.name);
    return IF.encodeFunctionResult(f,out);
  }
  function one(q){
    const r=v=>({jsonrpc:'2.0',id:q.id,result:v});
    switch(q.method){
      case 'eth_chainId': return r('0x1'); case 'net_version': return r('1');
      case 'eth_blockNumber': return r(ethers.toQuantity(blockNo()));
      case 'eth_getBlockByNumber': return r(block(q.params&&q.params[0]==='latest'?blockNo():Number(q.params[0])));
      case 'eth_call': return r(call(q.params[0].data||q.params[0].input||'0x'));
      case 'eth_getLogs': return r([]);
      case 'eth_getCode': return r('0x6080');
      case 'eth_gasPrice': return r('0x3b9aca00'); case 'eth_maxPriorityFeePerGas': return r('0x1');
      case 'eth_blobBaseFee': return r('0x1');
      case 'eth_getTransactionByHash': return r(txOf(q.params[0]));
      case 'eth_getTransactionReceipt': S.receiptsAsked++; return r(S.holdReceipts?null:rcOf(q.params[0]));
      case 'eth_getTransactionCount': return r('0x1');
      default: return {jsonrpc:'2.0',id:q.id,error:{code:-32601,message:'method not found: '+q.method}};
    }
  }
  S.handle=body=>{ const q=JSON.parse(body||'{}'); return JSON.stringify(Array.isArray(q)?q.map(one):one(q)); };
  return S;
}
module.exports={makeChain,HOST};
