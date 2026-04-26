# Step 1: db-schema

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 데이터 모델 섹션
- `/docs/ADR.md` — ADR-002 (Supabase 선택 이유)
- `/docs/PRD.md` — 워크샵 프로세스 8단계, 핵심 기능 요약
- `/docs/SPEC_AUDIT.md` — P0 정합성 결정
- `/docs/MODULE_MAP.md` — 데이터/API 소유권
- `/docs/modules/01-identity-access.md`
- `/docs/modules/02-project-workshop-lifecycle.md`
- `/docs/modules/04-board-notes.md`
- `/docs/modules/06-voting-prioritization.md`
- `/docs/modules/07-tasks-prd-artifacts.md`
- `/docs/modules/09-quality-operations.md`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라:

- `/src/lib/supabase/client.ts`
- `/src/lib/supabase/server.ts`
- `/src/lib/env.ts`

## 작업

Supabase PostgreSQL 스키마를 SQL 마이그레이션 파일로 작성하라. 실제 마이그레이션 실행은 하지 않는다.

### 1. 마이그레이션 파일 생성

`supabase/migrations/001_initial_schema.sql` 파일을 생성하라.

### 2. 테이블 정의

ARCHITECTURE.md의 데이터 모델 섹션에 정의된 15개 테이블을 모두 생성하라 (projects, workshops, participants, notes, clusters, votes, ax_tasks, prds, process_steps, process_edges, process_lanes, editing_locks, design_artifacts, ax_reports, task_reactions):

- `projects` — facilitator_id는 Supabase Auth user ID. 프로젝트 삭제는 소속 워크샵이 없을 때만 허용한다.
- `workshops` — `project_id` FK 필수. current_stage는 PostgreSQL enum 타입 `workshop_stage`로 정의 (`context`, `gather`, `cluster`, `vote`, `design`, `generate`, `report`, `completed`). `is_processing` boolean 필드 추가 (AI 중복 호출 방지). `is_processing_since` timestamptz nullable 필드 추가 (AI 처리 시작 시각; 5분 초과 시 stale lock 자동 복구). `description` text nullable 필드 추가. CHECK (char_length(description) <= 500). settings jsonb의 구조는 ARCHITECTURE.md의 settings 스키마 참조 (vote_mode, timer_minutes 포함).
- `participants` — workshop_id에 ON DELETE CASCADE 설정
- `notes` — workshop_id FK ON DELETE CASCADE. participant_id FK ON DELETE CASCADE. cluster_id nullable FK → clusters.id (ON DELETE SET NULL). process_step_id nullable FK → process_steps.id (ON DELETE SET NULL). content에 CHECK (char_length(content) <= 200) 제약 추가.
- `clusters` — workshop_id에 ON DELETE CASCADE. name에 CHECK (char_length(name) <= 50) 제약 추가.
- `votes` — workshop_id FK ON DELETE CASCADE. participant_id FK ON DELETE CASCADE. cluster_id nullable FK → clusters.id (ON DELETE CASCADE). note_id nullable FK → notes.id (ON DELETE CASCADE). CHECK 제약으로 둘 중 정확히 하나만 NOT NULL이어야 함 (vote_mode에 따라 cluster 또는 note 대상). (workshop_id, participant_id, cluster_id)와 (workshop_id, participant_id, note_id)에 각각 partial unique index 추가 (동일 대상 중복 투표 방지)
- `ax_tasks` — workshop_id FK ON DELETE CASCADE. pain_points, core_features, sub_features는 jsonb. title에 CHECK (char_length(title) <= 100) 제약 추가. description text nullable, CHECK (char_length(description) <= 500).
- `prds` — workshop_id FK ON DELETE CASCADE. content는 text (Markdown). CHECK (char_length(content) <= 50000) 제약 추가.
- `process_steps` — workshop_id FK ON DELETE CASCADE. name CHECK (char_length(name) <= 100), description CHECK (char_length(description) <= 500). node_type text NOT NULL DEFAULT 'task' CHECK (node_type IN ('task','exclusive_gateway','parallel_gateway','start_event','end_event','intermediate_event','sub_process')). order_index integer NOT NULL. position_x float nullable, position_y float nullable, width float nullable, height float nullable. lane_id uuid FK → process_lanes.id nullable (ON DELETE SET NULL). duration_info, tools_systems, volume_info는 text nullable. 최대 **50개** 제한은 API에서 검증.
- `process_edges` — workshop_id FK ON DELETE CASCADE. source_node_id uuid FK → process_steps.id (ON DELETE CASCADE), target_node_id uuid FK → process_steps.id (ON DELETE CASCADE). label text nullable CHECK (char_length(label) <= 50). edge_type text DEFAULT 'sequence' CHECK (edge_type IN ('sequence','message','association')). UNIQUE(source_node_id, target_node_id). CHECK(source_node_id != target_node_id).
- `process_lanes` — workshop_id FK ON DELETE CASCADE. name text CHECK (char_length(name) <= 50). order_index integer NOT NULL. color text nullable. 최대 **10개** 제한은 API에서 검증.
- `editing_locks` — workshop_id FK ON DELETE CASCADE. resource_type text CHECK (resource_type IN ('process_graph','design_artifacts')). editor_id uuid FK → participants.id (ON DELETE CASCADE). acquired_at timestamptz DEFAULT now(). UNIQUE(workshop_id, resource_type). 편집자 연결 끊김 30초 후 서버에서 자동 해제 (presence 기반).
- `design_artifacts` — workshop_id FK ON DELETE CASCADE. tobe_process, agent_specs, kpis, data_requirements, org_requirements는 jsonb NOT NULL. tobe_process jsonb는 mermaid_dsl(string) + graph({nodes, edges, lanes}) 구조를 포함. version integer NOT NULL DEFAULT 1. updated_at timestamp.
- `ax_reports` — workshop_id FK ON DELETE CASCADE. content text CHECK (char_length(content) <= 80000). version integer NOT NULL DEFAULT 1. updated_at timestamp.
- `task_reactions` — workshop_id FK ON DELETE CASCADE. task_id nullable FK → ax_tasks.id (ON DELETE CASCADE). prd_id nullable FK → prds.id (ON DELETE CASCADE). participant_id FK → participants.id (ON DELETE CASCADE). reaction_type('👍'|'⚠️'). CHECK 제약으로 task_id와 prd_id 중 정확히 하나만 NOT NULL. UNIQUE(workshop_id, participant_id, task_id, reaction_type)와 UNIQUE(workshop_id, participant_id, prd_id, reaction_type) 추가.

