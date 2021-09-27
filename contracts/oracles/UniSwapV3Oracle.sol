// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.7.6;

import '@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import "../interfaces/IOracle.sol";

contract UniSwapV3Oracle is IOracle {
    using LowGasSafeMath for uint256;
    uint32 public constant PERIOD = 10 minutes;
    uint128 public constant BASE_AMOUNT = 1e18;

    /// @param pool Address of Uniswap V3 pool that we want to observe
    /// @param baseToken Address of an ERC20 token contract used as the baseAmount denomination
    /// @param quoteToken Address of an ERC20 token contract used as the quoteAmount denomination
    function _get(IUniswapV3Pool pool, address baseToken, address quoteToken) public view returns (uint256) {

        int24 tick = OracleLibrary.consult(address(pool), PERIOD);

        return OracleLibrary.getQuoteAtTick(tick, BASE_AMOUNT, baseToken, quoteToken);
    }

    function getDataParameter(IUniswapV3Pool pair, address baseToken, address quoteToken) public pure returns (bytes memory) {
        return abi.encode(pair, baseToken, quoteToken);
    }

    // Get the latest exchange rate, if no valid (recent) rate is available, return false
    /// @inheritdoc IOracle
    function get(bytes calldata data) external override returns (bool, uint256) {
        (IUniswapV3Pool pair, address baseToken, address quoteToken) = abi.decode(data, (IUniswapV3Pool, address, address));

        return (true, _get(pair, baseToken, quoteToken));
    }

    // Check the last exchange rate without any state changes
    /// @inheritdoc IOracle
    function peek(bytes calldata data) public view override returns (bool, uint256) {
        (IUniswapV3Pool pair, address baseToken, address quoteToken) = abi.decode(data, (IUniswapV3Pool, address, address));

        return (true, _get(pair, baseToken, quoteToken));
    }

    // Check the current spot exchange rate without any state changes
    /// @inheritdoc IOracle
    function peekSpot(bytes calldata data) external view override returns (uint256 rate) {
        (IUniswapV3Pool pair, address baseToken, address quoteToken) = abi.decode(data, (IUniswapV3Pool, address, address));

        rate =  _get(pair, baseToken, quoteToken);
    }

    /// @inheritdoc IOracle
    function name(bytes calldata) public pure override returns (string memory) {
        return "UniSwapV3 TWAP";
    }

    /// @inheritdoc IOracle
    function symbol(bytes calldata) public pure override returns (string memory) {
        return "UniSwapV3 TWAP";
    }


}