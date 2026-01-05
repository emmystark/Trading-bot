'use client'
import { Zap } from 'lucide-react'
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ethers } from 'ethers';



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
    [key: string]: {
      usd: number
      usd_24h_change: number
    }
  }
}

interface CoinOption {
  value: string
  label: string
  symbol: string
}

export default function Dashboard() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [balance, setBalance] = useState<string>('0')
  const [signal, setSignal] = useState<string>('Hold')
  const [coinPrice, setCoinPrice] = useState<number>(0)
  const [coinChange, setCoinChange] = useState<number>(0)
  const [sentiment, setSentiment] = useState<number>(0)
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
  
  // Live server logs
  const [logs, setLogs] = useState<any[]>([]);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  
  // New states for coin selection
  const [selectedCoin, setSelectedCoin] = useState<CoinOption>({ value: 'bitcoin', label: 'Bitcoin', symbol: 'BTC' })
  const [coinOptions, setCoinOptions] = useState<CoinOption[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'

  // Fetch dynamic list of coins from CoinGecko API
  const fetchCoins = async () => {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false')
      if (res.ok) {
        const data = await res.json()
        const options = data.map((coin: any) => ({
          value: coin.id,
          label: coin.name,
          symbol: coin.symbol.toUpperCase()
        }))
        setCoinOptions(options)
        console.log('Coins loaded:', options.length)
      }
    } catch (err) {
      console.error('Failed to fetch coin list:', err)
      // Fallback to common coins
      setCoinOptions([
        { value: 'bitcoin', label: 'Bitcoin', symbol: 'BTC' },
        { value: 'ethereum', label: 'Ethereum', symbol: 'ETH' },
        { value: 'tether', label: 'Tether', symbol: 'USDT' },
        { value: 'binancecoin', label: 'BNB', symbol: 'BNB' },
        { value: 'solana', label: 'Solana', symbol: 'SOL' },
      ])
    }
  }

  // Fetch 24hr chart data for selected coin from CoinGecko
  const fetchChartData = async (coinId: string) => {
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=1&interval=hourly`)
      if (res.ok) {
        const data = await res.json()
        const formattedData = data.prices.map((item: any) => {
          const date = new Date(item[0])
          return {
            time: `${date.getHours()}:00`,
            price: item[1]
          }
        })
        setChartData(formattedData)
        console.log('Chart data loaded:', formattedData.length)
      }
    } catch (err) {
      console.error('Failed to fetch chart data:', err)
    }
  }

  const fetchData = async () => {
    try {
      setRefreshing(true)
      setError('')
      console.log('Fetching data from:', API_URL, 'for coin:', selectedCoin.value)

      // Fetch chart data for selected coin
      await fetchChartData(selectedCoin.value)

      const coinParam = `?coin=${selectedCoin.symbol}`

      const [tradesRes, marketRes, botStatusRes, newsRes] = await Promise.all([
        fetch(`${API_URL}/api/trades${coinParam}`).catch(e => {
          console.error('Trades API error:', e)
          return { ok: false, json: async () => [] }
        }),
        fetch(`${API_URL}/api/market${coinParam}`).catch(e => {
          console.error('Market API error:', e)
          return { ok: false, json: async () => null }
        }),
        fetch(`${API_URL}/api/bot/status${coinParam}`).catch(e => {
          console.error('Status API error:', e)
          return { ok: false, json: async () => null }
        }),
        // Fetch news for selected coin from CryptoCompare
        fetch(`https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=${selectedCoin.symbol}`).catch(e => {
          console.error('Crypto news API error:', e)
          return { ok: false, json: async () => ({ Data: [] }) }
        })
      ])

      if (tradesRes.ok) {
        const tradesData = await tradesRes.json()
        setTrades(Array.isArray(tradesData) ? tradesData : [])
        console.log('Trades loaded:', tradesData.length)
      }

      if (marketRes.ok) {
        const marketData: MarketData = await marketRes.json()
        setSignal(marketData.signal || 'Hold')
        setSentiment(marketData.sentiment || 0.5)
        
        // Use CoinGecko data for price
        const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${selectedCoin.value}&vs_currencies=usd&include_24hr_change=true`)
        if (priceRes.ok) {
          const priceData = await priceRes.json()
          setCoinPrice(priceData[selectedCoin.value]?.usd || 0)
          setCoinChange(priceData[selectedCoin.value]?.usd_24h_change || 0)
        }
      }

      if (botStatusRes.ok) {
        const statusData = await botStatusRes.json()
        setBotStatus(statusData)
        console.log('Bot status:', statusData)
      }

      if (newsRes.ok) {
        const newsData = await newsRes.json()
        setNews(newsData.Data.slice(0, 4).map((article: any) => ({
          title: article.title,
          link: article.url
        })))
        console.log('Crypto news loaded:', newsData.Data.length)
      }

      // Mock balance - replace with actual contract balance fetch
      // Example: const balance = await contract.balanceOf(userAddress)
      setBalance('1.2547')
      console.log('All data loaded successfully!')
    } catch (err) {
      console.error('Fetch error:', err)
      setError('Failed to connect to backend. Make sure the server is running on port 3001.')
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
          userAddress: '0xYourAddress', // Replace with actual wallet address
          privateKey: process.env.NEXT_PUBLIC_BOT_PRIVATE_KEY,
          coin: selectedCoin.symbol,
          coinId: selectedCoin.value
        })
      })
      if (response.ok) {
        const data = await response.json()
        alert(data.message)
        fetchData()
      } else {
        const errorData = await response.json()
        alert(`Failed to start bot: ${errorData.message || 'Unknown error'}`)
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coin: selectedCoin.symbol
        })
      })
      if (response.ok) {
        const data = await response.json()
        alert(data.message)
        fetchData()
      } else {
        const errorData = await response.json()
        alert(`Failed to stop bot: ${errorData.message || 'Unknown error'}`)
      }
    } catch (err) {
      console.error('Stop bot error:', err)
      alert('Failed to stop bot. Check backend connection.')
    }
  }

  useEffect(() => {
    fetchCoins()
  }, [])

  useEffect(() => {
    if (coinOptions.length > 0) {
      fetchData()
      const interval = setInterval(fetchData, 30000)
      return () => clearInterval(interval)
    }
  }, [selectedCoin])

  // Connect to server-sent events to receive live logs, market updates, and bot status
  useEffect(() => {
    let es: EventSource | null = null;

    async function loadHistory() {
      try {
        const res = await fetch(`${API_URL}/api/logs`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs ? data.logs.slice().reverse() : []);
        }
      } catch (e) {
        console.error('Failed to fetch log history', e);
      }
    }

    loadHistory();

    try {
      es = new EventSource(`${API_URL}/api/events`);

      es.addEventListener('history', (e: any) => {
        try {
          const items = JSON.parse(e.data);
          setLogs(prev => [...items.reverse(), ...prev].slice(0, 200));
        } catch (err) { console.error(err) }
      });

      // Market update event (price, sentiment, chart)
      es.addEventListener('market-update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          
          // Update price and change
          if (data.coin) {
            setCoinPrice(data.coin.current_price);
            setCoinChange(data.coin.price_change_percentage_24h);
          }
          
          // Update sentiment/confidence
          if (data.analysis) {
            setSignal(data.analysis.signal);
            setSentiment(data.analysis.confidence);
          }
          
          // Update chart data
          if (data.chart && data.chart.prices) {
            const formattedChart = data.chart.prices.map((p: any) => ({
              time: new Date(p[0]).getHours() + ':00',
              price: p[1]
            }));
            setChartData(formattedChart);
          }
        } catch (err) { console.error('market-update parse error', err) }
      });

      // Bot status event
      es.addEventListener('bot-status', (e: MessageEvent) => {
        try {
          const status = JSON.parse(e.data);
          setBotStatus(status);
        } catch (err) { console.error('bot-status parse error', err) }
      });

      // Default message handler for logs
      es.onmessage = (e: MessageEvent) => {
        try {
          const entry = JSON.parse(e.data);
          setLogs(prev => [entry, ...prev].slice(0, 200));
        } catch (err) { /* ignore parsing errors */ }
      };

      es.onopen = () => setSseConnected(true);
      es.onerror = (err) => {
        console.error('SSE connection error', err);
        setSseConnected(false);
        if (es) {
          es.close();
          es = null;
        }
      };
    } catch (err) {
      console.error('EventSource not supported or failed', err);
    }

    return () => { if (es) es.close(); };
  }, []);

  const filteredCoins = coinOptions.filter(coin => 
    coin.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    coin.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  )



  return (
    <div style={styles.pageWrapper}>
      <style>{cssStyles}</style>
      <div style={styles.container}>
        {error && (
          <div style={styles.errorBanner}>
             {error}
          </div>
        )}
        
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            {/* <img src="seismic.svg" alt="" /> */}
            <h1>TradeSafe</h1>
            <div style={styles.headerText}></div>
          </div>
          <div style={{display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap'}}>
            {/* Custom Searchable Dropdown */}
            <div style={styles.dropdownContainer}>
              <div 
                style={styles.dropdownButton}
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <span style={styles.dropdownText}>
                  {selectedCoin.label} ({selectedCoin.symbol})
                </span>
                <span style={styles.dropdownArrow}>{showDropdown ? '▲' : '▼'}</span>
              </div>
              {showDropdown && (
                <div style={styles.dropdownMenu}>
                  <input
                    type="text"
                    placeholder="Search coin..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={styles.searchInput}
                    autoFocus
                  />
                  <div style={styles.optionsList}>
                    {filteredCoins.slice(0, 50).map((coin) => (
                      <div
                        key={coin.value}
                        style={styles.option}
                        className="dropdown-option"
                        onClick={() => {
                          setSelectedCoin(coin)
                          setShowDropdown(false)
                          setSearchTerm('')
                        }}
                      >
                        <span style={styles.optionLabel}>{coin.label}</span>
                        <span style={styles.optionSymbol}>{coin.symbol}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

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

        <div style={{
          ...styles.signalBanner,
          background: signal === 'BUY' ? 'linear-gradient(135deg, #10b981, #059669)' :
          signal === 'SELL' ? 'linear-gradient(135deg, #ef4444, #dc2626)' :
          'linear-gradient(135deg, #3b82f6, #2563eb)'
        }} className="signal-banner">
          <div style={styles.signalContent}>
            <span style={styles.pulseIndicator}>●</span>
            <h2 style={styles.signalTitle}>AI SIGNAL: {signal}</h2>
          </div>
          <p style={styles.signalConfidence}>
            Confidence: {(sentiment * 100).toFixed(0)}% • Daily Trades: {botStatus.dailyTradeCount}/2
          </p>
        </div>

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
              <span style={styles.statIcon}>{selectedCoin.symbol} Price</span>
              <span style={{...styles.trendIndicator, color: coinChange > 0 ? '#6ee7b7' : '#fca5a5'}}>
                {coinChange > 0 ? '↗' : '↘'}
              </span>
            </div>
            <p style={styles.statLabel}></p>
            <div style={styles.priceContainer}>
              <h3 style={styles.statValue}>${coinPrice.toLocaleString()}</h3>
              <span style={{...styles.priceChange, color: coinChange > 0 ? '#6ee7b7' : '#fca5a5'}}>
                {coinChange > 0 ? '+' : ''}{coinChange.toFixed(2)}%
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

        <div style={styles.contentGrid}>
          <div style={styles.chartCard} className="card-hover">
            <h3 style={styles.cardTitle}>{selectedCoin.symbol} 24hr Chart</h3>
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
              <span style={styles.newsIcon}>📰</span>
              <h3 style={styles.cardTitle}>Latest News</h3>
            </div>
            <div style={styles.newsList}>
              {news.length > 0 ? news.map((item, i) => (
                <a key={i} href={item.link} style={styles.linkstyle} target="_blank" rel="noopener noreferrer">
                  <div style={styles.newsItem} className="news-item">
                    <p style={styles.newsText}>{item.title}</p>
                  </div>
                </a>
              )) : (
                <div style={styles.noData}>Loading news...</div>
              )}
            </div>
          </div>
        </div>

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

        <div style={styles.activityFeed} className="card-hover">
          <div style={styles.activityHeader}>
            <h3 style={styles.cardTitle}>Activity Feed</h3>
            <div style={{fontSize: '0.9rem', color: '#cbd5e1'}}>{sseConnected ? '● Live' : '○ Offline'}</div>
          </div>

          <div style={styles.feedList}>
            {logs.length === 0 ? (
              <div style={styles.noData}>No activity yet</div>
            ) : (
              logs.slice(0, 50).map((l) => (
                <div key={l.id} style={styles.logItem} className="log-item">
                  <div style={{...styles.logBadge, background: l.level === 'error' ? '#ef4444' : '#6ee7b7'}}></div>
                  <div style={styles.logContent}>
                    <div style={styles.logMessage}>{l.message}</div>
                    <div style={styles.logMeta}>{new Date(l.timestamp).toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}




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
  errorBanner: {
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.5)',
    borderRadius: '12px',
    padding: '1rem',
    marginBottom: '1rem',
    color: '#fff',
  },
  header: {
    zIndex: 1000,
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
  dropdownContainer: {
    position: 'relative' as const,
    minWidth: '220px',
    zIndex: 1001,
  },
  dropdownButton: {
    background: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '16px',
    padding: '0.875rem 1.5rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    transition: 'all 0.3s ease',
  },
  dropdownText: {
    color: '#383838',
    fontWeight: '600',
    fontSize: '1rem',
  },
  dropdownArrow: {
    color: '#383838',
    fontSize: '0.75rem',
  },
  dropdownMenu: {
    position: 'absolute' as const,
  top: '100%',
  left: 0,
  right: 0,
  marginTop: '0.5rem',
  background: 'rgba(109, 87, 112, 0.98)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '16px',
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  zIndex: 1002, // Increase from 1000
  maxHeight: '400px',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column' as const,
  },
  searchInput: {
    width: '100%',
    padding: '1rem',
    border: 'none',
    borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'transparent',
    color: '#fff',
    fontSize: '1rem',
    outline: 'none',
  },
  optionsList: {
    overflowY: 'auto' as const,
    maxHeight: '340px',
    zIndex: '9999px',
  },
  option: {
    padding: '1rem 1.5rem',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'background 0.2s ease',
  },
  optionLabel: {
    color: '#fff',
    fontSize: '0.9375rem',
  },
  optionSymbol: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '0.875rem',
    fontWeight: '600',
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
    zIndex: 0,
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
    color: '#fff',
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
    zIndex: 0,
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
  activityFeed: {
    marginTop: '1.5rem',
    background: 'rgba(255, 255, 255, 0.06)',
    padding: '1.25rem',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.08)'
  },
  activityHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.75rem'
  },
  feedList: {
    maxHeight: '320px',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  },
  logItem: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-start'
  },
  logBadge: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    marginTop: '6px'
  },
  logContent: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  logMessage: {
    color: '#fff',
    fontSize: '0.95rem'
  },
  logMeta: {
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.6)'
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
    color: 'inherit'
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

  .dropdown-option:hover {
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    background: rgba(255, 255, 255, 0.1) !important;
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