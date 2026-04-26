# Architecture Decision Records

## 철학

MVP 속도 최우선. 외부 의존성 최소화. 20명 규모 워크샵에 최적화된 최소 구현을 선택.

---

### ADR-001: Next.js 15 App Router 선택

**결정**: 프론트엔드 + API 서버를 Next.js 15 (App Router)로 통합 구현한다.

**이유**:
- 프론트엔드와 API Route를 하나의 프로젝트에서 관리하여 배포/운영 복잡도를 줄인다
- App Router의 Server Components로 초기 로딩 성능을 확보한다
- React 생태계의 풍부한 UI 라이브러리를 활용한다 (DnD, 차트 등)
- TypeScript strict mode로 타입 안전성을 보장한다

**트레이드오프**:
- API Route의 성능은 전용 백엔드(Express, FastAPI) 대비 제한적이나, 20명 규모에서는 문제없음
- App Router 학습 곡선이 있으나, 팀의 React 경험도를 고려하면 수용 가능

---

### ADR-002: Supabase 선택 (DB + Auth + Realtime)

**결정**: PostgreSQL DB, 인증, 실시간 동기화를 모두 Supabase로 처리한다.

**이유**:
- PostgreSQL + Realtime(CDC) + Auth가 하나의 서비스로 통합되어 인프라 관리 비용 제로
- Realtime은 PostgreSQL CDC(Change Data Capture) 기반으로, DB에 쓰기만 하면 자동으로 구독 클라이언트에 전파
- 별도 WebSocket 서버(Socket.io)를 운영할 필요가 없음
- Supabase Presence로 참석자 온라인 상태도 처리 가능
- 무료 티어로 PoC 수준 충분 (500MB DB, 동시 접속 200 제한)

**트레이드오프**:
- 커서 위치 등 고빈도 데이터(60fps)에는 CDC 기반 Realtime이 부적합하나, 이 프로젝트는 포스트잇 CRUD 수준(저빈도)이므로 충분
- Supabase 장애 시 전체 서비스 영향. 단, PoC 수준에서는 수용 가능
- 별도 Socket.io 도입은 Post-MVP에서 필요 시 검토

**비교 대안**:
| 옵션 | 장점 | 탈락 이유 |
|------|------|----------|
| Firebase | Realtime DB 우수 | PostgreSQL 필요, 관계형 쿼리 약함 |
| PlanetScale + Pusher | 각각 우수 | 2개 서비스 관리 부담, 비용 |
| 자체 PostgreSQL + Socket.io | 유연 | 인프라 운영 부담, MVP 속도 저하 |

---

### ADR-003: Azure OpenAI (GPT-4o) 사용

**결정**: AI 기능(클러스터링, AX 설계, PRD 생성, 종합 보고서)은 Azure OpenAI의 GPT-4o 모델을 사용한다.

**이유**:
- 고객사가 Azure 환경을 사용하고 있어 Azure OpenAI가 조직 정책에 부합
- GPT-4o는 JSON mode(structured output)를 지원하여, 클러스터링 결과를 안정적으로 파싱 가능
- 데이터가 Azure 내에서 처리되어 데이터 주권/보안 요구사항 충족
- 한국어 처리 성능이 검증됨

**트레이드오프**:
- Azure OpenAI는 모델 배포/관리가 필요하여 초기 설정이 OpenAI API 직접 사용보다 복잡
- 비용은 OpenAI 직접 호출과 동일하나, Azure 계정/리소스 그룹 필요

**모델 폴백 전략 (Post-MVP)**:
- MVP에서는 GPT-4o 단일 모델. Azure OpenAI 배포 장애 시 재시도(2회) 후 에러 반환
- Post-MVP: GPT-4o-mini를 폴백 배포로 추가. GPT-4o 429/503 시 자동 폴백. 폴백 시 토큰 가드레일 유지하되 품질 저하 가능성을 Toast로 안내

