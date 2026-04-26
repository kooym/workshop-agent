# Foundation Cluster 평가 및 개선 계획

Foundation Cluster는 M0 Platform Foundation과 M9 Quality & Operations를 묶은 영역이다. 앱 기능을 만들기 전에 런타임, 의존성, 빌드, 테스트, 배포, 운영 기준이 흔들리지 않도록 하는 것이 목적이다.

## 평가 범위

| 범위 | 포함 | 제외 |
|------|------|------|
| Runtime | Node.js, Next.js, React, package manager | 워크샵 도메인 로직 |
| Dependencies | Supabase SSR, tldraw/Yjs, OpenAI client compatibility | prompt 내용 |
| Environment | env schema, secret boundary, local/prod env split | 실제 secret 값 |
| Build/Deploy | standalone build, Docker, Azure App Service/ACR | 실제 Azure 리소스 생성 |
| Quality | lint, typecheck, test, build, Docker gate | E2E full automation |
| Operations | logs, smoke test, incident runbook, rollback | 조직 정책/승인 프로세스 |

## 스코어링 기준

점수는 문서/스펙 준비도 기준이며, 구현 완료 점수가 아니다.

| 점수 | 의미 |
|------|------|
| 0 | 기준 없음 |
| 1 | 언급만 있음 |
| 2 | 방향은 있으나 실행 기준이 불충분 |
| 3 | MVP 구현 가능하나 운영/호환성 갭 존재 |
| 4 | 구현자가 안정적으로 따라갈 수 있음 |
| 5 | 운영 자동화/회귀 방어까지 충분 |

## 초기 평가 점수

| 항목 | 가중치 | 점수 | 환산 | 판단 |
|------|--------|------|------|------|
| Runtime/Dependency compatibility | 15 | 2 | 6 | Next 15 목표와 `create-next-app@latest` 충돌, tldraw 패키지명 불일치 |
| Env/Secret boundary | 15 | 4 | 12 | `src/lib/env.ts`, `SESSION_SECRET`, secret 노출 금지 기준은 좋음 |
| Build/Docker reproducibility | 15 | 3 | 9 | standalone/Docker 방향은 있으나 base image, lockfile, runtime env 기준 부족 |
| Test/CI gates | 15 | 3 | 9 | lint/typecheck/test/build 기준은 있으나 CI matrix와 smoke test 자동화 부족 |
| Local DX | 10 | 3 | 6 | step0은 충분하나 package manager, Node version, setup script 기준 부족 |
| Observability/Ops | 15 | 3 | 9 | structured log/runbook은 있으나 health check, rollback, alert 기준 부족 |
| Compatibility/Upgrade strategy | 10 | 2 | 4 | 주요 라이브러리의 breaking change 방어 전략 부족 |
| Deployment/Rollback | 5 | 2 | 2 | 배포 절차는 있으나 rollback/staging slot 기준 부족 |
| **총점** | **100** |  | **57/100** | MVP 시작은 가능하지만 Foundation 보강 후 시작 권장 |

이 점수는 Foundation hardening을 문서와 step에 반영하기 전의 기준 점수다. 이 문서를 추가하면서 F-GAP-01, F-GAP-02 일부는 step0/step4/ADR에 반영했다.

## 1차 문서 보강 후 예상 점수

| 항목 | 보강 내용 | 예상 점수 |
|------|----------|----------|
| Runtime/Dependency compatibility | Next 15 pinning, Node 20 기준, tldraw 패키지명 정정 | 4/5 |
| Env/Secret boundary | 기존 기준 유지, `.env.example` 템플릿 추가, public/server env 분리 계획 명확화 | 4.5/5 |
| Build/Docker reproducibility | Docker base/lockfile 기준 추가. 실제 Dockerfile은 구현 필요 | 3.5/5 |
| Test/CI gates | AC와 smoke 기준 강화. **`.github/workflows/ci.yml` 파이프라인 생성 완료** | 4/5 |
| Local DX | `.nvmrc`, engines, `npm ci`, package check 기준 추가. **로컬 셋업 가이드 추가** | 4.5/5 |
| Observability/Ops | health/log/rollback 갭 명시. **모니터링 SLA 임계값 및 Azure Monitor 알림 규칙 추가** | 4/5 |
| Compatibility/Upgrade strategy | review loop와 matrix 신설 | 3.5/5 |
| Deployment/Rollback | gate는 명시, slot/rollback 구현은 Post-MVP | 3/5 |
| **예상 총점** | 문서/step 스펙 기준 | **76/100** |

