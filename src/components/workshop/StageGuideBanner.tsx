'use client'

import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { WorkshopStage } from '@/types/workshop'

const GUIDE: Record<WorkshopStage, string> = {
  context: '현행 업무 프로세스를 단계별로 정리합니다.',
  gather: '각 프로세스 단계에서 겪는 문제점, 필요사항을 포스트잇에 작성해주세요.',
  cluster: '포스트잇을 AI가 의미 기반으로 분류합니다.',
  vote: '가장 중요한 주제에 투표해주세요.',
  design: 'AS-IS 분석과 투표 결과를 기반으로 AI가 TO-BE 프로세스와 과제를 설계했습니다.',
  generate: 'Agent 설계와 과제를 기반으로 생성된 PRD입니다. 동의/우려를 표시해주세요.',
  report: '워크샵 전체 데이터를 종합한 AX 도입 종합 보고서입니다.',
  completed: '워크샵이 완료되었습니다. 산출물을 읽기 전용으로 확인할 수 있습니다.',
}

export function StageGuideBanner({ stage }: { stage: WorkshopStage }) {
  const storageKey = `stage-guide-dismissed:${stage}`
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(localStorage.getItem(storageKey) === 'true')
  }, [storageKey])

  if (dismissed) {
    return null
  }

  return (
    <div className="m-6 mb-0 flex items-start justify-between gap-3 rounded-apple-lg border border-hairline bg-surface-pearl p-3">
      <p className="text-sm leading-6 text-ink">{GUIDE[stage]}</p>
      <button
        type="button"
        aria-label="안내 닫기"
        onClick={() => {
          localStorage.setItem(storageKey, 'true')
          setDismissed(true)
        }}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-muted-48 hover:bg-canvas-parchment hover:text-ink"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  )
}
