# Step 8: output-generation

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — AI 파이프라인 (PRD 생성, AX 종합 보고서 생성), prds/ax_reports API
- `/docs/ADR.md` — ADR-016 (이중 산출물 전략)
- `/docs/PRD.md` — Stage 6: PRD 생성 (Generate), Stage 7: AX 종합 보고서 (Report) 전체 기능
- `/docs/UI_GUIDE.md` — PRD 화면, 보고서 화면, 에디터/프리뷰 디자인 패턴
- `/docs/MODULE_MAP.md`
- `/docs/modules/05-ai-pipeline.md`
- `/docs/modules/07-tasks-prd-artifacts.md`
- `/docs/modules/08-ui-experience-system.md`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라:

- `/src/lib/ai/openai.ts`
- `/src/lib/ai/prompts.ts`
- `/src/lib/ai/schemas.ts`
- `/src/app/api/ai/design/route.ts` — AI 호출 패턴 참조
- `/src/types/prd.ts`
- `/src/types/task.ts`
- `/src/types/design-artifact.ts`
- `/src/types/ax-report.ts`
- `/src/lib/api/middleware.ts`
- `/src/lib/api/validators.ts`

## 작업

확정된 AX 과제와 Agent 설계를 기반으로 PRD를 자동 생성하고, 이어서 워크샵 전체 데이터를 종합한 AX 종합 보고서를 생성하는 기능을 구현하라. Stage 6(PRD 생성)과 Stage 7(종합 보고서)의 핵심 기능이다.

이 step은 새 AI/API/UI 기능이므로 테스트를 먼저 작성한다. PRD 생성 성공, 보고서 생성 성공, 빈 과제, 빈 content, version 증가, stage lock, `dangerouslySetInnerHTML` 미사용을 구현 전에 테스트로 고정하라.

### 1. PRD 생성 프롬프트

`src/lib/ai/prompts.ts`에 추가:

```typescript
export function buildPrdPrompt(input: {
  workshop_title: string
  tasks: AxTask[]
  design_artifacts: DesignArtifact
  clusters: Cluster[]
  vote_results: VoteResult[]
}): { system: string, user: string }
```

- System 프롬프트: "당신은 시니어 프로덕트 매니저입니다. 워크샵에서 도출된 AX 과제와 Agent 설계를 기반으로 개발 착수용 PRD를 작성하세요."
- 모든 AI 호출은 JSON mode를 사용해야 하므로 출력은 `{ "content": "<Markdown 본문>" }` 형태의 JSON으로 지시한다. `content` 내부 Markdown 구조:
  1. 프로젝트 개요
  2. 목표 및 배경 (워크샵에서 도출된 pain point 요약)
  3. 사용자 (워크샵 참석자 기반)
  4. AX 과제별 상세 기능 명세
     - 과제명
     - 핵심 기능 상세 (각 기능의 입력/출력/동작 설명)
     - 부가 기능
     - Agent 구성 제안
  5. 비기능 요구사항
  6. 우선순위 매트릭스
  7. 제외 사항 (MVP 범위 밖)
  8. 용어 정의
- 한국어로 작성하도록 지시
- 워크샵 맥락(pain point → 클러스터 → 투표 → 과제 흐름)을 반영하도록 지시

### 2. AI PRD 생성 API Route

`src/app/api/ai/generate/route.ts` — POST 핸들러:

