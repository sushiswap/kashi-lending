module.exports = {
    hardhat: {
        solidity: {
            settings: {
                optimizer: {
                    runs: 256,
                },
            },
        },
    },
    coverage: {
        // We are always skipping mocks and interfaces, add specific files here
        skipFiles: ["libraries/FixedPoint.sol", "libraries/FullMath.sol", "libraries/SignedSafeMath.sol"],
    },
}
