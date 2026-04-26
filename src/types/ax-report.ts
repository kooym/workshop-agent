import type { Entity, Timestamped } from './common'

export interface AxReport extends Entity, Timestamped {
  workshop_id: string
  content: string
  version: number
  is_stale: boolean
}
