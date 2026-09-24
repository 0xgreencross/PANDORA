// SPDX-License-Identifier: CC0-1.0
pragma solidity 0.8.24;
/* THE COATS. Lays the token page's chunks on the chain, several per transaction: each part
   becomes a contract whose code is a STOP byte followed by the part (the SSTORE2 pattern),
   readable forever with EXTCODECOPY. Anyone may use it; it keeps nothing. */
contract Coats {
    event Laid(address indexed at, uint256 size);
    function lay(bytes[] calldata parts) external returns (address[] memory at) {
        at = new address[](parts.length);
        for (uint256 i = 0; i < parts.length; i++) {
            bytes memory code = abi.encodePacked(hex"61", uint16(parts[i].length + 1), hex"80600a3d393df300", parts[i]);
            address a;
            assembly { a := create(0, add(code, 32), mload(code)) }
            require(a != address(0), "create failed");
            at[i] = a;
            emit Laid(a, parts[i].length);
        }
    }
}
