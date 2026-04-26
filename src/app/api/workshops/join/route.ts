import type { NextRequest } from 'next/server'
import { createRateLimiter, getClientIp } from '@/lib/api/rate-limit'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { joinWorkshopSchema } from '@/lib/api/validators'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { setSession } from '@/lib/session'

const joinLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
  maxFailures: 5,
  blockDurationMs: 60_000,
})

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rateLimit = joinLimiter(ip)
  if (!rateLimit.allowed) {
    return error(API_ERROR_CODES.CONFLICT, '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 429)
  }

  const body = await req.json().catch(() => null)
  const parsed = joinWorkshopSchema.safeParse(body)
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '참여 정보를 확인해주세요.', 400)
  }

  const service = createServiceRoleClient()
  const { data, error: joinError } = await service
    .rpc('join_workshop_by_code', {
      p_invite_code: parsed.data.invite_code,
      p_display_name: parsed.data.name,
      p_role: parsed.data.role ?? null,
    })
    .single()

  if (joinError) {
    joinLimiter(ip, true)

    if (joinError.message.includes('WORKSHOP_NOT_FOUND')) {
      return error(API_ERROR_CODES.NOT_FOUND, '존재하지 않는 초대 코드입니다.', 404)
    }

    if (joinError.message.includes('PARTICIPANT_LIMIT')) {
      return error(API_ERROR_CODES.PARTICIPANT_LIMIT, '워크샵이 가득 찼습니다.', 409)
    }

    return error(API_ERROR_CODES.INTERNAL_ERROR, joinError.message, 500)
  }

  await setSession(data.workshop_id, data.participant_id)
  joinLimiter(ip, false)

  return success({
    workshop: data.workshop,
    participant: data.participant,
    readOnly: data.read_only,
  })
}
