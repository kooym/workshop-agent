import { describe, expect, it } from 'vitest'
import { validateStagePrerequisites } from './stage'
import type { WorkshopSummary } from './summary'

const baseSummary = {
  counts: {
    process_steps: 1,
    process_lanes: 1,
    notes: 5,
    clusters: 1,
    votes: 0,
    participants: 2,
    voted_participants: 0,
    tasks: 1,
  },
  has_start_event: true,
  has_end_event: true,
  latest_versions: {
    design_artifact: 1,
    prd: 1,
    report: 1,
  },
  stale: {
    clusters: false,
    design_artifacts: false,
    prds: false,
    ax_reports: false,
  },
  contribution: null,
} satisfies WorkshopSummary

describe('stage prerequisites', () => {
  it('requires start and end events before gathering', () => {
    expect(
      validateStagePrerequisites('context', 'gather', {
        ...baseSummary,
        has_end_event: false,
      }),
    ).toContain('시작 이벤트와 종료 이벤트')
  })

  it('requires at least five notes before clustering', () => {
    expect(
      validateStagePrerequisites('gather', 'cluster', {
        ...baseSummary,
        counts: { ...baseSummary.counts, notes: 4 },
      }),
    ).toBe('최소 5개의 포스트잇이 필요합니다.')
  })

  it('allows vote to design without requiring votes', () => {
    expect(validateStagePrerequisites('vote', 'design', baseSummary)).toBeNull()
  })

  it('requires design artifact and tasks before PRD generation', () => {
    expect(
      validateStagePrerequisites('design', 'generate', {
        ...baseSummary,
        latest_versions: { ...baseSummary.latest_versions, design_artifact: null },
      }),
    ).toBe('AX 설계를 먼저 생성하세요.')
  })

  it('requires latest report and no stale outputs before completion', () => {
    expect(
      validateStagePrerequisites('report', 'completed', {
        ...baseSummary,
        stale: { ...baseSummary.stale, prds: true },
      }),
    ).toContain('최신이 아닌 산출물')
  })
})
