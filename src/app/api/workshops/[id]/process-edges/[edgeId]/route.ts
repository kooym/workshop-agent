import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import {
  ensureProcessGraphEditable,
  propagateContextStaleIfNeeded,
} from '@/lib/api/process-graph'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { processEdgePatchSchema } from '@/lib/api/validators'

type RouteContext = {
  params: Promise<{ id: string; edgeId: string }>
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id, edgeId } = await context.params

  return withAuth(
    req,
    async (_request, { service, participant }) => {
      const guard = await ensureProcessGraphEditable(service, id, participant.id)
      if (!guard.ok) {
        return guard.response
      }

      const body = await req.json().catch(() => null)
      const parsed = processEdgePatchSchema.safeParse(body)
      if (!parsed.success) {
        return error(API_ERROR_CODES.VALIDATION_ERROR, '프로세스 간선 수정 정보를 확인해주세요.', 400)
      }

      const { data: edge, error: edgeError } = await service
        .from('process_edges')
        .update(parsed.data)
        .eq('id', edgeId)
        .eq('workshop_id', id)
        .select('*')
        .maybeSingle()

      if (edgeError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, edgeError.message, 500)
      }

      if (!edge) {
        return error(API_ERROR_CODES.NOT_FOUND, '프로세스 간선을 찾을 수 없습니다.', 404)
      }

      await propagateContextStaleIfNeeded(service, guard.workshop)
      return success(edge)
    },
    { workshopId: id },
  )
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id, edgeId } = await context.params

  return withAuth(
    req,
    async (_request, { service, participant }) => {
      const guard = await ensureProcessGraphEditable(service, id, participant.id)
      if (!guard.ok) {
        return guard.response
      }

      const { error: deleteError } = await service
        .from('process_edges')
        .delete()
        .eq('id', edgeId)
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
