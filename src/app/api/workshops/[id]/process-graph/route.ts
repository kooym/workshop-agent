import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { getProcessGraph } from '@/lib/api/process-graph'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  return withAuth(
    req,
    async (_request, { service }) => {
      try {
        return success(await getProcessGraph(service, id))
      } catch (graphError) {
        const message =
          graphError instanceof Error
            ? graphError.message
            : '프로세스 그래프를 불러오지 못했습니다.'
        return error(API_ERROR_CODES.INTERNAL_ERROR, message, 500)
      }
    },
    { workshopId: id },
  )
}
