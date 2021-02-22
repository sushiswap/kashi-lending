const { ethers, deployments } = require("hardhat")
const {
    getBigNumber,
    advanceBlock,
    advanceTime,
    setMasterContractApproval,
    createFixture,
    KashiPair,
} = require("@sushiswap/hardhat-framework")
const KashiPairStateMachine = require("./KashiPairStateMachine.js")

describe("KashiPair", function () {
    let cmd, fixture

    before(async function () {
        fixture = await createFixture(deployments, this, async (cmd) => {
            await cmd.deploy("weth9", "WETH9Mock")
            await cmd.deploy("bentoBox", "BentoBoxMock", this.weth9.address)

            await cmd.addToken("a", "Token A", "A", 18, this.ReturnFalseERC20Mock)
            await cmd.addToken("b", "Token B", "B", 8, this.RevertingERC20Mock)
            await cmd.addPair("sushiSwapPair", this.a, this.b, 50000, 50000)

            await cmd.deploy("strategy", "SimpleStrategyMock", this.bentoBox.address, this.a.address)

            await this.bentoBox.setStrategy(this.a.address, this.strategy.address)
            await advanceTime(1209600, ethers)
            await this.bentoBox.setStrategy(this.a.address, this.strategy.address)
            await this.bentoBox.setStrategyTargetPercentage(this.a.address, 20)

            await cmd.deploy("erc20", "ERC20Mock", 10000000)
            await cmd.deploy("kashiPair", "KashiPair", this.bentoBox.address)
            await cmd.deploy("oracle", "OracleMock")
            await cmd.deploy("swapper", "SushiSwapSwapper", this.bentoBox.address, this.factory.address)
            await this.kashiPair.setSwapper(this.swapper.address, true)

            await this.oracle.set(getBigNumber(1, 28))
            const oracleData = await this.oracle.getDataParameter()

            await cmd.addKashiPair("pairHelper", this.bentoBox, this.kashiPair, this.a, this.b, this.oracle, oracleData)

            // Two different ways to approve the kashiPair
            await setMasterContractApproval(this.bentoBox, this.alice, this.alice, this.alicePrivateKey, this.kashiPair.address, true)
            await setMasterContractApproval(this.bentoBox, this.bob, this.bob, this.bobPrivateKey, this.kashiPair.address, true)
        })
    })

    describe("KashiPairStateMachine", function () {
        const DEPOSIT_AMOUNT = 1000

        before(async function () {
            cmd = await fixture()
        })

        it("Setup state machine", async function () {
            this.stateMachine = new KashiPairStateMachine(
                {
                    kashiPair: this.pairHelper.contract,
                    bentoBox: this.bentoBox,
                }
            )
            await this.stateMachine.init()
        })

        afterEach(async function () {
            await this.stateMachine.drainEvents()
        })

        it("Approvals for deposit", async function () {
            await this.a.approve(this.bentoBox.address, getBigNumber(DEPOSIT_AMOUNT, await this.a.decimals()))
            await this.b.approve(this.bentoBox.address, getBigNumber(DEPOSIT_AMOUNT, await this.b.decimals()))
        })

        it("deposit", async function () {
            await this.bentoBox.deposit(
                this.a.address,
                this.alice.address,
                this.alice.address,
                0,
                getBigNumber(DEPOSIT_AMOUNT, await this.a.decimals())
            )
            await this.bentoBox.deposit(
                this.b.address,
                this.alice.address,
                this.alice.address,
                0,
                getBigNumber(DEPOSIT_AMOUNT, await this.b.decimals())
            )
        })

        it("add asset & collateral", async function () {
            await this.pairHelper.contract.addAsset(this.alice.address, false, getBigNumber(DEPOSIT_AMOUNT, 8))
            await this.pairHelper.contract.addCollateral(this.alice.address, false, getBigNumber(DEPOSIT_AMOUNT, 18))
        })

        it("update exchange rate", async function () {
            await this.pairHelper.contract.updateExchangeRate()
        })

        it("borrow", async function () {
            await this.pairHelper.contract.borrow(this.alice.address, 1)
        })

        it("borrow", async function () {
            await this.pairHelper.contract.borrow(this.alice.address, 1)
        })

        it("repay", async function () {
            await this.pairHelper.contract.repay(this.alice.address, false, 1)
        })

        it("remove collateral", async function () {
            await this.pairHelper.contract.removeCollateral(this.alice.address, 1)
        })

        it("remove asset", async function () {
            await this.pairHelper.contract.removeAsset(this.alice.address, 1)
        })

        describe("skim", function () {
            it("Approvals for deposit", async function () {
                await this.a.approve(this.bentoBox.address, getBigNumber(DEPOSIT_AMOUNT, await this.a.decimals()))
                await this.b.approve(this.bentoBox.address, getBigNumber(DEPOSIT_AMOUNT, await this.b.decimals()))
            })

            it("deposit", async function () {
                await this.bentoBox.deposit(
                    this.a.address,
                    this.alice.address,
                    this.pairHelper.contract.address,
                    0,
                    getBigNumber(DEPOSIT_AMOUNT, await this.a.decimals())
                )
                await this.bentoBox.deposit(
                    this.b.address,
                    this.alice.address,
                    this.pairHelper.contract.address,
                    0,
                    getBigNumber(DEPOSIT_AMOUNT, await this.b.decimals())
                )
            })

            it("add asset & collateral", async function () {
                await this.pairHelper.contract.addAsset(this.alice.address, true, getBigNumber(DEPOSIT_AMOUNT / 2, 8))
                await this.pairHelper.contract.addCollateral(this.alice.address, true, getBigNumber(DEPOSIT_AMOUNT / 2, 18))
            })

            it("borrow", async function () {
                await this.pairHelper.contract.borrow(this.alice.address, getBigNumber(DEPOSIT_AMOUNT, await this.b.decimals()))
            })

            it("advance blocks for accrue", async function () {
                for (let i = 0; i < 0xff; i++) {
                    await advanceBlock(ethers)
                }
            })

            it("accrue", async function () {
                await this.pairHelper.contract.accrue()
            })

            it("repay", async function () {
                await this.pairHelper.contract.repay(this.alice.address, true, 1)
            })

            it("remove collateral", async function () {
                await this.pairHelper.contract.removeCollateral(this.alice.address, 1)
            })

            it("remove asset", async function () {
                await this.pairHelper.contract.removeAsset(this.alice.address, 1)
            })

            it("withdraw fees", async function () {
                await this.pairHelper.contract.withdrawFees()
            })

            it("modify exchange rate", async function () {
                await this.oracle.set(getBigNumber(2, 28))
            })

            it("deposit collateral", async function () {
                await this.b.connect(this.bob).approve(this.bentoBox.address, getBigNumber(DEPOSIT_AMOUNT, await this.b.decimals()))
                await this.bentoBox.connect(this.bob).deposit(
                    this.b.address,
                    this.bob.address,
                    this.bob.address,
                    0,
                    getBigNumber(DEPOSIT_AMOUNT, await this.b.decimals())
                )
            })

            it("liquidate", async function () {
                const collateral = (await this.pairHelper.contract.userBorrowPart(this.alice.address)).div(2)
                await this.pairHelper.contract
                .connect(this.bob)
                .liquidate([this.alice.address], [collateral], this.bob.address, "0x0000000000000000000000000000000000000000", true)
            })
        })
    })
})
