// frontend/app/not-found.tsx
'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FontAwesomeIcon } from '@/app/components/FontAwesomeProvider'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
      <div className="text-center">
        <FontAwesomeIcon icon="exclamation-triangle" className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-4xl font-bold mb-2">404 - Page Not Found</h1>
        <p className="text-xl text-muted-foreground mb-8">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild>
          <Link href="/dashboard">
            <FontAwesomeIcon icon="home" className="mr-2 h-4 w-4" />
            Go to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  )
}