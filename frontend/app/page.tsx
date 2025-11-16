'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Auto-redirect to dashboard on load
    router.push('/dashboard')
  }, [router])

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Seismic Trading Bot</h1>
        <p className="text-xl text-muted-foreground mb-6">Loading dashboard...</p>
        {/* Fallback spinner */}
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    </div>
  )
}