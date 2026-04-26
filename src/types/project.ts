import type { Entity, Timestamped } from './common'

export interface Project extends Entity, Timestamped {
  name: string
  description: string | null
  facilitator_id: string
}
