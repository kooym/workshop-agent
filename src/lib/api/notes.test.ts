import { describe, expect, it, vi } from 'vitest'
import { canDeleteNote, canModifyNote, ensureGatherStage } from './notes'
import type { Tables } from '@/lib/supabase/types'

const participant: Tables<'participants'> = {
  id: '00000000-0000-4000-a000-000000000030',
  workshop_id: '00000000-0000-4000-a000-000000000020',
  user_id: null,
  display_name: '참석자',
  role: null,
  is_facilitator: false,
  joined_at: '2026-04-26T00:00:00.000Z',
  created_at: '2026-04-26T00:00:00.000Z',
}

const otherParticipant: Tables<'participants'> = {
  ...participant,
  id: '00000000-0000-4000-a000-000000000031',
  display_name: '다른 참석자',
}

const note: Tables<'notes'> = {
  id: '00000000-0000-4000-a000-000000000100',
  workshop_id: participant.workshop_id,
  participant_id: participant.id,
  cluster_id: null,
  process_step_id: null,
  content: '포스트잇',
  color: 'yellow',
  position_x: 0,
  position_y: 0,
  created_at: '2026-04-26T00:00:00.000Z',
  updated_at: '2026-04-26T00:00:00.000Z',
}

const gatherWorkshop = {
  id: participant.workshop_id,
  project_id: '00000000-0000-4000-a000-000000000010',
  title: '워크샵',
  description: null,
  invite_code: 'DEMO42',
  current_stage: 'gather',
  facilitator_id: '00000000-0000-4000-a000-000000000001',
  settings: {
    anonymous: false,
    votes_per_person: 3,
    max_participants: 20,
    results_visible: false,
    vote_mode: 'cluster',
    timer_minutes: null,
  },
  is_processing: false,
  is_processing_since: null,
  design_step: 0,
  created_at: '2026-04-26T00:00:00.000Z',
  updated_at: '2026-04-26T00:00:00.000Z',
} satisfies Tables<'workshops'>

describe('note permissions', () => {
  it('allows only the original author to modify a note', () => {
    expect(canModifyNote(note, participant)).toBe(true)
    expect(canModifyNote(note, otherParticipant)).toBe(false)
  })

  it('allows the author or facilitator to delete a note', () => {
    expect(canDeleteNote(note, participant, 'participant')).toBe(true)
    expect(canDeleteNote(note, otherParticipant, 'participant')).toBe(false)
    expect(canDeleteNote(note, otherParticipant, 'facilitator')).toBe(true)
  })
})

describe('note stage lock', () => {
  it('allows note mutations during gather', async () => {
    const result = await ensureGatherStage(createWorkshopService(gatherWorkshop), gatherWorkshop.id)

    expect(result.ok).toBe(true)
  })

  it('blocks note mutations after gather', async () => {
    const result = await ensureGatherStage(
      createWorkshopService({ ...gatherWorkshop, current_stage: 'cluster' }),
      gatherWorkshop.id,
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
      await expect(result.response.json()).resolves.toEqual({
        error: {
          code: 'STAGE_LOCKED',
          message: 'gather 단계에서만 포스트잇을 수정할 수 있습니다.',
        },
      })
    }
  })
})

function createWorkshopService(workshop: Tables<'workshops'>) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn().mockResolvedValue({ data: workshop, error: null }),
  }

  return {
    from: vi.fn(() => query),
  } as never
}
