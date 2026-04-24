# M3 Realtime Collaboration

## 책임

워크샵 상태와 참여자 온라인 상태, DB 변경 사항이 모든 클라이언트에 안정적으로 전파되도록 한다.

## 소유 범위

- `workshop:{id}` Realtime channel
- `notes:{workshop_id}` Realtime channel
- `clusters:{workshop_id}` Realtime channel
- `votes:{workshop_id}` Realtime channel
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
