import type { WorkshopSummary } from '@/lib/api/summary'
import type { WorkshopStage } from '@/types/workshop'

export function validateStagePrerequisites(current: WorkshopStage, next: WorkshopStage, summary: WorkshopSummary, workshop?: { design_step: number }) {
  if (current === 'context' && next === 'gather') {
    if (summary.counts.process_steps < 1) {
      return '프로세스 단계를 1개 이상 등록해주세요.'
    }
    if (!summary.has_start_event || !summary.has_end_event) {
      return '시작 이벤트와 종료 이벤트가 각각 1개 이상 필요합니다.'
    }
  }

  if (current === 'gather' && next === 'cluster' && summary.counts.notes < 5) {
    return '최소 5개의 포스트잇이 필요합니다.'
  }

  if (current === 'cluster' && next === 'vote' && summary.counts.clusters < 1) {
    return '클러스터링을 먼저 실행하세요.'
  }

  if (current === 'design' && next === 'generate') {
    if (!summary.latest_versions.design_artifact) {
      return 'AX 설계를 먼저 생성하세요.'
    }
    if (summary.counts.tasks < 1) {
      return 'PRD를 생성할 AX 과제가 없습니다.'
    }
    if (workshop && workshop.design_step < 4) {
      return '설계 4단계(솔루션 캔버스)까지 모두 완료해야 합니다.'
    }
  }

  if (current === 'generate' && next === 'report' && !summary.latest_versions.prd) {
    return 'PRD를 먼저 생성하세요.'
  }

  if (current === 'report' && next === 'completed') {
    if (!summary.latest_versions.report) {
      return '종합 보고서를 먼저 생성하세요.'
    }
    if (Object.values(summary.stale).some(Boolean)) {
      return '최신이 아닌 산출물이 있습니다. 재실행하거나 현재 결과 유지를 선택하세요.'
    }
  }

  return null
}
