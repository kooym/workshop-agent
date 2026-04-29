'use client'

import type { SolutionCanvasResult } from '@/lib/ai/schemas'

type Props = {
  canvas: SolutionCanvasResult
}

export function SolutionCanvasView({ canvas }: Props) {
  return (
    <div className="space-y-5">
      {/* BMC-style 5-section grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Use Case — full width */}
        <div className="rounded-apple-lg border border-hairline bg-white p-5 lg:col-span-2">
          <h4 className="mb-3 text-base font-bold text-ink">
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-sm font-bold text-blue-700">1</span>
            Use Case
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <CanvasField label="목적" value={canvas.use_case.objective} />
            <CanvasField label="사용자" value={canvas.use_case.user} />
            <CanvasField label="문제" value={canvas.use_case.problem} />
            <CanvasField label="솔루션" value={canvas.use_case.solution} />
          </div>
        </div>

        {/* Data */}
        <div className="rounded-apple-lg border border-hairline bg-white p-5">
          <h4 className="mb-3 text-base font-bold text-ink">
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-green-100 text-sm font-bold text-green-700">2</span>
            Data
          </h4>
          {canvas.data.must_have.length > 0 ? (
            <div className="mb-3">
              <p className="mb-1.5 text-sm font-semibold text-red-600">Must-Have</p>
              <ul className="space-y-1.5">
                {canvas.data.must_have.map((d, i) => (
                  <li key={i} className="text-sm text-ink-muted-80">
                    • <span className="font-medium text-ink">{d.name}</span> — {d.source}, {d.format}{d.volume ? `, ${d.volume}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {canvas.data.nice_to_have.length > 0 ? (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-amber-600">Nice-to-Have</p>
              <ul className="space-y-1.5">
                {canvas.data.nice_to_have.map((d, i) => (
                  <li key={i} className="text-sm text-ink-muted-80">
                    • {d.name} ({d.source})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Stakeholders */}
        <div className="rounded-apple-lg border border-hairline bg-white p-5">
          <h4 className="mb-3 text-base font-bold text-ink">
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-purple-100 text-sm font-bold text-purple-700">3</span>
            Stakeholders
          </h4>
          <ul className="space-y-1.5">
            {canvas.stakeholders.map((s, i) => (
              <li key={i} className="text-sm text-ink-muted-80">
                • <span className="font-semibold text-ink">{s.name}</span>
                {s.role ? ` — ${s.role}` : ''}
                {s.impact ? ` (${s.impact})` : ''}
              </li>
            ))}
          </ul>
        </div>

        {/* Value & KPI */}
        <div className="rounded-apple-lg border border-hairline bg-white p-5">
          <h4 className="mb-3 text-base font-bold text-ink">
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-amber-100 text-sm font-bold text-amber-700">4</span>
            Value & KPI
          </h4>
          {canvas.value_kpi.qualitative_effects.length > 0 ? (
            <div className="mb-3">
              <p className="mb-1.5 text-sm font-semibold text-ink-muted-80">정성적 효과</p>
              <ul className="space-y-1.5">
                {canvas.value_kpi.qualitative_effects.map((e, i) => (
                  <li key={i} className="text-sm text-ink-muted-80">• {e}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {canvas.value_kpi.quantitative_effects.length > 0 ? (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-ink-muted-80">정량적 효과</p>
              <ul className="space-y-1.5">
                {canvas.value_kpi.quantitative_effects.map((e, i) => (
                  <li key={i} className="text-sm text-ink-muted-80">
                    • <span className="font-medium text-ink">{e.name}</span>: {e.current_value} → <span className="text-green-600">{e.target_value}</span>
                    {e.measurement ? ` (${e.measurement})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Concern */}
        <div className="rounded-apple-lg border border-hairline bg-white p-5">
          <h4 className="mb-3 text-base font-bold text-ink">
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-red-100 text-sm font-bold text-red-700">5</span>
            Concern
          </h4>
          {canvas.concern.risks.length > 0 ? (
            <div className="mb-3">
              <p className="mb-1.5 text-sm font-semibold text-red-600">리스크</p>
              <div className="space-y-2">
                {canvas.concern.risks.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <SeverityBadge level={r.impact} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">{r.description}</p>
                      {r.mitigation ? (
                        <p className="mt-0.5 text-sm text-ink-muted-48">대응: {r.mitigation}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {canvas.concern.issues.length > 0 ? (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-amber-600">이슈</p>
              <ul className="space-y-1.5">
                {canvas.concern.issues.map((iss, i) => (
                  <li key={i} className="text-sm text-ink-muted-80">
                    • {iss.description}
                    {iss.category ? ` [${iss.category}]` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CanvasField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink-muted-48">{label}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-ink">{value}</p>
    </div>
  )
}

function SeverityBadge({ level }: { level: string }) {
  const colors = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-green-100 text-green-700',
  }
  const cls = colors[level as keyof typeof colors] ?? colors.medium
  return (
    <span className={`mt-0.5 inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-xs font-bold ${cls}`}>
      {level === 'high' ? '높음' : level === 'low' ? '낮음' : '중간'}
    </span>
  )
}
