'use client'

import type { Json } from '@/types/common'

export function DataRequirementTable({ value }: { value: Json }) {
  const rows = Array.isArray(value) ? value.filter(isRecord) : []

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-neutral-900 text-left text-neutral-400">
          <tr>
            <th className="px-4 py-3">데이터</th>
            <th className="px-4 py-3">소스</th>
            <th className="px-4 py-3">형태</th>
            <th className="px-4 py-3">규모</th>
            <th className="px-4 py-3">담당팀</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-neutral-800">
              <td className="px-4 py-3 text-white">{String(row.name ?? '')}</td>
              <td className="px-4 py-3 text-neutral-300">{String(row.source ?? '')}</td>
              <td className="px-4 py-3 text-neutral-300">{String(row.format ?? '')}</td>
              <td className="px-4 py-3 text-neutral-400">{String(row.volume ?? row.scale ?? '')}</td>
              <td className="px-4 py-3 text-neutral-400">
                {String(row.responsible_team ?? row.owner ?? '')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
