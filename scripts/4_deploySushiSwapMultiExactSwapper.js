const hre = require("hardhat");

const constructorArgs = {
  AURORA: {
    factory: "SUSHI FACTORY ADDRESS", // REPLACE
    bentoBox: "SUSHI BENTOBOX ADDRESS", // REPLACE
    pairCodeHash: "SUSHI FACTORY PAIR CODE HASH", // REPLACE
  }
}

async function main() {
  const [owner] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", owner.address);
  console.log("Account balance:", (await owner.getBalance()).toString());
  const SushiSwapMultiExactSwapper = await hre.ethers.getContractFactory("SushiSwapMultiExactSwapper");
  const sushiSwapMultiExactSwapper = await SushiSwapMultiExactSwapper.deploy(
      constructorArgs.AURORA.factory,
      constructorArgs.AURORA.bentoBox,
      constructorArgs.AURORA.pairCodeHash
  );
  await sushiSwapMultiExactSwapper.deployed();
  console.log("SushiSwapMultiExactSwapper deployed to:", sushiSwapMultiExactSwapper.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
