'use client'

import type { Json } from '@/types/common'

export function OrgRequirementList({ value }: { value: Json }) {
  const rows = Array.isArray(value) ? value.filter(isRecord) : []

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map((row, index) => (
        <article key={index} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">{categoryLabel(String(row.category ?? ''))}</h3>
            {row.priority ? (
              <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                {String(row.priority)}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-neutral-400">{String(row.description ?? '')}</p>
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
