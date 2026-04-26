# Step 6: dot-voting

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 투표 API, voteStore, Realtime 동기화
- `/docs/PRD.md` — Stage 4: 투표 (Vote) 전체 기능
- `/docs/UI_GUIDE.md` — VotingCard 컴포넌트, 투표 화면 레이아웃
- `/docs/SPEC_AUDIT.md` — vote -> design 전환 조건, 단계 잠금 결정
- `/docs/MODULE_MAP.md`
- `/docs/modules/06-voting-prioritization.md`
- `/docs/modules/02-project-workshop-lifecycle.md`
- `/docs/modules/08-ui-experience-system.md`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라:

- `/src/types/vote.ts`
- `/src/types/cluster.ts`
- `/src/stores/workshop.ts` — workshopStore 패턴 참조
- `/src/app/api/clusters/route.ts`
- `/src/components/cluster/ClusterGroup.tsx`
- `/src/lib/api/middleware.ts`
- `/src/lib/api/validators.ts`

## 작업

도트 투표 기능을 구현하라. Stage 4(투표 단계)의 핵심 기능이다.

이 step은 새 API/상태/UI 기능이므로 테스트를 먼저 작성한다. 투표 수 제한, 중복 투표, stage lock, 결과 비공개 정책을 구현 전에 테스트로 고정하라.

### 1. 투표 API Routes

`src/app/api/votes/route.ts`:

- **POST** — 투표. 요청 body를 Zod 검증: `{ workshop_id, cluster_id?, note_id? }`. 투표 대상은 workshop.settings.vote_mode에 따라 결정: vote_mode='cluster'이면 cluster_id 필수, vote_mode='note'이면 note_id 필수. 둘 다 널이거나 둘 다 있으면 400 에러. participant_id는 세션에서 추출. `withAuth` 미들웨어 사용.
  - current_stage가 `vote`가 아니면 409 반환
  - 남은 투표 수 검증: 참석자의 기존 투표 수가 설정된 votes_per_person(기본 3, workshop.settings.votes_per_person에서 읽음) 이상이면 400 에러
  - 동일 대상 중복 투표 방지: DB 유니크 제약으로 보장 (409 에러)
  - votes 테이블에 INSERT
  - **stale 전파**: `current_stage > 'vote'`이면 `propagateStale(workshopId, 'vote')` 호출 (design_artifacts, prds, ax_reports에 is_stale=true 설정)

- **DELETE** `?id=:vote_id` — 투표 취소. query를 Zod 검증한다. current_stage가 `vote`일 때만 허용하고, 본인 투표만 삭제 가능.
  - **stale 전파**: `current_stage > 'vote'`이면 `propagateStale(workshopId, 'vote')` 호출

`src/app/api/votes/results/route.ts`:

- **GET** `?workshop_id=:id` — 투표 결과 집계.
  - query를 Zod 검증하고 `withAuth` 미들웨어 사용
  - `settings.results_visible=false`이고 current_stage가 vote이면 참석자와 퍼실리테이터 모두에게 결과 수치를 숨긴다. 이 경우 표준 응답으로 빈 results 또는 `visible:false`를 반환한다.
  - AI 과제 도출 API는 서버 내부 권한으로 votes를 읽되, 일반 결과 조회 정책과 섞지 않는다.
  - target_type별로 그룹화 (vote_mode에 따라 cluster 또는 note 기준)
  - **cluster 모드 집계**: `SELECT cluster_id, clusters.name AS target_name, COUNT(*) AS vote_count FROM votes JOIN clusters ON votes.cluster_id = clusters.id WHERE votes.workshop_id = :id GROUP BY cluster_id, clusters.name ORDER BY vote_count DESC`
  - **note 모드 집계**: `SELECT note_id, LEFT(notes.content, 30) AS target_name, COUNT(*) AS vote_count FROM votes JOIN notes ON votes.note_id = notes.id WHERE votes.workshop_id = :id GROUP BY note_id, notes.content ORDER BY vote_count DESC`
  - `percentage`: 각 target의 vote_count / 전체 투표 수 * 100 (소수 첫째 자리)
  - 각 target의 총 투표 수 계산
  - 투표 수 기준 내림차순 정렬
  - 응답: `{ results: { cluster_id?, note_id?, target_name, vote_count, percentage }[] }`
  - `target_name`: cluster 모드에서는 클러스터명, note 모드에서는 포스트잇 content 앞 30자

`src/app/api/votes/stats/route.ts`:

- **GET** `?workshop_id=:id` — 투표 참여 통계.
  - query를 Zod 검증하고 `withAuth` 미들웨어 사용
  - 응답: `{ data: { total_participants, voted_participants, participation_rate } }`

### 2. Zustand 투표 스토어

`src/stores/vote.ts`:

