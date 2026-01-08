require('dotenv').config();

const networks = {
  // Base Sepolia Testnet (Default)
  baseSepolia: {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    contracts: {
      tradingBot: process.env.CONTRACT_ADDRESS
    },
    // Faucets for getting testnet tokens
    faucets: [
      'https://portal.cdp.coinbase.com/products/faucet',
      'https://bwarelabs.com/faucets/base-sepolia',
      'https://ponzifun.com/faucet'
    ]
  },

  // Local Anvil (for development)
  local: {
    name: 'Anvil Local',
    chainId: 31337,
    rpcUrl: 'http://127.0.0.1:8545',
    blockExplorer: null,
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    contracts: {
      tradingBot: process.env.LOCAL_CONTRACT_ADDRESS
    }
  }
};

// Get current network based on environment
const getCurrentNetwork = () => {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'development' && process.env.USE_LOCAL === 'true') {
    return networks.local;
  }
  
  return networks.baseSepolia;
};

// Export configuration
module.exports = {
  networks,
  currentNetwork: getCurrentNetwork(),
  
  // Helper functions
  getNetworkByChainId: (chainId) => {
    return Object.values(networks).find(n => n.chainId === chainId);
  },
  
  getContractAddress: () => {
    return getCurrentNetwork().contracts.tradingBot;
  },
  
  getRpcUrl: () => {
    return getCurrentNetwork().rpcUrl;
  },
  
  getChainId: () => {
    return getCurrentNetwork().chainId;
  },
  
  getBlockExplorer: () => {
    return getCurrentNetwork().blockExplorer;
  }
};