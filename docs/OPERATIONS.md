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

컨테이너 런타임:
- `NODE_ENV=production` | `development` — 세션 쿠키 Secure 플래그 결정. 프로덕션 배포 시 반드시 `production` 설정 (localhost 개발시 `development`으로 Secure 해제)
- `HOSTNAME=0.0.0.0` — Next.js standalone이 모든 인터페이스에서 listen하도록 설정 (Docker/App Service 필수)
- `PORT=3000` — 앱 listen 포트 (기본값)
- `WEBSITES_PORT=3000` — Azure App Service가 컨테이너 포트를 인식하는 설정

운영 원칙:
- `SESSION_SECRET`은 32자 이상.
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용.
- secret 변경 시 App Service 재시작 필요.
- `SESSION_SECRET` 변경은 guest session 무효화를 유발한다.
- Supabase publishable key 호환: 새 Supabase 프로젝트에서 publishable key를 사용하는 경우, `src/lib/env.ts`에서 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? NEXT_PUBLIC_SUPABASE_ANON_KEY` 순서로 폴백 처리. MVP는 anon_key 기준.
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
- context/cluster/vote/design/generate/report 버튼 권한 확인
- AI mock 또는 실제 테스트 실행
- completed read-only 확인

### Smoke Test 실행 스크립트

배포 후 또는 로컬에서 수동으로 실행할 수 있는 체크리스트. MVP에서는 수동 실행, Post-MVP에서 자동화.

```bash
#!/bin/bash
# scripts/smoke-test.sh
# Usage: ./scripts/smoke-test.sh <BASE_URL>
# Example: ./scripts/smoke-test.sh https://workshop-agent.azurewebsites.net

BASE_URL="${1:-http://localhost:3000}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local status="$2"
  local expected="$3"
  if [ "$status" = "$expected" ]; then
    echo "✅ $name (HTTP $status)"
    PASS=$((PASS + 1))
  else
    echo "❌ $name (HTTP $status, expected $expected)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Smoke Test: $BASE_URL ==="
echo ""

# 1. Health check
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
check "Health check" "$STATUS" "200"

# 2. Landing page
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
check "Landing page" "$STATUS" "200"

# 3. Auth pages
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/auth/login")
check "Login page" "$STATUS" "200"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/auth/signup")
check "Signup page" "$STATUS" "200"

# 4. API 미인증 접근 차단
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/projects")
check "Projects API requires auth" "$STATUS" "401"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/workshops")
check "Workshops API requires auth" "$STATUS" "401"

# 5. Invalid invite code
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/workshops/join" \
  -H "Content-Type: application/json" \
  -d '{"invite_code":"ZZZZZZ","name":"test"}')
check "Invalid invite code rejected" "$STATUS" "404"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  echo "⚠️  Smoke test FAILED"
  exit 1
fi
echo "✅ All smoke tests passed"
```

**주의**: 위 스크립트는 기본 엔드포인트 접근만 검증한다. 아래 수동 검증은 사람이 브라우저에서 수행한다:
1. facilitator signup → login → project 생성 → workshop 생성
2. invite code로 다른 브라우저/탭에서 참여
3. 포스트잇 실시간 동기화 확인 (2개 탭)
4. 퍼실리테이터 전용 버튼 가시성 확인 (AI 트리거, 단계 전환)
5. completed 워크샵 읽기 전용 확인

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

### /api/health 구현 참조

Location: `src/app/api/health/route.ts`

```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    data: {
      status: 'ok',
      version: process.env.npm_package_version || 'unknown',
      time: new Date().toISOString()
    }
  }, { status: 200 })
}

export const dynamic = 'force-dynamic'
```

검증: `curl -s http://localhost:3000/api/health | jq .data.status` → `"ok"`

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

### AI 파이프라인 로깅 예시

클러스터링 시작:
```json
{ "method": "POST", "path": "/api/ai/cluster", "action": "start", "workshop_id": "uuid", "notes_count": 25, "timestamp": "ISO" }
```

클러스터링 완료:
```json
{ "method": "POST", "path": "/api/ai/cluster", "action": "success", "workshop_id": "uuid", "cluster_count": 5, "duration_ms": 12340, "timestamp": "ISO" }
```

