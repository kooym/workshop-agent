import { z } from 'zod'

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
})

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  AZURE_OPENAI_ENDPOINT: z.string().url(),
  AZURE_OPENAI_API_KEY: z.string().min(1),
  AZURE_OPENAI_DEPLOYMENT: z.string().min(1),
  AZURE_OPENAI_API_VERSION: z.string().min(1),
})

export type PublicEnv = z.infer<typeof publicEnvSchema> & {
  NEXT_PUBLIC_SUPABASE_BROWSER_KEY: string
}

export type ServerEnv = z.infer<typeof serverEnvSchema> & {
  NEXT_PUBLIC_SUPABASE_BROWSER_KEY: string
}

type EnvSource = Record<string, string | undefined>

export function parsePublicEnv(source: EnvSource): PublicEnv {
  const parsed = publicEnvSchema.parse(source)
  return {
    ...parsed,
    NEXT_PUBLIC_SUPABASE_BROWSER_KEY:
      parsed.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}

export function parseServerEnv(source: EnvSource): ServerEnv {
  const parsed = serverEnvSchema.parse(source)
  return {
    ...parsed,
    NEXT_PUBLIC_SUPABASE_BROWSER_KEY:
      parsed.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}

export function getPublicEnv() {
  return parsePublicEnv(process.env)
}

export function getServerEnv() {
  return parseServerEnv(process.env)
}
