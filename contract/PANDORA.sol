// SPDX-License-Identifier: CC0-1.0
pragma solidity 0.8.24;

/*
  DITHERVOID // PANDORA — the collection
  ERC-1155. One seed, one token, one chance. Every loop minted here is locked
  into the ledger forever; the DNA can never be minted again by anyone.

  Edition types:
    UNIQUE  — supply 1, creation fee 0.01 ETH
    LIMITED — supply 2..N set by creator, creation fee 0.001 ETH,
              contract runs the primary sale at the creator's price
    OPEN    — uncapped (or deadline-capped) primary sale at the creator's
              price, creation fee 0.001 ETH

  All creation fees forward instantly to the artist wallet. All primary-sale
  proceeds forward instantly to each loop's creator. The contract holds
  nothing.

  Metadata is fully on-chain. The animation resurrects from a versioned
  renderer registry: every token remembers the engine that birthed it, and
  registry entries are append-only — history cannot be rewritten.

  CC0. Do what you want with what you mint. Greencross encourages it.
*/

contract PANDORA {
    // ---------------------------------------------------------- constants
    uint256 public constant FEE_EDITION = 0.001 ether;
    uint256 public constant FEE_UNIQUE  = 0.01 ether;
    address public constant ARTIST      = 0x19A84bF7b5DA2C290CB0Ca42bf691dd6C2308359;

    // ---------------------------------------------------------- ownership
    address public owner;
    modifier onlyOwner(){ require(msg.sender==owner, "not owner"); _; }

    // ---------------------------------------------------------- ERC-1155 core
    mapping(uint256 => mapping(address => uint256)) private _bal;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    event URI(string value, uint256 indexed id);

    // ---------------------------------------------------------- loop registry
    enum EditionType { UNIQUE, LIMITED, OPEN }

    struct Loop {
        uint32  seed;         // the locked genome key
        uint64  supplyCap;    // 1 for UNIQUE; 2..N for LIMITED; 0 = uncapped OPEN
        uint64  minted;       // copies in existence
        uint64  deadline;     // OPEN only; 0 = forever
        uint128 price;        // creator's primary-sale price per copy (wei)
        address creator;
        EditionType kind;
        string  dna;          // full card string
        string  loopedBy;     // artist name or "ANONYMOUS"
        string  palette;
        string  engine;       // engine version at mint
        uint8   corruption;
        uint8   voidLevel;
        bool    chromaCapped; // FULL SPECTRUM (false) or CAPPED (true)
    }

    uint256 public nextId = 1;
    mapping(uint256 => Loop) public loops;
    mapping(uint32  => uint256) public seedToToken;   // 0 = virgin seed

    // ------------------------------------------------- renderer registry (append-only)
    mapping(string => string) public engineRenderer;  // version => animation base URL
    string public currentEngine;
    string public imageBase;                          // poster storage base URL

    event LoopCreated(uint256 indexed id, uint32 indexed seed, EditionType kind, address indexed creator);
    event LoopCollected(uint256 indexed id, address indexed collector, uint256 qty);
    event EngineAdded(string version, string rendererBase);

    bool private _entered;
    modifier nonReentrant(){ require(!_entered, "reentrant"); _entered=true; _; _entered=false; }

    constructor(string memory _engineVersion, string memory _rendererBase, string memory _imageBase){
        owner = msg.sender;
        currentEngine = _engineVersion;
        engineRenderer[_engineVersion] = _rendererBase;
        imageBase = _imageBase;
        emit EngineAdded(_engineVersion, _rendererBase);
    }

    // ---------------------------------------------------------- creation
    function _create(
        uint32 seed, string calldata dna, string calldata loopedBy,
        string calldata palette, uint8 corruption, uint8 voidLevel, bool chromaCapped,
        EditionType kind, uint64 supplyCap, uint64 deadline, uint128 price
    ) internal returns (uint256 id) {
        require(seedToToken[seed] == 0, "SEED ALREADY MINTED");
        require(bytes(dna).length > 0 && bytes(dna).length < 64, "bad dna");
        require(bytes(loopedBy).length > 0 && bytes(loopedBy).length < 40, "bad name");
        id = nextId++;
        seedToToken[seed] = id;
        Loop storage L = loops[id];
        L.seed = seed; L.kind = kind; L.creator = msg.sender;
        L.supplyCap = supplyCap; L.deadline = deadline; L.price = price;
        L.dna = dna; L.loopedBy = loopedBy; L.palette = palette;
        L.engine = currentEngine;
        L.corruption = corruption; L.voidLevel = voidLevel; L.chromaCapped = chromaCapped;
        // the creator's copy
        L.minted = 1;
        _bal[id][msg.sender] += 1;
        emit TransferSingle(msg.sender, address(0), msg.sender, id, 1);
        emit LoopCreated(id, seed, kind, msg.sender);
        // creation fee: straight to the artist, nothing retained
        (bool ok, ) = ARTIST.call{value: msg.value}("");
        require(ok, "fee transfer failed");
    }

    function mintUnique(
        uint32 seed, string calldata dna, string calldata loopedBy,
        string calldata palette, uint8 corruption, uint8 voidLevel, bool chromaCapped
    ) external payable nonReentrant returns (uint256) {
        require(msg.value == FEE_UNIQUE, "fee is 0.01 ETH");
        return _create(seed, dna, loopedBy, palette, corruption, voidLevel, chromaCapped,
                       EditionType.UNIQUE, 1, 0, 0);
    }

    function mintLimited(
        uint32 seed, string calldata dna, string calldata loopedBy,
        string calldata palette, uint8 corruption, uint8 voidLevel, bool chromaCapped,
        uint64 supplyCap, uint128 pricePerCopy
    ) external payable nonReentrant returns (uint256) {
        require(msg.value == FEE_EDITION, "fee is 0.001 ETH");
        require(supplyCap >= 2, "limited needs supply >= 2");
        return _create(seed, dna, loopedBy, palette, corruption, voidLevel, chromaCapped,
                       EditionType.LIMITED, supplyCap, 0, pricePerCopy);
    }

    function mintOpen(
        uint32 seed, string calldata dna, string calldata loopedBy,
        string calldata palette, uint8 corruption, uint8 voidLevel, bool chromaCapped,
        uint64 deadline, uint128 pricePerCopy
    ) external payable nonReentrant returns (uint256) {
        require(msg.value == FEE_EDITION, "fee is 0.001 ETH");
        require(deadline == 0 || deadline > block.timestamp, "deadline passed");
        return _create(seed, dna, loopedBy, palette, corruption, voidLevel, chromaCapped,
                       EditionType.OPEN, 0, deadline, pricePerCopy);
    }

    // ---------------------------------------------------------- primary sale
    function collect(uint256 id, uint256 qty) external payable nonReentrant {
        Loop storage L = loops[id];
        require(L.creator != address(0), "no such loop");
        require(L.kind != EditionType.UNIQUE, "unique: not for edition sale");
        require(qty > 0 && qty <= 50, "qty 1..50");
        if (L.kind == EditionType.LIMITED)
            require(L.minted + qty <= L.supplyCap, "sold out");
        else if (L.deadline != 0)
            require(block.timestamp <= L.deadline, "edition closed");
        require(msg.value == uint256(L.price) * qty, "wrong payment");
        L.minted += uint64(qty);
        _bal[id][msg.sender] += qty;
        emit TransferSingle(msg.sender, address(0), msg.sender, id, qty);
        emit LoopCollected(id, msg.sender, qty);
        if (msg.value > 0) {
            (bool ok, ) = L.creator.call{value: msg.value}("");
            require(ok, "creator transfer failed");
        }
    }

    // ---------------------------------------------------------- THE SEALED (secondary market)
    // The market lives inside the token itself: listings are per (id, seller),
    // sales move balances internally (no approvals, no escrow), and the seller
    // takes 100% in the same transaction. The contract holds nothing, ever.
    struct Listing { uint128 price; uint64 qty; }
    mapping(uint256 => mapping(address => Listing)) public listings;

    event Listed(uint256 indexed id, address indexed seller, uint64 qty, uint128 pricePerCopy);
    event Delisted(uint256 indexed id, address indexed seller);
    event Bought(uint256 indexed id, address indexed seller, address buyer, uint256 qty, uint256 paid);

    function list(uint256 id, uint64 qty, uint128 pricePerCopy) external {
        require(loops[id].creator != address(0), "no such loop");
        require(qty > 0, "qty 0");
        require(pricePerCopy > 0, "price 0");
        require(_bal[id][msg.sender] >= qty, "insufficient copies");
        listings[id][msg.sender] = Listing(pricePerCopy, qty);
        emit Listed(id, msg.sender, qty, pricePerCopy);
    }

    function delist(uint256 id) external {
        require(listings[id][msg.sender].qty != 0, "not listed");
        delete listings[id][msg.sender];
        emit Delisted(id, msg.sender);
    }

    function buy(uint256 id, address seller, uint256 qty) external payable nonReentrant {
        Listing storage S = listings[id][seller];
        require(S.qty != 0, "not listed");
        require(qty > 0 && qty <= S.qty, "qty exceeds listing");
        require(msg.sender != seller, "self buy");
        uint256 b = _bal[id][seller];
        require(b >= qty, "seller lacks copies");
        require(msg.value == uint256(S.price) * qty, "wrong payment");
        if (qty == uint256(S.qty)) delete listings[id][seller];
        else S.qty -= uint64(qty);
        unchecked { _bal[id][seller] = b - qty; }
        _bal[id][msg.sender] += qty;
        emit TransferSingle(msg.sender, seller, msg.sender, id, qty);
        emit Bought(id, seller, msg.sender, qty, msg.value);
        _checkReceiver(msg.sender, seller, msg.sender, id, qty, "");
        // the seller takes all: 100%, in-tx, nothing retained
        (bool ok, ) = seller.call{value: msg.value}("");
        require(ok, "seller transfer failed");
    }

    // ---------------------------------------------------------- ERC-1155 surface
    function balanceOf(address account, uint256 id) public view returns (uint256) {
        require(account != address(0), "zero address");
        return _bal[id][account];
    }
    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids)
        external view returns (uint256[] memory out)
    {
        require(accounts.length == ids.length, "length mismatch");
        out = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) out[i] = balanceOf(accounts[i], ids[i]);
    }
    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external {
        require(from == msg.sender || isApprovedForAll[from][msg.sender], "not authorized");
        require(to != address(0), "zero address");
        uint256 b = _bal[id][from];
        require(b >= amount, "insufficient");
        unchecked { _bal[id][from] = b - amount; }
        _bal[id][to] += amount;
        emit TransferSingle(msg.sender, from, to, id, amount);
        _checkReceiver(msg.sender, from, to, id, amount, data);
    }
    function safeBatchTransferFrom(address from, address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data) external {
        require(from == msg.sender || isApprovedForAll[from][msg.sender], "not authorized");
        require(to != address(0), "zero address");
        require(ids.length == amounts.length, "length mismatch");
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 b = _bal[ids[i]][from];
            require(b >= amounts[i], "insufficient");
            unchecked { _bal[ids[i]][from] = b - amounts[i]; }
            _bal[ids[i]][to] += amounts[i];
        }
        emit TransferBatch(msg.sender, from, to, ids, amounts);
        if (to.code.length > 0) {
            try IERC1155Receiver(to).onERC1155BatchReceived(msg.sender, from, ids, amounts, data) returns (bytes4 r) {
                require(r == IERC1155Receiver.onERC1155BatchReceived.selector, "receiver rejected");
            } catch { revert("receiver rejected"); }
        }
    }
    function _checkReceiver(address op, address from, address to, uint256 id, uint256 amount, bytes memory data) private {
        if (to.code.length > 0) {
            try IERC1155Receiver(to).onERC1155Received(op, from, id, amount, data) returns (bytes4 r) {
                require(r == IERC1155Receiver.onERC1155Received.selector, "receiver rejected");
            } catch { revert("receiver rejected"); }
        }
    }
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7      // ERC-165
            || interfaceId == 0xd9b67a26      // ERC-1155
            || interfaceId == 0x0e89341c;     // ERC-1155 metadata
    }

    // ---------------------------------------------------------- engine registry
    function addEngine(string calldata version, string calldata rendererBase) external onlyOwner {
        require(bytes(engineRenderer[version]).length == 0, "version exists: registry is append-only");
        engineRenderer[version] = rendererBase;
        emit EngineAdded(version, rendererBase);
    }
    function setCurrentEngine(string calldata version) external onlyOwner {
        require(bytes(engineRenderer[version]).length != 0, "unknown version");
        currentEngine = version;
    }
    function setImageBase(string calldata base) external onlyOwner { imageBase = base; }
    function transferOwnership(address n) external onlyOwner { require(n != address(0)); owner = n; }

    // ---------------------------------------------------------- on-chain metadata
    function uri(uint256 id) external view returns (string memory) {
        Loop storage L = loops[id];
        require(L.creator != address(0), "no such loop");
        string memory kindStr = L.kind == EditionType.UNIQUE ? "UNIQUE"
                              : L.kind == EditionType.LIMITED ? "LIMITED" : "OPEN";
        bytes memory json = abi.encodePacked(
            '{"name":"DITHERVOID PANDORA #', _u(id),
            '","description":"A loop pulled from PANDORA, the generative engine by Greencross. The machine offered; a human chose; this is the record of that moment \\u2014 a collaboration between artist and stranger, sealed on the chain. DNA: ',
            L.dna,
            '. This work is CC0: no rights reserved. Copy it, remix it, sell it, build on it \\u2014 you are encouraged to.",',
            '"image":"', imageBase, _u(uint256(L.seed)), '.png",',
            '"animation_url":"', engineRenderer[L.engine], L.dna, '",'
        );
        json = abi.encodePacked(json,
            '"attributes":[',
            '{"trait_type":"EDITION TYPE","value":"', kindStr, '"},',
            '{"trait_type":"LOOPED BY","value":"', L.loopedBy, '"},',
            '{"trait_type":"CORRUPTION","value":', _u(L.corruption), '},',
            '{"trait_type":"VOID","value":', _u(L.voidLevel), '},',
            '{"trait_type":"PALETTE","value":"', L.palette, '"},',
            '{"trait_type":"CHROMA","value":"', L.chromaCapped ? "CAPPED" : "FULL SPECTRUM", '"},',
            '{"trait_type":"ENGINE VERSION","value":"', L.engine, '"}',
            ']}'
        );
        return string(abi.encodePacked("data:application/json;base64,", _b64(json)));
    }

    // ---------------------------------------------------------- tiny libs
    function _u(uint256 v) private pure returns (string memory) {
        if (v == 0) return "0";
        uint256 t = v; uint256 d;
        while (t != 0) { d++; t /= 10; }
        bytes memory b = new bytes(d);
        while (v != 0) { d--; b[d] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(b);
    }
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

interface IERC1155Receiver {
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external returns (bytes4);
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata) external returns (bytes4);
}
