import type { NextRequest } from 'next/server'
import { withAuth, withFacilitator } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { validateStagePrerequisites } from '@/lib/api/stage'
import { buildWorkshopSummary } from '@/lib/api/summary'
import { workshopPatchSchema } from '@/lib/api/validators'
import type { TablesUpdate } from '@/lib/supabase/types'
import {
  mergeWorkshopSettings,
  validateSettingsPatch,
  validateStageTransition,
} from '@/lib/workshop/stage'
import type { WorkshopSettings } from '@/types/workshop'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  return withAuth(
    req,
    async (_request, { service }) => {
      const { data: workshop, error: workshopError } = await service
        .from('workshops')
        .select('*')
        .eq('id', id)
        .single()

      if (workshopError || !workshop) {
        return error(API_ERROR_CODES.NOT_FOUND, '워크샵을 찾을 수 없습니다.', 404)
      }

      const { data: participants, error: participantsError } = await service
        .from('participants')
        .select('*')
        .eq('workshop_id', id)
        .order('joined_at', { ascending: true })

      if (participantsError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, participantsError.message, 500)
      }

      return success({ workshop, participants })
    },
    { workshopId: id },
  )
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  return withFacilitator(req, async (_request, { service, user }) => {
    const body = await req.json().catch(() => null)
    const parsed = workshopPatchSchema.safeParse(body)
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION_ERROR, '워크샵 수정 정보를 확인해주세요.', 400)
    }

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

    const nextStage = parsed.data.current_stage
    if (workshop.current_stage === 'completed') {
      return error(API_ERROR_CODES.FORBIDDEN, '완료된 워크샵은 수정할 수 없습니다.', 403)
    }

    if (nextStage && nextStage !== workshop.current_stage) {
      const stageError = validateStageTransition(workshop.current_stage, nextStage)
      if (stageError) {
        return error(API_ERROR_CODES.CONFLICT, stageError, 409)
      }

      const prerequisiteError = validateStagePrerequisites(
        workshop.current_stage,
        nextStage,
        await buildWorkshopSummary(service, workshop),
        workshop,
      )
      if (prerequisiteError) {
        return error(API_ERROR_CODES.VALIDATION_ERROR, prerequisiteError, 400)
      }
    }

    const { count: participantCount, error: countError } = await service
      .from('participants')
      .select('id', { count: 'exact', head: true })
      .eq('workshop_id', id)

    if (countError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, countError.message, 500)
    }

    if (parsed.data.settings) {
      const settingsError = validateSettingsPatch(
        workshop.current_stage,
        participantCount ?? 0,
        parsed.data.settings,
      )
      if (settingsError) {
        return error(API_ERROR_CODES.CONFLICT, settingsError, 409)
      }
    }

    const patch: TablesUpdate<'workshops'> = {}
    if (parsed.data.title !== undefined) {
      patch.title = parsed.data.title
    }
    if (parsed.data.description !== undefined) {
      patch.description = parsed.data.description ?? null
    }
    if (nextStage !== undefined) {
      patch.current_stage = nextStage
    }
    if (parsed.data.settings !== undefined) {
      patch.settings = mergeWorkshopSettings(
        workshop.settings as WorkshopSettings,
        parsed.data.settings,
      )
    }
    if (parsed.data.design_step !== undefined) {
      patch.design_step = parsed.data.design_step
    }

    // When transitioning cluster→vote, compute average scores from cluster_scores
    if (nextStage === 'vote' && workshop.current_stage === 'cluster') {
      const { data: clusters } = await service
        .from('clusters')
        .select('id')
        .eq('workshop_id', id)

      if (clusters && clusters.length > 0) {
        for (const cluster of clusters) {
          const { data: scores } = await service
            .from('cluster_scores')
            .select('score_impact, score_feasibility, score_urgency')
            .eq('cluster_id', cluster.id)

          if (scores && scores.length > 0) {
            const avgImpact = Math.round(scores.reduce((s, r) => s + r.score_impact, 0) / scores.length)
            const avgFeasibility = Math.round(scores.reduce((s, r) => s + r.score_feasibility, 0) / scores.length)
            const avgUrgency = Math.round(scores.reduce((s, r) => s + r.score_urgency, 0) / scores.length)

            await service
              .from('clusters')
              .update({
                score_impact: avgImpact,
                score_feasibility: avgFeasibility,
                score_urgency: avgUrgency,
              })
              .eq('id', cluster.id)
          }
        }
      }
    }

    const query = service.from('workshops').update(patch).eq('id', id)
    if (nextStage && nextStage !== workshop.current_stage) {
      query.eq('current_stage', workshop.current_stage)
    }

    const { data: updated, error: updateError } = await query.select('*').maybeSingle()

    if (updateError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, updateError.message, 500)
    }

    if (!updated) {
      return error(API_ERROR_CODES.CONFLICT, '워크샵 단계가 이미 변경되었습니다.', 409)
    }

    return success(updated)
  })
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  return withFacilitator(req, async (_request, { service, user }) => {
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
      return error(API_ERROR_CODES.FORBIDDEN, '워크샵 퍼실리테이터만 삭제할 수 있습니다.', 403)
    }

    const { error: deleteError } = await service.from('workshops').delete().eq('id', id)
    if (deleteError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, deleteError.message, 500)
    }

    return success({ success: true })
  })
}
