import Link from 'next/link'
import { Cpu, Layers, StickyNote, Vote } from 'lucide-react'
import { JoinWorkshopForm } from '@/components/workshop/JoinWorkshopForm'

const FEATURES = [
  { icon: StickyNote, title: '아이디어 수집', desc: '포스트잇으로 pain point와 개선 아이디어를 실시간 수집' },
  { icon: Layers, title: 'AI 클러스터링', desc: 'AI가 아이디어를 자동 분류하고 핵심 주제를 도출' },
  { icon: Vote, title: '투표 & 우선순위', desc: '참여자 투표로 데이터 기반 우선순위 결정' },
  { icon: Cpu, title: 'AX 설계 & PRD', desc: 'AI가 AX 전략 대안, 과제, PRD, 보고서를 자동 생성' },
] as const

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas-parchment px-6 py-12">
      <div className="mx-auto max-w-5xl">
        {/* Hero */}
        <div className="flex flex-col items-center text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            AX Workshop
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-ink-muted-48">
            AX Engagement Business Envisioning Platform.
            현황 진단부터 AI 솔루션 설계, MVP 명세, 최종 보고까지 한 곳에서 완성하세요.
          </p>
          <div className="mt-6">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-primary hover:text-primary transition-colors"
            >
              퍼실리테이터 로그인 →
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-apple-lg border border-hairline bg-white p-5"
            >
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold text-ink">{f.title}</h3>
              <p className="mt-1.5 text-xs leading-5 text-ink-muted-48">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Join Form */}
        <div className="mx-auto mt-16 max-w-md">
          <h2 className="mb-4 text-center text-sm font-medium text-ink-muted-48">
            초대 코드로 워크샵에 참여하기
          </h2>
          <JoinWorkshopForm />
        </div>
      </div>
    </main>
  )
}