**finish_reason 처리**:
- `stop`: 정상 완료. JSON 파싱 진행
- `length`: max_tokens 초과로 잘림 → 에러 처리 (CLAUDE.md 규칙). Toast "AI 응답이 잘렸습니다. 다시 시도해주세요"
- `content_filter`: Azure 콘텐츠 필터 차단 → 에러 처리. Toast "입력 내용이 정책에 의해 차단되었습니다. 포스트잇 내용을 확인해주세요". 로그에 워크샵 ID + 필터 카테고리 기록
- `null` 또는 예상 외 값: 에러 처리. 로깅 후 Toast "AI 처리 중 예상치 못한 오류가 발생했습니다"

---

### ADR-004: 이중 인증 모델 (퍼실리테이터 Supabase Auth + 참석자 초대 코드)

**결정**: 퍼실리테이터는 Supabase Auth 이메일/비밀번호로 회원가입·로그인하고, 참석자는 6자리 초대 코드 + 이름 입력으로만 접속한다.

**이유**:
- 퍼실리테이터는 **반복 사용자**로, 워크샵 목록 조회·관리·재접속이 필요. Supabase Auth가 세션·보안·비밀번호 해싱을 제공
- 참석자는 **일회성 사용자**로, 회원가입 마찰을 제거하여 접속 속도를 최대화 (30초 이내 참여)
- 두 역할의 권한 분리가 명확: withFacilitator(서버 Auth JWT 검증) / withAuth(쿠키 또는 Auth 양쪽 검증)
- 퍼실리테이터가 코드를 화면에 띄우면 참석자가 바로 입력하여 참여

**퍼실리테이터 인증 흐름**:
1. `/auth/signup`에서 이메일/비밀번호 회원가입 → Supabase Auth 사용자 생성
2. `/auth/login`에서 로그인 → Supabase Auth JWT 세션 발급 (`@supabase/ssr`로 관리)
3. 로그인 후 `/dashboard`에서 자신의 워크샵 목록 조회
4. 워크샵 생성 시 `workshops.facilitator_id`에 Auth user ID 연결

**참석자 인증 흐름**:
1. 랜딩 페이지에서 초대 코드 + 이름 입력
2. 서버에서 코드 검증 → participants 테이블 INSERT
3. HTTP-only 쿠키에 서명된 세션 저장: `v1:{base64url(workshop_id:participant_id)}.{HMAC-SHA256 서명}` (SESSION_SECRET으로 서명)
4. 브라우저 새로고침 시 쿠키 서명 검증 → 자동 복귀

**트레이드오프**:
- 두 가지 인증 메커니즘 병존으로 미들웨어 복잡도 증가. 그러나 역할별 필요가 명확히 다르므로 정당화됨
- 참석자 코드 유출 시 비인가 접속 가능. 워크샵 특성상 오프라인/화상 미팅 중 공유되므로 위험 낮음

---

### ADR-005: Zustand 상태 관리

**결정**: 클라이언트 상태 관리는 Zustand를 사용한다.

**이유**:
- 보일러플레이트 최소. Redux 대비 코드량 1/3 수준
- Supabase Realtime 이벤트를 스토어에 직접 반영하는 패턴이 깔끔
- DevTools 지원으로 디버깅 용이
- Next.js App Router와 호환 문제 없음

**트레이드오프**:
- 대규모 앱에서는 Redux Toolkit의 구조화가 유리하나, 이 프로젝트 규모에서는 Zustand 충분

---

### ADR-006: Tailwind CSS 스타일링

**결정**: 스타일링은 Tailwind CSS를 사용한다.

**이유**:
- 유틸리티 클래스로 빠른 프로토타이핑. CSS 파일 관리 불필요
- 다크모드 지원이 내장 (`dark:` 접두사)
- 디자인 시스템 토큰을 tailwind.config.ts에서 중앙 관리
- AI 코드 생성 시 일관된 스타일 유지가 용이

**트레이드오프**:
- 클래스명이 길어질 수 있으나, 컴포넌트 추출로 해결

---

### ADR-007: Docker + Azure App Service 배포

