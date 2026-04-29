import { z } from 'zod'

export const clusteringResponseSchema = z.object({
  clusters: z
    .array(
      z.object({
        name: z.string().min(1).max(50),
        summary: z.string().min(1).max(200),
        rationale: z.string().max(200).optional(),
        note_ids: z.array(z.string().uuid()),
      }),
    )
    .min(3)
    .max(5),
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
          description: z.string().max(500).default(''),
          automation_type: z.enum(['full', 'assisted', 'human']).default('human'),
          agent_name: z.string().max(100).optional().nullable(),
          asis_step_ids: z.array(z.string()).default([]),
        }),
      )
      .min(1),
    graph: z.object({
      nodes: z.array(designGraphNodeSchema).min(1),
      edges: z
        .array(
          z.object({
            id: z.string().optional(),
            source_node_id: z.string().default(''),
            target_node_id: z.string().default(''),
            source: z.string().optional(),
            target: z.string().optional(),
            label: z.string().max(50).optional().nullable(),
            edge_type: z.string().default('sequence'),
          }).transform((e) => ({
            ...e,
            source_node_id: e.source_node_id || e.source || '',
            target_node_id: e.target_node_id || e.target || '',
          })),
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
        role: z.string().max(500).default(''),
        core_features: z.array(z.string().min(1)).default([]),
        sub_features: z.array(z.string().min(1)).default([]),
        input: z.string().max(1000).default(''),
        output: z.string().max(1000).default(''),
        human_checkpoint: z.string().max(1000).default(''),
      }),
    )
    .min(1),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(100),
        description: z.string().max(500).default(''),
        cluster_ids: z.array(z.string()).default([]),
        core_features: z.array(z.string().min(1)).default([]),
        sub_features: z.array(z.string().min(1)).default([]),
        difficulty: z.enum(['low', 'medium', 'high']).default('medium'),
        priority: z.enum(['low', 'medium', 'high']).default('medium'),
        expected_effect: z.string().max(500).default(''),
        kpi_name: z.string().max(100).optional().nullable(),
        estimated_value: z.string().max(200).optional().nullable(),
      }),
    )
    .min(1),
  kpis: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        current_value: z.string().max(200).default(''),
        target_value: z.string().max(200).default(''),
        measurement_method: z.string().max(500).default(''),
      }),
    )
    .default([]),
  data_requirements: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        source: z.string().max(200).default(''),
        format: z.string().max(100).default(''),
        volume: z.string().max(100).default(''),
        responsible_team: z.string().max(100).default(''),
      }),
    )
    .default([]),
})

export type DesignResponse = z.infer<typeof designResponseSchema>

/** Schema for a single design alternative with name + strategy */
export const singleDesignAlternativeSchema = z
  .object({
    name: z.string().min(1).max(50),
    strategy: z.string().min(1).max(200),
  })
  .and(designResponseSchema)

export type SingleDesignAlternative = z.infer<typeof singleDesignAlternativeSchema>

/** Phase 1: Core design — name, strategy, tobe_process, agent_specs */
export const designPhase1Schema = z.object({
  name: z.string().min(1).max(50),
  strategy: z.string().min(1).max(200),
  tobe_process: designResponseSchema.shape.tobe_process,
  agent_specs: designResponseSchema.shape.agent_specs,
})

export type DesignPhase1 = z.infer<typeof designPhase1Schema>

/** Phase 2: Implementation — tasks, kpis, data_requirements */
export const designPhase2Schema = z.object({
  tasks: designResponseSchema.shape.tasks,
  kpis: designResponseSchema.shape.kpis,
  data_requirements: designResponseSchema.shape.data_requirements,
})

export type DesignPhase2 = z.infer<typeof designPhase2Schema>

