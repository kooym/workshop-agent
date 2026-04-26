# M9 Quality & Operations

## 책임

개발, 검증, 배포, 운영, 장애 대응, 데이터 보존 기준을 소유한다.

Foundation Cluster의 현재 준비도, gap register, 개선 우선순위는 `docs/FOUNDATION_ASSESSMENT.md`에서 관리한다.

## 소유 범위

- TDD strategy
- test pyramid
- CI gates
- Docker build verification
- structured API logging
- health check policy
- deployment runbook
- incident response
- data retention
- secret rotation
- cost/capacity monitoring
- compatibility review
- release smoke test
- rollback criteria
- secret leak audit

## 소유하지 않는 것

- 각 도메인 기능의 비즈니스 로직
- UI 컴포넌트 구현
- AI prompt 내용

## 계약

- 새 기능은 테스트 먼저 작성한다.
- 최소 검증은 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- 최종 통합은 `docker build -t workshop-agent .`까지 검증한다.
- 핵심 dependency 변경은 compatibility review와 lockfile diff 검토를 통과해야 한다.
- API 에러는 JSON 구조화 로깅한다.
- secret은 클라이언트 번들에 포함하지 않는다.
- `.env*` 실제 값 파일은 커밋하지 않는다. 환경 변수 템플릿은 `.env.example`만 허용한다.
- CI는 `npm ci`를 사용한다.
- Health check path는 `/api/health`로 표준화한다.
- blocked는 API 키/외부 인증/수동 설정 필요 시에만 사용한다.
- 코드/빌드/테스트 실패는 error로 보고 3회 수정 시도한다.

## 확장 포인트

- Playwright E2E
- Azure Monitor dashboards
- cost alerts
- backup/restore automation
- audit log table
- admin operations console
- dependency/license/security scanning
- App Service staging slot rollback
- App Service Health Check automation
- container image vulnerability scanning

## 테스트

- smoke test suite
- API integration tests
- store unit tests
- AI mocked integration tests
- component tests for interactive UI
- migration SQL validation
- dependency compatibility test
- smoke test checklist automation
- health check test
- secret leak scan

## Release Gate 순서

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test`
5. `npm run build`
6. `docker build -t workshop-agent .`
7. `/api/health` smoke test
8. secret leak audit
9. E2E workshop smoke test

이 순서에서 실패하면 뒤 단계를 진행하지 않는다. 외부 인증/API 키가 없어 실행할 수 없는 항목은 blocked로 기록하고, 코드/타입/빌드 실패는 error로 기록한다.

## 운영 고려사항

- Supabase 장애, Azure OpenAI 장애, Realtime disconnect는 각각 다른 사용자 안내와 복구 절차를 가진다.
- 워크샵 데이터는 최소 30일 유지한다.
- 고객 공유 산출물은 삭제/보존 정책을 명확히 해야 한다.
- 배포 후 첫 확인은 `/api/health`, 로그인, 워크샵 생성, 2탭 Realtime, AI mock path 순서로 수행한다.
