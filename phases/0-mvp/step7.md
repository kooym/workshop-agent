# Step 7: ax-design

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — AI 파이프라인 (AX Design), design_artifacts/ax_tasks API, design_artifacts jsonb 스키마
- `/docs/ADR.md` — ADR-015 (프로세스 중심 설계), ADR-016 (이중 산출물), ADR-017 (jsonb 저장 전략)
- `/docs/PRD.md` — Stage 5: AX 설계 (Design) 전체 기능
- `/docs/UI_GUIDE.md` — AX 설계 화면 (6개 탭), TaskCard, ReactionBar 디자인 패턴
- `/docs/MODULE_MAP.md`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라:

- `/src/lib/ai/openai.ts` — Azure OpenAI 클라이언트
- `/src/lib/ai/prompts.ts` — 프롬프트 패턴 참조
- `/src/lib/ai/schemas.ts` — 스키마 패턴 참조
- `/src/app/api/votes/results/route.ts` — 투표 결과 조회 패턴
- `/src/types/task.ts`
- `/src/types/design-artifact.ts`
- `/src/lib/api/middleware.ts`
- `/src/lib/api/validators.ts`

## 작업

AS-IS 프로세스 + 투표 결과를 기반으로 AI가 TO-BE AX 프로세스를 설계하고, Agent 아키텍처, KPI, 데이터·조직 요구사항, AX 과제를 동시에 도출하는 기능을 구현하라. Stage 5(AX 설계 단계)의 핵심 기능이다.

이 step은 새 AI/API 기능이므로 테스트를 먼저 작성한다. Azure OpenAI는 mock하고, 6개 산출물 검증, stage lock, 빈 결과, 잘못된 cluster 매핑, is_processing 복구를 구현 전에 테스트로 고정하라.

### 1. AX Design 프롬프트

`src/lib/ai/prompts.ts`에 추가:

```typescript
export function buildDesignPrompt(input: {
  process_graph: {
    nodes: { id: string, name: string, description: string, node_type: string, lane_name?: string, duration_info?: string, tools_systems?: string, volume_info?: string }[]
    edges: { source_node_id: string, target_node_id: string, label?: string, edge_type: string }[]
    lanes: { id: string, name: string }[]
  }
  clusters: { id: string, name: string, summary: string, vote_count: number, notes: { content: string, process_step_name?: string, vote_count?: number }[] }[]
  vote_mode: 'cluster' | 'note'
  workshop_description?: string
}): { system: string, user: string }
```

**클러스터 참조 방식**: AI 프롬프트에 각 클러스터의 `id` (UUID)와 `name`을 함께 전달한다. AI 응답의 `tasks[].cluster_ids`는 입력에서 전달받은 UUID를 그대로 사용하도록 프롬프트에서 지시한다. 사후 검증에서 반환된 cluster_ids가 입력 clusters의 id 집합에 포함되는지 확인한다.

- `vote_mode`에 따라 투표 데이터 해석이 달라짐:
  - `'cluster'` 모드: `clusters[].vote_count`가 클러스터에 대한 직접 투표 수
  - `'note'` 모드: `clusters[].notes[].vote_count`가 개별 노트 투표 수이며, 클러스터의 `vote_count`는 소속 노트 합산으로 계산
  - 프롬프트에 `vote_mode`를 명시하여 AI가 정확하게 우선순위를 판단하도록 함

