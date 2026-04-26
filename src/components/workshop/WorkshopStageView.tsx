'use client'

import { Board } from '@/components/board/Board'
import { ClusterView } from '@/components/cluster/ClusterView'
import { ProcessGraphEditor } from '@/components/context/ProcessGraphEditor'
import { DesignView } from '@/components/design/DesignView'
import { DotVoting } from '@/components/vote/DotVoting'
import { useWorkshopStore } from '@/stores/workshop'
import type { WorkshopStage } from '@/types/workshop'

const PLACEHOLDER_COPY: Record<Exclude<WorkshopStage, 'context'>, string> = {
  gather: '포스트잇 보드를 불러오는 중입니다.',
  cluster: '클러스터 뷰는 Step 5에서 구현됩니다.',
  vote: '투표 화면은 Step 6에서 구현됩니다.',
  design: 'AX 설계 화면은 Step 7에서 구현됩니다.',
  generate: 'PRD 생성 화면은 Step 8에서 구현됩니다.',
  report: '종합 보고서 화면은 Step 8에서 구현됩니다.',
  completed: '워크샵 완료 화면은 Step 9에서 구현됩니다.',
}

export function WorkshopStageView() {
  const workshop = useWorkshopStore((state) => state.workshop)
  const currentParticipant = useWorkshopStore((state) => state.currentParticipant)
  const viewingStage = useWorkshopStore((state) => state.viewingStage)

  if (!workshop || !currentParticipant || !viewingStage) {
    return <div className="p-6 text-sm text-neutral-400">워크샵을 불러오는 중입니다.</div>
  }

  if (viewingStage === 'context') {
    return (
      <ProcessGraphEditor
        workshopId={workshop.id}
        currentParticipantId={currentParticipant.id}
      />
    )
  }

  if (viewingStage === 'gather') {
    return (
      <Board
        workshopId={workshop.id}
        currentParticipant={currentParticipant}
        readOnly={workshop.current_stage !== 'gather'}
      />
    )
  }

  if (viewingStage === 'cluster') {
    return <ClusterView workshop={workshop} isFacilitator={currentParticipant.is_facilitator} />
  }

  if (viewingStage === 'vote') {
    return <DotVoting workshop={workshop} isFacilitator={currentParticipant.is_facilitator} />
  }

  if (viewingStage === 'design') {
    return <DesignView workshop={workshop} isFacilitator={currentParticipant.is_facilitator} />
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mb-6 border-b border-neutral-800 pb-4">
        <p className="text-sm text-neutral-500">현재 보는 단계</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-normal">{viewingStage}</h2>
      </div>
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <p className="text-sm leading-6 text-neutral-300">{PLACEHOLDER_COPY[viewingStage]}</p>
      </div>
    </main>
  )
}
