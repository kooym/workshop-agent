'use client'

import type { ReactNode } from 'react'
import { Board } from '@/components/board/Board'
import { ClusterView } from '@/components/cluster/ClusterView'
import { ProcessGraphEditor } from '@/components/context/ProcessGraphEditor'
import { DesignView } from '@/components/design/DesignView'
import { PrdStage } from '@/components/prd/PrdStage'
import { ReportStage } from '@/components/report/ReportStage'
import { DotVoting } from '@/components/vote/DotVoting'
import { useWorkshopStore } from '@/stores/workshop'
import type { WorkshopStage } from '@/types/workshop'
import { CompletedStage } from './CompletedStage'
import { StageGuideBanner } from './StageGuideBanner'
import { StaleBanner } from './StaleBanner'

const PLACEHOLDER_COPY: Record<Exclude<WorkshopStage, 'context'>, string> = {
  gather: '포스트잇 보드를 불러오는 중입니다.',
  cluster: '클러스터 뷰는 Step 5에서 구현됩니다.',
  vote: '투표 화면은 Step 6에서 구현됩니다.',
  design: 'AX 설계 화면은 Step 7에서 구현됩니다.',
  generate: 'PRD 화면을 불러오는 중입니다.',
  report: '종합 보고서 화면을 불러오는 중입니다.',
  completed: '워크샵 완료 화면은 Step 9에서 구현됩니다.',
}

export function WorkshopStageView() {
  const workshop = useWorkshopStore((state) => state.workshop)
  const currentParticipant = useWorkshopStore((state) => state.currentParticipant)
  const viewingStage = useWorkshopStore((state) => state.viewingStage)

  if (!workshop || !currentParticipant || !viewingStage) {
    return <div className="p-6 text-sm text-ink-muted-48">워크샵을 불러오는 중입니다.</div>
  }

  if (viewingStage === 'context') {
    return (
      <StageChrome workshopId={workshop.id} stage={viewingStage} isFacilitator={currentParticipant.is_facilitator}>
        <ProcessGraphEditor
          workshopId={workshop.id}
          currentParticipantId={currentParticipant.id}
          isFacilitator={currentParticipant.is_facilitator}
        />
      </StageChrome>
    )
  }

  if (viewingStage === 'gather') {
    return (
      <StageChrome workshopId={workshop.id} stage={viewingStage} isFacilitator={currentParticipant.is_facilitator}>
        <Board
          workshopId={workshop.id}
          currentParticipant={currentParticipant}
          readOnly={workshop.current_stage !== 'gather'}
        />
      </StageChrome>
    )
  }

  if (viewingStage === 'cluster') {
    return (
      <StageChrome workshopId={workshop.id} stage={viewingStage} isFacilitator={currentParticipant.is_facilitator}>
        <ClusterView workshop={workshop} isFacilitator={currentParticipant.is_facilitator} />
      </StageChrome>
    )
  }

  if (viewingStage === 'vote') {
    return (
      <StageChrome workshopId={workshop.id} stage={viewingStage} isFacilitator={currentParticipant.is_facilitator}>
        <DotVoting workshop={workshop} isFacilitator={currentParticipant.is_facilitator} />
      </StageChrome>
    )
  }

  if (viewingStage === 'design') {
    return (
      <StageChrome workshopId={workshop.id} stage={viewingStage} isFacilitator={currentParticipant.is_facilitator}>
        <DesignView workshop={workshop} isFacilitator={currentParticipant.is_facilitator} />
      </StageChrome>
    )
  }

  if (viewingStage === 'generate') {
    return (
      <StageChrome workshopId={workshop.id} stage={viewingStage} isFacilitator={currentParticipant.is_facilitator}>
        <PrdStage workshop={workshop} isFacilitator={currentParticipant.is_facilitator} />
      </StageChrome>
    )
  }

  if (viewingStage === 'report') {
    return (
      <StageChrome workshopId={workshop.id} stage={viewingStage} isFacilitator={currentParticipant.is_facilitator}>
        <ReportStage workshop={workshop} isFacilitator={currentParticipant.is_facilitator} />
      </StageChrome>
    )
  }

  if (viewingStage === 'completed') {
    return (
      <StageChrome workshopId={workshop.id} stage={viewingStage} isFacilitator={currentParticipant.is_facilitator}>
        <CompletedStage workshopId={workshop.id} />
      </StageChrome>
    )
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mb-6 border-b border-hairline pb-4">
        <p className="text-sm text-ink-muted-48">현재 보는 단계</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-normal">{viewingStage}</h2>
      </div>
      <div className="rounded-apple-lg border border-hairline bg-white p-6">
        <p className="text-sm leading-6 text-ink-muted-80">{PLACEHOLDER_COPY[viewingStage]}</p>
      </div>
    </main>
  )
}

function StageChrome({
  workshopId,
  stage,
  isFacilitator,
  children,
}: {
  workshopId: string
  stage: WorkshopStage
  isFacilitator: boolean
  children: ReactNode
}) {
  return (
    <>
      <StageGuideBanner stage={stage} />
      <StaleBanner workshopId={workshopId} stage={stage} isFacilitator={isFacilitator} />
      {children}
    </>
  )
}
