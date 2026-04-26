import type { Entity, Json, Timestamped } from './common'

export interface ToBeProcess {
  mermaid_dsl: string
  graph: {
    nodes: Json[]
    edges: Json[]
    lanes: Json[]
  }
}

export interface AgentSpec {
  name: string
  role: string
  core_features: string[]
  sub_features: string[]
  inputs: string[]
  outputs: string[]
  human_checkpoints: string[]
}

export interface Kpi {
  name: string
  as_is: string
  to_be: string
  measurement: string
}

export interface DataRequirement {
  name: string
  source: string
  format: string
  scale: string
  owner: string
}

export interface OrgRequirement {
  category: string
  description: string
}

export interface DesignArtifact extends Entity, Timestamped {
  workshop_id: string
  tobe_process: ToBeProcess
  agent_specs: AgentSpec[]
  kpis: Kpi[]
  data_requirements: DataRequirement[]
  org_requirements: OrgRequirement[]
  version: number
  is_stale: boolean
}
