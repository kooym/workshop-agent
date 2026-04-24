# M2 Project & Workshop Lifecycle

## 책임

프로젝트와 워크샵의 생성, 설정, 초대 코드, 단계 전환, 완료 상태를 소유한다.

## 소유 범위

- `projects` CRUD
- `workshops` CRUD
- invite code 생성/충돌 재시도
- `WorkshopSettings`
- stage transition guard
- completed read-only state
- 프로젝트당 활성 워크샵 1개 제한

## 소유 데이터

- `projects`
- `workshops`
- `workshops.settings`
- `workshops.current_stage`
- `workshops.is_processing`의 일반 상태. 단, AI 실행 중 lock 토글은 M5가 제한적으로 쓴다.

## 소유하지 않는 것

- 참가자 세션 발급: M1
- notes/votes/tasks/prds 생성: M4/M6/M7
- AI 실행: M5
- sidebar UI 구현: M8

## 계약

- 워크샵은 반드시 프로젝트에 속한다.
- 같은 프로젝트에는 completed가 아닌 활성 워크샵이 최대 1개만 존재한다.
- stage는 `gather -> cluster -> vote -> derive -> generate -> completed` 순방향만 허용한다.
- 전환 사전조건:
  - gather -> cluster: notes >= 1
  - cluster -> vote: clusters >= 1
  - vote -> derive: facilitator ConfirmModal 확인
  - derive -> generate: ax_tasks >= 1
  - generate -> completed: prds >= 1
- completed 상태는 읽기 전용이다.
- settings 변경 제약:
  - anonymous: gather에서만
  - votes_per_person: vote 진입 전까지만
  - max_participants: 현재 참가자 수 이상
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
- settings 변경 제약
- invite code collision retry

## 운영 고려사항

- stage 전환 실패는 사용자에게 구체적 메시지를 반환한다.
- 잘못된 stage 상태가 DB에 생기면 운영자는 워크샵 id와 current_stage를 기준으로 복구한다.
