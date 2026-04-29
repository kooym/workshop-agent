'use client'

import { Play, RotateCcw, Square, TimerIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createBrowserClient } from '@/lib/supabase/client'

function playAlarmBeep() {
  try {
    const audioContext = new AudioContext()
    const playBeep = (startTime: number) => {
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      oscillator.connect(gain)
      gain.connect(audioContext.destination)
      oscillator.frequency.value = 880
      oscillator.type = 'sine'
      gain.gain.setValueAtTime(0.3, startTime)
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3)
      oscillator.start(startTime)
      oscillator.stop(startTime + 0.3)
    }
    const now = audioContext.currentTime
    playBeep(now)
    playBeep(now + 0.5)
    playBeep(now + 1.0)
    setTimeout(() => void audioContext.close(), 2000)
  } catch {
    // Web Audio not supported — silent fail
  }
}

export function Timer({
  workshopId,
  timerMinutes,
  isFacilitator,
}: {
  workshopId: string
  timerMinutes: number | null
  isFacilitator: boolean
}) {
  const [configMinutes, setConfigMinutes] = useState(timerMinutes ?? 5)
  const [remainingSeconds, setRemainingSeconds] = useState((timerMinutes ?? configMinutes) * 60)
  const [timerEndAt, setTimerEndAt] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = useMemo(() => createBrowserClient(), [])

  const handleExpiry = useCallback(() => {
    setTimerEndAt(null)
    setExpired(true)
    playAlarmBeep()
    toast.warning('시간이 초과되었습니다.')
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel(`timer:${workshopId}`)
      .on('broadcast', { event: 'timer' }, ({ payload }) => {
        if (payload.type === 'timer_start') {
          setTimerEndAt(payload.timer_end_at)
          setExpired(false)
          if (payload.config_minutes) {
            setConfigMinutes(payload.config_minutes)
          }
        }
        if (payload.type === 'timer_pause') {
          setTimerEndAt(null)
          setRemainingSeconds(payload.remaining_seconds)
        }
        if (payload.type === 'timer_reset') {
          setTimerEndAt(null)
          setExpired(false)
          const mins = payload.config_minutes ?? configMinutes
          setConfigMinutes(mins)
          setRemainingSeconds(mins * 60)
        }
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, workshopId, configMinutes])

  useEffect(() => {
    if (!timerEndAt) return

    const interval = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((Date.parse(timerEndAt) - Date.now()) / 1000))
      setRemainingSeconds(next)
      if (next === 0) {
        handleExpiry()
      }
    }, 1000)

    return () => window.clearInterval(interval)
  }, [timerEndAt, handleExpiry])

  const isRunning = timerEndAt !== null
  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60

  async function broadcast(payload: Record<string, unknown>) {
    const channel = supabase.channel(`timer:${workshopId}`)
    await channel.subscribe()
    await channel.send({ type: 'broadcast', event: 'timer', payload })
    await supabase.removeChannel(channel)
  }

  function applyConfigMinutes() {
    const clamped = Math.min(60, Math.max(1, configMinutes))
    setConfigMinutes(clamped)
    setRemainingSeconds(clamped * 60)
    setExpired(false)
    void broadcast({ type: 'timer_reset', config_minutes: clamped })
  }

  async function startTimer() {
    const endAt = new Date(Date.now() + remainingSeconds * 1000).toISOString()
    setTimerEndAt(endAt)
    setExpired(false)
    await broadcast({ type: 'timer_start', timer_end_at: endAt, config_minutes: configMinutes })
  }

  async function pauseTimer() {
    setTimerEndAt(null)
    await broadcast({ type: 'timer_pause', remaining_seconds: remainingSeconds })
  }

  async function resetTimer() {
    setTimerEndAt(null)
    setExpired(false)
    setRemainingSeconds(configMinutes * 60)
    await broadcast({ type: 'timer_reset', config_minutes: configMinutes })
  }

  return (
    <div className="space-y-2">
      <div
        className={`flex items-center gap-2 rounded-md border px-3 py-2 transition ${
          expired
            ? 'animate-pulse border-red-500/50 bg-red-500/10'
            : 'border-hairline bg-white'
        }`}
      >
        <TimerIcon aria-hidden className={`h-4 w-4 ${expired ? 'text-red-600' : 'text-ink-muted-48'}`} />
        <span className={`font-mono text-xl ${expired ? 'text-red-600' : 'text-ink'}`}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
        {isFacilitator ? (
          <div className="ml-2 flex gap-1">
            {!isRunning ? (
              <button
                type="button"
                aria-label="시작"
                onClick={() => void startTimer()}
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-hairline text-ink hover:bg-canvas-parchment"
              >
                <Play aria-hidden className="h-3 w-3" />
              </button>
            ) : (
              <button
                type="button"
                aria-label="정지"
                onClick={() => void pauseTimer()}
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-hairline text-ink hover:bg-canvas-parchment"
              >
                <Square aria-hidden className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              aria-label="재설정"
              onClick={() => void resetTimer()}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-hairline text-ink hover:bg-canvas-parchment"
            >
              <RotateCcw aria-hidden className="h-3 w-3" />
            </button>
          </div>
        ) : null}
      </div>

      {isFacilitator && !isRunning ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="number"
            min={1}
            max={60}
            value={configMinutes}
            onChange={(e) => setConfigMinutes(Number(e.target.value) || 1)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyConfigMinutes()
            }}
            className="h-7 w-16 rounded border border-hairline bg-white px-2 text-center text-sm text-ink"
            aria-label="타이머 분"
          />
          <span className="text-xs text-ink-muted-48">분</span>
          <button
            type="button"
            onClick={applyConfigMinutes}
            className="rounded border border-hairline px-2 py-1 text-xs text-ink hover:bg-canvas-parchment"
          >
            설정
          </button>
        </div>
      ) : null}
    </div>
  )
}
