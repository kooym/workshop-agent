import type { NextRequest } from 'next/server'
import { withFacilitator } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { dismissStaleSchema } from '@/lib/api/validators'
import { dismissStale } from '@/lib/api/stale'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  return withFacilitator(req, async (_request, { service, user }) => {
    const body = await req.json().catch(() => null)
    const parsed = dismissStaleSchema.safeParse(body)
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION_ERROR, 'stale 해제 대상을 확인해주세요.', 400)
    }

    const { data: workshop, error: workshopError } = await service
      .from('workshops')
      .select('id,facilitator_id')
      .eq('id', id)
      .maybeSingle()

    if (workshopError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, workshopError.message, 500)
    }

    if (!workshop) {
      return error(API_ERROR_CODES.NOT_FOUND, '워크샵을 찾을 수 없습니다.', 404)
    }

    if (workshop.facilitator_id !== user.id) {
      return error(API_ERROR_CODES.FORBIDDEN, '워크샵 퍼실리테이터만 수행할 수 있습니다.', 403)
    }

    const tables = 'tables' in parsed.data ? parsed.data.tables : [parsed.data.table]
    await dismissStale(service, id, tables)

    return success({ dismissed: tables })
  })
}