export function parseDesignPhase1(raw: string, context: DesignValidationContext): { phase1: DesignPhase1; warnings: string[] } {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error('AI Phase 1 응답이 JSON 형식이 아닙니다.')
  }

  const parsed = designPhase1Schema.parse(json)
  const warnings: string[] = []

  // Soft-filter unknown asis_step_ids / asis_node_ids
  const processStepIdSet = new Set(context.processStepIds)
  parsed.tobe_process.steps.forEach((step) => {
    const original = step.asis_step_ids.length
    step.asis_step_ids = step.asis_step_ids.filter((id) => processStepIdSet.has(id))
    if (step.asis_step_ids.length < original) {
      warnings.push(`TO-BE 단계 "${step.name}"에서 알 수 없는 asis_step_id ${original - step.asis_step_ids.length}개 제거됨`)
    }
  })
  parsed.tobe_process.graph.nodes.forEach((node) => {
    const original = node.asis_node_ids.length
    node.asis_node_ids = node.asis_node_ids.filter((id) => processStepIdSet.has(id))
    if (node.asis_node_ids.length < original) {
      warnings.push(`그래프 노드 "${node.name}"에서 알 수 없는 asis_node_id ${original - node.asis_node_ids.length}개 제거됨`)
    }
  })

  return { phase1: parsed, warnings }
}

export function parseDesignPhase2(raw: string, context: DesignValidationContext): { phase2: DesignPhase2; warnings: string[] } {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error('AI Phase 2 응답이 JSON 형식이 아닙니다.')
  }

  const parsed = designPhase2Schema.parse(json)
  const warnings: string[] = []

  // Soft-filter unknown cluster_ids in tasks
  const clusterIdSet = new Set(context.clusterIds)
  parsed.tasks.forEach((task) => {
    const original = task.cluster_ids.length
    task.cluster_ids = task.cluster_ids.filter((id) => clusterIdSet.has(id))
    if (task.cluster_ids.length < original) {
      warnings.push(`과제 "${task.title}"에서 알 수 없는 cluster_id ${original - task.cluster_ids.length}개 제거됨`)
    }
  })

  return { phase2: parsed, warnings }
}

export function mergeDesignPhases(phase1: DesignPhase1, phase2: DesignPhase2): SingleDesignAlternative {
  return { ...phase1, ...phase2 }
}

export function parseDesignResponse(raw: string, context: DesignValidationContext): { alternative: SingleDesignAlternative; warnings: string[] } {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error('AI 응답이 JSON 형식이 아닙니다.')
  }

  const parsed = singleDesignAlternativeSchema.parse(json)
  const warnings = validateDesignResponse(parsed, context)
  return { alternative: parsed, warnings }
}

export type DesignValidationContext = {
  clusterIds: string[]
  processStepIds: string[]
}

export function validateDesignResponse(
  response: DesignResponse,
  { clusterIds, processStepIds }: DesignValidationContext,
): string[] {
  const clusterIdSet = new Set(clusterIds)
  const processStepIdSet = new Set(processStepIds)
  const warnings: string[] = []

  // Soft filter: remove unknown IDs and collect warnings instead of throwing
  response.tasks.forEach((task) => {
    const original = task.cluster_ids.length
    task.cluster_ids = task.cluster_ids.filter((id) => clusterIdSet.has(id))
    if (task.cluster_ids.length < original) {
      warnings.push(`과제 "${task.title}"에서 알 수 없는 cluster_id ${original - task.cluster_ids.length}개 제거됨`)
    }
  })

  response.tobe_process.steps.forEach((step) => {
    const original = step.asis_step_ids.length
    step.asis_step_ids = step.asis_step_ids.filter((id) => processStepIdSet.has(id))
    if (step.asis_step_ids.length < original) {
      warnings.push(`TO-BE 단계 "${step.name}"에서 알 수 없는 asis_step_id ${original - step.asis_step_ids.length}개 제거됨`)
    }
  })

  response.tobe_process.graph.nodes.forEach((node) => {
    const original = node.asis_node_ids.length
    node.asis_node_ids = node.asis_node_ids.filter((id) => processStepIdSet.has(id))
    if (node.asis_node_ids.length < original) {
      warnings.push(`그래프 노드 "${node.name}"에서 알 수 없는 asis_node_id ${original - node.asis_node_ids.length}개 제거됨`)
    }
  })

  return warnings
}

// ─── 5-Step Design Schemas ──────────────────────────────────────────

