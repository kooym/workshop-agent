'use client'

import { Check, Pencil, Trash2, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { ProcessOption } from './BoardToolbar'
import type { Note, NoteColor } from '@/types/note'
import type { Participant } from '@/types/workshop'

const COLOR_BG: Record<NoteColor, string> = {
  red: 'bg-red-200',
  blue: 'bg-blue-200',
  green: 'bg-green-200',
  yellow: 'bg-yellow-200',
}

const COLOR_TEXT: Record<NoteColor, string> = {
  red: 'text-red-900',
  blue: 'text-blue-900',
  green: 'text-green-900',
  yellow: 'text-yellow-900',
}

const COLOR_SWATCH: { value: NoteColor; bg: string }[] = [
  { value: 'yellow', bg: 'bg-yellow-300' },
  { value: 'red', bg: 'bg-red-300' },
  { value: 'blue', bg: 'bg-blue-300' },
  { value: 'green', bg: 'bg-green-300' },
]

type SortMode = 'newest' | 'oldest' | 'color' | 'author'
type FilterColor = NoteColor | 'all'

export function NoteBoard({
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
      case 'author':
        result.sort((a, b) => {
          const nameA = participantNames.get(a.participant_id) ?? ''
          const nameB = participantNames.get(b.participant_id) ?? ''
          return nameA.localeCompare(nameB)
        })
        break
    }
    return result
  }, [notes, filterColor, filterProcessStep, sortMode, participantNames])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFilterColor('all')}
            className={`rounded px-2 py-1 text-xs ${filterColor === 'all' ? 'bg-primary text-white' : 'bg-surface-pearl text-ink-muted-48'}`}
          >
            전체
          </button>
          {COLOR_SWATCH.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setFilterColor(c.value)}
              className={`h-6 w-6 rounded-full ${c.bg} ${filterColor === c.value ? 'ring-2 ring-primary' : 'opacity-60 hover:opacity-100'}`}
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
          <option value="author">작성자순</option>
        </select>
        <span className="text-xs text-ink-muted-48">{filtered.length}건</span>
      </div>

      {/* Card Grid */}
      <div className="flex-1 overflow-auto p-4">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-hairline bg-canvas-parchment p-8 text-center text-sm text-ink-muted-48">
            {notes.length === 0
              ? '왼쪽에서 아이디어를 입력하세요.'
              : '필터 조건에 맞는 포스트잇이 없습니다.'}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((note) => (
              <StickyCard
                key={note.id}
                note={note}
                authorName={anonymous ? '익명 참여자' : (participantNames.get(note.participant_id) ?? '참석자')}
                processStepName={note.process_step_id ? processOptionMap.get(note.process_step_id) : undefined}
                isOwner={note.participant_id === currentParticipantId}
                canDelete={note.participant_id === currentParticipantId || isFacilitator}
                readOnly={readOnly}
                processOptions={processOptions}
                onPatch={onPatchNote}
                onDelete={onDeleteNote}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StickyCard({
  note,
  authorName,
  processStepName,
  isOwner,
  canDelete,
  readOnly,
  processOptions,
  onPatch,
  onDelete,
}: {
  note: Note
  authorName: string
  processStepName?: string
  isOwner: boolean
  canDelete: boolean
  readOnly: boolean
  processOptions: ProcessOption[]
  onPatch(id: string, data: Partial<Note>): void
  onDelete(id: string): void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(note.content)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)

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

  const handleColorChange = useCallback(
    (newColor: NoteColor) => {
      if (readOnly || !isOwner) return
      onPatch(note.id, { color: newColor })
      setShowColorPicker(false)
    },
    [readOnly, isOwner, note.id, onPatch],
  )

  const handleTagClick = useCallback(
    (stepId: string | null) => {
      if (readOnly || !isOwner) return
      const newVal = stepId === note.process_step_id ? null : stepId
      onPatch(note.id, { process_step_id: newVal } as Partial<Note>)
    },
    [readOnly, isOwner, note.id, note.process_step_id, onPatch],
  )

  return (
    <div
      className={`group relative rounded-lg ${COLOR_BG[note.color]} p-4 shadow-md transition-shadow hover:shadow-lg`}
    >
      {/* Tape decoration */}
      <div className="absolute -top-1.5 left-1/2 h-3 w-10 -translate-x-1/2 rounded-sm bg-white/40" />

      {/* Content */}
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value.slice(0, 200))}
            maxLength={200}
            autoFocus
            className={`min-h-[80px] w-full resize-none rounded bg-white/30 px-2 py-1 text-sm ${COLOR_TEXT[note.color]} outline-none`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit() }
              if (e.key === 'Escape') cancelEdit()
            }}
          />
          <div className="flex items-center justify-between text-[11px]">
            <span className={`${editText.length > 180 ? 'text-red-700 font-medium' : COLOR_TEXT[note.color] + '/60'}`}>
              {editText.length}/200
            </span>
            <div className="flex gap-1">
              <button type="button" onClick={cancelEdit} className="rounded p-1 hover:bg-black/10">
                <X aria-hidden className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={commitEdit} className="rounded p-1 hover:bg-black/10">
                <Check aria-hidden className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p
          className={`min-h-[60px] whitespace-pre-wrap break-words text-sm ${!readOnly ? 'pr-16' : ''} ${COLOR_TEXT[note.color]}`}
          onDoubleClick={startEdit}
        >
          {note.content}
        </p>
      )}

      {/* Process tag chips */}
      {!isEditing && processOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {processOptions.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => handleTagClick(o.id)}
              disabled={readOnly || !isOwner}
              className={`rounded-full px-2 py-0.5 text-[10px] transition ${
                note.process_step_id === o.id
                  ? 'bg-primary text-white'
                  : 'bg-black/5 text-ink-muted-80 hover:bg-black/10'
              } disabled:cursor-default`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {/* Footer: author + color picker */}
      <div className="mt-2 flex items-center justify-between">
        <span className={`text-[11px] ${COLOR_TEXT[note.color]}/60`}>
          {authorName}
          {processStepName && !processOptions.length && (
            <span className="ml-1.5 rounded bg-black/10 px-1.5 py-0.5">{processStepName}</span>
          )}
        </span>

        {/* Color change swatches (owner, on hover) */}
        {!readOnly && isOwner && !isEditing && (
          <div className="relative">
            {showColorPicker ? (
              <div className="flex gap-1">
                {COLOR_SWATCH.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => handleColorChange(c.value)}
                    className={`h-4 w-4 rounded-full ${c.bg} ${note.color === c.value ? 'ring-1 ring-neutral-900' : ''}`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Actions — top right, always visible */}
      {!readOnly && !isEditing && (
        <div className="absolute right-2 top-2 flex gap-1">
          {isOwner && (
            <>
              <button
                type="button"
                onClick={() => setShowColorPicker((v) => !v)}
                className="rounded p-1 hover:bg-black/10"
                title="색상 변경"
              >
                <span className={`inline-block h-3 w-3 rounded-full ${COLOR_BG[note.color]} ring-1 ring-hairline`} />
              </button>
              <button
                type="button"
                onClick={startEdit}
                className="rounded p-1 hover:bg-black/10"
                title="수정"
              >
                <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded p-1 hover:bg-red-500/20"
              title="삭제"
            >
              <Trash2 aria-hidden className="h-3.5 w-3.5 text-red-700" strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}

      {/* Delete confirmation overlay */}
      {confirmDelete && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-black/60">
          <p className="text-sm font-medium text-white">삭제하시겠습니까?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { onDelete(note.id); setConfirmDelete(false) }}
              className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-500"
            >
              삭제
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded bg-canvas-parchment px-3 py-1 text-xs text-ink hover:bg-white"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
