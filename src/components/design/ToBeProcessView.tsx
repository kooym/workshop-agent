'use client'

import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
  type NodeTypes,
  applyNodeChanges,
} from '@xyflow/react'
import { Pencil, Save, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import mermaid from 'mermaid'
import { toast } from 'sonner'
import type { Json } from '@/types/common'

type JsonRecord = { [key: string]: Json | undefined }

export function ToBeProcessView({
  value,
  workshopId,
  canEdit = false,
  onChanged,
}: {
  value: Json
  workshopId?: string
  canEdit?: boolean
  onChanged?(): void
}) {
  const id = useId().replaceAll(':', '')
  const process = useMemo(() => normalizeToBeProcess(value), [value])
  const nodeTypes = useMemo<NodeTypes>(() => ({ tobe: ToBeGraphNode }), [])
  const [view, setView] = useState<'mermaid' | 'graph'>('graph')
  const [svg, setSvg] = useState('')
  const [flowNodes, setFlowNodes] = useState<Node[]>(process.flowNodes)
  const [flowEdges, setFlowEdges] = useState<Edge[]>(process.flowEdges)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const selectedNode = flowNodes.find((node) => node.id === selectedNodeId) ?? null

  useEffect(() => {
    setFlowNodes(process.flowNodes)
    setFlowEdges(process.flowEdges)
    setSelectedNodeId(null)
    setIsEditing(false)
  }, [process.flowEdges, process.flowNodes])

  useEffect(() => {
    let cancelled = false
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' })
    void mermaid
      .render(`tobe-${id}`, process.mermaid_dsl)
      .then((result) => {
        if (!cancelled) {
          setSvg(result.svg)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSvg('')
        }
      })
    return () => {
      cancelled = true
    }
  }, [id, process.mermaid_dsl])

  function handleNodeChanges(changes: NodeChange[]) {
    setFlowNodes((nodes) => applyNodeChanges(changes, nodes))
  }

  function updateSelectedNodeField(field: keyof ToBeNodeData, fieldValue: string) {
    if (!selectedNodeId) {
      return
    }

    setFlowNodes((nodes) =>
      nodes.map((node) =>
        node.id === selectedNodeId
          ? { ...node, data: { ...node.data, [field]: fieldValue } }
          : node,
      ),
    )
  }

  async function saveGraph() {
    if (!workshopId || !canEdit) {
      return
    }

    setIsSaving(true)
    const response = await fetch(`/api/workshops/${workshopId}/design-artifacts`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tobe_process: buildPatchedToBeProcess(value, flowNodes),
      }),
    })
    setIsSaving(false)

    if (!response.ok) {
      toast.error('TO-BE 그래프를 저장하지 못했습니다.')
      return
    }

    setIsEditing(false)
    onChanged?.()
    toast.success('TO-BE 그래프를 저장했습니다.')
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-hairline bg-white p-1">
          <button
            type="button"
            onClick={() => setView('mermaid')}
            className={`rounded-full px-3 py-1.5 text-sm ${view === 'mermaid' ? 'bg-primary text-white' : 'text-ink-muted-48'}`}
          >
            Mermaid 다이어그램
          </button>
          <button
            type="button"
            onClick={() => setView('graph')}
            className={`rounded-full px-3 py-1.5 text-sm ${view === 'graph' ? 'bg-primary text-white' : 'text-ink-muted-48'}`}
          >
            상세 그래프 뷰
          </button>
        </div>

        {canEdit && view === 'graph' ? (
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => void saveGraph()}
                  disabled={isSaving}
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-3 text-sm font-medium text-white hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-canvas-parchment disabled:text-ink-muted-48"
                >
                  <Save aria-hidden className="h-4 w-4" />
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFlowNodes(process.flowNodes)
                    setSelectedNodeId(null)
                    setIsEditing(false)
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-hairline px-3 text-sm text-ink-muted-80 hover:bg-canvas-parchment"
                >
                  <X aria-hidden className="h-4 w-4" />
                  취소
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-hairline px-3 text-sm text-ink-muted-80 hover:bg-canvas-parchment"
              >
                <Pencil aria-hidden className="h-4 w-4" />
                편집
              </button>
            )}
          </div>
        ) : null}
      </div>

      {view === 'mermaid' ? (
        <div className="overflow-auto rounded-apple-lg border border-hairline bg-white p-4">
          {svg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
              alt="TO-BE process diagram"
              className="max-w-none"
            />
          ) : (
            <pre className="whitespace-pre-wrap text-sm text-ink-muted-80">{process.mermaid_dsl}</pre>
          )}
        </div>
      ) : (
        <div className="h-[560px] min-h-96 overflow-hidden rounded-apple-lg border border-hairline bg-canvas-parchment">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            nodesDraggable={isEditing}
            nodesConnectable={false}
            elementsSelectable
            onNodesChange={isEditing ? handleNodeChanges : undefined}
            onNodeClick={(_event, node) => setSelectedNodeId(node.id)}
            fitView
          >
            <Background />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </div>
      )}

      {isEditing && selectedNode ? (
        <div className="grid gap-4 rounded-apple-lg border border-hairline bg-white p-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-ink-muted-48" htmlFor={`node-name-${id}`}>
              노드 라벨
            </label>
            <input
              id={`node-name-${id}`}
              value={String(selectedNode.data.name ?? '')}
              onChange={(event) => updateSelectedNodeField('name', event.target.value)}
              maxLength={100}
              className="mt-2 h-10 w-full rounded-full border border-hairline bg-canvas-parchment px-3 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted-48" htmlFor={`node-agent-${id}`}>
              담당 Agent명
            </label>
            <input
              id={`node-agent-${id}`}
              value={String(selectedNode.data.agent_name ?? '')}
              onChange={(event) => updateSelectedNodeField('agent_name', event.target.value)}
              maxLength={100}
              placeholder="없으면 비워두세요"
              className="mt-2 h-10 w-full rounded-full border border-hairline bg-canvas-parchment px-3 text-sm text-ink outline-none placeholder:text-ink-muted-48 focus:border-primary"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-ink-muted-48" htmlFor={`node-desc-${id}`}>
              설명
            </label>
            <textarea
              id={`node-desc-${id}`}
              value={String(selectedNode.data.description ?? '')}
              onChange={(event) => updateSelectedNodeField('description', event.target.value)}
              maxLength={80}
              rows={2}
              className="mt-2 w-full resize-none rounded-apple-lg border border-hairline bg-canvas-parchment px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
            <p className="mt-1 text-right text-xs text-ink-muted-48">{String(selectedNode.data.description ?? '').length}/80</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-muted-48" htmlFor={`node-auto-${id}`}>
              자동화 유형
            </label>
            <select
              id={`node-auto-${id}`}
              value={String(selectedNode.data.automation_type ?? 'assisted')}
              onChange={(event) => updateSelectedNodeField('automation_type', event.target.value)}
              className="mt-2 h-10 w-full rounded-full border border-hairline bg-canvas-parchment px-3 text-sm text-ink outline-none focus:border-primary"
            >
              <option value="full">Full (완전 자동)</option>
              <option value="assisted">Assisted (AI 보조)</option>
              <option value="human">Human (사람 수행)</option>
            </select>
          </div>
        </div>
      ) : null}
    </section>
  )
}

