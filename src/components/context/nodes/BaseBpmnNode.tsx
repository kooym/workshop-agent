'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'

type BpmnNodeProps = NodeProps & {
  variant: 'task' | 'start' | 'end' | 'gateway' | 'parallel' | 'event' | 'subprocess'
}

const variantClasses: Record<BpmnNodeProps['variant'], string> = {
  task: 'rounded-md border-neutral-500 bg-neutral-900',
  start: 'rounded-full border-emerald-400 bg-emerald-950',
  end: 'rounded-full border-red-400 bg-red-950',
  gateway: 'rotate-45 border-amber-400 bg-amber-950',
  parallel: 'rotate-45 border-sky-400 bg-sky-950',
  event: 'rounded-full border-cyan-400 bg-cyan-950 ring-2 ring-cyan-500/30',
  subprocess: 'rounded-md border-violet-400 bg-neutral-900 outline outline-2 outline-violet-500/20',
}

export function BaseBpmnNode({ data, variant }: BpmnNodeProps) {
  const nodeData = data as { label?: string; name?: string }
  const label = nodeData.label ?? nodeData.name ?? 'Untitled'
  const rotated = variant === 'gateway' || variant === 'parallel'

  return (
    <div
      className={`relative flex min-h-14 min-w-28 items-center justify-center border px-3 py-2 text-center text-xs text-white ${variantClasses[variant]}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-neutral-500" />
      <span className={rotated ? '-rotate-45' : ''}>{label}</span>
      <Handle type="source" position={Position.Right} className="!bg-neutral-500" />
    </div>
  )
}
