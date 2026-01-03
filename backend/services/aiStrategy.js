// FILE: backend/services/aiStrategy.js
// PURPOSE: AI-powered trading strategy that analyzes market and generates signals

const axios = require('axios');

/**
 * ====================================================================================
 * AI TRADING STRATEGY SERVICE
 * ====================================================================================
 * 
 * This service is the "BRAIN" of your trading bot
 * 
 * WHAT IT DOES:
 * 1. Fetches market data (prices, volume, news)
 * 2. Calculates technical indicators (RSI, MACD, Moving Averages)
 * 3. Analyzes market sentiment from news
 * 4. Generates BUY/SELL/HOLD signals with confidence scores
 * 5. Determines position size and risk management
 * 
 * ANALOGY:
 * - Input: Market conditions (like weather data)
 * - Processing: Technical analysis (like meteorology models)
 * - Output: Trading decision (like weather forecast)
 * 
 * ====================================================================================
 */

class AITradingStrategy {
  constructor() {
    // Strategy configuration
    this.config = {
      // Risk Management
      MAX_POSITION_SIZE: 0.30,      // Max 30% of balance per trade
      MIN_CONFIDENCE: 0.70,         // Min 70% confidence to trade
      STOP_LOSS_PERCENT: -0.05,     // Stop-loss at -5%
      TAKE_PROFIT_PERCENT: 0.10,    // Take-profit at +10%
      
      // Technical Indicators
      RSI_OVERSOLD: 30,             // RSI below 30 = oversold (BUY signal)
      RSI_OVERBOUGHT: 70,           // RSI above 70 = overbought (SELL signal)
      RSI_PERIOD: 14,               // 14-period RSI
      
      // Moving Averages
      SMA_SHORT_PERIOD: 20,         // 20-period short MA
      SMA_LONG_PERIOD: 50,          // 50-period long MA
      
      // Weights for scoring (must add to 1.0)
      WEIGHTS: {
        technicals: 0.35,           // 35% weight to technical indicators
        sentiment: 0.25,            // 25% weight to news sentiment
        momentum: 0.25,             // 25% weight to price momentum
        volume: 0.15                // 15% weight to volume analysis
      }
    };
  }
  
  
  // ==================== MAIN ANALYSIS FUNCTION ====================
  
