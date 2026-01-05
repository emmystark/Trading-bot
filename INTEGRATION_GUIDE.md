# Seismic AI Trading Bot - Setup & Integration Guide

## 🎯 Project Overview

This is a fully integrated Web3 trading bot system with three main components:

1. **Smart Contract** (Solidity) - Private trading logic on Seismic blockchain
2. **Backend API** (Express.js) - Node.js server handling market data & blockchain interactions
3. **Frontend** (Next.js + React) - Web dashboard for trading interface

---

## ✅ Setup Instructions

### 1. Prerequisites
- Node.js v18+ 
- npm v8+
- Environment variables configured in `.env` files

### 2. Quick Start

**Option A: Using the start script (Recommended)**
```bash
./start.sh
```

**Option B: Manual startup**

Terminal 1 - Backend:
```bash
cd backend
npm install
npm start
```

Terminal 2 - Frontend:
```bash
cd frontend
npm install
npm run dev
```

### 3. Environment Configuration

#### Backend `.env` (backend/.env)
```env
SEISMIC_RPC_URL=https://internal-testnet.seismictest.net/rpc
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
TRADING_CONTRACT_ADDRESS=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
PORT=3001
```

#### Frontend `.env.local` (frontend/.env.local)
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_CONTRACT_ADDRESS=0xc010C027c557dB20F5A0cE653Cca257A3De24843
NEXT_PUBLIC_SEISMIC_RPC_URL=https://internal-testnet.seismictest.net/rpc
```

#### Contracts `.env` (contracts/.env)
```env
SEISMIC_RPC_URL=https://internal-testnet.seismictest.net/rpc
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
TRADING_CONTRACT_ADDRESS=0xc010C027c557dB20F5A0cE653Cca257A3De24843
```

---

## 🏗️ Architecture & Component Integration

### **Backend API Server** (Port 3001)

The Express.js server provides RESTful endpoints for:
- Market data fetching (Binance, CryptoCompare)
- AI strategy analysis
- Blockchain interactions via ethers.js
- Trade execution on Seismic blockchain

**Key Files:**
- `backend/server.js` - Main Express application
- `backend/services/blockchain.js` - Blockchain service (ethers.js)
- `backend/services/aiStrategy.js` - AI analysis service

**Critical Fix Applied:**
- Fixed `require` statement in blockchain.js line 6
- Added error handling for blockchain service initialization
- Added middleware to check blockchain service availability

### **Frontend Dashboard** (Port 3000/3002)

Next.js React application with:
- Real-time market data display
- Trading interface
- Balance & position tracking
- Bot control UI

**Key Files:**
- `frontend/app/page.tsx` - Main dashboard component
- `frontend/.env.local` - Configuration for backend URL & contract address

### **Smart Contract** (Seismic Blockchain)

Solidity contract with privacy features using Seismic's shielded types.
- Manages user balances (private)
- Executes trades
- Tracks positions & history
- Controls bot settings

**Key Files:**
- `contracts/src/PrivateTradingBot.sol` - Main contract
- `contracts/PrivateTradingBot.json` - Compiled ABI
- `contracts/script/Deploy.s.sol` - Deployment script

---

## 🔗 Frontend-Backend Integration

### **API Endpoints Used by Frontend**

The frontend makes HTTP requests to these backend endpoints:

```
GET  /api/health                 # Health check
GET  /api/coins                  # List all supported coins
GET  /api/market/:coinId         # Coin data + AI analysis
GET  /api/analysis/:coinId       # AI analysis only
GET  /api/blockchain/balance     # User's balance from smart contract
GET  /api/blockchain/trades      # User's trade history
GET  /api/blockchain/positions   # User's open positions
POST /api/blockchain/trade       # Execute a trade
POST /api/blockchain/deposit     # Deposit funds
POST /api/blockchain/withdraw    # Withdraw funds
POST /api/bot/start              # Start auto-trading
POST /api/bot/stop               # Stop auto-trading
```

### **Backend-Contract Integration**

The backend service (`blockchain.js`) uses ethers.js to:

1. **Connect to Seismic RPC** (JsonRpcProvider)
2. **Initialize Wallet** (Signer)
3. **Load Smart Contract** (Contract interface)
4. **Call Contract Functions**:
   - Read: `getBalance()`, `getTradeHistory()`, `getOpenPositions()`
   - Write: `executeTrade()`, `deposit()`, `withdraw()`, `configureBotSettings()`
5. **Listen to Events** (Trade execution events)

**Flow Example:**
```
Frontend (UI) 
  → POST /api/blockchain/trade 
  → Backend API 
  → blockchainService.executeTrade() 
  → ethers.js 
  → Seismic Smart Contract 
  → Blockchain Transaction
