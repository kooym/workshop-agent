# 프로젝트: Workshop Agent

## 기술 스택
- Next.js 15 (App Router, `output: 'standalone'`)
- TypeScript (strict mode)
- Tailwind CSS
- Supabase (PostgreSQL + Realtime + Auth)
- @supabase/ssr (Next.js SSR 쿠키 기반 Auth 통합)
- tldraw (화이트보드 캔버스 — 포스트잇 보드 UI)
- Yjs + y-supabase (tldraw 멀티플레이어 CRDT 동기화)
- Zustand (클라이언트 상태 관리)
- Zod (API 요청/응답 검증)
- openai (Azure OpenAI GPT-4o 연동)
- Vitest + Testing Library (테스트)
- lucide-react (아이콘)
- sonner (Toast 알림)
- react-markdown (PRD Markdown 렌더링)
- Docker (컨테이너화)
- Azure App Service + Azure Container Registry (배포)

## 환경 변수
```
# 공개 (클라이언트 접근 가능)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# 서버 전용 (NEXT_PUBLIC_ 접두사 금지)
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=              # 참석자 쿠키 서명 전용 시크릿 (32자 이상 랜덤 문자열). SUPABASE_SERVICE_ROLE_KEY와 반드시 분리
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```
- CRITICAL: 서버 기동 시 필수 환경 변수가 누락되면 즉시 실패해야 함. `src/lib/env.ts`에서 Zod로 검증하고, 다른 모듈이 `process.env` 직접 참조 대신 이 모듈을 import할 것