/** Step 1: TO-BE Process (graph only — no steps[], no mermaid_dsl; both generated client-side) */
export const designStep1Schema = z.object({
  name: z.string().min(1).max(50),
  strategy: z.string().min(1).max(200),
  tobe_process: z.object({
    graph: z.object({
      nodes: z.array(designGraphNodeSchema).min(1),
      edges: z
        .array(
          z.object({
            id: z.string().optional(),
            source_node_id: z.string().default(''),
            target_node_id: z.string().default(''),
            source: z.string().optional(),
            target: z.string().optional(),
            label: z.string().max(50).optional().nullable(),
            edge_type: z.string().default('sequence'),
          }).transform((e) => ({
            ...e,
            source_node_id: e.source_node_id || e.source || '',
            target_node_id: e.target_node_id || e.target || '',
          })),
        )
        .default([]),
      lanes: z
        .array(z.object({ id: z.string(), name: z.string() }))
        .default([]),
    }),
  }),
})

export type DesignStep1Result = z.infer<typeof designStep1Schema>

export function parseDesignStep1(
  raw: string,
  context: DesignValidationContext,
  idMap?: Map<string, string>,
): { data: DesignStep1Result; warnings: string[] } {
  const json = parseJsonSafe(raw, 'Step 1')
  const parsed = designStep1Schema.parse(json)
  const warnings: string[] = []
  const processStepIdSet = new Set(context.processStepIds)

  // Restore short IDs (n1, n2) back to original UUIDs using the idMap
  parsed.tobe_process.graph.nodes.forEach((node) => {
    if (idMap && idMap.size > 0) {
      node.asis_node_ids = node.asis_node_ids.map((id) => idMap.get(id) ?? id)
    }
    const original = node.asis_node_ids.length
    node.asis_node_ids = node.asis_node_ids.filter((id) => processStepIdSet.has(id))
    if (node.asis_node_ids.length < original) {
      warnings.push(`그래프 노드 "${node.name}"에서 알 수 없는 asis_node_id ${original - node.asis_node_ids.length}개 제거됨`)
    }
  })
  return { data: parsed, warnings }
}

/** Step 2: Agent Specs */
export const designStep2Schema = z.object({
  agent_specs: designResponseSchema.shape.agent_specs,
})

export type DesignStep2Result = z.infer<typeof designStep2Schema>

export function parseDesignStep2(raw: string): { data: DesignStep2Result; warnings: string[] } {
  const json = parseJsonSafe(raw, 'Step 2')
  const parsed = designStep2Schema.parse(json)
  return { data: parsed, warnings: [] }
}

/** Step 3: Tasks */
export const designStep3Schema = z.object({
  tasks: designResponseSchema.shape.tasks,
})

export type DesignStep3Result = z.infer<typeof designStep3Schema>

export function parseDesignStep3(raw: string, context: DesignValidationContext): { data: DesignStep3Result; warnings: string[] } {
  const json = parseJsonSafe(raw, 'Step 3')
  const parsed = designStep3Schema.parse(json)
  const warnings: string[] = []
  const clusterIdSet = new Set(context.clusterIds)
  parsed.tasks.forEach((task) => {
    const original = task.cluster_ids.length
    task.cluster_ids = task.cluster_ids.filter((id) => clusterIdSet.has(id))
    if (task.cluster_ids.length < original) {
      warnings.push(`과제 "${task.title}"에서 알 수 없는 cluster_id ${original - task.cluster_ids.length}개 제거됨`)
    }
  })
  return { data: parsed, warnings }
}

/** Step 4: KPIs */
export const designStep4Schema = z.object({
  kpis: designResponseSchema.shape.kpis,
})

export type DesignStep4Result = z.infer<typeof designStep4Schema>

export function parseDesignStep4(raw: string): { data: DesignStep4Result; warnings: string[] } {
  const json = parseJsonSafe(raw, 'Step 4')
  const parsed = designStep4Schema.parse(json)
  return { data: parsed, warnings: [] }
}

/** Step 5: Data Requirements */
export const designStep5Schema = z.object({
  data_requirements: designResponseSchema.shape.data_requirements,
})

export type DesignStep5Result = z.infer<typeof designStep5Schema>

export function parseDesignStep5(raw: string): { data: DesignStep5Result; warnings: string[] } {
  const json = parseJsonSafe(raw, 'Step 5')
  const parsed = designStep5Schema.parse(json)
  return { data: parsed, warnings: [] }
}

