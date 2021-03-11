certoraRun.py spec/harness/KashiPairHarnessFlat.sol spec/harness/DummyERC20A.sol \
	spec/harness/DummyERC20B.sol spec/harness/Swapper.sol spec/harness/SimpleBentoBox.sol contracts/mocks/OracleMock.sol spec/harness/DummyWeth.sol spec/harness/WhitelistedSwapper.sol \
	--link KashiPairHarnessFlat:collateral=DummyERC20A KashiPairHarnessFlat:asset=DummyERC20B KashiPairHarnessFlat:bentoBox=SimpleBentoBox KashiPairHarnessFlat:oracle=OracleMock  KashiPairHarnessFlat:masterContract=KashiPairHarnessFlat KashiPairHarnessFlat:whitelistedSwapper=WhitelistedSwapper KashiPairHarnessFlat:redSwapper=Swapper \
	--solc solc6.12 \
	--settings -copyLoopUnroll=4,-b=1,-ignoreViewFunctions,-enableStorageAnalysis=true,-assumeUnwindCond,-ciMode=true,-recursionEntryLimit=10 \
	--verify KashiPairHarnessFlat:spec/kashiPair.spec \
	--staging shelly/sushiPackingBworIssueRuns800 \
	--solc_args "['--optimize', '--optimize-runs', '800']" \
	--cache KashiPairHarnessFlat \
	--msg "KashiPairHarnessFlat all rules optimize-runs 800"  \