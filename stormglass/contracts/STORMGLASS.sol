// SPDX-License-Identifier: CC0-1.0
pragma solidity 0.8.24;

/*
  DITHERVOID // STORMGLASS — one plate a day, at a falling price, until it dies.

  THE CANDLE. Plate Zero is sold by candle: an ascending auction, every bid
  escrowed, the outbid refunded at once, and every bid rerolls the plate.
  After twenty-four hours the candle may go out at any moment inside a window
  of up to six hours; the moment is drawn from a block hash fixed in advance.
  The leader at that moment wins. The winning bid is FOUNDING: Plate Zero's
  price and the price of a seat, forever.

  THE DAYS. Every day at 4:20pm in Miami (daylight saving followed, on chain)
  the day's plate closes and the next opens. Its price starts at the greater
  of FOUNDING and four times the median of the last seven sales, plus whatever
  the day's witnesses paid, and halves every 2.4 hours, so it is nearly nothing
  by the close. The first buy wins. No bids, no refunds, no extensions. The
  buyer chooses tomorrow's plate from thirty-two candidates; that choice is
  printed on every plate that descends from it.

  THE VAULT. An unsold day is bought by the vault at the reference price (the
  median of the last seven sales, or a tenth of FOUNDING, whichever is more) if
  it can pay, and held forever. If it cannot, the Tombstone is minted and the
  collection is dead. Death is possible.

  WITNESSES. Anyone may pay any amount toward the day's plate: it buys seats
  at the founding rate (at most one seat a day), cuts a notch on the plate in
  the accent ink, and raises the day's price by what was paid.

  MONEY. Seventy to the artist, in the transaction. Twenty to the seats.
  Ten to the vault. Plate Zero: seventy to the artist, thirty to the vault.
  Royalties: 6.9% to the vault (EIP-2981, a suggestion the market may honour).
  There is no owner and there are no dials. Set, and forgotten.

  CC0. Greencross, always.
*/

interface IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4);
}
interface IUniV3Slot0 {
    function slot0() external view returns (uint160 sqrtPriceX96, int24, uint16, uint16, uint16, uint8, bool);
}
interface IGlass {
    function tokenURI(uint256 id) external view returns (string memory);
    function storm() external view returns (address);
}

