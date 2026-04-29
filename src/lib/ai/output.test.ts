import { describe, expect, it, vi } from 'vitest'
import { generatePrdWithAI, generateReportWithAI } from './output'

describe('output AI helpers', () => {
  it('generates PRD markdown from JSON mode content', async () => {
    const createCompletion = vi.fn().mockResolvedValue(JSON.stringify({ content: '# PRD\n본문입니다.' }))

    const response = await generatePrdWithAI(
      {
        workshop_title: '워크샵',
        tasks: [],
        design_artifacts: {} as never,
        clusters: [],
        vote_results: [],
      },
      { createCompletion },
    )

    expect(response.content).toContain('# PRD')
    expect(createCompletion).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 12000, timeoutMs: 180_000 }))
  })

  it('rejects empty report content', async () => {
    const createCompletion = vi.fn().mockResolvedValue(JSON.stringify({ content: '' }))

    await expect(
      generateReportWithAI(
        {
          workshop_title: '워크샵',
          process_graph: { nodes: [], edges: [], lanes: [] },
          clusters: [],
          vote_results: [],
          design_artifacts: {} as never,
          tasks: [],
          prd_summary: '',
          stats: { participant_count: 0, note_count: 0, vote_count: 0 },
        },
        { createCompletion },
      ),
    ).rejects.toThrow()
  })
})
