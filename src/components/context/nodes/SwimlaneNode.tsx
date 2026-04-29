'use client'

import type { NodeProps } from '@xyflow/react'
import { memo } from 'react'

export const SwimlaneNode = memo(function SwimlaneNode({ data }: NodeProps) {
  const laneData = data as { label?: string; name?: string }

  return (
    <div className="min-h-32 min-w-64 rounded-md border border-hairline bg-surface-pearl/60 p-3 text-xs text-ink-muted-80">
      {laneData.label ?? laneData.name ?? 'Swimlane'}
    </div>
  )
})
