import type { Entity, Timestamped } from './common'
import type { Note } from './note'

export interface Cluster extends Entity, Timestamped {
  workshop_id: string
  name: string
  summary: string | null
  order_index: number
  is_stale: boolean
  score_impact: number | null
  score_feasibility: number | null
  score_urgency: number | null
}

export type ClusterWithNotes = Cluster & {
  notes: Note[]
}
