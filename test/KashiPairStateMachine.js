const { ethers } = require("hardhat")
const { expect } = require("chai")

module.exports = class KashiPairStateMachine {
    constructor ({ kashiPair, bentoBox }) {
        this.provider = kashiPair.provider
        this.kashiPair = kashiPair
        this.bentoBox = bentoBox
        this.fromBlock = 1

        // bookkeeping
        this._bentoBalanceDeltas = []
        this._transfers = []

        this.assetToken = null
        this.collateralToken = null

        // state
        this.collateralShares = {}
        this.borrowParts = {}
        this.assetBalances = {}
        this.bentoBalances = {}
        this.totalCollateralShare = ethers.BigNumber.from(0)
        this.totalAssetBase = ethers.BigNumber.from(0)
        this.totalAssetElastic = ethers.BigNumber.from(0)
        this.totalBorrowBase = ethers.BigNumber.from(0)
        this.totalBorrowElastic = ethers.BigNumber.from(0)
    }

    async init () {
        const ABI = ["function balanceOf(address) external returns(uint256)"]
        this.assetToken = new ethers.Contract(await this.kashiPair.asset(), ABI, this.provider)
        this.collateralToken = new ethers.Contract(await this.kashiPair.collateral(), ABI, this.provider)
    }

    async _balanceOfAsset (addr) {
        return this.assetToken.balanceOf(addr)
    }

    async _balanceOfCollateral (addr) {
        return this.collateralToken.balanceOf(addr)
    }

    async _bentoAssetBalance (addr) {
        return this.bentoBox.balanceOf(this.assetToken.address, addr)
    }

    async _bentoCollateralBalance (addr) {
        return this.bentoBox.balanceOf(this.collateralToken.address, addr)
    }

    _getBentoBalance (token, addr) {
        const bag = this.bentoBalances[token]
        return bag && bag[addr] ? bag[addr] : ethers.BigNumber.from(0)
    }

    _setBentoBalance (token, addr, val) {
        const bag = this.bentoBalances[token] || {}
        bag[addr] = val
        this.bentoBalances[token] = bag
    }

    async _verifyBentoTransfer (token, from, to, share) {
        // `from` may be different in other events, hence drop it
        this._bentoBalanceDeltas.push({ token, from, to, share })
    }

    // bentoBox
    async onLogDeposit (token, from, to, amount, share) {
        let expected = this._getBentoBalance(token, to).add(share)
        this._setBentoBalance(token, to, expected)
    }

    // bentoBox
    async onLogWithdraw (token, from, to, amount, share) {
        let expected = this._getBentoBalance(token, from).sub(share)
        this._setBentoBalance(token, from, expected)
    }

    // bentoBox
    async onLogTransfer (token, from, to, share) {
        // `from` may be different in other events, hence drop it
        this._transfers.push({ token, from, to, share })

        let expected = this._getBentoBalance(token, from).sub(share)
        this._setBentoBalance(token, from, expected)

        expected = this._getBentoBalance(token, to).add(share)
        this._setBentoBalance(token, to, expected)
    }

    async onLogAccrue (accruedAmount, feeFraction, rate, utilization) {
        //this.log({ accruedAmount, feeFraction, rate, utilization })

        // xxx
        let expected = this.totalBorrowElastic.add(accruedAmount)
        this.totalBorrowElastic = expected
    }

    async onLogAddCollateral (from, to, share) {
        //this.log({ from, to, share })

        let expected = (this.collateralShares[to] || ethers.BigNumber.from(0)).add(share)
        this.collateralShares[to] = expected

        expected = this.totalCollateralShare.add(share)
        this.totalCollateralShare = expected

        const skim = from === this.bentoBox.address
        if (!skim) {
            await this._verifyBentoTransfer(this.collateralToken.address, from, this.kashiPair.address, share)
        }
    }

    async onLogAddAsset (from, to, share, fraction) {
        //this.log({ from, to, share, fraction })

        if (this.totalAssetBase.add(fraction).lt(1000)) {
            return
        }

        let expected = (this.assetBalances[to] || ethers.BigNumber.from(0)).add(share)
        this.assetBalances[to] = expected

        expected = this.totalAssetBase.add(fraction)
        this.totalAssetBase = expected

        expected = this.totalAssetElastic.add(share)
        this.totalAssetElastic = expected

        const skim = from === this.bentoBox.address
        if (!skim) {
            await this._verifyBentoTransfer(this.assetToken.address, from, this.kashiPair.address, share)
        }
    }

    async onLogRemoveCollateral (from, to, share) {
        //this.log({ from, to, share })

        let expected = (this.collateralShares[from] || ethers.BigNumber.from(0)).sub(share)
        //expect(expected).to.be.equal(await this.kashiPair.userCollateralShare(from))
        this.collateralShares[from] = expected

        expected = this.totalCollateralShare.sub(share)
        //expect(expected).to.be.equal(await this.kashiPair.totalCollateralShare())
        this.totalCollateralShare = expected

        //xxx1
        // check balance of collateral token in bento
        await this._verifyBentoTransfer(this.collateralToken.address, this.kashiPair.address, to, share)
    }

    async onLogRemoveAsset (from, to, share, fraction) {
        //this.log({ from, to, share, fraction })

        let expected = (this.assetBalances[from] || ethers.BigNumber.from(0)).sub(fraction)
        this.assetBalances[from] = expected

        expected = this.totalAssetBase.sub(fraction)
        this.totalAssetBase = expected

        expected = this.totalAssetElastic.sub(share)
        this.totalAssetElastic = expected

        await this._verifyBentoTransfer(this.assetToken.address, this.kashiPair.address, to, share)
    }

    async onLogBorrow(from, to, amount, feeAmount, part) {
        //this.log({ from, to, amount, feeAmount, part })

        let expected = (this.borrowParts[from] || ethers.BigNumber.from(0)).add(part)
        this.borrowParts[from] = expected

        expected = this.totalBorrowBase.add(part)
        this.totalBorrowBase = expected

        expected = this.totalBorrowElastic.add(amount.add(feeAmount))
        this.totalBorrowElastic = expected

        const BORROW_OPENING_FEE = 50
        const BORROW_OPENING_FEE_PRECISION = 1e5
        expect(feeAmount).to.be.equal(amount.mul(BORROW_OPENING_FEE).div(BORROW_OPENING_FEE_PRECISION))

        const share = await this.bentoBox.toShare(this.assetToken.address, amount, false)
        expected = this.totalAssetElastic.sub(share)
        this.totalAssetElastic = expected

        // transfer asset token from lendingpair
        await this._verifyBentoTransfer(this.assetToken.address, this.kashiPair.address, to, share)
    }

    async onLogRepay(from, to, amount, part) {
        //this.log({ from, to, amount, part })

        let expected = (this.borrowParts[to] || ethers.BigNumber.from(0)).sub(part)
        this.borrowParts[to] = expected

        expected = this.totalBorrowBase.sub(part)
        this.totalBorrowBase = expected

        expected = this.totalBorrowElastic.sub(amount)
        this.totalBorrowElastic = expected

        const share = await this.bentoBox.toShare(this.assetToken.address, amount, true)
        const skim = from === this.bentoBox.address

        ///xxx2
        //if (from !== this.kashiPair.address) {
            // no liquidation
            expected = this.totalAssetElastic.add(share)
            this.totalAssetElastic = expected
        //}

        if (!skim) {
            await this._verifyBentoTransfer(this.assetToken.address, from, this.kashiPair.address, share)
        }
    }

    async onLogWithdrawFees (receiver, feesEarned) {
        // this.log({ receiver, feesEarned })
        let expected = (this.assetBalances[receiver] || ethers.BigNumber.from(0)).add(feesEarned)
        this.assetBalances[receiver] = expected
    }

    log (...args) {
        console.log(this.constructor.name, ...args)
    }

    async verify () {
        expect(this._bentoBalanceDeltas.length, "should be equal to transfers").to.be.equal(this._transfers.length)

        while (this._transfers.length) {
            const a = this._transfers.pop()
            const b = this._bentoBalanceDeltas.pop()

            expect(a).to.be.deep.equal(b)
        }

        expect(this.totalCollateralShare, "total collateral").to.be.equal(await this.kashiPair.totalCollateralShare())
        expect(this.totalAssetBase, "asset base").to.be.equal((await this.kashiPair.totalAsset()).base)
        expect(this.totalAssetElastic, "asset elastic").to.be.equal((await this.kashiPair.totalAsset()).elastic)
        expect(this.totalBorrowBase, "total borrow base").to.be.equal((await this.kashiPair.totalBorrow()).base)
        expect(this.totalBorrowElastic, "total borrow elastic").to.be.equal((await this.kashiPair.totalBorrow()).elastic)

        for (const addr in this.collateralShares) {
            expect(this.collateralShares[addr]).to.be.equal(await this.kashiPair.userCollateralShare(addr))
        }

        for (const addr in this.borrowParts) {
            expect(this.borrowParts[addr]).to.be.equal(await this.kashiPair.userBorrowPart(addr))
        }

        for (const addr in this.assetBalances) {
            expect(this.assetBalances[addr]).to.be.equal(await this.kashiPair.balanceOf(addr))
        }

        for (const tokenAddr in this.bentoBalances) {
            for (const user in this.bentoBalances[tokenAddr]) {
                expect(this._getBentoBalance(tokenAddr, user), "bento balance")
                    .to.be.equal(await this.bentoBox.balanceOf(tokenAddr, user))
            }
        }

        let expected = this.totalAssetElastic
        // xxx this can also be more (can be skimmed)
        expect(expected).to.be.at.most(await this.bentoBox.balanceOf(this.assetToken.address, this.kashiPair.address))
    }

    async drainEvents () {
        const contracts = {
            [this.bentoBox.address.toLowerCase()]: this.bentoBox,
            [this.kashiPair.address.toLowerCase()]: this.kashiPair,
        }
        const blockNum = await this.provider.getBlockNumber()

        if (blockNum < this.fromBlock) {
            return
        }

        const payload = {
            fromBlock: "0x" + this.fromBlock.toString(16),
            toBlock: "0x" + blockNum.toString(16),
        }
        this.fromBlock = blockNum + 1

        const logs = await this.provider.send("eth_getLogs", [payload])
        for (const log of logs) {
            const contract = contracts[log.address.toLowerCase()]
            if (!contract || !contract.interface) {
                continue
            }
            const event = contract.interface.parseLog(log)
            const handler = `on${event.name}`

            // this.log(Number(log.blockNumber), event.name)
            if (typeof this[handler] !== "function") {
                this.log(`${event.name} not handled`)
                continue
            }

            await this[handler](...event.args)
        }

        await this.verify()
    }
}
