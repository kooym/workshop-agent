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
│   │       ├── cluster/    # Stage 3: 클러스터 뷰
│   │       ├── vote/       # Stage 4: 투표
│   │       ├── design/     # Stage 5: AX 설계
│   │       ├── prd/        # Stage 6: PRD 생성
│   │       └── report/     # Stage 7: 종합 보고서
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
│       ├── reports/        # AX 종합 보고서 관리
│       ├── reactions/      # 참석자 이모지 반응
│       ├── design-artifacts/ # Design 산출물 관리
│       ├── process-steps/  # 프로세스 노드 CRUD
│       ├── process-edges/  # 프로세스 간선 CRUD
│       ├── process-lanes/  # Swimlane CRUD
│       ├── process-graph/  # 프로세스 그래프 통합 조회
│       ├── editing-locks/  # Active/Sleep 편집 잠금
│       └── ai/
│           ├── cluster/    # AI 클러스터링 엔드포인트
│           ├── design/     # AI AX 설계 엔드포인트
│           ├── generate/   # AI PRD 생성 엔드포인트
│           └── report/     # AI 종합 보고서 엔드포인트
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
│   ├── context/            # Context 단계 (AS-IS 프로세스 그래프) 컴포넌트
│   │   ├── ProcessGraphEditor.tsx  # React Flow 기반 BPMN 그래프 에디터
│   │   ├── nodes/                  # BPMN 커스텀 노드 컴포넌트
│   │   │   ├── TaskNode.tsx        # 작업 노드 (둥근 사각형)
│   │   │   ├── StartEventNode.tsx  # 시작 이벤트 (녹색 원)
│   │   │   ├── EndEventNode.tsx    # 종료 이벤트 (빨간 원)
│   │   │   ├── ExclusiveGatewayNode.tsx  # 배타 게이트웨이 (다이아몬드 X)
│   │   │   ├── ParallelGatewayNode.tsx   # 병렬 게이트웨이 (다이아몬드 +)
│   │   │   ├── IntermediateEventNode.tsx # 중간 이벤트 (이중 원)
│   │   │   ├── SubProcessNode.tsx  # 서브프로세스 (리사이즈 컨테이너)
│   │   │   └── SwimlaneNode.tsx    # Swimlane (그룹 컨테이너)
│   │   ├── NodeDetailPanel.tsx     # 노드 클릭 시 상세 편집 사이드 패널
│   │   ├── LaneManager.tsx         # Swimlane 관리 (추가/편집/삭제)
│   │   └── EditingLockBar.tsx      # Active/Sleep 편집 잠금 상태 바
│   ├── cluster/            # 클러스터 뷰 컴포넌트
│   │   ├── ClusterGroup.tsx
│   │   └── ClusterView.tsx
│   ├── vote/               # 투표 컴포넌트
│   │   ├── VotingCard.tsx
│   │   ├── VoteResult.tsx
│   │   └── DotVoting.tsx
│   ├── design/             # Design 단계 컴포넌트
│   │   ├── ToBeProcessView.tsx   # TO-BE 프로세스 시각화
│   │   ├── AgentSpecCard.tsx     # Agent 스펙 카드
│   │   ├── KpiTable.tsx          # KPI 테이블
│   │   ├── DataRequirementTable.tsx # 데이터 요구사항 테이블
│   │   ├── OrgRequirementList.tsx   # 조직적 요건 목록
│   │   └── DesignView.tsx        # Design 탭 메인 뷰
│   ├── prd/                # PRD 컴포넌트
│   │   ├── PrdEditor.tsx
│   │   └── PrdPreview.tsx
│   ├── report/             # AX 종합 보고서 컴포넌트
│   │   ├── ReportEditor.tsx
│   │   └── ReportPreview.tsx
│   ├── workshop/           # 워크샵 공통 컴포넌트
│   │   ├── StageNav.tsx    # 단계 전환 네비게이션
│   │   ├── Timer.tsx
│   │   ├── ParticipantList.tsx
│   │   └── InviteCode.tsx
│   ├── common/              # 공용 컴포넌트
│   │   ├── MermaidDiagram.tsx  # Mermaid 다이어그램 렌더러 (mermaid.render() → DOM ref)
│   │   ├── StaleBanner.tsx     # Stale 경고 배너 (퍼실리테이터: 재실행/유지 버튼, 참석자: 읽기 전용)
│   │   └── StageGuideBanner.tsx # 단계 안내 배너 (dismissable)
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
│   │   ├── response.ts     # API 응답 헬퍼 (success, error)
│   │   └── stale.ts        # propagateStale(workshopId, modifiedStage) — 하류 stale 전파 유틸
│   ├── env.ts              # 환경 변수 Zod 검증
│   ├── session.ts          # 쿠키 기반 세션 관리
│   └── utils.ts            # 유틸리티 함수
├── stores/
│   ├── workshop.ts         # 워크샵 상태 (Zustand) — currentStage, viewingStage
│   ├── board.ts            # 보드 상태 (포스트잇)
│   ├── process-graph.ts    # 프로세스 그래프 상태 (노드/간선/레인/잠금)
│   ├── vote.ts             # 투표 상태
│   ├── design.ts           # Design 산출물 + 과제 + 반응 상태
│   ├── prd.ts              # PRD 상태
│   └── report.ts           # 종합 보고서 상태
└── types/
    ├── workshop.ts         # 워크샵 관련 타입
    ├── project.ts          # 프로젝트 타입
    ├── note.ts             # 포스트잇 타입
    ├── cluster.ts          # 클러스터 타입
    ├── vote.ts             # 투표 타입
    ├── task.ts             # AX 과제 타입
    ├── prd.ts              # PRD 타입
    ├── report.ts           # AX 종합 보고서 타입
    ├── process.ts          # 프로세스 노드/간선/레인 타입
    ├── design.ts           # Design 산출물 타입
    └── reaction.ts         # 이모지 반응 타입

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
| description | text (nullable) | 워크샵 목적/주제 설명 (참석자에게 맥락 제공) |
| invite_code | varchar(6) | 초대 코드 (유니크) |
| current_stage | enum | 현재 단계 (`workshop_stage` enum: context/gather/cluster/vote/design/generate/report/completed) |
| facilitator_id | uuid (FK) | Supabase Auth user ID (퍼실리테이터) |
| settings | jsonb | 워크샵 설정 (아래 settings 스키마 참조) |
| is_processing | boolean | AI 처리 중 플래그 (중복 호출 방지) |
| is_processing_since | timestamptz (nullable) | AI 처리 시작 시각. 5분 초과 시 stale lock 판정 → 자동 복구 |
| created_at | timestamptz | 생성 시각 (DEFAULT now()) |
| updated_at | timestamptz | 수정 시각 (트리거로 자동 갱신) |

#### settings jsonb 스키마
```typescript
interface WorkshopSettings {
  anonymous: boolean          // 익명 모드 (기본 false)
  votes_per_person: number    // 1인당 투표 수 (기본 3, 범위 1~10)
  max_participants: number    // 최대 참가자 (기본 20)
  results_visible: boolean    // 투표 결과 공개 여부 (기본 false)
  vote_mode: 'cluster' | 'note'  // 투표 대상 모드 (기본 'cluster'). 퍼실리테이터가 선택
  timer_minutes: number | null    // 단계별 타이머 시간(분). null이면 타이머 미사용 (기본 null, 범위 1~60)
}
```

### participants
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 참가자 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 → workshops.id (ON DELETE CASCADE) |
| user_id | uuid (FK, nullable) | Supabase Auth user ID (퍼실리테이터만 값 있음) |
| name | text | 참가자 이름 |
| role | text | 역할/팀 (선택) |
| is_facilitator | boolean | 퍼실리테이터 여부 |
| joined_at | timestamptz | 참여 시각 |

### process_steps (AS-IS 프로세스 노드)

> 테이블명은 하위 호환을 위해 `process_steps`를 유지한다. BPMN 그래프 모델에서 각 행은 **노드**(Task, Gateway, Event 등)를 나타낸다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 프로세스 노드 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 → workshops.id (ON DELETE CASCADE) |
| name | text | 노드명 (예: "견적 요청 접수", "승인 여부 판단") |
| description | text (nullable) | 노드 상세 설명 |
| node_type | text NOT NULL DEFAULT 'task' | 노드 유형: `task` \| `exclusive_gateway` \| `parallel_gateway` \| `start_event` \| `end_event` \| `intermediate_event` \| `sub_process` |
| order_index | int | 레인 내 정렬 힌트 (0-based) |
| position_x | float (nullable) | 캔버스 X 좌표 (null이면 elkjs 자동 배치) |
| position_y | float (nullable) | 캔버스 Y 좌표 |
| width | float (nullable) | 노드 너비 (sub_process 리사이즈용) |
| height | float (nullable) | 노드 높이 |
| lane_id | uuid (FK, nullable) | 소속 Swimlane 참조 → process_lanes.id (ON DELETE SET NULL) |
| duration_info | text (nullable) | 소요시간 정보 (예: "평균 2시간, 최대 1일") |
| tools_systems | text (nullable) | 사용 도구/시스템 (예: "SAP ERP, Excel, 이메일") |
| volume_info | text (nullable) | 처리량/빈도 (예: "월 200건, 일 평균 10건") |
| created_at | timestamptz | 생성 시각 |

