# 프로젝트: Workshop Agent

## 기술 스택
- Next.js 15 (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- Supabase (PostgreSQL + Realtime + Auth)
- Zustand (클라이언트 상태 관리)
- Azure OpenAI GPT-4o (AI 기능)
- Vercel (배포)

## 아키텍처 규칙
- CRITICAL: AI 호출(클러스터링, 과제 도출, PRD 생성)은 반드시 API Route(서버사이드)에서만 처리할 것. 클라이언트에서 직접 Azure OpenAI를 호출하지 말 것
- CRITICAL: Azure OpenAI API 키, Supabase Service Role Key 등 시크릿을 클라이언트 코드에 절대 노출하지 말 것. 환경 변수는 NEXT_PUBLIC_ 접두사 없이 서버 전용으로 관리
- CRITICAL: 모든 API Route에서 워크샵 접근 권한을 검증할 것 (참가자 세션 + 워크샵 ID 매칭)
- Server Components 기본. 인터랙션이 필요한 곳만 'use client'
- 실시간 동기화는 Supabase Realtime(CDC) 사용. 별도 WebSocket 서버 금지
- Realtime 구독은 workshop/[id]/layout.tsx에서 한 번만 설정
- 포스트잇 CRUD는 Optimistic Update 적용 (API 응답 전 UI 즉시 반영)

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)
- 기획 변경 시 반드시 docs/ 문서를 먼저 업데이트한 후 코드를 수정할 것

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트
