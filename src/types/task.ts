import type { Entity, Json, Timestamped } from './common'

export type TaskDifficulty = 'low' | 'medium' | 'high' | string
export type TaskPriority = 'low' | 'medium' | 'high'

export interface AxTask extends Entity, Timestamped {
  workshop_id: string
  design_artifact_id: string | null
  cluster_id: string | null
  title: string
  description: string | null
  difficulty: TaskDifficulty | null
  priority: TaskPriority | null
  expected_effect: string | null
  pain_points: Json
  core_features: Json
  sub_features: Json
  order_index: number
}
