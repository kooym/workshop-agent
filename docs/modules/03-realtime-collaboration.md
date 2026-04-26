# M3 Realtime Collaboration

## 책임

워크샵 상태와 참여자 온라인 상태, DB 변경 사항이 모든 클라이언트에 안정적으로 전파되도록 한다.

## 소유 범위

- `workshop:{id}` Realtime channel
- `process_steps:{workshop_id}` Realtime channel
- `process_edges:{workshop_id}` Realtime channel
- `process_lanes:{workshop_id}` Realtime channel
- `editing_locks:{workshop_id}` Realtime channel
- `notes:{workshop_id}` Realtime channel
- `clusters:{workshop_id}` Realtime channel
- `votes:{workshop_id}` Realtime channel
- `reactions:{workshop_id}` Realtime channel
- `design:{workshop_id}` Realtime channel
- `presence:{workshop_id}` channel
- reconnect/refetch strategy
- Zustand store hydration and recovery pattern

## 소유하지 않는 것

- Yjs document 내부 변경 모델: M4
- API 쓰기 권한 검증: M1/M2/domain module
- UI 표시 컴포넌트: M8

## 계약

- Realtime 구독은 `workshop/[id]/layout.tsx`에서 한 번 설정한다.
- 각 channel cleanup은 unmount에서 반드시 수행한다.
- reconnect 성공 시 서버 API로 전체 상태를 다시 fetch한다.
- Optimistic update와 Realtime 중복 반영은 각 도메인 store가 pending id로 제어한다.
- Realtime 이벤트를 권한의 근거로 삼지 않는다. 권한은 API에서 검증한다.

### 채널별 구독 패턴

| 채널 | postgres_changes 필터 | 수신 이벤트 |
|------|----------------------|-------------|
| `workshop:{id}` | `table='workshops', filter='id=eq.${workshopId}'` | UPDATE |
| `process_steps:{workshop_id}` | `table='process_steps', filter='workshop_id=eq.${workshopId}'` | INSERT, UPDATE, DELETE |
| `process_edges:{workshop_id}` | `table='process_edges', filter='workshop_id=eq.${workshopId}'` | INSERT, UPDATE, DELETE |
| `process_lanes:{workshop_id}` | `table='process_lanes', filter='workshop_id=eq.${workshopId}'` | INSERT, UPDATE, DELETE |
| `editing_locks:{workshop_id}` | `table='editing_locks', filter='workshop_id=eq.${workshopId}'` | INSERT, UPDATE, DELETE |
| `notes:{workshop_id}` | `table='notes', filter='workshop_id=eq.${workshopId}'` | INSERT, UPDATE, DELETE |
| `clusters:{workshop_id}` | `table='clusters', filter='workshop_id=eq.${workshopId}'` | INSERT, UPDATE, DELETE |
| `votes:{workshop_id}` | `table='votes', filter='workshop_id=eq.${workshopId}'` | INSERT, DELETE |
| `reactions:{workshop_id}` | `table='task_reactions', filter='workshop_id=eq.${workshopId}'` | INSERT, DELETE |
| `design:{workshop_id}` | `table='design_artifacts'+'ax_tasks'+'prds'+'ax_reports', filter='workshop_id=eq.${workshopId}'` | INSERT, UPDATE |
| `presence:{workshop_id}` | Supabase Presence (CDC 아님) | sync, join, leave |

페이로드 타입 상세는 `ARCHITECTURE.md` > "채널별 이벤트 페이로드 스키마" 섹션을 참조한다.

### Presence 채널 상세

- 클라이언트는 **10초 주기**로 presence heartbeat를 전송한다.
- `presence:leave` 이벤트 수신 후 **30초** 내 rejoin이 없으면 해당 참가자를 오프라인으로 처리한다.
- editing_locks의 stale lock 감지: 현재 Active 편집자가 오프라인(30초 미응답)이면 다음 잠금 요청자가 stale lock을 해제하고 Active를 획득한다.
- 타이머 동기화: 퍼실리테이터가 타이머를 시작/중지하면 presence broadcast로 전체 참여자에게 전파한다 (Post-MVP 구현 시).

### 재연결 전략

Supabase Realtime 클라이언트는 WebSocket 끊김 시 **내장 자동 재연결**을 수행한다. 추가로 다음을 보장한다:

1. **재연결 감지**: `channel.on('system', { event: 'reconnect' })` 또는 Supabase 클라이언트의 연결 상태 콜백을 구독한다.
2. **전체 재페치**: 재연결 성공 시 `workshopStore`, `boardStore`, `processGraphStore`, `voteStore`, `designStore`, `prdStore`, `reportStore`의 서버 데이터를 API로 전체 재페치한다. 재연결 중 누락된 CDC 이벤트를 보상한다.
3. **재페치 순서**: workshop → process_steps → process_edges → process_lanes → editing_locks → notes → clusters → votes → ax_tasks → design_artifacts → prds → ax_reports → participants 순서로 fetch하여 의존 관계를 보장한다.
4. **UI 피드백**: 연결 끊김 시 헤더에 "연결 끊김" 인디케이터를 표시하고, 재연결 성공 시 자동 제거한다.

### Optimistic Update와 Realtime 병합

```
클라이언트 액션 (예: 포스트잇 생성)
  → boardStore.addNote(note) // optimistic: pending id로 즉시 UI 반영
  → API POST /api/notes      // 서버 처리
  → Realtime CDC INSERT 수신  // 서버에서 확정된 레코드 전파
  → boardStore.syncFromRealtime(payload)
    → pending id와 서버 id가 매칭되면 pending 제거 (중복 방지)
    → 매칭 실패 시 (다른 사용자의 새 데이터) 정상 추가
```

- **중복 방지**: 각 store는 `pendingIds: Set<string>`을 관리한다. optimistic 추가 시 id를 등록하고, Realtime 수신 시 pendingIds에 해당 id가 있으면 기존 항목을 서버 데이터로 교체한다.
- **실패 롤백**: API 호출 실패 시 pendingIds에서 제거하고 optimistic 항목을 rollback한다. Toast로 에러를 표시한다.

## 확장 포인트

- cursor 위치 표시
- offline retry queue
- connection quality indicator
- audit/event stream
- workshop replay

## 테스트

- store syncFromRealtime 동작
- reconnect refetch 호출
- channel cleanup
- optimistic duplicate ignore

## 운영 고려사항

- Supabase Realtime 장애 시 사용자는 stale 상태를 볼 수 있으므로 reconnect 안내와 수동 새로고침 경로가 필요하다.
- 동시 접속 목표는 MVP 20명이다.
