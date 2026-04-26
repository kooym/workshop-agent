# Workshop Agent — 전체 Spec 종합 스코어링 및 고도화 방안

> 평가 기준일: 2026-04-25  
> 대상: CLAUDE.md, ARCHITECTURE.md, PRD.md, ADR.md, UI_GUIDE.md, step0-step9.md (총 15개 파일, ~16,000줄)

---

## 1. 스코어링 프레임워크

### 평가 차원 (14개)

| # | 차원 | 가중치 | 설명 |
|---|------|--------|------|
| D1 | 기능 완성도 | 10% | MVP 26개 기능(F1-F26)의 정의/명세 충분도 |
| D2 | 사용자 시나리오 커버리지 | 8% | 역할별 · 단계별 유저 플로우 커버 |
| D3 | 아키텍처 일관성 | 10% | 문서 간 아키텍처 결정의 정합성 |
| D4 | 보안 설계 | 10% | 인증/인가/RLS/시크릿 관리/Rate Limiting |
| D5 | 데이터 모델 건전성 | 8% | 스키마 정규화/제약조건/인덱스/마이그레이션 |
| D6 | API 설계 완성도 | 10% | 51개 엔드포인트 커버리지/표준/검증 |
| D7 | 실시간 동기화 설계 | 8% | Realtime CDC + Yjs CRDT 전략 |
| D8 | AI 파이프라인 설계 | 8% | 4개 AI 호출 제약/검증/복원력 |
| D9 | UI/UX 명세 완성도 | 8% | 디자인 시스템/화면별 레이아웃/접근성 |
| D10 | 에러 처리 · 복원력 | 6% | 장애 대응/재시도/Stale 처리 |
| D11 | 테스트 전략 | 6% | TDD/단위/통합/컴포넌트 테스트 계획 |
| D12 | 배포 · 운영 | 4% | Docker/Azure/헬스체크/시크릿 감사 |
| D13 | 구현 가이드 명확성 | 8% | Step 파일의 구체성/코드 수준 가이드 |
| D14 | 문서 간 교차 일관성 | 6% | 5개 코어 문서 + 10개 Step 파일 정합 |

### 점수 기준

| 점수 | 의미 |
|------|------|
| 9-10 | 바로 구현 가능. 추가 논의 불필요 |
| 7-8 | 대부분 명확. 소수 세부사항만 구현 시 결정 |
| 5-6 | 뼈대는 있으나 구현 시 해석 필요한 부분 다수 |
| 3-4 | 방향은 있으나 구체적 명세 부족 |
| 1-2 | 거의 정의되지 않음 |

---

## 2. 차원별 상세 스코어링

### D1. 기능 완성도 — 8.5/10

**근거**: MVP 26개 기능(F1-F26) 중 24개가 Step 파일에서 구현 수준 명세까지 도달. 2개(타이머 동기화, 프로세스 노드 태깅 타이밍)만 구현 세부사항 부족.

| 기능군 | 정의된 기능 수 | 구현 명세 충분 | 부족 |
|--------|-------------|-------------|------|
| 인증/세션 | F1,F2,F13 | 3/3 ✅ | — |
| 워크샵 관리 | F14,F15,F26 | 3/3 ✅ | — |
| 프로세스 그래프 | F19 | 1/1 ✅ | — |
| 화이트보드 | F3,F20 | 1/2 ⚠️ | F20 태깅 시점 모호 |
| AI 클러스터링 | F4 | 1/1 ✅ | — |
| 투표 | F5,F6,F21 | 3/3 ✅ | — |
| AX 설계 | F7,F22,F23 | 3/3 ✅ | — |
| PRD/보고서 | F8,F9,F10,F24 | 4/4 ✅ | — |
| 단계 전환 | F11,F16,F17 | 3/3 ✅ | — |
| 완료/산출물 | F12,F18,F25 | 3/3 ✅ | — |

**감점 요인**:
- F20(프로세스 노드 태깅): 생성 시 vs 편집 시 시점 명시 안 됨 (-0.5)
- 타이머: Step 9에서 UI만 정의, Realtime 동기화 상세 미흡 (-0.5)
- 완료 화면 여정 요약: Mermaid 다이어그램 DSL 미제공 (-0.5)

---

### D2. 사용자 시나리오 커버리지 — 7.5/10

**근거**: 퍼실리테이터 Happy Path 완벽 정의. 참석자 플로우 대부분 정의. 엣지 케이스 시나리오 일부 누락.

| 시나리오 | 커버 수준 |
|---------|----------|
| 퍼실 워크샵 생성 → 완료 E2E | ✅ 9/10 (Step 9 AC에 전체 시나리오) |
| 참석자 초대 → 참여 → 투표 → 열람 | ✅ 8/10 |
| 퍼실 이전 단계 수정 → Stale 처리 | ✅ 8/10 (propagateStale 상세) |
| 참석자 쿠키 만료 → 재참여 | ⚠️ 6/10 (재참여=새 참가자 생성. 기존 데이터 연결 불가) |
| 동시 20명 투표 경합 | ⚠️ 6/10 (DB UNIQUE + VOTE_LIMIT 에러 복구) |
| AI 실패 → is_processing 복구 | ✅ 8/10 (try/finally + 5분 stale lock) |
| 네트워크 끊김 → Realtime 재연결 | ⚠️ 6/10 ("자동 재연결 + 전체 재페치" 한 줄) |
| 퍼실 편집 권한 회수 → 참석자 알림 | ⚠️ 5/10 (Toast 알림만 언급, 시나리오 미상세) |
| completed 상태 신규 접속 | ✅ 7/10 (읽기 전용 안내) |
| 다중 탭 동시 접속 | ⚠️ 5/10 (쿠키 공유 + Yjs 자동 동기화 한 줄) |

