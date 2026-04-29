'use client'

import { Loader2, RefreshCcw, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ClusterGroup } from './ClusterGroup'
import { getTotalScore } from './ClusterScoring'
import { AiProgressIndicator } from '@/components/common/AiProgressIndicator'
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
  const sortedClusters = useMemo(() => {
    return [...clusters].sort((a, b) => {
      const scoreA = getTotalScore(a) ?? -1
      const scoreB = getTotalScore(b) ?? -1
      if (scoreA !== scoreB) return scoreB - scoreA
      return a.order_index - b.order_index
    })
  }, [clusters])
  const canRunAi = isFacilitator && workshop.current_stage === 'cluster'
  const canEdit = isFacilitator && workshop.current_stage !== 'completed'
  const canScore = workshop.current_stage !== 'completed'
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
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 600_000)
    setIsRunning(true)
    try {
      const response = await fetch('/api/ai/cluster', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workshop_id: workshop.id }),
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(payload?.error?.message ?? 'AI 클러스터링에 실패했습니다.')
        await refetchWorkshop(workshop.id)
        return
      }

      setClusters(payload.data as ClusterWithNotes[])
      await Promise.all([refetchNotes(workshop.id), refetchWorkshop(workshop.id)])
      toast.success('AI 클러스터링이 완료되었습니다.')
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        toast.error('AI 클러스터링 요청이 시간 초과되었습니다. 다시 시도해주세요.')
      } else {
        toast.error('AI 클러스터링에 실패했습니다. 다시 시도해주세요.')
      }
      await refetchWorkshop(workshop.id).catch(() => {})
    } finally {
      clearTimeout(timer)
      setIsRunning(false)
    }
  }

  return (
    <main className="min-h-screen bg-canvas-parchment p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
        <div>
          <p className="text-sm text-ink-muted-48">현재 보는 단계</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal">이슈 구조화</h2>
          {clusters.length > 0 ? (
            <p className="mt-2 text-sm text-ink-muted-48">
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
            className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-canvas-parchment disabled:text-ink-muted-48"
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
        <div className="mb-4 rounded-apple-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-700">
            기존 클러스터를 유지하면서 미할당 포스트잇 {unassignedCount}개를 다시 분석합니다.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void runClustering()}
              className="rounded-full bg-amber-400 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-300"
            >
              실행
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="rounded-full border border-hairline px-3 py-2 text-sm text-ink hover:bg-canvas-parchment"
            >
              취소
            </button>
          </div>
        </div>
      ) : null}

      {isProcessing ? (
        <AiProgressIndicator
          isActive
          title="AI가 포스트잇을 분석하고 있습니다"
          className="mb-4"
          steps={[
            { label: '포스트잇 데이터 수집', estimatedSeconds: 3 },
            { label: '유사도 분석 및 그룹핑', estimatedSeconds: 10 },
            { label: '클러스터 이름 생성', estimatedSeconds: 7 },
            { label: '결과 저장', estimatedSeconds: 3 },
          ]}
        />
      ) : null}

      {clusters.length === 0 ? (
        <div className="rounded-apple-lg border border-dashed border-hairline bg-surface-pearl p-8 text-center">
          <p className="text-sm text-ink-muted-80">
            {isFacilitator
              ? 'AI 클러스터링을 시작하면 포스트잇이 대주제별로 정리됩니다.'
              : '퍼실리테이터가 클러스터링을 시작할 때까지 대기 중입니다.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedClusters.map((cluster) => (
            <ClusterGroup
              key={cluster.id}
              cluster={cluster}
              canEdit={canEdit}
              canScore={canScore}
              onUpdated={() => void refetchClusters(workshop.id)}
            />
          ))}
        </div>
      )}
    </main>
  )
}