const bundleResultSchema = z.object({
  bundles: z.array(
    z.object({
      title: z.string().trim().min(1).max(100),
      description: z.string().trim().min(1).max(500),
      source_task_ids: z.array(z.string().uuid()).min(1),
    }),
  ).min(1),
})

export type BundleResultItem = z.infer<typeof bundleResultSchema>['bundles'][number]

export function parseBundleResult(raw: string): { data: BundleResultItem[]; warnings: string[] } {
  const json = parseJsonSafe(raw, 'Bundle')
  const parsed = bundleResultSchema.parse(json)
  return { data: parsed.bundles, warnings: [] }
}

const checkedItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).default(''),
  is_checked: z.boolean().default(true),
})

const finalTaskDetailSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(1000),
  rationale: z.string().trim().min(1).max(500),
  source_task_id: z.string().min(1),

  core_features: z.array(checkedItemSchema.extend({
    implementation_type: z.enum(['full', 'assisted', 'human']).default('assisted'),
  })).min(1),
  sub_features: z.array(checkedItemSchema).default([]),
  kpis: z.array(checkedItemSchema.extend({
    current_value: z.string().trim().max(200).default(''),
    target_value: z.string().trim().max(200).default(''),
    measurement_method: z.string().trim().max(500).default(''),
  })).default([]),
  process_changes: z.array(z.object({
    area: z.string().trim().min(1).max(200),
    as_is: z.string().trim().max(500).default(''),
    to_be: z.string().trim().max(500).default(''),
    impact: z.string().trim().max(500).default(''),
    is_checked: z.boolean().default(true),
  })).default([]),
  expected_effects: z.array(z.object({
    type: z.enum(['qualitative', 'quantitative']),
    description: z.string().trim().min(1).max(500),
    is_checked: z.boolean().default(true),
  })).default([]),
  required_technologies: z.array(checkedItemSchema).default([]),
  stakeholder_impacts: z.array(z.object({
    stakeholder: z.string().trim().min(1).max(200),
    impact: z.string().trim().min(1).max(500),
    is_checked: z.boolean().default(true),
  })).default([]),
  risks: z.array(z.object({
    description: z.string().trim().min(1).max(500),
    is_checked: z.boolean().default(true),
  })).default([]),
  prerequisites: z.array(z.object({
    description: z.string().trim().min(1).max(500),
    is_checked: z.boolean().default(true),
  })).default([]),
})

const finalTaskResultSchema = z.object({
  final_task: finalTaskDetailSchema,
})

export type FinalTaskDetail = z.infer<typeof finalTaskDetailSchema>
export type FinalTaskResult = FinalTaskDetail

export function parseFinalTaskResult(raw: string): { data: FinalTaskResult; warnings: string[] } {
  const json = parseJsonSafe(raw, 'FinalTask')
  const parsed = finalTaskResultSchema.parse(json)
  return { data: parsed.final_task, warnings: [] }
}

/** Schema for validating curation patches to final_task_detail.
 *  Relaxed: allows empty name/description fields (user may be mid-edit). */
export const finalTaskDetailPatchSchema = finalTaskDetailSchema.extend({
  core_features: z.array(checkedItemSchema.omit({ name: true }).extend({
    name: z.string().trim().max(200).default(''),
    implementation_type: z.enum(['full', 'assisted', 'human']).default('assisted'),
  })).default([]),
  sub_features: z.array(checkedItemSchema.omit({ name: true }).extend({
    name: z.string().trim().max(200).default(''),
  })).default([]),
  kpis: z.array(checkedItemSchema.omit({ name: true }).extend({
    name: z.string().trim().max(200).default(''),
    current_value: z.string().trim().max(200).default(''),
    target_value: z.string().trim().max(200).default(''),
    measurement_method: z.string().trim().max(500).default(''),
  })).default([]),
  process_changes: z.array(z.object({
    area: z.string().trim().max(200).default(''),
    as_is: z.string().trim().max(500).default(''),
    to_be: z.string().trim().max(500).default(''),
    impact: z.string().trim().max(500).default(''),
    is_checked: z.boolean().default(true),
  })).default([]),
  expected_effects: z.array(z.object({
    type: z.enum(['qualitative', 'quantitative']),
    description: z.string().trim().max(500).default(''),
    is_checked: z.boolean().default(true),
  })).default([]),
  required_technologies: z.array(checkedItemSchema.omit({ name: true }).extend({
    name: z.string().trim().max(200).default(''),
  })).default([]),
  stakeholder_impacts: z.array(z.object({
    stakeholder: z.string().trim().max(200).default(''),
    impact: z.string().trim().max(500).default(''),
    is_checked: z.boolean().default(true),
  })).default([]),
  risks: z.array(z.object({
    description: z.string().trim().max(500).default(''),
    is_checked: z.boolean().default(true),
  })).default([]),
  prerequisites: z.array(z.object({
    description: z.string().trim().max(500).default(''),
    is_checked: z.boolean().default(true),
  })).default([]),
})

