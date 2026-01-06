const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

let blockchainService = null;
let blockchainError = null;




try {
  blockchainService = require('./services/blockchain');
} catch (error) {
  console.error(' Blockchain service failed to initialize:', error.message);
  blockchainError = error;
}

const aiStrategy = require('./services/aiStrategy');

const app = express();


function requireBlockchainService(req, res, next) {
  if (!blockchainService) {
    return res.status(503).json({
      success: false,
      error: 'Blockchain service unavailable',
      details: blockchainError?.message || 'Unknown error'
    });
  }
  next();
}


app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`\n ${req.method} ${req.path}`);
  next();
});

// Simple in-memory log buffer + SSE clients
const sseClients = new Set();
const LOG_MAX = 200;
const recentLogs = [];

function addLog(level, message, meta) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    level,
    message: typeof message === 'string' ? message : JSON.stringify(message),
    meta: meta || null,
    timestamp: new Date().toISOString()
  };

  recentLogs.push(entry);
  if (recentLogs.length > LOG_MAX) recentLogs.shift();

  // Broadcast to SSE clients
  const payload = `data: ${JSON.stringify(entry)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch (e) {
      sseClients.delete(res);
    }
  }
}

const botStatus = {
  isActive: false,
  dailyTradeCount: 0,
  activePositions: 0,
  aiType: 'Free Technical Analysis',
  currentCoin: null,
  lastUpdate: null
};

// Helper to broadcast market/bot updates via SSE
function broadcastUpdate(eventType, data) {
  const payload = `event: ${eventType}\\ndata: ${JSON.stringify(data)}\\n\\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch (e) {
      sseClients.delete(res);
    }
  }
}

