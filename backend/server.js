// backend/server.js - FREE VERSION with Rate Limit Handling
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Cache for API responses
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Rate limiting tracker
let lastAPICall = 0;
const MIN_API_INTERVAL = 10000; // 10 seconds between calls

// Trading bot state
let botState = {
  isActive: false,
  lastTradeTime: null,
  dailyTradeCount: 0,
  currentPositions: [],
  tradingHistory: []
};

// Mock data for when APIs are rate limited


// FREE AI Analysis using technical indicators only
function analyzeMarketFree(coinData, newsData, historicalData) {
  try {
    const technicals = calculateIndicators(historicalData);
    const sentiment = analyzeNewsSentiment(newsData);
    const momentum = calculateMomentum(coinData);
    
    let confidence = 0.5;
    let signal = 'HOLD';
    
    // RSI signals (30% weight)
    if (technicals.rsi < 30) {
      confidence += 0.25;
      signal = 'BUY';
    } else if (technicals.rsi > 70) {
      confidence += 0.15;
      signal = 'SELL';
    } else if (technicals.rsi >= 40 && technicals.rsi <= 60) {
      confidence += 0.1;
    }
    
    // Moving average crossover (25% weight)
    if (technicals.sma20 > technicals.sma50) {
      confidence += 0.2;
      if (signal !== 'SELL') signal = 'BUY';
    }
    
    // MACD signals (20% weight)
    if (technicals.macd > 0 && technicals.signal > 0) {
      confidence += 0.15;
      if (signal !== 'SELL') signal = 'BUY';
    }
    
    // Sentiment (15% weight)
    if (sentiment.score > 0.6) {
      confidence += 0.1;
    }
    
    // Momentum (10% weight)
    if (momentum > 0) {
      confidence += 0.1;
    }
    
    const positionSize = Math.min(0.3, confidence * 0.4);
    const stopLoss = technicals.rsi < 40 ? -0.05 : -0.07;
    const takeProfit = confidence > 0.7 ? 0.12 : 0.08;
    const reasoning = generateReasoning(technicals, sentiment, momentum, signal);
    
    return {
      signal,
      confidence: Math.min(confidence, 1.0),
      positionSize,
      stopLoss,
      takeProfit,
      reasoning,
      technicals
    };
  } catch (error) {
    console.error('Free AI Analysis Error:', error);
    return {
      signal: 'HOLD',
      confidence: 0.5,
      positionSize: 0,
      reasoning: 'Error in analysis, defaulting to HOLD'
    };
  }
}

function generateReasoning(technicals, sentiment, momentum, signal) {
  const reasons = [];
  
  if (technicals.rsi < 35) {
    reasons.push('Oversold conditions detected (RSI: ' + technicals.rsi.toFixed(1) + ')');
  } else if (technicals.rsi > 65) {
    reasons.push('Overbought conditions detected (RSI: ' + technicals.rsi.toFixed(1) + ')');
  }
  
  if (technicals.sma20 > technicals.sma50) {
    reasons.push('Bullish trend confirmed by moving averages');
  } else if (technicals.sma20 < technicals.sma50) {
    reasons.push('Bearish trend indicated by moving averages');
  }
  
  if (technicals.macd > 0) {
    reasons.push('Positive MACD momentum');
  }
  
  if (sentiment.score > 0.6) {
    reasons.push('Positive market sentiment');
  } else if (sentiment.score < 0.4) {
    reasons.push('Negative market sentiment');
  }
  
  if (momentum > 3) {
    reasons.push('Strong upward price momentum (+' + momentum.toFixed(1) + '%)');
  } else if (momentum < -3) {
    reasons.push('Strong downward momentum (' + momentum.toFixed(1) + '%)');
  }
  
  return reasons.length > 0 
    ? `${signal}: ${reasons.join('. ')}`
    : `${signal} signal based on neutral market conditions`;
}

function analyzeNewsSentiment(newsData) {
  const positiveWords = ['bullish', 'surge', 'rally', 'breakthrough', 'adoption', 
                         'partnership', 'growth', 'gain', 'up', 'rise', 'positive', 'institutional'];
  const negativeWords = ['crash', 'bearish', 'decline', 'concern', 'regulatory', 
                         'hack', 'fall', 'down', 'negative', 'risk', 'fear', 'ban'];
  
  let score = 0.5;
  let newsCount = 0;
  
  newsData.forEach(article => {
    const text = article.title.toLowerCase();
    newsCount++;
    
    positiveWords.forEach(word => {
      if (text.includes(word)) score += 0.02;
    });
    
    negativeWords.forEach(word => {
      if (text.includes(word)) score -= 0.02;
    });
  });
  
  return {
    score: Math.max(0, Math.min(1, score)),
    newsCount
  };
}

function calculateMomentum(coinData) {
  return coinData.price_change_percentage_24h || 0;
}

