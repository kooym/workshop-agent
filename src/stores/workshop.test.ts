import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkshopStore } from './workshop'
import type { Workshop } from '@/types/workshop'

const workshop: Workshop = {
  id: '00000000-0000-4000-a000-000000000020',
  project_id: '00000000-0000-4000-a000-000000000010',
  title: 'Demo Workshop',
  description: null,
  invite_code: 'DEMO42',
  current_stage: 'vote',
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
}

describe('workshop store stage navigation', () => {
  beforeEach(() => {
    useWorkshopStore.setState({
      workshop: null,
      participants: [],
      currentParticipant: null,
      isFacilitator: false,
      viewingStage: null,
    })
  })

  it('initializes viewingStage from current_stage', () => {
    useWorkshopStore.getState().setWorkshop(workshop)

    expect(useWorkshopStore.getState().viewingStage).toBe('vote')
  })

  it('allows free navigation only up to the reached stage', () => {
    useWorkshopStore.getState().setWorkshop(workshop)

    useWorkshopStore.getState().setViewingStage('gather')
    expect(useWorkshopStore.getState().viewingStage).toBe('gather')

    useWorkshopStore.getState().setViewingStage('design')
    expect(useWorkshopStore.getState().viewingStage).toBe('gather')
  })

  it('moves viewingStage when current_stage advances through realtime', () => {
    useWorkshopStore.getState().setWorkshop(workshop)
    useWorkshopStore.getState().setViewingStage('context')

    useWorkshopStore.getState().updateStage('design')

    expect(useWorkshopStore.getState().workshop?.current_stage).toBe('design')
    expect(useWorkshopStore.getState().viewingStage).toBe('design')
  })
})
