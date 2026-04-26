import type { NextRequest } from 'next/server'
import { withFacilitator } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { createWorkshopSchema, listWorkshopsQuerySchema } from '@/lib/api/validators'
import type { TablesInsert } from '@/lib/supabase/types'
import { generateInviteCode } from '@/lib/utils'
import { DEFAULT_WORKSHOP_SETTINGS } from '@/types/workshop'

const MAX_INVITE_CODE_ATTEMPTS = 3

export async function GET(req: NextRequest) {
  return withFacilitator(req, async (_request, { service, user }) => {
    const parsed = listWorkshopsQuerySchema.safeParse({
      project_id: req.nextUrl.searchParams.get('project_id'),
    })

    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION_ERROR, 'project_id가 필요합니다.', 400)
    }

    const { data: project, error: projectError } = await service
      .from('projects')
      .select('id')
      .eq('id', parsed.data.project_id)
      .eq('facilitator_id', user.id)
      .maybeSingle()

    if (projectError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, projectError.message, 500)
    }

    if (!project) {
      return error(API_ERROR_CODES.NOT_FOUND, '프로젝트를 찾을 수 없습니다.', 404)
    }

    const { data: workshops, error: workshopsError } = await service
      .from('workshops')
      .select('*')
      .eq('project_id', parsed.data.project_id)
      .order('updated_at', { ascending: false })

    if (workshopsError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, workshopsError.message, 500)
    }

    return success(workshops)
  })
}

export async function POST(req: NextRequest) {
  return withFacilitator(req, async (_request, { service, user }) => {
    const body = await req.json().catch(() => null)
    const parsed = createWorkshopSchema.safeParse(body)
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION_ERROR, '워크샵 정보를 확인해주세요.', 400)
    }

    const { data: project, error: projectError } = await service
      .from('projects')
      .select('id')
      .eq('id', parsed.data.project_id)
      .eq('facilitator_id', user.id)
      .maybeSingle()

    if (projectError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, projectError.message, 500)
    }

    if (!project) {
      return error(API_ERROR_CODES.NOT_FOUND, '프로젝트를 찾을 수 없습니다.', 404)
    }

    const { data: activeWorkshop, error: activeError } = await service
      .from('workshops')
      .select('id')
      .eq('project_id', parsed.data.project_id)
      .neq('current_stage', 'completed')
      .maybeSingle()

    if (activeError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, activeError.message, 500)
    }

    if (activeWorkshop) {
      return error(API_ERROR_CODES.CONFLICT, '이 프로젝트에 이미 활성 워크샵이 존재합니다.', 409)
    }

    const workshopInsert: Omit<TablesInsert<'workshops'>, 'invite_code'> = {
      project_id: parsed.data.project_id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      facilitator_id: user.id,
      current_stage: 'context',
      settings: {
        ...DEFAULT_WORKSHOP_SETTINGS,
        ...parsed.data.settings,
      },
    }

    let workshop = null
    let lastError: { message: string; code?: string } | null = null

    for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt += 1) {
      const { data, error: workshopError } = await service
        .from('workshops')
        .insert({
          ...workshopInsert,
          invite_code: generateInviteCode(),
        })
        .select('*')
        .single()

      if (!workshopError && data) {
        workshop = data
        lastError = null
        break
      }

      lastError = workshopError
      if (workshopError?.code !== '23505') {
        break
      }
    }

    if (!workshop) {
      if (lastError?.code === '23505') {
        return error(API_ERROR_CODES.CONFLICT, '초대 코드 충돌이 발생했습니다. 다시 시도해주세요.', 409)
      }

      return error(
        API_ERROR_CODES.INTERNAL_ERROR,
        lastError?.message ?? '워크샵 생성 중 오류가 발생했습니다.',
        500,
      )
    }

    const displayName = getFacilitatorDisplayName(user.user_metadata, user.email)
    const { data: participant, error: participantError } = await service
      .from('participants')
      .insert({
        workshop_id: workshop.id,
        user_id: user.id,
        display_name: displayName,
        is_facilitator: true,
      })
      .select('*')
      .single()

    if (participantError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, participantError.message, 500)
    }

    return success({ workshop, participant }, 201)
  })
}

function getFacilitatorDisplayName(metadata: Record<string, unknown>, email?: string) {
  const metadataName = metadata.name
  const name = typeof metadataName === 'string' && metadataName.trim() ? metadataName : email
  return (name ?? 'Facilitator').slice(0, 30)
}
