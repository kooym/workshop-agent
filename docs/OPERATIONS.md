# 운영 계획

이 문서는 Workshop Agent를 실제 워크샵에서 사용, 운영, 관리하기 위한 기준이다.

## 운영 대상

| 대상 | 설명 | 책임 모듈 |
|------|------|----------|
| Next.js App Service | 웹 UI와 API Route 실행 | M0/M9 |
| Supabase PostgreSQL | 워크샵 데이터 저장 | M2/M4/M6/M7/M9 |
| Supabase Auth | 퍼실리테이터 인증 | M1 |
| Supabase Realtime/Yjs | 협업 상태 동기화 | M3/M4 |
| Azure OpenAI | 클러스터링/과제/PRD 생성 | M5 |
| ACR/Docker image | 배포 아티팩트 | M0/M9 |

Foundation 준비도와 호환성 기준은 `FOUNDATION_ASSESSMENT.md`를 함께 확인한다.

## 환경 변수

필수:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`

운영 원칙:
- `SESSION_SECRET`은 32자 이상.
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용.
- secret 변경 시 App Service 재시작 필요.
- `SESSION_SECRET` 변경은 guest session 무효화를 유발한다.
- Supabase publishable key를 사용하는 프로젝트는 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` alias 지원 여부를 Foundation 기준에 맞춰 결정한다.
- 실제 `.env*` 값 파일은 커밋하지 않는다.

