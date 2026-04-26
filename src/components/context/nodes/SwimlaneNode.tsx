'use client'

import type { NodeProps } from '@xyflow/react'

export function SwimlaneNode({ data }: NodeProps) {
  const laneData = data as { label?: string; name?: string }

  return (
    <div className="min-h-32 min-w-64 rounded-md border border-neutral-700 bg-neutral-900/60 p-3 text-xs text-neutral-300">
      {laneData.label ?? laneData.name ?? 'Swimlane'}
    </div>
  )
}
