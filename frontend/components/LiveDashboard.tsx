'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { useWebhook, WebhookData } from '@/hooks/useWebhook';
import { AlertCircle, TrendingUp, TrendingDown, DollarSign, Activity, Zap, Loader } from 'lucide-react';

interface LiveDashboardProps {
  coinId: string;
  apiUrl?: string;
  userAddress?: string;
  onCoinChange?: (coinId: string) => void;
}

export default function LiveDashboard({
  coinId,
  apiUrl = 'http://localhost:3001',
  userAddress,
  onCoinChange
}: LiveDashboardProps) {
  const [signal, setSignal] = useState('HOLD');
  const [confidence, setConfidence] = useState(0);
  const [balance, setBalance] = useState('0');
  const [chartData, setChartData] = useState<any[]>([]);
  const [price, setPrice] = useState(0);
  const [priceChange, setPriceChange] = useState(0);
  const [trades, setTrades] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState('');
  const [positionSize, setPositionSize] = useState(0);
  const [coinInfo, setCoinInfo] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [coinChanging, setCoinChanging] = useState(false);
  const [connectionStable, setConnectionStable] = useState(false);
  const connectionCheckTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const previousCoinRef = React.useRef(coinId);

  // Detect coin change and show loading
  useEffect(() => {
    if (previousCoinRef.current !== coinId) {
      setCoinChanging(true);
      setIsLoading(true);
      previousCoinRef.current = coinId;
      onCoinChange?.(coinId);
    }
  }, [coinId, onCoinChange]);

  // Construct webhook URL with address if provided
  const webhookUrl = useMemo(() => {
    const baseUrl = `${apiUrl}/api/webhook/live/${coinId}`;
    return userAddress ? `${baseUrl}?address=${userAddress}` : baseUrl;
  }, [coinId, apiUrl, userAddress]);

  // Use the custom webhook hook
  const { isConnected, error, data } = useWebhook({
    url: webhookUrl,
    onData: (webhookData: WebhookData) => {
      setIsLoading(false);
      setCoinChanging(false);

      // Update balance
      if (webhookData.balance) {
        setBalance(webhookData.balance.amount);
      }

      // Update price and chart
      if (webhookData.coin) {
        setPrice(webhookData.coin.current_price);
        setPriceChange(webhookData.coin.price_change_percentage_24h);
        setCoinInfo(webhookData.coin);
      }

      // Update chart data
      if (webhookData.chart?.prices) {
        const formatted = webhookData.chart.prices.map((p) => ({
          time: new Date(p.time).toLocaleTimeString(),
          price: p.price,
          fullTime: p.time
        }));
        setChartData(formatted);
      }

      // Update AI Signal
      if (webhookData.aiSignal) {
        setSignal(webhookData.aiSignal.signal);
        setConfidence(webhookData.aiSignal.confidence);
        setPositionSize(webhookData.aiSignal.positionSize);
      }

      // Update Analysis
      if (webhookData.analysis) {
        setAnalysis(webhookData.analysis.reasoning);
      }

      // Update trades
      if (webhookData.trades) {
        setTrades(webhookData.trades);
      }

      // Update timestamp
      setLastUpdate(new Date().toLocaleTimeString());
    },
    onConnect: () => {
      console.log('✅ Connected to webhook:', webhookUrl);
      setConnectionStable(true);
      // Clear any pending timeout
      if (connectionCheckTimeoutRef.current) {
        clearTimeout(connectionCheckTimeoutRef.current);
      }
    },
    onError: (err) => {
      console.error('❌ Webhook error:', err);
      setConnectionStable(false);
    }
  });

  // Monitor connection stability - only show disconnected after 5 seconds of being disconnected
  useEffect(() => {
    if (!isConnected && connectionStable) {
      connectionCheckTimeoutRef.current = setTimeout(() => {
        setConnectionStable(false);
      }, 5000);
    } else if (isConnected) {
      setConnectionStable(true);
      if (connectionCheckTimeoutRef.current) {
        clearTimeout(connectionCheckTimeoutRef.current);
      }
    }

    return () => {
      if (connectionCheckTimeoutRef.current) {
        clearTimeout(connectionCheckTimeoutRef.current);
      }
    };
  }, [isConnected]);

  const signalColor = signal === 'BUY' ? '#10b981' : signal === 'SELL' ? '#ef4444' : '#3b82f6';
  const signalBgGradient =
    signal === 'BUY'
      ? 'linear-gradient(135deg, #10b981, #059669)'
      : signal === 'SELL'
      ? 'linear-gradient(135deg, #ef4444, #dc2626)'
      : 'linear-gradient(135deg, #3b82f6, #2563eb)';

  return (
    <div style={styles.container}>
      {/* Connection Status Banner */}
      <div
        style={{
          ...styles.statusBanner,
          background: connectionStable ? '#10b98144' : '#ef444444'
        }}
      >
        <span 
          style={{
            ...styles.statusDot,
            color: connectionStable ? '#10b981' : '#ef4444',
            opacity: connectionStable ? 1 : 0.5
          }}
        >
          {connectionStable ? '●' : '○'}
        </span>
        <span style={{ color: connectionStable ? '#059669' : '#dc2626' }}>
          {connectionStable ? '✓ Live Connected' : '✕ Disconnected'}
        </span>
        {lastUpdate && connectionStable && <span style={styles.timestamp}>Last update: {lastUpdate}</span>}
      </div>

      {/* Coin Change Indicator */}
      {coinChanging && (
        <div style={styles.coinChangingBanner}>
          <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Loading {coinInfo?.name} data...</span>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={styles.errorBanner}>
          <AlertCircle size={20} />
          <span>{error.message}</span>
        </div>
      )}

      {/* Signal Banner */}
      <div style={{ ...styles.signalBanner, background: signalBgGradient }}>
        <div style={styles.signalContent}>
          <span
            style={{
              ...styles.pulseIndicator,
              color: signalColor,
              animation: isLoading ? 'none' : 'pulse 2s infinite'
            }}
          >
            {isLoading ? '◌' : '●'}
          </span>
          <h2 style={styles.signalTitle}>
            {isLoading ? 'Loading Signal...' : `AI SIGNAL: ${signal}`}
          </h2>
        </div>
        {!isLoading && (
          <>
            <p style={styles.signalMetrics}>
              Confidence: {(confidence * 100).toFixed(1)}% • Position Size: {(positionSize * 100).toFixed(1)}%
            </p>
            <p style={styles.analysisText}>{analysis}</p>
          </>
        )}
      </div>

      {/* Stats Grid */}
      <div style={styles.statsGrid}>
        {/* Balance Card */}
        <div style={styles.statCard} className="card-hover">
          <div style={styles.cardHeader}>
            <DollarSign size={24} style={{ color: '#3b82f6' }} />
            <h3>Balance</h3>
          </div>
          {isLoading ? (
            <div style={styles.skeleton} />
          ) : (
            <>
              <p style={styles.cardValue}>{parseFloat(balance || '0').toFixed(6)} ETH</p>
              <p style={styles.cardLabel}>Sepolia Testnet</p>
            </>
          )}
        </div>

        {/* Price Card */}
        <div style={styles.statCard} className="card-hover">
          <div style={styles.cardHeader}>
            <TrendingUp size={24} style={{ color: '#10b981' }} />
            <h3>Current Price</h3>
          </div>
          {isLoading ? (
            <div style={styles.skeleton} />
          ) : (
            <>
              <p style={styles.cardValue}>${price.toFixed(2)}</p>
              <p
                style={{
                  ...styles.cardLabel,
                  color: priceChange >= 0 ? '#10b981' : '#ef4444'
                }}
              >
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}% (24h)
              </p>
            </>
          )}
        </div>

        {/* Confidence Card */}
        <div style={styles.statCard} className="card-hover">
          <div style={styles.cardHeader}>
            <Zap size={24} style={{ color: '#f59e0b' }} />
            <h3>Confidence</h3>
          </div>
          {isLoading ? (
            <div style={styles.skeleton} />
          ) : (
            <>
              <p style={styles.cardValue}>{(confidence * 100).toFixed(1)}%</p>
              <p style={styles.cardLabel}>{signal} Signal Strength</p>
            </>
          )}
        </div>

        {/* Position Size Card */}
        <div style={styles.statCard} className="card-hover">
          <div style={styles.cardHeader}>
            <Activity size={24} style={{ color: '#8b5cf6' }} />
            <h3>Position Size</h3>
          </div>
          {isLoading ? (
            <div style={styles.skeleton} />
          ) : (
            <>
              <p style={styles.cardValue}>{(positionSize * 100).toFixed(1)}%</p>
              <p style={styles.cardLabel}>Recommended Allocation</p>
            </>
          )}
        </div>
      </div>

      {/* Chart Section */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          <TrendingUp size={20} />
          Dynamic Price Chart (24h)
        </h3>
        {isLoading ? (
          <div style={{ ...styles.chartContainer, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
            <div style={{ textAlign: 'center' }}>
              <Loader size={40} style={{ animation: 'spin 1s linear infinite', margin: '0 auto', marginBottom: '12px', color: '#a594a8' }} />
              <p style={{ color: '#cbd5e1' }}>Loading chart data...</p>
            </div>
          </div>
        ) : chartData.length > 0 ? (
          <div style={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a594a8" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#a594a8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" />
                <XAxis
                  dataKey="time"
                  stroke="#94a3b8"
                  style={{ fontSize: '12px' }}
                  tick={{ fill: '#cbd5e1' }}
                />
                <YAxis
                  stroke="#94a3b8"
                  style={{ fontSize: '12px' }}
                  tick={{ fill: '#cbd5e1' }}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  labelStyle={{ color: '#cbd5e1' }}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#a594a8"
                  fillOpacity={1}
                  fill="url(#colorPrice)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p style={styles.placeholderText}>Waiting for chart data...</p>
        )}
      </div>

      {/* Analysis Section */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>📊 Dynamic Analysis</h3>
        <div style={styles.analysisBox}>
          <p style={styles.analysisTitle}>AI Market Analysis</p>
          {isLoading ? (
            <>
              <div style={{ ...styles.skeleton, marginBottom: '12px' }} />
              <div style={{ ...styles.skeleton, marginBottom: '12px', width: '80%' }} />
            </>
          ) : (
            <>
              <p style={styles.analysisContent}>
                {analysis || 'Analyzing market trends...'}
              </p>
              <div style={styles.analysisMetrics}>
                <div style={styles.metricItem}>
                  <span style={styles.metricLabel}>Signal:</span>
                  <span
                    style={{
                      ...styles.metricValue,
                      color: signalColor
                    }}
                  >
                    {signal}
                  </span>
                </div>
                <div style={styles.metricItem}>
                  <span style={styles.metricLabel}>Confidence:</span>
                  <span style={styles.metricValue}>{(confidence * 100).toFixed(1)}%</span>
                </div>
                <div style={styles.metricItem}>
                  <span style={styles.metricLabel}>Coin:</span>
                  <span style={styles.metricValue}>
                    {coinInfo?.name || 'Loading...'} ({coinInfo?.symbol?.toUpperCase()})
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Trades Section */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>💼 Trade History</h3>
        {isLoading ? (
          <div style={{ ...styles.tradesContainer }}>
            {[1, 2].map((i) => (
              <div key={i} style={styles.tradeCard}>
                <div style={{ ...styles.skeleton, marginBottom: '12px' }} />
                <div style={{ ...styles.skeleton, width: '60%' }} />
              </div>
            ))}
          </div>
        ) : trades.length > 0 ? (
          <div style={styles.tradesContainer}>
            {trades.map((trade) => (
              <div
                key={trade.id}
                style={{
                  ...styles.tradeCard,
                  borderLeft: `4px solid ${trade.status === 'Active' ? '#10b981' : '#ef4444'}`
                }}
                className="card-hover"
              >
                <div style={styles.tradeHeader}>
                  <span style={styles.tradeId}>{trade.id}</span>
                  <span
                    style={{
                      ...styles.tradeStatus,
                      background: trade.status === 'Active' ? '#10b98122' : '#ef444422',
                      color: trade.status === 'Active' ? '#10b981' : '#ef4444'
                    }}
                  >
                    {trade.status}
                  </span>
                </div>
                <div style={styles.tradeDetails}>
                  <div>
                    <span style={styles.tradeLabel}>Entry:</span>
                    <span style={styles.tradeValue}>${trade.entry}</span>
                  </div>
                  {trade.exit && (
                    <div>
                      <span style={styles.tradeLabel}>Exit:</span>
                      <span style={styles.tradeValue}>${trade.exit}</span>
                    </div>
                  )}
                  <div>
                    <span style={styles.tradeLabel}>P&L:</span>
                    <span
                      style={{
                        ...styles.tradeValue,
                        color: trade.pnl >= 0 ? '#10b981' : '#ef4444'
                      }}
                    >
                      ${trade.pnl.toFixed(2)}
                    </span>
                  </div>
                </div>
                <p style={styles.tradeTime}>{new Date(trade.timestamp).toLocaleString()}</p>
              </div>
            ))}
          </div>
        ) : (
          <p style={styles.placeholderText}>No trades recorded yet</p>
        )}
      </div>

      <style>{`
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

        .card-hover {
          transition: all 0.3s ease;
        }

        .card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    padding: '24px',
    background: 'linear-gradient(135deg, #8b7b8f 0%, #9d8ba0 50%, #b39bb7 100%)',
    color: '#e2e8f0',
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  } as React.CSSProperties,

  statusBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'all 0.3s ease'
  } as React.CSSProperties,

  statusDot: {
    fontSize: '16px',
    fontWeight: 'bold',
    transition: 'opacity 0.3s ease'
  } as React.CSSProperties,

  timestamp: {
    marginLeft: 'auto',
    fontSize: '12px',
    opacity: 0.7
  } as React.CSSProperties,

  coinChangingBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: 'rgba(168, 148, 166, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    marginBottom: '20px',
    color: '#cbd5e1',
    fontSize: '14px'
  } as React.CSSProperties,

  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: '#ef444422',
    border: '1px solid #ef4444',
    borderRadius: '8px',
    marginBottom: '20px',
    color: '#fca5a5'
  } as React.CSSProperties,

  signalBanner: {
    padding: '24px',
    borderRadius: '12px',
    marginBottom: '24px',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  } as React.CSSProperties,

  signalContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px'
  } as React.CSSProperties,

  pulseIndicator: {
    fontSize: '24px'
  } as React.CSSProperties,

  signalTitle: {
    fontSize: '28px',
    fontWeight: 'bold',
    margin: 0
  } as React.CSSProperties,

  signalMetrics: {
    margin: '12px 0 0 0',
    fontSize: '14px',
    opacity: 0.9
  } as React.CSSProperties,

  analysisText: {
    margin: '12px 0 0 0',
    fontSize: '14px',
    fontStyle: 'italic',
    opacity: 0.95,
    lineHeight: '1.5'
  } as React.CSSProperties,

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px'
  } as React.CSSProperties,

  statCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '20px',
    backdropFilter: 'blur(10px)'
  } as React.CSSProperties,

  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px'
  } as React.CSSProperties,

  cardValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    margin: '8px 0',
    minHeight: '32px'
  } as React.CSSProperties,

  cardLabel: {
    fontSize: '12px',
    opacity: 0.7,
    margin: 0
  } as React.CSSProperties,

  skeleton: {
    height: '24px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '4px',
    animation: 'pulse 1.5s ease-in-out infinite'
  } as React.CSSProperties,

  section: {
    marginBottom: '24px'
  } as React.CSSProperties,

  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '16px',
    margin: '0 0 16px 0'
  } as React.CSSProperties,

  chartContainer: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '16px',
    backdropFilter: 'blur(10px)'
  } as React.CSSProperties,

  placeholderText: {
    textAlign: 'center' as const,
    padding: '24px',
    opacity: 0.6,
    fontSize: '14px'
  } as React.CSSProperties,

  analysisBox: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '20px',
    backdropFilter: 'blur(10px)'
  } as React.CSSProperties,

  analysisTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '12px',
    margin: '0 0 12px 0'
  } as React.CSSProperties,

  analysisContent: {
    fontSize: '14px',
    lineHeight: '1.6',
    marginBottom: '16px',
    margin: '0 0 16px 0'
  } as React.CSSProperties,

  analysisMetrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '12px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)'
  } as React.CSSProperties,

  metricItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px'
  } as React.CSSProperties,

  metricLabel: {
    opacity: 0.7
  } as React.CSSProperties,

  metricValue: {
    fontWeight: '600'
  } as React.CSSProperties,

  tradesContainer: {
    display: 'grid',
    gap: '12px'
  } as React.CSSProperties,

  tradeCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '16px',
    backdropFilter: 'blur(10px)'
  } as React.CSSProperties,

  tradeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  } as React.CSSProperties,

  tradeId: {
    fontSize: '14px',
    fontWeight: '600'
  } as React.CSSProperties,

  tradeStatus: {
    fontSize: '12px',
    fontWeight: '600',
    padding: '4px 12px',
    borderRadius: '20px'
  } as React.CSSProperties,

  tradeDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '12px',
    marginBottom: '12px'
  } as React.CSSProperties,

  tradeLabel: {
    fontSize: '12px',
    opacity: 0.7,
    display: 'block',
    marginBottom: '4px'
  } as React.CSSProperties,

  tradeValue: {
    fontSize: '14px',
    fontWeight: '600',
    display: 'block'
  } as React.CSSProperties,

  tradeTime: {
    fontSize: '11px',
    opacity: 0.5,
    margin: 0
  } as React.CSSProperties
};