- System 프롬프트: "당신은 AX(Agent Transformation) 컨설턴트이자 AI Agent 아키텍트입니다. AS-IS 업무 프로세스 그래프(BPMN 노드/간선/Swimlane 포함)와 pain point 분석 결과를 기반으로, TO-BE AX 프로세스를 설계하고, Agent 아키텍처, KPI, 데이터·조직 요구사항, AX 과제를 도출하세요. TO-BE 프로세스는 Mermaid flowchart DSL과 구조화된 JSON 모두로 출력하세요."
- 입력: AS-IS 프로세스 그래프 (노드 유형/연결 관계/Swimlane 포함) + 클러스터별 pain point + 투표 순위 + 노트-프로세스 노드 매핑
- 출력 지시 (6개 섹션):
  1. **tobe_process**: `{ mermaid_dsl: string, graph: { nodes: [...], edges: [...], lanes: [...] } }` — TO-BE 프로세스를 Mermaid flowchart DSL과 React Flow 형식 JSON 모두로 출력. 자동화 유형(full/assisted/human), Agent 통합 포인트, AS-IS 노드 매핑 포함
  2. **agent_specs**: Agent별 이름, 역할, 핵심/부가 기능, 입출력, Human Checkpoint
  3. **tasks**: AX 과제 (과제명, 설명, 연결 클러스터, 핵심/부가 기능, 난이도, 예상 효과)
  4. **kpis**: KPI 지표 (AS-IS 현재값 추정 → TO-BE 목표값, 측정 방법)
  5. **data_requirements**: 필요 데이터 (소스, 형태, 규모, 담당팀)
  6. **org_requirements**: 조직 변화 요건 (카테고리: collaboration/training/governance/infrastructure)

### 2. AI 응답 스키마

`src/lib/ai/schemas.ts`에 추가:

6개 산출물에 대한 Zod 스키마를 정의하고 `z.infer`로 타입을 추론하라:

- `designResponseSchema`: 최상위 스키마
  - `tobe_process.steps[]`: name, description, automation_type(full|assisted|human), agent_name?, asis_step_ids[]
  - `agent_specs[]`: name, role, core_features[], sub_features[], input, output, human_checkpoint
  - `tasks[]`: title(1~100자), description(1~500자), cluster_ids[], core_features[], sub_features[], difficulty(low|medium|high), expected_effect
  - `kpis[]`: name, current_value, target_value, measurement_method
  - `data_requirements[]`: name, source, format, volume, responsible_team
  - `org_requirements[]`: category(collaboration|training|governance|infrastructure), description, priority(high|medium|low)

검증 조건:
- 6개 필드 모두 존재해야 함
- tasks ≥ 1
- 각 task의 cluster_ids가 실제 입력 클러스터와 매핑 가능해야 함
- tobe_process.graph.nodes의 asis_node_ids가 실제 AS-IS 프로세스 노드와 매핑 가능해야 함
- tobe_process.mermaid_dsl이 비어있지 않아야 함

### 3. AI AX Design API Route

`src/app/api/ai/design/route.ts` — POST 핸들러:

- `withFacilitator` 미들웨어로 권한 검증: **퍼실리테이터만** 호출 가능
- current_stage가 `design`이 아니면 409 반환
- **AI 중복 호출 방지**: workshops.is_processing이 true이면 409 에러. 추가로 `is_processing_since` 타임스탬프가 5분 초과이면 stale lock으로 판정하여 자동 복구 후 처리 진행. 호출 시작 시 `is_processing=true, is_processing_since=now()`, 완료/실패 시 `is_processing=false, is_processing_since=null` (try/finally)
- 입력 데이터 수집:
  - process_graph: 해당 워크샵의 프로세스 그래프 (GET /api/process-graph 형식 — nodes[], edges[], lanes[])
  - clusters: 투표 상위 클러스터 + 해당 포스트잇 (process_step 연결 정보 포함)
  - votes: 투표 결과
- buildDesignPrompt() → Azure OpenAI JSON mode 호출(max_tokens 4000, timeout 30초) → 응답 파싱/검증
- AI 응답 사후 검증:
  - 6개 필드 모두 존재하는지 확인
  - tasks ≥ 1
  - 각 task의 cluster_ids가 유효한지 확인
  - tobe_process.graph의 asis_node_ids가 유효한지 확인
  - tobe_process.mermaid_dsl이 비어있지 않은지 확인
