'use client'

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import type { ProcessOption } from './BoardToolbar'
import type { NoteColor } from '@/types/note'

const COLOR_SWATCHES: { value: NoteColor; bg: string; label: string }[] = [
  { value: 'yellow', bg: 'bg-yellow-300', label: '노랑' },
  { value: 'red', bg: 'bg-red-300', label: '빨강' },
  { value: 'blue', bg: 'bg-blue-300', label: '파랑' },
  { value: 'green', bg: 'bg-green-300', label: '초록' },
]

const COLOR_BG: Record<NoteColor, string> = {
  yellow: 'bg-yellow-200',
  red: 'bg-red-200',
  blue: 'bg-blue-200',
  green: 'bg-green-200',
}

const MAX_LENGTH = 200

export function NoteInputPanel({
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
  const [processStepId, setProcessStepId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed || readOnly || isCreating || noteCount >= MAX_LENGTH) return
    onAdd(trimmed, color, processStepId)
    setText('')
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const isFull = noteCount >= 200

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Post-it shaped input card */}
      <div className={`relative rounded-lg ${COLOR_BG[color]} p-4 shadow-md transition-colors`}>
        {/* Tape decoration */}
        <div className="absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 rounded-sm bg-white/40" />

        <textarea
          ref={textareaRef}
          id="note-input"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
          maxLength={MAX_LENGTH}
          placeholder={isFull ? '최대 200개 도달' : '아이디어를 입력하세요...'}
          disabled={readOnly || isFull}
          onKeyDown={handleKeyDown}
          rows={5}
          className="w-full resize-none rounded bg-transparent text-sm text-neutral-800 placeholder-ink-muted-48 outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />

        {/* Character counter */}
        <div className="flex items-center justify-between text-[11px] text-neutral-600">
          <span>{noteCount}/200개</span>
          <span className={text.length > 180 ? 'text-red-600 font-medium' : ''}>
            {text.length}/{MAX_LENGTH}
          </span>
        </div>
      </div>

      {/* Color swatches */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-ink-muted-48">색상</label>
        <div className="flex gap-1">
          {COLOR_SWATCHES.map((c) => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              aria-label={`${c.label} 포스트잇`}
              aria-pressed={color === c.value}
              onClick={() => setColor(c.value)}
              disabled={readOnly}
              className={`h-6 w-6 rounded-full ${c.bg} transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50 ${color === c.value ? 'ring-2 ring-primary ring-offset-1 ring-offset-white' : ''}`}
            />
          ))}
        </div>
      </div>

      {/* Process tag chips */}
      {processOptions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-ink-muted-48">프로세스 태그</label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setProcessStepId(null)}
              disabled={readOnly}
              className={`rounded-full px-2.5 py-1 text-xs transition ${
                processStepId === null
                  ? 'bg-primary text-white'
                  : 'bg-surface-pearl text-ink-muted-48 hover:bg-canvas-parchment'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              없음
            </button>
            {processOptions.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setProcessStepId(o.id)}
                disabled={readOnly}
                className={`rounded-full px-2.5 py-1 text-xs transition ${
                  processStepId === o.id
                    ? 'bg-primary text-white'
                    : 'bg-surface-pearl text-ink-muted-48 hover:bg-canvas-parchment'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Submit hint */}
      <p className="text-center text-[11px] text-ink-muted-48">
        Enter로 추가 · Shift+Enter 줄바꿈
      </p>
    </div>
  )
}
