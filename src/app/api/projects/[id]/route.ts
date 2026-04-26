import type { NextRequest } from 'next/server'
import { withFacilitator } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { projectPatchSchema } from '@/lib/api/validators'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  return withFacilitator(req, async (_request, { service, user }) => {
    const { id } = await context.params
    const body = await req.json().catch(() => null)
    const parsed = projectPatchSchema.safeParse(body)
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION_ERROR, '프로젝트 수정 정보를 확인해주세요.', 400)
    }

    const updateData: { name?: string; description?: string | null } = {}
    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name
    }
    if (parsed.data.description !== undefined) {
      updateData.description = parsed.data.description ?? null
    }

    const { data: project, error: projectError } = await service
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .eq('facilitator_id', user.id)
      .select('*')
      .maybeSingle()

    if (projectError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, projectError.message, 500)
    }

    if (!project) {
      return error(API_ERROR_CODES.NOT_FOUND, '프로젝트를 찾을 수 없습니다.', 404)
    }

    return success(project)
  })
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  return withFacilitator(req, async (_request, { service, user }) => {
    const { id } = await context.params
    const { data: project, error: projectError } = await service
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('facilitator_id', user.id)
      .maybeSingle()

    if (projectError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, projectError.message, 500)
    }

    if (!project) {
      return error(API_ERROR_CODES.NOT_FOUND, '프로젝트를 찾을 수 없습니다.', 404)
    }

    const { count, error: countError } = await service
      .from('workshops')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', id)

    if (countError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, countError.message, 500)
    }

    if ((count ?? 0) > 0) {
      return error(API_ERROR_CODES.CONFLICT, '워크샵이 있는 프로젝트는 삭제할 수 없습니다.', 409)
    }

    const { error: deleteError } = await service.from('projects').delete().eq('id', id)
    if (deleteError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, deleteError.message, 500)
    }

    return success({ success: true })
  })
}