```

---

## 🚀 Running the System

### **Full System (Recommended)**
```bash
./start.sh
```

This will:
1. Check Node.js installation
2. Install dependencies
3. Start backend (port 3001)
4. Start frontend (port 3000 or 3002)
5. Display service URLs and endpoints

### **Access the Application**
- **Frontend**: http://localhost:3000 (or 3002 if 3000 is taken)
- **Backend Health**: http://localhost:3001/api/health
- **Backend Coins**: http://localhost:3001/api/coins

---

## 🐛 Troubleshooting

### Issue: Port Already in Use
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Issue: Blockchain Service Unavailable
- Check `.env` files for correct:
  - `SEISMIC_RPC_URL`
  - `PRIVATE_KEY` 
  - `TRADING_CONTRACT_ADDRESS`
- Ensure you have valid Seismic testnet credentials
- Check network connectivity to Seismic RPC

### Issue: Frontend Can't Connect to Backend
- Verify backend is running on port 3001
- Check `frontend/.env.local` has correct `NEXT_PUBLIC_BACKEND_URL`
- Clear browser cache
- Check CORS headers in server.js (should show `Access-Control-Allow-Origin: *`)

### Issue: Smart Contract Interaction Fails
- Invalid contract ABI in `contracts/PrivateTradingBot.json`
- Private key doesn't match wallet that deployed contract
- Insufficient balance for gas fees
- Contract address is incorrect

### Warning: Invalid Fragment "suint256"
This is expected! Seismic uses shielded types (`suint256`, `sbool`, etc.) which ethers.js doesn't recognize. The contract still works, but calls to functions with shielded types may have limitations.

---

## 📊 Component Status Check

**To verify all systems are working:**

1. Health Check:
```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{
  "status": "ok",
  "uptime": 42.123,
  "cacheSize": 0,
  "pendingRequests": 0,
  "timestamp": "2026-01-05T09:08:48.779Z"
}
```

2. Get Coins List:
```bash
curl http://localhost:3001/api/coins
```

3. Check Frontend:
```bash
curl http://localhost:3000
```

---

## 🔐 Security Notes

- **Never commit `.env` files** - They contain private keys
- **Private Key Protection** - Store in secure vaults for production
- **RPC URL** - Use dedicated RPC for production (not testnet)
- **CORS** - Currently allows all origins; restrict in production

---

## 📝 Development Notes

### **File Changes Made to Fix Integration:**

1. **backend/services/blockchain.js**
   - Fixed line 6: Removed invalid `this.contractABI` outside class
   - Fixed line 60: Corrected path to contract ABI

2. **backend/server.js**
   - Added safe blockchain service initialization with try-catch
   - Added `requireBlockchainService` middleware for blockchain routes
   - Updated all blockchain endpoints to check service availability

3. **frontend/.env.local** (Created)
   - Added configuration for backend URL and contract address

### **Known Limitations:**

1. Shielded types (suint256, sbool) are not fully supported by ethers.js
2. Event listening may fail due to private contract nature
3. Some contract functions may return warnings

---

## 🎓 Next Steps

1. **Deploy Smart Contract to Seismic Mainnet**
   - Update contract addresses in all `.env` files
   - Increase gas limits for production

2. **Frontend Enhancements**
   - Add Web3 wallet connection (MetaMask, WalletConnect)
   - Add real-time WebSocket updates
   - Improve UI/UX

3. **Backend Improvements**
   - Add database for historical data
   - Implement better error handling
   - Add API rate limiting

4. **Testing**
   - Unit tests for blockchain service
   - Integration tests for API endpoints
   - Smart contract audit

---

## 📞 Support

For issues with:
- **Seismic Blockchain**: Check [Seismic Docs](https://docs.seismic.systems)
- **ethers.js**: See [ethers.js Documentation](https://docs.ethers.org)
- **Next.js**: Check [Next.js Docs](https://nextjs.org/docs)
- **Express**: See [Express Documentation](https://expressjs.com)

---

**Version**: 1.0  
**Last Updated**: January 5, 2026  
**Status**: ✅ All services integrated and running
