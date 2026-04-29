import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { getLatestPrd } from '@/lib/api/output'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { prdQuerySchema } from '@/lib/api/validators'

export async function GET(req: NextRequest) {
  const parsed = prdQuerySchema.safeParse({
    workshop_id: req.nextUrl.searchParams.get('workshop_id'),
  })
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, 'workshop_id가 필요합니다.', 400)
  }

  return withAuth(
    req,
    async (_request, { service }) => {
      try {
        return success(await getLatestPrd(service, parsed.data.workshop_id))
      } catch (prdError) {
        return error(
          API_ERROR_CODES.INTERNAL_ERROR,
          prdError instanceof Error ? prdError.message : 'PRD를 불러오지 못했습니다.',
          500,
        )
      }
    },
    { workshopId: parsed.data.workshop_id },
  )
}
