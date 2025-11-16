'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import axios from 'axios'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FontAwesomeIcon } from '@/app/components/FontAwesomeProvider' // Import here

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
      setTrades(tradesRes.data)
      setChartData(chartRes.data)
      setBalance(balanceRes.data.balance)
    } catch (error) {
      console.error('Fetch error:', error)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <FontAwesomeIcon icon="wallet" className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Seismic Trading Bot</h1>
        </div>
        <Button onClick={fetchData}>
          <FontAwesomeIcon icon="sync" className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FontAwesomeIcon icon="dollar-sign" className="h-5 w-5" />
              Balance
            </CardTitle>
            <CardDescription className="filter blur-sm cursor-pointer hover:blur-none transition">
              ${balance}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FontAwesomeIcon icon="exchange-alt" className="h-5 w-5" />
              Active Trades
            </CardTitle>
            <CardDescription>{trades.filter(t => t.status === 'Active').length}</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FontAwesomeIcon icon="chart-line" className="h-5 w-5" />
              Today&apos;s P&L
            </CardTitle>
            <CardDescription className="text-green-500">+2.3%</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FontAwesomeIcon icon="clock" className="h-5 w-5" />
              Next Scan
            </CardTitle>
            <CardDescription>In 15min</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>BTC 24hr Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="price" stroke="#10B981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Signals</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <FontAwesomeIcon icon="bullhorn" className="h-4 w-4 text-green-500" />
                BTC surges on ETF news (+0.8)
              </li>
              <li className="flex items-center gap-2">
                <FontAwesomeIcon icon="arrow-up" className="h-4 w-4 text-blue-500" />
                ETH +1.2% → Buy signal
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">ID</th>
                  <th className="text-left py-2">Asset</th>
                  <th className="text-left py-2">Entry</th>
                  <th className="text-left py-2">Exit</th>
                  <th className="text-left py-2">P&L</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={trade.id} className="border-b">
                    <td>{trade.id}</td>
                    <td>{trade.asset}</td>
                    <td className="filter blur-sm">{trade.entry}</td>
                    <td className="filter blur-sm">{trade.exit || 'Open'}</td>
                    <td className={trade.pnl > 0 ? 'text-green-500' : 'text-red-500'}>
                      {trade.pnl > 0 ? '+' : ''}{trade.pnl}%
                    </td>
                    <td>
                      <span className={`px-2 py-1 rounded text-xs ${trade.status === 'Active' ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'}`}>
                        {trade.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}