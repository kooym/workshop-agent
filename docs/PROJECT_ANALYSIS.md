# 프로젝트 전체 분석 및 개발 착수 판정

> 기준일: 2026-04-26 KST  
> 범위: 루트 설정, `CLAUDE.md`, `docs/`, `docs/modules/`, `phases/`, `.github/workflows/`, `scripts/`

## 결론

Workshop Agent는 현재 **앱 구현 전 문서/계획/하네스 준비 단계**에 있다. `src/`, `package.json`, `supabase/migrations/` 같은 실제 앱 코드는 아직 없으므로 개발은 `phases/0-mvp/step0.md`의 프로젝트 셋업부터 시작해야 한다.

문서 관점에서는 PRD, 아키텍처, ADR, UI, 운영, 테스트, 모듈 경계, MVP step 파일이 충분히 세분화되어 있어 **문서 기반 개발 착수는 가능(GO)** 하다. 다만 개발 착수 전에는 아래 사전 조건을 확인해야 한다.

## 현재 구성

| 영역 | 현재 상태 | 판단 |
|------|-----------|------|
| 제품 기획 | `docs/PRD.md`에 8단계 워크샵, MVP/Post-MVP, 사용자 여정 정의 | 충분 |
| 아키텍처 | `docs/ARCHITECTURE.md`, `docs/ADR.md`에 데이터/API/Auth/Realtime/AI 결정 정리 | 충분 |
| 모듈 경계 | `docs/MODULE_MAP.md`, `docs/modules/*.md`로 M0-M9 책임 분리 | 충분 |
| 구현 계획 | `phases/0-mvp/step0.md`부터 `step9.md`까지 MVP 순차 작업 존재 | 충분 |
| 테스트 전략 | `docs/TESTING_GUIDE.md`에 TDD, fixture, API/store/component 예시 존재 | 충분 |
| 운영 계획 | `docs/OPERATIONS.md`, `.github/workflows/*.yml`에 CI/CD, health, rollback 기준 존재 | 충분 |
| 실행 하네스 | `scripts/execute.py`가 phase step 순차 실행/재시도/커밋 흐름 제공 | 사용 가능 |
| 앱 코드 | 아직 없음 (`src/`, `package.json`, `supabase/` 미생성) | Step 0부터 시작 |

## 개발 착수 가능성

### GO 조건

- MVP 개발은 `0-mvp` phase의 `step0 -> step9` 순서로 바로 시작할 수 있다.
- 각 step은 읽어야 할 문서, 작업 범위, 금지사항, Acceptance Criteria를 포함한다.
- 모듈 경계가 M0-M9로 분리되어 있어 작업 단위가 섞이지 않게 관리 가능하다.
- TDD와 release gate가 명시되어 있어 품질 기준을 자동화하기 쉽다.

### 사전 확인 필요

| 항목 | 필요 이유 | 없을 때 판정 |
|------|-----------|-------------|
| Node.js 20 LTS, npm | Next.js 15 프로젝트 생성/빌드 | blocked |
| Docker Desktop | 로컬 Supabase와 Docker build 검증 | blocked 또는 일부 검증 생략 |
| Supabase CLI | `supabase init/start/db reset` | blocked |
| Azure OpenAI 키/배포명 | AI step 실제 통합 검증 | blocked |
| Supabase 로컬/리모트 키 | Auth/DB/Realtime 검증 | blocked |
| `.env.local` 실제 값 | 로컬 실행 | blocked |

코드/타입/빌드 오류는 blocked가 아니라 error로 보고 수정해야 한다. 외부 키, 인증, 수동 인프라 설정이 없을 때만 blocked로 기록한다.

## 주요 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| tldraw/Yjs/y-supabase 이중 저장 | Gather 단계 정합성 오류 가능 | M4 adapter 격리, notes 테이블 canonical, reconcile 테스트 |
| Guest Realtime RLS `USING(TRUE)` | anon read 범위가 넓어짐 | 모든 쓰기 API route 경유, 채널 필터, Post-MVP RLS 심화 |
| AI JSON 품질 | 잘림/누락/중복 note_id 가능 | Zod 스키마 + 사후 검증 + transaction rollback |
| 단계 자유 네비게이션 | 이전 단계 수정 후 하류 산출물 불일치 | `propagateStale`, StaleBanner, completed 전 stale 해제 |
| In-memory rate limit | scale-out 시 제한 불일치 | MVP 단일 인스턴스 전제, Post-MVP Redis |
| 실제 앱 코드 부재 | 현재 npm/build gate 실행 불가 | Step 0에서 기반 생성 후 gate 적용 |

## 문서 보강 사항

이번 분석에서 문서 실행성을 높이기 위해 다음을 정리했다.

- `.env.example`을 환경 변수 템플릿의 canonical 파일명으로 통일했다.
- API 표준 에러 코드 수를 12개로 통일했다.
- 전체 개발을 phase/module 단위로 진행할 수 있도록 `docs/DEVELOPMENT_ROADMAP.md`를 추가했다.
- `docs/INDEX.md`에서 분석 문서와 로드맵 문서를 바로 찾을 수 있게 연결했다.

## 최종 판정

| 판정 항목 | 결과 |
|-----------|------|
| 문서 완료도 | GO |
| 개발 착수 준비도 | GO, 단 Step 0부터 시작 |
| 운영 배포 준비도 | 아직 NO, Step 9 release gate 이후 재판정 |
| 코드 작성 여부 | 아직 시작하지 않음 |

다음 단계는 사용자 승인 후 `phases/0-mvp/step0.md`부터 TDD/검증 게이트를 지키며 구현을 시작하는 것이다.