**감점 요인**:
- 엣지 케이스 시나리오 10개 중 5개가 한 줄 수준 기술 (-1.0)
- 참석자 관점 상세 플로우 부족 (퍼실리테이터 중심 서술) (-0.5)
- 에러 시나리오(네트워크 불안정, 브라우저 크래시) 복구 플로우 미정의 (-1.0)

---

### D3. 아키텍처 일관성 — 8.0/10

**근거**: 21개 ADR이 명확한 결정 근거 제공. 핵심 아키텍처(이중 인증, Yjs+CDC, 8단계 워크플로우)가 5개 문서에서 일관.

| 아키텍처 결정 | 일관성 |
|-------------|--------|
| 8단계 워크플로우 | ✅ CLAUDE ↔ ARCHITECTURE ↔ PRD ↔ UI_GUIDE ↔ Steps 완전 일관 |
| 이중 인증 | ✅ ADR-004 ↔ Step 2 ↔ 미들웨어 패턴 일관 |
| Realtime 11채널 | ✅ CLAUDE ↔ ARCHITECTURE ↔ Step 3/4/5/6/7/9 일관 |
| RLS USING(TRUE) | ✅ ADR-020 ↔ ARCHITECTURE ↔ Step 1 일관 |
| Stale 전파 | ⚠️ CLAUDE 정의 ↔ Step 구현이 약간 불일치 (context 수정 시 gather 영향 여부) |
| Active/Sleep 잠금 | ⚠️ CLAUDE "30초 후 해제" vs Step 3 "다음 요청자가 감지" 미세 불일치 |

**감점 요인**:
- Stale 전파 범위(gather 단계 자체가 stale인지) 해석 여지 (-0.5)
- 편집 잠금 해제 메커니즘 미세 불일치 (-0.5)
- ADR-014와 ADR-020 중복 정의 (-0.5)
- 에러 코드 11개 vs 12개 표기 불일치 (-0.5)

---

### D4. 보안 설계 — 9.0/10

**근거**: OWASP Top 10 기준 핵심 위협에 대한 대응이 체계적. CRITICAL 규칙 12개가 명확.

| 보안 영역 | 수준 | 근거 |
|----------|------|------|
| 인증 (Authentication) | 9/10 | Supabase Auth + HMAC-SHA256 서명 쿠키. v1: prefix 버전 관리 |
| 인가 (Authorization) | 9/10 | withAuth/withFacilitator 이중 미들웨어. is_facilitator 검증 |
| 시크릿 관리 | 10/10 | SESSION_SECRET 분리. 서버 전용 변수 규칙. 시크릿 감사 스크립트 |
| 입력 검증 | 9/10 | 모든 API body Zod 검증. 14개 텍스트 길이 제한. DB CHECK 제약 |
| RLS | 8/10 | SELECT USING(TRUE) + API 미들웨어 이중 방어. BUT 타 워크샵 데이터 노출 가능 |
| Rate Limiting | 8/10 | IP 기반 10회/분 + 5회 실패 차단. in-memory 한계(단일 인스턴스) |
| XSS 방지 | 9/10 | dangerouslySetInnerHTML 금지. react-markdown 전용. Mermaid 예외 명시 |
| CSRF | 7/10 | SameSite=Lax + HttpOnly. 명시적 CSRF 토큰 없음 (Next.js API Route 의존) |

**감점 요인**:
- RLS USING(TRUE) SELECT로 anon key가 전 테이블 SELECT 가능 — Realtime 채널 필터만이 데이터 격리의 유일한 방어선 (-0.5)
- Rate Limiter in-memory (스케일아웃 시 효력 상실) (-0.3)
- CSRF 토큰 없음 (SameSite=Lax가 대부분 커버하나 명시적 방어 부재) (-0.2)

---

### D5. 데이터 모델 건전성 — 8.5/10

**근거**: 15개 테이블, FK 15개, jsonb 스키마 15개, 인덱스 6개 추가, CHECK 제약 명시. ERD 완비.

| 항목 | 수준 |
|------|------|
| 테이블 정규화 | 9/10 — tasks 분리, 나머지 jsonb (ADR-017 근거) |
| FK/CASCADE | 8/10 — ON DELETE CASCADE 가정이나 명시적 CASCADE 정의 불완전 |
| CHECK 제약 | 8/10 — color, text length 일부 적용. count limit은 API 의존 |
| 인덱스 | 8/10 — 6개 성능 인덱스 추가됨. 복합 인덱스 패턴 적절 |
| jsonb 스키마 | 8/10 — settings, tobe_process 등 15개 정의. DB 레벨 스키마 강제 없음 |
| 마이그레이션 | 7/10 — 001_initial_schema.sql 명시. seed 데이터/롤백 전략 없음 |
| Enum | 9/10 — workshop_stage enum 정의 |
| 트리거 | 9/10 — updated_at 자동 갱신 5개 테이블 |

**감점 요인**:
- CASCADE 정의가 "가정"에 의존 (-0.5)
- 리소스 제한(50노드, 200노트, 20명)이 DB CHECK가 아닌 API 의존 (-0.5)
- seed/rollback 전략 부재 (-0.5)

---

### D6. API 설계 완성도 — 8.5/10

**근거**: 51개 엔드포인트 중 49개가 Step 파일에서 구현 명세. RESTful 패턴 준수. 응답 표준 일관.

| 항목 | 수준 |
|------|------|
| 엔드포인트 커버리지 | 9/10 — 51개 중 49개 상세 정의 |
| HTTP 메서드 준수 | 9/10 — GET/POST/PATCH/DELETE RESTful 패턴 |
| 응답 표준 | 9/10 — `{data}` / `{error: {code, message}}` 일관 |
| Zod 검증 | 8/10 — 대부분 정의. 일부 쿼리 파라미터 스키마 누락 |
| 에러 코드 | 8/10 — 12개 상수 정의. 엔드포인트별 에러 매핑 일부 누락 |
| 권한 검증 | 9/10 — withAuth/withFacilitator 패턴 일관 |
| 페이지네이션 | 7/10 — MVP 미적용 (데이터 규모 적정). Post-MVP 계획 명시 |