AI 실패 (redacted):
```json
{ "method": "POST", "path": "/api/ai/cluster", "action": "error", "status": 500, "error": "OpenAI API rate limited", "workshop_id": "uuid", "duration_ms": 30000, "timestamp": "ISO" }
```

**주의**: AI 응답 본문, 토큰 사용량 상세, 전체 에러 스택은 로그에 포함하지 않는다.

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
2. Supabase 클라이언트 내장 자동 재연결 동작 확인 (exponential backoff: 1s → 2s → 4s → 8s → 16s, max 30s)
3. 재연결 성공 시 Zustand 스토어 전체 재페치로 상태 동기화
4. notes 테이블과 Yjs document 불일치 확인
5. AI 파이프라인은 notes 테이블 기준으로 계속 동작
6. Presence heartbeat: 클라이언트는 10초 주기로 heartbeat 전송. presence leave 이벤트 후 30초 내 rejoin 없으면 연결 끊김으로 판정

### Azure OpenAI 장애

증상:
- AI API timeout/500
- `is_processing=true`가 오래 유지됨
- `is_processing_since`가 5분 초과 (stale lock)

대응:
1. API Route try/finally로 `is_processing=false, is_processing_since=null` 복구 확인
2. `is_processing_since` > 5분인 워크샵 조회: stale lock으로 자동 복구되어야 하지만, 수동 대응은 위의 "is_processing Stale Lock 장애" 참조
3. Azure OpenAI deployment status/capacity 확인
4. 사용자에게 재시도 가능한 Toast 표시
5. 반복 실패 시 prompt/input size 로그 확인
6. 필요 시 model deployment/capacity 조정

### Auth/session 장애

증상:
- facilitator login 실패
- guest 새로고침 후 세션 복구 실패

대응:
1. Supabase Auth status 확인
2. cookie secure/samesite/domain 확인
3. `SESSION_SECRET` 변경 여부 확인
4. withAuth participant existence 검증 로그 확인

### is_processing Stale Lock 장애

증상:
- `is_processing=true`가 5분 이상 유지됨
- 퍼실리테이터가 AI 버튼을 눌러도 "이미 AI가 처리 중입니다" 409 에러

대응:
1. `is_processing_since` 타임스탬프 확인 (5분 초과 = stale lock)
2. API가 자동으로 stale lock을 감지하여 복구해야 하지만, 수동 복구가 필요한 경우:
   ```sql
   UPDATE workshops SET is_processing = false, is_processing_since = null WHERE id = '<workshop_id>';
   ```
3. AI 서버 크래시/OOM 로그 확인 (try/finally 미실행 원인)
4. 반복 발생 시 Azure OpenAI capacity/timeout 점검

### Stale Data Cascade (하류 무효화)

증상:
- 이전 단계에서 데이터가 수정된 후 하류 AI 산출물에 `is_stale=true` 설정됨
- 퍼실리테이터에게 StaleBanner 경고 표시

대응:
1. `propagateStale(workshopId, modifiedStage)` 호출이 정상 작동하는지 API 로그 확인
2. 대상 테이블 확인: `clusters.is_stale`, `design_artifacts.is_stale`, `prds.is_stale`, `ax_reports.is_stale`
3. 퍼실리테이터가 "AI 재실행 권장" 또는 "현재 결과 유지"(dismiss-stale) 중 선택
4. `completed` 단계 전진 전 모든 stale 플래그가 해제되어야 함
5. 수동 stale 해제 (긴급 시):
   ```sql
   UPDATE clusters SET is_stale = false WHERE workshop_id = '<id>';
   UPDATE design_artifacts SET is_stale = false WHERE workshop_id = '<id>';
   UPDATE prds SET is_stale = false WHERE workshop_id = '<id>';
   UPDATE ax_reports SET is_stale = false WHERE workshop_id = '<id>';
   ```

### Rate Limiting 차단

증상:
- 특정 IP에서 429 응답 반복
- 정상 사용자가 로그인/참여 차단됨

대응:
1. 서버 로그에서 429 응답 IP 확인
2. 악의적 접근인 경우 WAF/App Service IP 제한 추가 검토
3. 정상 사용자 오탐인 경우 서버 재시작으로 인메모리 Rate Limiter 초기화

### Rate Limiting 운영 기준