type ToBeProcess = {
  mermaid_dsl: string
  flowNodes: Node[]
  flowEdges: Edge[]
}

type ToBeNodeData = {
  name: string
  description: string
  automation_type: 'full' | 'assisted' | 'human'
  agent_name: string | null
  asis_node_ids: string[]
}

function normalizeToBeProcess(value: Json): ToBeProcess {
  const object = isJsonRecord(value) ? value : {}
  const mermaid = 'mermaid_dsl' in object && typeof object.mermaid_dsl === 'string' ? object.mermaid_dsl : 'flowchart LR'
  const rawSteps = Array.isArray(object.steps) ? object.steps : []
  const steps = rawSteps
        .filter(isJsonRecord)
        .map((step) => ({
          name: typeof step.name === 'string' ? step.name : 'TO-BE 단계',
          description: typeof step.description === 'string' ? step.description : '',
          automation_type: normalizeAutomationType(step.automation_type),
          agent_name: typeof step.agent_name === 'string' ? step.agent_name : null,
        }))

  const graph = isJsonRecord(object.graph) ? object.graph : {}
  const graphNodeRecords = Array.isArray(graph.nodes) ? graph.nodes.filter(isJsonRecord) : []
  const graphNodes = graphNodeRecords.length
    ? graphNodeRecords.map((node, index) => ({
        id: typeof node.id === 'string' ? node.id : `tobe-${index + 1}`,
        name: typeof node.name === 'string' ? node.name : `TO-BE 단계 ${index + 1}`,
        description: typeof node.description === 'string' ? node.description : '',
        automation_type: normalizeAutomationType(node.automation_type),
        agent_name: typeof node.agent_name === 'string' ? node.agent_name : null,
        asis_node_ids: toStringArray(node.asis_node_ids),
        position: {
          x: typeof node.position_x === 'number' ? node.position_x : 80 + (index % 3) * 280,
          y: typeof node.position_y === 'number' ? node.position_y : 80 + Math.floor(index / 3) * 180,
        },
      }))
    : steps.map((step, index) => ({
        id: `tobe-step-${index + 1}`,
        ...step,
        asis_node_ids: [],
        position: {
          x: 80 + (index % 3) * 280,
          y: 80 + Math.floor(index / 3) * 180,
        },
      }))
  const nodeIds = new Set(graphNodes.map((node) => node.id))
  const graphEdgeRecords = Array.isArray(graph.edges) ? graph.edges.filter(isJsonRecord) : []
  const flowEdges = graphEdgeRecords
    .map((edge, index): Edge | null => {
      const source = typeof edge.source_node_id === 'string' ? edge.source_node_id : ''
      const target = typeof edge.target_node_id === 'string' ? edge.target_node_id : ''
      if (!nodeIds.has(source) || !nodeIds.has(target)) {
        return null
      }
      return {
        id: typeof edge.id === 'string' ? edge.id : `tobe-edge-${index + 1}`,
        source,
        target,
        label: typeof edge.label === 'string' ? edge.label : undefined,
        type: 'smoothstep',
        animated: edge.edge_type === 'message',
      }
    })
    .filter((edge): edge is Edge => edge !== null)
  const fallbackEdges =
    flowEdges.length || graphNodes.length < 2
      ? flowEdges
      : graphNodes.slice(1).map((node, index) => ({
          id: `tobe-sequence-${index + 1}`,
          source: graphNodes[index].id,
          target: node.id,
          type: 'smoothstep',
        }))
  const flowNodes = graphNodes.map((node): Node => ({
    id: node.id,
    type: 'tobe',
    position: node.position,
    data: {
      name: node.name,
      description: node.description,
      automation_type: node.automation_type,
      agent_name: node.agent_name,
      asis_node_ids: node.asis_node_ids,
    },
  }))

  return { mermaid_dsl: mermaid, flowNodes, flowEdges: fallbackEdges }
}

