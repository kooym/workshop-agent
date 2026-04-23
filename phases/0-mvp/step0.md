# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`

## 작업

Next.js 15 프로젝트를 초기화하고 기본 개발 환경을 구성하라.

### 1. Next.js 프로젝트 생성

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

- TypeScript strict mode 활성화
- Tailwind CSS 포함
- App Router 사용
- src/ 디렉토리 사용

### 2. 추가 패키지 설치

```bash
npm install @supabase/supabase-js @supabase/ssr zustand lucide-react
npm install -D @types/node
```

- `@supabase/supabase-js`: Supabase 클라이언트
- `@supabase/ssr`: Next.js SSR용 Supabase 헬퍼
- `zustand`: 클라이언트 상태 관리
- `lucide-react`: 아이콘

### 3. 환경 변수 설정

`.env.local.example` 파일을 생성하라 (실제 값은 넣지 마라):

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AZURE_OPENAI_ENDPOINT=your-azure-openai-endpoint
AZURE_OPENAI_API_KEY=your-azure-openai-api-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

### 4. Tailwind 설정

`tailwind.config.ts`에 UI 가이드의 색상 토큰을 추가하라:

- 배경색: neutral-950(#0a0a0a), neutral-900(#171717) 등 (Tailwind 기본값 사용 가능)
- 다크모드: `darkMode: 'class'`

### 5. 디렉토리 구조 생성

ARCHITECTURE.md에 정의된 디렉토리 구조를 생성하라. 각 디렉토리에 빈 `.gitkeep` 파일을 넣어라:

```
src/
├── app/
│   ├── api/
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
│   ├── board/
│   ├── cluster/
│   ├── vote/
│   ├── derive/
│   ├── prd/
│   ├── workshop/
│   └── ui/
├── lib/
│   ├── supabase/
│   └── ai/
├── stores/
└── types/
```

### 6. Supabase 클라이언트 설정

`src/lib/supabase/client.ts` — 브라우저용 Supabase 클라이언트:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
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

### 7. 기본 레이아웃

`src/app/layout.tsx`를 수정하라:
- 다크모드 기본 (`<html className="dark">`)
- 기본 폰트: Inter 또는 Geist Sans
- 메타데이터: title "Workshop Agent"

`src/app/page.tsx`를 최소한의 랜딩 페이지로 교체하라:
- "Workshop Agent" 제목
- "워크샵 만들기" 버튼 (기능은 아직 미구현, UI만)
- "초대 코드로 참여" 입력란 (기능은 아직 미구현, UI만)

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # lint 에러 없음
npm run dev     # 개발 서버 정상 실행 (localhost:3000 접속 가능)
```

## 금지사항

- 실제 Supabase 프로젝트를 생성하거나 DB 마이그레이션을 실행하지 마라. 이 step에서는 클라이언트 설정 코드만 작성한다.
- Azure OpenAI 연동 코드를 작성하지 마라. 이 step에서는 환경 변수 예시 파일만 만든다.
- 테스트 프레임워크 설정은 이 step에서 하지 마라. 추후 별도 step에서 처리한다.
