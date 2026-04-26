import { API_ERROR_CODES, error } from '@/lib/api/response'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/types'

type ServiceClient = ReturnType<typeof createServiceRoleClient>

export async function ensureGatherStage(service: ServiceClient, workshopId: string) {
  const { data: workshop, error: workshopError } = await service
    .from('workshops')
    .select('*')
    .eq('id', workshopId)
    .single()

  if (workshopError || !workshop) {
    return {
      ok: false as const,
      response: error(API_ERROR_CODES.NOT_FOUND, '워크샵을 찾을 수 없습니다.', 404),
    }
  }

  if (workshop.current_stage !== 'gather') {
    return {
      ok: false as const,
      response: error(API_ERROR_CODES.STAGE_LOCKED, 'gather 단계에서만 포스트잇을 수정할 수 있습니다.', 403),
    }
  }

  return {
    ok: true as const,
    workshop,
  }
}

export async function validateProcessStep(
  service: ServiceClient,
  workshopId: string,
  processStepId: string | null | undefined,
) {
  if (!processStepId) {
    return true
  }

  const { data: step } = await service
    .from('process_steps')
    .select('id')
    .eq('id', processStepId)
    .eq('workshop_id', workshopId)
    .maybeSingle()

  return Boolean(step)
}

export function canModifyNote(
  note: Tables<'notes'>,
  participant: Tables<'participants'>,
) {
  return note.participant_id === participant.id
}

export function canDeleteNote(
  note: Tables<'notes'>,
  participant: Tables<'participants'>,
  actor: 'participant' | 'facilitator',
) {
  return actor === 'facilitator' || note.participant_id === participant.id
}
