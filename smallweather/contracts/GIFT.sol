// SPDX-License-Identifier: CC0-1.0
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/*
  DITHERVOID // SMALL WEATHER. The gift. (v2: the hard-pixel SVG and the renderer)

  One loop for each collector who answered, made from the hash of their own address.
  Every loop is drawn on a 96 x 96 grid. The chain keeps that grid as a GIF, and the
  token's image is an SVG that shows it with hard pixels: animated, and sharp at any size.
  The token's page (animation_url) carries the renderer itself, the code that drew every
  loop: it draws the holder's loop again in the browser, from the hash of the address and
  the scene, byte for byte the approved file, and lets the holder save it.

  The artist lays the page and every loop on the chain (SSTORE2: each part is the code of
  a small contract, a STOP byte in front), binds each loop to its holder, then seals. After
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

    struct Loop { address holder; uint40 scene; }   // one slot: holder + scene
    mapping(address => uint256) public giftOf;      // holder -> tokenId (0 = none)
    mapping(uint256 => Loop) private _loop;
    mapping(uint256 => address) private _gif;       // tokenId -> the 96 x 96 GIF (one part)
    address[] private _page;                        // the token page with the renderer, in parts

    event Gift(uint256 indexed id, address indexed holder, uint40 scene, uint256 size, bytes32 sha);
    event Page(uint256 size, bytes32 sha);
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

    // ------------------------------------------------------------------ the scenes (names in the renderer's order)
    function _pick(string memory list, uint256 i) private pure returns (string memory) {
        bytes memory b = bytes(list);
        uint256 start = 0; uint256 k = 0;
        for (uint256 j = 0; j <= b.length; j++) {
            if (j == b.length || b[j] == "|") {
                if (k == i) {
                    bytes memory o = new bytes(j - start);
                    for (uint256 q = 0; q < o.length; q++) o[q] = b[start + q];
                    return string(o);
                }
                k++; start = j + 1;
            }
        }
        revert Bad();
    }
    string private constant SKIES = "SUN|MOON|FULL MOON|SATURN|ECLIPSE|COMET|METEORS|TWIN SUNS|SATELLITE|RAINBOW|AURORA";
    string private constant LANDS = "GRID|PEAKS|VOLCANO|SEA|LIGHTHOUSE|DUNES|CITY";
    string private constant WEATHERS = "CLEAR|CLOUD|RAIN|STORM|SNOW|FOG|TORNADO|WIND|HURRICANE|MIRAGE";
    string private constant INKS = "DITHERVOID|POISONFROG|INFRARED|LAZER|CATHODE|MGC|POLE|TISNUKE|HOTLINE|EMBERGRID";

    /// scene = sky | land << 8 | weather << 16 | ink << 24 | thin << 32
    function sceneOf(uint256 id) public view returns (uint8 sky, uint8 land, uint8 weather, uint8 ink, uint8 thin) {
        Loop memory L = _loop[id];
        if (L.holder == address(0)) revert NoGift();
        uint40 s = L.scene;
        return (uint8(s), uint8(s >> 8), uint8(s >> 16), uint8(s >> 24), uint8(s >> 32));
    }

    function _validScene(uint40 s) private pure returns (bool) {
        return uint8(s) < 11 && uint8(s >> 8) < 7 && uint8(s >> 16) < 10 && uint8(s >> 24) < 10 && uint8(s >> 32) < 6;
    }

    // ------------------------------------------------------------------ laying the page and the loops
    function setPage(bytes calldata page) external onlyArtist {
        if (isSealed) revert IsSealed();
        if (page.length == 0) revert Bad();
        delete _page;
        for (uint256 off = 0; off < page.length; off += PART) {
            uint256 end = off + PART < page.length ? off + PART : page.length;
            _page.push(_lay(page[off:end]));
        }
        emit Page(page.length, sha256(page));
    }

    function setGift(address holder, uint256 id, uint40 scene, bytes calldata loop) public onlyArtist {
        if (isSealed) revert IsSealed();
        if (holder == address(0) || id == 0 || loop.length == 0 || loop.length > PART || !_validScene(scene)) revert Bad();
        address prev = _loop[id].holder;
        if (prev != address(0)) { delete giftOf[prev]; } else { gifts++; }
        uint256 other = giftOf[holder];
        if (other != 0 && other != id) revert Bad();          // one gift per holder
        giftOf[holder] = id;
        _loop[id] = Loop(holder, scene);
        _gif[id] = _lay(loop);
        emit Gift(id, holder, scene, loop.length, sha256(loop));
    }

    function setGifts(address[] calldata holders, uint256[] calldata ids, uint40[] calldata scenes, bytes[] calldata loops) external {
        if (holders.length != ids.length || ids.length != scenes.length || ids.length != loops.length) revert Bad();
        for (uint256 i = 0; i < ids.length; i++) setGift(holders[i], ids[i], scenes[i], loops[i]);
    }

    function seal(uint64 deadline_) external onlyArtist {
        if (isSealed) revert IsSealed();
        if (deadline_ <= block.timestamp || gifts == 0 || _page.length == 0) revert Bad();
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
            address h = _loop[id].holder;
            if (h == address(0)) revert NoGift();
            if (_ownerOf(id) != address(0)) continue;
            minted++;
            _mint(h, id);
        }
    }

    function isClaimed(uint256 id) external view returns (bool) { return _ownerOf(id) != address(0); }
    function holderOf(uint256 id) external view returns (address) { return _loop[id].holder; }

    // ------------------------------------------------------------------ reading
    function _read(address c) private view returns (bytes memory out) {
        uint256 n = c.code.length - 1;
        out = new bytes(n);
        assembly { extcodecopy(c, add(out, 32), 1, n) }
    }

    /// the loop's 96 x 96 GIF, byte for byte as laid
    function gif(uint256 id) public view returns (bytes memory) {
        address c = _gif[id];
        if (c == address(0)) revert NoGift();
        return _read(c);
    }

    /// sha256 of the loop, for anyone to check against the published set
    function gifHash(uint256 id) external view returns (bytes32) { return sha256(gif(id)); }

    /// the token page: the renderer and its frame, byte for byte as laid
    function page() public view returns (bytes memory out) {
        uint256 n = _page.length;
        if (n == 0) revert NoGift();
        bytes[] memory p = new bytes[](n);
        for (uint256 i = 0; i < n; i++) p[i] = _read(_page[i]);
        for (uint256 i = 0; i < n; i++) out = bytes.concat(out, p[i]);
    }

    /// the image: the 96 grid with hard pixels, sharp at any size
    function svg(uint256 id) public view returns (string memory) {
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="960" viewBox="0 0 96 96" shape-rendering="crispEdges">',
            '<image width="96" height="96" image-rendering="pixelated" style="image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges;image-rendering:pixelated" href="data:image/gif;base64,',
            Base64.encode(gif(id)), '"/></svg>'));
    }

    /// the token page for one loop: the renderer, then the loop's own numbers
    function html(uint256 id) public view returns (string memory) {
        (uint8 s, uint8 l, uint8 w, uint8 k, uint8 t) = sceneOf(id);
        address h = _loop[id].holder;
        return string(abi.encodePacked(
            page(),
            '<script>boot({"id":', Strings.toString(id),
            ',"seed":"', Strings.toHexString(uint256(keccak256(abi.encodePacked(h))), 32),
            '","sky":"', _pick(SKIES, s), '","land":"', _pick(LANDS, l), '","weather":"', _pick(WEATHERS, w),
            '","pair":', Strings.toString(k), ',"thin":', Strings.toString(t),
            ',"sha":"', Strings.toHexString(uint256(sha256(gif(id))), 32), '"})</script>'));
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        (uint8 s, uint8 l, uint8 w, uint8 k, ) = sceneOf(id);
        bytes memory json = abi.encodePacked(
            '{"name":"SMALL WEATHER #', Strings.toString(id),
            '","description":"A small weather, made for one collector who answered. It came before STORMGLASS. The loop is on the chain, drawn from the hash of the address it was made for. dithervoid dot art. CC0. Greencross.",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg(id))), '",',
            '"animation_url":"data:text/html;base64,', Base64.encode(bytes(html(id))), '",');
        json = abi.encodePacked(json,
            '"attributes":[{"trait_type":"MADE FOR","value":"', Strings.toHexString(_loop[id].holder),
            '"},{"trait_type":"SKY","value":"', _pick(SKIES, s),
            '"},{"trait_type":"LAND","value":"', _pick(LANDS, l),
            '"},{"trait_type":"WEATHER","value":"', _pick(WEATHERS, w),
            '"},{"trait_type":"INK","value":"', _pick(INKS, k), '"}]}');
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
    }

    // ------------------------------------------------------------------ SSTORE2
    function _lay(bytes calldata part) private returns (address a) {
        bytes memory code = abi.encodePacked(hex"61", uint16(part.length + 1), hex"80600a3d393df300", part);
        assembly { a := create(0, add(code, 32), mload(code)) }
        if (a == address(0)) revert Bad();
    }
}
