# Testing Guide

> 관련: CLAUDE.md (테스트 전략, TDD 규칙), ARCHITECTURE.md (API 미들웨어, Zustand 스토어)

## 원칙

- **CRITICAL**: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- 테스트 대상 파일과 동일 디렉토리에 co-locate: `utils.ts` → `utils.test.ts`
- 파일명: `*.test.ts` (유틸/로직), `*.test.tsx` (컴포넌트)

---

## 1. Vitest 설정

### vitest.config.ts

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/*.d.ts',
        'src/types/**',
        'src/app/**/layout.tsx',
        'src/app/**/page.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### src/test/setup.ts

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
```

---

## 2. 모킹 패턴

### 2-1. Supabase 서버 클라이언트 모킹

API Route 통합 테스트에서 사용. `vi.mock`으로 모듈 전체를 대체한다.

```ts
// src/lib/supabase/__mocks__/server.ts 또는 인라인 mock
import { vi } from 'vitest'

// 체이닝 빌더 패턴
export function createMockSupabaseClient() {
  const mockData: any = { data: null, error: null }

  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(mockData),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(mockData),
    then: vi.fn((cb) => cb(mockData)),
  }

  const client = {
    from: vi.fn().mockReturnValue(builder),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }

  return { client, builder, mockData }
}

// 사용 예시:
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => mockClient.client),
}))
```

### 2-2. Supabase 브라우저 클라이언트 모킹

컴포넌트 테스트에서 사용.

```ts
vi.mock('@/lib/supabase/client', () => ({
  createBrowserClient: vi.fn(() => ({
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    }),
  })),
}))
```

### 2-3. Azure OpenAI MSW 모킹

AI 파이프라인 테스트에서 HTTP 레벨 모킹.

```ts
// src/test/msw-handlers.ts
import { http, HttpResponse } from 'msw'

