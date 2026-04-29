import type { Entity, Timestamped } from './common'

export const WORKSHOP_STAGES = [
  'context',
  'gather',
  'cluster',
  'vote',
  'design',
  'generate',
  'report',
  'completed',
] as const

export type WorkshopStage = (typeof WORKSHOP_STAGES)[number]

export const WORKSHOP_SETTING_LIMITS = {
  votes_per_person: { min: 1, max: 10 },
  max_participants: { min: 2, max: 20 },
  timer_minutes: { min: 1, max: 60 },
} as const

export interface WorkshopSettings {
  anonymous: boolean
  votes_per_person: number
  max_participants: number
  results_visible: boolean
  vote_mode: 'cluster' | 'note'
  timer_minutes: number | null
}

export const DEFAULT_WORKSHOP_SETTINGS: WorkshopSettings = {
  anonymous: false,
  votes_per_person: 3,
  max_participants: 20,
  results_visible: false,
  vote_mode: 'cluster',
  timer_minutes: null,
}

export interface Workshop extends Entity, Timestamped {
  project_id: string
  title: string
  description: string | null
  invite_code: string
  current_stage: WorkshopStage
  facilitator_id: string
  settings: WorkshopSettings
  is_processing: boolean
  is_processing_since: string | null
  design_step: number
}

export interface Participant extends Entity {
  workshop_id: string
  user_id: string | null
  display_name: string
  role: string | null
  is_facilitator: boolean
  joined_at: string
  created_at: string
}
