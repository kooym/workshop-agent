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

### In Progress: Step 7 ax-design

- 시작: AX 설계 단계 구현을 시작했다.
- 범위: design prompt/schema/API, design_artifacts/tasks/reactions API, Design 화면, design/task/reaction Realtime 연결.
- 현재 결정: `ax_tasks` 테이블에는 task별 다중 cluster_ids 컬럼이 없으므로 MVP DB 반영은 `cluster_id` 단일 대표 클러스터와 `pain_points` JSON에 전체 cluster_ids를 보존하는 방식으로 구현한다.