| 엔드포인트 | 제한 | 실패 차단 | 모니터링 |
|-----------|------|---------|---------|
| POST /api/workshops/join | IP당 10req/min | 5회 연속 실패 → 60초 차단 | 429 > 10회/min → 알림 |
| POST /api/auth/signup | IP당 10req/min | 초과 시 429 | 429 급증 → 알림 |
| POST /api/auth/login | IP당 10req/min | 초과 시 429 | 429 급증 → 알림 |

IP 화이트리스트 (긴급):
1. Azure App Service 네트워크 규칙에서 신뢰할 수 있는 IP 추가
2. 정당한 오탐이면 rate limit threshold 재조정
3. 인메모리 Rate Limiter는 서버 재시작으로 초기화됨 (MVP 제약)

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

### Secret Rotation 스케줄

| 시크릿 | Rotation 주기 | 영향 범위 | 절차 |
|--------|---------------|-----------|------|
| `SESSION_SECRET` | 90일 또는 유출 의심 시 즉시 | 모든 guest 세션 무효화 → 참석자 재참여 필요 | 1. 새 시크릿 생성 (32자+) → 2. App Service env var 업데이트 → 3. App Service 재시작 → 4. 활성 워크샵 참석자에게 재접속 안내 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 대시보드에서 regenerate 시 | 모든 API Route 서버사이드 DB 접근 중단 | 1. Supabase 대시보드에서 새 key 생성 → 2. App Service env var 즉시 업데이트 → 3. 재시작 → 4. smoke test |
| `AZURE_OPENAI_API_KEY` | 90일 또는 Azure 정책에 따라 | AI 기능(클러스터링, 과제 도출, PRD 생성) 중단 | 1. Azure Portal에서 새 key 생성 → 2. App Service env var 업데이트 → 3. 재시작 → 4. AI 엔드포인트 smoke test |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 대시보드에서 regenerate 시 | 클라이언트 Realtime/읽기 중단, 재빌드 필요 | 1. Supabase 대시보드에서 새 key 생성 → 2. `.env` 업데이트 → 3. **재빌드 + 재배포** (NEXT_PUBLIC_ 빌드 타임 주입) → 4. smoke test |

**Rotation 원칙**:
- 유출 의심 시 즉시 rotation (스케줄 무관)
- rotation 전후로 `OPERATIONS.md`의 "secret rotation 기록" 에 날짜/사유 기록
- `SESSION_SECRET` rotation은 워크샵 진행 중을 피해 야간/비활성 시간대에 수행
- `NEXT_PUBLIC_*` 키는 빌드 타임에 주입되므로 rotation 시 **반드시 재빌드 + 재배포** 필요

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
- design > 30초
- PRD generation > 60초
- report generation > 60초
- Realtime reconnect 반복
- notes 200개 제한 근접
- participants max_participants 도달

### Realtime 연결 풀 관리

워크샵 당 채널 수 (CLAUDE.md 명시 11종):
- workshop:{id}, process_steps:{id}, process_edges:{id}, process_lanes:{id}, editing_locks:{id}, notes:{id}, clusters:{id}, votes:{id}, reactions:{id}, design:{id}, presence:{id}
- 참석자 N명 × 11채널 = N×11 WebSocket 구독
- Supabase Realtime 기본 제한: 보통 100개 채널/connection

모니터링 기준:
- 재연결 빈도: < 5회/min/user (경고 > 5, 위험 > 10)
- 채널당 지연: < 100ms (경고 > 200ms, 위험 > 500ms)
- 특정 워크샵의 채널 수가 11개를 초과하면 누수 의심

### 모니터링 SLA 및 알림 임계값

