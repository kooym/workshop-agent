import type { User } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { signSession, PARTICIPANT_SESSION_COOKIE } from '@/lib/session'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { withAuth, withFacilitator } from './middleware'

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}))

const mockCreateServerClient = vi.mocked(createServerClient)
const mockCreateServiceRoleClient = vi.mocked(createServiceRoleClient)

const user = {
  id: '00000000-0000-4000-a000-000000000001',
  email: 'facilitator@example.com',
} as User

const participant = {
  id: '00000000-0000-4000-a000-000000000030',
  workshop_id: '00000000-0000-4000-a000-000000000020',
  user_id: user.id,
  display_name: 'Facilitator',
  role: null,
  is_facilitator: true,
  joined_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
}

describe('api auth middleware', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
      SESSION_SECRET: 'session-secret-value-that-is-long-enough',
      AZURE_OPENAI_ENDPOINT: 'https://example.openai.azure.com/',
      AZURE_OPENAI_API_KEY: 'azure-key',
      AZURE_OPENAI_DEPLOYMENT: 'gpt-4o',
      AZURE_OPENAI_API_VERSION: '2024-08-01-preview',
    })
    vi.clearAllMocks()
  })

  it('does not allow guest cookies on facilitator-only routes', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as never)

    const req = createRequest('/api/projects', {
      [PARTICIPANT_SESSION_COOKIE]: signSession('workshop-id', 'participant-id'),
    })

    const response = await withFacilitator(req, () => NextResponse.json({ data: { ok: true } }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
    })
  })

  it('prioritizes a verified facilitator auth session over a guest cookie', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
    } as never)
    mockCreateServiceRoleClient.mockReturnValue(createServiceWithParticipant(participant) as never)

    const req = createRequest('/api/notes?workshop_id=00000000-0000-4000-a000-000000000020', {
      [PARTICIPANT_SESSION_COOKIE]: signSession('other-workshop', 'other-participant'),
    })

    const response = await withAuth(req, (_request, context) =>
      NextResponse.json({ data: { actor: context.actor } }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { actor: 'facilitator' } })
  })
})

function createRequest(path: string, cookies: Record<string, string>) {
  const cookieHeader = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')

  return new NextRequest(`http://localhost${path}`, {
    headers: {
      cookie: cookieHeader,
    },
  })
}

function createServiceWithParticipant(value: typeof participant) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue({ data: value, error: null }),
    single: vi.fn().mockResolvedValue({ data: value, error: null }),
  }

  return {
    from: vi.fn(() => query),
  }
}
