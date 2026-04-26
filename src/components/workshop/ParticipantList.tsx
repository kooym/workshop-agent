'use client'

import { Crown } from 'lucide-react'
import { useWorkshopStore } from '@/stores/workshop'

export function ParticipantList() {
  const participants = useWorkshopStore((state) => state.participants)

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-neutral-200">참석자</h2>
      <div className="mt-3 space-y-2">
        {participants.map((participant) => (
          <div key={participant.id} className="flex items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="truncate text-neutral-100">{participant.display_name}</span>
                {participant.is_facilitator ? (
                  <Crown aria-label="퍼실리테이터" className="h-3.5 w-3.5 text-amber-300" />
                ) : null}
              </div>
              {participant.role ? (
                <p className="ml-4 mt-0.5 truncate text-xs text-neutral-500">{participant.role}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
