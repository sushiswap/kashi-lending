// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
import "@boringcrypto/boring-solidity/contracts/libraries/BoringMath.sol";
import "@sushiswap/core/contracts/uniswapv2/interfaces/IUniswapV2Factory.sol";
import "@sushiswap/core/contracts/uniswapv2/interfaces/IUniswapV2Pair.sol";
import "../interfaces/ISwapper.sol";
import "@sushiswap/bentobox-sdk/contracts/IBentoBoxV1.sol";

contract SushiSwapOneHopSwapper is ISwapper {
    using BoringMath for uint256;

    // Local variables
    IBentoBoxV1 public immutable bentoBox;
    IUniswapV2Factory public immutable factory;
    IERC20 public immutable middleToken;
    bytes32 public pairCodeHash;

    constructor(
        IBentoBoxV1 bentoBox_,
        IUniswapV2Factory factory_,
        bytes32 pairCodeHash_,
        IERC20 middleToken_
    ) public {
        bentoBox = bentoBox_;
        factory = factory_;
        pairCodeHash = pairCodeHash_;
        middleToken = middleToken_;
    }

    // Given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountOut) {
        uint256 amountInWithFee = amountIn.mul(997);
        uint256 numerator = amountInWithFee.mul(reserveOut);
        uint256 denominator = reserveIn.mul(1000).add(amountInWithFee);
        amountOut = numerator / denominator;
    }

    /// How much ETH do we need to get the desired output amount, and how much input to get that ETH?
    function getAmountsIn(
        IUniswapV2Pair pair0,
        IUniswapV2Pair pair1,
        IERC20 fromToken,
        IERC20 toToken,
        uint256 amountToExact
    ) internal view returns (uint256 amountFrom, uint256 amountMiddle) {
        // See how much ETH we need to swap to get the desired amount
        uint256 reserveIn;
        uint256 reserveOut;
        if (middleToken < toToken) {
            (reserveIn, reserveOut, ) = pair1.getReserves();
        } else {
            (reserveOut, reserveIn, ) = pair1.getReserves();
        }
        uint256 numerator = reserveIn.mul(amountToExact).mul(1000);
        uint256 denominator = reserveOut.sub(amountToExact).mul(997);
        amountMiddle = (numerator / denominator).add(1);

        // See how much FROM we need to get that ETH:
        if (fromToken < middleToken) {
            (reserveIn, reserveOut, ) = pair0.getReserves();
        } else {
            (reserveOut, reserveIn, ) = pair0.getReserves();
        }
        numerator = reserveIn.mul(amountMiddle).mul(1000);
        denominator = reserveOut.sub(amountMiddle).mul(997);
        amountFrom = (numerator / denominator).add(1);
    }

    // Swaps to a flexible amount, from an exact input amount
    /// @inheritdoc ISwapper
    function swap(
        IERC20 fromToken,
        IERC20 toToken,
        address recipient,
        uint256 shareToMin,
        uint256 shareFrom
    ) public override returns (uint256 extraShare, uint256 shareReturned) {
        IUniswapV2Pair pair0;
        IUniswapV2Pair pair1;
        {
            bytes32 salt =
                keccak256(fromToken < middleToken ? abi.encodePacked(fromToken, middleToken) : abi.encodePacked(middleToken, fromToken));
            pair0 = IUniswapV2Pair(uint256(keccak256(abi.encodePacked(hex"ff", factory, salt, pairCodeHash))));
            salt = keccak256(middleToken < toToken ? abi.encodePacked(middleToken, toToken) : abi.encodePacked(toToken, middleToken));
            pair1 = IUniswapV2Pair(uint256(keccak256(abi.encodePacked(hex"ff", factory, salt, pairCodeHash))));
        }

        // Transfer FROM to pair 0 (FROM <-> ETH)
        (uint256 amountFrom, ) = bentoBox.withdraw(fromToken, address(this), address(pair0), 0, shareFrom);

        // Swap FROM to ETH. Transfers to pair 1 (ETH <-> TO)
        uint256 amountMiddle;
        {
            (uint256 reserve0, uint256 reserve1, ) = pair0.getReserves();
            if (fromToken < middleToken) {
                amountMiddle = getAmountOut(amountFrom, reserve0, reserve1);
                pair0.swap(0, amountMiddle, address(pair1), "");
            } else {
                amountMiddle = getAmountOut(amountFrom, reserve1, reserve0);
                pair0.swap(amountMiddle, 0, address(pair1), "");
            }
        }

        // Swap ETH to TO. Transfers to the BentoBox
        uint256 amountTo;
        {
            (uint256 reserve0, uint256 reserve1, ) = pair1.getReserves();
            if (middleToken < toToken) {
                amountTo = getAmountOut(amountMiddle, reserve0, reserve1);
                pair1.swap(0, amountTo, address(bentoBox), "");
            } else {
                amountTo = getAmountOut(amountMiddle, reserve1, reserve0);
                pair1.swap(amountTo, 0, address(bentoBox), "");
            }
        }

        (, shareReturned) = bentoBox.deposit(toToken, address(bentoBox), recipient, amountTo, 0);
        extraShare = shareReturned.sub(shareToMin);
    }

    // Swaps to an exact amount, from a flexible input amount
    /// @inheritdoc ISwapper
    function swapExact(
        IERC20 fromToken,
        IERC20 toToken,
        address recipient,
        address refundTo,
        uint256 shareFromSupplied,
        uint256 shareToExact
    ) public override returns (uint256 shareUsed, uint256 shareReturned) {
        IUniswapV2Pair pair0;
        IUniswapV2Pair pair1;
        {
            bytes32 salt =
                keccak256(fromToken < middleToken ? abi.encodePacked(fromToken, middleToken) : abi.encodePacked(middleToken, fromToken));
            pair0 = IUniswapV2Pair(uint256(keccak256(abi.encodePacked(hex"ff", factory, salt, pairCodeHash))));
            salt = keccak256(middleToken < toToken ? abi.encodePacked(middleToken, toToken) : abi.encodePacked(toToken, middleToken));
            pair1 = IUniswapV2Pair(uint256(keccak256(abi.encodePacked(hex"ff", factory, salt, pairCodeHash))));
        }

        // Calculate all the amounts first.
        // This has got to be easier than doing flash swaps:
        uint256 amountToExact = bentoBox.toAmount(toToken, shareToExact, true);
        (uint256 amountFrom, uint256 amountMiddle) = getAmountsIn(pair0, pair1, fromToken, toToken, amountToExact);

        // ...send it to the FROM <-> ETH pair,
        // and swap it for ETH. Send the ETH to the ETH <-> TO pair:
        // Why do the branches again? Stack depth.
        (, shareUsed) = bentoBox.withdraw(fromToken, address(this), address(pair0), amountFrom, 0);
        if (fromToken < middleToken) {
            pair0.swap(0, amountMiddle, address(pair1), "");
        } else {
            pair0.swap(amountMiddle, 0, address(pair1), "");
        }

        // Swap the ETH that we just sent to TO, and send it to the BentoBox:
        if (middleToken < toToken) {
            pair1.swap(0, amountToExact, address(bentoBox), "");
        } else {
            pair1.swap(amountToExact, 0, address(bentoBox), "");
        }

        bentoBox.deposit(toToken, address(bentoBox), recipient, 0, shareToExact);
        shareReturned = shareFromSupplied.sub(shareUsed);
        if (shareReturned > 0) {
            bentoBox.transfer(fromToken, address(this), refundTo, shareReturned);
        }
    }
}
