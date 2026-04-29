'use client'

import { ExternalLink, LogOut, Plus, Shield } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import type { Tables } from '@/lib/supabase/types'

export type DashboardProject = Tables<'projects'> & {
  workshop_count: number
  active_workshop: Tables<'workshops'> | null
  latest_workshop_updated_at: string | null
}

export function ProjectDashboard({ initialProjects, isAdmin }: { initialProjects: DashboardProject[]; isAdmin?: boolean }) {
  const router = useRouter()
  const [projects, setProjects] = useState(initialProjects)
  const [isCreating, setIsCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, description: description || null }),
    })
    const payload = await response.json()

    if (!response.ok) {
      setError(payload.error?.message ?? '프로젝트 생성에 실패했습니다.')
      return
    }

    setProjects([
      {
        ...payload.data,
        workshop_count: 0,
        active_workshop: null,
        latest_workshop_updated_at: null,
      },
      ...projects,
    ])
    setName('')
    setDescription('')
    setIsCreating(false)
    router.refresh()
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-canvas-parchment px-6 py-8 text-ink">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between border-b border-hairline pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">내 프로젝트</h1>
            <p className="mt-1 text-sm text-ink-muted-48">프로젝트별 워크샵을 관리합니다.</p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-2 text-sm text-ink hover:bg-canvas-parchment"
              >
                <Shield aria-hidden className="h-4 w-4" />
                관리자
              </Link>
            )}
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-focus"
            >
              <Plus aria-hidden className="h-4 w-4" />
              새 프로젝트
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-2 text-sm text-ink hover:bg-canvas-parchment"
            >
              <LogOut aria-hidden className="h-4 w-4" />
              로그아웃
            </button>
          </div>
        </header>

        {projects.length === 0 ? (
          <div className="rounded-apple-lg border border-hairline bg-white p-6 text-sm text-ink-muted-48">
            아직 프로젝트가 없습니다.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((project) => (
              <article key={project.id} className="rounded-apple-lg border border-hairline bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">{project.name}</h2>
                    {project.description ? (
                      <p className="mt-2 text-sm leading-6 text-ink-muted-48">{project.description}</p>
                    ) : null}
                  </div>
                  <Link
                    href={`/dashboard/project/${project.id}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-hairline px-3 py-2 text-sm text-ink hover:bg-canvas-parchment"
                  >
                    열기
                    <ExternalLink aria-hidden className="h-4 w-4" />
                  </Link>
                </div>
                <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-ink-muted-48">워크샵</dt>
                    <dd className="mt-1 text-ink">{project.workshop_count}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted-48">활성</dt>
                    <dd className="mt-1 text-ink">
                      {project.active_workshop ? project.active_workshop.current_stage : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted-48">최근 수정</dt>
                    <dd className="mt-1 text-ink">
                      {formatDate(project.latest_workshop_updated_at ?? project.updated_at)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </div>

      {isCreating ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <form onSubmit={handleCreate} className="w-full max-w-md space-y-4 rounded-apple-lg border border-hairline bg-white p-6">
            <h2 className="text-lg font-semibold">새 프로젝트 만들기</h2>
            <div className="space-y-2">
              <label htmlFor="project-name" className="block text-sm font-medium text-ink">
                프로젝트명
              </label>
              <input
                id="project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-md border border-hairline bg-canvas-parchment px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="project-description" className="block text-sm font-medium text-ink">
                설명
              </label>
              <textarea
                id="project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="w-full resize-none rounded-md border border-hairline bg-canvas-parchment px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="rounded-full border border-hairline px-3 py-2 text-sm text-ink hover:bg-canvas-parchment"
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

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
