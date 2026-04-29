import type { ReactNode } from 'react'

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
      {icon ? <div className="mb-4 text-ink-muted-48">{icon}</div> : null}
      <h3 className="text-base font-medium text-ink">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-6 text-ink-muted-48">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
