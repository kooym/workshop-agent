'use client'

import { Check, ChevronRight, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AiProgressIndicator } from '@/components/common/AiProgressIndicator'
import { FinalTaskView } from './FinalTaskView'
import { SolutionCanvasView } from './SolutionCanvasView'
import { TaskCard } from './TaskCard'
import { TaskVoting } from './TaskVoting'
import { ToBeProcessView } from './ToBeProcessView'
import { useClusterStore } from '@/stores/cluster'
import { useDesignStore } from '@/stores/design'
import { useWorkshopStore } from '@/stores/workshop'
import type { Workshop } from '@/types/workshop'

const DESIGN_STEPS = [
  { id: 1, label: '과제 도출', key: 'tasks' },
  { id: 2, label: '과제 투표', key: 'task-select' },
  { id: 3, label: '최종 과제', key: 'final-task' },
  { id: 4, label: '솔루션 캔버스', key: 'canvas' },
] as const

const STEP_MESSAGES = [
  'AI가 과제를 도출하고 있습니다...',
  '',
  '선택된 과제를 분석하여 최종 과제를 생성하고 있습니다...',
  '솔루션 캔버스를 생성하고 있습니다...',
]

export function DesignView({
  workshop,
  isFacilitator,
}: {
  workshop: Workshop
  isFacilitator: boolean
}) {
  const designArtifacts = useDesignStore((state) => state.designArtifacts)
  const tasks = useDesignStore((state) => state.tasks)
  const setDesignPayload = useDesignStore((state) => state.setDesignPayload)
  const refetchDesign = useDesignStore((state) => state.refetchAll)
  const refetchClusters = useClusterStore((state) => state.refetchAll)
  const refetchWorkshop = useWorkshopStore((state) => state.refetchAll)
  const [runningStep, setRunningStep] = useState<number | null>(null)
  const [viewingStep, setViewingStep] = useState(Math.max(1, workshop.design_step))
  const [facilitatorNote, setFacilitatorNote] = useState('')
  const isProcessing = workshop.is_processing || runningStep !== null
  const canRunAi = isFacilitator && workshop.current_stage === 'design'
  const completedStep = workshop.design_step

  const currentArtifact = designArtifacts.find((a) => a.alternative_index === 0) ?? null

  const selectedTaskCount = tasks.filter((t) => t.is_selected && !t.is_bundle).length
  const totalTaskCount = tasks.filter((t) => !t.is_bundle).length
  const winnerTask = tasks.find((t) => t.is_selected && !t.is_bundle)

  useEffect(() => {
    void Promise.all([refetchDesign(workshop.id), refetchClusters(workshop.id)])
  }, [refetchClusters, refetchDesign, workshop.id])

  // Sync viewingStep when completedStep advances
  useEffect(() => {
    if (completedStep > 0) {
      setViewingStep(completedStep)
    }
  }, [completedStep])

  async function runStep(step: number) {
    if (!canRunAi || isProcessing) return

    // Step 3 (final task detail) needs exactly 1 selected winner
    if (step === 3 && !winnerTask) {
      toast.error('투표 마감 후 1위 과제가 선정되어야 합니다.')
      return
    }

    // Step 4 (solution canvas) needs final_task_detail
    if (step === 4 && !currentArtifact?.final_task_detail) {
      toast.error('최종 과제 상세를 먼저 생성해야 솔루션 캔버스를 생성할 수 있습니다.')
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 600_000)
    setRunningStep(step)
    try {
      const response = await fetch('/api/ai/design', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workshop_id: workshop.id, design_step: step, facilitator_note: facilitatorNote || undefined }),
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        toast.error(payload?.error?.message ?? 'AI 설계에 실패했습니다.')
        await refetchWorkshop(workshop.id)
        return
      }

      setDesignPayload(payload.data)
      await refetchWorkshop(workshop.id)
      setViewingStep(step)
      setFacilitatorNote('')
      if (payload.data.warnings?.length) {
        toast.warning(payload.data.warnings.join('\n'))
      } else {
        toast.success(`${DESIGN_STEPS[step - 1].label} 생성이 완료되었습니다.`)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        toast.error('AI 설계 요청이 시간 초과되었습니다. 다시 시도해주세요.')
      } else {
        toast.error('AI 설계에 실패했습니다. 다시 시도해주세요.')
      }
      await refetchWorkshop(workshop.id).catch(() => {})
    } finally {
      clearTimeout(timer)
      setRunningStep(null)
    }
  }

  async function toggleTaskSelection(taskId: string, isSelected: boolean) {
    const response = await fetch(`/api/tasks/${taskId}?workshop_id=${workshop.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ is_selected: isSelected }),
    })
    if (!response.ok) {
      toast.error('과제 선택 상태를 변경하지 못했습니다.')
      return
    }
    await refetchDesign(workshop.id)
  }

  const canRunStep = (step: number) => {
    if (!canRunAi || isProcessing) return false
    if (step === 1) return true
    if (step === 3) return !!winnerTask
    if (step === 4) return !!currentArtifact?.final_task_detail
    return completedStep >= step - 1
  }

  return (
    <main className="min-h-screen bg-canvas-parchment p-6">
      <div className="mb-6 border-b border-hairline pb-4">
        <p className="text-sm text-ink-muted-48">현재 보는 단계</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-normal">AI 솔루션 설계</h2>
        {completedStep > 0 ? (
          <p className="mt-2 text-sm text-ink-muted-48">
            {completedStep}/4 단계 완료
            {totalTaskCount > 0 ? ` · 과제 ${totalTaskCount}개 (최종 선정 ${selectedTaskCount}개)` : ''}
          </p>
        ) : null}
      </div>

      {!canRunAi && !workshop.is_processing ? (
        <div className="mb-4 rounded-apple-lg border border-amber-500/30 bg-amber-50 p-4 text-sm text-amber-700">
          {isFacilitator && workshop.current_stage !== 'design'
            ? '현재 단계가 \'설계\'가 아닙니다. 사이드바에서 \'다음 단계로\' 버튼을 눌러 설계 단계로 전진해주세요.'
            : !isFacilitator
              ? '퍼실리테이터가 설계 단계를 시작하면 AI 설계 결과를 확인할 수 있습니다.'
              : null}
        </div>
      ) : null}

      {isProcessing && runningStep !== null ? (
        <AiProgressIndicator
          isActive
          title={STEP_MESSAGES[runningStep - 1]}
          className="mb-4"
          steps={[
            { label: '입력 데이터 준비', estimatedSeconds: 3 },
            { label: 'AI 모델 분석', estimatedSeconds: 15 },
            { label: '결과 검증 및 저장', estimatedSeconds: 5 },
          ]}
        />
      ) : workshop.is_processing ? (
        <AiProgressIndicator
          isActive
          title="퍼실리테이터가 AI를 실행 중입니다"
          className="mb-4"
        />
      ) : null}

      {/* Step Progress Bar */}
      <div className="mb-6 flex items-center gap-1">
        {DESIGN_STEPS.map((step, i) => {
          const isCompleted = completedStep >= step.id
          const isCurrent = viewingStep === step.id
          const isClickable = isCompleted || step.id <= completedStep + 1

          return (
            <div key={step.id} className="flex items-center">
              {i > 0 ? (
                <ChevronRight aria-hidden className="mx-1 h-4 w-4 text-ink-muted-48" />
              ) : null}
              <button
                type="button"
                onClick={() => isClickable && setViewingStep(step.id)}
                disabled={!isClickable}
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm transition ${
                  isCurrent
                    ? 'bg-primary text-white'
                    : isCompleted
                      ? 'bg-canvas-parchment text-green-600 hover:bg-surface-pearl'
                      : isClickable
                        ? 'bg-white text-ink-muted-48 hover:bg-canvas-parchment'
                        : 'bg-white/50 text-ink-muted-48 cursor-not-allowed'
                }`}
              >
                {isCompleted ? (
                  <Check aria-hidden className="h-3.5 w-3.5" />
                ) : (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-xs">
                    {step.id}
                  </span>
                )}
                {step.label}
              </button>
            </div>
          )
        })}
      </div>

      {/* Step Content */}
      <div className="space-y-4">
        {/* Facilitator note input */}
        {isFacilitator && canRunStep(viewingStep) ? (
          <div className="space-y-2">
            <label
              htmlFor="facilitator-note"
              className="block text-xs font-medium text-ink-muted-48"
            >
              AI에 전달할 지시사항 (선택)
            </label>
            <textarea
              id="facilitator-note"
              value={facilitatorNote}
              onChange={(e) => setFacilitatorNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="예: 고객응대 자동화에 집중해주세요, Agent는 3개 이내로..."
              className="w-full resize-none rounded-apple-lg border border-hairline bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted-48 focus:border-primary"
            />
            <p className="text-right text-xs text-ink-muted-48">{facilitatorNote.length}/500</p>
          </div>
        ) : null}

        {/* Step action button — only for AI steps (1, 3, 4), not step 2 (selection) */}
        {isFacilitator && canRunStep(viewingStep) && viewingStep !== 2 ? (
          <div className="space-y-2">
            {viewingStep === 3 ? (
              <p className="text-sm text-ink-muted-80">1위 과제를 9개 카테고리로 심화 확장합니다.</p>
            ) : viewingStep === 4 ? (
              <p className="text-sm text-ink-muted-80">큐레이션 결과를 기반으로 솔루션 캔버스(BMC)를 생성합니다.</p>
            ) : null}
            <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void runStep(viewingStep)}
              disabled={isProcessing}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-canvas-parchment disabled:text-ink-muted-48"
            >
              {runningStep === viewingStep ? (
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles aria-hidden className="h-4 w-4" />
              )}
              {completedStep >= viewingStep ? `${DESIGN_STEPS[viewingStep - 1].label} 재생성` : `${DESIGN_STEPS[viewingStep - 1].label} AI 생성`}
            </button>
            {completedStep >= viewingStep && viewingStep < 4 ? (
              <button
                type="button"
                onClick={() => setViewingStep(viewingStep + 1)}
                className="inline-flex h-9 items-center gap-1 rounded-full bg-canvas-parchment px-3 text-sm text-ink-muted-80 transition hover:bg-surface-pearl"
              >
                다음 스텝
                <ChevronRight aria-hidden className="h-4 w-4" />
              </button>
            ) : null}
            </div>
          </div>
        ) : null}

        {/* Step result view */}
        {viewingStep === 1 ? (
          tasks.filter((t) => !t.is_bundle).length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {tasks.filter((t) => !t.is_bundle).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  canEdit={canRunAi}
                  onChanged={() => void refetchDesign(workshop.id)}
                  onToggleSelection={(isSelected) => void toggleTaskSelection(task.id, isSelected)}
                />
              ))}
            </div>
          ) : completedStep < 1 ? (
            <StepPlaceholder
              message={isFacilitator ? 'AI 생성 버튼을 눌러 과제를 도출하세요.' : '퍼실리테이터가 과제 도출을 시작할 때까지 대기 중입니다.'}
            />
          ) : null
        ) : null}

        {viewingStep === 2 ? (
          tasks.filter((t) => !t.is_bundle).length > 0 ? (
            <TaskVoting
              tasks={tasks}
              workshopId={workshop.id}
              isFacilitator={isFacilitator}
              onDone={() => {
                void refetchWorkshop(workshop.id).then(() => refetchDesign(workshop.id))
                setViewingStep(3)
              }}
            />
          ) : (
            <StepPlaceholder
              message="과제 도출(Step 1)을 먼저 완료해주세요."
            />
          )
        ) : null}

        {viewingStep === 3 ? (
          currentArtifact?.final_task_detail ? (
            <FinalTaskView
              workshopId={workshop.id}
              detail={currentArtifact.final_task_detail as import('@/lib/ai/schemas').FinalTaskDetail}
              isFacilitator={isFacilitator}
              onChange={() => void refetchDesign(workshop.id)}
            />
          ) : completedStep < 3 ? (
            <StepPlaceholder
              message={isFacilitator ? 'AI 생성 버튼을 눌러 최종 과제 상세를 생성하세요.' : '퍼실리테이터가 최종 과제 상세를 생성할 때까지 대기 중입니다.'}
            />
          ) : null
        ) : null}

        {viewingStep === 4 ? (
          currentArtifact?.solution_canvas ? (
            <div className="space-y-6">
              <SolutionCanvasView canvas={currentArtifact.solution_canvas as import('@/lib/ai/schemas').SolutionCanvasResult} />
              {currentArtifact.tobe_process ? (
                <div>
                  <h3 className="mb-3 text-lg font-bold text-ink">TO-BE 프로세스</h3>
                  <ToBeProcessView
                    value={currentArtifact.tobe_process}
                    workshopId={workshop.id}
                    canEdit={canRunAi}
                    onChanged={() => void refetchDesign(workshop.id)}
                  />
                </div>
              ) : null}
            </div>
          ) : completedStep < 4 ? (
            <StepPlaceholder
              message={isFacilitator ? 'AI 생성 버튼을 눌러 솔루션 캔버스를 생성하세요.' : '퍼실리테이터가 솔루션 캔버스를 생성할 때까지 대기 중입니다.'}
            />
          ) : null
        ) : null}
      </div>

      {/* Selection summary bar */}
      {totalTaskCount > 0 ? (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-hairline bg-white/95 px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm text-ink-muted-80">
              과제: <span className="font-semibold text-ink">{totalTaskCount}</span>개
            </span>
            {winnerTask ? (
              <span className="text-sm text-green-600">
                🏆 1위: <span className="font-semibold">{winnerTask.title}</span>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  )
}

function StepPlaceholder({ message }: { message: string }) {
  return (
    <div className="rounded-apple-lg border border-dashed border-hairline bg-canvas-parchment/50 p-8 text-center">
      <p className="text-sm text-ink-muted-80">{message}</p>
    </div>
  )
}
