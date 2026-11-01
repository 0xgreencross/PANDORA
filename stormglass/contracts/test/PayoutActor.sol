// SPDX-License-Identifier: CC0-1.0
pragma solidity 0.8.24;
/* TEST ONLY (audit 5, payouts): a contract wallet that pays STORMGLASS and answers its payments in a
   chosen way, so the payout tests can show what happens to ether that a payee will not or cannot take.
   It is compiled with the pinned settings of hardhat.config.js like every other file under contracts/. */
interface IStormPay {
    function bid() external payable;
    function pledge() external payable;
    function buy(uint256 day, uint8 pick) external payable;
    function witness(uint256 day) external payable;
    function claim() external;
    function withdraw() external;
    function withdrawTo(address payable to) external;
}
contract PayoutActor {
    IStormPay public immutable s;
    /* 0 ACCEPT · 1 REVERT · 2 SPIN (burns every unit of gas it is given) · 3 HUNGRY (needs about 66k gas: three fresh
       storage writes; fails under the 60000 stipend, succeeds with full gas) · 4 PROBE (logs the gas it was given) ·
       5 REENTER (calls STORMGLASS again with `again`, logs the result, and accepts) */
    uint8 public mode;
    bytes public again;
    uint256 private salt;
    mapping(uint256 => uint256) private junk;
    event Entered(uint256 gasAtEntry, uint256 value);
    event Reentered(bool ok, bytes ret, uint256 gasAtEntry);

    constructor(address _s) { s = IStormPay(_s); }
    function setMode(uint8 m) external { mode = m; }
    function setAgain(bytes calldata d) external { again = d; }

    function bid() external payable { s.bid{value: msg.value}(); }
    function pledge() external payable { s.pledge{value: msg.value}(); }
    function buy(uint256 day, uint8 pick) external payable { s.buy{value: msg.value}(day, pick); }
    function witness(uint256 day) external payable { s.witness{value: msg.value}(day); }
    function claim() external { s.claim(); }
    function withdraw() external { s.withdraw(); }
    function withdrawTo(address payable to) external { s.withdrawTo(to); }

    receive() external payable {
        uint256 g = gasleft();
        uint8 m = mode;
        if (m == 0) return;
        if (m == 1) revert("no");
        if (m == 2) { uint256 i; while (true) { unchecked { i++; } } }
        if (m == 3) { uint256 k = uint256(keccak256(abi.encode(address(this), salt))); salt++; junk[k] = 1; junk[k + 1] = 1; junk[k + 2] = 1; return; }
        if (m == 4) { emit Entered(g, msg.value); return; }
        if (m == 5) { (bool ok, bytes memory r) = address(s).call(again); emit Reentered(ok, r, g); return; }
    }
}
