# M5 AI Pipeline

## 책임

워크샵 데이터를 AI가 처리할 수 있는 입력으로 만들고, Azure OpenAI 응답을 검증한 뒤 DB에 안전하게 반영한다.

## 소유 범위

- `src/lib/ai/openai.ts`
- `src/lib/ai/prompts.ts`
- `src/lib/ai/schemas.ts`
- `/api/ai/cluster`
- `/api/ai/design`
- `/api/ai/generate`
- `/api/ai/report`
- processing lock helper
- retry/timeout/max_tokens policy

## 소유 데이터

- `clusters` 생성/재생성
- `notes.cluster_id` 배정
- `workshops.is_processing` AI 실행 중 lock 토글
- `workshops.is_processing_since` 타임스탬프 (AI 시작 시 설정, 완료/실패 시 null로 복구. 5분 초과 시 M2에서 stale lock 자동 해제)
- `design_artifacts` 생성 (AI Design 단계)
- `ax_reports` 생성 (AI Report 단계)

M5는 `ax_tasks`, `prds`, `design_artifacts`, `ax_reports`를 생성할 수 있지만, 산출물의 일반 CRUD 소유권은 M7에 있다.

## 소유하지 않는 것

- Azure resource provisioning: M9
- PRD editor UI: M7/M8
- vote UI and result visibility: M6

## 계약

- AI 호출은 API Route 서버사이드에서만 수행한다.
- 클라이언트에서 Azure OpenAI key나 client를 import하지 않는다.
- 모든 AI 호출은 JSON mode를 사용한다.
- 응답은 Zod schema와 사후 무결성 검증을 통과해야 한다.
- `is_processing`은 try/finally로 반드시 복구한다.
- AI 재실행 완료 시 해당 산출물 + 하류 산출물의 `is_stale = false` 일괄 해제.
- 클러스터링 재실행: `cluster_id IS NULL`인 미할당 노트만 대상. 기존 클러스터를 컨텍스트로 포함.
- timeout:
  - clustering: 30초
  - design: 30초
  - PRD generation: 60초
  - report generation: 60초
- max_tokens:
  - clustering: 2000
  - design: 4000
  - PRD generation: 8000
  - report generation: 10000

## 확장 포인트

- model routing
- prompt versioning
- human review queue
- AI cost tracking
- retry with fallback model
- prompt evaluation dataset

## 테스트

- success path with mocked AI response
- malformed JSON
- schema failure
- clustering missing/duplicate note id
- design invalid cluster mapping
- design_artifacts 생성/버전 검증
- PRD empty/truncated content
- report empty/truncated content
- ax_reports 생성/버전 검증
- is_processing recovery on every failure

## 운영 고려사항

- Azure OpenAI 장애는 사용자에게 재시도 가능한 Toast로 안내한다.
- AI 비용과 timeout은 워크샵당 notes/tasks 규모에 민감하므로 M9에서 비용 모니터링을 추가한다.
