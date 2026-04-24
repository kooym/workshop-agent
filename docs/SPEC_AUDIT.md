# 스펙 점검 및 정합성 결정

이 문서는 MVP 구현 전에 문서/step 스펙 사이의 충돌을 분류하고, 구현 시 따라야 할 최종 결정을 고정하기 위해 작성한다. 구현 에이전트는 `AGENTS.md`/`CLAUDE.md`의 CRITICAL 규칙을 최상위 기준으로 삼고, step 파일이 이 문서의 결정과 충돌하면 이 문서를 우선 참고한다.

## 분류 기준

| 등급 | 의미 | 처리 |
|------|------|------|
| P0 | 구현 시작 전 반드시 해소해야 하는 스펙 충돌 또는 보안/데이터 무결성 문제 | step 스펙에 즉시 반영 |
| P1 | MVP 구현 중 누락되면 사용자 흐름이 깨지는 설계 공백 | 해당 기능 step에 반영 |
| P2 | Post-MVP 범위 또는 문구 정리 수준의 혼선 | 문서에 기록하고 구현 범위에서 제외 |

## P0: 구현 차단급 충돌

### 1. 프로젝트 계층 누락
- 문제: 상위 규칙과 `ARCHITECTURE.md`는 `projects -> workshops` 2단계 계층을 정규 구조로 정의하지만, 일부 step은 워크샵 flat 목록 또는 7개 테이블만 전제로 한다.
- 결정: MVP DB에는 `projects`를 포함한 8개 핵심 테이블을 만든다. 워크샵 생성은 반드시 `project_id`를 요구한다.
- 적용 위치: `step1`은 `projects` 테이블과 프로젝트당 활성 워크샵 1개 제약을 포함한다. `step2`는 프로젝트 CRUD와 프로젝트별 워크샵 생성 UI/API를 포함한다.

### 2. `completed` 단계 누락
- 문제: 상위 규칙은 `completed`를 읽기 전용 최종 상태로 정의하지만, 일부 step의 enum/전환 로직은 `generate`까지만 다룬다.
- 결정: `workshop_stage` enum은 `gather`, `cluster`, `vote`, `derive`, `generate`, `completed`를 모두 포함한다.
- 적용 위치: `step1`, `step3`, `step8`, `step9`에서 completed 상태와 읽기 전용 규칙을 명시한다.

### 3. 환경 변수 검증과 signed cookie 누락
- 문제: `SESSION_SECRET`과 `src/lib/env.ts` 경유 환경 변수 검증이 CRITICAL이지만 초기 step 지시가 약하다.
- 결정: `step0`에서 `.env.local.example`에 `SESSION_SECRET`을 포함하고 `src/lib/env.ts`를 만든다. 서버 전용 모듈은 `process.env`를 직접 읽지 않고 `env.ts`를 import한다.
- 적용 위치: `step2`에서 참석자 쿠키를 반드시 HMAC 서명하고, 서명 시크릿으로 `SUPABASE_SERVICE_ROLE_KEY`를 재사용하지 않는다.

### 4. tldraw/Yjs와 단순 보드 구현 충돌
- 문제: 상위 규칙과 ADR은 tldraw + Yjs + y-supabase를 Gather 단계의 핵심으로 보지만, 일부 step은 단순 카드 보드와 자동 배치에 가까운 구현을 지시한다.
- 결정: MVP Gather 단계도 tldraw 커스텀 shape + Yjs 동기화를 사용한다. `notes` 테이블은 AI 파이프라인과 권한 검증을 위한 정규 데이터 소스로 유지한다.
- 적용 위치: `step4`는 `WhiteboardCanvas`, `StickyNoteShape`, y-supabase 영속화, shape.id = note.id 매핑, tldraw 이벤트 기반 DB 동기화를 구현 범위로 삼는다.

### 5. RLS와 게스트 쿠키 세션의 경계 불명확
- 문제: 참석자는 Supabase Auth JWT가 아니라 signed cookie를 쓰므로, DB RLS가 직접 participant identity를 알기 어렵다. 동시에 Realtime/Yjs는 브라우저 Supabase 클라이언트가 필요하다.
- 결정: 모든 쓰기와 권한 민감 조회는 API Route에서 service role로 수행하고, API 미들웨어가 signed cookie 또는 Supabase Auth 세션을 검증한다. 브라우저 anon key는 공개 가능하지만 직접 테이블 쓰기는 금지한다. RLS는 기본 차단/제한 조회 중심으로 두며, Realtime/Yjs에 필요한 최소 범위만 허용한다.
- 적용 위치: `step1` RLS 정책과 `step2` 미들웨어/세션 설계에 반영한다.

