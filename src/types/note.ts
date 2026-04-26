import type { Entity, Timestamped } from './common'

export const NOTE_COLORS = ['red', 'blue', 'green', 'yellow'] as const

export type NoteColor = (typeof NOTE_COLORS)[number]

export interface Note extends Entity, Timestamped {
  workshop_id: string
  participant_id: string
  cluster_id: string | null
  process_step_id: string | null
  content: string
  color: NoteColor
  position_x: number
  position_y: number
}
