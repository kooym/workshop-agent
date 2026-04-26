# Step 2: auth-invite

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — API 설계 섹션 (인증 API, 워크샵 API, 미들웨어 패턴)
- `/docs/ADR.md` — ADR-004 (이중 인증 모델), ADR-009 (참석자 쿠키 세션)
- `/docs/PRD.md` — 사용자 섹션 (퍼실리테이터 vs 참석자), F1(워크샵 생성), F1.1(퍼실리테이터 인증), F2(초대 코드 접속)
- `/docs/UI_GUIDE.md` — 랜딩 페이지, 로그인/회원가입, 대시보드 레이아웃
- `/docs/SPEC_AUDIT.md` — 프로젝트 계층, signed cookie, RLS 경계 결정
- `/docs/MODULE_MAP.md`
- `/docs/FOUNDATION_ASSESSMENT.md` — Supabase SSR proxy/session refresh, server auth verification 기준
- `/docs/modules/00-platform-foundation.md`
- `/docs/modules/01-identity-access.md`
- `/docs/modules/02-project-workshop-lifecycle.md`
- `/docs/modules/08-ui-experience-system.md`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라:

- `/src/lib/supabase/client.ts`
- `/src/lib/supabase/server.ts`
- `/src/lib/supabase/proxy.ts`
- `/proxy.ts`
- `/src/lib/env.ts`
- `/src/lib/supabase/types.ts`
- `/src/types/workshop.ts`
- `/src/types/project.ts`
- `/src/types/*.ts` (모든 타입 파일)

## 작업

퍼실리테이터 인증(Supabase Auth) + 프로젝트 CRUD + 워크샵 생성 + 참석자 초대 코드 참여 흐름을 구현하라.

이 step은 새 기능 구현이므로 테스트를 먼저 작성한다. Supabase는 `vi.mock()`으로 모킹하고, API 응답 형식과 미들웨어 권한 분기를 우선 검증한 뒤 구현하라.

Foundation 전제:
- Step 0의 Supabase browser/server/proxy 분리를 유지한다.
- facilitator 서버 권한 검증은 cookie 값을 직접 신뢰하지 않고 Supabase Auth `getClaims()` 또는 `getUser()`로 재검증한다.
- 서버 보호 로직에서 `getSession()`만 호출하고 권한을 확정하는 구현은 금지한다.
- guest signed cookie는 Supabase Auth 세션과 별개이며, `SESSION_SECRET`으로만 서명한다.

### 1. 퍼실리테이터 회원가입/로그인 API

**회원가입** — `src/app/api/auth/signup/route.ts`:
- **Rate Limiting**: IP 기반 10회/분 제한. 초과 시 429 응답.
- 요청 body를 Zod로 검증 (이메일, 비밀번호(8자 이상), 이름)
- Supabase Auth `signUp`으로 사용자 생성
- 응답: `{ data: { user } }`

**로그인** — `src/app/api/auth/login/route.ts`:
- **Rate Limiting**: IP 기반 10회/분 제한. 초과 시 429 응답.
- 요청 body를 Zod로 검증 (이메일, 비밀번호)
- Supabase Auth `signInWithPassword`
- 응답: `{ data: { user, session } }`

**로그아웃** — `src/app/api/auth/logout/route.ts`:
- Supabase Auth `signOut`
- 응답: `{ data: { success: true } }`

### 2. 퍼실리테이터 로그인/회원가입 UI

`src/app/auth/login/page.tsx` — 로그인 페이지:
- UI_GUIDE.md의 로그인 레이아웃 참조
- 이메일 + 비밀번호 입력 → 로그인 → `/dashboard`로 리다이렉트
- 에러: 인라인 표시 (text-red-400)
- "계정이 없으신가요? 회원가입" 링크

`src/app/auth/signup/page.tsx` — 회원가입 페이지:
- UI_GUIDE.md의 회원가입 레이아웃 참조
- 이름 + 이메일 + 비밀번호 + 비밀번호 확인 → 회원가입 → `/dashboard`로 리다이렉트
- 비밀번호 최소 8자, 확인 일치 클라이언트 검증

