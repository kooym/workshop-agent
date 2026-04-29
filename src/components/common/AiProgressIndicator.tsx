'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

type ProgressStep = {
  label: string
  estimatedSeconds?: number
}

type AiProgressIndicatorProps = {
  isActive: boolean
  title: string
  steps?: ProgressStep[]
  className?: string
}

export function AiProgressIndicator({
  isActive,
  title,
  steps,
  className = '',
}: AiProgressIndicatorProps) {
  const [elapsed, setElapsed] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (!isActive) {
      setElapsed(0)
      setCurrentStep(0)
      return
    }
    const start = Date.now()
    const id = setInterval(() => {
      const seconds = Math.floor((Date.now() - start) / 1000)
      setElapsed(seconds)

      // Advance step indicator based on cumulative estimated time
      if (steps && steps.length > 0) {
        let cumulative = 0
        for (let i = 0; i < steps.length; i++) {
          cumulative += steps[i].estimatedSeconds ?? 5
          if (seconds < cumulative) {
            setCurrentStep(i)
            return
          }
        }
        setCurrentStep(steps.length - 1)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [isActive, steps])

  if (!isActive) return null

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}분 ${sec}초` : `${sec}초`
  }

  return (
    <div
      className={`rounded-apple-lg border border-primary/20 bg-blue-50 p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          {title}
        </span>
        <span className="text-xs text-ink-muted-48 tabular-nums">
          {formatTime(elapsed)} 경과
        </span>
      </div>

      {steps && steps.length > 0 ? (
        <div className="space-y-1.5 mt-3">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2 text-xs">
              <span className="flex h-4 w-4 items-center justify-center shrink-0">
                {i < currentStep ? (
                  <span className="text-emerald-600">✓</span>
                ) : i === currentStep ? (
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-hairline" />
                )}
              </span>
              <span
                className={
                  i < currentStep
                    ? 'text-ink-muted-48 line-through'
                    : i === currentStep
                      ? 'text-ink font-medium'
                      : 'text-ink-muted-48'
                }
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
