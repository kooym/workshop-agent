import { describe, expect, it } from 'vitest'
import { parseClusteringResponse, validateClusteringResponse } from './schemas'

const noteIds = [
  '00000000-0000-4000-a000-000000000101',
  '00000000-0000-4000-a000-000000000102',
  '00000000-0000-4000-a000-000000000103',
]

const validResponse = {
  clusters: [
    { name: '반복 업무', summary: '반복 수작업 문제', note_ids: [noteIds[0]] },
    { name: '시스템 연계', summary: '도구 간 연결 부족', note_ids: [noteIds[1]] },
    { name: '의사결정 지연', summary: '승인과 판단 지연', note_ids: [noteIds[2]] },
  ],
}

describe('clustering response schema', () => {
  it('parses valid JSON and verifies assignments', () => {
    expect(parseClusteringResponse(JSON.stringify(validResponse), noteIds)).toEqual(validResponse)
  })

  it('rejects missing note assignments', () => {
    expect(() =>
      validateClusteringResponse(noteIds, {
        clusters: [
          { name: 'A', summary: 'A summary', note_ids: [noteIds[0]] },
          { name: 'B', summary: 'B summary', note_ids: [noteIds[1]] },
          { name: 'C', summary: 'C summary', note_ids: [] },
        ],
      }),
    ).toThrow(`Missing note_id: ${noteIds[2]}`)
  })

  it('rejects duplicate note assignments', () => {
    expect(() =>
      validateClusteringResponse(noteIds, {
        clusters: [
          { name: 'A', summary: 'A summary', note_ids: [noteIds[0]] },
          { name: 'B', summary: 'B summary', note_ids: [noteIds[0], noteIds[1]] },
          { name: 'C', summary: 'C summary', note_ids: [noteIds[2]] },
        ],
      }),
    ).toThrow(`Duplicate assignment: ${noteIds[0]}`)
  })

  it('rejects unknown note ids', () => {
    expect(() =>
      validateClusteringResponse(noteIds, {
        clusters: [
          { name: 'A', summary: 'A summary', note_ids: [noteIds[0]] },
          { name: 'B', summary: 'B summary', note_ids: [noteIds[1]] },
          {
            name: 'C',
            summary: 'C summary',
            note_ids: ['00000000-0000-4000-a000-999999999999'],
          },
        ],
      }),
    ).toThrow('Unknown note_id')
  })
})
