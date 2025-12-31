// backend/ai/tradingStrategy.js
const { OpenAI } = require('openai');
const axios = require('axios');

class TradingStrategy {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    this.marketCache = new Map();
    this.lastUpdate = null;
  }

  /**
   * Main strategy: Analyze market and generate trading signals
   */
  async analyzeAndTrade(userBalance, existingPositions = []) {
    try {
      // 1. Fetch comprehensive market data
      const marketData = await this.fetchMarketData();
      
      // 2. Filter out coins we already have positions in
      const availableCoins = marketData.coins.filter(coin => 
        !existingPositions.some(pos => pos.asset === coin.symbol.toUpperCase())
      );
      
      // 3. Score and rank opportunities
      const opportunities = await this.scoreOpportunities(availableCoins, marketData.news);
      
      // 4. Select best opportunity
      const bestOpportunity = opportunities[0];
      
      if (!bestOpportunity || bestOpportunity.score < 0.65) {
        return {
          shouldTrade: false,
          reason: 'No high-confidence opportunities found',
          topOpportunities: opportunities.slice(0, 3)
        };
      }
      
      // 5. Get AI confirmation
      const aiDecision = await this.getAIDecision(
        bestOpportunity,
        marketData.news,
        userBalance
      );
      
      // 6. Calculate position parameters
      const tradeParams = this.calculateTradeParameters(
        aiDecision,
        bestOpportunity,
        userBalance
      );
      
      return {
        shouldTrade: aiDecision.confidence > 0.7 && aiDecision.signal === 'BUY',
        coin: bestOpportunity.coin,
        aiDecision,
        tradeParams,
        marketContext: {
          sentiment: bestOpportunity.sentiment,
          technicals: bestOpportunity.technicals,
          newsImpact: bestOpportunity.newsScore
        }
      };
    } catch (error) {
      console.error('Strategy analysis error:', error);
      return { shouldTrade: false, error: error.message };
    }
  }

  /**
   * Fetch real-time market data
   */
  async fetchMarketData() {
    const cacheKey = 'market_data';
    const cacheTime = 5 * 60 * 1000; // 5 minutes
    
    if (this.marketCache.has(cacheKey)) {
      const cached = this.marketCache.get(cacheKey);
      if (Date.now() - cached.timestamp < cacheTime) {
        return cached.data;
      }
    }
    
    try {
      const [coinsResponse, newsResponse, fearGreedResponse] = await Promise.all([
        // Top coins by market cap
        axios.get('https://api.coingecko.com/api/v3/coins/markets', {
          params: {
            vs_currency: 'usd',
            order: 'market_cap_desc',
            per_page: 100,
            sparkline: true,
            price_change_percentage: '24h,7d'
          }
        }),
        
        // Crypto news
        this.fetchCryptoNews(),
        
        // Fear & Greed Index
        axios.get('https://api.alternative.me/fng/').catch(() => ({ data: { data: [{ value: 50 }] } }))
      ]);
      
      const data = {
        coins: coinsResponse.data,
        news: newsResponse,
        fearGreedIndex: parseInt(fearGreedResponse.data.data[0].value),
        timestamp: Date.now()
      };
      
      this.marketCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error('Market data fetch error:', error);
      throw error;
    }
  }

  /**
   * Fetch cryptocurrency news
   */
  async fetchCryptoNews() {
    try {
      const response = await axios.get('https://cryptopanic.com/api/v1/posts/', {
        params: {
          auth_token: process.env.CRYPTOPANIC_API_KEY,
          public: true,
          filter: 'hot',
          currencies: 'BTC,ETH,SOL,ADA,DOT'
        }
      });
      
      return response.data.results || [];
    } catch (error) {
      console.error('News fetch error:', error);
      return [];
    }
  }

  /**
   * Score trading opportunities
   */
  async scoreOpportunities(coins, news) {
    const scoredCoins = [];
    
    for (const coin of coins.slice(0, 20)) {
      try {
        const technicals = this.calculateTechnicals(coin);
        const sentiment = this.analyzeSentiment(coin, news);
        const momentum = this.calculateMomentum(coin);
        const newsScore = this.scoreNews(coin, news);
        
        const score = (
          technicals.score * 0.35 +
          sentiment.score * 0.25 +
          momentum.score * 0.25 +
          newsScore * 0.15
        );
        
        scoredCoins.push({
          coin,
          score,
          technicals,
          sentiment,
          momentum,
          newsScore,
          reasoning: this.generateReasoning(technicals, sentiment, momentum)
        });
      } catch (error) {
        console.error(`Error scoring ${coin.symbol}:`, error);
      }
    }
    
    return scoredCoins.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate technical indicators
   */
  calculateTechnicals(coin) {
    const prices = coin.sparkline_in_7d?.price || [];
    if (prices.length < 50) {
      return { score: 0.5, indicators: {} };
    }
    
    // RSI
    const rsi = this.calculateRSI(prices);
    
    // Moving Averages
    const sma20 = this.calculateSMA(prices, 20);
    const sma50 = this.calculateSMA(prices, 50);
    const currentPrice = prices[prices.length - 1];
    
    // MACD
    const macd = this.calculateMACD(prices);
    
    // Bollinger Bands
    const bb = this.calculateBollingerBands(prices, 20, 2);
    
    // Scoring
    let score = 0.5;
    
    // RSI signals
    if (rsi < 30) score += 0.2; // Oversold - bullish
    else if (rsi > 70) score -= 0.2; // Overbought - bearish
    else if (rsi > 40 && rsi < 60) score += 0.1; // Neutral zone
    
    // MA signals
    if (currentPrice > sma20 && sma20 > sma50) score += 0.15; // Bullish trend
    else if (currentPrice < sma20 && sma20 < sma50) score -= 0.15; // Bearish trend
    
    // MACD signals
    if (macd.histogram > 0 && macd.signal > 0) score += 0.1;
    else if (macd.histogram < 0 && macd.signal < 0) score -= 0.1;
    
    // Bollinger Bands
    if (currentPrice < bb.lower) score += 0.05; // Below lower band - potential bounce
    else if (currentPrice > bb.upper) score -= 0.05; // Above upper band - potential correction
    
    return {
      score: Math.max(0, Math.min(1, score)),
      indicators: { rsi, sma20, sma50, macd, bb, currentPrice }
    };
  }

  /**
   * Analyze market sentiment
   */
  analyzeSentiment(coin, news) {
    const relevantNews = news.filter(article => 
      article.title.toLowerCase().includes(coin.symbol.toLowerCase()) ||
      article.title.toLowerCase().includes(coin.name.toLowerCase())
    );
    
    let sentimentScore = 0.5;
    
    // Positive keywords
    const positiveWords = ['bullish', 'surge', 'rally', 'breakthrough', 'adoption', 'partnership'];
    // Negative keywords
    const negativeWords = ['crash', 'bearish', 'decline', 'concern', 'regulatory', 'hack'];
    
    relevantNews.forEach(article => {
      const text = article.title.toLowerCase();
      positiveWords.forEach(word => {
        if (text.includes(word)) sentimentScore += 0.05;
      });
      negativeWords.forEach(word => {
        if (text.includes(word)) sentimentScore -= 0.05;
      });
    });
    
    return {
      score: Math.max(0, Math.min(1, sentimentScore)),
      newsCount: relevantNews.length,
      sentiment: sentimentScore > 0.5 ? 'positive' : sentimentScore < 0.5 ? 'negative' : 'neutral'
    };
  }

  /**
   * Calculate momentum indicators
   */
  calculateMomentum(coin) {
    const change24h = coin.price_change_percentage_24h || 0;
    const change7d = coin.price_change_percentage_7d_in_currency || 0;
    const volume = coin.total_volume || 0;
    const marketCap = coin.market_cap || 0;
    
    let momentumScore = 0.5;
    
    // Price momentum
    if (change24h > 5) momentumScore += 0.2;
    else if (change24h < -5) momentumScore -= 0.2;
    else if (change24h > 0) momentumScore += 0.1;
    
    // Weekly trend
    if (change7d > 10) momentumScore += 0.15;
    else if (change7d < -10) momentumScore -= 0.15;
    
    // Volume/Market Cap ratio (liquidity)
    const volumeRatio = volume / marketCap;
    if (volumeRatio > 0.1) momentumScore += 0.05;
    
    return {
      score: Math.max(0, Math.min(1, momentumScore)),
      change24h,
      change7d,
      volumeRatio
    };
  }

  /**
   * Score news impact
   */
  scoreNews(coin, news) {
    const relevantNews = news.filter(article => 
      article.title.toLowerCase().includes(coin.symbol.toLowerCase()) ||
      article.title.toLowerCase().includes(coin.name.toLowerCase())
    );
    
    if (relevantNews.length === 0) return 0.5;
    
    const recentNews = relevantNews.filter(article => {
      const publishedAt = new Date(article.published_at);
      const hoursAgo = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);
      return hoursAgo < 24;
    });
    
    let score = 0.5;
    score += Math.min(recentNews.length * 0.05, 0.3); // More recent news = higher score
    
    return Math.min(1, score);
  }

  /**
   * Get AI decision using GPT-4
   */
  async getAIDecision(opportunity, news, userBalance) {
    const prompt = `You are an expert cryptocurrency trading AI. Analyze this trading opportunity and provide a recommendation.

COIN: ${opportunity.coin.name} (${opportunity.coin.symbol})
CURRENT PRICE: $${opportunity.coin.current_price}
24H CHANGE: ${opportunity.coin.price_change_percentage_24h?.toFixed(2)}%
MARKET CAP: $${(opportunity.coin.market_cap / 1e9).toFixed(2)}B

TECHNICAL ANALYSIS:
- RSI: ${opportunity.technicals.indicators.rsi?.toFixed(2)}
- Price vs SMA20: ${((opportunity.technicals.indicators.currentPrice / opportunity.technicals.indicators.sma20 - 1) * 100).toFixed(2)}%
- Price vs SMA50: ${((opportunity.technicals.indicators.currentPrice / opportunity.technicals.indicators.sma50 - 1) * 100).toFixed(2)}%

SENTIMENT: ${opportunity.sentiment.sentiment.toUpperCase()}
NEWS ARTICLES: ${opportunity.sentiment.newsCount}

RECENT NEWS:
${news.slice(0, 3).map(n => `- ${n.title}`).join('\n')}

USER BALANCE: $${userBalance}

Provide your analysis in JSON format:
{
  "signal": "BUY" or "HOLD" or "SELL",
  "confidence": 0.0 to 1.0,
  "positionSize": percentage of balance (0.1 to 0.3),
  "stopLoss": percentage below entry (-0.03 to -0.08),
  "takeProfit": percentage above entry (0.05 to 0.20),
  "reasoning": "Brief explanation (2-3 sentences)",
  "risks": "Key risks to consider"
}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "You are a professional cryptocurrency trading analyst. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const decision = JSON.parse(completion.choices[0].message.content);
      return decision;
    } catch (error) {
      console.error('AI decision error:', error);
      return {
        signal: 'HOLD',
        confidence: 0.5,
        positionSize: 0.15,
        stopLoss: -0.05,
        takeProfit: 0.10,
        reasoning: 'AI analysis unavailable, defaulting to conservative HOLD',
        risks: 'Unable to perform comprehensive analysis'
      };
    }
  }

  /**
   * Calculate trade parameters
   */
  calculateTradeParameters(aiDecision, opportunity, userBalance) {
    const entryPrice = opportunity.coin.current_price;
    const positionSize = Math.min(aiDecision.positionSize, 0.3); // Max 30%
    const tradeAmount = userBalance * positionSize;
    
    const stopLossPrice = entryPrice * (1 + aiDecision.stopLoss);
    const takeProfitPrice = entryPrice * (1 + aiDecision.takeProfit);
    
    const potentialLoss = tradeAmount * Math.abs(aiDecision.stopLoss);
    const potentialProfit = tradeAmount * aiDecision.takeProfit;
    const riskRewardRatio = potentialProfit / potentialLoss;
    
    return {
      entryPrice,
      tradeAmount,
      positionSize: positionSize * 100,
      stopLossPrice,
      takeProfitPrice,
      potentialLoss,
      potentialProfit,
      riskRewardRatio
    };
  }

  /**
   * Helper: Calculate RSI
   */
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Helper: Calculate SMA
   */
  calculateSMA(prices, period) {
    if (prices.length < period) return prices[prices.length - 1];
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  /**
   * Helper: Calculate MACD
   */
  calculateMACD(prices) {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macdLine = ema12 - ema26;
    const signal = this.calculateEMA([macdLine], 9);
    const histogram = macdLine - signal;
    
    return { macdLine, signal, histogram };
  }

  /**
   * Helper: Calculate EMA
   */
  calculateEMA(prices, period) {
    if (prices.length < period) return prices[prices.length - 1];
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  /**
   * Helper: Calculate Bollinger Bands
   */
  calculateBollingerBands(prices, period = 20, stdDev = 2) {
    const sma = this.calculateSMA(prices, period);
    const slice = prices.slice(-period);
    
    const variance = slice.reduce((sum, price) => 
      sum + Math.pow(price - sma, 2), 0) / period;
    const std = Math.sqrt(variance);
    
    return {
      middle: sma,
      upper: sma + (std * stdDev),
      lower: sma - (std * stdDev)
    };
  }

  /**
   * Generate reasoning
   */
  generateReasoning(technicals, sentiment, momentum) {
    const reasons = [];
    
    if (technicals.indicators.rsi < 35) {
      reasons.push('Oversold conditions (RSI)');
    }
    if (momentum.change24h > 3) {
      reasons.push('Strong upward momentum');
    }
    if (sentiment.sentiment === 'positive') {
      reasons.push('Positive market sentiment');
    }
    
    return reasons.join(', ') || 'Neutral market conditions';
  }
}

module.exports = TradingStrategy;