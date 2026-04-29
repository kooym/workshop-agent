import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { editingLockSchema } from '@/lib/api/validators'

const HEARTBEAT_STALE_MS = 30_000

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  return withAuth(
    req,
    async (_request, { service }) => {
      const { data: locks, error: locksError } = await service
        .from('editing_locks')
        .select('*')
        .eq('workshop_id', id)

      if (locksError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, locksError.message, 500)
      }

      return success(locks)
    },
    { workshopId: id },
  )
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  return withAuth(
    req,
    async (_request, contextValue) => {
      const { service, participant } = contextValue
      const body = await req.json().catch(() => null)
      const parsed = editingLockSchema.safeParse(body)
      if (!parsed.success) {
        return error(API_ERROR_CODES.VALIDATION_ERROR, '편집 잠금 대상을 확인해주세요.', 400)
      }

      const { data: workshop, error: workshopError } = await service
        .from('workshops')
        .select('id,current_stage')
        .eq('id', id)
        .single()

      if (workshopError || !workshop) {
        return error(API_ERROR_CODES.NOT_FOUND, '워크샵을 찾을 수 없습니다.', 404)
      }

      if (workshop.current_stage === 'completed') {
        return error(API_ERROR_CODES.FORBIDDEN, '완료된 워크샵은 읽기 전용입니다.', 403)
      }

      // Check if a non-stale lock exists held by someone else
      const { data: existing } = await service
        .from('editing_locks')
        .select('*')
        .eq('workshop_id', id)
        .eq('resource_type', parsed.data.resource_type)
        .maybeSingle()

      if (existing && existing.editor_id !== participant.id) {
        const heartbeatAge = Date.now() - new Date(existing.last_heartbeat_at).getTime()
        const isStale = heartbeatAge > HEARTBEAT_STALE_MS
        const isFacilitatorOverride = contextValue.actor === 'facilitator'

        if (!isStale && !isFacilitatorOverride) {
          return error(API_ERROR_CODES.CONFLICT, '다른 참여자가 편집 중입니다.', 409)
        }
      }

      const { data: editingLock, error: lockError } = await service
        .from('editing_locks')
        .upsert(
          {
            workshop_id: id,
            resource_type: parsed.data.resource_type,
            editor_id: participant.id,
            acquired_at: new Date().toISOString(),
            last_heartbeat_at: new Date().toISOString(),
          },
          { onConflict: 'workshop_id,resource_type' },
        )
        .select('*')
        .single()

      if (lockError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, lockError.message, 500)
      }

      return success(editingLock)
    },
    { workshopId: id },
  )
}
