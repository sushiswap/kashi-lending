const hre = require("hardhat");

const constructorArgs = {
  AURORA: {
    chef: "0x0000000000000000000000000000000000000000",
    maker: "0x0000000000000000000000000000000000000000",
    sushi: "SUSHI TOKEN ADDRESS", // REPLACE
    WETH: "0xC9BdeEd33CD01541e1eeD10f90519d2C06Fe3feB",
    WBTC: "0xF4eB217Ba2454613b15dBdea6e5f22276410e89e",
    sushiFactory: "SUSHI FACTORY ADDRESS", // REPLACE
    uniV2Factory: "0x0000000000000000000000000000000000000000",
    bar: "0x0000000000000000000000000000000000000000",
    bentoBox: "SUSHI BENTOBOX ADDRESS", // REPLACE
  }
}

async function main() {
  const [owner] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", owner.address);
  console.log("Account balance:", (await owner.getBalance()).toString());
  const BoringHelperV1 = await hre.ethers.getContractFactory("BoringHelperV1");
  const boringHelperV1 = await BoringHelperV1.deploy(
      constructorArgs.AURORA.chef,
      constructorArgs.AURORA.maker,
      constructorArgs.AURORA.sushi,
      constructorArgs.AURORA.WETH,
      constructorArgs.AURORA.WBTC,
      constructorArgs.AURORA.sushiFactory,
      constructorArgs.AURORA.uniV2Factory,
      constructorArgs.AURORA.bar,
      constructorArgs.AURORA.bentoBox
  );
  await boringHelperV1.deployed();
  console.log("BoringHelperV1 deployed to:", boringHelperV1.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
