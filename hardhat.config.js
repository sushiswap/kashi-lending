console.log("Parsing hardhat configuration")
const { networks } = require('./sushi-config')

require("@nomiclabs/hardhat-waffle")
require("hardhat-deploy")

module.exports = {
    defaultNetwork: "hardhat",
    namedAccounts: {
    },
    networks: networks,
    paths: {
        artifacts: "artifacts",
        cache: "cache",
        deploy: "deploy",
        deployments: "deployments",
        imports: "imports",
        sources: "contracts",
        tests: "test",
    },
    solidity: {
        version: "0.6.12",
        settings: {
            optimizer: {
                enabled: true,
                runs: 256,
            },
        },
    }
}
