import { notFound, redirect } from 'next/navigation'
import { ProjectWorkshops } from '@/components/dashboard/ProjectWorkshops'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type ProjectPageProps = {
  params: Promise<{ projectId: string }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const service = createServiceRoleClient()
  const { data: project } = await service
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('facilitator_id', user.id)
    .maybeSingle()

  if (!project) {
    notFound()
  }

  const { data: workshops } = await service
    .from('workshops')
    .select('*')
    .eq('project_id', project.id)
    .order('updated_at', { ascending: false })

  return <ProjectWorkshops project={project} initialWorkshops={workshops ?? []} />
}
