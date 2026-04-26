import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import {
  ensureProcessGraphEditable,
  propagateContextStaleIfNeeded,
} from '@/lib/api/process-graph'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { processStepPatchSchema } from '@/lib/api/validators'
import type { TablesUpdate } from '@/lib/supabase/types'

type RouteContext = {
  params: Promise<{ id: string; stepId: string }>
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id, stepId } = await context.params

  return withAuth(
    req,
    async (_request, { service, participant }) => {
      const guard = await ensureProcessGraphEditable(service, id, participant.id)
      if (!guard.ok) {
        return guard.response
      }

      const body = await req.json().catch(() => null)
      const parsed = processStepPatchSchema.safeParse(body)
      if (!parsed.success) {
        return error(API_ERROR_CODES.VALIDATION_ERROR, '프로세스 노드 수정 정보를 확인해주세요.', 400)
      }

      const patch: TablesUpdate<'process_steps'> = { ...parsed.data }
      const { data: step, error: stepError } = await service
        .from('process_steps')
        .update(patch)
        .eq('id', stepId)
        .eq('workshop_id', id)
        .select('*')
        .maybeSingle()

      if (stepError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, stepError.message, 500)
      }

      if (!step) {
        return error(API_ERROR_CODES.NOT_FOUND, '프로세스 노드를 찾을 수 없습니다.', 404)
      }

      await propagateContextStaleIfNeeded(service, guard.workshop)
      return success(step)
    },
    { workshopId: id },
  )
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id, stepId } = await context.params

  return withAuth(
    req,
    async (_request, { service, participant }) => {
      const guard = await ensureProcessGraphEditable(service, id, participant.id)
      if (!guard.ok) {
        return guard.response
      }

      const { error: deleteError } = await service
        .from('process_steps')
        .delete()
        .eq('id', stepId)
        .eq('workshop_id', id)

      if (deleteError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, deleteError.message, 500)
      }

      await propagateContextStaleIfNeeded(service, guard.workshop)
      return success({ success: true })
    },
    { workshopId: id },
  )
}
