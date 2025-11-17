require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
const { ethers } = require('ethers');
const CryptoJS = require('crypto-js');
const { generateWallet } = require('../shared/utils');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
let provider;
let wallet;
let mockContract = null; // Lazy init

// Encryption util for privacy
function encryptData(data, key = process.env.ENCRYPTION_KEY) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
}
function decryptData(encrypted, key = process.env.ENCRYPTION_KEY) {
  const bytes = CryptoJS.AES.decrypt(encrypted, key);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

// Init provider & wallet (async, with error handling)
async function initBlockchain(retries = 3) {
  const rpcUrl = process.env.SEISMIC_RPC?.trim();
  if (!rpcUrl || rpcUrl === 'https://internal-testnet.seismictest.net/rpc') {
    console.log('⚠️ Seismic RPC invalid/down — testing connection...');
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Create provider with timeout
      const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
        timeout: 10000,  // 10s timeout
        pollingInterval: 4000,
      });

      // Test connection: Get chain ID
      const chainId = await provider.getNetwork().then(net => net.chainId);
      console.log(`✅ Connected to chain ${chainId} (${rpcUrl})`);

      wallet = generateWallet(process.env.PRIVATE_KEY || 'random');
      wallet = wallet.connect(provider);
      await wallet.getAddress();  // Final test

      console.log('✅ Wallet ready:', wallet.address);
      console.log('🔗 Provider URL:', provider.connection.url || rpcUrl);  // Safe access
      return true;
    } catch (error) {
      console.error(`❌ Attempt ${attempt}/${retries} failed:`, error.message);
      if (attempt === retries) {
        console.log('🔄 All retries failed — falling back to Sepolia testnet');
        // Auto-fallback to working Sepolia
        return await initBlockchainWithFallback();
      }
      await new Promise(resolve => setTimeout(resolve, 2000));  // 2s delay
    }
  }
  return false;
}

// Fallback function (add this below initBlockchain)
async function initBlockchainWithFallback() {
  try {
    const fallbackUrl = 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';
    const provider = new ethers.JsonRpcProvider(fallbackUrl);
    const chainId = await provider.getNetwork().then(net => net.chainId);
    console.log(`✅ Fallback connected to Sepolia (chain ${chainId})`);

    wallet = generateWallet(process.env.PRIVATE_KEY || 'random');
    wallet = wallet.connect(provider);
    await wallet.getAddress();

    console.log('✅ Wallet ready (fallback):', wallet.address);
    console.log('🔗 Fallback Provider:', fallbackUrl);
    return true;
  } catch (error) {
    console.error('❌ Even fallback failed:', error.message);
    return false;
  }
}

// Lazy contract init (only when needed, with valid address)
async function getMockContract() {
  if (mockContract) return mockContract;

  const isConnected = await initBlockchain();  // Uses retries + fallback
  const mockAddress = ethers.ZeroAddress; // Valid: 0x0000000000000000000000000000000000000000 – no ENS resolution
  const mockTradeABI = [
    'function enterTrade(address asset, uint amount) external',
    'function exitTrade(address asset) external',
    'function getBalance() view returns (uint)'
  ];

  if (isConnected) {
    try {
      mockContract = new ethers.Contract(mockAddress, mockTradeABI, wallet);
      console.log('📄 Mock contract connected');
      return mockContract;
    } catch (error) {
      console.error('⚠️ Contract connect failed:', error.message);
      console.log('🔄 Using full MOCK mode');
    }
  }

  // Full mock fallback (no blockchain)
  mockContract = {
    enterTrade: async (asset, amount) => ({ hash: '0xmock' + Math.random().toString(16), success: true }),
    exitTrade: async (asset) => ({ hash: '0xmock-exit', success: true, pnl: Math.random() * 5 }),
    getBalance: async () => ethers.parseEther('1.0') // Mock 1 ETH
  };
  console.log('🎭 Full mock contract active');
  return mockContract;
}

