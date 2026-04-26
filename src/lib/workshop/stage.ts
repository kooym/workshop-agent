import type { WorkshopSettings, WorkshopStage } from '@/types/workshop'
import { WORKSHOP_STAGES } from '@/types/workshop'

export const STAGE_ORDER = WORKSHOP_STAGES

export function getStageIndex(stage: WorkshopStage): number {
  return STAGE_ORDER.indexOf(stage)
}

export function isStageAfter(left: WorkshopStage, right: WorkshopStage): boolean {
  return getStageIndex(left) > getStageIndex(right)
}

export function getNextStage(stage: WorkshopStage): WorkshopStage | null {
  const next = STAGE_ORDER[getStageIndex(stage) + 1]
  return next ?? null
}

export function isForwardStageTransition(current: WorkshopStage, next: WorkshopStage): boolean {
  return getNextStage(current) === next
}

export function validateStageTransition(current: WorkshopStage, next: WorkshopStage) {
  if (current === 'completed') {
    return '완료된 워크샵은 수정할 수 없습니다.'
  }

  if (!isForwardStageTransition(current, next)) {
    return '워크샵 단계는 정해진 순서로 한 단계씩만 전진할 수 있습니다.'
  }

  return null
}

export function validateSettingsPatch(
  currentStage: WorkshopStage,
  currentParticipantCount: number,
  settingsPatch: Partial<WorkshopSettings>,
) {
  if (currentStage === 'completed') {
    return '완료된 워크샵의 설정은 수정할 수 없습니다.'
  }

  if (settingsPatch.anonymous !== undefined && getStageIndex(currentStage) > getStageIndex('gather')) {
    return '익명 설정은 context 또는 gather 단계에서만 변경할 수 있습니다.'
  }

  if (
    settingsPatch.votes_per_person !== undefined &&
    getStageIndex(currentStage) >= getStageIndex('vote')
  ) {
    return '투표 수는 vote 단계 진입 전까지만 변경할 수 있습니다.'
  }

  if (settingsPatch.vote_mode !== undefined && getStageIndex(currentStage) >= getStageIndex('vote')) {
    return '투표 대상은 vote 단계 진입 전까지만 변경할 수 있습니다.'
  }

  if (
    settingsPatch.max_participants !== undefined &&
    settingsPatch.max_participants < currentParticipantCount
  ) {
    return '최대 참가자 수는 현재 참가자 수보다 작게 설정할 수 없습니다.'
  }

  return null
}

export function mergeWorkshopSettings(
  current: WorkshopSettings,
  patch: Partial<WorkshopSettings> | undefined,
): WorkshopSettings {
  return {
    ...current,
    ...patch,
  }
}

export function getStaleTargets(modifiedStage: WorkshopStage) {
  if (modifiedStage === 'context' || modifiedStage === 'gather') {
    return ['clusters', 'design_artifacts', 'prds', 'ax_reports'] as const
  }

  if (modifiedStage === 'cluster' || modifiedStage === 'vote') {
    return ['design_artifacts', 'prds', 'ax_reports'] as const
  }

  if (modifiedStage === 'design') {
    return ['prds', 'ax_reports'] as const
  }

  if (modifiedStage === 'generate') {
    return ['ax_reports'] as const
  }

  return [] as const
}
