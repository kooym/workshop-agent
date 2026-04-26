import type { SupabaseClient } from '@supabase/supabase-js'
import { aggregateVoteResults } from '@/lib/api/votes'
import { propagateStale } from '@/lib/api/stale'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { Database, Tables, TablesInsert } from '@/lib/supabase/types'
import type { Json } from '@/types/common'
import type { DesignResponse } from '@/lib/ai/schemas'
import { getStageIndex, isStageAfter } from '@/lib/workshop/stage'

type ServiceClient = ReturnType<typeof createServiceRoleClient>

export type DesignPayload = {
  design_artifact: Tables<'design_artifacts'> | null
  tasks: Tables<'ax_tasks'>[]
  warnings?: string[]
}

export async function buildDesignInput(service: ServiceClient, workshop: Tables<'workshops'>) {
  const [
    stepsResult,
    edgesResult,
    lanesResult,
    clustersResult,
    notesResult,
    votesResult,
  ] = await Promise.all([
    service.from('process_steps').select('*').eq('workshop_id', workshop.id),
    service.from('process_edges').select('*').eq('workshop_id', workshop.id),
    service.from('process_lanes').select('*').eq('workshop_id', workshop.id),
    service.from('clusters').select('*').eq('workshop_id', workshop.id).order('order_index', { ascending: true }),
    service.from('notes').select('*').eq('workshop_id', workshop.id),
    service.from('votes').select('*').eq('workshop_id', workshop.id),
  ])

  const failure = [
    stepsResult,
    edgesResult,
    lanesResult,
    clustersResult,
    notesResult,
    votesResult,
  ].find((result) => result.error)
  if (failure?.error) {
    throw new Error(failure.error.message)
  }

  const steps = stepsResult.data ?? []
  const edges = edgesResult.data ?? []
  const lanes = lanesResult.data ?? []
  const clusters = clustersResult.data ?? []
  const notes = notesResult.data ?? []
  const votes = votesResult.data ?? []

  if (steps.length === 0) {
    throw new Error('AX 설계에는 AS-IS 프로세스 노드가 필요합니다.')
  }
  if (clusters.length === 0) {
    throw new Error('AX 설계에는 클러스터링 결과가 필요합니다.')
  }

  const laneNames = new Map(lanes.map((lane) => [lane.id, lane.name]))
  const stepNames = new Map(steps.map((step) => [step.id, step.name]))
  const voteResults = aggregateVoteResults({
    voteMode: workshop.settings.vote_mode,
    votes,
    clusters,
    notes,
  })
  const clusterVoteCounts = new Map(
    voteResults
      .filter((result) => result.cluster_id)
      .map((result) => [result.cluster_id as string, result.vote_count]),
  )
  const noteVoteCounts = new Map(
    voteResults
      .filter((result) => result.note_id)
      .map((result) => [result.note_id as string, result.vote_count]),
  )

  return {
    input: {
      process_graph: {
        nodes: steps.map((step) => ({
          id: step.id,
          name: step.name,
          description: step.description,
          node_type: step.node_type,
          lane_name: step.lane_id ? laneNames.get(step.lane_id) ?? null : null,
          duration_info: step.duration_info,
          tools_systems: step.tools_systems,
          volume_info: step.volume_info,
        })),
        edges: edges.map((edge) => ({
          source_node_id: edge.source_node_id,
          target_node_id: edge.target_node_id,
          label: edge.label,
          edge_type: edge.edge_type,
        })),
        lanes: lanes.map((lane) => ({
          id: lane.id,
          name: lane.name,
        })),
      },
      clusters: clusters.map((cluster) => {
        const clusterNotes = notes.filter((note) => note.cluster_id === cluster.id)
        const noteVotes = clusterNotes.reduce(
          (sum, note) => sum + (noteVoteCounts.get(note.id) ?? 0),
          0,
        )
        return {
          id: cluster.id,
          name: cluster.name,
          summary: cluster.summary,
          vote_count:
            workshop.settings.vote_mode === 'cluster'
              ? clusterVoteCounts.get(cluster.id) ?? 0
              : noteVotes,
          notes: clusterNotes.map((note) => ({
            content: note.content,
            process_step_name: note.process_step_id ? stepNames.get(note.process_step_id) ?? null : null,
            vote_count: noteVoteCounts.get(note.id) ?? 0,
          })),
        }
      }),
      vote_mode: workshop.settings.vote_mode,
      workshop_description: workshop.description,
    },
    context: {
      clusterIds: clusters.map((cluster) => cluster.id),
      processStepIds: steps.map((step) => step.id),
    },
  }
}

