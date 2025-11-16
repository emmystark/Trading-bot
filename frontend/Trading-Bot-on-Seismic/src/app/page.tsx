'use client'

import { useEffect, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useBalance, useSwitchChain, useChainId } from 'wagmi'
import { formatEther } from 'viem'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faWallet,
  faCopy,
  faSignOutAlt,
  faSyncAlt,
  faCheckCircle,
  faExternalLinkAlt,
} from '@fortawesome/free-solid-svg-icons'
import { seismicDevnet2 } from '@/lib/chains'

export default function Home() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: balance } = useBalance({ address })
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const [copied, setCopied] = useState(false)
  const [txs, setTxs] = useState<any[]>([])
  const [loadingTxs, setLoadingTxs] = useState(false)

  // Auto-switch to Seismic Testnet
  useEffect(() => {
    if (isConnected && chainId !== seismicDevnet2.id) {
      switchChain({ chainId: seismicDevnet2.id })
    }
  }, [isConnected, chainId, switchChain])

  // Fetch recent transactions
  useEffect(() => {
    if (!address) return
    const fetchTxs = async () => {
      setLoadingTxs(true)
      try {
        const res = await fetch(
          `https://explorer-2.seismicdev.net/api?module=account&action=txlist&address=${address}&sort=desc&page=1&offset=5`
        )
        const data = await res.json()
        setTxs(data.result || [])
      } catch (e) {
        console.error(e)
      }
      setLoadingTxs(false)
    }
    fetchTxs()
  }, [address])

  const copyAddress = () => {
    navigator.clipboard.writeText(address!)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl p-8 border border-white/20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Seismic Testnet</h1>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-white/80">Live</span>
          </div>
        </div>

        {/* Wallet Card */}
        <div className="space-y-6">
          {isConnected ? (
            <>
              {/* Address + Balance */}
              <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-white/60">Connected Address</span>
                  <button
                    onClick={copyAddress}
                    className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition"
                  >
                    <FontAwesomeIcon icon={copied ? faCheckCircle : faCopy} className="w-3 h-3" />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="font-mono text-lg text-white break-all">{address}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-white/60">Balance</span>
                  <span className="text-2xl font-semibold text-white">
                    {balance ? `${parseFloat(formatEther(balance.value)).toFixed(4)} ETH` : '—'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => disconnect()}
                  className="flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 py-3 rounded-xl transition"
                >
                  <FontAwesomeIcon icon={faSignOutAlt} className="w-5 h-5" />
                  Disconnect
                </button>
                <button
                  onClick={() => switchChain({ chainId: seismicDevnet2.id })}
                  className="flex items-center justify-center gap-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 py-3 rounded-xl transition"
                >
                  <FontAwesomeIcon icon={faSyncAlt} className="w-5 h-5" />
                  Switch Chain
                </button>
              </div>

              {/* Recent Transactions */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-white mb-3">Recent Transactions</h3>
                {loadingTxs ? (
                  <p className="text-sm text-white/60">Loading...</p>
                ) : txs.length === 0 ? (
                  <p className="text-sm text-white/60">No transactions yet.</p>
                ) : (
                  <div className="space-y-2">
                    {txs.map((tx: any) => (
                      <a
                        key={tx.hash}
                        href={`https://explorer-2.seismicdev.net/tx/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 bg-white/5 rounded-lg hover:bg-white/10 transition border border-white/10"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-xs text-cyan-400">
                            {tx.hash.slice(0, 12)}...
                          </span>
                          <div className="flex items-center gap-1 text-xs text-white/60">
                            {new Date(tx.timeStamp * 1000).toLocaleTimeString()}
                            <FontAwesomeIcon icon={faExternalLinkAlt} className="w-3 h-3 ml-1" />
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Connect Wallet UI */
            <div className="text-center space-y-6">
              <FontAwesomeIcon icon={faWallet} className="w-16 h-16 text-cyan-400" />
              <h2 className="text-2xl font-bold text-white">Connect Your Wallet</h2>
              <p className="text-white/60">Choose a connector to interact with Seismic Testnet</p>
              <div className="grid gap-3">
                {connectors.map((connector) => (
                  <button
                    key={connector.id}
                    onClick={() => connect({ connector })}
                    disabled={!connector.ready}
                    className="flex items-center justify-center gap-3 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-medium py-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {connector.icon ? (
                      <img src={connector.icon} alt="" className="w-6 h-6" />
                    ) : (
                      <FontAwesomeIcon icon={faWallet} className="w-6 h-6" />
                    )}
                    {connector.ready ? `Connect ${connector.name}` : `${connector.name} (not ready)`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-xs text-white/40">
          Chain ID: <span className="font-mono">{seismicDevnet2.id}</span> •{' '}
          <a
            href="https://explorer-2.seismicdev.net"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View on SeismicScan
          </a>
        </div>
      </div>
    </div>
  )
}