**결정**: 배포는 Docker 컨테이너로 패키징하여 Azure Container Registry(ACR) + Azure App Service로 운영한다.

**이유**:
- 고객사 Azure 환경과 일치. 데이터 주권/보안 요구사항 충족
- Docker로 환경 일관성 보장 (로컬 = 스테이징 = 프로덕션)
- Azure App Service는 WebSocket 지원 (Supabase Realtime + Yjs 동기화에 필수)
- 스테이징 슬롯으로 blue-green 배포 가능
- Next.js `output: 'standalone'` 모드로 최소 Docker 이미지 생성

**트레이드오프**:
- Vercel 대비 초기 설정 복잡도 증가 (Dockerfile, CI/CD 파이프라인 필요)
- Preview 배포는 Azure 스테이징 슬롯 또는 별도 App Service로 대체
- 콜드 스타트 없음 (always-on 컬테이너). Serverless 대비 고정 비용 발생하나 소규모 티어로 충분

**비교 대안**:
| 옵션 | 탈락 이유 |
|------|----------|
| Vercel | 고객사 Azure 환경 요구, WebSocket 제약 (Hobby 플랜) |
| Azure Container Apps | 동등한 선택지이나, App Service 경험이 있으므로 App Service 선택 |
| AKS | 20명 규모에는 과장. 운영 복잡도 높음 |

---

### ADR-008: Zod 요청 검증

**결정**: 모든 API Route의 요청 body는 Zod 스키마로 검증한다.

**이유**:
- TypeScript 타입과 런타임 검증을 하나의 스키마로 통합 (DRY)
- `.parse()` 한 줄로 검증 + 타입 추론이 동시에 완료
- AI 응답 JSON 파싱에도 동일한 Zod 스키마 재사용 가능
- Next.js API Route에서 별도 미들웨어 없이 함수 호출로 사용

**트레이드오프**:
- Joi 대비 에러 메시지 커스터마이징이 약간 번거로우나, `.refine()` 으로 해결 가능
- 번들 사이즈 추가 (~13KB gzip). 서버사이드 전용이므로 클라이언트 영향 없음

**비교 대안**:
| 옵션 | 탈락 이유 |
|------|----------|
| Joi | TypeScript 타입 추론 미지원 |
| Yup | Zod 대비 생태계/유지보수 열세 |
| 수동 검증 | 보일러플레이트 과다, 누락 위험 |

---

### ADR-009: 참석자 세션 — 쿠키 기반 직접 관리

**결정**: 참석자(게스트)는 Supabase Auth를 사용하지 않고, HMAC-SHA256 서명된 HTTP-only 쿠키로 세션을 직접 관리한다. 퍼실리테이터는 Supabase Auth JWT를 사용한다 (ADR-004 참조).

**이유**:
- 참석자는 일회성 사용자로, Supabase Auth의 사용자 계정 모델이 과잉
- 쿠키에 `workshop_id` + `participant_id`만 저장하면 충분
- 브라우저 새로고침 시 쿠키가 유지되어 세션 자동 복구 가능
- HttpOnly + Secure + SameSite=Lax로 보안 확보
- 쿠키 값은 `workshop_id` + `participant_id`를 `SESSION_SECRET` 환경 변수로 HMAC-SHA256 서명하여 위변조 방지. `SUPABASE_SERVICE_ROLE_KEY`를 서명 시크릿으로 재사용하지 않음 (단일 책임 원칙)
- 퍼실리테이터 세션은 `@supabase/ssr`가 쿠키 기반으로 관리 (별도 구현 불필요)

**트레이드오프**:
- 참석자 쿠키 기반이므로 동일 브라우저에서 한 워크샵만 참여 가능 (MVP에서 수용)
- 쿠키 만료(기본 24시간) 후 세션 소실. 워크샵 특성상 수 시간 내 종료되므로 충분

