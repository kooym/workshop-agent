'use client'

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type NodeTypes,
} from '@xyflow/react'
import { Lock, Unlock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useProcessGraphStore } from '@/stores/process-graph'
import { EndEventNode } from './nodes/EndEventNode'
import { ExclusiveGatewayNode } from './nodes/ExclusiveGatewayNode'
import { IntermediateEventNode } from './nodes/IntermediateEventNode'
import { ParallelGatewayNode } from './nodes/ParallelGatewayNode'
import { StartEventNode } from './nodes/StartEventNode'
import { SubProcessNode } from './nodes/SubProcessNode'
import { SwimlaneNode } from './nodes/SwimlaneNode'
import { TaskNode } from './nodes/TaskNode'

export function ProcessGraphEditor({
  workshopId,
  currentParticipantId,
}: {
  workshopId: string
  currentParticipantId: string
}) {
  const nodes = useProcessGraphStore((state) => state.nodes)
  const edges = useProcessGraphStore((state) => state.edges)
  const editingLock = useProcessGraphStore((state) => state.editingLock)
  const isActiveEditor = useProcessGraphStore((state) => state.isActiveEditor)
  const refetchGraph = useProcessGraphStore((state) => state.refetchAll)
  const [error, setError] = useState('')

  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      task: TaskNode,
      start_event: StartEventNode,
      end_event: EndEventNode,
      exclusive_gateway: ExclusiveGatewayNode,
      parallel_gateway: ParallelGatewayNode,
      intermediate_event: IntermediateEventNode,
      sub_process: SubProcessNode,
      swimlane: SwimlaneNode,
    }),
    [],
  )

  useEffect(() => {
    void refetchGraph(workshopId, currentParticipantId)
  }, [currentParticipantId, refetchGraph, workshopId])

  async function acquireLock() {
    setError('')
    const response = await fetch(`/api/workshops/${workshopId}/editing-locks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ resource_type: 'process_graph' }),
    })
    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error?.message ?? '편집 권한을 가져오지 못했습니다.')
      return
    }

    await refetchGraph(workshopId, currentParticipantId)
  }

  async function releaseLock() {
    if (!editingLock) {
      return
    }

    await fetch(`/api/workshops/${workshopId}/editing-locks/${editingLock.id}`, {
      method: 'DELETE',
    })
    await refetchGraph(workshopId, currentParticipantId)
  }

  return (
    <div className="flex h-[calc(100vh-48px)] flex-col">
      <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
        <div>
          <h2 className="text-base font-semibold text-white">AS-IS 프로세스</h2>
          <p className="mt-1 text-xs text-neutral-500">
            {isActiveEditor ? 'Active 편집 모드' : 'Sleep 읽기 모드'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isActiveEditor ? (
            <button
              type="button"
              onClick={releaseLock}
              className="inline-flex items-center gap-2 rounded-md border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800"
            >
              <Unlock aria-hidden className="h-4 w-4" />
              편집 해제
            </button>
          ) : (
            <button
              type="button"
              onClick={acquireLock}
              className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500"
            >
              <Lock aria-hidden className="h-4 w-4" />
              편집 참여
            </button>
          )}
        </div>
      </div>
      {error ? <p className="border-b border-neutral-800 px-6 py-2 text-sm text-red-400">{error}</p> : null}
      <div className="min-h-0 flex-1 bg-neutral-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={isActiveEditor}
          nodesConnectable={isActiveEditor}
          elementsSelectable={isActiveEditor}
          fitView
        >
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}
