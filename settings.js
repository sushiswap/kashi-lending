module.exports = {
    hardhat: {
        solidity: {
            overrides: {
                "contracts/flat/KashiPairFlat.sol": {
                    version: "0.6.12",
                    settings: {
                        optimizer: {
                            enabled: true,
                            runs: 800,
                        },
                    },
                },
                "contracts/flat/SushiSwapSwapperFlat.sol": {
                    version: "0.6.12",
                    settings: {
                        optimizer: {
                            enabled: true,
                            runs: 50000,
                        },
                    },
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