// Market analysis (unchanged, but with error handling)
async function analyzeMarket() {
  try {
    const { data: prices } = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true');
    const { data: news } = await axios.get(`https://newsapi.org/v2/everything?q=crypto&apiKey=${process.env.NEWS_API_KEY || ''}&sortBy=publishedAt&pageSize=5`);
    
    const positiveWords = ['surge', 'rally', 'bullish', 'gain'];
    const sentiment = news.articles.reduce((score, article) => {
      const text = article.title + ' ' + article.description;
      const posCount = positiveWords.filter(word => text.toLowerCase().includes(word)).length;
      return score + (posCount > 0 ? 0.5 : -0.2);
    }, 0) / news.articles.length;

    const btcChange = prices.bitcoin.usd_24h_change;
    const signal = (btcChange > 1 && sentiment > 0.3) ? 'Buy' : 'Hold';

    return { prices, news, sentiment: Math.round(sentiment * 10) / 10, signal };
  } catch (error) {
    console.error('Analysis error:', error.message);
    return { error: 'Failed to analyze', signal: 'Hold' };
  }
}

// Enter trade (now async-safe)
async function enterTrade(asset = 'bitcoin', amount = ethers.parseEther('0.01')) {
  try {
    const contract = await getMockContract();
    const assetAddr = ethers.ZeroAddress; // Mock asset address
    const tx = await contract.enterTrade(assetAddr, amount);
    const entryPrice = await getCurrentPrice(asset);
    const encryptedEntry = encryptData({ price: entryPrice, time: Date.now() });
    console.log('✅ Entered trade:', tx.hash || 'mock');
    return { success: true, txHash: tx.hash || '0xmock', entry: encryptedEntry };
  } catch (error) {
    console.error('Trade entry error:', error.message);
    return { success: false, error: error.message };
  }
}

// Exit on profit (now async-safe)
async function checkAndExitTrades() {
  try {
    const contract = await getMockContract();
    const assetAddr = ethers.ZeroAddress;
    const tx = await contract.exitTrade(assetAddr);
    const pnl = tx.pnl || (Math.random() > 0.5 ? 3.2 : -1.1); // Mock profit
    console.log('✅ Exited trade:', tx.hash || 'mock', `P&L: ${pnl}%`);
    return { success: true, pnl };
  } catch (error) {
    console.error('Exit error:', error.message);
    return { success: false };
  }
}

async function getCurrentPrice(asset) {
  try {
    const { data } = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${asset}&vs_currencies=usd`);
    return data[asset].usd;
  } catch (error) {
    return 60000; // Mock BTC price
  }
}

async function getBalance() {
  try {
    const contract = await getMockContract();
    const bal = await contract.getBalance();
    const encryptedBal = encryptData({ wei: bal.toString() });
    return { balance: ethers.formatEther(bal) };
  } catch (error) {
    return { balance: '1.0' }; // Mock
  }
}

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), blockchainReady: !!provider });
});

// API Routes (async-safe)
app.get('/api/market', async (req, res) => {
    try {
      const analysis = await analyzeMarket();
      
      // ALWAYS return chartData, even in mock
      const chartData = Array.from({ length: 24 }, (_, i) => ({
        time: `${String(i).padStart(2, '0')}:00`,
        price: 60000 + Math.random() * 2000 + i * 50
      }));
  
      res.json({ 
        ...analysis, 
        chartData // ← This must be here
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Market data failed', 
        chartData: [],
        signal: 'Hold'
      });
    }
  });

app.get('/api/trades', async (req, res) => {
  // Mock trades (add real DB later)
  res.json([
    { id: '001', asset: 'BTC', entry: '$60,000', exit: null, pnl: 1.2, status: 'Active' },
    { id: '002', asset: 'ETH', entry: '$3,000', exit: '$3,090', pnl: 3, status: 'Closed' }
  ]);
});

app.get('/api/balance', getBalance);

// Start server & cron (wait for blockchain)
async function startApp() {
  await initBlockchain(); // Early init

  // Cron: Only after ready
  cron.schedule('*/15 * * * *', async () => {
    const analysis = await analyzeMarket();
    if (analysis.signal === 'Buy') {
      await enterTrade();
    }
    console.log('📊 Analysis:', analysis);
  });

  cron.schedule('*/5 * * * *', checkAndExitTrades);

  app.listen(PORT, () => {
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
    console.log(`📡 Health: http://localhost:${PORT}/health`);
  });
}

startApp().catch(console.error);