- `withFacilitator` 미들웨어로 권한 검증: **퍼실리테이터만** 호출 가능
- current_stage가 `generate`가 아니면 409 반환
- **AI 중복 호출 방지**: workshops.is_processing이 true이면 409 에러. 추가로 `is_processing_since` 타임스탬프가 5분 초과이면 stale lock으로 판정하여 자동 복구 후 처리 진행. 호출 시작 시 `is_processing=true, is_processing_since=now()`, 완료/실패 시 `is_processing=false, is_processing_since=null` (try/finally)
- workshop_id로 ax_tasks, design_artifacts, clusters, vote_results 모두 조회
- ax_tasks가 0개면 400 에러 ("PRD를 생성할 AX 과제가 없습니다")
- buildPrdPrompt() → Azure OpenAI JSON mode 호출(max_tokens 8000, timeout 60초)
- 응답 Zod 스키마: `{ content: string }`
- content가 비어 있거나 50,000자를 초과하면 에러 처리
- 응답이 max_tokens에 걸려 잘렸다고 판단되면 에러 처리
- DB 반영:
  - **첫 실행**: prds 테이블에 INSERT (content에 Markdown 본문, version 1)
  - **재실행**: 새 버전으로 INSERT (version+1). 이전 버전은 DB에 보존되지만 MVP에서는 최신 버전만 표시. 재실행 시 "기존 PRD를 새 버전으로 대체합니다 (현재 v{N})" 확인 모달 필수
- 응답: 생성된 prd 객체

### 3. PRD 관리 API

`src/app/api/prd/route.ts` — GET `?workshop_id=:id`:
- query를 Zod로 검증하고 `withAuth` 미들웨어로 세션 검증
- 워크샵의 최신 PRD 조회: `SELECT * FROM prds WHERE workshop_id = :id ORDER BY version DESC LIMIT 1`. MVP에서는 최신 버전만 표시. 구버전은 DB에 보존하지만 조회 API를 별도 제공하지 않음 (Post-MVP 검토)

`src/app/api/prd/[id]/route.ts` — PATCH:
- 퍼실리테이터만 수정 가능
- current_stage가 `generate`일 때만 편집 가능. report 이후에는 읽기 전용.
- 수정 가능 필드: `content`
- 수정 시 version 자동 증가
- **stale 전파**: `current_stage > 'generate'`이면 `propagateStale(workshopId, 'generate')` 호출 (ax_reports에 is_stale=true 설정)

### 4. PRD UI 컴포넌트

`src/components/prd/PrdPreview.tsx` — PRD 미리보기:
- Markdown 렌더링 (react-markdown 또는 유사 라이브러리 설치 필요)
- `dangerouslySetInnerHTML` 사용 금지. Markdown 렌더링은 `react-markdown`만 사용
- **Mermaid 코드 블록 렌더링**: react-markdown의 `components` prop에서 `code` 블록을 커스텀 처리. `language === 'mermaid'`인 경우 `<MermaidDiagram dsl={children} />` 컴포넌트로 렌더링
- PRD 생성 전: "퍼실리테이터가 PRD 생성을 시작할 때까지 대기 중" 메시지
- 퍼실리테이터에게만 "PRD 생성" 버튼 표시 (첫 실행 시), PRD 존재 시 "AI 재생성" 버튼 ("기존 PRD를 새 버전으로 대체합니다 (현재 v{N})" 확인 모달)
- **ReactionBar**: PRD 상단에 이모지 반응 (푍 동의 / ⚠️ 우려) + 집계 수 표시. 토글 방식. 참석자·퍼실리테이터 모두 반응 가능. Step 7에서 구현한 reactions API 재사용 (prd_id 파라미터)
- 로딩 중: pulse 애니메이션 + "AI가 PRD를 작성 중입니다..." 메시지
- 참석자에게는 is_processing=true일 때 "퍼실리테이터가 AI를 실행 중입니다" 대기 화면 표시

`src/components/prd/PrdEditor.tsx` — PRD 편집기 (퍼실리테이터 전용):
- Markdown 텍스트 편집 (textarea)
- 실시간 미리보기 (좌: 편집, 우: 미리보기)
- 저장 버튼

### 5. Markdown 내보내기

PRD 미리보기 화면에 "Markdown 복사" 버튼 추가:
- 클릭 시 PRD content를 클립보드에 복사
- 복사 완료 피드백 ("복사되었습니다" 토스트)

### 6. Stage 6 페이지 연결

