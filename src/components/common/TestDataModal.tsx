'use client'

import { Loader2, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const PRESETS = [
  { label: '은행 대출 심사', scenario: '은행 대출 심사 프로세스 — 고객이 대출을 신청하면 서류 접수, 신용 평가, 심사 위원회 검토, 승인/거절 통지를 거치는 과정' },
  { label: '보험금 청구', scenario: '보험금 청구 처리 프로세스 — 고객이 보험금을 청구하면 접수, 손해사정, 보상 심사, 지급/거절을 거치는 과정' },
  { label: 'IT 서비스 데스크', scenario: 'IT 서비스 데스크 요청 처리 — 직원이 IT 지원을 요청하면 접수, 분류, 담당자 배정, 해결, 만족도 조사를 거치는 과정' },
  { label: '채용 프로세스', scenario: '채용 프로세스 — 채용 요청부터 공고, 서류 심사, 면접(1·2차), 합격 통보, 온보딩까지의 과정' },
  { label: '고객 불만 처리', scenario: '고객 불만 처리 프로세스 — 고객 불만 접수, 원인 분석, 보상 결정, 처리 완료 및 재발 방지까지의 과정' },
]

export function TestDataModal({
  workshopId,
  mode,
  onClose,
  onComplete,
}: {
  workshopId: string
  mode: 'process' | 'notes' | 'both'
  onClose(): void
  onComplete(): void
}) {
  const [scenario, setScenario] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isRunning) onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isRunning, onClose])

  async function handleGenerate() {
    const trimmed = scenario.trim()
    if (!trimmed) return

    setIsRunning(true)
    try {
      const response = await fetch('/api/ai/test-data', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workshop_id: workshopId, scenario: trimmed, mode }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(payload?.error?.message ?? '테스트 데이터 생성에 실패했습니다.')
        return
      }

      const parts: string[] = []
      if (payload.data.processSteps) parts.push(`프로세스 노드 ${payload.data.processSteps}개`)
      if (payload.data.lanes) parts.push(`레인 ${payload.data.lanes}개`)
      if (payload.data.edges) parts.push(`간선 ${payload.data.edges}개`)
      if (payload.data.notes) parts.push(`포스트잇 ${payload.data.notes}개`)
      toast.success(`테스트 데이터 생성 완료: ${parts.join(', ')}`)
      onComplete()
      onClose()
    } catch {
      toast.error('테스트 데이터 생성에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsRunning(false)
    }
  }

  const modeLabel =
    mode === 'process' ? 'AS-IS 프로세스' : mode === 'notes' ? '포스트잇' : '프로세스 + 포스트잇'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-apple-lg border border-hairline bg-white p-5 shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">
              AI 테스트 데이터 생성
            </h2>
            <p className="mt-1 text-sm text-ink-muted-48">
              시나리오를 입력하면 AI가 {modeLabel} 테스트 데이터를 생성합니다.
            </p>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            disabled={isRunning}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted-48 hover:bg-surface-pearl hover:text-ink disabled:opacity-50"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        {/* Presets */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setScenario(preset.scenario)}
              disabled={isRunning}
              className="rounded-full border border-hairline px-2.5 py-1 text-xs text-ink-muted-80 transition hover:bg-surface-pearl disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <div className="mt-3">
          <label htmlFor="test-scenario" className="text-xs text-ink-muted-48">
            시나리오 설명
          </label>
          <textarea
            ref={textareaRef}
            id="test-scenario"
            value={scenario}
            onChange={(e) => setScenario(e.target.value.slice(0, 500))}
            maxLength={500}
            rows={4}
            disabled={isRunning}
            placeholder="예: 은행 대출 심사 프로세스..."
            className="mt-1 w-full rounded-full border border-hairline bg-canvas-parchment px-3 py-2 text-sm text-ink placeholder:text-ink-muted-48 outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="mt-1 text-right text-[11px] text-ink-muted-48">
            {scenario.length}/500
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="rounded-full border border-hairline px-3 py-2 text-sm text-ink hover:bg-surface-pearl disabled:cursor-not-allowed disabled:text-ink-muted-48"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={isRunning || !scenario.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-surface-pearl disabled:text-ink-muted-48"
          >
            {isRunning ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles aria-hidden className="h-4 w-4" />
            )}
            {isRunning ? '생성 중...' : '생성'}
          </button>
        </div>
      </div>
    </div>
  )
}
