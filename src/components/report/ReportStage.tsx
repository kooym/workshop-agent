'use client'

import { useState } from 'react'
import { ReportEditor } from './ReportEditor'
import { ReportPreview } from './ReportPreview'
import type { Tables } from '@/lib/supabase/types'
import type { Workshop } from '@/types/workshop'

export function ReportStage({ workshop, isFacilitator }: { workshop: Workshop; isFacilitator: boolean }) {
  const [report, setReport] = useState<Tables<'ax_reports'> | null>(null)
  const canEdit = isFacilitator && workshop.current_stage === 'report'

  return (
    <main className="min-h-screen bg-canvas-parchment p-6">
      <div className="space-y-6">
        <ReportPreview workshop={workshop} isFacilitator={isFacilitator} onLoaded={setReport} />
        <ReportEditor report={report} workshopId={workshop.id} canEdit={canEdit} onSaved={setReport} />
      </div>
    </main>
  )
}
