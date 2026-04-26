'use client'

import { useEffect, useId, useState } from 'react'
import mermaid from 'mermaid'
import type { Json } from '@/types/common'

export function ToBeProcessView({ value }: { value: Json }) {
  const id = useId().replaceAll(':', '')
  const process = normalizeToBeProcess(value)
  const [view, setView] = useState<'mermaid' | 'steps'>('mermaid')
  const [svg, setSvg] = useState('')

  useEffect(() => {
    let cancelled = false
    mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' })
    void mermaid
      .render(`tobe-${id}`, process.mermaid_dsl)
      .then((result) => {
        if (!cancelled) {
          setSvg(result.svg)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSvg('')
        }
      })
    return () => {
      cancelled = true
    }
  }, [id, process.mermaid_dsl])

  return (
    <section className="space-y-4">
      <div className="inline-flex rounded-md border border-neutral-800 bg-neutral-900 p-1">
        <button
          type="button"
          onClick={() => setView('mermaid')}
          className={`rounded px-3 py-1.5 text-sm ${view === 'mermaid' ? 'bg-sky-600 text-white' : 'text-neutral-400'}`}
        >
          Mermaid 다이어그램
        </button>
        <button
          type="button"
          onClick={() => setView('steps')}
          className={`rounded px-3 py-1.5 text-sm ${view === 'steps' ? 'bg-sky-600 text-white' : 'text-neutral-400'}`}
        >
          상세 단계
        </button>
      </div>

      {view === 'mermaid' ? (
        <div className="overflow-auto rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          {svg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
              alt="TO-BE process diagram"
              className="max-w-none"
            />
          ) : (
            <pre className="whitespace-pre-wrap text-sm text-neutral-300">{process.mermaid_dsl}</pre>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {process.steps.map((step, index) => (
            <article key={`${step.name}-${index}`} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-white">{step.name}</h3>
                <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                  {automationLabel(step.automation_type)}
                </span>
                {step.agent_name ? (
                  <span className="rounded bg-sky-500/15 px-2 py-0.5 text-xs text-sky-200">
                    {step.agent_name}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-neutral-400">{step.description}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

type ToBeProcess = {
  mermaid_dsl: string
  steps: {
    name: string
    description: string
    automation_type: 'full' | 'assisted' | 'human'
    agent_name?: string | null
  }[]
}

function normalizeToBeProcess(value: Json): ToBeProcess {
  const object = typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {}
  const mermaid = 'mermaid_dsl' in object && typeof object.mermaid_dsl === 'string' ? object.mermaid_dsl : 'flowchart LR'
  const steps = Array.isArray('steps' in object ? object.steps : null)
    ? object.steps
        .filter((step): step is Record<string, unknown> => typeof step === 'object' && step !== null)
        .map((step) => ({
          name: typeof step.name === 'string' ? step.name : 'TO-BE 단계',
          description: typeof step.description === 'string' ? step.description : '',
          automation_type:
            step.automation_type === 'full' ||
            step.automation_type === 'assisted' ||
            step.automation_type === 'human'
              ? step.automation_type
              : 'assisted',
          agent_name: typeof step.agent_name === 'string' ? step.agent_name : null,
        }))
    : []

  return { mermaid_dsl: mermaid, steps }
}

function automationLabel(type: ToBeProcess['steps'][number]['automation_type']) {
  if (type === 'full') {
    return '전자동'
  }
  if (type === 'assisted') {
    return 'AI 보조'
  }
  return '사람 수행'
}
