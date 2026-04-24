# 작업 분해 계획

이 문서는 제품 기획, MVP 구현, 기능 확장, 운영 관리까지의 작업을 MECE하게 분해한다. 각 작업은 하나의 주 모듈을 갖고, 필요한 경우 협업 모듈을 명시한다.

## E2E 생애주기

| 단계 | 목표 | 산출물 | 주 모듈 |
|------|------|--------|--------|
| 1. 제품 정의 | 어떤 워크샵 경험을 만들지 고정 | PRD, 범위, 비기능 요구사항 | M8, M2 |
| 2. 아키텍처 설계 | 데이터/API/권한/실시간/AI 경계를 고정 | ARCHITECTURE, ADR, MODULE_MAP | M0-M9 |
| 3. 구현 준비 | step 스펙과 테스트 기준 준비 | phases, SPEC_AUDIT | M9 |
| 4. MVP 구현 | E2E 워크샵이 동작 | app code, tests, migrations | M0-M8 |
| 5. 검증 | 품질 게이트 통과 | lint/typecheck/test/build/docker | M9 |
| 6. 배포 | Azure에서 실행 | ACR image, App Service config | M0, M9 |
| 7. 운영 | 워크샵 운영과 장애 대응 | logs, runbooks, retention | M9 |
| 8. 확장 | 새 기능을 모듈 경계 안에서 추가 | updated docs/tests/code | owning module |

## MVP 작업 패키지

| WP | 이름 | 주 모듈 | 협업 모듈 | 현재 phase |
|----|------|---------|----------|------------|
| WP0 | Project setup | M0 | M8, M9 | step0 |
| WP0.1 | Foundation compatibility hardening | M0/M9 | M3, M4, M1 | Foundation preflight |
| WP1 | DB schema and types | M2 | M1, M4, M5, M6, M7, M9 | step1 |
| WP2 | Auth, invite, project dashboard | M1 | M2, M8 | step2 |
| WP3 | Workshop lifecycle and subscriptions | M2 | M3, M8 | step3 |
| WP4 | Realtime tldraw board | M4 | M3, M1, M2, M8 | step4 |
| WP5 | AI clustering | M5 | M4, M3, M8 | step5 |
| WP6 | Dot voting | M6 | M2, M3, M8 | step6 |
| WP7 | AX task derivation | M5 | M6, M7, M8 | step7 |
| WP8 | PRD generation and editing | M7 | M5, M8 | step8 |
| WP9 | Stage flow integration | M2 | M1, M3, M4, M5, M6, M7, M8, M9 | step9 |

## WP0.1 Foundation Compatibility Hardening

이 작업은 앱 기능 구현 전 또는 step0 직후 수행한다. 목적은 런타임/패키지/빌드/인증 세션/배포 기준을 명확히 고정해, 이후 기능 작업이 같은 기반 위에서 움직이게 하는 것이다.

| 하위 작업 | 산출물 | 완료 기준 |
|----------|--------|----------|
| Runtime lock | `.nvmrc`, `package.json.engines`, Next 15 pinning | Node 20 기준, `create-next-app@15`, `npm ls` 확인 |
| Package reproducibility | `package-lock.json`, npm 기준 | `npm ci` 성공 |
| Supabase SSR scaffold | `client.ts`, `server.ts`, `src/lib/supabase/proxy.ts`, root `proxy.ts` | browser/server client 분리, session refresh proxy 기준 반영 |
| Env boundary | `src/lib/env.ts`, `.env.local.example` | server/public env 분리, publishable/anon key alias 정책 명시 |
| Docker baseline | `Dockerfile`, `.dockerignore`, `next.config.ts` | standalone output, static/public copy, port 3000 |
| Health endpoint | `GET /api/health` | 인증 없이 200, external dependency 미호출 |
| Secret audit | 검색 기준과 테스트 TODO | client path에 server secret 노출 없음 |
| Release gate | step9 Foundation gate | lint/typecheck/test/build/docker/health smoke 연결 |

WP0.1이 완료되기 전에는 auth, realtime, AI 같은 상위 기능을 구현할 수는 있지만, 실제 워크샵 운영 준비 상태로 보지 않는다.

