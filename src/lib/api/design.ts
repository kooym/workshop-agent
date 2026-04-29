import type { SupabaseClient } from '@supabase/supabase-js'
import { aggregateVoteResults } from '@/lib/api/votes'
import { propagateStale } from '@/lib/api/stale'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { Database, Tables, TablesInsert } from '@/lib/supabase/types'
import type { Json } from '@/types/common'
import type { SingleDesignAlternative } from '@/lib/ai/schemas'
import type { DesignStepResult } from '@/lib/ai/design'
import { graphToMermaid } from '@/lib/ai/utils'
import { getStageIndex, isStageAfter } from '@/lib/workshop/stage'

type ServiceClient = ReturnType<typeof createServiceRoleClient>

export type DesignPayload = {
  design_artifacts: Tables<'design_artifacts'>[]
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
  alternative: SingleDesignAlternative,
  alternativeIndex: number,
): Promise<DesignPayload> {
  // Find existing artifact for this alternative_index to determine version
  const { data: existingForIndex } = await service
    .from('design_artifacts')
    .select('*')
    .eq('workshop_id', workshopId)
    .eq('alternative_index', alternativeIndex)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextVersion = (existingForIndex?.version ?? 0) + 1

  // Insert single alternative as one row
  const artifactRow = {
    workshop_id: workshopId,
    tobe_process: alternative.tobe_process as Json,
    agent_specs: alternative.agent_specs as Json,
    kpis: alternative.kpis as Json,
    data_requirements: alternative.data_requirements as Json,
    alternative_index: alternativeIndex,
    alternative_name: alternative.name,
    version: nextVersion,
    is_stale: false,
  }

  const { data: artifact, error: artifactError } = await service
    .from('design_artifacts')
    .insert(artifactRow)
    .select('*')
    .single()

  if (artifactError) {
    throw new Error(artifactError.message)
  }

  // Collect tasks from this alternative, deduplicating against existing tasks
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

  for (const task of alternative.tasks) {
    const normalized = normalizeTitle(task.title)
    if (existingTitles.has(normalized)) {
      warnings.push(`유사 과제 유지: ${task.title}`)
      continue
    }
    existingTitles.add(normalized)
    rows.push({
      workshop_id: workshopId,
      design_artifact_id: artifact.id,
      cluster_id: task.cluster_ids[0] ?? null,
      title: task.title,
      description: task.description,
      difficulty: task.difficulty,
      priority: task.priority,
      expected_effect: task.expected_effect,
      kpi_name: task.kpi_name ?? null,
      estimated_value: task.estimated_value ?? null,
      pain_points: { cluster_ids: task.cluster_ids } as Json,
      core_features: task.core_features as Json,
      sub_features: task.sub_features as Json,
      order_index: (existingTasks?.length ?? 0) + rows.length,
    })
  }

  if (rows.length) {
    const { error: taskError } = await service.from('ax_tasks').insert(rows)
    if (taskError) {
      throw new Error(taskError.message)
    }
  }

  await service.from('design_artifacts').update({ is_stale: false }).eq('id', artifact.id)

  // Return all artifacts (latest per alternative_index) + all tasks
  const { data: allArtifacts, error: allArtifactsError } = await service
    .from('design_artifacts')
    .select('*')
    .eq('workshop_id', workshopId)
    .order('alternative_index', { ascending: true })

  if (allArtifactsError) {
    throw new Error(allArtifactsError.message)
  }

  // Keep only the latest version per alternative_index
  const latestByIndex = new Map<number, Tables<'design_artifacts'>>()
  for (const a of allArtifacts) {
    const existing = latestByIndex.get(a.alternative_index)
    if (!existing || a.version > existing.version) {
      latestByIndex.set(a.alternative_index, a)
    }
  }

  const { data: tasks, error: tasksError } = await service
    .from('ax_tasks')
    .select('*')
    .eq('workshop_id', workshopId)
    .order('order_index', { ascending: true })

  if (tasksError) {
    throw new Error(tasksError.message)
  }

  return {
    design_artifacts: Array.from(latestByIndex.values()).sort((a, b) => a.alternative_index - b.alternative_index),
    tasks: tasks ?? [],
    warnings: warnings.length ? warnings : undefined,
  }
}

