'use client'

import { Pencil, Save, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { Json } from '@/types/common'

type JsonRecord = { [key: string]: Json | undefined }

type KpiRow = {
  name: string
  current_value: string
  target_value: string
  measurement_method: string
}

export function KpiTable({
  value,
  canEdit = false,
  workshopId,
  onChanged,
}: {
  value: Json
  canEdit?: boolean
  workshopId?: string
  onChanged?(): void
}) {
  const rows = toRows(value)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<KpiRow[]>(rows)
  const [isSaving, setIsSaving] = useState(false)

  function startEditing() {
    setEditData(toRows(value))
    setIsEditing(true)
  }

  function cancelEditing() {
    setEditData(rows)
    setIsEditing(false)
  }

  function updateRow(index: number, field: keyof KpiRow, fieldValue: string) {
    setEditData((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: fieldValue } : row)),
    )
  }

  async function saveKpis() {
    if (!workshopId) return
    setIsSaving(true)
    const response = await fetch(`/api/workshops/${workshopId}/design-artifacts`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kpis: editData }),
    })
    setIsSaving(false)
    if (!response.ok) {
      toast.error('KPI를 저장하지 못했습니다.')
      return
    }
    setIsEditing(false)
    onChanged?.()
    toast.success('KPI를 저장했습니다.')
  }

  const displayRows = isEditing ? editData : rows

  return (
    <section className="space-y-4">
      {canEdit ? (
        <div className="flex justify-end gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => void saveKpis()}
                disabled={isSaving}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-3 text-sm font-medium text-white hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-canvas-parchment disabled:text-ink-muted-48"
              >
                <Save aria-hidden className="h-4 w-4" />
                저장
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-hairline px-3 text-sm text-ink-muted-80 hover:bg-canvas-parchment"
              >
                <X aria-hidden className="h-4 w-4" />
                취소
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-hairline px-3 text-sm text-ink-muted-80 hover:bg-canvas-parchment"
            >
              <Pencil aria-hidden className="h-4 w-4" />
              편집
            </button>
          )}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-apple-lg border border-hairline">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-canvas-parchment text-left text-ink-muted-48">
            <tr>
              <th className="px-4 py-3">지표</th>
              <th className="px-4 py-3">AS-IS</th>
              <th className="px-4 py-3">TO-BE</th>
              <th className="px-4 py-3">측정 방법</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, index) => (
              <tr key={index} className="border-t border-hairline">
                {isEditing ? (
                  <>
                    <td className="px-3 py-2">
                      <input
                        value={row.name}
                        onChange={(e) => updateRow(index, 'name', e.target.value)}
                        maxLength={100}
                        className="h-8 w-full rounded border border-hairline bg-canvas-parchment px-2 text-sm text-ink outline-none focus:border-primary"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.current_value}
                        onChange={(e) => updateRow(index, 'current_value', e.target.value)}
                        maxLength={200}
                        className="h-8 w-full rounded border border-hairline bg-canvas-parchment px-2 text-sm text-ink outline-none focus:border-primary"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.target_value}
                        onChange={(e) => updateRow(index, 'target_value', e.target.value)}
                        maxLength={200}
                        className="h-8 w-full rounded border border-hairline bg-canvas-parchment px-2 text-sm text-ink outline-none focus:border-primary"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.measurement_method}
                        onChange={(e) => updateRow(index, 'measurement_method', e.target.value)}
                        maxLength={500}
                        className="h-8 w-full rounded border border-hairline bg-canvas-parchment px-2 text-sm text-ink outline-none focus:border-primary"
                      />
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-ink">{row.name}</td>
                    <td className="px-4 py-3 text-ink-muted-80">{row.current_value}</td>
                    <td className="px-4 py-3 text-ink-muted-80">{row.target_value}</td>
                    <td className="px-4 py-3 text-ink-muted-48">{row.measurement_method}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function toRows(value: Json): KpiRow[] {
  if (!Array.isArray(value)) return []
  return value.filter(isJsonRecord).map((row) => ({
    name: String(row.name ?? ''),
    current_value: String(row.current_value ?? row.as_is ?? ''),
    target_value: String(row.target_value ?? row.to_be ?? ''),
    measurement_method: String(row.measurement_method ?? row.measurement ?? ''),
  }))
}

function isJsonRecord(value: Json): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