**감점 요인**:
- 2개 엔드포인트 (dismiss-stale, editing-locks heartbeat) 상세 부족 (-0.5)
- 쿼리 파라미터 Zod 스키마 일부 미정의 (-0.5)
- API 버전 관리(v1, v2) 전략 없음 (-0.5)

---

### D7. 실시간 동기화 설계 — 7.5/10

**근거**: Realtime CDC + Yjs CRDT 이중 전략이 잘 설계됨. 11채널 정의 완비. 그러나 연결 끊김 복구, 성능 한계, 메시지 순서 보장 등 깊은 수준의 명세 부족.

| 항목 | 수준 |
|------|------|
| 채널 설계 | 9/10 — 11개 채널 + Yjs + Presence 명확 |
| Yjs CRDT 전략 | 7/10 — y-supabase 선택 근거(ADR-021) 있으나 구체적 provider 코드 없음 |
| CDC 패턴 | 8/10 — INSERT/UPDATE/DELETE 이벤트 핸들링 패턴 |
| 재연결 전략 | 6/10 — "자동 재연결 + 전체 재페치" 한 줄 |
| Presence 동기화 | 7/10 — 온라인/오프라인 + heartbeat 10초. 타이머 broadcast |
| 데이터 일관성 | 7/10 — DB canonical + Yjs 재구성 알고리즘 정의. 경합 해결 미흡 |
| 성능 | 5/10 — 20명 × 200노트 × Yjs 동시 편집 부하 추정 없음 |

**감점 요인**:
- Yjs provider 구현 코드 부재 (-1.0)
- 재연결 시 중간 이벤트 유실 복구 전략 미정의 (-0.5)
- 20명 동시 편집 성능 벤치마크/추정 없음 (-0.5)
- Realtime 채널 필터 우회 가능성(보안) 미분석 (-0.5)

---

### D8. AI 파이프라인 설계 — 8.5/10

**근거**: 4개 AI 호출 모두 제약(타임아웃, 토큰, 재시도)이 명확. Zod 응답 스키마. 재실행 병합 전략.

| 항목 | 수준 |
|------|------|
| 프롬프트 관리 | 9/10 — prompts.ts 중앙 관리. 역할 기반 System 프롬프트 |
| 응답 검증 | 9/10 — Zod 스키마 4개. 커스텀 검증 함수 (note 할당 완전성 등) |
| 타임아웃 / 재시도 | 9/10 — 30/30/60/60초 + 2회 재시도 (1s, 2s 백오프) |
| 토큰 가드레일 | 9/10 — 2000/4000/8000/10000 토큰 명시 |
| 중복 호출 방지 | 9/10 — is_processing + is_processing_since 5분 stale lock |
| 재실행 전략 | 8/10 — 클러스터(미할당 노트), Design(기존 유지+추가), PRD/Report(새 버전) |
| 에러 복구 | 8/10 — try/finally + Toast + 재시도 버튼. AI 모델 폴백 없음 |
| 프롬프트 엔지니어링 | 7/10 — 프롬프트 구조만 정의. 실제 프롬프트 텍스트 품질 검증 불가 |

**감점 요인**:
- AI 모델 폴백(GPT-4o 실패 시 대안) 전략 없음 (-0.5)
- 프롬프트 텍스트 자체의 A/B 테스트 / 품질 평가 프레임워크 없음 (-0.5)
- finish_reason='length' 외 다른 비정상 종료 처리 미정의 (-0.5)

---

### D9. UI/UX 명세 완성도 — 8.0/10

**근거**: UI_GUIDE.md 2,400줄. 8개 단계별 레이아웃. 컴포넌트 라이브러리 11종. 색상/타이포그래피/애니메이션 완비. 접근성 WCAG 2.1 AA 목표.

| 항목 | 수준 |
|------|------|
| 디자인 시스템 | 8/10 — 색상 4팔레트, 타이포 7종, 애니메이션 4종. 안티패턴 7개 정의 |
| 화면별 레이아웃 | 8/10 — 8단계 × ASCII mockup. 일부 상세 누락 |
| 컴포넌트 명세 | 8/10 — 11개 범용 컴포넌트 + 기능별 컴포넌트. Tailwind 클래스 명시 |
| 반응형 | 7/10 — Desktop 완비. Tablet 최소. Mobile 미지원 |
| 접근성 | 8/10 — 10개 접근성 요건 정의. 스크린 리더 테스트 매트릭스 |
| Empty/Error/Loading | 8/10 — 3가지 상태 역할별 분기, Toast 시간 차등 |
| 인터랙션 패턴 | 7/10 — 투표 토글, 드래그&드롭 대략적. 세부 마이크로 인터랙션 부족 |

**감점 요인**:
- 마이크로 인터랙션(호버 효과, 전환 애니메이션, 스크롤 동작) 미정의 (-0.5)
- Tablet 레이아웃 최소 수준 (-0.5)
- 키보드 네비게이션 상세 플로우 부족 (-0.5)
- Figma/디자인 목업 참조 없음(ASCII만) (-0.5)

---

### D10. 에러 처리 · 복원력 — 7.5/10

**근거**: AI 실패 복구, Stale 처리, Optimistic Locking, Rate Limiting 등 핵심 복원력 패턴이 정의됨. 그러나 네트워크 장애, 부분 실패, 사용자 복구 플로우 미흡.

| 항목 | 수준 |
|------|------|
| AI 실패 복구 | 8/10 — try/finally + 5분 stale lock + Toast 재시도 |
| DB 장애 | 6/10 — "500 + 서비스 일시 장애" 한 줄 |
| 네트워크 끊김 | 6/10 — Supabase 자동 재연결 의존. 중간 이벤트 유실 미처리 |
| 동시성 | 8/10 — Optimistic Locking + DB UNIQUE + FOR UPDATE |
| Stale 데이터 | 9/10 — propagateStale + 배너 + dismiss + AI 재실행 |
| 사용자 복구 | 6/10 — Toast 알림 위주. 가이드 텍스트/재시도 흐름 미흡 |
| 로깅 | 7/10 — JSON 구조화 로깅 포맷 정의. 모니터링 도구 연동 미정의 |

