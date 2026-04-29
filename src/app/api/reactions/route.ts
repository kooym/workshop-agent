import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import {
  createReactionSchema,
  deleteReactionQuerySchema,
  listReactionsQuerySchema,
} from '@/lib/api/validators'

export async function GET(req: NextRequest) {
  const parsed = listReactionsQuerySchema.safeParse({
    workshop_id: req.nextUrl.searchParams.get('workshop_id'),
    task_id: req.nextUrl.searchParams.get('task_id'),
    prd_id: req.nextUrl.searchParams.get('prd_id'),
  })
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '반응 조회 대상을 확인해주세요.', 400)
  }

  return withAuth(
    req,
    async (_request, { service, participant }) => {
      const query = service
        .from('task_reactions')
        .select('*')
        .eq('workshop_id', parsed.data.workshop_id)

      const { data: reactions, error: reactionsError } = parsed.data.task_id
        ? await query.eq('task_id', parsed.data.task_id)
        : await query.eq('prd_id', parsed.data.prd_id ?? '')

      if (reactionsError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, reactionsError.message, 500)
      }

      const rows = reactions ?? []
      return success({
        thumbs_up: rows.filter((reaction) => reaction.reaction_type === '👍').length,
        thinking: rows.filter((reaction) => reaction.reaction_type === '🤔').length,
        my_reaction:
          rows.find((reaction) => reaction.participant_id === participant.id)?.reaction_type ?? null,
        my_reaction_id:
          rows.find((reaction) => reaction.participant_id === participant.id)?.id ?? null,
      })
    },
    { workshopId: parsed.data.workshop_id },
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = createReactionSchema.safeParse(body)
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '반응 정보를 확인해주세요.', 400)
  }

  return withAuth(
    req,
    async (_request, { service, participant }) => {
      const exists = parsed.data.task_id
        ? await targetExists(service, 'ax_tasks', parsed.data.task_id, parsed.data.workshop_id)
        : await targetExists(service, 'prds', parsed.data.prd_id, parsed.data.workshop_id)

      if (!exists) {
        return error(API_ERROR_CODES.NOT_FOUND, '반응 대상을 찾을 수 없습니다.', 404)
      }

      // Check existing reaction for this participant on this target
      const existingQuery = service
        .from('task_reactions')
        .select('*')
        .eq('workshop_id', parsed.data.workshop_id)
        .eq('participant_id', participant.id)

      const { data: existing } = parsed.data.task_id
        ? await existingQuery.eq('task_id', parsed.data.task_id).maybeSingle()
        : await existingQuery.eq('prd_id', parsed.data.prd_id ?? '').maybeSingle()

      if (existing) {
        if (existing.reaction_type === parsed.data.reaction_type) {
          // Same reaction → toggle off (delete)
          await service.from('task_reactions').delete().eq('id', existing.id)
          return success({ success: true, toggled_off: true })
        }
        // Different reaction → delete old, insert new
        await service.from('task_reactions').delete().eq('id', existing.id)
      }

      const { data: reaction, error: reactionError } = await service
        .from('task_reactions')
        .insert({
          workshop_id: parsed.data.workshop_id,
          task_id: parsed.data.task_id ?? null,
          prd_id: parsed.data.prd_id ?? null,
          participant_id: participant.id,
          reaction_type: parsed.data.reaction_type,
        })
        .select('*')
        .single()

      if (reactionError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, reactionError.message, 500)
      }

      return success(reaction, 201)
    },
    { workshopId: parsed.data.workshop_id },
  )
}

export async function DELETE(req: NextRequest) {
  const parsed = deleteReactionQuerySchema.safeParse({
    id: req.nextUrl.searchParams.get('id'),
    workshop_id: req.nextUrl.searchParams.get('workshop_id'),
  })
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '반응 id와 workshop_id가 필요합니다.', 400)
  }

  return withAuth(
    req,
    async (_request, { service, participant }) => {
      const { data: reaction, error: reactionError } = await service
        .from('task_reactions')
        .select('*')
        .eq('id', parsed.data.id)
        .eq('workshop_id', parsed.data.workshop_id)
        .maybeSingle()

      if (reactionError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, reactionError.message, 500)
      }
      if (!reaction) {
        return error(API_ERROR_CODES.NOT_FOUND, '반응을 찾을 수 없습니다.', 404)
      }
      if (reaction.participant_id !== participant.id) {
        return error(API_ERROR_CODES.FORBIDDEN, '본인 반응만 취소할 수 있습니다.', 403)
      }

      const { error: deleteError } = await service.from('task_reactions').delete().eq('id', parsed.data.id)
      if (deleteError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, deleteError.message, 500)
      }

      return success({ success: true })
    },
    { workshopId: parsed.data.workshop_id },
  )
}

async function targetExists(
  service: Parameters<Parameters<typeof withAuth>[1]>[1]['service'],
  table: 'ax_tasks' | 'prds',
  id: string | null | undefined,
  workshopId: string,
) {
  if (!id) {
    return false
  }

  const { data } = await service
    .from(table)
    .select('id')
    .eq('id', id)
    .eq('workshop_id', workshopId)
    .maybeSingle()

  return Boolean(data)
}