| 메트릭 | 목표 SLA | 경고 임계값 | 위험 임계값 | 대응 |
|--------|----------|-------------|-------------|------|
| 일반 API 응답 시간 | < 500ms (p95) | > 500ms | > 2s | API Route 최적화, DB 쿼리 점검 |
| AI clustering 응답 | < 30s | > 25s | > 30s (timeout) | 프롬프트/입력 크기 점검, capacity 조정 |
| AI design 응답 | < 30s | > 25s | > 30s (timeout) | 프롬프트/입력 크기 점검 |
| AI PRD 생성 응답 | < 60s | > 50s | > 60s (timeout) | max_tokens 조정, 입력 필터링 |
| AI report 생성 응답 | < 60s | > 50s | > 60s (timeout) | max_tokens 조정, 입력 필터링 |
| 5xx 에러율 | < 1% | > 2%/5min | > 5%/5min | 에러 로그 확인, 외부 서비스 상태 점검 |
| App Service CPU | < 70% avg | > 70% avg | > 90% avg | scale up 또는 scale out 검토 |
| App Service Memory | < 80% | > 80% | > 90% | 메모리 누수 점검, 컨테이너 재시작 |
| Realtime 재연결 빈도 | < 5회/min/user | > 5회/min | > 10회/min | Supabase 서비스 상태 확인, 네트워크 점검 |
| DB connection pool | < 80% | > 80% | > 95% | connection pooling 설정 조정 |
| is_processing_since 경과 | < 5min | > 3min | > 5min (stale lock) | try/finally 미실행 의심, 수동 is_processing=false 복구 |
| is_stale 산출물 수 | 0 | > 0 | N/A | 퍼실리테이터에게 AI 재실행 또는 dismiss 안내 |
| Presence heartbeat | 10s 주기 | > 20s gap | > 30s gap (연결 끊김 판정) | 네트워크 점검, Realtime 채널 상태 확인 |
| Rate Limit 차단 | < 1%/min | > 5 차단/min | > 20 차단/min | IP 기반 공격 의심, WAF 추가 검토 |

### Azure Monitor 기본 메트릭

App Service에서 수집해야 할 메트릭:
- `Http5xx` — 서버 에러 응답 수
- `HttpResponseTime` — 평균 응답 시간
- `CpuPercentage` — CPU 사용률
- `MemoryPercentage` — 메모리 사용률
- `Requests` — 총 요청 수
- `HealthCheckStatus` — Health Check 통과율

Azure Monitor Alert 규칙 (MVP 최소 권장):
1. `Http5xx > 10` in 5 minutes → 이메일 알림
2. `HealthCheckStatus < 100%` in 5 minutes → 이메일 알림
3. `HttpResponseTime > 2000ms` (p95) in 5 minutes → 이메일 알림

**구체적 Alert 쿼리 예시** (Azure Monitor KQL):

```kusto
// Alert 1: 5xx 에러 급증
requests
| where timestamp > ago(5m)
| where resultCode startswith "5"
| summarize errorCount = count() by bin(timestamp, 1m)
| where errorCount > 10

// Alert 2: AI API 타임아웃 빈발
customEvents
| where name == "ai_call_failed"
| where timestamp > ago(1h)
| summarize failCount = count() by tostring(customDimensions.pipeline)
| where failCount > 5

// Alert 3: WebSocket 끊김 다수 (Realtime 장애 의심)
customEvents
| where name == "realtime_disconnect"
| where timestamp > ago(10m)
| summarize disconnectCount = dcount(tostring(customDimensions.participant_id))
| where disconnectCount > 5
```

**Alert → Action Group 매핑**:

| Alert | 심각도 | Action Group | 알림 대상 |
|-------|--------|-------------|----------|
| Http5xx Spike | SEV1 | `Workshop_Ops_Critical` | Operator 이메일 즉시 |
| Health Check Fail | SEV1 | `Workshop_Ops_Critical` | Operator 이메일 즉시 |
| Response Time p95 > 2s | SEV3 | `Workshop_Ops_Warning` | 일일 다이제스트 이메일 |
| AI Timeout > 5/hr | SEV2 | `Workshop_Ops_Critical` | Operator 이메일 1시간 내 |
| Realtime Disconnect > 5 | SEV2 | `Workshop_Ops_Critical` | Operator 이메일 1시간 내 |

**알림 채널**: MVP에서는 Operator 이메일로 전송. Post-MVP: Slack #workshop-alerts 채널 Webhook 연동.

### 장애 심각도 분류 (Incident Severity)