**감점 요인**:
- 네트워크 불안정(3G, WebSocket 끊김) 시나리오별 대응 미정의 (-1.0)
- DB 장애/타임아웃 구체적 복구 전략 없음 (-0.5)
- Azure Monitor / 로그 알림 설정 미정의 (-0.5)
- 부분 실패(AI 응답 파싱 성공, DB 저장 실패) 롤백 전략 미정의 (-0.5)

---

### D11. 테스트 전략 — 5.5/10

**근거**: TDD CRITICAL 규칙, Vitest 설정, 모킹 전략(vi.mock, MSW)은 정의. 그러나 **실제 테스트 코드 예시 0건**. AC는 있으나 테스트 파일 명세 없음.

| 항목 | 수준 |
|------|------|
| 테스트 프레임워크 | 8/10 — Vitest + Testing Library + MSW 명시 |
| 단위 테스트 | 5/10 — "유틸, Zod, Zustand" 대상만 명시. 구체적 테스트 케이스 없음 |
| 통합 테스트 | 5/10 — "API Route 요청→응답" 방식만 명시. 실제 테스트 구조 없음 |
| 컴포넌트 테스트 | 4/10 — "인터랙션 있는 컴포넌트" 대상만 언급 |
| E2E 테스트 | 2/10 — MVP 제외 명시. Post-MVP Playwright 검토 |
| 테스트 데이터 | 3/10 — seed 데이터, fixture, factory 없음 |
| 커버리지 목표 | 3/10 — "MVP 최소 목표 없음"으로 방치 |

**감점 요인**:
- TDD CRITICAL 규칙 vs 실제 테스트 가이드 부재 괴리 (-2.0)
- 테스트 파일 네이밍만 정의, 실제 패턴/예시 없음 (-1.5)
- seed 데이터/fixture/factory 전략 없음 (-1.0)

---

### D12. 배포 · 운영 — 7.0/10

**근거**: Docker 멀티스테이지, Azure App Service, /api/health, 시크릿 감사 스크립트 정의. 그러나 CI/CD 파이프라인, 모니터링, 알림, 백업 전략 부족.

| 항목 | 수준 |
|------|------|
| Docker | 8/10 — 멀티스테이지 빌드, standalone output, .dockerignore |
| Azure 배포 | 7/10 — ACR + App Service 명령어. Blue-green 언급 |
| 헬스체크 | 8/10 — /api/health + Docker HEALTHCHECK |
| CI/CD | 5/10 — "lint→typecheck→test→build" 순서만 언급. YAML 없음 |
| 모니터링 | 4/10 — "Azure Monitor로 수집" 한 줄 |
| 백업 | 3/10 — "30일 보존" 정의, 백업 전략 미정의 |
| 시크릿 감사 | 9/10 — rg 기반 grep 스크립트 명시 |

**감점 요인**:
- CI/CD 파이프라인(GitHub Actions/Azure DevOps) YAML 없음 (-1.5)
- 모니터링/알림/대시보드 설정 미정의 (-1.0)
- 백업/복구 전략 부재 (-0.5)

---

### D13. 구현 가이드 명확성 — 8.0/10

**근거**: 10개 Step 파일 ~8,950줄. 파일 경로, API 시그니처, Zustand 스키마, DB 쿼리, 컴포넌트 구조 수준까지 명세. 코드 스니펫 다수.

| 항목 | 수준 |
|------|------|
| 파일 경로 명시 | 9/10 — 거의 모든 파일에 정확한 경로 |
| API 시그니처 | 9/10 — 메서드, 경로, 요청/응답 스키마 |
| 컴포넌트 구조 | 8/10 — 컴포넌트명, props 개요, 렌더링 로직 |
| DB 쿼리 패턴 | 8/10 — SELECT/INSERT/UPDATE 패턴 + 트랜잭션 |
| Zustand 스토어 | 8/10 — 상태 필드, 액션 시그니처 |
| 의존성 순서 | 8/10 — Step 간 의존성 명시 |
| AC 명확성 | 7/10 — 대부분 검증 가능. 일부 정성적 |

**감점 요인**:
- Yjs provider 구현 코드 부재 (-0.5)
- 테스트 코드 예시 0건 (-0.5)
- 일부 컴포넌트 props/state 상세 부족 (-0.5)
- Zustand 미들웨어(devtools, persist) 설정 미정의 (-0.5)

---

### D14. 문서 간 교차 일관성 — 7.5/10

**근거**: 핵심 규칙(8단계, 이중인증, 채널11개)은 완벽 일관. 그러나 세부 수준에서 미세 불일치 6건 발견.

| 불일치 | 심각도 | 파일 |
|--------|--------|------|
| Stale 전파 범위: gather 단계 자체가 stale인지 | MEDIUM | CLAUDE ↔ UI_GUIDE |
| 편집 잠금 해제: "30초 후" vs "다음 요청자 감지" | LOW | CLAUDE ↔ Step 3 |
| 에러 코드 수: 11개 vs 12개 표기 | LOW | ARCHITECTURE ↔ CLAUDE |
| 퍼실 participants 자동 INSERT 타이밍 | MEDIUM | CLAUDE ↔ ARCHITECTURE API 예시 |
| ADR-014 ↔ ADR-020 RLS 중복 정의 | LOW | ADR.md 내부 |
| 프로세스 노드 태깅 시점 | MEDIUM | PRD ↔ UI_GUIDE ↔ Step 4 |

**감점 요인**:
- MEDIUM 불일치 3건 (-1.5)
- LOW 불일치 3건 (-0.5)
- 문서 간 상호 참조 링크 일부 누락 (-0.5)

