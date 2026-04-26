'use client'

import { Loader2, RefreshCcw, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AgentSpecCard } from './AgentSpecCard'
import { DataRequirementTable } from './DataRequirementTable'
import { KpiTable } from './KpiTable'
import { OrgRequirementList } from './OrgRequirementList'
import { TaskCard } from './TaskCard'
import { ToBeProcessView } from './ToBeProcessView'
import { useClusterStore } from '@/stores/cluster'
import { useDesignStore } from '@/stores/design'
import { useWorkshopStore } from '@/stores/workshop'
import type { Workshop } from '@/types/workshop'

const TABS = [
  { id: 'process', label: 'TO-BE 프로세스' },
  { id: 'agents', label: 'Agent' },
  { id: 'tasks', label: '과제' },
  { id: 'kpis', label: 'KPI' },
  { id: 'data', label: '데이터' },
  { id: 'org', label: '조직' },
] as const

type TabId = (typeof TABS)[number]['id']

export function DesignView({
  workshop,
  isFacilitator,
}: {
  workshop: Workshop
  isFacilitator: boolean
}) {
  const designArtifact = useDesignStore((state) => state.designArtifact)
  const tasks = useDesignStore((state) => state.tasks)
  const setDesignPayload = useDesignStore((state) => state.setDesignPayload)
  const refetchDesign = useDesignStore((state) => state.refetchAll)
  const refetchClusters = useClusterStore((state) => state.refetchAll)
  const refetchWorkshop = useWorkshopStore((state) => state.refetchAll)
  const [tab, setTab] = useState<TabId>('process')
  const [isRunning, setIsRunning] = useState(false)
  const isProcessing = workshop.is_processing || isRunning
  const canRunAi = isFacilitator && workshop.current_stage === 'design'

  useEffect(() => {
    void Promise.all([refetchDesign(workshop.id), refetchClusters(workshop.id)])
  }, [refetchClusters, refetchDesign, workshop.id])

  async function runDesign() {
    if (!canRunAi || isProcessing) {
      return
    }

    setIsRunning(true)
    const response = await fetch('/api/ai/design', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workshop_id: workshop.id }),
    })
    const payload = await response.json().catch(() => null)
    setIsRunning(false)

    if (!response.ok) {
      toast.error(payload?.error?.message ?? 'AI 설계에 실패했습니다.')
      await refetchWorkshop(workshop.id)
      return
    }

    setDesignPayload(payload.data)
    await refetchWorkshop(workshop.id)
    if (payload.data.warnings?.length) {
      toast.warning(payload.data.warnings.join('\n'))
    } else {
      toast.success('AI 설계가 완료되었습니다.')
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-neutral-800 pb-4">
        <div>
          <p className="text-sm text-neutral-500">현재 보는 단계</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal">design</h2>
          {designArtifact ? (
            <p className="mt-2 text-sm text-neutral-400">
              설계 산출물 v{designArtifact.version} · 과제 {tasks.length}개
            </p>
          ) : null}
        </div>
        {isFacilitator ? (
          <button
            type="button"
            onClick={() => void runDesign()}
            disabled={!canRunAi || isProcessing}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            {isProcessing ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : designArtifact ? (
              <RefreshCcw aria-hidden className="h-4 w-4" />
            ) : (
              <Sparkles aria-hidden className="h-4 w-4" />
            )}
            {designArtifact ? 'AI 재설계' : 'AI 설계'}
          </button>
        ) : null}
      </div>

      {isProcessing ? (
        <div className="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-100">
          <span className="inline-flex items-center gap-2">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            퍼실리테이터가 AI를 실행 중입니다. TO-BE 프로세스를 설계 중입니다.
          </span>
        </div>
      ) : null}

      {!designArtifact ? (
        <div className="rounded-lg border border-dashed border-neutral-800 bg-neutral-900/50 p-8 text-center">
          <p className="text-sm text-neutral-300">
            {isFacilitator
              ? 'AI 설계를 실행하면 TO-BE 프로세스와 AX 과제가 생성됩니다.'
              : '퍼실리테이터가 AX 설계를 시작할 때까지 대기 중입니다.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-md px-3 py-2 text-sm ${
                  tab === item.id ? 'bg-sky-600 text-white' : 'bg-neutral-900 text-neutral-400'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'process' ? <ToBeProcessView value={designArtifact.tobe_process} /> : null}
          {tab === 'agents' ? <AgentSpecCard value={designArtifact.agent_specs} /> : null}
          {tab === 'tasks' ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  canEdit={canRunAi}
                  onChanged={() => void refetchDesign(workshop.id)}
                />
              ))}
            </div>
          ) : null}
          {tab === 'kpis' ? <KpiTable value={designArtifact.kpis} /> : null}
          {tab === 'data' ? <DataRequirementTable value={designArtifact.data_requirements} /> : null}
          {tab === 'org' ? <OrgRequirementList value={designArtifact.org_requirements} /> : null}
        </div>
      )}
    </main>
  )
}
