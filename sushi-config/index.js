const { ethers } = require('ethers')

const test_accounts = {
    mnemonic: "test test test test test test test test test test test junk",
    accountsBalance: "990000000000000000000",
}

const accounts =
    process.env.MNEMONIC && process.env.FUNDER_MNEMONIC
        ? [ethers.Wallet.fromMnemonic(process.env.MNEMONIC).privateKey, ethers.Wallet.fromMnemonic(process.env.FUNDER_MNEMONIC).privateKey]
        : []

let networks = {
    hardhat: Object.assign(
        {
            blockGasLimit: 10_000_000,
            chainId: 31337,
            test_accounts,
        },
        process.env.ALCHEMY_API_KEY
            ? { forking: { url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`, blockNumber: 11829739 } }
            : {}
    ),
    mainnet: {
        url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
        accounts,
        chainId: 1,
        hardhat: {
            forking: {
                enabled: false,
                url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
            },
        },
    },
    ropsten: {
        url: `https://ropsten.infura.io/v3/${process.env.INFURA_API_KEY}`,
        accounts,
        chainId: 3,
        live: true,
        saveDeployments: true,
        tags: ["staging"],
    },
    rinkeby: {
        url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
        accounts,
        chainId: 4,
        live: true,
        saveDeployments: true,
        tags: ["staging"],
    },
    goerli: {
        url: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
        accounts,
        chainId: 5,
        live: true,
        saveDeployments: true,
        tags: ["staging"],
    },
    kovan: {
        url: `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
        accounts,
        chainId: 42,
        live: true,
        saveDeployments: true,
        tags: ["staging"],
    },
    moonbase: {
        url: "https://rpc.testnet.moonbeam.network",
        accounts,
        chainId: 1287,
        live: true,
        saveDeployments: true,
        tags: ["staging"],
    },
    arbitrum: {
        url: "https://kovan3.arbitrum.io/rpc",
        accounts,
        chainId: 79377087078960,
        live: true,
        saveDeployments: true,
        tags: ["staging"],
    },
    binance: {
        url: "https://bsc-dataseed.binance.org/",
        accounts,
        chainId: 56,
        live: true,
        saveDeployments: true,
    },
    binancetest: {
        url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
        accounts,
        chainId: 97,
        live: true,
        saveDeployments: true,
        tags: ["staging"],
    },
    matic: {
        url: "https://rpc-mainnet.maticvigil.com/",
        accounts,
        chainId: 137,
        live: true,
        saveDeployments: true,
    },
    fantom: {
        url: "https://rpcapi.fantom.network",
        accounts,
        chainId: 250,
        live: true,
        saveDeployments: true,
    },
    fantomtest: {
        url: "https://rpc.testnet.fantom.network/",
        accounts,
        chainId: 4002,
        live: true,
        saveDeployments: true,
        tags: ["staging"],
    },
    avalanche: {
        url: "https://ava.spacejelly.network/api/ext/bc/C/rpc",
        accounts,
        chainId: 43114,
        live: true,
        saveDeployments: true,
    },
    fuji: {
        url: "https://api.avax-test.network/ext/bc/C/rpc",
        accounts,
        chainId: 43113,
        live: true,
        saveDeployments: true,
        tags: ["staging"],
    },
    mumbai: {
        url: "https://rpc-mumbai.maticvigil.com/",
        accounts,
        chainId: 80001,
        live: true,
        saveDeployments: true,
        tags: ["staging"],
    },
    huobi: {
        url: "https://http-mainnet.hecochain.com",
        accounts,
        chainId: 128,
        live: true,
        saveDeployments: true,
    },
    huobitest: {
        url: "https://http-testnet.hecochain.com",
        accounts,
        chainId: 256,
        live: true,
        saveDeployments: true,
        tags: ["staging"],
    },
    okex: {
        url: "http://okexchain-rpc1.okex.com:26659",
        accounts,
        chainId: 66,
        live: true,
        saveDeployments: true,
    },
    okextest: {
        url: "http://okexchaintest-rpc1.okex.com:26659",
        accounts,
        chainId: 65,
        live: true,
        saveDeployments: true,
        tags: ["staging"],
    },
    xdai: {
        url: "https://rpc.xdaichain.com",
        accounts,
        chainId: 100,
        live: true,
        saveDeployments: true,
    },
    tomo: {
        url: "https://rpc.tomochain.com",
        accounts,
        chainId: 88,
        live: true,
        saveDeployments: true,
    },
    tomotest: {
        url: "https://rpc.testnet.tomochain.com",
        accounts,
        chainId: 89,
        live: true,
        saveDeployments: true,
        tags: ["staging"],
    },
}

module.exports = {
    networks
}