> **제약**: `name`은 CHECK (char_length(name) <= 100). `description`은 CHECK (char_length(description) <= 500). `node_type`은 CHECK (node_type IN ('task','exclusive_gateway','parallel_gateway','start_event','end_event','intermediate_event','sub_process')). 워크샵당 프로세스 노드 최대 **50개** (API에서 검증).

### process_edges (프로세스 간선)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 간선 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 → workshops.id (ON DELETE CASCADE) |
| source_node_id | uuid (FK) | 출발 노드 → process_steps.id (ON DELETE CASCADE) |
| target_node_id | uuid (FK) | 도착 노드 → process_steps.id (ON DELETE CASCADE) |
| label | text (nullable) | 간선 라벨 (예: "Yes", "No", "타임아웃") |
| edge_type | text DEFAULT 'sequence' | `sequence` \| `message` \| `association` |
| created_at | timestamptz | 생성 시각 |

> **제약**: UNIQUE(source_node_id, target_node_id) — 동일 방향 중복 간선 방지. CHECK(source_node_id != target_node_id) — 셀프 루프 방지. `label`은 CHECK (char_length(label) <= 50).

### process_lanes (Swimlane)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 레인 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 → workshops.id (ON DELETE CASCADE) |
| name | text | 레인명 (예: "영업팀", "고객", "시스템") |
| order_index | int | 수직 정렬 순서 (0-based) |
| color | text (nullable) | 레인 배경색 (hex, 예: "#EFF6FF") |
| created_at | timestamptz | 생성 시각 |

> **제약**: `name`은 CHECK (char_length(name) <= 50). 워크샵당 최대 **10개** (API에서 검증).

### editing_locks (Active/Sleep 편집 잠금)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 잠금 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 → workshops.id (ON DELETE CASCADE) |
| resource_type | text | 잠금 대상: `process_graph` \| `design_artifacts` |
| editor_id | uuid (FK) | 현재 Active 편집자 → participants.id (ON DELETE CASCADE) |
| acquired_at | timestamptz DEFAULT now() | 잠금 획득 시각 |

> **제약**: UNIQUE(workshop_id, resource_type) — 리소스당 1인만 Active. CHECK(resource_type IN ('process_graph','design_artifacts')). 편집자 연결 끊김 시 30초 후 서버에서 자동 해제 (presence 기반).

### notes (포스트잇)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 포스트잇 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 → workshops.id (ON DELETE CASCADE) |
| participant_id | uuid (FK) | 작성자 참조 → participants.id (ON DELETE CASCADE) |
| content | text | 포스트잇 내용 |
| color | varchar(20) | 색상 (red/blue/green/yellow) |
| cluster_id | uuid (FK, nullable) | 할당된 클러스터 → clusters.id (ON DELETE SET NULL) |
| process_step_id | uuid (FK, nullable) | 연결된 AS-IS 프로세스 노드 → process_steps.id (ON DELETE SET NULL) |
| position_x | float | 보드 내 X 좌표 |
| position_y | float | 보드 내 Y 좌표 |
| created_at | timestamptz | 생성 시각 |

### clusters
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 클러스터 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 → workshops.id (ON DELETE CASCADE) |
| name | text | 클러스터 이름 (AI가 생성) |
| summary | text | 클러스터 요약 (AI가 생성) |
| color | varchar(20) | 클러스터 표시 색상 |
| order_index | int | 표시 순서 |
| is_stale | boolean | 이전 단계 데이터 변경으로 결과가 최신이 아님 (기본 false) |
| created_at | timestamptz | 생성 시각 |

### votes
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 투표 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 → workshops.id (ON DELETE CASCADE) |
| participant_id | uuid (FK) | 투표자 참조 → participants.id (ON DELETE CASCADE) |
| cluster_id | uuid (FK, nullable) | 투표 대상 클러스터 → clusters.id (ON DELETE CASCADE) |
| note_id | uuid (FK, nullable) | 투표 대상 포스트잇 → notes.id (ON DELETE CASCADE) |
| created_at | timestamptz | 투표 시각 |

> **제약**: `cluster_id`와 `note_id` 중 정확히 하나만 NOT NULL (CHECK 제약). 같은 참가자가 같은 대상에 중복 투표 불가 (UNIQUE 제약: workshop_id + participant_id + cluster_id 또는 workshop_id + participant_id + note_id).

### ax_tasks (AX 과제)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 과제 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 → workshops.id (ON DELETE CASCADE) |
| title | text | 과제명 |
| description | text | 과제 설명 |
| pain_points | jsonb | 연결된 pain point IDs + 텍스트 |
| core_features | jsonb | 핵심 기능 목록 |
| sub_features | jsonb | 부가 기능 목록 |
| expected_impact | text | 예상 효과 |
| difficulty | enum | 구현 난이도 (low/medium/high) |
| priority | int | 우선순위 |
| created_at | timestamptz | 생성 시각 |

### design_artifacts (AX 설계 산출물)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 설계 산출물 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 → workshops.id (ON DELETE CASCADE) |
| tobe_process | jsonb | TO-BE 프로세스 정의 (단계별 자동화 유형, agent 배치) |
| agent_specs | jsonb | Agent 아키텍처/스펙 (Agent별 역할, 입출력, Core/Sub 기능) |
| kpis | jsonb | KPI 정의 (현재값, 목표값, 측정 방법) |
| data_requirements | jsonb | 데이터 요구사항 (필요 데이터, 소스, 형태, 품질, 담당팀) |
| org_requirements | jsonb | 조직적 요건 (부서 간 협업, 교육, 거버넌스) |
| version | int | 버전 번호 |
| is_stale | boolean | 이전 단계 데이터 변경으로 결과가 최신이 아님 (기본 false) |
| created_at | timestamptz | 생성 시각 |
| updated_at | timestamptz | 수정 시각 |

#### tobe_process jsonb 스키마
```typescript
interface ToBeProcess {
  steps: {
    name: string                    // 단계명
    description: string             // 설명
    automation_type: 'full' | 'assisted' | 'human'  // 자동화 유형
    agent_name: string | null       // 배치되는 Agent 이름 (human이면 null)
    agent_role: string | null       // Agent 역할 설명
    input_data: string[]            // 입력 데이터
    output_data: string[]           // 출력 데이터
    time_reduction: string | null   // 예상 시간 절감 (예: "2시간 → 5분")
    asis_step_ids: string[]         // 대응하는 AS-IS 단계 ID(들)
  }[]
}
```

#### agent_specs jsonb 스키마
```typescript
interface AgentSpec {
  name: string               // Agent 이름
  role: string               // 역할/목적
  core_features: string[]    // 핵심 기능
  sub_features: string[]     // 부가 기능
  input_data: string[]       // 필요 입력 데이터
  output_data: string[]      // 산출 데이터
  human_checkpoint: string   // Human-in-the-loop 지점 설명
  related_task_ids: string[] // 연결된 ax_tasks IDs
}
```

#### kpis jsonb 스키마
```typescript
interface Kpi {
  name: string             // KPI 이름 (예: "견적 처리 시간")
  current_value: string    // 현재값 (예: "평균 2시간")
  target_value: string     // 목표값 (예: "평균 5분")
  measurement_method: string // 측정 방법
  related_agent: string    // 관련 Agent
  related_task_id: string  // 관련 과제 ID
}
```

#### data_requirements jsonb 스키마
```typescript
interface DataRequirement {
  data_name: string         // 데이터명 (예: "견적 요청서")
  source: string            // 소스 (예: "SAP ERP")
  format: string            // 형태 (예: "CSV, REST API")
  volume: string            // 규모 (예: "월 5,000건")
  quality_requirements: string // 품질 요건
  responsible_team: string  // 담당 팀/부서
  priority: 'high' | 'medium' | 'low'
}
```

#### org_requirements jsonb 스키마
```typescript
interface OrgRequirement {
  requirement: string      // 요건명
  description: string      // 상세 설명
  category: 'collaboration' | 'training' | 'governance' | 'infrastructure'
  responsible_team: string // 담당 팀/부서
  priority: 'high' | 'medium' | 'low'
  timeline: string         // 예상 일정
}
```

### prds
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | PRD 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 → workshops.id (ON DELETE CASCADE) |
| content | text | PRD 본문 (Markdown) |
| version | int | 버전 번호 |
| is_stale | boolean | 이전 단계 데이터 변경으로 결과가 최신이 아님 (기본 false) |
| created_at | timestamptz | 생성 시각 |
| updated_at | timestamptz | 수정 시각 |

### ax_reports (AX 종합 보고서)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 보고서 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 → workshops.id (ON DELETE CASCADE) |
| content | text | 보고서 본문 (Markdown, 최대 80,000자) |
| version | int | 버전 번호 |
| is_stale | boolean | 이전 단계 데이터 변경으로 결과가 최신이 아님 (기본 false) |
| created_at | timestamptz | 생성 시각 |
| updated_at | timestamptz | 수정 시각 |

