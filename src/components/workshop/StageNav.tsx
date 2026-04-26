'use client'

import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { getNextStage, getStageIndex } from '@/lib/workshop/stage'
import { STAGE_ORDER, useWorkshopStore } from '@/stores/workshop'
import type { WorkshopStage } from '@/types/workshop'

const STAGE_LABELS: Record<WorkshopStage, string> = {
  context: '프로세스',
  gather: '수집',
  cluster: '클러스터',
  vote: '투표',
  design: '설계',
  generate: 'PRD',
  report: '보고서',
  completed: '완료',
}

export function StageNav() {
  const workshop = useWorkshopStore((state) => state.workshop)
  const viewingStage = useWorkshopStore((state) => state.viewingStage)
  const isFacilitator = useWorkshopStore((state) => state.isFacilitator)
  const setViewingStage = useWorkshopStore((state) => state.setViewingStage)
  const updateStage = useWorkshopStore((state) => state.updateStage)
  const [error, setError] = useState('')
  const [isAdvancing, setIsAdvancing] = useState(false)

  if (!workshop) {
    return null
  }

  const nextStage = getNextStage(workshop.current_stage)

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
      setError(payload.error?.message ?? '단계 전환에 실패했습니다.')
      return
    }

    updateStage(payload.data.current_stage)
  }

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-neutral-200">단계</h2>
      <nav className="mt-3 space-y-1">
        {STAGE_ORDER.map((stage) => {
          const isReachable = getStageIndex(stage) <= getStageIndex(workshop.current_stage)
          const isSelected = viewingStage === stage
          return (
            <button
              key={stage}
              type="button"
              disabled={!isReachable}
              onClick={() => setViewingStage(stage)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                isSelected
                  ? 'bg-sky-600 text-white'
                  : isReachable
                    ? 'text-neutral-200 hover:bg-neutral-800'
                    : 'cursor-not-allowed text-neutral-600'
              }`}
            >
              {STAGE_LABELS[stage]}
            </button>
          )
        })}
      </nav>

      {isFacilitator && nextStage ? (
        <button
          type="button"
          onClick={advanceStage}
          disabled={isAdvancing}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-100 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:text-neutral-500"
        >
          {isAdvancing ? '전환 중' : '다음 단계로'}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </button>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
    </div>
  )
}
