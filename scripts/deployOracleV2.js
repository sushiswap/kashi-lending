const hre = require("hardhat");

async function main() {
  const [owner] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", owner.address);
  console.log("Account balance:", (await owner.getBalance()).toString());
  const ChainlinkOracleV2 = await hre.ethers.getContractFactory("ChainlinkOracleV2");
  const chainlinkOracleV2 = await ChainlinkOracleV2.deploy();
  await chainlinkOracleV2.deployed();
  console.log("ChainlinkOracleV2 deployed to:", chainlinkOracleV2.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
