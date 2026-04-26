import Link from 'next/link'
import { SignupForm } from '@/components/auth/SignupForm'

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-normal text-white">
            퍼실리테이터 회원가입
          </h1>
        </div>
        <SignupForm />
        <p className="mt-6 text-center text-sm text-neutral-500">
          <Link href="/" className="underline-offset-4 hover:text-neutral-200 hover:underline">
            메인으로 돌아가기
          </Link>
        </p>
      </div>
    </main>
  )
}
