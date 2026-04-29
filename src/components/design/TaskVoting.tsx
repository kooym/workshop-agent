'use client'

import { Crown, ThumbsUp } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Tables } from '@/lib/supabase/types'


type TaskVoteCount = Record<string, number>

export function TaskVoting({
  tasks,
  workshopId,
  isFacilitator,
  onDone,
}: {
  tasks: Tables<'ax_tasks'>[]
  workshopId: string
  isFacilitator: boolean
  onDone(): void
}) {
  const [voteCounts, setVoteCounts] = useState<TaskVoteCount>({})
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [finalizing, setFinalizing] = useState(false)
  const [tiedTaskIds, setTiedTaskIds] = useState<string[] | null>(null)

  // Only show is_selected tasks from Step 1
  const visibleTasks = tasks.filter((t) => t.is_selected && !t.is_bundle)

  const fetchVotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/votes?workshop_id=${workshopId}`)
      if (!res.ok) return
      const { data } = await res.json()
      const allVotes = (data.votes ?? []) as { task_id: string | null; participant_id: string }[]
      const myVoteList = (data.my_votes ?? []) as { task_id: string | null }[]
      const counts: TaskVoteCount = {}
      const mine = new Set<string>()
      for (const v of allVotes) {
        if (!v.task_id) continue
        counts[v.task_id] = (counts[v.task_id] ?? 0) + 1
      }
      for (const v of myVoteList) {
        if (v.task_id) mine.add(v.task_id)
      }
      setVoteCounts(counts)
      setMyVotes(mine)
    } finally {
      setLoading(false)
    }
  }, [workshopId])

  useEffect(() => {
    void fetchVotes()
  }, [fetchVotes])

  async function toggleVote(taskId: string) {
    if (myVotes.has(taskId)) {
      const res = await fetch(`/api/votes?workshop_id=${workshopId}&task_id=${taskId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        toast.error('투표 취소에 실패했습니다.')
        return
      }
      setMyVotes((prev) => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
      setVoteCounts((prev) => ({
        ...prev,
        [taskId]: Math.max(0, (prev[taskId] ?? 0) - 1),
      }))
    } else {
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workshop_id: workshopId, task_id: taskId }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        toast.error(payload?.error?.message ?? '투표에 실패했습니다.')
        return
      }
      setMyVotes((prev) => new Set(prev).add(taskId))
      setVoteCounts((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] ?? 0) + 1,
      }))
    }
  }

  async function finalizeVote(winnerTaskId?: string) {
    setFinalizing(true)
    try {
      const res = await fetch(`/api/workshops/${workshopId}/finalize-vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(winnerTaskId ? { winner_task_id: winnerTaskId } : {}),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        if (res.status === 409 && payload?.error?.message) {
          try {
            const info = JSON.parse(payload.error.message)
            if (info.tied_task_ids) {
              setTiedTaskIds(info.tied_task_ids)
              toast.info(`동점 과제 ${info.tied_task_ids.length}개 — 1개를 선택해주세요.`)
              return
            }
          } catch { /* not tie info */ }
        }
        toast.error(payload?.error?.message ?? '투표 마감에 실패했습니다.')
        return
      }
      setTiedTaskIds(null)
      toast.success('투표가 마감되었습니다.')
      onDone()
    } finally {
      setFinalizing(false)
    }
  }

  if (loading) {
    return <div className="animate-pulse rounded-apple-lg bg-surface-pearl p-8 text-center text-sm text-ink-muted-48">투표 데이터 불러오는 중...</div>
  }

  // Determine current leader
  const maxVotes = Math.max(0, ...Object.values(voteCounts))
  const leaderIds = maxVotes > 0
    ? Object.entries(voteCounts).filter(([, c]) => c === maxVotes).map(([id]) => id)
    : []
  const hasVotes = Object.values(voteCounts).some((c) => c > 0)

  const sortedTasks = [...visibleTasks].sort(
    (a, b) => (voteCounts[b.id] ?? 0) - (voteCounts[a.id] ?? 0),
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm text-ink-muted-80">
            👍 투표로 가장 중요한 과제를 선정하세요
          </p>
          <p className="text-xs text-ink-muted-48">
            투표 1위가 최종 과제로 선정됩니다 (동점 시 퍼실리테이터 결정)
          </p>
        </div>
        {isFacilitator && hasVotes && !tiedTaskIds ? (
          <button
            type="button"
            onClick={() => void finalizeVote()}
            disabled={finalizing}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-focus disabled:opacity-50"
          >
            {finalizing ? '마감 중...' : '투표 마감 → 1위 확정'}
          </button>
        ) : null}
      </div>

      {tiedTaskIds ? (
        <div className="rounded-apple-lg border border-amber-300 bg-amber-50 p-3">
          <p className="mb-2 text-sm font-medium text-amber-800">
            🏆 동점 과제가 {tiedTaskIds.length}개 있습니다. 1개를 선택해주세요:
          </p>
          <div className="flex flex-wrap gap-2">
            {tiedTaskIds.map((tid) => {
              const t = visibleTasks.find((x) => x.id === tid)
              return (
                <button
                  key={tid}
                  type="button"
                  onClick={() => void finalizeVote(tid)}
                  disabled={finalizing}
                  className="rounded-full border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  {t?.title ?? tid.slice(0, 8)}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {sortedTasks.map((task) => {
          const count = voteCounts[task.id] ?? 0
          const voted = myVotes.has(task.id)
          const isLeader = leaderIds.includes(task.id) && maxVotes > 0
          const isTied = tiedTaskIds?.includes(task.id) ?? false

          return (
            <div
              key={task.id}
              className={`rounded-apple-lg border p-4 transition ${
                isTied
                  ? 'border-amber-400 bg-amber-50/50'
                  : isLeader
                    ? 'border-yellow-400 bg-yellow-50/50'
                    : 'border-hairline bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                {isLeader ? (
                  <Crown aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                ) : (
                  <span className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-ink">{task.title}</h4>
                    {isLeader ? (
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold text-yellow-700">
                        1위
                      </span>
                    ) : null}
                  </div>
                  {task.description ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-muted-48">{task.description}</p>
                  ) : null}
                  {task.kpi_name ? (
                    <span className="mt-1.5 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                      KPI: {task.kpi_name}
                    </span>
                  ) : null}
                </div>
                {/* Thumbs-up vote button */}
                <button
                  type="button"
                  onClick={() => void toggleVote(task.id)}
                  title={voted ? '투표 취소' : '투표'}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    voted ? 'bg-primary text-white' : 'bg-canvas-parchment text-ink-muted-80 hover:bg-primary/10 hover:text-primary'
                  }`}
                >
                  <ThumbsUp aria-hidden className="h-3 w-3" />
                  {count}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