// Cached API call wrapper
async function cachedFetch(key, fetchFunction, duration = CACHE_DURATION) {
  const now = Date.now();
  
  // Check cache first
  if (cache.has(key)) {
    const cached = cache.get(key);
    if (now - cached.timestamp < duration) {
      console.log(`Using cached data for: ${key}`);
      return cached.data;
    }
  }
  
  // Rate limiting
  const timeSinceLastCall = now - lastAPICall;
  if (timeSinceLastCall < MIN_API_INTERVAL) {
    const waitTime = MIN_API_INTERVAL - timeSinceLastCall;
    console.log(`Rate limiting: waiting ${waitTime}ms before API call`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  try {
    lastAPICall = Date.now();
    const data = await fetchFunction();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error(`API call failed for ${key}:`, error.message);
    
    // Return cached data even if expired, or mock data
    if (cache.has(key)) {
      console.log(`Using expired cache for: ${key}`);
      return cache.get(key).data;
    }
    
    throw error;
  }
}

// Fetch Market Data with caching and fallback
async function fetchMarketData() {
  try {
    const data = await cachedFetch('market_data', async () => {
      try {
        // Try CoinGecko
        const priceData = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
          params: {
            vs_currency: 'usd',
            order: 'market_cap_desc',
            per_page: 20,
            sparkline: true
          },
          timeout: 5000
        });

        return {
          coins: priceData.data,
          news: MOCK_DATA.news // Use mock news for now
        };
      } catch (error) {
        if (error.response?.status === 429) {
          console.log(' CoinGecko rate limit hit - using cached/mock data');
        }
        throw error;
      }
    }, 60000); // Cache for 1 minute

    return data;
  } catch (error) {
    console.log(' Using mock market data (API unavailable)');
    return MOCK_DATA;
  }
}

// Calculate Technical Indicators
function calculateIndicators(priceHistory) {
  const prices = priceHistory.map(p => typeof p === 'number' ? p : p.price);
  
  if (prices.length < 50) {
    const lastPrice = prices[prices.length - 1] || 50000;
    return { 
      rsi: 50, 
      sma20: lastPrice, 
      sma50: lastPrice, 
      macd: 0, 
      signal: 0 
    };
  }
  
  // RSI 
  const gains = [];
  const losses = [];
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? Math.abs(diff) : 0);
  }
  
  const avgGain = gains.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const avgLoss = losses.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  // Moving Averages
  const sma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const sma50 = prices.slice(-50).reduce((a, b) => a + b, 0) / 50;
  
  // Simple MACD
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;
  const signal = calculateEMA([macd], 9);
  
  return { rsi, sma20, sma50, macd, signal };
}

function calculateEMA(prices, period) {
  if (prices.length < period) return prices[prices.length - 1];
  
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(-period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

// Find Best Trading Opportunity
async function findBestTradingOpportunity() {
  const marketData = await fetchMarketData();
  const opportunities = [];
  
  for (const coin of marketData.coins.slice(0, 10)) {
    const analysis = analyzeMarketFree(
      coin,
      marketData.news.filter(n => 
        n.title.toLowerCase().includes(coin.symbol.toLowerCase())
      ),
      coin.sparkline_in_7d?.price || []
    );
    
    opportunities.push({
      coin,
      analysis,
      score: analysis.confidence
    });
  }
  
  return opportunities.sort((a, b) => b.score - a.score)[0];
}

app.get('/api/balance', async (req, res) => {
  try {
    // For demo, return mock balance
    // In production, query smart contract
    res.json({ balance: '1.2547' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/market', async (req, res) => {
  try {
    const marketData = await fetchMarketData();
    const opportunity = await findBestTradingOpportunity();
    
    res.json({
      chartData: opportunity.coin.sparkline_in_7d?.price.slice(-24).map((price, i) => ({
        time: `${i}h`,
        price: price
      })) || [],
      signal: opportunity.analysis.signal,
      sentiment: opportunity.analysis.confidence,
      reasoning: opportunity.analysis.reasoning,
      prices: {
        bitcoin: {
          usd: opportunity.coin.current_price,
          usd_24h_change: opportunity.coin.price_change_percentage_24h || 0
        }
      },
      news: { 
        articles: marketData.news.slice(0, 4).map(n => ({ title: n.title }))
      }
    });
  } catch (error) {
    console.error('Market API error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bot/start', async (req, res) => {
  const { userAddress, privateKey } = req.body;
  
  if (botState.isActive) {
    return res.json({ success: false, message: 'Bot is already running' });
  }
  
  botState.isActive = true;
  
  // Don't start interval in demo mode
  console.log(' Bot started (demo mode)');
  
  res.json({ 
    success: true, 
    message: 'Trading bot started with free AI analysis' 
  });
});

app.post('/api/bot/stop', (req, res) => {
  botState.isActive = false;
  console.log(' Bot stopped');
  res.json({ success: true, message: 'Trading bot stopped' });
});

app.get('/api/bot/status', (req, res) => {
  res.json({
    isActive: botState.isActive,
    dailyTradeCount: botState.dailyTradeCount,
    activePositions: botState.currentPositions.length,
    lastTradeTime: botState.lastTradeTime,
    aiType: 'Free Technical Analysis'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    cacheSize: cache.size,
    botActive: botState.isActive
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(` Seismic Trading Bot (FREE) running on port ${PORT}`);
  console.log(` Using 100% free tools - no API costs!`);
  console.log(` Rate limiting enabled: ${MIN_API_INTERVAL}ms between API calls`);
  console.log(` Caching enabled: ${CACHE_DURATION / 1000}s cache duration`);
  console.log(` Access dashboard at: http://localhost:${PORT}`);
});

module.exports = app;