// ─── Solution Canvas Schema ──────────────────────────────────────

export const solutionCanvasSchema = z.object({
  use_case: z.object({
    objective: z.string().trim().min(1).max(1000),
    user: z.string().trim().min(1).max(500),
    problem: z.string().trim().min(1).max(1000),
    solution: z.string().trim().min(1).max(1000),
  }),
  data: z.object({
    must_have: z.array(z.object({
      name: z.string().trim().min(1).max(200),
      source: z.string().trim().max(200).default(''),
      format: z.string().trim().max(100).default(''),
      volume: z.string().trim().max(100).default(''),
    })).min(1),
    nice_to_have: z.array(z.object({
      name: z.string().trim().min(1).max(200),
      source: z.string().trim().max(200).default(''),
      format: z.string().trim().max(100).default(''),
    })).default([]),
  }),
  stakeholders: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    role: z.string().trim().max(200).default(''),
    impact: z.string().trim().max(500).default(''),
  })).min(1),
  value_kpi: z.object({
    qualitative_effects: z.array(z.string().trim().min(1).max(500)).min(1),
    quantitative_effects: z.array(z.object({
      name: z.string().trim().min(1).max(200),
      current_value: z.string().trim().max(200).default(''),
      target_value: z.string().trim().max(200).default(''),
      measurement: z.string().trim().max(500).default(''),
    })).min(1),
  }),
  concern: z.object({
    risks: z.array(z.object({
      description: z.string().trim().min(1).max(500),
      probability: z.enum(['low', 'medium', 'high']).default('medium'),
      impact: z.enum(['low', 'medium', 'high']).default('medium'),
      mitigation: z.string().trim().max(500).default(''),
    })).min(1),
    issues: z.array(z.object({
      description: z.string().trim().min(1).max(500),
      category: z.string().trim().max(100).default(''),
      severity: z.enum(['low', 'medium', 'high']).default('medium'),
    })).default([]),
  }),
})

export type SolutionCanvasResult = z.infer<typeof solutionCanvasSchema>

export function parseSolutionCanvas(raw: string): { data: SolutionCanvasResult; warnings: string[] } {
  const json = parseJsonSafe(raw, 'SolutionCanvas') as Record<string, unknown>
  const normalized = normalizeSolutionCanvas(json)
  const parsed = solutionCanvasSchema.parse(normalized)
  return { data: parsed, warnings: [] }
}