**미들웨어 세션 판별 로직**:
```typescript
// withAuth: 두 세션 유형 모두 검증
// 1. Supabase Auth 세션 확인 (퍼실리테이터)
// 2. 없으면 쿠키 세션 확인 (참석자)
// 3. 둘 다 없으면 401

// withFacilitator: Supabase Auth 세션만 검증
// 1. Supabase Auth 세션 확인
// 2. participants 테이블에서 is_facilitator 확인
// 3. 아니면 403
```

---

### ADR-010: Vitest 테스트 프레임워크

**결정**: 테스트 프레임워크는 Vitest를 사용한다.

**이유**:
- Vite 기반으로 Next.js 프로젝트와 호환, 빠른 실행 속도
- Jest 호환 API로 학습 비용 제로
- TypeScript 네이티브 지원 (ts-jest 불필요)
- jsdom/happy-dom 환경으로 React 컴포넌트 테스트 가능
- MSW(Mock Service Worker)와 자연스러운 통합

**트레이드오프**:
- Next.js 공식 추천은 Jest이나, Vitest가 실행 속도와 DX에서 우위
- next/jest 설정을 직접 다뤄야 하나, vitest.config.ts에서 간단히 해결

---

### ADR-011: Optimistic Update 임시 ID

**결정**: Optimistic Update 시 임시 ID는 `crypto.randomUUID()`를 사용한다.

**이유**:
- 브라우저 내장 API로 추가 의존성 없음
- UUID v4 형식으로 DB의 실제 UUID와 동일 포맷 (타입 호환)
- 충돌 확률이 사실상 0

**패턴**:
```
1. 임시 UUID로 UI에 즉시 추가
2. API 호출 → 서버에서 실제 UUID 반환
3. 스토어에서 임시 ID를 실제 ID로 교체
4. Realtime 이벤트는 임시 ID가 아닌 실제 ID로 도착 → 자체 이벤트 무시 로직 필요
```

---

### ADR-012: tldraw 화이트보드 선택

**결정**: 포스트잇 보드(Gather 단계) UI를 tldraw 라이브러리로 구현한다.

**이유**:
- Yjs CRDT 기반 멀티플레이어가 내장되어 20명 동시 협업에 적합
- 프로그래밍 API가 풍부하여 AI 클러스터링 결과를 캔버스에 직접 배치 가능
- 커스텀 shape 정의로 포스트잇 UI를 자유롭게 디자인 가능
- Apache 2.0 라이선스로 상업적 사용 가능
- React 네이티브 통합 (`tldraw` 패키지)

**데이터 동기화 전략 (Option C — 이중 저장)**:
- tldraw 캔버스(Yjs)로 시각적 보드 운영 + `notes` 테이블에 정규화된 데이터 동기화
- tldraw shape.id = notes.id로 매핑
- Yjs 영속화: y-supabase 어댑터로 Supabase에 자동 저장 (별도 Yjs 서버 불필요)

**트레이드오프**:
- tldraw 번들 사이즈 큼 (~500KB gzip). 보드 페이지에서만 로딩되므로 dynamic import로 해결
- tldraw ↔ DB 양방향 동기화 복잡도. 단, MVP에서는 tldraw→DB 단방향이 주력

**비교 대안**:
| 옵션 | 탈락 이유 |
|------|----------|
| Excalidraw | 멀티플레이어 직접 구현 필요 (Excalidraw+는 유료) |
| Miro/FigJam iframe | 외부 SaaS 의존, 커스터마이징 제한 |
| 커스텀 React 보드 | 멀티플레이어/캔버스 직접 구현 부담 큰 |

---

### ADR-013: 프로젝트 → 워크샵 2단계 계층

**결정**: 워크샵을 프로젝트(고객사/사업 단위) 아래에 그룹핑한다.

**이유**:
- 워크샵은 동일 고객사에 대해 여러 차례 반복 진행될 수 있음 (예: 1차, 2차 워크샵)
- 프로젝트 단위로 산출물을 그룹핑하여 기업 단위 관리 효율성 확보
- 대시보드에서 프로젝트별 필터링으로 검색성 향상

