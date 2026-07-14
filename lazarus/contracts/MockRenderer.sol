// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract MockRenderer {
    function uri(uint256 id) external pure returns (string memory) {
        return string.concat("resurrected:", id == 1 ? "1" : "?");
    }
}
