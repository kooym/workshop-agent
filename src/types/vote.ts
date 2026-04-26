import type { Entity } from './common'

export type VoteTargetType = 'cluster' | 'note'

export interface Vote extends Entity {
  workshop_id: string
  participant_id: string
  cluster_id: string | null
  note_id: string | null
  created_at: string
}

export interface VoteResult {
  target_type: VoteTargetType
  target_id: string
  count: number
  percentage: number
}

export interface VoteResultRow {
  target_type: VoteTargetType
  cluster_id?: string
  note_id?: string
  target_name: string
  vote_count: number
  percentage: number
}
