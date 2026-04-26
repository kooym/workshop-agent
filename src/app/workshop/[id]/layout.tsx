import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ReactNode } from 'react'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { ParticipantList } from '@/components/workshop/ParticipantList'
import { StageNav } from '@/components/workshop/StageNav'
import { WorkshopRealtimeProvider } from '@/components/workshop/WorkshopRealtimeProvider'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

type WorkshopLayoutProps = {
  children: ReactNode
  params: Promise<{ id: string }>
}

export default async function WorkshopLayout({ children, params }: WorkshopLayoutProps) {
  const { id } = await params
  const service = createServiceRoleClient()
  const participant = await getAuthorizedParticipant(id)

  if (!participant) {
    redirect('/')
  }

  const { data: workshop } = await service
    .from('workshops')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!workshop) {
    redirect('/')
  }

  const { data: participants } = await service
    .from('participants')
    .select('*')
    .eq('workshop_id', id)
    .order('joined_at', { ascending: true })

  return (
    <WorkshopRealtimeProvider
      workshop={workshop}
      participants={participants ?? []}
      currentParticipant={participant}
    >
      <div className="min-h-screen bg-neutral-950 text-white">
        <div className="grid min-h-screen md:grid-cols-[280px_1fr]">
          <aside className="border-b border-neutral-800 bg-neutral-900 p-5 md:border-b-0 md:border-r">
            <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-200">
              Workshop Agent
            </Link>
            <h1 className="mt-5 text-xl font-semibold tracking-normal">{workshop.title}</h1>
            {workshop.description ? (
              <p className="mt-2 text-sm leading-6 text-neutral-400">{workshop.description}</p>
            ) : null}
            <dl className="mt-6 space-y-3 text-sm">
              <div>
                <dt className="text-neutral-500">현재 단계</dt>
                <dd className="mt-1 text-neutral-100">{workshop.current_stage}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">초대 코드</dt>
                <dd className="mt-1 font-mono text-neutral-100">{workshop.invite_code}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">참여자</dt>
                <dd className="mt-1 text-neutral-100">{participant.display_name}</dd>
              </div>
            </dl>
            <StageNav />
            <ParticipantList />
          </aside>
          <section>
            <ErrorBoundary>{children}</ErrorBoundary>
          </section>
        </div>
      </div>
    </WorkshopRealtimeProvider>
  )
}

async function getAuthorizedParticipant(workshopId: string) {
  const service = createServiceRoleClient()
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: participant } = await service
      .from('participants')
      .select('*')
      .eq('workshop_id', workshopId)
      .eq('user_id', user.id)
      .maybeSingle()

    return participant
  }

  const session = await getSession()
  if (!session || session.workshopId !== workshopId) {
    return null
  }

  const { data: participant } = await service
    .from('participants')
    .select('*')
    .eq('id', session.participantId)
    .eq('workshop_id', workshopId)
    .maybeSingle()

  return participant
}
