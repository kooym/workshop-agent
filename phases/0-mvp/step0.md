# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/docs/SPEC_AUDIT.md`
- `/docs/MODULE_MAP.md`
- `/docs/FOUNDATION_ASSESSMENT.md`
- `/docs/modules/00-platform-foundation.md`
- `/docs/modules/09-quality-operations.md`

## 작업

Next.js 15 프로젝트를 초기화하고 기본 개발 환경을 구성하라.

### 1. Next.js 프로젝트 생성

```bash
npx create-next-app@15 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

- `@latest`를 사용하지 마라. 목표 스택은 Next.js 15이므로 major version drift를 방지해야 한다.
- 생성 후 `package.json`의 `next` major version이 15인지 확인한다.
- Node.js 기준은 20 LTS로 둔다. `.nvmrc`와 `package.json.engines.node`에 반영한다.
- TypeScript strict mode 활성화
- Tailwind CSS 포함
- App Router 사용
- src/ 디렉토리 사용

### 2. 추가 패키지 설치

```bash
npm install @supabase/supabase-js @supabase/ssr zustand lucide-react zod react-markdown sonner
npm install tldraw yjs y-supabase
npm install -D @types/node vitest @testing-library/react @testing-library/user-event @vitejs/plugin-react jsdom
```

- `@supabase/supabase-js`: Supabase 클라이언트
- `@supabase/ssr`: Next.js SSR용 Supabase 헬퍼
- `zustand`: 클라이언트 상태 관리
- `lucide-react`: 아이콘
- `zod`: API 요청/응답 검증 (ADR-008)
- `react-markdown`: PRD Markdown 렌더링 (Step 8에서 사용)
- `sonner`: Toast 알림 컴포넌트 (Step 9에서 사용)
- `tldraw`, `yjs`, `y-supabase`: Gather 단계 화이트보드 + CRDT 동기화 (Step 4에서 사용)
- `vitest` + `@testing-library/*`: 테스트 프레임워크 (ADR-010)

호환성 확인:
- tldraw는 공식 `tldraw` 패키지를 사용한다.
- `y-supabase`는 안정성 리스크가 있으므로 Step 4에서 provider adapter 뒤에 격리한다.
- `package-lock.json`은 반드시 커밋 대상이다.

### 3. 환경 변수 설정

`.env.local.example` 파일을 생성하라 (실제 값은 넣지 마라):

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
# 선택: 새 Supabase publishable key 프로젝트를 위한 alias. MVP 기본값은 ANON_KEY.
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SESSION_SECRET=replace-with-random-string-at-least-32-characters
AZURE_OPENAI_ENDPOINT=your-azure-openai-endpoint
AZURE_OPENAI_API_KEY=your-azure-openai-api-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

`src/lib/env.ts`를 생성하여 Zod로 환경 변수를 검증하라:
- 서버 전용 필수값: `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`
- 공개 필수값: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 선택 공개 alias: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SESSION_SECRET`는 32자 이상이어야 한다.
- 서버 전용 모듈은 `process.env`를 직접 참조하지 말고 `src/lib/env.ts`를 import한다.
- 클라이언트 컴포넌트에는 서버 전용 secret이 포함된 객체를 import하지 말고 공개 env만 사용한다.
- browser Supabase key는 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? NEXT_PUBLIC_SUPABASE_ANON_KEY` 순서로 선택할 수 있게 설계하되, MVP 문서와 예시는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 기본값으로 유지한다.
- `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `AZURE_OPENAI_API_KEY`에는 `NEXT_PUBLIC_` 접두사를 절대 붙이지 않는다.

### 4. 테스트 설정

TDD 규칙을 지킬 수 있도록 이 step에서 Vitest 기본 설정을 완료하라:
- `vitest.config.ts` 생성
- Testing Library용 setup 파일 생성
- `package.json` scripts에 `test`, `test:watch`, `test:coverage`, `typecheck` 추가
- 아직 테스트 파일이 없어도 `npm run test`가 실패하지 않도록 설정한다.
- `npm ci`가 동작하도록 lockfile을 유지한다.

### 5. Next/Docker/Foundation 빌드 기준

`next.config.ts`에 standalone output을 설정하라:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
```

Docker/App Service 기준 파일을 준비하라:

- `Dockerfile`
- `.dockerignore`
- `src/app/api/health/route.ts`

Dockerfile 요구:
- multi-stage build: deps -> builder -> runner
- Node 20 계열 base image 사용
- package 설치는 `npm ci` 사용
- runner stage에는 `.next/standalone`, `.next/static`, `public`을 포함
- 실행 command는 `node server.js`
- `HOSTNAME=0.0.0.0`, `PORT=3000`
- `EXPOSE 3000`
- 가능하면 non-root user로 실행

`.dockerignore` 요구:

```
node_modules
.next
.env
.env.*
coverage
.git
npm-debug.log*
```

`GET /api/health` 요구:
- 외부 서비스(DB/OpenAI)를 호출하지 않는 liveness endpoint
- 응답 형식: `{ data: { status: 'ok', time: string } }`
- status code 200

### 6. Tailwind 설정

`tailwind.config.ts`에 UI 가이드의 색상 토큰을 추가하라:

- 배경색: neutral-950(#0a0a0a), neutral-900(#171717) 등 (Tailwind 기본값 사용 가능)
- 다크모드: `darkMode: 'class'`

### 7. 디렉토리 구조 생성

ARCHITECTURE.md에 정의된 디렉토리 구조를 생성하라. 각 디렉토리에 빈 `.gitkeep` 파일을 넣어라:

```
src/
├── app/
│   ├── auth/
│   │   ├── login/
│   │   └── signup/
│   ├── dashboard/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── signup/
│   │   │   ├── login/
│   │   │   └── logout/
│   │   ├── health/
│   │   ├── projects/
│   │   ├── workshops/
│   │   ├── notes/
│   │   ├── clusters/
│   │   ├── votes/
│   │   ├── tasks/
│   │   ├── prd/
│   │   └── ai/
│   │       ├── cluster/
│   │       ├── derive/
│   │       └── generate/
│   └── workshop/
│       └── [id]/
├── components/
│   ├── auth/
│   ├── dashboard/
│   ├── board/
│   ├── cluster/
│   ├── vote/
│   ├── derive/
│   ├── prd/
│   ├── workshop/
│   └── ui/
├── lib/
│   ├── supabase/
│   ├── ai/
│   └── api/
├── stores/
└── types/
```

### 8. Supabase 클라이언트와 세션 refresh proxy 설정

`src/lib/supabase/client.ts` — 브라우저용 Supabase 클라이언트:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

`src/lib/supabase/server.ts` — 서버용 Supabase 클라이언트:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
// cookies()를 사용하여 서버 컴포넌트/API Route에서 인증 상태 유지
```

`src/lib/supabase/proxy.ts` — Supabase Auth session refresh utility:
- `createServerClient`를 사용해 request/response cookie를 갱신한다.
- facilitator 보호 로직은 이후 step에서 `supabase.auth.getClaims()` 또는 `supabase.auth.getUser()`로 재검증한다.
- 서버 보호 로직에서 `supabase.auth.getSession()`만으로 권한을 판단하지 않도록 주석과 테스트 TODO를 남긴다.

루트 `proxy.ts`:
- `updateSession(request)`를 호출한다.
- matcher는 `_next/static`, `_next/image`, favicon, 정적 이미지 파일을 제외한다.
- API route는 기본적으로 matcher 범위에 포함한다. 추후 성능상 좁히더라도 withFacilitator가 자체 재검증을 수행해야 한다.

주의:
- 이 proxy는 퍼실리테이터 Supabase Auth 세션 refresh용이다.
- 참석자 guest session은 Step 2의 signed cookie로 별도 구현한다.
- 두 세션 모델을 하나의 쿠키나 하나의 secret으로 합치지 않는다.

### 9. 기본 레이아웃

`src/app/layout.tsx`를 수정하라:
- 다크모드 기본 (`<html className="dark">`)
- 기본 폰트: Inter 또는 Geist Sans
- 메타데이터: title "Workshop Agent"
- `<Toaster />`는 Step 9에서 root layout에 한 번만 추가한다. 이 step에서 추가한다면 중복 mount가 생기지 않게 이후 step에서 확인한다.

`src/app/page.tsx`를 최소한의 랜딩 페이지로 교체하라:
- "Workshop Agent" 제목
- "초대 코드로 참여" 입력란 + 이름 입력 (기능은 아직 미구현, UI만)
- "퍼실리테이터이신가요? 로그인" 링크 (하단에 작게)

### 10. Secret leak audit 기준 추가

릴리즈 전 자동화는 아직 없더라도, 이 step에서 다음 기준을 문서/테스트 TODO로 남겨라:

- 실제 `.env*` 파일은 git tracked 대상이 아니어야 한다.
- `.dockerignore`에 `.env*`가 포함되어야 한다.
- client component에서 `src/lib/env.ts`의 server env export를 import하면 안 된다.
- `process.env` 직접 접근은 `src/lib/env.ts`, `next.config.ts`, test setup 같은 허용 파일로 제한한다.

## Acceptance Criteria

```bash
npm run lint    # lint 에러 없음
npm run typecheck # TypeScript 타입 검사 통과
npm run test    # 테스트 러너 실행 가능
npm run build   # 컴파일 에러 없음
docker build -t workshop-agent . # Foundation Docker baseline 빌드 성공
```

- `npm run dev`로 개발 서버가 정상 실행되는지 확인하라 (localhost:3000 접속 가능).
- `node --version`이 Foundation 기준(Node 20 LTS)과 일치하는지 확인하라.
- `npm ls next react react-dom tldraw @supabase/ssr`로 핵심 패키지 설치 상태를 확인하라.
- `GET /api/health`가 `{ data: { status: 'ok', time } }` 형태로 200을 반환하는지 확인하라.
- `rg "SUPABASE_SERVICE_ROLE_KEY|AZURE_OPENAI_API_KEY|SESSION_SECRET" src/app src/components` 결과가 client 노출 위험을 만들지 않는지 확인하라.

## 금지사항

- 실제 Supabase 프로젝트를 생성하거나 DB 마이그레이션을 실행하지 마라. 이 step에서는 Supabase 관련 클라이언트/proxy 설정 코드만 작성한다.
- Azure OpenAI 연동 코드를 작성하지 마라. 이 step에서는 환경 변수 예시 파일만 만든다.
- 실제 secret 값을 `.env.local.example`에 넣지 마라.
- `create-next-app@latest`로 생성하지 마라.
- `@tldraw/tldraw` 패키지를 설치하지 마라.
