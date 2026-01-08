require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    // Seismic Mainnet
    seismic: {
      url: process.env.SEISMIC_RPC_URL || "https://rpc.seismic.network",
      chainId: parseInt(process.env.SEISMIC_CHAIN_ID || "0"),
      accounts: process.env.BOT_PRIVATE_KEY ? [process.env.BOT_PRIVATE_KEY] : [],
      gasPrice: "auto",
      gas: 5000000
    },
    // Seismic Testnet
    seismicTestnet: {
      url: process.env.SEISMIC_TESTNET_RPC_URL || "https://testnet-rpc.seismic.network",
      chainId: parseInt(process.env.SEISMIC_TESTNET_CHAIN_ID || "0"),
      accounts: process.env.BOT_PRIVATE_KEY ? [process.env.BOT_PRIVATE_KEY] : [],
      gasPrice: "auto"
    },
    // Local development
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    // For testing on other networks
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.BOT_PRIVATE_KEY ? [process.env.BOT_PRIVATE_KEY] : [],
      chainId: 11155111
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  },
  etherscan: {
    apiKey: {
      seismic: process.env.SEISMIC_EXPLORER_API_KEY || "not-needed",
      sepolia: process.env.ETHERSCAN_API_KEY || ""
    },
    customChains: [
      {
        network: "seismic",
        chainId: parseInt(process.env.SEISMIC_CHAIN_ID || "0"),
        urls: {
          apiURL: process.env.SEISMIC_EXPLORER_API || "https://api.explorer.seismic.network",
          browserURL: process.env.SEISMIC_EXPLORER || "https://explorer.seismic.network"
        }
      }
    ]
  },
  mocha: {
    timeout: 40000
  }
};