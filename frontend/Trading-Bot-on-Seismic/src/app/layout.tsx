// app/layout.tsx
import { Providers } from '@/components/Providers'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { config } from '@fortawesome/fontawesome-svg-core'
config.autoAddCss = false

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}