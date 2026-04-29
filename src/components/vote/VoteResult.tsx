'use client'

import type { VoteResultRow } from '@/types/vote'

export function VoteResult({ visible, results }: { visible: boolean; results: VoteResultRow[] }) {
  if (!visible) {
    return (
      <div className="rounded-apple-lg border border-dashed border-hairline bg-surface-pearl p-6 text-sm text-ink-muted-80">
        퍼실리테이터가 결과를 공개할 때까지 대기 중입니다.
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="rounded-apple-lg border border-hairline bg-surface-pearl p-6 text-sm text-ink-muted-48">
        아직 집계된 투표가 없습니다.
      </div>
    )
  }

  const maxVotes = Math.max(...results.map((result) => result.vote_count), 1)

  return (
    <section className="rounded-apple-lg border border-hairline bg-white p-4">
      <h3 className="mb-4 text-sm font-semibold text-ink">투표 결과</h3>
      <div className="space-y-3">
        {results.map((result) => (
          <div key={result.cluster_id ?? result.note_id} className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-ink">{result.target_name}</span>
              <span className="shrink-0 text-ink-muted-48">
                {result.vote_count}표 · {result.percentage}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-neutral-200">
              <div
                className="h-full rounded bg-primary"
                style={{ width: `${(result.vote_count / maxVotes) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
