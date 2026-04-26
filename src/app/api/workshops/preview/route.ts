import type { NextRequest } from 'next/server'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { previewWorkshopQuerySchema } from '@/lib/api/validators'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { WorkshopSettings } from '@/types/workshop'

export async function GET(req: NextRequest) {
  const parsed = previewWorkshopQuerySchema.safeParse({
    invite_code:
      req.nextUrl.searchParams.get('invite_code') ?? req.nextUrl.searchParams.get('code'),
  })

  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '초대 코드를 확인해주세요.', 400)
  }

  const service = createServiceRoleClient()
  const { data: workshop, error: workshopError } = await service
    .from('workshops')
    .select('id,title,description,current_stage,settings')
    .eq('invite_code', parsed.data.invite_code)
    .maybeSingle()

  if (workshopError) {
    return error(API_ERROR_CODES.INTERNAL_ERROR, workshopError.message, 500)
  }

  if (!workshop) {
    return error(API_ERROR_CODES.NOT_FOUND, '존재하지 않는 초대 코드입니다.', 404)
  }

  const { count, error: countError } = await service
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('workshop_id', workshop.id)

  if (countError) {
    return error(API_ERROR_CODES.INTERNAL_ERROR, countError.message, 500)
  }

  const settings = workshop.settings as WorkshopSettings

  return success({
    id: workshop.id,
    title: workshop.title,
    description: workshop.description,
    current_stage: workshop.current_stage,
    participant_count: count ?? 0,
    max_participants: settings.max_participants ?? 20,
    read_only: workshop.current_stage === 'completed',
  })
}
