import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Tables } from '@/lib/supabase/types'

interface DesignStore {
  designArtifacts: Tables<'design_artifacts'>[]
  tasks: Tables<'ax_tasks'>[]
  selectedAlternativeIndex: number
  reactionRevision: number
  setDesignPayload(payload: {
    design_artifacts: Tables<'design_artifacts'>[]
    tasks: Tables<'ax_tasks'>[]
  }): void
  setSelectedAlternativeIndex(index: number): void
  bumpReactionRevision(): void
  refetchAll(workshopId: string): Promise<void>
}

export const useDesignStore = create<DesignStore>()(
  devtools(
    (set) => ({
      designArtifacts: [],
      tasks: [],
      selectedAlternativeIndex: 0,
      reactionRevision: 0,

      setDesignPayload: (payload) =>
        set({
          designArtifacts: payload.design_artifacts,
          tasks: payload.tasks,
        }),

      setSelectedAlternativeIndex: (index) =>
        set({ selectedAlternativeIndex: index }),

      bumpReactionRevision: () =>
        set((state) => ({
          reactionRevision: state.reactionRevision + 1,
        })),

      refetchAll: async (workshopId) => {
        const response = await fetch(`/api/workshops/${workshopId}/design-artifacts`)
        if (!response.ok) {
          return
        }

        const payload = await response.json()
        set({
          designArtifacts: payload.data.design_artifacts,
          tasks: payload.data.tasks,
        })
      },
    }),
    { name: 'design-store' },
  ),
)