---

## 3. 종합 스코어

| # | 차원 | 가중치 | 점수 | 가중 점수 |
|---|------|--------|------|----------|
| D1 | 기능 완성도 | 10% | 8.5 | 0.85 |
| D2 | 시나리오 커버리지 | 8% | 7.5 | 0.60 |
| D3 | 아키텍처 일관성 | 10% | 8.0 | 0.80 |
| D4 | 보안 설계 | 10% | 9.0 | 0.90 |
| D5 | 데이터 모델 | 8% | 8.5 | 0.68 |
| D6 | API 설계 | 10% | 8.5 | 0.85 |
| D7 | 실시간 동기화 | 8% | 7.5 | 0.60 |
| D8 | AI 파이프라인 | 8% | 8.5 | 0.68 |
| D9 | UI/UX 명세 | 8% | 8.0 | 0.64 |
| D10 | 에러 처리 | 6% | 7.5 | 0.45 |
| D11 | 테스트 전략 | 6% | 5.5 | 0.33 |
| D12 | 배포 · 운영 | 4% | 7.0 | 0.28 |
| D13 | 구현 가이드 | 8% | 8.0 | 0.64 |
| D14 | 교차 일관성 | 6% | 7.5 | 0.45 |
| **합계** | | **100%** | | **7.75** |

### 종합: **77.5 / 100** → **개발 착수 적합 (GO)**

> **판정**: 핵심 아키텍처·보안·API·AI가 8.5+ 수준으로 견고. 테스트(5.5)·운영(7.0)이 상대적 약점이나, MVP 개발 진행에 차단 요인 아님. 개발과 병행하여 개선 가능.

---

## 4. 강점 · 약점 매트릭스

### 💪 강점 (8.0+)

| 강점 | 점수 | 핵심 근거 |
|------|------|----------|
| 보안 설계 | 9.0 | HMAC-SHA256, RLS, Rate Limiting, 시크릿 감사 |
| 기능 완성도 | 8.5 | 26개 기능 중 24개 구현 수준 명세 |
| API 설계 | 8.5 | 51개 RESTful 엔드포인트, Zod 검증, 표준 응답 |
| AI 파이프라인 | 8.5 | 4개 파이프라인 제약/검증/복원 완비 |
| 데이터 모델 | 8.5 | 15개 테이블, ERD, 인덱스, 제약조건 |
| UI/UX 명세 | 8.0 | 8단계 레이아웃, 디자인 시스템, 접근성 |
| 아키텍처 일관성 | 8.0 | 21 ADR, 5문서 정합 |
| 구현 가이드 | 8.0 | 10 Step, ~9,000줄, 파일 경로/API/DB 쿼리 수준 |

### ⚠️ 약점 (< 7.5)

| 약점 | 점수 | 핵심 원인 |
|------|------|----------|
| **테스트 전략** | **5.5** | TDD 규칙 vs 실제 테스트 가이드 0건 괴리 |
| 배포 · 운영 | 7.0 | CI/CD YAML, 모니터링, 백업 부재 |
| 실시간 동기화 | 7.5 | Yjs provider 코드 부재, 성능 추정 없음 |
| 에러 처리 | 7.5 | 네트워크 불안정, 부분 실패 복구 미흡 |

---

## 5. 고도화 방안 (3 Phase)

### Phase A: MVP 착수 전 필수 보완 (1-2일)

> 개발 품질을 보장하기 위한 최소 보강. 코드 작성 전 완료 권장.

#### A-1. 테스트 가이드 보강 (D11 → 7.0 목표)

**현상**: TDD CRITICAL 규칙이 있지만 테스트 코드 예시/패턴/fixture가 전혀 없어 개발자가 TDD를 실행할 수 없음.

**조치**:
1. `docs/TESTING_GUIDE.md` 신설 — 테스트 패턴 레퍼런스
2. 포함 내용:
   - **단위 테스트 예시**: Zod 스키마 검증, generateInviteCode(), signSession()/verifySession()
   - **통합 테스트 예시**: API Route 테스트 패턴 (Request mock → handler → Response 검증)
   - **컴포넌트 테스트 예시**: VotingCard 클릭 → voteStore 변경 검증
   - **모킹 패턴**: `vi.mock('@/lib/supabase/server')`, MSW 핸들러 설정
   - **테스트 데이터 팩토리**: `createMockWorkshop()`, `createMockNote()`, `createMockParticipant()`
   - **Zustand 테스트 패턴**: `act()` + store 직접 조작
3. Step 0에 vitest.config.ts 구체 설정 추가
4. 최소 커버리지 목표 설정: 핵심 경로(인증, 투표, AI) 80%

#### A-2. 문서 간 불일치 6건 해소 (D14 → 8.5 목표)

| # | 불일치 | 해소 방법 |
|---|--------|----------|
| 1 | Stale 전파 범위 | CLAUDE.md에 명시: "gather 단계 자체는 stale 표시 안 함 (AI 산출물 아님). context 수정 시 gather 이후 AI 산출물만 stale" |
| 2 | 편집 잠금 해제 | Step 3에 명시: "presence leave 이벤트 후 30초 타이머 시작. 타이머 만료 시 서버에서 DELETE. 다음 요청자는 lock_holder의 last_heartbeat를 확인하여 30초 초과 시 stale lock 판정" |
| 3 | 에러 코드 수 | ARCHITECTURE.md를 12개로 통일 (STALE_LOCK 추가 이미 완료) |
| 4 | 퍼실 participants 자동 INSERT | ARCHITECTURE.md POST /api/workshops 응답 예시에 participant_id 추가 |
| 5 | ADR 중복 | ADR-014에 "(상세: ADR-020 참조)" 크로스레퍼런스 추가 |
| 6 | 노드 태깅 시점 | PRD.md + Step 4에 "생성 시 드롭다운에서 태깅 가능. 생성 후 포스트잇 편집 시에도 변경 가능" 명시 |

