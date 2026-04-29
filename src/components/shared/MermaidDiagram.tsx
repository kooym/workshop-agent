'use client'

import { AlertTriangle } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

export function MermaidDiagram({ dsl, className = '' }: { dsl: string; className?: string }) {
  const id = useId().replaceAll(':', '')
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function renderDiagram() {
      try {
        setError(false)
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' })
        const result = await mermaid.render(`mermaid-${id}`, dsl)
        if (!cancelled && ref.current) {
          ref.current.innerHTML = result.svg
        }
      } catch (renderError) {
        console.error('Mermaid render failed', renderError)
        if (!cancelled) {
          setError(true)
        }
      }
    }

    void renderDiagram()
    return () => {
      cancelled = true
    }
  }, [dsl, id])

  if (error) {
    return (
      <div className={`rounded-apple-lg border border-amber-300 bg-amber-50 p-3 ${className}`}>
        <p className="inline-flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle aria-hidden className="h-4 w-4" />
          다이어그램 렌더링 실패
        </p>
        <pre className="mt-3 overflow-auto whitespace-pre-wrap rounded bg-surface-pearl p-3 text-xs text-ink-muted-80">
          <code>{dsl}</code>
        </pre>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={`overflow-auto rounded-apple-lg border border-hairline bg-white p-4 ${className}`}
    />
  )
}
