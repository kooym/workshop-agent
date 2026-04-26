import type { Entity } from './common'

export const PROCESS_NODE_TYPES = [
  'task',
  'exclusive_gateway',
  'parallel_gateway',
  'start_event',
  'end_event',
  'intermediate_event',
  'sub_process',
] as const

export type ProcessNodeType = (typeof PROCESS_NODE_TYPES)[number]

export interface ProcessLane extends Entity {
  workshop_id: string
  name: string
  order_index: number
  color: string | null
  created_at: string
}

export interface ProcessStep extends Entity {
  workshop_id: string
  name: string
  description: string | null
  node_type: ProcessNodeType
  order_index: number
  position_x: number | null
  position_y: number | null
  width: number | null
  height: number | null
  lane_id: string | null
  duration_info: string | null
  tools_systems: string | null
  volume_info: string | null
  created_at: string
  updated_at: string
}

export interface ProcessEdge extends Entity {
  workshop_id: string
  source_node_id: string
  target_node_id: string
  label: string | null
  edge_type: 'sequence' | 'message' | 'association'
  created_at: string
}

export interface EditingLock extends Entity {
  workshop_id: string
  resource_type: 'process_graph' | 'design_artifacts'
  editor_id: string
  acquired_at: string
  last_heartbeat_at: string
}
