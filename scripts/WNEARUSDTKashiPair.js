const hre = require("hardhat");

const config = {
  AURORA: {
    bentoBox: "SUSHI BENTOBOX ADDRESS", // REPLACE
    kashiPairMasterContract: "SUSHI KASHIPAIR MASTER CONTRACT ADDRESS", // REPLACE
    collateral: "0x4988a896b1227218e4A686fdE5EabdcAbd91571f",
    asset: "0xC42C30aC6Cc15faC9bD938618BcaA1a1FaE8501d",
    oracle: "ORACLE ADDRESS", // REPLACE
    NEARUSDFlux: "0x0a9A9cF9bDe10c861Fc1e45aCe4ea097eaa268eD",
    USDTUSDFlux: "0x5c8C275Bb70C66330F5f60E17530f37a50E6185E",
    decimals: "1000000000000000000000000000000", // 1e30
  },
}

async function main() {
  const BentoBox = await hre.ethers.getContractAt("BentoBoxV1", config.AURORA.bentoBox);
  const kashiPairMasterContract = config.AURORA.kashiPairMasterContract;
  const collateral = config.AURORA.collateral;
  const asset = config.AURORA.asset;
  const oracle = config.AURORA.oracle;
  const NEARUSDFlux = config.AURORA.NEARUSDFlux;
  const USDTUSDFlux = config.AURORA.USDTUSDFlux;
  const decimals = config.AURORA.decimals; // 1e30
  const oracleData = hre.ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint256"],
      [NEARUSDFlux, USDTUSDFlux, decimals]
  );
  console.log("OracleData:", oracleData)

  let initData = hre.ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "address", "bytes"],
      [collateral, asset, oracle, oracleData]
  );

  const tx = await (await BentoBox.deploy(kashiPairMasterContract, initData, true)).wait();
  const deployEvent = tx?.events?.[0];
  console.log("KashiPair clone", deployEvent?.args?.cloneAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