`src/components/auth/LoginForm.tsx` — 로그인 폼 컴포넌트
`src/components/auth/SignupForm.tsx` — 회원가입 폼 컴포넌트

### 3. 프로젝트 API

`src/app/api/projects/route.ts`:
- **POST** — 프로젝트 생성 (withFacilitator). body: `{ name, description? }`
- **GET** — 로그인한 퍼실리테이터의 프로젝트 목록 조회

`src/app/api/projects/[id]/route.ts`:
- **PATCH** — 프로젝트 수정 (withFacilitator + facilitator_id 소유권 확인)
- **DELETE** — 소속 워크샵이 없을 때만 삭제. 워크샵이 있으면 409 반환

모든 body는 Zod 스키마로 검증하고, 응답은 표준 `{ data }` / `{ error }` 형식을 따른다.

### 4. 퍼실리테이터 대시보드

`src/app/dashboard/page.tsx` — 대시보드 페이지:
- AuthGuard로 보호 (미로그인 시 `/auth/login`으로 리다이렉트)
- 퍼실리테이터가 생성한 프로젝트 목록 조회
- 프로젝트별 워크샵 수, 활성 워크샵, 최근 수정 시각 표시
- "새 프로젝트 만들기" 버튼 → 프로젝트 생성 모달
- 프로젝트 카드의 "열기" 버튼 → `/dashboard/project/[projectId]`

`src/app/dashboard/project/[projectId]/page.tsx` — 프로젝트 내 워크샵 목록:
- AuthGuard로 보호
- 해당 프로젝트의 워크샵 목록 조회
- "새 워크샵 만들기" 버튼 → 워크샵 생성 모달
- 프로젝트당 completed가 아닌 활성 워크샵이 이미 있으면 새 워크샵 생성 시 409 메시지를 인라인/Toast로 표시

`src/components/auth/AuthGuard.tsx` — 인증 보호 컴포넌트:
- Supabase Auth 세션 확인
- 미인증 시 `/auth/login`으로 리다이렉트
- client-side guard는 UX용으로만 사용한다. 실제 접근 제어는 Server Component/API Route의 server auth 검증과 `withFacilitator`에서 수행한다.

### 5. 초대 코드 생성 유틸리티

`src/lib/utils.ts`에 6자리 영숫자 초대 코드 생성 함수를 작성하라:

```typescript
export function generateInviteCode(): string
// 6자리, 대문자 + 숫자, 혼동 문자(0/O, 1/I/L) 제외
```

### 6. API 공통 모듈

API Route에서 반복 사용되는 공통 모듈을 먼저 생성하라:

`src/lib/api/response.ts` — API 응답 헬퍼:
```typescript
export function success<T>(data: T, status = 200): NextResponse
export function error(code: string, message: string, status: number): NextResponse
```

`src/lib/api/rate-limit.ts` — IP 기반 Rate Limiter (인메모리):
```typescript
// 슬라이딩 윈도우 카운터. windowMs 기간 내 maxRequests 초과 시 429 반환.
// 연속 실패 임계치(maxFailures) 초과 시 blockDurationMs 동안 차단.
export function createRateLimiter(options: {
  windowMs: number;      // 기본 60_000 (1분)
  maxRequests: number;   // 기본 10
  maxFailures?: number;  // 기본 5 (연속 실패 차단 기준)
  blockDurationMs?: number; // 기본 60_000
}): (ip: string, failed?: boolean) => { allowed: boolean; retryAfterMs?: number }
```
- 인메모리 Map으로 관리 (MVP). 단일 인스턴스 배포 전제.
- 적용 대상: POST /api/auth/signup, POST /api/auth/login, POST /api/workshops/join

