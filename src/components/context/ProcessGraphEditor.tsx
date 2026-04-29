'use client'

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  ConnectionMode,
  type Edge,
  type EdgeChange,
  type EdgeMouseHandler,
  type NodeChange,
  type NodeMouseHandler,
  type NodeTypes,
  type OnNodeDrag,
  type OnNodesDelete,
  type OnEdgesDelete,
} from '@xyflow/react'
import { Lock, Sparkles, Trash2, Unlock } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useProcessGraphStore } from '@/stores/process-graph'
import { isValidConnection as checkValid } from './connection-rules'
import { NodeDetailPanel } from './NodeDetailPanel'
import { NodePalette } from './NodePalette'
import { TestDataModal } from '@/components/common/TestDataModal'
import { EndEventNode } from './nodes/EndEventNode'
import { ExclusiveGatewayNode } from './nodes/ExclusiveGatewayNode'
import { IntermediateEventNode } from './nodes/IntermediateEventNode'
import { ParallelGatewayNode } from './nodes/ParallelGatewayNode'
import { StartEventNode } from './nodes/StartEventNode'
import { SubProcessNode } from './nodes/SubProcessNode'
import { SwimlaneNode } from './nodes/SwimlaneNode'
import { TaskNode } from './nodes/TaskNode'

const POSITION_DEBOUNCE_MS = 300

