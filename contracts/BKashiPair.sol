// SPDX-License-Identifier: UNLICENSED


pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;
import "./KashiPair.sol";

contract BKashiPair is KashiPair { 
    address public bprotocol;

    event BProtocol(address bprotocol_);

    /// @notice The constructor is only used for the initial master contract. Subsequent clones are initialised via `init`.
    constructor(IBentoBoxV1 bentoBox_) public KashiPair(bentoBox_) {}

    function setBProtocol(address bprotocol_) public onlyOwner {
        require(bprotocol == address(0x0)/*, "BKashiPair: bprotocol alread initialized"*/);
        bprotocol = bprotocol_;
        emit BProtocol(bprotocol_);
    }

    function liquidate(
        address[] calldata users,
        uint256[] calldata maxBorrowParts,
        address to,
        ISwapper swapper,
        bool open
    ) public
      override
    {
        if(bprotocol != address(0x0) && bprotocol != address(0xdead)) {
            require(msg.sender == bprotocol, "liquidate: not bprotocol");
        }

        super.liquidate(users, maxBorrowParts, to, swapper, open);
    }
}
