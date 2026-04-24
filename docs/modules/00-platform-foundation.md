# M0 Platform Foundation

## 책임

앱이 일관되게 실행, 검증, 빌드, 배포될 수 있는 기반을 소유한다.

Foundation Cluster의 세부 평가와 개선 계획은 `docs/FOUNDATION_ASSESSMENT.md`를 기준으로 한다.

## 소유 범위

- Next.js 15 App Router 설정
- Node.js 20 LTS 기준
- package manager/lockfile 정책
- TypeScript strict mode
- Tailwind/Vitest/Testing Library 설정
- `src/lib/env.ts`
- Supabase browser/server client factory
- Supabase Auth session refresh proxy scaffold
- Dockerfile, `.dockerignore`, `next.config.ts`
- `/api/health` liveness endpoint
- package scripts: `dev`, `lint`, `typecheck`, `test`, `build`
- Azure App Service/ACR 배포 전제
- dependency compatibility matrix

## 소유하지 않는 것

- 인증 정책 자체: M1
- 워크샵 상태 전환: M2
- AI prompt/schema: M5
- UI 스타일 규칙: M8
- 운영 런북: M9

## 계약

- 서버 전용 환경 변수는 `src/lib/env.ts`에서 Zod로 검증한다.
- 클라이언트 번들에 서버 secret을 노출하지 않는다.
- 서버 모듈은 `process.env`를 직접 읽지 않는다.
- Supabase browser client와 server client를 혼용하지 않는다.
- `output: 'standalone'` 빌드를 유지한다.
- Next.js 15, React, tldraw, Supabase SSR 등 핵심 런타임/패키지는 major version drift가 없도록 pinning한다.
- tldraw는 공식 `tldraw` 패키지를 사용한다.
- y-supabase는 직접 도메인 코드에 흩뿌리지 않고 provider adapter 뒤에 격리한다.
- Next standalone Docker image는 `.next/standalone`, `.next/static`, `public`을 모두 포함해야 한다.
- Azure App Service custom container 기준 port는 3000이고, `WEBSITES_PORT=3000`을 운영 설정에 반영한다.
- Supabase Auth session refresh는 root `proxy.ts`와 `src/lib/supabase/proxy.ts`로 분리한다.
- App Service Health Check용 `/api/health`는 외부 의존성에 깊게 결합하지 않는 liveness endpoint로 둔다.
- package manager는 npm을 기본값으로 하고 `package-lock.json`을 커밋한다.

## 확장 포인트

- CI pipeline 추가
- Azure staging slot 배포
- preview 환경 분리
- feature flag 시스템
- dependency audit 자동화
- compatibility review loop
- health check endpoint
- Supabase publishable key alias 지원
- Docker hardening(non-root, image size, startup time)

## 테스트

- env schema 테스트
- package scripts smoke test
- build/lint/typecheck/test 명령 검증
- Docker build 최종 검증
- dependency compatibility smoke test
- secret boundary audit
- standalone static asset smoke test
- health endpoint smoke test
- App Service port config check

## 준비도 레벨

| 레벨 | 의미 | 필수 기준 |
|------|------|----------|
| F0-Spec | 구현 전 스펙 고정 | `FOUNDATION_ASSESSMENT.md`, step0/step9 gate, compatibility matrix 정리 |
| F1-Baseline | 로컬 개발 가능 | Node 20, npm lockfile, env schema, Supabase client/proxy scaffold |
| F2-Deployable | 컨테이너 배포 가능 | standalone build, Dockerfile, `.dockerignore`, `/api/health`, port 3000 |
| F3-Operable | 실제 워크샵 운영 가능 | structured logs, smoke test, secret audit, rollback 기준 |
| F4-Scalable | 반복 확장 가능 | CI automation, dependency review loop, staging/rollback automation |

## 운영 고려사항

- secret rotation 절차는 M9에서 관리한다.
- 빌드 실패는 구현 오류로 보고 blocked가 아니라 error로 처리한다.
- 네트워크나 외부 인증이 필요한 배포 작업은 blocked로 분류한다.
- Foundation 변경은 package lockfile, Dockerfile, env schema, CI gate를 함께 검토한다.