## 아키텍처 규칙
- CRITICAL: AI 호출(클러스터링, 과제 도출, PRD 생성)은 반드시 API Route(서버사이드)에서만 처리할 것. 클라이언트에서 직접 Azure OpenAI를 호출하지 말 것
- CRITICAL: Azure OpenAI API 키, Supabase Service Role Key 등 시크릿을 클라이언트 코드에 절대 노출하지 말 것. 서버 전용 환경 변수는 NEXT_PUBLIC_ 접두사 없이 관리
- 예외: Supabase 브라우저 클라이언트에 필요한 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY는 공개 가능 (anon key는 RLS로 보호)
- Supabase RLS: 모든 테이블에 RLS 활성화. anon key는 RLS 정책으로만 데이터 접근 가능. service_role key는 API Route 서버에서만 사용
- Rate Limiting: AI 엔드포인트(/api/ai/*)는 workshops.is_processing 플래그로 동시 호출 차단. 일반 API는 MVP에서는 별도 Rate Limiting 미적용 (Azure App Service 기본 제한에 의존)
- CRITICAL: 모든 API Route에서 워크샵 접근 권한을 검증할 것. 공통 미들웨어 헬퍼(withAuth, withFacilitator)를 사용. 위치: `src/lib/api/middleware.ts`
- CRITICAL: 모든 API Route의 요청 body는 Zod 스키마로 검증할 것. 검증 실패 시 400 + 표준 에러 응답 반환. 위치: `src/lib/api/validators.ts`
- CRITICAL: ARCHITECTURE.md에 명시된 파일 경로는 정규 경로이다. 대안 경로를 만들지 마라
- Supabase 클라이언트 이중 패턴: 브라우저에서는 `createBrowserClient` (`src/lib/supabase/client.ts`), 서버(API Route/Server Component)에서는 `createServerClient` (`src/lib/supabase/server.ts`). 혼용 금지
- Server Components 기본. 인터랙션이 필요한 곳만 'use client'
- 실시간 동기화 이중 레이어:
  - **Gather 단계 (화이트보드)**: tldraw + Yjs CRDT로 캔버스 동기화. Yjs 문서는 y-supabase 어댑터로 Supabase에 실시간 동기화 및 영속화
  - **나머지 단계**: Supabase Realtime(CDC)으로 DB 변경사항 전파
- Realtime 구독은 workshop/[id]/layout.tsx에서 한 번만 설정. WebSocket 끊김 시 자동 재연결 + Zustand 스토어 전체 재페치
- 화이트보드 ↔ DB 이중 저장 (Gather 단계): tldraw shape 생성/수정/삭제 시 `notes` 테이블에도 동기화 (shape.id = note.id 매핑). AI 파이프라인은 `notes` 테이블의 정규화된 데이터를 사용
- Cluster 이후 단계에서 AI 결과를 tldraw 캔버스에 반영: 클러스터 배치를 캔버스 shape으로 시각화
- 포스트잇 CRUD는 tldraw 이벤트 핸들러에서 DB에 비동기 동기화. 실패 시 Toast 에러 표시
- AI 호출(클러스터링, 과제 도출, PRD 생성)은 서버사이드에서 중복 호출을 방지할 것 (처리 중 상태 플래그 + 클라이언트 버튼 disabled)
- DB timestamps: created_at은 DEFAULT now(), updated_at은 트리거로 자동 갱신. 코드에서 수동 설정하지 말 것
- Realtime 채널 5종: `workshop:{id}`, `notes:{workshop_id}`, `clusters:{workshop_id}`, `votes:{workshop_id}`, `presence:{workshop_id}`. Yjs 문서 동기화는 y-supabase가 별도 채널로 관리
- 프로젝트 → 워크샵 2단계 계층: 워크샵은 반드시 프로젝트(고객사/사업 단위)에 소속. 프로젝트별로 워크샵 목록 관리. 퍼실리테이터 대시보드에서 프로젝트 그룹핑 표시
- 워크샵 단계: gather → cluster → vote → derive → generate → completed. completed 상태에서는 읽기 전용 (산출물 조회만 가능)
- 단계 전환 사전조건: gather→cluster(포스트잇≥1), cluster→vote(클러스터≥1), vote→derive(퍼실리테이터가 투표 마감 선언. 전원 투표 필수 아님), derive→generate(과제≥1), generate→completed(PRD 생성 완료). 전환 전 ConfirmModal 필수 ("이전 단계로 돌아갈 수 없습니다")
- 워크샵 생성 시 퍼실리테이터를 participants 테이블에도 자동 INSERT (is_facilitator: true)

## 역할별 권한 매트릭스

### 단계별 퍼실리테이터 전용 컨트롤 (is_facilitator 검사 후 노출)
| 단계 | 퍼실리테이터 전용 UI | 참석자에게 숨김 |
|------|------|------|
| gather | "다음 단계로" 버튼 (StageNav) | O |
| cluster | "AI 클러스터링 시작" 버튼, 클러스터 병합/분리/이름 편집 | O |
| vote | "투표 마감" 버튼, "결과 공개" 토글, "다음 단계로" 버튼 | O |
| derive | "AI 과제 도출" 버튼, 과제 편집/삭제, "다음 단계로" 버튼 | O |
| generate | "AI PRD 생성" 버튼, PRD 편집, "워크샵 완료" 버튼 | O |
| completed | 없음 (읽기 전용) | - |

### 참석자 대기 화면 (AI 처리 중)
- AI 처리 중(is_processing=true)일 때, 참석자 화면에 pulse 애니메이션 + "퍼실리테이터가 AI를 실행 중입니다" 메시지 표시
- AI 완료 후 Realtime으로 결과 자동 반영 (참석자 수동 새로고침 불필요)

### 투표 결과 가시성
- `settings.results_visible = false`일 때: 투표 진행 중 참석자는 투표 수 불가. 퍼실리테이터도 진행 중에는 결과 비공개 (앵커링 방지)
- 퍼실리테이터가 "결과 공개" 버튼 클릭 → 전체 참석자에게 Realtime으로 결과 동시 공개
- `settings.results_visible = true`일 때: 실시간으로 모두에게 투표 현황 표시

### 단계별 쓰기 잠금 (Stage Write Lock)
- gather 단계에서만 포스트잇 생성/수정/삭제 가능. cluster 단계 이후 포스트잇 CRUD 차단 (API에서 current_stage 검증)
- vote 단계에서만 투표 가능. derive 단계 이후 투표 차단
- derive 단계에서만 과제 편집 가능 (퍼실리테이터 전용). generate 단계 이후 과제 읽기 전용
- generate 단계에서만 PRD 편집 가능 (퍼실리테이터 전용). completed 후 읽기 전용

### 퍼실리테이터 컨텐츠 관리 권한
- 퍼실리테이터는 타인의 포스트잇을 삭제할 수 있음 (API에서 is_facilitator 검증. 수정은 불가 — 원래 작성자만 수정 가능)
- 퍼실리테이터는 특정 참석자를 강제 퇴장(kick)할 수 없음 (MVP). 참가자 초과 시 초대 코드 비활성화로 신규 접속만 차단

### 워크샵 설정 변경 제약
- `anonymous`: gather 단계에서만 변경 가능. 포스트잇 작성 후 변경 시 기존 포스트잇의 작성자 표시에 영향
- `votes_per_person`: vote 단계 진입 전에만 변경 가능. 투표 시작 후 변경 불가
- `max_participants`: 현재 참가자 수 이상으로만 변경 가능 (API에서 검증)
- `results_visible`: 언제든 변경 가능

### completed 상태 접근 규칙
- 기존 참석자: 쿠키 유효 시 접속 가능, 산출물(클러스터, 과제, PRD) 조회 가능. 투표/포스트잇 작성은 불가
- 신규 참석자: 초대 코드로 접속 시 "이미 종료된 워크샵" 안내 메시지 + 읽기 전용 모드로 접속 허용
- 퍼실리테이터: 대시보드에서 completed 워크샵 조회/열람 가능

### Presence 표시
- ParticipantList에서 퍼실리테이터는 이름 옆에 퍼실리테이터 배지(예: 왕관 아이콘 또는 "host" Badge) 표시하여 참석자와 구분
- 온라인/오프라인 상태: 녹색 도트(온라인) / 회색 도트(오프라인)

### 사이드바 역할별 노출
- 공통: 단계 목록 (StageNav), 참석자 리스트 (ParticipantList), 초대 코드 표시
- 퍼실리테이터 전용: 단계별 액션 버튼 (AI 트리거, 단계 전환, 투표 마감/공개), 설정 버튼
- 참석자: 액션 버튼 영역이 숨겨지고 사이드바 더 콤팩트하게 표시

## 인증 모델
- **퍼실리테이터(관리자)**: Supabase Auth 이메일/비밀번호 로그인 (비밀번호 최소 8자). 로그인 후 워크샵 생성/관리 가능. 대시보드에서 자신의 워크샵 목록 조회 가능
- **참석자(게스트)**: 초대 코드(6자리 영숫자, 혼동문자 0/O/1/I/L 제외) + 이름 입력으로 접속. 별도 회원가입 없음
- CRITICAL: 참석자 세션 쿠키 값은 반드시 서명(signed)할 것. workshop_id + participant_id를 `SESSION_SECRET` 환경 변수로 서명하여 위변조 방지. 서명 없이 평문 저장 금지. `SUPABASE_SERVICE_ROLE_KEY`를 서명 시크릿으로 재사용하지 말 것 (단일 책임 원칙)
- 참석자 세션: HTTP-only 쿠키 (Secure, SameSite=Lax, maxAge=86400). 새로고침 시 쿠키로 자동 복구, Zustand 스토어는 서버에서 재페치
- 퍼실리테이터 세션: Supabase Auth 세션 (JWT). `@supabase/ssr`로 서버/클라이언트 양쪽에서 관리
- withAuth: 참석자 쿠키 세션 또는 퍼실리테이터 Auth 세션 모두 검증. 반드시 해당 워크샵의 participants 테이블에 존재하는지까지 확인
- withFacilitator: 퍼실리테이터 Auth 세션만 검증 (is_facilitator + facilitator_id 확인)
- 초대 코드 충돌: 생성 시 DB 유니크 제약 위반이면 재생성 (최대 3회)
- 동일 이름 참석자: 같은 워크샵 내 이름 중복 허용 (동명이인 존재 가능). 고유 식별은 participant_id로 수행
- 쿠키 만료 후 재참여: 참석자 쿠키(maxAge=24h) 만료 시 랜딩 페이지에서 동일 초대 코드 + 이름으로 다시 접속. 기존 participant 레코드와는 별개의 새 참가자로 생성 (MVP 제약)

## AI 파이프라인 제약
- 모든 AI 호출은 JSON Mode(structured output) 사용
- 재시도: 최대 2회 (exponential backoff, base delay 1초 → 1s, 2s)
- 타임아웃 (해당 시간 초과 시 AbortController로 중단): 클러스터링 30초, 과제 도출 30초, PRD 생성 60초
- 중복 방지: workshops.is_processing 플래그 (try/finally 패턴으로 반드시 복구)
- 프롬프트: `src/lib/ai/prompts.ts`에 모든 시스템/유저 프롬프트를 상수로 관리. API Route에 하드코딩 금지
- AI 실패 UX: Toast로 "AI 처리에 실패했습니다. 다시 시도해주세요" + 재시도 버튼 활성화. alert() 사용 금지
- 토큰 가드레일: max_tokens를 각 호출별로 설정 (클러스터링 2000, 과제 도출 3000, PRD 생성 8000)
- AI 응답 사후 검증:
  - 클러스터링: 모든 입력 note_id가 출력에 포함되는지 확인. 누락/중복 할당 시 에러 처리
  - 과제 도출: 반환된 과제가 1개 이상인지, 각 과제에 연결된 cluster_id가 유효한지 확인
  - PRD 생성: 반환된 텍스트가 비어있지 않고 max_tokens 미만인지 확인 (잘림 방지)
- AI 응답 Zod 스키마: `src/lib/ai/schemas.ts`에 정의. 각 AI 호출의 JSON 응답을 Zod로 파싱하여 타입 안전성 보장
- OpenAI 클라이언트: `openai` 패키지의 `AzureOpenAI` 클래스를 사용. 위치: `src/lib/ai/openai.ts`

## UI/UX 규칙
- 다크모드 기본. 포스트잇 색상(red/blue/green/yellow)으로 시각적 포인트
- AI 슬롭 안티패턴 금지: backdrop-filter blur, gradient-text, glow 애니메이션, 보라/인디고 색상, 균일한 rounded-2xl, gradient orb, "Powered by AI" 배지
- alert() 사용 금지 → Toast(sonner) 또는 인라인 에러 사용
- 허용 애니메이션만 사용: fade-in(300ms), scale-in(200ms), slide-up(300ms), pulse(1.5s infinite)
- 아이콘: Lucide Icons (strokeWidth: 1.5, w-4 h-4 인라인 / w-5 h-5 버튼). 둥근 배경 박스로 감싸지 않음
- 모달 배경: bg-black/60 (blur 금지)
- 반응형: 데스크톱 우선(1024px+), 태블릿 최소 지원(사이드바 숨김), 모바일 미지원(안내 메시지)
- 로딩 상태: 데이터 페칭 시 Skeleton 컴포넌트 사용 (spinner 금지). AI 처리 중에만 pulse 애니메이션 허용
- `<Toaster />` 컴포넌트는 root layout(`src/app/layout.tsx`)에 한 번만 마운트
- CRITICAL: `dangerouslySetInnerHTML` 사용 금지. 사용자 입력 텍스트는 반드시 텍스트 노드로 렌더링. Markdown 렌더링은 `react-markdown`만 사용
- 에러 바운더리: workshop/[id] 레이아웃에 React Error Boundary를 설정. 컴포넌트 예외 시 전체 페이지 대신 폴백 UI 표시 + 새로고침 버튼
- 접근성 최소 요건: 모든 form input에 label 연결, 버튼에 접근 가능한 이름, 모달에 focus trap + Escape 닫기, 키보드로 투표 가능

## 리소스 및 입력 제한
- 워크샵당 참가자: 기본 20명, 설정 가능 (2~20). DB CHECK 제약 또는 API에서 트랜잭션으로 초과 방지
- 워크샵당 포스트잇: 최대 200개. API에서 INSERT 전 count 검증
- AI 클러스터 수: 3~8개 (AI 동적 결정)
- 1인당 투표: 기본 3표 (설정 가능, 1~10)
- 텍스트 길이: 포스트잇 200자, 클러스터명 50자, 과제명 100자, 과제설명 500자, PRD 50,000자
- 초대 코드: 6자리 영숫자, 혼동문자(0/O, 1/I/L) 제외
- 브라우저: Chrome, Edge 최신 (데스크톱 전용)
- 데이터 보존: 워크샵 데이터 최소 30일 유지
- 동시 운영: 퍼실리테이터 1인이 동시에 여러 프로젝트/워크샵을 생성할 수 있으나, 프로젝트당 활성 워크샵은 1개로 제한 (MVP). 활성 = current_stage가 completed가 아닌 워크샵. 같은 프로젝트 내 새 워크샵 생성 시 기존 활성 워크샵이 있으면 API에서 409 CONFLICT 반환
- 퍼실리테이터 역할 겸임: 퍼실리테이터는 participants 테이블에 자동 등록되므로, 포스트잇 작성·투표 등 참석자 행동도 수행 가능. 단, 단계 전환·AI 트리거 등 관리 기능은 withFacilitator로 보호

## API 응답 표준
- 성공: `{ data: T }`
- 에러: `{ error: { code: string, message: string } }`
- HTTP 상태 코드: 200(조회/수정 성공), 201(리소스 생성 성공), 400(입력 오류), 401(인증 실패), 403(권한 없음), 404(미존재), 409(충돌/중복), 500(서버 에러)
- API 엔드포인트 규칙: 복수형 명사 사용 (예: /api/workshops, /api/notes). RESTful 패턴 준수 (GET 조회, POST 생성, PATCH 수정, DELETE 삭제)
- 에러 코드 상수: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `PROCESSING`, `INTERNAL_ERROR`. 위치: `src/lib/api/response.ts`에 상수로 정의
- 목록 조회: MVP에서는 페이지네이션 없이 전체 반환 (워크샵당 데이터 규모가 작으므로). Post-MVP에서 cursor 기반 페이지네이션 검토

## 타입 안전성
- DB 타입: `src/lib/supabase/types.ts`에 수동 작성 (Supabase 테이블 행 타입)
- 도메인 타입: `src/types/*.ts`에 API 응답/클라이언트용 타입 정의. DB 타입을 그대로 클라이언트에 노출하지 말 것
- Zod → TypeScript: API 요청 타입은 `z.infer<typeof schema>`로 추론. 별도 interface 중복 정의 금지
- 설정 스키마: `WorkshopSettings = { anonymous: boolean, votes_per_person: number(1~10, 기본 3), max_participants: number(2~20, 기본 20), results_visible: boolean(기본 false) }`

## 에러 처리 / 복원력
- 서버 로깅: API Route에서 에러 발생 시 `console.error`로 JSON 구조화 로깅. 형식: `{ method, path, status, error, duration_ms, workshop_id?, participant_id? }`. Azure App Service 로그 스트림 또는 Azure Monitor로 수집
- DB 마이그레이션: `supabase/migrations/` 디렉토리에 순번 파일 (`001_initial_schema.sql`, `002_...`). Supabase CLI `supabase db push`로 적용
- 동시성 가드: 투표 N표 초과, 참가자 초과, 포스트잇 초과는 DB 유니크 제약 또는 API 트랜잭션(SELECT ... FOR UPDATE)으로 방지. 클라이언트 검증만으로는 불충분
- 포스트잇 동시 수정: last-write-wins 전략. Realtime CDC가 최신 상태를 자동 전파하므로 별도 conflict resolution 불필요 (MVP). 자신의 포스트잇만 수정/삭제 가능 (API에서 participant_id 소유권 검증)
- 외부 서비스 장애 대응:
  - Supabase 장애: API Route에서 DB 에러 감지 시 500 + "서비스 일시 장애" 메시지. 클라이언트는 Toast로 안내
  - Azure OpenAI 장애: AI 호출 실패 시 is_processing 플래그 반드시 복구 (try/finally). Toast로 재시도 유도
  - Realtime 연결 끊김: Supabase 클라이언트 내장 자동 재연결. 재연결 성공 시 Zustand 스토어 전체 재페치로 상태 동기화

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)
- 기획 변경 시 반드시 docs/ 문서를 먼저 업데이트한 후 코드를 수정할 것
- PR은 lint → typecheck → test → build 순서의 CI를 통과해야 머지 가능
- 상세 설계 참조: docs/INDEX.md(문서 진입점), docs/MODULE_MAP.md(모듈 경계), docs/FOUNDATION_ASSESSMENT.md(Foundation 기준), docs/PRD.md(기능), docs/ARCHITECTURE.md(구조), docs/ADR.md(결정), docs/UI_GUIDE.md(디자인), docs/OPERATIONS.md(운영)

## 규칙 우선순위
- 이 문서의 CRITICAL 규칙 > step 파일의 지시 > 이 문서의 일반 규칙
- step 파일이 CRITICAL 규칙과 충돌하면, CRITICAL 규칙을 따르고 충돌 사실을 summary에 기록
- blocked 판정 기준: API 키 누락, 외부 서비스 인증, 수동 설정 필요 시. 코드/빌드 에러는 error (3회 재시도)

## 네이밍 규칙
- 파일명: kebab-case (예: `invite-code.ts`). React 컴포넌트만 PascalCase (예: `StickyNote.tsx`)
- 브랜치: 일반 작업은 `feat/step2-auth-invite`, `fix/vote-count-bug` 형식. Harness가 phase 단위로 자동 생성하는 브랜치는 `scripts/execute.py` 규칙에 따라 `feat-{phase}` 형식을 허용
- Import: 절대 경로 `@/*` 사용 (예: `@/lib/supabase/client`). 상대 경로는 같은 디렉토리 내 파일 간에만 허용

## 테스트 전략
- 단위 테스트: 유틸 함수, Zod 스키마, Zustand 스토어 액션
- 통합 테스트: API Route (요청→응답 검증, 미들웨어 동작 확인)
- 컴포넌트 테스트: 사용자 인터랙션이 있는 클라이언트 컴포넌트 (Testing Library)
- E2E: MVP에서는 제외 (Post-MVP에서 Playwright 도입 검토)
- 모킹: Supabase는 `vi.mock()` 모듈 모킹 (클라이언트/서버 각각), Azure OpenAI는 MSW로 HTTP 레벨 모킹
- 파일 규칙: `*.test.ts(x)` 네이밍. 테스트 대상 파일과 동일 디렉토리에 co-locate (예: `utils.ts` → `utils.test.ts`)
- 커버리지: MVP에서 최소 목표 없음. 핵심 경로(인증, 투표, AI 호출) 위주로 작성

## 명령어
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run lint         # ESLint
npm run typecheck    # TypeScript 타입 검사
npm run test         # 테스트 (Vitest)
npm run test:watch   # 테스트 워치 모드
npm run test:coverage # 테스트 커버리지

### Supabase CLI
npx supabase start   # 로컬 Supabase 인스턴스 시작 (Docker 필요)
npx supabase db push # 마이그레이션 적용 (리모트)
npx supabase db reset # 로컬 DB 초기화 + 마이그레이션 재적용

### Docker / Azure 배포
docker build -t workshop-agent .                           # 이미지 빌드
docker run -p 3000:3000 --env-file .env workshop-agent     # 로컬 컨테이너 실행
az acr login --name <ACR_NAME>                             # ACR 로그인
docker tag workshop-agent <ACR_NAME>.azurecr.io/workshop-agent:latest
docker push <ACR_NAME>.azurecr.io/workshop-agent:latest    # ACR 푸시
az webapp restart --name <APP_NAME> --resource-group <RG>  # App Service 재시작

---

## CRITICAL 규칙 체크리스트

매 step 완료 시 아래 항목을 검증한다:

1. [ ] AI 호출이 API Route 서버사이드에서만 이루어지는가
2. [ ] 시크릿(API 키, Service Role Key)이 클라이언트 코드에 노출되지 않는가
3. [ ] 모든 API Route에서 withAuth/withFacilitator로 권한 검증하는가
4. [ ] 모든 API 요청 body가 Zod 스키마로 검증되는가
5. [ ] ARCHITECTURE.md에 명시된 파일 경로를 따르는가
6. [ ] 환경 변수가 `src/lib/env.ts`를 경유하여 검증되는가
7. [ ] 참석자 세션 쿠키 값이 서명되어 있는가
8. [ ] `dangerouslySetInnerHTML`이 사용되지 않았는가
9. [ ] TDD: 테스트가 구현보다 먼저 작성되었는가
10. [ ] `npm run build && npm run lint && npm run typecheck` 통과하는가
11. [ ] Docker 빌드가 성공하는가 (`docker build -t workshop-agent .`)
