# Step 1: db-schema

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 데이터 모델 섹션
- `/docs/ADR.md` — ADR-002 (Supabase 선택 이유)
- `/docs/PRD.md` — 워크샵 프로세스 5단계, 핵심 기능 요약
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

ARCHITECTURE.md의 데이터 모델 섹션에 정의된 8개 핵심 테이블을 모두 생성하라:

- `projects` — facilitator_id는 Supabase Auth user ID. 프로젝트 삭제는 소속 워크샵이 없을 때만 허용한다.
- `workshops` — `project_id` FK 필수. current_stage는 PostgreSQL enum 타입 `workshop_stage`로 정의 (`gather`, `cluster`, `vote`, `derive`, `generate`, `completed`). `is_processing` boolean 필드 추가 (AI 중복 호출 방지). settings jsonb의 구조는 ARCHITECTURE.md의 settings 스키마 참조.
- `participants` — workshop_id에 ON DELETE CASCADE 설정
- `notes` — cluster_id는 nullable (클러스터링 전에는 null). content에 CHECK (char_length(content) <= 200) 제약 추가.
- `clusters` — workshop_id에 ON DELETE CASCADE. name에 CHECK (char_length(name) <= 50) 제약 추가.
- `votes` — (workshop_id, participant_id, target_type, target_id)에 유니크 제약 추가 (동일 대상 중복 투표 방지). target_type은 enum `vote_target_type` (`note`, `cluster`)
- `ax_tasks` — pain_points, core_features, sub_features는 jsonb. title에 CHECK (char_length(title) <= 100) 제약 추가.
- `prds` — content는 text (Markdown). CHECK (char_length(content) <= 50000) 제약 추가.

프로젝트당 활성 워크샵은 1개로 제한한다:
- 활성 워크샵 = `current_stage <> 'completed'`
- PostgreSQL partial unique index 또는 동등한 DB 제약을 추가하고, 최종 사용자 메시지는 API 트랜잭션에서 409로 처리할 수 있게 설계한다.

### 3. 인덱스

자주 조회되는 외래키 컬럼에 인덱스를 생성하라:

- `notes.workshop_id`
- `notes.cluster_id`
- `votes.workshop_id`
- `votes.target_id`
- `participants.workshop_id`
- `workshops.project_id`
- `projects.facilitator_id`
- `workshops.invite_code` (유니크 인덱스)

### 4. RLS (Row Level Security)

Supabase RLS 정책을 설정하라:

- 모든 테이블에 RLS 활성화
- 기본 원칙: INSERT/UPDATE/DELETE는 API Route(service_role)에서만 처리한다. anon 사용자는 직접 테이블 쓰기 권한을 갖지 않는다.
- `projects`: Supabase Auth 사용자 본인의 프로젝트만 SELECT 가능. guest anon 직접 접근은 금지한다.
- `workshops`: invite_code 참여 검증에 필요한 최소 조회와, Auth 사용자의 소유 프로젝트 워크샵 조회만 허용한다. 민감 조회는 API Route를 통한다.
- `participants`, `notes`, `votes`, `clusters`, `ax_tasks`, `prds`: 브라우저 직접 조회는 최소화하고, 워크샵 화면의 초기 데이터는 API Route가 signed cookie/Auth를 검증한 뒤 반환한다.
- Realtime/Yjs에 필요한 최소 SELECT 범위는 별도 정책으로 허용하되, 권한 판단은 API 미들웨어가 최종 책임을 가진다.

### 5. Realtime 활성화

마이그레이션 파일 끝에 Supabase Realtime publication을 설정하라:

```sql
-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE workshops;
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE clusters;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
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
```

### 7. TypeScript 타입 생성

`src/types/` 디렉토리에 DB 스키마에 대응하는 TypeScript 타입을 수동으로 작성하라:

- `src/types/project.ts` — Project 타입
- `src/types/workshop.ts` — Workshop, WorkshopStage, WorkshopSettings 타입
- `src/types/note.ts` — Note, NoteColor 타입
- `src/types/cluster.ts` — Cluster 타입
- `src/types/vote.ts` — Vote, VoteTargetType 타입
- `src/types/task.ts` — AxTask, TaskDifficulty 타입
- `src/types/prd.ts` — Prd 타입

각 타입은 DB 컬럼과 1:1 대응해야 한다. `id`, `created_at` 등 공통 필드 패턴을 정의하라.

또한 `src/lib/supabase/types.ts`에 Supabase 테이블 Row/Insert/Update 타입을 수동 작성하라. DB 타입을 클라이언트 도메인 타입으로 그대로 노출하지 말고, `src/types/*.ts`는 API/클라이언트용 도메인 타입으로 유지한다.

### 8. 테스트 작성

구현 전에 다음 테스트를 먼저 작성하라:
- `WorkshopStage`에 `completed`가 포함되는지 검증
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
- `projects` 포함 8개 테이블, `completed` enum, signed session에 필요한 `SESSION_SECRET` 전제가 누락되지 않았는지 확인하라

## 금지사항

- 실제 Supabase 프로젝트에 마이그레이션을 실행하지 마라. SQL 파일만 생성한다.
- `supabase gen types` 명령을 실행하지 마라. 타입은 수동으로 작성한다.
- notes 테이블의 position_x, position_y는 float 타입이다. integer로 바꾸지 마라.
