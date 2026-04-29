'use client'

import { Copy, FileDown, RefreshCcw, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AiProgressIndicator } from '@/components/common/AiProgressIndicator'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { MarkdownPreview } from '@/components/shared/MarkdownPreview'
import type { Tables } from '@/lib/supabase/types'
import type { Workshop } from '@/types/workshop'

export function ReportPreview({
  workshop,
  isFacilitator,
  onLoaded,
}: {
  workshop: Workshop
  isFacilitator: boolean
  onLoaded?(report: Tables<'ax_reports'> | null): void
}) {
  const [report, setReport] = useState<Tables<'ax_reports'> | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const canGenerate = isFacilitator && workshop.current_stage === 'report'
  const isProcessing = workshop.is_processing || isRunning

  useEffect(() => {
    let cancelled = false

    async function refetchReport() {
      const response = await fetch(`/api/workshops/${workshop.id}/reports`)
      if (!response.ok) {
        return
      }
      const payload = await response.json()
      if (!cancelled) {
        setReport(payload.data)
        onLoaded?.(payload.data)
      }
    }

    void refetchReport()
    return () => {
      cancelled = true
    }
  }, [onLoaded, workshop.id])

  async function runGenerate() {
    setConfirmOpen(false)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 600_000)
    setIsRunning(true)
    try {
      const response = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workshop_id: workshop.id }),
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(payload?.error?.message ?? 'AI 종합 보고서 생성에 실패했습니다.')
        return
      }

      setReport(payload.data)
      onLoaded?.(payload.data)
      toast.success('종합 보고서 생성이 완료되었습니다.')
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        toast.error('AI 보고서 생성 요청이 시간 초과되었습니다. 다시 시도해주세요.')
      } else {
        toast.error('AI 종합 보고서 생성에 실패했습니다. 다시 시도해주세요.')
      }
    } finally {
      clearTimeout(timer)
      setIsRunning(false)
    }
  }

  async function copyMarkdown() {
    if (!report) {
      return
    }
    await navigator.clipboard.writeText(report.content)
    toast.success('복사되었습니다.')
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">최종 보고서</h2>
          {report ? <p className="mt-2 text-sm text-ink-muted-48">최신 버전 v{report.version}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {report ? (
            <>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline px-3 text-sm text-ink-muted-80 hover:bg-canvas-parchment"
            >
              <FileDown aria-hidden className="h-4 w-4" />
              PDF 다운로드
            </button>
            <button
              type="button"
              onClick={() => void copyMarkdown()}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-hairline px-3 text-sm text-ink-muted-80 hover:bg-canvas-parchment"
            >
              <Copy aria-hidden className="h-4 w-4" />
              Markdown 복사
            </button>
            </>
          ) : null}
          {canGenerate ? (
            <button
              type="button"
              onClick={() => (report ? setConfirmOpen(true) : void runGenerate())}
              disabled={isProcessing}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-white hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-canvas-parchment disabled:text-ink-muted-48"
            >
              {report ? <RefreshCcw aria-hidden className="h-4 w-4" /> : <Sparkles aria-hidden className="h-4 w-4" />}
              {report ? 'AI 재생성' : '보고서 생성'}
            </button>
          ) : null}
        </div>
      </div>

      {isProcessing ? (
        <AiProgressIndicator
          isActive
          title="종합 보고서를 작성 중입니다"
          steps={[
            { label: '워크샵 데이터 수집', estimatedSeconds: 3 },
            { label: '보고서 내용 생성', estimatedSeconds: 35 },
            { label: '결과 검증 및 저장', estimatedSeconds: 5 },
          ]}
        />
      ) : null}

      {!report ? (
        <div className="rounded-apple-lg border border-dashed border-hairline bg-canvas-parchment/50 p-8 text-center">
          <p className="text-sm text-ink-muted-80">
            {isFacilitator
              ? '보고서 생성을 실행하면 워크샵 종합 Markdown 문서가 생성됩니다.'
              : '퍼실리테이터가 종합 보고서 생성을 시작할 때까지 대기 중입니다.'}
          </p>
        </div>
      ) : (
        <div className="print-content rounded-apple-lg border border-hairline bg-white p-8">
          <MarkdownPreview content={report.content} className="prose-lg" />
        </div>
      )}

      {confirmOpen && report ? (
        <ConfirmModal
          title="보고서를 재생성할까요?"
          description={`기존 보고서를 새 버전으로 대체합니다. 현재 v${report.version}은 DB에 보존됩니다.`}
          confirmLabel="재생성"
          isBusy={isRunning}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void runGenerate()}
        />
      ) : null}
    </section>
  )
}