export async function getLatestDesignPayload(
  service: ServiceClient,
  workshopId: string,
): Promise<DesignPayload> {
  // Fetch all artifacts for the workshop, then keep the latest version per alternative_index
  const [artifactsResult, tasksResult] = await Promise.all([
    service
      .from('design_artifacts')
      .select('*')
      .eq('workshop_id', workshopId)
      .order('alternative_index', { ascending: true }),
    service
      .from('ax_tasks')
      .select('*')
      .eq('workshop_id', workshopId)
      .order('order_index', { ascending: true }),
  ])

  if (artifactsResult.error) {
    throw new Error(artifactsResult.error.message)
  }
  if (tasksResult.error) {
    throw new Error(tasksResult.error.message)
  }

  const allArtifacts = artifactsResult.data ?? []
  const latestByIndex = new Map<number, Tables<'design_artifacts'>>()
  for (const a of allArtifacts) {
    const existing = latestByIndex.get(a.alternative_index)
    if (!existing || a.version > existing.version) {
      latestByIndex.set(a.alternative_index, a)
    }
  }

  return {
    design_artifacts: Array.from(latestByIndex.values()).sort((a, b) => a.alternative_index - b.alternative_index),
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

/** Apply a single design step result to the DB, creating or updating the artifact */
export async function applyDesignStepResult(
  service: ServiceClient,
  workshopId: string,
  stepResult: DesignStepResult,
): Promise<DesignPayload> {
  // Always use alternative_index = 0 (single design, no A/B/C)
  const alternativeIndex = 0

  // Find existing artifact
  const { data: existing } = await service
    .from('design_artifacts')
    .select('*')
    .eq('workshop_id', workshopId)
    .eq('alternative_index', alternativeIndex)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  switch (stepResult.step) {
    case 1: {
      // New step 1 chains: TO-BE process + Agent specs + Tasks
      const { step1, step2, step3 } = stepResult.data
      const graph = step1.tobe_process.graph
      const mermaid_dsl = graphToMermaid(graph.nodes, graph.edges)
      const steps = graph.nodes.map((node) => ({
        name: node.name,
        description: node.description ?? '',
        automation_type: node.automation_type ?? 'human',
        agent_name: node.agent_name ?? null,
        asis_step_ids: node.asis_node_ids,
      }))

      const nextVersion = (existing?.version ?? 0) + 1
      const artifactRow = {
        workshop_id: workshopId,
        tobe_process: { mermaid_dsl, steps, graph } as Json,
        agent_specs: step2.agent_specs as Json,
        kpis: (existing?.kpis ?? []) as Json,
        data_requirements: (existing?.data_requirements ?? []) as Json,
        alternative_index: alternativeIndex,
        alternative_name: step1.name,
        version: nextVersion,
        is_stale: false,
      }
      await service.from('design_artifacts').insert(artifactRow)

      // Insert tasks
      const { data: existingTasks } = await service
        .from('ax_tasks')
        .select('*')
        .eq('workshop_id', workshopId)

      const existingTitles = new Set((existingTasks ?? []).map((t) => normalizeTitle(t.title)))
      const newArtifact = await service
        .from('design_artifacts')
        .select('id')
        .eq('workshop_id', workshopId)
        .eq('version', nextVersion)
        .maybeSingle()

      const rows: TablesInsert<'ax_tasks'>[] = []
      for (const task of step3.tasks) {
        const normalized = normalizeTitle(task.title)
        if (existingTitles.has(normalized)) continue
        existingTitles.add(normalized)
        rows.push({
          workshop_id: workshopId,
          design_artifact_id: newArtifact?.data?.id ?? null,
          cluster_id: task.cluster_ids[0] ?? null,
          title: task.title,
          description: task.description,
          difficulty: task.difficulty,
          priority: task.priority,
          expected_effect: task.expected_effect,
          kpi_name: task.kpi_name ?? null,
          estimated_value: task.estimated_value ?? null,
          pain_points: { cluster_ids: task.cluster_ids } as Json,
          core_features: task.core_features as Json,
          sub_features: task.sub_features as Json,
          order_index: (existingTasks?.length ?? 0) + rows.length,
        })
      }
      if (rows.length) {
        await service.from('ax_tasks').insert(rows)
      }
      break
    }
    case 3: {
      // Final task detail: save expanded task detail to design_artifacts JSONB
      const { finalTask } = stepResult.data

      if (existing) {
        const { error: updateErr } = await service
          .from('design_artifacts')
          .update({
            final_task_detail: finalTask as Json,
            is_stale: false,
          })
          .eq('id', existing.id)
        if (updateErr) throw new Error(`final_task_detail 저장 실패: ${updateErr.message}`)
      } else {
        // Create a minimal artifact to hold the final_task_detail
        await service.from('design_artifacts').insert({
          workshop_id: workshopId,
          tobe_process: {} as Json,
          agent_specs: [] as Json,
          kpis: [] as Json,
          data_requirements: [] as Json,
          final_task_detail: finalTask as Json,
          alternative_index: alternativeIndex,
          alternative_name: finalTask.title,
          version: 1,
          is_stale: false,
        })
      }
      break
    }
    case 4: {
      // Solution canvas: save to design_artifacts
      if (existing) {
        const { error: updateErr } = await service
          .from('design_artifacts')
          .update({
            solution_canvas: stepResult.data.canvas as Json,
            is_stale: false,
          })
          .eq('id', existing.id)
        if (updateErr) throw new Error(`solution_canvas 저장 실패: ${updateErr.message}`)
      }
      break
    }
  }

  // Return updated payload
  return getLatestDesignPayload(service, workshopId)
}

function normalizeTitle(title: string) {
  return title.trim().toLocaleLowerCase('ko-KR')
}
