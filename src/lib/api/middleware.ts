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

export type AdminContext = {
  user: User
  service: ServiceClient
}

export async function withAdmin(
  req: NextRequest,
  handler: (req: NextRequest, context: AdminContext) => Promise<NextResponse> | NextResponse,
) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return error(API_ERROR_CODES.UNAUTHORIZED, '로그인이 필요합니다.', 401)
  }

  if (user.user_metadata?.role !== 'admin') {
    return error(API_ERROR_CODES.FORBIDDEN, '관리자 권한이 필요합니다.', 403)
  }

  return handler(req, {
    user,
    service: createServiceRoleClient(),
  })
}

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

  // Guest cookie first — same browser shares Supabase Auth cookies,
  // so a guest tab must resolve via its own cookie, not the facilitator's Auth session.
  const cookieValue = req.cookies.get(PARTICIPANT_SESSION_COOKIE)?.value
  const session = cookieValue ? verifySession(cookieValue) : null

  if (session && session.workshopId === workshopId) {
    const { data: guestParticipant } = await service
      .from('participants')
      .select('*')
      .eq('id', session.participantId)
      .eq('workshop_id', workshopId)
      .single()

    if (guestParticipant) {
      // If the guest participant is actually a facilitator (e.g. facilitator also has a cookie),
      // resolve as facilitator to preserve AuthContext typing.
      if (guestParticipant.is_facilitator && guestParticipant.user_id) {
        const supabase = await createServerClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          return handler(req, {
            actor: 'facilitator',
            user,
            participant: guestParticipant,
            workshopId,
            service,
          })
        }
      }
      return handler(req, {
        actor: 'participant',
        participant: guestParticipant,
        workshopId,
        service,
      })
    }
  }

  // Fallback: Supabase Auth (facilitator)
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

  return error(API_ERROR_CODES.UNAUTHORIZED, '유효하지 않은 세션입니다.', 401)
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
