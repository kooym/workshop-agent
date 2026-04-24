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

**결정**: AI 기능(클러스터링, 과제 도출, PRD 생성)은 Azure OpenAI의 GPT-4o 모델을 사용한다.

**이유**:
- 고객사가 Azure 환경을 사용하고 있어 Azure OpenAI가 조직 정책에 부합
- GPT-4o는 JSON mode(structured output)를 지원하여, 클러스터링 결과를 안정적으로 파싱 가능
- 데이터가 Azure 내에서 처리되어 데이터 주권/보안 요구사항 충족
- 한국어 처리 성능이 검증됨

**트레이드오프**:
- Azure OpenAI는 모델 배포/관리가 필요하여 초기 설정이 OpenAI API 직접 사용보다 복잡
- 비용은 OpenAI 직접 호출과 동일하나, Azure 계정/리소스 그룹 필요

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
3. HTTP-only 쿠키에 `workshop_id` + `participant_id` 저장
4. 브라우저 새로고침 시 쿠키로 자동 복귀

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

**결정**: 참석자(게스트)는 Supabase Auth를 사용하지 않고, HTTP-only 쿠키로 세션을 직접 관리한다. 퍼실리테이터는 Supabase Auth JWT를 사용한다 (ADR-004 참조).

**이유**:
- 참석자는 일회성 사용자로, Supabase Auth의 사용자 계정 모델이 과잉
- 쿠키에 `workshop_id` + `participant_id`만 저장하면 충분
- 브라우저 새로고침 시 쿠키가 유지되어 세션 자동 복구 가능
- HttpOnly + Secure + SameSite=Lax로 보안 확보
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

**결정**: 참석자 권한 검증은 Supabase RLS에만 의존하지 않고 Next.js API Route의 `withAuth`/`withFacilitator`에서 최종 수행한다. RLS는 직접 테이블 쓰기를 차단하고 Realtime/Yjs에 필요한 최소 조회 범위만 허용하는 보조 방어선으로 둔다.

**이유**:
- 참석자는 Supabase Auth 사용자가 아니라 signed HTTP-only 쿠키 세션을 사용하므로, PostgreSQL RLS가 참석자 identity를 직접 안정적으로 알기 어렵다.
- 모든 쓰기 작업을 API Route로 모으면 stage write lock, facilitator 권한, 참가자 수/투표 수/포스트잇 수 제한을 한 곳에서 일관되게 검증할 수 있다.
- service role key는 서버에서만 사용하므로 RLS를 우회하더라도 API 미들웨어와 Zod 검증을 반드시 통과해야 한다.
- 브라우저는 Realtime/Yjs 구독을 위해 anon key를 사용하지만, anon key로 직접 INSERT/UPDATE/DELETE를 수행하지 않는다.

**트레이드오프**:
- RLS만으로 모든 권한을 표현하는 구조보다 API 계층 테스트가 중요해진다.
- Realtime/Yjs용 최소 SELECT 정책은 워크샵 참여 경계와 충돌하지 않도록 별도 검토가 필요하다.
