'use client'

import {
  Circle,
  CircleDot,
  Diamond,
  GitFork,
  Layers,
  Square,
  Timer,
} from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { useProcessGraphStore } from '@/stores/process-graph'
import type { ProcessNodeType } from '@/types/process-step'

const NODE_TYPE_OPTIONS: {
  type: ProcessNodeType
  label: string
  icon: typeof Circle
  shortLabel: string
}[] = [
  { type: 'start_event', label: '시작', icon: Circle, shortLabel: 'Start' },
  { type: 'end_event', label: '종료', icon: CircleDot, shortLabel: 'End' },
  { type: 'task', label: '업무', icon: Square, shortLabel: 'Task' },
  { type: 'exclusive_gateway', label: 'XOR 게이트', icon: Diamond, shortLabel: 'XOR' },
  { type: 'parallel_gateway', label: 'AND 게이트', icon: GitFork, shortLabel: 'Par' },
  { type: 'intermediate_event', label: '중간 이벤트', icon: Timer, shortLabel: 'Event' },
  { type: 'sub_process', label: '서브 프로세스', icon: Layers, shortLabel: 'Sub' },
]

const DEFAULT_NAMES: Record<ProcessNodeType, string> = {
  start_event: '시작',
  end_event: '종료',
  task: '새 업무',
  exclusive_gateway: '분기',
  parallel_gateway: '병렬',
  intermediate_event: '이벤트',
  sub_process: '서브 프로세스',
}

export function NodePalette({ workshopId }: { workshopId: string }) {
  const isActiveEditor = useProcessGraphStore((s) => s.isActiveEditor)
  const addNode = useProcessGraphStore((s) => s.addNode)
  const nodes = useProcessGraphStore((s) => s.nodes)
  const reactFlow = useReactFlow()

  async function handleAddNode(nodeType: ProcessNodeType) {
    const viewport = reactFlow.getViewport()
    const centerX = (-viewport.x + window.innerWidth / 2) / viewport.zoom
    const centerY = (-viewport.y + window.innerHeight / 2) / viewport.zoom

    await addNode(workshopId, {
      name: DEFAULT_NAMES[nodeType],
      node_type: nodeType,
      order_index: nodes.length,
      position_x: Math.round(centerX),
      position_y: Math.round(centerY),
    })
  }

  return (
    <div className="flex items-center justify-center gap-1 border-t border-hairline bg-white/95 px-4 py-2">
      {NODE_TYPE_OPTIONS.map(({ type, label, icon: Icon, shortLabel }) => (
        <button
          key={type}
          type="button"
          disabled={!isActiveEditor}
          onClick={() => handleAddNode(type)}
          className="inline-flex flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-xs text-ink-muted-80 transition-colors hover:bg-canvas-parchment hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          title={label}
        >
          <Icon aria-hidden className="h-4 w-4" strokeWidth={1.5} />
          <span>{shortLabel}</span>
        </button>
      ))}
    </div>
  )
}
