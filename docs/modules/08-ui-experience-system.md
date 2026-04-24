# M8 UI Experience System

## 책임

사용자가 워크샵 흐름을 명확히 이해하고, 권한에 맞는 조작만 안전하게 수행하도록 UI 시스템과 화면 경험을 관리한다.

## 소유 범위

- root layout and Toaster mount
- workshop shell layout
- StageNav
- InviteCode
- ParticipantList
- ConfirmModal
- shared UI primitives
- responsive behavior
- accessibility baseline
- loading/error/empty states

## 소유하지 않는 것

- 도메인 API 로직
- AI prompt/content
- DB schema
- Realtime channel ownership

## 계약

- 다크모드 기본.
- 포스트잇이 시각 중심이다.
- alert() 금지. Toast 또는 인라인 에러 사용.
- `dangerouslySetInnerHTML` 금지.
- Modal은 focus trap과 Escape 닫기를 지원한다.
- 모든 form input은 label과 연결한다.
- 버튼은 접근 가능한 이름을 가진다.
- AI 처리 중에만 pulse 애니메이션을 허용한다.
- 모바일은 MVP 미지원 안내 화면을 보여준다.

## 확장 포인트

- facilitator analytics dashboard
- public read-only share page
- mobile participant input mode
- theme customization per customer
- richer artifact viewer

## 테스트

- form accessibility
- ConfirmModal keyboard flow
- facilitator-only controls hidden for participants
- results hidden state
- no alert usage
- root Toaster single mount

## 운영 고려사항

- 프로젝터 공유 환경을 고려해 초대 코드와 단계 상태를 크게 표시한다.
- UI가 AI 결과를 과신하게 만들지 않도록 편집/확인 affordance를 유지한다.
