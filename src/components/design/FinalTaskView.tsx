'use client'

import { Check, ChevronDown, ChevronRight, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { FinalTaskDetail } from '@/lib/ai/schemas'

type FinalTaskViewProps = {
  workshopId: string
  detail: FinalTaskDetail
  isFacilitator: boolean
  onChange?: (updated: FinalTaskDetail) => void
}

const CATEGORIES = [
  { key: 'core_features' as const, label: '핵심 기능', fields: ['name', 'description', 'implementation_type'] },
  { key: 'kpis' as const, label: 'KPI', fields: ['name', 'description', 'current_value', 'target_value', 'measurement_method'] },
  { key: 'process_changes' as const, label: '프로세스 변경', fields: ['area', 'as_is', 'to_be', 'impact'] },
  { key: 'expected_effects' as const, label: '기대 효과', fields: ['type', 'description'] },
  { key: 'risks' as const, label: '리스크', fields: ['description'] },
] as const

type CategoryKey = (typeof CATEGORIES)[number]['key']

export function FinalTaskView({ workshopId, detail, isFacilitator, onChange }: FinalTaskViewProps) {
  const [localDetail, setLocalDetail] = useState<FinalTaskDetail>(detail)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const hasUnsavedChanges = useRef(false)

  // Sync from server prop only when NOT in edit mode
  useEffect(() => {
    if (!isEditing) {
      setLocalDetail(detail)
    }
  }, [detail, isEditing])

  const saveToServer = useCallback(
    async (updated: FinalTaskDetail) => {
      setIsSaving(true)
      try {
        const res = await fetch(`/api/workshops/${workshopId}/final-task-detail`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(updated),
        })
        if (!res.ok) {
          const payload = await res.json().catch(() => null)
          if (res.status !== 400 || payload?.error?.code !== 'VALIDATION_ERROR') {
            toast.error('저장에 실패했습니다.')
            return false
          }
        }
        toast.success('저장되었습니다.')
        return true
      } catch {
        toast.error('저장에 실패했습니다.')
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [workshopId],
  )

  function updateLocal(updated: FinalTaskDetail) {
    setLocalDetail(updated)
    hasUnsavedChanges.current = true
  }

  async function handleSave() {
    const ok = await saveToServer(localDetail)
    if (ok) {
      hasUnsavedChanges.current = false
      onChange?.(localDetail)
      setIsEditing(false)
    }
  }

  function handleCancelEdit() {
    setLocalDetail(detail)
    hasUnsavedChanges.current = false
    setIsEditing(false)
  }

  function toggleCheck(categoryKey: CategoryKey, index: number) {
    const arr = [...(localDetail[categoryKey] as { is_checked: boolean }[])]
    arr[index] = { ...arr[index], is_checked: !arr[index].is_checked }
    updateLocal({ ...localDetail, [categoryKey]: arr })
  }

  function deleteItem(categoryKey: CategoryKey, index: number) {
    const arr = [...(localDetail[categoryKey] as unknown[])]
    arr.splice(index, 1)
    updateLocal({ ...localDetail, [categoryKey]: arr })
  }

  function addItem(categoryKey: CategoryKey) {
    const arr = [...(localDetail[categoryKey] as unknown[])]
    const newItem = createEmptyItem(categoryKey)
    arr.push(newItem)
    updateLocal({ ...localDetail, [categoryKey]: arr })
  }

  function updateItemField(categoryKey: CategoryKey, index: number, field: string, value: string) {
    const arr = [...(localDetail[categoryKey] as Record<string, unknown>[])]
    arr[index] = { ...arr[index], [field]: value }
    updateLocal({ ...localDetail, [categoryKey]: arr })
  }

  const checkedCounts = CATEGORIES.reduce(
    (acc, cat) => {
      const items = (localDetail[cat.key] as { is_checked: boolean }[]) ?? []
      acc[cat.key] = items.filter((i) => i.is_checked).length
      return acc
    },
    {} as Record<CategoryKey, number>,
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-apple-lg border border-hairline bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-ink">{localDetail.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-muted-80">{localDetail.description}</p>
            {localDetail.rationale ? (
              <p className="mt-2 text-xs text-ink-muted-48">선정 근거: {localDetail.rationale}</p>
            ) : null}
          </div>
          {isFacilitator ? (
            <div className="flex shrink-0 gap-2">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-white hover:bg-primary-focus disabled:opacity-50"
                  >
                    <Save aria-hidden className="h-4 w-4" />
                    {isSaving ? '저장 중...' : '저장'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline px-4 text-sm text-ink-muted-80 hover:bg-canvas-parchment"
                  >
                    취소
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline px-4 text-sm text-ink-muted-80 hover:bg-canvas-parchment"
                >
                  <Pencil aria-hidden className="h-3.5 w-3.5" />
                  수정
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Categories */}
      {CATEGORIES.map((cat) => {
        const items = (localDetail[cat.key] as Record<string, unknown>[]) ?? []
        const total = items.length
        const checked = checkedCounts[cat.key]

        return (
          <div key={cat.key} className="rounded-apple-lg border border-hairline bg-white">
            <button
              type="button"
              onClick={() => setCollapsed(prev => ({ ...prev, [cat.key]: !prev[cat.key] }))}
              className="flex w-full items-center justify-between border-b border-hairline px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                {collapsed[cat.key]
                  ? <ChevronRight aria-hidden className="h-4 w-4 text-ink-muted-48" />
                  : <ChevronDown aria-hidden className="h-4 w-4 text-ink-muted-48" />
                }
                <h4 className="text-sm font-semibold text-ink">{cat.label}</h4>
                <span className="text-xs text-ink-muted-48">
                  {checked}/{total}개 선택
                </span>
              </div>
              {isEditing ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); addItem(cat.key) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); addItem(cat.key) } }}
                  className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-primary hover:bg-primary/5"
                >
                  <Plus aria-hidden className="h-3 w-3" />
                  추가
                </span>
              ) : null}
            </button>
            {!collapsed[cat.key] ? (
            <div className="divide-y divide-hairline">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 px-4 py-3 ${
                    item.is_checked === false ? 'opacity-40' : ''
                  }`}
                >
                  {isEditing ? (
                    <button
                      type="button"
                      onClick={() => toggleCheck(cat.key, idx)}
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        item.is_checked !== false
                          ? 'border-primary bg-primary text-white'
                          : 'border-hairline bg-canvas-parchment'
                      }`}
                    >
                      {item.is_checked !== false ? <Check aria-hidden className="h-2.5 w-2.5" /> : null}
                    </button>
                  ) : (
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        item.is_checked !== false
                          ? 'border-primary bg-primary text-white'
                          : 'border-hairline bg-canvas-parchment'
                      }`}
                    >
                      {item.is_checked !== false ? <Check aria-hidden className="h-2.5 w-2.5" /> : null}
                    </span>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    {renderItemFields(cat, item, idx, isEditing, (field, value) =>
                      updateItemField(cat.key, idx, field, value),
                    )}
                  </div>
                  {isEditing ? (
                    <button
                      type="button"
                      onClick={() => deleteItem(cat.key, idx)}
                      className="mt-0.5 shrink-0 rounded p-1 text-ink-muted-48 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 aria-hidden className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
              ))}
              {items.length === 0 ? (
                <p className="px-4 py-3 text-xs text-ink-muted-48">항목이 없습니다.</p>
              ) : null}
            </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function renderItemFields(
  cat: (typeof CATEGORIES)[number],
  item: Record<string, unknown>,
  _idx: number,
  editable: boolean,
  onFieldChange: (field: string, value: string) => void,
) {
  // KPI: custom layout — name as heading, current→target badge, measurement, description as rationale
  if (cat.key === 'kpis') {
    return renderKpiFields(item, editable, onFieldChange)
  }

  const mainField = cat.fields[0]
  const mainValue = String(item[mainField] ?? '')
  const otherFields = cat.fields.slice(1)

  return (
    <>
      {editable ? (
        <input
          type="text"
          value={mainValue}
          onChange={(e) => onFieldChange(mainField, e.target.value)}
          className="w-full rounded border border-hairline bg-canvas-parchment/50 px-2 py-1 text-sm font-medium text-ink outline-none focus:border-primary"
          placeholder={fieldLabel(mainField)}
        />
      ) : (
        <p className="text-sm font-medium text-ink">{mainValue}</p>
      )}
      {otherFields.map((field) => {
        const val = String(item[field] ?? '')
        if (!editable && !val) return null
        return editable ? (
          <input
            key={field}
            type="text"
            value={val}
            onChange={(e) => onFieldChange(field, e.target.value)}
            className="w-full rounded border border-hairline bg-canvas-parchment/50 px-2 py-1 text-xs text-ink-muted-80 outline-none focus:border-primary"
            placeholder={fieldLabel(field)}
          />
        ) : val ? (
          <p key={field} className="text-xs text-ink-muted-48">
            <span className="font-medium">{fieldLabel(field)}:</span> {val}
          </p>
        ) : null
      })}
    </>
  )
}

function renderKpiFields(
  item: Record<string, unknown>,
  editable: boolean,
  onFieldChange: (field: string, value: string) => void,
) {
  const name = String(item.name ?? '')
  const currentVal = String(item.current_value ?? '')
  const targetVal = String(item.target_value ?? '')
  const method = String(item.measurement_method ?? '')
  const description = String(item.description ?? '')

  if (editable) {
    return (
      <>
        <input
          type="text"
          value={name}
          onChange={(e) => onFieldChange('name', e.target.value)}
          className="w-full rounded border border-hairline bg-canvas-parchment/50 px-2 py-1 text-sm font-medium text-ink outline-none focus:border-primary"
          placeholder="핵심 KPI 지표명"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={currentVal}
            onChange={(e) => onFieldChange('current_value', e.target.value)}
            className="w-1/2 rounded border border-hairline bg-canvas-parchment/50 px-2 py-1 text-xs text-ink-muted-80 outline-none focus:border-primary"
            placeholder="현행 값"
          />
          <input
            type="text"
            value={targetVal}
            onChange={(e) => onFieldChange('target_value', e.target.value)}
            className="w-1/2 rounded border border-hairline bg-canvas-parchment/50 px-2 py-1 text-xs text-ink-muted-80 outline-none focus:border-primary"
            placeholder="목표 값"
          />
        </div>
        <input
          type="text"
          value={method}
          onChange={(e) => onFieldChange('measurement_method', e.target.value)}
          className="w-full rounded border border-hairline bg-canvas-parchment/50 px-2 py-1 text-xs text-ink-muted-80 outline-none focus:border-primary"
          placeholder="측정 방법"
        />
        <input
          type="text"
          value={description}
          onChange={(e) => onFieldChange('description', e.target.value)}
          className="w-full rounded border border-hairline bg-canvas-parchment/50 px-2 py-1 text-xs text-ink-muted-80 outline-none focus:border-primary"
          placeholder="선정 사유"
        />
      </>
    )
  }

  return (
    <>
      <p className="text-sm font-bold text-ink">{name}</p>
      {(currentVal || targetVal) ? (
        <div className="flex items-center gap-1.5">
          {currentVal ? (
            <span className="inline-flex items-center rounded-full bg-canvas-parchment px-2 py-0.5 text-xs text-ink-muted-80">
              현행 {currentVal}
            </span>
          ) : null}
          {currentVal && targetVal ? (
            <span className="text-xs text-ink-muted-48">→</span>
          ) : null}
          {targetVal ? (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              목표 {targetVal}
            </span>
          ) : null}
        </div>
      ) : null}
      {method ? (
        <p className="text-xs text-ink-muted-48">
          <span className="font-medium">측정:</span> {method}
        </p>
      ) : null}
      {description ? (
        <p className="text-xs text-ink-muted-48">
          <span className="font-medium">선정 사유:</span> {description}
        </p>
      ) : null}
    </>
  )
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    name: '이름',
    description: '설명',
    implementation_type: '자동화 수준 (full/assisted/human)',
    current_value: '현재 값',
    target_value: '목표 값',
    measurement_method: '측정 방법',
    area: '영역',
    as_is: 'AS-IS',
    to_be: 'TO-BE',
    impact: '영향',
    type: '유형 (qualitative/quantitative)',
    stakeholder: '이해관계자',
  }
  return labels[field] ?? field
}

function createEmptyItem(categoryKey: CategoryKey): Record<string, unknown> {
  const base = { is_checked: true }
  switch (categoryKey) {
    case 'core_features':
      return { ...base, name: '', description: '', implementation_type: 'assisted' }
    case 'kpis':
      return { ...base, name: '', description: '', current_value: '', target_value: '', measurement_method: '' }
    case 'process_changes':
      return { ...base, area: '', as_is: '', to_be: '', impact: '' }
    case 'expected_effects':
      return { ...base, type: 'qualitative', description: '' }
    case 'risks':
      return { ...base, description: '' }
  }
}
