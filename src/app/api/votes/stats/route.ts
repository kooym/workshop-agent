import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { voteResultsQuerySchema } from '@/lib/api/validators'

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
      const [participantsResult, votesResult] = await Promise.all([
        service.from('participants').select('id').eq('workshop_id', parsed.data.workshop_id),
        service.from('votes').select('participant_id').eq('workshop_id', parsed.data.workshop_id),
      ])

      if (participantsResult.error) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, participantsResult.error.message, 500)
      }
      if (votesResult.error) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, votesResult.error.message, 500)
      }

      const totalParticipants = participantsResult.data?.length ?? 0
      const votedParticipants = new Set(
        (votesResult.data ?? []).map((vote) => vote.participant_id),
      ).size

      return success({
        total_participants: totalParticipants,
        voted_participants: votedParticipants,
        participation_rate: totalParticipants
          ? Math.round((votedParticipants / totalParticipants) * 1000) / 10
          : 0,
      })
    },
    { workshopId: parsed.data.workshop_id },
  )
}