- DB 반영:
  - **첫 실행**: design_artifacts INSERT (version=1) + ax_tasks INSERT
  - **재실행 (병합)**: design_artifacts를 version+1로 새 INSERT. 기존 과제 유지 + 새 과제만 INSERT. 유사 과제 발견 시 응답에 warning 포함
- 응답: `{ data: { design_artifacts, tasks, warnings? } }`

### 4. Design 산출물 조회/편집 API

`src/app/api/workshops/[id]/design-artifacts/route.ts`:
- **GET**: `withAuth`로 세션 검증. 최신 버전의 design_artifacts 반환: `SELECT * FROM design_artifacts WHERE workshop_id = :id ORDER BY version DESC LIMIT 1`.
- **PATCH**: `withFacilitator`로 권한 검증. design 단계에서만 편집 가능. 편집 가능 필드: tobe_process, agent_specs, kpis, data_requirements, org_requirements (jsonb 전체 교체).
  - **stale 전파**: `current_stage > 'design'`이면 `propagateStale(workshopId, 'design')` 호출 (prds, ax_reports에 is_stale=true 설정)

### 5. AX 과제 관리 API

`src/app/api/tasks/route.ts` — GET `?workshop_id=:id`:
- `withAuth` 미들웨어로 세션 검증
- query를 Zod로 검증
- 워크샵의 AX 과제 목록 조회

`src/app/api/tasks/[id]/route.ts` — PATCH:
- `withFacilitator` 미들웨어로 권한 검증
- 요청 body를 Zod 검증
- current_stage가 `design`일 때만 편집 가능. generate 이후에는 읽기 전용.
- 수정 가능 필드: `title` (max 100자), `description` (max 500자), `core_features`, `sub_features`, `priority`, `difficulty`
- **stale 전파**: `current_stage > 'design'`이면 `propagateStale(workshopId, 'design')` 호출

`src/app/api/tasks/[id]/route.ts` — DELETE:
- `withFacilitator` 미들웨어로 권한 검증
- current_stage가 `design`일 때만 삭제 가능
- 관련 task_reactions도 함께 삭제 (CASCADE)
- **stale 전파**: `current_stage > 'design'`이면 `propagateStale(workshopId, 'design')` 호출

### 5-1. 이모지 반응 API

`src/app/api/reactions/route.ts`:

- **POST** — 반응 등록. 요청 body를 Zod 검증: `{ workshop_id, task_id?, prd_id?, reaction_type: '👍' | '⚠️' }`. `withAuth` 미들웨어.
  - task_id와 prd_id 중 정확히 하나만 제공해야 함
  - 동일 대상에 같은 반응 중복 시 DB UNIQUE 제약으로 409
  - task_reactions 테이블에 INSERT

- **DELETE** `?id=:reaction_id` — 반응 취소. 본인 반응만 삭제 가능.

- **GET** `?workshop_id=:id&task_id=:id` 또는 `?workshop_id=:id&prd_id=:id` — 반응 집계.
  - 응답: `{ data: { thumbs_up: number, warning: number, my_reaction: '👍'|'⚠️'|null } }`

### 6. AX Design UI 컴포넌트

`src/components/design/DesignView.tsx` — Design 메인 뷰:
- 6개 탭 기반 레이아웃: TO-BE 프로세스, Agent 스펙, 과제, KPI, 데이터 요구사항, 조직 요구사항
- 퍼실리테이터에게만 "AI 설계" 버튼 표시 (첫 실행 시), 산출물 존재 시 "AI 재설계" 버튼
- AI 미실행 시: "퍼실리테이터가 AX 설계를 시작할 때까지 대기 중" 메시지
- 참석자에게는 is_processing=true일 때 "퍼실리테이터가 AI를 실행 중입니다 — TO-BE 프로세스를 설계 중..." 대기 화면 표시