워크샵 메인 페이지의 `generate` stage 분기에 PrdPreview/PrdEditor 컴포넌트를 연결하라.
- 퍼실리테이터: PrdEditor (편집 + 미리보기)
- 참석자: PrdPreview (미리보기만)

### 7. AX 종합 보고서 생성 프롬프트

`src/lib/ai/prompts.ts`에 추가:

```typescript
export function buildReportPrompt(input: {
  workshop_title: string
  workshop_description?: string
  process_graph: { nodes: ProcessNode[], edges: ProcessEdge[], lanes: ProcessLane[] }
  clusters: Cluster[]
  vote_results: VoteResult[]
  design_artifacts: DesignArtifact  // tobe_process에 mermaid_dsl + graph 포함
  tasks: AxTask[]
  prd_summary: string
}): { system: string, user: string }
```

- System 프롬프트: "당신은 AX(Agent Transformation) 컨설팅 전문가입니다. 워크샵 전체 여정의 데이터를 종합하여 경영진과 AX 엔지니어를 위한 종합 보고서를 작성하세요. AS-IS/TO-BE 프로세스 비교 섹션에는 Mermaid 다이어그램을 포함하세요."
- 입력: AS-IS 프로세스 그래프(노드/간선/Swimlane) + TO-BE 설계(mermaid_dsl + graph) + 클러스터 + 투표 결과 + Agent 스펙 + 과제 + KPI + PRD 요약
- 출력은 `{ "content": "<Markdown 본문>" }` 형태의 JSON으로 지시. `content` 내부 10개 섹션:
  1. Executive Summary
  2. AS-IS 프로세스 분석 (Mermaid 다이어그램 포함)
  3. Pain Point 분석 (클러스터 + 투표 결과)
  4. TO-BE 프로세스 설계 (Mermaid 다이어그램 포함 — AS-IS 대비 변경점 시각화)
  5. Agent 아키텍처
  6. KPI·ROI 분석
  7. 데이터 요구사항
  8. 조직 변화 관리
  9. 구현 로드맵
  10. 부록 (참석자 수, 포스트잇 수, 투표 통계 등)