**IP 추출 방식**:
```typescript
function getClientIp(req: NextRequest): string {
  // Azure App Service / reverse proxy 환경: x-forwarded-for 헤더에서 첫 번째 IP 추출
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()  // 첫 번째 = 실제 클라이언트 IP
  }
  // 로컬 개발 (프록시 없음): x-real-ip 또는 소켓 주소
  return req.headers.get('x-real-ip') ?? req.ip ?? '127.0.0.1'
}
```
- Azure App Service는 `x-forwarded-for`에 `client, proxy1, proxy2` 형식으로 전달. 첫 번째 IP가 실제 클라이언트
- `x-forwarded-for` 스푸핑 방지: Azure App Service가 원본 IP를 강제 주입하므로 별도 방어 불필요 (신뢰 프록시)
- 로컬 개발 시 `127.0.0.1` 폴백으로 동작 보장

`src/lib/api/middleware.ts` — 공통 미들웨어:
```typescript
// 참석자 쿠키 세션 또는 퍼실리테이터 Supabase Auth 세션 모두 검증
export async function withAuth(req, handler): Promise<NextResponse>

// Supabase Auth 세션만 검증 + is_facilitator 확인
export async function withFacilitator(req, handler): Promise<NextResponse>
```

미들웨어 계약:
- `withFacilitator`는 Supabase Auth user를 `getClaims()` 또는 `getUser()`로 검증한다.
- 검증된 user id와 `workshops.facilitator_id` 또는 `participants.user_id/is_facilitator`를 대조한다.
- `withAuth`는 참석자 signed cookie와 facilitator Supabase Auth를 모두 허용하되, 해당 `workshop_id`의 `participants` row 존재까지 확인한다.
- signed cookie 검증 실패, participant row 없음, workshop 불일치는 모두 401 또는 403으로 처리한다.
- Supabase service role key는 이 미들웨어와 server-only API에서만 사용하고 client import 경로로 흐르지 않게 한다.

`src/lib/api/validators.ts` — Zod 스키마:
```typescript
export const signupSchema = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(100),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const createWorkshopSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  settings: z.object({
    anonymous: z.boolean().optional(),
    votes_per_person: z.number().int().min(1).max(10).optional(),
    max_participants: z.number().int().min(2).max(20).optional(),
    results_visible: z.boolean().optional(),
    vote_mode: z.enum(['cluster', 'note']).optional(),
    timer_minutes: z.number().int().min(1).max(60).nullable().optional(),
  }).optional(),
})

export const joinWorkshopSchema = z.object({
  invite_code: z.string().length(6),
  name: z.string().min(1).max(50),
  role: z.string().max(50).optional(),
})
```

### 7. API Route: 워크샵 생성

`src/app/api/workshops/route.ts` — POST 핸들러 (withFacilitator):

- 요청 body를 `createWorkshopSchema`로 검증. 실패 시 400 + 표준 에러 응답
- `project_id`가 요청자 소유 프로젝트인지 검증. 아니면 403/404 반환
- 같은 프로젝트에 `current_stage <> 'completed'`인 워크샵이 이미 있으면 409 CONFLICT 반환
- 초대 코드 자동 생성 (generateInviteCode). 충돌 시 재시도 (최대 3회)
- workshops 테이블에 INSERT (project_id, facilitator_id = auth.user.id, settings 기본값 병합, current_stage='context')
- participants 테이블에 퍼실리테이터 INSERT (is_facilitator: true, user_id = auth.user.id)
- 응답: `{ data: { workshop, participant } }`

GET 핸들러 (withFacilitator):
- `project_id` query를 Zod로 검증
- 퍼실리테이터 소유 프로젝트의 워크샵 목록 조회
- 응답: `{ data: workshops[] }`

### 8. API Route: 워크샵 미리보기

`src/app/api/workshops/preview/route.ts` — GET `?invite_code=:code` 핸들러:

- invite_code로 workshops 조회. 존재하지 않으면 404 응답
- 인증 불필요 (코드 입력 후 참여 전 미리보기 용도)
- 응답: `{ data: { title, description, current_stage, participant_count, max_participants } }`
- 민감 정보(facilitator_id, settings 전체 등)는 포함하지 않는다

