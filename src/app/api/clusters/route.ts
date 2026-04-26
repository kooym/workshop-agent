import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { getClustersWithNotes } from '@/lib/api/clusters'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { listClustersQuerySchema } from '@/lib/api/validators'

export async function GET(req: NextRequest) {
  const parsed = listClustersQuerySchema.safeParse({
    workshop_id: req.nextUrl.searchParams.get('workshop_id'),
  })
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, 'workshop_id가 필요합니다.', 400)
  }

  return withAuth(
    req,
    async (_request, { service }) => {
      try {
        const clusters = await getClustersWithNotes(service, parsed.data.workshop_id)
        return success(clusters)
      } catch (clusterError) {
        return error(
          API_ERROR_CODES.INTERNAL_ERROR,
          clusterError instanceof Error ? clusterError.message : '클러스터를 불러오지 못했습니다.',
          500,
        )
      }
    },
    { workshopId: parsed.data.workshop_id },
  )
}
