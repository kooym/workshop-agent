'use client'

import type { Json } from '@/types/common'

type JsonRecord = { [key: string]: Json | undefined }

export function OrgRequirementList({ value }: { value: Json }) {
  const rows = Array.isArray(value) ? value.filter(isJsonRecord) : []

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map((row, index) => (
        <article key={index} className="rounded-apple-lg border border-hairline bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">{categoryLabel(String(row.category ?? ''))}</h3>
            {row.priority ? (
              <span className="rounded bg-canvas-parchment px-2 py-0.5 text-xs text-ink-muted-80">
                {String(row.priority)}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-ink-muted-48">{String(row.description ?? '')}</p>
        </article>
      ))}
    </div>
  )
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    collaboration: '협업',
    training: '교육',
    governance: '거버넌스',
    infrastructure: '인프라',
  }
  return labels[category] ?? category
}

function isJsonRecord(value: Json): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
