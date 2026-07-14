// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
  LAZARUS — the DITHERVOID // PANDORA corpus.

  One contract, one body of work. Curators inscribe a loop's DNA on-chain
  for a flat fee (capped at deployment, adjustable only downward — the
  contract itself promises the terms can never worsen). The curator then
  sells it as a 1/1, a limited edition, or a time-windowed open edition;
  collector payments route 100% to the curator. Zero royalties, by doctrine.

  The genome is the ground truth: the DNA card resurrects the exact loop,
  byte-identical, forever. tokenURI delegates to a swappable renderer so the
  corpus can graduate to a fully on-chain resurrector without migration.

  GREENCROSS x Claude — dithervoid dot art
*/

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IRenderer {
    function uri(uint256 id) external view returns (string memory);
}

contract Lazarus is ERC1155, Ownable2Step, ReentrancyGuard {

    enum EditionKind { ONE, LIMITED, OPEN }

    struct Genome {
        string  dna;          // the PNDR card — canonical, immutable truth
        string  traits;       // app-derived trait line, e.g. "VOID*SCANS*SIGNAL*C62*F36"
        string  curatorENS;   // the curator's name, frozen at inscription (epitaph)
        address curator;      // the wallet that inscribed
        uint64  inscribedAt;  // block timestamp
        uint64  saleEnd;      // OPEN editions: window close; else 0
        uint40  maxSupply;    // ONE=1 · LIMITED=N TOTAL copies INCLUDING curator's Nº1 · OPEN=0
        uint40  minted;       // copies minted so far
        uint128 price;        // wei per copy for collectors
        EditionKind kind;
        bytes32 gifHash;      // keccak256 of the canonical 1080 GIF — the LAZARUS commitment
        bool    curatorHidden;   // curator's own gallery flag
        uint8   houseTier;       // 0 normal · 1 featured · 2 hidden (visibility only)
    }

    uint256 public nextId = 1;
    mapping(uint256 => Genome) public genomes;
    mapping(bytes32 => uint256) public dnaToId;   // one inscription per DNA

    uint256 public immutable FEE_CEILING;          // the promise: fee can never exceed this
    uint256 public inscriptionFee;                 // adjustable downward only
    uint64  public constant MAX_OPEN_WINDOW = 30 days;

    address public renderer;                       // swappable tokenURI brain
    address public treasury;                       // where inscription fees land

    event Inscribed(uint256 indexed id, address indexed curator, string dna, bytes32 gifHash, EditionKind kind, uint40 maxSupply, uint128 price, uint64 saleEnd);
    event Collected(uint256 indexed id, address indexed collector, uint256 amount, uint256 paid);
    event CuratorFlag(uint256 indexed id, bool hidden);
    event HouseTier(uint256 indexed id, uint8 tier);
    event FeeLowered(uint256 newFee);
    event RendererChanged(address renderer);

    error WrongFee();
    error DnaTaken();
    error BadEdition();
    error SaleClosed();
    error SoldOut();
    error WrongPayment();
    error NotCurator();
    error FeeUpOnly();

    constructor(uint256 fee, address treasury_) ERC1155("") Ownable(msg.sender) {
        FEE_CEILING = fee;
        inscriptionFee = fee;
        treasury = treasury_ == address(0) ? msg.sender : treasury_;
    }

    /* ---------------- inscription: the toll gate ---------------- */

    function inscribe(
        string calldata dna,
        string calldata traits,
        string calldata curatorENS,
        bytes32 gifHash,
        EditionKind kind,
        uint40 maxSupply,
        uint128 price,
        uint64 saleEnd
    ) external payable nonReentrant returns (uint256 id) {
        if (msg.value != inscriptionFee) revert WrongFee();
        bytes32 key = keccak256(bytes(dna));
        if (dnaToId[key] != 0) revert DnaTaken();
        if (bytes(dna).length < 10 || bytes(dna).length > 64) revert BadEdition();
        if (!_clean(dna) || !_clean(traits) || !_clean(curatorENS)) revert BadEdition();
        if (bytes(traits).length > 64 || bytes(curatorENS).length > 64) revert BadEdition();

        if (kind == EditionKind.ONE) {
            if (maxSupply != 1 || saleEnd != 0) revert BadEdition();
        } else if (kind == EditionKind.LIMITED) {
            if (maxSupply < 2 || saleEnd != 0) revert BadEdition();
        } else { // OPEN
            if (maxSupply != 0) revert BadEdition();
            if (saleEnd <= block.timestamp || saleEnd > block.timestamp + MAX_OPEN_WINDOW) revert BadEdition();
        }

        id = nextId++;
        dnaToId[key] = id;
        genomes[id] = Genome({
            dna: dna,
            traits: traits,
            curatorENS: curatorENS,
            curator: msg.sender,
            inscribedAt: uint64(block.timestamp),
            saleEnd: saleEnd,
            maxSupply: maxSupply,
            minted: 1,
            price: price,
            kind: kind,
            gifHash: gifHash,
            curatorHidden: false,
            houseTier: 0
        });

        (bool ok, ) = treasury.call{value: msg.value}("");
        require(ok, "fee route failed");

        _mint(msg.sender, id, 1, "");                 // copy #1 belongs to the curator
        emit Inscribed(id, msg.sender, dna, gifHash, kind, maxSupply, price, saleEnd);
    }

    /* ---------------- collecting: 100% to the curator ---------------- */

    function collect(uint256 id, uint256 amount) external payable nonReentrant {
        Genome storage g = genomes[id];
        if (g.curator == address(0)) revert BadEdition();
        if (amount == 0 || amount > 10_000) revert BadEdition();   // uint40-safe by construction
        if (g.kind == EditionKind.ONE) revert SoldOut();                  // 1/1: the inscription IS the mint
        if (g.kind == EditionKind.LIMITED) {
            if (g.minted + amount > g.maxSupply) revert SoldOut();
        } else { // OPEN
            if (block.timestamp > g.saleEnd) revert SaleClosed();
        }
        if (msg.value != uint256(g.price) * amount) revert WrongPayment();

        g.minted += uint40(amount);
        (bool ok, ) = g.curator.call{value: msg.value}("");
        require(ok, "pay route failed");

        _mint(msg.sender, id, amount, "");
        emit Collected(id, msg.sender, amount, msg.value);
    }

    /* ---------------- curation: dual keys, visibility only ---------------- */

    function setCuratorHidden(uint256 id, bool hidden) external {
        if (genomes[id].curator != msg.sender) revert NotCurator();
        genomes[id].curatorHidden = hidden;
        emit CuratorFlag(id, hidden);
    }

    function setHouseTier(uint256 id, uint8 tier) external onlyOwner {
        require(tier <= 2, "tier");
        genomes[id].houseTier = tier;
        emit HouseTier(id, tier);
    }

    /* ---------------- the downward-only promise ---------------- */

    function lowerFee(uint256 newFee) external onlyOwner {
        if (newFee > inscriptionFee) revert FeeUpOnly();
        inscriptionFee = newFee;
        emit FeeLowered(newFee);
    }

    function setTreasury(address t) external onlyOwner { treasury = t; }

    function setRenderer(address r) external onlyOwner {
        renderer = r;
        emit RendererChanged(r);
    }

    /* ---------------- metadata ---------------- */

    function uri(uint256 id) public view override returns (string memory) {
        if (renderer != address(0)) return IRenderer(renderer).uri(id);
        return _defaultURI(id);
    }

    function _defaultURI(uint256 id) internal view returns (string memory) {
        Genome storage g = genomes[id];
        require(g.curator != address(0), "no genome");
        string memory kindStr = g.kind == EditionKind.ONE ? "1/1"
            : g.kind == EditionKind.LIMITED ? string.concat("LIMITED ", _u(g.maxSupply))
            : "OPEN";
        bytes memory json = abi.encodePacked(
            '{"name":"PANDORA N\\u00ba', _u(id),
            '","description":"A DITHERVOID loop, inscribed. The DNA is the artwork: ',
            g.dna,
            ' resurrects it byte-identical, forever. dithervoid dot art",',
            '"animation_url":"https://dithervoid.art/?mint=', _u(id), '",',
            '"external_url":"https://dithervoid.art/?mint=', _u(id), '",',
            '"attributes":['
        );
        json = abi.encodePacked(json,
            '{"trait_type":"DNA","value":"', g.dna, '"},',
            '{"trait_type":"TRAITS","value":"', g.traits, '"},',
            '{"trait_type":"CURATOR","value":"', _hex(g.curator), '"},',
            bytes(g.curatorENS).length > 0
                ? abi.encodePacked('{"trait_type":"CURATOR ENS","value":"', g.curatorENS, '"},')
                : bytes(""),
            '{"trait_type":"EDITION","value":"', kindStr, '"},',
            '{"display_type":"date","trait_type":"INSCRIBED","value":', _u(g.inscribedAt), '}',
            ']}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(json));
    }

    /* strings live inside on-chain JSON forever: only calm characters allowed.
       a-z A-Z 0-9 and  - _ . * : / space  — no quotes, no backslash, no control. */
    function _clean(string calldata str) internal pure returns (bool) {
        bytes calldata b = bytes(str);
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            bool ok = (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)
                || c == 0x2d || c == 0x5f || c == 0x2e || c == 0x2a || c == 0x3a || c == 0x2f || c == 0x20;
            if (!ok) return false;
        }
        return true;
    }

    /* ---------------- tiny pure helpers (no deps) ---------------- */

    function _u(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 t = v; uint256 d;
        while (t != 0) { d++; t /= 10; }
        bytes memory b = new bytes(d);
        while (v != 0) { d--; b[d] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(b);
    }

    function _hex(address a) internal pure returns (string memory) {
        bytes16 sym = "0123456789abcdef";
        bytes memory b = new bytes(42);
        b[0] = "0"; b[1] = "x";
        uint160 v = uint160(a);
        for (uint256 i = 41; i > 1; i--) { b[i] = sym[v & 0xf]; v >>= 4; }
        return string(b);
    }


}
