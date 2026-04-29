import type { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`rounded-apple-lg border border-hairline bg-white ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: CardProps) {
  return <div className={`border-b border-divider-soft px-5 py-4 ${className}`}>{children}</div>
}

export function CardBody({ children, className = '' }: CardProps) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>
}
