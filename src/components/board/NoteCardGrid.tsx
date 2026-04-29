'use client'

import { Pencil, Trash2, X, Check } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { ProcessOption } from './BoardToolbar'
import type { Note, NoteColor } from '@/types/note'
import type { Participant } from '@/types/workshop'

const COLOR_BG: Record<NoteColor, string> = {
  red: 'bg-red-400/20 border-red-400/40',
  blue: 'bg-blue-400/20 border-blue-400/40',
  green: 'bg-green-400/20 border-green-400/40',
  yellow: 'bg-yellow-400/20 border-yellow-400/40',
}

const COLOR_STRIP: Record<NoteColor, string> = {
  red: 'bg-red-400',
  blue: 'bg-blue-400',
  green: 'bg-green-400',
  yellow: 'bg-yellow-400',
}

type SortMode = 'newest' | 'oldest' | 'color'
type FilterColor = NoteColor | 'all'

export function NoteCardGrid({
  notes,
  participants,
  currentParticipantId,
  isFacilitator,
  anonymous,
  processOptions,
  readOnly,
  onPatchNote,
  onDeleteNote,
}: {
  notes: Note[]
  participants: Participant[]
  currentParticipantId: string
  isFacilitator: boolean
  anonymous: boolean
  processOptions: ProcessOption[]
  readOnly: boolean
  onPatchNote(id: string, data: Partial<Note>): void
  onDeleteNote(id: string): void
}) {
  const [filterColor, setFilterColor] = useState<FilterColor>('all')
  const [filterProcessStep, setFilterProcessStep] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('newest')

  const participantNames = useMemo(
    () => new Map(participants.map((p) => [p.id, p.display_name])),
    [participants],
  )

  const processOptionMap = useMemo(
    () => new Map(processOptions.map((o) => [o.id, o.label])),
    [processOptions],
  )

  const filtered = useMemo(() => {
    let result = [...notes]
    if (filterColor !== 'all') {
      result = result.filter((n) => n.color === filterColor)
    }
    if (filterProcessStep) {
      result = result.filter((n) => n.process_step_id === filterProcessStep)
    }
    switch (sortMode) {
      case 'newest':
        result.sort((a, b) => b.created_at.localeCompare(a.created_at))
        break
      case 'oldest':
        result.sort((a, b) => a.created_at.localeCompare(b.created_at))
        break
      case 'color':
        result.sort((a, b) => a.color.localeCompare(b.color))
        break
    }
    return result
  }, [notes, filterColor, filterProcessStep, sortMode])

  return (
    <div className="flex-1 overflow-auto p-4">
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFilterColor('all')}
            className={`rounded px-2 py-1 text-xs ${filterColor === 'all' ? 'bg-primary text-white' : 'bg-surface-pearl text-ink-muted-48'}`}
          >
            전체
          </button>
          {(['red', 'blue', 'green', 'yellow'] as NoteColor[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilterColor(c)}
              className={`h-6 w-6 rounded ${COLOR_STRIP[c]} ${filterColor === c ? 'ring-2 ring-primary' : 'opacity-60 hover:opacity-100'}`}
            />
          ))}
        </div>
        {processOptions.length > 0 && (
          <select
            value={filterProcessStep}
            onChange={(e) => setFilterProcessStep(e.target.value)}
            className="h-8 rounded border border-hairline bg-surface-pearl px-2 text-xs text-ink"
          >
            <option value="">모든 프로세스</option>
            {processOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        )}
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="h-8 rounded border border-hairline bg-surface-pearl px-2 text-xs text-ink"
        >
          <option value="newest">최신순</option>
          <option value="oldest">오래된순</option>
          <option value="color">색상순</option>
        </select>
        <span className="text-xs text-ink-muted-48">{filtered.length}건</span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-hairline bg-canvas-parchment p-8 text-center text-sm text-ink-muted-48">
          {notes.length === 0
            ? '아직 작성된 포스트잇이 없습니다. 위에서 아이디어를 입력하세요.'
            : '필터 조건에 맞는 포스트잇이 없습니다.'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              authorName={anonymous ? '익명 참여자' : (participantNames.get(note.participant_id) ?? '참석자')}
              processStepName={note.process_step_id ? processOptionMap.get(note.process_step_id) : undefined}
              isOwner={note.participant_id === currentParticipantId}
              canDelete={note.participant_id === currentParticipantId || isFacilitator}
              readOnly={readOnly}
              onPatch={onPatchNote}
              onDelete={onDeleteNote}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NoteCard({
  note,
  authorName,
  processStepName,
  isOwner,
  canDelete,
  readOnly,
  onPatch,
  onDelete,
}: {
  note: Note
  authorName: string
  processStepName?: string
  isOwner: boolean
  canDelete: boolean
  readOnly: boolean
  onPatch(id: string, data: Partial<Note>): void
  onDelete(id: string): void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(note.content)

  const startEdit = useCallback(() => {
    if (readOnly || !isOwner) return
    setEditText(note.content)
    setIsEditing(true)
  }, [readOnly, isOwner, note.content])

  const commitEdit = useCallback(() => {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== note.content) {
      onPatch(note.id, { content: trimmed })
    }
    setIsEditing(false)
  }, [editText, note.content, note.id, onPatch])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
  }, [])

  return (
    <div className={`group relative overflow-hidden rounded-lg border ${COLOR_BG[note.color]} transition-shadow hover:shadow-md`}>
      {/* Color strip */}
      <div className={`h-1 ${COLOR_STRIP[note.color]}`} />

      <div className="p-3">
        {/* Content */}
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value.slice(0, 200))}
              maxLength={200}
              autoFocus
              className="min-h-[60px] w-full resize-none rounded border border-hairline bg-surface-pearl px-2 py-1 text-sm text-ink outline-none focus:border-primary"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit() }
                if (e.key === 'Escape') cancelEdit()
              }}
            />
            <div className="flex justify-end gap-1">
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded p-1 text-ink-muted-48 hover:bg-canvas-parchment"
              >
                <X aria-hidden className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={commitEdit}
                className="rounded p-1 text-primary hover:bg-canvas-parchment"
              >
                <Check aria-hidden className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <p
            className="min-h-[40px] whitespace-pre-wrap break-words text-sm text-ink/90"
            onDoubleClick={startEdit}
          >
            {note.content}
          </p>
        )}

        {/* Meta */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted-48">
          <span>{authorName}</span>
          {processStepName && (
            <span className="rounded bg-canvas-parchment px-1.5 py-0.5">{processStepName}</span>
          )}
        </div>

        {/* Actions — visible on hover */}
        {!readOnly && !isEditing && (
          <div className="absolute right-2 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {isOwner && (
              <button
                type="button"
                onClick={startEdit}
                className="rounded p-1 text-ink-muted-48 hover:bg-canvas-parchment hover:text-ink"
                title="수정"
              >
                <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(note.id)}
                className="rounded p-1 text-ink-muted-48 hover:bg-red-50 hover:text-red-600"
                title="삭제"
              >
                <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