## 2차 세부 스펙 보강 후 목표 점수

아래 세부 스펙이 `step0`, `step2`, `step9`, M0/M9, 운영 문서에 반영되면 문서/스펙 준비도는 다음 수준을 목표로 한다. 이 점수는 실제 코드 구현 완료 점수가 아니라, 구현자가 따라갈 수 있는 기준의 명확도다.

| 항목 | 추가 보강 내용 | 목표 점수 |
|------|---------------|----------|
| Runtime/Dependency compatibility | create-next-app/Node/package lock/package check 기준 고정 | 4.5/5 |
| Env/Secret boundary | public/server env export, secret leak audit, Supabase key alias 기준 구체화 | 4.5/5 |
| Build/Docker reproducibility | Dockerfile, `.dockerignore`, standalone static copy, App Service port 계약 명시 | 4.5/5 |
| Test/CI gates | local gate, final Docker gate, secret audit, health smoke test 연결 | 4/5 |
| Local DX | `.nvmrc`, engines, `npm ci`, package smoke check 기준 명시 | 4.5/5 |
| Observability/Ops | `/api/health`, release smoke test, rollback gate 기준 구체화 | 4/5 |
| Compatibility/Upgrade strategy | major dependency 변경 시 문서/ADR 업데이트 의무화 | 4/5 |
| Deployment/Rollback | App Service port/health/previous image rollback 기준 명시 | 3.5/5 |
| **목표 총점** | 2차 상세 스펙 기준 | **82/100** |

다음 목표는 F0.1~F0.3을 실제 코드/설정에 반영해 문서 기준과 구현 기준을 일치시키고, F0.4~F0.6까지 운영화해 반복 배포 가능한 상태로 올리는 것이다.

## 주요 호환성 체크

| 축 | 현재 스펙 | 확인 내용 | 리스크 | 결정 |
|----|----------|----------|--------|------|
| Next.js | Next.js 15 | Next.js 15 문서는 Node.js 18.18+를 요구한다. | `create-next-app@latest`는 향후 Next 16+를 생성할 수 있다. | Next 15를 명시적으로 pin한다. Node는 20 LTS 기준으로 둔다. |
| Next.js standalone | `output: 'standalone'` | Next standalone은 `.next/standalone`을 만들지만 `public`과 `.next/static`은 기본 복사하지 않는다. | Docker image에서 static asset 누락 가능 | Dockerfile에서 `.next/static`과 `public` 복사 기준을 명시한다. |
| React | Next 15 기본 | Next 15는 React 19 계열과 함께 쓰일 수 있다. | 일부 라이브러리 peer warning 가능 | React/ReactDOM 버전을 Next 15 호환 범위로 lock한다. |
| Supabase SSR | `@supabase/ssr` | Supabase SSR은 browser/server client 분리와 cookie 기반 session refresh를 요구한다. | API가 변할 수 있고 proxy/session refresh 누락 가능 | Supabase SSR wrapper와 proxy/session refresh 기준을 M0/M1에 명시한다. |
| Supabase key | anon key | Supabase 문서는 publishable key 전환을 안내한다. | 새 프로젝트에서 key 명칭 혼선 | MVP는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 유지하되 publishable key alias 지원을 검토한다. |
| tldraw | `@tldraw/tldraw`로 일부 표기 | 공식 설치 패키지는 `tldraw`이며 React 18/19를 요구한다. | 잘못된 패키지 설치로 step4 실패 | `tldraw` 패키지와 import 경로로 정정한다. |
| tldraw assets | 미정 | tldraw는 CSS import, explicit parent size, asset hosting 전략이 필요하다. | App Service 환경에서 CDN/asset 문제 가능 | MVP는 CDN 기본값 허용, 운영 hardening에서 self-host 검토. |
| y-supabase | y-supabase 사용 | npm 패키지는 오래되고 문서가 빈약하다. | production reliability 리스크 | M4에서 adapter wrapper를 만들고 대체 provider 교체 가능하게 격리한다. |
| Azure App Service port | custom container | App Service custom container는 기본 80을 가정하고, 다른 포트는 `WEBSITES_PORT`가 필요하다. | 컨테이너 boot 후 라우팅 실패 | Node server는 3000, App Service는 `WEBSITES_PORT=3000` 기준. |
| Azure Health Check | 미정 | App Service Health Check는 지정 path를 1분마다 ping하고, 200~299가 아니면 unhealthy로 본다. | 장애 감지/인스턴스 교체 불가 | `/api/health` liveness route를 정의한다. |
| Docker | standalone | base image/Node version 미정 | 로컬/프로덕션 차이 | `node:20-alpine` 또는 Azure 권장 Node 20 계열을 기준으로 pin한다. |