export const aiHandlers = [
  http.post('*/openai/deployments/*/chat/completions*', ({ request }) => {
    return HttpResponse.json({
      choices: [{
        message: {
          content: JSON.stringify({
            clusters: [
              { name: '프로세스 비효율', summary: '수작업 관련 이슈', note_ids: ['id-1', 'id-2'] },
              { name: '시스템 문제', summary: '기존 시스템 한계', note_ids: ['id-3'] },
              { name: '교육 부족', summary: '교육 관련 이슈', note_ids: ['id-4', 'id-5'] },
            ],
          }),
        },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 500, completion_tokens: 300 },
    })
  }),
]

// 실패 시나리오
export const aiFailHandlers = [
  http.post('*/openai/deployments/*/chat/completions*', () => {
    return HttpResponse.json(
      { error: { message: 'Rate limit exceeded' } },
      { status: 429 }
    )
  }),
]
```

```ts
// 테스트에서 MSW 서버 사용
import { setupServer } from 'msw/node'
import { aiHandlers } from '@/test/msw-handlers'

const server = setupServer(...aiHandlers)
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### 2-4. Next.js Request/Response 모킹

API Route 통합 테스트에서 NextRequest를 생성.

```ts
import { NextRequest } from 'next/server'

export function createMockRequest(
  method: string,
  url: string,
  options?: {
    body?: Record<string, unknown>
    headers?: Record<string, string>
    cookies?: Record<string, string>
  }
): NextRequest {
  const init: RequestInit = { method }
  if (options?.body) {
    init.body = JSON.stringify(options.body)
    init.headers = { 'Content-Type': 'application/json', ...options?.headers }
  }
  const req = new NextRequest(new URL(url, 'http://localhost:3000'), init)
  if (options?.cookies) {
    for (const [name, value] of Object.entries(options.cookies)) {
      req.cookies.set(name, value)
    }
  }
  return req
}
```

---

## 3. 테스트 데이터 팩토리

모든 팩토리는 `src/test/factories.ts`에 모아 관리한다.

```ts
// src/test/factories.ts
import { randomUUID } from 'crypto'

// ─── 기본 ID 생성 ───
let counter = 0
export const nextId = () => randomUUID()
export const nextSeq = () => ++counter

// ─── Workshop ───
export function createMockWorkshop(overrides?: Partial<Workshop>): Workshop {
  const id = nextId()
  return {
    id,
    project_id: nextId(),
    title: `테스트 워크샵 ${nextSeq()}`,
    description: '테스트용 워크샵입니다',
    invite_code: 'ABC123',
    current_stage: 'gather',
    is_processing: false,
    is_processing_since: null,
    settings: {
      anonymous: false,
      votes_per_person: 3,
      max_participants: 20,
      results_visible: false,
      vote_mode: 'cluster',
      timer_minutes: null,
    },
    facilitator_id: nextId(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

// ─── Participant ───
export function createMockParticipant(
  workshopId: string,
  overrides?: Partial<Participant>
): Participant {
  return {
    id: nextId(),
    workshop_id: workshopId,
    user_id: null,
    display_name: `참석자${nextSeq()}`,
    is_facilitator: false,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// ─── Note ───
export function createMockNote(
  workshopId: string,
  participantId: string,
  overrides?: Partial<Note>
): Note {
  return {
    id: nextId(),
    workshop_id: workshopId,
    participant_id: participantId,
    content: `테스트 포스트잇 ${nextSeq()}`,
    color: 'yellow',
    position_x: Math.random() * 800,
    position_y: Math.random() * 600,
    process_step_id: null,
    cluster_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

// ─── Cluster ───
export function createMockCluster(
  workshopId: string,
  overrides?: Partial<Cluster>
): Cluster {
  return {
    id: nextId(),
    workshop_id: workshopId,
    name: `클러스터 ${nextSeq()}`,
    summary: '테스트 클러스터 요약',
    order_index: nextSeq(),
    is_stale: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

// ─── Vote ───
export function createMockVote(
  workshopId: string,
  participantId: string,
  overrides?: Partial<Vote>
): Vote {
  return {
    id: nextId(),
    workshop_id: workshopId,
    participant_id: participantId,
    cluster_id: null,
    note_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// ─── Process Step ───
export function createMockProcessStep(
  workshopId: string,
  overrides?: Partial<ProcessStep>
): ProcessStep {
  return {
    id: nextId(),
    workshop_id: workshopId,
    node_type: 'task',
    label: `프로세스 노드 ${nextSeq()}`,
    description: null,
    lane_id: null,
    position_x: 100,
    position_y: 100,
    width: 150,
    height: 60,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}
```

---

## 4. 테스트 유형별 패턴

### 4-1. 단위 테스트 — 유틸 함수

```ts
// src/lib/invite-code.test.ts
import { describe, it, expect } from 'vitest'
import { generateInviteCode } from './invite-code'

describe('generateInviteCode', () => {
  it('6자리 문자열을 생성한다', () => {
    const code = generateInviteCode()
    expect(code).toHaveLength(6)
  })

  it('대문자와 숫자만 포함한다', () => {
    const code = generateInviteCode()
    expect(code).toMatch(/^[A-Z2-9]+$/)
  })

  it('혼동 문자(0, O, 1, I, L)를 포함하지 않는다', () => {
    // 1000회 반복으로 확률적 커버리지
    for (let i = 0; i < 1000; i++) {
      const code = generateInviteCode()
      expect(code).not.toMatch(/[0O1IL]/)
    }
  })

  it('매 호출마다 다른 코드를 생성한다', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateInviteCode()))
    expect(codes.size).toBeGreaterThan(90) // 충돌 확률 극히 낮음
  })
})
```

### 4-2. 단위 테스트 — 세션 서명

```ts
// src/lib/session.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// 환경 변수 모킹
vi.mock('@/lib/env', () => ({
  env: { SESSION_SECRET: 'test-secret-at-least-32-characters-long!!' },
}))

import { signSession, verifySession } from './session'

describe('signSession / verifySession', () => {
  const workshopId = '550e8400-e29b-41d4-a716-446655440000'
  const participantId = '660e8400-e29b-41d4-a716-446655440001'

  it('서명된 쿠키 값이 v1: 접두사를 가진다', () => {
    const cookie = signSession(workshopId, participantId)
    expect(cookie).toMatch(/^v1:.+\..+$/)
  })

  it('유효한 쿠키 값을 검증하면 원래 ID를 반환한다', () => {
    const cookie = signSession(workshopId, participantId)
    const result = verifySession(cookie)
    expect(result).toEqual({ workshopId, participantId })
  })

  it('변조된 payload를 거부한다', () => {
    const cookie = signSession(workshopId, participantId)
    const tampered = cookie.replace(/v1:(.+?)\./, 'v1:AAAA.')
    expect(verifySession(tampered)).toBeNull()
  })

  it('변조된 signature를 거부한다', () => {
    const cookie = signSession(workshopId, participantId)
    const tampered = cookie.slice(0, -4) + 'xxxx'
    expect(verifySession(tampered)).toBeNull()
  })

  it('v1: 접두사가 없으면 거부한다', () => {
    expect(verifySession('v2:payload.sig')).toBeNull()
  })

  it('빈 문자열을 거부한다', () => {
    expect(verifySession('')).toBeNull()
  })

  it('구분자(.)가 없으면 거부한다', () => {
    expect(verifySession('v1:payloadwithoutdot')).toBeNull()
  })
})
```

### 4-3. 단위 테스트 — Zod 스키마

```ts
// src/lib/ai/schemas.test.ts
import { describe, it, expect } from 'vitest'
import { clusteringResponseSchema, validateClusteringResponse } from './schemas'

describe('clusteringResponseSchema', () => {
  const validResponse = {
    clusters: [
      { name: '프로세스 비효율', summary: '요약1', note_ids: ['id-1', 'id-2'] },
      { name: '시스템 문제', summary: '요약2', note_ids: ['id-3'] },
      { name: '교육 부족', summary: '요약3', note_ids: ['id-4', 'id-5'] },
    ],
  }

  it('유효한 응답을 파싱한다', () => {
    expect(() => clusteringResponseSchema.parse(validResponse)).not.toThrow()
  })

  it('클러스터 수 3개 미만이면 실패한다', () => {
    const invalid = { clusters: [validResponse.clusters[0], validResponse.clusters[1]] }
    expect(() => clusteringResponseSchema.parse(invalid)).toThrow()
  })

  it('클러스터 수 8개 초과이면 실패한다', () => {
    const tooMany = {
      clusters: Array.from({ length: 9 }, (_, i) => ({
        name: `클러스터${i}`, summary: '요약', note_ids: [`id-${i}`],
      })),
    }
    expect(() => clusteringResponseSchema.parse(tooMany)).toThrow()
  })

  it('클러스터명이 50자를 초과하면 실패한다', () => {
    const invalid = {
      clusters: validResponse.clusters.map((c, i) =>
        i === 0 ? { ...c, name: 'a'.repeat(51) } : c
      ),
    }
    expect(() => clusteringResponseSchema.parse(invalid)).toThrow()
  })
})

describe('validateClusteringResponse', () => {
  const inputNoteIds = ['id-1', 'id-2', 'id-3', 'id-4', 'id-5']
  const validResponse = {
    clusters: [
      { name: 'A', summary: '요약', note_ids: ['id-1', 'id-2'] },
      { name: 'B', summary: '요약', note_ids: ['id-3'] },
      { name: 'C', summary: '요약', note_ids: ['id-4', 'id-5'] },
    ],
  }

  it('모든 note_id가 할당되면 통과한다', () => {
    expect(() => validateClusteringResponse(inputNoteIds, validResponse)).not.toThrow()
  })

  it('누락된 note_id가 있으면 에러를 던진다', () => {
    const missing = {
      clusters: [
        { name: 'A', summary: '요약', note_ids: ['id-1', 'id-2'] },
        { name: 'B', summary: '요약', note_ids: ['id-3'] },
        { name: 'C', summary: '요약', note_ids: ['id-4'] }, // id-5 누락
      ],
    }
    expect(() => validateClusteringResponse(inputNoteIds, missing)).toThrow(/Missing/)
  })

  it('알 수 없는 note_id가 있으면 에러를 던진다', () => {
    const unknown = {
      clusters: [
        { name: 'A', summary: '요약', note_ids: ['id-1', 'id-2'] },
        { name: 'B', summary: '요약', note_ids: ['id-3', 'id-unknown'] },
        { name: 'C', summary: '요약', note_ids: ['id-4', 'id-5'] },
      ],
    }
    expect(() => validateClusteringResponse(inputNoteIds, unknown)).toThrow(/Unknown/)
  })

  it('중복 할당된 note_id가 있으면 에러를 던진다', () => {
    const duplicate = {
      clusters: [
        { name: 'A', summary: '요약', note_ids: ['id-1', 'id-2'] },
        { name: 'B', summary: '요약', note_ids: ['id-2', 'id-3'] }, // id-2 중복
        { name: 'C', summary: '요약', note_ids: ['id-4', 'id-5'] },
      ],
    }
    expect(() => validateClusteringResponse(inputNoteIds, duplicate)).toThrow(/Duplicate/)
  })
})
```

### 4-4. 단위 테스트 — Rate Limiter

```ts
// src/lib/api/rate-limit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRateLimiter } from './rate-limit'

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('windowMs 내 maxRequests까지 허용한다', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 3 })
    expect(limiter('1.2.3.4').allowed).toBe(true)
    expect(limiter('1.2.3.4').allowed).toBe(true)
    expect(limiter('1.2.3.4').allowed).toBe(true)
    expect(limiter('1.2.3.4').allowed).toBe(false)
  })

  it('윈도우 초과 후 카운터가 리셋된다', () => {
    const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 1 })
    expect(limiter('1.2.3.4').allowed).toBe(true)
    expect(limiter('1.2.3.4').allowed).toBe(false)

    vi.advanceTimersByTime(1001)
    expect(limiter('1.2.3.4').allowed).toBe(true)
  })

  it('IP별로 독립적으로 카운팅한다', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1 })
    expect(limiter('1.1.1.1').allowed).toBe(true)
    expect(limiter('2.2.2.2').allowed).toBe(true)
    expect(limiter('1.1.1.1').allowed).toBe(false)
  })

  it('연속 실패 5회 시 차단한다', () => {
    const limiter = createRateLimiter({
      windowMs: 60_000, maxRequests: 100,
      maxFailures: 5, blockDurationMs: 10_000,
    })
    for (let i = 0; i < 5; i++) {
      limiter('1.2.3.4', true) // 실패 기록
    }
    const result = limiter('1.2.3.4')
    expect(result.allowed).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('차단 시간 후 다시 허용된다', () => {
    const limiter = createRateLimiter({
      windowMs: 60_000, maxRequests: 100,
      maxFailures: 5, blockDurationMs: 5_000,
    })
    for (let i = 0; i < 5; i++) limiter('1.2.3.4', true)
    expect(limiter('1.2.3.4').allowed).toBe(false)

    vi.advanceTimersByTime(5001)
    expect(limiter('1.2.3.4').allowed).toBe(true)
  })
})
```

### 4-5. 통합 테스트 — API Route

```ts
// src/app/api/votes/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, DELETE } from './route'
import { createMockRequest } from '@/test/helpers'
import { createMockWorkshop, createMockParticipant, createMockVote } from '@/test/factories'

// Supabase mock
const { client, builder, mockData } = createMockSupabaseClient()
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => client),
}))

// Session mock
vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}))

import { getSession } from '@/lib/session'

describe('POST /api/votes', () => {
  const workshop = createMockWorkshop({ current_stage: 'vote' })
  const participant = createMockParticipant(workshop.id)

  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue({
      workshopId: workshop.id,
      participantId: participant.id,
    })
  })

  it('유효한 투표 요청에 201을 반환한다', async () => {
    // Workshop 조회 모킹
    mockData.data = workshop
    // 기존 투표 수 조회 모킹 (0표)
    // ... (체이닝 모킹 설정)

    const req = createMockRequest('POST', '/api/votes', {
      body: { workshop_id: workshop.id, cluster_id: 'cluster-1' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('vote 단계가 아니면 409를 반환한다', async () => {
    const gatherWorkshop = createMockWorkshop({ current_stage: 'gather' })
    vi.mocked(getSession).mockResolvedValue({
      workshopId: gatherWorkshop.id,
      participantId: participant.id,
    })
    mockData.data = gatherWorkshop

    const req = createMockRequest('POST', '/api/votes', {
      body: { workshop_id: gatherWorkshop.id, cluster_id: 'cluster-1' },
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
  })

  it('투표 한도 초과 시 400을 반환한다', async () => {
    // votes_per_person = 3인데 이미 3표 사용한 상태 모킹
    mockData.data = workshop
    // 기존 투표 3건 모킹 → VOTE_LIMIT 에러
    const req = createMockRequest('POST', '/api/votes', {
      body: { workshop_id: workshop.id, cluster_id: 'cluster-1' },
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VOTE_LIMIT')
  })

  it('인증되지 않은 요청에 401을 반환한다', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    const req = createMockRequest('POST', '/api/votes', {
      body: { workshop_id: workshop.id, cluster_id: 'cluster-1' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('cluster_id와 note_id 모두 없으면 400을 반환한다', async () => {
    mockData.data = workshop
    const req = createMockRequest('POST', '/api/votes', {
      body: { workshop_id: workshop.id },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

### 4-6. 단위 테스트 — Zustand 스토어

```ts
// src/stores/vote.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useVoteStore } from './vote'
import { createMockVote } from '@/test/factories'

// fetch 모킹
global.fetch = vi.fn()

describe('voteStore', () => {
  beforeEach(() => {
    // Zustand 스토어 초기화
    useVoteStore.setState({
      votes: [],
      myVotes: [],
      remainingVotes: 3,
      resultsVisible: false,
      votesPerPerson: 3,
    })
  })

  it('setVotes: 투표 목록을 설정한다', () => {
    const votes = [createMockVote('ws-1', 'p-1'), createMockVote('ws-1', 'p-2')]
    useVoteStore.getState().setVotes(votes)
    expect(useVoteStore.getState().votes).toHaveLength(2)
  })

  it('syncFromRealtime INSERT: 새 투표를 추가한다', () => {
    const newVote = createMockVote('ws-1', 'p-1')
    useVoteStore.getState().syncFromRealtime('INSERT', newVote)
    expect(useVoteStore.getState().votes).toContainEqual(newVote)
  })

  it('syncFromRealtime DELETE: 투표를 제거한다', () => {
    const vote = createMockVote('ws-1', 'p-1')
    useVoteStore.setState({ votes: [vote] })
    useVoteStore.getState().syncFromRealtime('DELETE', vote)
    expect(useVoteStore.getState().votes).toHaveLength(0)
  })

  it('syncFromRealtime INSERT: 중복 투표를 추가하지 않는다', () => {
    const vote = createMockVote('ws-1', 'p-1')
    useVoteStore.setState({ votes: [vote] })
    useVoteStore.getState().syncFromRealtime('INSERT', vote)
    expect(useVoteStore.getState().votes).toHaveLength(1)
  })

  it('setResultsVisible: 결과 공개 상태를 변경한다', () => {
    useVoteStore.getState().setResultsVisible(true)
    expect(useVoteStore.getState().resultsVisible).toBe(true)
  })
})
```

### 4-7. 컴포넌트 테스트

```tsx
// src/components/vote/VotingCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VotingCard } from './VotingCard'

describe('VotingCard', () => {
  const defaultProps = {
    targetId: 'cluster-1',
    targetName: '프로세스 비효율',
    summary: '수작업 관련 이슈 모음',
    noteCount: 5,
    voteCount: 0,
    isVoted: false,
    canVote: true,
    onVote: vi.fn(),
    onUnvote: vi.fn(),
  }

  it('클러스터 이름과 요약을 표시한다', () => {
    render(<VotingCard {...defaultProps} />)
    expect(screen.getByText('프로세스 비효율')).toBeInTheDocument()
    expect(screen.getByText('수작업 관련 이슈 모음')).toBeInTheDocument()
  })

  it('투표 버튼 클릭 시 onVote를 호출한다', async () => {
    const user = userEvent.setup()
    render(<VotingCard {...defaultProps} />)

    const voteButton = screen.getByRole('button', { name: /투표/i })
    await user.click(voteButton)
    expect(defaultProps.onVote).toHaveBeenCalledWith('cluster-1')
  })

  it('이미 투표한 상태에서 클릭하면 onUnvote를 호출한다', async () => {
    const user = userEvent.setup()
    render(<VotingCard {...defaultProps} isVoted={true} />)

    const unvoteButton = screen.getByRole('button', { name: /취소/i })
    await user.click(unvoteButton)
    expect(defaultProps.onUnvote).toHaveBeenCalled()
  })

  it('canVote=false이면 투표 버튼이 비활성화된다', () => {
    render(<VotingCard {...defaultProps} canVote={false} />)
    const button = screen.getByRole('button', { name: /투표/i })
    expect(button).toBeDisabled()
  })

  it('소속 포스트잇 수를 표시한다', () => {
    render(<VotingCard {...defaultProps} />)
    expect(screen.getByText(/5개/)).toBeInTheDocument()
  })
})
```

### 4-8. Stale 전파 단위 테스트

```ts
// src/lib/api/stale.test.ts
import { describe, it, expect, vi } from 'vitest'
import { propagateStale } from './stale'

const { client, builder } = createMockSupabaseClient()
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => client),
}))

