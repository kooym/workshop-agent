'use client'

import { X } from 'lucide-react'

export function ConfirmModal({
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  isBusy = false,
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  isBusy?: boolean
  onConfirm(): void
  onCancel(): void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-apple-lg border border-hairline bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted-80">{description}</p>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onCancel}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted-48 hover:bg-surface-pearl hover:text-ink"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="rounded-full border border-hairline px-3 py-2 text-sm text-ink hover:bg-surface-pearl disabled:cursor-not-allowed disabled:text-ink-muted-48"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className="rounded-full bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-surface-pearl disabled:text-ink-muted-48"
          >
            {isBusy ? '처리 중' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
