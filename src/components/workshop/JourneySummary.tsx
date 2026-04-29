'use client'

import { BarChart3, CheckCircle2, Cpu, FileText, Layers, ListOrdered, StickyNote, Vote } from 'lucide-react'

type Summary = {
  counts: {
    process_steps: number
    process_lanes: number
    notes: number
    clusters: number
    votes: number
    voted_participants: number
    tasks: number
  }
  latest_versions: {
    design_artifact: number | null
    prd: number | null
    report: number | null
  }
  contribution: {
    my_notes: number
    my_votes: number
    my_notes_in_top_cluster: number
  } | null
}

export function JourneySummary({ summary }: { summary: Summary }) {
  const items = [
    {
      icon: ListOrdered,
      label: 'AS-IS 프로세스',
      value: `${summary.counts.process_steps}개`,
      detail: `레인 ${summary.counts.process_lanes}개`,
    },
    { icon: StickyNote, label: '포스트잇 수집', value: `${summary.counts.notes}개`, detail: 'pain point' },
    { icon: Layers, label: 'AI 클러스터링', value: `${summary.counts.clusters}개`, detail: '그룹' },
    {
      icon: Vote,
      label: '투표',
      value: `${summary.counts.votes}표`,
      detail: `${summary.counts.voted_participants}명 참여`,
    },
    {
      icon: Cpu,
      label: 'TO-BE 설계',
      value: summary.latest_versions.design_artifact ? `v${summary.latest_versions.design_artifact}` : '-',
      detail: '설계 산출물',
    },
    { icon: CheckCircle2, label: 'AX 과제', value: `${summary.counts.tasks}개`, detail: '도출' },
    {
      icon: FileText,
      label: 'PRD',
      value: summary.latest_versions.prd ? `v${summary.latest_versions.prd}` : '-',
      detail: '생성',
    },
    {
      icon: BarChart3,
      label: '종합 보고서',
      value: summary.latest_versions.report ? `v${summary.latest_versions.report}` : '-',
      detail: '생성',
    },
  ]

  return (
    <div>
      <div className="space-y-0">
        {items.map((item, index) => {
          const Icon = item.icon
          return (
            <div key={item.label}>
              <article className="rounded-apple-lg border border-hairline bg-white p-4">
                <div className="flex items-center gap-3">
                  <Icon aria-hidden className="h-5 w-5 text-ink-muted-48" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-ink">{item.label}</h3>
                    <p className="text-xs text-ink-muted-48">{item.detail}</p>
                  </div>
                  <strong className="text-lg font-bold text-emerald-600">{item.value}</strong>
                </div>
              </article>
              {index < items.length - 1 ? <div className="mx-auto h-8 w-px bg-neutral-200" /> : null}
            </div>
          )
        })}
      </div>

      {summary.contribution ? (
        <div className="mt-6 rounded-apple-lg border border-hairline bg-white p-4">
          <h3 className="text-sm font-semibold text-ink">내 기여</h3>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-ink-muted-48">작성 포스트잇</dt>
              <dd className="mt-1 text-lg font-semibold text-ink">{summary.contribution.my_notes}개</dd>
            </div>
            <div>
              <dt className="text-ink-muted-48">상위 클러스터 포함</dt>
              <dd className="mt-1 text-lg font-semibold text-ink">
                {summary.contribution.my_notes_in_top_cluster}개
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted-48">내 투표</dt>
              <dd className="mt-1 text-lg font-semibold text-ink">{summary.contribution.my_votes}표</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  )
}