/** Normalize common AI field-name variations to match our schema */
function normalizeSolutionCanvas(raw: Record<string, unknown>): Record<string, unknown> {
  const result = { ...raw }

  // use_case: map common alternative field names
  if (result.use_case && typeof result.use_case === 'object') {
    const uc = result.use_case as Record<string, unknown>
    if (!uc.objective) uc.objective = uc.purpose ?? uc.goal ?? uc.overview ?? ''
    if (!uc.user) uc.user = uc.target_user ?? uc.user_persona ?? uc.target ?? uc.users ?? ''
    if (!uc.problem) uc.problem = uc.pain_point ?? uc.challenge ?? uc.issue ?? ''
    if (!uc.solution) uc.solution = uc.approach ?? uc.proposal ?? uc.description ?? ''
  }

  // data: map must_have alternatives
  if (result.data && typeof result.data === 'object') {
    const d = result.data as Record<string, unknown>
    if (!d.must_have) d.must_have = d.required ?? d.essential ?? d.required_data ?? []
    if (!d.nice_to_have) d.nice_to_have = d.optional ?? d.optional_data ?? []
  }

  // stakeholders: ensure items have 'name' field
  if (Array.isArray(result.stakeholders)) {
    result.stakeholders = (result.stakeholders as Record<string, unknown>[]).map((s) => ({
      name: s.name ?? s.stakeholder ?? s.title ?? s.department ?? '',
      role: s.role ?? s.responsibility ?? '',
      impact: s.impact ?? s.influence ?? s.description ?? '',
    }))
  }

  // value_kpi: map effect arrays
  if (result.value_kpi && typeof result.value_kpi === 'object') {
    const vk = result.value_kpi as Record<string, unknown>
    if (!vk.qualitative_effects) vk.qualitative_effects = vk.qualitative ?? vk.quality_effects ?? []
    if (!vk.quantitative_effects) vk.quantitative_effects = vk.quantitative ?? vk.quantity_effects ?? vk.kpis ?? []
  }

  // concern.risks: normalize risk items
  if (result.concern && typeof result.concern === 'object') {
    const c = result.concern as Record<string, unknown>
    if (Array.isArray(c.risks)) {
      c.risks = (c.risks as Record<string, unknown>[]).map((r) => ({
        description: r.description ?? r.risk ?? r.content ?? r.name ?? '',
        probability: normalizeLevel(r.probability ?? r.likelihood ?? 'medium'),
        impact: normalizeLevel(r.impact ?? r.severity ?? 'medium'),
        mitigation: r.mitigation ?? r.response ?? r.countermeasure ?? '',
      }))
    }
  }

  return result
}

function normalizeLevel(v: unknown): string {
  const s = String(v).toLowerCase().trim()
  if (['low', 'medium', 'high'].includes(s)) return s
  if (s === '높음' || s === 'critical') return 'high'
  if (s === '중간' || s === 'moderate') return 'medium'
  if (s === '낮음' || s === 'minor') return 'low'
  return 'medium'
}

function parseJsonSafe(raw: string, label: string): unknown {
  // Strip potential markdown code fences (defensive — json_object mode shouldn't produce them)
  const cleaned = raw.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error(`AI ${label} 응답이 JSON 형식이 아닙니다.`)
  }
}

export const markdownContentResponseSchema = z.object({
  content: z.string().trim().min(1),
})

export type MarkdownContentResponse = z.infer<typeof markdownContentResponseSchema>

export function parseMarkdownContentResponse(
  raw: string,
  {
    maxLength,
    label,
  }: {
    maxLength: number
    label: string
  },
): MarkdownContentResponse {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error('AI 응답이 JSON 형식이 아닙니다.')
  }

  const response = markdownContentResponseSchema.parse(json)
  if (response.content.length > maxLength) {
    throw new Error(`${label} 본문이 최대 길이를 초과했습니다.`)
  }

  return response
}

// ─── Test Data Schemas ───────────────────────────────────────────

export const testProcessResponseSchema = z.object({
  lanes: z.array(z.object({
    name: z.string().min(1).max(50),
    order_index: z.number().int().min(0),
  })).min(1).max(5),
  nodes: z.array(z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).nullable().optional(),
    node_type: z.enum(['task', 'exclusive_gateway', 'parallel_gateway', 'start_event', 'end_event', 'intermediate_event']),
    lane_index: z.number().int().min(0),
    order_index: z.number().int().min(0),
  })).min(5).max(20),
  edges: z.array(z.object({
    source_index: z.number().int().min(0),
    target_index: z.number().int().min(0),
    label: z.string().max(50).nullable().optional(),
  })),
})

export type TestProcessResponse = z.infer<typeof testProcessResponseSchema>

export const testNotesResponseSchema = z.object({
  notes: z.array(z.object({
    content: z.string().min(1).max(200),
    color: z.enum(['yellow', 'red', 'blue', 'green']),
    process_node_index: z.number().int().min(-1),
  })).min(5).max(30),
})

export type TestNotesResponse = z.infer<typeof testNotesResponseSchema>

export function parseTestProcessResponse(raw: string): TestProcessResponse {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error('AI 응답이 JSON 형식이 아닙니다.')
  }
  return testProcessResponseSchema.parse(json)
}

export function parseTestNotesResponse(raw: string): TestNotesResponse {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error('AI 응답이 JSON 형식이 아닙니다.')
  }
  return testNotesResponseSchema.parse(json)
}
