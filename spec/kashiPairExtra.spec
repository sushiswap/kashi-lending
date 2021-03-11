using DummyERC20A as collateralInstance
using DummyERC20B as assetInstance
using SimpleBentoBox as bentoBox

methods {
	balanceOf(address a) returns (uint256) envfree
	userBorrowPart(address user) returns (uint256) envfree
	totalCollateralShare() returns (uint256) envfree
	userCollateralShare(address user) returns (uint256) envfree
	totalAssetElastic() returns (uint256) envfree
	totalSupply() returns (uint256) envfree
	totalBorrowElastic() returns (uint256) envfree
	totalBorrowBase() returns (uint256) envfree
	borrowToElastic(uint256 part) returns (uint256) envfree
	
	collateralInstance.balanceOf(address a) returns (uint256) envfree
	feesEarnedFraction() returns (uint128) envfree
	collateral() returns (address) envfree
	asset() returns (address) envfree
	feeTo() returns (address) envfree
	isSolvent(address user, bool open) returns (bool) envfree

	// Bentobox functions
	bentoBox.transfer(address token, address from, address to, uint256 share) => DISPATCHER(true)
	bentoBox.balanceOf(address token, address user) returns (uint256) envfree
	bentoBox.toShare(address token, uint256 amount, bool roundUp) returns (uint256) envfree
	bentoBox.toAmount(address token, uint256 share, bool roundUp) returns (uint256) envfree
	
	deposit(address token, address from, address to, uint256 amount, uint256 share) => DISPATCHER(true)
	
	// Swapper
	swap(address fromToken, address toToken, address recipient, uint256 amountToMin, uint256 shareFrom) => DISPATCHER(true)
	swappers(address) => NONDET

	// Weth specific methods
	deposit() => DISPATCHER(true)
	withdraw(uint256 amount) => DISPATCHER(true)

	// Accrue
	FULL_UTILIZATION() returns (uint256) envfree
}

function setup() {
	require collateralInstance == collateral();
	require assetInstance == asset();
}


invariant integrityOfZeroBorrowAssets()
	totalBorrowElastic() >= totalBorrowBase() && 
	((totalBorrowElastic() == 0) <=> (totalBorrowBase() == 0)) {

		preserved repay(address to, bool skim, uint256 amount) with (env e) {
			require totalBorrowElastic() == borrowToElastic(totalBorrowBase());
		}

		preserved liquidate(address[] users, uint256[] amounts, address to, address swap, bool open) with (env e){
			require totalBorrowElastic() == borrowToElastic(totalBorrowBase());
		}


	}


function validState() {
	setup();

	//requireInvariant validityOfTotalSupply();
	require ((totalBorrowBase() > 0) => (totalSupply() > 0)) &&
	((totalSupply() == 0) => (totalAssetElastic() == 0));
	// requireInvariant integrityOfZeroBorrowAssets();
	require totalBorrowElastic() >= totalBorrowBase() && 
	((totalBorrowElastic() == 0) <=> (totalBorrowBase() == 0));
	// rule totalCollateralLeBentoBoxBalanceOf
	require bentoBox.balanceOf(collateralInstance, currentContract) >= totalCollateralShare();
	// rule totalAssetElasticLeBentoBoxBalanceOf
	require bentoBox.balanceOf(assetInstance, currentContract) >= totalAssetElastic();
}



// RULES that timeout in general settings, can be proven only on simplified version



// total assets of the lending pair and balance of a user 
// should not change if they deposit and withdraw the same fraction.
rule addThenRemoveAsset(address to, bool skim, uint256 share, uint256 totalAssetElasticAfterAdd) {
	validState();
	env e;

	// skim = false, to test a simple case first
	// skim is true, then maybe we add more assets, so we might want to change == to <=
	require e.msg.sender == to && skim == false; 

	uint256 _totalAssetElastic = totalAssetElastic(); // free shares of LendingPair in BentoBox
	uint256 _totalAssetBase = totalSupply(); // Sum of all users' fraction.
	uint256 _balanceOf = balanceOf(to); // user fraction

	require _totalAssetElastic == 0 <=> _totalAssetBase == 0; // TODO: invariant 
	
	// might want to try doing this in two lines, and manually converting 
	// share to fraction and then calling removeAsset with the converted fraction
	// might also want to compare the return values after proper conversion
    uint256 fraction = addAsset(e, to, skim, share);
	uint256 tempTotalAssetElastic = totalAssetElastic();
	require totalAssetElasticAfterAdd == totalAssetElastic();
	uint256 tempShare = removeAsset(e, to, fraction);
	

	uint256 totalAssetElastic_ = totalAssetElastic();
	uint256 totalAssetBase_ = totalSupply();
	uint256 balanceOf_ = balanceOf(to);
	
	assert (_totalAssetBase == totalAssetBase_, 
			"total asset base changed");

	assert (_balanceOf == balanceOf_, 
			"balance of user changed");

	// totalAssetElastic_ increases by share when assets are added, but
	// it doesn't decrease when assets are removed.
	// not exactly sure what's going on here. (might be a bug)
	//total asset change in favor of the system
	assert (_totalAssetElastic <= totalAssetElastic_, 
			"total asset elastic decreses");
}



// total borrow and the borrow part of a user should stay the same 
// if they borrow and repay the same amount
// work in progress ...
rule borrowThenRepay(address to, bool skim, uint256 amount) {
	validState();
	env e;

	// skim = false, to test a simple case first
	// skim is true, then maybe we can repay less?
	require e.msg.sender == to && skim == false && to != 0; 

	// totalAssetElastic()/free shares of LendingPair in BentoBox should also stay the same? totalAssetBase same also?
	uint256 _totalBorrowElastic = totalBorrowElastic();
	uint256 _totalBorrowBase = totalBorrowBase(); // not sure about this
	uint256 _userBorrowPart = userBorrowPart(to); // user's borrow part

	// might also want to compare the return values after proper conversion
	uint256 part;
	uint256 share;
	part, share = borrow(e, to, amount);
	repay(e, to, skim, part);
	
	uint256 totalBorrowElastic_ = totalBorrowElastic();
	uint256 totalBorrowBase_ = totalBorrowBase();
	uint256 userBorrowPart_ = userBorrowPart(to);

	assert (_userBorrowPart == userBorrowPart_, 
			"user borrow part changed");

	// rounding should be in favor of system 
	assert (_totalBorrowElastic >= totalBorrowElastic_, 
			"total borrow elastic changed");

	assert (_totalBorrowBase == totalBorrowBase_, 
			"total borrow base changed");
}






