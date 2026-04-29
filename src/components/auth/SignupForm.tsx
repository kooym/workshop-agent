'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'

export function SignupForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingApproval, setPendingApproval] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }

    if (password !== confirmPassword) {
      setError('비밀번호 확인이 일치하지 않습니다.')
      return
    }

    setIsSubmitting(true)
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    const payload = await response.json()
    setIsSubmitting(false)

    if (!response.ok) {
      setError(payload.error?.message ?? '회원가입에 실패했습니다.')
      return
    }

    // Show pending approval message instead of redirecting
    setPendingApproval(true)
  }

  if (pendingApproval) {
    return (
      <div className="space-y-4 rounded-apple-lg border border-hairline bg-white p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-ink">회원가입 완료</h2>
        <p className="text-sm text-ink-muted-48">
          관리자 승인 대기 중입니다.<br />
          승인이 완료되면 로그인할 수 있습니다.
        </p>
        <Link
          href="/auth/login"
          className="inline-block rounded-full border border-hairline px-4 py-2 text-sm text-ink hover:bg-canvas-parchment"
        >
          로그인 페이지로 이동
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-apple-lg border border-hairline bg-white p-6">
      <div className="space-y-2">
        <label htmlFor="name" className="block text-sm font-medium text-ink">
          이름
        </label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-full border border-hairline bg-canvas-parchment px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          required
        />
      </div>

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

      <div className="space-y-2">
        <label htmlFor="confirm-password" className="block text-sm font-medium text-ink">
          비밀번호 확인
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="w-full rounded-full border border-hairline bg-canvas-parchment px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          required
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-focus disabled:cursor-not-allowed disabled:bg-canvas-parchment disabled:text-ink-muted-48"
      >
        {isSubmitting ? '가입 중' : '회원가입'}
      </button>

      <p className="text-center text-sm text-ink-muted-48">
        이미 계정이 있으신가요?{' '}
        <Link href="/auth/login" className="text-ink underline-offset-4 hover:underline">
          로그인
        </Link>
      </p>
    </form>
  )
}
