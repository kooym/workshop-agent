import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'

type RouteContext = {
  params: Promise<{ id: string; lockId: string }>
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id, lockId } = await context.params

  return withAuth(
    req,
    async (_request, contextValue) => {
      const { service, participant } = contextValue
      const { data: lock, error: lockError } = await service
        .from('editing_locks')
        .select('*')
        .eq('id', lockId)
        .eq('workshop_id', id)
        .maybeSingle()

      if (lockError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, lockError.message, 500)
      }

      if (!lock) {
        return error(API_ERROR_CODES.NOT_FOUND, '편집 잠금을 찾을 수 없습니다.', 404)
      }

      if (contextValue.actor !== 'facilitator' && lock.editor_id !== participant.id) {
        return error(API_ERROR_CODES.FORBIDDEN, '잠금 소유자만 해제할 수 있습니다.', 403)
      }

      const { error: deleteError } = await service
        .from('editing_locks')
        .delete()
        .eq('id', lockId)
        .eq('workshop_id', id)

      if (deleteError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, deleteError.message, 500)
      }

      return success({ success: true })
    },
    { workshopId: id },
  )
}
