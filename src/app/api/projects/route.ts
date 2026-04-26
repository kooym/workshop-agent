import type { NextRequest } from 'next/server'
import { withFacilitator } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { projectSchema } from '@/lib/api/validators'
import type { Tables } from '@/lib/supabase/types'

type ProjectSummary = Tables<'projects'> & {
  workshop_count: number
  active_workshop: Tables<'workshops'> | null
  latest_workshop_updated_at: string | null
}

export async function GET(req: NextRequest) {
  return withFacilitator(req, async (_request, { service, user }) => {
    const { data: projects, error: projectsError } = await service
      .from('projects')
      .select('*')
      .eq('facilitator_id', user.id)
      .order('updated_at', { ascending: false })

    if (projectsError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, projectsError.message, 500)
    }

    const projectIds = projects.map((project) => project.id)
    const { data: workshops, error: workshopsError } = projectIds.length
      ? await service
          .from('workshops')
          .select('*')
          .in('project_id', projectIds)
          .order('updated_at', { ascending: false })
      : { data: [], error: null }

    if (workshopsError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, workshopsError.message, 500)
    }

    const summaries: ProjectSummary[] = projects.map((project) => {
      const projectWorkshops = workshops.filter((workshop) => workshop.project_id === project.id)
      const activeWorkshop =
        projectWorkshops.find((workshop) => workshop.current_stage !== 'completed') ?? null

      return {
        ...project,
        workshop_count: projectWorkshops.length,
        active_workshop: activeWorkshop,
        latest_workshop_updated_at: projectWorkshops[0]?.updated_at ?? null,
      }
    })

    return success(summaries)
  })
}

export async function POST(req: NextRequest) {
  return withFacilitator(req, async (_request, { service, user }) => {
    const body = await req.json().catch(() => null)
    const parsed = projectSchema.safeParse(body)
    if (!parsed.success) {
      return error(API_ERROR_CODES.VALIDATION_ERROR, '프로젝트 정보를 확인해주세요.', 400)
    }

    const { data: project, error: projectError } = await service
      .from('projects')
      .insert({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        facilitator_id: user.id,
      })
      .select('*')
      .single()

    if (projectError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, projectError.message, 500)
    }

    return success(project, 201)
  })
}