프로젝트당 활성 워크샵은 1개로 제한한다:
- 활성 워크샵 = `current_stage <> 'completed'`
- PostgreSQL partial unique index 또는 동등한 DB 제약을 추가하고, 최종 사용자 메시지는 API 트랜잭션에서 409로 처리할 수 있게 설계한다.

### 3. 인덱스

자주 조회되는 외래키 컬럼에 인덱스를 생성하라:

- `notes.workshop_id`
- `notes.cluster_id`
- `notes.process_step_id`
- `votes.workshop_id`
- `votes.cluster_id`
- `votes.note_id`
- `participants.workshop_id`
- `workshops.project_id`
- `projects.facilitator_id`
- `workshops.invite_code` (유니크 인덱스)
- `process_steps.workshop_id`
- `process_steps.lane_id`
- `process_edges.workshop_id`
- `process_edges.source_node_id`
- `process_edges.target_node_id`
- `process_lanes.workshop_id`
- `editing_locks.workshop_id`
- `design_artifacts.workshop_id`
- `ax_reports.workshop_id`

추가 성능 인덱스 (빈번한 WHERE/ORDER BY 패턴):
- `workshops.current_stage` (단계별 조회 필터)
- `prds(workshop_id, version DESC)` (최신 버전 조회)
- `ax_reports(workshop_id, version DESC)` (최신 버전 조회)
- `design_artifacts(workshop_id, version DESC)` (최신 버전 조회)
- `participants(workshop_id, is_facilitator)` (퍼실리테이터 조회)
- `notes(workshop_id, created_at DESC)` (타임라인 정렬)

**인덱스 SQL 생성 예시** (마이그레이션 파일에 포함):

