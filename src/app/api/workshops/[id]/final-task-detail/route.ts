import type { NextRequest } from 'next/server'
import { withFacilitator } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { finalTaskDetailPatchSchema } from '@/lib/ai/schemas'
import type { Json } from '@/types/common'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params
  const body = await req.json().catch(() => null)
  if (!body) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '요청 본문이 필요합니다.', 400)
  }

  const parsed = finalTaskDetailPatchSchema.safeParse(body)
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '유효하지 않은 최종 과제 상세입니다.', 400)
  }

  return withFacilitator(req, async (_request, { service, user }) => {
    const { data: workshop } = await service
      .from('workshops')
      .select('*')
      .eq('id', workshopId)
      .maybeSingle()

    if (!workshop) {
      return error(API_ERROR_CODES.NOT_FOUND, '워크샵을 찾을 수 없습니다.', 404)
    }
    if (workshop.facilitator_id !== user.id) {
      return error(API_ERROR_CODES.FORBIDDEN, '퍼실리테이터만 수정할 수 있습니다.', 403)
    }
    if (workshop.current_stage !== 'design') {
      return error(API_ERROR_CODES.STAGE_LOCKED, '설계 단계에서만 수정할 수 있습니다.', 403)
    }

    const { data: artifact } = await service
      .from('design_artifacts')
      .select('id')
      .eq('workshop_id', workshopId)
      .eq('alternative_index', 0)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!artifact) {
      return error(API_ERROR_CODES.NOT_FOUND, '설계 산출물을 찾을 수 없습니다.', 404)
    }

    const { error: updateError } = await service
      .from('design_artifacts')
      .update({ final_task_detail: parsed.data as Json })
      .eq('id', artifact.id)

    if (updateError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, updateError.message, 500)
    }

    return success({ final_task_detail: parsed.data })
  })
}