// Monkey-patch console so all logs flow through addLog as well
const originalConsoleLog = console.log.bind(console);
const originalConsoleError = console.error.bind(console);
console.log = (...args) => {
  originalConsoleLog(...args);
  try { addLog('info', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')); } catch (e) {}
};
console.error = (...args) => {
  originalConsoleError(...args);
  try { addLog('error', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')); } catch (e) {}
};

// SSE endpoint for live server logs / events
app.get('/api/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.flushHeaders?.();

  // Welcome + send recent history
  res.write(`event: welcome\ndata: ${JSON.stringify({ message: 'connected', now: new Date().toISOString() })}\n\n`);
  res.write(`event: history\ndata: ${JSON.stringify(recentLogs)}\n\n`);

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// Simple logs history endpoint
app.get('/api/logs', (req, res) => {
  res.json({ success: true, logs: recentLogs });
});

// ==================== CACHE SYSTEM ====================

const cache = new Map();
const pendingRequests = new Map();
const CACHE_DURATION = 30000; // 30 seconds
let lastAPICall = 0;
const MIN_API_INTERVAL = 2000; // 2 seconds

/**
 * Optimized caching with promise deduplication
 */
async function cachedFetch(key, fetchFunction, duration = CACHE_DURATION) {
  const now = Date.now();
  
  // Check for pending request
  if (pendingRequests.has(key)) {
    console.log(` Reusing pending request: ${key}`);
    return await pendingRequests.get(key);
  }
  
  // Check cache
  if (cache.has(key)) {
    const cached = cache.get(key);
    if (now - cached.timestamp < duration) {
      console.log(` Cache hit: ${key}`);
      return cached.data;
    }
  }
  
  // Create new request
  const fetchPromise = (async () => {
    try {
      // Rate limiting
      const timeSinceLastCall = now - lastAPICall;
      if (timeSinceLastCall < MIN_API_INTERVAL) {
        const waitTime = MIN_API_INTERVAL - timeSinceLastCall;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      lastAPICall = Date.now();
      const data = await fetchFunction();
      cache.set(key, { data, timestamp: Date.now() });
      return data;
      
    } catch (error) {
      // Return stale cache on error
      if (cache.has(key)) {
        console.log(` Using stale cache: ${key}`);
        return cache.get(key).data;
      }
      throw error;
    } finally {
      pendingRequests.delete(key);
    }
  })();
  
  pendingRequests.set(key, fetchPromise);
  return await fetchPromise;
}

// ==================== MARKET DATA FETCHING ====================

/**
 * Fetch prices from multiple sources (no rate limits)
 */
async function fetchPricesFromMultipleSources() {
  const sources = [
    // Source 1: Binance
    async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT', 'DOTUSDT'];
      const prices = await Promise.all(
        symbols.map(symbol => 
          axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, { 
            timeout: 5000 
          })
        )
      );
      return parseBinanceData(prices);
    },
    
    // Source 2: CryptoCompare
    async () => {
      const response = await axios.get('https://min-api.cryptocompare.com/data/pricemultifull', {
        params: {
          fsyms: 'BTC,ETH,SOL,ADA,XRP,DOT',
          tsyms: 'USD'
        },
        timeout: 5000
      });
      return parseCryptoCompareData(response.data);
    }
  ];
  
  // Try sources until one succeeds
  for (const source of sources) {
    try {
      return await source();
    } catch (error) {
      console.log(` Source failed, trying next...`);
      continue;
    }
  }
  
  // All failed, return mock data
  console.log('🎭 Using mock data');
  return getMockCoins();
}

function parseBinanceData(responses) {
  const coinMap = {
    BTCUSDT: { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc' },
    ETHUSDT: { id: 'ethereum', name: 'Ethereum', symbol: 'eth' },
    SOLUSDT: { id: 'solana', name: 'Solana', symbol: 'sol' },
    ADAUSDT: { id: 'cardano', name: 'Cardano', symbol: 'ada' },
    XRPUSDT: { id: 'ripple', name: 'XRP', symbol: 'xrp' },
    DOTUSDT: { id: 'polkadot', name: 'Polkadot', symbol: 'dot' }
  };
  
  return responses.map(response => {
    const data = response.data;
    const info = coinMap[data.symbol];
    return {
      id: info.id,
      symbol: info.symbol,
      name: info.name,
      current_price: parseFloat(data.lastPrice),
      price_change_percentage_24h: parseFloat(data.priceChangePercent),
      market_cap: parseFloat(data.quoteVolume) * parseFloat(data.lastPrice),
      total_volume: parseFloat(data.volume),
      sparkline_in_7d: {
        price: generateSparkline(parseFloat(data.lastPrice))
      }
    };
  });
}

function parseCryptoCompareData(data) {
  const coinMap = {
    BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana',
    ADA: 'cardano', XRP: 'ripple', DOT: 'polkadot'
  };
  
  return Object.entries(data.RAW).map(([symbol, info]) => ({
    id: coinMap[symbol],
    symbol: symbol.toLowerCase(),
    name: symbol,
    current_price: info.USD.PRICE,
    price_change_percentage_24h: info.USD.CHANGEPCT24HOUR,
    market_cap: info.USD.MKTCAP,
    total_volume: info.USD.TOTALVOLUME24HTO,
    sparkline_in_7d: {
      price: generateSparkline(info.USD.PRICE)
    }
  }));
}

function generateSparkline(basePrice) {
  return Array.from({ length: 168 }, (_, i) => {
    const trend = Math.sin(i / 20) * basePrice * 0.02;
    const noise = (Math.random() - 0.5) * basePrice * 0.01;
    return basePrice + trend + noise;
  });
}

function getMockCoins() {
  return [
    {
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      current_price: 45230.50,
      price_change_percentage_24h: 2.34,
      market_cap: 885000000000,
      total_volume: 28000000000,
      sparkline_in_7d: { price: generateSparkline(45230.50) }
    },
    {
      id: 'ethereum',
      symbol: 'eth',
      name: 'Ethereum',
      current_price: 2345.80,
      price_change_percentage_24h: -1.23,
      market_cap: 282000000000,
      total_volume: 15000000000,
      sparkline_in_7d: { price: generateSparkline(2345.80) }
    },
    {
      id: 'solana',
      symbol: 'sol',
      name: 'Solana',
      current_price: 98.45,
      price_change_percentage_24h: 5.67,
      market_cap: 43000000000,
      total_volume: 2500000000,
      sparkline_in_7d: { price: generateSparkline(98.45) }
    }
  ];
}

const MOCK_NEWS = [
  { title: 'Bitcoin shows strong bullish momentum as institutional adoption grows' },
  { title: 'Ethereum network upgrade brings improved scalability' },
  { title: 'Major partnership announcement boosts Solana ecosystem' }
];

// ==================== API ROUTES ====================

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    cacheSize: cache.size,
    pendingRequests: pendingRequests.size,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/coins
 * Get list of all supported coins
 */
app.get('/api/coins', async (req, res) => {
  try {
    const coins = await cachedFetch('all_coins', async () => {
      return await fetchPricesFromMultipleSources();
    });
    
    res.json({
      success: true,
      coins: coins.map(c => ({
        id: c.id,
        symbol: c.symbol,
        name: c.name,
        current_price: c.current_price,
        price_change_percentage_24h: c.price_change_percentage_24h
      }))
    });
  } catch (error) {
    console.error(' Error fetching coins:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/market/:coinId
 * Get detailed market data for specific coin
 */
app.get('/api/market/:coinId', async (req, res) => {
  const { coinId } = req.params;
  
  try {
    const coins = await cachedFetch('all_coins', async () => {
      return await fetchPricesFromMultipleSources();
    });
    
    const coin = coins.find(c => c.id === coinId);
    if (!coin) {
      return res.status(404).json({ 
        success: false, 
        error: 'Coin not found' 
      });
    }
    
    // Analyze with AI
    const analysis = await aiStrategy.analyzeMarket(
      coin,
      coin.sparkline_in_7d.price,
      MOCK_NEWS.filter(n => 
        n.title.toLowerCase().includes(coin.name.toLowerCase())
      )
    );
    
    res.json({
      success: true,
      data: {
        coin: {
          id: coin.id,
          name: coin.name,
          symbol: coin.symbol,
          current_price: coin.current_price,
          price_change_percentage_24h: coin.price_change_percentage_24h,
          market_cap: coin.market_cap,
          total_volume: coin.total_volume
        },
        chart: {
          prices: coin.sparkline_in_7d.price.slice(-24).map((price, i) => [
            Date.now() - (24 - i) * 3600000,
            price
          ])
        },
        analysis: {
          signal: analysis.signal,
          confidence: analysis.confidence,
          reasoning: analysis.reasoning,
          positionSize: analysis.positionSize
        },
        timestamp: Date.now()
      }
    });
    
    // Broadcast market update via SSE
    broadcastUpdate('market-update', {
      coin: {
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol,
        current_price: coin.current_price,
        price_change_percentage_24h: coin.price_change_percentage_24h,
        market_cap: coin.market_cap,
        total_volume: coin.total_volume
      },
      chart: {
        prices: coin.sparkline_in_7d.price.slice(-24).map((price, i) => [
          Date.now() - (24 - i) * 3600000,
          price
        ])
      },
      analysis: {
        signal: analysis.signal,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
        positionSize: analysis.positionSize
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error(' Market data error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analysis/:coinId
 * Get AI analysis for a coin (without full market data)
 */
app.get('/api/analysis/:coinId', async (req, res) => {
  const { coinId } = req.params;
  
  try {
    const coins = await cachedFetch('all_coins', async () => {
      return await fetchPricesFromMultipleSources();
    });
    
    const coin = coins.find(c => c.id === coinId);
    if (!coin) {
      return res.status(404).json({ 
        success: false, 
        error: 'Coin not found' 
      });
    }
    
    const analysis = await aiStrategy.analyzeMarket(
      coin,
      coin.sparkline_in_7d.price,
      MOCK_NEWS
    );
    
    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error(' Analysis error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blockchain/balance
 * Get user's private balance from smart contract
 */
app.get('/api/blockchain/balance', requireBlockchainService, async (req, res) => {
  try {
    const userAddress = req.query.address || blockchainService.wallet.address;
    const balance = await blockchainService.getBalance(userAddress);
    
    res.json({
      success: true,
      balance,
      address: userAddress
    });
  } catch (error) {
    console.error(' Balance error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blockchain/trades
 * Get user's trade history from smart contract
 */
app.get('/api/blockchain/trades', requireBlockchainService, async (req, res) => {
  try {
    const userAddress = req.query.address || blockchainService.wallet.address;
    const trades = await blockchainService.getTradeHistory(userAddress);
    
    res.json({
      success: true,
      trades
    });
  } catch (error) {
    console.error(' Trades error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/blockchain/positions
 * Get user's open positions from smart contract
 */
app.get('/api/blockchain/positions', requireBlockchainService, async (req, res) => {
  try {
    const userAddress = req.query.address || blockchainService.wallet.address;
    const positions = await blockchainService.getOpenPositions(userAddress);
    
    res.json({
      success: true,
      positions
    });
  } catch (error) {
    console.error(' Positions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/blockchain/deposit
 * Deposit funds into smart contract
 */
app.post('/api/blockchain/deposit', requireBlockchainService, async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid amount' 
      });
    }
    
    const receipt = await blockchainService.deposit(amount.toString());
    
    res.json({
      success: true,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber
    });
  } catch (error) {
    console.error(' Deposit error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/blockchain/withdraw
 * Withdraw funds from smart contract
 */
app.post('/api/blockchain/withdraw', requireBlockchainService, async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid amount' 
      });
    }
    
    const receipt = await blockchainService.withdraw(amount.toString());
    
    res.json({
      success: true,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber
    });
  } catch (error) {
    console.error(' Withdrawal error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/blockchain/trade
 * Execute a trade on the blockchain
 */
app.post('/api/blockchain/trade', requireBlockchainService, async (req, res) => {
  try {
    const { amount, price, isBuy, coinId } = req.body;
    
    // Validate inputs
    if (!amount || !price || isBuy === undefined || coinId === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }
    
    const result = await blockchainService.executeTrade({
      amount: amount.toString(),
      price: price.toString(),
      isBuy,
      coinId
    });
    
    res.json(result);
  } catch (error) {
    console.error(' Trade error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/blockchain/configure
 * Configure bot settings
 */
app.post('/api/blockchain/configure', requireBlockchainService, async (req, res) => {
  try {
    const config = req.body;
    
    const receipt = await blockchainService.configureBotSettings(config);
    
    res.json({
      success: true,
      transactionHash: receipt.transactionHash
    });
  } catch (error) {
    console.error(' Configuration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bot/start
 * Start automated trading bot
 */
app.post('/api/bot/start', async (req, res) => {
  try {
    const { coinId } = req.body;

    // prevent duplicate intervals
    if (global.tradingInterval) {
      console.log(' Trading bot already running - restarting interval');
      clearInterval(global.tradingInterval);
      global.tradingInterval = null;
    }

    botStatus.isActive = true;
    botStatus.lastStartedAt = new Date().toISOString();
    botStatus.currentCoin = coinId || 'all';
    addLog('info', `Trading bot started for ${coinId || 'all coins'}`);
    broadcastUpdate('bot-status', botStatus);

    // Start trading loop (1-minute intervals)
    global.tradingInterval = setInterval(async () => {
      try {
        const coins = await fetchPricesFromMultipleSources();
        const targetCoin = coinId 
          ? coins.find(c => c.id === coinId)
          : coins[0]; // Default to first coin

        if (!targetCoin) {
          console.error(' Coin not found');
          return;
        }

        // Analyze market
        const analysis = await aiStrategy.analyzeMarket(
          targetCoin,
          targetCoin.sparkline_in_7d.price,
          MOCK_NEWS
        );

        console.log(`\n [${new Date().toLocaleTimeString()}] Trading Check`);
        console.log(` ${targetCoin.name}: $${targetCoin.current_price.toFixed(2)}`);
        console.log(` Signal: ${analysis.signal} (${(analysis.confidence * 100).toFixed(1)}%)`);

        // Broadcast market update via SSE
        broadcastUpdate('market-update', {
          coin: {
            id: targetCoin.id,
            name: targetCoin.name,
            symbol: targetCoin.symbol,
            current_price: targetCoin.current_price,
            price_change_percentage_24h: targetCoin.price_change_percentage_24h,
            market_cap: targetCoin.market_cap,
            total_volume: targetCoin.total_volume
          },
          chart: {
            prices: targetCoin.sparkline_in_7d.price.slice(-24).map((price, i) => [
              Date.now() - (24 - i) * 3600000,
              price
            ])
          },
          analysis: {
            signal: analysis.signal,
            confidence: analysis.confidence,
            reasoning: analysis.reasoning,
            positionSize: analysis.positionSize
          },
          timestamp: Date.now()
        });

        // Update a simple status estimate
        if (analysis.signal !== 'HOLD' && analysis.confidence > 0.7) {
          console.log(` Would execute ${analysis.signal} trade!`);
          console.log(` ${analysis.reasoning}`);
          botStatus.dailyTradeCount = (botStatus.dailyTradeCount || 0) + 1;
          botStatus.activePositions = Math.min(5, (botStatus.activePositions || 0) + 1);
          botStatus.lastUpdate = new Date().toISOString();
          broadcastUpdate('bot-status', botStatus);
        }

      } catch (error) {
        console.error(' Trading loop error:', error);
      }
    }, 60000); // 1 minute

    res.json({
      success: true,
      message: 'Trading bot started (1-minute intervals)',
      coinId: coinId || 'all'
    });
  } catch (error) {
    console.error(' Bot start error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bot/stop
 * Stop automated trading bot
 */
app.post('/api/bot/stop', (req, res) => {
  if (global.tradingInterval) {
    clearInterval(global.tradingInterval);
    global.tradingInterval = null;
    botStatus.isActive = false;
    botStatus.lastUpdate = new Date().toISOString();
    addLog('info', 'Trading bot stopped');
    broadcastUpdate('bot-status', botStatus);

    res.json({
      success: true,
      message: 'Trading bot stopped'
    });
  } else {
    res.json({
      success: false,
      message: 'Bot is not running'
    });
  }
});

/**
 * GET /api/bot/status
 * Return the current bot status for frontend
 */
app.get('/api/bot/status', (req, res) => {
  res.json(botStatus);
});

/**
 * POST /api/cache/clear
 * Clear the cache (useful for debugging)
 */
app.post('/api/cache/clear', (req, res) => {
  cache.clear();
  pendingRequests.clear();
  
  res.json({
    success: true,
    message: 'Cache cleared'
  });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`\n Seismic Trading Bot Backend`);
  console.log(` Server: http://localhost:${PORT}`);
  console.log(` API Sources: Binance → CryptoCompare → Mock`);
  console.log(`⚡ Cache: ${CACHE_DURATION / 1000}s | Rate limit: ${MIN_API_INTERVAL}ms`);
  console.log(`\n🎯 Available Endpoints:`);
  console.log(`   GET  /api/health              - Health check`);
  console.log(`   GET  /api/coins               - List all coins`);
  console.log(`   GET  /api/market/:coinId      - Coin data + analysis`);
  console.log(`   GET  /api/analysis/:coinId    - AI analysis only`);
  console.log(`   GET  /api/blockchain/balance  - User balance`);
  console.log(`   GET  /api/blockchain/trades   - Trade history`);
  console.log(`   POST /api/blockchain/trade    - Execute trade`);
  console.log(`   POST /api/bot/start           - Start auto-trading`);
  console.log(`   POST /api/bot/stop            - Stop auto-trading`);
  console.log(`\n Using Seismic: ${process.env.SEISMIC_RPC_URL || 'Not configured'}`);
  console.log(` Contract: ${process.env.TRADING_CONTRACT_ADDRESS || 'Not deployed yet'}\n`);
  
  // Listen to blockchain events
  // if (blockchainService && process.env.TRADING_CONTRACT_ADDRESS) {
  //   blockchainService.listenToTradeEvents((event) => {
  //     console.log(`\n🔔 Trade event detected on blockchain!`);
  //     console.log(`   User: ${event.user}`);
  //     console.log(`   Type: ${event.isBuy ? 'BUY' : 'SELL'}`);
  //     // Send notification, update UI, etc.
  //   });
  // }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n Shutting down gracefully...');
  
  if (global.tradingInterval) {
    clearInterval(global.tradingInterval);
  }
  
  if (blockchainService) {
    blockchainService.stopListening();
  }
  
  process.exit(0);
});

module.exports = app;