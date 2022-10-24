const hre = require("hardhat");

async function main() {
  const [owner] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", owner.address);
  console.log("Account balance:", (await owner.getBalance()).toString());
  const UniswapInterfaceMulticall = await hre.ethers.getContractFactory("UniswapInterfaceMulticall");
  const uniswapInterfaceMulticall = await UniswapInterfaceMulticall.deploy();
  await uniswapInterfaceMulticall.deployed();
  console.log("UniswapInterfaceMulticall deployed to:", uniswapInterfaceMulticall.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
