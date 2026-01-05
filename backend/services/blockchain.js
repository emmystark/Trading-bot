// FILE: backend/services/blockchain.js
// PURPOSE: Handles ALL interactions with Seismic blockchain and smart contract

const { ethers } = require('ethers');
require('dotenv').config();
const contractABI = require('../../contracts/PrivateTradingBot.json');

/**
 * ====================================================================================
 * BLOCKCHAIN SERVICE
 * ====================================================================================
 * 
 * This service is the BRIDGE between your backend and Seismic blockchain
 * 
 * RESPONSIBILITIES:
 * 1. Connect to Seismic network
 * 2. Read data from smart contract (balances, trades)
 * 3. Write data to smart contract (execute trades)
 * 4. Sign transactions with private key
 * 5. Handle gas estimation and errors
 * 
 * ANALOGY (Web2):
 * - In Web2: You use 'pg' or 'mongoose' to connect to database
 * - In Web3: You use 'ethers.js' to connect to blockchain
 * - Smart Contract = Your database tables
 * - This service = Your database connection pool
 * ====================================================================================
 */

class BlockchainService {
  constructor() {
    // ==================== CONFIGURATION ====================
    
    /**
     * RPC URL: The HTTP endpoint to connect to Seismic nodes
     * Like: Database connection string in Web2
     * Example: "https://testnet-rpc.seismic.systems"
     */
    this.rpcUrl = process.env.SEISMIC_RPC_URL;
    
    /**
     * Private Key: Your wallet's secret key (NEVER SHARE!)
     * Like: Database password in Web2
     * Used to: Sign transactions (prove you authorized them)
     */
    this.privateKey = process.env.PRIVATE_KEY;
    
    /**
     * Contract Address: Where your smart contract lives on blockchain
     * Like: Table name in database
     * Example: "0x1234567890abcdef..."
     */
    this.contractAddress = process.env.TRADING_CONTRACT_ADDRESS;
    
    /**
     * Contract ABI: The "API documentation" of your smart contract
     * Tells ethers.js what functions exist and their parameters
     * Like: GraphQL schema or OpenAPI spec
     */
    this.contractABI = contractABI.abi || contractABI;
    
    // Initialize connections (happens in constructor)
    this._initializeProvider();
    this._initializeWallet();
    this._initializeContract();
  }
  
  
  // ==================== INITIALIZATION ====================
  
  /**
   * Initialize Provider
   * Provider = Connection to blockchain (read-only)
   * Like: Database read replica in Web2
   */
  _initializeProvider() {
    try {
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
      console.log('✅ Connected to Seismic network');
    } catch (error) {
      console.error('❌ Failed to connect to Seismic:', error);
      throw new Error('Blockchain connection failed');
    }
  }
  
  /**
   * Initialize Wallet
   * Wallet = Your private key + provider (read AND write)
   * Like: Database connection with write permissions
   */
  _initializeWallet() {
    try {
      this.wallet = new ethers.Wallet(this.privateKey, this.provider);
      console.log('✅ Wallet initialized:', this.wallet.address);
    } catch (error) {
      console.error('❌ Failed to initialize wallet:', error);
      throw new Error('Wallet initialization failed');
    }
  }
  
  /**
   * Initialize Contract
   * Contract = Interface to smart contract functions
   * Like: ORM model (e.g., User.findById() in Mongoose)
   */
  _initializeContract() {
    try {
      this.contract = new ethers.Contract(
        this.contractAddress,
        this.contractABI,
        this.wallet  // Use wallet (not provider) for write operations
      );
      console.log('✅ Contract connected:', this.contractAddress);
    } catch (error) {
      console.error('❌ Failed to connect to contract:', error);
      throw new Error('Contract initialization failed');
    }
  }
  
  
  // ==================== READ FUNCTIONS (Free, no gas) ====================
  