describe('propagateStale', () => {
  it('context 수정 시 clusters, design_artifacts, prds, ax_reports를 stale로 설정한다', async () => {
    await propagateStale('ws-1', 'context')

    // from('clusters').update({ is_stale: true }).eq('workshop_id', 'ws-1') 호출 확인
    expect(client.from).toHaveBeenCalledWith('clusters')
    expect(client.from).toHaveBeenCalledWith('design_artifacts')
    expect(client.from).toHaveBeenCalledWith('prds')
    expect(client.from).toHaveBeenCalledWith('ax_reports')
  })

  it('gather 수정 시 clusters 이하를 stale로 설정한다', async () => {
    await propagateStale('ws-1', 'gather')
    expect(client.from).toHaveBeenCalledWith('clusters')
    expect(client.from).toHaveBeenCalledWith('design_artifacts')
  })

  it('cluster 수정 시 design_artifacts 이하를 stale로 설정한다', async () => {
    await propagateStale('ws-1', 'cluster')
    expect(client.from).toHaveBeenCalledWith('design_artifacts')
    expect(client.from).not.toHaveBeenCalledWith('clusters') // 자기 자신은 아님
  })

  it('design 수정 시 prds, ax_reports를 stale로 설정한다', async () => {
    await propagateStale('ws-1', 'design')
    expect(client.from).toHaveBeenCalledWith('prds')
    expect(client.from).toHaveBeenCalledWith('ax_reports')
  })

  it('generate 수정 시 ax_reports만 stale로 설정한다', async () => {
    await propagateStale('ws-1', 'generate')
    expect(client.from).toHaveBeenCalledWith('ax_reports')
    expect(client.from).not.toHaveBeenCalledWith('prds')
  })
})
```

---

### 4-9. workshopStore 단위 테스트

```ts
// src/stores/workshop.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkshopStore } from './workshop'
import { createMockWorkshop } from '@/test/factories'

