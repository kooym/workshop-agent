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
- react-markdown (PRD/Report Markdown 렌더링)
- @xyflow/react (React Flow — 프로세스 BPMN 그래프 에디터)
- elkjs (BPMN 그래프 자동 레이아웃 엔진)
- mermaid (TO-BE 프로세스/보고서 Mermaid 다이어그램 렌더링)
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
AZURE_OPENAI_DEPLOYMENT=gpt-4o  # Azure OpenAI 배포 이름 (기본값 예시; 실제 배포 이름으로 교체)
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```
- CRITICAL: 서버 기동 시 필수 환경 변수가 누락되면 즉시 실패해야 함. `src/lib/env.ts`에서 Zod로 검증하고, 다른 모듈이 `process.env` 직접 참조 대신 이 모듈을 import할 것

## 아키텍처 규칙
- CRITICAL: AI 호출(클러스터링, AX 설계, PRD 생성, 종합 보고서)은 반드시 API Route(서버사이드)에서만 처리할 것. 클라이언트에서 직접 Azure OpenAI를 호출하지 말 것
- CRITICAL: Azure OpenAI API 키, Supabase Service Role Key 등 시크릿을 클라이언트 코드에 절대 노출하지 말 것. 서버 전용 환경 변수는 NEXT_PUBLIC_ 접두사 없이 관리
- 예외: Supabase 브라우저 클라이언트에 필요한 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY는 공개 가능 (anon key는 RLS로 보호)
- Supabase RLS: 모든 테이블에 RLS 활성화. anon key는 RLS 정책으로만 데이터 접근 가능. service_role key는 API Route 서버에서만 사용
- CRITICAL: 게스트(참석자)는 Supabase Auth 세션이 없으므로 `auth.uid()` = NULL. 게스트의 모든 데이터 접근은 API Route(service_role)를 경유해야 하며, 브라우저 Supabase 클라이언트(anon key)로 직접 DB 접근 불가. RLS 정책은 퍼실리테이터(Auth 사용자) 전용으로 설계하고, 게스트 요청은 반드시 서버에서 service_role로 처리
- Rate Limiting: AI 엔드포인트(/api/ai/*)는 workshops.is_processing 플래그로 동시 호출 차단. 일반 API는 MVP에서는 별도 Rate Limiting 미적용 (Azure App Service 기본 제한에 의존)
- Rate Limiting 예외: 초대 코드 검증(`POST /api/workshops/join`)은 IP 기반 10회/분 제한 적용. 연속 5회 실패 시 60초 차단. 인증 엔드포인트(로그인/회원가입)도 IP 기반 10회/분 제한 적용
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
- Yjs ↔ DB 일관성 보장: (1) DB 쓰기 실패 시 3회 재시도 후 Toast 에러 표시 (Yjs 상태는 유지, 다음 수정 시 재동기화 시도). (2) cluster 단계 전환 전 notes 테이블이 정본(canonical) — Yjs shape 개수와 notes 테이블 count 불일치 시 경고 Toast + 전환 차단. (3) 워크샵 재접속 시 notes 테이블 기준으로 Yjs 도큐먼트 재구성
- Cluster 이후 단계에서 AI 결과를 tldraw 캔버스에 반영: 클러스터 배치를 캔버스 shape으로 시각화
- 포스트잇 CRUD는 tldraw 이벤트 핸들러에서 DB에 비동기 동기화. 실패 시 Toast 에러 표시
- AI 호출(클러스터링, AX 설계, PRD 생성, 종합 보고서)는 서버사이드에서 중복 호출을 방지할 것 (처리 중 상태 플래그 + 클라이언트 버튼 disabled)
- DB timestamps: created_at은 DEFAULT now(), updated_at은 트리거로 자동 갱신. 코드에서 수동 설정하지 말 것
- Realtime 채널 11종 (채널명 → 구독 대상 테이블):
  - `workshop:{workshop_id}` → `workshops` (current_stage, settings, is_processing 변경)
  - `process_steps:{workshop_id}` → `process_steps` (BPMN 노드 CRUD)
  - `process_edges:{workshop_id}` → `process_edges` (간선 CRUD)
  - `process_lanes:{workshop_id}` → `process_lanes` (Swimlane CRUD)
  - `editing_locks:{workshop_id}` → `editing_locks` (Active/Sleep 전환)
  - `notes:{workshop_id}` → `notes` (포스트잇 CRUD + cluster_id 변경)
  - `clusters:{workshop_id}` → `clusters` (클러스터 CRUD)
  - `votes:{workshop_id}` → `votes` (투표 INSERT/DELETE)
  - `reactions:{workshop_id}` → `task_reactions` (과제 이모지 반응 CRUD)
  - `design:{workshop_id}` → `ax_tasks`, `design_artifacts`, `prds`, `ax_reports` (설계/산출물 변경)
  - `presence:{workshop_id}` → Presence 채널 (온라인/오프라인, 타이머 동기화)
  - Yjs 문서 동기화는 y-supabase가 별도 채널로 관리
- 프로젝트 → 워크샵 2단계 계층: 워크샵은 반드시 프로젝트(고객사/사업 단위)에 소속. 프로젝트별로 워크샵 목록 관리. 퍼실리테이터 대시보드에서 프로젝트 그룹핑 표시
- 워크샵 단계: context → gather → cluster → vote → design → generate → report → completed. completed 상태에서는 읽기 전용 (산출물 조회만 가능)
- CRITICAL: 단계 네비게이션은 자유 이동 가능. `current_stage`는 최고 도달 단계를 추적하고, 참여자는 이미 도달한 단계(`current_stage` 이하) 사이를 자유롭게 이동하며 열람·편집할 수 있다. StageNav의 각 단계 버튼을 클릭하여 해당 단계 화면으로 전환
- 단계 뷰 상태 이중 구조:
  - `current_stage` (DB, 공유): 워크샵의 최고 도달 단계. 퍼실리테이터가 "다음 단계로" 전진 시에만 변경. 모든 참여자에게 동일
  - `viewing_stage` (클라이언트 Zustand, 개인): 현재 사용자가 보고 있는 단계. StageNav 클릭으로 변경. 다른 참여자에게 전파되지 않음
  - 초기값: 페이지 로드/새로고침 시 `viewing_stage = current_stage`
  - StageNav 클릭: `viewing_stage`만 변경, `current_stage`는 불변
  - Realtime으로 `current_stage` 전진 수신 시: `viewing_stage`도 새 `current_stage`로 자동 이동 (퍼실리테이터가 다음 단계로 진행했으므로 전체 참여자를 새 단계로 안내)
  - 위치: `src/stores/workshop.ts`의 `workshopStore`에 `viewingStage` 필드 추가
- 단계 전진 ("다음 단계로" 버튼): `current_stage`를 다음 단계로 전진시키는 것. 사전조건 충족 필요. 퍼실리테이터 전용. 동시 전환 방지: `UPDATE workshops SET current_stage = :next WHERE id = :id AND current_stage = :expected` (optimistic locking). 영향 행 0이면 409 CONFLICT 반환
- 단계 전진 사전조건: context→gather(프로세스 노드≥1, start_event + end_event 각 1개 이상), gather→cluster(포스트잇≥5), cluster→vote(클러스터≥1), vote→design(퍼실리테이터가 투표 마감 선언. 전원 투표 필수 아님), design→generate(과제≥1 AND design_artifacts 존재), generate→report(PRD 생성 완료), report→completed(종합 보고서 생성 완료 + 모든 stale 플래그 해제). 전진 전 ConfirmModal 필수 (현재 단계 상태 요약 표시)
- 단계 네비게이션 규칙:
  - `current_stage` 이하의 모든 단계는 StageNav에서 클릭 가능 (열람 + 편집)
  - `current_stage` 초과 단계는 비활성 (아직 도달하지 못한 단계)
  - `completed` 상태: 모든 단계 클릭 가능하나 읽기 전용
  - 이전 단계로 이동해도 `current_stage`는 변경되지 않음 (UI 네비게이션만)
  - 예: current_stage=vote일 때, context/gather/cluster/vote 모두 클릭 가능. design/generate/report/completed는 비활성
- CRITICAL: 이전 단계에서 데이터 수정 시 하류 AI 결과 무효화 처리 (Stale Data):
  - context 단계에서 프로세스 수정 시 → 하류 모든 AI 산출물에 `is_stale = true` 설정 (clusters, design_artifacts, prds, ax_reports)
  - gather 단계에서 포스트잇 추가/수정/삭제 시 → clusters 이하 모든 AI 산출물에 stale 설정
  - cluster 단계에서 클러스터 수정 시 → design_artifacts 이하 AI 산출물에 stale 설정 (vote는 AI 산출물이 아니므로 is_stale 대상 아님)
  - **Stale 표시 범위 명확화**: context/gather/vote 단계 자체는 AI 산출물이 아니므로 is_stale 필드가 없다. StageNav에서 stale 배지(⚠️)는 AI 산출물이 있는 단계(cluster, design, generate, report)에만 표시한다. 예: context 수정 시 gather 단계에는 stale 배지가 표시되지 않고, cluster 단계부터 stale 배지가 표시된다
  - vote 단계에서 투표 변경 시 → design_artifacts 이하 AI 산출물에 stale 설정
  - Stale 전파 메커니즘: API-side 유틸 함수 `propagateStale(workshopId, modifiedStage)` — 해당 단계 이후의 모든 AI 산출물 테이블에 `UPDATE SET is_stale = true` 실행. 위치: `src/lib/api/stale.ts`. 각 리소스 수정 API Route에서 `current_stage > modifiedStage` 조건일 때(= 이미 지나간 단계에서 수정) 호출
  - Stale 대상 테이블: `clusters.is_stale`, `design_artifacts.is_stale`, `prds.is_stale`, `ax_reports.is_stale`. 투표(votes) 테이블에는 `is_stale` 없음 — 투표는 AI 산출물이 아닌 사용자 입력이므로 무효화 대신 DB 보존 후 퍼실리테이터 판단에 위임
  - 퍼실리테이터 배너: 노란/오렌지 경고 배너 + "AI 재실행 권장" 버튼 + "현재 결과 유지" 버튼
  - 참석자 배너: 동일한 노란/오렌지 경고 배너 표시 (읽기 전용). 액션 버튼 없음 — 퍼실리테이터만 stale 해제 가능
  - 퍼실리테이터는 "현재 결과 유지" 버튼으로 stale 경고를 디스미스할 수 있음 (API: `PATCH /api/workshops/:id/dismiss-stale` — 해당 테이블의 is_stale = false로 설정. AI 재실행 없이 경고만 해제)
  - 투표 데이터는 stale 시 자동 삭제하지 않음 (DB 보존). 퍼실리테이터 판단으로 투표 재실시 여부 결정
  - `completed` 단계 전진 전 모든 stale 플래그가 해제되어야 함 (AI 재실행 또는 "현재 결과 유지" 확인)
- 워크샵 생성 시 퍼실리테이터를 participants 테이블에도 자동 INSERT (is_facilitator: true). 퍼실리테이터 display_name은 Supabase Auth user_metadata에서 가져오거나, 생성 시 닉네임 입력 필드에서 받아 participants.display_name에 저장

## 역할별 권한 매트릭스

### 단계별 퍼실리테이터 전용 컨트롤 (is_facilitator 검사 후 노출)
| 단계 | 퍼실리테이터 전용 UI | 참석자에게 숨김 |
|------|------|------|
| context | 프로세스 그래프 편집 (**Active 편집자만** — 퍼실리테이터 기본), Active/Sleep 전환, "다음 단계로" 버튼. 참석자도 "편집 참여" 버튼으로 Active 획득 가능 | 퍼실리테이터 전용 버튼: "회수", "다음 단계로" |
| gather | "다음 단계로" 버튼 (StageNav), 타이머 설정 | O |
| cluster | "AI 클러스터링 시작" 버튼 (재실행 가능), 클러스터 이름 편집. 병합/분리는 Post-MVP | O |
| vote | "투표 마감" 버튼, "결과 공개" 토글, 투표 참여율 표시, "다음 단계로" 버튼. 투표 마감은 퍼실리테이터 판단 (최소 참여율 제한 없음, 사이드바에 참여율 표시하여 판단 지원) | O |
| design | "AI 설계" 버튼 (재실행 가능), 과제 편집/삭제, 설계 산출물 편집, "다음 단계로" 버튼 | O |
| generate | "AI PRD 생성" 버튼 (재실행 가능), PRD 편집, "다음 단계로" 버튼 | O |
| report | "AI 보고서 생성" 버튼 (재실행 가능), 보고서 편집, "워크샵 완료" 버튼 | O |
| completed | 없음 (읽기 전용) | - |

### 참석자 대기 화면 (AI 처리 중)
- AI 처리 중(is_processing=true)일 때, 참석자 화면에 pulse 애니메이션 + "퍼실리테이터가 AI를 실행 중입니다" 메시지 표시
- 처리 대상 정보 표시: "포스트잇 N개를 분석 중..." (클러스터링), "TO-BE 프로세스를 설계 중..." (Design), "PRD를 생성 중..." (PRD), "종합 보고서를 작성 중..." (보고서)
- 예상 시간 안내: "약 15~30초 소요됩니다"
- AI 완료 후 Realtime으로 결과 자동 반영 (참석자 수동 새로고침 불필요)

### 투표 결과 가시성
- `settings.results_visible = false`일 때: 투표 진행 중 참석자는 투표 수 불가. 퍼실리테이터도 진행 중에는 결과 비공개 (앵커링 방지)
- 퍼실리테이터가 "결과 공개" 버튼 클릭 → 전체 참석자에게 Realtime으로 결과 동시 공개
- `settings.results_visible = true`일 때: 실시간으로 모두에게 투표 현황 표시

### 단계별 쓰기 잠금 (Stage Write Lock)
- 자유 네비게이션 모델에서, 각 리소스는 해당 단계에 도달한 이후(`current_stage` ≥ 해당 단계)에 편집 가능. 이전 단계로 돌아가서 편집하면 하류 stale 플래그 전파
- context 단계 프로세스 편집은 **Active 편집자만** 가능 (editing_locks 기반). Sleep 상태에서 쓰기 요청 시 403 반환
- 프로세스 그래프(노드/간선/레인): `current_stage` ≥ context일 때 편집 가능. gather 이후 수정 시 하류 전체 stale 전파
- 포스트잇: `current_stage` ≥ gather일 때 CRUD 가능. cluster 이후 수정 시 cluster 이하 stale 전파
- 투표: `current_stage` ≥ vote일 때 가능. design 이후 투표 변경 시 design 이하 stale 전파
- 과제/산출물: `current_stage` ≥ design일 때 편집 가능 (퍼실리테이터 전용). generate 이후 수정 시 generate 이하 stale 전파
- PRD: `current_stage` ≥ generate일 때 편집 가능 (퍼실리테이터 전용). report 이후 수정 시 report stale 전파
- 보고서: `current_stage` ≥ report일 때 편집 가능 (퍼실리테이터 전용)
- `completed` 상태: 모든 쓰기 전면 차단 (읽기 전용)

### Active/Sleep 편집 잠금 패턴
- 동시 편집이 충돌하는 리소스(프로세스 그래프 등)에 대해 1인 편집 잠금. `editing_locks` 테이블로 관리
- 퍼실리테이터가 기본 Active (Context 단계 진입 시 자동 잠금 획득)
- 참석자도 "편집 참여" 버튼으로 Active 획득 가능. 요청 시 1초 카운트다운 후 서버에 잠금 전환 요청
- 퍼실리테이터는 "회수" 버튼으로 즉시 Active 회수 가능 (1초 딜레이 없음)
- Active 편집자 연결 끊김 시 30초 후 서버에서 자동 잠금 해제 (presence 기반 감지). 구체적 메커니즘: 클라이언트는 10초 주기로 presence heartbeat 전송. presence leave 이벤트 수신 후 30초 내 rejoin 없으면 다음 잠금 요청자가 stale lock 감지하여 잠금 해제 후 획득
- 잠금 전환 시 이전 편집자에게 Toast 알림 ("편집 권한이 [이름]에게 이전되었습니다")
- 적용 리소스: `process_graph` (Context 단계), `design_artifacts` (Post-MVP 검토)

### 퍼실리테이터 컨텐츠 관리 권한
- 퍼실리테이터는 타인의 포스트잇을 삭제할 수 있음 (API에서 is_facilitator 검증. 수정은 불가 — 원래 작성자만 수정 가능)
- 퍼실리테이터는 특정 참석자를 강제 퇴장(kick)할 수 없음 (MVP). 참가자 초과 시 초대 코드 비활성화로 신규 접속만 차단

### 워크샵 설정 변경 제약
- `anonymous`: context 또는 gather 단계에서만 변경 가능 (`current_stage` ≤ gather). 변경 시 현재 설정 값 기준으로 모든 포스트잇에 일괄 적용 (true: 작성자명 숨김 — UI에서 "익명 참여자"로 표시, false: `participants.display_name`으로 작성자명 표시. DB participant_id는 항상 유지)
- `votes_per_person`: `current_stage` < vote일 때만 변경 가능. vote 단계 도달 후 변경 불가
- `vote_mode`: `current_stage` < vote일 때만 변경 가능. 기본값 'cluster'. vote 단계 미도달 상태에서만 변경 가능하므로 기존 투표 삭제 문제 없음 (투표 데이터가 아직 없는 상태)
- `timer_minutes`: 언제든 변경 가능. null이면 타이머 미사용
- `max_participants`: 현재 참가자 수 이상으로만 변경 가능 (API에서 검증)
- `results_visible`: 언제든 변경 가능

### completed 상태 접근 규칙
- 기존 참석자: 쿠키 유효 시 접속 가능, 산출물(클러스터, 과제, PRD, 종합 보고서) 조회 가능. 투표/포스트잇 작성은 불가
- 신규 참석자: 초대 코드로 접속 시 "이미 종료된 워크샵" 안내 메시지 + 읽기 전용 모드로 접속 허용
- 퍼실리테이터: 대시보드에서 completed 워크샵 조회/열람 가능

### Presence 표시
- ParticipantList에서 퍼실리테이터는 이름 옆에 퍼실리테이터 배지(예: 왕관 아이콘 또는 "host" Badge) 표시하여 참석자와 구분
- 온라인/오프라인 상태: 녹색 도트(온라인) / 회색 도트(오프라인)

### 사이드바 역할별 노출
- 공통: 단계 목록 (StageNav), 참석자 리스트 (ParticipantList), 초대 코드 표시, 워크샵 목적(description 축약)
- 퍼실리테이터 전용: 단계별 액션 버튼 (AI 트리거, 단계 전환, 투표 마감/공개), 설정 버튼, 투표 참여율 표시, 타이머 설정
- 참석자: 현재 단계 안내 텍스트, 내 활동 요약(포스트잇 N개, 투표 N표), 퍼실리테이터 전용 버튼 숨김

## 인증 모델
- **퍼실리테이터(관리자)**: Supabase Auth 이메일/비밀번호 로그인 (비밀번호 최소 8자). 로그인 후 워크샵 생성/관리 가능. 대시보드에서 자신의 워크샵 목록 조회 가능
- **참석자(게스트)**: 초대 코드(6자리 영숫자, 혼동문자 0/O/1/I/L 제외) + 이름 입력으로 접속. 별도 회원가입 없음
- CRITICAL: 참석자 세션 쿠키 값은 반드시 서명(signed)할 것. workshop_id + participant_id를 `SESSION_SECRET` 환경 변수로 HMAC-SHA256 서명하여 위변조 방지. 서명 없이 평문 저장 금지. `SUPABASE_SERVICE_ROLE_KEY`를 서명 시크릿으로 재사용하지 말 것 (단일 책임 원칙)
- 쿠키 서명 포맷: `v1:{payload}.{signature}` — payload = `base64url(workshop_id:participant_id)`, signature = `HMAC-SHA256(payload, SESSION_SECRET)`의 hex 인코딩. `v1:` 접두사로 키 로테이션 시 구버전 검증 폴백 지원
- 참석자 세션: HTTP-only 쿠키 (Secure, SameSite=Lax, maxAge=86400). Secure 플래그는 프로덕션에서만 적용 (`NODE_ENV=development`일 때는 Secure 해제하여 localhost 개발 지원). 새로고침 시 쿠키로 자동 복구, Zustand 스토어는 서버에서 재페치
- 퍼실리테이터 세션: Supabase Auth 세션 (JWT). `@supabase/ssr`로 서버/클라이언트 양쪽에서 관리
- withAuth: 참석자 쿠키 세션 또는 퍼실리테이터 Auth 세션 모두 검증. 반드시 해당 워크샵의 participants 테이블에 존재하는지까지 확인
- withFacilitator: 퍼실리테이터 Auth 세션만 검증 (is_facilitator + facilitator_id 확인)
- 초대 코드 충돌: 생성 시 DB 유니크 제약 위반이면 재생성 (최대 3회)
- 동일 이름 참석자: 같은 워크샵 내 이름 중복 허용 (동명이인 존재 가능). 고유 식별은 participant_id로 수행
- 쿠키 만료 후 재참여: 참석자 쿠키(maxAge=24h) 만료 시 랜딩 페이지에서 동일 초대 코드 + 이름으로 다시 접속. 기존 participant 레코드와는 별개의 새 참가자로 생성 (MVP 제약)

## AI 파이프라인 제약
- 모든 AI 호출은 JSON Mode(structured output) 사용
- 재시도: 최대 2회 (exponential backoff, base delay 1초 → 1s, 2s)
- 타임아웃 (해당 시간 초과 시 AbortController로 중단): 클러스터링 30초, AX 설계 30초, PRD 생성 60초, 종합 보고서 60초
- 중복 방지: workshops.is_processing 플래그 (try/finally 패턴으로 반드시 복구). 추가로 `is_processing_since` 타임스탬프 칼럼을 함께 설정하여, API에서 5분 초과 시 stale lock으로 판정 → 자동 복구 (AI 서버 크래시/OOM으로 try/finally 미실행 시 영구 잠금 방지)
- 프롬프트: `src/lib/ai/prompts.ts`에 모든 시스템/유저 프롬프트를 상수로 관리. API Route에 하드코딩 금지
- AI 실패 UX: Toast로 "AI 처리에 실패했습니다. 다시 시도해주세요" + 재시도 버튼 활성화. alert() 사용 금지
- 토큰 가드레일: max_tokens를 각 호출별로 설정 (클러스터링 2000, AX 설계 4000, PRD 생성 8000, 종합 보고서 10000)
- AI 응답 사후 검증:
  - 클러스터링: 모든 입력 note_id가 출력에 포함되는지 확인. 누락/중복 할당 시 에러 처리
  - AX 설계: tobe_process, agent_specs, tasks, kpis, data_requirements, org_requirements 6개 필드 모두 존재하는지 확인. tasks ≥ 1. 각 과제에 연결된 cluster_id가 유효한지 확인
  - PRD 생성: 반환된 텍스트가 비어있지 않고 50,000자 이하인지 확인. finish_reason이 'length'이면 잘림으로 판정하여 에러 처리
  - 종합 보고서: 반환된 텍스트가 비어있지 않고 80,000자 이하인지 확인. finish_reason이 'length'이면 잘림으로 판정
- AI 응답 Zod 스키마: `src/lib/ai/schemas.ts`에 정의. 각 AI 호출의 JSON 응답을 Zod로 파싱하여 타입 안전성 보장
- OpenAI 클라이언트: `openai` 패키지의 `AzureOpenAI` 클래스를 사용. 위치: `src/lib/ai/openai.ts`
- AI 재실행 (병합) 전략:
  - 클러스터링 재실행: cluster_id IS NULL인 미할당 노트만 대상. 기존 클러스터 목록을 컨텍스트로 포함. 전제: 미할당 노트 ≥ 1. 재실행 완료 시 `clusters.is_stale = false` 설정
  - Design 재실행: 기존 과제 유지 + 새 과제만 INSERT. design_artifacts는 version+1로 새로 생성 (`is_stale = false`). 이전 버전의 is_stale은 변경하지 않음 (DB 보존, 최신 버전만 표시). 유사 과제 중복 시 Toast 알림
  - PRD 재생성: 새 버전으로 INSERT (version+1, `is_stale = false`). 이전 버전 DB 보존, MVP에서는 최신만 표시
  - 보고서 재생성: 새 버전으로 INSERT (version+1, `is_stale = false`). 이전 버전 DB 보존, MVP에서는 최신만 표시
  - 모든 재실행: 퍼실리테이터 전용 + 안내 모달 필수. 재실행 성공 시 해당 산출물 + 하류 산출물의 is_stale 플래그 일괄 해제

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
- CRITICAL: `dangerouslySetInnerHTML` 사용 금지. 사용자 입력 텍스트는 반드시 텍스트 노드로 렌더링. Markdown 렌더링은 `react-markdown`만 사용. Mermaid 다이어그램은 `react-markdown`의 코드 블록 커스텀 렌더러로 `language=mermaid` 감지 시 `mermaid.render()` 호출. 컴포넌트: `src/components/common/MermaidDiagram.tsx`. SVG 출력은 DOM ref에 주입 (mermaid 라이브러리 생성 SVG는 신뢰 가능)
- **Mermaid innerHTML 예외**: `mermaid.render()`가 반환하는 SVG 문자열은 mermaid 라이브러리가 생성한 것이므로 신뢰 가능. `divRef.current.innerHTML = svgString` 패턴을 허용한다. 이는 사용자 입력을 직접 innerHTML에 넣는 것이 아니므로 `dangerouslySetInnerHTML` 금지 규칙의 예외이다. React의 `dangerouslySetInnerHTML` prop은 여전히 사용하지 않는다.
- 에러 바운더리: workshop/[id] 레이아웃에 React Error Boundary를 설정. 컴포넌트 예외 시 전체 페이지 대신 폴백 UI 표시 + 새로고침 버튼
- 접근성 최소 요건: 모든 form input에 label 연결, 버튼에 접근 가능한 이름, 모달에 focus trap + Escape 닫기, 키보드로 투표 가능

## 리소스 및 입력 제한
- 워크샵당 참가자: 기본 20명, 설정 가능 (2~20). 퍼실리테이터 포함 카운트 (20명 = 퍼실리테이터 1 + 참석자 19). DB CHECK 제약 또는 API에서 트랜잭션으로 초과 방지
- 워크샵당 포스트잇: 최대 200개. API에서 INSERT 전 count 검증
- 워크샵당 프로세스 노드: 최대 50개 (Task, Gateway, Event 등 BPMN 요소 포함). API에서 INSERT 전 count 검증
- 워크샵당 Swimlane: 최대 10개. API에서 검증
- AI 클러스터 수: 3~8개 (AI 동적 결정)
- 1인당 투표: 기본 3표 (설정 가능, 1~10)
- 투표 모드: 클러스터 단위 또는 개별 노트 단위 (퍼실리테이터 설정, 기본 'cluster')
- 타이머: 1~60분 (퍼실리테이터 설정, 기본 null=미사용). 브라우저 카운트다운, 자동 단계 전환 없음. presence broadcast로 타이머 동기화. 타이머 만료 시 Toast 알림 + 시각적 강조(빨간색 깜빡임). 퍼실리테이터에게 "시간이 초과되었습니다. 다음 단계로 진행하시겠습니까?" 표시. 자동 전환은 없음
- 텍스트 길이: 포스트잇 200자, 클러스터명 50자, 과제명 100자, 과제설명 500자, PRD 50,000자, 종합 보고서 80,000자, 워크샵 description 500자, 프로세스 노드명 100자, 프로세스 노드 설명 500자, 간선 라벨 50자, Swimlane명 50자, 프로젝트명 100자, 워크샵 제목 100자, 참석자 이름 30자
- 초대 코드: 6자리 영숫자, 혼동문자(0/O, 1/I/L) 제외
- 초대 코드 대소문자: 대문자만 사용 (A-Z, 2-9). 입력 시 소문자를 자동 대문자 변환 (case-insensitive 비교)
- 브라우저: Chrome, Edge 최신 (데스크톱 전용)
- 데이터 보존: 워크샵 데이터 최소 30일 유지
- 동시 운영: 퍼실리테이터 1인이 동시에 여러 프로젝트/워크샵을 생성할 수 있으나, 프로젝트당 활성 워크샵은 1개로 제한 (MVP). 활성 = current_stage가 completed가 아닌 워크샵. 같은 프로젝트 내 새 워크샵 생성 시 기존 활성 워크샵이 있으면 API에서 409 CONFLICT 반환
- 다중 탭 세션: 같은 참석자가 여러 탭으로 접속 시 모든 탭에서 동일 쿠키/세션 공유. Yjs는 자동 동기화. 투표는 participant_id 기준 유니크 제약으로 중복 방지. Presence는 복수 탭 접속 시에도 단일 온라인 표시
- 퍼실리테이터 역할 겸임: 퍼실리테이터는 participants 테이블에 자동 등록되므로, 포스트잇 작성·투표 등 참석자 행동도 수행 가능. 단, 단계 전환·AI 트리거 등 관리 기능은 withFacilitator로 보호. 퍼실리테이터의 투표 결과는 참석자와 동일 시점에 공개됨 (`results_visible` 설정 준수). 퍼실리테이터 투표 편향은 MVP에서 통제하지 않음 (신뢰 기반)

## API 응답 표준
- 성공: `{ data: T }`
- 에러: `{ error: { code: string, message: string } }`
- HTTP 상태 코드: 200(조회/수정 성공), 201(리소스 생성 성공), 400(입력 오류), 401(인증 실패), 403(권한 없음), 404(미존재), 409(충돌/중복), 500(서버 에러)
- API 엔드포인트 규칙: 복수형 명사 사용 (예: /api/workshops, /api/notes). RESTful 패턴 준수 (GET 조회, POST 생성, PATCH 수정, DELETE 삭제). `/api/health`는 인증 없이 접근 가능 (배포 헬스체크용)
- 에러 코드 상수: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `PROCESSING`, `STAGE_LOCKED`, `STALE_LOCK`, `VOTE_LIMIT`, `PARTICIPANT_LIMIT`, `NOTE_LIMIT`, `INTERNAL_ERROR`. 위치: `src/lib/api/response.ts`에 상수로 정의
- 목록 조회: MVP에서는 페이지네이션 없이 전체 반환 (워크샵당 데이터 규모가 작으므로). Post-MVP에서 cursor 기반 페이지네이션 검토

## 타입 안전성
- DB 타입: `src/lib/supabase/types.ts`에 수동 작성 (Supabase 테이블 행 타입)
- 도메인 타입: `src/types/*.ts`에 API 응답/클라이언트용 타입 정의. DB 타입을 그대로 클라이언트에 노출하지 말 것
- Zod → TypeScript: API 요청 타입은 `z.infer<typeof schema>`로 추론. 별도 interface 중복 정의 금지
- 설정 스키마: `WorkshopSettings = { anonymous: boolean, votes_per_person: number(1~10, 기본 3), max_participants: number(2~20, 기본 20), results_visible: boolean(기본 false), vote_mode: 'cluster'|'note'(기본 'cluster'), timer_minutes: number|null(1~60, 기본 null) }`

## 에러 처리 / 복원력
- 서버 로깅: API Route에서 에러 발생 시 `console.error`로 JSON 구조화 로깅. 형식: `{ method, path, status, error, duration_ms, workshop_id?, participant_id? }`. Azure App Service 로그 스트림 또는 Azure Monitor로 수집
- DB 마이그레이션: `supabase/migrations/` 디렉토리에 순번 파일 (`001_initial_schema.sql`, `002_...`). Supabase CLI `supabase db push`로 적용
- 동시성 가드: 투표 N표 초과, 참가자 초과, 포스트잇 초과는 DB 유니크 제약 또는 API 트랜잭션(SELECT ... FOR UPDATE)으로 방지. 클라이언트 검증만으로는 불충분
- 포스트잇 동시 수정: last-write-wins 전략. Realtime CDC가 최신 상태를 자동 전파하므로 별도 conflict resolution 불필요 (MVP). 자신의 포스트잇만 수정/삭제 가능 (API에서 participant_id 소유권 검증). **예외: 퍼실리테이터는 타인의 포스트잇 삭제 가능 (is_facilitator 검증), 수정은 불가**
- 외부 서비스 장애 대응:
  - Supabase 장애: API Route에서 DB 에러 감지 시 500 + "서비스 일시 장애" 메시지. 클라이언트는 Toast로 안내
  - Azure OpenAI 장애: AI 호출 실패 시 is_processing 플래그 반드시 복구 (try/finally). Toast로 재시도 유도
  - Realtime 연결 끊김: Supabase 클라이언트 내장 자동 재연결. 재연결 성공 시 Zustand 스토어 전체 재페치로 상태 동기화

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:, chore:). chore는 메타데이터/설정 커밋용 (예: index.json 업데이트, 빌드 설정 변경)
- 기획 변경 시 반드시 docs/ 문서를 먼저 업데이트한 후 코드를 수정할 것
- PR은 lint → typecheck → test → build 순서의 CI를 통과해야 머지 가능
- 상세 설계 참조: docs/INDEX.md(문서 진입점), docs/MODULE_MAP.md(모듈 경계), docs/FOUNDATION_ASSESSMENT.md(Foundation 기준), docs/PRD.md(기능), docs/ARCHITECTURE.md(구조), docs/ADR.md(결정), docs/UI_GUIDE.md(디자인), docs/OPERATIONS.md(운영), docs/SPEC_AUDIT.md(MVP/Post-MVP 범위 기준)

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

### 로컬 개발 퀵스타트
npx supabase start              # 로컬 Supabase 시작 (Docker Desktop 필요)
cp .env.example .env.local      # 환경 변수 템플릿 복사
# .env.local에 supabase start 출력값 + Azure OpenAI 키 입력
npx supabase db reset            # 로컬 DB에 마이그레이션 적용
npm run dev                      # http://localhost:3000

### Supabase CLI
npx supabase start   # 로컬 Supabase 인스턴스 시작 (Docker 필요)
npx supabase stop    # 로컬 Supabase 종료
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
7. [ ] 참석자 세션 쿠키 값이 서명되어 있는가 (v1: 포맷 + HMAC-SHA256)
8. [ ] `dangerouslySetInnerHTML`이 사용되지 않았는가
9. [ ] TDD: 테스트가 구현보다 먼저 작성되었는가
10. [ ] `npm run build && npm run lint && npm run typecheck` 통과하는가
11. [ ] Docker 빌드가 성공하는가 (`docker build -t workshop-agent .`)
12. [ ] 단계별 쓰기 잠금(Stage Write Lock)이 API에서 검증되는가
13. [ ] 이전 단계 수정 시 하류 stale 전파(`propagateStale`)가 API에서 호출되는가
