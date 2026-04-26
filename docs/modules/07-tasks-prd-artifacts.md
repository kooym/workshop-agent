# M7 Tasks & PRD Artifacts

## 책임

투표와 AI 분석 결과를 AX 과제, 설계 산출물, PRD, 종합 보고서로 저장, 편집, 조회한다.

## 소유 범위

- `/api/tasks*`
- `/api/prd*`
- `/api/design-artifacts*`
- `/api/reports*`
- `/api/reactions*`
- `TaskList`
- `TaskCard`
- `PrdEditor`
- `PrdPreview`
- `DesignArtifactViewer`
- `ReportEditor`
- `ReportPreview`
- Markdown copy
- completed 산출물 조회

## 소유 데이터

- `ax_tasks`
- `prds`
- `design_artifacts`
- `ax_reports`
- `task_reactions`

## 소유하지 않는 것

- AI prompt와 raw AI response parsing: M5
- AI에 의한 `design_artifacts`와 `ax_reports` 초기 생성: M5 (M7은 편집만 소유)
- vote aggregation: M6
- completed stage transition: M2/M8
- PDF export renderer until Post-MVP extension is planned

## 계약

- design 단계에서만 tasks 편집 가능하다.
- design 단계에서만 design_artifacts 편집 가능하다 (퍼실리테이터 전용).
- generate 단계에서만 PRD 편집 가능하다.
- report 단계에서만 ax_reports 편집 가능하다 (퍼실리테이터 전용).
- completed 상태에서는 모든 산출물(tasks/prds/design_artifacts/ax_reports/task_reactions) 읽기 전용이다.
- Markdown 렌더링은 `react-markdown`만 사용한다.
- `dangerouslySetInnerHTML` 사용 금지.
- PRD/ax_reports version은 재생성 시 version+1로 새 레코드 INSERT.
- **Stale 플래그**: `design_artifacts`, `prds`, `ax_reports`에 `is_stale` boolean 필드. 이전 단계 데이터 수정 시 M2(`propagateStale`)가 `is_stale = true` 설정. AI 재실행 완료 시 M5가 `is_stale = false`로 해제. 퍼실리테이터 "현재 결과 유지" 시 M2(`dismiss-stale`)가 해제.
- Stale 상태인 산출물은 UI에 노란/오렌지 경고 배너 표시 (M8 소유).

### AI → Task 생성 흐름

```
M6 투표 완료 → 퍼실리테이터가 design 단계 전환
  → 퍼실리테이터가 "AI 설계" 버튼 클릭
    → POST /api/ai/design (M5)
      → M5가 상위 클러스터 + 투표 결과 + 포스트잇을 AI에 전달
      → AI 응답: ax_tasks[], design_artifacts (JSON mode)
      → M5가 Zod 스키마로 검증
      → M5가 ax_tasks, design_artifacts 테이블에 INSERT (service role)
    → Realtime CDC로 전체 참석자에게 전파
    → M7 TaskList/TaskCard/DesignArtifactViewer가 Zustand store에서 렌더링
```

### Task 상태 모델

MVP에서 task는 별도 상태 필드를 갖지 않는다. 단계(stage)가 상태를 대신한다:
- **design 단계**: task 생성/편집/삭제 가능 (퍼실리테이터 전용)
- **generate 단계 이후**: task 읽기 전용
- Post-MVP에서 task 상태 (draft/active/done) 도입 검토

### Task ↔ PRD 바인딩

- PRD는 `ax_tasks`의 전체 목록을 입력으로 생성된다 (1:N 암묵적 바인딩).
- PRD 본문 내에서 task를 참조하되, DB 수준의 FK는 두지 않는다 (PRD는 Markdown 텍스트).
- Post-MVP에서 traceability view (note → cluster → vote → task → PRD) 도입 시 명시적 바인딩 추가.

### PRD 버전 관리

- `prds.version` 필드: 최초 생성 시 1.
- AI 재생성 시: 새 버전으로 INSERT (version+1). 이전 버전 DB 보존, MVP에서는 최신만 표시.
- 퍼실리테이터 편집 시: 최신 버전의 content를 PATCH.
- Post-MVP에서 별도 `prd_versions` 테이블로 이전 버전 히스토리 기능을 도입한다.

### Report 버전 관리

- `ax_reports.version` 필드: 최초 생성 시 1.
- AI 재생성 시: 새 버전으로 INSERT (version+1). 이전 버전 DB 보존, MVP에서는 최신만 표시.
- 퍼실리테이터 편집 시: 최신 버전의 content를 PATCH.
- report 단계에서만 편집 가능. completed 후 읽기 전용.

### Task Reactions

- 참석자는 과제(ax_tasks)에 이모지 리액션을 추가/제거할 수 있다.
- `task_reactions` 테이블: (task_id, participant_id, emoji) UNIQUE 제약.
- design 단계에서만 리액션 추가/제거 가능.

### Completed 상태 산출물 접근

- completed 워크샵의 산출물(clusters, ax_tasks, design_artifacts, prds, ax_reports, task_reactions)은 기존 참석자와 퍼실리테이터에게 조회 허용.
- 신규 참석자(초대 코드로 completed 워크샵 접속)도 읽기 전용 접근 허용.
- 퍼실리테이터 대시보드에서 completed 워크샵 목록 및 산출물 열람 가능.

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