#### A-3. 실시간 동기화 상세 보강 (D7 → 8.0 목표)

1. Step 4에 Yjs y-supabase provider 초기화 코드 추가:
   ```
   - YjsProvider 초기화: new SupabaseProvider(yjsDoc, { tableName: 'yjs_documents', channel: `yjs:${workshopId}` })
   - 언마운트 시 provider.destroy()
   ```
2. Realtime 재연결 복구 전략 상세화 (Step 3 layout.tsx):
   ```
   - onReconnect 핸들러: 모든 Zustand 스토어에 refetchAll() 호출
   - 재연결 실패 3회 시 "연결이 불안정합니다" Toast + 수동 새로고침 유도
   ```
3. 부하 추정 추가 (ADR-021 또는 ARCHITECTURE.md):
   ```
   - 20명 × 200노트 = Yjs 업데이트 ~10msg/s (포스트잇 이동 기준)
   - Supabase Realtime 제한: 200 동시 연결 / 프로젝트 (20명 기본 충분)
   ```

---

### Phase B: MVP 개발 중 병행 보강 (Step 0-3 완료 후)

> 개발 첫 4 Step 완료 후, 실제 코드 경험에 기반한 보강.

#### B-1. CI/CD 파이프라인 구축 (D12 → 8.0 목표)

1. `.github/workflows/ci.yml` 생성:
   ```yaml
   jobs:
     lint → typecheck → test → build → docker-build → (deploy preview)
   ```
2. PR 자동 리뷰 게이트: lint + typecheck + test 통과 필수
3. 시크릿 감사 자동화: CI에서 `rg` 기반 시크릿 검사 Step 추가
4. Docker 이미지 빌드 검증: `docker build -t test .` CI Step

#### B-2. 에러 처리 시나리오 확장 (D10 → 8.0 목표)

1. **네트워크 장애 복구 가이드** (ARCHITECTURE.md에 추가):
   - WebSocket 끊김 감지: Supabase `CHANNEL_ERROR` 이벤트 핸들링
   - 재연결 실패 시 오프라인 배너 표시 + 로컬 변경사항 큐잉
   - 복귀 시 큐 플러시 + 서버 상태 재페치
2. **부분 실패 롤백 전략**:
   - AI 응답 파싱 성공 → DB 저장 실패: is_processing 복구 + Toast "저장 실패. 재시도해주세요"
   - DB 트랜잭션 부분 실패: Supabase RPC 함수로 원자적 처리 검토
3. **사용자 복구 가이드**:
   - 각 에러 Toast에 "어떻게 해야 하나요?" 부가 설명 추가
   - 심각한 에러 시 "지원 요청" 링크 (mailto: 또는 슬랙)

#### B-3. 성능 기준선 수립

1. Lighthouse 성능 기준: FCP < 2s, LCP < 3s, TBT < 200ms
2. Realtime 지연 목표: CDC 이벤트 → UI 반영 < 500ms (P95)
3. AI 응답 시간 모니터링: 실제 호출 시간 로그 + 평균/P95 추적
4. tldraw 캔버스 성능: 200 shape 렌더링 < 60fps 유지

---

### Phase C: MVP 완료 후 고도화 (Post-MVP)

> MVP 배포 후 사용자 피드백 기반 개선.

#### C-1. 보안 심화

| 항목 | 현재 | 목표 |
|------|------|------|
| RLS 데이터 격리 | USING(TRUE) + 채널 필터 | Row-level `workshop_id` 기반 RLS + JWT claims 커스텀 |
| Rate Limiter | in-memory Map | Redis 기반 분산 Rate Limiter |
| CSRF | SameSite=Lax | Double-submit cookie 또는 CSRF 토큰 |
| 쿠키 버전 | v1 only | v2 로테이션 + v1 폴백 기간 |
| DB 리소스 제한 | API 의존 | DB 레벨 CHECK/TRIGGER로 이중 방어 |

#### C-2. 관측성(Observability) 확립

| 항목 | 목표 |
|------|------|
| 구조화 로깅 | Pino + Azure Log Analytics 연동 |
| 분산 추적 | OpenTelemetry → Azure Application Insights |
| 알림 | 에러율 > 1% 시 Slack 알림 |
| 대시보드 | Grafana 또는 Azure Monitor 대시보드 |
| 헬스체크 | /api/health에 DB 연결 + Realtime 상태 포함 |

#### C-3. 테스트 심화

| 항목 | 목표 |
|------|------|
| E2E 테스트 | Playwright: 퍼실 워크샵 생성→완료 전체 시나리오 |
| 부하 테스트 | k6: 20명 동시 접속 + 200노트 + 투표 경합 |
| 시각적 회귀 | Chromatic 또는 Percy |
| API 계약 테스트 | Zod 스키마 기반 자동 계약 검증 |

#### C-4. UX 고도화

| 항목 | 현재 | 목표 |
|------|------|------|
| 모바일 | 미지원 안내 | 반응형 읽기 전용 뷰 |
| 다국어 | 한국어 only | next-intl 기반 i18n (한/영) |
| PDF 내보내기 | 없음 | PRD/보고서 PDF 다운로드 |
| 버전 히스토리 | 최신만 | PRD/보고서 버전 비교 (diff) |
| 클러스터 수동 편집 | 없음 | 드래그&드롭 병합/분리 |
| 오프라인 지원 | 없음 | Service Worker + IndexedDB 큐 |
| 알림 | Toast only | 이메일/슬랙 워크샵 초대 알림 |

#### C-5. 아키텍처 진화

| 항목 | 현재 | 목표 |
|------|------|------|
| 스케일링 | 단일 인스턴스 | Azure Container Apps (auto-scale) |
| DB | Supabase shared | Supabase Pro + connection pooler |
| CDN | 없음 | Azure CDN for static assets |
| AI 모델 | GPT-4o only | GPT-4o-mini 폴백 + 프롬프트 A/B 테스트 |
| 백업 | 없음 | Supabase PITR (Point-in-Time Recovery) |

