'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

export function SignupForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-6">
      <div className="space-y-2">
        <label htmlFor="name" className="block text-sm font-medium text-neutral-200">
          이름
        </label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-neutral-200">
          이메일
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-neutral-200">
          비밀번호
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="confirm-password" className="block text-sm font-medium text-neutral-200">
          비밀번호 확인
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          required
        />
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-neutral-700"
      >
        {isSubmitting ? '가입 중' : '회원가입'}
      </button>

      <p className="text-center text-sm text-neutral-400">
        이미 계정이 있으신가요?{' '}
        <Link href="/auth/login" className="text-neutral-100 underline-offset-4 hover:underline">
          로그인
        </Link>
      </p>
    </form>
  )
}