```sql
-- FK 인덱스 (자주 조회되는 외래키)
CREATE INDEX idx_notes_workshop ON notes(workshop_id);
CREATE INDEX idx_notes_cluster ON notes(cluster_id);
CREATE INDEX idx_notes_process_step ON notes(process_step_id);
CREATE INDEX idx_votes_workshop ON votes(workshop_id);
CREATE INDEX idx_votes_cluster ON votes(cluster_id);
CREATE INDEX idx_votes_note ON votes(note_id);
CREATE INDEX idx_participants_workshop ON participants(workshop_id);
CREATE INDEX idx_workshops_project ON workshops(project_id);
CREATE INDEX idx_projects_facilitator ON projects(facilitator_id);
CREATE UNIQUE INDEX idx_workshops_invite_code ON workshops(invite_code);
CREATE INDEX idx_process_steps_workshop ON process_steps(workshop_id);
CREATE INDEX idx_process_steps_lane ON process_steps(lane_id);
CREATE INDEX idx_process_edges_workshop ON process_edges(workshop_id);
CREATE INDEX idx_process_edges_source ON process_edges(source_node_id);
CREATE INDEX idx_process_edges_target ON process_edges(target_node_id);
CREATE INDEX idx_process_lanes_workshop ON process_lanes(workshop_id);
CREATE INDEX idx_editing_locks_workshop ON editing_locks(workshop_id);
CREATE INDEX idx_design_artifacts_workshop ON design_artifacts(workshop_id);
CREATE INDEX idx_ax_reports_workshop ON ax_reports(workshop_id);

-- 복합 성능 인덱스
CREATE INDEX idx_workshops_stage ON workshops(current_stage);
CREATE INDEX idx_prds_latest ON prds(workshop_id, version DESC);
CREATE INDEX idx_ax_reports_latest ON ax_reports(workshop_id, version DESC);
CREATE INDEX idx_design_artifacts_latest ON design_artifacts(workshop_id, version DESC);
CREATE INDEX idx_participants_facilitator ON participants(workshop_id, is_facilitator);
CREATE INDEX idx_notes_timeline ON notes(workshop_id, created_at DESC);

-- Partial unique index: 프로젝트당 활성 워크샵 1개 제한
CREATE UNIQUE INDEX idx_one_active_workshop_per_project
  ON workshops(project_id)
  WHERE current_stage <> 'completed';
```

### 3-1. SQL 기본값 및 CHECK 제약

- `workshops.settings` 기본값: `DEFAULT '{"anonymous": false, "votes_per_person": 3, "max_participants": 20, "results_visible": false, "vote_mode": "cluster", "timer_minutes": null}'::jsonb`
- `notes.color` CHECK: `CHECK (color IN ('red', 'blue', 'green', 'yellow'))` — 4색 제한
- `workshops.is_processing` 기본값: `DEFAULT false`
- `workshops.is_processing_since` 기본값: `DEFAULT NULL`
- `workshops.current_stage` 기본값: `DEFAULT 'context'`
- `clusters.is_stale` 기본값: `DEFAULT false`
- `design_artifacts.is_stale` 기본값: `DEFAULT false`
- `prds.is_stale` 기본값: `DEFAULT false`
- `ax_reports.is_stale` 기본값: `DEFAULT false`

### 4. RLS (Row Level Security)

Supabase RLS 정책을 설정하라:

- 모든 테이블에 RLS 활성화
- 기본 원칙: INSERT/UPDATE/DELETE는 API Route(service_role)에서만 처리한다. anon 사용자는 직접 테이블 쓰기 권한을 갖지 않는다.
- `projects`: Supabase Auth 사용자 본인의 프로젝트만 SELECT 가능 (`auth.uid()` 기반). guest anon 직접 접근은 금지한다.
- 워크샵 데이터 테이블(workshops, participants, notes, clusters, votes, ax_tasks, prds, task_reactions, process_steps, process_edges, process_lanes, editing_locks, design_artifacts, ax_reports): SELECT 정책은 `USING (TRUE)`로 설정. Guest(anon key)도 Realtime CDC 수신을 위해 읽기 허용. INSERT/UPDATE/DELETE 정책은 만들지 않음 (기본 차단). ARCHITECTURE.md의 RLS 정책 설계 섹션 참조.

### 5. Realtime 활성화

