import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { buildWorkshopSummary } from '@/lib/api/summary'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  return withAuth(
    req,
    async (_request, { service, participant }) => {
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

      try {
        return success(await buildWorkshopSummary(service, workshop, participant.id))
      } catch (summaryError) {
        return error(
          API_ERROR_CODES.INTERNAL_ERROR,
          summaryError instanceof Error ? summaryError.message : '워크샵 요약을 불러오지 못했습니다.',
          500,
        )
      }
    },
    { workshopId: id },
  )
}
