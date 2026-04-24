# Step 6: dot-voting

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 투표 API, voteStore, Realtime 동기화
- `/docs/PRD.md` — Stage 3: 투표 (Vote) 전체 기능
- `/docs/UI_GUIDE.md` — VotingCard 컴포넌트, 투표 화면 레이아웃
- `/docs/SPEC_AUDIT.md` — vote -> derive 전환 조건, 단계 잠금 결정
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

도트 투표 기능을 구현하라. Stage 3(투표 단계)의 핵심 기능이다.

이 step은 새 API/상태/UI 기능이므로 테스트를 먼저 작성한다. 투표 수 제한, 중복 투표, stage lock, 결과 비공개 정책을 구현 전에 테스트로 고정하라.

### 1. 투표 API Routes

`src/app/api/votes/route.ts`:

- **POST** — 투표. 요청 body를 Zod 검증: `{ workshop_id, target_type, target_id }`. participant_id는 세션에서 추출. `withAuth` 미들웨어 사용.
  - current_stage가 `vote`가 아니면 409 반환
  - 남은 투표 수 검증: 참석자의 기존 투표 수가 설정된 votes_per_person(기본 3, workshop.settings.votes_per_person에서 읽음) 이상이면 400 에러
  - 동일 대상 중복 투표 방지: DB 유니크 제약으로 보장 (409 에러)
  - votes 테이블에 INSERT

- **DELETE** `?id=:vote_id` — 투표 취소. query를 Zod 검증한다. current_stage가 `vote`일 때만 허용하고, 본인 투표만 삭제 가능.

`src/app/api/votes/results/route.ts`:

- **GET** `?workshop_id=:id` — 투표 결과 집계.
  - query를 Zod 검증하고 `withAuth` 미들웨어 사용
  - `settings.results_visible=false`이고 current_stage가 vote이면 참석자와 퍼실리테이터 모두에게 결과 수치를 숨긴다. 이 경우 표준 응답으로 빈 results 또는 `visible:false`를 반환한다.
  - AI 과제 도출 API는 서버 내부 권한으로 votes를 읽되, 일반 결과 조회 정책과 섞지 않는다.
  - target_type별로 그룹화
  - 각 target의 총 투표 수 계산
  - 투표 수 기준 내림차순 정렬
  - 응답: `{ results: { target_id, target_type, target_name, vote_count, percentage }[] }`

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

### 4. 투표 UI 컴포넌트

`src/components/vote/DotVoting.tsx` — 투표 메인 컴포넌트:
- 상단: 남은 투표 수 표시 ("남은 표: 🔵🔵 (2/3)")
- 클러스터 단위로 VotingCard 목록 렌더링
- 투표 완료 시 결과 대기 메시지

`src/components/vote/VotingCard.tsx` — 개별 투표 카드:
- UI 가이드의 VotingCard 디자인 구현
- 클러스터 이름 + 요약 + 포함된 포스트잇 수
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
- 클릭 시 workshop.settings.results_visible을 true로 변경
- `withFacilitator` 미들웨어로 PATCH /api/workshops/:id로 settings 업데이트
- Realtime으로 전체 참석자에게 전파 (워크샵 설정 변경 이벤트)
- 결과 공개 후 VoteResult 컴포넌트 렌더링
- `vote -> derive` 전환은 Step 9에서 ConfirmModal을 통해 "투표 마감" 선언으로 처리한다. 최소 1표 또는 전원 투표는 필수 조건이 아니다.

### 6. Stage 3 페이지 연결

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