  /**
   * Get user's private balance
   * 
   * PRIVACY: Only the user can see their balance
   * If you try to read someone else's balance, you get 0
   * 
   * WEB2 EQUIVALENT:
   * const balance = await db.query('SELECT balance FROM users WHERE id = ?', [userId])
   * 
   * WEB3 VERSION:
   * const balance = await contract.getBalance()
   * 
   * @param {string} userAddress - User's wallet address
   * @returns {string} Balance in ETH (e.g., "1.5")
   */
  async getBalance(userAddress) {
    try {
      console.log(`📊 Reading balance for ${userAddress}...`);
      
      // Call smart contract's getBalance() function
      const balanceWei = await this.contract.getBalance();
      
      // Convert from wei (smallest unit) to ETH
      // 1 ETH = 1,000,000,000,000,000,000 wei (18 decimals)
      const balanceEth = ethers.formatEther(balanceWei);
      
      console.log(`💰 Balance: ${balanceEth} ETH`);
      return balanceEth;
      
    } catch (error) {
      console.error('❌ Failed to get balance:', error);
      throw error;
    }
  }
  
  /**
   * Get user's trade history
   * 
   * RETURNS: Array of trades with private data decrypted
   * Only the user can see their own trades
   * 
   * @param {string} userAddress - User's wallet address
   * @returns {Array} Array of trade objects
   */
  async getTradeHistory(userAddress) {
    try {
      console.log(`📜 Reading trade history for ${userAddress}...`);
      
      // Call contract function
      const trades = await this.contract.getTradeHistory();
      
      // Convert blockchain data to JavaScript objects
      const formattedTrades = trades.map(trade => ({
        amount: ethers.formatEther(trade.amount),
        price: ethers.formatUnits(trade.price, 18),
        isBuy: trade.isBuy,
        timestamp: new Date(Number(trade.timestamp) * 1000).toISOString(),
        coinId: Number(trade.coinId)
      }));
      
      console.log(`📊 Found ${formattedTrades.length} trades`);
      return formattedTrades;
      
    } catch (error) {
      console.error('❌ Failed to get trade history:', error);
      throw error;
    }
  }
  
  /**
   * Get user's open positions
   * 
   * @param {string} userAddress - User's wallet address
   * @returns {Array} Array of position objects
   */
  async getOpenPositions(userAddress) {
    try {
      console.log(`📊 Reading open positions for ${userAddress}...`);
      
      const positions = await this.contract.getOpenPositions();
      
      const formattedPositions = positions
        .filter(p => p.isActive) // Only active positions
        .map(position => ({
          entryPrice: ethers.formatUnits(position.entryPrice, 18),
          amount: ethers.formatEther(position.amount),
          stopLoss: ethers.formatUnits(position.stopLoss, 18),
          takeProfit: ethers.formatUnits(position.takeProfit, 18),
          openedAt: new Date(Number(position.openedAt) * 1000).toISOString(),
          coinId: Number(position.coinId)
        }));
      
      console.log(`📈 Found ${formattedPositions.length} open positions`);
      return formattedPositions;
      
    } catch (error) {
      console.error('❌ Failed to get positions:', error);
      throw error;
    }
  }
  
  /**
   * Get bot configuration
   * 
   * @param {string} userAddress - User's wallet address
   * @returns {Object} Bot config settings
   */
  async getBotConfig(userAddress) {
    try {
      console.log(`⚙️ Reading bot config for ${userAddress}...`);
      
      const config = await this.contract.getBotConfig();
      
      return {
        maxPositionSize: Number(config.maxPositionSize),
        dailyTradeLimit: Number(config.dailyTradeLimit),
        isActive: config.isActive,
        minConfidence: Number(config.minConfidence)
      };
      
    } catch (error) {
      console.error('❌ Failed to get bot config:', error);
      throw error;
    }
  }
  