## Gap Register

| ID | 우선순위 | 상태 | 해소일 | 갭 | 영향 | 개선안 | 소유 |
|----|----------|------|--------|----|----|--------|------|
| F-GAP-01 | P0 | 스펙 반영 | - | Next 15가 목표인데 `create-next-app@latest` 사용 | 최신 major로 생성될 수 있음 | `create-next-app`/`next`/`react` 버전 pinning | M0 |
| F-GAP-02 | P0 | 스펙 반영 | - | tldraw 패키지명이 최신 공식 문서와 불일치 | 설치/빌드 실패 | `tldraw` 패키지로 정정 | M0/M4 |
| F-GAP-03 | P0 | 스펙 반영 | - | Node runtime 기준 없음 | 로컬/CI/Docker/Azure 불일치 | Node 20 LTS 기준, `.nvmrc`/engines/Docker base 명시 | M0 |
| F-GAP-04 | P0 | 스펙 반영 | - | package manager/lockfile 정책 없음 | 재현 불가능한 설치 | npm 사용 고정 또는 package manager 결정, lockfile 필수 | M0/M9 |
| F-GAP-05 | P1 | 스펙 반영, 구현 남음 | - | Supabase SSR proxy/session refresh 기준 부족 | Auth session edge case | proxy/session refresh utility를 Foundation 작업에 포함 | M0/M1 |
| F-GAP-06 | P1 | 스펙 반영, 구현 남음 | - | y-supabase 신뢰성 리스크 | 협업 보드 안정성 저하 | provider adapter abstraction, fallback/recovery test | M0/M4/M3 |
| F-GAP-07 | P1 | 스펙 반영, 구현 남음 | - | Dockerfile 상세 기준 없음 | App Service 배포 실패 가능 | multi-stage Dockerfile, non-root, health endpoint 검토 | M0/M9 |
| F-GAP-08 | P1 | **해소** — `.github/workflows/ci.yml` 생성 | 2026-04-24 | CI gate 구체성 부족 | 수동 검증 의존 | GitHub Actions CI 파이프라인 + CD 배포 파이프라인 추가 완료 | M9 |
| F-GAP-09 | P1 | **해소** — CI secret-audit job 생성 | 2026-04-24 | secret leak 자동 검사 없음 | 보안 사고 | CI에서 client code 시크릿 검색 + process.env 패턴 + NEXT_PUBLIC_ 오용 검사 + dangerouslySetInnerHTML 검사 자동화 완료 | M9 |
| F-GAP-10 | P1 | 스펙 반영, 구현 남음 | - | 운영 health check 기준 없음 | 장애 감지 지연 | `/api/health` 또는 App Service health check 계획 | M0/M9 |
| F-GAP-11 | P2 | 스펙 반영, 운영화 남음 | - | staging/rollback 기준 부족 | 배포 실패시 복구 지연 | App Service deployment slot/previous image rollback 절차 | M9 |
| F-GAP-12 | P2 | 스펙 반영, 운영화 남음 | - | dependency upgrade 정책 없음 | 보안/호환성 drift | monthly compatibility review, lockfile diff review | M9 |
| F-GAP-13 | P1 | 스펙 반영, 구현 남음 | - | Next standalone static asset 복사 기준 부족 | CSS/static asset 404 | Dockerfile에서 `.next/static`과 `public` 복사 | M0 |
| F-GAP-14 | P1 | 스펙 반영, 운영 설정 남음 | - | Azure App Service port/env 기준 부족 | 배포 후 502/timeout | `PORT=3000`, `WEBSITES_PORT=3000`, single exposed port | M0/M9 |
| F-GAP-15 | P1 | 스펙 반영, 테스트 남음 | - | Supabase server auth 검증 API 선택 기준 부족 | spoofed cookie/session 신뢰 위험 | server 보호 로직은 `getClaims()` 또는 `getUser()`로 재검증 | M1/M9 |