## 배포 절차

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`
5. `docker build -t workshop-agent .`
6. ACR login/tag/push
7. Azure App Service image update or restart
8. smoke test

배포 전 Foundation gate:
- Node/Next/React/tldraw/Supabase SSR 버전이 compatibility matrix와 일치
- lockfile 변경 검토 완료
- Docker base image가 문서 기준과 일치
- secret boundary audit 완료
- `WEBSITES_PORT=3000` 설정 확인
- `/api/health` path 존재 확인
- Next standalone static asset 복사 확인

Smoke test:
- `/api/health` 200 확인
- facilitator signup/login
- project/workshop 생성
- invite code 참여
- 2개 탭에서 note 실시간 동기화
- cluster/vote/derive/generate 버튼 권한 확인
- AI mock 또는 실제 테스트 실행
- completed read-only 확인

Rollback 기준:
- App Service health check가 배포 직후 반복 실패하면 이전 정상 image tag로 되돌린다.
- facilitator login, workshop 생성, invite join 중 하나라도 smoke test에서 실패하면 배포를 보류한다.
- DB migration이 포함된 배포는 rollback 가능성, forward-fix 가능성, 데이터 backfill 여부를 사전에 기록한다.
- staging slot을 사용하는 경우 production swap 전 동일 smoke test를 staging에서 먼저 실행한다.

## App Service Container 기준

- 컨테이너는 port 3000에서 HTTP를 listen한다.
- App Service app setting에 `WEBSITES_PORT=3000`을 설정한다.
- App Service는 HTTP 요청용 port를 하나만 노출한다고 가정한다.
- HTTPS termination은 App Service front end가 처리하므로 컨테이너 내부에서 HTTPS를 직접 구현하지 않는다.
- startup timeout이 필요한 경우 `WEBSITES_CONTAINER_START_TIME_LIMIT` 조정을 검토한다.

## Health Check 기준

- Health Check path: `/api/health`
- 응답 status: 200~299
- 응답은 빠르고 외부 의존성에 깊게 결합하지 않는다.
- DB/Azure OpenAI deep check는 운영자 전용 별도 endpoint 또는 Post-MVP로 둔다.
- Health Check 실패가 반복되면 App Service가 인스턴스를 unhealthy로 판단할 수 있으므로, liveness와 dependency check를 섞지 않는다.

## 로그 기준

API Route 에러는 다음 구조로 기록한다.

```json
{
  "method": "POST",
  "path": "/api/ai/cluster",
  "status": 500,
  "error": "message",
  "duration_ms": 1234,
  "workshop_id": "optional",
  "participant_id": "optional"
}
```

로그에 넣지 말 것:
- API keys
- service role key
- session secret
- raw signed cookie
- Azure OpenAI request headers

## Secret Leak Audit

릴리즈 전 확인:
- `.env`, `.env.local`, `.env.production`이 git tracked 상태가 아닌지 확인
- `.dockerignore`에 `.env*` 포함
- `NEXT_PUBLIC_` 접두사가 server secret에 붙지 않았는지 확인
- client component에서 server env import가 없는지 확인
- Docker build context에 secret 파일이 포함되지 않는지 확인

검색 예:
```bash
rg "SUPABASE_SERVICE_ROLE_KEY|AZURE_OPENAI_API_KEY|SESSION_SECRET" src/app src/components
```

검색 결과가 client component 또는 client-imported module에 있으면 릴리즈를 중단한다.

## 주요 장애 런북

### Supabase DB 장애

증상:
- API 500 증가
- 데이터 fetch 실패
- Realtime reconnect 반복

대응:
1. Supabase status 확인
2. App Service 로그에서 DB error code 확인
3. 사용자에게 "서비스 일시 장애" Toast/inline error 표시
4. 쓰기 요청 재시도는 사용자가 명시적으로 실행
5. 장애 복구 후 workshop store 전체 refetch

### Realtime/Yjs 장애

증상:
- 다른 참석자의 포스트잇/투표가 안 보임
- presence가 부정확함

대응:
1. Realtime channel status 확인
2. reconnect 후 API refetch
3. notes 테이블과 Yjs document 불일치 확인
4. AI 파이프라인은 notes 테이블 기준으로 계속 동작

### Azure OpenAI 장애

증상:
- AI API timeout/500
- `is_processing=true`가 오래 유지됨

대응:
1. API Route try/finally로 `is_processing=false` 복구 확인
2. Azure OpenAI deployment status/capacity 확인
3. 사용자에게 재시도 가능한 Toast 표시
4. 반복 실패 시 prompt/input size 로그 확인
5. 필요 시 model deployment/capacity 조정

### Auth/session 장애

증상:
- facilitator login 실패
- guest 새로고침 후 세션 복구 실패

대응:
1. Supabase Auth status 확인
2. cookie secure/samesite/domain 확인
3. `SESSION_SECRET` 변경 여부 확인
4. withAuth participant existence 검증 로그 확인

## 데이터 보존

- 워크샵 데이터는 최소 30일 유지한다.
- completed 워크샵은 산출물 조회를 위해 보존한다.
- 삭제 기능 도입 전에는 프로젝트/워크샵 삭제 정책을 명확히 한다.
- Post-MVP에서 archive/export/delete policy를 분리한다.

## 보안 운영

- service role key 접근 권한 최소화
- App Service env var 접근 제한
- secret rotation 기록
- facilitator 계정 비밀번호 정책 유지
- guest invite code 노출 범위는 워크샵 참석자에게 한정
- completed 신규 참여는 read-only

## 비용/용량 관리

관측할 지표:
- 워크샵 수
- 참가자 수
- notes 수
- AI 호출 수/실패율/latency
- PRD generation token usage
- Realtime reconnect count
- App Service CPU/memory
- Supabase DB size

임계값 예:
- AI clustering > 30초
- derivation > 30초
- PRD generation > 60초
- Realtime reconnect 반복
- notes 200개 제한 근접
- participants max_participants 도달

## 운영 역할

| 역할 | 책임 |
|------|------|
| Facilitator | 워크샵 생성/진행/완료, 산출물 확인 |
| Operator | 배포, env var, 장애 대응, 로그 확인 |
| Developer | 버그 수정, 테스트, schema/API 변경 |
| Admin/Post-MVP | 데이터 보존, 감사 로그, 조직 설정 |

## 릴리즈 전 체크리스트

- 문서: 변경 모듈 문서 업데이트
- 보안: secret 노출 검색
- 데이터: migration 검토
- API: Zod + 표준 응답 확인
- UI: role별 컨트롤 노출 확인
- 테스트: lint/typecheck/test/build
- 배포: Docker build
- 운영: rollback 또는 재시작 절차 확인
