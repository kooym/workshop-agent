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
    <article className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-white">
            {mode === 'cluster' ? cluster?.name : note?.content}
          </h3>
          {mode === 'cluster' && cluster?.summary ? (
            <p className="mt-1 text-sm leading-5 text-neutral-400">{cluster.summary}</p>
          ) : null}
          {mode === 'note' ? (
            <p className="mt-2 text-xs text-neutral-500">{clusterName ?? '미분류'}</p>
          ) : null}
        </div>
        {hasVote ? <span className="h-3 w-3 shrink-0 rounded-full bg-sky-400" /> : null}
      </div>

      {mode === 'cluster' && cluster ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200"
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
            <p key={clusterNote.id} className="rounded-md bg-neutral-950 p-2 text-sm text-neutral-300">
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
            className="inline-flex h-9 items-center gap-2 rounded-md border border-neutral-700 px-3 text-sm text-neutral-200 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Undo2 aria-hidden className="h-4 w-4" />
            투표 취소
          </button>
        ) : (
          <button
            type="button"
            onClick={onVote}
            disabled={!canVote}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-sky-600 px-3 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            <Circle aria-hidden className="h-4 w-4" />
            투표하기
          </button>
        )}
      </div>
    </article>
  )
}
