import { describe, expect, it } from 'vitest'
import { parsePublicEnv, parseServerEnv } from './env'

const validPublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
}

const validServerEnv = {
  ...validPublicEnv,
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SESSION_SECRET: 'a'.repeat(32),
  AZURE_OPENAI_ENDPOINT: 'https://example.openai.azure.com/',
  AZURE_OPENAI_API_KEY: 'azure-key',
  AZURE_OPENAI_DEPLOYMENT: 'gpt-4o',
  AZURE_OPENAI_API_VERSION: '2024-08-01-preview',
}

describe('env parsing', () => {
  it('parses public env and uses anon key as browser key by default', () => {
    expect(parsePublicEnv(validPublicEnv).NEXT_PUBLIC_SUPABASE_BROWSER_KEY).toBe('anon-key')
  })

  it('prefers publishable key when provided', () => {
    const parsed = parsePublicEnv({
      ...validPublicEnv,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    })

    expect(parsed.NEXT_PUBLIC_SUPABASE_BROWSER_KEY).toBe('publishable-key')
  })

  it('rejects short session secrets', () => {
    expect(() =>
      parseServerEnv({
        ...validServerEnv,
        SESSION_SECRET: 'too-short',
      }),
    ).toThrow()
  })

  it('rejects missing server secrets', () => {
    const envWithoutServiceRole: Partial<typeof validServerEnv> = { ...validServerEnv }
    delete envWithoutServiceRole.SUPABASE_SERVICE_ROLE_KEY

    expect(() => parseServerEnv(envWithoutServiceRole)).toThrow()
  })
})
