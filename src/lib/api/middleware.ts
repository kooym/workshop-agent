import type { User } from '@supabase/supabase-js'
import type { NextRequest, NextResponse } from 'next/server'
import { API_ERROR_CODES, error } from '@/lib/api/response'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/types'
import { PARTICIPANT_SESSION_COOKIE, verifySession } from '@/lib/session'

type ServiceClient = ReturnType<typeof createServiceRoleClient>

export type FacilitatorContext = {
  user: User
  service: ServiceClient
}

export type ParticipantAuthContext = {
  actor: 'participant'
  participant: Tables<'participants'>
  workshopId: string
  service: ServiceClient
}

export type FacilitatorAuthContext = {
  actor: 'facilitator'
  user: User
  participant: Tables<'participants'>
  workshopId: string
  service: ServiceClient
}

export type AuthContext = ParticipantAuthContext | FacilitatorAuthContext

export async function withFacilitator(
  req: NextRequest,
  handler: (req: NextRequest, context: FacilitatorContext) => Promise<NextResponse> | NextResponse,
) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return error(API_ERROR_CODES.UNAUTHORIZED, '로그인이 필요합니다.', 401)
  }

  return handler(req, {
    user,
    service: createServiceRoleClient(),
  })
}

export async function withAuth(
  req: NextRequest,
  handler: (req: NextRequest, context: AuthContext) => Promise<NextResponse> | NextResponse,
  options: { workshopId?: string } = {},
) {
  const workshopId = options.workshopId ?? getWorkshopIdFromRequest(req)
  if (!workshopId) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, 'workshop_id가 필요합니다.', 400)
  }

  const service = createServiceRoleClient()
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const participant = await findFacilitatorParticipant(service, workshopId, user.id)
    if (!participant) {
      return error(API_ERROR_CODES.FORBIDDEN, '퍼실리테이터 권한이 없습니다.', 403)
    }

    return handler(req, {
      actor: 'facilitator',
      user,
      participant,
      workshopId,
      service,
    })
  }

  const cookieValue = req.cookies.get(PARTICIPANT_SESSION_COOKIE)?.value
  const session = cookieValue ? verifySession(cookieValue) : null
  if (!session) {
    return error(API_ERROR_CODES.UNAUTHORIZED, '유효하지 않은 세션입니다.', 401)
  }

  if (session.workshopId !== workshopId) {
    return error(API_ERROR_CODES.FORBIDDEN, '워크샵 세션이 일치하지 않습니다.', 403)
  }

  const { data: participant, error: participantError } = await service
    .from('participants')
    .select('*')
    .eq('id', session.participantId)
    .eq('workshop_id', workshopId)
    .single()

  if (participantError || !participant) {
    return error(API_ERROR_CODES.UNAUTHORIZED, '참석자 세션을 찾을 수 없습니다.', 401)
  }

  return handler(req, {
    actor: 'participant',
    participant,
    workshopId,
    service,
  })
}

function getWorkshopIdFromRequest(req: NextRequest) {
  return req.nextUrl.searchParams.get('workshop_id') ?? req.headers.get('x-workshop-id')
}

async function findFacilitatorParticipant(
  service: ServiceClient,
  workshopId: string,
  userId: string,
) {
  const { data: participant } = await service
    .from('participants')
    .select('*')
    .eq('workshop_id', workshopId)
    .eq('user_id', userId)
    .eq('is_facilitator', true)
    .maybeSingle()

  return participant
}
