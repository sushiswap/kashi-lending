// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.6.12;

import "./PriceFormula.sol";
import "@boringcrypto/boring-solidity/contracts/BoringOwnable.sol";
import "@boringcrypto/boring-solidity/contracts/ERC20.sol";
import "@boringcrypto/boring-solidity/contracts/libraries/BoringERC20.sol";
import "./../interfaces/IOracle.sol";
import "./../interfaces/IKashiPair.sol"; // TODO the interface for abracadabra is a bit different

contract BAMM is PriceFormula, BoringOwnable, ERC20 {
    using BoringERC20 for IERC20;

    IOracle public immutable oracle;
    IERC20 public immutable mim;
    IERC20 public immutable collateral;
    IKashiPair public immutable lendingPair;
    bytes public oracleData;

    address public immutable feePool;
    uint public constant MAX_FEE = 100; // 1%
    uint public constant MAX_CALLER_FEE = 100; // 1%    
    uint public fee = 0; // fee in bps
    uint public callerFee = 0; // fee in bps
    uint public A = 20;
    uint public constant MIN_A = 20;
    uint public constant MAX_A = 200;    

    uint public immutable maxDiscount; // max discount in bips

    uint constant public PRECISION = 1e18;

    uint public totalSupply;

    event ParamsSet(uint A, uint fee, uint callerFee);
    event UserDeposit(address indexed user, uint wad, uint numShares);
    event UserWithdraw(address indexed user, uint wad, uint gem, uint numShares);
    event RebalanceSwap(address indexed user, uint wad, uint gem, uint timestamp);

    constructor(
        address lendingPair_,
        address oracle_,
        address mim_,
        address collateral_,
        address feePool_,
        uint    maxDiscount_
    )
        public
    {
        lendingPair = IKashiPair(lendingPair_);
        oracle = IOracle(oracle_);
        mim = IERC20(mim_);
        collateral = IERC20(collateral_);
        oracleData = IKashiPair(lendingPair_).oracleData();

        feePool = feePool_;
        maxDiscount = maxDiscount_;

        ERC20(mim_).approve(lendingPair_, uint(-1)); // TODO - is it needed?

        // TODO - can we support only 18 decimals collateral? it depends on the price feed
        //require(ERC20(collateral_).decimals() == 18, "only 18 decimals collaterals are supported");
    }

    function setParams(uint _A, uint _fee, uint _callerFee) external onlyOwner {
        require(_fee <= MAX_FEE, "setParams: fee is too big");
        require(_callerFee <= MAX_CALLER_FEE, "setParams: caller fee is too big");        
        require(_A >= MIN_A, "setParams: A too small");
        require(_A <= MAX_A, "setParams: A too big");

        fee = _fee;
        callerFee = _callerFee;
        A = _A;

        emit ParamsSet(_A, _fee, _callerFee);
    }

    function fetchPrice() public returns(uint) {
        (bool succ, uint rate) = oracle.get(oracleData);

        if(succ) return 0;
        else return rate;
    }

    function peekPrice() public view returns(uint) {
        (bool succ, uint rate) = oracle.peek(oracleData);

        if(succ) return 0;
        else return rate;
    }    

    function deposit(uint wad) external {
        // update share
        uint usdValue = mim.balanceOf(address(this));
        uint gemValue = collateral.balanceOf(address(this));

        uint price = fetchPrice();
        require(gemValue == 0 || price > 0, "deposit: feed is down");

        uint totalValue = usdValue.add(gemValue.mul(price) / PRECISION);

        // this is in theory not reachable. if it is, better halt deposits
        // the condition is equivalent to: (totalValue = 0) ==> (total = 0)
        require(totalValue > 0 || totalSupply == 0, "deposit: system is rekt");

        uint newShare = PRECISION;
        if(totalSupply > 0) newShare = wad.mul(totalSupply) / totalValue;

        totalSupply = totalSupply.add(newShare);
        balanceOf[msg.sender] = balanceOf[msg.sender].add(newShare);

        // deposit the wad
        mim.safeTransferFrom(msg.sender, address(this), wad);

        emit Transfer(address(0), msg.sender, newShare);
        emit UserDeposit(msg.sender, wad, newShare);        
    }

    function withdraw(uint numShares) external {
        require(balanceOf[msg.sender] >= numShares, "withdraw: insufficient balance");

        uint usdValue = mim.balanceOf(address(this));
        uint gemValue = collateral.balanceOf(address(this));

        uint usdAmount = usdValue.mul(numShares) / totalSupply;
        uint gemAmount = gemValue.mul(numShares) / totalSupply;

        mim.safeTransfer(msg.sender, usdAmount);

        if(gemAmount > 0) {
            collateral.safeTransfer(msg.sender, gemAmount);
        }

        balanceOf[msg.sender] = balanceOf[msg.sender].sub(numShares);
        totalSupply = totalSupply.sub(numShares);

        emit Transfer(msg.sender, address(0), numShares);
        emit UserWithdraw(msg.sender, usdAmount, gemAmount, numShares);            
    }

    function addBps(uint n, int bps) internal pure returns(uint) {
        require(bps <= 10000, "reduceBps: bps exceeds max");
        require(bps >= -10000, "reduceBps: bps exceeds min");

        return n.mul(uint(10000 + bps)) / 10000;
    }

    function getSwapGemAmount(uint wad) external view returns(uint gemAmount) {
        uint oraclePrice = peekPrice();
        return getSwapGemAmount(wad, oraclePrice);
    }

    function getSwapGemAmount(uint wad, uint gem2usdPrice) internal view returns(uint gemAmount) {
        uint usdBalance = mim.balanceOf(address(this));
        uint gemBalance = collateral.balanceOf(address(this));

        if(gem2usdPrice == 0) return (0); // feed is down

        uint gemUsdValue = gemBalance.mul(gem2usdPrice) / PRECISION;
        uint maxReturn = addBps(wad.mul(PRECISION) / gem2usdPrice, int(maxDiscount));

        uint xQty = wad;
        uint xBalance = usdBalance;
        uint yBalance = usdBalance.add(gemUsdValue.mul(2));
        
        uint usdReturn = getReturn(xQty, xBalance, yBalance, A);
        uint basicGemReturn = usdReturn.mul(PRECISION) / gem2usdPrice;

        if(gemBalance < basicGemReturn) basicGemReturn = gemBalance; // cannot give more than balance 
        if(maxReturn < basicGemReturn) basicGemReturn = maxReturn;

        gemAmount = basicGemReturn;
    }

    // get gem in return to mim
    function swap(uint wad, uint minGemReturn, address dest) public returns(uint) {
        uint oraclePrice = fetchPrice();
        uint gemAmount = getSwapGemAmount(wad, oraclePrice);

        require(gemAmount >= minGemReturn, "swap: low return");

        mim.safeTransferFrom(msg.sender, address(this), wad);

        uint feeWad = addBps(wad, int(fee)).sub(wad);
        if(feeWad > 0) mim.safeTransfer(feePool, feeWad);

        collateral.safeTransfer(dest, gemAmount);

        emit RebalanceSwap(msg.sender, wad, gemAmount, now);

        return gemAmount;
    }

    function liquidate(
        address[] calldata users,
        uint256[] calldata maxBorrowParts,
        address to,
        ISwapper swapper,
        bool open
    ) public
        returns(uint mimBalanceBefore, uint mimBalanceAfter)
    {
        mimBalanceBefore = mim.balanceOf(address(this));        
        lendingPair.liquidate(users, maxBorrowParts, to, swapper, open);
        mimBalanceAfter = mim.balanceOf(address(this));

        uint callerReward = mimBalanceBefore.sub(mimBalanceAfter).mul(callerFee) / 10000;

        if(mimBalanceAfter >= callerReward) {
            mim.safeTransfer(msg.sender, callerReward);
            mimBalanceAfter = mimBalanceAfter.sub(callerReward);
        }
    }

    function liquidateLikeBoomer(
        uint extraMim,
        address[] calldata users,
        uint256[] calldata maxBorrowParts,
        address to,
        ISwapper swapper,
        bool open        
    ) public {
        // take the mim
        mim.safeTransferFrom(msg.sender, address(this), extraMim);

        uint collatBalanceBefore = collateral.balanceOf(address(this));
        
        // do the liquidation
        (uint mimBalanceBefore, uint mimBalanceAfter) = liquidate(users, maxBorrowParts, to, swapper, open);

        uint collatBalanceAfter = collateral.balanceOf(address(this));

        if(extraMim <= mimBalanceAfter) {
            // boomer liquidation was not needed. just return the money
            mim.safeTransfer(msg.sender, extraMim);
            return;
        }

        // send mim leftover to liquidator
        if(mimBalanceBefore.sub(mimBalanceAfter) >= extraMim) {
            uint returnAmount = mimBalanceBefore.sub(mimBalanceAfter).sub(extraMim);
            mim.safeTransfer(msg.sender, returnAmount);
        }

        // send collateral to liquidator
        collateral.safeTransfer(msg.sender, collatBalanceAfter.sub(collatBalanceBefore));
    }

}