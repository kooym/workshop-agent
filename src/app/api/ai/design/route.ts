import type { NextRequest } from 'next/server'
import { generateDesignWithAI } from '@/lib/ai/design'
import { withFacilitator } from '@/lib/api/middleware'
import { applyDesignResponse, buildDesignInput } from '@/lib/api/design'
import { isProcessingStale } from '@/lib/api/clusters'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { aiDesignSchema } from '@/lib/api/validators'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = aiDesignSchema.safeParse(body)
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
    if (workshop.current_stage !== 'design') {
      return error(API_ERROR_CODES.CONFLICT, '설계 단계에서만 실행할 수 있습니다.', 409)
    }
    if (workshop.is_processing && !isProcessingStale(workshop.is_processing_since)) {
      return error(API_ERROR_CODES.PROCESSING, '이미 AI가 처리 중입니다.', 409)
    }

    const { error: lockError } = await service
      .from('workshops')
      .update({
        is_processing: true,
        is_processing_since: new Date().toISOString(),
      })
      .eq('id', workshopId)

    if (lockError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, lockError.message, 500)
    }
    processingStarted = true

    try {
      const { input, context } = await buildDesignInput(service, workshop)
      const aiResponse = await generateDesignWithAI(input, context)
      const payload = await applyDesignResponse(service, workshopId, aiResponse)
      return success(payload)
    } catch (designError) {
      return error(
        API_ERROR_CODES.INTERNAL_ERROR,
        designError instanceof Error ? designError.message : 'AI AX 설계에 실패했습니다.',
        500,
      )
    } finally {
      if (processingStarted) {
        await service
          .from('workshops')
          .update({
            is_processing: false,
            is_processing_since: null,
          })
          .eq('id', workshopId)
      }
    }
  })
}