const STAGES = ['context','gather','cluster','vote','design','generate','report','completed'] as const

describe('workshopStore', () => {
  beforeEach(() => {
    useWorkshopStore.setState({
      workshop: null, participants: [], currentParticipant: null,
      isFacilitator: false, viewingStage: null,
    })
  })

  it('setWorkshop: viewingStage를 current_stage로 초기화한다', () => {
    const ws = createMockWorkshop({ current_stage: 'vote' })
    useWorkshopStore.getState().setWorkshop(ws)

    expect(useWorkshopStore.getState().viewingStage).toBe('vote')
  })

  it('setViewingStage: current_stage 이하만 허용한다', () => {
    const ws = createMockWorkshop({ current_stage: 'vote' })
    useWorkshopStore.getState().setWorkshop(ws)

    useWorkshopStore.getState().setViewingStage('gather') // 허용
    expect(useWorkshopStore.getState().viewingStage).toBe('gather')

    useWorkshopStore.getState().setViewingStage('design') // 초과 → 무시
    expect(useWorkshopStore.getState().viewingStage).toBe('gather')
  })

  it('updateStage: current_stage 전진 시 viewingStage도 동기화한다', () => {
    const ws = createMockWorkshop({ current_stage: 'cluster' })
    useWorkshopStore.getState().setWorkshop(ws)
    useWorkshopStore.getState().setViewingStage('gather') // 이전 단계 열람 중

    useWorkshopStore.getState().updateStage('vote') // Realtime 수신

    expect(useWorkshopStore.getState().workshop?.current_stage).toBe('vote')
    expect(useWorkshopStore.getState().viewingStage).toBe('vote') // 자동 이동
  })

  it('completed 상태에서 모든 단계 열람 가능하다', () => {
    const ws = createMockWorkshop({ current_stage: 'completed' })
    useWorkshopStore.getState().setWorkshop(ws)

    for (const stage of STAGES) {
      useWorkshopStore.getState().setViewingStage(stage)
      expect(useWorkshopStore.getState().viewingStage).toBe(stage)
    }
  })
})
```

### 4-10. withAuth / withFacilitator 미들웨어 통합 테스트

```ts
// src/lib/api/middleware.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withAuth, withFacilitator } from './middleware'
import { NextRequest, NextResponse } from 'next/server'

