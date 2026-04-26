import { describe, expect, it } from 'vitest'
import { isProcessingStale } from './clusters'

describe('cluster processing lock helpers', () => {
  it('treats recent processing locks as active', () => {
    expect(
      isProcessingStale('2026-04-26T12:00:00.000Z', new Date('2026-04-26T12:04:59.000Z')),
    ).toBe(false)
  })

  it('treats locks older than five minutes as stale', () => {
    expect(
      isProcessingStale('2026-04-26T12:00:00.000Z', new Date('2026-04-26T12:05:01.000Z')),
    ).toBe(true)
  })

  it('treats malformed timestamps as stale for recovery', () => {
    expect(isProcessingStale('not-a-date')).toBe(true)
  })
})
