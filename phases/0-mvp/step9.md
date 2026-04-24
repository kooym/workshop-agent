# Step 9: stage-flow

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/PRD.md` — 워크샵 프로세스 5단계 전체 흐름
- `/docs/ARCHITECTURE.md` — 전체 시스템 구성, 상태 관리
- `/docs/UI_GUIDE.md` — StageNav, 전체 레이아웃
- `/docs/SPEC_AUDIT.md` — vote->derive 전환, completed 상태, 최종 검증 결정
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
- `/src/components/derive/TaskList.tsx`
- `/src/components/prd/PrdPreview.tsx`

## 작업

워크샵 5단계 흐름을 통합하고 엔드투엔드 사용자 경험을 완성하라. 개별 기능은 이미 구현되어 있으므로, 이 step에서는 **연결과 전환**에 집중한다.

새로운 기능을 크게 추가하지 않더라도 전환 조건과 completed 상태는 회귀 위험이 크므로 테스트를 먼저 보완한다. 단계 전환 사전조건, ConfirmModal, completed 읽기 전용, Toast 에러 처리를 검증하라.

### 1. 단계 전환 흐름 검증 및 보완

`src/app/api/workshops/[id]/route.ts`의 PATCH 핸들러를 보완하라:

단계 전환 시 최소 조건 검증:
- gather → cluster: notes가 1개 이상 존재해야 함
- cluster → vote: clusters가 1개 이상 존재해야 함
- vote → derive: 퍼실리테이터의 ConfirmModal 확인 자체를 "투표 마감 선언"으로 간주. 최소 1표 또는 전원 투표는 필수 아님
- derive → generate: ax_tasks가 1개 이상 존재해야 함
- generate → completed: PRD가 1개 이상 존재해야 함

조건 미충족 시 400 에러 + 구체적 메시지 ("클러스터링을 먼저 실행하세요" 등)

completed 상태에서는 모든 쓰기 API(notes, votes, clusters, tasks, prd, settings 변경)를 차단하고 산출물 조회만 허용한다.

### 2. StageNav 보완

`src/components/workshop/StageNav.tsx`를 보완하라:

- "다음 단계로" 버튼 클릭 시 `ConfirmModal` 컴포넌트로 확인 대화상자 표시 ("투표 단계로 넘어가시겠습니까? 이전 단계로 돌아갈 수 없습니다.")
- 단계 전환 실패 시 Toast(에러) + 인라인 메시지 표시 (조건 미충족)
- 각 단계 아이콘 + 라벨 표시 (Lucide 아이콘 사용)
  - 수집: StickyNote 아이콘
  - 클러스터: Layers 아이콘
  - 투표: Vote 아이콘
  - 과제: Lightbulb 아이콘
- PRD: FileText 아이콘
- vote 단계의 버튼 문구는 "투표 마감"으로 표시하고, 확인 후 derive로 전환한다.
- generate 단계에서 PRD가 생성된 경우 "워크샵 완료" 버튼을 표시하고, 확인 후 completed로 전환한다.

### 3. 초대 코드 공유 UI

`src/components/workshop/InviteCode.tsx`:
- 워크샵 초대 코드를 큰 글씨로 표시 (프로젝터 공유용)
- "코드 복사" 버튼
- 참석자 수 실시간 표시
- 사이드바 상단에 배치

### 4. 워크샵 완료 상태

generate 단계에서 PRD가 생성되면 "워크샵 완료" 상태를 표시하라:
- "워크샵이 완료되었습니다" 배너
- 전체 결과 요약: 포스트잇 N개 → 클러스터 N개 → 투표 N표 → 과제 N개 → PRD 생성 완료
- "Markdown 복사" 버튼 (PRD)
- completed 상태로 전환된 이후 접속한 참석자와 퍼실리테이터 모두 읽기 전용 산출물 화면을 본다.

### 5. 에러 처리 및 로딩 상태 통합

모든 AI 호출(클러스터링, 과제 도출, PRD 생성)의 에러 처리를 통일하라:
- 네트워크 에러: Toast(에러) "AI 서비스에 연결할 수 없습니다. 잠시 후 다시 시도하세요."
- 타임아웃: Toast(에러) "AI 처리 시간이 초과되었습니다. 다시 시도하세요."
- API 에러: 서버에서 반환한 에러 메시지를 Toast로 표시
- Toast는 `sonner` 라이브러리 사용 (Step 0에서 설치 완료). `<Toaster />` 컴포넌트를 root layout에 추가
- alert() 사용 금지. 항상 Toast 또는 인라인 ErrorState 컴포넌트 사용

로딩 상태:
- AI 호출 중: "AI가 분석 중입니다..." + pulse 애니메이션 + 버튼 disabled
- 단계 전환 중: 버튼 disabled + 짧은 진행 문구. spinner는 사용하지 않는다.

### 6. 전체 레이아웃 마무리

`src/app/workshop/[id]/layout.tsx`를 최종 정리하라:
- 모든 Realtime 구독이 올바르게 설정되어 있는지 확인 (workshops, notes, clusters, votes, presence)
- 구독 해제가 cleanup에서 모두 처리되는지 확인
- 사이드바: StageNav + InviteCode + ParticipantList
- 헤더: 워크샵 제목 + 현재 단계 표시 + 참석자 수
- workshop/[id] 레이아웃에 Error Boundary를 연결하여 컴포넌트 예외 시 폴백 UI와 새로고침 버튼을 제공한다.

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
3. 수집 단계: 각자 포스트잇 작성 (실시간 동기화 확인)
4. 클러스터 단계로 전환 → AI 클러스터링 실행 → 결과 확인
5. 투표 단계로 전환 → 각 참석자 투표 → 결과 공개
6. 과제 단계로 전환 → AI 과제 도출 → 결과 확인
7. PRD 단계로 전환 → AI PRD 생성 → Markdown 확인/복사
8. 워크샵 완료 → completed 읽기 전용 화면 확인

위 시나리오가 에러 없이 완료되면 성공.

## 금지사항

- 새로운 기능을 추가하지 마라. 이 step은 기존 기능의 통합과 마무리만 한다.
- 퍼포먼스 최적화를 이 step에서 하지 마라. 이유: MVP에서는 10명 규모이므로 불필요
- 기존 step에서 구현한 API의 인터페이스를 변경하지 마라. 호환성을 깨뜨리면 안 됨