// Supabase 모킹
const mockClient = { from: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(), single: vi.fn() }
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => mockClient),
}))
vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
}))

import { verifySession } from '@/lib/session'

describe('withAuth', () => {
  const handler = vi.fn(() => NextResponse.json({ data: 'ok' }))

  beforeEach(() => { vi.clearAllMocks() })

  it('유효한 참석자 쿠키 → handler 실행', async () => {
    ;(verifySession as any).mockReturnValue({ workshopId: 'ws-1', participantId: 'p-1' })
    mockClient.single.mockResolvedValue({ data: { id: 'p-1' }, error: null })

    const req = new NextRequest('http://localhost/api/notes', {
      headers: { cookie: 'ws_session=v1:valid.sig' },
    })
    await withAuth(req, { params: { id: 'ws-1' } }, handler)

    expect(handler).toHaveBeenCalledWith(req, expect.objectContaining({
      participant: expect.objectContaining({ id: 'p-1' }),
    }))
  })

  it('쿠키 없음 → 401 UNAUTHORIZED', async () => {
    ;(verifySession as any).mockReturnValue(null)

    const req = new NextRequest('http://localhost/api/notes')
    const res = await withAuth(req, { params: { id: 'ws-1' } }, handler)

    expect(res.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('participants에 미존재 → 401 UNAUTHORIZED', async () => {
    ;(verifySession as any).mockReturnValue({ workshopId: 'ws-1', participantId: 'p-999' })
    mockClient.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

    const req = new NextRequest('http://localhost/api/notes', {
      headers: { cookie: 'ws_session=v1:valid.sig' },
    })
    const res = await withAuth(req, { params: { id: 'ws-1' } }, handler)

    expect(res.status).toBe(401)
  })
})

describe('withFacilitator', () => {
  const handler = vi.fn(() => NextResponse.json({ data: 'ok' }))

  it('is_facilitator=false → 403 FORBIDDEN', async () => {
    ;(verifySession as any).mockReturnValue({ workshopId: 'ws-1', participantId: 'p-1' })
    mockClient.single.mockResolvedValue({ data: { id: 'p-1', is_facilitator: false }, error: null })

    const req = new NextRequest('http://localhost/api/workshops/ws-1/advance-stage', {
      headers: { cookie: 'ws_session=v1:valid.sig' },
    })
    const res = await withFacilitator(req, { params: { id: 'ws-1' } }, handler)

    expect(res.status).toBe(403)
  })
})
```

### 4-11. AI 클러스터링 API + MSW 통합 테스트

```ts
// src/app/api/ai/cluster/route.test.ts
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { POST } from './route'
import { NextRequest } from 'next/server'

// MSW 서버: Azure OpenAI 응답 모킹
const AZURE_ENDPOINT = 'https://test.openai.azure.com'
const clusterResponse = {
  choices: [{
    message: { content: JSON.stringify({
      clusters: [
        { name: '비효율적 프로세스', summary: '업무 절차 문제', note_ids: ['n-1', 'n-2'] },
        { name: '시스템 불편', summary: '도구 관련 이슈', note_ids: ['n-3'] },
      ]
    })},
    finish_reason: 'stop'
  }],
  usage: { total_tokens: 500 }
}

const server = setupServer(
  http.post(`${AZURE_ENDPOINT}/openai/deployments/*/chat/completions`, () =>
    HttpResponse.json(clusterResponse)
  ),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Supabase 모킹
const mockClient = { /* ... from/select/eq/update chain mocks ... */ }
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => mockClient),
}))

