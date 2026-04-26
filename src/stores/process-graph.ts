import type { Edge, Node } from '@xyflow/react'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Tables } from '@/lib/supabase/types'

type ProcessGraphPayload = {
  nodes: Node[]
  edges: Edge[]
  lanes: Tables<'process_lanes'>[]
  editingLock: Tables<'editing_locks'> | null
}

interface ProcessGraphStore extends ProcessGraphPayload {
  isActiveEditor: boolean
  setGraph(payload: ProcessGraphPayload): void
  setEditingLock(lock: Tables<'editing_locks'> | null, participantId?: string): void
  refetchAll(workshopId: string, participantId?: string): Promise<void>
}

export const useProcessGraphStore = create<ProcessGraphStore>()(
  devtools(
    (set) => ({
      nodes: [],
      edges: [],
      lanes: [],
      editingLock: null,
      isActiveEditor: false,

      setGraph: (payload) =>
        set({
          ...payload,
        }),

      setEditingLock: (editingLock, participantId) =>
        set({
          editingLock,
          isActiveEditor: Boolean(
            participantId && editingLock && editingLock.editor_id === participantId,
          ),
        }),

      refetchAll: async (workshopId, participantId) => {
        const response = await fetch(`/api/workshops/${workshopId}/process-graph`)
        if (!response.ok) {
          return
        }

        const payload = await response.json()
        const data = payload.data as ProcessGraphPayload
        set({
          ...data,
          isActiveEditor: Boolean(
            participantId && data.editingLock && data.editingLock.editor_id === participantId,
          ),
        })
      },
    }),
    { name: 'process-graph-store' },
  ),
)
