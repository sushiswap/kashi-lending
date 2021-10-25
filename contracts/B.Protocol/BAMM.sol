// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity >=0.6.12;

import "./PriceFormula.sol";
import "@boringcrypto/boring-solidity/contracts/BoringOwnable.sol";
import "@boringcrypto/boring-solidity/contracts/ERC20.sol";
import "@boringcrypto/boring-solidity/contracts/libraries/BoringERC20.sol";
import "./../interfaces/IOracle.sol";
import "./../interfaces/IKashiPair.sol"; // TODO the interface for abracadabra is a bit different
import "@sushiswap/bentobox-sdk/contracts/IBentoBoxV1.sol";

contract BAMM is PriceFormula, BoringOwnable, ERC20 {
    using BoringERC20 for IERC20;

    IOracle public immutable oracle;
    IERC20 public immutable mim;
    IERC20 public immutable collateral;
    IKashiPair public immutable lendingPair;
    IBentoBoxV1 public immutable bentobox;
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

        IBentoBoxV1 box = IBentoBoxV1(IKashiPair(lendingPair_).bentoBox());
        box.setMasterContractApproval(address(this), box.masterContractOf(lendingPair_), true, 0, 0, 0);
        bentobox = box;

        ERC20(mim_).approve(address(box), uint(-1));

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

        if(succ) return rate;
        else return 0;
    }

    function peekPrice() public view returns(uint) {
        (bool succ, uint rate) = oracle.peek(oracleData);

        if(succ) return rate;
        else return 0;
    }    

    function deposit(uint wad, bool viaBentobox) external {
        // update share
        (uint usdValue, uint gemValue) = getBalances();

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
        receiveToken(mim, wad, viaBentobox);

        emit Transfer(address(0), msg.sender, newShare);
        emit UserDeposit(msg.sender, wad, newShare);        
    }

    function withdraw(uint numShares, bool viaBentobox) external {
        require(balanceOf[msg.sender] >= numShares, "withdraw: insufficient balance");

        (uint usdValue, uint gemValue) = getBalances();

        uint usdAmount = usdValue.mul(numShares) / totalSupply;
        uint gemAmount = gemValue.mul(numShares) / totalSupply;

        sendToken(mim, msg.sender, usdAmount, viaBentobox);

        if(gemAmount > 0) {
            sendToken(collateral, msg.sender, gemAmount, viaBentobox);
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
        (uint usdBalance, uint gemBalance) = getBalances();

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
    function swap(uint wad, uint minGemReturn, address dest, bool viaBentobox) public returns(uint) {
        uint oraclePrice = fetchPrice();
        uint gemAmount = getSwapGemAmount(wad, oraclePrice);

        require(gemAmount >= minGemReturn, "swap: low return");

        receiveToken(mim, wad, viaBentobox);

        uint feeWad = addBps(wad, int(fee)).sub(wad);
        if(feeWad > 0) sendToken(mim, feePool, feeWad, true);

        sendToken(collateral, dest, gemAmount, viaBentobox);

        emit RebalanceSwap(msg.sender, wad, gemAmount, now);

        return gemAmount;
    }

    function liquidate(
        address[] calldata users,
        uint256[] calldata maxBorrowParts,
        address to,
        ISwapper swapper
    ) public
        returns(uint mimBalanceBefore, uint collateralBalanceBefore, uint mimBalanceAfter, uint collateralBalanceAfter)
    {
        (mimBalanceBefore, collateralBalanceBefore) = getBalances();
        lendingPair.liquidate(users, maxBorrowParts, address(this), swapper, true);
        (mimBalanceAfter, collateralBalanceAfter) = getBalances();

        uint callerReward = mimBalanceBefore.sub(mimBalanceAfter).mul(callerFee) / 10000;

        if(mimBalanceAfter >= callerReward) {
            sendToken(mim, to, callerReward, true);
            mimBalanceAfter = mimBalanceAfter.sub(callerReward);
        }
    }

    function liquidateLikeTiran(
        uint extraMim,
        address[] calldata users,
        uint256[] calldata maxBorrowParts,
        address to,
        ISwapper swapper,
        bool viaBentobox  
    ) public {
        // take the mim
        receiveToken(mim, extraMim, viaBentobox);

        // do the liquidation
        (uint mimBalanceBefore, uint collatBalanceBefore, uint mimBalanceAfter, uint collatBalanceAfter) =
            liquidate(users, maxBorrowParts, to, swapper);

        if(extraMim <= mimBalanceAfter) {
            sendToken(mim, msg.sender, extraMim, viaBentobox);
            return;
        }

        // send mim leftover to liquidator
        if(mimBalanceBefore.sub(mimBalanceAfter) >= extraMim) {
            uint returnAmount = mimBalanceBefore.sub(mimBalanceAfter).sub(extraMim);
            sendToken(mim, msg.sender, returnAmount, viaBentobox);
        }

        // send collateral to liquidator
        sendToken(collateral, to, collatBalanceAfter.sub(collatBalanceBefore), viaBentobox);
    }

    function getBalances() public view returns(uint mimBalance, uint collateralBalance) {
        mimBalance = bentobox.toAmount(mim, bentobox.balanceOf(mim, address(this)), false);
        collateralBalance = bentobox.toAmount(collateral, bentobox.balanceOf(collateral, address(this)), false);
    }

    function sendToken(IERC20 token, address to, uint amount, bool viaBentobox) internal {
        if(viaBentobox) {
            bentobox.transfer(token, address(this), to, bentobox.toShare(token, amount, false));
        }
        else {
            bentobox.withdraw(token, address(this), to, amount, 0);
        }        
    }

    function receiveToken(IERC20 token, uint amount, bool viaBentobox) internal {
        if(viaBentobox) {
            bentobox.transfer(token, msg.sender, address(this), bentobox.toShare(token, amount, false));
        }
        else {
            token.safeTransferFrom(msg.sender, address(this), amount);
            bentobox.deposit(token, address(this), address(this), amount, 0);
        }     
    }
}