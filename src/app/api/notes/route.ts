import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { ensureGatherStage, validateProcessStep } from '@/lib/api/notes'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { createNoteSchema, listNotesQuerySchema } from '@/lib/api/validators'

export async function GET(req: NextRequest) {
  const parsed = listNotesQuerySchema.safeParse({
    workshop_id: req.nextUrl.searchParams.get('workshop_id'),
  })
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, 'workshop_id가 필요합니다.', 400)
  }

  return withAuth(
    req,
    async (_request, { service }) => {
      const { data: notes, error: notesError } = await service
        .from('notes')
        .select('*')
        .eq('workshop_id', parsed.data.workshop_id)
        .order('created_at', { ascending: true })

      if (notesError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, notesError.message, 500)
      }

      return success(notes)
    },
    { workshopId: parsed.data.workshop_id },
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = createNoteSchema.safeParse(body)
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '포스트잇 정보를 확인해주세요.', 400)
  }

  return withAuth(
    req,
    async (_request, { service, participant }) => {
      const stage = await ensureGatherStage(service, parsed.data.workshop_id)
      if (!stage.ok) {
        return stage.response
      }

      const isValidStep = await validateProcessStep(
        service,
        parsed.data.workshop_id,
        parsed.data.process_step_id,
      )
      if (!isValidStep) {
        return error(API_ERROR_CODES.VALIDATION_ERROR, '연결할 프로세스 노드를 찾을 수 없습니다.', 400)
      }

      const { count, error: countError } = await service
        .from('notes')
        .select('id', { count: 'exact', head: true })
        .eq('workshop_id', parsed.data.workshop_id)

      if (countError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, countError.message, 500)
      }

      if ((count ?? 0) >= 200) {
        return error(API_ERROR_CODES.NOTE_LIMIT, '포스트잇은 최대 200개까지 작성할 수 있습니다.', 409)
      }

      const { data: note, error: noteError } = await service
        .from('notes')
        .insert({
          id: parsed.data.id,
          workshop_id: parsed.data.workshop_id,
          participant_id: participant.id,
          content: parsed.data.content,
          color: parsed.data.color,
          position_x: parsed.data.position_x,
          position_y: parsed.data.position_y,
          process_step_id: parsed.data.process_step_id ?? null,
        })
        .select('*')
        .single()

      if (noteError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, noteError.message, 500)
      }

      return success(note, 201)
    },
    { workshopId: parsed.data.workshop_id },
  )
}
