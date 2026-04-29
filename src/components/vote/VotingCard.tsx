'use client'

import { ChevronDown, ChevronUp, Circle, Undo2 } from 'lucide-react'
import { useState } from 'react'
import type { ClusterWithNotes } from '@/types/cluster'
import type { Note } from '@/types/note'
import type { Vote } from '@/types/vote'

export function VotingCard({
  mode,
  cluster,
  note,
  clusterName,
  existingVote,
  remainingVotes,
  disabled,
  onVote,
  onRemoveVote,
}: {
  mode: 'cluster' | 'note'
  cluster?: ClusterWithNotes
  note?: Note
  clusterName?: string
  existingVote?: Vote
  remainingVotes: number
  disabled: boolean
  onVote(): void
  onRemoveVote(voteId: string): void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasVote = Boolean(existingVote)
  const canVote = !disabled && (hasVote || remainingVotes > 0)

  return (
    <article className="rounded-apple-lg border border-hairline bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink">
            {mode === 'cluster' ? cluster?.name : note?.content}
          </h3>
          {mode === 'cluster' && cluster?.summary ? (
            <p className="mt-1 text-sm leading-5 text-ink-muted-48">{cluster.summary}</p>
          ) : null}
          {mode === 'cluster' && cluster?.score_impact != null && cluster?.score_feasibility != null && cluster?.score_urgency != null ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                파급력 {cluster.score_impact}
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                실현가능성 {cluster.score_feasibility}
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                시급성 {cluster.score_urgency}
              </span>
              {(() => {
                const t = cluster.score_impact + cluster.score_feasibility + cluster.score_urgency
                return (
                  <span className={`ml-1 rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${
                    t >= 12 ? 'bg-emerald-500' : t >= 8 ? 'bg-amber-500' : 'bg-red-500'
                  }`}>
                    총 {t}/15
                  </span>
                )
              })()}
            </div>
          ) : null}
          {mode === 'note' ? (
            <p className="mt-2 text-xs text-ink-muted-48">{clusterName ?? '미분류'}</p>
          ) : null}
        </div>
        {hasVote ? <span className="h-3 w-3 shrink-0 rounded-full bg-primary" /> : null}
      </div>

      {mode === 'cluster' && cluster ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 inline-flex items-center gap-1 text-xs text-ink-muted-48 hover:text-ink"
        >
          {expanded ? (
            <ChevronUp aria-hidden className="h-4 w-4" />
          ) : (
            <ChevronDown aria-hidden className="h-4 w-4" />
          )}
          포스트잇 {cluster.notes.length}개
        </button>
      ) : null}

      {expanded && cluster ? (
        <div className="mt-3 space-y-2">
          {cluster.notes.map((clusterNote) => (
            <p key={clusterNote.id} className="rounded-md bg-canvas-parchment p-2 text-sm text-ink-muted-80">
              {clusterNote.content}
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        {hasVote && existingVote ? (
          <button
            type="button"
            onClick={() => onRemoveVote(existingVote.id)}
            disabled={disabled}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-hairline px-3 text-sm text-ink hover:bg-canvas-parchment disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Undo2 aria-hidden className="h-4 w-4" />
            투표 취소
          </button>
        ) : (
          <button
            type="button"
            onClick={onVote}
            disabled={!canVote}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-3 text-sm font-medium text-white hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-canvas-parchment disabled:text-ink-muted-48"
          >
            <Circle aria-hidden className="h-4 w-4" />
            투표하기
          </button>
        )}
      </div>
    </article>
  )
}
