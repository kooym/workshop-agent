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
        <h1 className="text-3xl font-semibold tracking-normal text-white">Workshop Agent</h1>
      </div>

      {!preview ? (
        <form onSubmit={handlePreview} className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <div>
            <h2 className="text-base font-semibold text-white">초대 코드로 참여</h2>
          </div>
          <div className="space-y-2">
            <label htmlFor="invite-code" className="block text-sm font-medium text-neutral-200">
              초대 코드
            </label>
            <input
              id="invite-code"
              value={inviteCode}
              onChange={(event) => handleCodeChange(event.target.value)}
              maxLength={6}
              placeholder="ABC123"
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-center font-mono text-lg tracking-normal text-white outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              required
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={isLoading || inviteCode.length !== 6}
            className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-neutral-700"
          >
            {isLoading ? '확인 중' : '확인'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoin} className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-normal text-neutral-500">
              {preview.current_stage}
            </p>
            <h2 className="text-lg font-semibold text-white">{preview.title}</h2>
            {preview.description ? (
              <p className="text-sm leading-6 text-neutral-400">{preview.description}</p>
            ) : null}
          </div>

          <div className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
            참가자 {preview.participant_count}/{preview.max_participants}
            {preview.read_only ? (
              <span className="ml-2 text-amber-300">종료됨 · 읽기 전용</span>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="display-name" className="block text-sm font-medium text-neutral-200">
              이름
            </label>
            <input
              id="display-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={50}
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="role" className="block text-sm font-medium text-neutral-200">
              역할/팀
            </label>
            <input
              id="role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              maxLength={50}
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="w-24 rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
            >
              이전
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="flex-1 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-neutral-700"
            >
              {isLoading ? '참여 중' : '참여하기'}
            </button>
          </div>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-neutral-500">
        퍼실리테이터이신가요?{' '}
        <Link href="/auth/login" className="text-neutral-300 underline-offset-4 hover:underline">
          로그인
        </Link>
      </p>
    </div>
  )
}