export function ProcessGraphEditor({
  workshopId,
  currentParticipantId,
  isFacilitator = false,
}: {
  workshopId: string
  currentParticipantId: string
  isFacilitator?: boolean
}) {
  const nodes = useProcessGraphStore((s) => s.nodes)
  const edges = useProcessGraphStore((s) => s.edges)
  const editingLock = useProcessGraphStore((s) => s.editingLock)
  const isActiveEditor = useProcessGraphStore((s) => s.isActiveEditor)
  const selectedNodeId = useProcessGraphStore((s) => s.selectedNodeId)
  const setSelectedNode = useProcessGraphStore((s) => s.setSelectedNode)
  const refetchGraph = useProcessGraphStore((s) => s.refetchAll)
  const storeAddEdge = useProcessGraphStore((s) => s.addEdge)
  const deleteNode = useProcessGraphStore((s) => s.deleteNode)
  const deleteEdge = useProcessGraphStore((s) => s.deleteEdge)
  const onNodesChange = useProcessGraphStore((s) => s.onNodesChange)
  const onEdgesChange = useProcessGraphStore((s) => s.onEdgesChange)
  const [error, setError] = useState('')
  const [showTestModal, setShowTestModal] = useState(false)

  // Debounced position save
  const posTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const savePosRef = useRef<(nodeId: string, x: number, y: number) => void>(undefined)
  savePosRef.current = (nodeId: string, x: number, y: number) => {
    void fetch(`/api/workshops/${workshopId}/process-steps/${nodeId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ position_x: Math.round(x), position_y: Math.round(y) }),
    })
  }

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

  const defaultEdgeOptions = useMemo(
    () => ({ type: 'smoothstep' }),
    [],
  )

  useEffect(() => {
    void refetchGraph(workshopId, currentParticipantId)
  }, [currentParticipantId, refetchGraph, workshopId])

  // ---- Controlled mode handlers ----
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes)
    },
    [onNodesChange],
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes)
    },
    [onEdgesChange],
  )

  // ---- Lock Controls ----
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
    if (!editingLock) return
    await fetch(`/api/workshops/${workshopId}/editing-locks/${editingLock.id}`, {
      method: 'DELETE',
    })
    await refetchGraph(workshopId, currentParticipantId)
  }

  // ---- Event Handlers ----
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!isActiveEditor) return
      void storeAddEdge(workshopId, connection.source, connection.target).then((ok) => {
        if (!ok) toast.error('연결 생성에 실패했습니다.')
      })
    },
    [storeAddEdge, isActiveEditor, workshopId],
  )

  const handleIsValidConnection = useCallback(
    (connection: Edge | Connection) => checkValid(connection, nodes, edges),
    [nodes, edges],
  )

  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (!isActiveEditor) return
      clearTimeout(posTimerRef.current)
      posTimerRef.current = setTimeout(() => {
        savePosRef.current?.(node.id, node.position.x, node.position.y)
      }, POSITION_DEBOUNCE_MS)
    },
    [isActiveEditor],
  )

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      setSelectedNode(node.id)
    },
    [setSelectedNode],
  )

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [setSelectedNode])

  const handleNodesDelete: OnNodesDelete = useCallback(
    (deletedNodes) => {
      if (!isActiveEditor) return
      for (const n of deletedNodes) {
        void deleteNode(workshopId, n.id).then((ok) => {
          if (!ok) toast.error('노드 삭제에 실패했습니다.')
        })
      }
    },
    [deleteNode, isActiveEditor, workshopId],
  )

  const handleEdgesDelete: OnEdgesDelete = useCallback(
    (deletedEdges) => {
      if (!isActiveEditor) return
      for (const e of deletedEdges) {
        void deleteEdge(workshopId, e.id).then((ok) => {
          if (!ok) toast.error('연결 삭제에 실패했습니다.')
        })
      }
    },
    [deleteEdge, isActiveEditor, workshopId],
  )

  const handleEdgeDoubleClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      if (!isActiveEditor) return
      void deleteEdge(workshopId, edge.id)
    },
    [deleteEdge, isActiveEditor, workshopId],
  )

  // ---- Keyboard Delete ----
  const handleDeleteSelected = useCallback(() => {
    if (!isActiveEditor || !selectedNodeId) return
    void deleteNode(workshopId, selectedNodeId).then((ok) => {
      if (ok) setSelectedNode(null)
      else toast.error('노드 삭제에 실패했습니다.')
    })
  }, [deleteNode, isActiveEditor, selectedNodeId, setSelectedNode, workshopId])

  return (
    <ReactFlowProvider>
    <div className="flex h-[calc(100vh-48px)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-hairline px-6 py-3">
        <div>
          <h2 className="text-base font-semibold text-ink">AS-IS 프로세스</h2>
          <p className="mt-1 text-xs text-ink-muted-48">
            {isActiveEditor ? 'Active 편집 모드' : 'Sleep 읽기 모드'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFacilitator && isActiveEditor && (
            <button
              type="button"
              onClick={() => setShowTestModal(true)}
              className="inline-flex items-center gap-2 rounded-full border border-amber-300 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50"
            >
              <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.5} />
              테스트 데이터
            </button>
          )}
          {isActiveEditor && selectedNodeId && (
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="inline-flex items-center gap-2 rounded-full border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.5} />
              삭제
            </button>
          )}
          {isActiveEditor ? (
            <button
              type="button"
              onClick={releaseLock}
              className="inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-2 text-sm hover:bg-canvas-parchment"
            >
              <Unlock aria-hidden className="h-4 w-4" strokeWidth={1.5} />
              편집 해제
            </button>
          ) : (
            <button
              type="button"
              onClick={acquireLock}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm font-medium hover:bg-primary-focus"
            >
              <Lock aria-hidden className="h-4 w-4" strokeWidth={1.5} />
              편집 참여
            </button>
          )}
        </div>
      </div>
      {error ? (
        <p className="border-b border-hairline px-6 py-2 text-sm text-red-600">{error}</p>
      ) : null}

      {/* Canvas */}
      <div className="relative min-h-0 flex-1 bg-canvas-parchment">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionMode={ConnectionMode.Loose}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          nodesDraggable={isActiveEditor}
          nodesConnectable={isActiveEditor}
          elementsSelectable={isActiveEditor}
          onConnect={handleConnect}
          isValidConnection={handleIsValidConnection}
          onNodeDragStop={handleNodeDragStop}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onNodesDelete={handleNodesDelete}
          onEdgesDelete={handleEdgesDelete}
          onEdgeDoubleClick={handleEdgeDoubleClick}
          deleteKeyCode={isActiveEditor ? 'Backspace' : null}
          colorMode="light"
          fitView
        >
          <Background />
          <MiniMap
            className="!border-hairline !bg-white"
            maskColor="rgba(0,0,0,0.1)"
            nodeColor="#a3a3a3"
          />
          <Controls className="!border-hairline !bg-white [&>button]:!border-hairline [&>button]:!bg-white [&>button]:!fill-neutral-500 [&>button:hover]:!bg-canvas-parchment" />
        </ReactFlow>
        <NodeDetailPanel workshopId={workshopId} />
      </div>

      {/* Bottom Palette */}
      <NodePalette workshopId={workshopId} />
    </div>
    {showTestModal && (
      <TestDataModal
        workshopId={workshopId}
        mode="process"
        onClose={() => setShowTestModal(false)}
        onComplete={() => void refetchGraph(workshopId)}
      />
    )}
    </ReactFlowProvider>
  )
}
