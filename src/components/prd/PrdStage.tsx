'use client'

import { useState } from 'react'
import { PrdEditor } from './PrdEditor'
import { PrdPreview } from './PrdPreview'
import type { Tables } from '@/lib/supabase/types'
import type { Workshop } from '@/types/workshop'

export function PrdStage({ workshop, isFacilitator }: { workshop: Workshop; isFacilitator: boolean }) {
  const [prd, setPrd] = useState<Tables<'prds'> | null>(null)
  const canEdit = isFacilitator && workshop.current_stage === 'generate'

  return (
    <main className="min-h-screen bg-canvas-parchment p-6">
      <div className="space-y-6">
        <PrdPreview workshop={workshop} isFacilitator={isFacilitator} onLoaded={setPrd} />
        <PrdEditor prd={prd} workshopId={workshop.id} canEdit={canEdit} onSaved={setPrd} />
      </div>
    </main>
  )
}
