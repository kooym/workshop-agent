import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ReactNode } from 'react'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { InviteCode } from '@/components/workshop/InviteCode'
import { ParticipantList } from '@/components/workshop/ParticipantList'
import { StageNav } from '@/components/workshop/StageNav'
import { Timer } from '@/components/workshop/Timer'
import { WorkshopRealtimeProvider } from '@/components/workshop/WorkshopRealtimeProvider'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import type { WorkshopStage } from '@/types/workshop'

export const dynamic = 'force-dynamic'

const STAGE_LABEL_KO: Record<WorkshopStage, string> = {
  context: '프로세스 정의',
  gather: '아이디어 수집',
  cluster: '클러스터링',
  vote: '투표',
  design: 'AX 설계',
  generate: 'PRD 생성',
  report: '종합 보고서',
  completed: '완료',
}

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
      <div className="min-h-screen bg-canvas-parchment text-ink">
        <div className="grid min-h-screen md:grid-cols-[280px_1fr]">
          <aside className="flex flex-col border-b border-hairline bg-white md:border-b-0 md:border-r md:overflow-y-auto">
            {/* Header */}
            <div className="border-b border-hairline px-5 py-4">
              <Link href="/" className="text-xs font-medium text-ink-muted-48 hover:text-ink-muted-80 transition-colors">
                ← 워크샵 에이전트
              </Link>
              <h1 className="mt-3 text-lg font-semibold leading-tight tracking-normal">{workshop.title}</h1>
              {workshop.description ? (
                <p className="mt-1.5 text-xs leading-5 text-ink-muted-48 line-clamp-2">{workshop.description}</p>
              ) : null}
            </div>

            {/* Status */}
            <div className="border-b border-hairline px-5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-muted-48">현재 단계</span>
                <span className="text-xs font-medium text-primary">{STAGE_LABEL_KO[workshop.current_stage as WorkshopStage]}</span>
              </div>
              <Timer
                workshopId={workshop.id}
                timerMinutes={workshop.settings.timer_minutes}
                isFacilitator={participant.is_facilitator}
              />
            </div>

            {/* Navigation */}
            <div className="flex-1 px-5 py-3">
              <StageNav />
            </div>

            {/* Invite & Participants */}
            <div className="border-t border-hairline px-5 py-3">
              <InviteCode />
              <ParticipantList />
            </div>
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

  // Guest cookie first — same browser shares Supabase Auth cookies,
  // so a guest tab must resolve via its own cookie, not the facilitator's Auth session.
  const session = await getSession()
  if (session && session.workshopId === workshopId) {
    const { data: guestParticipant } = await service
      .from('participants')
      .select('*')
      .eq('id', session.participantId)
      .eq('workshop_id', workshopId)
      .maybeSingle()

    if (guestParticipant) {
      return guestParticipant
    }
  }

  // Fallback: Supabase Auth (facilitator)
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

  return null
}
