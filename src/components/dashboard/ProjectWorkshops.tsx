'use client'

import { ArrowLeft, ExternalLink, Plus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import type { Tables } from '@/lib/supabase/types'
import { DEFAULT_WORKSHOP_SETTINGS } from '@/types/workshop'

export function ProjectWorkshops({
  project,
  initialWorkshops,
}: {
  project: Tables<'projects'>
  initialWorkshops: Tables<'workshops'>[]
}) {
  const router = useRouter()
  const [workshops, setWorkshops] = useState(initialWorkshops)
  const [isCreating, setIsCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [maxParticipants, setMaxParticipants] = useState(DEFAULT_WORKSHOP_SETTINGS.max_participants)
  const [votesPerPerson, setVotesPerPerson] = useState(DEFAULT_WORKSHOP_SETTINGS.votes_per_person)
  const [voteMode, setVoteMode] = useState(DEFAULT_WORKSHOP_SETTINGS.vote_mode)
  const [error, setError] = useState('')

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const response = await fetch('/api/workshops', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        project_id: project.id,
        title,
        description: description || null,
        settings: {
          max_participants: maxParticipants,
          votes_per_person: votesPerPerson,
          vote_mode: voteMode,
        },
      }),
    })
    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error?.message ?? '워크샵 생성에 실패했습니다.')
      return
    }

    setWorkshops([payload.data.workshop, ...workshops])
    setTitle('')
    setDescription('')
    setIsCreating(false)
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-canvas-parchment px-6 py-8 text-ink">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 border-b border-hairline pb-4">
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-2 text-sm text-ink-muted-48 hover:text-ink"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            프로젝트 목록
          </Link>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">{project.name}</h1>
              {project.description ? (
                <p className="mt-1 text-sm text-ink-muted-48">{project.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-focus"
            >
              <Plus aria-hidden className="h-4 w-4" />
              새 워크샵
            </button>
          </div>
        </header>

        {workshops.length === 0 ? (
          <div className="rounded-apple-lg border border-hairline bg-white p-6 text-sm text-ink-muted-48">
            아직 워크샵이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {workshops.map((workshop) => (
              <article key={workshop.id} className="rounded-apple-lg border border-hairline bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{workshop.title}</h2>
                    {workshop.description ? (
                      <p className="mt-2 text-sm leading-6 text-ink-muted-48">{workshop.description}</p>
                    ) : null}
                  </div>
                  <Link
                    href={`/workshop/${workshop.id}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-hairline px-3 py-2 text-sm hover:bg-canvas-parchment"
                  >
                    열기
                    <ExternalLink aria-hidden className="h-4 w-4" />
                  </Link>
                </div>
                <dl className="mt-5 grid gap-2 text-sm md:grid-cols-4">
                  <div>
                    <dt className="text-ink-muted-48">단계</dt>
                    <dd className="mt-1 text-ink">{workshop.current_stage}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted-48">초대 코드</dt>
                    <dd className="mt-1 font-mono text-ink">{workshop.invite_code}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted-48">상태</dt>
                    <dd className="mt-1 text-ink">
                      {workshop.current_stage === 'completed' ? '완료' : '진행 중'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted-48">수정</dt>
                    <dd className="mt-1 text-ink">{formatDate(workshop.updated_at)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </div>

      {isCreating ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <form onSubmit={handleCreate} className="w-full max-w-lg space-y-4 rounded-apple-lg border border-hairline bg-white p-6">
            <h2 className="text-lg font-semibold">새 워크샵 만들기</h2>
            <div className="space-y-2">
              <label htmlFor="workshop-title" className="block text-sm font-medium text-ink">
                워크샵 제목
              </label>
              <input
                id="workshop-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-md border border-hairline bg-canvas-parchment px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="workshop-description" className="block text-sm font-medium text-ink">
                목적
              </label>
              <textarea
                id="workshop-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="w-full resize-none rounded-md border border-hairline bg-canvas-parchment px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-2 text-sm">
                <span className="block font-medium text-ink">정원</span>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={maxParticipants}
                  onChange={(event) => setMaxParticipants(Number(event.target.value))}
                  className="w-full rounded-md border border-hairline bg-canvas-parchment px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="block font-medium text-ink">투표 수</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={votesPerPerson}
                  onChange={(event) => setVotesPerPerson(Number(event.target.value))}
                  className="w-full rounded-md border border-hairline bg-canvas-parchment px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="block font-medium text-ink">투표 대상</span>
                <select
                  value={voteMode}
                  onChange={(event) => setVoteMode(event.target.value as 'cluster' | 'note')}
                  className="w-full rounded-md border border-hairline bg-canvas-parchment px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="cluster">클러스터</option>
                  <option value="note">포스트잇</option>
                </select>
              </label>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="rounded-full border border-hairline px-3 py-2 text-sm hover:bg-canvas-parchment"
              >
                취소
              </button>
              <button type="submit" className="rounded-full bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-focus">
                만들기
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