마이그레이션 파일 끝에 Supabase Realtime publication을 설정하라:

```sql
-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE workshops;
ALTER PUBLICATION supabase_realtime ADD TABLE process_steps;
ALTER PUBLICATION supabase_realtime ADD TABLE process_edges;
ALTER PUBLICATION supabase_realtime ADD TABLE process_lanes;
ALTER PUBLICATION supabase_realtime ADD TABLE editing_locks;
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE clusters;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER PUBLICATION supabase_realtime ADD TABLE task_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE design_artifacts;
ALTER PUBLICATION supabase_realtime ADD TABLE ax_reports;
```

### 6. updated_at 자동 갱신 트리거

updated_at 컬럼을 가진 테이블(projects, workshops, prds)에 자동 갱신 트리거를 생성하라:

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_workshops_updated_at
  BEFORE UPDATE ON workshops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_prds_updated_at
  BEFORE UPDATE ON prds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_design_artifacts_updated_at
  BEFORE UPDATE ON design_artifacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_ax_reports_updated_at
  BEFORE UPDATE ON ax_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 7. TypeScript 타입 생성

`src/types/` 디렉토리에 DB 스키마에 대응하는 TypeScript 타입을 수동으로 작성하라:

- `src/types/project.ts` — Project 타입
- `src/types/workshop.ts` — Workshop, WorkshopStage, WorkshopSettings 타입
- `src/types/process-step.ts` — ProcessStep 타입
- `src/types/note.ts` — Note, NoteColor 타입
- `src/types/cluster.ts` — Cluster 타입
- `src/types/vote.ts` — Vote, VoteTargetType 타입
- `src/types/task.ts` — AxTask, TaskDifficulty 타입
- `src/types/prd.ts` — Prd 타입
- `src/types/design-artifact.ts` — DesignArtifact, ToBeProcess, AgentSpec, Kpi, DataRequirement, OrgRequirement 타입
- `src/types/ax-report.ts` — AxReport 타입

각 타입은 DB 컬럼과 1:1 대응해야 한다. `id`, `created_at` 등 공통 필드 패턴을 정의하라.

또한 `src/lib/supabase/types.ts`에 Supabase 테이블 Row/Insert/Update 타입을 수동 작성하라. DB 타입을 클라이언트 도메인 타입으로 그대로 노출하지 말고, `src/types/*.ts`는 API/클라이언트용 도메인 타입으로 유지한다.

### 8. 테스트 작성

구현 전에 다음 테스트를 먼저 작성하라:
- `WorkshopStage`에 `context`, `design`, `report`, `completed`가 포함되는지 검증
- `WorkshopSettings` 기본값/범위가 문서와 일치하는지 검증
- invite_code/프로젝트 활성 워크샵 제약처럼 DB에서 강제할 제약이 SQL에 포함되어 있는지 문자열 기반으로 검증

## Acceptance Criteria

```bash
npm run lint    # lint 에러 없음
npm run typecheck # 타입 검사 통과
npm run test    # 테스트 통과
npm run build   # 컴파일 에러 없음
```

- `supabase/migrations/001_initial_schema.sql`이 유효한 PostgreSQL SQL인지 직접 확인하라.
- 모든 외래키 관계가 ARCHITECTURE.md ERD와 일치하는지 확인하라
- `projects` 포함 15개 테이블, `completed` enum, signed session에 필요한 `SESSION_SECRET` 전제가 누락되지 않았는지 확인하라
- `npx supabase db reset`으로 로컬 DB에 스키마가 정상 적용되는지 검증하라 (로컬 Supabase 인스턴스 필요: `npx supabase start`)
- `supabase/seed.sql` 파일을 생성하여 개발용 기초 데이터를 삽입하라. `db reset` 시 자동 실행된다. seed 데이터 구조는 `docs/TESTING_GUIDE.md` 섹션 8 참조

## 금지사항

- 리모트 Supabase 프로젝트에 마이그레이션을 실행하지 마라 (`npx supabase db push` 금지). 로컬 `npx supabase db reset`은 허용한다.
- `supabase gen types` 명령을 실행하지 마라. 타입은 수동으로 작성한다.
- notes 테이블의 position_x, position_y는 float 타입이다. integer로 바꾸지 마라.
