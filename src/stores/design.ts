import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Tables } from '@/lib/supabase/types'

interface DesignStore {
  designArtifact: Tables<'design_artifacts'> | null
  tasks: Tables<'ax_tasks'>[]
  reactionRevision: number
  setDesignPayload(payload: {
    design_artifact: Tables<'design_artifacts'> | null
    tasks: Tables<'ax_tasks'>[]
  }): void
  bumpReactionRevision(): void
  refetchAll(workshopId: string): Promise<void>
}

export const useDesignStore = create<DesignStore>()(
  devtools(
    (set) => ({
      designArtifact: null,
      tasks: [],
      reactionRevision: 0,

      setDesignPayload: (payload) =>
        set({
          designArtifact: payload.design_artifact,
          tasks: payload.tasks,
        }),

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
          designArtifact: payload.data.design_artifact,
          tasks: payload.data.tasks,
        })
      },
    }),
    { name: 'design-store' },
  ),
)
