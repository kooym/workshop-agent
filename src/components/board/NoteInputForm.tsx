'use client'

import { Plus, Tags } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { ProcessOption } from './BoardToolbar'
import type { NoteColor } from '@/types/note'

const COLOR_SWATCHES: Record<NoteColor, string> = {
  red: '#fecaca',
  blue: '#bfdbfe',
  green: '#bbf7d0',
  yellow: '#fde68a',
}

const COLOR_LABELS: Record<NoteColor, string> = {
  red: '빨강',
  blue: '파랑',
  green: '초록',
  yellow: '노랑',
}

export function NoteInputForm({
  processOptions,
  noteCount,
  readOnly,
  isCreating,
  onAdd,
}: {
  processOptions: ProcessOption[]
  noteCount: number
  readOnly: boolean
  isCreating: boolean
  onAdd(content: string, color: NoteColor, processStepId: string | null): void
}) {
  const [text, setText] = useState('')
  const [color, setColor] = useState<NoteColor>('yellow')
  const [processStepId, setProcessStepId] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || readOnly || isCreating || noteCount >= 200) return
    onAdd(trimmed, color, processStepId || null)
    setText('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 border-b border-hairline bg-white px-4 py-3"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label htmlFor="note-input" className="text-xs text-ink-muted-48">
          아이디어 입력 ({noteCount}/200)
        </label>
        <input
          id="note-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 200))}
          maxLength={200}
          placeholder="아이디어를 입력하세요..."
          disabled={readOnly || noteCount >= 200}
          className="h-10 w-full rounded-md border border-hairline bg-surface-pearl px-3 text-sm text-ink placeholder:text-ink-muted-48 outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* Color picker */}
      <div className="flex items-center gap-1 rounded-md border border-hairline bg-surface-pearl p-1">
        {(Object.keys(COLOR_SWATCHES) as NoteColor[]).map((c) => (
          <button
            key={c}
            type="button"
            title={`${COLOR_LABELS[c]} 포스트잇`}
            aria-label={`${COLOR_LABELS[c]} 포스트잇`}
            aria-pressed={color === c}
            onClick={() => setColor(c)}
            disabled={readOnly}
            className="h-7 w-7 rounded border border-hairline outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: COLOR_SWATCHES[c],
              boxShadow: color === c ? '0 0 0 2px #38bdf8' : undefined,
            }}
          />
        ))}
      </div>

      {/* Process step tag */}
      {processOptions.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-ink-muted-80">
          <Tags aria-hidden className="h-4 w-4" />
          <select
            value={processStepId}
            onChange={(e) => setProcessStepId(e.target.value)}
            disabled={readOnly}
            className="h-10 min-w-40 rounded-md border border-hairline bg-surface-pearl px-2 text-sm text-ink outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">태그 없음</option>
            {processOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>
      )}

      <button
        type="submit"
        disabled={readOnly || isCreating || !text.trim() || noteCount >= 200}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-canvas-parchment disabled:text-ink-muted-48"
      >
        <Plus aria-hidden className="h-4 w-4" />
        추가
      </button>
    </form>
  )
}
