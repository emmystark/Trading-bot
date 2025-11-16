import type { Metadata } from 'next'
import './globals.css'
import FontAwesomeProvider from '../components/FontAwesomeProvider'

export const metadata: Metadata = {
  title: 'Seismic Trading Bot',
  description: 'Privacy-first crypto trading on Seismic testnet',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground font-sans">
        <FontAwesomeProvider>
          {children}
        </FontAwesomeProvider>
      </body>
    </html>
  )
}