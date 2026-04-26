import { z } from 'zod'

export const clusteringResponseSchema = z.object({
  clusters: z
    .array(
      z.object({
        name: z.string().min(1).max(50),
        summary: z.string().min(1).max(300),
        note_ids: z.array(z.string().uuid()),
      }),
    )
    .min(3)
    .max(8),
})

export type ClusteringResponse = z.infer<typeof clusteringResponseSchema>

export function parseClusteringResponse(raw: string, inputNoteIds: string[]): ClusteringResponse {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error('AI 응답이 JSON 형식이 아닙니다.')
  }

  const response = clusteringResponseSchema.parse(json)
  validateClusteringResponse(inputNoteIds, response)
  return response
}

export function validateClusteringResponse(
  inputNoteIds: string[],
  response: ClusteringResponse,
): void {
  const inputSet = new Set(inputNoteIds)
  const assignedIds = new Set<string>()

  for (const cluster of response.clusters) {
    for (const noteId of cluster.note_ids) {
      if (!inputSet.has(noteId)) {
        throw new Error(`Unknown note_id: ${noteId}`)
      }
      if (assignedIds.has(noteId)) {
        throw new Error(`Duplicate assignment: ${noteId}`)
      }
      assignedIds.add(noteId)
    }
  }

  for (const id of inputNoteIds) {
    if (!assignedIds.has(id)) {
      throw new Error(`Missing note_id: ${id}`)
    }
  }
}

const designGraphNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  automation_type: z.enum(['full', 'assisted', 'human']).optional(),
  agent_name: z.string().max(100).optional().nullable(),
  asis_node_ids: z.array(z.string()).default([]),
})

export const designResponseSchema = z.object({
  tobe_process: z.object({
    mermaid_dsl: z.string().trim().min(1),
    steps: z
      .array(
        z.object({
          name: z.string().min(1).max(100),
          description: z.string().min(1).max(500),
          automation_type: z.enum(['full', 'assisted', 'human']),
          agent_name: z.string().max(100).optional().nullable(),
          asis_step_ids: z.array(z.string()),
        }),
      )
      .min(1),
    graph: z.object({
      nodes: z.array(designGraphNodeSchema).min(1),
      edges: z
        .array(
          z.object({
            id: z.string().optional(),
            source_node_id: z.string(),
            target_node_id: z.string(),
            label: z.string().max(50).optional().nullable(),
            edge_type: z.string().default('sequence'),
          }),
        )
        .default([]),
      lanes: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
          }),
        )
        .default([]),
    }),
  }),
  agent_specs: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        role: z.string().min(1).max(500),
        core_features: z.array(z.string().min(1)).default([]),
        sub_features: z.array(z.string().min(1)).default([]),
        input: z.string().min(1).max(1000),
        output: z.string().min(1).max(1000),
        human_checkpoint: z.string().min(1).max(1000),
      }),
    )
    .min(1),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(100),
        description: z.string().min(1).max(500),
        cluster_ids: z.array(z.string().uuid()).min(1),
        core_features: z.array(z.string().min(1)).default([]),
        sub_features: z.array(z.string().min(1)).default([]),
        difficulty: z.enum(['low', 'medium', 'high']),
        priority: z.enum(['low', 'medium', 'high']).default('medium'),
        expected_effect: z.string().min(1).max(500),
      }),
    )
    .min(1),
  kpis: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        current_value: z.string().min(1).max(200),
        target_value: z.string().min(1).max(200),
        measurement_method: z.string().min(1).max(500),
      }),
    )
    .min(1),
  data_requirements: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        source: z.string().min(1).max(200),
        format: z.string().min(1).max(100),
        volume: z.string().min(1).max(100),
        responsible_team: z.string().min(1).max(100),
      }),
    )
    .min(1),
  org_requirements: z
    .array(
      z.object({
        category: z.enum(['collaboration', 'training', 'governance', 'infrastructure']),
        description: z.string().min(1).max(500),
        priority: z.enum(['high', 'medium', 'low']),
      }),
    )
    .min(1),
})

export type DesignResponse = z.infer<typeof designResponseSchema>

export function parseDesignResponse(raw: string, context: DesignValidationContext): DesignResponse {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error('AI 응답이 JSON 형식이 아닙니다.')
  }

  const response = designResponseSchema.parse(json)
  validateDesignResponse(response, context)
  return response
}

export type DesignValidationContext = {
  clusterIds: string[]
  processStepIds: string[]
}

export function validateDesignResponse(
  response: DesignResponse,
  { clusterIds, processStepIds }: DesignValidationContext,
) {
  const clusterIdSet = new Set(clusterIds)
  const processStepIdSet = new Set(processStepIds)

  response.tasks.forEach((task) => {
    task.cluster_ids.forEach((clusterId) => {
      if (!clusterIdSet.has(clusterId)) {
        throw new Error(`Unknown cluster_id: ${clusterId}`)
      }
    })
  })

  response.tobe_process.steps.forEach((step) => {
    step.asis_step_ids.forEach((stepId) => {
      if (!processStepIdSet.has(stepId)) {
        throw new Error(`Unknown asis_step_id: ${stepId}`)
      }
    })
  })

  response.tobe_process.graph.nodes.forEach((node) => {
    node.asis_node_ids.forEach((stepId) => {
      if (!processStepIdSet.has(stepId)) {
        throw new Error(`Unknown asis_node_id: ${stepId}`)
      }
    })
  })
}
