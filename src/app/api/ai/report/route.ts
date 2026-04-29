import type { NextRequest } from 'next/server'
import { generateReportWithAI } from '@/lib/ai/output'
import { withFacilitator } from '@/lib/api/middleware'
import { buildReportInput, insertVersionedReport } from '@/lib/api/output'
import { isProcessingStale } from '@/lib/api/clusters'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { aiOutputSchema } from '@/lib/api/validators'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = aiOutputSchema.safeParse(body)
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '워크샵 정보를 확인해주세요.', 400)
  }

  return withFacilitator(req, async (_request, { service, user }) => {
    const workshopId = parsed.data.workshop_id
    let processingStarted = false

    const { data: workshop, error: workshopError } = await service
      .from('workshops')
      .select('*')
      .eq('id', workshopId)
      .maybeSingle()

    if (workshopError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, workshopError.message, 500)
    }
    if (!workshop) {
      return error(API_ERROR_CODES.NOT_FOUND, '워크샵을 찾을 수 없습니다.', 404)
    }
    if (workshop.facilitator_id !== user.id) {
      return error(API_ERROR_CODES.FORBIDDEN, '워크샵 퍼실리테이터만 실행할 수 있습니다.', 403)
    }
    if (workshop.current_stage !== 'report') {
      return error(API_ERROR_CODES.CONFLICT, '보고서 단계에서만 실행할 수 있습니다.', 409)
    }
    if (workshop.is_processing && !isProcessingStale(workshop.is_processing_since)) {
      return error(API_ERROR_CODES.PROCESSING, '이미 AI가 처리 중입니다.', 409)
    }

    const { error: lockError } = await service
      .from('workshops')
      .update({ is_processing: true, is_processing_since: new Date().toISOString() })
      .eq('id', workshopId)

    if (lockError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, lockError.message, 500)
    }
    processingStarted = true

    try {
      const input = await buildReportInput(service, workshop)
      const response = await generateReportWithAI(input)
      const report = await insertVersionedReport(service, workshopId, response.content)
      return success(report)
    } catch (reportError) {
      const message =
        reportError instanceof Error ? reportError.message : 'AI 종합 보고서 생성에 실패했습니다.'
      if (
        message === '보고서를 생성할 AX 설계 산출물이 없습니다.' ||
        message === '보고서를 생성할 PRD가 없습니다.'
      ) {
        return error(API_ERROR_CODES.VALIDATION_ERROR, message, 400)
      }
      return error(
        API_ERROR_CODES.INTERNAL_ERROR,
        message,
        500,
      )
    } finally {
      if (processingStarted) {
        await service
          .from('workshops')
          .update({ is_processing: false, is_processing_since: null })
          .eq('id', workshopId)
      }
    }
  })
}
