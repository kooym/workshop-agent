# Step 7: ax-derivation

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — AI 파이프라인 (AX 과제 도출), ax_tasks API
- `/docs/PRD.md` — Stage 4: AX 과제 도출 (Derive) 전체 기능
- `/docs/UI_GUIDE.md` — 전반적인 카드/리스트 디자인 패턴

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라:

- `/src/lib/ai/openai.ts` — Azure OpenAI 클라이언트
- `/src/lib/ai/prompts.ts` — 프롬프트 패턴 참조
- `/src/lib/ai/schemas.ts` — 스키마 패턴 참조
- `/src/app/api/votes/results/route.ts` — 투표 결과 조회 패턴
- `/src/types/task.ts`

## 작업

투표 결과 상위 pain point를 기반으로 AI가 AX 과제를 도출하는 기능을 구현하라. Stage 4(과제 도출 단계)의 핵심 기능이다.

### 1. AX 과제 도출 프롬프트

`src/lib/ai/prompts.ts`에 추가:

```typescript
export function buildDerivationPrompt(input: {
  clusters: { name: string, summary: string, vote_count: number, notes: { content: string }[] }[]
  top_n: number
}): { system: string, user: string }
```

- System 프롬프트: "당신은 비즈니스 컨설턴트이자 AI Agent 아키텍트입니다. 워크샵에서 도출된 pain point를 분석하여 AI Agent(AX)로 해결할 수 있는 과제를 도출하세요."
- 투표 상위 N개 클러스터의 pain point + 투표 순위를 입력으로 제공
- 출력 지시:
  - 과제명 (한국어)
  - 과제 설명 (2~3문장)
  - 해결 대상 pain point 매핑 (어떤 클러스터/포스트잇과 연결되는지)
  - 핵심(core) 기능 목록
  - 부가(sub) 기능 목록
  - 예상 효과
  - 구현 난이도 (low/medium/high)
- 대주제 간 연계/중복 분석 지시: 여러 클러스터를 한 번에 해결할 수 있는 통합 과제도 제안

### 2. AI 응답 스키마

`src/lib/ai/schemas.ts`에 추가:

```typescript
export interface DerivationResponse {
  tasks: {
    title: string
    description: string
    pain_point_cluster_names: string[]
    core_features: string[]
    sub_features: string[]
    expected_impact: string
    difficulty: 'low' | 'medium' | 'high'
  }[]
}
```

### 3. AI AX 과제 도출 API Route

`src/app/api/ai/derive/route.ts` — POST 핸들러:

- 세션 검증: **퍼실리테이터만** 호출 가능
- 요청: `{ workshop_id, top_n?: number }` (기본 top_n = 5)
- 투표 결과 상위 N개 클러스터 + 해당 포스트잇 조회
- buildDerivationPrompt() → Azure OpenAI 호출 → 응답 파싱
- DB 반영:
  1. 기존 ax_tasks 삭제 (해당 workshop의)
  2. 새 ax_tasks INSERT (pain_points에 연결된 클러스터/포스트잇 ID 매핑)
- 응답: 생성된 ax_tasks 배열

### 4. AX 과제 관리 API

`src/app/api/tasks/route.ts` — GET `?workshop_id=:id`:
- 워크샵의 AX 과제 목록 조회

`src/app/api/tasks/[id]/route.ts` — PATCH:
- 퍼실리테이터만 수정 가능
- 수정 가능 필드: `title`, `description`, `core_features`, `sub_features`, `priority`, `difficulty`

### 5. AX 과제 UI 컴포넌트

`src/components/derive/TaskList.tsx` — 과제 목록:
- AI 도출 전: "퍼실리테이터가 AX 과제 도출을 시작할 때까지 대기 중" 메시지
- 퍼실리테이터에게만 "AX 과제 도출" 버튼 표시
- 로딩 중: pulse 애니메이션
- 과제 카드 목록 렌더링

`src/components/derive/TaskCard.tsx` — 개별 과제 카드:
- 과제명 (text-lg font-semibold)
- 설명
- 연결된 pain point 클러스터 태그 (badge)
- 핵심 기능 목록 (체크리스트 스타일)
- 부가 기능 목록
- 예상 효과
- 난이도 표시 (low=green, medium=yellow, high=red)
- 퍼실리테이터만 편집 가능

### 6. Stage 4 페이지 연결

워크샵 메인 페이지의 `derive` stage 분기에 TaskList 컴포넌트를 연결하라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # lint 에러 없음
```

- AI 과제 도출 API가 투표 상위 pain point를 기반으로 과제를 생성하는지 확인
- 과제에 연결된 pain point 매핑이 올바른지 확인
- 퍼실리테이터가 과제를 편집할 수 있는지 확인
- 비퍼실리테이터가 과제 도출을 트리거하면 403이 반환되는지 확인

## 금지사항

- 참석자 코멘트/피드백 기능은 이 step에서 구현하지 마라. 이유: Post-MVP
- 과제 우선순위 드래그앤드롭 정렬은 이 step에서 구현하지 마라
- 클라이언트에서 직접 Azure OpenAI를 호출하지 마라
