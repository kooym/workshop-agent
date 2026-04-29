'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { ClusterWithNotes } from '@/types/cluster'

const CRITERIA = [
  { key: 'score_impact', label: '업무영향도', description: '비즈니스 가치 및 영향 범위', color: 'bg-blue-500' },
  { key: 'score_urgency', label: '시급성', description: '해결 우선순위 및 긴급도', color: 'bg-amber-500' },
  { key: 'score_feasibility', label: '실현가능성', description: '기술·조직 구현 난이도', color: 'bg-emerald-500' },
] as const

type ScoreKey = (typeof CRITERIA)[number]['key']
type MyScores = Record<ScoreKey, number | null>

function getTotal(cluster: ClusterWithNotes): number | null {
  const { score_impact, score_feasibility, score_urgency } = cluster
  if (score_impact == null || score_feasibility == null || score_urgency == null) return null
  return score_impact + score_feasibility + score_urgency
}

export function ClusterScoring({
  cluster,
  canEdit,
  onUpdated,
}: {
  cluster: ClusterWithNotes
  canEdit: boolean
  onUpdated(): void
}) {
  const [saving, setSaving] = useState(false)
  const [myScores, setMyScores] = useState<MyScores>({
    score_impact: null,
    score_feasibility: null,
    score_urgency: null,
  })
  const total = getTotal(cluster)

  // Fetch current participant's scores
  useEffect(() => {
    let cancelled = false
    async function fetchMyScores() {
      try {
        const res = await fetch(`/api/clusters/${cluster.id}/scores?workshop_id=${cluster.workshop_id}`)
        if (!res.ok) return
        const { data } = await res.json()
        if (!cancelled && data) {
          setMyScores({
            score_impact: data.score_impact,
            score_feasibility: data.score_feasibility,
            score_urgency: data.score_urgency,
          })
        }
      } catch {
        // ignore
      }
    }
    void fetchMyScores()
    return () => { cancelled = true }
  }, [cluster.id, cluster.workshop_id])

  async function submitScores(key: ScoreKey, value: number) {
    if (saving) return

    const updated: MyScores = { ...myScores, [key]: value }
    setMyScores(updated)

    // Only submit when all 3 scores are filled
    if (updated.score_impact == null || updated.score_feasibility == null || updated.score_urgency == null) {
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/clusters/${cluster.id}/scores?workshop_id=${cluster.workshop_id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          score_impact: updated.score_impact,
          score_feasibility: updated.score_feasibility,
          score_urgency: updated.score_urgency,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        toast.error(payload?.error?.message ?? '점수 저장에 실패했습니다.')
        return
      }
      onUpdated()
    } catch {
      toast.error('점수 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-t border-hairline px-4 py-3">
      {/* Average scores — colored progress bars */}
      {total != null ? (
        <div className="mb-3 space-y-1.5">
          <div className="flex items-center gap-3">
            {CRITERIA.map((c) => {
              const value = cluster[c.key] ?? 0
              return (
                <div key={c.key} className="flex flex-1 items-center gap-2">
                  <span className="w-14 shrink-0 text-xs text-ink-muted-80">{c.label}</span>
                  <div className="relative h-2 flex-1 rounded-full bg-canvas-parchment">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full ${c.color} transition-all`}
                      style={{ width: `${(value / 5) * 100}%` }}
                    />
                  </div>
                  <span className="w-4 text-right text-xs font-semibold text-ink">{value}</span>
                </div>
              )
            })}
            <div className={`ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
              total >= 12 ? 'bg-emerald-500' : total >= 8 ? 'bg-amber-500' : 'bg-red-500'
            }`}>
              {total}
            </div>
          </div>
        </div>
      ) : null}
      {/* Per-participant scoring */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {CRITERIA.map((c) => {
          const current = myScores[c.key]
          return (
            <div key={c.key} className="flex items-center gap-2">
              <span className="text-xs font-medium text-ink-muted-80 w-16">{c.label}</span>
              <div className="flex gap-0.5" role="radiogroup" aria-label={c.label}>
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={current === v}
                    aria-label={`${c.label} ${v}점`}
                    disabled={!canEdit || saving}
                    onClick={() => void submitScores(c.key, v)}
                    className={`h-7 w-7 rounded-md text-xs font-medium transition ${
                      current != null && v <= current
                        ? 'bg-primary text-white'
                        : 'border border-hairline bg-white text-ink-muted-48 hover:bg-canvas-parchment'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function getTotalScore(cluster: ClusterWithNotes): number | null {
  return getTotal(cluster)
}
