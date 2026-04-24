# Step 5: ai-clustering

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — AI 파이프라인 (클러스터링 파이프라인), 클러스터 API, 실시간 동기화
- `/docs/ADR.md` — ADR-003 (Azure OpenAI 선택 이유)
- `/docs/PRD.md` — Stage 2: 클러스터링 (Cluster) 전체 기능
- `/docs/UI_GUIDE.md` — ClusterGroup 컴포넌트
- `/docs/SPEC_AUDIT.md` — AI 응답 검증, MVP 범위 결정
- `/docs/MODULE_MAP.md`
- `/docs/modules/05-ai-pipeline.md`
- `/docs/modules/04-board-notes.md`
- `/docs/modules/08-ui-experience-system.md`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라:

- `/src/app/api/notes/route.ts`
- `/src/types/cluster.ts`
- `/src/types/note.ts`
- `/src/stores/board.ts`
- `/src/lib/supabase/server.ts`
- `/src/lib/env.ts`
- `/src/lib/api/middleware.ts`
- `/src/lib/api/validators.ts`

## 작업

Azure OpenAI를 연동하여 포스트잇 자동 클러스터링 기능을 구현하라. Stage 2(클러스터 단계)의 핵심 기능이다.

이 step은 새 AI/API 기능이므로 테스트를 먼저 작성한다. Azure OpenAI는 HTTP/MSW 또는 모듈 mock으로 대체하고, 성공/검증 실패/권한 실패/is_processing 복구를 구현 전에 테스트로 고정하라.

### 1. Azure OpenAI 클라이언트

`src/lib/ai/openai.ts`:

```typescript
// AzureOpenAI 클라이언트 생성
// `openai` 패키지의 AzureOpenAI 클래스를 사용한다 (@azure/openai 사용 금지)
// 환경 변수는 src/lib/env.ts에서 검증된 값을 사용한다.
// 클러스터링 타임아웃: 30초
// 재시도: 최대 2회 (1초, 2초 exponential backoff)
```

`openai` 패키지를 설치하라:
```bash
npm install openai
```

### 2. 클러스터링 프롬프트

`src/lib/ai/prompts.ts`에 클러스터링 프롬프트를 정의하라:

```typescript
export function buildClusteringPrompt(notes: { id: string, content: string }[]): {
  system: string
  user: string
}
```

- System 프롬프트: "당신은 비즈니스 워크샵 퍼실리테이터입니다. 참석자들이 작성한 포스트잇을 의미 기반으로 3~8개의 대주제로 클러스터링하세요."
- 출력 형식을 JSON으로 명확히 지시
- 각 클러스터에 한국어 이름과 한 줄 요약을 포함하도록 지시
- 모든 포스트잇이 반드시 하나의 클러스터에 할당되도록 지시

### 3. AI 응답 스키마

`src/lib/ai/schemas.ts`:

Zod 스키마를 정의하고 `z.infer`로 타입을 추론하라. 별도 interface를 중복 정의하지 마라.

스키마 형태:
- `clusters`: 3~8개
- `name`: 1~50자
- `summary`: 1~300자
- `note_ids`: 입력 note id 배열의 부분집합

응답 파싱 + 검증 함수도 작성하라:
- 모든 입력 note_id가 결과에 포함되는지 검증
- 하나의 note_id가 여러 클러스터에 중복 할당되지 않았는지 검증
- 알 수 없는 note_id가 출력에 포함되지 않았는지 검증
- 검증 실패 시 에러를 던진다

### 4. AI 클러스터링 API Route

`src/app/api/ai/cluster/route.ts` — POST 핸들러:

- `withFacilitator` 미들웨어로 권한 검증: **퍼실리테이터만** 호출 가능
- 요청 body를 Zod 검증: `{ workshop_id }`
- current_stage가 `cluster`가 아니면 409 반환 ("클러스터 단계에서만 실행할 수 있습니다")
- **AI 중복 호출 방지**: workshops.is_processing이 true이면 409 에러 ("이미 AI가 처리 중입니다"). 호출 시작 시 is_processing=true, 완료/실패 시 is_processing=false로 복구 (try/finally)
- workshop_id로 모든 notes 조회
- notes가 0개면 400 에러 ("클러스터링할 포스트잇이 없습니다")
- buildClusteringPrompt() → Azure OpenAI JSON mode 호출(max_tokens 2000) → 응답 파싱/검증
- DB 반영:
  1. 기존 clusters 삭제 (해당 workshop의)
  2. 새 clusters INSERT
  3. 각 note의 cluster_id UPDATE
- 응답: `{ data: clusters }`

### 5. 클러스터 관리 API

`src/app/api/clusters/route.ts` — GET `?workshop_id=:id`:
- query를 Zod로 검증하고 `withAuth` 미들웨어로 세션 검증
- 워크샵의 클러스터 목록 + 각 클러스터에 속한 notes 포함

`src/app/api/clusters/[id]/route.ts` — PATCH:
- 퍼실리테이터만 수정 가능
- current_stage가 `cluster`일 때만 수정 가능
- 수정 가능 필드: `name`, `order_index`

### 6. 클러스터 뷰 UI

`src/components/cluster/ClusterView.tsx` — 클러스터 목록 뷰:
- 클러스터 그룹들을 세로로 나열
- 클러스터링 실행 전: "퍼실리테이터가 클러스터링을 시작할 때까지 대기 중" 메시지
- 퍼실리테이터에게만 "AI 클러스터링 시작" 버튼 표시
- 로딩 중: pulse 애니메이션 + "AI가 분석 중입니다..." 메시지
- 참석자에게는 is_processing=true일 때 "퍼실리테이터가 AI를 실행 중입니다" 대기 화면 표시

`src/components/cluster/ClusterGroup.tsx` — 개별 클러스터 그룹:
- UI 가이드의 ClusterGroup 디자인 구현
- 클러스터명 + 요약 + 포함된 포스트잇들 표시
- 하단: 포스트잇 수 통계

### 7. Realtime 구독 추가

layout.tsx의 Realtime 설정에 clusters 채널 구독 추가:
- clusters 테이블의 INSERT/UPDATE/DELETE 이벤트 감지
- 클러스터 데이터 변경 시 UI 자동 업데이트

### 8. Stage 2 페이지 연결

워크샵 메인 페이지의 `cluster` stage 분기에 ClusterView 컴포넌트를 연결하라.

## Acceptance Criteria

```bash
npm run lint    # lint 에러 없음
npm run typecheck # 타입 검사 통과
npm run test    # 테스트 통과
npm run build   # 컴파일 에러 없음
```

- AI 클러스터링 API가 포스트잇을 의미 기반으로 분류하는지 확인
- 모든 포스트잇이 클러스터에 할당되는지 확인
- 누락/중복/알 수 없는 note_id가 있으면 API가 실패하고 is_processing이 false로 복구되는지 확인
- 클러스터 뷰에서 그룹별로 포스트잇이 표시되는지 확인
- 퍼실리테이터가 아닌 사람이 클러스터링을 트리거하면 403이 반환되는지 확인

## 금지사항

- 클라이언트에서 직접 Azure OpenAI API를 호출하지 마라. 이유: API 키 노출 금지
- 수동 클러스터 조정(드래그앤드롭 이동, 병합/분리)은 이 step에서 구현하지 마라. 이유: SPEC_AUDIT에서 Post-MVP로 분류했다. MVP에서는 클러스터명/순서 편집과 AI 재실행만 허용한다.
- 클러스터링 결과를 캐싱하지 마라. 재실행 시 항상 새로 분류
