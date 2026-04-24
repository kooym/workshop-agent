# Step 8: prd-generation

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — AI 파이프라인 (PRD 생성), prds API
- `/docs/PRD.md` — Stage 5: PRD 생성 (Generate) 전체 기능
- `/docs/UI_GUIDE.md` — 전반적인 에디터/프리뷰 디자인 패턴
- `/docs/SPEC_AUDIT.md` — PRD MVP 범위, AI JSON mode 결정
- `/docs/MODULE_MAP.md`
- `/docs/modules/05-ai-pipeline.md`
- `/docs/modules/07-tasks-prd-artifacts.md`
- `/docs/modules/08-ui-experience-system.md`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라:

- `/src/lib/ai/openai.ts`
- `/src/lib/ai/prompts.ts`
- `/src/lib/ai/schemas.ts`
- `/src/app/api/ai/derive/route.ts` — AI 호출 패턴 참조
- `/src/types/prd.ts`
- `/src/types/task.ts`
- `/src/lib/api/middleware.ts`
- `/src/lib/api/validators.ts`

## 작업

확정된 AX 과제를 기반으로 PRD를 자동 생성하는 기능을 구현하라. Stage 5(PRD 생성 단계)의 핵심 기능이다.

이 step은 새 AI/API/UI 기능이므로 테스트를 먼저 작성한다. PRD 생성 성공, 빈 과제, 빈 content, version 증가, stage lock, `dangerouslySetInnerHTML` 미사용을 구현 전에 테스트로 고정하라.

### 1. PRD 생성 프롬프트

`src/lib/ai/prompts.ts`에 추가:

```typescript
export function buildPrdPrompt(input: {
  workshop_title: string
  tasks: AxTask[]
  clusters: Cluster[]
  vote_results: VoteResult[]
}): { system: string, user: string }
```

- System 프롬프트: "당신은 시니어 프로덕트 매니저입니다. 워크샵에서 도출된 AX 과제를 기반으로 개발 착수용 PRD를 작성하세요."
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
- **AI 중복 호출 방지**: workshops.is_processing이 true이면 409 에러. 호출 시작 시 is_processing=true, 완료/실패 시 is_processing=false (try/finally)
- workshop_id로 ax_tasks, clusters, vote_results 모두 조회
- ax_tasks가 0개면 400 에러 ("PRD를 생성할 AX 과제가 없습니다")
- buildPrdPrompt() → Azure OpenAI JSON mode 호출(max_tokens 8000, timeout 60초)
- 응답 Zod 스키마: `{ content: string }`
- content가 비어 있거나 50,000자를 초과하면 에러 처리
- 응답이 max_tokens에 걸려 잘렸다고 판단되면 에러 처리
- DB 반영: prds 테이블에 INSERT (content에 Markdown 본문, version 1)
- 응답: 생성된 prd 객체

### 3. PRD 관리 API

`src/app/api/prd/route.ts` — GET `?workshop_id=:id`:
- query를 Zod로 검증하고 `withAuth` 미들웨어로 세션 검증
- 워크샵의 최신 PRD 조회

`src/app/api/prd/[id]/route.ts` — PATCH:
- 퍼실리테이터만 수정 가능
- current_stage가 `generate`일 때만 편집 가능. completed 후에는 읽기 전용.
- 수정 가능 필드: `content`
- 수정 시 version 자동 증가

### 4. PRD UI 컴포넌트

`src/components/prd/PrdPreview.tsx` — PRD 미리보기:
- Markdown 렌더링 (react-markdown 또는 유사 라이브러리 설치 필요)
- `dangerouslySetInnerHTML` 사용 금지. Markdown 렌더링은 `react-markdown`만 사용
- PRD 생성 전: "퍼실리테이터가 PRD 생성을 시작할 때까지 대기 중" 메시지
- 퍼실리테이터에게만 "PRD 생성" 버튼 표시
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

### 6. Stage 5 페이지 연결

워크샵 메인 페이지의 `generate` stage 분기에 PrdPreview/PrdEditor 컴포넌트를 연결하라.
- 퍼실리테이터: PrdEditor (편집 + 미리보기)
- 참석자: PrdPreview (미리보기만)

## Acceptance Criteria

```bash
npm run lint    # lint 에러 없음
npm run typecheck # 타입 검사 통과
npm run test    # 테스트 통과
npm run build   # 컴파일 에러 없음
```

- AI PRD 생성이 AX 과제 기반으로 구조화된 Markdown을 생성하는지 확인
- PRD에 워크샵 맥락(pain point, 투표 결과)이 반영되는지 확인
- Markdown이 올바르게 렌더링되는지 확인
- AI 응답 content가 비어 있거나 잘렸으면 API가 실패하고 is_processing이 false로 복구되는지 확인
- 퍼실리테이터가 PRD를 편집하고 저장할 수 있는지 확인
- Markdown 복사 기능이 동작하는지 확인
- completed 상태에서는 PRD 편집이 차단되는지 확인

## 금지사항

- PDF 내보내기는 이 step에서 구현하지 마라. 이유: Post-MVP
- PRD 버전 히스토리 UI는 이 step에서 구현하지 마라. DB에는 version 필드가 있지만 UI는 생략
- 클라이언트에서 직접 Azure OpenAI를 호출하지 마라
