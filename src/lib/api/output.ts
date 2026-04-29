import { aggregateVoteResults } from '@/lib/api/votes'
import { propagateStale } from '@/lib/api/stale'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/types'
import { isStageAfter } from '@/lib/workshop/stage'

type ServiceClient = ReturnType<typeof createServiceRoleClient>

// Strip DB metadata fields that waste AI tokens
function stripMeta<T extends Record<string, unknown>>(
  row: T,
  extraKeys: string[] = [],
): Omit<T, 'created_at' | 'updated_at' | 'workshop_id' | 'is_stale'> {
  const keys = ['created_at', 'updated_at', 'workshop_id', 'is_stale', ...extraKeys]
  const result = { ...row }
  for (const key of keys) {
    delete (result as Record<string, unknown>)[key]
  }
  return result as Omit<T, 'created_at' | 'updated_at' | 'workshop_id' | 'is_stale'>
}

export async function buildPrdInput(service: ServiceClient, workshop: Tables<'workshops'>) {
  const [tasksResult, artifactResult, clustersResult, notesResult, votesResult] = await Promise.all([
    service
      .from('ax_tasks')
      .select('*')
      .eq('workshop_id', workshop.id)
      .eq('is_selected', true)
      .order('order_index', { ascending: true }),
    service
      .from('design_artifacts')
      .select('*')
      .eq('workshop_id', workshop.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    service.from('clusters').select('*').eq('workshop_id', workshop.id).order('order_index', { ascending: true }),
    service.from('notes').select('*').eq('workshop_id', workshop.id),
    service.from('votes').select('*').eq('workshop_id', workshop.id),
  ])

  const failure = [tasksResult, artifactResult, clustersResult, notesResult, votesResult].find(
    (result) => result.error,
  )
  if (failure?.error) {
    throw new Error(failure.error.message)
  }

  const tasks = tasksResult.data ?? []
  const designArtifact = artifactResult.data ?? null
  const clusters = clustersResult.data ?? []
  const notes = notesResult.data ?? []
  const votes = votesResult.data ?? []

  if (!tasks.length) {
    throw new Error('PRD를 생성할 AX 과제가 없습니다.')
  }
  if (!designArtifact) {
    throw new Error('PRD를 생성할 AX 설계 산출물이 없습니다.')
  }

  return {
    workshop_title: workshop.title,
    tasks: tasks.map((t) => stripMeta(t)),
    design_artifacts: stripMeta(designArtifact),
    clusters: clusters.map((c) => stripMeta(c)),
    vote_results: aggregateVoteResults({
      voteMode: workshop.settings.vote_mode,
      votes,
      clusters,
      notes,
    }),
  }
}

export async function buildReportInput(service: ServiceClient, workshop: Tables<'workshops'>) {
  const [
    stepsResult,
    edgesResult,
    lanesResult,
    clustersResult,
    notesResult,
    votesResult,
    participantsResult,
    artifactResult,
    tasksResult,
    prdResult,
  ] = await Promise.all([
    service.from('process_steps').select('*').eq('workshop_id', workshop.id),
    service.from('process_edges').select('*').eq('workshop_id', workshop.id),
    service.from('process_lanes').select('*').eq('workshop_id', workshop.id),
    service.from('clusters').select('*').eq('workshop_id', workshop.id).order('order_index', { ascending: true }),
    service.from('notes').select('*').eq('workshop_id', workshop.id),
    service.from('votes').select('*').eq('workshop_id', workshop.id),
    service.from('participants').select('*').eq('workshop_id', workshop.id),
    service
      .from('design_artifacts')
      .select('*')
      .eq('workshop_id', workshop.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from('ax_tasks')
      .select('*')
      .eq('workshop_id', workshop.id)
      .order('order_index', { ascending: true }),
    service
      .from('prds')
      .select('*')
      .eq('workshop_id', workshop.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const failure = [
    stepsResult,
    edgesResult,
    lanesResult,
    clustersResult,
    notesResult,
    votesResult,
    participantsResult,
    artifactResult,
    tasksResult,
    prdResult,
  ].find((result) => result.error)
  if (failure?.error) {
    throw new Error(failure.error.message)
  }

  const clusters = clustersResult.data ?? []
  const notes = notesResult.data ?? []
  const votes = votesResult.data ?? []
  const designArtifact = artifactResult.data ?? null
  const prd = prdResult.data ?? null

  if (!designArtifact) {
    throw new Error('보고서를 생성할 AX 설계 산출물이 없습니다.')
  }
  if (!prd) {
    throw new Error('보고서를 생성할 PRD가 없습니다.')
  }

  return {
    workshop_title: workshop.title,
    workshop_description: workshop.description,
    process_graph: {
      nodes: (stepsResult.data ?? []).map((n) => ({ id: n.id, node_type: n.node_type, name: n.name, lane_id: n.lane_id })),
      edges: (edgesResult.data ?? []).map((e) => ({ id: e.id, source_node_id: e.source_node_id, target_node_id: e.target_node_id, label: e.label })),
      lanes: (lanesResult.data ?? []).map((l) => ({ id: l.id, name: l.name })),
    },
    clusters: clusters.map((c) => ({ id: c.id, name: c.name, summary: c.summary })),
    vote_results: aggregateVoteResults({
      voteMode: workshop.settings.vote_mode,
      votes,
      clusters,
      notes,
    }),
    design_artifacts: {
      tobe_process: designArtifact.tobe_process,
      agent_specs: (designArtifact.agent_specs as unknown[])?.slice(0, 10),
    },
    tasks: (tasksResult.data ?? []).map((t) => ({ id: t.id, title: t.title, description: t.description, priority: t.priority })),
    prd_summary: prd.content.slice(0, 3000),
    stats: {
      participant_count: (participantsResult.data ?? []).length,
      note_count: notes.length,
      cluster_count: clusters.length,
      vote_count: votes.length,
    },
  }
}

export async function insertVersionedPrd(
  service: ServiceClient,
  workshopId: string,
  content: string,
): Promise<Tables<'prds'>> {
  const latest = await getLatestPrd(service, workshopId)
  const { data: prd, error } = await service
    .from('prds')
    .insert({
      workshop_id: workshopId,
      content,
      version: (latest?.version ?? 0) + 1,
      is_stale: false,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await service.from('prds').update({ is_stale: false }).eq('workshop_id', workshopId)
  return prd
}

export async function insertVersionedReport(
  service: ServiceClient,
  workshopId: string,
  content: string,
): Promise<Tables<'ax_reports'>> {
  const latest = await getLatestReport(service, workshopId)
  const { data: report, error } = await service
    .from('ax_reports')
    .insert({
      workshop_id: workshopId,
      content,
      version: (latest?.version ?? 0) + 1,
      is_stale: false,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await service.from('ax_reports').update({ is_stale: false }).eq('workshop_id', workshopId)
  return report
}

export async function getLatestPrd(service: ServiceClient, workshopId: string) {
  const { data, error } = await service
    .from('prds')
    .select('*')
    .eq('workshop_id', workshopId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ?? null
}

export async function getLatestReport(service: ServiceClient, workshopId: string) {
  const { data, error } = await service
    .from('ax_reports')
    .select('*')
    .eq('workshop_id', workshopId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ?? null
}

export async function propagatePrdStaleIfNeeded(service: ServiceClient, workshop: Tables<'workshops'>) {
  if (isStageAfter(workshop.current_stage, 'generate')) {
    await propagateStale(service, workshop.id, 'generate')
  }
}
