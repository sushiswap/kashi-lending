// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;
import "@sushiswap/bentobox-sdk/contracts/IBentoBoxV1.sol";
import "../KashiPair.sol";
import "../BKashiPair.sol";

contract KashiPairMock is KashiPair { 
    constructor(IBentoBoxV1 bentoBox) public KashiPair(bentoBox) {
        return;
    }

    function accrueTwice() public {
        accrue();
        accrue();
    }
}

contract BKashiPairMock is BKashiPair {
    constructor(IBentoBoxV1 bentoBox) public BKashiPair(bentoBox) {
        return;
    }

    function accrueTwice() public {
        accrue();
        accrue();
    }

    function setBProtocolMock(address bprotocol_) public {
        require(bprotocol == address(0x0)/*, "BKashiPair: bprotocol alread initialized"*/);
        bprotocol = bprotocol_;
        emit BProtocol(bprotocol_);
    }    
}
