# Seismic Trading Bot Architecture

## Overview
Privacy-first bot for crypto trades on Seismic testnet. Analyzes market/news, enters/exits positions within 24hrs, maximizes privacy via encryption.

## Components
- **Frontend**: Next.js dashboard with Tailwind/shadcn. Polls backend for data.
- **Backend**: Express server with cron for analysis (CoinGecko/NewsAPI). Uses ethers for testnet txns.
- **Shared**: Wallet utils.
- **Contracts**: Mock Solidity for trade simulation (deploy to testnet).

## Flow
1. Cron analyzes → Buy signal? → Enter via contract.
2. Monitor → Profit >3%? → Exit.
3. UI shows blurred/encrypted data.

## Setup
- Deploy contracts: `cd contracts && npm run deploy`
- Run: `npm run dev`
- Test wallet: Generated in shared; fund via faucet.

## Roadmap
- Integrate real Seismic privacy SDK.
- Add ML sentiment (VADER).
- WebSockets for real-time UI.