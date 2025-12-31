'use client'
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Trade {
  id: string
  asset: string
  entry: string
  exit: string | null
  pnl: number
  status: 'Active' | 'Closed'
  timestamp?: string
}

interface MarketData {
  chartData: Array<{time: string, price: number}>
  signal: string
  sentiment: number
  prices: {
    bitcoin: {
      usd: number
      usd_24h_change: number
    }
  }
  // Removed news field, as it's now fetched separately
}

export default function Dashboard() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [balance, setBalance] = useState<string>('0')
  const [signal, setSignal] = useState<string>('Hold')
  const [btcPrice, setBtcPrice] = useState<number>(0)
  const [btcChange, setBtcChange] = useState<number>(0)
  const [sentiment, setSentiment] = useState<number>(0)
  // Updated news state to array of objects for title and link
  const [news, setNews] = useState<{title: string, link: string}[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [botStatus, setBotStatus] = useState({
    isActive: false,
    dailyTradeCount: 0,
    activePositions: 0,
    aiType: 'Free Technical Analysis'
  })

  // Backend URL - change this if deployed elsewhere
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  const fetchData = async () => {
    try {
      setRefreshing(true)
      setError('')
      console.log('Fetching data from:', API_URL)

      // Added newsRes to Promise.all for parallel fetching from CryptoCompare API
      const [tradesRes, marketRes, botStatusRes, newsRes] = await Promise.all([
        fetch(`${API_URL}/api/trades`).catch(e => {
          console.error('Trades API error:', e)
          return { ok: false, json: async () => [] }
        }),
        fetch(`${API_URL}/api/market`).catch(e => {
          console.error('Market API error:', e)
          return { ok: false, json: async () => null }
        }),
        fetch(`${API_URL}/api/bot/status`).catch(e => {
          console.error('Status API error:', e)
          return { ok: false, json: async () => null }
        }),
        // New: Fetch latest crypto news from CryptoCompare API (filtered for relevance)
        fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=Market,Blockchain,BTC,ETH').catch(e => {
          console.error('Crypto news API error:', e)
          return { ok: false, json: async () => ({ Data: [] }) }
        })
      ])

      // Process trades
      if (tradesRes.ok) {
        const tradesData = await tradesRes.json()
        setTrades(Array.isArray(tradesData) ? tradesData : [])
        console.log('Trades loaded:', tradesData.length)
      }

      // Process market data (removed news handling)
      if (marketRes.ok) {
        const marketData: MarketData = await marketRes.json()
        setChartData(marketData.chartData || [])
        setSignal(marketData.signal || 'Hold')
        setSentiment(marketData.sentiment || 0.5)
        setBtcPrice(marketData.prices?.bitcoin?.usd || 0)
        setBtcChange(marketData.prices?.bitcoin?.usd_24h_change || 0)
        console.log('Market data loaded:', {
          signal: marketData.signal,
          price: marketData.prices?.bitcoin?.usd
        })
      }

      // Process bot status
      if (botStatusRes.ok) {
        const statusData = await botStatusRes.json()
        setBotStatus(statusData)
        console.log('Bot status:', statusData)
      }

      // New: Process crypto news
      if (newsRes.ok) {
        const newsData = await newsRes.json()
        setNews(newsData.Data.slice(0, 4).map((article: any) => ({
          title: article.title,
          link: article.url
        })))
        console.log('Crypto news loaded:', newsData.Data.length)
      }

      // Mock balance for demo (replace with actual contract call)
      setBalance('1.2547')
      console.log('All data loaded successfully!')
    } catch (err) {
      console.error('Fetch error:', err)
      setError('Failed to connect to backend. Make sure the server is running on port 3001.')
      // Load mock data so UI isn't empty
      setChartData(Array.from({length: 24}, (_, i) => ({
        time: `${i}:00`,
        price: 60000 + i * 50 + Math.random() * 200
      })))
      setSignal('Hold')
      setBalance('1.547')
      setBtcPrice(61234)
      setBtcChange(2.34)
      setSentiment(0.65)
      // Updated mock news to include links
      setNews([
        { title: 'Bitcoin shows strong momentum as institutional adoption grows', link: 'https://example.com/news1' },
        { title: 'Ethereum Layer 2 solutions reach new all-time high in usage', link: 'https://example.com/news2' },
        { title: 'Market sentiment remains bullish despite regulatory concerns', link: 'https://example.com/news3' },
        { title: 'DeFi protocols see record trading volumes this week', link: 'https://example.com/news4' }
      ])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const startBot = async () => {
    try {
      const response = await fetch(`${API_URL}/api/bot/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: '0xYourAddress', // Replace with actual user address
          privateKey: process.env.NEXT_PUBLIC_BOT_PRIVATE_KEY // For demo only
        })
      })
      if (response.ok) {
        const data = await response.json()
        alert(data.message)
        fetchData() // Refresh status
      }
    } catch (err) {
      console.error('Start bot error:', err)
      alert('Failed to start bot. Check backend connection.')
    }
  }

  const stopBot = async () => {
    try {
      const response = await fetch(`${API_URL}/api/bot/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (response.ok) {
        const data = await response.json()
        alert(data.message)
        fetchData() // Refresh status
      }
    } catch (err) {
      console.error('Stop bot error:', err)
      alert('Failed to stop bot. Check backend connection.')
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingContent}>
          <div style={styles.logoContainer}>
            <svg width="100" height="100" viewBox="0 0 200 200" style={styles.pulsingLogo}>
              <polygon points="100,40 140,80 140,140 100,180 60,140 60,80" fill="#6d5770" opacity="0.8"/>
              <polygon points="100,40 140,80 100,100" fill="#8b7b8f"/>
              <polygon points="140,80 140,140 100,100" fill="#7a6a7d"/>
              <polygon points="100,100 140,140 100,180" fill="#9d8ba0"/>
              <polygon points="60,80 100,100 60,140" fill="#b39bb7"/>
              <polygon points="100,40 60,80 100,100" fill="#a594a8"/>
            </svg>
          </div>
          <h2 style={styles.loadingTitle}>Seismic AI</h2>
          <p style={styles.loadingText}>Loading market data...</p>
          {error && <p style={{...styles.loadingText, color: '#fca5a5'}}>{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div style={styles.pageWrapper}>
      <style>{cssStyles}</style>
      <div style={styles.container}>
        {/* Error Banner */}
        {error && (
          <div >
            ⚠️ {error}
          </div>
        )}
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <img src="seismic.svg" alt="" />
            <div style={styles.headerText}>
              {/* <h1 style={styles.mainTitle}>Seismic Trading Bot</h1>
              <p style={styles.subtitle}>
                {botStatus.aiType} • {botStatus.isActive ? ' Active' : ' Inactive'}
              </p> */}
            </div>
          </div>
          <div style={{display: 'flex', gap: '1rem'}}>
            <button
              onClick={fetchData}
              disabled={refreshing}
              style={styles.refreshButton}
              className="refresh-btn"
            >
              <span style={{...styles.refreshIcon, ...(refreshing ? styles.spinning : {})}}>↻</span>
              Refresh
            </button>
            {botStatus.isActive ? (
              <button
                onClick={stopBot}
                style={{...styles.refreshButton, background: 'rgba(239, 68, 68, 0.3)'}}
                className="refresh-btn"
              >
                ⏸ Stop Bot
              </button>
            ) : (
              <button
                onClick={startBot}
                style={{...styles.refreshButton, background: 'rgba(34, 197, 94, 0.3)'}}
                className="refresh-btn"
              >
                ▶ Start Bot
              </button>
            )}
          </div>
        </header>
        {/* AI Signal Banner */}
        <div style={{
          ...styles.signalBanner,
          background: signal === 'BUY' ? 'linear-gradient(135deg, #10b981, #059669)' :
          signal === 'SELL' ? 'linear-gradient(135deg, #ef4444, #dc2626)' :
          'linear-gradient(135deg, #3b82f6, #2563eb)'
        }} className="signal-banner">
          <div style={styles.signalContent}>
            <span style={styles.pulseIndicator}></span>
            <h2 style={styles.signalTitle}>AI SIGNAL: {signal}</h2>
          </div>
          <p style={styles.signalConfidence}>
            Confidence: {(sentiment * 100).toFixed(0)}% • Daily Trades: {botStatus.dailyTradeCount}/2
          </p>
        </div>
        {/* Stats Grid */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard} className="card-hover">
            <div style={styles.statHeader}>
              <span style={styles.statIcon}>Balance</span>
              <div style={styles.iconBadge}>
                <span style={styles.trendUp}>↗</span>
              </div>
            </div>
            <p style={styles.statLabel}></p>
            <h3 style={styles.statValue}>${balance}</h3>
          </div>
          <div style={styles.statCard} className="card-hover">
            <div style={styles.statHeader}>
              <span style={styles.statIcon}>Active Trades</span>
              <div style={styles.iconBadge}>
                <span style={{...styles.activeDot, backgroundColor: botStatus.activePositions > 0 ? '#10b981' : '#64748b'}}></span>
              </div>
            </div>
            <p style={styles.statLabel}></p>
            <h3 style={styles.statValue}>{botStatus.activePositions}</h3>
          </div>
          <div style={styles.statCard} className="card-hover">
            <div style={styles.statHeader}>
              <span style={styles.statIcon}>BTC Price</span>
              <span style={{...styles.trendIndicator, color: btcChange > 0 ? '#6ee7b7' : '#fca5a5'}}>
                {btcChange > 0 ? '↗' : '↘'}
              </span>
            </div>
            <p style={styles.statLabel}></p>
            <div style={styles.priceContainer}>
              <h3 style={styles.statValue}>${btcPrice.toLocaleString()}</h3>
              <span style={{...styles.priceChange, color: btcChange > 0 ? '#6ee7b7' : '#fca5a5'}}>
                {btcChange > 0 ? '+' : ''}{btcChange.toFixed(2)}%
              </span>
            </div>
          </div>
          <div style={styles.statCard} className="card-hover">
            <div style={styles.statHeader}>
              <span style={styles.statIcon}>AI Sentiment</span>
              <div style={styles.aiBadge}>FREE</div>
            </div>
            <p style={styles.statLabel}></p>
            <div style={styles.sentimentContainer}>
              <h3 style={styles.statValue}>{(sentiment * 100).toFixed(0)}%</h3>
              <div style={styles.progressBar}>
                <div style={{...styles.progressFill, width: `${sentiment * 100}%`}}></div>
              </div>
            </div>
          </div>
        </div>
        {/* Chart + News */}
        <div style={styles.contentGrid}>
          <div style={styles.chartCard} className="card-hover">
            <h3 style={styles.cardTitle}>BTC 24hr Chart</h3>
            <div style={styles.chartContainer}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="time" stroke="rgba(255,255,255,0.7)" style={{fontSize: '12px'}} />
                    <YAxis stroke="rgba(255,255,255,0.7)" style={{fontSize: '12px'}} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(109, 87, 112, 0.95)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '12px',
                        backdropFilter: 'blur(10px)',
                        padding: '12px'
                      }}
                      labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Price']}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#a594a8"
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={styles.noData}>Loading chart data...</div>
              )}
            </div>
          </div>
          <div style={styles.newsCard} className="card-hover">
            <div style={styles.newsHeader}>
              <span style={styles.newsIcon}></span>
              <h3 style={styles.cardTitle}>Latest News</h3>
            </div>
            <div style={styles.newsList}>
              {news.length > 0 ? news.map((item, i) => (
                // Updated to use item.title and item.link consistently
                <div >
                    <a href={item.link} style={styles.linkstyle} target="_blank" rel="noopener noreferrer">
                  <div key={i} style={styles.newsItem} className="news-item">
                    <p style={styles.newsText}>{item.title}</p>
                  </div>
                  </a>
                </div>
              )) : (
                <div style={styles.noData}>Loading news...</div>
              )}
            </div>
          </div>
        </div>
        {/* Trade History */}
        <div style={styles.tradeCard} className="card-hover">
          <h3 style={styles.cardTitle}>Trade History</h3>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={styles.tableHeader}>ID</th>
                  <th style={styles.tableHeader}>Asset</th>
                  <th style={styles.tableHeader}>Entry</th>
                  <th style={styles.tableHeader}>Exit</th>
                  <th style={styles.tableHeader}>P&L</th>
                  <th style={styles.tableHeader}>Status</th>
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={styles.noTrades}>
                      {botStatus.isActive
                        ? 'No trades yet. AI is analyzing the market...'
                        : 'Start the bot to begin trading'}
                    </td>
                  </tr>
                ) : (
                  trades.map((trade) => (
                    <tr key={trade.id} style={styles.tableRow} className="table-row-hover">
                      <td style={styles.tableCell}>{trade.id}</td>
                      <td style={{...styles.tableCell, fontWeight: '600'}}>{trade.asset}</td>
                      <td style={styles.tableCell}>${trade.entry}</td>
                      <td style={styles.tableCell}>{trade.exit ? `$${trade.exit}` : 'Open'}</td>
                      <td style={{...styles.tableCell, color: trade.pnl > 0 ? '#6ee7b7' : '#fca5a5', fontWeight: 'bold'}}>
                        {trade.pnl > 0 ? '+' : ''}{trade.pnl.toFixed(2)}%
                      </td>
                      <td style={styles.tableCell}>
                        <span style={{
                          ...styles.statusBadge,
                          backgroundColor: trade.status === 'Active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                          color: trade.status === 'Active' ? '#6ee7b7' : '#cbd5e1',
                          border: trade.status === 'Active' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(148, 163, 184, 0.3)'
                        }}>
                          {trade.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        {/* Connection Status */}
        {/* <div style={styles.footer}>
          <p style={styles.footerText}>
            {error ? ' Backend Disconnected' : ' Connected to Backend'} •
            API: {API_URL} •
            Updates every 30s
          </p>
        </div> */}
      </div>
    </div>
  )
}

// styles and cssStyles remain unchanged


const styles = {
  pageWrapper: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #8b7b8f 0%, #9d8ba0 50%, #b39bb7 100%)',
    padding: '2rem 1rem',
    fontFamily: "Suisseintl, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
  },
  loadingContainer: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #8b7b8f 0%, #9d8ba0 50%, #b39bb7 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContent: {
    textAlign: 'center' as const,
  },
  logoContainer: {
    marginBottom: '2rem',
    display: 'flex',
    justifyContent: 'center',
  },
  pulsingLogo: {
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  },
  loadingTitle: {
    fontSize: '3rem',
    fontWeight: 'bold',
    color: '#383838',

    marginBottom: '1rem',
  },
  loadingText: {
    fontSize: '1.25rem',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
  },
  header: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    borderRadius: '24px',
    padding: '2rem',
    marginBottom: '2rem',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: '1.5rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  headerText: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  mainTitle: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#383838',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'rgba(255, 255, 255, 0.7)',
    margin: 0,
  },
  refreshButton: {
    background: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: '#383838',
    padding: '0.875rem 1.75rem',
    borderRadius: '16px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    transition: 'all 0.3s ease',
  },
  refreshIcon: {
    fontSize: '1.5rem',
    display: 'inline-block',
  },
  spinning: {
    animation: 'spin 1s linear infinite',
  },
  signalBanner: {
    borderRadius: '24px',
    padding: '2.5rem',
    textAlign: 'center' as const,
    marginBottom: '2rem',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    transition: 'transform 0.3s ease',
  },
  signalContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    marginBottom: '0.5rem',
  },
  pulseIndicator: {
    fontSize: '2rem',
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  },
  signalTitle: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: '#383838',
    margin: 0,
  },
  signalConfidence: {
    fontSize: '1.25rem',
    color: 'rgba(255, 255, 255, 0.9)',
    margin: 0,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  statCard: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    borderRadius: '24px',
    padding: '2rem',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
    transition: 'all 0.3s ease',
  },
  statHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.5rem',
  },
  statIcon: {
    fontSize: '2rem',
    color: 'white',
    fontWeight: '600',
  },
  iconBadge: {
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendUp: {
    fontSize: '1.25rem',
    color: '#6ee7b7',
  },
  activeDot: {
    width: '12px',
    height: '12px',
    background: '#10b981',
    borderRadius: '50%',
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  },
  trendIndicator: {
    fontSize: '1.5rem',
  },
  aiBadge: {
    background: 'rgba(255, 255, 255, 0.2)',
    padding: '0.25rem 0.75rem',
    borderRadius: '12px',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#383838',
  },
  statLabel: {
    fontSize: '0.875rem',
    color: 'rgba(255, 255, 255, 0.7)',
    margin: '0 0 0.5rem 0',
  },
  statValue: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#383838',
    margin: 0,
  },
  priceContainer: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.75rem',
    flexWrap: 'wrap' as const,
  },
  priceChange: {
    fontSize: '1.125rem',
    fontWeight: '600',
  },
  sentimentContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  progressBar: {
    flex: 1,
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '10px',
    height: '8px',
    overflow: 'hidden',
  },
  progressFill: {
    background: 'linear-gradient(90deg, #6ee7b7, #10b981)',
    height: '100%',
    borderRadius: '10px',
    transition: 'width 0.5s ease',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  chartCard: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    borderRadius: '24px',
    padding: '2rem',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
    transition: 'all 0.3s ease',
  },
  newsCard: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    borderRadius: '24px',
    padding: '2rem',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
    transition: 'all 0.3s ease',
  },
  linkstyle: {
    textDecoration: 'none',
  },
  cardTitle: {
    fontSize: '2.25rem',
    fontWeight: 'bold',
    color: 'white',
    marginBottom: '1.5rem',
  },
  chartContainer: {
    height: '320px',
  },
  noData: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '1rem',
  },
  newsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  newsIcon: {
    fontSize: '1.5rem',
  },
  newsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  newsItem: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    padding: '1.25rem',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  newsText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '0.9375rem',
    lineHeight: '1.6',
    margin: 0,
  },
  tradeCard: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    borderRadius: '24px',
    padding: '2rem',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
    transition: 'all 0.3s ease',
  },
  tableWrapper: {
    overflowX: 'auto' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  tableHeaderRow: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
  },
  tableHeader: {
    textAlign: 'left' as const,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    padding: '1rem',
    fontSize: '0.875rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  tableRow: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'background 0.2s ease',
  },
  tableCell: {
    padding: '1.25rem 1rem',
    color: '#383838',
    fontSize: '0.9375rem',
  },
  statusBadge: {
    padding: '0.375rem 0.875rem',
    borderRadius: '20px',
    fontSize: '0.8125rem',
    fontWeight: '600',
    display: 'inline-block',
  },
  noTrades: {
    textAlign: 'center' as const,
    padding: '3rem 1rem',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '1rem',
  },
}

const cssStyles = `
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .refresh-btn:hover {
    background: rgba(255, 255, 255, 0.3) !important;
    transform: scale(1.05);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .signal-banner:hover {
    transform: scale(1.02);
  }

  .card-hover:hover {
    transform: translateY(-5px);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3) !important;
  }

  .news-item:hover {
    background: rgba(255, 255, 255, 0.15) !important;
    transform: scale(1.02);
  }

  .table-row-hover:hover {
    background: rgba(255, 255, 255, 0.05) !important;
  }

  @media (max-width: 768px) {
    .signal-banner h2 {
      font-size: 1.75rem !important;
    }
    
    .stat-card {
      min-width: 100% !important;
    }
  }
`