- 한국어로 작성하도록 지시
- Mermaid 코드 블록은 ` ```mermaid ` 형식으로 출력 (react-markdown + Mermaid 렌더러에서 처리)

### 8. AI 종합 보고서 생성 API Route

`src/app/api/ai/report/route.ts` — POST 핸들러:

- `withFacilitator` 미들웨어로 권한 검증: **퍼실리테이터만** 호출 가능
- current_stage가 `report`가 아니면 409 반환
- **AI 중복 호출 방지**: workshops.is_processing이 true이면 409 에러. 추가로 `is_processing_since` 타임스탬프가 5분 초과이면 stale lock으로 판정하여 자동 복구. try/finally로 복구
- 전체 워크샵 데이터 수집: process_steps, notes, clusters, votes, design_artifacts, ax_tasks, prds (최신 버전 요약)
- buildReportPrompt() → Azure OpenAI JSON mode 호출(max_tokens 10000, timeout 60초)
- content가 비어 있거나 80,000자를 초과하면 에러 처리
- DB 반영:
  - **첫 실행**: ax_reports 테이블에 INSERT (version=1)
  - **재실행**: 새 버전으로 INSERT (version+1)
- 응답: 생성된 ax_report 객체

### 9. 종합 보고서 관리 API

`src/app/api/workshops/[id]/reports/route.ts`:
- **GET**: `withAuth`로 세션 검증. 최신 버전의 보고서 반환: `SELECT * FROM ax_reports WHERE workshop_id = :id ORDER BY version DESC LIMIT 1`.
- **PATCH**: `withFacilitator`로 권한 검증. report 단계에서만 편집 가능. completed 후 읽기 전용.
  - **참고**: report는 마지막 AI 산출물이므로 하류 stale 전파 대상 없음

### 10. 종합 보고서 UI 컴포넌트

`src/components/report/ReportPreview.tsx` — 보고서 미리보기:
- Markdown 렌더링 (react-markdown). `dangerouslySetInnerHTML` 금지
- Mermaid 코드 블록 렌더링 (PrdPreview와 동일한 MermaidDiagram 컴포넌트 재사용)
- 10개 섹션 구조
- 퍼실리테이터에게만 "보고서 생성" / "AI 재생성" 버튼 표시
- 참석자에게는 is_processing=true일 때 "종합 보고서를 작성 중..." 대기 화면 표시

`src/components/report/ReportEditor.tsx` — 보고서 편집기 (퍼실리테이터 전용):
- PrdEditor와 동일한 구조 (편집/미리보기 토글)
- "Markdown 복사" 버튼

### 11. Stage 7 페이지 연결

워크샵 메인 페이지의 `report` stage 분기에 ReportPreview/ReportEditor 컴포넌트를 연결하라.

### 12. Mermaid 다이어그램 렌더러

`src/components/shared/MermaidDiagram.tsx`:
- `mermaid` 패키지를 **lazy import** (`import('mermaid')`)하여 번들 크기 최소화
- Props: `{ dsl: string, className?: string }`
- `useEffect`에서 `mermaid.render(id, dsl)` 호출 → SVG 문자열을 DOM ref에 주입: `divRef.current.innerHTML = svgString` (mermaid 라이브러리 생성 SVG는 신뢰 가능 — CLAUDE.md Mermaid innerHTML 예외 참조. React의 `dangerouslySetInnerHTML` prop은 사용하지 않는다)
- 에러 처리: `mermaid.render()` 실패 시 (잘못된 DSL 문법, 렌더링 타임아웃 등):
  - "다이어그램 렌더링 실패" 텍스트 + AlertTriangle 아이콘 표시
  - fallback으로 원본 Mermaid DSL을 `<pre><code>` 블록으로 표시 (사용자가 DSL 확인 가능)
  - `console.error`로 에러 로깅
- 다크 테마: `mermaid.initialize({ theme: 'dark' })` 설정
- react-markdown과 통합: `components={{ code({ className, children }) { if (className === 'language-mermaid') return <MermaidDiagram dsl={String(children)} /> } }}`

## Acceptance Criteria

```bash
npm run lint    # lint 에러 없음
npm run typecheck # 타입 검사 통과
npm run test    # 테스트 통과
npm run build   # 컴파일 에러 없음
```

- AI PRD 생성이 AX 과제 + Agent 설계 기반으로 구조화된 Markdown을 생성하는지 확인
- PRD에 워크샵 맥락(pain point, 투표 결과, TO-BE 프로세스)이 반영되는지 확인
- Markdown이 올바르게 렌더링되는지 확인
- Mermaid 코드 블록(` ```mermaid `)이 다이어그램으로 렌더링되는지 확인 (MermaidDiagram 컴포넌트)
- AI 응답 content가 비어 있거나 잘렸으면 API가 실패하고 is_processing이 false로 복구되는지 확인
- 퍼실리테이터가 PRD를 편집하고 저장할 수 있는지 확인
- Markdown 복사 기능이 동작하는지 확인
- report 상태에서는 PRD 편집이 차단되는지 확인
- AI 종합 보고서 생성이 전체 워크샵 데이터를 종합한 10개 섹션 Markdown을 생성하는지 확인
- 보고서 content가 비어 있거나 80,000자 초과 시 에러 처리되는지 확인
- 보고서 재생성 시 version+1로 새 레코드가 생성되는지 확인
- completed 상태에서는 보고서 편집이 차단되는지 확인

## 금지사항

- PDF 내보내기는 이 step에서 구현하지 마라. 이유: Post-MVP
- PRD/보고서 버전 히스토리 UI는 이 step에서 구현하지 마라. DB에는 version 필드가 있지만 UI는 생략
- 클라이언트에서 직접 Azure OpenAI를 호출하지 마라
