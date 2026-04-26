import type { NextRequest } from 'next/server'
import { withAuth, withFacilitator } from '@/lib/api/middleware'
import {
  canEditDesign,
  getLatestDesignPayload,
  hasReachedDesign,
  propagateDesignStaleIfNeeded,
} from '@/lib/api/design'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { designArtifactPatchSchema } from '@/lib/api/validators'
import type { TablesUpdate } from '@/lib/supabase/types'
import type { Json } from '@/types/common'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  return withAuth(
    req,
    async (_request, { service }) => {
      try {
        return success(await getLatestDesignPayload(service, id))
      } catch (designError) {
        return error(
          API_ERROR_CODES.INTERNAL_ERROR,
          designError instanceof Error ? designError.message : '설계 산출물을 불러오지 못했습니다.',
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
  const parsed = designArtifactPatchSchema.safeParse(body)
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '설계 산출물 수정 정보를 확인해주세요.', 400)
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
    if (!hasReachedDesign(workshop)) {
      return error(API_ERROR_CODES.CONFLICT, '설계 단계 이후에만 수정할 수 있습니다.', 409)
    }
    if (!canEditDesign(workshop)) {
      return error(API_ERROR_CODES.FORBIDDEN, '설계 단계에서만 수정할 수 있습니다.', 403)
    }

    const { data: latest, error: latestError } = await service
      .from('design_artifacts')
      .select('*')
      .eq('workshop_id', id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, latestError.message, 500)
    }
    if (!latest) {
      return error(API_ERROR_CODES.NOT_FOUND, '설계 산출물을 찾을 수 없습니다.', 404)
    }

    const patch: TablesUpdate<'design_artifacts'> = {}
    if (parsed.data.tobe_process !== undefined) {
      patch.tobe_process = parsed.data.tobe_process as Json
    }
    if (parsed.data.agent_specs !== undefined) {
      patch.agent_specs = parsed.data.agent_specs as Json
    }
    if (parsed.data.kpis !== undefined) {
      patch.kpis = parsed.data.kpis as Json
    }
    if (parsed.data.data_requirements !== undefined) {
      patch.data_requirements = parsed.data.data_requirements as Json
    }
    if (parsed.data.org_requirements !== undefined) {
      patch.org_requirements = parsed.data.org_requirements as Json
    }

    const { data: updated, error: updateError } = await service
      .from('design_artifacts')
      .update(patch)
      .eq('id', latest.id)
      .select('*')
      .single()

    if (updateError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, updateError.message, 500)
    }

    await propagateDesignStaleIfNeeded(service, workshop)
    return success(updated)
  })
}
