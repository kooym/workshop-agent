'use client'

import { Plus, StickyNote, Tags } from 'lucide-react'
import type { NoteColor } from '@/types/note'

export type ProcessOption = {
  id: string
  label: string
}

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

export function BoardToolbar({
  selectedColor,
  selectedProcessStepId,
  processOptions,
  noteCount,
  readOnly,
  isCreating,
  onColorChange,
  onProcessStepChange,
  onAddNote,
}: {
  selectedColor: NoteColor
  selectedProcessStepId: string
  processOptions: ProcessOption[]
  noteCount: number
  readOnly: boolean
  isCreating: boolean
  onColorChange(color: NoteColor): void
  onProcessStepChange(processStepId: string): void
  onAddNote(): void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 bg-neutral-950 px-4 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-neutral-300">
          <StickyNote aria-hidden className="h-4 w-4" />
          <span>{noteCount}/200</span>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-900 p-1">
          {(Object.keys(COLOR_SWATCHES) as NoteColor[]).map((color) => (
            <button
              key={color}
              type="button"
              title={`${COLOR_LABELS[color]} 포스트잇`}
              aria-label={`${COLOR_LABELS[color]} 포스트잇`}
              aria-pressed={selectedColor === color}
              onClick={() => onColorChange(color)}
              disabled={readOnly}
              className="h-7 w-7 rounded border border-neutral-700 outline-none ring-offset-2 ring-offset-neutral-950 transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor: COLOR_SWATCHES[color],
                boxShadow: selectedColor === color ? '0 0 0 2px #38bdf8' : undefined,
              }}
            />
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <Tags aria-hidden className="h-4 w-4" />
          <select
            value={selectedProcessStepId}
            onChange={(event) => onProcessStepChange(event.target.value)}
            disabled={readOnly || processOptions.length === 0}
            className="h-9 min-w-48 rounded-md border border-neutral-800 bg-neutral-900 px-3 text-sm text-white outline-none focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">프로세스 태그 없음</option>
            {processOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        title="포스트잇 추가"
        onClick={onAddNote}
        disabled={readOnly || isCreating || noteCount >= 200}
        className="inline-flex h-9 items-center gap-2 rounded-md bg-sky-600 px-3 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
      >
        <Plus aria-hidden className="h-4 w-4" />
        포스트잇 추가
      </button>
    </div>
  )
}
