// SPDX-License-Identifier: CC0-1.0
pragma solidity 0.8.24;
/* a Uniswap v3 pool's slot0, for the tests: only the sqrt price matters */
contract MockPool {
    uint160 public sp;
    constructor(uint160 _sp) { sp = _sp; }
    function set(uint160 _sp) external { sp = _sp; }
    function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool) { return (sp, 0, 0, 0, 0, 0, true); }
}
/* a wallet that refuses ether, to prove refunds fall back to owed[] */
contract Refuser {
    STORMLike public s;
    constructor(address _s) { s = STORMLike(_s); }
    function bid() external payable { s.bid{value: msg.value}(); }
    function pull() external { s.withdraw(); }
    receive() external payable { revert("no"); }
}
interface STORMLike { function bid() external payable; function withdraw() external; }
