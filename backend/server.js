require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
const { ethers } = require('ethers');
const CryptoJS = require('crypto-js');
const { generateWallet } = require('../shared/utils'); // From shared

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const provider = new ethers.JsonRpcProvider(process.env.SEISMIC_RPC);
let wallet; // Your unique test wallet

// Init wallet on start
(async () => {
  wallet = generateWallet(process.env.PRIVATE_KEY || 'random');
  wallet = wallet.connect(provider);
  console.log('Wallet address:', wallet.address); // Log once
})();

// Encryption util for privacy
function encryptData(data, key = process.env.ENCRYPTION_KEY) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
}
function decryptData(encrypted, key = process.env.ENCRYPTION_KEY) {
  const bytes = CryptoJS.AES.decrypt(encrypted, key);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

// Mock contract ABI for trade (deploy later)
const mockTradeABI = ['function enterTrade(address asset, uint amount) external', 'function exitTrade(address asset) external', 'function getBalance() view returns (uint)'];
const mockContractAddress = '0x...'; // Mock for now; replace with deployed
const mockContract = new ethers.Contract(mockContractAddress, mockTradeABI, wallet);

// Market analysis
async function analyzeMarket() {
  try {
    // Fetch prices from CoinGecko
    const { data: prices } = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true');
    
    // Fetch news from NewsAPI
    const { data: news } = await axios.get(`https://newsapi.org/v2/everything?q=crypto&apiKey=${process.env.NEWS_API_KEY}&sortBy=publishedAt&pageSize=5`);
    
    // Simple sentiment (keyword-based)
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
    console.error('Analysis error:', error);
    return { error: 'Failed to analyze' };
  }
}

// Enter trade mock
async function enterTrade(asset = 'bitcoin', amount = ethers.parseEther('0.01')) {
  try {
    const tx = await mockContract.enterTrade(ethers.getAddress('0x...asset'), amount); // Mock
    await tx.wait();
    const entryPrice = await getCurrentPrice(asset);
    const encryptedEntry = encryptData({ price: entryPrice, time: Date.now() });
    // Save to DB or file (mock: console)
    console.log('Entered trade:', encryptedEntry);
    return { success: true, txHash: tx.hash, entry: encryptedEntry };
  } catch (error) {
    console.error('Trade entry error:', error);
    return { success: false };
  }
}

// Exit on profit
async function checkAndExitTrades() {
  // Mock: Check if profit > 3%
  const currentPrice = await getCurrentPrice('bitcoin');
  // Assume stored entries; for demo, exit if random > 0.03
  if (Math.random() > 0.97) { // Simulate profit hit
    const tx = await mockContract.exitTrade(ethers.getAddress('0x...'));
    await tx.wait();
    console.log('Exited trade on profit');
    return { success: true, pnl: 3.2 };
  }
  return { success: false };
}

async function getCurrentPrice(asset) {
  const { data } = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${asset}&vs_currencies=usd`);
  return data[asset].usd;
}

async function getBalance() {
  try {
    const bal = await wallet.getBalance();
    const encryptedBal = encryptData({ wei: bal.toString() });
    return { balance: ethers.formatEther(bal) }; // Decrypt in frontend if needed
  } catch (error) {
    return { balance: '0' };
  }
}

// Cron: Analyze every 15min, trade if signal, check exit every 5min
cron.schedule('*/15 * * * *', async () => {
  const analysis = await analyzeMarket();
  if (analysis.signal === 'Buy') {
    await enterTrade();
  }
  console.log('Analysis:', analysis);
});

cron.schedule('*/5 * * * *', checkAndExitTrades);

// API Routes
app.get('/api/market', async (req, res) => {
  const analysis = await analyzeMarket();
  // Mock chart data
  const chartData = Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    price: 60000 + Math.random() * 1000
  }));
  res.json({ ...analysis, chartData });
});

app.get('/api/trades', (req, res) => {
  // Mock trades
  res.json([
    { id: '001', asset: 'BTC', entry: '$60,000', exit: null, pnl: 1.2, status: 'Active' },
    { id: '002', asset: 'ETH', entry: '$3,000', exit: '$3,090', pnl: 3, status: 'Closed' }
  ]);
});

app.get('/api/balance', getBalance);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});