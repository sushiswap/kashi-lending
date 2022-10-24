const hre = require("hardhat");

const wrappedNativeToken = {
  WETH: "0xC9BdeEd33CD01541e1eeD10f90519d2C06Fe3feB"
}

async function main() {
  const [owner] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", owner.address);
  console.log("Account balance:", (await owner.getBalance()).toString());
  const BentoBox = await hre.ethers.getContractFactory("BentoBoxV1");
  const bentoBox = await BentoBox.deploy(wrappedNativeToken.WETH);
  await bentoBox.deployed();
  console.log("BentoBox deployed to:", bentoBox.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
