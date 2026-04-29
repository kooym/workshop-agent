import type { NextRequest } from 'next/server'
import { createRateLimiter, getClientIp } from '@/lib/api/rate-limit'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { loginSchema } from '@/lib/api/validators'
import { createServerClient } from '@/lib/supabase/server'

const loginLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 })

export async function POST(req: NextRequest) {
  const rateLimit = loginLimiter(getClientIp(req))
  if (!rateLimit.allowed) {
    return error(API_ERROR_CODES.CONFLICT, '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 429)
  }

  const body = await req.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '이메일과 비밀번호를 확인해주세요.', 400)
  }

  const supabase = await createServerClient()
  const { data, error: authError } = await supabase.auth.signInWithPassword(parsed.data)

  if (authError) {
    return error(API_ERROR_CODES.UNAUTHORIZED, authError.message, authError.status ?? 401)
  }

  // Check if user is approved
  const metadata = data.user?.user_metadata
  if (metadata?.approved !== true) {
    await supabase.auth.signOut()
    return error(API_ERROR_CODES.FORBIDDEN, '관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다.', 403)
  }

  return success({ user: data.user, session: data.session })
}
