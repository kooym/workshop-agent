import type { Json } from '@/types/common'
import type { NoteColor } from '@/types/note'
import type { ProcessNodeType } from '@/types/process-step'
import type { ReactionType } from '@/types/reaction'
import type { WorkshopSettings, WorkshopStage } from '@/types/workshop'

type RowWithId = { id: string }
type InsertWithId = { id?: string }

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: RowWithId & {
          name: string
          description: string | null
          facilitator_id: string
          created_at: string
          updated_at: string
        }
        Insert: InsertWithId & {
          name: string
          description?: string | null
          facilitator_id: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
        Relationships: []
      }
      workshops: {
        Row: RowWithId & {
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
          created_at: string
          updated_at: string
        }
        Insert: InsertWithId & {
          project_id: string
          title: string
          description?: string | null
          invite_code: string
          current_stage?: WorkshopStage
          facilitator_id: string
          settings?: WorkshopSettings
          is_processing?: boolean
          is_processing_since?: string | null
          design_step?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['workshops']['Insert']>
        Relationships: []
      }
      participants: {
        Row: RowWithId & {
          workshop_id: string
          user_id: string | null
          display_name: string
          role: string | null
          is_facilitator: boolean
          joined_at: string
          created_at: string
        }
        Insert: InsertWithId & {
          workshop_id: string
          user_id?: string | null
          display_name: string
          role?: string | null
          is_facilitator?: boolean
          joined_at?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['participants']['Insert']>
        Relationships: []
      }
      process_lanes: {
        Row: RowWithId & {
          workshop_id: string
          name: string
          order_index: number
          color: string | null
          created_at: string
        }
        Insert: InsertWithId & {
          workshop_id: string
          name: string
          order_index: number
          color?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['process_lanes']['Insert']>
        Relationships: []
      }
      process_steps: {
        Row: RowWithId & {
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
        Insert: InsertWithId & {
          workshop_id: string
          name: string
          description?: string | null
          node_type?: ProcessNodeType
          order_index?: number
          position_x?: number | null
          position_y?: number | null
          width?: number | null
          height?: number | null
          lane_id?: string | null
          duration_info?: string | null
          tools_systems?: string | null
          volume_info?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['process_steps']['Insert']>
        Relationships: []
      }
      process_edges: {
        Row: RowWithId & {
          workshop_id: string
          source_node_id: string
          target_node_id: string
          label: string | null
          edge_type: 'sequence' | 'message' | 'association'
          created_at: string
        }
        Insert: InsertWithId & {
          workshop_id: string
          source_node_id: string
          target_node_id: string
          label?: string | null
          edge_type?: 'sequence' | 'message' | 'association'
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['process_edges']['Insert']>
        Relationships: []
      }
      editing_locks: {
        Row: RowWithId & {
          workshop_id: string
          resource_type: 'process_graph' | 'design_artifacts'
          editor_id: string
          acquired_at: string
          last_heartbeat_at: string
        }
        Insert: InsertWithId & {
          workshop_id: string
          resource_type: 'process_graph' | 'design_artifacts'
          editor_id: string
          acquired_at?: string
          last_heartbeat_at?: string
        }
        Update: Partial<Database['public']['Tables']['editing_locks']['Insert']>
        Relationships: []
      }
      clusters: {
        Row: RowWithId & {
          workshop_id: string
          name: string
          summary: string | null
          order_index: number
          is_stale: boolean
          score_impact: number | null
          score_feasibility: number | null
          score_urgency: number | null
          created_at: string
          updated_at: string
        }
        Insert: InsertWithId & {
          workshop_id: string
          name: string
          summary?: string | null
          order_index?: number
          is_stale?: boolean
          score_impact?: number | null
          score_feasibility?: number | null
          score_urgency?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['clusters']['Insert']>
        Relationships: []
      }
      notes: {
        Row: RowWithId & {
          workshop_id: string
          participant_id: string
          cluster_id: string | null
          process_step_id: string | null
          content: string
          color: NoteColor
          position_x: number
          position_y: number
          created_at: string
          updated_at: string
        }
        Insert: InsertWithId & {
          workshop_id: string
          participant_id: string
          cluster_id?: string | null
          process_step_id?: string | null
          content: string
          color?: NoteColor
          position_x?: number
          position_y?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['notes']['Insert']>
        Relationships: []
      }
      votes: {
        Row: RowWithId & {
          workshop_id: string
          participant_id: string
          cluster_id: string | null
          note_id: string | null
          task_id: string | null
          created_at: string
        }
        Insert: InsertWithId & {
          workshop_id: string
          participant_id: string
          cluster_id?: string | null
          note_id?: string | null
          task_id?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['votes']['Insert']>
        Relationships: []
      }
      design_artifacts: {
        Row: RowWithId & {
          workshop_id: string
          tobe_process: Json
          agent_specs: Json
          kpis: Json
          data_requirements: Json
          final_task_detail: Json | null
          solution_canvas: Json | null
          alternative_index: number
          alternative_name: string
          version: number
          is_stale: boolean
          created_at: string
          updated_at: string
        }
        Insert: InsertWithId & {
          workshop_id: string
          tobe_process: Json
          agent_specs: Json
          kpis: Json
          data_requirements: Json
          final_task_detail?: Json | null
          solution_canvas?: Json | null
          alternative_index?: number
          alternative_name?: string
          version?: number
          is_stale?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['design_artifacts']['Insert']>
        Relationships: []
      }
      ax_tasks: {
        Row: RowWithId & {
          workshop_id: string
          design_artifact_id: string | null
          cluster_id: string | null
          title: string
          description: string | null
          difficulty: string | null
          priority: 'high' | 'medium' | 'low' | null
          expected_effect: string | null
          kpi_name: string | null
          estimated_value: string | null
          pain_points: Json
          core_features: Json
          sub_features: Json
          is_selected: boolean
          is_bundle: boolean
          bundle_id: string | null
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: InsertWithId & {
          workshop_id: string
          design_artifact_id?: string | null
          cluster_id?: string | null
          title: string
          description?: string | null
          difficulty?: string | null
          priority?: 'high' | 'medium' | 'low' | null
          expected_effect?: string | null
          kpi_name?: string | null
          estimated_value?: string | null
          pain_points?: Json
          core_features?: Json
          sub_features?: Json
          is_selected?: boolean
          is_bundle?: boolean
          bundle_id?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['ax_tasks']['Insert']>
        Relationships: []
      }
      prds: {
        Row: RowWithId & {
          workshop_id: string
          content: string
          version: number
          is_stale: boolean
          created_at: string
          updated_at: string
        }
        Insert: InsertWithId & {
          workshop_id: string
          content: string
          version?: number
          is_stale?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['prds']['Insert']>
        Relationships: []
      }
      ax_reports: {
        Row: RowWithId & {
          workshop_id: string
          content: string
          version: number
          is_stale: boolean
          created_at: string
          updated_at: string
        }
        Insert: InsertWithId & {
          workshop_id: string
          content: string
          version?: number
          is_stale?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['ax_reports']['Insert']>
        Relationships: []
      }
      task_reactions: {
        Row: RowWithId & {
          workshop_id: string
          task_id: string | null
          prd_id: string | null
          participant_id: string
          reaction_type: ReactionType
          created_at: string
        }
        Insert: InsertWithId & {
          workshop_id: string
          task_id?: string | null
          prd_id?: string | null
          participant_id: string
          reaction_type: ReactionType
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['task_reactions']['Insert']>
        Relationships: []
      }
      yjs_documents: {
        Row: {
          id: string
          document: number[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          document?: number[]
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['yjs_documents']['Insert']>
        Relationships: []
      }
      cluster_scores: {
        Row: RowWithId & {
          cluster_id: string
          workshop_id: string
          participant_id: string
          score_impact: number
          score_feasibility: number
          score_urgency: number
          created_at: string
          updated_at: string
        }
        Insert: InsertWithId & {
          cluster_id: string
          workshop_id: string
          participant_id: string
          score_impact: number
          score_feasibility: number
          score_urgency: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['cluster_scores']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      join_workshop_by_code: {
        Args: {
          p_invite_code: string
          p_display_name: string
          p_role?: string | null
        }
        Returns: {
          workshop_id: string
          participant_id: string
          workshop: Json
          participant: Json
          read_only: boolean
        }[]
      }
    }
    Enums: {
      workshop_stage: WorkshopStage
    }
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
