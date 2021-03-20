// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;
import "@boringcrypto/boring-solidity/contracts/libraries/BoringMath.sol";
import "@boringcrypto/boring-solidity/contracts/libraries/BoringRebase.sol";
import "@boringcrypto/boring-solidity/contracts/libraries/BoringERC20.sol";
import "@sushiswap/bentobox-sdk/contracts/IBentoBoxV1.sol";
import "./interfaces/IOracle.sol";
import "./interfaces/IKashiPair.sol";



/// @dev This contract provides useful helper functions for `KashiPair`.
contract KashiPairHelper {
    using BoringMath for uint256;
    using BoringMath128 for uint128;
    using BoringERC20 for IERC20;
    using RebaseLibrary for Rebase;

    uint256 public constant APY_PRECISION = 1e8;
    uint256 private constant PROTOCOL_FEE_LEFTOVER = 90000; // 100% - 10%
    uint256 private constant PROTOCOL_FEE_DIVISOR = 1e5;

    /// @dev Helper function to calculate the collateral shares that are needed for `borrowPart`,
    /// taking the current exchange rate into account.
    function getCollateralSharesForBorrowPart(IKashiPair kashiPair, uint256 borrowPart) public view returns (uint256) {
        // Taken from KashiPair
        uint256 EXCHANGE_RATE_PRECISION = 1e18;
        uint256 LIQUIDATION_MULTIPLIER = 112000; // add 12%
        uint256 LIQUIDATION_MULTIPLIER_PRECISION = 1e5;

        Rebase memory totalBorrow = kashiPair.totalBorrow();
        uint256 borrowAmount = totalBorrow.toElastic(borrowPart, false);

        return
            kashiPair.bentoBox().toShare(
                kashiPair.collateral(),
                borrowAmount.mul(LIQUIDATION_MULTIPLIER).mul(kashiPair.exchangeRate()) /
                    (LIQUIDATION_MULTIPLIER_PRECISION * EXCHANGE_RATE_PRECISION),
                false
            );
    }

    struct KashiPairInfo {
        IERC20 collateral;
        string collateralSymbol;
        uint8 collateralDecimals;
        IERC20 asset;
        string assetSymbol;
        uint8 assetDecimals;
        IOracle oracle;
        bytes oracleData;
    }

    function getPairs(IKashiPair[] calldata addresses) public view returns (KashiPairInfo[] memory) {
        KashiPairInfo[] memory pairs = new KashiPairInfo[](addresses.length);
        for (uint256 i = 0; i < addresses.length; i++) {
            pairs[i].collateral = addresses[i].collateral();
            pairs[i].collateralSymbol = IERC20(addresses[i].collateral()).safeSymbol();
            pairs[i].collateralDecimals = IERC20(addresses[i].collateral()).safeDecimals();
            pairs[i].asset = addresses[i].asset();
            pairs[i].assetSymbol = IERC20(addresses[i].asset()).safeSymbol();
            pairs[i].assetDecimals = IERC20(addresses[i].asset()).safeDecimals();
            pairs[i].oracle = addresses[i].oracle();
            pairs[i].oracleData = addresses[i].oracleData();
        }
        return pairs;
    }

    struct PairPollInfo {
        uint256 suppliedPairCount;
        uint256 borrowPairCount;
    }

    struct PairPoll {
        uint256 totalCollateralAmount;
        uint256 userCollateralAmount;
        uint256 totalAssetAmount;
        uint256 userAssetAmount;
        uint256 totalBorrowAmount;
        uint256 userBorrowAmount;
        uint256 currentExchangeRate;
        uint256 oracleExchangeRate;
        AccrueInfo accrueInfo;
        uint256 assetAPR;
        uint256 borrowAPR;
    }

    function pollPairs(address who, IKashiPair[] calldata addresses) public view returns (PairPollInfo memory, PairPoll[] memory) {
        PairPollInfo memory info;
        PairPoll[] memory pairs = new PairPoll[](addresses.length);

        for (uint256 i = 0; i < addresses.length; i++) {
            IBentoBoxV1 bentoBox = IBentoBoxV1(addresses[i].bentoBox());
            {
                pairs[i].totalCollateralAmount = bentoBox.toAmount(addresses[i].collateral(), addresses[i].totalCollateralShare(), false);
                pairs[i].userCollateralAmount = bentoBox.toAmount(addresses[i].collateral(), addresses[i].userCollateralShare(who), false);
            }
            {
                Rebase memory totalAsset;
                {
                    totalAsset = addresses[i].totalAsset();
                    pairs[i].totalAssetAmount = bentoBox.toAmount(addresses[i].asset(), totalAsset.elastic, false);
                }
                pairs[i].userAssetAmount = bentoBox.toAmount(addresses[i].asset(), totalAsset.toElastic(addresses[i].balanceOf(who), false), false);
                if(pairs[i].userAssetAmount > 0) {
                    info.suppliedPairCount += 1;
                }
            }
            {
                {
                    pairs[i].currentExchangeRate = addresses[i].exchangeRate();
                    (, pairs[i].oracleExchangeRate) = addresses[i].oracle().peek(addresses[i].oracleData());
                    pairs[i].accrueInfo = addresses[i].accrueInfo();
                }
                Rebase memory totalBorrow = addresses[i].totalBorrow();
                pairs[i].totalBorrowAmount = totalBorrow.elastic;
                pairs[i].userBorrowAmount = totalBorrow.toElastic(addresses[i].userBorrowPart(who), false);
                if(pairs[i].userBorrowAmount > 0) {
                    info.borrowPairCount += 1;
                }
            }
            {
                uint256 _totalBorrowAmount = pairs[i].totalBorrowAmount == 0 ? 1 : pairs[i].totalBorrowAmount; 
                uint256 yearlyInterest = _totalBorrowAmount.mul(pairs[i].accrueInfo.interestPerSecond).mul(365 days);
                pairs[i].assetAPR = yearlyInterest.mul(APY_PRECISION).mul(PROTOCOL_FEE_LEFTOVER) / _totalBorrowAmount.add(pairs[i].totalAssetAmount).mul(PROTOCOL_FEE_DIVISOR).mul(1e18);
                pairs[i].borrowAPR = yearlyInterest.mul(APY_PRECISION) / _totalBorrowAmount.mul(1e18);
            }
        }

        return (info, pairs);

    }

}
