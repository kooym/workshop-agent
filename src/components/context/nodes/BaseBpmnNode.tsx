'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { memo } from 'react'

type BpmnNodeProps = NodeProps & {
  variant: 'task' | 'start' | 'end' | 'gateway' | 'parallel' | 'event' | 'subprocess'
}

const shapeClasses: Record<BpmnNodeProps['variant'], string> = {
  task: 'min-w-28 min-h-12 rounded-md border-hairline bg-white px-3 py-2',
  start: 'w-14 h-14 rounded-full border-emerald-400 bg-emerald-50',
  end: 'w-14 h-14 rounded-full border-red-400 bg-red-50',
  gateway: 'w-14 h-14 rotate-45 border-amber-400 bg-amber-50',
  parallel: 'w-14 h-14 rotate-45 border-primary bg-primary/10',
  event: 'w-14 h-14 rounded-full border-cyan-400 bg-cyan-50 ring-2 ring-cyan-500/30',
  subprocess: 'min-w-28 min-h-12 rounded-md border-violet-400 bg-white outline outline-2 outline-violet-500/20 px-3 py-2',
}

function BaseBpmnNodeInner({ data, variant, selected }: BpmnNodeProps) {
  const nodeData = data as { label?: string; name?: string }
  const label = nodeData.label ?? nodeData.name ?? 'Untitled'
  const rotated = variant === 'gateway' || variant === 'parallel'
  const isCompact = ['start', 'end', 'gateway', 'parallel', 'event'].includes(variant)

  return (
    <div
      className={`relative flex items-center justify-center border text-center text-xs text-ink transition-shadow ${shapeClasses[variant]} ${selected ? 'ring-2 ring-primary shadow-lg shadow-primary/20' : ''}`}
    >
      <Handle id="left-target" type="target" position={Position.Left} className="!bg-neutral-400" />
      <span className={`${rotated ? '-rotate-45' : ''} ${isCompact ? 'text-[10px] leading-tight' : ''} max-w-[120px] truncate`}>
        {label}
      </span>
      <Handle id="right-source" type="source" position={Position.Right} className="!bg-neutral-400" />
    </div>
  )
}

export const BaseBpmnNode = memo(BaseBpmnNodeInner)
