import type { NextRequest } from 'next/server'
import { withFacilitator } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { z } from 'zod'

const finalizeVoteSchema = z.object({
  winner_task_id: z.string().uuid().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workshopId } = await params
  const body = await req.json().catch(() => null)
  const parsed = finalizeVoteSchema.safeParse(body ?? {})
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '입력을 확인해주세요.', 400)
  }

  return withFacilitator(req, async (_request, { service, user }) => {
    const { data: workshop } = await service
      .from('workshops')
      .select('*')
      .eq('id', workshopId)
      .maybeSingle()

    if (!workshop) {
      return error(API_ERROR_CODES.NOT_FOUND, '워크샵을 찾을 수 없습니다.', 404)
    }
    if (workshop.facilitator_id !== user.id) {
      return error(API_ERROR_CODES.FORBIDDEN, '퍼실리테이터만 투표를 마감할 수 있습니다.', 403)
    }
    if (workshop.current_stage !== 'design') {
      return error(API_ERROR_CODES.CONFLICT, '설계 단계에서만 투표를 마감할 수 있습니다.', 409)
    }

    // Aggregate task votes
    const { data: votes } = await service
      .from('votes')
      .select('task_id')
      .eq('workshop_id', workshopId)
      .not('task_id', 'is', null)

    if (!votes || votes.length === 0) {
      return error(API_ERROR_CODES.VALIDATION_ERROR, '투표 결과가 없습니다.', 400)
    }

    // Count votes per task
    const voteCounts = new Map<string, number>()
    for (const v of votes) {
      if (v.task_id) {
        voteCounts.set(v.task_id, (voteCounts.get(v.task_id) ?? 0) + 1)
      }
    }

    const maxVotes = Math.max(...voteCounts.values())
    const topTasks = [...voteCounts.entries()]
      .filter(([, count]) => count === maxVotes)
      .map(([taskId]) => taskId)

    let winnerId: string

    if (topTasks.length === 1) {
      // Clear winner
      winnerId = topTasks[0]
    } else if (parsed.data.winner_task_id) {
      // Tie-breaking by facilitator
      if (!topTasks.includes(parsed.data.winner_task_id)) {
        return error(API_ERROR_CODES.VALIDATION_ERROR, '선택한 과제가 동점 과제 목록에 없습니다.', 400)
      }
      winnerId = parsed.data.winner_task_id
    } else {
      // Tie — return 409 with tied task IDs
      return error(API_ERROR_CODES.CONFLICT, JSON.stringify({
        message: '동점 과제가 있습니다. 1개를 선택해주세요.',
        tied_task_ids: topTasks,
        vote_count: maxVotes,
      }), 409)
    }

    // Set winner as is_selected=true, all others is_selected=false
    await service
      .from('ax_tasks')
      .update({ is_selected: false })
      .eq('workshop_id', workshopId)
      .eq('is_bundle', false)

    await service
      .from('ax_tasks')
      .update({ is_selected: true })
      .eq('id', winnerId)

    // Advance design_step to 2
    await service
      .from('workshops')
      .update({ design_step: 2 })
      .eq('id', workshopId)

    // Return the winner task
    const { data: winnerTask } = await service
      .from('ax_tasks')
      .select('*')
      .eq('id', winnerId)
      .single()

    return success({
      winner: winnerTask,
      vote_counts: Object.fromEntries(voteCounts),
    })
  })
}
