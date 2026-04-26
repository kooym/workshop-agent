import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import {
  canDeleteNote,
  canModifyNote,
  ensureGatherStage,
  validateProcessStep,
} from '@/lib/api/notes'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { patchNoteSchema } from '@/lib/api/validators'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const body = await req.json().catch(() => null)
  const parsed = patchNoteSchema.safeParse(body)
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '포스트잇 수정 정보를 확인해주세요.', 400)
  }

  const workshopId = req.nextUrl.searchParams.get('workshop_id') ?? req.headers.get('x-workshop-id')
  if (!workshopId) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, 'workshop_id가 필요합니다.', 400)
  }

  return withAuth(
    req,
    async (_request, { service, participant }) => {
      const { data: note, error: noteError } = await service
        .from('notes')
        .select('*')
        .eq('id', id)
        .eq('workshop_id', workshopId)
        .maybeSingle()

      if (noteError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, noteError.message, 500)
      }

      if (!note) {
        return error(API_ERROR_CODES.NOT_FOUND, '포스트잇을 찾을 수 없습니다.', 404)
      }

      if (!canModifyNote(note, participant)) {
        return error(API_ERROR_CODES.FORBIDDEN, '작성자만 포스트잇을 수정할 수 있습니다.', 403)
      }

      const stage = await ensureGatherStage(service, workshopId)
      if (!stage.ok) {
        return stage.response
      }

      const isValidStep = await validateProcessStep(service, workshopId, parsed.data.process_step_id)
      if (!isValidStep) {
        return error(API_ERROR_CODES.VALIDATION_ERROR, '연결할 프로세스 노드를 찾을 수 없습니다.', 400)
      }

      const { data: updated, error: updateError } = await service
        .from('notes')
        .update(parsed.data)
        .eq('id', id)
        .eq('workshop_id', workshopId)
        .select('*')
        .single()

      if (updateError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, updateError.message, 500)
      }

      return success(updated)
    },
    { workshopId },
  )
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const workshopId = req.nextUrl.searchParams.get('workshop_id') ?? req.headers.get('x-workshop-id')
  if (!workshopId) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, 'workshop_id가 필요합니다.', 400)
  }

  return withAuth(
    req,
    async (_request, contextValue) => {
      const { service, participant } = contextValue
      const { data: note, error: noteError } = await service
        .from('notes')
        .select('*')
        .eq('id', id)
        .eq('workshop_id', workshopId)
        .maybeSingle()

      if (noteError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, noteError.message, 500)
      }

      if (!note) {
        return error(API_ERROR_CODES.NOT_FOUND, '포스트잇을 찾을 수 없습니다.', 404)
      }

      if (!canDeleteNote(note, participant, contextValue.actor)) {
        return error(API_ERROR_CODES.FORBIDDEN, '작성자 또는 퍼실리테이터만 삭제할 수 있습니다.', 403)
      }

      const stage = await ensureGatherStage(service, workshopId)
      if (!stage.ok) {
        return stage.response
      }

      const { error: deleteError } = await service
        .from('notes')
        .delete()
        .eq('id', id)
        .eq('workshop_id', workshopId)

      if (deleteError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, deleteError.message, 500)
      }

      return success({ success: true })
    },
    { workshopId },
  )
}
