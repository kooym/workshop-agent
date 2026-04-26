'use client'

import { Loader2, RefreshCcw, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ClusterGroup } from './ClusterGroup'
import { useBoardStore } from '@/stores/board'
import { useClusterStore } from '@/stores/cluster'
import { useWorkshopStore } from '@/stores/workshop'
import type { ClusterWithNotes } from '@/types/cluster'
import type { Workshop } from '@/types/workshop'

export function ClusterView({
  workshop,
  isFacilitator,
}: {
  workshop: Workshop
  isFacilitator: boolean
}) {
  const clusters = useClusterStore((state) => state.clusters)
  const setClusters = useClusterStore((state) => state.setClusters)
  const refetchClusters = useClusterStore((state) => state.refetchAll)
  const notes = useBoardStore((state) => state.notes)
  const refetchNotes = useBoardStore((state) => state.refetchAll)
  const refetchWorkshop = useWorkshopStore((state) => state.refetchAll)
  const [isRunning, setIsRunning] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const unassignedCount = useMemo(
    () => notes.filter((note) => !note.cluster_id).length,
    [notes],
  )
  const canRunAi = isFacilitator && workshop.current_stage === 'cluster'
  const canEdit = isFacilitator && workshop.current_stage !== 'completed'
  const isProcessing = workshop.is_processing || isRunning

  useEffect(() => {
    void refetchClusters(workshop.id)
    void refetchNotes(workshop.id)
  }, [refetchClusters, refetchNotes, workshop.id])

  async function runClustering() {
    if (!canRunAi || isProcessing) {
      return
    }

    if (clusters.length > 0 && unassignedCount === 0) {
      toast.info('모든 포스트잇이 이미 분류되었습니다.')
      return
    }

    setShowConfirm(false)
    setIsRunning(true)
    const response = await fetch('/api/ai/cluster', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workshop_id: workshop.id }),
    })
    const payload = await response.json().catch(() => null)
    setIsRunning(false)

    if (!response.ok) {
      toast.error(payload?.error?.message ?? 'AI 클러스터링에 실패했습니다.')
      await refetchWorkshop(workshop.id)
      return
    }

    setClusters(payload.data as ClusterWithNotes[])
    await Promise.all([refetchNotes(workshop.id), refetchWorkshop(workshop.id)])
    toast.success('AI 클러스터링이 완료되었습니다.')
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-neutral-800 pb-4">
        <div>
          <p className="text-sm text-neutral-500">현재 보는 단계</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal">cluster</h2>
          {clusters.length > 0 ? (
            <p className="mt-2 text-sm text-neutral-400">
              클러스터 {clusters.length}개 · 미할당 포스트잇 {unassignedCount}개
            </p>
          ) : null}
        </div>
        {isFacilitator ? (
          <button
            type="button"
            onClick={() => {
              if (clusters.length > 0) {
                setShowConfirm(true)
                return
              }
              void runClustering()
            }}
            disabled={!canRunAi || isProcessing}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            {isProcessing ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : clusters.length > 0 ? (
              <RefreshCcw aria-hidden className="h-4 w-4" />
            ) : (
              <Sparkles aria-hidden className="h-4 w-4" />
            )}
            {clusters.length > 0 ? 'AI 재클러스터링' : 'AI 클러스터링 시작'}
          </button>
        ) : null}
      </div>

      {showConfirm ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-100">
            기존 클러스터를 유지하면서 미할당 포스트잇 {unassignedCount}개를 다시 분석합니다.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void runClustering()}
              className="rounded-md bg-amber-400 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-300"
            >
              실행
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900"
            >
              취소
            </button>
          </div>
        </div>
      ) : null}

      {isProcessing ? (
        <div className="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-100">
          <span className="inline-flex items-center gap-2">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            AI가 분석 중입니다...
          </span>
        </div>
      ) : null}

      {clusters.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-800 bg-neutral-900/50 p-8 text-center">
          <p className="text-sm text-neutral-300">
            {isFacilitator
              ? 'AI 클러스터링을 시작하면 포스트잇이 대주제별로 정리됩니다.'
              : '퍼실리테이터가 클러스터링을 시작할 때까지 대기 중입니다.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {clusters.map((cluster) => (
            <ClusterGroup
              key={cluster.id}
              cluster={cluster}
              canEdit={canEdit}
              onUpdated={() => void refetchClusters(workshop.id)}
            />
          ))}
        </div>
      )}
    </main>
  )
}
