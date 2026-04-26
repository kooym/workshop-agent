import { z } from 'zod'

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(50),
  email: z.string().trim().email(),
  password: z.string().min(8).max(100),
})

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
})

export const projectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().nullable(),
})

export const projectPatchSchema = projectSchema.partial().refine(
  (value) => value.name !== undefined || value.description !== undefined,
  '수정할 프로젝트 필드가 필요합니다.',
)

export const workshopSettingsSchema = z.object({
  anonymous: z.boolean().optional(),
  votes_per_person: z.number().int().min(1).max(10).optional(),
  max_participants: z.number().int().min(2).max(20).optional(),
  results_visible: z.boolean().optional(),
  vote_mode: z.enum(['cluster', 'note']).optional(),
  timer_minutes: z.number().int().min(1).max(60).nullable().optional(),
})

export const createWorkshopSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  settings: workshopSettingsSchema.optional(),
})

export const listWorkshopsQuerySchema = z.object({
  project_id: z.string().uuid(),
})

export const inviteCodeSchema = z
  .string()
  .trim()
  .length(6)
  .transform((value) => value.toUpperCase())

export const previewWorkshopQuerySchema = z.object({
  invite_code: inviteCodeSchema,
})

export const joinWorkshopSchema = z.object({
  invite_code: inviteCodeSchema,
  name: z.string().trim().min(1).max(50),
  role: z.string().trim().max(50).optional().nullable(),
})

export const workshopPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    current_stage: z
      .enum(['context', 'gather', 'cluster', 'vote', 'design', 'generate', 'report', 'completed'])
      .optional(),
    settings: workshopSettingsSchema.optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.current_stage !== undefined ||
      value.settings !== undefined,
    '수정할 워크샵 필드가 필요합니다.',
  )

export const dismissStaleSchema = z.union([
  z.object({
    table: z.enum(['clusters', 'design_artifacts', 'prds', 'ax_reports']),
  }),
  z.object({
    tables: z.array(z.enum(['clusters', 'design_artifacts', 'prds', 'ax_reports'])).min(1),
  }),
])

export const processNodeTypeSchema = z.enum([
  'task',
  'exclusive_gateway',
  'parallel_gateway',
  'start_event',
  'end_event',
  'intermediate_event',
  'sub_process',
])

export const processStepCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  node_type: processNodeTypeSchema.default('task'),
  order_index: z.number().int(),
  position_x: z.number().optional().nullable(),
  position_y: z.number().optional().nullable(),
  width: z.number().positive().optional().nullable(),
  height: z.number().positive().optional().nullable(),
  lane_id: z.string().uuid().optional().nullable(),
  duration_info: z.string().trim().max(500).optional().nullable(),
  tools_systems: z.string().trim().max(500).optional().nullable(),
  volume_info: z.string().trim().max(500).optional().nullable(),
})

export const processStepPatchSchema = processStepCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, '수정할 프로세스 노드 필드가 필요합니다.')

export const processEdgeCreateSchema = z
  .object({
    source_node_id: z.string().uuid(),
    target_node_id: z.string().uuid(),
    label: z.string().trim().max(50).optional().nullable(),
    edge_type: z.enum(['sequence', 'message', 'association']).default('sequence'),
  })
  .refine((value) => value.source_node_id !== value.target_node_id, {
    message: 'source_node_id와 target_node_id는 달라야 합니다.',
  })

export const processEdgePatchSchema = z
  .object({
    label: z.string().trim().max(50).optional().nullable(),
    edge_type: z.enum(['sequence', 'message', 'association']).optional(),
  })
  .refine((value) => value.label !== undefined || value.edge_type !== undefined, {
    message: '수정할 프로세스 간선 필드가 필요합니다.',
  })

export const processLaneCreateSchema = z.object({
  name: z.string().trim().min(1).max(50),
  order_index: z.number().int(),
  color: z.string().trim().max(50).optional().nullable(),
})

export const processLanePatchSchema = processLaneCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, '수정할 Swimlane 필드가 필요합니다.')

