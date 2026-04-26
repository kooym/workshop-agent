# M2 Project & Workshop Lifecycle

## 책임

프로젝트와 워크샵의 생성, 설정, 초대 코드, 단계 전환, 완료 상태를 소유한다.

## 소유 범위

- `projects` CRUD
- `workshops` CRUD
- invite code 생성/충돌 재시도
- `WorkshopSettings` (6개 필드: `anonymous`, `votes_per_person`, `vote_mode`, `results_visible`, `max_participants`, `timer_minutes`)
- stage transition guard
- completed read-only state
- 프로젝트당 활성 워크샵 1개 제한
- `process_steps` CRUD (`/api/process-steps*`)
- `process_edges` CRUD (`/api/process-edges*`)
- `process_lanes` CRUD (`/api/process-lanes*`)
- `editing_locks` 관리 (`/api/editing-locks*`, `/api/process-graph`)
- Active/Sleep 편집 잠금 패턴 (context 단계, 30초 타임아웃으로 stale lock 자동 해제)
- context 단계 프로세스 그래프 stage lock
- `propagateStale(workshopId, modifiedStage)` 하류 stale 전파 (`src/lib/api/stale.ts`)
- `viewingStage` Zustand 상태 관리 (`src/stores/workshop.ts`)
- `is_processing_since` stale lock 5분 자동 복구
- `/api/workshops/:id/advance-stage` 단계 전진 API
- `/api/workshops/:id/dismiss-stale` stale 디스미스 API
- 워크샵 생성 시 퍼실리테이터를 `participants` 테이블에 자동 INSERT (is_facilitator: true)

## 소유 데이터

- `projects`
- `workshops`
- `workshops.settings` (anonymous, votes_per_person, vote_mode, results_visible, max_participants, timer_minutes)
- `workshops.current_stage`
- `workshops.is_processing`의 일반 상태. 단, AI 실행 중 lock 토글은 M5가 제한적으로 쓴다.
- `workshops.is_processing_since` 타임스탬프 (5분 초과 시 stale lock 자동 해제)
- `process_steps`
- `process_edges`
- `process_lanes`
- `editing_locks`

## 소유하지 않는 것

- 참가자 세션 발급: M1
- notes/votes/tasks/prds 생성: M4/M6/M7
- AI 실행: M5
- sidebar UI 구현: M8

## 계약

- 워크샵은 반드시 프로젝트에 속한다.
- 같은 프로젝트에는 completed가 아닌 활성 워크샵이 최대 1개만 존재한다.
- stage는 `context → gather → cluster → vote → design → generate → report → completed` 순서로 전진한다 (8단계). `current_stage`는 최고 도달 단계를 추적한다.
- 자유 네비게이션 이중 상태:
  - `current_stage` (DB, 공유): 워크샵의 최고 도달 단계. 퍼실리테이터가 "다음 단계로" 전진 시에만 변경.
  - `viewingStage` (Zustand, 개인): 사용자가 현재 보고 있는 단계. StageNav 클릭으로 변경. 다른 참여자에게 전파되지 않음.
  - 초기값: `viewingStage = current_stage`. Realtime으로 `current_stage` 전진 수신 시 `viewingStage`도 자동 이동.
- **자유 네비게이션**: 참여자는 `current_stage` 이하의 모든 단계를 자유롭게 이동하며 열람·편집 가능. 이전 단계 편집 시 하류 AI 산출물에 `is_stale = true` 전파.
- **Stale 데이터 전파**: `propagateStale(workshopId, modifiedStage)` 유틸(`src/lib/api/stale.ts`)을 호출. 각 리소스 수정 API에서 `current_stage > modifiedStage`일 때 호출. 대상: `clusters`, `design_artifacts`, `prds`, `ax_reports`의 `is_stale`.
- 전환 사전조건:
  - context → gather: 프로세스 노드 ≥ 1, start_event + end_event 각 1개 이상
  - gather → cluster: notes ≥ 5
  - cluster → vote: clusters ≥ 1
  - vote → design: 퍼실리테이터가 투표 마감 선언 (전원 투표 필수 아님)
  - design → generate: 과제 ≥ 1 AND design_artifacts 존재
  - generate → report: PRD 생성 완료
  - report → completed: 종합 보고서 생성 완료 + 모든 stale 플래그 해제
- completed 상태는 읽기 전용이다.
- settings 변경 제약:
  - anonymous: context 또는 gather 단계에서만 (`current_stage` ≤ gather)
  - votes_per_person: vote 진입 전까지만
  - vote_mode: vote 진입 전까지만 (MVP. 기본값 'cluster')
  - max_participants: 현재 참가자 수 이상
  - timer_minutes: 언제든 변경 가능
  - results_visible: 언제든 가능

## 확장 포인트

- 워크샵 템플릿
- 프로젝트 멤버/공동 퍼실리테이터
- 다중 활성 워크샵
- 워크샵 복제
- stage rollback with audit
- timer module

## 테스트

- 프로젝트 소유권 검증
- 활성 워크샵 1개 제한
- stage transition guard
- completed read-only enforcement
- settings 변경 제약 (anonymous, vote_mode 조건부 변경)
- invite code collision retry
- propagateStale 하류 전파 검증
- viewingStage 초기화 및 StageNav 이동 검증
- is_processing_since 5분 초과 stale lock 자동 복구
- advance-stage optimistic locking (409 CONFLICT)
- dismiss-stale 플래그 해제 검증
- 퍼실리테이터 participants 자동 INSERT

## 운영 고려사항

- stage 전환 실패는 사용자에게 구체적 메시지를 반환한다.
- 잘못된 stage 상태가 DB에 생기면 운영자는 워크샵 id와 current_stage를 기준으로 복구한다.
