import type { NextRequest } from 'next/server'
import { createRateLimiter, getClientIp } from '@/lib/api/rate-limit'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { signupSchema } from '@/lib/api/validators'
import { createServiceRoleClient } from '@/lib/supabase/server'

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

  // Use service_role admin API to create user with email auto-confirmed.
  // Email confirmation is redundant since we use admin approval as the gate.
  const service = createServiceRoleClient()
  const { data, error: authError } = await service.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      name: parsed.data.name,
      role: 'facilitator',
      approved: false,
    },
  })

  if (authError) {
    const msg = authError.message.includes('already been registered')
      ? '이미 등록된 이메일입니다.'
      : authError.message
    return error(API_ERROR_CODES.VALIDATION_ERROR, msg, authError.status ?? 400)
  }

  return success({ user: data.user, pending_approval: true })
}
