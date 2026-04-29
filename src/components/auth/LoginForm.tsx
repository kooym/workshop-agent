'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingMessage, setPendingMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPendingMessage('')
    setIsSubmitting(true)

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const payload = await response.json()
    setIsSubmitting(false)

    if (!response.ok) {
      if (response.status === 403) {
        setPendingMessage(payload.error?.message ?? '관리자 승인 대기 중입니다.')
        return
      }
      setError(payload.error?.message ?? '로그인에 실패했습니다.')
      return
    }

    // Admin goes to admin dashboard, facilitator to workshop dashboard
    const role = payload.data?.user?.user_metadata?.role
    if (role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/dashboard')
    }
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-apple-lg border border-hairline bg-white p-6">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-ink">
          이메일
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-full border border-hairline bg-canvas-parchment px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-ink">
          비밀번호
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-full border border-hairline bg-canvas-parchment px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          required
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {pendingMessage ? (
        <div className="rounded-apple-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {pendingMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-canvas-parchment disabled:text-ink-muted-48"
      >
        {isSubmitting ? '로그인 중' : '로그인'}
      </button>

      <p className="text-center text-sm text-ink-muted-48">
        계정이 없으신가요?{' '}
        <Link href="/auth/signup" className="text-ink underline-offset-4 hover:underline">
          회원가입
        </Link>
      </p>
    </form>
  )
}
