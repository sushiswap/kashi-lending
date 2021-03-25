const _ = require("lodash")
const { expect } = require("chai")
const { prepare, getBigNumber, createFixture } = require("@sushiswap/hardhat-framework")

let cmd, fixture

describe("SushiSwapOneHopSwapper", function () {
    before(async function () {
        fixture = await createFixture(deployments, this, async (cmd) => {
            const pairCodeHash = await this.factory.pairCodeHash()

            await cmd.addToken("a", "Token A", "A", 18, this.ReturnFalseERC20Mock)
            await cmd.addToken("b", "Token B", "B", 8, this.RevertingERC20Mock)
            await cmd.addToken("c", "Token C", "C", 12, this.RevertingERC20Mock)

            await cmd.deploy("weth9", "WETH9Mock")
            await cmd.deploy("bentoBox", "BentoBoxMock", this.weth9.address)

            // One swapper per possible intermediate token, called
            //
            //  swapperA, swapperB, swapperC
            //
            for (const letter of ["a", "b", "c"]) {
                await cmd.deploy(
                    `swapper${letter.toUpperCase()}`,
                    "SushiSwapOneHopSwapper",
                    this.bentoBox.address,
                    this.factory.address,
                    pairCodeHash,
                    this[letter].address
                )
            }
        })
    })

    beforeEach(async function () {
        cmd = await fixture()
    })

    describe("Swap - Hardcoded", function () {
        it("should swap", async function () {
            // Fully hardcoded case as a sanity check.
            //
            // We swap A (18 digits) to C (12 digits) via B (8 digits).
            // Liquidity is always 50_000 * 10^n, for n-digit tokens.
            // We are trading 20 * 10^18 A, and therefore expect to end up with
            // a little less than 20 * 10^12 C.
            //
            // The formulas for "amount out" and "amount in", which can be
            // derived from the Uniswap AMM "xy=k" rule, are:
            //
            //      in   >=  1000 * X * out / (997 * (Y - out))
            //
            //      out  <=    Y * in * 997 / (1000 * X + in * 997)
            //
            // where we want "out" tokens out of pile Y, in exchange for
            // adding "in" tokens onto pile X.
            //
            // First we swap 20e18 "in" of A for B. The reserves are:
            //
            //                          A = 50_000e18
            //                          B = 50_000e8
            //
            // out <= 50_000e8 * 20e18 * 997 / (1000 * 50_000e18 + 20e18 * 997)
            //      = 1_000_000e26 * 997 / (50_000_000e18 + 20e18 * 997)
            //      = 1_000_000e8  * 997 / (50_000_000 + 20 * 997)
            //      = 1e8  * 997_000_000 / (50_000_000 + 19_940)
            //      =             997e14 / 50_019_940
            //      = 1993205109.802211...
            //
            // We round down to get the greatest integer that satisfies that
            // inequality, so we expect to receive
            //
            //                      1_993_205_109
            //
            // of token B. We then trade these in for C's. The calculation is
            // a bit messier and we will need a calculator sooner:
            //
            //              C = 50_000e12
            //
            //           out <= 50_000e12 * n / (1000 * 50_000e8 + n)
            //
            // where
            //
            //              n =     1_993_205_109 * 997
            //                = 1_987_225_493_673,
            //
            // giving
            //
            // out <= 5e16 * 1_987_225_493_673 / (5e15 + 1_987_225_493_673)
            //      = 5e16 * 1_987_225_493_673 / 5_001_987_225_493_673
            //      = 19864359944230.664
            //
            // which rounds down to
            //
            //                  19_864_359_944_230
            //
            // of token C. As a sanity check, taking into consideration the
            // number of digits it is close to 20, but less so than the amount
            // of the intermediate token.
            //
            //
            await cmd.addPair("sushiSwapPairAB", this.a, this.b, 50_000, 50_000)
            await cmd.addPair("sushiSwapPairBC", this.b, this.c, 50_000, 50_000)

            await this.a.approve(this.bentoBox.address, getBigNumber(100))
            await this.bentoBox.deposit(this.a.address, this.alice.address, this.alice.address, getBigNumber(100), 0)
            await this.bentoBox.transfer(this.a.address, this.alice.address, this.swapperB.address, getBigNumber(20))
            await expect(this.swapperB.swap(this.a.address, this.c.address, this.alice.address, 0, getBigNumber(20)))
                .to.emit(this.a, "Transfer")
                .withArgs(this.bentoBox.address, this.sushiSwapPairAB.address, 20_000_000_000_000_000_000n)
                .to.emit(this.bentoBox, "LogWithdraw")
                .withArgs(
                    this.a.address,
                    this.swapperB.address,
                    this.sushiSwapPairAB.address,
                    20_000_000_000_000_000_000n,
                    20_000_000_000_000_000_000n
                )
                .to.emit(this.b, "Transfer")
                .withArgs(this.sushiSwapPairAB.address, this.sushiSwapPairBC.address, 1_993_205_109n)
                .to.emit(this.c, "Transfer")
                .withArgs(this.sushiSwapPairBC.address, this.bentoBox.address, 19_864_359_944_230n)
                .to.emit(this.bentoBox, "LogDeposit")
                .withArgs(this.c.address, this.bentoBox.address, this.alice.address, 19_864_359_944_230n, 19_864_359_944_230n)
        })

        it("should swap with minimum set", async function () {
            await cmd.addPair("sushiSwapPairAB", this.a, this.b, 50_000, 50_000)
            await cmd.addPair("sushiSwapPairBC", this.b, this.c, 50_000, 50_000)

            await this.a.approve(this.bentoBox.address, getBigNumber(100))
            await this.bentoBox.deposit(this.a.address, this.alice.address, this.alice.address, getBigNumber(100), 0)
            await this.bentoBox.transfer(this.a.address, this.alice.address, this.swapperB.address, getBigNumber(20))
            await expect(this.swapperB.swap(this.a.address, this.c.address, this.alice.address, 19_864_359_944_230n, getBigNumber(20)))
                .to.emit(this.a, "Transfer")
                .withArgs(this.bentoBox.address, this.sushiSwapPairAB.address, 20_000_000_000_000_000_000n)
                .to.emit(this.bentoBox, "LogWithdraw")
                .withArgs(
                    this.a.address,
                    this.swapperB.address,
                    this.sushiSwapPairAB.address,
                    20_000_000_000_000_000_000n,
                    20_000_000_000_000_000_000n
                )
                .to.emit(this.b, "Transfer")
                .withArgs(this.sushiSwapPairAB.address, this.sushiSwapPairBC.address, 1_993_205_109n)
                .to.emit(this.c, "Transfer")
                .withArgs(this.sushiSwapPairBC.address, this.bentoBox.address, 19_864_359_944_230n)
                .to.emit(this.bentoBox, "LogDeposit")
                .withArgs(this.c.address, this.bentoBox.address, this.alice.address, 19_864_359_944_230n, 19_864_359_944_230n)
        })

        it("should not swap with minimum not met", async function () {
            await cmd.addPair("sushiSwapPairAB", this.a, this.b, 50_000, 50_000)
            await cmd.addPair("sushiSwapPairBC", this.b, this.c, 50_000, 50_000)

            await this.a.approve(this.bentoBox.address, getBigNumber(100))
            await this.bentoBox.deposit(this.a.address, this.alice.address, this.alice.address, getBigNumber(100), 0)
            await this.bentoBox.transfer(this.a.address, this.alice.address, this.swapperB.address, getBigNumber(20))
            await expect(
                this.swapperB.swap(this.a.address, this.c.address, this.alice.address, 19_864_359_944_231n, getBigNumber(20))
            ).to.be.revertedWith("BoringMath: Underflow")
        })

        it("should swap in opposite direction", async function () {
            // Token A: 18 decimals
            // Token B: 8 decimals
            // Token C: 12 decimals
            //
            // C -> B:
            //
            //       in  = 20e12
            //      out <= B * in * 997 / (1000 * C + in * 997)
            //           = 50_000e8 * 20e12 * 997 / (1000 * 50_000e12 + 20e12 * 997)
            //           = 50_000e8 * 20    * 997 / (1000 * 50_000    + 20    * 997)
            //           =                 997e14 / 50_019_940
            //           = 1_993_205_109.802211...
            //
            // The next step is again similar, but we get more digits:
            //
            // B -> A:
            //
            //      in  = 1_993_205_109
            //     out <= A * in * 997 / (1000 * B + in * 997)
            //          = 50_000e18 * n / (1000 * 50_000e8 + n)
            //
            // where, as before,
            //
            //                      n = in * 997
            //                        = 1_987_225_493_673
            // so that
            //
            // out <= 5e22 * 1_987_225_493_673 / (5e15 + 1_987_225_493_673)
            //      = 5e22 * 1_987_225_493_673 / 5_001_987_225_493_673
            //
            // A calculator with BigInt division gives
            //
            //                  19_864_359_944_230_665_609
            //
            await cmd.addPair("sushiSwapPairAB", this.a, this.b, 50_000, 50_000)
            await cmd.addPair("sushiSwapPairBC", this.b, this.c, 50_000, 50_000)

            await this.c.approve(this.bentoBox.address, getBigNumber(100, 12))
            await this.bentoBox.deposit(this.c.address, this.alice.address, this.alice.address, getBigNumber(100, 12), 0)
            await this.bentoBox.transfer(this.c.address, this.alice.address, this.swapperB.address, getBigNumber(20, 12))
            await expect(this.swapperB.swap(this.c.address, this.a.address, this.alice.address, 0, getBigNumber(20, 12)))
                .to.emit(this.c, "Transfer")
                .withArgs(this.bentoBox.address, this.sushiSwapPairBC.address, 20_000_000_000_000n)
                .to.emit(this.bentoBox, "LogWithdraw")
                .withArgs(this.c.address, this.swapperB.address, this.sushiSwapPairBC.address, 20_000_000_000_000n, 20_000_000_000_000n)
                .to.emit(this.b, "Transfer")
                .withArgs(this.sushiSwapPairBC.address, this.sushiSwapPairAB.address, 1_993_205_109n)
                .to.emit(this.a, "Transfer")
                .withArgs(this.sushiSwapPairAB.address, this.bentoBox.address, 19_864_359_944_230_665_609n)
                .to.emit(this.bentoBox, "LogDeposit")
                .withArgs(this.a.address, this.bentoBox.address, this.alice.address, 19_864_359_944_230_665_609n, 19_864_359_944_230_665_609n)
        })

        it("should swap in opposite direction with minimum set", async function () {
            await cmd.addPair("sushiSwapPairAB", this.a, this.b, 50_000, 50_000)
            await cmd.addPair("sushiSwapPairBC", this.b, this.c, 50_000, 50_000)

            await this.c.approve(this.bentoBox.address, getBigNumber(100, 12))
            await this.bentoBox.deposit(this.c.address, this.alice.address, this.alice.address, getBigNumber(100, 12), 0)
            await this.bentoBox.transfer(this.c.address, this.alice.address, this.swapperB.address, getBigNumber(20, 12))
            await expect(
                this.swapperB.swap(this.c.address, this.a.address, this.alice.address, 19_864_359_944_230_665_609n, getBigNumber(20, 12))
            )
                .to.emit(this.c, "Transfer")
                .withArgs(this.bentoBox.address, this.sushiSwapPairBC.address, 20_000_000_000_000n)
                .to.emit(this.bentoBox, "LogWithdraw")
                .withArgs(this.c.address, this.swapperB.address, this.sushiSwapPairBC.address, 20_000_000_000_000n, 20_000_000_000_000n)
                .to.emit(this.b, "Transfer")
                .withArgs(this.sushiSwapPairBC.address, this.sushiSwapPairAB.address, 1_993_205_109n)
                .to.emit(this.a, "Transfer")
                .withArgs(this.sushiSwapPairAB.address, this.bentoBox.address, 19_864_359_944_230_665_609n)
                .to.emit(this.bentoBox, "LogDeposit")
                .withArgs(this.a.address, this.bentoBox.address, this.alice.address, 19_864_359_944_230_665_609n, 19_864_359_944_230_665_609n)
        })

        it("should not swap in opposite direction with minimum not met", async function () {
            await cmd.addPair("sushiSwapPairAB", this.a, this.b, 50_000, 50_000)
            await cmd.addPair("sushiSwapPairBC", this.b, this.c, 50_000, 50_000)

            await this.c.approve(this.bentoBox.address, getBigNumber(100, 12))
            await this.bentoBox.deposit(this.c.address, this.alice.address, this.alice.address, getBigNumber(100, 12), 0)
            await this.bentoBox.transfer(this.c.address, this.alice.address, this.swapperB.address, getBigNumber(20, 12))
            await expect(
                this.swapperB.swap(this.c.address, this.a.address, this.alice.address, 19_864_359_944_230_665_610n, getBigNumber(20))
            ).to.be.revertedWith("BoringMath: Underflow")
        })

        it("should swap with different reserve and decimals ratios", async function () {
            // Use A as the middle token, for no particular reason
            //
            // Token A: 18 decimals
            // Token B: 8 decimals
            // Token C: 12 decimals

            // We swap one B (1e8 base units) to C, via A.
            //
            // B -> A:
            //
            // A = 1_000e18 = 1e21
            // B = 2_000e8  = 2e11
            //
            //      out <=    A * in  * 997 / (1000 * B + in  * 997)
            //           = 1e21 * 1e8 * 997 / (2e14     + 1e8 * 997)
            //           = 1e21 *       997 / (2e6      +       997)
            //           =           997e21 / 2_000_997
            //           = 498_251_621_566_649_025
            //
            // rounded down. That's 18 digits, so a bit less than half an A.
            //
            // A -> C:
            //
            // A = 100e18 = 1e20
            // C =          1e12
            //
            // in * 997 =     498_251_621_566_649_025 * 997
            //          = 496_756_866_701_949_077_925           =: N
            //
            //      out <=    C * in * 997 / (1000 * A + in * 997)
            //           = 1e12 * N        / (1e23     + N)
            //           = 4_943_013_906
            //
            // rounded down. That's about 0.5% of a 12-decimal token, or 1/100
            // of 1/2, as expected per the ratios, and it is further off than
            // the intermediate number.
            //
            await cmd.addPair("sushiSwapPairAB", this.a, this.b, 1_000, 2_000)
            await cmd.addPair("sushiSwapPairAC", this.a, this.c, 100, 1)

            await this.b.approve(this.bentoBox.address, getBigNumber(100))
            await this.bentoBox.deposit(this.b.address, this.alice.address, this.alice.address, getBigNumber(100, 8), 0)
            await this.bentoBox.transfer(this.b.address, this.alice.address, this.swapperA.address, getBigNumber(1, 8))
            await expect(this.swapperA.swap(this.b.address, this.c.address, this.alice.address, 0, getBigNumber(1, 8)))
                .to.emit(this.b, "Transfer")
                .withArgs(this.bentoBox.address, this.sushiSwapPairAB.address, 100_000_000n)
                .to.emit(this.bentoBox, "LogWithdraw")
                .withArgs(this.b.address, this.swapperA.address, this.sushiSwapPairAB.address, 100_000_000n, 100_000_000n)
                .to.emit(this.a, "Transfer")
                .withArgs(this.sushiSwapPairAB.address, this.sushiSwapPairAC.address, 498_251_621_566_649_025n)
                .to.emit(this.c, "Transfer")
                .withArgs(this.sushiSwapPairAC.address, this.bentoBox.address, 4_943_013_906n)
                .to.emit(this.bentoBox, "LogDeposit")
                .withArgs(this.c.address, this.bentoBox.address, this.alice.address, 4_943_013_906n, 4_943_013_906n)
        })
    })

    describe("Swap Exact - Hardcoded", function () {
        it("should swap exact", async function () {
            // Token A: 18 decimals
            // Token B: 8 decimals
            // Token C: 12 decimals
            //
            // Alice transfers 30 of token A to the swapper, and wants 20 of
            // token C. Any A's left after that should go to Bob.
            //
            // B -> C:
            //
            // in >= 1000 * B        * out   / (997 * (C         - out))
            //     = 1000 * 50_000e8 * 20e12 / (997 * (50_000e12 - 20e12))
            //     =        5e15     * 20e12 / (997 * 49_980e12)
            //     =                    1e29 / (49_980_000 - 149_940)e12
            //     =                    1e17 /  49_830_060
            //     =                    1e16 /   4_983_006
            //
            // This clearly does not divide evenly; we round up to satisfy the
            // inequality. A calculator gives
            //
            //                          2_006_820_783
            //
            // A -> B:
            //
            // 1000 * A = 1000 * 50_000e18
            //          = 5e25
            //
            //        B = 50_000e8
            //          = 5e12
            //
            // in >= 1000 * A * out           / (997 * (B - out))
            //     =     5e25 * 2_006_820_783 / (997 * (5e12 - 2_006_820_783))
            //
            // Rounded up, this comes to
            //
            //                   20_136_675_750_711_909_650
            //
            // We deposited 30 tokens; the change, going to Bob, is
            //
            //                    9_863_324_249_288_090_350
            //
            await cmd.addPair("sushiSwapPairAB", this.a, this.b, 50_000, 50_000)
            await cmd.addPair("sushiSwapPairBC", this.b, this.c, 50_000, 50_000)

            await this.a.approve(this.bentoBox.address, getBigNumber(100))
            await this.bentoBox.deposit(this.a.address, this.alice.address, this.alice.address, getBigNumber(100), 0)
            await this.bentoBox.transfer(this.a.address, this.alice.address, this.swapperB.address, getBigNumber(30))
            await expect(
                this.swapperB.swapExact(
                    this.a.address,
                    this.c.address,
                    this.alice.address,
                    this.bob.address,
                    getBigNumber(30),
                    getBigNumber(20, 12)
                )
            )
                .to.emit(this.a, "Transfer")
                .withArgs(this.bentoBox.address, this.sushiSwapPairAB.address, 20_136_675_750_711_909_650n)
                .to.emit(this.bentoBox, "LogWithdraw")
                .withArgs(
                    this.a.address,
                    this.swapperB.address,
                    this.sushiSwapPairAB.address,
                    20_136_675_750_711_909_650n,
                    20_136_675_750_711_909_650n
                )
                .to.emit(this.b, "Transfer")
                .withArgs(this.sushiSwapPairAB.address, this.sushiSwapPairBC.address, 2_006_820_783n)
                .to.emit(this.c, "Transfer")
                .withArgs(this.sushiSwapPairBC.address, this.bentoBox.address, 20_000_000_000_000n)
                .to.emit(this.bentoBox, "LogDeposit")
                .withArgs(this.c.address, this.bentoBox.address, this.alice.address, 20_000_000_000_000n, 20_000_000_000_000n)
                .to.emit(this.bentoBox, "LogTransfer")
                .withArgs(this.a.address, this.swapperB.address, this.bob.address, 9_863_324_249_288_090_350n)
        })

        it("should swap exact with exact amountIn", async function () {
            await cmd.addPair("sushiSwapPairAB", this.a, this.b, 50_000, 50_000)
            await cmd.addPair("sushiSwapPairBC", this.b, this.c, 50_000, 50_000)

            await this.a.approve(this.bentoBox.address, getBigNumber(100))
            await this.bentoBox.deposit(this.a.address, this.alice.address, this.alice.address, getBigNumber(100), 0)
            await this.bentoBox.transfer(this.a.address, this.alice.address, this.swapperB.address, 20_136_675_750_711_909_650n)
            await expect(
                this.swapperB.swapExact(
                    this.a.address,
                    this.c.address,
                    this.alice.address,
                    this.bob.address,
                    20_136_675_750_711_909_650n,
                    getBigNumber(20, 12)
                )
            )
                .to.emit(this.a, "Transfer")
                .withArgs(this.bentoBox.address, this.sushiSwapPairAB.address, 20_136_675_750_711_909_650n)
                .to.emit(this.bentoBox, "LogWithdraw")
                .withArgs(
                    this.a.address,
                    this.swapperB.address,
                    this.sushiSwapPairAB.address,
                    20_136_675_750_711_909_650n,
                    20_136_675_750_711_909_650n
                )
                .to.emit(this.b, "Transfer")
                .withArgs(this.sushiSwapPairAB.address, this.sushiSwapPairBC.address, 2_006_820_783n)
                .to.emit(this.c, "Transfer")
                .withArgs(this.sushiSwapPairBC.address, this.bentoBox.address, 20_000_000_000_000n)
                .to.emit(this.bentoBox, "LogDeposit")
                .withArgs(this.c.address, this.bentoBox.address, this.alice.address, 20_000_000_000_000n, 20_000_000_000_000n)
        })

        it("should not swap exact with not enough amountIn", async function () {
            await cmd.addPair("sushiSwapPairAB", this.a, this.b, 50_000, 50_000)
            await cmd.addPair("sushiSwapPairBC", this.b, this.c, 50_000, 50_000)

            await this.a.approve(this.bentoBox.address, getBigNumber(100))
            await this.bentoBox.deposit(this.a.address, this.alice.address, this.alice.address, getBigNumber(100), 0)
            await this.bentoBox.transfer(this.a.address, this.alice.address, this.swapperB.address, 20_136_675_750_711_909_649n)
            await expect(
                this.swapperB.swapExact(
                    this.a.address,
                    this.c.address,
                    this.alice.address,
                    this.bob.address,
                    20_136_675_750_711_909_649n,
                    getBigNumber(20, 12)
                )
            ).to.be.revertedWith("BoringMath: Underflow")
        })

        it("should swap exact in opposite direction", async function () {
            // Token A: 18 decimals
            // Token B: 8 decimals
            // Token C: 12 decimals
            //
            // Alice transfers 30 of token C to the swapper, and wants 20 of
            // token A. Any C's left after that should go to Bob.
            //
            // B -> A:
            //
            // in >= 1000 * B        * out   / (997 * (A         - out))
            //     = 1000 * 50_000e8 * 20e18 / (997 * (50_000e18 - 20e18))
            //     =        5e15     * 20e18 / (997 * 49_980e18)
            //     =                    1e35 / (49_980_000 - 149_940)e18
            //     =                    1e17 /  49_830_060
            //     =                    1e16 /   4_983_006
            //
            // We calculated this before; both numerator and denominator are
            // a factor 1e6 higher, to account for A's six extra decimals.
            //
            //                      2_006_820_783
            //
            // C -> B:
            //
            // 1000 * C = 1000 * 50_000e12
            //          = 5e19
            //
            //        B = 50_000e8
            //          = 5e12
            //
            // in >= 1000 * C * out           / (997 * (B - out))
            //     =     5e19 * 2_006_820_783 / (997 * (5e12 - 2_006_820_783))
            //
            // Again, the calculations here are simpler, in that we've done
            // them before. This time, the only difference is a factor 5e19 in
            // the numerator, vs. the 5e25 we had in the "A -> C" case.
            // We take that number, chop off six digits and round up:
            //
            //                    20_136_675_750_712
            //
            // We deposited 30 tokens; the change, going to Bob, is
            //
            //                     9_863_324_249_288
            //
            await cmd.addPair("sushiSwapPairAB", this.a, this.b, 50_000, 50_000)
            await cmd.addPair("sushiSwapPairBC", this.b, this.c, 50_000, 50_000)

            await this.c.approve(this.bentoBox.address, getBigNumber(100))
            await this.bentoBox.deposit(this.c.address, this.alice.address, this.alice.address, getBigNumber(100, 12), 0)
            await this.bentoBox.transfer(this.c.address, this.alice.address, this.swapperB.address, getBigNumber(30, 12))
            await expect(
                this.swapperB.swapExact(
                    this.c.address,
                    this.a.address,
                    this.alice.address,
                    this.bob.address,
                    getBigNumber(30, 12),
                    getBigNumber(20)
                )
            )
                .to.emit(this.c, "Transfer")
                .withArgs(this.bentoBox.address, this.sushiSwapPairBC.address, 20_136_675_750_712n)
                .to.emit(this.bentoBox, "LogWithdraw")
                .withArgs(this.c.address, this.swapperB.address, this.sushiSwapPairBC.address, 20_136_675_750_712n, 20_136_675_750_712n)
                .to.emit(this.b, "Transfer")
                .withArgs(this.sushiSwapPairBC.address, this.sushiSwapPairAB.address, 2_006_820_783n)
                .to.emit(this.a, "Transfer")
                .withArgs(this.sushiSwapPairAB.address, this.bentoBox.address, 20_000_000_000_000_000_000n)
                .to.emit(this.bentoBox, "LogDeposit")
                .withArgs(this.a.address, this.bentoBox.address, this.alice.address, 20_000_000_000_000_000_000n, 20_000_000_000_000_000_000n)
                .to.emit(this.bentoBox, "LogTransfer")
                .withArgs(this.c.address, this.swapperB.address, this.bob.address, 9_863_324_249_288n)
        })

        it("should swap exact in opposite direction with exact AmountIn", async function () {
            await cmd.addPair("sushiSwapPairAB", this.a, this.b, 50_000, 50_000)
            await cmd.addPair("sushiSwapPairBC", this.b, this.c, 50_000, 50_000)

            await this.c.approve(this.bentoBox.address, getBigNumber(100))
            await this.bentoBox.deposit(this.c.address, this.alice.address, this.alice.address, getBigNumber(100, 12), 0)
            await this.bentoBox.transfer(this.c.address, this.alice.address, this.swapperB.address, getBigNumber(30, 12))
            await expect(
                this.swapperB.swapExact(
                    this.c.address,
                    this.a.address,
                    this.alice.address,
                    this.bob.address,
                    20_136_675_750_712n,
                    getBigNumber(20)
                )
            )
                .to.emit(this.c, "Transfer")
                .withArgs(this.bentoBox.address, this.sushiSwapPairBC.address, 20_136_675_750_712n)
                .to.emit(this.bentoBox, "LogWithdraw")
                .withArgs(this.c.address, this.swapperB.address, this.sushiSwapPairBC.address, 20_136_675_750_712n, 20_136_675_750_712n)
                .to.emit(this.b, "Transfer")
                .withArgs(this.sushiSwapPairBC.address, this.sushiSwapPairAB.address, 2_006_820_783n)
                .to.emit(this.a, "Transfer")
                .withArgs(this.sushiSwapPairAB.address, this.bentoBox.address, 20_000_000_000_000_000_000n)
                .to.emit(this.bentoBox, "LogDeposit")
                .withArgs(this.a.address, this.bentoBox.address, this.alice.address, 20_000_000_000_000_000_000n, 20_000_000_000_000_000_000n)
        })

        it("should not swap exact in opposite direction with not enough amountIn", async function () {
            await cmd.addPair("sushiSwapPairAB", this.a, this.b, 50_000, 50_000)
            await cmd.addPair("sushiSwapPairBC", this.b, this.c, 50_000, 50_000)

            await this.c.approve(this.bentoBox.address, getBigNumber(100))
            await this.bentoBox.deposit(this.c.address, this.alice.address, this.alice.address, getBigNumber(100, 12), 0)
            await this.bentoBox.transfer(this.c.address, this.alice.address, this.swapperB.address, 20_136_675_750_711n)
            await expect(
                this.swapperB.swapExact(
                    this.c.address,
                    this.a.address,
                    this.alice.address,
                    this.bob.address,
                    20_136_675_750_711n,
                    getBigNumber(20)
                )
            ).to.be.revertedWith("BoringMath: Underflow")
        })
    })

    describe("Swap - Automated", function () {
        // The arguments given to the `swap` function on SushiSwap pairs,
        // as well as the address of the pair contract, depend on which
        // token address compares lower as a 160-bit number.
        //
        const triples = ["abc", "acb", "bac", "bca", "cab", "cba"]

        // Note that Alice gets a bit under 1e6 of each "base" token;
        // the TOTAL reserves given to each token must fit
        const reserves = [
            {
                AB: { A: 50_000n, B: 50_000n },
                AC: { A: 50_000n, C: 50_000n },
                BC: { B: 50_000n, C: 50_000n },
            },
            {
                AB: { A: 1_000n, B: 2_000n },
                AC: { A: 100_000n, C: 1_000n },
                BC: { B: 350_000n, C: 54_321n },
            },
            {
                AB: { A: 314_159n, B: 271_828n },
                AC: { A: 141_421n, C: 693_147n },
                BC: { B: 618n, C: 161_803n },
            },
        ]
        const decimalFactors = {
            A: 1_000_000_000_000_000_000n,
            B: 100_000_000n,
            C: 1_000_000_000_000n,
        }

        triples.forEach((triple) =>
            reserves.forEach((res) => {
                // Letters
                const [f, m, t] = triple.split("")
                const [F, M, T] = triple.toUpperCase().split("")

                // Pairs and reserves
                const FM = F < M ? `${F}${M}` : `${M}${F}`
                const MT = M < T ? `${M}${T}` : `${T}${M}`
                const resFromMiddleX = res[FM][F]
                const resFromMiddleY = res[FM][M]
                const resMiddleToX = res[MT][M]
                const resMiddleToY = res[MT][T]

                // Decimals
                const [dFrom, dMiddle, dTo] = [F, M, T].map((k) => decimalFactors[k])

                const setup = async (self) => {
                    // Tokens
                    const from = self[f]
                    const middle = self[m]
                    const to = self[t]

                    await cmd.addPair("pairFM", from, middle, resFromMiddleX, resFromMiddleY)
                    await cmd.addPair("pairMT", middle, to, resMiddleToX, resMiddleToY)

                    const swapper = self[`swapper${M}`]

                    return { from, middle, to, swapper }
                }

                // For swap
                //
                // Trade in `amountTraded` for some amount of the other token.
                //
                // out <= Y * in * 997 / (1000 * X + in * 997)
                //
                // (The order is only different to make my syntax highlighter happy)
                const amountTraded = 20n * dFrom
                const swapAmountMiddle =
                    (997n * resFromMiddleY * dMiddle * amountTraded) / (1000n * resFromMiddleX * dFrom + amountTraded * 997n)
                const swapAmountTo = (997n * resMiddleToY * dTo * swapAmountMiddle) / (1000n * resMiddleToX * dMiddle + swapAmountMiddle * 997n)

                it(`should swap ${F} -> ${M} -> ${T}`, async function () {
                    const { from, middle, to, swapper } = await setup(this)

                    await from.approve(this.bentoBox.address, 100n * dFrom)
                    await this.bentoBox.deposit(from.address, this.alice.address, this.alice.address, 100n * dFrom, 0)
                    await this.bentoBox.transfer(from.address, this.alice.address, swapper.address, amountTraded)
                    await expect(swapper.swap(from.address, to.address, this.alice.address, 0, amountTraded))
                        .to.emit(from, "Transfer")
                        .withArgs(this.bentoBox.address, this.pairFM.address, amountTraded)
                        .to.emit(this.bentoBox, "LogWithdraw")
                        .withArgs(from.address, swapper.address, this.pairFM.address, amountTraded, amountTraded)
                        .to.emit(middle, "Transfer")
                        .withArgs(this.pairFM.address, this.pairMT.address, swapAmountMiddle)
                        .to.emit(to, "Transfer")
                        .withArgs(this.pairMT.address, this.bentoBox.address, swapAmountTo)
                        .to.emit(this.bentoBox, "LogDeposit")
                        .withArgs(to.address, this.bentoBox.address, this.alice.address, swapAmountTo, swapAmountTo)
                })

                it(`should swap ${F} -> ${M} -> ${T} with minimum set`, async function () {
                    const { from, middle, to, swapper } = await setup(this)

                    await from.approve(this.bentoBox.address, 100n * dFrom)
                    await this.bentoBox.deposit(from.address, this.alice.address, this.alice.address, 100n * dFrom, 0)
                    await this.bentoBox.transfer(from.address, this.alice.address, swapper.address, amountTraded)
                    await expect(swapper.swap(from.address, to.address, this.alice.address, swapAmountTo, amountTraded))
                        .to.emit(from, "Transfer")
                        .withArgs(this.bentoBox.address, this.pairFM.address, amountTraded)
                        .to.emit(this.bentoBox, "LogWithdraw")
                        .withArgs(from.address, swapper.address, this.pairFM.address, amountTraded, amountTraded)
                        .to.emit(middle, "Transfer")
                        .withArgs(this.pairFM.address, this.pairMT.address, swapAmountMiddle)
                        .to.emit(to, "Transfer")
                        .withArgs(this.pairMT.address, this.bentoBox.address, swapAmountTo)
                        .to.emit(this.bentoBox, "LogDeposit")
                        .withArgs(to.address, this.bentoBox.address, this.alice.address, swapAmountTo, swapAmountTo)
                })

                it(`should not swap ${F} -> ${M} -> ${T} with minimum not met`, async function () {
                    const { from, middle, to, swapper } = await setup(this)
                    const cutoff = swapAmountTo + 1n

                    await from.approve(this.bentoBox.address, 100n * dFrom)
                    await this.bentoBox.deposit(from.address, this.alice.address, this.alice.address, 100n * dFrom, 0)
                    await this.bentoBox.transfer(from.address, this.alice.address, swapper.address, amountTraded)
                    await expect(swapper.swap(from.address, to.address, this.alice.address, cutoff, amountTraded)).to.be.revertedWith(
                        "BoringMath: Underflow"
                    )
                })

                // For swapExact
                //
                // Trade in some amount, for `amountTraded` of the other token
                //
                // in >= 1000 * X * out / (997 * (Y - out))
                //
                // Adding 1 in the end is "optimistically" rounding up: if the
                // numerator and denominator do happen to divide evenly, then this
                // calculation is off. However, because..
                // - This is very unlikely to occur to begin with
                // - Correctly rounding up costs more gas (AFAIK)
                // - The discrepancy is on the order of 1 "wei"; less than the gas
                // ..the swapper contract does it this way as well.
                //
                // Due to some of the reserve rations given, we have to "want" a
                // considerably smaller amount than before for this to fit in
                // Alice's budget:
                const amountWanted = 123_456n
                const exactAmountMiddle = (1000n * resMiddleToX * dMiddle * amountWanted) / (997n * (resMiddleToY * dTo - amountWanted)) + 1n
                const exactAmountFrom =
                    (1000n * resFromMiddleX * dFrom * exactAmountMiddle) / (997n * (resFromMiddleY * dMiddle - exactAmountMiddle)) + 1n

                const amountProvided = 30n * dFrom
                const changeExpected = amountProvided - exactAmountFrom

                // Some (but not all) of the swapExact amounts are real edge cases,
                // when we ask for very small numbers. However, the contract
                // performs as expected.
                //
                // console.log({
                //     amountWanted,
                //     exactAmountMiddle,
                //     exactAmountFrom,
                //     amountProvided,
                //     changeExpected
                // });

                // If these fail, that is an error in the test setup, not the contract:
                if (amountWanted > resMiddleToY * dTo + 1000n) {
                    console.error({ token: T, amountWanted, reserve: resMiddleToY })
                    throw new Error("Test setup: middle-to pair lacks the reserves")
                }
                if (exactAmountMiddle > resFromMiddleY * dMiddle + 1000n) {
                    throw new Error("Test setup: from-middle pair lacks the reserves")
                }
                if (changeExpected <= 0) {
                    throw new Error("Test setup: insufficient funds provided")
                }

                it(`should swap exact ${F} -> ${M} -> ${T}`, async function () {
                    const { from, middle, to, swapper } = await setup(this)

                    await from.approve(this.bentoBox.address, amountProvided)
                    await this.bentoBox.deposit(from.address, this.alice.address, this.alice.address, amountProvided, 0)
                    await this.bentoBox.transfer(from.address, this.alice.address, swapper.address, amountProvided)
                    await expect(swapper.swapExact(from.address, to.address, this.alice.address, this.bob.address, amountProvided, amountWanted))
                        .to.emit(from, "Transfer")
                        .withArgs(this.bentoBox.address, this.pairFM.address, exactAmountFrom)
                        .to.emit(this.bentoBox, "LogWithdraw")
                        .withArgs(from.address, swapper.address, this.pairFM.address, exactAmountFrom, exactAmountFrom)
                        .to.emit(middle, "Transfer")
                        .withArgs(this.pairFM.address, this.pairMT.address, exactAmountMiddle)
                        .to.emit(to, "Transfer")
                        .withArgs(this.pairMT.address, this.bentoBox.address, amountWanted)
                        .to.emit(this.bentoBox, "LogDeposit")
                        .withArgs(to.address, this.bentoBox.address, this.alice.address, amountWanted, amountWanted)
                        .to.emit(this.bentoBox, "LogTransfer")
                        .withArgs(from.address, swapper.address, this.bob.address, changeExpected)
                })

                it(`should swap exact ${F} -> ${M} -> ${T} with just enough`, async function () {
                    const { from, middle, to, swapper } = await setup(this)

                    await from.approve(this.bentoBox.address, amountProvided)
                    await this.bentoBox.deposit(from.address, this.alice.address, this.alice.address, amountProvided, 0)
                    await this.bentoBox.transfer(from.address, this.alice.address, swapper.address, exactAmountFrom)
                    await expect(
                        swapper.swapExact(from.address, to.address, this.alice.address, this.bob.address, exactAmountFrom, amountWanted)
                    )
                        .to.emit(from, "Transfer")
                        .withArgs(this.bentoBox.address, this.pairFM.address, exactAmountFrom)
                        .to.emit(this.bentoBox, "LogWithdraw")
                        .withArgs(from.address, swapper.address, this.pairFM.address, exactAmountFrom, exactAmountFrom)
                        .to.emit(middle, "Transfer")
                        .withArgs(this.pairFM.address, this.pairMT.address, exactAmountMiddle)
                        .to.emit(to, "Transfer")
                        .withArgs(this.pairMT.address, this.bentoBox.address, amountWanted)
                        .to.emit(this.bentoBox, "LogDeposit")
                        .withArgs(to.address, this.bentoBox.address, this.alice.address, amountWanted, amountWanted)
                })

                it(`should not swap exact ${F} -> ${M} -> ${T} with just too little`, async function () {
                    const { from, middle, to, swapper } = await setup(this)
                    const cutoff = exactAmountFrom - 1n

                    await from.approve(this.bentoBox.address, amountProvided)
                    await this.bentoBox.deposit(from.address, this.alice.address, this.alice.address, amountProvided, 0)
                    await this.bentoBox.transfer(from.address, this.alice.address, swapper.address, exactAmountFrom)
                    await expect(
                        swapper.swapExact(from.address, to.address, this.alice.address, this.bob.address, cutoff, amountWanted)
                    ).to.be.revertedWith("BoringMath: Underflow")
                })
            })
        )
    })
})