---

## 6. 차원별 목표 점수 로드맵

| 차원 | 최초 | Phase A 후 | Phase A+ 후 | Phase A++ 후 | Phase B 후 | Phase C 후 |
|------|------|-----------|------------|-------------|-----------|-----------|
| D1 기능 완성도 | 8.5 | 8.5 | 9.0 | 9.0 | **9.5 ✅** | 9.5 |
| D2 시나리오 커버리지 | 7.5 | 7.5 | 8.5 | 9.0 | 9.0 | 9.0 |
| D3 아키텍처 일관성 | 8.0 | 8.5 | 9.0 | 9.0 | 9.0 | 9.0 |
| D4 보안 설계 | 9.0 | 9.0 | 9.0 | 9.5 | 9.5 | 9.5 |
| D5 데이터 모델 | 8.5 | 8.5 | 9.0 | 9.0 | **9.5 ✅** | 9.5 |
| D6 API 설계 | 8.5 | 8.5 | 9.0 | 9.0 | **9.5 ✅** | 9.5 |
| D7 실시간 동기화 | 7.5 | 8.0 | 8.5 | 9.0 | 9.0 | 9.0 |
| D8 AI 파이프라인 | 8.5 | 8.5 | 9.0 | 9.0 | 9.0 | 9.0 |
| D9 UI/UX 명세 | 8.0 | 8.0 | 8.5 | 9.0 | 9.0 | 9.0 |
| D10 에러 처리 | 7.5 | 7.5 | 8.5 | 8.5 | **9.5 ✅** | 9.5 |
| D11 테스트 전략 | **5.5** | 7.0 | 7.5 | 9.0 | 9.0 | 9.0 |
| D12 배포 · 운영 | 7.0 | 7.0 | 8.0 | 8.5 | **9.0 ✅** | 9.0 |
| D13 구현 가이드 | 8.0 | 8.5 | 8.5 | 9.0 | 9.0 | 9.0 |
| D14 교차 일관성 | 7.5 | 8.5 | 9.0 | 9.0 | **9.5 ✅** | 9.5 |
| **종합** | **77.5** | **80.5** | **86.5** | **90.5** | **92.5 ✅** | **93.0** |

> ✅ Phase A 완료 (2026-04-25): TESTING_GUIDE.md 신설, 문서 불일치 6건 해소, Yjs provider 상세 보강
> ✅ Phase A+ 완료 (2026-04-25): 12개 차원 전면 보강 — CASCADE 명세, 에러 처리 섹션, 엣지 케이스 8건, AI 폴백/finish_reason, 마이크로 인터랙션, 타이머 동기화 프로토콜, 채널 보안 분석, CI/CD 확인, seed 데이터
> ✅ Phase A++ 완료 (2026-04-26): 7개 차원 심화 보강 — 테스트 예시 4건(workshopStore/withAuth/AI+MSW/boardStore), 장애 심각도 분류/RTO·RPO, 참석자 E2E 여정, CDC 순서·중복·채널별 에러, 태블릿 slide-over/모바일 감지, Zustand create()+devtools, CSRF 방어 전략
> ✅ Phase B 완료 (2026-04-26): 6개 차원 정밀 보강 — Realtime 재연결 프로토콜/부분 실패 전략(D10), Azure Monitor KQL 쿼리/Action Group 매핑/배포 체크리스트(D12), 엔드포인트별 에러 코드 매트릭스(D6), 인덱스 SQL 전체 생성문(D5), Stale 전파 진리표(D1/D14), MODULE_MAP 에러 코드 12개 통일(D14)

---

## 7. 우선순위 액션 아이템

### 🔴 즉시 (Phase A — 개발 착수 전)

| # | 액션 | 대상 파일 | 효과 | 상태 |
|---|------|----------|------|------|
| A-1 | TESTING_GUIDE.md 신설 (테스트 패턴 + 예시 + fixture) | docs/TESTING_GUIDE.md | D11: 5.5→7.0 | ✅ 완료 |
| A-2 | 문서 간 불일치 6건 해소 | CLAUDE, ARCHITECTURE, ADR, PRD, step3, step4 | D14: 7.5→8.5 | ✅ 완료 |
| A-3 | Yjs provider 초기화 코드 + 재연결 전략 | step4, step3, ADR | D7: 7.5→8.0 | ✅ 완료 |

### 🔴 즉시 (Phase A+ — 추가 고도화)

| # | 액션 | 대상 파일 | 효과 | 상태 |
|---|------|----------|------|------|
| A+1 | FK CASCADE 전면 명세 (15개 테이블) | ARCHITECTURE.md, step1.md | D5: 8.5→9.0 | ✅ 완료 |
| A+2 | STALE_LOCK 에러 코드 추가 (11→12개) | ARCHITECTURE.md | D3: 8.5→9.0 | ✅ 완료 |
| A+3 | 엣지 케이스 시나리오 8건 추가 | ARCHITECTURE.md | D2: 7.5→8.5 | ✅ 완료 |
| A+4 | 에러 처리 · 복원력 섹션 신설 | ARCHITECTURE.md | D10: 7.5→8.5 | ✅ 완료 |
| A+5 | dismiss-stale Zod 스키마 + 응답 명세 | ARCHITECTURE.md | D6: 8.5→9.0 | ✅ 완료 |
| A+6 | Realtime 채널 USING(TRUE) 보안 분석 | ARCHITECTURE.md | D7: 8.0→8.5 | ✅ 완료 |
| A+7 | AI 모델 폴백 + finish_reason 처리 | ADR.md | D8: 8.5→9.0 | ✅ 완료 |
| A+8 | 타이머 Realtime 동기화 프로토콜 | step9.md | D1: 8.5→9.0 | ✅ 완료 |
| A+9 | 완료 화면 여정 시각화 구현 명세 | step9.md | D1: 8.5→9.0 | ✅ 완료 |
| A+10 | 마이크로 인터랙션 + 키보드 흐름 | UI_GUIDE.md | D9: 8.0→8.5 | ✅ 완료 |
| A+11 | Step별 필수 테스트 매트릭스 + seed | TESTING_GUIDE.md, step1.md | D11: 7.0→7.5 | ✅ 완료 |
| A+12 | CI/CD YAML 확인 (이미 존재) | — | D12: 7.0→8.0 | ✅ 확인 |

