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
}

export default function Dashboard() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [balance, setBalance] = useState<string>('0')
  const [signal, setSignal] = useState<string>('Hold')
  const [btcPrice, setBtcPrice] = useState<number>(0)
  const [btcChange, setBtcChange] = useState<number>(0)
  const [sentiment, setSentiment] = useState<number>(0)
  const [news, setNews] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)

  const fetchData = async () => {
    try {
      setRefreshing(true)
      await new Promise(resolve => setTimeout(resolve, 800))
      
      const mockChartData = Array.from({length: 24}, (_, i) => ({ 
        time: `${i}:00`, 
        price: 60000 + Math.sin(i / 3) * 2000 + Math.random() * 500 
      }))
      
      const mockTrades = [
        { id: 'T001', asset: 'BTC/USDT', entry: '60,250', exit: '61,500', pnl: 2.07, status: 'Closed' as const },
        { id: 'T002', asset: 'ETH/USDT', entry: '3,200', exit: null, pnl: 1.25, status: 'Active' as const },
        { id: 'T003', asset: 'BTC/USDT', entry: '59,800', exit: '60,100', pnl: 0.50, status: 'Closed' as const },
      ]
      
      const mockNews = [
        'Bitcoin breaks resistance at $61K amid institutional buying',
        'Ethereum Layer 2 solutions see record adoption',
        'Federal Reserve signals potential rate cuts in Q2',
        'Major crypto exchange announces new trading pairs'
      ]
      
      setTrades(mockTrades)
      setChartData(mockChartData)
      setSignal(['Buy', 'Sell', 'Hold'][Math.floor(Math.random() * 3)])
      setSentiment(0.65 + Math.random() * 0.2)
      setBtcPrice(61234)
      setBtcChange(2.34)
      setNews(mockNews)
      setBalance('12.5847')
      
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
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
          <p style={styles.loadingText}>Initializing trading intelligence...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.pageWrapper}>
      <style>{cssStyles}</style>
      <div style={styles.container}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <img src="seismic.svg" alt="" />
            
            {/* <div style={styles.headerText}>
              <h1 style={styles.mainTitle}>Seismic Trading Bot</h1>
              <p style={styles.subtitle}>AI-Powered Market Intelligence</p>
            </div> */}
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
        </header>

        {/* AI Signal Banner */}
        <div style={{
          ...styles.signalBanner,
          background: signal === 'Buy' ? 'linear-gradient(135deg, #10b981, #059669)' : 
                      signal === 'Sell' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 
                      'linear-gradient(135deg, #3b82f6, #2563eb)'
        }} className="signal-banner">
          <div style={styles.signalContent}>
            <span style={styles.pulseIndicator}></span>
            <h2 style={styles.signalTitle}>AI SIGNAL: {signal}</h2>
          </div>
          <p style={styles.signalConfidence}>
            Confidence: {(sentiment * 100).toFixed(0)}%
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
            {/* <p style={styles.statLabel}>Balance</p> */}
            <h3 style={styles.statValue}>${balance}</h3>
          </div>

          <div style={styles.statCard} className="card-hover">
            <div style={styles.statHeader}>
              <span style={styles.statIcon}>Active Trades</span>
              <div style={styles.iconBadge}>
                <span style={styles.activeDot}></span>
              </div>
            </div>
            {/* <p style={styles.statLabel}>Active Trades</p> */}
            <h3 style={styles.statValue}>
              {trades.filter(t => t.status === 'Active').length}
            </h3>
          </div>

          <div style={styles.statCard} className="card-hover">
            <div style={styles.statHeader}>
              <span style={styles.statIcon}>BTC Price</span>
              <span style={{...styles.trendIndicator, color: btcChange > 0 ? '#6ee7b7' : '#fca5a5'}}>
                {btcChange > 0 ? '↗' : '↘'}
              </span>
            </div>
            {/* <p style={styles.statLabel}>BTC Price</p> */}
            <div style={styles.priceContainer}>
              <h3 style={styles.statValue}>${btcPrice.toLocaleString()}</h3>
              <span style={{...styles.priceChange, color: btcChange > 0 ? '#6ee7b7' : '#fca5a5'}}>
                {btcChange > 0 ? '+' : ''}{btcChange.toFixed(2)}%
              </span>
            </div>
          </div>

          <div style={styles.statCard} className="card-hover">
            <div style={styles.statHeader}>
              <span style={styles.statIcon}>Sentiment</span>
              {/* <div style={styles.aiBadge}>AI</div> */}
            </div>
            {/* <p style={styles.statLabel}>Sentiment</p> */}
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
                <div style={styles.noData}>No chart data available</div>
              )}
            </div>
          </div>

          <div style={styles.newsCard} className="card-hover">
            <div style={styles.newsHeader}>
              <span style={styles.newsIcon}></span>
              <h3 style={styles.cardTitle}>Latest News</h3>
            </div>
            <div style={styles.newsList}>
              {news.map((title, i) => (
                <div key={i} style={styles.newsItem} className="news-item">
                  <p style={styles.newsText}>{title}</p>
                </div>
              ))}
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
                      No trades yet. AI is analyzing market conditions...
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
    color: 'white',
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
    color: 'white',
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
    color: 'white',
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
    color: 'white',
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
    color: 'black',
    fontWeight: '400',
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
    color: 'white',
  },
  statLabel: {
    fontSize: '0.875rem',
    color: 'rgba(255, 255, 255, 0.7)',
    margin: '0 0 0.5rem 0',
  },
  statValue: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: 'white',
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
  cardTitle: {
    fontSize: '1.25rem',
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
    color: 'white',
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