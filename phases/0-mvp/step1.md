# Step 1: db-schema

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 데이터 모델 섹션
- `/docs/ADR.md` — ADR-002 (Supabase 선택 이유)
- `/docs/PRD.md` — 워크샵 프로세스 5단계, 핵심 기능 요약

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라:

- `/src/lib/supabase/client.ts`
- `/src/lib/supabase/server.ts`

## 작업

Supabase PostgreSQL 스키마를 SQL 마이그레이션 파일로 작성하라. 실제 마이그레이션 실행은 하지 않는다.

### 1. 마이그레이션 파일 생성

`supabase/migrations/001_initial_schema.sql` 파일을 생성하라.

### 2. 테이블 정의

ARCHITECTURE.md의 데이터 모델 섹션에 정의된 7개 테이블을 모두 생성하라:

- `workshops` — current_stage는 PostgreSQL enum 타입 `workshop_stage`로 정의 (`gather`, `cluster`, `vote`, `derive`, `generate`)
- `participants` — workshop_id에 ON DELETE CASCADE 설정
- `notes` — cluster_id는 nullable (클러스터링 전에는 null)
- `clusters` — workshop_id에 ON DELETE CASCADE
- `votes` — (workshop_id, participant_id, target_type, target_id)에 유니크 제약 없음 (한 참석자가 같은 대상에 여러 표 가능하지 않게 하려면 유니크 제약 추가). target_type은 enum `vote_target_type` (`note`, `cluster`)
- `ax_tasks` — pain_points, core_features, sub_features는 jsonb
- `prds` — content는 text (Markdown)

### 3. 인덱스

자주 조회되는 외래키 컬럼에 인덱스를 생성하라:

- `notes.workshop_id`
- `notes.cluster_id`
- `votes.workshop_id`
- `votes.target_id`
- `participants.workshop_id`
- `workshops.invite_code` (유니크 인덱스)

### 4. RLS (Row Level Security)

Supabase RLS 정책을 설정하라:

- 모든 테이블에 RLS 활성화
- `workshops`: invite_code로 조회 허용 (참여 시), id로 조회 허용 (참가자)
- `participants`, `notes`, `votes`, `clusters`, `ax_tasks`, `prds`: 해당 workshop의 participant만 접근 가능
- INSERT/UPDATE/DELETE는 API Route(service_role)에서 처리하므로, anon 사용자에게는 SELECT만 허용

### 5. Realtime 활성화

마이그레이션 파일 끝에 Supabase Realtime publication을 설정하라:

```sql
-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE workshops;
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE clusters;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
```

### 6. TypeScript 타입 생성

`src/types/` 디렉토리에 DB 스키마에 대응하는 TypeScript 타입을 수동으로 작성하라:

- `src/types/workshop.ts` — Workshop, WorkshopStage, WorkshopSettings 타입
- `src/types/note.ts` — Note, NoteColor 타입
- `src/types/cluster.ts` — Cluster 타입
- `src/types/vote.ts` — Vote, VoteTargetType 타입
- `src/types/task.ts` — AxTask, TaskDifficulty 타입
- `src/types/prd.ts` — Prd 타입

각 타입은 DB 컬럼과 1:1 대응해야 한다. `id`, `created_at` 등 공통 필드 패턴을 정의하라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음 (타입 파일이 올바른 TypeScript인지 검증)
npm run lint    # lint 에러 없음
```

- `supabase/migrations/001_initial_schema.sql`이 유효한 PostgreSQL SQL인지 직접 확인하라
- 모든 외래키 관계가 ARCHITECTURE.md ERD와 일치하는지 확인하라

## 금지사항

- 실제 Supabase 프로젝트에 마이그레이션을 실행하지 마라. SQL 파일만 생성한다.
- `supabase gen types` 명령을 실행하지 마라. 타입은 수동으로 작성한다.
- notes 테이블의 position_x, position_y는 float 타입이다. integer로 바꾸지 마라.
