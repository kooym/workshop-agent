import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Vote, VoteResult, VoteTargetType } from '@/types/vote'

interface VoteStore {
  votes: Vote[]
  myVotes: Vote[]
  remainingVotes: number
  resultsVisible: boolean
  votesPerPerson: number
  setVotes(votes: Vote[]): void
  setVoteSnapshot(snapshot: {
    votes: Vote[]
    my_votes: Vote[]
    visible: boolean
    votes_per_person: number
  }): void
  setResultsVisible(visible: boolean): void
  refetchAll(workshopId: string): Promise<void>
  castVote(workshopId: string, targetType: VoteTargetType, targetId: string): Promise<boolean>
  removeVote(workshopId: string, voteId: string): Promise<boolean>
  syncFromRealtime(eventType: string, vote: Vote): void
  getResultsByTarget(): VoteResult[]
}

export const useVoteStore = create<VoteStore>()(
  devtools(
    (set, get) => ({
      votes: [],
      myVotes: [],
      remainingVotes: 0,
      resultsVisible: false,
      votesPerPerson: 3,

      setVotes: (votes) => set({ votes }),

      setVoteSnapshot: (snapshot) =>
        set({
          votes: snapshot.votes,
          myVotes: snapshot.my_votes,
          resultsVisible: snapshot.visible,
          votesPerPerson: snapshot.votes_per_person,
          remainingVotes: Math.max(0, snapshot.votes_per_person - snapshot.my_votes.length),
        }),

      setResultsVisible: (visible) => set({ resultsVisible: visible }),

      refetchAll: async (workshopId) => {
        const response = await fetch(`/api/votes?workshop_id=${workshopId}`)
        if (!response.ok) {
          return
        }

        const payload = await response.json()
        get().setVoteSnapshot(payload.data)
      },

      castVote: async (workshopId, targetType, targetId) => {
        const response = await fetch('/api/votes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            workshop_id: workshopId,
            cluster_id: targetType === 'cluster' ? targetId : null,
            note_id: targetType === 'note' ? targetId : null,
          }),
        })

        await get().refetchAll(workshopId)
        return response.ok
      },

      removeVote: async (workshopId, voteId) => {
        const response = await fetch(`/api/votes?id=${voteId}&workshop_id=${workshopId}`, {
          method: 'DELETE',
        })

        await get().refetchAll(workshopId)
        return response.ok
      },

      syncFromRealtime: (eventType, vote) => {
        if (eventType === 'DELETE') {
          set((state) => {
            const wasMyVote = state.myVotes.some((existing) => existing.id === vote.id)
            const newMyVotes = state.myVotes.filter((existing) => existing.id !== vote.id)
            return {
              votes: state.votes.filter((existing) => existing.id !== vote.id),
              myVotes: newMyVotes,
              remainingVotes: wasMyVote
                ? Math.max(0, state.votesPerPerson - newMyVotes.length)
                : state.remainingVotes,
            }
          })
          return
        }

        if (eventType === 'INSERT') {
          set((state) => {
            const exists = state.votes.some((existing) => existing.id === vote.id)
            return {
              votes: exists ? state.votes : [...state.votes, vote],
            }
          })
        }
      },

      getResultsByTarget: () => {
        const votes = get().votes
        const counts = new Map<string, { targetType: VoteTargetType; count: number }>()

        votes.forEach((vote) => {
          const targetType: VoteTargetType = vote.cluster_id ? 'cluster' : 'note'
          const targetId = vote.cluster_id ?? vote.note_id
          if (!targetId) {
            return
          }

          const existing = counts.get(targetId)
          counts.set(targetId, {
            targetType,
            count: (existing?.count ?? 0) + 1,
          })
        })

        return Array.from(counts.entries())
          .map(([targetId, result]) => ({
            target_type: result.targetType,
            target_id: targetId,
            count: result.count,
            percentage: votes.length ? Math.round((result.count / votes.length) * 1000) / 10 : 0,
          }))
          .sort((left, right) => right.count - left.count)
      },
    }),
    { name: 'vote-store' },
  ),
)
