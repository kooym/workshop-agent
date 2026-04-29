'use client'

import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useWorkshopStore } from '@/stores/workshop'

export function InviteCode() {
  const workshop = useWorkshopStore((state) => state.workshop)
  const participants = useWorkshopStore((state) => state.participants)

  if (!workshop) {
    return null
  }
  const currentWorkshop = workshop

  async function copyCode() {
    await navigator.clipboard.writeText(currentWorkshop.invite_code)
    toast.success('초대 코드가 복사되었습니다.')
  }

  return (
    <section className="mt-6 rounded-apple-lg border border-hairline bg-white p-4">
      <p className="text-xs font-medium text-ink-muted-48">초대 코드</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <strong className="font-mono text-3xl tracking-widest text-ink">{currentWorkshop.invite_code}</strong>
        <button
          type="button"
          aria-label="코드 복사"
          title="코드 복사"
          onClick={() => void copyCode()}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline text-ink hover:bg-canvas-parchment"
        >
          <Copy aria-hidden className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-3 text-sm text-ink-muted-48">참석자 {participants.length}명</p>
    </section>
  )
}
