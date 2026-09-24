// SPDX-License-Identifier: CC0-1.0
pragma solidity 0.8.24;
interface IG { function page() external view returns (bytes memory); function chunks() external view returns (address[] memory); }
contract Probe {
    function pageOnly(address g) external view returns (uint256) { return IG(g).page().length; }
    function b64Of(bytes memory data) public pure returns (uint256) { return bytes(_b64(data)).length; }
    function packTwice(bytes memory data) external pure returns (uint256) { bytes memory a = abi.encodePacked("x", data, "y"); bytes memory b = abi.encodePacked(a, a); return b.length; }
    function _b64(bytes memory data) private pure returns (string memory) {
        string memory table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        if (data.length == 0) return "";
        string memory result = new string(4 * ((data.length + 2) / 3));
        assembly {
            let tablePtr := add(table, 1)
            let resultPtr := add(result, 32)
            for { let dataPtr := data let endPtr := add(data, mload(data)) }
                lt(dataPtr, endPtr) {} {
                dataPtr := add(dataPtr, 3)
                let input := mload(dataPtr)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(18, input), 0x3F)))) resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(12, input), 0x3F)))) resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(6, input), 0x3F))))  resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(input, 0x3F))))          resultPtr := add(resultPtr, 1)
            }
            switch mod(mload(data), 3)
            case 1 { mstore8(sub(resultPtr, 1), 0x3d) mstore8(sub(resultPtr, 2), 0x3d) }
            case 2 { mstore8(sub(resultPtr, 1), 0x3d) }
        }
        return result;
    }
}
