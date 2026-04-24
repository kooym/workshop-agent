# 문서 인덱스

이 디렉토리는 Workshop Agent의 제품 의도, 아키텍처, 모듈 경계, 구현 작업, 운영 계획을 분리해서 관리한다. 구현자는 먼저 이 파일을 읽고 필요한 문서로 이동한다.

## 우선순위

1. `AGENTS.md` / `CLAUDE.md`의 CRITICAL 규칙
2. `docs/SPEC_AUDIT.md`
3. `docs/MODULE_MAP.md`
4. `docs/modules/*.md`
5. `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/ADR.md`, `docs/UI_GUIDE.md`
6. `phases/*/step*.md`

## 핵심 문서

| 문서 | 목적 | 읽는 시점 |
|------|------|----------|
| `PRD.md` | 제품 목표, 사용자, 워크샵 단계, MVP/Post-MVP 범위 | 제품 맥락 파악 |
| `ARCHITECTURE.md` | 시스템 구성, 디렉토리, 데이터 모델, API, 상태 관리 | 설계/구현 전 |
| `ADR.md` | 주요 기술 선택과 트레이드오프 | 기술 변경 전 |
| `UI_GUIDE.md` | 디자인 원칙, 화면 패턴, 컴포넌트 스타일 | UI 구현 전 |
| `SPEC_AUDIT.md` | 문서 간 충돌 분석과 최종 정합성 결정 | 구현 시작 전 |
| `MODULE_MAP.md` | MECE 모듈 분해, 책임, 의존성, 확장성 체크 | 기능 추가/리팩터링 전 |
| `FOUNDATION_ASSESSMENT.md` | Foundation Cluster 스코어링, 갭, 호환성 개선 계획 | 프로젝트 세팅/배포 기준 확정 전 |
| `WORK_BREAKDOWN.md` | MVP와 확장 작업 패키지, 검증 게이트 | 작업 계획 수립 |
| `EXTENSION_GUIDE.md` | 신규 기능을 안전하게 붙이는 절차 | 기능 확장 전 |
| `OPERATIONS.md` | 운영, 배포, 모니터링, 장애 대응, 데이터 관리 | 배포/운영 전 |

## 모듈 문서

| 모듈 | 문서 | 소유 책임 |
|------|------|----------|
| M0 Platform Foundation | `modules/00-platform-foundation.md` | Next.js, env, Supabase clients, Docker, CI |
| M1 Identity & Access | `modules/01-identity-access.md` | Supabase Auth, guest signed cookie, middleware, RBAC |
| M2 Project & Workshop Lifecycle | `modules/02-project-workshop-lifecycle.md` | projects, workshops, settings, invite code, stages |
| M3 Realtime Collaboration | `modules/03-realtime-collaboration.md` | Realtime channels, presence, reconnect/refetch |
| M4 Board & Notes | `modules/04-board-notes.md` | tldraw/Yjs board, sticky notes, notes API, reactions |
| M5 AI Pipeline | `modules/05-ai-pipeline.md` | OpenAI client, prompts, schemas, AI routes, processing lock |
| M6 Voting & Prioritization | `modules/06-voting-prioritization.md` | dot voting, result visibility, vote aggregation |
| M7 Tasks & PRD Artifacts | `modules/07-tasks-prd-artifacts.md` | AX tasks, PRD generation/edit/preview/export |
| M8 UI Experience System | `modules/08-ui-experience-system.md` | layout, components, accessibility, visual language |
| M9 Quality & Operations | `modules/09-quality-operations.md` | tests, observability, deployment, data retention, incident response |

## 사용 방법

- 새 기능을 붙일 때: `MODULE_MAP.md`에서 소유 모듈을 찾고, 해당 `modules/*.md`와 `EXTENSION_GUIDE.md`를 읽는다.
- 기존 기능을 고칠 때: 관련 모듈 문서의 "소유하지 않는 것"을 확인해 다른 모듈 경계를 침범하지 않는다.
- 운영 이슈를 처리할 때: `OPERATIONS.md`와 M9 문서를 먼저 본다.
- phase step을 실행할 때: step 파일의 지시가 상위 문서와 충돌하면 `SPEC_AUDIT.md`와 모듈 문서를 우선한다.
