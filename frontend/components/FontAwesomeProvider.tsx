'use client'

import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ReactNode } from 'react'

// Add all solid icons to the library
library.add(fas)

export default function FontAwesomeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

// Export Icon component for easy use
export { FontAwesomeIcon }