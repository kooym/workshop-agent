import { describe, expect, it } from 'vitest'
import {
  getNextStage,
  getStaleTargets,
  isForwardStageTransition,
  validateSettingsPatch,
  validateStageTransition,
} from './stage'

describe('workshop stage lifecycle rules', () => {
  it('allows only one-step forward transitions', () => {
    expect(getNextStage('context')).toBe('gather')
    expect(isForwardStageTransition('context', 'gather')).toBe(true)
    expect(isForwardStageTransition('vote', 'gather')).toBe(false)
    expect(isForwardStageTransition('context', 'cluster')).toBe(false)
  })

  it('rejects backward, skipped, and completed transitions', () => {
    expect(validateStageTransition('vote', 'gather')).toContain('정해진 순서')
    expect(validateStageTransition('context', 'cluster')).toContain('정해진 순서')
    expect(validateStageTransition('completed', 'completed')).toContain('완료된')
    expect(validateStageTransition('report', 'completed')).toBeNull()
  })

  it('enforces settings edit windows', () => {
    expect(validateSettingsPatch('cluster', 3, { anonymous: true })).toContain('익명')
    expect(validateSettingsPatch('vote', 3, { votes_per_person: 5 })).toContain('투표 수')
    expect(validateSettingsPatch('vote', 3, { vote_mode: 'note' })).toContain('투표 대상')
    expect(validateSettingsPatch('gather', 4, { max_participants: 3 })).toContain('현재 참가자')
    expect(validateSettingsPatch('report', 4, { results_visible: true })).toBeNull()
    expect(validateSettingsPatch('completed', 4, { timer_minutes: 10 })).toContain('완료된')
  })

  it('maps modified stages to downstream stale targets', () => {
    expect(getStaleTargets('context')).toEqual([
      'clusters',
      'design_artifacts',
      'prds',
      'ax_reports',
    ])
    expect(getStaleTargets('vote')).toEqual(['design_artifacts', 'prds', 'ax_reports'])
    expect(getStaleTargets('generate')).toEqual(['ax_reports'])
    expect(getStaleTargets('completed')).toEqual([])
  })
})
