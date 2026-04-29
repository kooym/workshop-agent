import { describe, expect, it } from 'vitest'
import { aggregateVoteResults, canMutateVotes, resolveVoteTarget, shouldHideVoteResults } from './votes'
import type { Tables } from '@/lib/supabase/types'

const workshop = {
  id: '00000000-0000-4000-a000-000000000020',
  current_stage: 'vote',
  settings: {
    anonymous: false,
    votes_per_person: 3,
    max_participants: 20,
    results_visible: false,
    vote_mode: 'cluster',
    timer_minutes: null,
  },
} as Tables<'workshops'>

describe('vote policy helpers', () => {
  it('allows vote mutation only once vote stage is reached', () => {
    expect(canMutateVotes({ ...workshop, current_stage: 'cluster' })).toBe(false)
    expect(canMutateVotes(workshop)).toBe(true)
    expect(canMutateVotes({ ...workshop, current_stage: 'design' })).toBe(true)
    expect(canMutateVotes({ ...workshop, current_stage: 'completed' })).toBe(false)
  })

  it('hides results while vote is in progress and visibility is off', () => {
    expect(shouldHideVoteResults(workshop)).toBe(true)
    expect(shouldHideVoteResults({ ...workshop, settings: { ...workshop.settings, results_visible: true } })).toBe(false)
    expect(shouldHideVoteResults({ ...workshop, current_stage: 'design' })).toBe(false)
  })

  it('validates vote target by workshop vote mode', () => {
    expect(resolveVoteTarget('cluster', { cluster_id: 'cluster-id' })).toEqual({
      cluster_id: 'cluster-id',
      note_id: null,
      task_id: null,
    })
    expect(resolveVoteTarget('cluster', { note_id: 'note-id' })).toBeNull()
    expect(resolveVoteTarget('note', { note_id: 'note-id' })).toEqual({
      cluster_id: null,
      note_id: 'note-id',
      task_id: null,
    })
  })
})

describe('vote result aggregation', () => {
  it('orders vote results by count and calculates percentages', () => {
    const results = aggregateVoteResults({
      voteMode: 'cluster',
      votes: [
        { id: 'v1', workshop_id: workshop.id, participant_id: 'p1', cluster_id: 'c1', note_id: null, task_id: null, created_at: '' },
        { id: 'v2', workshop_id: workshop.id, participant_id: 'p2', cluster_id: 'c1', note_id: null, task_id: null, created_at: '' },
        { id: 'v3', workshop_id: workshop.id, participant_id: 'p3', cluster_id: 'c2', note_id: null, task_id: null, created_at: '' },
      ],
      clusters: [
        { id: 'c1', workshop_id: workshop.id, name: 'A', summary: null, order_index: 0, is_stale: false, score_impact: null, score_feasibility: null, score_urgency: null, created_at: '', updated_at: '' },
        { id: 'c2', workshop_id: workshop.id, name: 'B', summary: null, order_index: 1, is_stale: false, score_impact: null, score_feasibility: null, score_urgency: null, created_at: '', updated_at: '' },
      ],
      notes: [],
    })

    expect(results[0]).toMatchObject({ cluster_id: 'c1', vote_count: 2, percentage: 66.7 })
    expect(results[1]).toMatchObject({ cluster_id: 'c2', vote_count: 1, percentage: 33.3 })
  })
})
