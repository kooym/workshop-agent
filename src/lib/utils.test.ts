import { describe, expect, it } from 'vitest'
import { generateInviteCode } from './utils'

describe('generateInviteCode', () => {
  it('uses six unambiguous uppercase characters', () => {
    for (let index = 0; index < 100; index += 1) {
      expect(generateInviteCode()).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/)
    }
  })
})
