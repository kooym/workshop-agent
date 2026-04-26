import type { NextRequest } from 'next/server'
import { clusterNotesWithAI } from '@/lib/ai/clustering'
import { withFacilitator } from '@/lib/api/middleware'
import {
  applyClusteringResponse,
  buildExistingClusterPromptInput,
  clearClusterStaleFlags,
  getClustersWithNotes,
  isProcessingStale,
} from '@/lib/api/clusters'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { aiClusterSchema } from '@/lib/api/validators'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = aiClusterSchema.safeParse(body)
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '워크샵 정보를 확인해주세요.', 400)
  }

  return withFacilitator(req, async (_request, { service, user }) => {
    const workshopId = parsed.data.workshop_id
    let processingStarted = false

    const { data: workshop, error: workshopError } = await service
      .from('workshops')
      .select('*')
      .eq('id', workshopId)
      .maybeSingle()

    if (workshopError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, workshopError.message, 500)
    }
    if (!workshop) {
      return error(API_ERROR_CODES.NOT_FOUND, '워크샵을 찾을 수 없습니다.', 404)
    }
    if (workshop.facilitator_id !== user.id) {
      return error(API_ERROR_CODES.FORBIDDEN, '워크샵 퍼실리테이터만 실행할 수 있습니다.', 403)
    }
    if (workshop.current_stage !== 'cluster') {
      return error(API_ERROR_CODES.CONFLICT, '클러스터 단계에서만 실행할 수 있습니다.', 409)
    }
    if (workshop.is_processing && !isProcessingStale(workshop.is_processing_since)) {
      return error(API_ERROR_CODES.PROCESSING, '이미 AI가 처리 중입니다.', 409)
    }

    const { error: lockError } = await service
      .from('workshops')
      .update({
        is_processing: true,
        is_processing_since: new Date().toISOString(),
      })
      .eq('id', workshopId)

    if (lockError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, lockError.message, 500)
    }

    processingStarted = true

    try {
      const { data: notes, error: notesError } = await service
        .from('notes')
        .select('*')
        .eq('workshop_id', workshopId)
        .order('created_at', { ascending: true })

      if (notesError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, notesError.message, 500)
      }
      if ((notes ?? []).length < 5) {
        return error(
          API_ERROR_CODES.VALIDATION_ERROR,
          '클러스터링에는 최소 5개의 포스트잇이 필요합니다.',
          400,
        )
      }

      const { data: existingClusters, error: clustersError } = await service
        .from('clusters')
        .select('*')
        .eq('workshop_id', workshopId)
        .order('order_index', { ascending: true })

      if (clustersError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, clustersError.message, 500)
      }

      const allNotes = notes ?? []
      const clusters = existingClusters ?? []
      const fullRefresh = clusters.length === 0
      const targetNotes = fullRefresh ? allNotes : allNotes.filter((note) => !note.cluster_id)

      if (targetNotes.length === 0) {
        await clearClusterStaleFlags(service, workshopId)
        return success(await getClustersWithNotes(service, workshopId))
      }

      const response = await clusterNotesWithAI(
        targetNotes.map((note) => ({ id: note.id, content: note.content })),
        fullRefresh ? [] : buildExistingClusterPromptInput(clusters, allNotes),
      )

      const clusterData = await applyClusteringResponse({
        service,
        workshopId,
        response,
        existingClusters: clusters,
        fullRefresh,
      })

      return success(clusterData)
    } catch (clusterError) {
      return error(
        API_ERROR_CODES.INTERNAL_ERROR,
        clusterError instanceof Error ? clusterError.message : 'AI 클러스터링에 실패했습니다.',
        500,
      )
    } finally {
      if (processingStarted) {
        await service
          .from('workshops')
          .update({
            is_processing: false,
            is_processing_since: null,
          })
          .eq('id', workshopId)
      }
    }
  })
}
