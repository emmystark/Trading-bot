// lib/wagmi.ts
import { createConfig, http, cookieToInitialState } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';  // Your chains
import { QueryClient } from '@tanstack/react-query';  // For initialState
import { seismicMainnet, seismicDevnet2 } from './chains'; // Import Seismic chains
import { injected, walletConnect } from 'wagmi/connectors'; // Add wallet connectors

// Create QueryClient for SSR
export const queryClient = new QueryClient();

// Config
export const config = createConfig({
  chains: [seismicMainnet, seismicDevnet2], // Include Seismic chains
  transports: {
    [seismicMainnet.id]: http('https://rpc.seismic.systems'),
    [seismicDevnet2.id]: http('https://rpc-2.seismicdev.net'),
  },
  connectors: [
    injected(), // MetaMask and browser wallets
    walletConnect({ projectId: 'YOUR_WALLETCONNECT_PROJECT_ID' }), // WalletConnect
  ],
});

// SSR helper: Get initial state from cookies (call this on server)
export function getInitialState() {
  if (typeof window === 'undefined') return undefined;  // Client-only
  return cookieToInitialState(config, document.cookie);
}