  /**
   * Get public statistics
   * 
   * SAFE: This returns only non-private data
   * 
   * @returns {Object} Public stats
   */
  async getPublicStats() {
    try {
      const stats = await this.contract.getPublicStats();
      
      return {
        totalUsers: Number(stats[0]),
        totalTrades: Number(stats[1]),
        userDailyTrades: Number(stats[2])
      };
      
    } catch (error) {
      console.error('❌ Failed to get public stats:', error);
      throw error;
    }
  }
  
  
  // ==================== WRITE FUNCTIONS (Cost gas) ====================
  
  /**
   * Deposit funds into the contract
   * 
   * FLOW:
   * 1. User sends ETH to contract
   * 2. Contract converts it to private balance
   * 3. Only user can see this balance
   * 
   * WEB2 EQUIVALENT:
   * await db.query('UPDATE balances SET amount = amount + ? WHERE user = ?', [amount, userId])
   * 
   * WEB3 VERSION:
   * await contract.deposit({ value: amount })
   * 
   * @param {string} amountEth - Amount in ETH (e.g., "1.0")
   * @returns {Object} Transaction receipt
   */
  async deposit(amountEth) {
    try {
      console.log(`💰 Depositing ${amountEth} ETH...`);
      
      // Convert ETH to wei
      const amountWei = ethers.parseEther(amountEth);
      
      // Send transaction with ETH
      const tx = await this.contract.deposit({ 
        value: amountWei,
        gasLimit: 200000 // Set gas limit to avoid running out
      });
      
      console.log(`⏳ Transaction sent: ${tx.hash}`);
      console.log('   Waiting for confirmation...');
      
      // Wait for transaction to be mined (confirmed)
      const receipt = await tx.wait();
      
      console.log(`✅ Deposit confirmed! Block: ${receipt.blockNumber}`);
      return receipt;
      
    } catch (error) {
      console.error('❌ Deposit failed:', error);
      throw error;
    }
  }
  
