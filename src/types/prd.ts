import type { Entity, Timestamped } from './common'

export interface Prd extends Entity, Timestamped {
  workshop_id: string
  content: string
  version: number
  is_stale: boolean
}
