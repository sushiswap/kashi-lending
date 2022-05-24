module.exports = {
    hardhat: {
        etherscan: {
            // Your API key for Etherscan
            // Obtain one at https://etherscan.io/
            apiKey: process.env.ETHERSCAN_API_KEY
        },
        solidity: {
            compilers: [
                {
                  version: "0.7.6",
                  settings: {
                    optimizer: {
                        enabled: true,
                        runs: 9000,
                    },
                },
                },
                {
                  version: "0.6.12",
                },
              ],
            overrides: {
                "contracts/KashiPair.sol": {
                    version: "0.6.12",
                    settings: {
                        optimizer: {
                            enabled: true,
                            runs: 1,
                        },
                    },
                },
                "contracts/mocks/KashiPairMock.sol": {
                    version: "0.6.12",
                    settings: {
                        optimizer: {
                            enabled: true,
                            runs: 1,
                        },
                    },
                },
                "contracts/flat/BentoBoxFlat.sol": {
                    version: "0.6.12",
                    settings: {
                        optimizer: {
                            enabled: true,
                            runs: 999999,
                        },
                    },
                },
                "contracts/flat/KashiPairFlat.sol": {
                    version: "0.6.12",
                    settings: {
                        optimizer: {
                            enabled: true,
                            runs: 350,
                        },
                    },
                },
                "contracts/flat/SushiSwapSwapperFlat.sol": {
                    version: "0.6.12",
                    settings: {
                        optimizer: {
                            enabled: true,
                            runs: 999999,
                        },
                    },
                },
                "contracts/flat/PeggedOracleFlat.sol": {
                    version: "0.6.12",
                    settings: {
                        optimizer: {
                            enabled: true,
                            runs: 999999,
                        },
                    },
                },
                "contracts/flat/SimpleSLPTWAP0OracleFlat.sol": {
                    version: "0.6.12",
                    settings: {
                        optimizer: {
                            enabled: true,
                            runs: 999999,
                        },
                    },
                },
                "contracts/flat/SimpleSLPTWAP1OracleFlat.sol": {
                    version: "0.6.12",
                    settings: {
                        optimizer: {
                            enabled: true,
                            runs: 999999,
                        },
                    },
                },
                "contracts/flat/ChainlinkOracleFlat.sol": {
                    version: "0.6.12",
                    settings: {
                        optimizer: {
                            enabled: true,
                            runs: 999999,
                        },
                    },
                },
                "contracts/flat/ChainlinkOracleV2Flat.sol": {
                    version: "0.6.12",
                    settings: {
                        optimizer: {
                            enabled: true,
                            runs: 999999,
                        },
                    },
                },
                "contracts/flat/CompoundOracle.sol": {
                    version: "0.6.12",
                    settings: {
                        optimizer: {
                            enabled: true,
                            runs: 999999,
                        },
                    },
                },
                "contracts/flat/BoringHelperFlat.sol": {
                    version: "0.6.12",
                    settings: {
                        optimizer: {
                            enabled: true,
                            runs: 999999,
                        },
                    },
                },
            },
        },
    },
    solcover: {
        // We are always skipping mocks and interfaces, add specific files here
        skipFiles: [
            "libraries/FixedPoint.sol",
            "libraries/FullMath.sol",
            "libraries/SignedSafeMath.sol",
            "flat/BentoBoxFlat.sol",
            "flat/KashiPairFlat.sol",
            "flat/SushiSwapSwapperFlat.sol",
        ],
    },
    prettier: {
        // Add or change prettier settings here
    },
    
}
