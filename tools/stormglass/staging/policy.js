/* THE STAGING WALLET POLICY (single source: build.js inlines it into test-wallet.html and checks index.html against it).
   In REAL-WALLET mode the page only ever holds wrapped providers. A wrapped provider forwards to the real wallet ONLY the methods
   in FORWARD (default-deny); LOCAL methods are answered by the staging layer itself; TX methods open the intercept panel and are
   never forwarded; SIGN methods are shown and refused; everything else is refused with 4200 (unsupported), nothing forwarded.
   READER methods are the ones the page sends only to the public HTTP readers (answered in-page by the simulated chain).
   KNOWN_UNUSED: literals present in index.html that the page never sends to a wallet (wallet_addEthereumChain is only in the
   WalletConnect nudge list WC_NEEDS); they are refused like any other unlisted method. */
const POLICY={
  /* each entry: why the page needs it (checked against index.html by build.js: every method literal must be classified) */
  FORWARD:{
    eth_accounts:'the last look before a write (opCheck), onAccounts after an empty list, ethers getSigner',
    eth_requestAccounts:'CONNECT (gated: the visitor confirms first on the staging panel)',
    eth_chainId:'chainOf(): the alive() ping, opBegin/opCheck, nxWrong, walletReads; ethers network detection',
    wallet_switchEthereumChain:'SWITCH TO ETHEREUM, opBegin on a wrong chain (gated: the visitor confirms first)',
    wallet_revokePermissions:'DISCONNECT asks the wallet to forget the site (EIP-2255)',
    eth_blockNumber:'reads through the wallet (bindRead fallback "wallet", ethers BrowserProvider)',
    eth_call:'reads through the wallet (bindRead fallback "wallet")',
    eth_getBlockByNumber:'reads through the wallet (ro.getBlock)',
    eth_getLogs:'reads through the wallet (queryFilter in the witness list)',
    eth_getTransactionReceipt:'reads through the wallet (ethers)',
    eth_getTransactionByHash:'trackTx asks the wallet for the nonce when no reader has the tx (a simulated hash is answered locally)'
  },
  LOCAL:{
    eth_estimateGas:'answered by the staging layer: the sale on this page is simulated, so the real chain cannot estimate it'
  },
  TX:['eth_sendTransaction','wallet_sendTransaction','wallet_sendCalls','eth_sendRawTransaction','eth_signTransaction','eth_sendUserOperation','wallet_grantPermissions'],
  SIGN:['eth_sign','personal_sign','eth_signTypedData','eth_signTypedData_v1','eth_signTypedData_v3','eth_signTypedData_v4'],
  READER:['eth_blobBaseFee','eth_getTransactionCount','eth_gasPrice','eth_maxPriorityFeePerGas','eth_feeHistory','eth_getCode','eth_getBalance','net_version'],
  KNOWN_UNUSED:['wallet_addEthereumChain'],
  /* JSON-RPC methods that may never leave the page over HTTP (fetch guard, both modes) */
  HTTP_WRITE:/^(eth_send|eth_sign|personal_sign|wallet_|eth_signTypedData)/
};
if(typeof module!=='undefined') module.exports=POLICY;
