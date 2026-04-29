import type { NextRequest } from 'next/server'
import { withFacilitator } from '@/lib/api/middleware'
import { propagateClusterStaleIfNeeded } from '@/lib/api/clusters'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { patchClusterSchema } from '@/lib/api/validators'
import type { TablesUpdate } from '@/lib/supabase/types'
import { getStageIndex } from '@/lib/workshop/stage'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const workshopId = req.nextUrl.searchParams.get('workshop_id') ?? req.headers.get('x-workshop-id')
  if (!workshopId) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, 'workshop_id가 필요합니다.', 400)
  }

  const body = await req.json().catch(() => null)
  const parsed = patchClusterSchema.safeParse(body)
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '클러스터 수정 정보를 확인해주세요.', 400)
  }

  return withFacilitator(req, async (_request, { service, user }) => {
    const { data: workshop, error: workshopError } = await service
      .from('workshops')
      .select('*')
      .eq('id', workshopId)
      .maybeSingle()

    if (workshopError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, workshopError.message, 500)
    }
    if (!workshop) {
      return error(API_ERROR_CODES.NOT_FOUND, '워크샵을 찾을 수 없습니다.', 404)
    }
    if (workshop.facilitator_id !== user.id) {
      return error(API_ERROR_CODES.FORBIDDEN, '워크샵 퍼실리테이터만 수정할 수 있습니다.', 403)
    }
    if (workshop.current_stage === 'completed') {
      return error(API_ERROR_CODES.FORBIDDEN, '완료된 워크샵은 수정할 수 없습니다.', 403)
    }
    if (getStageIndex(workshop.current_stage) < getStageIndex('cluster')) {
      return error(API_ERROR_CODES.CONFLICT, '클러스터 단계 이후에만 수정할 수 있습니다.', 409)
    }

    const patch: TablesUpdate<'clusters'> = {}
    if (parsed.data.name !== undefined) {
      patch.name = parsed.data.name
    }
    if (parsed.data.order_index !== undefined) {
      patch.order_index = parsed.data.order_index
    }
    if (parsed.data.score_impact !== undefined) {
      patch.score_impact = parsed.data.score_impact
    }
    if (parsed.data.score_feasibility !== undefined) {
      patch.score_feasibility = parsed.data.score_feasibility
    }
    if (parsed.data.score_urgency !== undefined) {
      patch.score_urgency = parsed.data.score_urgency
    }

    const { data: updated, error: updateError } = await service
      .from('clusters')
      .update(patch)
      .eq('id', id)
      .eq('workshop_id', workshopId)
      .select('*')
      .maybeSingle()

    if (updateError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, updateError.message, 500)
    }
    if (!updated) {
      return error(API_ERROR_CODES.NOT_FOUND, '클러스터를 찾을 수 없습니다.', 404)
    }

    if (getStageIndex(workshop.current_stage) > getStageIndex('cluster')) {
      await propagateClusterStaleIfNeeded(service, workshop)
    }

    return success(updated)
  })
}
