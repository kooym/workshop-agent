'use client'

import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MarkdownPreview } from '@/components/shared/MarkdownPreview'
import type { Tables } from '@/lib/supabase/types'

export function ReportEditor({
  report,
  workshopId,
  canEdit,
  onSaved,
}: {
  report: Tables<'ax_reports'> | null
  workshopId: string
  canEdit: boolean
  onSaved(report: Tables<'ax_reports'>): void
}) {
  const [draft, setDraft] = useState(report?.content ?? '')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setDraft(report?.content ?? '')
  }, [report?.content])

  if (!report || !canEdit) {
    return null
  }
  const currentReport = report

  async function save() {
    setIsSaving(true)
    const response = await fetch(`/api/workshops/${workshopId}/reports`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: draft, current_version: currentReport.version }),
    })
    const payload = await response.json().catch(() => null)
    setIsSaving(false)

    if (!response.ok) {
      toast.error(payload?.error?.message ?? '보고서를 저장하지 못했습니다.')
      return
    }

    onSaved(payload.data)
    toast.success('보고서가 저장되었습니다.')
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-apple-lg border border-hairline bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Markdown 편집</h3>
          <button
            type="button"
            onClick={() => void save()}
            disabled={isSaving}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-3 text-sm font-medium text-white hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-canvas-parchment disabled:text-ink-muted-48"
          >
            <Save aria-hidden className="h-4 w-4" />
            저장
          </button>
        </div>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={80_000}
          className="min-h-[640px] w-full resize-y rounded-apple-lg border border-hairline bg-canvas-parchment p-4 font-mono text-sm leading-6 text-ink outline-none focus:border-primary"
        />
      </div>
      <div className="rounded-apple-lg border border-hairline bg-white p-5">
        <MarkdownPreview content={draft} />
      </div>
    </section>
  )
}
