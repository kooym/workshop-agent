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
- **StageNav 자유 네비게이션**: `current_stage` 이하 단계는 클릭 가능(열람+편집), 초과 단계는 비활성(회색), completed는 읽기 전용. stale 단계에 ⚠️ 오렌지 도트 배지 표시. StageNav 클릭 시 M2의 `workshopStore.viewingStage`를 변경하여 해당 단계 화면으로 전환.
- **Stale 경고 배너** (`StaleBanner`): 이전 단계 데이터 수정으로 AI 결과가 최신이 아닌 단계에 노란/오렌지 경고 배너 표시. 퍼실리테이터에게 "AI 재실행" + "현재 결과 유지" 버튼 제공. 참석자에게는 읽기 전용 경고만 표시 (액션 버튼 없음).
- **AI 대기 화면**: `is_processing=true`일 때 참석자에게 pulse 애니메이션 + "퍼실리테이터가 AI를 실행 중입니다" 메시지 + 처리 대상 정보 + 예상 시간 안내.
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
