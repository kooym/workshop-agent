'use client'

import { Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { JourneySummary } from './JourneySummary'
import { useWorkshopStore } from '@/stores/workshop'

type Summary = Parameters<typeof JourneySummary>[0]['summary']

export function CompletedStage({ workshopId }: { workshopId: string }) {
  const setViewingStage = useWorkshopStore((state) => state.setViewingStage)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [prdContent, setPrdContent] = useState('')
  const [showOverlay, setShowOverlay] = useState(true)

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowOverlay(false), 3000)
    async function refetch() {
      const [summaryResponse, prdResponse] = await Promise.all([
        fetch(`/api/workshops/${workshopId}/summary`),
        fetch(`/api/prd?workshop_id=${workshopId}`),
      ])
      if (summaryResponse.ok) {
        const payload = await summaryResponse.json()
        setSummary(payload.data)
      }
      if (prdResponse.ok) {
        const payload = await prdResponse.json()
        setPrdContent(payload.data?.content ?? '')
      }
    }
    void refetch()
    return () => window.clearTimeout(timeout)
  }, [workshopId])

  async function copyPrd() {
    await navigator.clipboard.writeText(prdContent)
    toast.success('PRD Markdown이 복사되었습니다.')
  }

  return (
    <main className="min-h-screen bg-canvas-parchment p-6">
      {showOverlay ? (
        <button
          type="button"
          onClick={() => setShowOverlay(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 text-center"
        >
          <span className="text-3xl font-semibold text-white">워크샵이 완료되었습니다! 수고하셨습니다</span>
        </button>
      ) : null}
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 rounded-apple-lg border border-emerald-200 bg-emerald-50 p-5 text-center">
          <h2 className="text-2xl font-semibold tracking-normal text-emerald-800">워크샵이 완료되었습니다</h2>
          <p className="mt-2 text-sm text-emerald-700">수고하셨습니다. 산출물은 읽기 전용으로 보관됩니다.</p>
        </div>

        {summary ? <JourneySummary summary={summary} /> : null}

        <div className="mt-6 grid gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setViewingStage('design')}
            className="rounded-full border border-hairline px-3 py-2 text-sm text-ink hover:bg-canvas-parchment"
          >
            설계 보기
          </button>
          <button
            type="button"
            onClick={() => setViewingStage('generate')}
            className="rounded-full border border-hairline px-3 py-2 text-sm text-ink hover:bg-canvas-parchment"
          >
            PRD 보기
          </button>
          <button
            type="button"
            onClick={() => setViewingStage('report')}
            className="rounded-full border border-hairline px-3 py-2 text-sm text-ink hover:bg-canvas-parchment"
          >
            보고서 보기
          </button>
          <button
            type="button"
            onClick={() => void copyPrd()}
            disabled={!prdContent}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-hairline px-3 py-2 text-sm text-ink hover:bg-canvas-parchment disabled:cursor-not-allowed disabled:text-ink-muted-48"
          >
            <Copy aria-hidden className="h-4 w-4" />
            Markdown 복사
          </button>
        </div>
      </div>
    </main>
  )
}