describe('POST /api/ai/cluster', () => {
  it('정상 클러스터링: clusters 생성 + notes 업데이트 + is_processing 복구', async () => {
    // 워크샵: is_processing=false, current_stage='cluster'
    mockClient.single.mockResolvedValueOnce({
      data: { id: 'ws-1', is_processing: false, current_stage: 'cluster' }, error: null
    })
    // 미할당 노트 3개
    mockClient.data = [
      { id: 'n-1', content: '보고서 작성이 오래 걸림' },
      { id: 'n-2', content: '수작업 반복' },
      { id: 'n-3', content: 'ERP가 느림' },
    ]

    const req = new NextRequest('http://localhost/api/ai/cluster', {
      method: 'POST',
      body: JSON.stringify({ workshop_id: 'ws-1' }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.clusters).toHaveLength(2)
    // is_processing이 false로 복구되었는지 확인
  })

  it('is_processing=true → 409 PROCESSING', async () => {
    mockClient.single.mockResolvedValueOnce({
      data: { id: 'ws-1', is_processing: true, is_processing_since: new Date().toISOString() },
      error: null
    })

    const req = new NextRequest('http://localhost/api/ai/cluster', {
      method: 'POST',
      body: JSON.stringify({ workshop_id: 'ws-1' }),
    })
    const res = await POST(req)

    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('PROCESSING')
  })

  it('AI 실패 → is_processing 복구 + 500', async () => {
    mockClient.single.mockResolvedValueOnce({
      data: { id: 'ws-1', is_processing: false, current_stage: 'cluster' }, error: null
    })
    server.use(
      http.post(`${AZURE_ENDPOINT}/openai/deployments/*/chat/completions`, () =>
        HttpResponse.error()
      ),
    )

    const req = new NextRequest('http://localhost/api/ai/cluster', {
      method: 'POST',
      body: JSON.stringify({ workshop_id: 'ws-1' }),
    })
    const res = await POST(req)

    expect(res.status).toBe(500)
    // is_processing이 false로 복구되었는지 확인 (try/finally)
  })
})
```

### 4-12. boardStore (pendingNoteIds) 단위 테스트

```ts
// src/stores/board.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useBoardStore } from './board'
import { createMockNote } from '@/test/factories'

describe('boardStore', () => {
  beforeEach(() => {
    useBoardStore.setState({ notes: [], pendingNoteIds: new Set() })
  })

  it('addNote: optimistic → pendingNoteIds에 추가', () => {
    const note = createMockNote({ id: 'n-1' })
    useBoardStore.getState().addNoteOptimistic(note)

    expect(useBoardStore.getState().notes).toContainEqual(note)
    expect(useBoardStore.getState().pendingNoteIds.has('n-1')).toBe(true)
  })

  it('confirmNote: API 성공 → pendingNoteIds에서 제거', () => {
    const note = createMockNote({ id: 'n-1' })
    useBoardStore.getState().addNoteOptimistic(note)
    useBoardStore.getState().confirmNote('n-1')

    expect(useBoardStore.getState().pendingNoteIds.has('n-1')).toBe(false)
    expect(useBoardStore.getState().notes).toContainEqual(note) // 유지
  })

  it('rollbackNote: API 실패 → notes에서 제거 + pending 해제', () => {
    const note = createMockNote({ id: 'n-1' })
    useBoardStore.getState().addNoteOptimistic(note)
    useBoardStore.getState().rollbackNote('n-1')

    expect(useBoardStore.getState().notes).not.toContainEqual(note)
    expect(useBoardStore.getState().pendingNoteIds.has('n-1')).toBe(false)
  })

  it('syncFromRealtime INSERT: pending 아닌 노트만 추가 (중복 방지)', () => {
    const note = createMockNote({ id: 'n-1' })
    useBoardStore.getState().addNoteOptimistic(note) // pending 상태

    // Realtime CDC로 동일 노트 수신
    useBoardStore.getState().syncFromRealtime('INSERT', createMockNote({ id: 'n-1', content: '서버 확정' }))

    // 중복 추가되지 않아야 함
    expect(useBoardStore.getState().notes.filter(n => n.id === 'n-1')).toHaveLength(1)
  })

  it('syncFromRealtime DELETE: 노트 제거', () => {
    const note = createMockNote({ id: 'n-1' })
    useBoardStore.setState({ notes: [note] })

    useBoardStore.getState().syncFromRealtime('DELETE', { id: 'n-1' })

    expect(useBoardStore.getState().notes).toHaveLength(0)
  })
})
```

---

## 5. 테스트 우선순위

### P0 — 핵심 경로 (반드시 작성)

| 대상 | 테스트 유형 | 주요 검증 |
|------|-----------|----------|
| `signSession` / `verifySession` | 단위 | 서명 생성/검증, 변조 거부, 빈 값 |
| `generateInviteCode` | 단위 | 포맷, 혼동 문자 제외, 유일성 |
| `createRateLimiter` | 단위 | 윈도우 카운팅, 실패 차단, IP 독립 |
| `withAuth` / `withFacilitator` | 통합 | 쿠키 세션 검증, Auth 세션 검증, 미인증 거부 |
| `POST /api/votes` | 통합 | 한도 초과, 중복, 단계 검증, 권한 |
| `POST /api/ai/cluster` | 통합 | is_processing 가드, 5분 stale lock, 노트 수 검증 |
| `propagateStale` | 단위 | 단계별 하류 테이블 정확성 |
| `clusteringResponseSchema` | 단위 | 범위 제약, 필드 검증 |
| `validateClusteringResponse` | 단위 | 누락/중복/미확인 note_id |
| `voteStore` | 단위 | setVotes, syncFromRealtime, 중복 방지 |

### P1 — 중요 경로 (권장)

| 대상 | 테스트 유형 | 주요 검증 |
|------|-----------|----------|
| `POST /api/workshops` | 통합 | 초대 코드 생성, 프로젝트당 활성 워크샵 1개 |
| `POST /api/workshops/join` | 통합 | 참가자 수 초과, 완료 워크샵, Rate Limit |
| `PATCH /api/workshops/[id]` | 통합 | 단계 전진 optimistic lock, settings 변경 제약 |
| `POST /api/notes` | 통합 | 200개 제한, 단계 검증, 소유권 |
| `boardStore` (pendingNoteIds) | 단위 | Realtime 중복 방지, 롤백 |
| `workshopStore` (viewingStage) | 단위 | 범위 제한, Realtime 전진 동기화 |
| `VotingCard` | 컴포넌트 | 클릭 이벤트, 비활성 상태, 접근성 |

### P2 — 보조 경로 (선택)

| 대상 | 테스트 유형 |
|------|-----------|
| `POST /api/ai/design` | 통합 |
| `POST /api/ai/generate` | 통합 |
| `POST /api/ai/report` | 통합 |
| `POST /api/reactions` | 통합 |
| `StageNav` | 컴포넌트 |
| `StaleBanner` | 컴포넌트 |

---

## 6. 커버리지 목표

| 범주 | 대상 | 최소 목표 |
|------|------|----------|
| P0 핵심 경로 | 인증, 투표, AI 호출, Stale 전파 | **80%** |
| P1 중요 경로 | 워크샵 CRUD, 노트, 스토어 | **60%** |
| P2 보조 경로 | AI Design/PRD/Report, 반응 | **30%** |
| 전체 | src/ 전체 | **50%** |

### 커버리지 확인

```bash
npm run test:coverage
```

CI에서 P0 핵심 경로 커버리지가 80% 미만이면 빌드 실패로 처리한다.

### Step별 필수 테스트 매트릭스

| Step | 필수 테스트 파일 | P등급 | 검증 대상 |
|------|-----------------|-------|----------|
| Step 0 | `src/lib/env.test.ts` | P1 | 환경 변수 Zod 검증, 누락 시 에러 |
| Step 1 | — (마이그레이션 SQL, 수동 검증) | — | DB 스키마 무결성 |
| Step 2 | `src/lib/session.test.ts`, `src/lib/api/middleware.test.ts`, `src/lib/api/rate-limiter.test.ts` | P0 | 세션 서명/검증, withAuth/withFacilitator, Rate Limiting |
| Step 3 | `src/lib/api/validators.test.ts`, `src/app/api/workshops/route.test.ts` | P0 | Zod 스키마, 워크샵 CRUD API |
| Step 4 | `src/stores/board.test.ts`, `src/app/api/notes/route.test.ts` | P1 | 포스트잇 CRUD, 보드 스토어 |
| Step 5 | `src/app/api/ai/cluster/route.test.ts` | P0 | AI 클러스터링, 응답 검증, is_processing 복구 |
| Step 6 | `src/app/api/votes/route.test.ts`, `src/stores/vote.test.ts` | P0 | 투표 생성/삭제, 제한 검증, 스토어 |
| Step 7 | `src/app/api/ai/design/route.test.ts` | P0 | AX 설계 AI, 과제 생성 |
| Step 8 | `src/app/api/ai/prd/route.test.ts`, `src/app/api/ai/report/route.test.ts` | P1 | PRD/보고서 생성 |
| Step 9 | `src/lib/api/stale.test.ts` | P0 | Stale 전파 로직 |

---

## 7. 테스트 실행 명령어

```bash
npm run test              # 전체 테스트 (watch 모드 아님)
npm run test:watch        # 파일 변경 감지 모드
npm run test:coverage     # 커버리지 리포트 생성
npm run test -- --run src/lib/session.test.ts   # 특정 파일만
npm run test -- --grep "signSession"             # 특정 테스트만
```

## 8. Seed 데이터 전략

> 로컬 개발 및 수동 테스트용. 자동 테스트는 팩토리 함수(섹션 3)를 사용한다.

`supabase/seed.sql` (로컬 Supabase `db reset` 시 자동 실행):

```sql
-- 개발용 퍼실리테이터 (Supabase Auth에 사전 등록 필요)
-- supabase dashboard 또는 supabase/config.toml의 auth.test_users로 생성

-- 프로젝트
INSERT INTO projects (id, facilitator_id, name)
VALUES ('00000000-0000-4000-a000-000000000001', '<facilitator_auth_uid>', '데모 프로젝트');

-- 워크샵 (gather 단계)
INSERT INTO workshops (id, project_id, facilitator_id, title, description, current_stage, invite_code)
VALUES ('00000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-000000000001',
        '<facilitator_auth_uid>', '데모 워크샵', '개발 테스트용', 'gather', 'DEMO42');

-- 퍼실리테이터 participants 등록
INSERT INTO participants (id, workshop_id, user_id, name, is_facilitator)
VALUES ('00000000-0000-4000-a000-000000000100', '00000000-0000-4000-a000-000000000010',
        '<facilitator_auth_uid>', '홍길동(퍼실)', true);

-- 게스트 참석자 2명
INSERT INTO participants (id, workshop_id, name, is_facilitator)
VALUES ('00000000-0000-4000-a000-000000000101', '00000000-0000-4000-a000-000000000010', '김참석', false),
       ('00000000-0000-4000-a000-000000000102', '00000000-0000-4000-a000-000000000010', '이참석', false);
```

> **주의**: seed.sql의 `<facilitator_auth_uid>`는 실제 Auth UID로 교체 필요. `supabase/config.toml`에서 테스트 유저를 설정하면 자동화 가능.
