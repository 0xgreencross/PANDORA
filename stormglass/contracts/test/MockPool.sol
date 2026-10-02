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
    function pullTo(address payable to) external { s.withdrawTo(to); }
    receive() external payable { revert("no"); }
}
interface STORMLike { function bid() external payable; function withdraw() external; function withdrawTo(address payable to) external; }
/* answers every payment with a large return, so a caller that copies returned data pays for it */
contract Bomber {
    STORMLike immutable s;
    constructor(address _s) { s = STORMLike(_s); }
    function bid() external payable { s.bid{value: msg.value}(); }
    fallback() external payable { assembly { return(0, 120000) } }
}
/* a pool that turns bad after deploy: its first word grows past 160 bits */
contract DirtyPool {
    bool public dirty;
    function spoil() external { dirty = true; }
    fallback(bytes calldata) external returns (bytes memory) {
        uint256 w = dirty ? type(uint256).max : uint256(79228162514264337593543950336);
        return abi.encode(w, int24(0), uint16(0), uint16(0), uint16(0), uint8(0), true);
    }
}
/* stands in for the EIP-2935 history contract (Hardhat answers it with a revert) */
contract HistoryMock {
    fallback(bytes calldata q) external returns (bytes memory) { return abi.encode(keccak256(abi.encodePacked("history", q))); }
}