**데이터 모델**:
- `projects` 테이블 신설 (id, name, description, facilitator_id)
- `workshops.project_id` FK 추가
- 프로젝트당 활성 워크샵 1개 제한 (MVP)

**트레이드오프**:
- 단순 flat 목록 대비 UI/API 복잡도 증가. 그러나 반복 워크샵 운영에 필수적이므로 정당화됨
- 3단계 계층(고객사 > 시리즈 > 워크샵)은 MVP에서 과장. 2단계로 충분

---

### ADR-014: API Route 중심 권한 검증 + 제한적 RLS

**결정**: 참석자 권한 검증은 Supabase RLS에만 의존하지 않고 Next.js API Route의 `withAuth`/`withFacilitator`에서 최종 수행한다. RLS는 직접 테이블 쓰기를 차단하고 Realtime/Yjs에 필요한 최소 조회 범위만 허용하는 보조 방어선으로 둔다. (RLS SELECT 정책의 구체적 설계는 **ADR-020** 참조)

**이유**:
- 참석자는 Supabase Auth 사용자가 아니라 signed HTTP-only 쿠키 세션을 사용하므로, PostgreSQL RLS가 참석자 identity를 직접 안정적으로 알기 어렵다.
- 모든 쓰기 작업을 API Route로 모으면 stage write lock, facilitator 권한, 참가자 수/투표 수/포스트잇 수 제한을 한 곳에서 일관되게 검증할 수 있다.
- service role key는 서버에서만 사용하므로 RLS를 우회하더라도 API 미들웨어와 Zod 검증을 반드시 통과해야 한다.
- 브라우저는 Realtime/Yjs 구독을 위해 anon key를 사용하지만, anon key로 직접 INSERT/UPDATE/DELETE를 수행하지 않는다.

**트레이드오프**:
- RLS만으로 모든 권한을 표현하는 구조보다 API 계층 테스트가 중요해진다.
- Realtime/Yjs용 최소 SELECT 정책은 워크샵 참여 경계와 충돌하지 않도록 별도 검토가 필요하다.

---

### ADR-015: 프로세스 중심 워크샵 설계 (Context 단계 도입)

**결정**: 초기 5단계(gather→cluster→vote→design→generate)를 8단계(context→gather→cluster→vote→design→generate→report→completed)로 확장한다. 새로운 Context 단계에서 AS-IS 업무 프로세스를 매핑한 후, 각 프로세스 단계별로 pain point를 수집한다.

**이유**:
- AX(Agent Transformation) 도입 워크샵의 핵심은 "현재 업무를 어떻게 Agent가 대체/보조할 수 있는가"이므로, AS-IS 프로세스 없이 pain point만 수집하면 맥락이 끊기고 TO-BE 설계의 품질이 떨어진다.
- 프로세스 단계 → pain point → 클러스터 → TO-BE 설계로 이어지는 트레이서빌리티가 핵심 가치이다.
- 전문 AX 컨설팅 방법론(프로세스 마이닝, AS-IS/TO-BE 분석)과 정합한다.
- Context 단계를 분리하면 퍼실리테이터가 사전에 프로세스를 정의하고, 참석자는 각 단계별로 집중하여 pain point를 작성할 수 있어 워크샵 효율이 높아진다.

**대안 검토**:
- Gather 단계에서 프로세스 매핑과 pain point 수집을 동시에 진행: UI가 복잡해지고 참석자에게 두 가지 활동을 동시에 요구하게 됨
- 프로세스 없이 자유 형식 brainstorming만: 현재 구조와 동일. AX 컨설팅 품질 미달

**트레이드오프**:
- 워크샵 진행 시간 증가 (Context 단계 추가). 그러나 TO-BE 설계 품질 향상으로 정당화
- process_steps 테이블 추가 + notes.process_step_id FK 추가

---

### ADR-016: 이중 산출물 전략 (PRD + AX 종합 보고서)

**결정**: 워크샵 최종 산출물을 PRD(개발팀 대상)와 AX 종합 보고서(경영진/비즈니스 대상) 두 가지로 분리 생성한다. generate 단계에서 PRD를, report 단계에서 종합 보고서를 각각 AI로 생성한다.

