module.exports = {
    hardhat: {
        solidity: {
            settings: {
                optimizer: {
                    // Set the number of runs for this project, default is 500
                    runs: 200,
                },
            },
        },
    },
    solcover: {
        // We are always skipping mocks and interfaces, add specific files here
        skipFiles: ["libraries/FixedPoint.sol", "libraries/FullMath.sol", "libraries/SignedSafeMath.sol"],
    },
    prettier: {
        // Add or change prettier settings here
    },
}