| 등급 | 정의 | 예시 | 대응 시간 | 에스컬레이션 |
|------|------|------|----------|--------------|
| **SEV1 — 서비스 중단** | 전체 사용자 접근 불가 | App Service 다운, DB 연결 실패, Health Check 실패 | **15분 이내 대응 시작** | Operator → Developer 즉시 통보 |
| **SEV2 — 기능 장애** | 핵심 기능 사용 불가 | AI 호출 전체 실패, Realtime 전체 끊김, 투표 불가 | **1시간 이내** | Operator 로그 확인 → Developer 배정 |
| **SEV3 — 부분 장애** | 비핵심 기능 오류 | 특정 사용자 세션 오류, UI 버그, 단일 API 간헐적 실패 | **다음 업무일** | 버그 티켓 생성 |
| **SEV4 — 미세 경고** | 성능 저하, 로그 경고 | 응답 시간 증가, Rate Limit 근접 | **주간 리뷰** | 모니터링 대시보드 확인 |

**장애 대응 커뮤니케이션**:
- SEV1/SEV2: 워크샵 진행 중이면 퍼실리테이터에게 이메일로 "일시적 서비스 장애" 안내
- 복구 완료 후: 원인/조치/재발 방지를 간략히 기록 (Post-Mortem)

### API 에러 코드 참조

API 응답의 `error.code` 필드 모니터링 기준 (`src/lib/api/response.ts` 정의):

| 에러 코드 | HTTP 상태 | 의미 | 모니터링 주의 |
|-----------|----------|------|-------------|
| `VALIDATION_ERROR` | 400 | 입력 검증 실패 | 빈번 시 클라이언트 버그 |
| `UNAUTHORIZED` | 401 | 인증 실패 | 빈번 시 세션/토큰 만료 점검 |
| `FORBIDDEN` | 403 | 권한 없음 | 빈번 시 권한 설정 오류 점검 |
| `NOT_FOUND` | 404 | 리소스 미존재 | 정상 범위 |
| `CONFLICT` | 409 | 충돌/중복 | 동시 접근 빈도 확인 |
| `PROCESSING` | 409 | AI 이미 처리 중 | is_processing stale lock 의심 |
| `STAGE_LOCKED` | 403 | 단계 쓰기 잠금 | 정상 범위 |
| `STALE_LOCK` | 409 | stale 편집 잠금 | 연결 끊김 복구 확인 |
| `INTERNAL_ERROR` | 500 | 서버 에러 | 즉시 조사 필요 |

### DB 백업 및 복구

**Supabase 관리 백업**:
- Supabase Pro plan: 일일 자동 백업 (7일 보존)
- Point-in-time recovery: Pro plan에서 지원
- 복구 시 Supabase 대시보드에서 특정 시점으로 복원

**수동 백업 (MVP)**:
```bash
# pg_dump로 수동 백업 (Supabase connection string 사용)
pg_dump "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  --format=custom --no-owner \
  -f workshop_backup_$(date +%Y%m%d).dump

# 복원
pg_restore --clean --no-owner \
  -d "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  workshop_backup_YYYYMMDD.dump
```

**백업 검증**: 복원 후 `/api/health` + smoke test 실행

**백업 스케줄**:
- 배포 전: 매번 pg_dump 수동 백업 (rollback 준비)
- 운영: 주 1회 수동 백업 (MVP). Post-MVP: cron job 자동화
- Supabase Pro: 일일 자동 백업 + PITR 활성화 권장

### 복구 목표 (RTO/RPO)

| 지표 | MVP 목표 | Post-MVP 목표 | 설명 |
|------|----------|--------------|------|
| **RTO** (Recovery Time Objective) | **30분** | 10분 | 서비스 중단부터 복구까지 최대 허용 시간 |
| **RPO** (Recovery Point Objective) | **24시간** | 1시간 | 데이터 손실 허용 범위 (마지막 백업 시점까지) |

**복구 절차** (SEV1):
1. 원인 판별: Health Check 실패 → App Service 로그 확인 → DB/Realtime/OpenAI 상태 확인
2. App Service 장애: 이전 Docker 이미지 태그로 롤백 (`az webapp config container set --docker-custom-image-name :previous-tag`)
3. DB 장애: Supabase 대시보드에서 상태 확인. PITR 복원 또는 pg_restore
4. Smoke test 실행 → 정상 확인 후 알림 해제

### 배포 체크리스트