**이유**:
- PRD와 경영 보고서는 대상 독자, 목적, 구조가 완전히 다르다. 단일 문서로 양쪽을 만족시키면 어느 쪽에도 적합하지 않은 타협 문서가 된다.
- PRD: 개발팀이 즉시 착수할 수 있는 기능 명세, 기술 요구사항, 수용 기준 중심
- 종합 보고서: 경영진이 AX 도입 의사결정에 필요한 비즈니스 가치, ROI, KPI, 조직 변화, 로드맵 중심
- 별도 단계로 분리하면 퍼실리테이터가 각 문서를 개별적으로 검토/편집할 수 있다.

**대안 검토**:
- 단일 PRD에 비즈니스 섹션 추가: 문서가 비대해지고 독자별 최적화 불가
- 수동 보고서 작성: AI 활용 워크샵의 자동화 가치 감소

**트레이드오프**:
- AI 호출 1회 추가 (report 파이프라인). 비용/시간 증가 미미 (60초 이내)
- ax_reports 테이블 추가. generate→report→completed 2단계 추가로 워크샵 종료까지 1~2분 추가

---

### ADR-017: Design 산출물 jsonb 저장 전략

**결정**: Design 단계의 6개 산출물(tobe_process, agent_specs, kpis, data_requirements, org_requirements + tasks)을 design_artifacts 테이블에 jsonb 컬럼으로 저장한다. tasks만 별도 ax_tasks 테이블에 정규화한다.

**이유**:
- tobe_process, agent_specs, kpis, data_requirements, org_requirements는 모두 AI가 한 번에 생성하는 구조화된 데이터로, 개별 항목에 대한 독립적인 CRUD가 필요하지 않다.
- 5개 산출물을 각각 별도 테이블로 정규화하면 13+ 테이블이 추가되어 스키마 복잡도가 과도해진다.
- jsonb로 저장하면 AI 응답 구조 변경 시 마이그레이션 없이 유연하게 대응 가능하다.
- TypeScript 타입 안전성은 Zod 스키마(`src/lib/ai/schemas.ts`)로 보장한다.
- tasks만 정규화하는 이유: 과제는 PRD 생성의 입력이자 퍼실리테이터가 개별 편집/삭제하는 단위이므로, 행 단위 CRUD가 필수적이다.

**대안 검토**:
- 전체 정규화: 테이블 13+개 추가. MVP 복잡도 과도
- 전체 jsonb (tasks 포함): 과제 개별 편집이 복잡한 jsonb 조작으로 전환됨

**트레이드오프**:
- jsonb 내부 필드에 대한 PostgreSQL 인덱싱/쿼리가 정규화 대비 불편하지만, 이 데이터는 워크샵 단위로만 조회하므로 문제 없음
- 버전 관리를 위해 design_artifacts.version 컬럼 사용. 재실행 시 전체 jsonb를 새 버전으로 INSERT
- PRD(`prds` 테이블)와 종합 보고서(`ax_reports` 테이블)도 동일한 버전 전략 적용: 재생성 시 기존 행을 PATCH하지 않고 version+1로 새 행을 INSERT. 이전 버전은 DB에 보존하되 MVP에서는 최신 버전만 표시

### ADR-018: React Flow 기반 프로세스 그래프 에디터

**결정**: Context 단계의 AS-IS 프로세스 맵핑에 React Flow(@xyflow/react) + elkjs 자동 레이아웃을 사용한다. TO-BE 프로세스는 Mermaid(읽기 전용 다이어그램) + React Flow(편집 가능 뷰) 이중 렌더링을 채택한다.

