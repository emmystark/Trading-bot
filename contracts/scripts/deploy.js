const hre = require("hardhat");

async function main() {
  const MockTrade = await hre.ethers.getContractFactory("MockTrade");
  const contract = await MockTrade.deploy();

  await contract.waitForDeployment();
  console.log("MockTrade deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});