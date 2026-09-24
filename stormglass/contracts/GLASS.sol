// SPDX-License-Identifier: CC0-1.0
pragma solidity 0.8.24;

/*
  THE GLASS — what a STORMGLASS token shows when it is read.

  The whole token page (the engine, the OS, the print) lives on the chain in
  chunks, gzipped. tokenURI hands back a small page that carries the plate's
  seed and everything the chain knows at that moment (the sky), then unpacks
  the engine in the browser. No server, no address, nothing to expire.

  The sky, read at the moment of the call:
    gas       the base fee, gwei            -> the weather
    hunger    the blob base fee, gwei       -> the screen loop's corruption
    hour      the time in Miami             -> the sun's arc, the night
    moon      the phase of the moon         -> the moon's shape
    tide      spring at new and full        -> the water
    wind      the day's own roll            -> rain and fog
    flood     ETH against its seven-day mean, from the pool's own price -> the water rises over the base
    peg       the dollar's shadow off its peg, from the USDC/USDT pool -> the counterfeit impression
    pulse     hours since anyone paid       -> the screen loop ruptures
    age       days since the candle         -> the horizon sinks
    lamps     weeks the owner has held it   -> lamps round the monument
    weight    the owner's balance           -> haze
    witnesses those who paid to be present -> the first notches, in the accent
    hands     every holder since            -> the notches after
    lineage   the picks that led here       -> the strip along the edge
*/

interface IStorm {
    function plates(uint256) external view returns (uint32 seed, uint64 open, uint64 close, uint128 price, uint128 witnessed, address buyer, uint8 pick, bool sold);
    function FOUNDING() external view returns (uint256);
    function candleOpen() external view returns (uint256);
    function lastBidAt() external view returns (uint256);
    function dead() external view returns (bool);
    function tombId() external view returns (uint256);
    function ownerOf(uint256) external view returns (address);
    function ownerSince(uint256) external view returns (uint64);
    function witnessesOf(uint256) external view returns (uint32[] memory);
    function handsOf(uint256) external view returns (uint32[] memory);
    function lineageOf(uint256) external view returns (uint8[] memory);
    function ethSampleAvg() external view returns (uint256);
    function ethPool() external view returns (address);
    function pegPool() external view returns (address);
    function isDST(uint256) external pure returns (bool);
}
interface ISlot0 { function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool); }

