import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas-parchment px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-normal text-ink">
            퍼실리테이터 로그인
          </h1>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-ink-muted-48">
          <Link href="/" className="underline-offset-4 hover:text-ink hover:underline">
            메인으로 돌아가기
          </Link>
        </p>
      </div>
    </main>
  )
}