**배포 전 (Pre-Deployment)**:
- [ ] CI 파이프라인 전체 통과 (lint → typecheck → test → build → docker build)
- [ ] pg_dump 수동 백업 완료 (rollback용)
- [ ] 환경 변수 변경 사항 확인 (새 변수 추가 시 App Service Configuration에 반영)
- [ ] DB 마이그레이션 필요 시 `supabase db push` 실행 및 검증
- [ ] Docker 이미지 태그 기록 (현재 운영 태그 + 새 태그)

**배포 후 (Post-Deployment)**:
- [ ] `/api/health` 200 응답 확인
- [ ] Smoke test: 워크샵 목록 조회 → 워크샵 생성 → 초대 코드 발급 → 참석자 접속
- [ ] Realtime 연결 정상 확인 (브라우저 DevTools → Network → WS 탭)
- [ ] Azure Monitor 대시보드에서 5xx 에러 0건 확인 (배포 후 5분)
- [ ] 배포 완료 기록: 이미지 태그, 배포 시각, 변경 요약

### CI/CD 파이프라인

CI 파이프라인은 `.github/workflows/ci.yml`에 정의되어 있다.

**CI 파이프라인 구성 (PR / push to master)**:

```
┌─ lint-typecheck-test-build ─────────────┐
│ 1. checkout                             │
│ 2. setup Node 20                        │
│ 3. npm ci                               │
│ 4. npm run lint                         │
│ 5. npm run typecheck                    │
│ 6. npm run test                         │
│ 7. npm run build                        │
├─────────────────────────────────────────┤
│ 8. docker build -t workshop-agent .     │  ← docker-build job (depends on above)
└─────────────────────────────────────────┘

┌─ secret-audit (parallel) ───────────────┐
│ • client code에서 시크릿 참조 검색       │
│ • NEXT_PUBLIC_ 접두사 오용 검사          │
│ • .env 파일 git tracking 검사           │
└─────────────────────────────────────────┘
```

**배포 파이프라인 (수동 / Post-MVP 자동화)**:
1. CI 통과 확인
2. `docker build -t workshop-agent .`
3. ACR login → tag → push
4. Azure App Service 이미지 업데이트 또는 재시작
5. Smoke test 실행
6. 실패 시 이전 이미지 태그로 롤백

### 로컬 개발 환경 셋업

**사전 요구사항**:
- Node.js 20 LTS (`nvm install 20`)
- npm (yarn/pnpm 사용 금지 — lockfile 통일)
- Docker Desktop (Supabase 로컬 인스턴스 + 빌드 검증에 필요. 앱 실행 자체에는 불필요)
- Azure OpenAI API 키 (로컬에서도 실제 키 필수. mock 미지원)

```bash
# 1. 레포지토리 클론 및 의존성 설치
git clone https://github.com/kooym/workshop-agent.git
cd workshop-agent
npm ci

# 2. 로컬 Supabase 시작 (Docker Desktop 실행 상태여야 함)
npx supabase start
# 터미널에 출력되는 API URL, anon key, service_role key를 복사한다.
# 종료: npx supabase stop

# 3. 환경 변수 설정
cp .env.example .env.local
# .env.local을 열고 아래 값을 입력:
#   NEXT_PUBLIC_SUPABASE_URL      → 2단계 출력의 API URL (기본: http://127.0.0.1:54321)
#   NEXT_PUBLIC_SUPABASE_ANON_KEY → 2단계 출력의 anon key
#   SUPABASE_SERVICE_ROLE_KEY     → 2단계 출력의 service_role key
#   SESSION_SECRET                → openssl rand -base64 32 로 생성
#   AZURE_OPENAI_*                → Azure Portal에서 가져온 실제 값

# 4. DB 스키마 적용 (마이그레이션 파일이 존재할 때)
npx supabase db reset

# 5. 개발 서버 실행
npm run dev
# → http://localhost:3000 접속
# → GET http://localhost:3000/api/health → { data: { status: 'ok' } } 확인

# 6. 코드 검증
npm run lint
npm run typecheck
npm run test
npm run build
```

> **Supabase 로컬 인스턴스 참고**: `npx supabase start`는 Docker 컨테이너로 PostgreSQL, Auth, Realtime, Storage를 로컬에 띄운다. `npx supabase stop`으로 종료하며, `npx supabase db reset`은 로컬 DB를 초기화하고 `supabase/migrations/` 아래 SQL을 재적용한다.

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
