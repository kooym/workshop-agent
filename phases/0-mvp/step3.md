# Step 3: workshop-crud

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — API 설계 (워크샵 CRUD), 상태 관리 (workshopStore)
- `/docs/PRD.md` — F1(워크샵 생성/관리), 워크샵 프로세스 5단계
- `/docs/SPEC_AUDIT.md` — completed 단계, 프로젝트 계층, 단계 잠금 결정
- `/docs/MODULE_MAP.md`
- `/docs/modules/02-project-workshop-lifecycle.md`
- `/docs/modules/03-realtime-collaboration.md`
- `/docs/modules/08-ui-experience-system.md`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라:

- `/src/app/api/workshops/route.ts`
- `/src/app/api/workshops/join/route.ts`
- `/src/app/api/projects/route.ts`
- `/src/lib/session.ts`
- `/src/app/workshop/[id]/layout.tsx`
- `/src/app/workshop/[id]/page.tsx`
- `/src/types/workshop.ts`

## 작업

워크샵 조회/수정 API와 Zustand 상태 관리, Realtime 구독을 구현하라.

이 step은 새 API/상태 로직을 추가하므로 테스트를 먼저 작성한다. 특히 단계 전환, 프로젝트 소유권, 비퍼실리테이터 403을 구현 전에 테스트로 고정하라.

### 1. API Route: 워크샵 조회

`src/app/api/workshops/[id]/route.ts` — GET 핸들러:

- `withAuth` 미들웨어로 세션 검증: 요청자가 해당 워크샵의 participant인지 확인
- workshops + participants 조인하여 반환
- 응답: `{ data: { workshop, participants } }`

### 2. API Route: 워크샵 수정

`src/app/api/workshops/[id]/route.ts` — PATCH 핸들러:

- `withFacilitator` 미들웨어로 권한 검증: 요청자가 해당 워크샵의 **퍼실리테이터**인지 확인
- 요청 body를 Zod 스키마로 검증: `{ title?, current_stage?, settings? }`
- 수정 가능 필드: `title`, `current_stage`, `settings`
- current_stage 변경 시 유효한 전이인지 검증 (gather→cluster→vote→derive→generate→completed 순서만 허용, 역방향 금지)
- completed 상태 워크샵은 읽기 전용이므로 title/settings/current_stage 수정 시 403 또는 409를 반환한다. 단, generate→completed 전환은 허용한다.
- settings 변경 제약을 적용한다: `anonymous`는 gather에서만, `votes_per_person`은 vote 진입 전까지만, `max_participants`는 현재 참가자 수 이상으로만 변경 가능, `results_visible`은 언제든 변경 가능.
- 응답: `{ data: workshop }`

### 3. Zustand 워크샵 스토어

`src/stores/workshop.ts`:

```typescript
interface WorkshopStore {
  workshop: Workshop | null
  participants: Participant[]
  currentParticipant: Participant | null
  isFacilitator: boolean

  setWorkshop(workshop: Workshop): void
  setParticipants(participants: Participant[]): void
  setCurrentParticipant(participant: Participant): void
  updateStage(stage: WorkshopStage): void
  addParticipant(participant: Participant): void
}
```

### 4. Realtime 구독 설정

`src/app/workshop/[id]/layout.tsx`에 Supabase Realtime 구독을 설정하라:

- `workshop:{id}` 채널 구독: workshops 테이블의 UPDATE 이벤트 감지
  - current_stage 변경 시 workshopStore.updateStage() 호출
- `presence:{id}` 채널 구독: 참석자 온라인 상태 추적
  - 접속/퇴장 시 참석자 목록 UI 업데이트
- layout 언마운트 시 구독 해제 (cleanup)
- WebSocket 재연결 성공 시 workshop/participants를 API로 다시 fetch하여 Zustand 스토어를 복구한다.

### 5. 사이드바 컴포넌트

`src/components/workshop/StageNav.tsx` — 단계 네비게이션:
- 5단계 표시 (수집, 클러스터, 투표, 과제, PRD)
- 현재 단계 하이라이트
- 퍼실리테이터에게만 "다음 단계로" 버튼 표시
- 단계 전환 버튼은 아직 ConfirmModal을 붙이지 않고, Step 9에서 최종 보완한다.
- UI 가이드의 StageNav 디자인 참조

`src/components/workshop/ParticipantList.tsx` — 참석자 목록:
- 온라인 참석자 표시 (이름 + 역할)
- 온라인 상태 표시 (녹색 dot)
- 퍼실리테이터 표시 (crown 아이콘 등)

### 6. 워크샵 메인 페이지 업데이트

`src/app/workshop/[id]/page.tsx`를 수정하여 current_stage에 따라 적절한 placeholder 컴포넌트를 렌더링하라:

```typescript
switch (workshop.current_stage) {
  case 'gather': return <div>포스트잇 보드 (Step 4에서 구현)</div>
  case 'cluster': return <div>클러스터 뷰 (Step 5에서 구현)</div>
  case 'vote': return <div>투표 화면 (Step 6에서 구현)</div>
  case 'derive': return <div>AX 과제 (Step 7에서 구현)</div>
  case 'generate': return <div>PRD 생성 (Step 8에서 구현)</div>
  case 'completed': return <div>워크샵 완료 (Step 9에서 구현)</div>
}
```

## Acceptance Criteria

```bash
npm run lint    # lint 에러 없음
npm run typecheck # 타입 검사 통과
npm run test    # 테스트 통과
npm run build   # 컴파일 에러 없음
```

- GET /api/workshops/:id가 워크샵 + 참석자 정보를 반환하는지 확인
- PATCH /api/workshops/:id로 단계 전환이 되는지 확인
- 비퍼실리테이터가 단계 전환을 시도하면 403이 반환되는지 확인
- 역방향 단계 전환 (예: vote→gather)이 거부되는지 확인
- generate→completed 전환이 허용되고 completed 이후 수정이 거부되는지 확인

## 금지사항

- 포스트잇, 투표 등 다른 기능의 API/UI를 이 step에서 구현하지 마라
- Realtime 구독에서 notes, votes 등 다른 테이블을 구독하지 마라. 이 step에서는 workshops + presence만 구독
- 단계 전환 시 데이터 검증(예: 포스트잇이 있어야 클러스터링 가능)은 이 step에서 하지 마라. 단순 순서 검증만 수행
