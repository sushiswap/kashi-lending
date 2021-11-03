const { ethers, deployments } = require("hardhat")
const { expect, assert } = require("chai")
const {
    getBigNumber,
    sansBorrowFee,
    sansSafetyAmount,
    advanceBlock,
    advanceTime,
    KashiPairPermit,
    setMasterContractApproval,
    setKashiPairContractApproval,
    createFixture,
    ADDRESS_ZERO,
    BKashiPair,
    BAMM,
    advanceTimeAndBlock,
} = require("@sushiswap/hardhat-framework")
const { defaultAbiCoder } = require("ethers/lib/utils")

const feePool = "0xFeE0000ee89f342a85543C489Ff400dA521156F2"

let cmd, fixture

async function debugInfo(thisObject) {
    console.log("Alice Collateral in Bento", (await thisObject.bentoBox.balanceOf(thisObject.a.address, thisObject.alice.address)).toString())
    console.log("Bob Collateral in Bento", (await thisObject.bentoBox.balanceOf(thisObject.a.address, thisObject.bob.address)).toString())
    console.log(
        "Swapper Collateral in Bento",
        (await thisObject.bentoBox.balanceOf(thisObject.a.address, thisObject.swapper.address)).toString()
    )
    console.log("Bento Collateral in Bento", (await thisObject.bentoBox.balanceOf(thisObject.a.address, thisObject.bentoBox.address)).toString())
    console.log(
        "Pair Collateral in Bento",
        (await thisObject.bentoBox.balanceOf(thisObject.a.address, thisObject.pairHelper.contract.address)).toString()
    )
    console.log()
    console.log("Alice Asset in Bento", (await thisObject.bentoBox.balanceOf(thisObject.b.address, thisObject.alice.address)).toString())
    console.log("Bob Asset in Bento", (await thisObject.bentoBox.balanceOf(thisObject.b.address, thisObject.bob.address)).toString())
    console.log("Swapper Asset in Bento", (await thisObject.bentoBox.balanceOf(thisObject.b.address, thisObject.swapper.address)).toString())
    console.log("Bento Asset in Bento", (await thisObject.bentoBox.balanceOf(thisObject.b.address, thisObject.bentoBox.address)).toString())
    console.log(
        "Pair Asset in Bento",
        (await thisObject.bentoBox.balanceOf(thisObject.b.address, thisObject.pairHelper.contract.address)).toString()
    )
    console.log()
    console.log("Alice CollateralShare in Pair", (await thisObject.pairHelper.contract.userCollateralShare(thisObject.alice.address)).toString())
    console.log("Alice BorrowPart in Pair", (await thisObject.pairHelper.contract.userBorrowPart(thisObject.alice.address)).toString())
    console.log("Alice Solvent", (await thisObject.pairHelper.contract.isSolvent(thisObject.alice.address, false)).toString())
}

