import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRateLimiter } from './rate-limit'

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-26T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('blocks requests above the window limit', () => {
    const limit = createRateLimiter({ windowMs: 1_000, maxRequests: 2 })

    expect(limit('127.0.0.1')).toEqual({ allowed: true })
    expect(limit('127.0.0.1')).toEqual({ allowed: true })
    expect(limit('127.0.0.1').allowed).toBe(false)

    vi.advanceTimersByTime(1_001)
    expect(limit('127.0.0.1')).toEqual({ allowed: true })
  })

  it('temporarily blocks after repeated failures', () => {
    const limit = createRateLimiter({
      windowMs: 60_000,
      maxRequests: 10,
      maxFailures: 2,
      blockDurationMs: 5_000,
    })

    expect(limit('127.0.0.1', true)).toEqual({ allowed: true })
    expect(limit('127.0.0.1', true)).toEqual({ allowed: false, retryAfterMs: 5_000 })
    expect(limit('127.0.0.1').allowed).toBe(false)

    vi.advanceTimersByTime(5_001)
    expect(limit('127.0.0.1')).toEqual({ allowed: true })
  })
})