contract GLASS {
    address public immutable storm;
    address[] private _chunks;                // the page in its three coats (see pack.py), in order

    // the loader, in three parts round the GLASS object and the page
    string private constant HEAD = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DITHERVOID // STORMGLASS</title><style>html,body{margin:0;background:#000;height:100%}</style></head><body><script>\nwindow.GLASS=';
    string private constant MID  = ';\n(async()=>{var b=Uint8Array.from(atob("';
    string private constant TAIL = '"),function(c){return c.charCodeAt(0)});\nvar d=new DecompressionStream("gzip"),w=d.writable.getWriter();w.write(b);w.close();\nvar h=await new Response(d.readable).text();var G=window.GLASS;document.open();document.write(h);document.close();window.GLASS=G;})();\n</script></body></html>';

    constructor(address _storm, address[] memory chunks_) {
        storm = _storm; _chunks = chunks_;
    }
    function chunks() external view returns (address[] memory) { return _chunks; }

    /* THE THREE COATS. tokenURI must return base64(JSON); the JSON carries base64(HTML); the
       HTML carries base64(gzip(page)). Base64 splits cleanly on three-byte boundaries, so the
       chain holds base64(base64(base64(gzip))) with the inner text padded to a multiple of
       nine, and every wrapper is padded with spaces (harmless in JSON, in JS and to atob) to
       a multiple of three. Nothing large is ever encoded here: it is only put together. */
    function coat() public view returns (bytes memory out) {
        uint256 total = 0;
        for (uint256 i = 0; i < _chunks.length; i++) total += _chunks[i].code.length - 1;
        out = new bytes(total);
        uint256 off = 0;
        for (uint256 i = 0; i < _chunks.length; i++) {
            address c = _chunks[i]; uint256 n = c.code.length - 1;
            assembly { extcodecopy(c, add(add(out, 32), off), 1, n) }
            off += n;
        }
    }

    // ---------------------------------------------------------- the token
    function tokenURI(uint256 id) external view returns (string memory) {
        IStorm S = IStorm(storm);
        (uint32 seed, , , uint128 price, , address buyer, uint8 pick, ) = S.plates(id);
        bool tomb = S.dead() && id == S.tombId();
        string memory title = id == 0 ? "PLATE ZERO" : tomb ? "THE TOMBSTONE" : string(abi.encodePacked("DAY ", _u(id)));
        bytes memory glassObj = abi.encodePacked(
            '{"seed":', _u(seed), ',"frames":36', _s(id == 0, ',"subject":44', _s(tomb, ',"subject":45', '')),
            ',"live":', _sky(S, id), '}');
        bytes memory svg = abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><rect width="1000" height="1000" fill="#000"/>',
            '<g font-family="Menlo,Consolas,monospace" fill="#e8e8ec" text-anchor="middle"><text x="500" y="440" font-size="26" letter-spacing="8">DITHERVOID // STORMGLASS</text>',
            '<text x="500" y="530" font-size="64" letter-spacing="6">', title, '</text>',
            '<text x="500" y="600" font-size="22" fill="#8a8a94" letter-spacing="4">SEED ', _u(seed), '</text>',
            '<text x="500" y="940" font-size="18" fill="#8a8a94" letter-spacing="4">THE PLATE LIVES IN THE ANIMATION</text></g></svg>');
        // the html's head, padded so its base64 stops on a whole group, then encoded
        bytes memory hh = abi.encodePacked(HEAD, glassObj, _spaces(bytes(HEAD).length + glassObj.length + bytes(MID).length), MID);
        bytes memory jsonHead = abi.encodePacked(
            '{"name":"DITHERVOID // STORMGLASS \\u00b7 ', title,
            '","description":"One plate a day at a falling price, the chain writing the sky, until it dies. ',
            _s(id == 0, 'Plate Zero, sold by candle: the founding plate, rerolled by every bid.', _s(tomb, 'The Tombstone. The day the vault could not pay; the collection is dead, and this is its grave.', 'A monument on an empty plain, lit by one sun, printed with the PANDORA loop it wears. Every plate carries the picks that led to it.')),
            ' Seed ', _u(seed), '. The engine and the print are on the chain; what you see is read at the moment you look. CC0. Greencross, always.",',
            '"image":"data:image/svg+xml;base64,', _b64(svg), '",',
            '"animation_url":');
        // the json's head, up to and including the html's encoded head, padded to a whole group
        bytes memory b64hh = bytes(_b64(hh));
        bytes memory jh = abi.encodePacked(jsonHead, _spaces(jsonHead.length + 23 + b64hh.length), '"data:text/html;base64,', b64hh);
        bytes memory jsonTail = abi.encodePacked(_b64(bytes(TAIL)), '",',
            '"attributes":[{"trait_type":"PLATE","value":"', title, '"},',
            '{"trait_type":"PRICE","value":"', _eth(price), ' ETH"},',
            '{"trait_type":"WITNESSES","value":', _u(S.witnessesOf(id).length), '},',
            '{"trait_type":"PICK","value":', _u(pick), '},',
            '{"trait_type":"HELD BY THE VAULT","value":"', _s(buyer == storm, 'YES', 'NO'), '"}]}');
        return string(abi.encodePacked("data:application/json;base64,", _b64(jh), coat(), _b64(jsonTail)));
    }
    /* the spaces that bring a length to a multiple of three */
    function _spaces(uint256 len) private pure returns (bytes memory) {
        uint256 n = (3 - len % 3) % 3;
        if (n == 0) return ""; if (n == 1) return " "; return "  ";
    }

    // ---------------------------------------------------------- the sky
    /* the sky over any plate, minted or not: the site reads it for the day on sale */
    function sky(uint256 id) external view returns (string memory) { return string(_sky(IStorm(storm), id)); }
    function _sky(IStorm S, uint256 id) private view returns (bytes memory) {
        uint256 t = block.timestamp;
        (uint32 seed, uint64 open, , , , , , ) = S.plates(id);
        uint256 local = t - (S.isDST(t) ? 4 hours : 5 hours);
        uint256 hour100 = (local % 86400) * 100 / 3600;                       // hour in Miami, two decimals
        uint256 phase1e4 = ((t - 947182440) % 2551443) * 10000 / 2551443;      // the moon, 0 new .. 0.5 full .. 1
        uint256 u = (phase1e4 * 2) % 10000; uint256 tide1e4 = 10000 - 2 * (u < 5000 ? u : 10000 - u);
        uint256 windRoll = uint256(keccak256(abi.encodePacked(seed, id, uint256(open) / 86400))) % 201;   // -1.00 .. 1.00
        uint256 weeks_ = 0; uint256 weight100 = 0;
        try S.ownerOf(id) returns (address owner) {
            weeks_ = (t - S.ownerSince(id)) / 1 weeks; if (weeks_ > 7) weeks_ = 7;
            uint256 bal = owner.balance; weight100 = bal >= 10 ether ? 100 : bal * 100 / 10 ether;
        } catch {}
        uint256 age = (t - S.candleOpen()) / 1 days; if (age > 365) age = 365;
        uint256 pulse100 = (t - S.lastBidAt()) * 100 / 24 hours; if (pulse100 > 100) pulse100 = 100;
        bytes memory a = abi.encodePacked(
            '{"gas":', _dec(block.basefee, 9, 3),
            ',"hunger":', _dec(block.blobbasefee, 9, 3),
            ',"hour":', _dec(hour100, 2, 2),
            ',"moon":', _dec(phase1e4, 4, 4),
            ',"tide":', _dec(tide1e4, 4, 4),
            ',"wind":', _s(windRoll < 100, '-', ''), _dec(windRoll < 100 ? 100 - windRoll : windRoll - 100, 2, 2));
        bytes memory b = abi.encodePacked(
            ',"flood":', _dec(_flood(S), 4, 4),
            ',"peg":', _dec(_peg(S), 4, 4),
            ',"pulse":', _dec(pulse100, 2, 2),
            ',"age":', _u(age),
            ',"lamps":', _u(weeks_),
            ',"weight":', _dec(weight100, 2, 2),
            ',"witnesses":', _list32(S.witnessesOf(id)),
            ',"hands":', _list32(S.handsOf(id)),
            ',"lineage":', _list8(S.lineageOf(id)), '}');
        return abi.encodePacked(a, b);
    }

    /* ETH against its own seven-day mean: the pool's sqrt price is WETH per USDC, so a fall in
       ETH is a rise in it. Returns the drawdown, 1e4 = 100%. Nothing to read means dry. */
    function _flood(IStorm S) private view returns (uint256) {
        address p = S.ethPool(); if (p == address(0)) return 0;
        uint256 avg = S.ethSampleAvg(); if (avg == 0) return 0;
        try ISlot0(p).slot0() returns (uint160 sp, int24, uint16, uint16, uint16, uint8, bool) {
            uint256 now_ = uint256(sp) >> 64; if (now_ <= avg) return 0;
            uint256 r = avg * avg * 10000 / (now_ * now_);       // (avg/now)^2 -> the price ratio
            return 10000 - r;
        } catch { return 0; }
    }
    /* USDT per USDC from the pool, the deviation from one in percent, 1e4 = 1.00% */
    function _peg(IStorm S) private view returns (uint256) {
        address p = S.pegPool(); if (p == address(0)) return 0;
        try ISlot0(p).slot0() returns (uint160 sp, int24, uint16, uint16, uint16, uint8, bool) {
            uint256 q = uint256(sp) >> 48;                          // ~2^48 at par
            uint256 price1e6 = q * q * 1e6 >> 96;                    // (sp/2^96)^2 scaled 1e6
            uint256 dev = price1e6 > 1e6 ? price1e6 - 1e6 : 1e6 - price1e6;
            return dev * 100 * 10000 / 1e6;                          // percent, four decimals
        } catch { return 0; }
    }

    // ---------------------------------------------------------- tiny libs
    function _list32(uint32[] memory v) private pure returns (bytes memory out) {
        out = "["; for (uint256 i = 0; i < v.length; i++) out = abi.encodePacked(out, _s(i == 0, "", ","), _u(v[i])); out = abi.encodePacked(out, "]");
    }
    function _list8(uint8[] memory v) private pure returns (bytes memory out) {
        out = "["; for (uint256 i = 0; i < v.length; i++) out = abi.encodePacked(out, _s(i == 0, "", ","), _u(v[i])); out = abi.encodePacked(out, "]");
    }
    function _s(bool c, string memory a, string memory b) private pure returns (string memory) { return c ? a : b; }
    /* v scaled by 10^scale, printed with `places` decimals (places <= scale) */
    function _dec(uint256 v, uint8 scale, uint8 places) private pure returns (string memory) {
        uint256 div = 10 ** scale; uint256 whole = v / div; uint256 frac = v % div;
        if (places == 0) return _u(whole);
        frac = frac / (10 ** (scale - places));
        bytes memory f = bytes(_u(frac));
        bytes memory pad = new bytes(places - f.length); for (uint256 i = 0; i < pad.length; i++) pad[i] = "0";
        return string(abi.encodePacked(_u(whole), ".", pad, f));
    }
    function _eth(uint256 wei_) private pure returns (string memory) { return _dec(wei_, 18, 4); }
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
