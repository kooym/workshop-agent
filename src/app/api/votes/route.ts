import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { createVoteSchema, deleteVoteQuerySchema, listVotesQuerySchema } from '@/lib/api/validators'
import {
  canMutateVotes,
  propagateVoteStaleIfNeeded,
  resolveVoteTarget,
  shouldHideVoteResults,
} from '@/lib/api/votes'

export async function GET(req: NextRequest) {
  const parsed = listVotesQuerySchema.safeParse({
    workshop_id: req.nextUrl.searchParams.get('workshop_id'),
  })
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, 'workshop_id가 필요합니다.', 400)
  }

  return withAuth(
    req,
    async (_request, { service, participant }) => {
      const { data: workshop, error: workshopError } = await service
        .from('workshops')
        .select('*')
        .eq('id', parsed.data.workshop_id)
        .single()

      if (workshopError || !workshop) {
        return error(API_ERROR_CODES.NOT_FOUND, '워크샵을 찾을 수 없습니다.', 404)
      }

      const { data: myVotes, error: myVotesError } = await service
        .from('votes')
        .select('*')
        .eq('workshop_id', parsed.data.workshop_id)
        .eq('participant_id', participant.id)

      if (myVotesError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, myVotesError.message, 500)
      }

      const visible = !shouldHideVoteResults(workshop)
      const { data: votes, error: votesError } = visible
        ? await service.from('votes').select('*').eq('workshop_id', parsed.data.workshop_id)
        : { data: [], error: null }

      if (votesError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, votesError.message, 500)
      }

      return success({
        votes: votes ?? [],
        my_votes: myVotes ?? [],
        visible,
        votes_per_person: workshop.settings.votes_per_person,
      })
    },
    { workshopId: parsed.data.workshop_id },
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = createVoteSchema.safeParse(body)
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '투표 대상을 확인해주세요.', 400)
  }

  return withAuth(
    req,
    async (_request, { service, participant }) => {
      const { data: workshop, error: workshopError } = await service
        .from('workshops')
        .select('*')
        .eq('id', parsed.data.workshop_id)
        .single()

      if (workshopError || !workshop) {
        return error(API_ERROR_CODES.NOT_FOUND, '워크샵을 찾을 수 없습니다.', 404)
      }
      if (!canMutateVotes(workshop)) {
        return error(API_ERROR_CODES.CONFLICT, '투표할 수 없는 단계입니다.', 409)
      }

      const target = resolveVoteTarget(workshop.settings.vote_mode, parsed.data)
      if (!target) {
        return error(API_ERROR_CODES.VALIDATION_ERROR, '투표 대상을 확인해주세요.', 400)
      }

      // Validate target exists
      if (target.task_id) {
        const taskExists = await existsInWorkshop(service, 'ax_tasks', target.task_id, parsed.data.workshop_id)
        if (!taskExists) {
          return error(API_ERROR_CODES.NOT_FOUND, '투표 대상을 찾을 수 없습니다.', 404)
        }
      } else {
        const targetExists = target.cluster_id
          ? await existsInWorkshop(service, 'clusters', target.cluster_id, parsed.data.workshop_id)
          : await existsInWorkshop(service, 'notes', target.note_id, parsed.data.workshop_id)
        if (!targetExists) {
          return error(API_ERROR_CODES.NOT_FOUND, '투표 대상을 찾을 수 없습니다.', 404)
        }
      }

      // Task votes have a separate budget — skip votes_per_person limit for task votes
      if (!target.task_id) {
        const { count, error: countError } = await service
          .from('votes')
          .select('id', { count: 'exact', head: true })
          .eq('workshop_id', parsed.data.workshop_id)
          .eq('participant_id', participant.id)
          .is('task_id', null)

        if (countError) {
          return error(API_ERROR_CODES.INTERNAL_ERROR, countError.message, 500)
        }
        if ((count ?? 0) >= workshop.settings.votes_per_person) {
          return error(API_ERROR_CODES.VOTE_LIMIT, '사용 가능한 투표 수를 모두 사용했습니다.', 409)
        }
      }

      const duplicateQuery = service
        .from('votes')
        .select('id')
        .eq('workshop_id', parsed.data.workshop_id)
        .eq('participant_id', participant.id)

      const { data: duplicate } = target.task_id
        ? await duplicateQuery.eq('task_id', target.task_id).maybeSingle()
        : target.cluster_id
          ? await duplicateQuery.eq('cluster_id', target.cluster_id).maybeSingle()
          : await duplicateQuery.eq('note_id', target.note_id ?? '').maybeSingle()

      if (duplicate) {
        return error(API_ERROR_CODES.CONFLICT, '이미 투표한 대상입니다.', 409)
      }

      const { data: vote, error: voteError } = await service
        .from('votes')
        .insert({
          workshop_id: parsed.data.workshop_id,
          participant_id: participant.id,
          cluster_id: target.cluster_id,
          note_id: target.note_id,
          task_id: target.task_id,
        })
        .select('*')
        .single()

      if (voteError) {
        return error(API_ERROR_CODES.CONFLICT, '이미 투표한 대상입니다.', 409)
      }

      await propagateVoteStaleIfNeeded(service, workshop)
      return success(vote, 201)
    },
    { workshopId: parsed.data.workshop_id },
  )
}

