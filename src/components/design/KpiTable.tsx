'use client'

import type { Json } from '@/types/common'

export function KpiTable({ value }: { value: Json }) {
  const rows = Array.isArray(value) ? value.filter(isRecord) : []

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-neutral-900 text-left text-neutral-400">
          <tr>
            <th className="px-4 py-3">지표</th>
            <th className="px-4 py-3">AS-IS</th>
            <th className="px-4 py-3">TO-BE</th>
            <th className="px-4 py-3">측정 방법</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-neutral-800">
              <td className="px-4 py-3 text-white">{String(row.name ?? '')}</td>
              <td className="px-4 py-3 text-neutral-300">{String(row.current_value ?? row.as_is ?? '')}</td>
              <td className="px-4 py-3 text-neutral-300">{String(row.target_value ?? row.to_be ?? '')}</td>
              <td className="px-4 py-3 text-neutral-400">
                {String(row.measurement_method ?? row.measurement ?? '')}
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