## 작업 패키지 템플릿

새 작업은 다음 형식을 따른다.

```markdown
## WP-{id}: {name}

- 주 모듈:
- 협업 모듈:
- 목표:
- 범위:
- 범위 밖:
- 데이터 변경:
- API 변경:
- UI 변경:
- 테스트:
- 운영 영향:
- Acceptance Criteria:
- Rollback/복구:
```

## MVP 이후 확장 백로그

| 우선순위 | 작업 | 주 모듈 | 선행 조건 | 운영 영향 |
|----------|------|---------|----------|----------|
| P1 | Timer | M2/M8 | stage flow 안정화 | 워크샵 진행 상태 알림 |
| P1 | Manual cluster adjustment | M4/M5 | board-note-cluster 매핑 안정화 | 데이터 정합성 복구 필요 |
| P1 | PRD version history UI | M7 | PRD edit 안정화 | 저장소 증가 |
| P1 | PDF export | M7 | Markdown rendering 안정화 | 렌더러/폰트/파일 저장 전략 |
| P1 | Participant feedback on tasks | M7 | completed/read-only 정책 정리 | moderation 필요 가능 |
| P2 | SSO/Entra ID | M1 | facilitator auth 추상화 | enterprise onboarding |
| P2 | Analytics dashboard | M9/M8 | event logging | 비용/성능 모니터링 |
| P2 | Artifact archive | M7/M2 | traceability 완성 | 데이터 보존 정책 강화 |
| P2 | Multi active workshops per project | M2 | dashboard UX/DB 제약 변경 | 운영 복잡도 증가 |
| P2 | Mobile participant mode | M8/M4 | board interaction 재설계 | QA 범위 확대 |

## 모듈별 병렬화 기준

동시에 작업해도 되는 경우:
- 서로 다른 모듈의 문서/테스트만 변경한다.
- write set이 명확히 분리되어 있다.
- shared schema/API contract가 먼저 확정되어 있다.

동시에 작업하면 안 되는 경우:
- `workshops.current_stage` 전환 규칙을 여러 작업이 동시에 바꾼다.
- `notes`와 tldraw shape schema를 여러 작업이 동시에 바꾼다.
- AI response schema와 UI rendering을 contract 없이 동시에 바꾼다.
- Auth middleware를 바꾸면서 도메인 API 권한 테스트를 같이 바꾸지 않는다.

## 구현 순서 원칙

1. 데이터/계약 먼저: schema, type, Zod, API response.
2. 권한과 stage lock 먼저: UI보다 서버 검증을 우선.
3. 테스트 먼저: 실패하는 테스트를 먼저 만들고 구현.
4. UI는 domain API가 안정된 뒤 연결.
5. 운영 영향이 있으면 `OPERATIONS.md`를 함께 업데이트.

## 완료 게이트

각 작업은 다음 게이트를 통과해야 한다.

| 게이트 | 기준 |
|--------|------|
| Spec | 소유 모듈과 범위 밖이 명시됨 |
| Security | secret, auth, RLS/API 경계 위반 없음 |
| Data | migration/type/Zod/API contract 일치 |
| UX | 권한별 UI 노출과 실패 UX 정의 |
| Test | unit/integration/component 중 필요한 테스트 존재 |
| Build | lint/typecheck/test/build 통과 |
| Ops | 로그, 장애, 배포/복구 영향 확인 |

## 운영 준비 체크

MVP를 실제 워크샵에서 쓰기 전:
- Foundation score가 `FOUNDATION_ASSESSMENT.md` 기준 82점 이상인지 확인하고, F0.1~F0.3 구현 기준이 실제 코드/설정에 반영됐는지 확인
- Supabase project/Auth/Realtime 설정 확인
- Azure OpenAI deployment/capacity 확인
- App Service env vars 설정 확인
- `SESSION_SECRET` 32자 이상 설정
- Docker image build and run 확인
- 2명 이상 브라우저 탭으로 Realtime smoke test
- AI 실패 시 is_processing 복구 확인
- completed 상태 read-only 확인