export async function applyDesignResponse(
  service: ServiceClient,
  workshopId: string,
  response: DesignResponse,
): Promise<DesignPayload> {
  const { data: latest } = await service
    .from('design_artifacts')
    .select('*')
    .eq('workshop_id', workshopId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextVersion = (latest?.version ?? 0) + 1
  const { data: artifact, error: artifactError } = await service
    .from('design_artifacts')
    .insert({
      workshop_id: workshopId,
      tobe_process: response.tobe_process as Json,
      agent_specs: response.agent_specs as Json,
      kpis: response.kpis as Json,
      data_requirements: response.data_requirements as Json,
      org_requirements: response.org_requirements as Json,
      version: nextVersion,
      is_stale: false,
    })
    .select('*')
    .single()

  if (artifactError) {
    throw new Error(artifactError.message)
  }

  const { data: existingTasks, error: existingTasksError } = await service
    .from('ax_tasks')
    .select('*')
    .eq('workshop_id', workshopId)

  if (existingTasksError) {
    throw new Error(existingTasksError.message)
  }

  const existingTitles = new Set((existingTasks ?? []).map((task) => normalizeTitle(task.title)))
  const warnings: string[] = []
  const rows: TablesInsert<'ax_tasks'>[] = []

  response.tasks.forEach((task, index) => {
    if (existingTitles.has(normalizeTitle(task.title))) {
      warnings.push(`유사 과제 유지: ${task.title}`)
      return
    }

    rows.push({
      workshop_id: workshopId,
      design_artifact_id: artifact.id,
      cluster_id: task.cluster_ids[0] ?? null,
      title: task.title,
      description: task.description,
      difficulty: task.difficulty,
      priority: task.priority,
      expected_effect: task.expected_effect,
      pain_points: { cluster_ids: task.cluster_ids } as Json,
      core_features: task.core_features as Json,
      sub_features: task.sub_features as Json,
      order_index: (existingTasks?.length ?? 0) + index,
    })
  })

  if (rows.length) {
    const { error: taskError } = await service.from('ax_tasks').insert(rows)
    if (taskError) {
      throw new Error(taskError.message)
    }
  }

  await service.from('design_artifacts').update({ is_stale: false }).eq('workshop_id', workshopId)

  const { data: tasks, error: tasksError } = await service
    .from('ax_tasks')
    .select('*')
    .eq('workshop_id', workshopId)
    .order('order_index', { ascending: true })

  if (tasksError) {
    throw new Error(tasksError.message)
  }

  return {
    design_artifact: artifact,
    tasks: tasks ?? [],
    warnings: warnings.length ? warnings : undefined,
  }
}

export async function getLatestDesignPayload(
  service: ServiceClient,
  workshopId: string,
): Promise<DesignPayload> {
  const [artifactResult, tasksResult] = await Promise.all([
    service
      .from('design_artifacts')
      .select('*')
      .eq('workshop_id', workshopId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from('ax_tasks')
      .select('*')
      .eq('workshop_id', workshopId)
      .order('order_index', { ascending: true }),
  ])

  if (artifactResult.error) {
    throw new Error(artifactResult.error.message)
  }
  if (tasksResult.error) {
    throw new Error(tasksResult.error.message)
  }

  return {
    design_artifact: artifactResult.data ?? null,
    tasks: tasksResult.data ?? [],
  }
}

export function canEditDesign(workshop: Tables<'workshops'>) {
  return workshop.current_stage === 'design'
}

export async function propagateDesignStaleIfNeeded(
  service: SupabaseClient<Database>,
  workshop: Tables<'workshops'>,
) {
  if (isStageAfter(workshop.current_stage, 'design')) {
    await propagateStale(service, workshop.id, 'design')
  }
}

export function hasReachedDesign(workshop: Tables<'workshops'>) {
  return getStageIndex(workshop.current_stage) >= getStageIndex('design')
}

function normalizeTitle(title: string) {
  return title.trim().toLocaleLowerCase('ko-KR')
}
