import { describe, expect, it, vi } from 'vitest'
import { generateDesignWithAI } from './design'
import { validateDesignResponse, type DesignResponse } from './schemas'

const clusterId = '00000000-0000-4000-a000-000000000201'
const processStepId = '00000000-0000-4000-a000-000000000301'

const validResponse: DesignResponse = {
  tobe_process: {
    mermaid_dsl: 'flowchart LR\nA-->B',
    steps: [
      {
        name: '자동 접수',
        description: '요청을 자동으로 분류합니다.',
        automation_type: 'full',
        agent_name: '접수 Agent',
        asis_step_ids: [processStepId],
      },
    ],
    graph: {
      nodes: [
        {
          id: 'to-be-1',
          name: '자동 접수',
          description: '요청 분류',
          automation_type: 'full',
          agent_name: '접수 Agent',
          asis_node_ids: [processStepId],
        },
      ],
      edges: [],
      lanes: [],
    },
  },
  agent_specs: [
    {
      name: '접수 Agent',
      role: '요청을 분류하고 담당자를 추천합니다.',
      core_features: ['분류'],
      sub_features: ['우선순위 추천'],
      input: '요청 텍스트',
      output: '분류 결과',
      human_checkpoint: '예외 건 검토',
    },
  ],
  tasks: [
    {
      title: '요청 자동 분류',
      description: '반복 접수 업무를 자동화합니다.',
      cluster_ids: [clusterId],
      core_features: ['분류'],
      sub_features: ['추천'],
      difficulty: 'medium',
      priority: 'high',
      expected_effect: '처리 시간 단축',
    },
  ],
  kpis: [
    {
      name: '처리 시간',
      current_value: '2일',
      target_value: '4시간',
      measurement_method: '평균 리드타임',
    },
  ],
  data_requirements: [
    {
      name: '요청 이력',
      source: 'CRM',
      format: 'CSV/API',
      volume: '월 1만건',
      responsible_team: '운영팀',
    },
  ],
  org_requirements: [
    {
      category: 'training',
      description: 'Agent 결과 검토 교육',
      priority: 'medium',
    },
  ],
}

describe('design response validation', () => {
  it('accepts valid mappings', () => {
    expect(() =>
      validateDesignResponse(validResponse, {
        clusterIds: [clusterId],
        processStepIds: [processStepId],
      }),
    ).not.toThrow()
  })

  it('rejects unknown cluster mappings', () => {
    expect(() =>
      validateDesignResponse(
        {
          ...validResponse,
          tasks: [{ ...validResponse.tasks[0], cluster_ids: ['00000000-0000-4000-a000-999999999999'] }],
        },
        { clusterIds: [clusterId], processStepIds: [processStepId] },
      ),
    ).toThrow('Unknown cluster_id')
  })

  it('rejects unknown AS-IS mappings', () => {
    expect(() =>
      validateDesignResponse(
        {
          ...validResponse,
          tobe_process: {
            ...validResponse.tobe_process,
            steps: [
              {
                ...validResponse.tobe_process.steps[0],
                asis_step_ids: ['unknown-step'],
              },
            ],
          },
        },
        { clusterIds: [clusterId], processStepIds: [processStepId] },
      ),
    ).toThrow('Unknown asis_step_id')
  })
})

describe('generateDesignWithAI', () => {
  it('retries malformed responses and returns a valid design', async () => {
    const createCompletion = vi
      .fn()
      .mockResolvedValueOnce('not-json')
      .mockResolvedValueOnce(JSON.stringify(validResponse))

    const response = await generateDesignWithAI(
      {
        process_graph: {
          nodes: [{ id: processStepId, name: '접수', description: null, node_type: 'task' }],
          edges: [],
          lanes: [],
        },
        clusters: [{ id: clusterId, name: '접수 병목', summary: null, vote_count: 3, notes: [] }],
        vote_mode: 'cluster',
      },
      { clusterIds: [clusterId], processStepIds: [processStepId] },
      { createCompletion, wait: vi.fn().mockResolvedValue(undefined) },
    )

    expect(createCompletion).toHaveBeenCalledTimes(2)
    expect(response.tasks[0]?.title).toBe('요청 자동 분류')
  })
})