  /**
   * Analyze market and generate trading signal
   * 
   * THIS IS THE MAIN FUNCTION - Called by trading bot every minute/hour
   * 
   * @param {Object} marketData - Current market data
   * @param {Array} priceHistory - Historical prices (for indicators)
   * @param {Array} newsData - Recent news articles
   * @returns {Object} Trading decision with signal, confidence, and reasoning
   * 
   * FLOW:
   * 1. Calculate technical indicators (RSI, MACD, MA)
   * 2. Analyze news sentiment (positive/negative)
   * 3. Calculate price momentum and volume
   * 4. Combine all factors with weighted scoring
   * 5. Generate BUY/SELL/HOLD signal with confidence
   * 6. Calculate position size and risk parameters
   */
  async analyzeMarket(marketData, priceHistory, newsData = []) {
    try {
      console.log(`\n🧠 AI Analysis Starting...`);
      console.log(`   Coin: ${marketData.name}`);
      console.log(`   Current Price: $${marketData.current_price}`);
      console.log(`   24h Change: ${marketData.price_change_percentage_24h?.toFixed(2)}%`);
      
      // Step 1: Calculate Technical Indicators
      const technicals = this.calculateTechnicalIndicators(priceHistory);
      console.log(`\n📊 Technical Indicators:`);
      console.log(`   RSI: ${technicals.rsi.toFixed(2)}`);
      console.log(`   MACD: ${technicals.macd.toFixed(2)}`);
      console.log(`   SMA20: $${technicals.sma20.toFixed(2)}`);
      console.log(`   SMA50: $${technicals.sma50.toFixed(2)}`);
      
      // Step 2: Analyze News Sentiment
      const sentiment = this.analyzeNewsSentiment(newsData);
      console.log(`\n📰 News Sentiment: ${(sentiment.score * 100).toFixed(1)}%`);
      console.log(`   Articles analyzed: ${sentiment.articleCount}`);
      
      // Step 3: Calculate Momentum
      const momentum = this.calculateMomentum(marketData, priceHistory);
      console.log(`\n📈 Momentum Score: ${momentum.toFixed(2)}`);
      
      // Step 4: Analyze Volume
      const volumeScore = this.analyzeVolume(marketData);
      console.log(`💹 Volume Score: ${volumeScore.toFixed(2)}`);
      
      // Step 5: Generate Trading Signal
      const decision = this.generateTradingSignal(
        technicals,
        sentiment,
        momentum,
        volumeScore,
        marketData
      );
      
      console.log(`\n🎯 DECISION: ${decision.signal}`);
      console.log(`   Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
      console.log(`   Position Size: ${(decision.positionSize * 100).toFixed(1)}%`);
      console.log(`   Reasoning: ${decision.reasoning}`);
      
      return decision;
      
    } catch (error) {
      console.error('❌ AI Analysis Error:', error);
      // Return safe HOLD signal on error
      return {
        signal: 'HOLD',
        confidence: 0.5,
        positionSize: 0,
        reasoning: 'Error in analysis, defaulting to HOLD',
        error: error.message
      };
    }
  }
  
  
  // ==================== TECHNICAL INDICATORS ====================
  
  /**
   * Calculate all technical indicators
   * 
   * INDICATORS EXPLAINED:
   * - RSI (Relative Strength Index): Measures if asset is overbought/oversold
   * - MACD (Moving Average Convergence Divergence): Shows trend strength
   * - SMA (Simple Moving Average): Average price over period
   * 
   * @param {Array} priceHistory - Array of historical prices
   * @returns {Object} Technical indicators
   */
  calculateTechnicalIndicators(priceHistory) {
    // Extract just the prices from history
    const prices = priceHistory.map(p => 
      typeof p === 'number' ? p : (p.price || p[1])
    );
    
    // Need at least 50 data points for accurate indicators
    if (prices.length < 50) {
      console.warn('⚠️ Not enough historical data, using defaults');
      return {
        rsi: 50,
        sma20: prices[prices.length - 1] || 0,
        sma50: prices[prices.length - 1] || 0,
        macd: 0,
        signal: 0
      };
    }
    
    // Calculate RSI
    const rsi = this._calculateRSI(prices, this.config.RSI_PERIOD);
    
    // Calculate Simple Moving Averages
    const sma20 = this._calculateSMA(prices, this.config.SMA_SHORT_PERIOD);
    const sma50 = this._calculateSMA(prices, this.config.SMA_LONG_PERIOD);
    
    // Calculate MACD
    const macd = this._calculateMACD(prices);
    
    return {
      rsi,
      sma20,
      sma50,
      macd: macd.macdLine,
      signal: macd.signalLine,
      histogram: macd.histogram
    };
  }
  
  /**
   * Calculate RSI (Relative Strength Index)
   * 
   * HOW IT WORKS:
   * - RSI < 30: Oversold (potential BUY)
   * - RSI > 70: Overbought (potential SELL)
   * - RSI 40-60: Neutral
   * 
   * FORMULA:
   * RSI = 100 - (100 / (1 + RS))
   * RS = Average Gain / Average Loss
   */
  _calculateRSI(prices, period = 14) {
    const gains = [];
    const losses = [];
    
    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    // Calculate average gain and loss
    const avgGain = this._average(gains.slice(-period));
    const avgLoss = this._average(losses.slice(-period));
    
    // Handle edge case
    if (avgLoss === 0) return 100;
    
    // Calculate RS and RSI
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
  }
  
  /**
   * Calculate Simple Moving Average
   * 
   * HOW IT WORKS:
   * - Average of last N prices
   * - Smooths out price action
   * - SMA20 > SMA50: Uptrend (bullish)
   * - SMA20 < SMA50: Downtrend (bearish)
   */
  _calculateSMA(prices, period) {
    const subset = prices.slice(-period);
    return this._average(subset);
  }
  
  /**
   * Calculate MACD
   * 
   * HOW IT WORKS:
   * - MACD = 12-day EMA - 26-day EMA
   * - Signal = 9-day EMA of MACD
   * - Histogram = MACD - Signal
   * - MACD > Signal: Bullish
   * - MACD < Signal: Bearish
   */
  _calculateMACD(prices) {
    const ema12 = this._calculateEMA(prices, 12);
    const ema26 = this._calculateEMA(prices, 26);
    const macdLine = ema12 - ema26;
    
    // For simplicity, use approximate signal line
    const signalLine = macdLine * 0.9;
    const histogram = macdLine - signalLine;
    
    return { macdLine, signalLine, histogram };
  }
  
  /**
   * Calculate Exponential Moving Average
   * 
   * EMA gives more weight to recent prices
   */
  _calculateEMA(prices, period) {
    if (prices.length < period) return prices[prices.length - 1];
    
    const multiplier = 2 / (period + 1);
    let ema = this._average(prices.slice(-period)); // Start with SMA
    
    // Apply EMA formula
    for (let i = prices.length - period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }
  
  
  // ==================== SENTIMENT ANALYSIS ====================
  
  /**
   * Analyze news sentiment
   * 
   * APPROACH:
   * 1. Count positive keywords (bullish, surge, gain, etc.)
   * 2. Count negative keywords (crash, fall, decline, etc.)
   * 3. Calculate sentiment score (0 = very negative, 1 = very positive)
   * 
   * @param {Array} newsData - Array of news articles
   * @returns {Object} Sentiment analysis
   */
  analyzeNewsSentiment(newsData) {
    // Keywords that indicate positive sentiment
    const positiveKeywords = [
      'bullish', 'surge', 'rally', 'breakthrough', 'adoption',
      'partnership', 'growth', 'gain', 'up', 'rise', 'positive',
      'institutional', 'milestone', 'record', 'soar', 'jump'
    ];
    
    // Keywords that indicate negative sentiment
    const negativeKeywords = [
      'crash', 'bearish', 'decline', 'concern', 'regulatory',
      'hack', 'fall', 'down', 'negative', 'risk', 'fear',
      'ban', 'lawsuit', 'fraud', 'scam', 'drop', 'plunge'
    ];
    
    let score = 0.5; // Start neutral
    let positiveCount = 0;
    let negativeCount = 0;
    
    newsData.forEach(article => {
      const text = (article.title + ' ' + (article.description || '')).toLowerCase();
      
      // Count positive keywords
      positiveKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          positiveCount++;
          score += 0.02; // Small boost per keyword
        }
      });
      
      // Count negative keywords
      negativeKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          negativeCount++;
          score -= 0.02; // Small penalty per keyword
        }
      });
    });
    
    // Clamp score between 0 and 1
    score = Math.max(0, Math.min(1, score));
    
    return {
      score,
      positiveCount,
      negativeCount,
      articleCount: newsData.length,
      interpretation: this._interpretSentiment(score)
    };
  }
  
  _interpretSentiment(score) {
    if (score >= 0.7) return 'Very Positive';
    if (score >= 0.6) return 'Positive';
    if (score >= 0.4) return 'Neutral';
    if (score >= 0.3) return 'Negative';
    return 'Very Negative';
  }
  
  
  // ==================== MOMENTUM ANALYSIS ====================
  
  /**
   * Calculate price momentum
   * 
   * MEASURES:
   * - Short-term momentum: Last 24h change
   * - Medium-term momentum: Last 7d trend
   * - Acceleration: Is momentum increasing?
   * 
   * @param {Object} marketData - Current market data
   * @param {Array} priceHistory - Historical prices
   * @returns {number} Momentum score (-10 to +10)
   */
  calculateMomentum(marketData, priceHistory) {
    // 24-hour momentum
    const momentum24h = marketData.price_change_percentage_24h || 0;
    
    // 7-day momentum (if available)
    let momentum7d = 0;
    if (priceHistory.length >= 168) { // 7 days of hourly data
      const weekAgo = priceHistory[priceHistory.length - 168];
      const current = priceHistory[priceHistory.length - 1];
      const weekAgoPrice = typeof weekAgo === 'number' ? weekAgo : weekAgo.price;
      const currentPrice = typeof current === 'number' ? current : current.price;
      momentum7d = ((currentPrice - weekAgoPrice) / weekAgoPrice) * 100;
    }
    
    // Combine short and medium term (weighted)
    const combinedMomentum = (momentum24h * 0.6) + (momentum7d * 0.4);
    
    return combinedMomentum;
  }
  
  
  // ==================== VOLUME ANALYSIS ====================
  
  /**
   * Analyze trading volume
   * 
   * HIGH VOLUME + PRICE UP = Strong bullish signal
   * HIGH VOLUME + PRICE DOWN = Strong bearish signal
   * LOW VOLUME = Weak signal (ignore)
   * 
   * @param {Object} marketData - Current market data
   * @returns {number} Volume score (0 to 1)
   */
  analyzeVolume(marketData) {
    const currentVolume = marketData.total_volume || 0;
    const avgVolume = marketData.market_cap / 100; // Rough estimate
    
    if (currentVolume === 0 || avgVolume === 0) return 0.5;
    
    const volumeRatio = currentVolume / avgVolume;
    
    // High volume (> 1.5x average)
    if (volumeRatio > 1.5) return 0.8;
    
    // Normal volume (0.7x to 1.5x average)
    if (volumeRatio > 0.7) return 0.6;
    
    // Low volume (< 0.7x average)
    return 0.4;
  }
  
  
  // ==================== SIGNAL GENERATION ====================
  
  /**
   * Generate final trading signal
   * 
   * COMBINES:
   * - Technical indicators (35% weight)
   * - News sentiment (25% weight)
   * - Price momentum (25% weight)
   * - Volume analysis (15% weight)
   * 
   * OUTPUT:
   * - signal: 'BUY', 'SELL', or 'HOLD'
   * - confidence: 0 to 1 (how sure we are)
   * - positionSize: 0 to 0.3 (% of balance to use)
   * - stopLoss: Where to cut losses (e.g., -5%)
   * - takeProfit: Where to take profits (e.g., +10%)
   * - reasoning: Human-readable explanation
   */
  generateTradingSignal(technicals, sentiment, momentum, volumeScore, marketData) {
    // Initialize scores
    let buyScore = 0;
    let sellScore = 0;
    
    // 1. TECHNICAL INDICATORS (35% weight)
    const techWeight = this.config.WEIGHTS.technicals;
    
    // RSI signals
    if (technicals.rsi < this.config.RSI_OVERSOLD) {
      buyScore += 0.3 * techWeight;
    } else if (technicals.rsi > this.config.RSI_OVERBOUGHT) {
      sellScore += 0.3 * techWeight;
    }
    
    // Moving average crossover
    if (technicals.sma20 > technicals.sma50) {
      buyScore += 0.25 * techWeight;
    } else if (technicals.sma20 < technicals.sma50) {
      sellScore += 0.25 * techWeight;
    }
    
    // MACD
    if (technicals.macd > technicals.signal) {
      buyScore += 0.2 * techWeight;
    } else {
      sellScore += 0.2 * techWeight;
    }
    
    // 2. SENTIMENT (25% weight)
    const sentWeight = this.config.WEIGHTS.sentiment;
    if (sentiment.score > 0.6) {
      buyScore += (sentiment.score - 0.5) * sentWeight;
    } else if (sentiment.score < 0.4) {
      sellScore += (0.5 - sentiment.score) * sentWeight;
    }
    
    // 3. MOMENTUM (25% weight)
    const momWeight = this.config.WEIGHTS.momentum;
    if (momentum > 3) {
      buyScore += (momentum / 10) * momWeight;
    } else if (momentum < -3) {
      sellScore += (Math.abs(momentum) / 10) * momWeight;
    }
    
    // 4. VOLUME (15% weight)
    const volWeight = this.config.WEIGHTS.volume;
    if (volumeScore > 0.7) {
      // High volume amplifies the stronger signal
      if (buyScore > sellScore) {
        buyScore += volWeight;
      } else {
        sellScore += volWeight;
      }
    }
    
    // Determine signal and confidence
    let signal = 'HOLD';
    let confidence = 0.5;
    
    if (buyScore > sellScore && buyScore > this.config.MIN_CONFIDENCE) {
      signal = 'BUY';
      confidence = Math.min(buyScore, 1.0);
    } else if (sellScore > buyScore && sellScore > this.config.MIN_CONFIDENCE) {
      signal = 'SELL';
      confidence = Math.min(sellScore, 1.0);
    } else {
      confidence = Math.max(buyScore, sellScore);
    }
    
    // Calculate position size (more confidence = larger position)
    const positionSize = Math.min(
      confidence * this.config.MAX_POSITION_SIZE,
      this.config.MAX_POSITION_SIZE
    );
    
    // Risk management
    const stopLoss = this.config.STOP_LOSS_PERCENT;
    const takeProfit = this.config.TAKE_PROFIT_PERCENT * (confidence / 0.7);
    
    // Generate reasoning
    const reasoning = this._generateReasoning(
      signal,
      technicals,
      sentiment,
      momentum,
      volumeScore
    );
    
    return {
      signal,
      confidence,
      positionSize,
      stopLoss,
      takeProfit,
      reasoning,
      scores: { buyScore, sellScore },
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Generate human-readable reasoning for the decision
   */
  _generateReasoning(signal, technicals, sentiment, momentum, volumeScore) {
    const reasons = [];
    
    // Technical reasons
    if (technicals.rsi < 35) {
      reasons.push(`Oversold (RSI: ${technicals.rsi.toFixed(1)})`);
    } else if (technicals.rsi > 65) {
      reasons.push(`Overbought (RSI: ${technicals.rsi.toFixed(1)})`);
    }
    
    if (technicals.sma20 > technicals.sma50) {
      reasons.push('Bullish moving average crossover');
    } else if (technicals.sma20 < technicals.sma50) {
      reasons.push('Bearish moving average crossover');
    }
    
    if (technicals.macd > 0) {
      reasons.push('Positive MACD momentum');
    }
    
    // Sentiment reasons
    if (sentiment.score > 0.6) {
      reasons.push(`Positive sentiment (${(sentiment.score * 100).toFixed(0)}%)`);
    } else if (sentiment.score < 0.4) {
      reasons.push(`Negative sentiment (${(sentiment.score * 100).toFixed(0)}%)`);
    }
    
    // Momentum reasons
    if (momentum > 3) {
      reasons.push(`Strong upward momentum (+${momentum.toFixed(1)}%)`);
    } else if (momentum < -3) {
      reasons.push(`Strong downward momentum (${momentum.toFixed(1)}%)`);
    }
    
    // Volume reasons
    if (volumeScore > 0.7) {
      reasons.push('High trading volume confirms signal');
    }
    
    return reasons.length > 0
      ? `${signal}: ${reasons.join('. ')}`
      : `${signal} based on neutral market conditions`;
  }
  
  
  // ==================== UTILITY FUNCTIONS ====================
  
  _average(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}

// Export singleton instance
const aiStrategy = new AITradingStrategy();
module.exports = aiStrategy;

/**
 * ====================================================================================
 * USAGE EXAMPLE
 * ====================================================================================
 * 
 * const aiStrategy = require('./services/aiStrategy');
 * 
 * // Get market data
 * const marketData = {
 *   name: 'Bitcoin',
 *   current_price: 45230.50,
 *   price_change_percentage_24h: 2.34,
 *   total_volume: 28000000000,
 *   market_cap: 885000000000
 * };
 * 
 * // Get historical prices (168 = 7 days of hourly data)
 * const priceHistory = [45000, 45100, 45200, ...];
 * 
 * // Get news
 * const newsData = [
 *   { title: 'Bitcoin surges to new highs' },
 *   { title: 'Institutional adoption grows' }
 * ];
 * 
 * // Analyze and get trading signal
 * const decision = await aiStrategy.analyzeMarket(marketData, priceHistory, newsData);
 * 
 * console.log(decision);
 * // {
 * //   signal: 'BUY',
 * //   confidence: 0.78,
 * //   positionSize: 0.23,
 * //   stopLoss: -0.05,
 * //   takeProfit: 0.11,
 * //   reasoning: 'BUY: Oversold (RSI: 28.5). Bullish moving average crossover...'
 * // }
 * 
 * ====================================================================================
 */