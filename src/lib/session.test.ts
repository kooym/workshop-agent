import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { signSession, verifySession } from './session'

const baseEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
  SESSION_SECRET: 'session-secret-value-that-is-long-enough',
  AZURE_OPENAI_ENDPOINT: 'https://example.openai.azure.com/',
  AZURE_OPENAI_API_KEY: 'azure-key',
  AZURE_OPENAI_DEPLOYMENT: 'gpt-4o',
  AZURE_OPENAI_API_VERSION: '2024-08-01-preview',
}

describe('participant session signing', () => {
  beforeEach(() => {
    Object.assign(process.env, baseEnv)
  })

  it('verifies a signed participant cookie payload', () => {
    const signed = signSession(
      '00000000-0000-4000-a000-000000000020',
      '00000000-0000-4000-a000-000000000030',
    )

    expect(verifySession(signed)).toEqual({
      workshopId: '00000000-0000-4000-a000-000000000020',
      participantId: '00000000-0000-4000-a000-000000000030',
    })
  })

  it('rejects a tampered cookie value', () => {
    const signed = signSession('workshop-id', 'participant-id')
    const tampered = `${signed.slice(0, -1)}0`

    expect(verifySession(tampered)).toBeNull()
  })

  it('uses SESSION_SECRET instead of the Supabase service role key', () => {
    const signed = signSession('workshop-id', 'participant-id')
    const [payload, signature] = signed.slice(3).split('.')

    const sessionSecretSignature = createHmac('sha256', baseEnv.SESSION_SECRET)
      .update(payload)
      .digest('hex')
    const serviceRoleSignature = createHmac('sha256', baseEnv.SUPABASE_SERVICE_ROLE_KEY)
      .update(payload)
      .digest('hex')

    expect(signature).toBe(sessionSecretSignature)
    expect(signature).not.toBe(serviceRoleSignature)
  })
})