### 6. TDD 및 검증 커맨드 불일치
- 문제: 상위 규칙은 TDD와 `lint -> typecheck -> test -> build`를 요구하지만 일부 step AC는 `build/lint`만 요구한다.
- 결정: 기능 step은 테스트를 먼저 작성하고, AC에 최소 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`를 포함한다. Docker 빌드는 최종 통합 step에서 검증한다.
- 적용 위치: 모든 step의 Acceptance Criteria와 작업 지시에 반영한다.

### 7. vote -> derive 전환 조건 불일치
- 문제: 상위 규칙은 “퍼실리테이터가 투표 마감 선언”을 전환 조건으로 두지만, 일부 step은 투표 1건 이상을 요구한다.
- 결정: `vote -> derive`는 퍼실리테이터 확인 액션 자체가 마감 선언이다. 전원 투표 또는 최소 1표는 필수 조건이 아니다.
- 적용 위치: `step9` 전환 조건에서 투표 수 필수 조건을 제거한다.

## P1: MVP 흐름 공백

### 1. 단계별 쓰기 잠금
- 문제: 개별 API step이 현재 단계 검증을 충분히 강제하지 않으면 완료 이후에도 쓰기가 가능해진다.
- 결정: notes는 gather, votes는 vote, ax_tasks 편집은 derive, prd 편집은 generate에서만 허용한다. completed는 모든 쓰기를 차단한다.

### 2. AI 처리 중 참석자 UX
- 문제: is_processing 플래그가 서버 락으로만 쓰이면 참석자는 왜 화면이 대기 중인지 알기 어렵다.
- 결정: AI step UI는 참석자에게 pulse 대기 화면을 보여주고 Realtime 반영 후 자동 갱신한다.

### 3. 프로젝트당 활성 워크샵 1개
- 문제: PRD/상위 규칙에는 있지만 초기 API step에 누락되면 데이터 정책이 깨진다.
- 결정: 워크샵 생성 API에서 같은 project_id에 completed가 아닌 워크샵이 있으면 409를 반환한다. DB에는 보조 인덱스를 두고 최종 검증은 API 트랜잭션에서 수행한다.

### 4. AI 응답 사후 검증
- 문제: 프롬프트만으로 JSON 결과 품질을 보장할 수 없다.
- 결정: AI 응답은 모두 Zod 스키마로 파싱하고, 클러스터링 누락/중복 note_id, 과제의 유효하지 않은 cluster_id, 빈 PRD/잘림 가능성을 사후 검증한다.

## P2: 범위 정리

### 1. 수동 클러스터 병합/분리
- 결정: UI 노출 규칙에는 퍼실리테이터 권한으로 기록되어 있으나 MVP step에서는 Post-MVP로 제외한다. MVP에서는 클러스터명 편집과 재실행만 허용한다.

### 2. 타이머
- 결정: PRD에는 P1 기능으로 남기되 MVP 구현 step에서는 제외한다. StageNav와 레이아웃은 나중에 타이머를 넣을 수 있는 공간만 확보한다.

### 3. PRD PDF 내보내기와 버전 히스토리 UI
- 결정: MVP는 Markdown 생성/편집/복사까지 구현한다. DB version 필드는 유지하되 히스토리 UI와 PDF는 Post-MVP로 둔다.

### 4. 브랜치 네이밍
- 결정: 일반 수동 작업은 `feat/...`, `fix/...` 형식을 따른다. 다만 Harness 자동 실행은 현재 `scripts/execute.py`가 `feat-{phase}` 브랜치를 만들도록 설계되어 있으므로 예외로 허용한다.

## 최종 구현 원칙

1. 문서 정합성 우선순위는 `AGENTS.md`/`CLAUDE.md` CRITICAL 규칙 > 이 문서 > `MODULE_MAP.md`/`modules/*.md` > step 파일 > 일반 설명 순서다.
2. 구현자는 step 파일에서 오래된 지시를 발견하면 최신 결정에 맞게 보정하고, summary에 충돌 해결 내용을 남긴다.
3. 앱 코드 구현 전에 step 스펙이 이 문서의 P0 항목을 모두 반영해야 한다.
