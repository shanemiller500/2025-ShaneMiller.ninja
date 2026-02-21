import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  /** Apply odd/even tilt animation — use inside a list of cards */
  tilt?: boolean
}

export function Card({ children, className = '', tilt = false }: CardProps) {
  const tiltClass = tilt
    ? 'odd:-rotate-1 even:rotate-1 hover:rotate-0 transition-transform duration-700 hover:duration-100 ease-in-out'
    : ''

  return (
    <div
      className={`rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-brand-900 ${tiltClass} ${className}`}
    >
      {children}
    </div>
  )
}
