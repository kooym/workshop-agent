'use client'

import { Pencil, Save, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { Json } from '@/types/common'

type JsonRecord = { [key: string]: Json | undefined }

type AgentData = {
  name: string
  role: string
  core_features: string[]
  sub_features: string[]
  input: string
  output: string
  human_checkpoint: string
  is_selected: boolean
}

export function AgentSpecCard({
  value,
  canEdit = false,
  workshopId,
  onChanged,
}: {
  value: Json
  canEdit?: boolean
  workshopId?: string
  onChanged?(): void
}) {
  const agents = toArray(value)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<AgentData[]>(agents)
  const [isSaving, setIsSaving] = useState(false)

  const selectedCount = agents.filter((a) => a.is_selected).length

  function startEditing() {
    setEditData(toArray(value))
    setIsEditing(true)
  }

  function cancelEditing() {
    setEditData(agents)
    setIsEditing(false)
  }

  function updateAgent(index: number, field: keyof AgentData, fieldValue: string | string[] | boolean) {
    setEditData((prev) =>
      prev.map((agent, i) => (i === index ? { ...agent, [field]: fieldValue } : agent)),
    )
  }

  async function toggleAgentSelection(index: number, selected: boolean) {
    if (!workshopId) return
    const updated = agents.map((agent, i) =>
      i === index ? { ...agent, is_selected: selected } : agent,
    )
    const response = await fetch(`/api/workshops/${workshopId}/design-artifacts`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent_specs: updated }),
    })
    if (!response.ok) {
      toast.error('Agent 선택 상태를 변경하지 못했습니다.')
      return
    }
    onChanged?.()
  }

  async function saveAgents() {
    if (!workshopId) return
    setIsSaving(true)
    const response = await fetch(`/api/workshops/${workshopId}/design-artifacts`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent_specs: editData }),
    })
    setIsSaving(false)
    if (!response.ok) {
      toast.error('Agent 사양을 저장하지 못했습니다.')
      return
    }
    setIsEditing(false)
    onChanged?.()
    toast.success('Agent 사양을 저장했습니다.')
  }

  const displayAgents = isEditing ? editData : agents

  return (
    <section className="space-y-4">
      {canEdit ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-ink-muted-80">
            Agent <span className="font-semibold text-ink">{selectedCount}</span> / {agents.length}개 선택됨
            {selectedCount === 0 ? (
              <span className="ml-2 text-amber-600">— 1개 이상 선택해야 과제를 도출할 수 있습니다</span>
            ) : null}
          </p>
          <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => void saveAgents()}
                disabled={isSaving}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-3 text-sm font-medium text-white hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-canvas-parchment disabled:text-ink-muted-48"
              >
                <Save aria-hidden className="h-4 w-4" />
                저장
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-hairline px-3 text-sm text-ink-muted-80 hover:bg-canvas-parchment"
              >
                <X aria-hidden className="h-4 w-4" />
                취소
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-hairline px-3 text-sm text-ink-muted-80 hover:bg-canvas-parchment"
            >
              <Pencil aria-hidden className="h-4 w-4" />
              편집
            </button>
          )}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {displayAgents.map((agent, index) => (
          <article key={`${agent.name}-${index}`} className={`rounded-apple-lg border bg-white p-4 ${agent.is_selected ? 'border-hairline' : 'border-hairline/50 opacity-60'}`}>
            <div className="flex items-start gap-3">
              {canEdit && !isEditing ? (
                <label className="mt-1 flex shrink-0 cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={agent.is_selected}
                    onChange={(e) => void toggleAgentSelection(index, e.target.checked)}
                    className="h-4 w-4 rounded border-hairline bg-canvas-parchment text-primary focus:ring-primary focus:ring-offset-0"
                  />
                  <span className="sr-only">Agent 선택</span>
                </label>
              ) : null}
              <div className="min-w-0 flex-1">
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-ink-muted-48" htmlFor={`agent-name-${index}`}>이름</label>
                  <input
                    id={`agent-name-${index}`}
                    value={agent.name}
                    onChange={(e) => updateAgent(index, 'name', e.target.value)}
                    maxLength={100}
                    className="mt-1 h-9 w-full rounded-full border border-hairline bg-canvas-parchment px-3 text-sm text-ink outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted-48" htmlFor={`agent-role-${index}`}>역할</label>
                  <textarea
                    id={`agent-role-${index}`}
                    value={agent.role}
                    onChange={(e) => updateAgent(index, 'role', e.target.value)}
                    maxLength={200}
                    rows={2}
                    className="mt-1 w-full resize-none rounded-apple-lg border border-hairline bg-canvas-parchment px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted-48" htmlFor={`agent-core-${index}`}>핵심 기능 (쉼표 구분)</label>
                  <input
                    id={`agent-core-${index}`}
                    value={agent.core_features.join(', ')}
                    onChange={(e) => updateAgent(index, 'core_features', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                    className="mt-1 h-9 w-full rounded-full border border-hairline bg-canvas-parchment px-3 text-sm text-ink outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted-48" htmlFor={`agent-sub-${index}`}>부가 기능 (쉼표 구분)</label>
                  <input
                    id={`agent-sub-${index}`}
                    value={agent.sub_features.join(', ')}
                    onChange={(e) => updateAgent(index, 'sub_features', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                    className="mt-1 h-9 w-full rounded-full border border-hairline bg-canvas-parchment px-3 text-sm text-ink outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted-48" htmlFor={`agent-input-${index}`}>입력</label>
                  <textarea
                    id={`agent-input-${index}`}
                    value={agent.input}
                    onChange={(e) => updateAgent(index, 'input', e.target.value)}
                    maxLength={200}
                    rows={2}
                    className="mt-1 w-full resize-none rounded-apple-lg border border-hairline bg-canvas-parchment px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted-48" htmlFor={`agent-output-${index}`}>출력</label>
                  <textarea
                    id={`agent-output-${index}`}
                    value={agent.output}
                    onChange={(e) => updateAgent(index, 'output', e.target.value)}
                    maxLength={200}
                    rows={2}
                    className="mt-1 w-full resize-none rounded-apple-lg border border-hairline bg-canvas-parchment px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted-48" htmlFor={`agent-hc-${index}`}>Human Checkpoint</label>
                  <textarea
                    id={`agent-hc-${index}`}
                    value={agent.human_checkpoint}
                    onChange={(e) => updateAgent(index, 'human_checkpoint', e.target.value)}
                    maxLength={200}
                    rows={2}
                    className="mt-1 w-full resize-none rounded-apple-lg border border-hairline bg-canvas-parchment px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                  />
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-base font-semibold text-ink">{agent.name}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-muted-48">{agent.role}</p>
                <FeatureBlock title="핵심 기능" items={agent.core_features} />
                <FeatureBlock title="부가 기능" items={agent.sub_features} />
                <dl className="mt-4 grid gap-2 text-sm">
                  <div>
                    <dt className="text-ink-muted-48">입력</dt>
                    <dd className="text-ink-muted-80">{agent.input}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted-48">출력</dt>
                    <dd className="text-ink-muted-80">{agent.output}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted-48">Human Checkpoint</dt>
                    <dd className="text-ink-muted-80">{agent.human_checkpoint}</dd>
                  </div>
                </dl>
              </>
            )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function FeatureBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium text-ink-muted-48">{title}</p>
      <ul className="space-y-1 text-sm text-ink-muted-80">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function toArray(value: Json) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isJsonRecord)
    .map((item) => ({
      name: String(item.name ?? 'Agent'),
      role: String(item.role ?? ''),
      core_features: toStringArray(item.core_features),
      sub_features: toStringArray(item.sub_features),
      input: String(item.input ?? ''),
      output: String(item.output ?? ''),
      human_checkpoint: String(item.human_checkpoint ?? ''),
      is_selected: item.is_selected !== false,
    }))
}

function isJsonRecord(value: Json): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toStringArray(value: Json | undefined) {
  return Array.isArray(value) ? value.map(String) : []
}