### 9. API Route: 초대 코드 참여

`src/app/api/workshops/join/route.ts` — POST 핸들러:

- **Rate Limiting**: IP 기반 10회/분 제한. 연속 5회 실패(404/409) 시 60초 차단. 초과 시 429 응답.
- 요청 body를 `joinWorkshopSchema`로 검증
- invite_code로 workshops 조회. 존재하지 않으면 404 응답
- completed 워크샵이면 신규 참석자도 읽기 전용 participant로 생성하되, 응답에 readOnly 상태를 포함한다.
- 현재 참가자 수가 max_participants(기본 20)에 도달했으면 409 응답 ("워크샵이 가득 찼습니다")
- **참가자 초과 방지 (동시성 안전)**: `SELECT COUNT(*) FROM participants WHERE workshop_id = :id FOR UPDATE` 트랜잭션으로 동시 JOIN 요청 시에도 max_participants 초과를 방지한다
- participants 테이블에 INSERT (is_facilitator: false, user_id: null)
- 세션 쿠키 설정 (setSession)
- 응답: `{ data: { workshop, participant } }`

### 9. 참석자 세션 관리

참석자(게스트)는 HTTP-only 쿠키 기반 세션을 사용하라 (ADR-009 참조):

- 워크샵 참여 시 participant_id와 workshop_id를 HTTP-only 쿠키에 저장
- 쿠키 값은 반드시 `SESSION_SECRET`으로 HMAC 서명한다. 평문 JSON/base64만 저장하지 마라.
- 쿠키 서명 포맷: `v1:{payload}.{signature}` — payload = `base64url(workshop_id:participant_id)`, signature = `HMAC-SHA256(payload, SESSION_SECRET)` hex. `v1:` 접두사로 키 로테이션 시 구버전 검증 폴백 지원.
- `SUPABASE_SERVICE_ROLE_KEY`를 세션 서명 시크릿으로 재사용하지 마라.
- 쿠키 설정: `HttpOnly: true`, `Secure: true` (프로덕션), `SameSite: Lax`, `maxAge: 86400` (24시간)
- 브라우저 새로고침 시 쿠키가 유지되어 세션 자동 복구
- `src/lib/session.ts`에 세션 읽기/쓰기 헬퍼 함수:

```typescript
export async function setSession(workshopId: string, participantId: string): Promise<void>
export async function getSession(): Promise<{ workshopId: string, participantId: string } | null>
export async function clearSession(): Promise<void>
```

**쿠키 서명 구현 상세** (Node.js `crypto` 모듈 사용):

```typescript
import { createHmac } from 'crypto'

// --- 서명 생성 ---
function signSession(workshopId: string, participantId: string): string {
  const payload = Buffer.from(`${workshopId}:${participantId}`)
    .toString('base64url')  // base64url (NOT base64)
  const signature = createHmac('sha256', env.SESSION_SECRET)
    .update(payload)
    .digest('hex')  // hex 인코딩
  return `v1:${payload}.${signature}`  // v1: 접두사
}

// --- 서명 검증 ---
function verifySession(cookieValue: string): { workshopId: string, participantId: string } | null {
  if (!cookieValue.startsWith('v1:')) return null  // 버전 체크
  const body = cookieValue.slice(3)  // 'v1:' 제거
  const dotIndex = body.lastIndexOf('.')
  if (dotIndex === -1) return null
  const payload = body.slice(0, dotIndex)
  const signature = body.slice(dotIndex + 1)
  // 타이밍 공격 방지: timingSafeEqual 사용
  const expected = createHmac('sha256', env.SESSION_SECRET)
    .update(payload)
    .digest('hex')
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  // payload 디코딩
  const decoded = Buffer.from(payload, 'base64url').toString()
  const [workshopId, participantId] = decoded.split(':')
  if (!workshopId || !participantId) return null
  return { workshopId, participantId }
}
```