contract STORMGLASS {
    // ---------------------------------------------------------- the constants
    address public constant ARTIST   = 0x19A84bF7b5DA2C290CB0Ca42bf691dd6C2308359;
    uint256 public constant RESERVE  = 0.01 ether;   // the least a candle bid may be; FOUNDING if nobody bids
    uint256 public constant HALF     = 8640;         // seconds per halving: 2.4 hours
    uint256 public constant CANDLE   = 24 hours;     // the candle burns at least this long
    uint256 public constant WINDOW   = 6 hours;      // and goes out inside this window after
    uint256 public constant FOUNDERS = 24 hours;     // founders' day
    uint256 public constant ROYALTY  = 690;          // 6.9% in basis points
    uint256 public constant MAXMARKS = 200;          // witnesses and hands the plate can carry

    string public constant name   = "DITHERVOID // STORMGLASS";
    string public constant symbol = "GLASS";

    // ---------------------------------------------------------- set once
    IGlass       public immutable glass;      // THE GLASS: tokenURI, the page and the sky
    IUniV3Slot0  public immutable ethPool;    // ETH/USDC, for the flood (zero on a chain without it)
    IUniV3Slot0  public immutable pegPool;    // USDC/USDT, for the counterfeit
    uint256      public immutable revealBlock;// the block whose hash decides when the candle goes out
    uint256      public immutable candleOpen;

    // ---------------------------------------------------------- the candle
    struct Bid { address bidder; uint128 amount; uint64 at; uint32 seed; }
    Bid[] public bids;                        // every bid that was leader when made, in order
    uint32  public zeroSeed;                  // rerolled by every bid
    uint256 public candleClose;               // 0 until sealed
    bool    public candleSettled;
    uint256 public FOUNDING;                  // the winning bid: the price of Plate Zero and of a seat
    uint256 public foundersEnd;

    // ---------------------------------------------------------- the days
    struct Day {
        uint32  seed;
        uint64  open;
        uint64  close;
        uint128 price;      // what it sold for (the vault's reference when the vault bought)
        uint128 witnessed;  // what the witnesses paid
        address buyer;      // zero until sold; address(this) when the vault holds it
        uint8   pick;       // the buyer's choice for tomorrow, 0..31
        bool    sold;
    }
    mapping(uint256 => Day) public plates;      // token id => day (id 0 is Plate Zero, closed at candleClose)
    uint256 public today;                     // the id of the day on sale (0 before day 1 opens)
    uint256 public lastId;                    // the highest id minted
    bool    public dead;                      // the Tombstone has been minted
    uint256 public tombId;
    uint256[] public salePrices;              // every day's price, in order (the median reads the last seven)
    uint256 public lastBidAt;                 // any money at all: bid, pledge, buy, witness

    // ---------------------------------------------------------- the money
    uint256 public vault;                     // held here, for the unsold days; royalties land here too
    uint256 public seatPool;                  // what the seats have earned and not yet claimed
    uint256 public totalSeats;                // 1e18 = one seat
    uint256 private accPerSeat;               // seat earnings accumulator, 1e18 scale
    mapping(address => uint256) public seats;
    mapping(address => uint256) private seatDebt;
    mapping(address => uint256) public owed;  // refunds that could not be pushed
    mapping(uint256 => mapping(address => uint256)) public dayPaid;   // day => wallet => paid (for the seat cap)
    mapping(uint256 => mapping(address => uint256)) private daySeat;  // day => wallet => seats granted

    // ---------------------------------------------------------- the marks the plate wears
    mapping(uint256 => uint32[]) private _witnesses;  // per token, in order
    mapping(uint256 => uint32[]) private _hands;      // per token: one per transfer, in order
    uint8[] public picks;                             // the lineage: picks[d] chose day d+1's plate
    uint160[7] public ethSamples;                     // the pool's sqrt price, sampled once a day
    uint8 public ethSampleN;
    uint8 private ethSampleI;

    // ---------------------------------------------------------- ERC-721
    mapping(uint256 => address) private _owner;
    mapping(address => uint256) private _balance;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;
    mapping(uint256 => uint64) public ownerSince;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    event BidPlaced(address indexed bidder, uint256 amount, uint32 seed);
    event CandleSealed(uint256 closeAt);
    event CandleSettled(address indexed winner, uint256 founding, uint32 seed);
    event Pledged(address indexed who, uint256 amount, uint256 seats);
    event DayOpened(uint256 indexed id, uint32 seed, uint64 open, uint64 close);
    event Bought(uint256 indexed id, address indexed buyer, uint256 price, uint8 pick);
    event Witnessed(uint256 indexed id, address indexed who, uint256 amount);
    event VaultBought(uint256 indexed id, uint256 price);
    event Died(uint256 indexed tombId);
    event SeatsClaimed(address indexed who, uint256 amount);

    bool private _entered;
    modifier nonReentrant(){ require(!_entered, "reentrant"); _entered = true; _; _entered = false; }

    constructor(address _glass, address _ethPool, address _pegPool) {
        require(IGlass(_glass).storm() == address(this), "the glass is not ours");
        glass = IGlass(_glass);
        ethPool = IUniV3Slot0(_ethPool);
        pegPool = IUniV3Slot0(_pegPool);
        candleOpen = block.timestamp;
        revealBlock = block.number + CANDLE / 12;          // about twenty-four hours of blocks
        zeroSeed = uint32(uint256(keccak256(abi.encodePacked(block.prevrandao, block.timestamp, address(this)))));
        lastBidAt = block.timestamp;
    }

    // ═══════════════════════════════════════════════════════════ THE CANDLE
    function bid() external payable nonReentrant {
        require(!candleSettled, "the candle is out");
        if (block.number > revealBlock && candleClose == 0) _seal();
        require(candleClose == 0 || block.timestamp < candleClose, "the candle is out");
        uint256 n = bids.length;
        uint256 lead = n == 0 ? 0 : bids[n - 1].amount;
        require(msg.value >= RESERVE && msg.value > lead, "bid more");
        uint32 s = uint32(uint256(keccak256(abi.encodePacked(zeroSeed, msg.sender, msg.value, block.number))));
        zeroSeed = s;
        bids.push(Bid(msg.sender, uint128(msg.value), uint64(block.timestamp), s));
        lastBidAt = block.timestamp;
        emit BidPlaced(msg.sender, msg.value, s);
        // before the window the outbid are refunded at once; inside it everyone waits for the flame
        if (n > 0 && block.timestamp < candleOpen + CANDLE) _pay(bids[n - 1].bidder, lead);
    }

    /* the moment the candle goes out is drawn from the hash of a block fixed at deploy.
       Anyone may seal it once that block is past; a bid does it too. If no one comes for
       256 blocks the hash is gone and the latest block stands in for it. */
    function seal() external { require(block.number > revealBlock, "not yet"); require(candleClose == 0, "sealed"); _seal(); }
    function _seal() private {
        bytes32 h = blockhash(revealBlock);
        if (h == bytes32(0)) h = blockhash(block.number - 1);
        candleClose = candleOpen + CANDLE + (uint256(keccak256(abi.encodePacked(h, address(this)))) % WINDOW);
        emit CandleSealed(candleClose);
    }

    function settleCandle() external nonReentrant {
        require(!candleSettled, "settled");
        if (candleClose == 0) { require(block.number > revealBlock, "the candle burns"); _seal(); }
        require(block.timestamp >= candleClose, "the candle burns");
        candleSettled = true;
        uint256 n = bids.length;
        uint256 w = type(uint256).max;
        for (uint256 i = 0; i < n; i++) { if (bids[i].at <= candleClose) w = i; }
        uint32 seed; address winner; uint256 amount;
        if (w == type(uint256).max) {
            // nobody bid in time: Plate Zero is the artist's, at the reserve
            winner = ARTIST; amount = 0; seed = zeroSeed; FOUNDING = RESERVE;
        } else {
            Bid storage B = bids[w]; winner = B.bidder; amount = B.amount; seed = B.seed; FOUNDING = amount;
        }
        // the bids made after the flame went out, and any leader that waited inside the window, are returned
        for (uint256 i = 0; i < n; i++) {
            if (i == w) continue;
            if (i + 1 < n && bids[i + 1].at < candleOpen + CANDLE) continue;   // refunded at once when outbid before the window
            _pay(bids[i].bidder, bids[i].amount);
        }
        plates[0] = Day(seed, uint64(candleOpen), uint64(candleClose), uint128(amount), 0, winner, 0, true);
        _mint(winner, 0);
        salePrices.push(amount);
        if (amount > 0) { uint256 a = amount * 70 / 100; vault += amount - a; _pay(ARTIST, a); }
        foundersEnd = block.timestamp + FOUNDERS;
        // the chain chooses day one's plate
        uint8 p = uint8(uint256(keccak256(abi.encodePacked(block.prevrandao, seed))) % 32);
        picks.push(p);
        emit CandleSettled(winner, FOUNDING, seed);
    }

    // ═══════════════════════════════════════════════════════════ FOUNDERS' DAY
    /* pay anything: seats at the founding rate, uncapped, and a notch on Plate Zero. No token. */
    function pledge() external payable nonReentrant {
        require(candleSettled && block.timestamp < foundersEnd, "not founders' day");
        require(msg.value > 0, "pay something");
        _settleSeats(msg.sender);
        _split(msg.value);
        uint256 s = msg.value * 1e18 / FOUNDING;
        _grantSeats(msg.sender, s);
        _notch(_witnesses[0], msg.sender);
        lastBidAt = block.timestamp;
        emit Pledged(msg.sender, msg.value, s);
    }

    // ═══════════════════════════════════════════════════════════ THE DAYS
    /* the clock: settles every day that has closed since anyone last came, then
       opens the day that is on sale now. Anyone may call it; buy and witness do. */
    function sync() public {
        if (!candleSettled || dead) return;
        if (today == 0) {
            if (block.timestamp < foundersEnd) return;
            uint64 open = uint64(closeAfter(foundersEnd));
            if (block.timestamp < open) return;
            _open(1, _seedFor(plates[0].seed, picks[0]), open);
        }
        while (!dead && block.timestamp >= plates[today].close) {
            Day storage D = plates[today];
            if (!D.sold) _vaultOrDie(today);
            if (dead) break;
            _open(today + 1, _seedFor(D.seed, D.pick), D.close);
        }
    }

    function _open(uint256 id, uint32 seed, uint64 open) private {
        uint64 close = uint64(closeAfter(open));
        plates[id] = Day(seed, open, close, 0, 0, address(0), 0, false);
        today = id;
        _sample();
        emit DayOpened(id, seed, open, close);
    }

    function _vaultOrDie(uint256 id) private {
        Day storage D = plates[id];
        uint256 ref = referencePrice();
        if (vault >= ref) {
            vault -= ref;
            D.sold = true; D.buyer = address(this); D.price = uint128(ref);
            D.pick = uint8(uint256(keccak256(abi.encodePacked(block.prevrandao, D.seed, id))) % 32);
            picks.push(D.pick);
            _mint(address(this), id);
            salePrices.push(ref);
            _split(ref);
            emit VaultBought(id, ref);
        } else {
            dead = true; tombId = id;
            D.sold = true; D.buyer = address(this); D.price = 0;
            _mint(address(this), id);
            emit Died(id);
        }
    }

    /* the plate on sale now, its price now, and when it closes */
    function onSale() public view returns (uint256 id, uint256 price, uint256 close, bool open) {
        if (!candleSettled || dead || today == 0) return (0, 0, 0, false);
        Day storage D = plates[today];
        if (D.sold || block.timestamp >= D.close) return (today, 0, D.close, false);
        return (today, priceAt(today, block.timestamp), D.close, true);
    }

    function startPrice(uint256 id) public view returns (uint256) {
        uint256 m = median7();
        uint256 s = 4 * m; if (s < FOUNDING) s = FOUNDING;
        return s + plates[id].witnessed;
    }

    /* halving every 2.4 hours from the open; the fraction of a halving by e^(-x), six terms */
    function priceAt(uint256 id, uint256 t) public view returns (uint256) {
        Day storage D = plates[id];
        if (t <= D.open) return startPrice(id);
        uint256 dt = t - D.open;
        uint256 p = startPrice(id) >> (dt / HALF);
        uint256 f = (dt % HALF) * 1e18 / HALF;           // 0..1e18
        uint256 x = f * 693147180559945309 / 1e18;         // f * ln 2
        // e^-x = 1 - x + x^2/2 - x^3/6 + x^4/24 - x^5/120
        uint256 x2 = x * x / 1e18; uint256 x3 = x2 * x / 1e18; uint256 x4 = x3 * x / 1e18; uint256 x5 = x4 * x / 1e18;
        uint256 e = 1e18 + x2 / 2 + x4 / 24 - x - x3 / 6 - x5 / 120;
        return p * e / 1e18;
    }

    function median7() public view returns (uint256) {
        uint256 n = salePrices.length; if (n == 0) return 0;
        uint256 k = n < 7 ? n : 7;
        uint256[] memory a = new uint256[](k);
        for (uint256 i = 0; i < k; i++) a[i] = salePrices[n - k + i];
        for (uint256 i = 1; i < k; i++) { uint256 v = a[i]; uint256 j = i; while (j > 0 && a[j - 1] > v) { a[j] = a[j - 1]; j--; } a[j] = v; }
        return k % 2 == 1 ? a[k / 2] : (a[k / 2 - 1] + a[k / 2]) / 2;
    }

    function referencePrice() public view returns (uint256) {
        uint256 m = median7(); uint256 f = FOUNDING / 10; return m > f ? m : f;
    }

    /* THE BUY. First to pay the price now takes the plate and chooses tomorrow's from thirty-two. */
    function buy(uint8 pick) external payable nonReentrant {
        sync();
        require(pick < 32, "pick 0..31");
        (uint256 id, uint256 price, , bool open) = onSale();
        require(open, "nothing on sale");
        require(msg.value >= price, "the price is higher");
        Day storage D = plates[id];
        D.sold = true; D.buyer = msg.sender; D.price = uint128(price); D.pick = pick;
        picks.push(pick);
        salePrices.push(price);
        _settleSeats(msg.sender);
        _split(price);
        _seatForDay(id, msg.sender, price);
        _mint(msg.sender, id);
        if (msg.value > price) _pay(msg.sender, msg.value - price);
        lastBidAt = block.timestamp;
        emit Bought(id, msg.sender, price, pick);
    }

    /* THE WITNESS. Any amount toward the day's plate: a seat (at most one a day), a notch, and the price rises by it. */
    function witness() external payable nonReentrant {
        sync();
        (uint256 id, , , bool open) = onSale();
        require(open, "nothing on sale");
        require(msg.value > 0, "pay something");
        Day storage D = plates[id];
        D.witnessed += uint128(msg.value);
        _settleSeats(msg.sender);
        _split(msg.value);
        _seatForDay(id, msg.sender, msg.value);
        _notch(_witnesses[id], msg.sender);
        lastBidAt = block.timestamp;
        emit Witnessed(id, msg.sender, msg.value);
    }

    /* the thirty-two candidates for tomorrow, from today's seed */
    function candidates(uint256 id) external view returns (uint32[32] memory c) {
        uint32 s = plates[id].seed; for (uint256 k = 0; k < 32; k++) c[k] = _seedFor(s, uint8(k));
    }
    function _seedFor(uint32 s, uint8 pick) private pure returns (uint32) {
        return uint32(uint256(keccak256(abi.encodePacked(s, pick))));
    }

    // ═══════════════════════════════════════════════════════════ THE MONEY
    function _split(uint256 v) private {
        uint256 a = v * 70 / 100; uint256 s = v * 20 / 100; uint256 r = v - a - s;
        if (totalSeats == 0) { r += s; } else { seatPool += s; accPerSeat += s * 1e18 / totalSeats; }
        vault += r;
        _pay(ARTIST, a);
    }
    function _seatForDay(uint256 id, address who, uint256 paid) private {
        uint256 total = dayPaid[id][who] + paid; dayPaid[id][who] = total;
        uint256 s = total * 1e18 / FOUNDING; if (s > 1e18) s = 1e18;
        uint256 had = daySeat[id][who];
        if (s > had) { daySeat[id][who] = s; _grantSeats(who, s - had); }
    }
    function _grantSeats(address who, uint256 s) private {
        seats[who] += s; totalSeats += s; seatDebt[who] = seats[who] * accPerSeat / 1e18;
    }
    /* what a wallet's seats have earned and not yet taken */
    function pending(address who) public view returns (uint256) {
        return seats[who] * accPerSeat / 1e18 - seatDebt[who];
    }
    function _settleSeats(address who) private {
        uint256 p = pending(who);
        seatDebt[who] = seats[who] * accPerSeat / 1e18;
        if (p > 0) { seatPool -= p; _pay(who, p); emit SeatsClaimed(who, p); }
    }
    function claim() external nonReentrant { _settleSeats(msg.sender); }
    /* a refund that could not be pushed waits here */
    function withdraw() external nonReentrant { uint256 v = owed[msg.sender]; require(v > 0, "nothing owed"); owed[msg.sender] = 0; (bool ok, ) = msg.sender.call{value: v}(""); require(ok, "failed"); }
    function _pay(address to, uint256 v) private {
        if (v == 0) return;
        (bool ok, ) = to.call{value: v, gas: 60000}("");
        if (!ok) owed[to] += v;
    }
    /* royalties and gifts land in the vault */
    receive() external payable { vault += msg.value; }

    // ═══════════════════════════════════════════════════════════ THE MARKS
    function _notch(uint32[] storage arr, address who) private {
        if (arr.length < MAXMARKS) arr.push(uint32(uint256(keccak256(abi.encodePacked(who, arr.length)))));
    }
    function witnessesOf(uint256 id) external view returns (uint32[] memory) { return _witnesses[id]; }
    function handsOf(uint256 id) external view returns (uint32[] memory) { return _hands[id]; }
    function picksCount() external view returns (uint256) { return picks.length; }
    function lineageOf(uint256 id) external view returns (uint8[] memory out) {
        // the picks that led to plate id: picks[0..id-1]
        uint256 n = id < picks.length ? id : picks.length;
        out = new uint8[](n); for (uint256 i = 0; i < n; i++) out[i] = picks[i];
    }
    function bidsCount() external view returns (uint256) { return bids.length; }
    function salesCount() external view returns (uint256) { return salePrices.length; }
    function _sample() private {
        if (address(ethPool) == address(0)) return;
        try ethPool.slot0() returns (uint160 sp, int24, uint16, uint16, uint16, uint8, bool) {
            ethSamples[ethSampleI] = sp; ethSampleI = uint8((ethSampleI + 1) % 7); if (ethSampleN < 7) ethSampleN++;
        } catch {}
    }
    function ethSampleAvg() external view returns (uint256) {
        if (ethSampleN == 0) return 0;
        uint256 s = 0; for (uint256 i = 0; i < ethSampleN; i++) s += uint256(ethSamples[i]) >> 64; return s / ethSampleN;
    }

    // ═══════════════════════════════════════════════════════════ THE CLOCK
    /* 4:20pm in Miami: 21:20 UTC in winter, 20:20 UTC in summer. US daylight saving since 2007:
       from the second Sunday of March at 2am to the first Sunday of November at 2am, local. */
    function closeAfter(uint256 t) public pure returns (uint256) {
        uint256 day = t / 86400;
        for (uint256 k = 0; k < 3; k++) {
            uint256 c = _closeOnDay(day + k);
            if (c > t) return c;
        }
        revert("clock");
    }
    function _closeOnDay(uint256 day) private pure returns (uint256) {
        (uint256 y, uint256 m, uint256 d) = _civil(day);
        bool dst = _isDST(y, m, d, day);
        return day * 86400 + (dst ? 20 hours + 20 minutes : 21 hours + 20 minutes);
    }
    function isDST(uint256 t) public pure returns (bool) {
        uint256 day = t / 86400; (uint256 y, uint256 m, uint256 d) = _civil(day); return _isDST(y, m, d, day);
    }
    /* decided by the calendar date of the Miami afternoon, which is the UTC date of 4:20pm Miami */
    function _isDST(uint256, uint256 m, uint256 d, uint256 day) private pure returns (bool) {
        if (m < 3 || m > 11) return false;
        if (m > 3 && m < 11) return true;
        uint256 dow = (day + 4) % 7;                       // 0 Sunday
        uint256 first = (d + 35 - dow) % 7;                // the first Sunday's date this month
        if (first == 0) first = 7;
        if (m == 3) { uint256 second = first + 7; return d >= second; }
        return d < first;                                  // November: DST until the first Sunday
    }
    /* days since 1970-01-01 -> civil date (Howard Hinnant's algorithm) */
    function _civil(uint256 z) private pure returns (uint256 y, uint256 m, uint256 d) {
        z += 719468;
        uint256 era = z / 146097;
        uint256 doe = z - era * 146097;
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        y = yoe + era * 400;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        d = doy - (153 * mp + 2) / 5 + 1;
        m = mp < 10 ? mp + 3 : mp - 9;
        if (m <= 2) y += 1;
    }

    // ═══════════════════════════════════════════════════════════ ERC-721
    function balanceOf(address a) external view returns (uint256) { require(a != address(0), "zero address"); return _balance[a]; }
    function ownerOf(uint256 id) public view returns (address) { address o = _owner[id]; require(o != address(0), "no such plate"); return o; }
    function totalSupply() external view returns (uint256) { return _owner[0] == address(0) ? 0 : lastId + 1; }
    function approve(address to, uint256 id) external {
        address o = ownerOf(id); require(msg.sender == o || isApprovedForAll[o][msg.sender], "not authorized");
        getApproved[id] = to; emit Approval(o, to, id);
    }
    function setApprovalForAll(address op, bool ok) external { isApprovedForAll[msg.sender][op] = ok; emit ApprovalForAll(msg.sender, op, ok); }
    function transferFrom(address from, address to, uint256 id) public {
        address o = ownerOf(id);
        require(o == from, "wrong from");
        require(msg.sender == o || getApproved[id] == msg.sender || isApprovedForAll[o][msg.sender], "not authorized");
        require(to != address(0), "zero address");
        require(from != address(this), "the vault holds forever");
        delete getApproved[id];
        _balance[from] -= 1; _balance[to] += 1; _owner[id] = to; ownerSince[id] = uint64(block.timestamp);
        _notch(_hands[id], to);
        emit Transfer(from, to, id);
    }
    function safeTransferFrom(address from, address to, uint256 id) external { safeTransferFrom(from, to, id, ""); }
    function safeTransferFrom(address from, address to, uint256 id, bytes memory data) public {
        transferFrom(from, to, id);
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, id, data) returns (bytes4 r) { require(r == IERC721Receiver.onERC721Received.selector, "receiver rejected"); }
            catch { revert("receiver rejected"); }
        }
    }
    function _mint(address to, uint256 id) private {
        require(_owner[id] == address(0), "minted");
        _owner[id] = to; _balance[to] += 1; ownerSince[id] = uint64(block.timestamp);
        if (id > lastId) lastId = id;
        emit Transfer(address(0), to, id);
    }
    function supportsInterface(bytes4 i) external pure returns (bool) {
        return i == 0x01ffc9a7 || i == 0x80ac58cd || i == 0x5b5e139f || i == 0x2a55205a;   // 165, 721, 721 metadata, 2981
    }
    function royaltyInfo(uint256, uint256 salePrice) external view returns (address, uint256) { return (address(this), salePrice * ROYALTY / 10000); }
    function tokenURI(uint256 id) external view returns (string memory) { ownerOf(id); return glass.tokenURI(id); }
    function isTomb(uint256 id) external view returns (bool) { return dead && id == tombId; }
}
