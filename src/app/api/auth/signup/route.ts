import type { NextRequest } from 'next/server'
import { createRateLimiter, getClientIp } from '@/lib/api/rate-limit'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { signupSchema } from '@/lib/api/validators'
import { createServerClient } from '@/lib/supabase/server'

const signupLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 })

export async function POST(req: NextRequest) {
  const rateLimit = signupLimiter(getClientIp(req))
  if (!rateLimit.allowed) {
    return error(API_ERROR_CODES.CONFLICT, '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 429)
  }

  const body = await req.json().catch(() => null)
  const parsed = signupSchema.safeParse(body)
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '회원가입 정보를 확인해주세요.', 400)
  }

  const supabase = await createServerClient()
  const { data, error: authError } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        name: parsed.data.name,
      },
    },
  })

  if (authError) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, authError.message, authError.status ?? 400)
  }

  return success({ user: data.user })
}
