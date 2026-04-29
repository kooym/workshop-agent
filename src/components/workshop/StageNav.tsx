'use client'

import {
  ArrowRight,
  BarChart3,
  Cpu,
  FileText,
  Layers,
  ListOrdered,
  StickyNote,
  Vote,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { getNextStage, getStageIndex } from '@/lib/workshop/stage'
import { STAGE_ORDER, useWorkshopStore } from '@/stores/workshop'
import type { WorkshopStage } from '@/types/workshop'

const STAGE_LABELS: Record<WorkshopStage, string> = {
  context: '현황 진단',
  gather: '아이디어 발산',
  cluster: '이슈 구조화',
  vote: '우선순위 결정',
  design: 'AI 솔루션 설계',
  generate: 'MVP 명세',
  report: '최종 보고',
  completed: '완료',
}

const STAGE_ICONS = {
  context: ListOrdered,
  gather: StickyNote,
  cluster: Layers,
  vote: Vote,
  design: Cpu,
  generate: FileText,
  report: BarChart3,
  completed: BarChart3,
} satisfies Record<WorkshopStage, typeof ListOrdered>

type StageSummary = {
  counts: {
    process_steps: number
    notes: number
    clusters: number
    votes: number
    participants: number
    voted_participants: number
    tasks: number
  }
  latest_versions: {
    design_artifact: number | null
    prd: number | null
    report: number | null
  }
  stale: {
    clusters: boolean
    design_artifacts: boolean
    prds: boolean
    ax_reports: boolean
  }
}

export function StageNav() {
  const workshop = useWorkshopStore((state) => state.workshop)
  const viewingStage = useWorkshopStore((state) => state.viewingStage)
  const isFacilitator = useWorkshopStore((state) => state.isFacilitator)
  const setViewingStage = useWorkshopStore((state) => state.setViewingStage)
  const updateStage = useWorkshopStore((state) => state.updateStage)
  const refetchWorkshop = useWorkshopStore((state) => state.refetchAll)
  const participants = useWorkshopStore((state) => state.participants)
  const [error, setError] = useState('')
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [summary, setSummary] = useState<StageSummary | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!workshop) {
      return
    }
    let cancelled = false

    async function refetchInitialSummary() {
      const response = await fetch(`/api/workshops/${workshop?.id}/summary`)
      if (!response.ok) {
        return
      }
      const payload = await response.json()
      if (!cancelled) {
        setSummary(payload.data)
      }
    }

    void refetchInitialSummary()
    return () => {
      cancelled = true
    }
  }, [workshop])

  if (!workshop) {
    return null
  }

  const nextStage = getNextStage(workshop.current_stage)

  async function refetchSummary(workshopId: string) {
    const response = await fetch(`/api/workshops/${workshopId}/summary`)
    if (!response.ok) {
      return
    }
    const payload = await response.json()
    setSummary(payload.data)
  }

  async function advanceStage() {
    if (!workshop || !nextStage) {
      return
    }

    setError('')
    setIsAdvancing(true)
    const response = await fetch(`/api/workshops/${workshop.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ current_stage: nextStage }),
    })
    const payload = await response.json()
    setIsAdvancing(false)

    if (!response.ok) {
      const message = payload.error?.message ?? '단계 전환에 실패했습니다.'
      setError(message)
      toast.error(message)
      if (response.status === 409 && message.includes('이미 변경')) {
        toast.error('다른 변경이 감지되었습니다. 페이지를 새로고침합니다.')
        window.setTimeout(() => window.location.reload(), 1000)
      }
      return
    }

    updateStage(payload.data.current_stage)
    await refetchWorkshop(workshop.id)
    await refetchSummary(workshop.id)
    setConfirmOpen(false)
  }

  return (
    <div className="mt-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted-48">진행 단계</h2>
      <nav className="relative mt-3">
        {/* Vertical connecting line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-hairline" aria-hidden />
        <div className="space-y-0.5">
          {STAGE_ORDER.map((stage) => {
            const isReachable = getStageIndex(stage) <= getStageIndex(workshop.current_stage)
            const isCompleted = getStageIndex(stage) < getStageIndex(workshop.current_stage)
            const isSelected = viewingStage === stage
            const isCurrent = workshop.current_stage === stage
            const Icon = STAGE_ICONS[stage]
            const stale = hasStaleBadge(stage, summary)
            return (
              <button
                key={stage}
                type="button"
                disabled={!isReachable}
                onClick={() => setViewingStage(stage)}
                className={`relative flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                  isSelected
                    ? 'bg-primary/10 text-primary'
                    : isReachable
                      ? 'text-ink-muted-80 hover:bg-canvas-parchment'
                      : 'cursor-not-allowed text-ink-muted-48'
                }`}
              >
                {/* Step indicator dot */}
                <span
                  className={`relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : isCompleted
                        ? 'border-emerald-600 bg-emerald-600/20'
                        : isCurrent
                          ? 'border-primary bg-white'
                          : 'border-hairline bg-white'
                  }`}
                  aria-hidden
                >
                  <Icon className={`h-3.5 w-3.5 ${isCompleted ? 'text-emerald-600' : ''}`} />
                </span>
                <span className="flex-1">
                  <span className={`block text-sm font-medium ${isSelected ? 'text-primary' : ''}`}>
                    {STAGE_LABELS[stage]}
                  </span>
                  {isCurrent && !isCompleted && stage !== 'completed' ? (
                    <span className="block text-xs text-ink-muted-48">진행 중</span>
                  ) : null}
                </span>
                {stale ? (
                  <span
                    aria-label="최신 아님"
                    className="h-2 w-2 shrink-0 rounded-full bg-amber-400"
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      </nav>

      {isFacilitator && nextStage ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={isAdvancing}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-hairline px-3 py-2 text-sm text-ink hover:bg-canvas-parchment disabled:cursor-not-allowed disabled:text-ink-muted-48"
        >
          {isAdvancing ? '전환 중' : nextButtonLabel(workshop.current_stage, nextStage)}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </button>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {confirmOpen && nextStage ? (
        <ConfirmModal
          title={`${STAGE_LABELS[nextStage]} 단계로 전환`}
          description={transitionSummary(workshop.current_stage, nextStage, summary, participants.length)}
          confirmLabel={nextButtonLabel(workshop.current_stage, nextStage)}
          isBusy={isAdvancing}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void advanceStage()}
        />
      ) : null}
    </div>
  )
}

function hasStaleBadge(stage: WorkshopStage, summary: StageSummary | null) {
  if (!summary) {
    return false
  }
  if (stage === 'cluster') {
    return summary.stale.clusters
  }
  if (stage === 'design') {
    return summary.stale.design_artifacts
  }
  if (stage === 'generate') {
    return summary.stale.prds
  }
  if (stage === 'report') {
    return summary.stale.ax_reports
  }
  return false
}

function nextButtonLabel(current: WorkshopStage, next: WorkshopStage) {
  if (current === 'vote' && next === 'design') {
    return '투표 마감'
  }
  if (current === 'report' && next === 'completed') {
    return '워크샵 완료'
  }
  return '다음 단계로'
}

function transitionSummary(
  current: WorkshopStage,
  next: WorkshopStage,
  summary: StageSummary | null,
  participantCount: number,
) {
  const counts = summary?.counts
  if (current === 'context' && next === 'gather') {
    return `프로세스 단계 ${counts?.process_steps ?? 0}개 → pain point 수집을 시작합니다.`
  }
  if (current === 'gather' && next === 'cluster') {
    return `포스트잇 ${counts?.notes ?? 0}개, 참가자 ${participantCount}명 → AI 클러스터링을 시작합니다.`
  }
  if (current === 'cluster' && next === 'vote') {
    return `클러스터 ${counts?.clusters ?? 0}개 → 투표를 시작합니다.`
  }
  if (current === 'vote' && next === 'design') {
    return `투표 참여: ${counts?.voted_participants ?? 0}/${participantCount}명, 총 ${counts?.votes ?? 0}표 → AI AX 설계를 시작합니다.`
  }
  if (current === 'design' && next === 'generate') {
    return `과제 ${counts?.tasks ?? 0}개 + 설계 산출물 → AI PRD 생성을 시작합니다.`
  }
  if (current === 'generate' && next === 'report') {
    return `PRD v${summary?.latest_versions.prd ?? '-'} → AI 종합 보고서 생성을 시작합니다.`
  }
  if (current === 'report' && next === 'completed') {
    return `보고서 v${summary?.latest_versions.report ?? '-'} → 워크샵을 완료합니다. 모든 stale 플래그가 해제되어 있어야 합니다.`
  }
  return `${STAGE_LABELS[next]} 단계로 이동합니다.`
}
