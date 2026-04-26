import { beforeEach, describe, expect, it } from 'vitest'
import { useBoardStore } from './board'
import type { Note } from '@/types/note'

const baseNote: Note = {
  id: '00000000-0000-4000-a000-000000000100',
  workshop_id: '00000000-0000-4000-a000-000000000020',
  participant_id: '00000000-0000-4000-a000-000000000030',
  cluster_id: null,
  process_step_id: null,
  content: '첫 번째 포스트잇',
  color: 'yellow',
  position_x: 120,
  position_y: 160,
  created_at: '2026-04-26T00:00:00.000Z',
  updated_at: '2026-04-26T00:00:00.000Z',
}

describe('board store realtime sync', () => {
  beforeEach(() => {
    useBoardStore.setState({
      notes: [],
      pendingNoteIds: new Set<string>(),
    })
  })

  it('ignores realtime events for pending local notes', () => {
    useBoardStore.getState().markPending(baseNote.id)
    useBoardStore.getState().syncFromRealtime('INSERT', baseNote)

    expect(useBoardStore.getState().notes).toEqual([])
  })

  it('upserts realtime inserts and updates idempotently', () => {
    useBoardStore.getState().syncFromRealtime('INSERT', baseNote)
    useBoardStore.getState().syncFromRealtime('INSERT', baseNote)
    useBoardStore.getState().syncFromRealtime('UPDATE', {
      ...baseNote,
      content: '수정된 포스트잇',
    })

    expect(useBoardStore.getState().notes).toHaveLength(1)
    expect(useBoardStore.getState().notes[0]?.content).toBe('수정된 포스트잇')
  })

  it('handles realtime deletes even when the note is already absent', () => {
    useBoardStore.getState().setNotes([baseNote])
    useBoardStore.getState().syncFromRealtime('DELETE', baseNote)
    useBoardStore.getState().syncFromRealtime('DELETE', baseNote)

    expect(useBoardStore.getState().notes).toEqual([])
  })
})