function isJsonRecord(value: Json | undefined): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeAutomationType(value: Json | undefined): ToBeNodeData['automation_type'] {
  return value === 'full' || value === 'assisted' || value === 'human' ? value : 'assisted'
}

function toStringArray(value: Json | undefined) {
  return Array.isArray(value) ? value.map(String) : []
}

function buildPatchedToBeProcess(value: Json, nodes: Node[]): Json {
  const object = isJsonRecord(value) ? { ...value } : {}
  const graph = isJsonRecord(object.graph) ? { ...object.graph } : {}
  const records = Array.isArray(graph.nodes) ? graph.nodes.filter(isJsonRecord) : []
  const nodesById = new Map(nodes.map((node) => [node.id, node]))

  graph.nodes = records.length
    ? records.map((record, index) => {
        const id = typeof record.id === 'string' ? record.id : `tobe-${index + 1}`
        const node = nodesById.get(id)
        return node ? patchGraphNode(record, id, node) : record
      })
    : nodes.map((node) => patchGraphNode({}, node.id, node))

  return {
    ...object,
    mermaid_dsl: typeof object.mermaid_dsl === 'string' ? object.mermaid_dsl : 'flowchart LR',
    graph,
  }
}

function patchGraphNode(record: JsonRecord, id: string, node: Node): JsonRecord {
  const data = node.data as ToBeNodeData
  return {
    ...record,
    id,
    name: data.name,
    description: data.description,
    automation_type: data.automation_type,
    agent_name: data.agent_name,
    asis_node_ids: data.asis_node_ids,
    position_x: node.position.x,
    position_y: node.position.y,
  }
}

function ToBeGraphNode({ data }: NodeProps) {
  const node = data as ToBeNodeData
  return (
    <div className="min-w-56 rounded-apple-lg border border-hairline bg-white p-3 text-left shadow-sm">
      <Handle type="target" position={Position.Left} className="!bg-ink-muted-48" />
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="max-w-48 text-sm font-semibold text-ink">{node.name}</h3>
        <span className="rounded bg-canvas-parchment px-2 py-0.5 text-[11px] text-ink-muted-80">
          {automationLabel(node.automation_type)}
        </span>
      </div>
      {node.agent_name ? (
        <p className="mt-2 rounded bg-primary/10 px-2 py-1 text-xs text-primary">
          {node.agent_name}
        </p>
      ) : null}
      {node.description ? (
        <p className="mt-2 line-clamp-3 text-xs leading-5 text-ink-muted-48">{node.description}</p>
      ) : null}
      {node.asis_node_ids.length ? (
        <p className="mt-2 text-[11px] text-ink-muted-48">AS-IS {node.asis_node_ids.length}개 연결</p>
      ) : null}
      <Handle type="source" position={Position.Right} className="!bg-ink-muted-48" />
    </div>
  )
}

function automationLabel(type: ToBeNodeData['automation_type']) {
  if (type === 'full') {
    return '전자동'
  }
  if (type === 'assisted') {
    return 'AI 보조'
  }
  return '사람 수행'
}
