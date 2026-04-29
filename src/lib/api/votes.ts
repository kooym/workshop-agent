import { propagateStale } from '@/lib/api/stale'
import type { Tables } from '@/lib/supabase/types'
import { getStageIndex, isStageAfter } from '@/lib/workshop/stage'
import type { VoteResultRow, VoteTargetType } from '@/types/vote'

export function canMutateVotes(workshop: Tables<'workshops'>) {
  return (
    getStageIndex(workshop.current_stage) >= getStageIndex('vote') &&
    workshop.current_stage !== 'completed'
  )
}

export function shouldHideVoteResults(workshop: Tables<'workshops'>) {
  return !workshop.settings.results_visible && workshop.current_stage === 'vote'
}

export function resolveVoteTarget(
  voteMode: VoteTargetType,
  input: { cluster_id?: string | null; note_id?: string | null; task_id?: string | null },
) {
  // Task voting (design stage 2nd round)
  if (input.task_id) {
    return { cluster_id: null, note_id: null, task_id: input.task_id }
  }

  if (voteMode === 'cluster') {
    if (!input.cluster_id || input.note_id) {
      return null
    }
    return { cluster_id: input.cluster_id, note_id: null, task_id: null }
  }

  if (!input.note_id || input.cluster_id) {
    return null
  }
  return { cluster_id: null, note_id: input.note_id, task_id: null }
}

export function aggregateVoteResults({
  voteMode,
  votes,
  clusters,
  notes,
}: {
  voteMode: VoteTargetType
  votes: Tables<'votes'>[]
  clusters: Tables<'clusters'>[]
  notes: Tables<'notes'>[]
}): VoteResultRow[] {
  const counts = new Map<string, number>()

  votes.forEach((vote) => {
    const targetId = voteMode === 'cluster' ? vote.cluster_id : vote.note_id
    if (!targetId) {
      return
    }
    counts.set(targetId, (counts.get(targetId) ?? 0) + 1)
  })

  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0)
  const clusterNames = new Map(clusters.map((cluster) => [cluster.id, cluster.name]))
  const noteNames = new Map(notes.map((note) => [note.id, note.content.slice(0, 30)]))

  return Array.from(counts.entries())
    .map(([targetId, voteCount]) => ({
      target_type: voteMode,
      ...(voteMode === 'cluster' ? { cluster_id: targetId } : { note_id: targetId }),
      target_name:
        voteMode === 'cluster'
          ? clusterNames.get(targetId) ?? '클러스터'
          : noteNames.get(targetId) ?? '포스트잇',
      vote_count: voteCount,
      percentage: total ? Math.round((voteCount / total) * 1000) / 10 : 0,
    }))
    .sort((left, right) => right.vote_count - left.vote_count)
}

export async function propagateVoteStaleIfNeeded(
  service: Parameters<typeof propagateStale>[0],
  workshop: Tables<'workshops'>,
) {
  if (isStageAfter(workshop.current_stage, 'vote')) {
    await propagateStale(service, workshop.id, 'vote')
  }
}