## 세부 실행 스펙

### 1. Supabase SSR Proxy/Session Refresh

필수 파일:
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/proxy.ts`
- `proxy.ts` at project root

계약:
- Client Component는 `createBrowserClient`만 사용한다.
- Server Component, Route Handler, Server Action은 server client만 사용한다.
- Server Component는 cookies를 직접 갱신할 수 없으므로, root `proxy.ts`가 Supabase Auth token refresh를 담당한다.
- 보호가 필요한 서버 로직은 cookie에 들어 있는 세션 값을 그대로 신뢰하지 않는다.
- facilitator 인증/권한 확인은 Supabase Auth의 `getClaims()` 또는 `getUser()`를 통해 재검증한다.
- guest participant는 Supabase Auth가 아니라 M1 signed cookie를 사용한다. Supabase proxy는 facilitator Auth 세션 refresh용이다.

matcher 기준:
- `_next/static`, `_next/image`, favicon, 정적 이미지 파일은 제외한다.
- `/api/*` route가 Supabase Auth 세션을 읽을 수 있으므로 API route도 matcher 범위에 포함하는 것을 기본값으로 둔다.
- AI route에서 proxy가 불필요한 비용을 만들 경우 matcher를 좁히되, withFacilitator가 Auth 재검증을 자체 수행해야 한다.

테스트:
- facilitator session이 만료 직전일 때 proxy가 cookie refresh를 수행하는지 확인.
- 서버 보호 로직에서 `getSession()`만으로 권한 판단하지 않는지 검색/테스트.
- guest signed cookie와 Supabase Auth cookie가 동시에 있어도 withAuth 우선순위가 명확한지 확인.

### 2. Supabase Key Compatibility

현재 MVP env:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

호환성 정책:
- 새 Supabase 프로젝트에서 publishable key를 쓰는 경우를 고려해 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` alias를 허용할 수 있다.
- MVP 구현은 기존 `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 기준으로 하되, `env.ts`에서 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? NEXT_PUBLIC_SUPABASE_ANON_KEY` 형태를 검토한다.
- server-only service role key는 alias를 허용하지 않는다.

금지:
- service role key를 client env로 노출 금지.
- browser client에서 service role 사용 금지.

### 3. Dockerfile/Standalone Build

Dockerfile 요구:
- Location: `./Dockerfile` (프로젝트 루트). Step 0에서 생성.
- multi-stage build: deps -> builder -> runner.
- base image는 Node 20 계열로 pin한다 (`node:20-alpine` 권장).
- `npm ci` 사용.
- `next.config.ts`에 `output: 'standalone'`.
- runner stage에는 `.next/standalone`, `.next/static`, `public`을 복사한다.
- production runtime은 `node server.js`를 사용한다.
- container는 port 3000 하나만 expose한다.
- App Service app setting은 `WEBSITES_PORT=3000`.
- `HOSTNAME=0.0.0.0`, `PORT=3000`을 명시한다.
- 가능하면 non-root user로 실행한다.

`.dockerignore` 요구:
- `node_modules`
- `.next`
- `.env`
- `.env.*`
- test coverage/output
- local logs
- `.git`

Acceptance:
- `docker build -t workshop-agent .`
- `docker run -p 3000:3000 --env-file .env.local workshop-agent`
- `/api/health`가 200을 반환.

### 4. Health Check

route:
- `GET /api/health`

MVP 응답:
```json
{
  "data": {
    "status": "ok",
    "version": "optional",
    "time": "ISO timestamp"
  }
}
```

원칙:
- App Service Health Check용 liveness는 빠르고 외부 의존성에 약하게 결합한다.
- DB/Azure OpenAI까지 호출하는 deep health는 Post-MVP 또는 운영자 전용 endpoint로 분리한다.
- liveness가 외부 장애 때문에 실패하면 정상 인스턴스가 불필요하게 제거될 수 있으므로 주의한다.

Azure 설정:
- Health Check path: `/api/health`
- App Service는 이 path를 1분마다 ping한다.
- 200~299가 아닌 응답이 반복되면 unhealthy로 판단된다.

### 5. CI Gate

권장 GitHub Actions 또는 Azure Pipeline 단계:
1. checkout
2. setup Node 20
3. `npm ci`
4. `npm run lint`
5. `npm run typecheck`
6. `npm run test`
7. `npm run build`
8. optional: `docker build -t workshop-agent .`

PR 필수 조건:
- lockfile 변경이 있으면 dependency compatibility review 필요.
- `package.json`의 major dependency 변경 시 `FOUNDATION_ASSESSMENT.md` 또는 ADR 업데이트 필요.
- secret 값이 diff에 포함되지 않았는지 검사.

로컬 step gate:
- 모든 step은 최소 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`를 통과해야 한다.
- Foundation/최종 통합 step은 `docker build -t workshop-agent .`를 추가로 통과해야 한다.
- 네트워크/외부 인증이 필요한 배포 단계는 blocked로 분류하되, 로컬 빌드 실패는 blocked가 아니라 error로 분류하고 수정한다.

### 6. Secret Leak Audit

정적 검사 기준:
- `.env`, `.env.local`, `.env.production`은 커밋 금지.
- `.env.example`만 커밋 가능.
- `SUPABASE_SERVICE_ROLE_KEY`, `AZURE_OPENAI_API_KEY`, `SESSION_SECRET`는 `NEXT_PUBLIC_` 접두사 금지.
- client component에서 `src/lib/env.ts`의 server env import 금지.
- `process.env` 직접 접근은 `src/lib/env.ts`, Next config, test setup 같은 허용 파일로 제한.

권장 테스트:
- `rg "SUPABASE_SERVICE_ROLE_KEY|AZURE_OPENAI_API_KEY|SESSION_SECRET" src/app src/components`로 client 노출 검색.
- server env import boundary test.
- Docker image build context에 `.env*`가 들어가지 않는지 `.dockerignore` 확인.

### 7. y-supabase Adapter Contract

목표:
- y-supabase가 바뀌거나 교체되어도 M4 도메인 코드를 크게 바꾸지 않게 한다.

권장 wrapper:
```typescript
interface BoardSyncProvider {
  connect(): Promise<void>
  disconnect(): void
  getStatus(): 'connecting' | 'connected' | 'disconnected' | 'error'
}
```

계약:
- WhiteboardCanvas는 wrapper만 import한다.
- provider 내부만 y-supabase를 직접 import한다.
- reconnect 실패 시 notes API refetch로 정규 데이터를 복구한다.
- Yjs document와 notes table이 불일치하면 notes table을 AI pipeline 기준 데이터로 삼는다.

테스트:
- connect/disconnect cleanup.
- provider error 상태에서 UI fallback.
- notes refetch recovery.

### Yjs-Supabase 동기화 충돌 해결

충돌 감지:
1. Yjs map size ≠ notes table count (차이 > 2개)
2. shape.id가 DB note.id와 불일치 (orphaned shapes 존재)
3. Realtime channel 재연결 후 notes refetch (stale 감지)

해결 알고리즘:
1. **우선순위**: notes table을 CANONICAL SOURCE로 삼는다 (AI는 notes 기준)
2. **재구성**: 워크샵 재접속 시 notes 테이블 기준으로 Yjs document 재구성
3. **사용자 알림**: "화이트보드가 동기화되었습니다" Toast 표시
4. **로깅**: `{ action: 'yjs-reconcile', shape_count, note_count, workshop_id }` warn 레벨

트리거 시점:
- gather→cluster 단계 전환 전 (notes count 불일치 시 경고 Toast + 전환 차단)
- 워크샵 재접속 시 (페이지 로드)

### Yjs-Supabase 동기화 충돌 해결

충돌 감지:
1. Yjs map size ≠ notes table count (차이 > 2개)
2. shape.id가 DB note.id와 불일치 (orphaned shapes 존재)
3. Realtime channel 재연결 후 notes refetch (stale 감지)

해결 알고리즘:
1. **우선순위**: notes table을 CANONICAL SOURCE로 삼는다 (AI는 notes 기준)
2. **재구성**: 워크샵 재접속 시 notes 테이블 기준으로 Yjs document 재구성
3. **사용자 알림**: "화이트보드가 동기화되었습니다" Toast 표시
4. **로깅**: `{ action: 'yjs-reconcile', shape_count, note_count, workshop_id }` warn 레벨

트리거 시점:
- gather→cluster 단계 전환 전 (notes count 불일치 시 경고 Toast + 전환 차단)
- 워크샵 재접속 시 (페이지 로드)

## 고도화된 Foundation 계획

### F0.1 Runtime & Dependency Lock

목표: 누구의 로컬/CI/Docker에서도 같은 major stack이 설치되게 한다.

작업:
- Node 기준: Node 20 LTS.
- `.nvmrc`와 `package.json.engines.node`를 Node 20 기준으로 지정.
- `create-next-app`은 Next.js 15 생성이 보장되는 방식으로 pin한다.
- `next`, `react`, `react-dom`, `eslint-config-next` 버전을 Next 15 호환 범위로 고정한다.
- `tldraw` 패키지를 사용하고 `@tldraw/tldraw` 표기는 제거한다.
- lockfile을 커밋 대상으로 명시한다.

Acceptance:
- `node --version` 기준 문서와 일치.
- `npm ci`로 설치 가능.
- `npm ls next react react-dom tldraw @supabase/ssr`로 주요 버전 확인 가능.

### F0.2 Environment & Secret Boundary

목표: 서버/클라이언트 env 경계가 실수로 깨지지 않게 한다.

작업:
- `src/lib/env.ts`에서 server env와 public env를 분리 export.
- client component에서 server env import 금지 테스트.
- `.env.example`과 운영 env 목록 동기화.
- Supabase anon/publishable key 명칭 전환 가능성을 주석으로 설명.

Acceptance:
- env 누락 시 서버 시작 실패.
- `SESSION_SECRET` 32자 미만이면 실패.
- secret 문자열이 클라이언트 번들에 포함되지 않는지 audit.

### F0.3 Build, Docker & Deployment Baseline

목표: Next standalone output이 Azure App Service container에서 안정적으로 실행되게 한다.

작업:
- `next.config.ts`에 `output: 'standalone'`.
- Dockerfile은 multi-stage build.
- Node base image는 Node 20 계열로 pin.
- `.dockerignore`에 `node_modules`, `.next`, `.env*`, test output 포함.
- container 실행 command와 port 3000 기준 명시.
- App Service health check 경로 계획.

Acceptance:
- `npm run build` 통과.
- `docker build -t workshop-agent .` 통과.
- `docker run -p 3000:3000 --env-file .env.local workshop-agent`로 boot 가능.

### F0.4 Quality Gate & CI

목표: 사람이 빼먹기 쉬운 검증을 자동화한다.

작업:
- `lint -> typecheck -> test -> build` 순서 고정.
- 최종 통합 step에서 Docker build 실행.
- Vitest config, Testing Library setup, test scripts 준비.
- migration SQL 문자열 검증 테스트를 step1에 유지.
- AI/OpenAI는 mock/MSW 기반 테스트 원칙 유지.

Acceptance:
- CI 또는 local gate가 같은 명령 순서로 실행.
- test가 없는 초기 상태에서도 runner가 실패하지 않음.
- 새 기능 step은 테스트 선작성 지시 포함.

### F0.5 Observability & Operations Baseline

목표: 운영 중 실패 원인을 빠르게 좁힐 수 있게 한다.

작업:
- API structured logging helper 계획.
- error code/status/duration/workshop_id/participant_id 포함.
- secret redaction 기준 명시.
- Supabase/Azure OpenAI/Realtime/Auth 장애 런북 유지.
- smoke test checklist를 release checklist와 연결.

Acceptance:
- 모든 API route가 공통 response/logging helper 사용.
- AI timeout/is_processing 복구 로그 확인 가능.
- smoke test가 운영 문서에 명시된 순서대로 실행 가능.

### F0.6 Compatibility Review Loop

목표: 핵심 라이브러리 변화에 스펙이 늦게 반응하지 않게 한다.

작업:
- Foundation compatibility matrix를 유지.
- Next/Supabase/tldraw/y-supabase/OpenAI 주요 버전 변경 시 ADR 또는 SPEC_AUDIT 업데이트.
- y-supabase는 wrapper 뒤에 격리하고 교체 가능하게 설계.
- dependency upgrade는 lockfile diff와 smoke test를 함께 리뷰.

Acceptance:
- 호환성 변경은 `FOUNDATION_ASSESSMENT.md` 또는 ADR에 기록.
- 주요 dependency upgrade PR은 Foundation checklist를 통과해야 함.

## 목표 점수

| 단계 | 목표 점수 | 의미 |
|------|----------|------|
| 현재 | 57/100 | 구현 시작 가능하지만 호환성 리스크 큼 |
| 1차 문서 보강 후 | 72/100 | 주요 P0 스펙 충돌 해소 |
| 2차 세부 스펙 보강 후 | 82/100 | 구현자가 안정적으로 따라갈 수 있는 Foundation 계약 |
| F0.1~F0.3 실제 구현 후 | 88+/100 | 문서 기준과 코드/설정 기준이 일치하는 MVP 구현 안정권 |
| F0.4~F0.6 운영화 후 | 92+/100 | 운영 준비 가능한 Foundation |
| Post-MVP 운영 자동화 후 | 96+/100 | 반복 배포/확장 안정권 |

## Foundation 완료 정의

- Next 15/React/tldraw/Supabase SSR 호환성 기준이 문서와 package에 반영됨.
- Node/package manager/Docker runtime이 pin됨.
- env schema와 secret boundary 테스트가 존재함.
- lint/typecheck/test/build/Docker build gate가 작동함.
- Supabase SSR session refresh/proxy 전략이 확정됨.
- y-supabase reliability risk가 adapter abstraction으로 격리됨.
- 운영 smoke test, log redaction, incident runbook이 문서화됨.

## 참고한 호환성 근거

- Next.js 15 installation docs: Node.js 18.18 이상 필요.
- Supabase SSR docs: browser/server client 분리, cookie 기반 SSR client, session refresh proxy 필요.
- Supabase SSR overview: `@supabase/ssr` API가 변할 수 있음을 명시.
- tldraw installation docs: `tldraw` 패키지 설치, React 18/19 필요, CSS/asset/parent sizing 요구.
- y-supabase npm/package docs: 오래된 package이고 README/운영 안정성 정보가 부족하므로 wrapper 격리가 필요.