### task_reactions (참석자 이모지 반응)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 반응 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 → workshops.id (ON DELETE CASCADE) |
| task_id | uuid (FK, nullable) | 대상 과제 → ax_tasks.id (ON DELETE CASCADE) |
| prd_id | uuid (FK, nullable) | 대상 PRD → prds.id (ON DELETE CASCADE) |
| participant_id | uuid (FK) | 반응자 → participants.id (ON DELETE CASCADE) |
| reaction_type | varchar(10) | 반응 유형: 'agree' 또는 'concern' |
| created_at | timestamptz | 생성 시각 |

> **제약**: `task_id`와 `prd_id` 중 정확히 하나만 NOT NULL (CHECK 제약). 동일 참가자가 동일 대상에 중복 반응 불가 (UNIQUE: participant_id + task_id 또는 participant_id + prd_id). 반응 변경은 DELETE + INSERT (upsert).

### ERD 관계

```
projects 1──N workshops        (workshop.project_id → projects.id)
workshops 1──N participants
workshops 1──N process_steps   (process_step.workshop_id → workshops.id)
workshops 1──N notes
workshops 1──N clusters
workshops 1──N votes
workshops 1──N ax_tasks
workshops 1──N design_artifacts
workshops 1──N prds
workshops 1──N ax_reports
workshops 1──N task_reactions
process_steps 1──N notes       (note.process_step_id → process_steps.id, nullable)
clusters  1──N notes           (note.cluster_id → clusters.id)
clusters  1──N votes           (vote.cluster_id → clusters.id, vote_mode='cluster')
notes     1──N votes           (vote.note_id → notes.id, vote_mode='note')
participants 1──N notes        (note.participant_id → participants.id)
participants 1──N votes        (vote.participant_id → participants.id)
participants 1──N task_reactions (task_reaction.participant_id → participants.id)
ax_tasks 1──N task_reactions   (task_reaction.task_id → ax_tasks.id)
prds     1──N task_reactions   (task_reaction.prd_id → prds.id)
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

### API 요청/응답 예시

#### 워크샵 생성

```bash
curl -X POST http://localhost:3000/api/workshops \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=<facilitator_jwt>" \
  -d '{
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "1차 워크샵",
    "settings": {
      "anonymous": false,
      "votes_per_person": 3,
      "max_participants": 15,
      "results_visible": false,
      "vote_mode": "cluster",
      "timer_minutes": null
    }
  }'
```

```json
// 201 Created
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "1차 워크샵",
    "invite_code": "AB3D7K",
    "current_stage": "context",
    "is_processing": false,
    "settings": {
      "anonymous": false,
      "votes_per_person": 3,
      "max_participants": 15,
      "results_visible": false,
      "vote_mode": "cluster",
      "timer_minutes": null
    },
    "created_at": "2026-04-24T09:00:00.000Z",
    "facilitator_participant": {
      "id": "f1a2b3c4-d5e6-7890-abcd-ef1234567891",
      "display_name": "김퍼실",
      "is_facilitator": true
    }
  }
}
```

#### 참석자 참여 (초대 코드)

```bash
curl -X POST http://localhost:3000/api/workshops/join \
  -H "Content-Type: application/json" \
  -d '{
    "invite_code": "AB3D7K",
    "name": "김참석"
  }'
```

```json
// 200 OK (Set-Cookie: participant_session=<signed_value>; HttpOnly; Secure; SameSite=Lax; Max-Age=86400)
{
  "data": {
    "workshop_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "participant_id": "f1e2d3c4-b5a6-7890-fedc-ba0987654321",
    "name": "김참석",
    "is_facilitator": false
  }
}
```

#### 포스트잇 생성

```bash
curl -X POST http://localhost:3000/api/notes \
  -H "Content-Type: application/json" \
  -H "Cookie: participant_session=<signed_value>" \
  -d '{
    "workshop_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "content": "수작업이 너무 많아서 시간이 낭비된다",
    "color": "red",
    "position_x": 120.5,
    "position_y": 300.0
  }'
```

```json
// 201 Created
{
  "data": {
    "id": "note-uuid-1234",
    "workshop_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "participant_id": "f1e2d3c4-b5a6-7890-fedc-ba0987654321",
    "content": "수작업이 너무 많아서 시간이 낭비된다",
    "color": "red",
    "cluster_id": null,
    "position_x": 120.5,
    "position_y": 300.0,
    "created_at": "2026-04-24T09:15:00.000Z"
  }
}
```

#### AI 클러스터링

```bash
curl -X POST http://localhost:3000/api/ai/cluster \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=<facilitator_jwt>" \
  -d '{
    "workshop_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }'
```

```json
// 200 OK
{
  "data": {
    "clusters": [
      {
        "id": "cluster-uuid-001",
        "name": "프로세스 비효율",
        "summary": "수작업 중심의 업무 처리로 인한 시간 낭비와 오류 발생",
        "note_ids": ["note-uuid-1234", "note-uuid-5678"],
        "order_index": 0
      },
      {
        "id": "cluster-uuid-002",
        "name": "커뮤니케이션 단절",
        "summary": "부서 간 정보 공유 부재로 인한 업무 지연",
        "note_ids": ["note-uuid-9012"],
        "order_index": 1
      }
    ]
  }
}
```

#### 에러 응답 예시

에러 코드 상수는 `src/lib/api/response.ts`에 정의한다.

| HTTP | 에러 코드 | 의미 | 예시 메시지 |
|------|----------|------|-------------|
| 400 | `VALIDATION_ERROR` | Zod 검증 실패, 입력 형식 오류 | "content는 1자 이상 200자 이하여야 합니다" |
| 401 | `UNAUTHORIZED` | 세션 없음, 서명 검증 실패, 만료 | "유효하지 않은 세션입니다" |
| 403 | `FORBIDDEN` | 권한 부족 (참석자가 퍼실리테이터 액션 시도 등) | "퍼실리테이터만 수행할 수 있습니다" |
| 403 | `STAGE_LOCKED` | 현재 단계에서 허용되지 않는 쓰기 | "이 단계에서는 포스트잇을 수정할 수 없습니다" |
| 404 | `NOT_FOUND` | 리소스 미존재 | "워크샵을 찾을 수 없습니다" |
| 409 | `CONFLICT` | 비즈니스 규칙 충돌 (활성 워크샵 중복 등) | "이 프로젝트에 이미 활성 워크샵이 존재합니다" |
| 409 | `PROCESSING` | AI 처리 중 중복 호출 | "AI가 이미 처리 중입니다. 완료 후 다시 시도해주세요" |
| 409 | `VOTE_LIMIT` | 투표 수 초과 | "투표 가능한 수를 초과했습니다 (최대 3표)" |
| 409 | `PARTICIPANT_LIMIT` | 참가자 수 초과 | "최대 참가자 수에 도달했습니다" |
| 409 | `NOTE_LIMIT` | 포스트잇 수 초과 | "포스트잇은 최대 200개까지 작성할 수 있습니다" |
| 409 | `STALE_LOCK` | is_processing이 5분 초과로 stale 상태 | "이전 AI 처리가 비정상 종료되었습니다. 다시 시도해주세요" |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류, DB 장애, 예상치 못한 예외 | "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요" |

```json
// 400 Bad Request — 입력 검증 실패
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "content는 1자 이상 200자 이하여야 합니다"
  }
}

// 401 Unauthorized — 인증 실패
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "유효하지 않은 세션입니다"
  }
}

// 403 Forbidden — 권한 없음
{
  "error": {
    "code": "FORBIDDEN",
    "message": "퍼실리테이터만 수행할 수 있습니다"
  }
}

// 403 Forbidden — 단계 잠금
{
  "error": {
    "code": "STAGE_LOCKED",
    "message": "이 단계에서는 포스트잇을 수정할 수 없습니다"
  }
}

// 404 Not Found — 리소스 미존재
{
  "error": {
    "code": "NOT_FOUND",
    "message": "워크샵을 찾을 수 없습니다"
  }
}

// 409 Conflict — 중복/충돌
{
  "error": {
    "code": "CONFLICT",
    "message": "이 프로젝트에 이미 활성 워크샵이 존재합니다"
  }
}

// 409 Conflict — AI 처리 중
{
  "error": {
    "code": "PROCESSING",
    "message": "AI가 이미 처리 중입니다. 완료 후 다시 시도해주세요"
  }
}

// 409 Conflict — 투표 초과
{
  "error": {
    "code": "VOTE_LIMIT",
    "message": "투표 가능한 수를 초과했습니다 (최대 3표)"
  }
}

// 409 Conflict — 참가자 초과
{
  "error": {
    "code": "PARTICIPANT_LIMIT",
    "message": "최대 참가자 수에 도달했습니다"
  }
}

// 409 Conflict — 포스트잇 초과
{
  "error": {
    "code": "NOTE_LIMIT",
    "message": "포스트잇은 최대 200개까지 작성할 수 있습니다"
  }
}

// 500 Internal Server Error — 서버 오류
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요"
  }
}
```

### 엔드포인트별 에러 코드 매핑

주요 API 엔드포인트가 반환할 수 있는 에러 코드 매트릭스:

| 엔드포인트 | 400 VALIDATION | 401 UNAUTH | 403 FORBIDDEN | 403 STAGE_LOCKED | 404 NOT_FOUND | 409 CONFLICT | 409 PROCESSING | 409 VOTE_LIMIT | 409 PARTICIPANT_LIMIT | 409 NOTE_LIMIT | 409 STALE_LOCK | 500 |
|-----------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `POST /api/workshops/join` | ✓ | — | — | — | ✓ | — | — | — | ✓ | — | — | ✓ |
| `POST /api/notes` | ✓ | ✓ | — | ✓ | ✓ | — | — | — | — | ✓ | — | ✓ |
| `PATCH /api/notes/:id` | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | — | ✓ |
| `DELETE /api/notes/:id` | — | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | — | ✓ |
| `POST /api/votes` | ✓ | ✓ | — | ✓ | ✓ | ✓ | — | ✓ | — | — | — | ✓ |
| `DELETE /api/votes/:id` | — | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | — | ✓ |
| `POST /api/ai/cluster` | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | — | — | — | ✓ | ✓ |
| `POST /api/ai/design` | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | — | — | — | ✓ | ✓ |
| `POST /api/ai/prd` | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | — | — | — | ✓ | ✓ |
| `POST /api/ai/report` | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | — | — | — | ✓ | ✓ |
| `PATCH /api/workshops/:id/stage` | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | — | — | — | — | ✓ |
| `POST /api/process-steps` | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | — | ✓ |
| `PATCH /api/workshops/:id/settings` | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | — | ✓ |

> **참고**: 모든 인증 필수 엔드포인트는 401 UNAUTHORIZED를 반환할 수 있다. 퍼실리테이터 전용 엔드포인트(AI, 단계 전진, 설정)는 403 FORBIDDEN을 반환한다.

## API 미들웨어 패턴

모든 API Route에서 반복되는 세션 검증/권한 확인을 공통 헬퍼로 추출한다:

```typescript
// src/lib/api/middleware.ts

/** 참석자 쿠키 세션 또는 퍼실리테이터 Auth 세션으로 인증된 사용자 컨텍스트 */
interface AuthContext {
  workshopId: string               // 요청 대상 워크샵 ID
  participantId: string            // participants 테이블의 id
  userId: string | null            // Supabase Auth user ID (퍼실리테이터만 값 있음, 참석자는 null)
  isFacilitator: boolean           // participants.is_facilitator
  participantName: string          // participants.name
}

/** 퍼실리테이터 전용 컨텍스트 (Supabase Auth 세션 필수) */
interface FacilitatorContext {
  workshopId: string               // 요청 대상 워크샵 ID
  participantId: string            // participants 테이블의 id
  userId: string                   // Supabase Auth user ID (항상 존재)
  facilitatorId: string            // workshops.facilitator_id와 일치 검증됨
  isFacilitator: true              // 항상 true
  participantName: string          // participants.name
}

// 세션 검증: 참석자 쿠키 세션 또는 퍼실리테이터 Supabase Auth 세션 모두 검증
// 반드시 해당 워크샵의 participants 테이블에 존재하는지까지 확인
async function withAuth(
  req: NextRequest,
  handler: (ctx: AuthContext) => Promise<NextResponse>
): Promise<NextResponse>

// 퍼실리테이터 검증: Supabase Auth 세션만 검증 (is_facilitator + user_id 확인)
// workshops.facilitator_id와 Auth user ID가 일치하는지 검증
async function withFacilitator(
  req: NextRequest,
  handler: (ctx: FacilitatorContext) => Promise<NextResponse>
): Promise<NextResponse>
```

### 미들웨어 검증 순서

```
withAuth:
  1. Cookie에서 participant_session (signed) 또는 Supabase Auth JWT 추출
  2. signed cookie → HMAC 서명 검증 → workshop_id + participant_id 추출
  3. Supabase Auth → getUser()로 재검증 (getSession()만으로 판단 금지)
  4. participants 테이블에서 해당 participant 존재 확인
  5. AuthContext 구성 → handler 호출

withFacilitator:
  1. Supabase Auth JWT만 허용 (signed cookie 불가)
  2. getUser()로 Auth user 재검증
  3. participants 테이블에서 is_facilitator=true 확인
  4. workshops.facilitator_id와 Auth user ID 일치 확인
  5. FacilitatorContext 구성 → handler 호출
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

### CSRF 방어 전략

MVP에서는 명시적 CSRF 토큰을 사용하지 않는다. 다음 조건으로 충분한 방어가 보장된다:

1. **SameSite=Lax 쿠키**: 크로스 오리진 POST 요청에 쿠키가 전송되지 않음
2. **JSON Content-Type**: 모든 API Route는 `application/json` body를 요구. HTML `<form>`으로는 JSON body를 전송할 수 없어 암묵적 CSRF 방어
3. **Same-Origin API**: Next.js API Route는 동일 도메인에서만 호출. CORS 허용 없음
4. **쓰기 작업 제한**: GET으로 상태 변경 없음. 모든 mutation은 POST/PATCH/DELETE

Post-MVP에서 double-submit cookie 패턴 도입 검토 (CSRF 토큰 쿠키 + 헤더 비교).

### RLS 정책 설계

**원칙**: anon key를 사용하는 브라우저 클라이언트는 **읽기만 최소 허용**, 쓰기는 **전면 차단**. 모든 쓰기는 API Route(service role)가 수행한다.

**Guest(참석자) Realtime 접근**: Guest는 Supabase Auth JWT가 없으므로 `auth.uid() = NULL`이다. Realtime CDC 수신을 위해 워크샵 데이터 테이블의 SELECT 정책은 `USING (TRUE)`로 설정하여 anon key로도 읽기를 허용한다. 이는 보안 위험이 아닌 이유:
1. anon key는 RLS SELECT만 통과 — INSERT/UPDATE/DELETE 정책이 없으므로 쓰기는 불가
2. Realtime 채널 필터에 `workshop_id`를 명시하여 타 워크샵 데이터 구독 불가
3. 민감 데이터(투표 결과 등)는 API Route에서 `results_visible` 설정으로 이중 필터링
4. `projects` 테이블만 퍼실리테이터 전용 (`auth.uid()` 기반 정책 유지)

```sql
-- ============================================================
-- 공통: 모든 테이블에 RLS 활성화
-- ============================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_lanes ENABLE ROW LEVEL SECURITY;
ALTER TABLE editing_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ax_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prds ENABLE ROW LEVEL SECURITY;
ALTER TABLE ax_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_reactions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- projects: 퍼실리테이터 본인 소유만 조회 허용
-- ============================================================
CREATE POLICY "facilitator_select_own_projects"
  ON projects FOR SELECT
  USING (facilitator_id = auth.uid());

-- anon/guest는 projects 접근 불가 (API Route가 필요시 service role로 조회)

-- ============================================================
-- workshops: Realtime CDC 구독을 위한 SELECT 허용 (anon key 포함)
-- Guest는 auth.uid()=NULL이므로 TRUE 기반 정책 필요
-- 쓰기 정책 없음 = INSERT/UPDATE/DELETE 차단
-- ============================================================
CREATE POLICY "anyone_select_workshop"
  ON workshops FOR SELECT
  USING (TRUE);

-- ============================================================
-- participants: 워크샵 참가자 조회 허용 (presence용, anon key 포함)
-- ============================================================
CREATE POLICY "anyone_select_participants"
  ON participants FOR SELECT
  USING (TRUE);

-- ============================================================
-- notes: SELECT 허용 (Realtime CDC용, anon key 포함)
-- ============================================================
CREATE POLICY "anyone_select_notes"
  ON notes FOR SELECT
  USING (TRUE);

-- ============================================================
-- clusters: SELECT 허용 (anon key 포함)
-- ============================================================
CREATE POLICY "anyone_select_clusters"
  ON clusters FOR SELECT
  USING (TRUE);

-- ============================================================
-- votes: SELECT 허용 (anon key 포함)
-- 투표 결과 가시성(results_visible)은 API 계층에서 제어
-- ============================================================
CREATE POLICY "anyone_select_votes"
  ON votes FOR SELECT
  USING (TRUE);

-- ============================================================
-- ax_tasks: SELECT 허용 (anon key 포함)
-- ============================================================
CREATE POLICY "anyone_select_tasks"
  ON ax_tasks FOR SELECT
  USING (TRUE);

-- ============================================================
-- prds: SELECT 허용 (anon key 포함)
-- ============================================================
CREATE POLICY "anyone_select_prds"
  ON prds FOR SELECT
  USING (TRUE);

-- ============================================================
-- task_reactions: SELECT 허용 (anon key 포함)
-- ============================================================
CREATE POLICY "anyone_select_reactions"
  ON task_reactions FOR SELECT
  USING (TRUE);

-- ============================================================
-- process_steps: SELECT 허용 (anon key 포함)
-- ============================================================
CREATE POLICY "anyone_select_process_steps"
  ON process_steps FOR SELECT
  USING (TRUE);

-- ============================================================
-- process_edges: SELECT 허용 (anon key 포함)
-- ============================================================
CREATE POLICY "anyone_select_process_edges"
  ON process_edges FOR SELECT
  USING (TRUE);

-- ============================================================
-- process_lanes: SELECT 허용 (anon key 포함)
-- ============================================================
CREATE POLICY "anyone_select_process_lanes"
  ON process_lanes FOR SELECT
  USING (TRUE);

-- ============================================================
-- editing_locks: SELECT 허용 (anon key 포함)
-- ============================================================
CREATE POLICY "anyone_select_editing_locks"
  ON editing_locks FOR SELECT
  USING (TRUE);

-- ============================================================
-- design_artifacts: SELECT 허용 (anon key 포함)
-- ============================================================
CREATE POLICY "anyone_select_design_artifacts"
  ON design_artifacts FOR SELECT
  USING (TRUE);

-- ============================================================
-- ax_reports: SELECT 허용 (anon key 포함)
-- ============================================================
CREATE POLICY "anyone_select_ax_reports"
  ON ax_reports FOR SELECT
  USING (TRUE);

-- ============================================================
-- 모든 테이블: INSERT/UPDATE/DELETE는 기본 차단
-- API Route가 service role client로 수행
-- ============================================================
-- (별도 INSERT/UPDATE/DELETE 정책을 만들지 않음 = 기본 차단)
```

**guest(signed cookie) 참석자의 Realtime 접근**: Guest는 Supabase Auth JWT가 없으므로 `auth.uid() = NULL`이다. 위 RLS 정책에서 워크샵 데이터 테이블은 `USING (TRUE)` SELECT를 허용하여, anon key로도 Realtime CDC를 수신할 수 있다. 보안은 다음과 같이 보장한다:
- Realtime 채널 필터에 `workshop_id`를 명시하여 타 워크샵 데이터 유출 방지
- 투표 결과(`results_visible=false` 시)는 API에서만 반환하고, Realtime CDC는 투표 존재 알림만 전파
- `projects` 테이블만 퍼실리테이터 전용 (`auth.uid()` 기반 정책 유지)
- INSERT/UPDATE/DELETE 정책이 없으므로 anon key로 쓰기는 완전 차단

> **보안 참고 — USING(TRUE) SELECT의 데이터 격리 한계**: anon key + `USING(TRUE)` SELECT 조합은 기술적으로 workshop_id를 알면 타 워크샵의 Realtime CDC를 수신할 수 있다. 이는 MVP에서 허용 가능한 트레이드오프이다. 근거: (1) workshop_id는 UUID v4로 추측 불가 (2) 쓰기는 완전 차단 (3) 민감 데이터(투표 결과)는 API 전용 반환 (4) 초대 코드는 workshop_id가 아닌 별도 6자리 코드. Post-MVP에서 JWT claims에 workshop_id를 포함하여 `auth.jwt() ->> 'workshop_id'` 기반 RLS로 강화 가능 (ADR-020 참조).

### API + RLS 이중 보호 요약

| 경로 | RLS (anon key) | API Route (service role) |
|------|----------------|--------------------------|
| 워크샵 데이터 읽기 | SELECT 허용 (참가자 범위) | withAuth로 세션 검증 |
| 포스트잇 생성/수정/삭제 | INSERT/UPDATE/DELETE 차단 | withAuth + stage lock + 소유권 검증 |
| 투표 | INSERT/DELETE 차단 | withAuth + stage lock + 투표 수 검증 |
| 클러스터 수정 | UPDATE 차단 | withFacilitator |
| AI 트리거 | 해당 없음 | withFacilitator + is_processing lock |
| 단계 전환 | UPDATE 차단 | withFacilitator + 사전조건 검증 |

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
| `workshop:{id}` | workshops 테이블 변경 | 단계 전환, 설정 변경, 타이머 알림 |
| `process_steps:{workshop_id}` | process_steps 테이블 INSERT/UPDATE/DELETE | AS-IS 프로세스 노드 실시간 동기화 |
| `process_edges:{workshop_id}` | process_edges 테이블 INSERT/UPDATE/DELETE | 프로세스 간선 실시간 동기화 |
| `process_lanes:{workshop_id}` | process_lanes 테이블 INSERT/UPDATE/DELETE | Swimlane 실시간 동기화 |
| `editing_locks:{workshop_id}` | editing_locks 테이블 INSERT/UPDATE/DELETE | Active/Sleep 편집 잠금 상태 전파 |
| `notes:{workshop_id}` | notes 테이블 INSERT/UPDATE/DELETE | 포스트잇 실시간 동기화 |
| `clusters:{workshop_id}` | clusters 테이블 변경 | 클러스터 생성/수정 알림 |
| `votes:{workshop_id}` | votes 테이블 INSERT/DELETE | 투표 실시간 집계 |
| `reactions:{workshop_id}` | task_reactions 테이블 INSERT/DELETE | 과제·PRD 이모지 반응 동기화 |
| `design:{workshop_id}` | ax_tasks, design_artifacts, prds, ax_reports 테이블 변경 | 설계/산출물 변경 동기화 (Design → Generate → Report) |
| `presence:{workshop_id}` | Supabase Presence | 참석자 온라인 상태 + 타이머 broadcast |

### 채널별 이벤트 페이로드 스키마

각 Realtime 채널이 전달하는 이벤트의 페이로드 구조를 정의한다.

#### 공통 CDC 이벤트 구조

```typescript
interface RealtimePayload<T> {
  schema: 'public'
  table: string
  commit_timestamp: string   // ISO 8601
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: T | null              // INSERT/UPDATE 시 변경 후 레코드
  old: { id: string } | null // UPDATE/DELETE 시 변경 전 레코드 (PK만)
}
```

#### `workshop:{id}` — 워크샵 상태 변경

```typescript
// 구독 필터: postgres_changes, table='workshops', filter=`id=eq.${workshopId}`
// 수신 이벤트: UPDATE
type WorkshopEvent = RealtimePayload<{
  id: string
  current_stage: 'context' | 'gather' | 'cluster' | 'vote' | 'design' | 'generate' | 'report' | 'completed'
  is_processing: boolean
  is_processing_since: string | null
  settings: WorkshopSettings
  updated_at: string
}>
```

사용: 단계 전환 감지, AI 처리 상태 변경, 설정 변경(results_visible 등)

#### `notes:{workshop_id}` — 포스트잇 변경

```typescript
// 구독 필터: postgres_changes, table='notes', filter=`workshop_id=eq.${workshopId}`
// 수신 이벤트: INSERT, UPDATE, DELETE
type NoteEvent = RealtimePayload<{
  id: string
  workshop_id: string
  participant_id: string
  content: string
  color: string
  cluster_id: string | null
  process_step_id: string | null
  position_x: number
  position_y: number
  reactions: number
  created_at: string
}>
```

사용: 포스트잇 실시간 동기화. Yjs가 tldraw shape 동기화를 담당하고, 이 채널은 DB 상태 동기화용.

#### `clusters:{workshop_id}` — 클러스터 변경

```typescript
// 구독 필터: postgres_changes, table='clusters', filter=`workshop_id=eq.${workshopId}`
// 수신 이벤트: INSERT, UPDATE, DELETE
type ClusterEvent = RealtimePayload<{
  id: string
  workshop_id: string
  name: string
  summary: string
  color: string
  order_index: number
  created_at: string
}>
```

사용: AI 클러스터링 완료 시 결과 전파, 퍼실리테이터의 클러스터명 편집 반영

#### `votes:{workshop_id}` — 투표 변경

```typescript
// 구독 필터: postgres_changes, table='votes', filter=`workshop_id=eq.${workshopId}`
// 수신 이벤트: INSERT, DELETE
type VoteEvent = RealtimePayload<{
  id: string
  workshop_id: string
  participant_id: string
  target_type: 'note' | 'cluster'
  target_id: string
  created_at: string
}>
```

사용: 투표/투표 취소 실시간 반영. `results_visible=false`일 때는 클라이언트에서 집계를 표시하지 않음 (이벤트 자체는 수신).

#### `presence:{workshop_id}` — 접속 상태

```typescript
// Supabase Presence (CDC가 아닌 별도 프로토콜)
interface PresenceState {
  participant_id: string
  name: string
  is_facilitator: boolean
  online_at: string   // ISO 8601
}
// 이벤트: sync, join, leave
```

사용: ParticipantList 온라인/오프라인 표시, 접속자 수 표시

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

### 헬스 체크
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/health | Liveness 체크 (인증 불필요). 응답: `{ data: { status: "ok", timestamp: ISO8601 } }`. Azure App Service 및 Docker 컨테이너 헬스 체크에 사용 |

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
| POST | /api/workshops | 워크샵 생성 (withFacilitator). body에 title, description(선택), settings 포함 |
| GET | /api/workshops?project_id=:id | 프로젝트 내 워크샵 목록 (withFacilitator) |
| GET | /api/workshops/:id | 워크샵 조회 (withAuth) |
| PATCH | /api/workshops/:id | 워크샵 수정 (withFacilitator) |
| DELETE | /api/workshops/:id | 워크샵 삭제 (withFacilitator, completed 또는 gather+노트0개일 때만) |
| POST | /api/workshops/join | 초대 코드로 참여 (게스트) |
| GET | /api/workshops/preview?code=:code | 초대 코드로 워크샵 미리보기 (인증 불요). 제목/description/현재단계/참가자수 반환 |
| POST | /api/workshops/:id/advance-stage | 단계 전진 (withFacilitator). body: `{ expected_stage }`. 사전조건 검증 후 `current_stage`를 다음 단계로 UPDATE. optimistic locking: WHERE current_stage = expected_stage. 영향 행 0이면 409 |
| PATCH | /api/workshops/:id/dismiss-stale | stale 경고 디스미스 (withFacilitator). body: `{ tables: ('clusters' | 'design_artifacts' | 'prds' | 'ax_reports')[] }`. Zod: `z.object({ tables: z.array(z.enum(['clusters','design_artifacts','prds','ax_reports'])).min(1) })`. 지정된 테이블의 is_stale = false 설정. AI 재실행 없이 경고만 해제. 성공: 200 `{ data: { dismissed: string[] } }`. 대상 테이블에 stale 행이 없으면 무시 (멱등) |

### 포스트잇
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/notes?workshop_id=:id | 워크샵의 모든 포스트잇 조회 |
| POST | /api/notes | 포스트잇 생성 |
| PATCH | /api/notes/:id | 포스트잇 수정 (내용, 위치, 클러스터 변경) |
| DELETE | /api/notes/:id | 포스트잇 삭제 |

### 클러스터
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/clusters?workshop_id=:id | 워크샵의 클러스터 목록 |
| PATCH | /api/clusters/:id | 클러스터 수정 (이름, 순서) |

### 투표
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/votes | 투표 (body에 cluster_id 또는 note_id. vote_mode에 따라 검증) |
| DELETE | /api/votes/:id | 투표 취소 |
| GET | /api/votes/results?workshop_id=:id | 투표 결과 조회 |
| GET | /api/votes/stats?workshop_id=:id | 투표 참여율 조회 (withFacilitator). 응답: { total_participants, voted_count, votes_cast } |

### AX 과제
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/tasks?workshop_id=:id | 과제 목록 |
| PATCH | /api/tasks/:id | 과제 수정 |
| DELETE | /api/tasks/:id | 과제 삭제 (withFacilitator) |

### 프로세스 노드
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/process-steps?workshop_id=:id | 프로세스 노드 목록 (withAuth) |
| POST | /api/process-steps | 노드 추가 (withAuth, context 단계, **Active 편집자만**) |
| PATCH | /api/process-steps/:id | 노드 수정 (withAuth, context 단계, **Active 편집자만**) |
| DELETE | /api/process-steps/:id | 노드 삭제 (withAuth, context 단계, **Active 편집자만**) |

### 프로세스 간선
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/process-edges?workshop_id=:id | 간선 목록 (withAuth) |
| POST | /api/process-edges | 간선 추가 (withAuth, context 단계, Active 편집자만) |
| PATCH | /api/process-edges/:id | 간선 수정 (withAuth, context 단계, Active 편집자만) |
| DELETE | /api/process-edges/:id | 간선 삭제 (withAuth, context 단계, Active 편집자만) |

### Swimlane
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/process-lanes?workshop_id=:id | 레인 목록 (withAuth) |
| POST | /api/process-lanes | 레인 추가 (withAuth, context 단계, Active 편집자만) |
| PATCH | /api/process-lanes/:id | 레인 수정 (withAuth, context 단계, Active 편집자만) |
| DELETE | /api/process-lanes/:id | 레인 삭제 (withAuth, context 단계, Active 편집자만) |

### 프로세스 그래프 통합
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/process-graph?workshop_id=:id | 노드+간선+레인+편집잠금 통합 조회 (withAuth). React Flow `{nodes, edges}` 형식 반환 |

### 편집 잠금 (Active/Sleep)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/editing-locks?workshop_id=:id | 현재 잠금 상태 조회 (withAuth) |
| POST | /api/editing-locks | 잠금 획득/전환 (withAuth). body: { workshop_id, resource_type }. 기존 잠금 있으면 전환 |
| DELETE | /api/editing-locks/:id | 잠금 해제 (withAuth 본인) 또는 강제 회수 (withFacilitator) |

### Design 산출물
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/design-artifacts?workshop_id=:id | Design 산출물 조회 (withAuth) |
| PATCH | /api/design-artifacts/:id | Design 산출물 수정 (withFacilitator, design 단계에서만) |

### 반응 (Reactions)
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/reactions | 이모지 반응 추가 (withAuth). body: { task_id?또는 prd_id?, reaction_type: 'agree'\|'concern' } |
| DELETE | /api/reactions/:id | 반응 취소 (withAuth, 본인만) |
| GET | /api/reactions?workshop_id=:id | 워크샵 전체 반응 조회 (withAuth). 과제별/PRD별 집계 포함 |

### PRD
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/prd?workshop_id=:id | PRD 조회 |
| PATCH | /api/prd/:id | PRD 수정 |

### AX 종합 보고서
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/reports?workshop_id=:id | 보고서 조회 (withAuth) |
| PATCH | /api/reports/:id | 보고서 수정 (withFacilitator, report 단계에서만) |

### AI
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/ai/cluster | AI 클러스터링 실행 |
| POST | /api/ai/design | AI Design 실행 (TO-BE + Agent + KPI + Data + Org + Tasks) |
| POST | /api/ai/generate | AI PRD 생성 |
| POST | /api/ai/report | AI 종합 보고서 생성 |

## AI 파이프라인

### 공통 설정
- **API**: Azure OpenAI (GPT-4o)
- **JSON Mode**: 모든 AI 호출은 structured output (JSON) 사용
- **서버사이드 전용**: 클라이언트에서 직접 호출하지 않음
- **타임아웃**: 클러스터링 30초, Design 30초, PRD 생성 60초, 종합 보고서 60초
- **재시도**: 최대 2회 (1초, 2초 exponential backoff)
- **토큰 가드레일**: 클러스터링 2000, Design 4000, PRD 생성 8000, 종합 보고서 10000
- **응답 검증**: `src/lib/ai/schemas.ts`의 Zod 스키마로 파싱하고, 각 호출별 사후 무결성 검증을 통과해야 DB에 반영한다.

### AI 재실행 (병합) 전략

모든 AI 호출은 재실행이 가능하다. 기존 결과를 보존하면서 새 결과를 병합하는 전략을 사용한다.

#### 클러스터링 재실행
- **입력**: `cluster_id IS NULL`인 미할당 노트만 대상. 이미 클러스터에 할당된 노트는 변경하지 않음
- **프롬프트 컨텍스트**: 기존 클러스터 목록(이름+요약)을 프롬프트에 포함하여, AI가 기존 클러스터에 추가 할당하거나 새 클러스터를 생성할 수 있도록 함
- **DB 반영**: 새 클러스터는 INSERT, 기존 클러스터에 추가 할당은 notes.cluster_id UPDATE
- **전제조건**: 미할당 노트 ≥ 1
- **UI**: "미할당 노트 N개를 대상으로 재분석합니다" 안내 모달

#### Design 재실행
- **입력**: 전체 AS-IS 프로세스 + 투표 결과 + 기존 Design 산출물
- **프롬프트 컨텍스트**: 기존 과제 목록 + 기존 TO-BE 프로세스를 포함하여, 중복 없이 보완하도록 유도
- **DB 반영**: 기존 design_artifacts를 새 버전으로 INSERT (version+1). 기존 과제는 유지, 새 과제만 추가 INSERT
- **중복 검출**: AI 응답에서 기존 과제와 유사도가 높은 과제가 있으면 Toast로 "유사한 기존 과제가 있습니다" 알림 (자동 제거는 하지 않음)
- **UI**: "기존 설계를 보완하고 추가 과제를 도출합니다" 안내 모달

#### PRD 재생성
- **동작**: 기존 PRD를 새 버전으로 교체. `prds.version + 1`로 새 레코드 INSERT
- **이전 버전**: DB에 보존되지만 MVP에서는 버전 히스토리 UI 없음. `GET /api/prd`는 최신 버전만 반환
- **UI**: "기존 PRD를 새 버전으로 대체합니다 (현재 v{N})" 안내 모달

#### 종합 보고서 재생성
- **동작**: 기존 보고서를 새 버전으로 교체. `ax_reports.version + 1`로 새 레코드 INSERT
- **이전 버전**: DB에 보존, MVP에서는 최신 버전만 표시
- **UI**: "기존 보고서를 새 버전으로 대체합니다 (현재 v{N})" 안내 모달

### 클러스터링 파이프라인

```
입력: notes[] (포스트잇 배열)
  ↓
프롬프트 구성:
  - System: "워크샵 퍼실리테이터로서 포스트잇을 의미 기반으로 클러스터링하라"
  - User: 포스트잇 목록 (id + content + process_step 연결 정보)
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

### AX Design 파이프라인

```
입력: AS-IS 프로세스 그래프 {nodes[], edges[], lanes[]} + 상위 클러스터[] + 포스트잇[] + 투표 결과 + 워크샵 메타데이터
  ↓
프롬프트 구성:
  - System: "AX 컨설턴트이자 AI Agent 아키텍트로서, AS-IS 프로세스와 pain point를 분석하여
    TO-BE AX 프로세스를 설계하고, Agent 아키텍처, KPI, 데이터/조직 요구사항, 과제를 도출하라"
  - User: AS-IS 프로세스 그래프 (노드 유형/연결 관계/Swimlane 포함) + 단계별 매핑된 pain point + 클러스터 + 투표 순위
  ↓
Azure OpenAI 호출 (JSON mode, max_tokens 4000)
  ↓
응답:
  {
    tobe_process: {
      mermaid_dsl: "...",            // TO-BE 프로세스 Mermaid 다이어그램 DSL
      graph: { nodes: [...], edges: [...], lanes: [...] }  // React Flow 형식 구조화 JSON
    },
    agent_specs: [...],                     // Agent별 역할/기능/입출력
    tasks: [...],                           // AX 과제
    kpis: [...],                            // POV 기반 KPI
    data_requirements: [...],               // 필요 데이터/소스/형태
    org_requirements: [...]                 // 조직적 요건
  }
  ↓
DB 반영:
  1. design_artifacts 테이블 INSERT (tobe_process, agent_specs, kpis, data_requirements, org_requirements)
  2. ax_tasks 테이블 INSERT (tasks 배열)
  ↓
Realtime으로 전체 참석자에게 전파
```

### PRD 생성 파이프라인

```
입력: ax_tasks[] + design_artifacts + 워크샵 메타데이터
  ↓
프롬프트 구성:
  - System: "시니어 프로덕트 매니저로서 AX 과제와 Agent 설계를 기반으로 개발 착수용 PRD를 작성하라"
  - User: 과제 목록 + Agent 스펙 + TO-BE 프로세스 + 워크샵 맥락
  ↓
Azure OpenAI 호출 (JSON mode, max_tokens 8000)
  ↓
응답: { content: "PRD 본문 Markdown" }
  ↓
DB 반영: prds 테이블 INSERT
```

### AX 종합 보고서 생성 파이프라인

```
입력: 전체 워크샵 데이터 (프로세스 그래프 {nodes, edges, lanes} + notes + clusters + votes + design_artifacts + ax_tasks + prds)
  ↓
프롬프트 구성:
  - System: "AX 컨설팅 전문가로서, 워크샵 전체 여정의 데이터를 종합하여
    경영진과 AX 엔지니어를 위한 종합 보고서를 작성하라. AS-IS/TO-BE 비교는 Mermaid 다이어그램으로 포함하라"
  - User: AS-IS 프로세스 그래프 + pain point 분석 + TO-BE 설계 (Mermaid + 구조화 JSON) + Agent 스펙 +
    KPI + 데이터/조직 요건 + PRD 요약 + 투표 결과 + 참석자 반응
  ↓
Azure OpenAI 호출 (JSON mode, max_tokens 10000, timeout 60초)
  ↓
응답: { content: "종합 보고서 Markdown" }
  ↓
DB 반영: ax_reports 테이블 INSERT
```

## 상태 관리

Zustand를 사용하여 클라이언트 상태를 관리한다.

### 스토어 구조

```
workshopStore
  - workshop: Workshop | null        # 현재 워크샵 정보
  - participants: Participant[]       # 참석자 목록
  - currentStage: Stage              # 최고 도달 단계 (DB current_stage와 동기화)
  - viewingStage: Stage              # 현재 사용자가 보고 있는 단계 (클라이언트 전용)
  - setStage(stage)                  # 단계 전환 (current_stage 업데이트 시)
  - setViewingStage(stage)           # 열람 단계 전환 (StageNav 클릭 시)

boardStore
  - notes: Note[]                    # 포스트잇 목록
  - addNote(note)                    # 포스트잇 추가 (optimistic)
  - updateNote(id, data)             # 포스트잇 수정
  - removeNote(id)                   # 포스트잇 삭제
  - syncFromRealtime(payload)        # Realtime 이벤트 반영

processGraphStore
  - nodes: ProcessNode[]             # 프로세스 노드 (React Flow Node 형식)
  - edges: ProcessEdge[]             # 프로세스 간선 (React Flow Edge 형식)
  - lanes: ProcessLane[]             # Swimlane 목록
  - editingLock: EditingLock | null  # 현재 편집 잠금 상태
  - isActiveEditor: boolean          # 내가 Active 편집자인지
  - setNodes(nodes)                  # 노드 목록 설정
  - setEdges(edges)                  # 간선 목록 설정
  - onNodesChange(changes)           # React Flow 노드 변경 핸들러
  - onEdgesChange(changes)           # React Flow 간선 변경 핸들러
  - acquireLock(resourceType)        # 편집 잠금 획득
  - releaseLock(resourceType)        # 편집 잠금 해제
  - syncFromRealtime(payload)        # Realtime 이벤트 반영

voteStore
  - votes: Vote[]                    # 투표 목록
  - myVotes: Vote[]                  # 내 투표
  - remainingVotes: number           # 남은 투표 수
  - castVote(targetType, targetId)   # 투표
  - removeVote(voteId)               # 투표 취소
  - results: VoteResult[]            # 집계 결과

designStore
  - designArtifacts: DesignArtifact | null  # 현재 버전 Design 산출물
  - tasks: AxTask[]                         # AX 과제 목록
  - reactions: TaskReaction[]               # 과제·PRD 반응 목록
  - setDesignArtifacts(artifacts)           # Design 산출물 설정
  - addTask(task)                           # 과제 추가
  - updateTask(id, data)                    # 과제 수정
  - removeTask(id)                          # 과제 삭제
  - syncFromRealtime(payload)               # Realtime 이벤트 반영

prdStore
  - prd: Prd | null                  # 현재 버전 PRD
  - setPrd(prd)                      # PRD 설정
  - syncFromRealtime(payload)        # Realtime 이벤트 반영

reportStore
  - report: AxReport | null          # 현재 버전 종합 보고서
  - setReport(report)                # 보고서 설정
  - syncFromRealtime(payload)        # Realtime 이벤트 반영
```

## 에러 처리 · 복원력 전략

> 상세 운영 절차: `docs/OPERATIONS.md` 참조

### 엣지 케이스 시나리오

| # | 시나리오 | 트리거 | 시스템 동작 | 사용자 경험 |
|---|---------|--------|-----------|------------|
| E1 | 참석자 쿠키 만료 후 재참여 | maxAge(24h) 만료 + 동일 초대 코드 재입력 | 새 participant 레코드 생성 (기존과 별개). 기존 포스트잇/투표는 이전 participant_id에 귀속 | "이전 세션의 데이터와 연결되지 않습니다" 안내 표시 |
| E2 | 동시 20명 투표 경합 | 다수 참석자가 거의 동시에 투표 | DB UNIQUE 제약으로 중복 방지. votes_per_person 초과 시 409 `VOTE_LIMIT`. 클라이언트 optimistic update 실패 시 롤백 + Toast | 일시적 "투표 반영 중..." → 성공/실패 피드백 |
| E3 | 퍼실리테이터 편집 권한 회수 | 퍼실리테이터가 "회수" 버튼 클릭 | POST /api/editing-locks → 즉시 lock 전환 (딜레이 없음). Realtime `editing_locks` CDC로 전파 | 이전 편집자: Toast "편집 권한이 [이름]에게 이전되었습니다" + 입력 필드 readonly 전환. 새 편집자: 편집 UI 활성화 |
| E4 | 다중 탭 동시 접속 | 참석자가 2+ 브라우저 탭으로 동일 워크샵 접속 | 쿠키 공유로 동일 세션. Yjs CRDT 자동 동기화 (탭 간 충돌 없음). Supabase Realtime 채널 중복 구독 (안전). Presence: 탭 수와 무관하게 단일 온라인 표시 | 모든 탭에서 동일 상태. 한 탭에서 수정 → 다른 탭 즉시 반영 |
| E5 | AI 처리 중 퍼실리테이터 브라우저 크래시 | AI 호출 진행 중 브라우저 종료 | AI API는 서버사이드에서 실행 중이므로 완료될 수 있음. is_processing = true 유지. 5분 초과 시 stale lock으로 자동 복구 (is_processing_since 기반) | 재접속 시: 처리 완료됐으면 결과 표시. 미완료면 is_processing 상태 → 5분 후 재시도 가능 |
| E6 | completed 워크샵에 신규 접속 | 초대 코드로 접속 시도 | participants에 새 레코드 INSERT (읽기 전용). 완료 화면으로 리다이렉트 | "이미 종료된 워크샵입니다" 안내 + 산출물 조회 가능 |
| E7 | 프로세스 노드 삭제 후 연결된 포스트잇 | Context 단계에서 노드 삭제 | process_step_id FK ON DELETE SET NULL → 해당 포스트잇의 process_step_id = null | gather 단계에서 해당 포스트잇은 "미연결" 상태로 표시. 사용자가 재태깅 가능 |
| E8 | 타이머 만료 직후 포스트잇 작성 | gather 타이머 00:00 도달 | 타이머는 안내용. API는 타이머와 무관하게 요청 수락 (stage lock만 검증). 단계 전환 전까지 쓰기 가능 | Toast "시간이 초과되었습니다" + 빨간색 깜빡임. 계속 작성 가능 |

### 외부 서비스 장애 대응

| 서비스 | 장애 감지 | 대응 | 사용자 안내 |
|--------|----------|------|------------|
| Supabase DB | API Route에서 PostgrestError 감지 | 500 + `INTERNAL_ERROR` 반환 | Toast "서비스 일시 장애입니다. 잠시 후 다시 시도해주세요" |
| Supabase Realtime | 채널 `CHANNEL_ERROR` 이벤트 | 내장 자동 재연결 (exponential backoff). 3회 실패 시 오프라인 배너 | Toast(warning) "연결이 불안정합니다. 페이지를 새로고침해주세요" |
| Azure OpenAI | HTTP 429/500/503 또는 타임아웃 | 2회 재시도 (1s, 2s backoff). is_processing 반드시 복구 (try/finally) | Toast(error) "AI 처리에 실패했습니다. 다시 시도해주세요" + 재시도 버튼 |

### 부분 실패 복구

| 시나리오 | 처리 |
|---------|------|
| AI 응답 파싱 성공 → DB 저장 실패 | is_processing = false 복구. Toast "결과 저장에 실패했습니다. 다시 시도해주세요". 파싱된 데이터 폐기 (원자성 보장) |
| 포스트잇 생성: Yjs 성공 → DB 실패 | 3회 재시도 후 Toast "동기화 실패". Yjs 상태 유지, 다음 수정 시 재동기화 시도 |
| 투표 INSERT 성공 → Stale 전파 실패 | 투표 자체는 유효. propagateStale 실패를 로깅하고 다음 API 호출 시 재시도 |
| 단계 전진 UPDATE 성공 → Realtime 미전파 | DB 상태가 정본. 클라이언트는 다음 Realtime 이벤트 또는 페이지 새로고침으로 복구 |

### 네트워크 불안정 대응

- **Realtime 재연결**: Supabase 내장 exponential backoff. 재연결 성공 시 모든 Zustand 스토어 refetchAll()
- **API 호출 실패**: fetch 에러 시 Toast 표시. 자동 재시도 없음 (사용자 액션 기반 재시도)
- **오프라인 모드**: MVP에서는 미지원. 오프라인 시 "인터넷 연결을 확인해주세요" 안내 배너. Post-MVP에서 Service Worker + IndexedDB 큐 검토
- **Yjs 오프라인**: Yjs CRDT는 로컬 변경사항을 보존. 재연결 시 자동 병합. 장시간(5분+) 오프라인 후 재연결 시 대량 동기화 → 진행 표시기 표시

### 사용자 복구 가이드

모든 에러 Toast에 액션 정보를 포함한다:
- **재시도 가능 에러**: "다시 시도해주세요" 텍스트 + 버튼 (AI 실패, 저장 실패)
- **새로고침 필요 에러**: "페이지를 새로고침해주세요" (연결 끊김, 상태 불일치)
- **대기 필요 에러**: "잠시 후 다시 시도해주세요" (서비스 장애, Rate Limit 초과)

### Realtime 연결 끊김 복구 프로토콜

WebSocket 연결 끊김 시 클라이언트와 서버가 협력하여 이벤트 유실 없이 상태를 복구한다:

```
1. onDisconnect 감지 → Zustand `connectionStatus = 'disconnected'` 설정
2. 화면 상단에 노란색 배너: "연결이 끊어졌습니다. 재연결 중..."
3. Supabase 클라이언트 내장 exponential backoff 재연결 (500ms → 1s → 2s → 5s → 10s, 무한 재시도)
4. onReconnect 성공 → 모든 11개 채널 재구독 완료 확인
5. 재구독 완료 후 Zustand 스토어 전체 재페치: refetchAll(workshopId)
   - GET /api/workshops/:id → workshop 상태
   - GET /api/workshops/:id/participants → 참석자 목록
   - GET /api/notes?workshop_id=:id → 포스트잇 (gather 이후)
   - 해당 단계에 필요한 추가 리소스 (clusters, votes, tasks 등)
6. 재페치 완료 → connectionStatus = 'connected' → 배너 해제 (2초 fade-out)
7. 재연결 실패 (5분 연속 실패) → 배너 빨간색 전환: "연결할 수 없습니다. 페이지를 새로고침해주세요"
```

> **이벤트 유실 방어**: 재연결 gap 동안 발생한 CDC 이벤트는 유실될 수 있다. step 5의 전체 재페치가 이를 보상한다. Yjs는 CRDT 특성상 재연결 시 자동 머지되므로 별도 보상 불필요.

### 부분 실패(Partial Failure) 처리 전략

API 처리 중 일부 단계만 성공하고 나머지가 실패하는 경우의 처리 원칙:

| 시나리오 | 처리 전략 | 복구 방법 |
|---------|----------|----------|
| AI 응답 파싱 성공 → DB 저장 실패 | **재시도 우선**. 파싱된 결과를 메모리에 유지하고 DB INSERT 3회 재시도 (1s, 2s, 4s). 모두 실패 시 is_processing=false 복구 + Toast 에러 | 퍼실리테이터가 AI 재실행 |
| 포스트잇 tldraw 추가 성공 → DB 동기화 실패 | **Yjs 우선, DB 재시도**. Yjs 상태 유지. DB INSERT 3회 재시도. 모두 실패 시 Toast 경고 + `pendingNoteIds`에 기록. 다음 수정 시 재시도 | 사용자가 포스트잇 재수정 시 자동 재동기화 |
| 투표 INSERT 성공 → Realtime 전파 지연 | **정상 범위**. DB가 정본. Realtime이 늦어도 다른 참여자의 다음 이벤트 시 catch-up | 자동 복구 (재페치) |
| 단계 전진 DB 성공 → Realtime 브로드캐스트 실패 | **DB 정본**. 전진은 이미 확정됨. 다른 참여자는 다음 Realtime 이벤트 또는 polling으로 감지 | 자동 복구 (다음 이벤트) |
| 클러스터링 결과 일부 저장 → 중간 크래시 | **트랜잭션 롤백**. 클러스터 + 노트 할당을 단일 트랜잭션으로 처리. 실패 시 전체 롤백 → is_processing=false | 퍼실리테이터가 AI 재실행 |

> **원칙**: DB가 항상 정본(canonical). 클라이언트 상태(Yjs, Zustand)는 DB와 불일치 시 DB 기준으로 복구. AI 결과 저장은 반드시 트랜잭션으로 원자성 보장.

## 패턴

- **Server Components 기본** — 데이터 페칭은 서버 컴포넌트에서 수행
- **Client Components는 인터랙션 전용** — 실시간 구독, 사용자 입력, 상태 변경이 필요한 곳만 'use client'
- **Optimistic Updates** — 포스트잇 생성/수정 시 API 응답을 기다리지 않고 즉시 UI 반영, 실패 시 롤백
- **Realtime 구독은 레이아웃 레벨** — workshop/[id]/layout.tsx에서 한 번만 구독, 하위 페이지에서 스토어 참조
- **AI 중복 호출 방지** — workshops.is_processing 플래그로 서버사이드 락, 클라이언트 버튼 disabled 병행. is_processing_since 5분 초과 시 stale lock 자동 복구
- **Stale 전파** — 이전 단계 데이터 수정 시 `propagateStale(workshopId, modifiedStage)` (`src/lib/api/stale.ts`)로 하류 AI 산출물(clusters/design_artifacts/prds/ax_reports)의 is_stale = true 설정. 호출 조건: current_stage > modifiedStage

**Stale 전파 진리표** — 수정 단계별로 영향받는 테이블과 StageNav 배지 표시 범위:

| 수정 단계 | clusters.is_stale | design_artifacts.is_stale | prds.is_stale | ax_reports.is_stale | StageNav ⚠️ 배지 표시 단계 |
|----------|:-:|:-:|:-:|:-:|--------------------------|
| context 수정 | ✓ | ✓ | ✓ | ✓ | cluster, design, generate, report |
| gather 수정 | ✓ | ✓ | ✓ | ✓ | cluster, design, generate, report |
| cluster 수정 | — | ✓ | ✓ | ✓ | design, generate, report |
| vote 변경 | — | ✓ | ✓ | ✓ | design, generate, report |
| design 수정 | — | — | ✓ | ✓ | generate, report |
| generate 수정 | — | — | — | ✓ | report |

> **주의**: context/gather/vote 단계 자체에는 is_stale 필드가 없다 (AI 산출물이 아님). StageNav 배지는 AI 산출물이 있는 단계(cluster~report)에만 표시.
- **자유 네비게이션** — 클라이언트 viewingStage(Zustand)로 현재 보는 단계 관리. current_stage(DB)는 최고 도달 단계만 추적. StageNav 클릭 시 viewingStage만 변경
- **DB timestamps 자동화** — created_at은 DEFAULT now(), updated_at은 트리거로 자동 갱신
- **Zod 검증** — 모든 API body는 Zod 스키마로 검증, 실패 시 400 + 표준 에러 응답
