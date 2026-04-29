'use client'

import { Check, Pencil, Save, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ClusterScoring } from './ClusterScoring'
import type { ClusterWithNotes } from '@/types/cluster'
import type { Note } from '@/types/note'

const NOTE_STYLE = {
  red: 'border-red-300 bg-red-100 text-red-950',
  blue: 'border-blue-300 bg-blue-100 text-blue-950',
  green: 'border-green-300 bg-green-100 text-green-950',
  yellow: 'border-yellow-300 bg-yellow-100 text-yellow-950',
} satisfies Record<Note['color'], string>

export function ClusterGroup({
  cluster,
  canEdit,
  canScore,
  onUpdated,
}: {
  cluster: ClusterWithNotes
  canEdit: boolean
  canScore?: boolean
  onUpdated(): void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(cluster.name)
  const [isSaving, setIsSaving] = useState(false)

  async function saveName() {
    const name = draftName.trim()
    if (!name || name === cluster.name) {
      setDraftName(cluster.name)
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    const response = await fetch(`/api/clusters/${cluster.id}?workshop_id=${cluster.workshop_id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })

    setIsSaving(false)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      toast.error(payload?.error?.message ?? '클러스터 이름을 저장하지 못했습니다.')
      return
    }

    setIsEditing(false)
    onUpdated()
  }

  return (
    <section className="rounded-apple-lg border border-hairline bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              maxLength={50}
              className="h-9 w-full rounded-md border border-hairline bg-canvas-parchment px-3 text-sm font-semibold text-ink outline-none focus:border-primary-focus"
            />
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-ink">{cluster.name}</h3>
              {cluster.is_stale ? (
                <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
                  stale
                </span>
              ) : null}
            </div>
          )}
          {cluster.summary ? (
            <p className="mt-1 text-sm leading-5 text-ink-muted-48">{cluster.summary}</p>
          ) : null}
        </div>
        {canEdit ? (
          <div className="flex shrink-0 items-center gap-1">
            {isEditing ? (
              <>
                <button
                  type="button"
                  title="저장"
                  aria-label="저장"
                  onClick={saveName}
                  disabled={isSaving}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink hover:bg-canvas-parchment disabled:opacity-50"
                >
                  {isSaving ? (
                    <Check aria-hidden className="h-4 w-4" />
                  ) : (
                    <Save aria-hidden className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  title="취소"
                  aria-label="취소"
                  onClick={() => {
                    setDraftName(cluster.name)
                    setIsEditing(false)
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink hover:bg-canvas-parchment"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                title="클러스터 이름 편집"
                aria-label="클러스터 이름 편집"
                onClick={() => setIsEditing(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink hover:bg-canvas-parchment"
              >
                <Pencil aria-hidden className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : null}
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {cluster.notes.map((note) => (
          <article key={note.id} className={`min-h-24 rounded-md border p-3 ${NOTE_STYLE[note.color]}`}>
            <p className="text-sm leading-5">{note.content}</p>
          </article>
        ))}
        {cluster.notes.length === 0 ? (
          <p className="col-span-full rounded-md border border-dashed border-hairline p-4 text-sm text-ink-muted-48">
            아직 연결된 포스트잇이 없습니다.
          </p>
        ) : null}
      </div>
      <ClusterScoring cluster={cluster} canEdit={canScore ?? canEdit} onUpdated={onUpdated} />
      <div className="border-t border-hairline px-4 py-2 text-xs text-ink-muted-48">
        포스트잇 {cluster.notes.length}개
      </div>
    </section>
  )
}
