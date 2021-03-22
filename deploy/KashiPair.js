const { weth, getBigNumber } = require("@sushiswap/hardhat-framework")

module.exports = async function (hre) {
    const bentoBoxABI = [
        {
            inputs: [{ internalType: "contract IERC20", name: "wethToken_", type: "address" }],
            stateMutability: "nonpayable",
            type: "constructor",
        },
        {
            anonymous: false,
            inputs: [
                { indexed: true, internalType: "address", name: "masterContract", type: "address" },
                { indexed: false, internalType: "bytes", name: "data", type: "bytes" },
                { indexed: true, internalType: "address", name: "cloneAddress", type: "address" },
            ],
            name: "LogDeploy",
            type: "event",
        },
        {
            anonymous: false,
            inputs: [
                { indexed: true, internalType: "contract IERC20", name: "token", type: "address" },
                { indexed: true, internalType: "address", name: "from", type: "address" },
                { indexed: true, internalType: "address", name: "to", type: "address" },
                { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
                { indexed: false, internalType: "uint256", name: "share", type: "uint256" },
            ],
            name: "LogDeposit",
            type: "event",
        },
        {
            anonymous: false,
            inputs: [
                { indexed: true, internalType: "address", name: "borrower", type: "address" },
                { indexed: true, internalType: "contract IERC20", name: "token", type: "address" },
                { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
                { indexed: false, internalType: "uint256", name: "feeAmount", type: "uint256" },
                { indexed: true, internalType: "address", name: "receiver", type: "address" },
            ],
            name: "LogFlashLoan",
            type: "event",
        },
        {
            anonymous: false,
            inputs: [{ indexed: true, internalType: "address", name: "protocol", type: "address" }],
            name: "LogRegisterProtocol",
            type: "event",
        },
        {
            anonymous: false,
            inputs: [
                { indexed: true, internalType: "address", name: "masterContract", type: "address" },
                { indexed: true, internalType: "address", name: "user", type: "address" },
                { indexed: false, internalType: "bool", name: "approved", type: "bool" },
            ],
            name: "LogSetMasterContractApproval",
            type: "event",
        },
        {
            anonymous: false,
            inputs: [
                { indexed: true, internalType: "contract IERC20", name: "token", type: "address" },
                { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
            ],
            name: "LogStrategyDivest",
            type: "event",
        },
        {
            anonymous: false,
            inputs: [
                { indexed: true, internalType: "contract IERC20", name: "token", type: "address" },
                { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
            ],
            name: "LogStrategyInvest",
            type: "event",
        },
        {
            anonymous: false,
            inputs: [
                { indexed: true, internalType: "contract IERC20", name: "token", type: "address" },
                { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
            ],
            name: "LogStrategyLoss",
            type: "event",
        },
        {
            anonymous: false,
            inputs: [
                { indexed: true, internalType: "contract IERC20", name: "token", type: "address" },
                { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
            ],
            name: "LogStrategyProfit",
            type: "event",
        },
        {
            anonymous: false,
            inputs: [
                { indexed: true, internalType: "contract IERC20", name: "token", type: "address" },
                { indexed: true, internalType: "contract IStrategy", name: "strategy", type: "address" },
            ],
            name: "LogStrategyQueued",
            type: "event",
        },
        {
            anonymous: false,
            inputs: [
                { indexed: true, internalType: "contract IERC20", name: "token", type: "address" },
                { indexed: true, internalType: "contract IStrategy", name: "strategy", type: "address" },
            ],
            name: "LogStrategySet",
            type: "event",
        },
        {
            anonymous: false,
            inputs: [
                { indexed: true, internalType: "contract IERC20", name: "token", type: "address" },
                { indexed: false, internalType: "uint256", name: "targetPercentage", type: "uint256" },
            ],
            name: "LogStrategyTargetPercentage",
            type: "event",
        },
        {
            anonymous: false,
            inputs: [
                { indexed: true, internalType: "contract IERC20", name: "token", type: "address" },
                { indexed: true, internalType: "address", name: "from", type: "address" },
                { indexed: true, internalType: "address", name: "to", type: "address" },
                { indexed: false, internalType: "uint256", name: "share", type: "uint256" },
            ],
            name: "LogTransfer",
            type: "event",
        },
        {
            anonymous: false,
            inputs: [
                { indexed: true, internalType: "address", name: "masterContract", type: "address" },
                { indexed: false, internalType: "bool", name: "approved", type: "bool" },
            ],
            name: "LogWhiteListMasterContract",
            type: "event",
        },
        {
            anonymous: false,
            inputs: [
                { indexed: true, internalType: "contract IERC20", name: "token", type: "address" },
                { indexed: true, internalType: "address", name: "from", type: "address" },
                { indexed: true, internalType: "address", name: "to", type: "address" },
                { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
                { indexed: false, internalType: "uint256", name: "share", type: "uint256" },
            ],
            name: "LogWithdraw",
            type: "event",
        },
        {
            anonymous: false,
            inputs: [
                { indexed: true, internalType: "address", name: "previousOwner", type: "address" },
                { indexed: true, internalType: "address", name: "newOwner", type: "address" },
            ],
            name: "OwnershipTransferred",
            type: "event",
        },
        {
            inputs: [
                { internalType: "contract IERC20", name: "", type: "address" },
                { internalType: "address", name: "", type: "address" },
            ],
            name: "balanceOf",
            outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [
                { internalType: "bytes[]", name: "calls", type: "bytes[]" },
                { internalType: "bool", name: "revertOnFail", type: "bool" },
            ],
            name: "batch",
            outputs: [
                { internalType: "bool[]", name: "successes", type: "bool[]" },
                { internalType: "bytes[]", name: "results", type: "bytes[]" },
            ],
            stateMutability: "payable",
            type: "function",
        },
        {
            inputs: [
                { internalType: "contract IBatchFlashBorrower", name: "borrower", type: "address" },
                { internalType: "address[]", name: "receivers", type: "address[]" },
                { internalType: "contract IERC20[]", name: "tokens", type: "address[]" },
                { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
                { internalType: "bytes", name: "data", type: "bytes" },
            ],
            name: "batchFlashLoan",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
        },
        { inputs: [], name: "claimOwnership", outputs: [], stateMutability: "nonpayable", type: "function" },
        {
            inputs: [
                { internalType: "address", name: "masterContract", type: "address" },
                { internalType: "bytes", name: "data", type: "bytes" },
                { internalType: "bool", name: "useCreate2", type: "bool" },
            ],
            name: "deploy",
            outputs: [],
            stateMutability: "payable",
            type: "function",
        },
        {
            inputs: [
                { internalType: "contract IERC20", name: "token_", type: "address" },
                { internalType: "address", name: "from", type: "address" },
                { internalType: "address", name: "to", type: "address" },
                { internalType: "uint256", name: "amount", type: "uint256" },
                { internalType: "uint256", name: "share", type: "uint256" },
            ],
            name: "deposit",
            outputs: [
                { internalType: "uint256", name: "amountOut", type: "uint256" },
                { internalType: "uint256", name: "shareOut", type: "uint256" },
            ],
            stateMutability: "payable",
            type: "function",
        },
        {
            inputs: [
                { internalType: "contract IFlashBorrower", name: "borrower", type: "address" },
                { internalType: "address", name: "receiver", type: "address" },
                { internalType: "contract IERC20", name: "token", type: "address" },
                { internalType: "uint256", name: "amount", type: "uint256" },
                { internalType: "bytes", name: "data", type: "bytes" },
            ],
            name: "flashLoan",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
        },
        {
            inputs: [
                { internalType: "contract IERC20", name: "token", type: "address" },
                { internalType: "bool", name: "balance", type: "bool" },
                { internalType: "uint256", name: "maxChangeAmount", type: "uint256" },
            ],
            name: "harvest",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
        },
        {
            inputs: [
                { internalType: "address", name: "", type: "address" },
                { internalType: "address", name: "", type: "address" },
            ],
            name: "masterContractApproved",
            outputs: [{ internalType: "bool", name: "", type: "bool" }],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [{ internalType: "address", name: "", type: "address" }],
            name: "masterContractOf",
            outputs: [{ internalType: "address", name: "", type: "address" }],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [{ internalType: "address", name: "", type: "address" }],
            name: "nonces",
            outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [],
            name: "owner",
            outputs: [{ internalType: "address", name: "", type: "address" }],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [],
            name: "pendingOwner",
            outputs: [{ internalType: "address", name: "", type: "address" }],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [{ internalType: "contract IERC20", name: "", type: "address" }],
            name: "pendingStrategy",
            outputs: [{ internalType: "contract IStrategy", name: "", type: "address" }],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [
                { internalType: "contract IERC20", name: "token", type: "address" },
                { internalType: "address", name: "from", type: "address" },
                { internalType: "address", name: "to", type: "address" },
                { internalType: "uint256", name: "amount", type: "uint256" },
                { internalType: "uint256", name: "deadline", type: "uint256" },
                { internalType: "uint8", name: "v", type: "uint8" },
                { internalType: "bytes32", name: "r", type: "bytes32" },
                { internalType: "bytes32", name: "s", type: "bytes32" },
            ],
            name: "permitToken",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
        },
        { inputs: [], name: "registerProtocol", outputs: [], stateMutability: "nonpayable", type: "function" },
        {
            inputs: [
                { internalType: "address", name: "user", type: "address" },
                { internalType: "address", name: "masterContract", type: "address" },
                { internalType: "bool", name: "approved", type: "bool" },
                { internalType: "uint8", name: "v", type: "uint8" },
                { internalType: "bytes32", name: "r", type: "bytes32" },
                { internalType: "bytes32", name: "s", type: "bytes32" },
            ],
            name: "setMasterContractApproval",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
        },
        {
            inputs: [
                { internalType: "contract IERC20", name: "token", type: "address" },
                { internalType: "contract IStrategy", name: "newStrategy", type: "address" },
            ],
            name: "setStrategy",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
        },
        {
            inputs: [
                { internalType: "contract IERC20", name: "token", type: "address" },
                { internalType: "uint64", name: "targetPercentage_", type: "uint64" },
            ],
            name: "setStrategyTargetPercentage",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
        },
        {
            inputs: [{ internalType: "contract IERC20", name: "", type: "address" }],
            name: "strategy",
            outputs: [{ internalType: "contract IStrategy", name: "", type: "address" }],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [{ internalType: "contract IERC20", name: "", type: "address" }],
            name: "strategyData",
            outputs: [
                { internalType: "uint64", name: "strategyStartDate", type: "uint64" },
                { internalType: "uint64", name: "targetPercentage", type: "uint64" },
                { internalType: "uint128", name: "balance", type: "uint128" },
            ],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [
                { internalType: "contract IERC20", name: "token", type: "address" },
                { internalType: "uint256", name: "share", type: "uint256" },
                { internalType: "bool", name: "roundUp", type: "bool" },
            ],
            name: "toAmount",
            outputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [
                { internalType: "contract IERC20", name: "token", type: "address" },
                { internalType: "uint256", name: "amount", type: "uint256" },
                { internalType: "bool", name: "roundUp", type: "bool" },
            ],
            name: "toShare",
            outputs: [{ internalType: "uint256", name: "share", type: "uint256" }],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [{ internalType: "contract IERC20", name: "", type: "address" }],
            name: "totals",
            outputs: [
                { internalType: "uint128", name: "elastic", type: "uint128" },
                { internalType: "uint128", name: "base", type: "uint128" },
            ],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [
                { internalType: "contract IERC20", name: "token", type: "address" },
                { internalType: "address", name: "from", type: "address" },
                { internalType: "address", name: "to", type: "address" },
                { internalType: "uint256", name: "share", type: "uint256" },
            ],
            name: "transfer",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
        },
        {
            inputs: [
                { internalType: "contract IERC20", name: "token", type: "address" },
                { internalType: "address", name: "from", type: "address" },
                { internalType: "address[]", name: "tos", type: "address[]" },
                { internalType: "uint256[]", name: "shares", type: "uint256[]" },
            ],
            name: "transferMultiple",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
        },
        {
            inputs: [
                { internalType: "address", name: "newOwner", type: "address" },
                { internalType: "bool", name: "direct", type: "bool" },
                { internalType: "bool", name: "renounce", type: "bool" },
            ],
            name: "transferOwnership",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
        },
        {
            inputs: [
                { internalType: "address", name: "masterContract", type: "address" },
                { internalType: "bool", name: "approved", type: "bool" },
            ],
            name: "whitelistMasterContract",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
        },
        {
            inputs: [{ internalType: "address", name: "", type: "address" }],
            name: "whitelistedMasterContracts",
            outputs: [{ internalType: "bool", name: "", type: "bool" }],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [
                { internalType: "contract IERC20", name: "token_", type: "address" },
                { internalType: "address", name: "from", type: "address" },
                { internalType: "address", name: "to", type: "address" },
                { internalType: "uint256", name: "amount", type: "uint256" },
                { internalType: "uint256", name: "share", type: "uint256" },
            ],
            name: "withdraw",
            outputs: [
                { internalType: "uint256", name: "amountOut", type: "uint256" },
                { internalType: "uint256", name: "shareOut", type: "uint256" },
            ],
            stateMutability: "nonpayable",
            type: "function",
        },
        { stateMutability: "payable", type: "receive" },
    ]
    const factory_abi = [
        {
            inputs: [],
            name: "pairCodeHash",
            outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
            stateMutability: "pure",
            type: "function",
        },
    ]

    const signers = await hre.ethers.getSigners()
    const deployer = signers[0]
    const funder = signers[1]
    const chainId = await hre.getChainId()
    if (chainId == "31337" || hre.network.config.forking) {
        return
    }
    /*if (!weth(chainId)) {
        console.log("No WETH address for chain", chainId)
        return
    }*/
    console.log("Chain:", chainId)
    console.log("Balance:", (await funder.getBalance()).div("1000000000000000000").toString())
    const deployerBalance = await deployer.getBalance()

    let sushiOwner = "0x10601b88F47e5FAfE9Da5Ac855c9E98e79903280"
    if (chainId == 1) {
        let sushiOwner = "0x19B3Eb3Af5D93b77a5619b047De0EED7115A19e7"
    }

    const gasPrice = await funder.provider.getGasPrice()
    let multiplier = hre.network.tags && hre.network.tags.staging ? 2 : 1
    let finalGasPrice = gasPrice.mul(multiplier)
    const gasLimit = 5000000 + 5500000 + 1300000
    if (chainId == "88" || chainId == "89") {
        finalGasPrice = getBigNumber("10000", 9)
    }
    console.log("Gasprice:", gasPrice.toString(), " with multiplier ", multiplier, "final", finalGasPrice.toString())

    let factory = "0xc35DADB65012eC5796536bD9864eD8773aBc74C4"
    if (chainId == "1") {
        factory = "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac"
    }

    const initCodeHash = await new ethers.Contract(factory, factory_abi, deployer).pairCodeHash()
    console.log("InitCodeHash is", initCodeHash)

    console.log("Deployer balance", deployerBalance.toString())
    console.log("Needed", finalGasPrice.mul(gasLimit + 500000).toString(), finalGasPrice.toString(), gasLimit.toString())
    if (deployerBalance.lt(finalGasPrice.mul(gasLimit + 500000))) {
        console.log(
            "Sending native token to fund deployment:",
            finalGasPrice
                .mul(gasLimit + 500000)
                .sub(deployerBalance)
                .toString()
        )
        let tx = await funder.sendTransaction({
            to: deployer.address,
            value: finalGasPrice.mul(gasLimit + 500000).sub(deployerBalance),
            gasPrice: gasPrice.mul(multiplier),
        })
        await tx.wait()
    }

    console.log("Deploying contract")
    tx = await hre.deployments.deploy("BentoBox", {
        from: deployer.address,
        args: [weth(chainId)],
        log: true,
        deterministicDeployment: false,
        gasLimit: 5000000,
        gasPrice: finalGasPrice,
    })

    const bentobox = (await hre.ethers.getContractFactory("BentoBox")).attach((await deployments.get("BentoBox")).address)

    console.log("Deploying KashiPair contract")
    tx = await hre.deployments.deploy("KashiPairMediumRiskV1", {
        from: deployer.address,
        args: [bentobox.address],
        log: true,
        deterministicDeployment: false,
        gasLimit: 5500000,
        gasPrice: finalGasPrice,
    })

    console.log("Deploying Swapper contract")
    tx = await hre.deployments.deploy("SushiSwapSwapperV1", {
        from: deployer.address,
        args: [bentobox.address, factory, initCodeHash],
        log: true,
        deterministicDeployment: false,
        gasLimit: 1300000,
        gasPrice: finalGasPrice,
    })

    const kashipair = (await hre.ethers.getContractFactory("KashiPairMediumRiskV1")).attach(
        (await deployments.get("KashiPairMediumRiskV1")).address
    )
    const swapper = (await hre.ethers.getContractFactory("SushiSwapSwapperV1")).attach((await deployments.get("SushiSwapSwapperV1")).address)

    console.log("Whitelisting Swapper")
    tx = await kashipair.connect(deployer).setSwapper(swapper.address, true, {
        gasLimit: 100000,
        gasPrice: finalGasPrice,
    })
    await tx.wait()
    console.log("Update KashiPair Owner")
    tx = await kashipair.connect(deployer).transferOwnership(sushiOwner, true, false, {
        gasLimit: 100000,
        gasPrice: finalGasPrice,
    })
    await tx.wait()

    //if ((await bentobox.owner()) == bentoBoxSigner.address) {
    console.log("Whitelisting KashiPair")
    tx = await bentobox.whitelistMasterContract(kashipair.address, true, {
        gasLimit: 100000,
        gasPrice: finalGasPrice,
    })
    await tx.wait()

    console.log("Update BentoBox Owner")
    await bentobox.transferOwnership(sushiOwner, true, false, {
        gasLimit: 100000,
        gasPrice: finalGasPrice,
    })
    //}
}

function verify(apikey, address, source, contractname, license, runs) {
    var request = require("request")
    request.post(
        "//api.etherscan.io/api",
        {
            apikey: apikey, //A valid API-Key is required
            module: "contract", //Do not change
            action: "verifysourcecode", //Do not change
            contractaddress: address, //Contract Address starts with 0x...
            sourceCode: source, //Contract Source Code (Flattened if necessary)
            contractname: contractname, //ContractName (if codeformat=solidity-standard-json-input, then enter contractname as ex: erc20.sol:erc20)
            compilerversion: "v0.6.12+commit.27d51765", // see https://etherscan.io/solcversions for list of support versions
            optimizationUsed: 1, //0 = No Optimization, 1 = Optimization used (applicable when codeformat=solidity-single-file)
            runs: runs, //set to 200 as default unless otherwise  (applicable when codeformat=solidity-single-file)
            constructorArguements: $("#constructorArguements").val(), //if applicable
            evmversion: $("#evmVersion").val(), //leave blank for compiler default, homestead, tangerineWhistle, spuriousDragon, byzantium, constantinople, petersburg, istanbul (applicable when codeformat=solidity-single-file)
            licenseType: license, //Valid codes 1-12 where 1=No License .. 12=Apache 2.0, see https://etherscan.io/contract-license-types
        },
        function (err, res, body) {
            console.log(res)
            /*if (result.status == "1") {
            //1 = submission success, use the guid returned (result.result) to check the status of your submission.
            // Average time of processing is 30-60 seconds
            document.getElementById("postresult").innerHTML = result.status + ";" + result.message + ";" + result.result;
            // result.result is the GUID receipt for the submission, you can use this guid for checking the verification status
        } else {
            //0 = error
            document.getElementById("postresult").innerHTML = result.status + ";" + result.message + ";" + result.result;
        }
        console.log("status : " + result.status);
        console.log("result : " + result.result);*/
        }
    )
}
