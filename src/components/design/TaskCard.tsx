'use client'

import { Pencil, Save, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useClusterStore } from '@/stores/cluster'
import { useDesignStore } from '@/stores/design'
import type { Tables } from '@/lib/supabase/types'

type ReactionSummary = {
  thumbs_up: number
  warning: number
  my_reaction: '👍' | '⚠️' | null
}

export function TaskCard({
  task,
  canEdit,
  onChanged,
}: {
  task: Tables<'ax_tasks'>
  canEdit: boolean
  onChanged(): void
}) {
  const clusters = useClusterStore((state) => state.clusters)
  const reactionRevision = useDesignStore((state) => state.reactionRevision)
  const bumpReactionRevision = useDesignStore((state) => state.bumpReactionRevision)
  const [reaction, setReaction] = useState<ReactionSummary>({
    thumbs_up: 0,
    warning: 0,
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
    void refetchReaction()
  }, [reactionRevision, task.id])

  async function refetchReaction() {
    const response = await fetch(`/api/reactions?workshop_id=${task.workshop_id}&task_id=${task.id}`)
    if (!response.ok) {
      return
    }
    const payload = await response.json()
    setReaction(payload.data)
  }

  async function react(reactionType: '👍' | '⚠️') {
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
    <article className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              maxLength={100}
              className="h-9 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm font-semibold text-white outline-none focus:border-sky-500"
            />
          ) : (
            <h3 className="text-base font-semibold text-white">{task.title}</h3>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {clusterNames.map((name) => (
              <span key={name} className="rounded bg-sky-500/15 px-2 py-0.5 text-xs text-sky-200">
                {name}
              </span>
            ))}
            {task.difficulty ? (
              <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                {task.difficulty}
              </span>
            ) : null}
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
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-700 text-neutral-200 hover:bg-neutral-800"
                >
                  <Save aria-hidden className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="취소"
                  aria-label="취소"
                  onClick={() => setIsEditing(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-700 text-neutral-200 hover:bg-neutral-800"
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
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-700 text-neutral-200 hover:bg-neutral-800"
                >
                  <Pencil aria-hidden className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="삭제"
                  aria-label="삭제"
                  onClick={() => void remove()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-700 text-neutral-200 hover:bg-neutral-800"
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
          className="mt-3 min-h-24 w-full resize-none rounded-md border border-neutral-700 bg-neutral-950 p-3 text-sm text-white outline-none focus:border-sky-500"
        />
      ) : (
        <p className="mt-3 text-sm leading-6 text-neutral-400">{task.description}</p>
      )}

      <FeatureList title="핵심 기능" value={task.core_features} />
      <FeatureList title="부가 기능" value={task.sub_features} />

      {task.expected_effect ? (
        <p className="mt-4 rounded-md bg-neutral-950 p-3 text-sm text-neutral-300">
          {task.expected_effect}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => void react('👍')}
          className={`rounded-md border px-3 py-1.5 text-sm ${
            reaction.my_reaction === '👍'
              ? 'border-sky-400 bg-sky-500/20 text-sky-100'
              : 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'
          }`}
        >
          👍 {reaction.thumbs_up}
        </button>
        <button
          type="button"
          onClick={() => void react('⚠️')}
          className={`rounded-md border px-3 py-1.5 text-sm ${
            reaction.my_reaction === '⚠️'
              ? 'border-amber-400 bg-amber-500/20 text-amber-100'
              : 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'
          }`}
        >
          ⚠️ {reaction.warning}
        </button>
      </div>
    </article>
  )
}

function FeatureList({ title, value }: { title: string; value: unknown }) {
  const items = Array.isArray(value) ? value.map(String) : []
  if (!items.length) {
    return null
  }

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium text-neutral-500">{title}</p>
      <ul className="space-y-1 text-sm text-neutral-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
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
