const hre = require("hardhat");

const bentoBox = {
  AURORA: "SUSHI BENTOBOX ADDRESS" // REPLACE
}

async function main() {
  const [owner] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", owner.address);
  console.log("Account balance:", (await owner.getBalance()).toString());
  const KashiPair = await hre.ethers.getContractFactory("KashiPairNear");
  const kashiPair = await KashiPair.deploy(bentoBox.AURORA);
  await kashiPair.deployed();
  console.log("KashiPair deployed to:", kashiPair.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
