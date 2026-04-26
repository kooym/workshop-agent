# 확장 가이드

이 문서는 새 기능을 추가할 때 기존 구조를 깨지 않기 위한 절차다.

## 1. 기능 분류

먼저 새 기능을 하나의 주 모듈에 배정한다.

| 질문 | 예 |
|------|----|
| 신원/권한 문제인가? | SSO, 역할 추가, invite 만료 -> M1 |
| 워크샵 상태/설정 문제인가? | 타이머, 워크샵 복제 -> M2 |
| 실시간 전파 문제인가? | 커서 표시, reconnect UI -> M3 |
| 화이트보드 입력 문제인가? | note template, manual cluster drag -> M4 |
| AI 변환 문제인가? | prompt version, model routing -> M5 |
| 우선순위 판단 문제인가? | weighted vote, quorum -> M6 |
| 산출물 문제인가? | PDF export, archive, version UI -> M7 |
| 화면/사용성 문제인가? | mobile mode, dashboard UX -> M8 |
| 운영/품질 문제인가? | monitoring, audit log, backup -> M9 |

주 모듈이 애매하면 기능이 너무 큰 것이다. 기능을 두 개 이상의 작업 패키지로 나눈다.

## 2. 변경 순서

1. `docs/MODULE_MAP.md`에서 데이터/API/UI 소유권을 확인한다.
2. 해당 `docs/modules/*.md`에 확장 포인트 또는 계약 변경을 기록한다.
3. 데이터 변경이 있으면 `ARCHITECTURE.md` 데이터 모델과 migration step을 업데이트한다.
4. API 변경이 있으면 validators/response/middleware 규칙을 먼저 정의한다.
5. UI 변경이 있으면 `UI_GUIDE.md` 또는 M8 문서를 업데이트한다.
6. 운영 영향이 있으면 `OPERATIONS.md`를 업데이트한다.
7. 테스트를 먼저 작성한다.
8. 구현한다.

## 3. 확장 레시피

### Timer 추가

- 주 모듈: M2
- 협업: M8, M3
- 데이터: `workshops.settings` 또는 별도 `timers` 필드/테이블 결정
- API: timer start/pause/reset
- UI: StageNav/Header timer
- Realtime: `workshop:{id}` update로 전파
- 테스트: facilitator-only control, reconnect 후 timer state, completed read-only

### Manual Cluster Adjustment 추가

- 주 모듈: M4/M5
- 협업: M2, M8
- 데이터: notes.cluster_id update, clusters merge/split semantics
- API: move note to cluster, merge clusters, split cluster
- UI: drag/drop or explicit menu
- 위험: AI 재실행 시 수동 조정 overwrite 여부 결정 필요
- 테스트: cluster stage only, facilitator-only, note assignment integrity

### PDF Export 추가

- 주 모듈: M7
- 협업: M0, M9
- 데이터: export artifact 저장 여부 결정
- API: `/api/prd/:id/export`
- UI: download/copy controls
- 운영: renderer dependency, font, file size, timeout
- 테스트: Markdown input, Korean font rendering, no secret exposure

### SSO 추가

- 주 모듈: M1
- 협업: M0, M2, M9
- 데이터: facilitator identity mapping
- API: auth callback/session handling
- 운영: tenant configuration, metadata, redirect URLs
- 테스트: existing password auth regression, withFacilitator still valid

### Analytics 추가

- 주 모듈: M9
- 협업: all modules
- 데이터: event log or derived views
- API: admin-only dashboard endpoint
- UI: dashboard metrics
- 운영: PII minimization, retention, cost
- 테스트: no participant secret leakage, aggregation correctness

### Foundation Dependency Upgrade

- 주 모듈: M0/M9
- 협업: 변경 대상에 따라 M1(Supabase/Auth), M4(tldraw/Yjs), M5(OpenAI), M8(UI)
- 데이터: 일반적으로 없음. ORM/DB client major upgrade면 migration/type 영향 확인
- API: runtime/framework 변경이 Route Handler 동작에 영향을 주는지 확인
- 운영: Docker base image, App Service port, health check, CI cache 영향 확인
- 문서: `FOUNDATION_ASSESSMENT.md` compatibility matrix와 필요 시 ADR 업데이트
- 테스트: `npm ci`, lint, typecheck, test, build, Docker build, `/api/health`, 2탭 Realtime smoke
- 금지: lockfile만 바꾸고 compatibility review 없이 merge하지 않는다.

## 4. 계약 변경 체크리스트

계약 변경 전 다음을 확인한다.

- 기존 API 응답 형태 `{ data }` / `{ error }` 유지 여부
- stage write lock 영향
- facilitator/participant 권한 영향
- completed read-only 영향
- Realtime channel 영향
- Zustand store hydration 영향
- AI prompt/schema 영향
- migration/backfill 필요 여부
- 운영/복구 절차 영향
- stale 데이터 전파 (`propagateStale`) 영향: 새 리소스 수정이 하류 AI 산출물을 무효화하는지 확인
- `viewingStage` 자유 네비게이션 영향: 새 단계/화면이 StageNav에 적절히 노출되는지 확인

## 5. 금지 패턴

- 클라이언트에서 Azure OpenAI 직접 호출
- 서버 secret을 `NEXT_PUBLIC_`로 노출
- 도메인 API에서 Zod 검증 생략
- UI에서만 권한을 막고 API 검증을 생략
- `dangerouslySetInnerHTML`로 Markdown 렌더링
- 하나의 PR에서 auth, schema, AI prompt, UI 대규모 변경을 모두 섞기- Rate Limiting 우회: 인증/초대코드 API에 IP 기반 제한 없이 배포
- Stale 전파 누락: 이전 단계 데이터 수정 API에서 `propagateStale` 호출 없이 배포
## 6. 확장 완료 정의

새 기능은 다음이 모두 완료되어야 한다.

- 주 모듈과 협업 모듈 문서 업데이트
- 데이터/API/UI/테스트/운영 영향 기록
- 테스트 선작성
- lint/typecheck/test/build 통과
- 필요 시 Docker build 통과
- 실패 UX와 로그 정의
- completed/read-only와 stage lock 회귀 없음
