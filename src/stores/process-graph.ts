import {
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  applyEdgeChanges,
  applyNodeChanges,
} from '@xyflow/react'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Tables } from '@/lib/supabase/types'
import type { ProcessNodeType } from '@/types/process-step'

type ProcessGraphPayload = {
  nodes: Node[]
  edges: Edge[]
  lanes: Tables<'process_lanes'>[]
  editingLock: Tables<'editing_locks'> | null
}

type AddNodeInput = {
  name: string
  node_type: ProcessNodeType
  order_index: number
  position_x: number
  position_y: number
  lane_id?: string | null
}

type UpdateNodeInput = {
  name?: string
  description?: string | null
  duration_info?: string | null
  tools_systems?: string | null
  volume_info?: string | null
  lane_id?: string | null
  position_x?: number
  position_y?: number
}

interface ProcessGraphStore extends ProcessGraphPayload {
  isActiveEditor: boolean
  selectedNodeId: string | null

  setGraph(payload: ProcessGraphPayload): void
  setEditingLock(lock: Tables<'editing_locks'> | null, participantId?: string): void
  setSelectedNode(nodeId: string | null): void
  refetchAll(workshopId: string, participantId?: string): Promise<void>

  addNode(workshopId: string, input: AddNodeInput): Promise<boolean>
  updateNode(workshopId: string, stepId: string, patch: UpdateNodeInput): Promise<boolean>
  deleteNode(workshopId: string, stepId: string): Promise<boolean>
  addEdge(workshopId: string, sourceId: string, targetId: string): Promise<boolean>
  deleteEdge(workshopId: string, edgeId: string): Promise<boolean>
  updateNodePosition(workshopId: string, stepId: string, x: number, y: number): Promise<void>

  addLane(workshopId: string, name: string): Promise<boolean>
  deleteLane(workshopId: string, laneId: string): Promise<boolean>

  onNodesChange(changes: NodeChange[]): void
  onEdgesChange(changes: EdgeChange[]): void
}

export const useProcessGraphStore = create<ProcessGraphStore>()(
  devtools(
    (set, get) => ({
      nodes: [],
      edges: [],
      lanes: [],
      editingLock: null,
      isActiveEditor: false,
      selectedNodeId: null,

      setGraph: (payload) =>
        set({ ...payload }),

      setEditingLock: (editingLock, participantId) =>
        set({
          editingLock,
          isActiveEditor: Boolean(
            participantId && editingLock && editingLock.editor_id === participantId,
          ),
        }),

      setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),

      refetchAll: async (workshopId, participantId) => {
        const response = await fetch(`/api/workshops/${workshopId}/process-graph`)
        if (!response.ok) return

        const payload = await response.json()
        const data = payload.data as ProcessGraphPayload

        // Stable merge: preserve existing node type and reference when only position changed
        const current = get()
        const existingMap = new Map(current.nodes.map((n) => [n.id, n]))
        const mergedNodes = data.nodes.map((incoming) => {
          const existing = existingMap.get(incoming.id)
          if (!existing) return incoming
          // Always preserve the type field from the incoming server data or existing local data
          return {
            ...incoming,
            type: incoming.type || existing.type,
          }
        })

        set({
          nodes: mergedNodes,
          edges: data.edges,
          lanes: data.lanes,
          editingLock: data.editingLock,
          isActiveEditor: Boolean(
            participantId && data.editingLock && data.editingLock.editor_id === participantId,
          ),
        })
      },

      addNode: async (workshopId, input) => {
        const res = await fetch(`/api/workshops/${workshopId}/process-steps`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        })
        if (!res.ok) return false
        const { data: step } = await res.json()
        set((state) => ({
          nodes: [
            ...state.nodes,
            {
              id: step.id,
              type: step.node_type,
              position: { x: step.position_x ?? 0, y: step.position_y ?? 0 },
              data: { ...step, label: step.name },
              parentId: step.lane_id ?? undefined,
            },
          ],
        }))
        return true
      },

      updateNode: async (workshopId, stepId, patch) => {
        const res = await fetch(`/api/workshops/${workshopId}/process-steps/${stepId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) return false
        const { data: updated } = await res.json()
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === stepId
              ? {
                  ...n,
                  type: updated.node_type ?? n.type,
                  data: { ...updated, label: updated.name },
                  position: { x: updated.position_x ?? n.position.x, y: updated.position_y ?? n.position.y },
                }
              : n,
          ),
        }))
        return true
      },

      deleteNode: async (workshopId, stepId) => {
        const res = await fetch(`/api/workshops/${workshopId}/process-steps/${stepId}`, {
          method: 'DELETE',
        })
        if (!res.ok) return false
        set((state) => ({
          nodes: state.nodes.filter((n) => n.id !== stepId),
          edges: state.edges.filter((e) => e.source !== stepId && e.target !== stepId),
          selectedNodeId: state.selectedNodeId === stepId ? null : state.selectedNodeId,
        }))
        return true
      },

      addEdge: async (workshopId, sourceId, targetId) => {
        const res = await fetch(`/api/workshops/${workshopId}/process-edges`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            source_node_id: sourceId,
            target_node_id: targetId,
            edge_type: 'sequence',
          }),
        })
        if (!res.ok) return false
        const { data: edge } = await res.json()
        set((state) => ({
          edges: [
            ...state.edges,
            {
              id: edge.id,
              source: edge.source_node_id,
              target: edge.target_node_id,
              type: edge.edge_type,
              label: edge.label ?? undefined,
            },
          ],
        }))
        return true
      },

      deleteEdge: async (workshopId, edgeId) => {
        const res = await fetch(`/api/workshops/${workshopId}/process-edges/${edgeId}`, {
          method: 'DELETE',
        })
        if (!res.ok) return false
        set((state) => ({
          edges: state.edges.filter((e) => e.id !== edgeId),
        }))
        return true
      },

      updateNodePosition: async (workshopId, stepId, x, y) => {
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === stepId ? { ...n, position: { x, y } } : n,
          ),
        }))
        await fetch(`/api/workshops/${workshopId}/process-steps/${stepId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ position_x: x, position_y: y }),
        })
      },

      addLane: async (workshopId, name) => {
        const lanes = get().lanes
        const res = await fetch(`/api/workshops/${workshopId}/process-lanes`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, order_index: lanes.length }),
        })
        if (!res.ok) return false
        const { data: lane } = await res.json()
        set((state) => ({ lanes: [...state.lanes, lane] }))
        return true
      },

      deleteLane: async (workshopId, laneId) => {
        const res = await fetch(`/api/workshops/${workshopId}/process-lanes/${laneId}`, {
          method: 'DELETE',
        })
        if (!res.ok) return false
        set((state) => ({
          lanes: state.lanes.filter((l) => l.id !== laneId),
          nodes: state.nodes.map((n) =>
            n.parentId === laneId ? { ...n, parentId: undefined } : n,
          ),
        }))
        return true
      },

      onNodesChange: (changes) =>
        set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })),

      onEdgesChange: (changes) =>
        set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),
    }),
    { name: 'process-graph-store' },
  ),
)