export const editingLockSchema = z.object({
  resource_type: z.enum(['process_graph', 'design_artifacts']),
})

export const noteColorSchema = z.enum(['red', 'blue', 'green', 'yellow'])

export const listNotesQuerySchema = z.object({
  workshop_id: z.string().uuid(),
})

export const createNoteSchema = z.object({
  workshop_id: z.string().uuid(),
  id: z.string().uuid().optional(),
  content: z.string().trim().min(1).max(200),
  color: noteColorSchema,
  position_x: z.number(),
  position_y: z.number(),
  process_step_id: z.string().uuid().optional().nullable(),
})

export const patchNoteSchema = z
  .object({
    content: z.string().trim().min(1).max(200).optional(),
    color: noteColorSchema.optional(),
    position_x: z.number().optional(),
    position_y: z.number().optional(),
    process_step_id: z.string().uuid().optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, '수정할 포스트잇 필드가 필요합니다.')

export const aiClusterSchema = z.object({
  workshop_id: z.string().uuid(),
})

export const listClustersQuerySchema = z.object({
  workshop_id: z.string().uuid(),
})

export const patchClusterSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    order_index: z.number().int().optional(),
  })
  .refine(
    (value) => value.name !== undefined || value.order_index !== undefined,
    '수정할 클러스터 필드가 필요합니다.',
  )

export const listVotesQuerySchema = z.object({
  workshop_id: z.string().uuid(),
})

export const createVoteSchema = z
  .object({
    workshop_id: z.string().uuid(),
    cluster_id: z.string().uuid().optional().nullable(),
    note_id: z.string().uuid().optional().nullable(),
  })
  .refine((value) => Boolean(value.cluster_id) !== Boolean(value.note_id), {
    message: '투표 대상은 하나만 선택해야 합니다.',
  })

export const deleteVoteQuerySchema = z.object({
  id: z.string().uuid(),
  workshop_id: z.string().uuid(),
})

export const voteResultsQuerySchema = z.object({
  workshop_id: z.string().uuid(),
})

export const aiDesignSchema = z.object({
  workshop_id: z.string().uuid(),
})

export const designArtifactPatchSchema = z
  .object({
    tobe_process: z.unknown().optional(),
    agent_specs: z.unknown().optional(),
    kpis: z.unknown().optional(),
    data_requirements: z.unknown().optional(),
    org_requirements: z.unknown().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, '수정할 설계 산출물 필드가 필요합니다.')

export const listTasksQuerySchema = z.object({
  workshop_id: z.string().uuid(),
})

export const patchTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().min(1).max(500).optional().nullable(),
    core_features: z.array(z.string().trim().min(1)).optional(),
    sub_features: z.array(z.string().trim().min(1)).optional(),
    priority: z.enum(['high', 'medium', 'low']).optional().nullable(),
    difficulty: z.enum(['low', 'medium', 'high']).optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, '수정할 과제 필드가 필요합니다.')

export const reactionTypeSchema = z.enum(['👍', '⚠️'])

export const createReactionSchema = z
  .object({
    workshop_id: z.string().uuid(),
    task_id: z.string().uuid().optional().nullable(),
    prd_id: z.string().uuid().optional().nullable(),
    reaction_type: reactionTypeSchema,
  })
  .refine((value) => Boolean(value.task_id) !== Boolean(value.prd_id), {
    message: '반응 대상은 하나만 선택해야 합니다.',
  })

export const listReactionsQuerySchema = z
  .object({
    workshop_id: z.string().uuid(),
    task_id: z.string().uuid().optional().nullable(),
    prd_id: z.string().uuid().optional().nullable(),
  })
  .refine((value) => Boolean(value.task_id) !== Boolean(value.prd_id), {
    message: '반응 대상은 하나만 선택해야 합니다.',
  })

export const deleteReactionQuerySchema = z.object({
  id: z.string().uuid(),
  workshop_id: z.string().uuid(),
})
