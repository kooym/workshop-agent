import type { NextRequest } from 'next/server'
import { withFacilitator } from '@/lib/api/middleware'
import { getLatestPrd, insertVersionedPrd, propagatePrdStaleIfNeeded } from '@/lib/api/output'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { prdPatchSchema } from '@/lib/api/validators'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const body = await req.json().catch(() => null)
  const parsed = prdPatchSchema.safeParse(body)
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, 'PRD 수정 정보를 확인해주세요.', 400)
  }

  return withFacilitator(req, async (_request, { service, user }) => {
    const { data: workshop, error: workshopError } = await service
      .from('workshops')
      .select('*')
      .eq('id', parsed.data.workshop_id)
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
    if (workshop.current_stage !== 'generate') {
      return error(API_ERROR_CODES.FORBIDDEN, 'PRD 생성 단계에서만 수정할 수 있습니다.', 403)
    }

    const latest = await getLatestPrd(service, workshop.id)
    if (!latest || latest.id !== id) {
      return error(API_ERROR_CODES.NOT_FOUND, '최신 PRD를 찾을 수 없습니다.', 404)
    }

    const prd = await insertVersionedPrd(service, workshop.id, parsed.data.content)
    await propagatePrdStaleIfNeeded(service, workshop)
    return success(prd)
  })
}
