import type { NextRequest } from 'next/server'

type Bucket = {
  hits: number[]
  failures: number
  blockedUntil: number
}

export type RateLimitResult = {
  allowed: boolean
  retryAfterMs?: number
}

export function createRateLimiter(options: {
  windowMs?: number
  maxRequests?: number
  maxFailures?: number
  blockDurationMs?: number
} = {}) {
  const windowMs = options.windowMs ?? 60_000
  const maxRequests = options.maxRequests ?? 10
  const maxFailures = options.maxFailures ?? 5
  const blockDurationMs = options.blockDurationMs ?? 60_000
  const buckets = new Map<string, Bucket>()

  return (ip: string, failed?: boolean): RateLimitResult => {
    const now = Date.now()
    const bucket = buckets.get(ip) ?? { hits: [], failures: 0, blockedUntil: 0 }

    if (bucket.blockedUntil > now) {
      buckets.set(ip, bucket)
      return { allowed: false, retryAfterMs: bucket.blockedUntil - now }
    }

    if (failed === true) {
      bucket.failures += 1
      if (bucket.failures >= maxFailures) {
        bucket.blockedUntil = now + blockDurationMs
        buckets.set(ip, bucket)
        return { allowed: false, retryAfterMs: blockDurationMs }
      }
    } else if (failed === false) {
      bucket.failures = 0
    } else {
      bucket.hits = bucket.hits.filter((hit) => now - hit < windowMs)

      if (bucket.hits.length >= maxRequests) {
        const retryAfterMs = windowMs - (now - bucket.hits[0])
        buckets.set(ip, bucket)
        return { allowed: false, retryAfterMs }
      }

      bucket.hits.push(now)
    }

    buckets.set(ip, bucket)
    return { allowed: true }
  }
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || '127.0.0.1'
  }

  return (
    req.headers.get('x-real-ip') ??
    (req as NextRequest & { ip?: string }).ip ??
    '127.0.0.1'
  )
}
