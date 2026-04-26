import type { Entity, Timestamped } from './common'
import type { Note } from './note'

export interface Cluster extends Entity, Timestamped {
  workshop_id: string
  name: string
  summary: string | null
  order_index: number
  is_stale: boolean
}

export type ClusterWithNotes = Cluster & {
  notes: Note[]
}
