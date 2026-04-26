# Step 9: stage-flow

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/PRD.md` — 워크샵 프로세스 8단계 전체 흐름
- `/docs/ARCHITECTURE.md` — 전체 시스템 구성, 상태 관리
- `/docs/UI_GUIDE.md` — StageNav, 전체 레이아웃
- `/docs/SPEC_AUDIT.md` — vote->design 전환, completed 상태, 최종 검증 결정
- `/docs/MODULE_MAP.md`
- `/docs/FOUNDATION_ASSESSMENT.md`
- `/docs/WORK_BREAKDOWN.md`
- `/docs/OPERATIONS.md`
- `/docs/modules/00-platform-foundation.md`
- `/docs/modules/02-project-workshop-lifecycle.md`
- `/docs/modules/08-ui-experience-system.md`
- `/docs/modules/09-quality-operations.md`

이전 step에서 만들어진 **모든** 코드를 꼼꼼히 읽어라. 이 step은 전체 흐름을 통합하는 마무리 step이다:

- `/src/app/workshop/[id]/layout.tsx`
- `/src/app/workshop/[id]/page.tsx`
- `/src/components/workshop/StageNav.tsx`
- `/src/stores/workshop.ts`
- `/src/app/api/workshops/[id]/route.ts`
- `/src/components/board/Board.tsx`
- `/src/components/cluster/ClusterView.tsx`
- `/src/components/vote/DotVoting.tsx`
- `/src/components/design/DesignView.tsx`
- `/src/components/design/TaskCard.tsx`
- `/src/components/prd/PrdPreview.tsx`
- `/src/components/report/ReportPreview.tsx`

## 작업

워크샵 8단계 흐름을 통합하고 엔드투엔드 사용자 경험을 완성하라. 개별 기능은 이미 구현되어 있으므로, 이 step에서는 **연결과 전환**에 집중한다.

새로운 기능을 크게 추가하지 않더라도 전환 조건과 completed 상태는 회귀 위험이 크므로 테스트를 먼저 보완한다. 단계 전환 사전조건, ConfirmModal, completed 읽기 전용, Toast 에러 처리를 검증하라.

### 1. 단계 전환 흐름 검증 및 보완

`src/app/api/workshops/[id]/route.ts`의 PATCH 핸들러를 보완하라:

단계 전환 시 최소 조건 검증:
- context → gather: process_steps가 **1개 이상** 존재하고, start_event + end_event 각 1개 이상이어야 함
- gather → cluster: notes가 **5개 이상** 존재해야 함 ("최소 5개의 포스트잇이 필요합니다")
- cluster → vote: clusters가 1개 이상 존재해야 함
- vote → design: 퍼실리테이터의 ConfirmModal 확인 자체를 "투표 마감 선언"으로 간주. 최소 1표 또는 전원 투표는 필수 아님
- design → generate: ax_tasks가 1개 이상 존재해야 하고 design_artifacts가 존재해야 함
- generate → report: PRD가 1개 이상 존재해야 함
- report → completed: ax_reports가 1개 이상 존재해야 함

조건 미충족 시 400 에러 + 구체적 메시지 ("클러스터링을 먼저 실행하세요" 등)

completed 상태에서는 모든 쓰기 API(notes, votes, clusters, tasks, prd, settings 변경)를 차단하고 산출물 조회만 허용한다.

### 2. StageNav 보완

`src/components/workshop/StageNav.tsx`를 보완하라:

- "다음 단계로" 버튼 클릭 시 `ConfirmModal` 컴포넌트로 확인 대화상자 표시. 모달에는 **현재 상태 요약**을 표시:
  - context→gather: "프로세스 단계 N개 → pain point 수집을 시작합니다"
  - gather→cluster: "포스트잇 N개, 참가자 M명 → AI 클러스터링을 시작합니다"
  - cluster→vote: "클러스터 N개 → 투표를 시작합니다"
  - vote→design: "투표 참여: N/M명, 총 K표 → AI AX 설계를 시작합니다"
  - design→generate: "과제 N개 + 설계 산출물 → AI PRD 생성을 시작합니다"
  - generate→report: "PRD v{N} → AI 종합 보고서 생성을 시작합니다"
  - report→completed: "보고서 v{N} → 워크샵을 완료합니다" (모든 stale 플래그 해제 필요)
- **자유 네비게이션**: `current_stage` 이하의 모든 단계 버튼을 클릭하면 해당 단계 화면으로 전환. 미도달 단계는 비활성(회색). stale 플래그가 설정된 단계에 ⚠️ 오렌지 도트 배지 표시
- 단계 전환 실패 시 Toast(에러) + 인라인 메시지 표시 (조건 미충족)
- **409 CONFLICT 처리**: Optimistic locking 실패 시 (`UPDATE ... WHERE current_stage = :expected` 영향 행 0), 클라이언트는 Toast "다른 변경이 감지되었습니다. 페이지를 새로고침합니다" + 1초 후 `window.location.reload()`. 자동 재시도 없음 (사용자에게 최신 상태를 보여주는 것이 우선)
- 각 단계 아이콘 + 라벨 표시 (Lucide 아이콘 사용)
  - Context: ListOrdered 아이콘
  - 수집: StickyNote 아이콘
  - 클러스터: Layers 아이콘
  - 투표: Vote 아이콘
  - Design: Cpu 아이콘
  - PRD: FileText 아이콘
  - Report: BarChart3 아이콘
- vote 단계의 버튼 문구는 "투표 마감"으로 표시하고, 확인 후 design으로 전환한다.
- report 단계에서 보고서가 생성된 경우 "워크샵 완료" 버튼을 표시하고, 확인 후 completed로 전환한다.

### 3. 초대 코드 공유 UI

`src/components/workshop/InviteCode.tsx`:
- 워크샵 초대 코드를 큰 글씨로 표시 (프로젝터 공유용)
- "코드 복사" 버튼
- 참석자 수 실시간 표시
- 사이드바 상단에 배치

### 4. 타이머 컴포넌트

`src/components/workshop/Timer.tsx`:
- 퍼실리테이터가 설정한 timer_minutes에 따라 MM:SS 카운트다운 표시 (font-mono text-xl)
- 퍼실리테이터: 타이머 시작/정지/재설정 컨트롤
- 참석자: 카운트다운만 표시 (읽기 전용)
- **타이머 Realtime 동기화 프로토콜**:
  - 퍼실리테이터가 "시작" 클릭 시 presence broadcast: `{ type: 'timer_start', timer_end_at: ISO8601, timer_minutes: number }`
  - 참석자는 `timer_end_at`(절대 시각) 기준으로 로컬 카운트다운 계산 → 기기 시계 차이(±수 초)는 허용
  - "정지" 클릭 시 broadcast: `{ type: 'timer_pause', remaining_seconds: number }`
  - "재설정" 클릭 시 broadcast: `{ type: 'timer_reset' }`
  - 재연결 시: presence state에 현재 타이머 상태(`timer_end_at` 또는 `paused_remaining`)를 포함하여 신규/재접속 참석자도 즉시 동기화
  - 권한: broadcast 송신은 퍼실리테이터만 (클라이언트 검증 + UI 버튼 숨김)
- 타이머 만료 시 자동 단계 전환 없음 (Toast 알림만)
- timer_minutes가 null이면 타이머 UI 숨김
- 헤더에 배치 (워크샵 제목 옆)

### 5. 단계 안내 시스템

`src/components/workshop/StageGuideBanner.tsx`:
- 각 단계 진입 시 메인 영역 상단에 안내 배너 표시
- 단계별 안내 텍스트:
  - context: "현행 업무 프로세스를 단계별로 정리합니다"
  - gather: "각 프로세스 단계에서 겤는 문제점, 필요사항을 포스트잇에 작성해주세요"
  - cluster: "포스트잇을 AI가 의미 기반으로 분류합니다"
  - vote: "가장 중요한 주제에 투표해주세요"
  - design: "AS-IS 분석과 투표 결과를 기반으로 AI가 TO-BE 프로세스와 과제를 설계했습니다"
  - generate: "Agent 설계와 과제를 기반으로 생성된 PRD입니다. 동의/우려를 표시해주세요"
  - report: "워크샵 전체 데이터를 종합한 AX 도입 종합 보고서입니다"
- [X] 버튼으로 dismiss 가능 (localStorage로 단계별 상태 저장)
- bg-neutral-800 border border-neutral-700 rounded-lg p-3

### 5-1. Stale Data 경고 배너

`src/components/workshop/StaleBanner.tsx`:
- 이전 단계에서 데이터가 수정되어 하류 AI 산출물이 무효화된 경우(is_stale=true) 노란/오렌지 경고 배너 표시
- 대상 테이블별 메시지:
  - clusters: "포스트잇이 수정되었습니다. 클러스터링 결과가 최신이 아닐 수 있습니다."
  - design_artifacts: "이전 단계 데이터가 변경되었습니다. AX 설계 결과가 최신이 아닐 수 있습니다."
  - prds: "설계 산출물이 변경되었습니다. PRD가 최신이 아닐 수 있습니다."
  - ax_reports: "워크샵 데이터가 변경되었습니다. 종합 보고서가 최신이 아닐 수 있습니다."
- **퍼실리테이터 전용 액션 버튼**: "AI 재실행 권장" + "현재 결과 유지" 버튼
  - "AI 재실행 권장": 해당 AI 엔드포인트 호출 (클러스터링/설계/PRD/보고서)
  - "현재 결과 유지": `PATCH /api/workshops/:id/dismiss-stale` 호출 → is_stale=false 설정
- **참석자**: 동일 경고 배너 표시 (읽기 전용). 액션 버튼 없음
- 각 단계 뷰 상단, StageGuideBanner 아래에 배치
- `bg-amber-900/50 border border-amber-600/50 text-amber-200 rounded-lg p-3`

### 6. 워크샵 완료 화면

report 단계에서 종합 보고서가 생성되면 "워크샵 완료" 상태를 표시하라:

**전환 시 풀스크린 오버레이** (3초 후 자동 닫힘 또는 클릭으로 닫기):
- "🎉 워크샵이 완료되었습니다! 수고하셨습니다" 메시지
- bg-black/80, text-white, text-center, fade-in 애니메이션

**완료 메인 화면**:
- **여정 요약 시각화**: React 컴포넌트(`src/components/workshop/JourneySummary.tsx`)로 수직 흐름도 구현. 각 단계를 카드로 표시하고 수직 커넥터 라인으로 연결:
  - AS-IS 프로세스 (노드 N개, 레인 M개) → 포스트잇 N개 수집 → AI 클러스터링 (N개 그룹) → 투표 N표 (M명 참여) → TO-BE 설계 완료 → 과제 N개 도출 → PRD vN 생성 → 종합 보고서 vN
  - 각 카드: `bg-neutral-800 border border-neutral-700 rounded-lg p-4`, 아이콘(lucide) + 수치 강조(`text-lg font-bold text-emerald-400`)
  - 커넥터: `w-px h-8 bg-neutral-600 mx-auto`
  - 수치 데이터는 API에서 집계하여 전달: `GET /api/workshops/:id/summary` (withAuth, 완료 화면 전용)
- **내 기여 요약**: 내가 작성한 포스트잇 수, 상위 클러스터에 포함된 포스트잇 수, 내 투표 수 (participant_id 기반)
- 산출물 링크: [설계 보기] [과제 보기] [PRD 보기] [보고서 보기] [Markdown 복사]
- "Markdown 복사" 버튼 (PRD)
- completed 상태로 전환된 이후 접속한 참석자와 퍼실리테이터 모두 읽기 전용 산출물 화면을 본다.
- **completed 상태 네비게이션**: StageNav에서 모든 단계(context~report)를 클릭할 수 있으나, 모든 쓰기 작업이 차단된다 (포스트잇 작성, 투표, 과제 편집, PRD 수정 등 일체 불가). API는 403 반환. UI는 편집 버튼을 숨기거나 disabled 처리한다.

### 5. 에러 처리 및 로딩 상태 통합

모든 AI 호출(클러스터링, AX 설계, PRD 생성, 종합 보고서)의 에러 처리를 통일하라:
- 네트워크 에러: Toast(에러) "AI 서비스에 연결할 수 없습니다. 잠시 후 다시 시도하세요."
- 타임아웃: Toast(에러) "AI 처리 시간이 초과되었습니다. 다시 시도하세요."
- API 에러: 서버에서 반환한 에러 메시지를 Toast로 표시
- Toast는 `sonner` 라이브러리 사용 (Step 0에서 `<Toaster />`가 root layout에 이미 마운트됨). 이 step에서 추가로 마운트하지 않는다.
- alert() 사용 금지. 항상 Toast 또는 인라인 ErrorState 컴포넌트 사용

로딩 상태:
- AI 호출 중: "AI가 분석 중입니다..." + pulse 애니메이션 + 버튼 disabled
- 단계 전환 중: 버튼 disabled + 짧은 진행 문구. spinner는 사용하지 않는다.

### 6. 전체 레이아웃 마무리

`src/app/workshop/[id]/layout.tsx`를 최종 정리하라:
- 모든 Realtime 구독이 올바르게 설정되어 있는지 확인 (workshops, process_steps, process_edges, process_lanes, editing_locks, notes, clusters, votes, reactions, design, presence — 총 11종)
- 구독 해제가 cleanup에서 모두 처리되는지 확인
- 사이드바: StageNav + InviteCode + ParticipantList + 워크샵 목적(description 축약)
- 헤더: 워크샵 제목 + 현재 단계 표시 + 타이머 + 참석자 수
- workshop/[id] 레이아웃의 Error Boundary가 정상 동작하는지 확인한다 (Step 3에서 이미 추가됨). 폴백 UI와 새로고침 버튼이 컴포넌트 예외 시 표시되는지 검증한다.

### 7. Foundation release gate

최종 통합 전에 Foundation Cluster 기준을 다시 검증하라:

- `next.config.ts`에 `output: 'standalone'`이 유지되는지 확인
- `Dockerfile`이 `.next/standalone`, `.next/static`, `public`을 runner image에 포함하는지 확인
- `.dockerignore`에 `.env*`, `.next`, `node_modules`, coverage/output이 포함되는지 확인
- container port는 3000 하나로 고정하고, 운영 문서의 `WEBSITES_PORT=3000` 기준과 일치하는지 확인
- `GET /api/health`가 인증 없이 빠르게 200을 반환하는지 확인
- Supabase Auth 보호 로직이 `getClaims()` 또는 `getUser()`로 재검증되는지 확인
- guest signed cookie가 `SESSION_SECRET`으로 서명되고, service role key를 재사용하지 않는지 확인
- client component 또는 client-imported module에 `SUPABASE_SERVICE_ROLE_KEY`, `AZURE_OPENAI_API_KEY`, `SESSION_SECRET`가 흘러가지 않는지 확인
- `npm ci`로 재현 설치가 되는지 확인
- `FOUNDATION_ASSESSMENT.md`의 Gap Register 상태와 실제 구현 상태가 어긋나면 문서를 업데이트한다.

릴리즈 전 secret audit:

```bash
rg "SUPABASE_SERVICE_ROLE_KEY|AZURE_OPENAI_API_KEY|SESSION_SECRET" src/app src/components
```

검색 결과가 client component, browser bundle, UI 컴포넌트 경로에 노출되면 릴리즈를 중단한다.

## Acceptance Criteria

```bash
npm run lint    # lint 에러 없음
npm run typecheck # 타입 검사 통과
npm run test    # 테스트 통과
npm run build   # 컴파일 에러 없음
docker build -t workshop-agent . # Docker 빌드 성공
```

- `npm ci` 후 동일한 gate가 통과한다.
- `/api/health`가 200을 반환하고 App Service Health Check path로 사용할 수 있다.
- Docker image 실행 후 `http://localhost:3000/api/health` smoke test가 통과한다.
- secret audit 검색 결과가 릴리즈 차단 항목을 만들지 않는다.

엔드투엔드 시나리오:
1. 워크샵 생성 → 초대 코드 발급
2. 참석자 2명 이상 접속
3. Context 단계: AS-IS 프로세스 단계 등록
4. 수집 단계: 각자 포스트잇 작성 (프로세스 단계 태깅 + 실시간 동기화 확인)
5. 클러스터 단계로 전환 → AI 클러스터링 실행 → 결과 확인
6. 투표 단계로 전환 → 각 참석자 투표 → 결과 공개
7. Design 단계로 전환 → AI AX 설계 → TO-BE/Agent/과제/KPI 확인
8. PRD 단계로 전환 → AI PRD 생성 → Markdown 확인/복사
9. Report 단계로 전환 → AI 종합 보고서 생성 → 확인
10. 워크샵 완료 → completed 읽기 전용 화면 확인

위 시나리오가 에러 없이 완료되면 성공.

## 금지사항

- 새로운 기능을 추가하지 마라. 이 step은 기존 기능의 통합과 마무리만 한다.
- 퍼포먼스 최적화를 이 step에서 하지 마라. 이유: MVP에서는 10명 규모이므로 불필요
- 기존 step에서 구현한 API의 인터페이스를 변경하지 마라. 호환성을 깨뜨리면 안 됨
