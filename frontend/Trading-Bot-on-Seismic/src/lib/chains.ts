// lib/chains.ts
import { defineChain } from 'viem'
import { createConfig, http } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'

// === Seismic Devnet 2 ===
export const seismicDevnet2 = defineChain({
  id: 5124, // 0x1404
  name: 'Seismic Devnet 2',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://internal-testnet.seismictest.net/rpc'],
      webSocket: ['wss://internal-testnet.seismictest.net/ws'],
    },
  },
  blockExplorers: {
    default: {
      name: 'SeismicScan',
      url: 'https://explorer-2.seismicdev.net',
    },
  },
  testnet: true,
});

// === Seismic Mainnet ===
export const seismicMainnet = defineChain({
  id: 5125, // Example ID for mainnet
  name: 'Seismic Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.seismic.systems'],
      webSocket: ['wss://rpc.seismic.systems/ws'],
    },
  },
  blockExplorers: {
    default: {
      name: 'SeismicScan',
      url: 'https://explorer.seismic.systems',
    },
  },
  testnet: false,
});

// === Wagmi Config ===
export const config = createConfig({
  chains: [seismicDevnet2],
  connectors: [
    injected(), // MetaMask, Rabby, etc.
    walletConnect({
      projectId: 'YOUR_WALLETCONNECT_PROJECT_ID', // Get from https://cloud.walletconnect.com
    }),
  ],
  transports: {
    [seismicDevnet2.id]: http('https://internal-testnet.seismictest.net/rpc'),
  },
})