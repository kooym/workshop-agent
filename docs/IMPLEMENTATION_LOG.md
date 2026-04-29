# Implementation Log

이 문서는 개발 중 발생한 결정사항, 검증 결과, 제약사항을 후속 작업자가 바로 이어받을 수 있도록 누적 기록한다.

## 2026-04-26

### Completed: Step 4 realtime-board

- 구현: Gather 단계 `notes` API, `boardStore`, tldraw 캔버스 shell, DB 정본 기반 Sticky Note UI, Yjs/y-supabase provider adapter, `yjs_documents` migration, notes Realtime 구독.
- 검증: `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test`, `npm.cmd run build` 통과.
- 제약: Docker Desktop/daemon이 없어 Supabase migration 실제 적용과 멀티탭 Yjs E2E는 미검증.
- 메모: `y-supabase` package entry가 잘못되어 `y-supabase/dist/index.js`로 우회했고 `next.config.ts`에 `transpilePackages`를 추가했다.

### Completed: Step 5 ai-clustering

- 구현: Azure OpenAI client wrapper, clustering prompt/schema/retry helper, AI 응답 사후 검증, `/api/ai/cluster`, clusters GET/PATCH API, clusterStore, ClusterView/ClusterGroup, clusters Realtime 구독.
- 검증: mock AI 기반 테스트 포함 `14 files / 47 tests` 통과, production build 통과.
- 제약: 네트워크 제한으로 Azure OpenAI live 호출 미검증. Docker 미사용으로 DB migration/runtime E2E 미검증.

### Completed: Step 6 dot-voting

- 구현: votes create/delete/list API, results/stats API, vote policy helpers, voteStore, DotVoting/VotingCard/VoteResult, results reveal control, votes Realtime 구독.
- 검증: `15 files / 51 tests` 통과, production build 통과.
- 제약: Supabase live Realtime/unique constraint E2E는 Docker Desktop/daemon 부재로 미검증.
- 운영 메모: 기존 3000번 dev server가 포트를 점유했지만 `/api/health` 응답이 없었다. 검증용 서버는 3001번에서 정상 응답했다.

## 2026-04-27

### Completed: Step 7 ax-design

- 구현: AX 설계 prompt/schema/API, design_artifacts/tasks/reactions API, DesignView 6개 탭, Mermaid + React Flow TO-BE 뷰, 퍼실리테이터 그래프 위치/라벨 편집 저장, task/reaction UI, design/task/reaction Realtime 연결.
- 검증: `npm run lint`, `npm run typecheck`, `npm run test` (`17 files / 59 tests`), `npm run build` 통과.
- 테스트 보강: `/api/ai/design` route의 design-stage lock, active/stale processing lock, 성공 후 processing 해제, AI 실패 시 processing 복구를 추가 검증했다.
- 현재 결정: `ax_tasks` 테이블에는 task별 다중 cluster_ids 컬럼이 없으므로 MVP DB 반영은 `cluster_id` 단일 대표 클러스터와 `pain_points` JSON에 전체 cluster_ids를 보존한다.
- 제약: Live Azure OpenAI 호출, Supabase DB/Realtime E2E, Docker build는 네트워크 제한과 Docker Desktop/daemon 부재로 미검증. 현재 Node는 v25.6.0이고 프로젝트 표준은 Node 20 LTS다.

### Completed: Step 8 output-generation

- 구현: PRD/종합 보고서 prompt, Markdown content schema, `/api/ai/generate`, `/api/ai/report`, 최신 PRD/보고서 조회·버전 증가 저장 API, react-markdown 기반 Preview/Editor, MermaidDiagram lazy renderer, Markdown 복사, PRD reaction bar.
- 검증: output helper 테스트를 추가했고 전체 `npm run lint`, `npm run typecheck`, `npm run test` (`19 files / 66 tests`), `npm run build` 통과.
- 제약: Live Azure OpenAI 출력 생성과 Supabase DB/Realtime E2E는 미검증.

### Completed: Step 9 stage-flow

- 구현: 단계 전환 사전조건 검증, 워크샵 summary API, StageNav 아이콘/자유 네비게이션/ConfirmModal/stale 배지/409 처리, InviteCode, Timer, StageGuideBanner, StaleBanner, completed JourneySummary/내 기여 요약/산출물 이동·복사.
- 검증: stage prerequisite 테스트와 secret audit(`rg "SUPABASE_SERVICE_ROLE_KEY|AZURE_OPENAI_API_KEY|SESSION_SECRET" src/app src/components`) 통과. `/api/health`는 dev server `http://localhost:3001`에서 200 응답 확인.
- 릴리즈 게이트: `next.config.ts` standalone, Dockerfile standalone/static/public 복사, `.dockerignore` env/node_modules/.next/coverage 제외, port 3000 설정을 확인했다.
- 제약: `docker build -t workshop-agent .`는 Docker 권한 승인 후 buildx까지 진입했지만 `node:20-alpine` metadata resolution 단계에서 장시간 멈춰 취소했다. Docker image smoke test는 미검증. 현재 Node는 v25.6.0이고 프로젝트 표준은 Node 20 LTS다.
