import type { User } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateDesignStep } from '@/lib/ai/design'
import { applyDesignStepResult, buildDesignInput } from '@/lib/api/design'
import { withFacilitator } from '@/lib/api/middleware'
import type { Tables } from '@/lib/supabase/types'
import { POST } from './route'

vi.mock('@/lib/ai/design', () => ({
  generateDesignStep: vi.fn(),
}))

vi.mock('@/lib/api/design', () => ({
  applyDesignStepResult: vi.fn(),
  buildDesignInput: vi.fn(),
}))

vi.mock('@/lib/api/middleware', () => ({
  withFacilitator: vi.fn(),
}))

const workshopId = '00000000-0000-4000-a000-000000000020'
const user = {
  id: '00000000-0000-4000-a000-000000000001',
  email: 'facilitator@example.com',
} as User

const designResponse = {
  result: {
    step: 1 as const,
    data: {
      step1: {
        name: 'A안: 점진적 자동화',
        strategy: '기존 프로세스 유지하며 반복 업무만 자동화',
        tobe_process: {
          graph: { nodes: [], edges: [], lanes: [] },
        },
      },
      step2: { agent_specs: [] },
      step3: { tasks: [] },
    },
  },
  warnings: [],
}

describe('POST /api/ai/design', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(buildDesignInput).mockResolvedValue({
      input: {
        process_graph: { nodes: [], edges: [], lanes: [] },
        clusters: [],
        vote_mode: 'cluster',
        workshop_description: null,
      },
      context: { clusterIds: [], processStepIds: [] },
    })
    vi.mocked(generateDesignStep).mockResolvedValue(designResponse)
    vi.mocked(applyDesignStepResult).mockResolvedValue({
      design_artifacts: [],
      tasks: [],
    })
  })

  it('rejects design generation outside the design stage', async () => {
    const service = createService({ current_stage: 'vote' })
    mockFacilitator(service)

    const response = await POST(createRequest())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'CONFLICT', message: '설계 단계에서만 실행할 수 있습니다.' },
    })
    expect(service.updateCalls).toEqual([])
    expect(generateDesignStep).not.toHaveBeenCalled()
  })

  it('rejects active processing locks before starting a new AI call', async () => {
    const service = createService({
      is_processing: true,
      is_processing_since: new Date().toISOString(),
    })
    mockFacilitator(service)

    const response = await POST(createRequest())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'PROCESSING', message: '이미 AI가 처리 중입니다.' },
    })
    expect(service.updateCalls).toEqual([])
  })

  it('recovers stale processing locks and clears processing after success', async () => {
    const service = createService({
      is_processing: true,
      is_processing_since: '2026-04-26T00:00:00.000Z',
    })
    mockFacilitator(service)

    const response = await POST(createRequest())

    expect(response.status).toBe(200)
    expect(service.updateCalls).toEqual([
      expect.objectContaining({ is_processing: true }),
      expect.objectContaining({ design_step: 1 }),
      expect.objectContaining({ is_processing: false, is_processing_since: null }),
    ])
  })

  it('clears processing when AI design generation fails', async () => {
    const service = createService()
    mockFacilitator(service)
    vi.mocked(generateDesignStep).mockRejectedValue(new Error('Unknown cluster_id: missing'))

    const response = await POST(createRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Unknown cluster_id: missing' },
    })
    expect(service.updateCalls).toEqual([
      expect.objectContaining({ is_processing: true }),
      expect.objectContaining({ is_processing: false, is_processing_since: null }),
    ])
  })
})

function mockFacilitator(service: ReturnType<typeof createService>) {
  vi.mocked(withFacilitator).mockImplementation(async (req, handler) =>
    handler(req, { service: service.client as never, user }),
  )
}

function createRequest() {
  return new NextRequest('http://localhost/api/ai/design', {
    method: 'POST',
    body: JSON.stringify({ workshop_id: workshopId, design_step: 1 }),
    headers: { 'content-type': 'application/json' },
  })
}

function createService(overrides: Partial<Tables<'workshops'>> = {}) {
  const updateCalls: Partial<Tables<'workshops'>>[] = []
  const workshop = {
    id: workshopId,
    project_id: '00000000-0000-4000-a000-000000000010',
    title: 'Workshop',
    description: null,
    invite_code: 'ABC123',
    current_stage: 'design',
    facilitator_id: user.id,
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
    created_at: '',
    updated_at: '',
    ...overrides,
  } satisfies Tables<'workshops'>
  let mode: 'select' | 'update' = 'select'
  const workshopQuery = {
    select: vi.fn(() => {
      mode = 'select'
      return workshopQuery
    }),
    update: vi.fn((patch: Partial<Tables<'workshops'>>) => {
      mode = 'update'
      updateCalls.push(patch)
      return workshopQuery
    }),
    eq: vi.fn(() =>
      mode === 'update' ? Promise.resolve({ error: null }) : workshopQuery,
    ),
    maybeSingle: vi.fn().mockResolvedValue({ data: workshop, error: null }),
  }
  const emptyQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  const client = {
    from: vi.fn((table: string) => {
      if (table === 'workshops') {
        return workshopQuery
      }
      // design_artifacts, ax_tasks — return empty results for loadPreviousSteps
      return emptyQuery
    }),
  }

  return { client, updateCalls }
}