- `setSession()`: `signSession()`으로 쿠키 값 생성 후 `cookies().set()` 호출
- `getSession()`: 쿠키에서 값을 읽고 `verifySession()`으로 검증. 실패 시 null 반환
- 쿠키 옵션: `{ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 86400, path: '/' }`
- `Secure` 플래그: 프로덕션에서만 true (localhost 개발 지원)
- 키 로테이션: MVP에서는 v1만 지원. Post-MVP에서 v2 도입 시 `v1:` 폴백 검증 유지

서명 검증 실패, 만료, participant/workshop 불일치 시 `getSession()`은 null을 반환해야 한다.

테스트:
- 정상 signed cookie는 `getSession()`이 workshop/participant id를 반환한다.
- 위변조된 cookie는 null을 반환한다.
- `SUPABASE_SERVICE_ROLE_KEY`를 서명 secret으로 쓰지 않는지 확인한다.
- Supabase Auth cookie와 guest cookie가 동시에 있을 때 `withAuth`의 우선순위와 반환 context가 명확해야 한다.
- facilitator-only route는 guest cookie만으로 접근할 수 없다.

### 10. 랜딩 페이지 UI (2단계 참여 플로우)

`src/app/page.tsx`를 UI 가이드의 랜딩 페이지 레이아웃에 맞게 구현하라:

**Step 1 — 코드 입력**:
- "Workshop Agent" 제목
- "초대 코드로 참여" — 6자리 코드 입력 + "확인" 버튼
- 하단에 "퍼실리테이터이신가요? 로그인" 링크 → `/auth/login`으로 이동

**Step 2 — 워크샵 미리보기 + 이름 입력**:
- GET /api/workshops/preview로 워크샵 정보 조회
- 워크샵 제목, 목적(description), 현재 단계, 참가자 수/정원 표시
- 이름 입력 필드 + "참여하기" 버튼
- 워크샵 참여 성공 시 `/workshop/[id]`로 리다이렉트
- completed 워크샵이면 "이미 종료된 워크샵입니다 (읽기 전용)" 안내 표시

### 11. 워크샵 메인 페이지 레이아웃

`src/app/workshop/[id]/layout.tsx` — 기본 레이아웃:

- 세션 검증: 퍼실리테이터(Supabase Auth) 또는 참석자(쿠키)로 해당 워크샵 참가자인지 확인. 아니면 랜딩으로 리다이렉트
- 워크샵 데이터 서버 컴포넌트에서 fetch
- 사이드바 + 메인 캔버스 레이아웃 골격만 잡기

`src/app/workshop/[id]/page.tsx` — 현재 stage에 따라 적절한 뷰를 표시 (이 step에서는 stage 텍스트만 표시)

## Acceptance Criteria

```bash
npm run lint    # lint 에러 없음
npm run typecheck # 타입 검사 통과
npm run test    # 테스트 통과
npm run build   # 컴파일 에러 없음
```

- 퍼실리테이터가 회원가입 → 로그인 → 프로젝트 대시보드 접근이 가능한지 확인
- 로그인된 퍼실리테이터가 프로젝트를 만들고, 해당 프로젝트 아래에서 POST /api/workshops로 워크샵을 생성하고 초대 코드를 반환하는지 확인
- 같은 프로젝트에 활성 워크샵을 2개 만들려고 하면 409가 반환되는지 확인
- 미로그인 상태에서 워크샵 생성 시 403 응답이 오는지 확인
- POST /api/workshops/join이 유효한 코드로 참여할 수 있는지 확인
- 잘못된 초대 코드로 참여 시 적절한 에러 응답이 오는지 확인
- 참석자 쿠키 세션이 서명되어 있고, 위변조 시 거부되며, 새로고침 시 유지되는지 확인

## 금지사항

- 참석자에게 Supabase Auth(signUp/signIn)를 사용하지 마라. 참석자는 쿠키 세션만 사용
- 세션에 민감한 정보(API 키 등)를 저장하지 마라
- 포스트잇, 클러스터, 투표 등 다른 기능의 API를 이 step에서 구현하지 마라
