const hre = require("hardhat");

async function main() {
  const [owner] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", owner.address);
  console.log("Account balance:", (await owner.getBalance()).toString());
  const Multicall2 = await hre.ethers.getContractFactory("Multicall2");
  const multicall2 = await Multicall2.deploy();
  await multicall2.deployed();
  console.log("Multicall2 deployed to:", multicall2.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