```typescript
interface VoteStore {
  votes: Vote[]                     // 전체 투표
  myVotes: Vote[]                   // 내 투표
  remainingVotes: number            // 남은 투표 수
  resultsVisible: boolean           // 결과 공개 여부
  votesPerPerson: number            // 1인당 투표 수

  setVotes(votes: Vote[]): void
  castVote(targetType: VoteTargetType, targetId: string): Promise<void>
  removeVote(voteId: string): Promise<void>
  setResultsVisible(visible: boolean): void
  syncFromRealtime(eventType: string, vote: Vote): void

  // 계산 프로퍼티
  getResultsByTarget(): VoteResult[]
}
```

### 3. Realtime 구독 추가

layout.tsx의 Realtime 설정에 votes 채널 구독 추가:
- votes 테이블의 INSERT/DELETE 이벤트 감지
- 투표 발생/취소 시 voteStore.syncFromRealtime() 호출
- **동시 투표 경합 처리**: 사용자가 투표 버튼 클릭 후 API에서 `VOTE_LIMIT` 에러(409)를 받으면, voteStore를 서버 상태로 재페치하여 UI를 복구한다. optimistic update는 사용하지 않음 (Realtime CDC가 1-2초 이내에 최신 상태를 전파하므로 충분)

### 4. 투표 UI 컴포넌트

`src/components/vote/DotVoting.tsx` — 투표 메인 컴포넌트:
- 상단: 남은 투표 수 표시 ("3표 중 1표 사용")
- vote_mode='cluster'이면 클러스터 단위 VotingCard, vote_mode='note'이면 개별 노트 단위 VotingCard 렌더링
- 퍼실리테이터에게만 투표 참여율 표시 ("8/12명 투표 완료")
- 투표 완료 시 결과 대기 메시지

`src/components/vote/VotingCard.tsx` — 개별 투표 카드:
- UI 가이드의 VotingCard 디자인 구현
- vote_mode='cluster': 클러스터 이름 + 요약 + 포함된 포스트잇 수. 아코디언 토글로 포함된 포스트잇 목록 펼치기/접기
- vote_mode='note': 개별 노트 내용 + 소속 클러스터 Badge
- "투표하기" 버튼 (남은 표가 있을 때만 활성)
- 이미 투표한 항목은 "투표 취소" 버튼 표시
- 투표 시 scale-in 애니메이션으로 도트 추가

`src/components/vote/VoteResult.tsx` — 투표 결과 시각화:
- 바 차트 형태 (가로 막대)
- 투표 수 + 퍼센트 표시
- 내림차순 정렬
- 결과 공개 전: "퍼실리테이터가 결과를 공개할 때까지 대기 중"

### 5. 결과 공개 컨트롤

퍼실리테이터만 볼 수 있는 "결과 공개" 버튼:
- 클릭 시 `PATCH /api/workshops/:id` 호출. body: `{ settings: { results_visible: true } }`. `withFacilitator` 검증
- Realtime 전파: `workshop:{workshop_id}` 채널이 workshops 테이블의 UPDATE 이벤트를 감지. step3에서 설정한 Realtime 구독이 `settings` 변경도 감지하도록 workshopStore에서 `settings.results_visible` 변경 시 `voteStore.setResultsVisible(true)` 호출
- 결과 공개 후 VoteResult 컴포넌트 렌더링: 모든 참석자의 화면에서 동시에 투표 결과 바 차트 표시
- "결과 공개" 버튼은 한 번 누르면 토글 불가 (results_visible=true 후 false로 되돌릴 수 없음. 한 번 공개하면 유지)
- `vote -> design` 전환은 Step 9에서 ConfirmModal을 통해 "투표 마감" 선언으로 처리한다. 최소 1표 또는 전원 투표는 필수 조건이 아니다.

### 6. Stage 4 페이지 연결

워크샵 메인 페이지의 `vote` stage 분기에 DotVoting 컴포넌트를 연결하라.
초기 데이터(votes, clusters)를 서버 컴포넌트에서 fetch하여 주입하라.

## Acceptance Criteria

```bash
npm run lint    # lint 에러 없음
npm run typecheck # 타입 검사 통과
npm run test    # 테스트 통과
npm run build   # 컴파일 에러 없음
```

- 투표가 실시간으로 다른 참석자에게 반영되는지 확인
- 1인당 투표 수 제한이 동작하는지 확인 (기본 3표)
- 동일 대상 중복 투표가 거부되는지 확인
- 투표 취소가 정상 동작하는지 확인
- 결과 공개 전에는 다른 참석자의 투표 현황이 보이지 않는지 확인
- vote 단계가 아니면 투표 생성/취소가 API에서 차단되는지 확인

## 금지사항

- 가중치 투표(weighted voting)를 구현하지 마라. 이유: MVP에서는 1인 1표 = 동일 가중치
- 투표 타이머를 이 step에서 구현하지 마라. 이유: Post-MVP 기능
- 투표 결과를 캐싱하지 마라. 항상 실시간 집계
