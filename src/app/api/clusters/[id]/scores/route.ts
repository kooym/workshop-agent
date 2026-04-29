import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { upsertClusterScoreSchema } from '@/lib/api/validators'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id: clusterId } = await context.params
  const workshopId = req.nextUrl.searchParams.get('workshop_id')

  if (!workshopId) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, 'workshop_id가 필요합니다.', 400)
  }

  return withAuth(
    req,
    async (_request, { service, participant }) => {
      const { data: score, error: scoreError } = await service
        .from('cluster_scores')
        .select('*')
        .eq('cluster_id', clusterId)
        .eq('participant_id', participant.id)
        .maybeSingle()

      if (scoreError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, scoreError.message, 500)
      }

      return success(score)
    },
    { workshopId },
  )
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { id: clusterId } = await context.params

  const body = await req.json().catch(() => null)
  const parsed = upsertClusterScoreSchema.safeParse(body)
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '점수 정보를 확인해주세요.', 400)
  }

  const workshopId = req.nextUrl.searchParams.get('workshop_id')
  if (!workshopId) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, 'workshop_id가 필요합니다.', 400)
  }

  return withAuth(
    req,
    async (_request, { service, participant }) => {
      // Verify cluster belongs to workshop
      const { data: cluster } = await service
        .from('clusters')
        .select('id')
        .eq('id', clusterId)
        .eq('workshop_id', workshopId)
        .maybeSingle()

      if (!cluster) {
        return error(API_ERROR_CODES.NOT_FOUND, '클러스터를 찾을 수 없습니다.', 404)
      }

      const { data: score, error: upsertError } = await service
        .from('cluster_scores')
        .upsert(
          {
            cluster_id: clusterId,
            workshop_id: workshopId,
            participant_id: participant.id,
            score_impact: parsed.data.score_impact,
            score_feasibility: parsed.data.score_feasibility,
            score_urgency: parsed.data.score_urgency,
          },
          { onConflict: 'cluster_id,participant_id' },
        )
        .select('*')
        .single()

      if (upsertError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, upsertError.message, 500)
      }

      return success(score, 201)
    },
    { workshopId },
  )
}
