'use client'

import { Eye, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { VoteResult } from './VoteResult'
import { VotingCard } from './VotingCard'
import { useBoardStore } from '@/stores/board'
import { useClusterStore } from '@/stores/cluster'
import { useVoteStore } from '@/stores/vote'
import { useWorkshopStore } from '@/stores/workshop'
import type { VoteResultRow } from '@/types/vote'
import type { Workshop } from '@/types/workshop'

type VoteStats = {
  total_participants: number
  voted_participants: number
  participation_rate: number
}

export function DotVoting({
  workshop,
  isFacilitator,
}: {
  workshop: Workshop
  isFacilitator: boolean
}) {
  const clusters = useClusterStore((state) => state.clusters)
  const refetchClusters = useClusterStore((state) => state.refetchAll)
  const notes = useBoardStore((state) => state.notes)
  const refetchNotes = useBoardStore((state) => state.refetchAll)
  const myVotes = useVoteStore((state) => state.myVotes)
  const remainingVotes = useVoteStore((state) => state.remainingVotes)
  const votesPerPerson = useVoteStore((state) => state.votesPerPerson)
  const refetchVotes = useVoteStore((state) => state.refetchAll)
  const castVote = useVoteStore((state) => state.castVote)
  const removeVote = useVoteStore((state) => state.removeVote)
  const refetchWorkshop = useWorkshopStore((state) => state.refetchAll)
  const [results, setResults] = useState<VoteResultRow[]>([])
  const [resultsVisible, setResultsVisible] = useState(workshop.settings.results_visible)
  const [stats, setStats] = useState<VoteStats | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const voteMode = workshop.settings.vote_mode
  const usedVotes = votesPerPerson - remainingVotes
  const clusterNames = useMemo(
    () => new Map(clusters.map((cluster) => [cluster.id, cluster.name] as const)),
    [clusters],
  )

  const refetchResults = useCallback(async () => {
    const response = await fetch(`/api/votes/results?workshop_id=${workshop.id}`)
    if (!response.ok) {
      return
    }
    const payload = await response.json()
    setResultsVisible(payload.data.visible)
    setResults(payload.data.results)
  }, [workshop.id])

  const refetchStats = useCallback(async () => {
    const response = await fetch(`/api/votes/stats?workshop_id=${workshop.id}`)
    if (!response.ok) {
      return
    }
    const payload = await response.json()
    setStats(payload.data)
  }, [workshop.id])

  // Sync from realtime workshop updates (e.g. facilitator toggles results_visible)
  useEffect(() => {
    setResultsVisible(workshop.settings.results_visible)
    if (workshop.settings.results_visible) {
      void refetchResults()
    }
  }, [workshop.settings.results_visible, refetchResults])

  useEffect(() => {
    void Promise.all([
      refetchClusters(workshop.id),
      refetchNotes(workshop.id),
      refetchVotes(workshop.id),
      refetchResults(),
      refetchStats(),
    ])
  }, [refetchClusters, refetchNotes, refetchResults, refetchStats, refetchVotes, workshop.id])

  async function handleVote(targetId: string) {
    setIsBusy(true)
    const ok = await castVote(workshop.id, voteMode, targetId)
    setIsBusy(false)
    await Promise.all([refetchResults(), refetchStats()])
    if (!ok) {
      toast.error('투표를 반영하지 못했습니다.')
    }
  }

  async function handleRemoveVote(voteId: string) {
    setIsBusy(true)
    const ok = await removeVote(workshop.id, voteId)
    setIsBusy(false)
    await Promise.all([refetchResults(), refetchStats()])
    if (!ok) {
      toast.error('투표 취소에 실패했습니다.')
    }
  }

  async function revealResults() {
    setIsBusy(true)
    const response = await fetch(`/api/workshops/${workshop.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ settings: { results_visible: true } }),
    })
    setIsBusy(false)
    if (!response.ok) {
      toast.error('결과 공개에 실패했습니다.')
      return
    }

    await Promise.all([refetchWorkshop(workshop.id), refetchVotes(workshop.id), refetchResults()])
    toast.success('투표 결과를 공개했습니다.')
  }

  return (
    <main className="min-h-screen bg-canvas-parchment p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
        <div>
          <p className="text-sm text-ink-muted-48">현재 보는 단계</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal">우선순위 결정</h2>
          <p className="mt-2 text-sm text-ink-muted-48">
            {votesPerPerson}표 중 {usedVotes}표 사용
          </p>
          {isFacilitator && stats ? (
            <p className="mt-1 text-sm text-ink-muted-48">
              {stats.voted_participants}/{stats.total_participants}명 투표 완료 ·{' '}
              {stats.participation_rate}%
            </p>
          ) : null}
        </div>
        {isFacilitator && !workshop.settings.results_visible ? (
          <button
            type="button"
            onClick={() => void revealResults()}
            disabled={isBusy}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-white hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-canvas-parchment disabled:text-ink-muted-48"
          >
            {isBusy ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <Eye aria-hidden className="h-4 w-4" />
            )}
            결과 공개
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <section className="grid gap-4 md:grid-cols-2">
          {voteMode === 'cluster'
            ? clusters.map((cluster) => (
                <VotingCard
                  key={cluster.id}
                  mode="cluster"
                  cluster={cluster}
                  existingVote={myVotes.find((vote) => vote.cluster_id === cluster.id)}
                  remainingVotes={remainingVotes}
                  disabled={isBusy || workshop.current_stage === 'completed'}
                  onVote={() => void handleVote(cluster.id)}
                  onRemoveVote={(voteId) => void handleRemoveVote(voteId)}
                />
              ))
            : notes.map((note) => (
                <VotingCard
                  key={note.id}
                  mode="note"
                  note={note}
                  clusterName={note.cluster_id ? clusterNames.get(note.cluster_id) : undefined}
                  existingVote={myVotes.find((vote) => vote.note_id === note.id)}
                  remainingVotes={remainingVotes}
                  disabled={isBusy || workshop.current_stage === 'completed'}
                  onVote={() => void handleVote(note.id)}
                  onRemoveVote={(voteId) => void handleRemoveVote(voteId)}
                />
              ))}
        </section>
        <aside>
          <VoteResult visible={resultsVisible} results={results} />
        </aside>
      </div>
    </main>
  )
}
