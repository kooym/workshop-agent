import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORKSHOP_SETTINGS,
  WORKSHOP_SETTING_LIMITS,
  WORKSHOP_STAGES,
} from './workshop'

describe('workshop domain constants', () => {
  it('matches the documented workshop stage sequence', () => {
    expect(WORKSHOP_STAGES).toEqual([
      'context',
      'gather',
      'cluster',
      'vote',
      'design',
      'generate',
      'report',
      'completed',
    ])
  })

  it('keeps default settings aligned with the database default', () => {
    expect(DEFAULT_WORKSHOP_SETTINGS).toEqual({
      anonymous: false,
      votes_per_person: 3,
      max_participants: 20,
      results_visible: false,
      vote_mode: 'cluster',
      timer_minutes: null,
    })
  })

  it('documents the API validation ranges that mirror SQL checks', () => {
    expect(WORKSHOP_SETTING_LIMITS).toEqual({
      votes_per_person: { min: 1, max: 10 },
      max_participants: { min: 2, max: 20 },
      timer_minutes: { min: 1, max: 60 },
    })
  })
})
