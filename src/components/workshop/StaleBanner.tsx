'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { WorkshopStage } from '@/types/workshop'

type StaleTable = 'clusters' | 'design_artifacts' | 'prds' | 'ax_reports'

const STALE_BY_STAGE: Partial<Record<WorkshopStage, StaleTable>> = {
  cluster: 'clusters',
  design: 'design_artifacts',
  generate: 'prds',
  report: 'ax_reports',
}

const MESSAGES: Record<StaleTable, string> = {
  clusters: '포스트잇이 수정되었습니다. 클러스터링 결과가 최신이 아닐 수 있습니다.',
  design_artifacts: '이전 단계 데이터가 변경되었습니다. AX 설계 결과가 최신이 아닐 수 있습니다.',
  prds: '설계 산출물이 변경되었습니다. PRD가 최신이 아닐 수 있습니다.',
  ax_reports: '워크샵 데이터가 변경되었습니다. 종합 보고서가 최신이 아닐 수 있습니다.',
}

const AI_ENDPOINTS: Record<StaleTable, string> = {
  clusters: '/api/ai/cluster',
  design_artifacts: '/api/ai/design',
  prds: '/api/ai/generate',
  ax_reports: '/api/ai/report',
}

export function StaleBanner({
  workshopId,
  stage,
  isFacilitator,
}: {
  workshopId: string
  stage: WorkshopStage
  isFacilitator: boolean
}) {
  const [stale, setStale] = useState<Record<StaleTable, boolean> | null>(null)
  const table = STALE_BY_STAGE[stage]

  useEffect(() => {
    let cancelled = false
    async function refetch() {
      const response = await fetch(`/api/workshops/${workshopId}/summary`)
      if (!response.ok) {
        return
      }
      const payload = await response.json()
      if (!cancelled) {
        setStale(payload.data.stale)
      }
    }
    void refetch()
    return () => {
      cancelled = true
    }
  }, [workshopId, stage])

  if (!table || !stale?.[table]) {
    return null
  }
  const activeTable = table

  async function rerunAi() {
    const response = await fetch(AI_ENDPOINTS[activeTable], {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workshop_id: workshopId }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      toast.error(payload?.error?.message ?? 'AI 재실행에 실패했습니다.')
      return
    }
    toast.success('AI 재실행이 완료되었습니다.')
    setStale((current) => (current ? { ...current, [activeTable]: false } : current))
  }

  async function dismiss() {
    const response = await fetch(`/api/workshops/${workshopId}/dismiss-stale`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ table: activeTable }),
    })
    if (!response.ok) {
      toast.error('현재 결과 유지 처리에 실패했습니다.')
      return
    }
    setStale((current) => (current ? { ...current, [activeTable]: false } : current))
  }

  return (
    <div className="m-6 mb-0 rounded-apple-lg border border-amber-300 bg-amber-50 p-3 text-amber-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6">{MESSAGES[activeTable]}</p>
        {isFacilitator ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void rerunAi()}
              className="rounded-full bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-400"
            >
              AI 재실행 권장
            </button>
            <button
              type="button"
              onClick={() => void dismiss()}
              className="rounded-full border border-amber-400 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-100"
            >
              현재 결과 유지
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