describe("KashiPair Basic", function () {
    before(async function () {
        fixture = await createFixture(deployments, this, async (cmd) => {
            await cmd.deploy("weth9", "WETH9Mock")
            await cmd.deploy("bentoBox", "BentoBoxMock", this.weth9.address)

            await cmd.addToken("a", "Token A", "A", 18, this.ReturnFalseERC20Mock)
            //await cmd.addToken("b", "Token B", "B", 8, this.RevertingERC20Mock)
            await cmd.addToken("b", "Token B", "B", 18, this.RevertingERC20Mock)            
            await cmd.addPair("sushiSwapPair", this.a, this.b, 50000, 50000)

            await cmd.deploy("strategy", "SimpleStrategyMock", this.bentoBox.address, this.a.address)

            await this.bentoBox.setStrategy(this.a.address, this.strategy.address)
            await advanceTime(1209600, ethers)
            await this.bentoBox.setStrategy(this.a.address, this.strategy.address)
            await this.bentoBox.setStrategyTargetPercentage(this.a.address, 20)

            await cmd.deploy("erc20", "ERC20Mock", 10000000)
            await cmd.deploy("BkashiPair", "BKashiPairMock", this.bentoBox.address)
            await cmd.deploy("oracle", "OracleMock")
            await cmd.deploy("swapper", "SushiSwapSwapper", this.bentoBox.address, this.factory.address, await this.factory.pairCodeHash())
            await this.BkashiPair.setSwapper(this.swapper.address, true)
            await this.BkashiPair.setFeeTo(this.alice.address)

            await this.oracle.set(getBigNumber(1, 28))
            const oracleData = await this.oracle.getDataParameter()

            await cmd.addKashiPair("pairHelper", this.bentoBox, this.BkashiPair, this.a, this.b, this.oracle, oracleData)

            // Two different ways to approve the kashiPair
            await setMasterContractApproval(this.bentoBox, this.alice, this.alice, this.alicePrivateKey, this.BkashiPair.address, true)
            await setMasterContractApproval(this.bentoBox, this.bob, this.bob, this.bobPrivateKey, this.BkashiPair.address, true)

            await this.a.connect(this.fred).approve(this.bentoBox.address, getBigNumber(130))
            await expect(this.bentoBox.connect(this.fred).deposit(this.a.address, this.fred.address, this.fred.address, getBigNumber(100), 0))
                .to.emit(this.a, "Transfer")
                .withArgs(this.fred.address, this.bentoBox.address, getBigNumber(100))
                .to.emit(this.bentoBox, "LogDeposit")
                .withArgs(this.a.address, this.fred.address, this.fred.address, getBigNumber(100), getBigNumber(100))

            await this.bentoBox.connect(this.fred).addProfit(this.a.address, getBigNumber(30))

            await this.b.connect(this.fred).approve(this.bentoBox.address, getBigNumber(400, 8))
            await expect(this.bentoBox.connect(this.fred).deposit(this.b.address, this.fred.address, this.fred.address, getBigNumber(200, 8), 0))
                .to.emit(this.b, "Transfer")
                .withArgs(this.fred.address, this.bentoBox.address, getBigNumber(200, 8))
                .to.emit(this.bentoBox, "LogDeposit")
                .withArgs(this.b.address, this.fred.address, this.fred.address, getBigNumber(200, 8), getBigNumber(200, 8))

            await this.bentoBox.connect(this.fred).addProfit(this.b.address, getBigNumber(200, 8))

            

            const master = await this.bentoBox.masterContractOf(this.pairHelper.contract.address)
            await this.bentoBox.whitelistMasterContract(master, true)            
            await cmd.deploy("BAMM", "BAMM", this.pairHelper.contract.address, this.oracle.address, this.b.address, this.a.address, feePool, 400)            
        })
    })

    beforeEach(async function () {
        cmd = await fixture()
    })

    describe("Deployment", function () {
        it("Assigns a name", async function () {
            expect(await this.pairHelper.contract.name()).to.be.equal("Kashi Medium Risk Token A/Token B-Test")
        })
        it("Assigns a symbol", async function () {
            expect(await this.pairHelper.contract.symbol()).to.be.equal("kmA/B-TEST")
        })

        it("Assigns decimals", async function () {
            expect(await this.pairHelper.contract.decimals()).to.be.equal(8)
        })

        it("totalSupply is reachable", async function () {
            expect(await this.pairHelper.contract.totalSupply()).to.be.equal(0)
        })
    })

    describe("Init", function () {
        it("Reverts init for collateral address 0", async function () {
            const oracleData = await this.oracle.getDataParameter()
            await expect(
                cmd.addKashiPair("pairHelper", this.bentoBox, this.BkashiPair, ADDRESS_ZERO, this.b, this.oracle, oracleData)
            ).to.be.revertedWith("KashiPair: bad pair")
        })

        it("Reverts init for initilised pair", async function () {
            await expect(this.pairHelper.contract.init(this.pairHelper.initData)).to.be.revertedWith("KashiPair: already initialized")
        })
    })

    describe("Permit", function () {
        it("should allow permit", async function () {
            const nonce = await this.a.nonces(this.alice.address)
            const deadline = (await this.alice.provider._internalBlockNumber).respTime + 10000
            await this.pairHelper.tokenPermit(this.a, this.alice, this.alicePrivateKey, 1, nonce, deadline)
        })
    })

    describe("Accrue", function () {
        it("should take else path if accrue is called within same block", async function () {
            await this.pairHelper.contract.accrueTwice()
        })

        it("should update the interest rate according to utilization", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.approveAsset(getBigNumber(700, 8)),
                cmd.depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(800)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.do(this.pairHelper.contract.borrow, this.alice.address, sansBorrowFee(getBigNumber(75, 8))),
                cmd.do(this.pairHelper.contract.accrue),
                cmd.do(this.oracle.set, "1100000000000000000"),
                cmd.do(this.pairHelper.contract.updateExchangeRate),
            ])

            let borrowPartLeft = await this.pairHelper.contract.userBorrowPart(this.alice.address)
            let collateralLeft = await this.pairHelper.contract.userCollateralShare(this.alice.address)
            await this.pairHelper.run((cmd) => [cmd.repay(borrowPartLeft.sub(getBigNumber(1, 6)))])
            borrowPartLeft = await this.pairHelper.contract.userBorrowPart(this.alice.address)

            // run for a while with 0 utilization
            let rate1 = (await this.pairHelper.contract.accrueInfo()).interestPerSecond
            for (let i = 0; i < 20; i++) {
                await advanceBlock(ethers)
            }
            await this.pairHelper.contract.accrue()

            // check results
            let rate2 = (await this.pairHelper.contract.accrueInfo()).interestPerSecond
            assert(rate2.lt(rate1), "rate has not adjusted down with low utilization")

            // then increase utilization to 90%
            await this.pairHelper.run((cmd) => [
                cmd.depositCollateral(getBigNumber(400)),
                cmd.do(this.pairHelper.contract.borrow, this.alice.address, sansBorrowFee(getBigNumber(270, 8))),
            ])

            // and run a while again
            rate1 = (await this.pairHelper.contract.accrueInfo()).interestPerSecond
            for (let i = 0; i < 20; i++) {
                await advanceBlock(ethers)
            }

            // check results
            await this.pairHelper.contract.accrue()
            rate2 = (await this.pairHelper.contract.accrueInfo()).interestPerSecond
            expect(rate2).to.be.gt(rate1)
        })

        it("should reset interest rate if no more assets are available", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.approveAsset(getBigNumber(900, 8)),
                cmd.depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(200)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.do(this.pairHelper.contract.borrow, this.alice.address, sansBorrowFee(getBigNumber(75, 8))),
                cmd.do(this.pairHelper.contract.accrue),
            ])
            let borrowPartLeft = await this.pairHelper.contract.userBorrowPart(this.alice.address)
            let balanceLeft = await this.pairHelper.contract.balanceOf(this.alice.address)
            await this.pairHelper.run((cmd) => [cmd.repay(borrowPartLeft), cmd.do(this.pairHelper.contract.accrue)])
            expect((await this.pairHelper.contract.accrueInfo()).interestPerSecond).to.be.equal(317097920)
        })

        it("should lock interest rate at minimum", async function () {
            let totalBorrowBefore = (await this.pairHelper.contract.totalBorrow()).amount
            await this.pairHelper.run((cmd) => [
                cmd.approveAsset(getBigNumber(900, 8)),
                cmd.depositAsset(getBigNumber(100, 8)),
                cmd.approveCollateral(getBigNumber(200)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.do(this.pairHelper.contract.borrow, this.alice.address, 1),
                cmd.do(this.pairHelper.contract.accrue),
            ])
            await advanceTimeAndBlock(30000, ethers)
            await this.pairHelper.contract.accrue()
            await advanceTimeAndBlock(30000, ethers)
            await this.pairHelper.contract.accrue()

            expect((await this.pairHelper.contract.accrueInfo()).interestPerSecond).to.be.equal(79274480)
        })

        it("should lock interest rate at maximum", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.approveAsset(getBigNumber(900, 8)),
                cmd.depositAsset(getBigNumber(100, 8)),
                cmd.approveCollateral(getBigNumber(300)),
                cmd.depositCollateral(getBigNumber(300)),
                cmd.do(this.pairHelper.contract.borrow, this.alice.address, sansBorrowFee(getBigNumber(100, 8))),
                cmd.do(this.pairHelper.contract.accrue),
            ])
            await this.pairHelper.contract.accrue()
            await advanceTimeAndBlock(30000, ethers)
            await this.pairHelper.contract.accrue()
            await advanceTimeAndBlock(1500000, ethers)
            await this.pairHelper.contract.accrue()
            await advanceTimeAndBlock(1500000, ethers)
            await this.pairHelper.contract.accrue()

            expect((await this.pairHelper.contract.accrueInfo()).interestPerSecond).to.be.equal(317097920000)
        })

        it("should emit Accrue if on target utilization", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.approveAsset(getBigNumber(900, 8)),
                cmd.depositAsset(getBigNumber(100, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.do(this.pairHelper.contract.borrow, this.alice.address, sansBorrowFee(getBigNumber(75, 8))),
            ])
            await expect(this.pairHelper.contract.accrue()).to.emit(this.pairHelper.contract, "LogAccrue")
        })
    })

    describe("Is Solvent", function () {
        //
    })

    describe("Update Exchange Rate", async function () {
        it("should update exchange rate", async function () {
            const ACTION_UPDATE_EXCHANGE_RATE = 11
            await this.pairHelper.contract.cook(
                [ACTION_UPDATE_EXCHANGE_RATE],
                [0],
                [defaultAbiCoder.encode(["bool", "uint256", "uint256"], [true, 0, 0])]
            )
        })
    })

    describe("Add Asset", function () {
        it("should add asset with skim", async function () {
            await this.b.approve(this.bentoBox.address, getBigNumber(2, 8))
            await this.bentoBox.deposit(this.b.address, this.alice.address, this.alice.address, 0, getBigNumber(1, 8))
            await this.bentoBox.transfer(this.b.address, this.alice.address, this.pairHelper.contract.address, getBigNumber(1, 8))
            await this.pairHelper.run((cmd) => [cmd.do(this.pairHelper.contract.addAsset, this.alice.address, true, getBigNumber(1, 8))])
            expect(await this.pairHelper.contract.balanceOf(this.alice.address)).to.be.equal(getBigNumber(1, 8))
        })

        it("should revert when trying to skim too much", async function () {
            await this.b.approve(this.bentoBox.address, getBigNumber(2))
            await this.bentoBox.deposit(this.b.address, this.alice.address, this.alice.address, 0, getBigNumber(1, 8))
            await this.bentoBox.transfer(this.b.address, this.alice.address, this.pairHelper.contract.address, getBigNumber(1, 8))
            await expect(
                this.pairHelper.run((cmd) => [cmd.do(this.pairHelper.contract.addAsset, this.alice.address, true, getBigNumber(2, 8))])
            ).to.be.revertedWith("KashiPair: Skim too much")
        })

        it("should revert if MasterContract is not approved", async function () {
            await this.b.connect(this.carol).approve(this.bentoBox.address, 300)
            await expect((await this.pairHelper.as(this.carol)).depositAsset(290)).to.be.revertedWith("BentoBox: Transfer not approved")
        })

        it("should take a deposit of assets from BentoBox", async function () {
            await this.pairHelper.run((cmd) => [cmd.approveAsset(3000), cmd.depositAsset(3000)])
            expect(await this.pairHelper.contract.balanceOf(this.alice.address)).to.be.equal(1500)
        })

        it("should emit correct event on adding asset", async function () {
            await this.b.approve(this.bentoBox.address, 3000)
            await expect(this.pairHelper.depositAsset(2900))
                .to.emit(this.pairHelper.contract, "LogAddAsset")
                .withArgs(this.alice.address, this.alice.address, 1450, 1450)
        })
    })

    describe("Remove Asset", function () {
        it("should not allow a remove without assets", async function () {
            await expect(this.pairHelper.withdrawAsset(1)).to.be.reverted
        })

        it("should allow to remove assets", async function () {
            let bobHelper = await this.pairHelper.as(this.bob)
            await bobHelper.run((cmd) => [cmd.approveAsset(getBigNumber(200, 8)), cmd.depositAsset(getBigNumber(200, 8))])
            expect(await this.pairHelper.contract.balanceOf(this.bob.address)).to.be.equal(getBigNumber(100, 8))
            await this.pairHelper.run((cmd) => [
                cmd.approveAsset(getBigNumber(200, 8)),
                cmd.depositAsset(getBigNumber(200, 8)),
                cmd.withdrawAsset(getBigNumber(100, 8)),
            ])
        })
    })

    describe("Add Collateral", function () {
        it("should take a deposit of collateral", async function () {
            await this.a.approve(this.bentoBox.address, 300)
            await expect(this.pairHelper.depositCollateral(290))
                .to.emit(this.pairHelper.contract, "LogAddCollateral")
                .withArgs(this.alice.address, this.alice.address, 223)
        })
    })

    describe("Remove Collateral", function () {
        it("should not allow a remove without collateral", async function () {
            await expect(this.pairHelper.withdrawCollateral(this.alice.address, 1)).to.be.revertedWith("BoringMath: Underflow")
        })

        it("should allow a direct removal of collateral", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.do(this.pairHelper.contract.removeCollateral, this.alice.address, getBigNumber(50)),
            ])
            expect(await this.bentoBox.balanceOf(this.a.address, this.alice.address)).to.be.equal(getBigNumber(50))
        })

        it("should not allow a remove of collateral if user is insolvent", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.approveAsset(getBigNumber(300, 8)),
                cmd.depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.do(this.pairHelper.contract.borrow, this.alice.address, sansBorrowFee(getBigNumber(75, 8))),
                cmd.do(this.pairHelper.contract.accrue),
            ])

            await expect(this.pairHelper.withdrawCollateral(getBigNumber(1, 0))).to.be.revertedWith("KashiPair: user insolvent")
        })

        it("should allow to partial withdrawal of collateral", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.approveAsset(getBigNumber(700, 8)),
                cmd.depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.do(this.pairHelper.contract.borrow, this.alice.address, sansBorrowFee(getBigNumber(75, 8))),
                cmd.do(this.pairHelper.contract.accrue),
                cmd.do(this.oracle.set, "11000000000000000000000000000"),
                cmd.do(this.pairHelper.contract.updateExchangeRate),
            ])
            let borrowPartLeft = await this.pairHelper.contract.userBorrowPart(this.alice.address)
            await this.pairHelper.run((cmd) => [cmd.repay(borrowPartLeft), cmd.withdrawCollateral(getBigNumber(50))])
        })

        it("should allow to full withdrawal of collateral", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.approveAsset(getBigNumber(700, 8)),
                cmd.depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.do(this.pairHelper.contract.borrow, this.alice.address, sansBorrowFee(getBigNumber(75, 8))),
                cmd.do(this.pairHelper.contract.accrue),
                cmd.do(this.oracle.set, "11000000000000000000000000000"),
                cmd.do(this.pairHelper.contract.updateExchangeRate),
            ])
            let borrowPartLeft = await this.pairHelper.contract.userBorrowPart(this.alice.address)
            await this.pairHelper.repay(borrowPartLeft)
            let collateralLeft = await this.pairHelper.contract.userCollateralShare(this.alice.address)
            await this.pairHelper.withdrawCollateral(sansSafetyAmount(collateralLeft))
        })
    })

    describe("Borrow", function () {
        it("should not allow borrowing without any assets", async function () {
            await expect(this.pairHelper.contract.borrow(this.alice.address, 10000)).to.be.revertedWith("Kashi: below minimum")
            await expect(this.pairHelper.contract.borrow(this.alice.address, 1)).to.be.revertedWith("Kashi: below minimum")
        })

        it("should not allow borrowing without any collateral", async function () {
            await this.b.approve(this.bentoBox.address, 300)
            await await this.pairHelper.depositAsset(290)
            await expect(this.pairHelper.contract.borrow(this.alice.address, 1)).to.be.revertedWith("Kashi: below minimum")
        })

        it("should allow borrowing with collateral up to 75%", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.as(this.bob).approveAsset(getBigNumber(300, 8)),
                cmd.as(this.bob).depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
            ])
            await expect(this.pairHelper.contract.borrow(this.alice.address, sansBorrowFee(getBigNumber(75, 8))))
                .to.emit(this.pairHelper.contract, "LogBorrow")
                .withArgs(this.alice.address, this.alice.address, "7496251874", "3748125", "7499999999")
        })

        it("should allow borrowing to other with correct borrowPart", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.as(this.bob).approveAsset(getBigNumber(300, 8)),
                cmd.as(this.bob).depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
            ])
            await expect(this.pairHelper.contract.borrow(this.bob.address, sansBorrowFee(getBigNumber(75, 8))))
                .to.emit(this.pairHelper.contract, "LogBorrow")
                .withArgs(this.alice.address, this.bob.address, "7496251874", "3748125", "7499999999")
            expect(await this.pairHelper.contract.userBorrowPart(this.alice.address)).to.be.equal("7499999999")
            expect(await this.pairHelper.contract.userBorrowPart(this.bob.address)).to.be.equal("0")
        })

        it("should not allow any more borrowing", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.approveAsset(getBigNumber(300, 8)),
                cmd.depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
            ])
            await this.pairHelper.contract.borrow(this.alice.address, sansBorrowFee(getBigNumber(75, 8)))
            await expect(this.pairHelper.contract.borrow(this.alice.address, 1)).to.be.revertedWith("user insolvent")
        })

        /*it("should report insolvency due to interest", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.approveAsset(getBigNumber(300, 8)),
                cmd.depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.do(this.pairHelper.contract.borrow, this.alice.address, sansBorrowFee(getBigNumber(75, 8))),
                cmd.do(this.pairHelper.contract.accrue),
            ])
            expect(await this.pairHelper.contract.isSolvent(this.alice.address, false)).to.be.false
        })*/
    })

    describe("Repay", function () {
        it("should allow to repay", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.approveAsset(getBigNumber(700, 8)),
                cmd.depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.borrow(sansBorrowFee(getBigNumber(75, 8))),
                cmd.accrue(),
                cmd.do(this.oracle.set, "11000000000000000000000000000"),
                cmd.updateExchangeRate(),
                cmd.repay(getBigNumber(30, 8)),
            ])
        })

        it("should allow to repay from BentoBox", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.approveAsset(getBigNumber(700, 8)),
                cmd.depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.borrow(sansBorrowFee(getBigNumber(75, 8))),
                cmd.do(this.bentoBox.deposit, this.b.address, this.alice.address, this.alice.address, getBigNumber(70, 8), 0),
                cmd.do(this.pairHelper.contract.repay, this.alice.address, false, getBigNumber(50, 8)),
            ])
        })

        it("should allow full repayment", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.approveAsset(getBigNumber(900, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositAsset(getBigNumber(290, 8)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.borrow(sansBorrowFee(getBigNumber(75, 8))),
                cmd.accrue(),
                cmd.do(this.oracle.set, "11000000000000000000000000000"),
                cmd.updateExchangeRate(),
            ])

            let part = await this.pairHelper.contract.userBorrowPart(this.alice.address)

            await this.pairHelper.run((cmd) => [cmd.repay(part)])
        })
    })

    describe("Short", function () {
        it("should not allow shorting if it does not return enough", async function () {
            await expect(
                this.pairHelper.run((cmd) => [
                    cmd.as(this.bob).approveAsset(getBigNumber(1000, 8)),
                    cmd.as(this.bob).depositAsset(getBigNumber(1000, 8)),
                    cmd.approveCollateral(getBigNumber(100)),
                    cmd.depositCollateral(getBigNumber(100)),
                    cmd.short(this.swapper, getBigNumber(200, 8), getBigNumber(200)),
                ])
            ).to.be.revertedWith("KashiPair: call failed")
        })

        it("should not allow shorting into insolvency", async function () {
            await expect(
                this.pairHelper.run((cmd) => [
                    // Bob adds 1000 asset (amount)
                    cmd.as(this.bob).approveAsset(getBigNumber(1000, 8)),
                    cmd.as(this.bob).depositAsset(getBigNumber(1000, 8)),
                    // Alice adds 100 collateral (amount)
                    cmd.approveCollateral(getBigNumber(100)),
                    cmd.depositCollateral(getBigNumber(100)),
                    // Alice shorts by borrowing 500 assets shares for at least 50 shares collateral
                    cmd.short(this.swapper, getBigNumber(400, 8), getBigNumber(50)),
                ])
            ).to.be.revertedWith("KashiPair: user insolvent")
        })

        it("should allow shorting", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.as(this.bob).approveAsset(getBigNumber(1000, 8)),
                cmd.as(this.bob).depositAsset(getBigNumber(1000, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.short(this.swapper, getBigNumber(250, 8), getBigNumber(176)),
            ])
        })

        it("should limit asset availability after shorting", async function () {
            // Alice adds 1 asset
            // Bob adds 1000 asset
            // Alice adds 100 collateral
            // Alice borrows 250 asset and deposits 230+ collateral
            await this.pairHelper.run((cmd) => [
                cmd.approveAsset(getBigNumber(1, 8)),
                cmd.depositAsset(getBigNumber(1, 8)), // Just a minimum balance for the BentoBox
                cmd.as(this.bob).approveAsset(getBigNumber(1000, 8)),
                cmd.as(this.bob).depositAsset(getBigNumber(1000, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.short(this.swapper, getBigNumber(250, 8), getBigNumber(176)),
            ])

            const bobBal = await this.pairHelper.contract.balanceOf(this.bob.address)
            expect(bobBal).to.be.equal(getBigNumber(500, 8))
            // virtual balance of 1000 is higher than the contract has
            await expect(this.pairHelper.as(this.bob).withdrawAsset(bobBal)).to.be.revertedWith("BoringMath: Underflow")
            await expect(this.pairHelper.as(this.bob).withdrawAsset(getBigNumber(376, 8))).to.be.revertedWith("BoringMath: Underflow")
            await this.pairHelper.as(this.bob).withdrawAsset(getBigNumber(375, 8))
        })
    })

    describe("Unwind", function () {
        it("should allow unwinding the short", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.as(this.bob).approveAsset(getBigNumber(1000, 8)),
                cmd.as(this.bob).depositAsset(getBigNumber(1000, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.short(this.swapper, getBigNumber(250, 8), getBigNumber(176)),
            ])

            const collateralShare = await this.pairHelper.contract.userCollateralShare(this.alice.address)
            const borrowPart = await this.pairHelper.contract.userBorrowPart(this.alice.address)

            await this.pairHelper.run((cmd) => [cmd.unwind(this.swapper, borrowPart, collateralShare)])
        })
    })

    describe("Cook", function () {
        it("can add 2 values to a call and receive 1 value back", async function () {
            const ACTION_BENTO_DEPOSIT = 20
            const ACTION_CALL = 30

            await cmd.deploy("externalFunctionMock", "ExternalFunctionMock")

            let data = this.externalFunctionMock.interface.encodeFunctionData("sum", [10, 10])

            await this.pairHelper.run((cmd) => [cmd.approveAsset(getBigNumber(100, 8))])

            await expect(
                this.pairHelper.contract.cook(
                    [ACTION_BENTO_DEPOSIT, ACTION_CALL, ACTION_BENTO_DEPOSIT],
                    [0, 0, 0],
                    [
                        defaultAbiCoder.encode(
                            ["address", "address", "int256", "int256"],
                            [this.b.address, this.alice.address, getBigNumber(25, 8), 0]
                        ),
                        defaultAbiCoder.encode(
                            ["address", "bytes", "bool", "bool", "uint8"],
                            [this.externalFunctionMock.address, data.slice(0, -128), true, true, 1]
                        ),
                        defaultAbiCoder.encode(["address", "address", "int256", "int256"], [this.b.address, this.alice.address, -1, 0]),
                    ]
                )
            )
                .to.emit(this.externalFunctionMock, "Result")
                .withArgs(getBigNumber(375, 7))

            // (25 / 2) + (37.5 / 2) = 31.25
            expect(await this.bentoBox.balanceOf(this.b.address, this.alice.address)).to.be.equal("3125000000")
        })

        it("reverts on a call to the BentoBox", async function () {
            const ACTION_CALL = 30
            await expect(
                this.pairHelper.contract.cook(
                    [ACTION_CALL],
                    [0],
                    [defaultAbiCoder.encode(["address", "bytes", "bool", "bool", "uint8"], [this.bentoBox.address, "0x", false, false, 0])]
                )
            ).to.be.revertedWith("KashiPair: can't call")
        })

        it("takes else path", async function () {
            await expect(
                this.pairHelper.contract.cook(
                    [99],
                    [0],
                    [
                        defaultAbiCoder.encode(
                            ["address", "address", "int256", "int256"],
                            [this.b.address, this.alice.address, getBigNumber(25), 0]
                        ),
                    ]
                )
            )
        })

        it("get repays part", async function () {
            const ACTION_GET_REPAY_PART = 7
            await this.pairHelper.contract.cook([ACTION_GET_REPAY_PART], [0], [defaultAbiCoder.encode(["int256"], [1])])
        })

        it("executed Bento transfer multiple", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.approveAsset(getBigNumber(100, 8)),
                cmd.do(this.bentoBox.deposit, this.b.address, this.alice.address, this.alice.address, getBigNumber(70, 8), 0),
            ])
            const ACTION_BENTO_TRANSFER_MULTIPLE = 23
            await this.pairHelper.contract.cook(
                [ACTION_BENTO_TRANSFER_MULTIPLE],
                [0],
                [defaultAbiCoder.encode(["address", "address[]", "uint256[]"], [this.b.address, [this.carol.address], [getBigNumber(10, 8)]])]
            )
        })

        it("allows to addAsset with approval", async function () {
            const nonce = await this.bentoBox.nonces(this.alice.address)
            await expect(
                await this.pairHelper.run((cmd) => [
                    cmd.approveAsset(getBigNumber(100, 8)),
                    cmd.depositAssetWithApproval(getBigNumber(100, 8), this.BkashiPair, this.alicePrivateKey, nonce),
                ])
            )
        })
    })

    const isEqualWithRoundingErrorFlexability = (a, b, rounding) => {
        if(a.gte(b)){
            return a.sub(b).lte(rounding)
        }else{
            return b.sub(a).lte(rounding)
        }
    }

   describe.only("bamm", function () {
        async function getBentoBoxBalance(thisObject, token, address) {
            const share = await thisObject.bentoBox.balanceOf(token, address)
            return await thisObject.bentoBox.toAmount(token, share, false) 
        }

        async function toAmount(thisObject, token, share) {
            return await thisObject.bentoBox.toAmount(token, share, false)            
        }

        it("deposit and withdraw only with mim", async function () {
            const bamm = this.BAMM
            const depositAmonut = getBigNumber(2, 18);
            const withdrawAmountShare = getBigNumber(5, 17);
            const withdrawAmountMim = getBigNumber(1, 18);

            const bobBalBefore = await this.b.balanceOf(this.bob.address)
            
            // deposit
            await this.b.connect(this.bob).approve(bamm.address, depositAmonut);
            await bamm.connect(this.bob).deposit(depositAmonut, false);

            expect(await bamm.balanceOf(this.bob.address)).to.be.equal(getBigNumber(1, 18))
            expect((await this.b.balanceOf(this.bob.address)).add(depositAmonut)).to.be.equal(bobBalBefore)            
            expect((await getBentoBoxBalance(this, this.b.address, bamm.address))).to.be.equal(depositAmonut)

            // withdraw
            await bamm.connect(this.bob).withdraw(withdrawAmountShare, false)

            expect(await bamm.balanceOf(this.bob.address)).to.be.equal(getBigNumber(1, 18).sub(withdrawAmountShare))
            expect((await this.b.balanceOf(this.bob.address)).add(depositAmonut.sub(withdrawAmountMim))).to.be.equal(bobBalBefore)            
            expect((await getBentoBoxBalance(this, this.b.address, bamm.address))).to.be.equal(depositAmonut.sub(withdrawAmountMim))

            // deposit with alice
            await this.b.connect(this.alice).approve(bamm.address, depositAmonut)
            await bamm.connect(this.alice).deposit(depositAmonut, false)

            expect(await bamm.balanceOf(this.alice.address)).to.be.equal(getBigNumber(1, 18)) // 1 shares            
        })

        it("deposit and withdraw only with mim via bentoBox", async function () {
            const depositAmonut = getBigNumber(2, 18);
            // bob bento deposit
            await this.b.connect(this.bob).approve(this.bentoBox.address, depositAmonut);
            await this.bentoBox.connect(this.bob).deposit(this.b.address, this.bob.address, this.bob.address, depositAmonut, 0)
            // alice bento deposit
            await this.b.connect(this.alice).approve(this.bentoBox.address, depositAmonut);
            await this.bentoBox.connect(this.alice).deposit(this.b.address, this.alice.address, this.alice.address, depositAmonut, 0)
            
            const bobBentoBalBefore = await getBentoBoxBalance(this, this.b.address, this.bob.address)
            
            // console.log("Alice Asset in Bento", (await getBentoBoxBalance(this, this.b.address, this.alice.address)).toString())
            // console.log("Bob Asset in Bento", (bobBentoBalBefore).toString())
            const bamm = this.BAMM
            const withdrawAmountShare = getBigNumber(5, 17);
            const withdrawAmountMim = getBigNumber(1, 18);

            // deposit
            await setMasterContractApproval(this.bentoBox, this.bob, this.bob, this.bobPrivateKey, bamm.address, true)
            await bamm.connect(this.bob).deposit(depositAmonut, true);

            expect(await bamm.balanceOf(this.bob.address)).to.be.equal(getBigNumber(1, 18))
            expect((await getBentoBoxBalance(this, this.b.address, this.bob.address)).add(depositAmonut)).to.be.equal(bobBentoBalBefore)            
            expect((await getBentoBoxBalance(this, this.b.address, bamm.address))).to.be.equal(depositAmonut)
            
            // withdraw
            await bamm.connect(this.bob).withdraw(withdrawAmountShare, true)

            expect((await getBentoBoxBalance(this, this.b.address, this.bob.address)).add(depositAmonut.sub(withdrawAmountMim))).to.be.equal(bobBentoBalBefore)            
            expect((await getBentoBoxBalance(this, this.b.address, bamm.address))).to.be.equal(depositAmonut.sub(withdrawAmountMim))
            expect((await bamm.balanceOf(this.bob.address))).to.be.equal(withdrawAmountShare)
            
            // deposit with alice
            await setMasterContractApproval(this.bentoBox, this.alice, this.alice, this.alicePrivateKey, bamm.address, true)
            await bamm.connect(this.alice).deposit(depositAmonut, true)
            expect(await bamm.balanceOf(this.alice.address)).to.be.equal(getBigNumber(1, 18)) // 1 shares            
        })

        it("deposit and withdraw also with collateral", async function () {
            const bamm = this.BAMM
            const depositAmonut = getBigNumber(11, 17);
            
            // deposit
            await this.b.connect(this.bob).approve(bamm.address, depositAmonut);
            await bamm.connect(this.bob).deposit(depositAmonut, false);

            // transfer collateral
            await this.a.connect(this.bob).approve(this.bentoBox.address, getBigNumber(1, 18))
            await this.bentoBox.connect(this.bob).deposit(this.a.address, this.bob.address, bamm.address, getBigNumber(1, 18), 0)
            //await this.a.connect(this.bob).transfer(bamm.address, getBigNumber(1, 18))
            await this.oracle.connect(this.alice).set(getBigNumber(11, 17).toString())

            // now there are 1.1 of mim, and 1.1 worth of collateral

            // deposit 2.2 of mim
            await this.b.connect(this.alice).approve(bamm.address, getBigNumber(22, 17))
            await bamm.connect(this.alice).deposit(getBigNumber(22, 17), false)

            expect((await bamm.balanceOf(this.alice.address))).to.be.equal(getBigNumber(1, 18))

            // now there are 3.3 of mim and 1.1 worth of collateral

            // withdraw half the deposit. get 3.3/4 = 0.825 mim and 1.0/4 = 0.25 of collateral
            const aliceMimBalBefore = await this.b.balanceOf(this.alice.address)
            const aliceColBalBefore = await this.a.balanceOf(this.alice.address)

            await bamm.connect(this.alice).withdraw(getBigNumber(5, 17), false)

            const aliceMimBalAfter = await this.b.balanceOf(this.alice.address)
            const aliceColBalAfter = await this.a.balanceOf(this.alice.address)


            const expectedMimDelta = getBigNumber(825, 15)
            const expectedColDelta = getBigNumber(25, 16)

            // sub 1 to compensate on rounding errors
            expect(aliceColBalBefore.add(expectedColDelta.sub(1))).to.be.equal(aliceColBalAfter)
            expect(aliceMimBalBefore.add(expectedMimDelta)).to.be.equal(aliceMimBalAfter)
        })

        it("deposit and withdraw also with collateral via bentoBox", async function () {
            const bamm = this.BAMM
            const depositAmonut = getBigNumber(11, 17);
            const aliceDepositAmonut = getBigNumber(22, 17);

            // bob bento deposit
            await this.b.connect(this.bob).approve(this.bentoBox.address, depositAmonut);
            await this.bentoBox.connect(this.bob).deposit(this.b.address, this.bob.address, this.bob.address, depositAmonut, 0)
            // alice bento deposit
            await this.b.connect(this.alice).approve(this.bentoBox.address, aliceDepositAmonut);
            await this.bentoBox.connect(this.alice).deposit(this.b.address, this.alice.address, this.alice.address, aliceDepositAmonut, 0)
            
            // deposit
            await setMasterContractApproval(this.bentoBox, this.bob, this.bob, this.bobPrivateKey, bamm.address, true)
            await bamm.connect(this.bob).deposit(depositAmonut, true);

            // transfer collateral
            await this.a.connect(this.bob).approve(this.bentoBox.address, getBigNumber(1, 18))
            await this.bentoBox.connect(this.bob).deposit(this.a.address, this.bob.address, bamm.address, getBigNumber(1, 18), 0)
            // //await this.a.connect(this.bob).transfer(bamm.address, getBigNumber(1, 18))
            await this.oracle.connect(this.alice).set(getBigNumber(11, 17).toString())

            // now there are 1.1 of mim, and 1.1 worth of collateral

            // deposit 2.2 of mim
            await setMasterContractApproval(this.bentoBox, this.alice, this.alice, this.alicePrivateKey, bamm.address, true)
            await bamm.connect(this.alice).deposit(aliceDepositAmonut, true)

            expect((await bamm.balanceOf(this.alice.address))).to.be.equal(getBigNumber(1, 18))

            // now there are 3.3 of mim and 1.1 worth of collateral

            // withdraw half the deposit. get 3.3/4 = 0.825 mim and 1.0/4 = 0.25 of collateral
            const aliceMimBentoBalBefore = await getBentoBoxBalance(this, this.b.address, this.alice.address)
            const aliceColBentoBalBefore = await getBentoBoxBalance(this, this.a.address, this.alice.address)

            await bamm.connect(this.alice).withdraw(getBigNumber(5, 17), true)

            const aliceMimBentoBalAfter = await getBentoBoxBalance(this, this.b.address, this.alice.address)
            const aliceColBentoBalAfter = await getBentoBoxBalance(this, this.a.address, this.alice.address)


            const expectedMimDelta = getBigNumber(825, 15)
            const expectedColDelta = getBigNumber(25, 16)

            // sub 1 to compensate on rounding errors
            const roundingErrorFlex = getBigNumber(5, 0)
            expect(isEqualWithRoundingErrorFlexability(aliceColBentoBalBefore.add(expectedColDelta), aliceColBentoBalAfter, roundingErrorFlex)).to.be.equal(true)
            expect(aliceMimBentoBalBefore.add(expectedMimDelta)).to.be.equal(aliceMimBentoBalAfter)
        })


/*
    it('test getSwapEthAmount', async () => {
      // --- SETUP ---


      // 4k liquidations
      assert.equal(toBN(dec(6000, 18)).toString(), (await stabilityPool.getCompoundedLUSDDeposit(bamm.address)).toString())
      const ethGains = web3.utils.toBN("39799999999999999975")

      const lusdQty = dec(105, 18)
      const expectedReturn = await bamm.getReturn(lusdQty, dec(6000, 18), toBN(dec(6000, 18)).add(ethGains.mul(toBN(2 * 105))), 200)

      // without fee
      await bamm.setParams(200, 0, {from: bammOwner})
      const priceWithoutFee = await bamm.getSwapEthAmount(lusdQty)
      assert.equal(priceWithoutFee.ethAmount.toString(), expectedReturn.mul(toBN(100)).div(toBN(100 * 105)).toString())

      // with fee
      await bamm.setParams(200, 100, {from: bammOwner})
      const priceWithFee = await bamm.getSwapEthAmount(lusdQty)
      assert.equal(priceWithFee.ethAmount.toString(), expectedReturn.mul(toBN(99)).div(toBN(100 * 105)).toString())      
    }) */

        it("getSwapGemAmount", async function () {
            const bamm = this.BAMM
            const mimAmonut = getBigNumber(600, 18)
            const colAmount = "3979999999999999997" // almost 4e17
            const price = getBigNumber(105, 18)
            const wad = getBigNumber(105, 17)

            // deposit
            await this.b.connect(this.bob).approve(bamm.address, mimAmonut);
            await bamm.connect(this.bob).deposit(mimAmonut, false);

            // transfer collateral
            await this.a.connect(this.bob).approve(this.bentoBox.address, colAmount)
            await this.bentoBox.connect(this.bob).deposit(this.a.address, this.bob.address, bamm.address, colAmount, 0)
            //await this.a.connect(this.bob).transfer(bamm.address, getBigNumber(1, 18))
            await this.oracle.connect(this.alice).set(price.toString())
            await bamm.fetchPrice()

            const expectedReturn = await bamm.getReturn(wad, mimAmonut, mimAmonut.add(price.mul(colAmount).mul(2).div(getBigNumber(1, 18))), 200)

            // without fee
            await bamm.setParams(200, 0, 0)
            const priceWithoutFee = await bamm.getSwapGemAmount(wad)
            expect(priceWithoutFee).to.be.equal(expectedReturn.mul(getBigNumber(1,18)).div(price))

            // with fee - price should be the same
            await bamm.setParams(200, 100, 0)
            const priceWithFee = await bamm.getSwapGemAmount(wad)
            expect(priceWithFee).to.be.equal(expectedReturn.mul(getBigNumber(1,18)).div(price))            
        })

        it("swap", async function () {
            const bamm = this.BAMM
            const mimAmonut = getBigNumber(600, 18)
            const colAmount = "3979999999999999997" // almost 4e17
            const price = getBigNumber(105, 18)
            const wad = getBigNumber(105, 17)

            // deposit
            await this.b.connect(this.bob).approve(bamm.address, mimAmonut);
            await bamm.connect(this.bob).deposit(mimAmonut, false);

            // transfer collateral
            await this.a.connect(this.bob).approve(this.bentoBox.address, colAmount)
            await this.bentoBox.connect(this.bob).deposit(this.a.address, this.bob.address, bamm.address, colAmount, 0)
            //await this.a.connect(this.bob).transfer(bamm.address, getBigNumber(1, 18))
            await this.oracle.connect(this.alice).set(price.toString())
            await bamm.fetchPrice()

            // with fee
            await bamm.setParams(200, 100, 0)
            const expectedCol = await bamm.getSwapGemAmount(wad)

            // do the swap
            await this.b.connect(this.bob).approve(bamm.address, wad);
            const dest = "0x0000000000000000000000000000000000000007"

            await bamm.connect(this.bob).swap(wad, 1, dest, false)
            expect(await this.a.balanceOf(dest)).to.be.equal(expectedCol)

            expect(await getBentoBoxBalance(this, this.b.address, feePool)).to.be.equal(wad.div(100))
        })

        it("swap via bentoBox", async function () {
            const bamm = this.BAMM
            const mimAmonut = getBigNumber(600, 18)
            const colAmount = "3979999999999999997" // almost 4e17
            const price = getBigNumber(105, 18)
            const wad = getBigNumber(105, 17)

            // deposit
            await this.b.connect(this.bob).approve(bamm.address, mimAmonut);
            await bamm.connect(this.bob).deposit(mimAmonut, false);

            // transfer collateral
            await this.a.connect(this.bob).approve(this.bentoBox.address, colAmount)
            await this.bentoBox.connect(this.bob).deposit(this.a.address, this.bob.address, bamm.address, colAmount, 0)
            //await this.a.connect(this.bob).transfer(bamm.address, getBigNumber(1, 18))
            await this.oracle.connect(this.alice).set(price.toString())
            await bamm.fetchPrice()

            // with fee
            await bamm.setParams(200, 100, 0)
            const expectedCol = await bamm.getSwapGemAmount(wad)

            // set up bentoBox
            await this.b.connect(this.bob).approve(this.bentoBox.address, wad);
            await this.bentoBox.connect(this.bob).deposit(this.b.address, this.bob.address, this.bob.address, wad, 0)

            // do the swap
            await setMasterContractApproval(this.bentoBox, this.bob, this.bob, this.bobPrivateKey, bamm.address, true)
            const dest = "0x0000000000000000000000000000000000000007"

            await bamm.connect(this.bob).swap(wad, 1, dest, true)
            
            const roundingErrorFlex = getBigNumber(2, 0)
            expect(isEqualWithRoundingErrorFlexability((await getBentoBoxBalance(this, this.a.address, dest)), expectedCol, roundingErrorFlex)).to.be.true
            expect(await getBentoBoxBalance(this, this.b.address, feePool)).to.be.equal(wad.div(100))
        })

        it("liquidate via bprotocol", async function () {
            const bamm = this.BAMM
            
            //console.log(await this.pairHelper.contract.collateral(), this.a.address, await bamm.mim())

            //await this.pairHelper.contract.connect(this.alice).setBProtocolMock(bamm.address)

            const price = getBigNumber(11, 27);

            await this.pairHelper.run((cmd) => [
                cmd.as(this.bob).approveAsset(getBigNumber(310, 8)),
                cmd.as(this.bob).depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.borrow(sansBorrowFee(getBigNumber(75, 8))),
                cmd.accrue(),
                cmd.do(this.oracle.set, price.toString()),
                cmd.updateExchangeRate(),
                cmd.do(this.bentoBox.connect(this.bob).deposit, this.b.address, this.bob.address, this.bob.address, getBigNumber(20, 8), 0),
                cmd.do(this.pairHelper.contract.connect(this.bob).removeAsset, this.bob.address, getBigNumber(50, 8)),
            ])

            await bamm.setParams(20, 0, 100)

            // deposit
            const depositAmonut = await this.b.balanceOf(this.bob.address);

            await this.b.connect(this.bob).approve(bamm.address, depositAmonut);
            await bamm.connect(this.bob).deposit(depositAmonut, false);

            const liquidationShare = await this.pairHelper.contract.userBorrowPart(this.alice.address) //getBigNumber(20, 18);
            const liquidationAmount = await toAmount(this, this.b.address, liquidationShare)

            const bammMimBalBefore = await getBentoBoxBalance(this, this.b.address, bamm.address)
            const bammColBalBefore = await getBentoBoxBalance(this, this.a.address, bamm.address)
            const pairMimBalBefore = await getBentoBoxBalance(this, this.b.address, this.pairHelper.contract.address)
            const nullAddr = "0x0000000000000000000000000000000000000000"
            const rewardAddress = "0x0000000000000000000000000000000000000007"

            // liquidate
            await bamm.connect(this.bob).liquidate([this.alice.address], [liquidationShare], rewardAddress, nullAddr)
            const bammMimBalAfter = await getBentoBoxBalance(this, this.b.address, bamm.address)
            const bammColBalAfter = await getBentoBoxBalance(this, this.a.address, bamm.address)            
            const pairMimBalAfter = await getBentoBoxBalance(this, this.b.address, this.pairHelper.contract.address)

            const deltaMimBamm = bammMimBalBefore.sub(bammMimBalAfter)
            const deltaMimPair = pairMimBalAfter.sub(pairMimBalBefore)

            const rewardBalance = await getBentoBoxBalance(this, this.b.address, rewardAddress)

            expect(deltaMimBamm.sub(rewardBalance)).to.be.equal(deltaMimPair)
            expect(deltaMimPair.div(100)).to.be.equal(rewardBalance)

            const deltaCol = bammColBalAfter.sub(bammColBalBefore)
            const deltaMimWithPermium = deltaMimPair.mul(112).div(100)

            const roundingFactor = getBigNumber(1, 11);
            expect(deltaMimWithPermium.mul(price).div(getBigNumber(1,18)).div(roundingFactor)).to.be.equal(deltaCol.div(roundingFactor))
        })

        it("liquidateLikeTiran", async function () {
            const bamm = this.BAMM
            const price = getBigNumber(11, 27);

            // bob bento deposit setup
            const depositAmonut = getBigNumber(1000, 0)
            await this.b.connect(this.bob).approve(this.bentoBox.address, depositAmonut);
            await this.bentoBox.connect(this.bob).deposit(this.b.address, this.bob.address, this.bob.address, depositAmonut, 0)
            await setMasterContractApproval(this.bentoBox, this.bob, this.bob, this.bobPrivateKey, bamm.address, true)
            await bamm.connect(this.bob).deposit(depositAmonut, true);


            await this.pairHelper.run((cmd) => [
                cmd.as(this.bob).approveAsset(getBigNumber(310, 8)),
                cmd.as(this.bob).depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.borrow(sansBorrowFee(getBigNumber(75, 8))),
                cmd.accrue(),
                cmd.do(this.oracle.set, price.toString()),
                cmd.updateExchangeRate(),
                cmd.do(this.bentoBox.connect(this.bob).deposit, this.b.address, this.bob.address, this.bob.address, getBigNumber(20, 8), 0),
                cmd.do(this.pairHelper.contract.connect(this.bob).removeAsset, this.bob.address, getBigNumber(50, 8)),
            ])

            await bamm.setParams(20, 0, 100)

            // deposit
            const liquidationShare = await this.pairHelper.contract.userBorrowPart(this.alice.address) //getBigNumber(20, 18);
            const liquidationAmount = (await toAmount(this, this.b.address, liquidationShare)).add(11)
            const bammMimBalBefore = await getBentoBoxBalance(this, this.b.address, bamm.address)
            const bobMimBalBefore = await this.b.balanceOf(this.bob.address)
            const bammColBalBefore = await getBentoBoxBalance(this, this.a.address, bamm.address)
            const pairMimBalBefore = await getBentoBoxBalance(this, this.b.address, this.pairHelper.contract.address)
            const nullAddr = "0x0000000000000000000000000000000000000000"
            const rewardAddress = "0x0000000000000000000000000000000000000007"

            // liquidate
            await this.b.connect(this.bob).approve(bamm.address, liquidationAmount);
            await bamm.connect(this.bob).liquidateLikeTiran(liquidationAmount, [this.alice.address], [liquidationShare], rewardAddress, nullAddr, false)
            const bammMimBalAfter = await getBentoBoxBalance(this, this.b.address, bamm.address)
            const bammColBalAfter = await getBentoBoxBalance(this, this.a.address, bamm.address)            
            const pairMimBalAfter = await getBentoBoxBalance(this, this.b.address, this.pairHelper.contract.address)

            const deltaMimBamm = bammMimBalBefore.sub(bammMimBalAfter)
            const deltaMimPair = pairMimBalAfter.sub(pairMimBalBefore)
            const bobMimBalAfter = await this.b.balanceOf(this.bob.address)

            const rewardBalance = await this.a.balanceOf(rewardAddress)
            // check bamm MIM is the same
            expect(bammMimBalAfter).to.be.equal(bammMimBalBefore)
            
            // check reward address contains collateral & mim bonus is 1% of the liquidation
            expect(isEqualWithRoundingErrorFlexability(bobMimBalBefore.sub(deltaMimPair), bobMimBalAfter, 2)).to.be.true

            expect(bammColBalBefore).to.be.equal(bammColBalAfter) // no collateral added to the BAMM            
            
            const roundingFactor = getBigNumber(1, 11);
            const deltaMimWithPermium = deltaMimPair.mul(112).div(100)
            const collateralInMim = deltaMimWithPermium.mul(price).div(getBigNumber(1,18)).div(roundingFactor)
            const roundedRewardBalance = rewardBalance.div(roundingFactor)
            
            expect(collateralInMim).to.be.equal(roundedRewardBalance)
        })


        it("liquidateLikeTiran via bentoBox", async function () {
            const bamm = this.BAMM
            const price = getBigNumber(11, 27);

            // bamm initial deposit setup
            const depositAmonut = getBigNumber(1000, 0)
            await this.b.connect(this.bob).approve(this.bentoBox.address, depositAmonut);
            await this.bentoBox.connect(this.bob).deposit(this.b.address, this.bob.address, this.bob.address, depositAmonut, 0)
            await setMasterContractApproval(this.bentoBox, this.bob, this.bob, this.bobPrivateKey, bamm.address, true)
            await bamm.connect(this.bob).deposit(depositAmonut, true);

            await this.pairHelper.run((cmd) => [
                cmd.as(this.bob).approveAsset(getBigNumber(310, 8)),
                cmd.as(this.bob).depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.borrow(sansBorrowFee(getBigNumber(75, 8))),
                cmd.accrue(),
                cmd.do(this.oracle.set, price.toString()),
                cmd.updateExchangeRate(),
                cmd.do(this.bentoBox.connect(this.bob).deposit, this.b.address, this.bob.address, this.bob.address, getBigNumber(20, 8), 0),
                cmd.do(this.pairHelper.contract.connect(this.bob).removeAsset, this.bob.address, getBigNumber(50, 8)),
            ])

            await bamm.setParams(20, 0, 100)

            const liquidationShare = await this.pairHelper.contract.userBorrowPart(this.alice.address) //getBigNumber(20, 18);
            const liquidationAmount = (await toAmount(this, this.b.address, liquidationShare)).add(11)
            
            await this.b.connect(this.bob).approve(this.bentoBox.address, liquidationAmount.mul(2));
            await this.bentoBox.connect(this.bob).deposit(this.b.address, this.bob.address, this.bob.address, liquidationAmount.mul(2), 0)
            
            const bammMimBalBefore = await getBentoBoxBalance(this, this.b.address, bamm.address)
            const bobMimBentoBalBefore = await getBentoBoxBalance(this, this.b.address, this.bob.address)
            const pairMimBalBefore = await getBentoBoxBalance(this, this.b.address, this.pairHelper.contract.address)
            const nullAddr = "0x0000000000000000000000000000000000000000"
            const rewardAddress = "0x0000000000000000000000000000000000000007"

            // liquidate
            await this.b.connect(this.bob).approve(bamm.address, liquidationAmount);
            await bamm.connect(this.bob).liquidateLikeTiran(liquidationAmount, [this.alice.address], [liquidationShare], rewardAddress, nullAddr, true)
            const bammMimBalAfter = await getBentoBoxBalance(this, this.b.address, bamm.address)
            const pairMimBalAfter = await getBentoBoxBalance(this, this.b.address, this.pairHelper.contract.address)

            const deltaMimBamm = bammMimBalBefore.sub(bammMimBalAfter)
            const deltaMimPair = pairMimBalAfter.sub(pairMimBalBefore)
            const bobMimBentoBalAfter = await getBentoBoxBalance(this, this.b.address, this.bob.address)
            const rewardBalance = await getBentoBoxBalance(this, this.a.address, rewardAddress)
            // check bamm MIM is the same
            expect(bammMimBalAfter).to.be.equal(bammMimBalBefore)

            expect(isEqualWithRoundingErrorFlexability(bobMimBentoBalBefore.sub(deltaMimPair), bobMimBentoBalAfter, 2)).to.be.true
            
            const roundingFactor = getBigNumber(1, 11);
            const deltaMimWithPermium = deltaMimPair.mul(112).div(100)
            const collateralInMim = deltaMimWithPermium.mul(price).div(getBigNumber(1,18)).div(roundingFactor)
            const roundedRewardBalance = rewardBalance.div(roundingFactor)
            
            expect(collateralInMim).to.be.equal(roundedRewardBalance)
        })

        it("when BAMM has sufficient funds liquidateLikeTiran should return tiran money", async function () {
            const bamm = this.BAMM
            const price = getBigNumber(11, 27);

            await this.pairHelper.run((cmd) => [
                cmd.as(this.bob).approveAsset(getBigNumber(310, 8)),
                cmd.as(this.bob).depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.borrow(sansBorrowFee(getBigNumber(75, 8))),
                cmd.accrue(),
                cmd.do(this.oracle.set, price.toString()),
                cmd.updateExchangeRate(),
                cmd.do(this.bentoBox.connect(this.bob).deposit, this.b.address, this.bob.address, this.bob.address, getBigNumber(20, 8), 0),
                cmd.do(this.pairHelper.contract.connect(this.bob).removeAsset, this.bob.address, getBigNumber(50, 8)),
            ])

            await bamm.setParams(20, 0, 100)

            // deposit
            const liquidationShare = await this.pairHelper.contract.userBorrowPart(this.alice.address) //getBigNumber(20, 18);
            const liquidationAmount = (await toAmount(this, this.b.address, liquidationShare)).add(11)

            // making sure bamm has sufficient funds
            const depositAmonut = liquidationAmount
            await this.b.connect(this.bob).approve(this.bentoBox.address, depositAmonut);
            await this.bentoBox.connect(this.bob).deposit(this.b.address, this.bob.address, this.bob.address, depositAmonut, 0)
            await setMasterContractApproval(this.bentoBox, this.bob, this.bob, this.bobPrivateKey, bamm.address, true)
            await bamm.connect(this.bob).deposit(depositAmonut, true);

            const bammMimBalBefore = await getBentoBoxBalance(this, this.b.address, bamm.address)
            const bobMimBalBefore = await this.b.balanceOf(this.bob.address)
            const bammColBalBefore = await getBentoBoxBalance(this, this.a.address, bamm.address)
            const pairMimBalBefore = await getBentoBoxBalance(this, this.b.address, this.pairHelper.contract.address)
            const nullAddr = "0x0000000000000000000000000000000000000000"
            const rewardAddress = "0x0000000000000000000000000000000000000007"

            // liquidate
            await this.b.connect(this.bob).approve(bamm.address, liquidationAmount);
            await bamm.connect(this.bob).liquidateLikeTiran(liquidationAmount, [this.alice.address], [liquidationShare], rewardAddress, nullAddr, false)
            const bammMimBalAfter = await getBentoBoxBalance(this, this.b.address, bamm.address)
            const bammColBalAfter = await getBentoBoxBalance(this, this.a.address, bamm.address)            
            const pairMimBalAfter = await getBentoBoxBalance(this, this.b.address, this.pairHelper.contract.address)

            const deltaMimBamm = bammMimBalBefore.sub(bammMimBalAfter)
            const deltaMimPair = pairMimBalAfter.sub(pairMimBalBefore)
            const bobMimBalAfter = await this.b.balanceOf(this.bob.address)

            const rewardBalance = await this.a.balanceOf(rewardAddress)

            // tirans funds sould be returned
            expect(bobMimBalAfter).to.be.equal(bobMimBalBefore)

            // tirans collateral should not get any collateral reward
            expect(rewardBalance).to.be.equal(0)

            // check bamm MIM makes sense
            expect(
                isEqualWithRoundingErrorFlexability(bammMimBalBefore.sub(deltaMimPair), bammMimBalAfter, 2)
            ).to.be.true
            
            const roundingFactor = getBigNumber(1, 11);
            const deltaMimWithPermium = deltaMimPair.mul(112).div(100)
            const collateralInMim = deltaMimWithPermium.mul(price).div(getBigNumber(1,18)).div(roundingFactor)
            const roundedBammCollBalance = bammColBalAfter.div(roundingFactor)
    
            expect(bammColBalBefore).to.be.equal(0)
            // liquidated collateral should be in the BAMM
            expect(collateralInMim).to.be.equal(roundedBammCollBalance)
        })

        it("liquidateLikeTiran insufficent funds", async function () {
            const bamm = this.BAMM
            const price = getBigNumber(11, 27);

            // bob bento deposit setup
            const depositAmonut = getBigNumber(1000, 0)
            await this.b.connect(this.bob).approve(this.bentoBox.address, depositAmonut);
            await this.bentoBox.connect(this.bob).deposit(this.b.address, this.bob.address, this.bob.address, depositAmonut, 0)
            await setMasterContractApproval(this.bentoBox, this.bob, this.bob, this.bobPrivateKey, bamm.address, true)
            await bamm.connect(this.bob).deposit(depositAmonut, true);


            await this.pairHelper.run((cmd) => [
                cmd.as(this.bob).approveAsset(getBigNumber(310, 8)),
                cmd.as(this.bob).depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.borrow(sansBorrowFee(getBigNumber(75, 8))),
                cmd.accrue(),
                cmd.do(this.oracle.set, price.toString()),
                cmd.updateExchangeRate(),
                cmd.do(this.bentoBox.connect(this.bob).deposit, this.b.address, this.bob.address, this.bob.address, getBigNumber(20, 8), 0),
                cmd.do(this.pairHelper.contract.connect(this.bob).removeAsset, this.bob.address, getBigNumber(50, 8)),
            ])

            await bamm.setParams(20, 0, 100)

            // deposit
            const liquidationShare = await this.pairHelper.contract.userBorrowPart(this.alice.address) //getBigNumber(20, 18);
            const liquidationAmount = getBigNumber(1, 4)//(await toAmount(this, this.b.address, liquidationShare)).add(11)
            const nullAddr = "0x0000000000000000000000000000000000000000"
            const rewardAddress = "0x0000000000000000000000000000000000000007"

            await this.b.connect(this.bob).approve(bamm.address, liquidationAmount);
            await expect(
                bamm.connect(this.bob)
                    .liquidateLikeTiran(liquidationAmount, [this.alice.address], [liquidationShare], rewardAddress, nullAddr, false)
            ).to.be.revertedWith('BoringMath: Underflow')
        })

        it("liquidateLikeTiran tiran calims to provide all funds but provides half", async function () {
            const bamm = this.BAMM
            const price = getBigNumber(11, 27);
            const halfTheLiquidationAmount = getBigNumber(7500000027, 0).div(2)
            // bob bento deposit setup
            const depositAmonut = halfTheLiquidationAmount
            await this.b.connect(this.bob).approve(this.bentoBox.address, depositAmonut);
            await this.bentoBox.connect(this.bob).deposit(this.b.address, this.bob.address, this.bob.address, depositAmonut, 0)
            await setMasterContractApproval(this.bentoBox, this.bob, this.bob, this.bobPrivateKey, bamm.address, true)
            await bamm.connect(this.bob).deposit(depositAmonut, true);


            await this.pairHelper.run((cmd) => [
                cmd.as(this.bob).approveAsset(getBigNumber(310, 8)),
                cmd.as(this.bob).depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.borrow(sansBorrowFee(getBigNumber(75, 8))),
                cmd.accrue(),
                cmd.do(this.oracle.set, price.toString()),
                cmd.updateExchangeRate(),
                cmd.do(this.bentoBox.connect(this.bob).deposit, this.b.address, this.bob.address, this.bob.address, getBigNumber(20, 8), 0),
                cmd.do(this.pairHelper.contract.connect(this.bob).removeAsset, this.bob.address, getBigNumber(50, 8)),
            ])

            await bamm.setParams(20, 0, 100)

            // deposit
            const liquidationShare = await this.pairHelper.contract.userBorrowPart(this.alice.address) //getBigNumber(20, 18);
            const liquidationAmount = halfTheLiquidationAmount
            const nullAddr = "0x0000000000000000000000000000000000000000"
            const rewardAddress = "0x0000000000000000000000000000000000000007"

            await this.b.connect(this.bob).approve(bamm.address, liquidationAmount);
            await expect(
                bamm.connect(this.bob)
                    .liquidateLikeTiran(liquidationAmount, [this.alice.address], [liquidationShare], rewardAddress, nullAddr, false)
            ).to.be.revertedWith('liquidateLikeTiran: insufficent extraMim')
        })
    })

    describe.only("Liquidate", function () {

        it("should not allow open liquidate yet", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.as(this.bob).approveAsset(getBigNumber(310, 8)),
                cmd.as(this.bob).depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.borrow(sansBorrowFee(getBigNumber(75, 8))),
                cmd.accrue(),
                cmd.do(this.bentoBox.connect(this.bob).deposit, this.b.address, this.bob.address, this.bob.address, getBigNumber(20, 8), 0),
            ])

            await expect(
                this.pairHelper.contract
                    .connect(this.bob)
                    .liquidate([this.alice.address], [getBigNumber(20, 8)], this.bob.address, "0x0000000000000000000000000000000000000000", true)
            ).to.be.revertedWith("KashiPair: all are solvent")
        })

        it("should allow open liquidate", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.as(this.bob).approveAsset(getBigNumber(310, 8)),
                cmd.as(this.bob).depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.borrow(sansBorrowFee(getBigNumber(75, 8))),
                cmd.accrue(),
                cmd.do(this.oracle.set, "11000000000000000000000000000"),
                cmd.updateExchangeRate(),
                cmd.do(this.bentoBox.connect(this.bob).deposit, this.b.address, this.bob.address, this.bob.address, getBigNumber(20, 8), 0),
                cmd.do(this.pairHelper.contract.connect(this.bob).removeAsset, this.bob.address, getBigNumber(50, 8)),
            ])
            await this.pairHelper.contract
                .connect(this.bob)
                .liquidate([this.alice.address], [getBigNumber(20, 8)], this.bob.address, "0x0000000000000000000000000000000000000000", true)
        })

        it("should not allow liquidate for non b.protocol", async function () {
            //await this.BkashiPair.setBProtocol(this.bob.address)
            //console.log(this.BKashiPair)

            await this.pairHelper.contract.connect(this.alice).setBProtocolMock(this.alice.address)

            await this.pairHelper.run((cmd) => [
                cmd.as(this.bob).approveAsset(getBigNumber(310, 8)),
                cmd.as(this.bob).depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.borrow(sansBorrowFee(getBigNumber(75, 8))),
                cmd.accrue(),
                cmd.do(this.oracle.set, "11000000000000000000000000000"),
                cmd.updateExchangeRate(),
                cmd.do(this.bentoBox.connect(this.bob).deposit, this.b.address, this.bob.address, this.bob.address, getBigNumber(20, 8), 0),
                cmd.do(this.pairHelper.contract.connect(this.bob).removeAsset, this.bob.address, getBigNumber(50, 8)),
            ])
            await expect(
                this.pairHelper.contract
                .connect(this.bob)
                .liquidate([this.alice.address], [getBigNumber(20, 8)], this.bob.address, "0x0000000000000000000000000000000000000000", true)
            ).to.be.revertedWith("liquidate: not bprotocol")
        })        

        it("should allow open liquidate with swapper", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.as(this.bob).approveAsset(getBigNumber(310, 8)),
                cmd.as(this.bob).depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.borrow(sansBorrowFee(getBigNumber(75, 8))),
                cmd.accrue(),
                cmd.do(this.oracle.set, "11000000000000000000000000000"),
                cmd.updateExchangeRate(),
                cmd.do(this.bentoBox.connect(this.bob).deposit, this.b.address, this.bob.address, this.bob.address, getBigNumber(20, 8), 0),
            ])
            await expect(
                this.pairHelper.contract
                    .connect(this.bob)
                    .liquidate([this.alice.address], [getBigNumber(20, 8)], this.swapper.address, this.swapper.address, true)
            )
                .to.emit(this.pairHelper.contract, "LogRemoveCollateral")
                .to.emit(this.pairHelper.contract, "LogRepay")
        })

        it("should allow closed liquidate", async function () {
            await this.pairHelper.run((cmd) => [
                // Bob adds 290 asset amount (145 shares)
                cmd.as(this.bob).approveAsset(getBigNumber(310, 8)),
                cmd.as(this.bob).depositAsset(getBigNumber(290, 8)),
                // Alice adds 100 collateral amount (76 shares)
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                // Alice borrows 75 asset amount
                cmd.borrow(sansBorrowFee(getBigNumber(75, 8))),
                cmd.accrue(),
                // Change oracle to put Alice into insolvency
                cmd.do(this.oracle.set, "11000000000000000000000000000"),
                //cmd.do(this.a.transfer, this.sushiSwapPair.address, getBigNumber(500)),
                //cmd.do(this.sushiSwapPair.sync),
                cmd.updateExchangeRate(),
            ])

            // Bob liquidates Alice for 20 asset parts (approx 20 asset amount = 10 asset shares)
            await this.pairHelper.contract
                .connect(this.bob)
                .liquidate([this.alice.address], [getBigNumber(20, 8)], this.swapper.address, this.swapper.address, false)
        })

        it("should not allow closed liquidate with invalid swapper", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.as(this.bob).approveAsset(getBigNumber(340, 8)),
                cmd.as(this.bob).depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.borrow(sansBorrowFee(getBigNumber(75, 8))),
                cmd.accrue(),
            ])

            await cmd.deploy(
                "invalidSwapper",
                "SushiSwapSwapper",
                this.bentoBox.address,
                this.factory.address,
                await this.factory.pairCodeHash()
            )
            await expect(
                this.pairHelper.contract
                    .connect(this.bob)
                    .liquidate([this.alice.address], [getBigNumber(20, 8)], this.invalidSwapper.address, this.invalidSwapper.address, false)
            ).to.be.revertedWith("KashiPair: Invalid swapper")
        })

    })

    describe("Withdraw Fees", function () {
        it("should allow to withdraw fees", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.approveAsset(getBigNumber(700, 8)),
                cmd.depositAsset(getBigNumber(290, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.borrow(sansBorrowFee(getBigNumber(75, 8))),
                cmd.repay(getBigNumber(50, 8)),
            ])
            await expect(this.pairHelper.contract.withdrawFees()).to.emit(this.pairHelper.contract, "LogWithdrawFees")
        })

        it("should emit events even if dev fees are empty", async function () {
            await this.pairHelper.run((cmd) => [
                cmd.approveAsset(getBigNumber(900, 8)),
                cmd.approveCollateral(getBigNumber(100)),
                cmd.depositAsset(getBigNumber(290, 8)),
                cmd.depositCollateral(getBigNumber(100)),
                cmd.borrow(sansBorrowFee(getBigNumber(75, 8))),
                cmd.accrue(),
                cmd.do(this.oracle.set, "11000000000000000000000000000"),
                cmd.updateExchangeRate(),
            ])

            let part = await this.pairHelper.contract.userBorrowPart(this.alice.address)

            await this.pairHelper.run((cmd) => [cmd.repay(part)])
            await this.pairHelper.contract.withdrawFees()
            await expect(this.pairHelper.contract.withdrawFees()).to.emit(this.pairHelper.contract, "LogWithdrawFees")
        })
    })

    describe("Set Fee To", function () {
        it("Mutates fee to", async function () {
            console.log(this.BkashiPair.address, this.pairHelper.contract.address)
            await this.BkashiPair.setFeeTo(this.bob.address)
            expect(await this.BkashiPair.feeTo()).to.be.equal(this.bob.address)
            expect(await this.pairHelper.contract.feeTo()).to.be.equal(ADDRESS_ZERO)
        })

        it("Emit LogFeeTo event if dev attempts to set fee to", async function () {
            await expect(this.BkashiPair.setFeeTo(this.bob.address)).to.emit(this.BkashiPair, "LogFeeTo").withArgs(this.bob.address)
        })

        it("Reverts if non-owner attempts to set fee to", async function () {
            await expect(this.BkashiPair.connect(this.bob).setFeeTo(this.bob.address)).to.be.revertedWith("caller is not the owner")
            await expect(this.pairHelper.contract.connect(this.bob).setFeeTo(this.bob.address)).to.be.revertedWith("caller is not the owner")
        })
    })
})