import type { Entity } from './common'

export type ReactionType = '👍' | '🤔'

export interface TaskReaction extends Entity {
  workshop_id: string
  task_id: string | null
  prd_id: string | null
  participant_id: string
  reaction_type: ReactionType
  created_at: string
}
