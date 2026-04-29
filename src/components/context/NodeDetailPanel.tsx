'use client'

import { X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useProcessGraphStore } from '@/stores/process-graph'

export function NodeDetailPanel({ workshopId }: { workshopId: string }) {
  const selectedNodeId = useProcessGraphStore((s) => s.selectedNodeId)
  const nodes = useProcessGraphStore((s) => s.nodes)
  const isActiveEditor = useProcessGraphStore((s) => s.isActiveEditor)
  const updateNode = useProcessGraphStore((s) => s.updateNode)
  const setSelectedNode = useProcessGraphStore((s) => s.setSelectedNode)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const nodeData = selectedNode?.data as Record<string, unknown> | undefined

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [durationInfo, setDurationInfo] = useState('')
  const [toolsSystems, setToolsSystems] = useState('')
  const [volumeInfo, setVolumeInfo] = useState('')
  const [saving, setSaving] = useState(false)

  // Sync local state when selected node changes
  useEffect(() => {
    if (nodeData) {
      setName(String(nodeData.name ?? ''))
      setDescription(String(nodeData.description ?? ''))
      setDurationInfo(String(nodeData.duration_info ?? ''))
      setToolsSystems(String(nodeData.tools_systems ?? ''))
      setVolumeInfo(String(nodeData.volume_info ?? ''))
    }
  }, [nodeData, selectedNodeId])

  const handleSave = useCallback(async () => {
    if (!selectedNodeId) return
    setSaving(true)
    const ok = await updateNode(workshopId, selectedNodeId, {
      name: name.trim() || undefined,
      description: description.trim() || null,
      duration_info: durationInfo.trim() || null,
      tools_systems: toolsSystems.trim() || null,
      volume_info: volumeInfo.trim() || null,
    })
    setSaving(false)
    if (ok) {
      toast.success('노드가 업데이트되었습니다.')
    } else {
      toast.error('노드 업데이트에 실패했습니다.')
    }
  }, [description, durationInfo, name, selectedNodeId, toolsSystems, updateNode, volumeInfo, workshopId])

  if (!selectedNode || !nodeData) return null

  const nodeType = String(nodeData.node_type ?? selectedNode.type ?? '')
  const isEvent = nodeType.includes('event')

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-80 flex-col border-l border-hairline bg-white animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">노드 속성</h3>
        <button
          type="button"
          onClick={() => setSelectedNode(null)}
          className="rounded p-1 text-ink-muted-48 hover:bg-canvas-parchment hover:text-ink"
          aria-label="패널 닫기"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded bg-surface-pearl px-3 py-2 text-xs text-ink-muted-48">
          타입: <span className="font-medium text-ink">{nodeType.replace(/_/g, ' ')}</span>
        </div>

        <fieldset disabled={!isActiveEditor || saving}>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-muted-48">이름</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                className="w-full rounded-md border border-hairline bg-canvas-parchment px-3 py-2 text-sm text-ink placeholder:text-ink-muted-48 focus:border-primary-focus focus:outline-none disabled:opacity-50"
                placeholder="노드 이름"
              />
            </label>

            {!isEvent && (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-muted-48">설명</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="w-full rounded-md border border-hairline bg-canvas-parchment px-3 py-2 text-sm text-ink placeholder:text-ink-muted-48 focus:border-primary-focus focus:outline-none disabled:opacity-50"
                    placeholder="업무 설명"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-muted-48">소요 시간</span>
                  <input
                    type="text"
                    value={durationInfo}
                    onChange={(e) => setDurationInfo(e.target.value)}
                    maxLength={100}
                    className="w-full rounded-md border border-hairline bg-canvas-parchment px-3 py-2 text-sm text-ink placeholder:text-ink-muted-48 focus:border-primary-focus focus:outline-none disabled:opacity-50"
                    placeholder="예: 2시간, 1일"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-muted-48">사용 도구/시스템</span>
                  <input
                    type="text"
                    value={toolsSystems}
                    onChange={(e) => setToolsSystems(e.target.value)}
                    maxLength={200}
                    className="w-full rounded-md border border-hairline bg-canvas-parchment px-3 py-2 text-sm text-ink placeholder:text-ink-muted-48 focus:border-primary-focus focus:outline-none disabled:opacity-50"
                    placeholder="예: Excel, SAP, ERP"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-muted-48">처리량 정보</span>
                  <input
                    type="text"
                    value={volumeInfo}
                    onChange={(e) => setVolumeInfo(e.target.value)}
                    maxLength={200}
                    className="w-full rounded-md border border-hairline bg-canvas-parchment px-3 py-2 text-sm text-ink placeholder:text-ink-muted-48 focus:border-primary-focus focus:outline-none disabled:opacity-50"
                    placeholder="예: 월 300건"
                  />
                </label>
              </>
            )}
          </div>
        </fieldset>
      </div>

      {/* Footer */}
      {isActiveEditor && (
        <div className="border-t border-hairline p-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="w-full rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-focus disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      )}
    </div>
  )
}
