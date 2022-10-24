const hre = require("hardhat");

async function main() {
  const [owner] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", owner.address);
  console.log("Account balance:", (await owner.getBalance()).toString());
  const ChainlinkOracle = await hre.ethers.getContractFactory("ChainlinkOracle");
  const chainlinkOracle = await ChainlinkOracle.deploy();
  await chainlinkOracle.deployed();
  console.log("ChainlinkOracle deployed to:", chainlinkOracle.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
