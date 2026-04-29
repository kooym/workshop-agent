type SkeletonProps = {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-apple-sm bg-canvas-parchment ${className}`}
      aria-hidden
    />
  )
}
