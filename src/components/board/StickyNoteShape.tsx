'use client'

import { GripHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useState, type PointerEvent } from 'react'
import type { ProcessOption } from './BoardToolbar'
import type { Note } from '@/types/note'

const NOTE_STYLE = {
  red: { backgroundColor: '#fecaca', borderColor: '#f87171', color: '#450a0a' },
  blue: { backgroundColor: '#bfdbfe', borderColor: '#60a5fa', color: '#082f49' },
  green: { backgroundColor: '#bbf7d0', borderColor: '#4ade80', color: '#052e16' },
  yellow: { backgroundColor: '#fde68a', borderColor: '#fbbf24', color: '#422006' },
} satisfies Record<Note['color'], { backgroundColor: string; borderColor: string; color: string }>

type DragState = {
  pointerId: number
  startClientX: number
  startClientY: number
  startX: number
  startY: number
}

export function StickyNoteShape({
  note,
  participantName,
  processOptions,
  canEdit,
  canDelete,
  readOnly,
  onPatch,
  onDelete,
}: {
  note: Note
  participantName: string
  processOptions: ProcessOption[]
  canEdit: boolean
  canDelete: boolean
  readOnly: boolean
  onPatch(id: string, data: Partial<Note>): void
  onDelete(id: string): void
}) {
  const [draft, setDraft] = useState(note.content)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [position, setPosition] = useState({
    x: note.position_x,
    y: note.position_y,
  })
  const style = NOTE_STYLE[note.color]
  const editable = canEdit && !readOnly

  useEffect(() => {
    setDraft(note.content)
  }, [note.content])

  useEffect(() => {
    if (!drag) {
      setPosition({ x: note.position_x, y: note.position_y })
    }
  }, [drag, note.position_x, note.position_y])

  function commitContent() {
    const content = draft.trim()
    if (!editable || content === note.content) {
      return
    }
    if (!content) {
      setDraft(note.content)
      return
    }
    onPatch(note.id, { content })
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!editable || event.button !== 0) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: position.x,
      startY: position.y,
    })
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    setPosition({
      x: Math.max(12, drag.startX + event.clientX - drag.startClientX),
      y: Math.max(12, drag.startY + event.clientY - drag.startClientY),
    })
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    const nextPosition = {
      x: Math.max(12, drag.startX + event.clientX - drag.startClientX),
      y: Math.max(12, drag.startY + event.clientY - drag.startClientY),
    }

    event.currentTarget.releasePointerCapture(event.pointerId)
    setPosition(nextPosition)
    setDrag(null)
    if (nextPosition.x !== note.position_x || nextPosition.y !== note.position_y) {
      onPatch(note.id, {
        position_x: Math.round(nextPosition.x),
        position_y: Math.round(nextPosition.y),
      })
    }
  }

  return (
    <article
      className="pointer-events-auto absolute w-60 rounded-md border p-3 shadow-lg"
      style={{
        ...style,
        left: position.x,
        top: position.y,
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          title="포스트잇 이동"
          aria-label="포스트잇 이동"
          disabled={!editable}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setDrag(null)}
          className="inline-flex h-6 w-10 items-center justify-center rounded bg-black/10 text-current transition hover:bg-black/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <GripHorizontal aria-hidden className="h-4 w-4" />
        </button>
        {canDelete && !readOnly ? (
          <button
            type="button"
            title="포스트잇 삭제"
            aria-label="포스트잇 삭제"
            onClick={() => onDelete(note.id)}
            className="inline-flex h-7 w-7 items-center justify-center rounded bg-black/10 text-current transition hover:bg-black/15"
          >
            <Trash2 aria-hidden className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitContent}
        disabled={!editable}
        maxLength={200}
        className="min-h-24 w-full resize-none rounded border border-black/10 bg-white/35 p-2 text-sm leading-5 text-current outline-none placeholder:text-current/50 focus:border-black/25 disabled:cursor-default disabled:bg-transparent"
      />
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-current/75">
        <span className="min-w-0 truncate">{participantName}</span>
        <select
          value={note.process_step_id ?? ''}
          onChange={(event) =>
            onPatch(note.id, {
              process_step_id: event.target.value ? event.target.value : null,
            })
          }
          disabled={!editable || processOptions.length === 0}
          className="max-w-32 rounded border border-black/10 bg-white/35 px-1 py-0.5 text-xs text-current outline-none disabled:cursor-default disabled:bg-transparent"
        >
          <option value="">태그 없음</option>
          {processOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </article>
  )
}