**이유**:
- 실제 업무 프로세스는 선형 리스트가 아니라 분기(의사결정 게이트웨이), 병렬 처리, 루프 등이 존재하므로 그래프 모델이 필수적이다.
- React Flow는 MIT 라이선스, 네이티브 React 컴포넌트, JSON `{nodes[], edges[]}` 데이터 모델로 AI 파이프라인 입력에 직접 활용 가능하다.
- bpmn-js 대비 장점: 워터마크 불필요, XML 대신 JSON, React 네이티브 통합, 커스텀 노드 자유도
- elkjs는 BPMN 레이아웃(layered, hierarchical)에 적합하고, dagre 대비 유지보수가 활발하다.
- Mermaid는 LLM이 직접 생성 가능한 텍스트 DSL이며, react-markdown 내 인라인 삽입이 가능해 Report 단계에 적합하다.

**BPMN 노드 유형** (커스텀 노드 7종 + Swimlane 1종):
- `task`: 둥근 사각형 (업무 단계)
- `start_event`: 녹색 원 (프로세스 시작)
- `end_event`: 빨간 굵은 원 (프로세스 종료)
- `exclusive_gateway`: 다이아몬드 X (배타 분기)
- `parallel_gateway`: 다이아몬드 + (병렬 분기/합류)
- `intermediate_event`: 이중 원 (타이머, 메시지 등 중간 이벤트)
- `sub_process`: 리사이즈 가능 컨테이너 (서브프로세스 그룹)
- `swimlane`: 수평 레인 컨테이너 (역할/부서별 그룹핑, React Flow parentId 메커니즘 활용)

**데이터 모델**:
- `process_steps` 테이블 확장: node_type, position_x/y, width/height, lane_id 추가
- `process_edges` 테이블 신규: source_node_id, target_node_id, label, edge_type
- `process_lanes` 테이블 신규: name, order_index, color
- Realtime 채널 3종 추가: process_edges, process_lanes, editing_locks

**번들 영향**: @xyflow/react ~57kB(필수) + elkjs ~140kB(lazy) + mermaid ~200kB(lazy) = 필수 57kB + 지연 340kB

**대안 검토**:
- bpmn-js: 워터마크 필수, BPMN XML(AI 비친화적), React 통합 없음, ~500kB
- tldraw 확장: 그래프 시맨틱 없음. 커넥터/게이트웨이를 처음부터 구축 필요. 라이선스 불확실
- Excalidraw: MIT이나 그래프 시맨틱 없음. tldraw와 동일 문제

### ADR-019: Active/Sleep 편집 잠금 패턴

**결정**: 프로세스 그래프처럼 동시 편집이 충돌하는 리소스에 대해 "Active/Sleep" 1인 편집 잠금 패턴을 도입한다. `editing_locks` 테이블로 관리하며, 퍼실리테이터뿐 아니라 참석자(현업)도 편집 참여가 가능하다.

**이유**:
- 포스트잇은 각자 독립 생성하므로 동시 편집 무해. 그러나 프로세스 그래프는 노드/간선이 상호 의존하여 동시 편집 시 충돌·의도치 않은 삭제가 발생한다.
- CRDT(Yjs 등)로 그래프 동시 편집을 지원하면 구현 복잡도가 매우 높고, 노드 연결 관계의 의미적 충돌은 CRDT로도 해결할 수 없다.
- 현업 게스트가 직접 프로세스를 편집할 수 있어야 정확한 AS-IS 매핑이 가능하다 (퍼실리테이터는 업무 흐름을 모를 수 있음).
- 1인 편집 잠금 + 자발적 전환이 최적의 트레이드오프: 구현 간단, UX 명확, 충돌 없음.

**동작 흐름**:
1. Context 단계 진입 → 퍼실리테이터가 기본 Active (자동 잠금 획득)
2. 참석자 "편집 참여" 버튼 클릭 → 1초 카운트다운 후 서버에 잠금 전환 요청
3. 퍼실리테이터 "회수" 버튼 → 즉시 Active 회수 (딜레이 없음)
4. Active 편집자 연결 끊김 → 30초 후 presence 기반 자동 잠금 해제

**적용 리소스**:
- `process_graph`: Context 단계 프로세스 그래프 편집 (MVP)
- `design_artifacts`: Design 단계 TO-BE 편집 (Post-MVP 검토)