  /**
   * Withdraw funds from contract
   * 
   * @param {string} amountEth - Amount in ETH to withdraw
   * @returns {Object} Transaction receipt
   */
  async withdraw(amountEth) {
    try {
      console.log(`💸 Withdrawing ${amountEth} ETH...`);
      
      const amountWei = ethers.parseEther(amountEth);
      
      const tx = await this.contract.withdraw(amountWei, {
        gasLimit: 200000
      });
      
      console.log(`⏳ Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      
      console.log(`✅ Withdrawal confirmed!`);
      return receipt;
      
    } catch (error) {
      console.error('❌ Withdrawal failed:', error);
      throw error;
    }
  }
  
  /**
   * Execute a trade (BUY or SELL)
   * 
   * THIS IS THE CORE FUNCTION - Called when AI generates signal
   * 
   * @param {Object} tradeParams - Trade parameters
   * @param {string} tradeParams.amount - Amount in ETH
   * @param {string} tradeParams.price - Current price in USD
   * @param {boolean} tradeParams.isBuy - true for BUY, false for SELL
   * @param {number} tradeParams.coinId - Coin identifier (0=BTC, 1=ETH, etc.)
   * @returns {Object} Transaction receipt
   */
  async executeTrade({ amount, price, isBuy, coinId }) {
    try {
      console.log(`\n🤖 Executing ${isBuy ? 'BUY' : 'SELL'} trade...`);
      console.log(`   Amount: ${amount} ETH`);
      console.log(`   Price: $${price}`);
      console.log(`   Coin: ${this._getCoinName(coinId)}`);
      
      // Convert to wei (blockchain's smallest unit)
      const amountWei = ethers.parseEther(amount);
      const priceWei = ethers.parseUnits(price, 18);
      
      // Call smart contract function
      const tx = await this.contract.executeTrade(
        amountWei,
        priceWei,
        isBuy,
        coinId,
        { gasLimit: 300000 }
      );
      
      console.log(`⏳ Transaction sent: ${tx.hash}`);
      console.log('   Waiting for blockchain confirmation...');
      
      // Wait for confirmation (usually 5-30 seconds)
      const receipt = await tx.wait();
      
      console.log(`✅ Trade confirmed! Block: ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
      
      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
      
    } catch (error) {
      console.error('❌ Trade execution failed:', error);
      
      // Parse error message from blockchain
      if (error.message.includes('Insufficient balance')) {
        throw new Error('Not enough balance to execute trade');
      } else if (error.message.includes('Daily trade limit')) {
        throw new Error('Daily trade limit reached');
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Open a position with stop-loss and take-profit
   * 
   * @param {Object} positionParams - Position parameters
   * @returns {Object} Transaction receipt
   */
  async openPosition({ amount, entryPrice, stopLoss, takeProfit, coinId }) {
    try {
      console.log(`\n📈 Opening position...`);
      console.log(`   Amount: ${amount} ETH`);
      console.log(`   Entry: $${entryPrice}`);
      console.log(`   Stop-Loss: $${stopLoss}`);
      console.log(`   Take-Profit: $${takeProfit}`);
      
      const amountWei = ethers.parseEther(amount);
      const entryPriceWei = ethers.parseUnits(entryPrice, 18);
      const stopLossWei = ethers.parseUnits(stopLoss, 18);
      const takeProfitWei = ethers.parseUnits(takeProfit, 18);
      
      const tx = await this.contract.openPosition(
        amountWei,
        entryPriceWei,
        stopLossWei,
        takeProfitWei,
        coinId,
        { gasLimit: 350000 }
      );
      
      console.log(`⏳ Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      
      console.log(`✅ Position opened!`);
      return receipt;
      
    } catch (error) {
      console.error('❌ Failed to open position:', error);
      throw error;
    }
  }
  
  /**
   * Close an open position
   * 
   * @param {number} positionIndex - Index in positions array
   * @param {string} currentPrice - Current market price
   * @returns {Object} Transaction receipt
   */
  async closePosition(positionIndex, currentPrice) {
    try {
      console.log(`\n📉 Closing position ${positionIndex}...`);
      console.log(`   Current price: $${currentPrice}`);
      
      const currentPriceWei = ethers.parseUnits(currentPrice, 18);
      
      const tx = await this.contract.closePosition(
        positionIndex,
        currentPriceWei,
        { gasLimit: 300000 }
      );
      
      console.log(`⏳ Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      
      console.log(`✅ Position closed!`);
      return receipt;
      
    } catch (error) {
      console.error('❌ Failed to close position:', error);
      throw error;
    }
  }
  
  /**
   * Configure bot settings
   * 
   * @param {Object} config - Bot configuration
   * @returns {Object} Transaction receipt
   */
  async configureBotSettings(config) {
    try {
      console.log(`⚙️ Configuring bot settings...`);
      
      const tx = await this.contract.configureBotSettings(
        config.maxPositionSize || 30,    // Default 30%
        config.dailyTradeLimit || 5,     // Default 5 trades/day
        config.isActive || true,         // Default active
        config.minConfidence || 70,      // Default 70%
        { gasLimit: 200000 }
      );
      
      console.log(`⏳ Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      
      console.log(`✅ Bot configured!`);
      return receipt;
      
    } catch (error) {
      console.error('❌ Failed to configure bot:', error);
      throw error;
    }
  }
  
  
  // ==================== UTILITY FUNCTIONS ====================
  
  /**
   * Get current gas price
   * Used to estimate transaction costs
   */
  async getGasPrice() {
    try {
      const feeData = await this.provider.getFeeData();
      const gasPriceGwei = ethers.formatUnits(feeData.gasPrice, 'gwei');
      console.log(`⛽ Current gas price: ${gasPriceGwei} Gwei`);
      return gasPriceGwei;
    } catch (error) {
      console.error('❌ Failed to get gas price:', error);
      return '0';
    }
  }
  
  /**
   * Get user's ETH balance (not contract balance)
   * This is their wallet balance, not trading balance
   */
  async getWalletBalance(address) {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('❌ Failed to get wallet balance:', error);
      return '0';
    }
  }
  
  /**
   * Check if contract is paused
   */
  async isPaused() {
    try {
      return await this.contract.isPaused();
    } catch (error) {
      console.error('❌ Failed to check pause status:', error);
      return true; // Assume paused on error (safe)
    }
  }
  
  /**
   * Listen for events from smart contract
   * Updates UI in real-time when trades execute
   * 
   * WEB2 EQUIVALENT: WebSocket or Server-Sent Events
   */
  async listenToTradeEvents(callback) {
    console.log('👂 Listening for trade events...');
    
    // Listen for TradeExecuted events
    this.contract.on('TradeExecuted', (user, timestamp, isBuy, coinId, event) => {
      console.log(`\n🔔 Trade Event Detected!`);
      console.log(`   User: ${user}`);
      console.log(`   Type: ${isBuy ? 'BUY' : 'SELL'}`);
      console.log(`   Coin: ${this._getCoinName(coinId)}`);
      console.log(`   Time: ${new Date(Number(timestamp) * 1000).toISOString()}`);
      
      // Call callback function (update UI, send notification, etc.)
      callback({
        user,
        timestamp: Number(timestamp),
        isBuy,
        coinId: Number(coinId),
        transactionHash: event.transactionHash
      });
    });
  }
  
  /**
   * Stop listening to events
   */
  stopListening() {
    this.contract.removeAllListeners();
    console.log('🔇 Stopped listening to events');
  }
  
  /**
   * Helper: Get coin name from ID
   */
  _getCoinName(coinId) {
    const coins = ['Bitcoin', 'Ethereum', 'Solana', 'Cardano', 'XRP', 'Polkadot'];
    return coins[coinId] || 'Unknown';
  }
}

// ==================== EXPORT ====================

// Create singleton instance
const blockchainService = new BlockchainService();

module.exports = blockchainService;

/**
 * ====================================================================================
 * USAGE EXAMPLES
 * ====================================================================================
 * 
 * // In your Express routes (backend/routes/bot.js):
 * 
 * const blockchainService = require('../services/blockchain');
 * 
 * // Get balance
 * app.get('/api/balance', async (req, res) => {
 *   const balance = await blockchainService.getBalance(req.user.address);
 *   res.json({ balance });
 * });
 * 
 * // Execute trade
 * app.post('/api/trade', async (req, res) => {
 *   const result = await blockchainService.executeTrade({
 *     amount: "0.1",
 *     price: "45000",
 *     isBuy: true,
 *     coinId: 0
 *   });
 *   res.json(result);
 * });
 * 
 * // Listen to events
 * blockchainService.listenToTradeEvents((event) => {
 *   console.log('New trade:', event);
 *   // Update dashboard, send notification, etc.
 * });
 * 
 * ====================================================================================
 * ENVIRONMENT VARIABLES NEEDED (.env)
 * ====================================================================================
 * 
 * SEISMIC_RPC_URL=https://testnet-rpc.seismic.systems
 * PRIVATE_KEY=0x1234567890abcdef... (YOUR PRIVATE KEY - NEVER COMMIT THIS!)
 * TRADING_CONTRACT_ADDRESS=0xabcdef123456... (FROM DEPLOYMENT)
 * 
 * ====================================================================================
 * ERROR HANDLING
 * ====================================================================================
 * 
 * All functions throw errors that you should catch:
 * 
 * try {
 *   await blockchainService.executeTrade(...);
 * } catch (error) {
 *   if (error.message.includes('Insufficient balance')) {
 *     res.status(400).json({ error: 'Not enough funds' });
 *   } else {
 *     res.status(500).json({ error: 'Blockchain error' });
 *   }
 * }
 * 
 * ====================================================================================
 */