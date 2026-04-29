import { aggregateVoteResults } from '@/lib/api/votes'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/types'

type ServiceClient = ReturnType<typeof createServiceRoleClient>

export type WorkshopSummary = Awaited<ReturnType<typeof buildWorkshopSummary>>

export async function buildWorkshopSummary(
  service: ServiceClient,
  workshop: Tables<'workshops'>,
  participantId?: string,
) {
  const [
    stepsResult,
    lanesResult,
    notesResult,
    clustersResult,
    votesResult,
    participantsResult,
    artifactResult,
    tasksResult,
    prdResult,
    reportResult,
  ] = await Promise.all([
    service.from('process_steps').select('*').eq('workshop_id', workshop.id),
    service.from('process_lanes').select('*').eq('workshop_id', workshop.id),
    service.from('notes').select('*').eq('workshop_id', workshop.id),
    service.from('clusters').select('*').eq('workshop_id', workshop.id),
    service.from('votes').select('*').eq('workshop_id', workshop.id),
    service.from('participants').select('*').eq('workshop_id', workshop.id),
    service
      .from('design_artifacts')
      .select('*')
      .eq('workshop_id', workshop.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    service.from('ax_tasks').select('*').eq('workshop_id', workshop.id),
    service
      .from('prds')
      .select('*')
      .eq('workshop_id', workshop.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from('ax_reports')
      .select('*')
      .eq('workshop_id', workshop.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const failure = [
    stepsResult,
    lanesResult,
    notesResult,
    clustersResult,
    votesResult,
    participantsResult,
    artifactResult,
    tasksResult,
    prdResult,
    reportResult,
  ].find((result) => result.error)
  if (failure?.error) {
    throw new Error(failure.error.message)
  }

  const processSteps = stepsResult.data ?? []
  const notes = notesResult.data ?? []
  const clusters = clustersResult.data ?? []
  const votes = votesResult.data ?? []
  const participants = participantsResult.data ?? []
  const tasks = tasksResult.data ?? []
  const designArtifact = artifactResult.data ?? null
  const prd = prdResult.data ?? null
  const report = reportResult.data ?? null
  const voteResults = aggregateVoteResults({
    voteMode: workshop.settings.vote_mode,
    votes,
    clusters,
    notes,
  })
  const topClusterId = voteResults.find((result) => result.cluster_id)?.cluster_id ?? null

  return {
    counts: {
      process_steps: processSteps.length,
      process_lanes: (lanesResult.data ?? []).length,
      notes: notes.length,
      clusters: clusters.length,
      votes: votes.length,
      participants: participants.length,
      voted_participants: new Set(votes.map((vote) => vote.participant_id)).size,
      tasks: tasks.length,
    },
    has_start_event: processSteps.some((step) => step.node_type === 'start_event'),
    has_end_event: processSteps.some((step) => step.node_type === 'end_event'),
    latest_versions: {
      design_artifact: designArtifact?.version ?? null,
      prd: prd?.version ?? null,
      report: report?.version ?? null,
    },
    stale: {
      clusters: clusters.some((cluster) => cluster.is_stale),
      design_artifacts: Boolean(designArtifact?.is_stale),
      prds: Boolean(prd?.is_stale),
      ax_reports: Boolean(report?.is_stale),
    },
    contribution: participantId
      ? {
          my_notes: notes.filter((note) => note.participant_id === participantId).length,
          my_votes: votes.filter((vote) => vote.participant_id === participantId).length,
          my_notes_in_top_cluster: topClusterId
            ? notes.filter((note) => note.participant_id === participantId && note.cluster_id === topClusterId).length
            : 0,
        }
      : null,
  }
}