**대안 검토**:
- 퍼실리테이터 전용: 현업이 편집 참여 불가. AS-IS 정확도 저하
- CRDT 동시 편집: 그래프 구조에 CRDT 적용은 구현 복잡도 과도. 의미적 충돌 미해결
- 무잠금 last-write-wins: 그래프에서는 한 사람이 간선을 생성하는 동안 다른 사람이 노드를 삭제하면 orphan edge 발생

### ADR-020: Guest Realtime 접근 — RLS USING(TRUE) SELECT 정책

**결정**: 워크샵 데이터 테이블(workshops, participants, notes, clusters, votes 등)의 RLS SELECT 정책을 `USING (TRUE)`로 설정하여, anon key(Guest)도 Realtime CDC를 수신할 수 있도록 한다. `projects` 테이블만 `auth.uid()` 기반 정책을 유지한다.

**이유**:
- Guest(참석자)는 Supabase Auth 세션이 없으므로 `auth.uid() = NULL`이다. 기존 `auth.uid()` 기반 RLS로는 Realtime CDC를 수신할 수 없어 모든 실시간 기능이 작동하지 않는다.
- `USING (TRUE)` SELECT는 읽기만 허용하고, INSERT/UPDATE/DELETE 정책이 없으므로 쓰기는 완전 차단된다.
- 워크샵 데이터(포스트잇, 클러스터, 투표 등)는 민감 개인정보가 아니며, 같은 워크샵 내 참석자 간 공유가 목적이다.
- 투표 결과 등 조건부 가시성 데이터는 API Route에서 `results_visible` 설정으로 이중 필터링한다.
- Realtime 채널 필터에 `workshop_id`를 명시하여 타 워크샵 데이터 구독을 방지한다.

**대안 검토**:
- `auth.uid()` 기반 유지 + Guest 폴링: 실시간성 상실. 워크샵의 핵심 가치(실시간 협업) 훼손
- Guest용 임시 JWT 발급: Supabase Auth에 Guest를 등록해야 하므로 "회원가입 없는 참여" 원칙 위배
- Service Role 채널 프록시: 서버가 모든 Realtime 이벤트를 중계해야 하므로 서버 부하 증가, 구현 복잡

### ADR-021: Yjs CRDT 선택 근거

**결정**: 실시간 화이트보드(Gather 단계) 동기화에 Yjs CRDT를 사용한다. y-supabase 어댑터로 Supabase에 영속화한다.

**이유**:
- tldraw는 Yjs를 공식 지원하며, y-supabase 어댑터로 Supabase Realtime 위에 CRDT 동기화를 구현할 수 있어 별도 서버가 불필요하다.
- Yjs는 오프라인 편집 후 재연결 시 자동 병합을 지원하여, 네트워크 불안정 환경에서도 데이터 손실 없이 동기화된다.
- npm 주간 다운로드 100만+, 활발한 유지보수, MIT 라이선스.

**대안 검토**:
- Automerge: Yjs보다 번들 크기 큼(~200kB vs ~30kB). tldraw 공식 지원 없음
- OT(Operational Transform): 중앙 서버 필요. 서버리스(Supabase) 아키텍처와 비호환
- Supabase Realtime만 사용: CRDT 없이 last-write-wins. 동시 편집 시 데이터 손실 위험

**성능 추정 (MVP 20명 기준)**:
- 20명 동시 편집 × 200 포스트잇 = Yjs 업데이트 ~10-20 msg/sec (포스트잇 이동/편집 기준, 유휴 시 0)
- Supabase Realtime 제한: 무료 티어 200 동시 연결/프로젝트. 20명 × 2-3 채널 ≈ 40-60 연결 → 충분
- Yjs 문서 크기: 200 포스트잇 × ~500byte/shape ≈ ~100KB. y-supabase 증분 동기화로 전송량 최소화
- 초기 로드: notes API + Yjs 문서 동기화 완료까지 ~1-3초 (네트워크 환경 의존)
