import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { voteResultsQuerySchema } from '@/lib/api/validators'
import { aggregateVoteResults, shouldHideVoteResults } from '@/lib/api/votes'

export async function GET(req: NextRequest) {
  const parsed = voteResultsQuerySchema.safeParse({
    workshop_id: req.nextUrl.searchParams.get('workshop_id'),
  })
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, 'workshop_id가 필요합니다.', 400)
  }

  return withAuth(
    req,
    async (_request, { service }) => {
      const { data: workshop, error: workshopError } = await service
        .from('workshops')
        .select('*')
        .eq('id', parsed.data.workshop_id)
        .single()

      if (workshopError || !workshop) {
        return error(API_ERROR_CODES.NOT_FOUND, '워크샵을 찾을 수 없습니다.', 404)
      }

      if (shouldHideVoteResults(workshop)) {
        return success({ visible: false, results: [] })
      }

      const [votesResult, clustersResult, notesResult] = await Promise.all([
        service.from('votes').select('*').eq('workshop_id', parsed.data.workshop_id),
        service.from('clusters').select('*').eq('workshop_id', parsed.data.workshop_id),
        service.from('notes').select('*').eq('workshop_id', parsed.data.workshop_id),
      ])

      const failure = [votesResult, clustersResult, notesResult].find((result) => result.error)
      if (failure?.error) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, failure.error.message, 500)
      }

      return success({
        visible: true,
        results: aggregateVoteResults({
          voteMode: workshop.settings.vote_mode,
          votes: votesResult.data ?? [],
          clusters: clustersResult.data ?? [],
          notes: notesResult.data ?? [],
        }),
      })
    },
    { workshopId: parsed.data.workshop_id },
  )
}
