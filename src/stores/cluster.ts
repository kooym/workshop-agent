import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ClusterWithNotes } from '@/types/cluster'

interface ClusterStore {
  clusters: ClusterWithNotes[]
  setClusters(clusters: ClusterWithNotes[]): void
  refetchAll(workshopId: string): Promise<void>
}

export const useClusterStore = create<ClusterStore>()(
  devtools(
    (set) => ({
      clusters: [],

      setClusters: (clusters) =>
        set({
          clusters: sortClusters(clusters),
        }),

      refetchAll: async (workshopId) => {
        const response = await fetch(`/api/clusters?workshop_id=${workshopId}`)
        if (!response.ok) {
          return
        }

        const payload = await response.json()
        set({ clusters: sortClusters(payload.data as ClusterWithNotes[]) })
      },
    }),
    { name: 'cluster-store' },
  ),
)

function sortClusters(clusters: ClusterWithNotes[]) {
  return [...clusters].sort((left, right) => left.order_index - right.order_index)
}