`src/components/design/ToBeProcessView.tsx` — TO-BE 프로세스 탭:
- **Mermaid 다이어그램**: design_artifacts.tobe_process.mermaid_dsl을 Mermaid로 렌더링 (읽기 전용). 다크 테마 적용
- **React Flow 뷰**: design_artifacts.tobe_process.graph를 React Flow로 렌더링. 기본 읽기 전용, 퍼실리테이터가 "편집" 토글 시 노드 위치/라벨 수정 가능
- 뷰 전환 탭: [Mermaid 다이어그램] / [상세 그래프 뷰] 선택 가능
- 각 TO-BE 노드에 자동화 유형 배지 (🤖 전자동/🤝 AI보조/👤 사람수행)
- Agent 통합 포인트 표시
- AS-IS ↔ TO-BE 노드 매핑 하이라이트 (선택 시)

`src/components/design/AgentSpecCard.tsx` — Agent 스펙 카드:
- Agent명, 역할, 핵심/부가 기능, 입출력, Human Checkpoint 표시

`src/components/design/KpiTable.tsx` — KPI 테이블:
- 지표명, AS-IS 현재값, TO-BE 목표값, 측정 방법

`src/components/design/DataRequirementTable.tsx` — 데이터 요구사항 테이블:
- 데이터명, 소스, 형태, 규모, 담당팀

`src/components/design/OrgRequirementList.tsx` — 조직 요구사항 목록:
- 카테고리별(협업/교육/거버넌스/인프라) 요건 목록

`src/components/design/TaskCard.tsx` — 개별 과제 카드 (과제 탭에서 재사용):
- 과제명, 설명, 연결 클러스터 태그
- 핵심/부가 기능 목록
- 난이도 배지 (low=green, medium=yellow, high=red)
- **ReactionBar**: 이모지 반응 (👍 동의 / ⚠️ 우려) + 집계
- 퍼실리테이터만 편집/삭제 가능

### 7. Realtime 구독 추가

layout.tsx의 Realtime 설정에 추가:
- `design:{workshop_id}` 채널: `ax_tasks`, `design_artifacts`, `prds`, `ax_reports` 4개 테이블의 INSERT/UPDATE/DELETE 이벤트 감지 (CLAUDE.md 정의 기준)
- `reactions:{workshop_id}` 채널: task_reactions 테이블의 INSERT/DELETE 이벤트 감지
- 변경 시 Design 화면 자동 업데이트

### 8. Stage 5 페이지 연결

워크샵 메인 페이지의 `design` stage 분기에 DesignView 컴포넌트를 연결하라.

## Acceptance Criteria

```bash
npm run lint    # lint 에러 없음
npm run typecheck # 타입 검사 통과
npm run test    # 테스트 통과
npm run build   # 컴파일 에러 없음
```

- AI Design API가 AS-IS 프로세스 + 투표 결과를 기반으로 6개 산출물을 생성하는지 확인
- 6개 필드(tobe_process, agent_specs, tasks, kpis, data_requirements, org_requirements)가 모두 존재하는지 확인
- 과제에 연결된 cluster_ids가 올바른지 확인
- tobe_process의 asis_step_ids가 유효한지 확인
- AI 응답이 빈 tasks 또는 유효하지 않은 매핑을 반환하면 API가 실패하고 is_processing이 false로 복구되는지 확인
- 퍼실리테이터가 과제/설계 산출물을 편집할 수 있는지 확인
- 비퍼실리테이터가 AI 설계를 트리거하면 403이 반환되는지 확인
- generate 단계 이후 과제 편집이 차단되는지 확인
- Design 재실행 시 기존 과제가 유지되고 새 design_artifacts가 version+1로 생성되는지 확인

## 금지사항

- 참석자 코멘트/텍스트 피드백 기능은 이 step에서 구현하지 마라. 이유: Post-MVP (이모지 반응으로 대체)
- 과제 우선순위 드래그앤드롭 정렬은 이 step에서 구현하지 마라
- 클라이언트에서 직접 Azure OpenAI를 호출하지 마라
