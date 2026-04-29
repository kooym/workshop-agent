'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

type Preview = {
  id: string
  title: string
  description: string | null
  current_stage: string
  participant_count: number
  max_participants: number
  read_only: boolean
}

type JoinResponse = {
  workshop: {
    id: string
  }
  readOnly: boolean
}

export function JoinWorkshopForm() {
  const router = useRouter()
  const [inviteCode, setInviteCode] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    const response = await fetch(`/api/workshops/preview?invite_code=${inviteCode}`)
    const payload = await response.json()
    setIsLoading(false)

    if (!response.ok) {
      setError(payload.error?.message ?? '초대 코드를 확인해주세요.')
      return
    }

    setPreview(payload.data)
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    const response = await fetch('/api/workshops/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invite_code: inviteCode, name, role: role || undefined }),
    })
    const payload = await response.json()
    setIsLoading(false)

    if (!response.ok) {
      setError(payload.error?.message ?? '워크샵 참여에 실패했습니다.')
      return
    }

    const data = payload.data as JoinResponse
    router.push(`/workshop/${data.workshop.id}`)
    router.refresh()
  }

  function handleCodeChange(value: string) {
    setInviteCode(value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6))
    setPreview(null)
    setError('')
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-normal text-ink">Workshop Agent</h1>
      </div>

      {!preview ? (
        <form onSubmit={handlePreview} className="space-y-4 rounded-apple-lg border border-hairline bg-white p-6">
          <div>
            <h2 className="text-base font-semibold text-ink">초대 코드로 참여</h2>
          </div>
          <div className="space-y-2">
            <label htmlFor="invite-code" className="block text-sm font-medium text-ink">
              초대 코드
            </label>
            <input
              id="invite-code"
              value={inviteCode}
              onChange={(event) => handleCodeChange(event.target.value)}
              maxLength={6}
              placeholder="ABC123"
              className="w-full rounded-md border border-hairline bg-canvas-parchment px-3 py-2 text-center font-mono text-lg tracking-normal text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={isLoading || inviteCode.length !== 6}
            className="w-full rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-neutral-200"
          >
            {isLoading ? '확인 중' : '확인'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoin} className="space-y-4 rounded-apple-lg border border-hairline bg-white p-6">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-normal text-ink-muted-48">
              {preview.current_stage}
            </p>
            <h2 className="text-lg font-semibold text-ink">{preview.title}</h2>
            {preview.description ? (
              <p className="text-sm leading-6 text-ink-muted-48">{preview.description}</p>
            ) : null}
          </div>

          <div className="rounded-md border border-hairline bg-canvas-parchment px-3 py-2 text-sm text-ink-muted-80">
            참가자 {preview.participant_count}/{preview.max_participants}
            {preview.read_only ? (
              <span className="ml-2 text-amber-600">종료됨 · 읽기 전용</span>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="display-name" className="block text-sm font-medium text-ink">
              이름
            </label>
            <input
              id="display-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={50}
              className="w-full rounded-md border border-hairline bg-canvas-parchment px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="role" className="block text-sm font-medium text-ink">
              역할/팀
            </label>
            <input
              id="role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              maxLength={50}
              className="w-full rounded-md border border-hairline bg-canvas-parchment px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="w-24 rounded-full border border-hairline px-4 py-2 text-sm text-ink hover:bg-canvas-parchment"
            >
              이전
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="flex-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-neutral-200"
            >
              {isLoading ? '참여 중' : '참여하기'}
            </button>
          </div>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink-muted-48">
        퍼실리테이터이신가요?{' '}
        <Link href="/auth/login" className="text-ink-muted-80 underline-offset-4 hover:underline">
          로그인
        </Link>
      </p>
    </div>
  )
}
