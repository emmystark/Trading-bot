'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import axios from 'axios'
import './styles.css'   // <-- import the CSS

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
  const [chartData, setChartData] = useState<{ time: string; price: number }[]>([])
  const [balance, setBalance] = useState('0')

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const [tradesRes, chartRes, balanceRes] = await Promise.all([
        axios.get('http://localhost:3001/api/trades'),
        axios.get('http://localhost:3001/api/market'),
        axios.get('http://localhost:3001/api/balance')
      ])
  
      setTrades(tradesRes.data || [])
      setChartData(chartRes.data.chartData || [])  // ← Critical
      setBalance(balanceRes.data.balance || '0')
    } catch (error) {
      console.error('Fetch error:', error)
      setChartData([])
    }
  }

  return (
    <div className="container">
      {/* Header */}
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <i className="fas fa-wallet" style={{ fontSize: '2rem', color: '#60a5fa' }}></i>
          <h1>Seismic Trading Bot</h1>
        </div>
        <button className="btn" onClick={fetchData}>
          <i className="fas fa-sync-alt"></i> Refresh
        </button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-4">
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <i className="fas fa-dollar-sign"></i> Balance
            </div>
            <div className="card-desc">${balance}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <i className="fas fa-exchange-alt"></i> Active Trades
            </div>
            <div className="card-desc">
              {trades.filter(t => t.status === 'Active').length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <i className="fas fa-chart-line"></i> Today&apos;s P&L
            </div>
            <div style={{ color: '#86efac' }}>+2.3%</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <i className="fas fa-clock"></i> Next Scan
            </div>
            <div className="card-desc">In 15min</div>
          </div>
        </div>
      </div>

      {/* Charts + Signals */}
      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">BTC 24hr Chart</div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="price" stroke="#10B981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Signals</div>
          </div>
          <ul style={{ paddingLeft: '1.25rem', listStyle: 'none' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <i className="fas fa-bullhorn" style={{ color: '#86efac' }}></i>
              BTC surges on ETF news (+0.8)
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="fas fa-arrow-up" style={{ color: '#60a5fa' }}></i>
              ETH +1.2% → Buy signal
            </li>
          </ul>
        </div>
      </div>

      {/* Trade History */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <div className="card-header">
          <div className="card-title">Trade History</div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Asset</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>P&L</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr key={trade.id}>
                  <td>{trade.id}</td>
                  <td>{trade.asset}</td>
                  <td style={{ filter: 'blur(4px)' }}>{trade.entry}</td>
                  <td style={{ filter: 'blur(4px)' }}>{trade.exit || 'Open'}</td>
                  <td className={trade.pnl > 0 ? 'text-green' : 'text-red'}>
                    {trade.pnl > 0 ? '+' : ''}{trade.pnl}%
                  </td>
                  <td>
                    <span className={`status ${trade.status === 'Active' ? 'status-active' : 'status-closed'}`}>
                      {trade.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}