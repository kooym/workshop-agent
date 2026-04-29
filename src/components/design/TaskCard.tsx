'use client'

import { Pencil, Save, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useClusterStore } from '@/stores/cluster'
import { useDesignStore } from '@/stores/design'
import type { Tables } from '@/lib/supabase/types'

type ReactionSummary = {
  thumbs_up: number
  thinking: number
  my_reaction: '👍' | '🤔' | null
}

export function TaskCard({
  task,
  canEdit,
  onChanged,
  onToggleSelection,
}: {
  task: Tables<'ax_tasks'>
  canEdit: boolean
  onChanged(): void
  onToggleSelection?(isSelected: boolean): void
}) {
  const clusters = useClusterStore((state) => state.clusters)
  const reactionRevision = useDesignStore((state) => state.reactionRevision)
  const bumpReactionRevision = useDesignStore((state) => state.bumpReactionRevision)
  const [reaction, setReaction] = useState<ReactionSummary>({
    thumbs_up: 0,
    thinking: 0,
    my_reaction: null,
  })
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(task.title)
  const [draftDescription, setDraftDescription] = useState(task.description ?? '')
  const clusterNames = getClusterIds(task).map((clusterId) => {
    const cluster = clusters.find((item) => item.id === clusterId)
    return cluster?.name ?? '클러스터'
  })

  useEffect(() => {
    setDraftTitle(task.title)
    setDraftDescription(task.description ?? '')
  }, [task.description, task.title])

  useEffect(() => {
    let cancelled = false

    async function refetchReaction() {
      const response = await fetch(`/api/reactions?workshop_id=${task.workshop_id}&task_id=${task.id}`)
      if (!response.ok) {
        return
      }
      const payload = await response.json()
      if (!cancelled) {
        setReaction(payload.data)
      }
    }

    void refetchReaction()
    return () => {
      cancelled = true
    }
  }, [reactionRevision, task.id, task.workshop_id])

  async function react(reactionType: '👍' | '🤔') {
    const response = await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workshop_id: task.workshop_id,
        task_id: task.id,
        reaction_type: reactionType,
      }),
    })

    if (!response.ok) {
      toast.error('반응을 저장하지 못했습니다.')
      return
    }

    bumpReactionRevision()
  }

  async function save() {
    const title = draftTitle.trim()
    if (!title) {
      setDraftTitle(task.title)
      return
    }

    const response = await fetch(`/api/tasks/${task.id}?workshop_id=${task.workshop_id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title,
        description: draftDescription.trim() || null,
      }),
    })

    if (!response.ok) {
      toast.error('과제를 저장하지 못했습니다.')
      return
    }

    setIsEditing(false)
    onChanged()
  }

  async function remove() {
    const response = await fetch(`/api/tasks/${task.id}?workshop_id=${task.workshop_id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      toast.error('과제를 삭제하지 못했습니다.')
      return
    }

    onChanged()
  }

  return (
    <article className={`rounded-apple-lg border bg-white p-4 ${task.is_selected ? 'border-hairline' : 'border-hairline/50 opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {onToggleSelection ? (
            <label className="mt-1 flex shrink-0 cursor-pointer items-center">
              <input
                type="checkbox"
                checked={task.is_selected}
                onChange={(event) => onToggleSelection(event.target.checked)}
                className="h-4 w-4 rounded border-hairline bg-canvas-parchment text-primary focus:ring-primary focus:ring-offset-0"
              />
              <span className="sr-only">PRD에 포함</span>
            </label>
          ) : null}
          <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              maxLength={100}
              className="h-9 w-full rounded-full border border-hairline bg-canvas-parchment px-3 text-sm font-semibold text-ink outline-none focus:border-primary"
            />
          ) : (
            <h3 className="text-base font-semibold text-ink">{task.title}</h3>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {clusterNames.map((name) => (
              <span key={name} className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {name}
              </span>
            ))}
            {task.difficulty ? (
              <span className="rounded bg-canvas-parchment px-2 py-0.5 text-xs text-ink-muted-80">
                난이도: {DIFFICULTY_LABELS[task.difficulty] ?? task.difficulty}
              </span>
            ) : null}
            {task.priority ? (
              <span className="rounded bg-canvas-parchment px-2 py-0.5 text-xs text-ink-muted-80">
                우선순위: {PRIORITY_LABELS[task.priority] ?? task.priority}
              </span>
            ) : null}
          </div>
          </div>
        </div>
        {canEdit ? (
          <div className="flex shrink-0 gap-1">
            {isEditing ? (
              <>
                <button
                  type="button"
                  title="저장"
                  aria-label="저장"
                  onClick={() => void save()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink-muted-80 hover:bg-canvas-parchment"
                >
                  <Save aria-hidden className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="취소"
                  aria-label="취소"
                  onClick={() => setIsEditing(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink-muted-80 hover:bg-canvas-parchment"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  title="편집"
                  aria-label="편집"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink-muted-80 hover:bg-canvas-parchment"
                >
                  <Pencil aria-hidden className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="삭제"
                  aria-label="삭제"
                  onClick={() => void remove()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink-muted-80 hover:bg-canvas-parchment"
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {isEditing ? (
        <textarea
          value={draftDescription}
          onChange={(event) => setDraftDescription(event.target.value)}
          maxLength={500}
          className="mt-3 min-h-24 w-full resize-none rounded-apple-lg border border-hairline bg-canvas-parchment p-3 text-sm text-ink outline-none focus:border-primary"
        />
      ) : (
        <p className="mt-3 text-sm leading-6 text-ink-muted-48">{task.description}</p>
      )}

      {/* Pain Points */}
      {Array.isArray(task.pain_points) && task.pain_points.length > 0 ? (
        <div className="mt-4 rounded-apple-lg border border-red-200 bg-red-50 p-3">
          <p className="mb-1.5 text-xs font-semibold text-red-700">페인포인트</p>
          <ul className="space-y-1 text-sm text-red-900">
            {task.pain_points.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-400" />
                {String(item)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <FeatureList title="핵심 기능" value={task.core_features} accent="primary" />
      <FeatureList title="부가 기능" value={task.sub_features} accent="muted" />

      {task.kpi_name || task.estimated_value ? (
        <div className="mt-4 rounded-apple-lg border border-green-200 bg-green-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {task.kpi_name ? (
              <span className="rounded-full bg-green-600 px-2.5 py-0.5 text-xs font-bold text-white">
                KPI: {task.kpi_name}
              </span>
            ) : null}
            {task.estimated_value ? (
              <span className="text-sm font-medium text-green-800">{task.estimated_value}</span>
            ) : null}
          </div>
          {task.expected_effect ? (
            <p className="mt-1.5 text-xs text-green-700">{task.expected_effect}</p>
          ) : null}
        </div>
      ) : task.expected_effect ? (
        <div className="mt-4 rounded-apple-lg border border-green-200 bg-green-50 p-3">
          <p className="mb-1 text-xs font-semibold text-green-700">기대 효과</p>
          <p className="text-sm text-green-900">{task.expected_effect}</p>
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => void react('👍')}
          className={`rounded-md border px-3 py-1.5 text-sm ${
            reaction.my_reaction === '👍'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-hairline text-ink-muted-80 hover:bg-canvas-parchment'
          }`}
        >
          👍 {reaction.thumbs_up}
        </button>
        <button
          type="button"
          onClick={() => void react('🤔')}
          className={`rounded-md border px-3 py-1.5 text-sm ${
            reaction.my_reaction === '🤔'
              ? 'border-amber-500 bg-amber-50 text-amber-700'
              : 'border-hairline text-ink-muted-80 hover:bg-canvas-parchment'
          }`}
        >
          🤔 {reaction.thinking}
        </button>
      </div>
    </article>
  )
}

function FeatureList({ title, value, accent }: { title: string; value: unknown; accent: 'primary' | 'muted' }) {
  const items = Array.isArray(value) ? value.map(String) : []
  if (!items.length) {
    return null
  }

  return (
    <div className={`mt-4 rounded-apple-lg border p-3 ${accent === 'primary' ? 'border-blue-200 bg-blue-50' : 'border-hairline bg-surface-pearl'}`}>
      <p className={`mb-1.5 text-xs font-semibold ${accent === 'primary' ? 'text-blue-700' : 'text-ink-muted-80'}`}>{title}</p>
      <ul className="space-y-1 text-sm text-ink-muted-80">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-1.5">
            <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${accent === 'primary' ? 'bg-blue-400' : 'bg-ink-muted-48'}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

const DIFFICULTY_LABELS: Record<string, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음',
}

const PRIORITY_LABELS: Record<string, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음',
}

function getClusterIds(task: Tables<'ax_tasks'>) {
  const painPoints = task.pain_points
  if (typeof painPoints === 'object' && painPoints !== null && !Array.isArray(painPoints)) {
    const clusterIds = painPoints.cluster_ids
    if (Array.isArray(clusterIds)) {
      return clusterIds.map(String)
    }
  }

  return task.cluster_id ? [task.cluster_id] : []
}
