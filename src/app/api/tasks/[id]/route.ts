import type { NextRequest } from 'next/server'
import { withFacilitator } from '@/lib/api/middleware'
import { canEditDesign, propagateDesignStaleIfNeeded } from '@/lib/api/design'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { patchTaskSchema } from '@/lib/api/validators'
import type { TablesUpdate } from '@/lib/supabase/types'
import type { Json } from '@/types/common'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const workshopId = req.nextUrl.searchParams.get('workshop_id') ?? req.headers.get('x-workshop-id')
  if (!workshopId) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, 'workshop_id가 필요합니다.', 400)
  }

  const body = await req.json().catch(() => null)
  const parsed = patchTaskSchema.safeParse(body)
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '과제 수정 정보를 확인해주세요.', 400)
  }

  return withFacilitator(req, async (_request, { service, user }) => {
    const authError = await assertCanEditTask(service, workshopId, user.id)
    if (authError) {
      return authError
    }

    const patch: TablesUpdate<'ax_tasks'> = {}
    if (parsed.data.title !== undefined) {
      patch.title = parsed.data.title
    }
    if (parsed.data.description !== undefined) {
      patch.description = parsed.data.description
    }
    if (parsed.data.core_features !== undefined) {
      patch.core_features = parsed.data.core_features as Json
    }
    if (parsed.data.sub_features !== undefined) {
      patch.sub_features = parsed.data.sub_features as Json
    }
    if (parsed.data.priority !== undefined) {
      patch.priority = parsed.data.priority
    }
    if (parsed.data.difficulty !== undefined) {
      patch.difficulty = parsed.data.difficulty
    }

    const { data: updated, error: updateError } = await service
      .from('ax_tasks')
      .update(patch)
      .eq('id', id)
      .eq('workshop_id', workshopId)
      .select('*')
      .maybeSingle()

    if (updateError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, updateError.message, 500)
    }
    if (!updated) {
      return error(API_ERROR_CODES.NOT_FOUND, '과제를 찾을 수 없습니다.', 404)
    }

    return success(updated)
  })
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const workshopId = req.nextUrl.searchParams.get('workshop_id') ?? req.headers.get('x-workshop-id')
  if (!workshopId) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, 'workshop_id가 필요합니다.', 400)
  }

  return withFacilitator(req, async (_request, { service, user }) => {
    const authError = await assertCanEditTask(service, workshopId, user.id)
    if (authError) {
      return authError
    }

    const { error: deleteError } = await service
      .from('ax_tasks')
      .delete()
      .eq('id', id)
      .eq('workshop_id', workshopId)

    if (deleteError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, deleteError.message, 500)
    }

    return success({ success: true })
  })
}

async function assertCanEditTask(
  service: Parameters<Parameters<typeof withFacilitator>[1]>[1]['service'],
  workshopId: string,
  userId: string,
) {
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
  if (workshop.facilitator_id !== userId) {
    return error(API_ERROR_CODES.FORBIDDEN, '워크샵 퍼실리테이터만 수정할 수 있습니다.', 403)
  }
  if (!canEditDesign(workshop)) {
    return error(API_ERROR_CODES.FORBIDDEN, '설계 단계에서만 과제를 수정할 수 있습니다.', 403)
  }

  await propagateDesignStaleIfNeeded(service, workshop)
  return null
}
