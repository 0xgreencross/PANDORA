/* THE AUDIT-5b POST-INTEGRATION REVIEW CASES (audit/wallet-5b-review2). Loaded by wallet.test.js (every audit5*.test.js is group @audit5). Same mocks,
   same fake chain: nothing real is touched (no wallet, no RPC, no relay).
   a5p1  request §4 ("SWITCH with no wallet"): COLLECT's wrong-network view belongs to the wallet that was connected. When that wallet ends the session
         (its own disconnect event) or DISCONNECT is pressed, the dialog must stop saying that a wallet is on another network: it shows its
         not-connected COLLECT again, with no SWITCH TO ETHEREUM, and no wallet is asked to switch. On 691687a3 (bce0646) the view stayed:
         "[!!] YOUR WALLET IS ON ANOTHER NETWORK · Your wallet is on another network. Switch it to Ethereum mainnet. · SWITCH TO ETHEREUM" under
         a header that says CONNECT.
   Every row asserts its trigger (the wrong-network view shown, the page disconnected) before the outcome. */
const H=require('./wallet.test.js');
const {T,connect,closeWit,one}=H;
const pop=E=>E.page.evaluate(()=>({acts:document.getElementById('ccActs').textContent,pop:!!NX.pop,tx:NX.tx,sw:!!document.getElementById('nx-switch'),buy:!!document.getElementById('ccBuy'),label:document.getElementById('wallet').textContent}));
const switches=E=>E.page.evaluate(()=>__MW.log.filter(x=>x.method==='wallet_switchEthereumChain').length);

T('a5p1','COLLECT shows "your wallet is on another network"; the wallet then ends the session (its disconnect event), or DISCONNECT is pressed: the dialog no longer says a wallet is on another network, shows its not-connected COLLECT (no SWITCH TO ETHEREUM), and no wallet is asked to switch',{wallets:[]},async E0=>{
  const rows={};
  for(const how of ['event','disconnect']){ const E=await H.boot({wallets:[one('A','0x2105')],ethereum:'A'}); try{
    await connect(E); await closeWit(E.page);
    await E.page.evaluate(()=>{ if(!NX.pop) document.getElementById('bPick').click(); document.querySelectorAll('#candGrid .card')[3].click(); }); await E.page.waitForSelector('#ccBuy');
    await E.page.evaluate(()=>document.getElementById('ccBuy').click());
    const wrong=await E.until(async()=>{ const v=await pop(E); return v.sw&&/ANOTHER NETWORK/.test(v.acts)&&await E.page.evaluate(()=>OPLOCK===null); },8000);
    const sw0=await switches(E);
    if(how==='event') await E.P('A').emit('disconnect',{code:4900}); else await E.page.evaluate(()=>disconnect(true));   /* DISCONNECT's own call (as a5r2): the dialog covers the header button */
    const gone=await E.until(async()=>/CONNECT/.test(await E.label())&&await E.page.evaluate(()=>!me&&!EP),5000);
    const redrawn=await E.until(async()=>{ const v=await pop(E); return !/another network/i.test(v.acts); },4000);
    const v=await pop(E), sw=(await switches(E))-sw0;
    rows[how]={wrongView:wrong,disconnected:gone,redrawn,view:v,switchAsked:sw,errors:E.errors.slice(0,2)}; }
    finally{ await E.close().catch(()=>{}); } }
  const ok=r=>r.wrongView&&r.disconnected&&r.redrawn&&r.view.pop&&!r.view.sw&&r.view.buy&&r.view.tx===null&&!/another network/i.test(r.view.acts)&&r.switchAsked===0&&r.errors.length===0;
  return {pass:ok(rows.event)&&ok(rows.disconnect), ev:rows}; });
