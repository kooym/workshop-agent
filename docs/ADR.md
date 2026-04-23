# Architecture Decision Records

## 철학

MVP 속도 최우선. 외부 의존성 최소화. 10명 규모 워크샵에 최적화된 최소 구현을 선택.

---

### ADR-001: Next.js 15 App Router 선택

**결정**: 프론트엔드 + API 서버를 Next.js 15 (App Router)로 통합 구현한다.

**이유**:
- 프론트엔드와 API Route를 하나의 프로젝트에서 관리하여 배포/운영 복잡도를 줄인다
- App Router의 Server Components로 초기 로딩 성능을 확보한다
- React 생태계의 풍부한 UI 라이브러리를 활용한다 (DnD, 차트 등)
- TypeScript strict mode로 타입 안전성을 보장한다

**트레이드오프**:
- API Route의 성능은 전용 백엔드(Express, FastAPI) 대비 제한적이나, 10명 규모에서는 문제없음
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

### ADR-004: 초대 코드 기반 인증

**결정**: 워크샵 참가자는 6자리 초대 코드 + 이름 입력으로만 접속한다. 별도 회원가입/로그인 없음.

**이유**:
- 워크샵 참석자는 일회성 사용자. 회원가입 마찰을 제거하여 접속 속도를 최대화
- 퍼실리테이터가 코드를 화면에 띄우면 참석자가 바로 입력하여 참여 (30초 이내)
- Supabase Anonymous Auth + 커스텀 세션으로 구현

**트레이드오프**:
- 코드 유출 시 비인가 접속 가능. 단, 워크샵 특성상 오프라인/화상 미팅 중 공유되므로 위험 낮음
- 브라우저 세션 기반이므로 브라우저를 닫으면 재접속 시 새 참가자로 인식됨. MVP에서는 수용.

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

### ADR-007: Vercel 배포

**결정**: 배포는 Vercel을 사용한다.

**이유**:
- Next.js의 공식 호스팅 플랫폼으로 zero-config 배포
- Preview 배포로 변경사항 확인 용이
- Edge Network로 글로벌 응답 속도 최적화
- 무료 티어로 PoC 수준 충분

**트레이드오프**:
- Vercel 종속. 단, Next.js는 다른 플랫폼(AWS, Docker)으로도 배포 가능하여 탈출 비용 낮음
- Serverless 특성상 콜드 스타트 있으나, AI 호출 지연(수초)에 비하면 무시 가능
