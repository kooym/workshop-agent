'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

type ReactionSummary = {
  thumbs_up: number
  warning: number
  my_reaction: '👍' | '⚠️' | null
  my_reaction_id?: string | null
}

export function ReactionBar({
  workshopId,
  taskId,
  prdId,
  revision = 0,
}: {
  workshopId: string
  taskId?: string
  prdId?: string
  revision?: number
}) {
  const [reaction, setReaction] = useState<ReactionSummary>({
    thumbs_up: 0,
    warning: 0,
    my_reaction: null,
    my_reaction_id: null,
  })
  const targetQuery = taskId ? `task_id=${taskId}` : `prd_id=${prdId}`

  useEffect(() => {
    let cancelled = false

    async function refetchReaction() {
      const response = await fetch(`/api/reactions?workshop_id=${workshopId}&${targetQuery}`)
      if (!response.ok) {
        return
      }
      const payload = await response.json()
      if (!cancelled) {
        setReaction(payload.data)
      }
    }

    void refetchReaction()
    return () => {
      cancelled = true
    }
  }, [revision, targetQuery, workshopId])

  async function react(reactionType: '👍' | '⚠️') {
    if (reaction.my_reaction_id) {
      const deleteResponse = await fetch(
        `/api/reactions?id=${reaction.my_reaction_id}&workshop_id=${workshopId}`,
        { method: 'DELETE' },
      )
      if (!deleteResponse.ok) {
        toast.error('반응을 변경하지 못했습니다.')
        return
      }
      if (reaction.my_reaction === reactionType) {
        setReaction((current) => ({
          ...current,
          my_reaction: null,
          my_reaction_id: null,
          thumbs_up: reactionType === '👍' ? Math.max(0, current.thumbs_up - 1) : current.thumbs_up,
          warning: reactionType === '⚠️' ? Math.max(0, current.warning - 1) : current.warning,
        }))
        return
      }
    }

    const response = await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workshop_id: workshopId,
        task_id: taskId,
        prd_id: prdId,
        reaction_type: reactionType,
      }),
    })

    if (!response.ok) {
      toast.error('반응을 저장하지 못했습니다.')
      return
    }

    const payload = await response.json()
    setReaction((current) => ({
      thumbs_up:
        reactionType === '👍'
          ? current.thumbs_up + 1
          : Math.max(0, current.thumbs_up - (current.my_reaction === '👍' ? 1 : 0)),
      warning:
        reactionType === '⚠️'
          ? current.warning + 1
          : Math.max(0, current.warning - (current.my_reaction === '⚠️' ? 1 : 0)),
      my_reaction: reactionType,
      my_reaction_id: payload.data.id,
    }))
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => void react('👍')}
        className={`rounded-full border px-3 py-1.5 text-sm ${
          reaction.my_reaction === '👍'
            ? 'border-primary bg-blue-50 text-primary'
            : 'border-hairline text-ink-muted-80 hover:bg-surface-pearl'
        }`}
      >
        👍 {reaction.thumbs_up}
      </button>
      <button
        type="button"
        onClick={() => void react('⚠️')}
        className={`rounded-full border px-3 py-1.5 text-sm ${
          reaction.my_reaction === '⚠️'
            ? 'border-amber-400 bg-amber-50 text-amber-700'
            : 'border-hairline text-ink-muted-80 hover:bg-surface-pearl'
        }`}
      >
        ⚠️ {reaction.warning}
      </button>
    </div>
  )
}
