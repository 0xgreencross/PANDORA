// SPDX-License-Identifier: CC0-1.0
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/*
  DITHERVOID // SMALL WEATHER. The gift.

  One loop for each collector who answered, made from the hash of their own address.
  The artist lays every loop on the chain (SSTORE2: each part is the code of a small
  contract, a STOP byte in front), binds it to the holder's address, then seals. After
  the seal nothing can be added or changed. Each holder claims their own, once, for free
  (they pay only the gas). After the deadline the artist may hand the unclaimed ones to
  their holders himself. No owner transfer, no admin dial, no royalties, no withdraw:
  the contract never holds ether.
*/
contract GIFT is ERC721 {
    address public immutable ARTIST;
    uint256 private constant PART = 24575;          // EIP-170: a contract's code is at most 24576 bytes

    bool public isSealed;
    uint64 public deadline;                         // set at the seal; airdrop allowed from here on
    uint256 public gifts;                           // loops laid
    uint256 public minted;                          // loops claimed or handed over

    mapping(address => uint256) public giftOf;      // holder -> tokenId (0 = none)
    mapping(uint256 => address) public holderOf;    // tokenId -> holder
    mapping(uint256 => address[]) private _parts;   // tokenId -> the loop, in parts
    mapping(uint256 => bytes32) public gifHash;     // tokenId -> sha256 of the loop, for anyone to check

    event Gift(uint256 indexed id, address indexed holder, uint256 size, bytes32 sha);
    event Sealed(uint64 deadline);

    error NotArtist();
    error IsSealed();
    error NotSealed();
    error NoGift();
    error Claimed();
    error TooEarly();
    error Bad();

    constructor() ERC721("SMALL WEATHER", "WEATHER") {
        ARTIST = msg.sender;
    }

    modifier onlyArtist() {
        if (msg.sender != ARTIST) revert NotArtist();
        _;
    }

    /// for marketplaces that read a collection owner; fixed forever
    function owner() external view returns (address) { return ARTIST; }

    // ------------------------------------------------------------------ laying the loops
    function setGift(address holder, uint256 id, bytes calldata loop) public onlyArtist {
        if (isSealed) revert IsSealed();
        if (holder == address(0) || id == 0 || loop.length == 0) revert Bad();
        address prev = holderOf[id];
        if (prev != address(0)) { delete giftOf[prev]; } else { gifts++; }
        uint256 other = giftOf[holder];
        if (other != 0 && other != id) revert Bad();          // one gift per holder
        giftOf[holder] = id;
        holderOf[id] = holder;
        delete _parts[id];
        for (uint256 off = 0; off < loop.length; off += PART) {
            uint256 end = off + PART < loop.length ? off + PART : loop.length;
            _parts[id].push(_lay(loop[off:end]));
        }
        bytes32 h = sha256(loop);
        gifHash[id] = h;
        emit Gift(id, holder, loop.length, h);
    }

    function setGifts(address[] calldata holders, uint256[] calldata ids, bytes[] calldata loops) external {
        if (holders.length != ids.length || ids.length != loops.length) revert Bad();
        for (uint256 i = 0; i < ids.length; i++) setGift(holders[i], ids[i], loops[i]);
    }

    function seal(uint64 deadline_) external onlyArtist {
        if (isSealed) revert IsSealed();
        if (deadline_ <= block.timestamp || gifts == 0) revert Bad();
        isSealed = true;
        deadline = deadline_;
        emit Sealed(deadline_);
    }

    // ------------------------------------------------------------------ claiming
    function claim() external {
        if (!isSealed) revert NotSealed();
        uint256 id = giftOf[msg.sender];
        if (id == 0) revert NoGift();
        if (_ownerOf(id) != address(0)) revert Claimed();
        minted++;
        _mint(msg.sender, id);
    }

    /// after the deadline the artist hands the unclaimed loops to their holders; claimed ones are skipped
    function airdropUnclaimed(uint256[] calldata ids) external onlyArtist {
        if (!isSealed) revert NotSealed();
        if (block.timestamp < deadline) revert TooEarly();
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            address h = holderOf[id];
            if (h == address(0)) revert NoGift();
            if (_ownerOf(id) != address(0)) continue;
            minted++;
            _mint(h, id);
        }
    }

    function isClaimed(uint256 id) external view returns (bool) { return _ownerOf(id) != address(0); }

    // ------------------------------------------------------------------ reading
    function parts(uint256 id) external view returns (address[] memory) { return _parts[id]; }

    function gif(uint256 id) public view returns (bytes memory out) {
        address[] storage p = _parts[id];
        if (p.length == 0) revert NoGift();
        uint256 total = 0;
        for (uint256 i = 0; i < p.length; i++) total += p[i].code.length - 1;
        out = new bytes(total);
        uint256 off = 0;
        for (uint256 i = 0; i < p.length; i++) {
            address c = p[i];
            uint256 n = c.code.length - 1;
            assembly { extcodecopy(c, add(add(out, 32), off), 1, n) }
            off += n;
        }
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        string memory n = Strings.toString(id);
        bytes memory json = abi.encodePacked(
            '{"name":"SMALL WEATHER #', n,
            '","description":"A small weather, made for one collector who answered. It came before STORMGLASS. The loop is on the chain, drawn from the hash of the address it was made for. dithervoid dot art. CC0. Greencross.",',
            '"image":"data:image/gif;base64,', Base64.encode(gif(id)), '",',
            '"attributes":[{"trait_type":"MADE FOR","value":"', Strings.toHexString(holderOf[id]), '"}]}');
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
    }

    // ------------------------------------------------------------------ SSTORE2
    function _lay(bytes calldata part) private returns (address a) {
        bytes memory code = abi.encodePacked(hex"61", uint16(part.length + 1), hex"80600a3d393df300", part);
        assembly { a := create(0, add(code, 32), mload(code)) }
        if (a == address(0)) revert Bad();
    }
}
