// SPDX-License-Identifier: MIT
// Using the same Copyleft License as in the original Repository
pragma solidity 0.6.12;
import "@boringcrypto/boring-solidity/contracts/libraries/BoringMath.sol";
import "../interfaces/IOracle.sol";

// Open Oracle Framework Interface
interface IOpenOracleFramework {
    function getFeed(uint256 feedID) external view returns (uint256, uint256, uint256);
}

// Open Oracle Framework TWAP Interface
interface IOpenOracleFrameworkTWAP {
    function getTWAP(
        address OOFContract,
        uint256[] memory feedIDs,
        uint256[] memory timestampstart,
        uint256[] memory timestampfinish,
        bool strictMode)
    external view returns (uint256[] memory TWAP);
}

contract OpenOracleFramework is IOracle {
    using BoringMath for uint256; // Keep everything in uint256

    // Calculates the latest rate
    function _get(
        address oracle,
        uint256 feedId
    ) internal view returns (uint256) {
        uint256 price;
        uint256 decimals;
        (price, , decimals) = IOpenOracleFramework(oracle).getFeed(feedId);
        return price / decimals;
    }

    // Calculates the 24h TWAP rate
    function _getTWAP(
        address twap,
        address oracle,
        uint256 feedId
    ) internal view returns (uint256) {

        uint256 decimals;
        (,,decimals) = IOpenOracleFramework(oracle).getFeed(feedId);

        uint256[] memory feedIdInput = new uint256[](1);
        uint256[] memory twapStart = new uint256[](1);
        uint256[] memory twapEnd = new uint256[](1);

        feedIdInput[0] = feedId;
        twapStart[0] = block.timestamp - 60*60*24;
        twapEnd[0] = block.timestamp;

        uint256 price = IOpenOracleFrameworkTWAP(twap).getTWAP(oracle,feedIdInput,twapStart,twapEnd,false)[0];
        return price / decimals;
    }

    function getDataParameter(
        address multiply,
        address divide,
        uint256 decimals
    ) public pure returns (bytes memory) {
        return abi.encode(multiply, divide, decimals);
    }

    // Get the latest exchange rate
    /// @inheritdoc IOracle
    function get(bytes calldata data) public override returns (bool, uint256) {
        (address oracle, uint256 feedId) = abi.decode(data, (address, uint256));
        return (true, _get(oracle, feedId));
    }

    // Check the last exchange rate without any state changes
    /// @inheritdoc IOracle
    function peek(bytes calldata data) public view override returns (bool, uint256) {
        (address twap, address oracle, uint256 feedId) = abi.decode(data, (address, address, uint256));
        return (true, _getTWAP(twap, oracle, feedId));
    }

    // Check the current spot exchange rate without any state changes
    /// @inheritdoc IOracle
    function peekSpot(bytes calldata data) external view override returns (uint256 rate) {
        (address oracle, uint256 feedId) = abi.decode(data, (address, uint256));
        return _get(oracle, feedId);
    }

    /// @inheritdoc IOracle
    function name(bytes calldata) public view override returns (string memory) {
        return "Open Oracle Framework";
    }

    /// @inheritdoc IOracle
    function symbol(bytes calldata) public view override returns (string memory) {
        return "OOF";
    }
}
