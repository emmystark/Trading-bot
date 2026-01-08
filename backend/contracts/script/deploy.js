const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting Seismic Trading Bot deployment...\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Configuration
  const TRADING_TOKEN = process.env.TRADING_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000";
  const FEE_COLLECTOR = process.env.FEE_COLLECTOR_ADDRESS || deployer.address;

  if (TRADING_TOKEN === "0x0000000000000000000000000000000000000000") {
    console.log("  Warning: TRADING_TOKEN_ADDRESS not set. Please set it in .env");
    console.log("   For Seismic testnet, you may need to deploy a mock USDT first.\n");
  }

  // Deploy Mock USDT (if needed for testing)
  let tradingTokenAddress = TRADING_TOKEN;
  if (hre.network.name === "localhost" || hre.network.name === "seismicTestnet") {
    console.log("📝 Deploying Mock USDT for testing...");
    const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy("Mock USDT", "USDT", 6);
    await mockUSDT.waitForDeployment();
    tradingTokenAddress = await mockUSDT.getAddress();
    console.log("✅ Mock USDT deployed to:", tradingTokenAddress, "\n");
  }

  // Deploy main contract
  console.log("📝 Deploying SeismicTradingBot...");
  const SeismicTradingBot = await hre.ethers.getContractFactory("SeismicTradingBot");
  const tradingBot = await SeismicTradingBot.deploy(
    tradingTokenAddress,
    FEE_COLLECTOR
  );

  await tradingBot.waitForDeployment();
  const tradingBotAddress = await tradingBot.getAddress();
  
  console.log("✅ SeismicTradingBot deployed to:", tradingBotAddress);
  console.log("   Trading Token:", tradingTokenAddress);
  console.log("   Fee Collector:", FEE_COLLECTOR, "\n");

  // Configure initial settings
  console.log("⚙️  Configuring contract...");
  
  // Authorize deployer as bot
  const authTx = await tradingBot.setBotAuthorization(deployer.address, true);
  await authTx.wait();
  console.log("✅ Deployer authorized as bot");

  // Set initial asset prices (for testing)
  if (hre.network.name !== "mainnet" && hre.network.name !== "seismic") {
    console.log("📊 Setting initial test prices...");
    const assets = [
      { name: "BTC", price: hre.ethers.parseEther("60000") },
      { name: "ETH", price: hre.ethers.parseEther("3000") },
      { name: "SOL", price: hre.ethers.parseEther("100") }
    ];

    for (const asset of assets) {
      const priceTx = await tradingBot.updatePrice(asset.name, asset.price);
      await priceTx.wait();
      console.log(`   ${asset.name}: $${hre.ethers.formatEther(asset.price)}`);
    }
  }

  console.log("\n✅ Deployment complete!\n");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    contracts: {
      SeismicTradingBot: tradingBotAddress,
      TradingToken: tradingTokenAddress
    },
    timestamp: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber()
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filePath = path.join(deploymentsDir, `${hre.network.name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
  console.log("📄 Deployment info saved to:", filePath, "\n");

  // Update .env file
  console.log("📝 Update your .env file with these values:");
  console.log("─────────────────────────────────────────────");
  console.log(`TRADING_CONTRACT_ADDRESS=${tradingBotAddress}`);
  console.log(`TRADING_TOKEN_ADDRESS=${tradingTokenAddress}`);
  console.log(`BOT_ADDRESS=${deployer.address}`);
  console.log("─────────────────────────────────────────────\n");

  // Verify on explorer (if not localhost)
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    console.log("⏳ Waiting for block confirmations before verification...");
    await tradingBot.deploymentTransaction()?.wait(6);
    
    console.log("🔍 Verifying contract on block explorer...");
    try {
      await hre.run("verify:verify", {
        address: tradingBotAddress,
        constructorArguments: [tradingTokenAddress, FEE_COLLECTOR],
      });
      console.log("✅ Contract verified!\n");
    } catch (error) {
      console.log("  Verification failed:", error.message);
      console.log("   You can verify manually later.\n");
    }
  }

  // Instructions
  console.log("🎉 Next Steps:");
  console.log("──────────────────────────────────────────────────────────");
  console.log("1. Update .env with the contract addresses shown above");
  console.log("2. Start the backend: npm run dev");
  console.log("3. Start the frontend: cd frontend && npm run dev");
  console.log("4. Fund your bot wallet with trading tokens");
  console.log("5. Deposit funds to the contract");
  console.log("6. Start the trading bot from the dashboard");
  console.log("──────────────────────────────────────────────────────────\n");

  // Seismic-specific instructions
  if (hre.network.name.includes("seismic")) {
    console.log("🔐 Seismic Privacy Features Enabled:");
    console.log("──────────────────────────────────────────────────────────");
    console.log("✓ All trades are executed privately");
    console.log("✓ Balances are encrypted on-chain");
    console.log("✓ Transaction details hidden from public view");
    console.log("✓ TEE-based execution for security");
    console.log("✓ Only you can view your trading activity");
    console.log("──────────────────────────────────────────────────────────\n");
  }
}

// Mock USDT contract for testing
const MockUSDTSource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT is ERC20 {
    uint8 private _decimals;
    
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) {
        _decimals = decimals_;
        _mint(msg.sender, 1000000 * 10**decimals_); // Mint 1M tokens
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
`;

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });