# 아키텍처

## 시스템 구성

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Browser)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Next.js App (React)                                  │  │
│  │  - Pages: 워크샵 생성, 보드, 클러스터, 투표, 과제, PRD │  │
│  │  - Realtime: DB 변경 구독 (Supabase Realtime)         │  │
│  │  - State: Zustand (클라이언트 상태 관리)               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTPS / WSS
┌─────────────────▼───────────────────────────────────────────┐
│                    Next.js API Routes                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  /api/workshops     — 워크샵 CRUD                     │  │
│  │  /api/notes         — 포스트잇 CRUD                   │  │
│  │  /api/clusters      — 클러스터 관리                   │  │
│  │  /api/votes         — 투표 처리                       │  │
│  │  /api/tasks         — AX 과제 관리                    │  │
│  │  /api/prd           — PRD 생성/관리                   │  │
│  │  /api/ai/cluster    — AI 클러스터링 (Azure OpenAI)    │  │
│  │  /api/ai/derive     — AI 과제 도출 (Azure OpenAI)     │  │
│  │  /api/ai/generate   — AI PRD 생성 (Azure OpenAI)      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                     Supabase                                 │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │ PostgreSQL│  │ Realtime     │  │ Auth (초대 코드)    │    │
│  │ (DB)     │  │ (WebSocket)  │  │                    │    │
│  └──────────┘  └──────────────┘  └────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                  Azure OpenAI                                │
│  - 클러스터링: GPT-4o (JSON mode)                            │
│  - AX 과제 도출: GPT-4o                                      │
│  - PRD 생성: GPT-4o                                          │
└─────────────────────────────────────────────────────────────┘
```

## 디렉토리 구조

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx            # 랜딩 (워크샵 생성/참여)
│   ├── workshop/
│   │   └── [id]/
│   │       ├── page.tsx    # 워크샵 메인 (단계별 뷰 전환)
│   │       ├── board/      # Stage 1: 포스트잇 보드
│   │       ├── cluster/    # Stage 2: 클러스터 뷰
│   │       ├── vote/       # Stage 3: 투표
│   │       ├── derive/     # Stage 4: AX 과제 도출
│   │       └── prd/        # Stage 5: PRD 생성
│   └── api/
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
│   ├── board/              # 포스트잇 보드 컴포넌트
│   │   ├── StickyNote.tsx
│   │   ├── Board.tsx
│   │   └── NoteInput.tsx
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
│       └── Input.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts       # Supabase 브라우저 클라이언트
│   │   ├── server.ts       # Supabase 서버 클라이언트
│   │   └── types.ts        # DB 타입 (자동생성)
│   ├── ai/
│   │   ├── openai.ts       # Azure OpenAI 클라이언트
│   │   ├── prompts.ts      # AI 프롬프트 템플릿
│   │   └── schemas.ts      # AI 응답 JSON 스키마
│   └── utils.ts            # 유틸리티 함수
├── stores/
│   ├── workshop.ts         # 워크샵 상태 (Zustand)
│   ├── board.ts            # 보드 상태
│   └── vote.ts             # 투표 상태
└── types/
    ├── workshop.ts         # 워크샵 관련 타입
    ├── note.ts             # 포스트잇 타입
    ├── cluster.ts          # 클러스터 타입
    ├── vote.ts             # 투표 타입
    ├── task.ts             # AX 과제 타입
    └── prd.ts              # PRD 타입
```

## 데이터 모델

### workshops
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 워크샵 고유 ID |
| title | text | 워크샵 제목 |
| invite_code | varchar(6) | 초대 코드 (유니크) |
| current_stage | enum | 현재 단계 (gather/cluster/vote/derive/generate) |
| facilitator_name | text | 퍼실리테이터 이름 |
| settings | jsonb | 워크샵 설정 (익명 여부, 투표 수 등) |
| created_at | timestamptz | 생성 시각 |
| updated_at | timestamptz | 수정 시각 |

### participants
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | 참가자 고유 ID |
| workshop_id | uuid (FK) | 워크샵 참조 |
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

## 실시간 동기화 전략

Supabase Realtime (PostgreSQL CDC 기반)을 사용한다.

### 구독 채널

| 채널 | 구독 대상 | 용도 |
|------|----------|------|
| `workshop:{id}` | workshops 테이블 변경 | 단계 전환, 설정 변경 알림 |
| `notes:{workshop_id}` | notes 테이블 INSERT/UPDATE/DELETE | 포스트잇 실시간 동기화 |
| `clusters:{workshop_id}` | clusters 테이블 변경 | 클러스터 생성/수정 알림 |
| `votes:{workshop_id}` | votes 테이블 INSERT | 투표 실시간 집계 |
| `presence:{workshop_id}` | Supabase Presence | 참석자 온라인 상태 |

### 동기화 흐름

```
참석자 A (포스트잇 작성)
    → API Route (POST /api/notes)
        → Supabase INSERT
            → Realtime CDC 이벤트 발행
                → 모든 구독 클라이언트 (참석자 B, C, ...) 수신
                    → Zustand 스토어 업데이트
                        → React 리렌더링
```

## API 설계

### 워크샵
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/workshops | 워크샵 생성 |
| GET | /api/workshops/:id | 워크샵 조회 |
| PATCH | /api/workshops/:id | 워크샵 수정 (단계 전환 포함) |
| POST | /api/workshops/join | 초대 코드로 참여 |

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
- **타임아웃**: 60초
- **재시도**: 최대 2회 (exponential backoff)

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
Azure OpenAI 호출
  ↓
응답: PRD 본문 (Markdown)
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
