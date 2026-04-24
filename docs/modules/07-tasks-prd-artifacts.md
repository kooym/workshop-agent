# M7 Tasks & PRD Artifacts

## 책임

투표와 AI 분석 결과를 AX 과제와 PRD 산출물로 저장, 편집, 조회한다.

## 소유 범위

- `/api/tasks*`
- `/api/prd*`
- `TaskList`
- `TaskCard`
- `PrdEditor`
- `PrdPreview`
- Markdown copy
- completed 산출물 조회

## 소유 데이터

- `ax_tasks`
- `prds`

## 소유하지 않는 것

- AI prompt와 raw AI response parsing: M5
- vote aggregation: M6
- completed stage transition: M2/M8
- PDF export renderer until Post-MVP extension is planned

## 계약

- derive 단계에서만 tasks 편집 가능하다.
- generate 단계에서만 PRD 편집 가능하다.
- completed 상태에서는 tasks/prds 모두 읽기 전용이다.
- Markdown 렌더링은 `react-markdown`만 사용한다.
- `dangerouslySetInnerHTML` 사용 금지.
- PRD version은 PATCH 시 증가한다.

## 확장 포인트

- PRD version history UI
- PDF export
- task comments/feedback
- task prioritization matrix
- artifact archive page
- traceability view: note -> cluster -> vote -> task -> PRD

## 테스트

- task schema and stage lock
- task edit facilitator-only
- PRD latest fetch
- PRD version increment
- Markdown rendering safety
- completed read-only

## 운영 고려사항

- PRD 본문 최대 50,000자 제한을 넘지 않게 API와 UI에서 모두 방어한다.
- 산출물은 고객 공유 대상이므로 복사/내보내기 기능에 대한 회귀 테스트가 중요하다.
