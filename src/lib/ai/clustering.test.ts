import { describe, expect, it, vi } from 'vitest'
import { clusterNotesWithAI } from './clustering'

const notes = [
  { id: '00000000-0000-4000-a000-000000000101', content: '승인 대기가 너무 길다' },
  { id: '00000000-0000-4000-a000-000000000102', content: '수작업 엑셀 취합이 반복된다' },
  { id: '00000000-0000-4000-a000-000000000103', content: '시스템 간 데이터가 연결되지 않는다' },
]

describe('clusterNotesWithAI', () => {
  it('retries malformed AI responses and returns the first valid result', async () => {
    const createCompletion = vi
      .fn()
      .mockResolvedValueOnce('not-json')
      .mockResolvedValueOnce(
        JSON.stringify({
          clusters: [
            { name: '승인', summary: '승인 지연', note_ids: [notes[0].id] },
            { name: '수작업', summary: '반복 수작업', note_ids: [notes[1].id] },
            { name: '연계', summary: '데이터 연계', note_ids: [notes[2].id] },
          ],
        }),
      )

    const response = await clusterNotesWithAI(notes, [], {
      createCompletion,
      wait: vi.fn().mockResolvedValue(undefined),
    })

    expect(createCompletion).toHaveBeenCalledTimes(2)
    expect(response.clusters).toHaveLength(3)
  })

  it('fails after exhausting validation retries', async () => {
    const createCompletion = vi.fn().mockResolvedValue(
      JSON.stringify({
        clusters: [
          { name: '승인', summary: '승인 지연', note_ids: [notes[0].id] },
          { name: '수작업', summary: '반복 수작업', note_ids: [notes[1].id] },
          { name: '연계', summary: '데이터 연계', note_ids: [] },
        ],
      }),
    )

    await expect(
      clusterNotesWithAI(notes, [], {
        createCompletion,
        wait: vi.fn().mockResolvedValue(undefined),
      }),
    ).rejects.toThrow(`Missing note_id: ${notes[2].id}`)
    expect(createCompletion).toHaveBeenCalledTimes(3)
  })
})