export async function DELETE(req: NextRequest) {
  const parsed = deleteVoteQuerySchema.safeParse({
    id: req.nextUrl.searchParams.get('id') ?? undefined,
    workshop_id: req.nextUrl.searchParams.get('workshop_id'),
    task_id: req.nextUrl.searchParams.get('task_id') ?? undefined,
  })
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '투표 id 또는 task_id와 workshop_id가 필요합니다.', 400)
  }

  return withAuth(
    req,
    async (_request, { service, participant }) => {
      const { data: workshop, error: workshopError } = await service
        .from('workshops')
        .select('*')
        .eq('id', parsed.data.workshop_id)
        .single()

      if (workshopError || !workshop) {
        return error(API_ERROR_CODES.NOT_FOUND, '워크샵을 찾을 수 없습니다.', 404)
      }
      if (!canMutateVotes(workshop)) {
        return error(API_ERROR_CODES.CONFLICT, '투표를 취소할 수 없는 단계입니다.', 409)
      }

      // Delete by task_id (for task voting in design stage)
      if (parsed.data.task_id) {
        const { error: deleteError } = await service
          .from('votes')
          .delete()
          .eq('workshop_id', parsed.data.workshop_id)
          .eq('participant_id', participant.id)
          .eq('task_id', parsed.data.task_id)
        if (deleteError) {
          return error(API_ERROR_CODES.INTERNAL_ERROR, deleteError.message, 500)
        }
        await propagateVoteStaleIfNeeded(service, workshop)
        return success({ success: true })
      }

      // Delete by vote id
      const { data: vote, error: voteError } = await service
        .from('votes')
        .select('*')
        .eq('id', parsed.data.id!)
        .eq('workshop_id', parsed.data.workshop_id)
        .maybeSingle()

      if (voteError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, voteError.message, 500)
      }
      if (!vote) {
        return error(API_ERROR_CODES.NOT_FOUND, '투표를 찾을 수 없습니다.', 404)
      }
      if (vote.participant_id !== participant.id) {
        return error(API_ERROR_CODES.FORBIDDEN, '본인 투표만 취소할 수 있습니다.', 403)
      }

      const { error: deleteError } = await service.from('votes').delete().eq('id', parsed.data.id!)
      if (deleteError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, deleteError.message, 500)
      }

      await propagateVoteStaleIfNeeded(service, workshop)
      return success({ success: true })
    },
    { workshopId: parsed.data.workshop_id },
  )
}

async function existsInWorkshop(
  service: Parameters<Parameters<typeof withAuth>[1]>[1]['service'],
  table: 'clusters' | 'notes' | 'ax_tasks',
  id: string | null,
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
