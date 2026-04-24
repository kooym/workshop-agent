# 아키텍처

## 관련 문서

- 문서 진입점: `docs/INDEX.md`
- MECE 모듈 경계와 데이터/API 소유권: `docs/MODULE_MAP.md`
- 모듈별 상세 계약: `docs/modules/*.md`
- 스펙 충돌과 최종 결정: `docs/SPEC_AUDIT.md`
- 운영/배포/장애 대응: `docs/OPERATIONS.md`

## 시스템 구성

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Browser)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Next.js App (React)                                  │  │
│  │  - tldraw (화이트보드 캔버스, Gather 단계)          │  │
│  │  - Yjs (CRDT 멀티플레이어 동기화)                │  │
│  │  - Realtime: DB 변경 구독 (Supabase Realtime)         │  │
│  │  - State: Zustand (클라이언트 상태 관리)               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTPS / WSS
┌─────────────────▼───────────────────────────────────────────┐
│  Azure App Service (Docker Container)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Next.js Standalone Server                             │  │
│  │  - API Routes (/api/workshops, /api/notes, /api/ai/*) │  │
│  │  - Server Components (SSR)                            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                     Supabase (Cloud)                         │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │ PostgreSQL│  │ Realtime     │  │ Auth               │    │
│  │ (DB)     │  │ (WebSocket)  │  │ (퍼실리테이터 JWT │    │
│  └──────────┘  └──────────────┘  │  + 참석자 쿠키)  │    │
│                                    └────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                  Azure OpenAI                                │
│  - 클러스터링: GPT-4o (JSON mode)                            │
│  - AX 과제 도출: GPT-4o                                      │
│  - PRD 생성: GPT-4o                                          │
└─────────────────────────────────────────────────────────────┘

배포: Azure Container Registry → Azure App Service (Linux Container)
Yjs 동기화: y-supabase 어댑터로 Supabase에 영속화 (별도 Yjs 서버 불필요)
```

## 디렉토리 구조

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # 랜딩 (초대 코드 참여 + 퍼실리테이터 로그인 링크)
│   ├── auth/
│   │   ├── login/page.tsx  # 퍼실리테이터 로그인
│   │   └── signup/page.tsx # 퍼실리테이터 회원가입
│   ├── dashboard/
│   │   ├── page.tsx        # 퍼실리테이터 프로젝트 목록
│   │   └── project/
│   │       └── [projectId]/
│   │           └── page.tsx  # 프로젝트 내 워크샵 목록
│   ├── workshop/
│   │   └── [id]/
│   │       ├── layout.tsx  # 세션 검증 + Realtime 구독
│   │       ├── page.tsx    # 워크샵 메인 (단계별 뷰 전환)
│   │       ├── board/      # Stage 1: tldraw 화이트보드
│   │       ├── cluster/    # Stage 2: 클러스터 뷰
│   │       ├── vote/       # Stage 3: 투표
│   │       ├── derive/     # Stage 4: AX 과제 도출
│   │       └── prd/        # Stage 5: PRD 생성
│   └── api/
│       ├── auth/
│       │   ├── signup/     # 퍼실리테이터 회원가입
│       │   ├── login/      # 퍼실리테이터 로그인
│       │   └── logout/     # 퍼실리테이터 로그아웃
│       ├── projects/       # 프로젝트 CRUD (withFacilitator)
│       ├── workshops/      # 워크샵 CRUD
│       ├── notes/          # 포스트잇 CRUD
│       ├── clusters/       # 클러스터 관리
│       ├── votes/          # 투표 처리
│       ├── tasks/          # AX 과제 관리
│       ├── prd/            # PRD 관리
│       └── ai/
│           ├── cluster/    # AI 클러스터링 엔드포인트
│           ├── derive/     # AI 과제 도출 엔드포인트
│           └── generate/   # AI PRD 생성 엔드포인트
├── components/
│   ├── auth/               # 인증 컴포넌트
│   │   ├── LoginForm.tsx
│   │   ├── SignupForm.tsx
│   │   └── AuthGuard.tsx   # 퍼실리테이터 인증 보호
│   ├── dashboard/          # 대시보드 컴포넌트
│   │   ├── ProjectList.tsx # 프로젝트 목록
│   │   └── WorkshopList.tsx # 프로젝트 내 워크샵 목록
│   ├── board/              # 화이트보드 컴포넌트
│   │   ├── WhiteboardCanvas.tsx  # tldraw 캔버스 래퍼
│   │   ├── StickyNoteShape.tsx   # tldraw 커스텀 포스트잇 shape
│   │   └── BoardToolbar.tsx      # 보드 도구모음
│   ├── cluster/            # 클러스터 뷰 컴포넌트
│   │   ├── ClusterGroup.tsx
│   │   └── ClusterView.tsx
│   ├── vote/               # 투표 컴포넌트
│   │   ├── VotingCard.tsx
│   │   ├── VoteResult.tsx
│   │   └── DotVoting.tsx
│   ├── derive/             # AX 과제 컴포넌트
│   │   ├── TaskCard.tsx
│   │   └── TaskList.tsx
│   ├── prd/                # PRD 컴포넌트
│   │   ├── PrdEditor.tsx
│   │   └── PrdPreview.tsx
│   ├── workshop/           # 워크샵 공통 컴포넌트
│   │   ├── StageNav.tsx    # 단계 전환 네비게이션
│   │   ├── Timer.tsx
│   │   ├── ParticipantList.tsx
│   │   └── InviteCode.tsx
│   └── ui/                 # 범용 UI 컴포넌트
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Modal.tsx
│       ├── ConfirmModal.tsx  # 확인 대화상자 (단계 전환 등)
│       ├── Input.tsx
│       ├── Textarea.tsx
│       ├── Badge.tsx         # 태그/라벨 표시
│       ├── Toast.tsx         # 알림 토스트
│       ├── Skeleton.tsx      # 로딩 스케레톤
│       └── EmptyState.tsx    # 빈 상태 UI
├── lib/
│   ├── supabase/
│   │   ├── client.ts       # Supabase 브라우저 클라이언트
│   │   ├── server.ts       # Supabase 서버 클라이언트
│   │   └── types.ts        # DB 타입 (수동 작성)
│   ├── ai/
│   │   ├── openai.ts       # Azure OpenAI 클라이언트
│   │   ├── prompts.ts      # AI 프롬프트 템플릿
│   │   └── schemas.ts      # AI 응답 JSON 스키마 (Zod)
│   ├── api/
│   │   ├── middleware.ts   # 공통 미들웨어 (withAuth, withFacilitator)
│   │   ├── validators.ts   # API 요청 body Zod 스키마 모음
│   │   └── response.ts     # API 응답 헬퍼 (success, error)
│   ├── env.ts              # 환경 변수 Zod 검증
│   ├── session.ts          # 쿠키 기반 세션 관리
│   └── utils.ts            # 유틸리티 함수
├── stores/
│   ├── workshop.ts         # 워크샵 상태 (Zustand)
│   ├── board.ts            # 보드 상태
│   └── vote.ts             # 투표 상태
└── types/
    ├── workshop.ts         # 워크샵 관련 타입
    ├── project.ts          # 프로젝트 타입
    ├── note.ts             # 포스트잇 타입
    ├── cluster.ts          # 클러스터 타입
    ├── vote.ts             # 투표 타입
    ├── task.ts             # AX 과제 타입
    └── prd.ts              # PRD 타입

Dockerfile                  # 멀티스테이지 빌드 (standalone output)
.dockerignore
next.config.ts              # output: 'standalone' 설정
supabase/
  └── migrations/         # SQL 마이그레이션 파일
```

## 데이터 모델

### projects (프로젝트)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 프로젝트 고유 ID |
| name | text | 프로젝트명 (예: "삼성전자 DX사업부") |
| description | text (nullable) | 프로젝트 설명 |
| facilitator_id | uuid (FK) | Supabase Auth user ID (퍼실리테이터) |
| created_at | timestamptz | 생성 시각 (DEFAULT now()) |
| updated_at | timestamptz | 수정 시각 (트리거로 자동 갱신) |

### workshops
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 워크샵 고유 ID |
| project_id | uuid (FK) | 프로젝트 참조 |
| title | text | 워크샵 제목 |
| invite_code | varchar(6) | 초대 코드 (유니크) |
| current_stage | enum | 현재 단계 (gather/cluster/vote/derive/generate/completed) |
| facilitator_id | uuid (FK) | Supabase Auth user ID (퍼실리테이터) |
| settings | jsonb | 워크샵 설정 (아래 settings 스키마 참조) |
| is_processing | boolean | AI 처리 중 플래그 (중복 호출 방지) |
| created_at | timestamptz | 생성 시각 (DEFAULT now()) |
| updated_at | timestamptz | 수정 시각 (트리거로 자동 갱신) |

#### settings jsonb 스키마
```typescript
interface WorkshopSettings {
  anonymous: boolean          // 익명 모드 (기본 false)
  votes_per_person: number    // 1인당 투표 수 (기본 3, 범위 1~10)
  max_participants: number    // 최대 참가자 (기본 20)
  results_visible: boolean    // 투표 결과 공개 여부 (기본 false)
}
```

### participants
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 참가자 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 |
| user_id | uuid (FK, nullable) | Supabase Auth user ID (퍼실리테이터만 값 있음) |
| name | text | 참가자 이름 |
| role | text | 역할/팀 (선택) |
| is_facilitator | boolean | 퍼실리테이터 여부 |
| joined_at | timestamptz | 참여 시각 |

### notes (포스트잇)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 포스트잇 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 |
| participant_id | uuid (FK) | 작성자 참조 |
| content | text | 포스트잇 내용 |
| color | varchar(20) | 색상 (red/blue/green/yellow) |
| cluster_id | uuid (FK, nullable) | 할당된 클러스터 |
| position_x | float | 보드 내 X 좌표 |
| position_y | float | 보드 내 Y 좌표 |
| reactions | int | 좋아요 수 |
| created_at | timestamptz | 생성 시각 |

### clusters
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 클러스터 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 |
| name | text | 클러스터 이름 (AI가 생성) |
| summary | text | 클러스터 요약 (AI가 생성) |
| color | varchar(20) | 클러스터 표시 색상 |
| order_index | int | 표시 순서 |
| created_at | timestamptz | 생성 시각 |

### votes
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 투표 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 |
| participant_id | uuid (FK) | 투표자 참조 |
| target_type | enum | 투표 대상 유형 (note/cluster) |
| target_id | uuid | 투표 대상 ID |
| created_at | timestamptz | 투표 시각 |

### ax_tasks (AX 과제)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 과제 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 |
| title | text | 과제명 |
| description | text | 과제 설명 |
| pain_points | jsonb | 연결된 pain point IDs + 텍스트 |
| core_features | jsonb | 핵심 기능 목록 |
| sub_features | jsonb | 부가 기능 목록 |
| expected_impact | text | 예상 효과 |
| difficulty | enum | 구현 난이도 (low/medium/high) |
| priority | int | 우선순위 |
| created_at | timestamptz | 생성 시각 |

### prds
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | PRD 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 |
| content | text | PRD 본문 (Markdown) |
| version | int | 버전 번호 |
| created_at | timestamptz | 생성 시각 |
| updated_at | timestamptz | 수정 시각 |

### ERD 관계

```
projects 1──N workshops    (workshop.project_id → projects.id)
workshops 1──N participants
workshops 1──N notes
workshops 1──N clusters
workshops 1──N votes
workshops 1──N ax_tasks
workshops 1──N prds
clusters  1──N notes        (note.cluster_id → clusters.id)
participants 1──N notes     (note.participant_id → participants.id)
participants 1──N votes     (vote.participant_id → participants.id)
```

## API 응답 표준

모든 API Route는 다음 형식을 준수한다:

```typescript
// 성공 응답
interface SuccessResponse<T> {
  data: T
}

// 에러 응답
interface ErrorResponse {
  error: {
    code: string      // 예: 'VALIDATION_ERROR', 'UNAUTHORIZED', 'NOT_FOUND'
    message: string   // 사용자에게 보여줄 수 있는 메시지
  }
}
```

HTTP 상태 코드: 200(성공), 400(입력 오류/검증 실패), 403(권한 없음), 404(미존재), 409(충돌/중복), 500(서버 에러)

## API 미들웨어 패턴

모든 API Route에서 반복되는 세션 검증/권한 확인을 공통 헬퍼로 추출한다:

```typescript
// src/lib/api/middleware.ts

// 세션 검증: 참석자 쿠키 세션 또는 퍼실리테이터 Supabase Auth 세션 모두 검증
async function withAuth(
  req: NextRequest,
  handler: (ctx: AuthContext) => Promise<NextResponse>
): Promise<NextResponse>

// 퍼실리테이터 검증: Supabase Auth 세션만 검증 (is_facilitator + user_id 확인)
async function withFacilitator(
  req: NextRequest,
  handler: (ctx: FacilitatorContext) => Promise<NextResponse>
): Promise<NextResponse>
```

## 요청 검증 (Zod)

모든 API Route의 요청 body는 Zod 스키마로 검증한다:

```typescript
// src/lib/api/validators.ts
import { z } from 'zod'

export const createWorkshopSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1).max(100),
  settings: z.object({
    anonymous: z.boolean().optional(),
    votes_per_person: z.number().int().min(1).max(10).optional(),
    max_participants: z.number().int().min(2).max(20).optional(),
    results_visible: z.boolean().optional(),
  }).optional(),
})

export const createNoteSchema = z.object({
  workshop_id: z.string().uuid(),
  id: z.string().uuid().optional(), // tldraw shape.id = note.id 매핑용
  content: z.string().min(1).max(200),
  color: z.enum(['red', 'blue', 'green', 'yellow']),
  position_x: z.number(),
  position_y: z.number(),
})
// ... 나머지 API도 동일 패턴
```

## RLS 및 API 권한 경계

참석자(guest)는 Supabase Auth JWT가 아니라 signed HTTP-only 쿠키를 사용한다. 따라서 권한 판단의 최종 책임은 API Route 미들웨어에 둔다.

- 모든 INSERT/UPDATE/DELETE는 API Route에서 service role client로 수행한다.
- 브라우저 anon key는 공개 가능하지만 직접 테이블 쓰기 권한을 갖지 않는다.
- 초기 데이터 조회와 권한 민감 조회는 API Route가 `withAuth`/`withFacilitator`로 signed cookie 또는 Supabase Auth 세션을 검증한 뒤 반환한다.
- Supabase Realtime/Yjs에 필요한 SELECT 범위는 RLS에서 최소 허용하되, 민감한 데이터 접근 정책은 API 계층에서 다시 검증한다.
- service role key는 서버 전용이며 클라이언트 번들에 절대 포함하지 않는다.

## 실시간 동기화 전략

이중 레이어 동기화:
1. **Gather 단계 (화이트보드)**: tldraw + Yjs CRDT로 캔버스 실시간 동기화. y-supabase 어댑터가 Yjs 문서를 Supabase에 영속화.
2. **나머지 단계**: Supabase Realtime (PostgreSQL CDC 기반)으로 DB 변경 전파.

### tldraw ↔ DB 이중 저장 (Gather 단계)

tldraw 캔버스에서 포스트잇 shape를 생성/수정/삭제하면, `notes` 테이블에도 동기화:
- shape.id = note.id 로 매핑
- tldraw 이벤트 핸들러(`onShapeCreate`, `onShapeChange`, `onShapeDelete`)에서 API 호출
- AI 파이프라인은 `notes` 테이블의 정규화된 데이터를 사용
- Cluster 이후 단계에서 AI 결과를 tldraw 캔버스에 shape로 반영

### 구독 채널

| 채널 | 구독 대상 | 용도 |
|------|----------|------|
| `workshop:{id}` | workshops 테이블 변경 | 단계 전환, 설정 변경 알림 |
| `notes:{workshop_id}` | notes 테이블 INSERT/UPDATE/DELETE | 포스트잇 실시간 동기화 |
| `clusters:{workshop_id}` | clusters 테이블 변경 | 클러스터 생성/수정 알림 |
| `votes:{workshop_id}` | votes 테이블 INSERT | 투표 실시간 집계 |
| `presence:{workshop_id}` | Supabase Presence | 참석자 온라인 상태 |

### 동기화 흐름

#### Gather 단계 (tldraw + Yjs)
```
참석자 A (tldraw에서 포스트잇 shape 생성)
    → Yjs CRDT 로컬 업데이트
    → y-supabase가 Yjs 변경사항을 Supabase Realtime으로 전파
    → 모든 구독 클라이언트 (B, C, ...) Yjs 문서 동기화 → tldraw 리렌더링
    + 동시에 API Route (POST /api/notes) → notes 테이블 INSERT
```

#### 나머지 단계 (Supabase Realtime CDC)
```
퍼실리테이터 (AI 트리거 또는 데이터 수정)
    → API Route
        → Supabase INSERT/UPDATE
            → Realtime CDC 이벤트 발행
                → 모든 구독 클라이언트 수신
                    → Zustand 스토어 업데이트 → React 리렌더링
```

## API 설계

### 인증 (퍼실리테이터)
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/auth/signup | 퍼실리테이터 회원가입 (Supabase Auth) |
| POST | /api/auth/login | 퍼실리테이터 로그인 (Supabase Auth) |
| POST | /api/auth/logout | 퍼실리테이터 로그아웃 |

### 프로젝트
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/projects | 프로젝트 생성 (withFacilitator) |
| GET | /api/projects | 퍼실리테이터 프로젝트 목록 (withFacilitator) |
| PATCH | /api/projects/:id | 프로젝트 수정 (withFacilitator) |
| DELETE | /api/projects/:id | 프로젝트 삭제 (withFacilitator, 소속 워크샵 없을 때만) |

### 워크샵
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/workshops | 워크샵 생성 (withFacilitator) |
| GET | /api/workshops?project_id=:id | 프로젝트 내 워크샵 목록 (withFacilitator) |
| GET | /api/workshops/:id | 워크샵 조회 (withAuth) |
| PATCH | /api/workshops/:id | 워크샵 수정 (withFacilitator) |
| POST | /api/workshops/join | 초대 코드로 참여 (게스트) |

### 포스트잇
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/notes?workshop_id=:id | 워크샵의 모든 포스트잇 조회 |
| POST | /api/notes | 포스트잇 생성 |
| PATCH | /api/notes/:id | 포스트잇 수정 (내용, 위치, 클러스터 변경) |
| DELETE | /api/notes/:id | 포스트잇 삭제 |
| POST | /api/notes/:id/react | 좋아요 리액션 |

### 클러스터
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/clusters?workshop_id=:id | 워크샵의 클러스터 목록 |
| PATCH | /api/clusters/:id | 클러스터 수정 (이름, 순서) |

### 투표
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/votes | 투표 |
| DELETE | /api/votes/:id | 투표 취소 |
| GET | /api/votes/results?workshop_id=:id | 투표 결과 조회 |

### AX 과제
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/tasks?workshop_id=:id | 과제 목록 |
| PATCH | /api/tasks/:id | 과제 수정 |

### PRD
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/prd?workshop_id=:id | PRD 조회 |
| PATCH | /api/prd/:id | PRD 수정 |

### AI
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/ai/cluster | AI 클러스터링 실행 |
| POST | /api/ai/derive | AI AX 과제 도출 |
| POST | /api/ai/generate | AI PRD 생성 |

## AI 파이프라인

### 공통 설정
- **API**: Azure OpenAI (GPT-4o)
- **JSON Mode**: 모든 AI 호출은 structured output (JSON) 사용
- **서버사이드 전용**: 클라이언트에서 직접 호출하지 않음
- **타임아웃**: 클러스터링 30초, AX 과제 도출 30초, PRD 생성 60초
- **재시도**: 최대 2회 (1초, 2초 exponential backoff)
- **토큰 가드레일**: 클러스터링 2000, AX 과제 도출 3000, PRD 생성 8000
- **응답 검증**: `src/lib/ai/schemas.ts`의 Zod 스키마로 파싱하고, 각 호출별 사후 무결성 검증을 통과해야 DB에 반영한다.

### 클러스터링 파이프라인

```
입력: notes[] (포스트잇 배열)
  ↓
프롬프트 구성:
  - System: "워크샵 퍼실리테이터로서 포스트잇을 의미 기반으로 클러스터링하라"
  - User: 포스트잇 목록 (id + content)
  ↓
Azure OpenAI 호출 (JSON mode)
  ↓
응답 파싱:
  {
    clusters: [
      {
        name: "클러스터명",
        summary: "요약",
        note_ids: ["id1", "id2", ...]
      }
    ]
  }
  ↓
DB 반영: clusters 테이블 INSERT + notes.cluster_id UPDATE
  ↓
Realtime으로 전체 참석자에게 전파
```

### AX 과제 도출 파이프라인

```
입력: 상위 클러스터[] + 포스트잇[] + 투표 결과
  ↓
프롬프트 구성:
  - System: "비즈니스 컨설턴트로서 pain point를 분석하여 AX 과제를 도출하라"
  - User: 클러스터별 pain point + 투표 순위
  ↓
Azure OpenAI 호출 (JSON mode)
  ↓
응답: ax_tasks[] (과제명, 설명, 연결 pain point, 핵심/부가 기능, 난이도, 예상 효과)
  ↓
DB 반영: ax_tasks 테이블 INSERT
```

### PRD 생성 파이프라인

```
입력: ax_tasks[] + 워크샵 메타데이터
  ↓
프롬프트 구성:
  - System: "프로덕트 매니저로서 AX 과제를 기반으로 PRD를 작성하라"
  - User: 과제 목록 + 핵심 기능 + 워크샵 맥락
  ↓
Azure OpenAI 호출 (JSON mode)
  ↓
응답: { content: "PRD 본문 Markdown" }
  ↓
DB 반영: prds 테이블 INSERT
```

## 상태 관리

Zustand를 사용하여 클라이언트 상태를 관리한다.

### 스토어 구조

```
workshopStore
  - workshop: Workshop | null        # 현재 워크샵 정보
  - participants: Participant[]       # 참석자 목록
  - currentStage: Stage              # 현재 단계
  - setStage(stage)                  # 단계 전환

boardStore
  - notes: Note[]                    # 포스트잇 목록
  - addNote(note)                    # 포스트잇 추가 (optimistic)
  - updateNote(id, data)             # 포스트잇 수정
  - removeNote(id)                   # 포스트잇 삭제
  - syncFromRealtime(payload)        # Realtime 이벤트 반영

voteStore
  - votes: Vote[]                    # 투표 목록
  - myVotes: Vote[]                  # 내 투표
  - remainingVotes: number           # 남은 투표 수
  - castVote(targetType, targetId)   # 투표
  - removeVote(voteId)               # 투표 취소
  - results: VoteResult[]            # 집계 결과
```

## 패턴

- **Server Components 기본** — 데이터 페칭은 서버 컴포넌트에서 수행
- **Client Components는 인터랙션 전용** — 실시간 구독, 사용자 입력, 상태 변경이 필요한 곳만 'use client'
- **Optimistic Updates** — 포스트잇 생성/수정 시 API 응답을 기다리지 않고 즉시 UI 반영, 실패 시 롤백
- **Realtime 구독은 레이아웃 레벨** — workshop/[id]/layout.tsx에서 한 번만 구독, 하위 페이지에서 스토어 참조
- **AI 중복 호출 방지** — workshops.is_processing 플래그로 서버사이드 락, 클라이언트 버튼 disabled 병행
- **DB timestamps 자동화** — created_at은 DEFAULT now(), updated_at은 트리거로 자동 갱신
- **Zod 검증** — 모든 API body는 Zod 스키마로 검증, 실패 시 400 + 표준 에러 응답
