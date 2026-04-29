import type { NextRequest } from 'next/server'
import { withAuth, withFacilitator } from '@/lib/api/middleware'
import { getLatestReport, insertVersionedReport } from '@/lib/api/output'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { reportPatchSchema } from '@/lib/api/validators'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  return withAuth(
    req,
    async (_request, { service }) => {
      try {
        return success(await getLatestReport(service, id))
      } catch (reportError) {
        return error(
          API_ERROR_CODES.INTERNAL_ERROR,
          reportError instanceof Error ? reportError.message : '보고서를 불러오지 못했습니다.',
          500,
        )
      }
    },
    { workshopId: id },
  )
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const body = await req.json().catch(() => null)
  const parsed = reportPatchSchema.safeParse(body)
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '보고서 수정 정보를 확인해주세요.', 400)
  }

  return withFacilitator(req, async (_request, { service, user }) => {
    const { data: workshop, error: workshopError } = await service
      .from('workshops')
      .select('*')
      .eq('id', id)
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
    if (workshop.current_stage !== 'report') {
      return error(API_ERROR_CODES.FORBIDDEN, '보고서 단계에서만 수정할 수 있습니다.', 403)
    }

    const report = await insertVersionedReport(service, id, parsed.data.content)
    return success(report)
  })
}