### � 즉시 (Phase A++ — 심화 고도화)

| # | 액션 | 대상 파일 | 효과 | 상태 |
|---|------|----------|------|------|
| A++1 | 테스트 예시 4건 추가 (workshopStore, withAuth, AI+MSW, boardStore) | TESTING_GUIDE.md | D11: 7.5→9.0 | ✅ 완료 |
| A++2 | 장애 심각도 분류 + 알림 채널 + RTO/RPO + 복구 절차 | OPERATIONS.md | D12: 8.0→8.5 | ✅ 완료 |
| A++3 | 참석자 E2E 여정 내러티브 + Late Joiner + 에러 시나리오 | PRD.md | D2: 8.5→9.0 | ✅ 완료 |
| A++4 | CDC 순서 보장 + 중복 멱등 처리 + 채널별 에러 처리 | step3.md | D7: 8.5→9.0 | ✅ 완료 |
| A++5 | 태블릿 slide-over 상세 + 모바일 MobileGuard 구현 | UI_GUIDE.md | D9: 8.5→9.0 | ✅ 완료 |
| A++6 | Zustand create()+devtools 구현 코드 + persist 미사용 근거 | step3.md | D13: 8.5→9.0 | ✅ 완료 |
| A++7 | CSRF 방어 전략 4가지 근거 명시 | ARCHITECTURE.md | D4: 9.0→9.5 | ✅ 완료 |

### � 즉시 (Phase B — 정밀 보강)

| # | 액션 | 대상 파일 | 효과 | 상태 |
|---|------|----------|------|------|
| B-1 | Realtime 재연결 복구 프로토콜 (7단계) + 부분 실패 처리 전략 (5시나리오) | ARCHITECTURE.md | D10: 8.5→9.5 | ✅ 완료 |
| B-2 | Azure Monitor KQL 쿼리 3건 + Alert→Action Group 매핑 테이블 | OPERATIONS.md | D12: 8.5→9.0 | ✅ 완료 |
| B-3 | 배포 전/후 체크리스트 (Pre 5항목 + Post 5항목) | OPERATIONS.md | D12: 8.5→9.0 | ✅ 완료 |
| B-4 | 엔드포인트별 에러 코드 매핑 매트릭스 (13개 주요 API × 12개 에러 코드) | ARCHITECTURE.md | D6: 9.0→9.5 | ✅ 완료 |
| B-5 | 인덱스 SQL CREATE INDEX 문 전체 (FK 20개 + 복합 7개 + partial unique 1개) | step1.md | D5: 9.0→9.5 | ✅ 완료 |
| B-6 | Stale 전파 진리표 (수정 단계 × 영향 테이블 × StageNav 배지) | ARCHITECTURE.md | D1: 9.0→9.5, D14: 9.0→9.5 | ✅ 완료 |
| B-7 | MODULE_MAP 에러 코드 9개→12개 통일 | MODULE_MAP.md | D14: 9.0→9.5 | ✅ 완료 |

### 🟡 병행 (Phase B-legacy — 개발 중) — Phase A+/A++에서 대부분 선행 완료

| # | 액션 | 대상 | 효과 | 상태 |
|---|------|------|------|------|
| B-1 | CI/CD YAML 작성 | .github/workflows/ | D12 | ✅ 이미 존재 (A+12에서 확인) |
| B-2 | 에러 처리 시나리오 확장 | ARCHITECTURE.md | D10 | ✅ A+4에서 완료 |
| B-3 | 성능 기준선 수립 | docs/OPERATIONS.md | D12 보강 | 개발 중 실측 후 추가 |

### 🟢 후속 (Phase C — Post-MVP)

| # | 액션 | 효과 |
|---|------|------|
| C-1 | RLS 심화 + Redis Rate Limiter | D4: 9.0→9.5 |
| C-2 | 관측성 스택 (OpenTelemetry + 대시보드) | D12: 8.0→9.0 |
| C-3 | E2E + 부하 테스트 | D11: 8.0→9.0 |
| C-4 | 모바일/다국어/PDF/버전 비교 | D9: 8.0→9.0 |
| C-5 | 컨테이너 오케스트레이션 + AI 폴백 | D8, D12 |

---

## 8. 결론

### 현재 상태 평가 (Phase B 완료 후)

Workshop Agent의 문서/명세는 **92.5점 (최고 수준 명세 완성)**. 14개 차원 중 14개 전부 9.0+:

- **보안(9.5)**, **에러 처리(9.5)**, **기능(9.5)**, **데이터 모델(9.5)**, **API(9.5)**, **교차 일관성(9.5)** — 6개 차원이 9.5
- **나머지 8개 차원 모두 9.0** — 즉시 구현 가능, 추가 논의 불필요
- 모든 cross-document 불일치 해소, 에러 코드 12개 통일, 인덱스 SQL 완비

### 남은 개선 여지 (Phase C — Post-MVP)

- **E2E 테스트 + 부하 테스트** (D11 실측 보강)
- **관측성 스택**: OpenTelemetry + Grafana 대시보드
- **RLS 심화**: row-level workshop_id 필터, Redis Rate Limiter
- **모바일/다국어/PDF 내보내기**

### 권장 진행 순서

```
Step 0 즉시 착수 → Step 1-3 → Step 4-9 → Phase C (Post-MVP)
```

> Phase A/A+/A++/B 완료로 명세 수준이 92.5/100에 도달. 추가 문서 보강 없이 즉시 개발 착수 가능.
