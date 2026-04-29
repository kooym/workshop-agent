import { redirect } from 'next/navigation'
import { ProjectDashboard, type DashboardProject } from '@/components/dashboard/ProjectDashboard'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Check if user is approved
  if (user.user_metadata?.approved !== true) {
    redirect('/auth/login')
  }

  const service = createServiceRoleClient()
  const { data: projects } = await service
    .from('projects')
    .select('*')
    .eq('facilitator_id', user.id)
    .order('updated_at', { ascending: false })

  const projectIds = projects?.map((project) => project.id) ?? []
  const { data: workshops } = projectIds.length
    ? await service
        .from('workshops')
        .select('*')
        .in('project_id', projectIds)
        .order('updated_at', { ascending: false })
    : { data: [] }

  const dashboardProjects: DashboardProject[] = (projects ?? []).map((project) => {
    const projectWorkshops = (workshops ?? []).filter((workshop) => workshop.project_id === project.id)
    return {
      ...project,
      workshop_count: projectWorkshops.length,
      active_workshop:
        projectWorkshops.find((workshop) => workshop.current_stage !== 'completed') ?? null,
      latest_workshop_updated_at: projectWorkshops[0]?.updated_at ?? null,
    }
  })

  const isAdmin = user.user_metadata?.role === 'admin'

  return <ProjectDashboard initialProjects={dashboardProjects} isAdmin={isAdmin} />
}
