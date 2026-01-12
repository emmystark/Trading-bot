// Frontend Configuration for Base Sepolia

export const BASE_SEPOLIA_CONFIG = {
  // Network Details
  chainId: 84532,
  chainIdHex: '0x14a34',
  chainName: 'Base Sepolia',
  
  // RPC
  rpcUrl: 'https://sepolia.base.org',
  
  // Contract
  contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS || '0x...',
  
  // Explorer
  blockExplorer: 'https://sepolia.basescan.org',
  blockExplorerName: 'BaseScan',
  
  // Native Currency
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18
  },
  
  // Faucets
  faucets: [
    {
      name: 'Coinbase Faucet',
      url: 'https://portal.cdp.coinbase.com/products/faucet',
      amount: '0.1 ETH',
      cooldown: '24 hours'
    },
    {
      name: 'Bware Labs',
      url: 'https://bwarelabs.com/faucets/base-sepolia',
      amount: '0.1 ETH',
      cooldown: '24 hours'
    },
    {
      name: 'PonziFun',
      url: 'https://ponzifun.com/faucet',
      amount: '1 ETH',
      cooldown: '48 hours'
    }
  ]
};

// Local Development Config (Anvil)
export const LOCAL_CONFIG = {
  chainId: 31337,
  chainIdHex: '0x7a69',
  chainName: 'Anvil Local',
  rpcUrl: 'http://127.0.0.1:8545',
  contractAddress: import.meta.env.VITE_LOCAL_CONTRACT_ADDRESS || '0x...',
  blockExplorer: null,
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18
  }
};

// Determine which config to use
const isDevelopment = import.meta.env.MODE === 'development';
const useLocal = import.meta.env.VITE_USE_LOCAL === 'true';

export const config = (isDevelopment && useLocal) ? LOCAL_CONFIG : BASE_SEPOLIA_CONFIG;

// Helper functions
export const getExplorerUrl = (type, value) => {
  const baseUrl = config.blockExplorer;
  if (!baseUrl) return null;
  
  switch (type) {
    case 'tx':
    case 'transaction':
      return `${baseUrl}/tx/${value}`;
    case 'address':
    case 'account':
      return `${baseUrl}/address/${value}`;
    case 'block':
      return `${baseUrl}/block/${value}`;
    case 'token':
      return `${baseUrl}/token/${value}`;
    default:
      return baseUrl;
  }
};

export const formatAddress = (address, chars = 4) => {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
};

export const addNetworkToMetaMask = async () => {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  try {
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: config.chainIdHex,
        chainName: config.chainName,
        nativeCurrency: config.nativeCurrency,
        rpcUrls: [config.rpcUrl],
        blockExplorerUrls: config.blockExplorer ? [config.blockExplorer] : []
      }]
    });
    return true;
  } catch (error) {
    console.error('Failed to add network:', error);
    throw error;
  }
};

export const switchToNetwork = async () => {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: config.chainIdHex }]
    });
    return true;
  } catch (error) {
    // If network doesn't exist, add it
    if (error.code === 4902) {
      return await addNetworkToMetaMask();
    }
    throw error;
  }
};

export default config;