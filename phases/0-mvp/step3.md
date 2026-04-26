# Step 3: workshop-crud

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — API 설계 (워크샵 CRUD), 상태 관리 (workshopStore)
- `/docs/PRD.md` — F1(워크샵 생성/관리), F19(AS-IS 프로세스 정의), 워크샵 프로세스 8단계
- `/docs/SPEC_AUDIT.md` — completed 단계, 프로젝트 계층, 단계 잠금 결정
- `/docs/MODULE_MAP.md`
- `/docs/modules/02-project-workshop-lifecycle.md`
- `/docs/modules/03-realtime-collaboration.md`
- `/docs/modules/08-ui-experience-system.md`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라:

- `/src/app/api/workshops/route.ts`
- `/src/app/api/workshops/join/route.ts`
- `/src/app/api/projects/route.ts`
- `/src/lib/session.ts`
- `/src/app/workshop/[id]/layout.tsx`
- `/src/app/workshop/[id]/page.tsx`
- `/src/types/workshop.ts`

## 작업

워크샵 조회/수정 API와 Zustand 상태 관리, Realtime 구독을 구현하라.

이 step은 새 API/상태 로직을 추가하므로 테스트를 먼저 작성한다. 특히 단계 전환, 프로젝트 소유권, 비퍼실리테이터 403을 구현 전에 테스트로 고정하라.

### 1. API Route: 워크샵 조회

`src/app/api/workshops/[id]/route.ts` — GET 핸들러:

- `withAuth` 미들웨어로 세션 검증: 요청자가 해당 워크샵의 participant인지 확인
- workshops + participants 조인하여 반환
- 응답: `{ data: { workshop, participants } }`

### 2. API Route: 워크샵 수정

`src/app/api/workshops/[id]/route.ts` — PATCH 핸들러:

- `withFacilitator` 미들웨어로 권한 검증: 요청자가 해당 워크샵의 **퍼실리테이터**인지 확인
- 요청 body를 Zod 스키마로 검증: `{ title?, description?, current_stage?, settings? }`
- 수정 가능 필드: `title`, `description`, `current_stage`, `settings`
- current_stage 변경 시 유효한 전이인지 검증 (context→gather→cluster→vote→design→generate→report→completed 순서만 허용, 역방향 금지)
- current_stage 전진 시 **optimistic locking** 적용: `UPDATE workshops SET current_stage = :next WHERE id = :id AND current_stage = :expected`. 영향 행 0이면 409 CONFLICT 반환 (동시 전환 방지)
- completed 상태 워크샵은 읽기 전용이므로 title/settings/current_stage 수정 시 403 또는 409를 반환한다. 단, report→completed 전환은 허용한다.
- settings 변경 제약을 적용한다: `anonymous`는 context 또는 gather 단계에서만(`current_stage` ≤ gather), `votes_per_person`은 vote 진입 전까지만, `vote_mode`는 vote 진입 전까지만, `max_participants`는 현재 참가자 수 이상으로만 변경 가능, `results_visible`은 언제든 변경 가능, `timer_minutes`는 언제든 변경 가능.
- 응답: `{ data: workshop }`

### 2-1. API Route: 워크샵 삭제

`src/app/api/workshops/[id]/route.ts` — DELETE 핸들러:

- `withFacilitator` 미들웨어로 권한 검증
- 해당 워크샵의 facilitator_id가 요청자와 일치하는지 확인
- 관련 데이터(participants, notes, clusters, votes, tasks, prds, process_steps, design_artifacts, ax_reports) 캐스케이드 삭제 또는 DB CASCADE로 처리
- 응답: `{ data: { success: true } }`

### 2-2. Stale Data 전파 유틸리티

`src/lib/api/stale.ts` — 이전 단계 수정 시 하류 AI 산출물 무효화:
```typescript
// modifiedStage 이후의 모든 AI 산출물 테이블에 is_stale = true 설정
// 대상: clusters, design_artifacts, prds, ax_reports
// 조건: current_stage > modifiedStage일 때만 (이미 지나간 단계에서 수정된 경우)
export async function propagateStale(
  supabase: SupabaseClient,
  workshopId: string,
  modifiedStage: WorkshopStage
): Promise<void>
```
- 단계 순서: context(0) < gather(1) < cluster(2) < vote(3) < design(4) < generate(5) < report(6) < completed(7)
- context 수정 → clusters, design_artifacts, prds, ax_reports 전부 stale
- gather 수정 → clusters 이하 전부 stale
- cluster 수정 → design_artifacts 이하 stale
- vote 수정 → design_artifacts 이하 stale
- 각 리소스 수정 API Route에서 `current_stage > modifiedStage` 조건일 때 호출
- 이 step에서는 유틸리티만 생성. 실제 호출은 각 리소스 API Route에서 추가 (step4, step5, step6, step7, step8에서 적용)

### 2-3. Stale 경고 디스미스 API

`src/app/api/workshops/[id]/dismiss-stale/route.ts` — PATCH 핸들러:
- `withFacilitator` 미들웨어로 권한 검증
- 요청 body: `{ table: 'clusters' | 'design_artifacts' | 'prds' | 'ax_reports' }`
- 해당 테이블의 `is_stale = false`로 설정 (AI 재실행 없이 경고만 해제)
- **참고**: `current_stage`와 무관하게 퍼실리테이터가 언제든 stale 경고를 디스미스할 수 있음 (이전 단계 수정을 인지한 상태에서 기존 결과를 유지하기로 판단)
- 응답: `{ data: { success: true } }`

### 2-4. API Route: 프로세스 그래프 CRUD (Context 단계)

#### 프로세스 노드

`src/app/api/workshops/[id]/process-steps/route.ts`:

**GET**: `withAuth`로 세션 검증. 해당 워크샵의 모든 프로세스 노드를 order_index 순으로 반환.

**POST**: `withAuth`로 세션 검증 + **Active 편집자 검증** (editing_locks에서 현재 editor_id 확인). `current_stage` ≥ context일 때 편집 가능 (completed이면 403). Zod 스키마로 body 검증: `{ name: string(1~100), description?: string(max 500), node_type: 'task'|'exclusive_gateway'|'parallel_gateway'|'start_event'|'end_event'|'intermediate_event'|'sub_process', order_index: number, position_x?: number, position_y?: number, width?: number, height?: number, lane_id?: uuid, duration_info?: string, tools_systems?: string, volume_info?: string }`. 최대 50개 제한 API에서 count 검증. **stale 전파**: `current_stage > 'context'`이면 `propagateStale(workshopId, 'context')` 호출. 응답: `{ data: processStep }`.

`src/app/api/workshops/[id]/process-steps/[stepId]/route.ts`:

**PATCH**: `withAuth` + Active 편집자 검증. `current_stage` ≥ context (completed이면 403). Zod 스키마로 body 검증: `{ name?, description?, node_type?, order_index?, position_x?, position_y?, width?, height?, lane_id?, duration_info?, tools_systems?, volume_info? }`. **stale 전파**: `current_stage > 'context'`이면 `propagateStale(workshopId, 'context')` 호출. 응답: `{ data: processStep }`.

**DELETE**: `withAuth` + Active 편집자 검증. `current_stage` ≥ context (completed이면 403). 연결된 process_edges는 CASCADE 삭제. **stale 전파**: `current_stage > 'context'`이면 `propagateStale(workshopId, 'context')` 호출. 응답: `{ data: { success: true } }`.

#### 프로세스 간선

`src/app/api/workshops/[id]/process-edges/route.ts`:

**GET**: `withAuth`. 해당 워크샵의 모든 간선 반환.

**POST**: `withAuth` + Active 편집자 검증. `current_stage` ≥ context (completed이면 403). Zod: `{ source_node_id: uuid, target_node_id: uuid, label?: string(max 50), edge_type?: 'sequence'|'message'|'association' }`. source/target 존재 확인. 셀프 루프 방지 (source === target → 400). **stale 전파**: `current_stage > 'context'`이면 `propagateStale(workshopId, 'context')` 호출. 응답: `{ data: edge }`.

`src/app/api/workshops/[id]/process-edges/[edgeId]/route.ts`:

**PATCH**: `withAuth` + Active 편집자 검증. `current_stage` ≥ context (completed이면 403). Zod: `{ label?, edge_type? }`. **stale 전파**: `current_stage > 'context'`이면 `propagateStale` 호출.

**DELETE**: `withAuth` + Active 편집자 검증. `current_stage` ≥ context (completed이면 403). **stale 전파**: `current_stage > 'context'`이면 `propagateStale` 호출.

#### Swimlane

`src/app/api/workshops/[id]/process-lanes/route.ts`:

**GET**: `withAuth`. 해당 워크샵의 모든 Swimlane을 order_index 순으로 반환.

**POST**: `withAuth` + Active 편집자 검증. `current_stage` ≥ context (completed이면 403). Zod: `{ name: string(1~50), order_index: number, color?: string }`. 최대 10개 제한 검증. **stale 전파**: `current_stage > 'context'`이면 `propagateStale` 호출. 응답: `{ data: lane }`.

`src/app/api/workshops/[id]/process-lanes/[laneId]/route.ts`:

**PATCH**: `withAuth` + Active 편집자 검증. `current_stage` ≥ context (completed이면 403). Zod: `{ name?, order_index?, color? }`. **stale 전파**: `current_stage > 'context'`이면 `propagateStale` 호출.

**DELETE**: `withAuth` + Active 편집자 검증. `current_stage` ≥ context (completed이면 403). 소속 노드의 lane_id를 null로 SET (ON DELETE SET NULL). **stale 전파**: `current_stage > 'context'`이면 `propagateStale` 호출.

#### 프로세스 그래프 통합 조회

`src/app/api/workshops/[id]/process-graph/route.ts`:

**GET**: `withAuth`. process_steps + process_edges + process_lanes + editing_locks를 한 번에 반환. React Flow `{nodes, edges}` 형식으로 변환하여 응답: `{ data: { nodes: [...], edges: [...], lanes: [...], editingLock: {...} | null } }`.

#### 편집 잠금 (Active/Sleep)

`src/app/api/workshops/[id]/editing-locks/route.ts`:

**GET**: `withAuth`. 현재 워크샵의 모든 editing_locks 상태 반환.

**POST**: `withAuth`. 잠금 획득/전환. Zod: `{ resource_type: 'process_graph'|'design_artifacts' }`.
- 배타적 1인 잠금: 해당 resource_type에 대해 한 명만 Active 가능
- 기존 잠금이 있으면 editor_id를 현재 참석자로 업데이트 (전환). 없으면 새 잠금 INSERT
- **퍼실리테이터 "회수" 우선순위**: 퍼실리테이터의 POST 요청은 즉시 잠금 전환 (1초 카운트다운 무시). 참석자의 POST 요청 중 퍼실리테이터가 먼저 POST하면 참석자 요청은 409 반환
- 잠금 확인 SQL: `SELECT * FROM editing_locks WHERE workshop_id = :wid AND resource_type = :type FOR UPDATE` (행 잠금으로 동시 요청 방지)
- 잠금 획득 SQL: `INSERT INTO editing_locks (workshop_id, resource_type, editor_id, acquired_at) VALUES (:wid, :type, :pid, now()) ON CONFLICT (workshop_id, resource_type) DO UPDATE SET editor_id = :pid, acquired_at = now()`
- 전환 시 이전 편집자에게 Realtime으로 알림 (클라이언트에서 Toast "편집 권한이 [이름]에게 이전되었습니다")
- 응답: `{ data: editingLock }`

`src/app/api/workshops/[id]/editing-locks/[lockId]/route.ts`:

**DELETE**: `withAuth` (본인) 또는 `withFacilitator` (강제 회수). 잠금 해제 (DELETE). 응답: `{ data: { success: true } }`.

#### 편집 잠금 생명주기 (자동 획득 → heartbeat → 타임아웃)

1. **자동 잠금 획득**: Context 단계 페이지(`src/app/workshop/[id]/page.tsx`의 context 분기)에서 `useEffect`로 퍼실리테이터인 경우 자동으로 `POST /api/workshops/:id/editing-locks` 호출. 이미 Active인 편집자가 있으면 Skip (퍼실리테이터가 아닌 다른 사용자가 편집 중이면 Sleep 상태로 진입)
2. **Presence Heartbeat**: 클라이언트는 10초 주기로 Supabase Presence `track()` 호출. payload: `{ participant_id, display_name, is_editing: true/false }`
3. **타임아웃 감지**: Active 편집자의 presence leave 이벤트 수신 시점을 기준으로 **30초 타이머를 시작**한다. 30초 이내에 해당 편집자가 presence rejoin하면 타이머를 취소한다. 30초 만료 시: 다음 잠금 요청자가 `editing_locks.acquired_at`과 presence 목록을 확인하여 stale lock을 판정한다. 구체적으로: (1) presence leave 이벤트 → 클라이언트에서 `setTimeout(30_000)` 시작 (2) 타이머 만료 → 잠금 요청 시 서버에서 `acquired_at + 40초 < now()` AND presence 목록에 lock_holder 부재 확인 (3) 조건 충족 시 기존 lock DELETE + 새 lock INSERT. heartbeat 10초 주기이므로 최악 40초(30초 타임아웃 + 10초 heartbeat 간격)가 실제 타임아웃 상한이다
4. **페이지 이탈 시**: `beforeunload` 이벤트에서 `DELETE /api/workshops/:id/editing-locks/:lockId` 호출 (best-effort). Presence는 WebSocket 끊김으로 자동 leave

#### is_processing_since Stale Lock 감지

AI API Route(`/api/ai/*`)에서 is_processing 플래그 확인 시:
```
if (workshop.is_processing) {
  const sinceDiff = Date.now() - new Date(workshop.is_processing_since).getTime()
  if (sinceDiff > 5 * 60 * 1000) {
    // 5분 초과: stale lock → 자동 복구
    await supabase.from('workshops').update({
      is_processing: false,
      is_processing_since: null
    }).eq('id', workshopId)
    // 계속 진행 (현재 요청이 새로 처리)
  } else {
    return NextResponse.json({ error: { code: 'PROCESSING', message: 'AI가 이미 처리 중입니다' } }, { status: 409 })
  }
}
```

### 2-3. Context 단계 UI 컴포넌트

`src/components/context/ProcessGraphEditor.tsx` — React Flow 기반 BPMN 그래프 에디터:
- `@xyflow/react`의 `<ReactFlow>` + `<MiniMap>` + `<Controls>` + `<Background>`
- BPMN 커스텀 노드 8종 등록 (nodeTypes 맵)
- Active 편집자: 노드 드래그/연결/추가/삭제 가능
- Sleep 상태: nodesDraggable={false}, nodesConnectable={false}, elementsSelectable={false}
- `isValidConnection`으로 BPMN 연결 규칙 검증
- **elkjs 자동 레이아웃**: "Auto Layout" 버튼 클릭 시 `elkjs`를 사용하여 노드를 자동 배치한다. 레이아웃 알고리즘: `layered` (방향: left-to-right). Swimlane 내 노드는 그룹별로 정렬. 레이아웃 적용 후 React Flow의 `fitView()`를 호출하여 전체 그래프가 화면에 맞도록 조정한다.
- UI_GUIDE.md의 Context 그래프 에디터 디자인 참조

`src/components/context/nodes/` — BPMN 커스텀 노드 컴포넌트 7종 + Swimlane:
- `TaskNode.tsx`, `StartEventNode.tsx`, `EndEventNode.tsx`
- `ExclusiveGatewayNode.tsx`, `ParallelGatewayNode.tsx`
- `IntermediateEventNode.tsx`, `SubProcessNode.tsx`
- `SwimlaneNode.tsx` — parentId 기반 자식 노드 그룹핑

`src/components/context/NodeDetailPanel.tsx` — 노드 클릭 시 우측 슬라이드인 상세 편집 패널:
- Task: 이름, 설명, 소요시간, 사용도구, 처리량, Swimlane 선택
- Gateway: 이름, 분기 조건 설명
- Event: 이름, 이벤트 유형 설명
- Active 편집자만 편집 가능

`src/components/context/LaneManager.tsx` — Swimlane 관리 (추가/편집/삭제/순서변경)

`src/components/context/EditingLockBar.tsx` — Active/Sleep 편집 잠금 상태 바:
- Active 상태: "✏️ [이름] 편집 중" + 퍼실리테이터에게 [회수] 버튼
- Sleep 상태: "[이름]이 편집 중입니다" + [편집 참여] 버튼
- 1초 카운트다운 + Toast 알림 패턴

`src/stores/process-graph.ts` — Zustand processGraphStore:
- nodes, edges, lanes, editingLock, isActiveEditor 상태 관리
- onNodesChange, onEdgesChange 핸들러 (React Flow 연동)
- acquireLock, releaseLock 액션
- syncFromRealtime 핸들러

### 3. Zustand 워크샵 스토어

`src/stores/workshop.ts`:

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

const STAGE_ORDER = ['context','gather','cluster','vote','design','generate','report','completed'] as const
type WorkshopStage = typeof STAGE_ORDER[number]

interface WorkshopStore {
  workshop: Workshop | null
  participants: Participant[]
  currentParticipant: Participant | null
  isFacilitator: boolean
  viewingStage: WorkshopStage | null  // 현재 사용자가 보고 있는 단계 (클라이언트 전용)

  setWorkshop(workshop: Workshop): void
  setParticipants(participants: Participant[]): void
  setCurrentParticipant(participant: Participant): void
  updateStage(stage: WorkshopStage): void  // current_stage Realtime 수신 시: viewingStage도 함께 이동
  setViewingStage(stage: WorkshopStage): void  // StageNav 클릭: viewingStage만 변경
  addParticipant(participant: Participant): void
  refetchAll(workshopId: string): Promise<void>  // 재연결 시 전체 상태 재조회
}

export const useWorkshopStore = create<WorkshopStore>()(
  devtools(
    (set, get) => ({
      workshop: null, participants: [], currentParticipant: null,
      isFacilitator: false, viewingStage: null,

      setWorkshop: (workshop) => set({
        workshop, viewingStage: workshop.current_stage,
      }),

      setViewingStage: (stage) => {
        const ws = get().workshop
        if (!ws) return
        const currentIdx = STAGE_ORDER.indexOf(ws.current_stage)
        const targetIdx = STAGE_ORDER.indexOf(stage)
        if (targetIdx <= currentIdx) set({ viewingStage: stage })
        // 초과 단계는 무시
      },

      updateStage: (stage) => set((state) => ({
        workshop: state.workshop ? { ...state.workshop, current_stage: stage } : null,
        viewingStage: stage, // 자동 이동
      })),

      // ... 나머지 액션 구현
    }),
    { name: 'workshop-store' }  // DevTools 식별자
  )
)
```

> **Zustand 미들웨어 참고**: `devtools`는 개발 중 Redux DevTools에서 상태 변화를 추적할 수 있다. `persist`는 사용하지 않는다 — Realtime CDC와 API 재조회가 상태의 정본(source of truth)이므로 localStorage 영속화는 오히려 스테일 데이터 문제를 유발한다.

- 초기값: 페이지 로드/새로고침 시 `viewingStage = workshop.current_stage`
- `setViewingStage`: `current_stage` 이하 단계만 허용. 초과 단계는 무시
- `updateStage`: Realtime으로 `current_stage` 전진 수신 시 `viewingStage`도 새 `current_stage`로 자동 이동 (전체 참여자를 새 단계로 안내)
- `workshop/[id]/page.tsx`의 stage switch는 `viewingStage`를 기준으로 렌더링

### 4. Realtime 구독 설정

`src/app/workshop/[id]/layout.tsx`에 Supabase Realtime 구독을 설정하라:

- **Error Boundary**: workshop/[id] 레이아웃에 React Error Boundary를 감싸서, 하위 컴포넌트(React Flow, tldraw 등) 예외 시 전체 페이지 대신 폴백 UI("문제가 발생했습니다" + 새로고침 버튼)를 표시한다. `src/components/common/ErrorBoundary.tsx`를 class component로 생성하라 (React Error Boundary는 class component 필수). 이 step에서 반드시 추가해야 Step 4 이후 tldraw/React Flow 크래시가 전체 앱을 깨뜨리지 않는다.

- `workshop:{id}` 채널 구독: workshops 테이블의 UPDATE 이벤트 감지
  - current_stage 변경 시 workshopStore.updateStage() 호출
- `process_steps:{id}` 채널 구독: process_steps 테이블의 INSERT/UPDATE/DELETE 이벤트 감지
  - Context 단계에서 프로세스 노드 변경사항 실시간 반영
- `process_edges:{id}` 채널 구독: process_edges 테이블의 INSERT/UPDATE/DELETE 이벤트 감지
  - 프로세스 간선 변경사항 실시간 반영
- `process_lanes:{id}` 채널 구독: process_lanes 테이블의 INSERT/UPDATE/DELETE 이벤트 감지
  - Swimlane 변경사항 실시간 반영
- `editing_locks:{id}` 채널 구독: editing_locks 테이블의 INSERT/UPDATE/DELETE 이벤트 감지
  - Active/Sleep 편집 잠금 상태 변경 실시간 반영
- `presence:{id}` 채널 구독: 참석자 온라인 상태 추적
  - 접속/퇴장 시 참석자 목록 UI 업데이트
- layout 언마운트 시 구독 해제 (cleanup)

**Realtime CDC 메시지 순서 및 중복 처리**:
- **순서 보장**: Supabase Realtime은 PostgreSQL WAL(Write-Ahead Log) 기반으로 동일 테이블 내 이벤트는 커밋 순서로 전달된다. 테이블 간 이벤트 순서는 보장되지 않으나, Zustand 스토어가 테이블별로 독립 관리하므로 문제없다.
- **중복 이벤트 처리**: 재연결 경계에서 Supabase가 중복 CDC 이벤트를 전송할 수 있다. Zustand 스토어의 syncFromRealtime 핸들러는 **멱등(idempotent) 업데이트**로 구현한다:
  - INSERT: 동일 ID 이미 존재 시 무시 (boardStore.pendingNoteIds 패턴 참조)
  - UPDATE: 동일 ID의 데이터를 덮어쓰기 (last-write-wins)
  - DELETE: 존재하지 않는 ID 삭제 시 무시
- **채널별 에러 처리**: 11개 채널 중 개별 채널 오류 시 해당 채널만 재구독. 전체 재페치는 모든 채널이 `SUBSCRIBED`로 복구된 후에만 실행한다. 개별 채널 오류는 로그만 기록하고, 3회 연속 실패 시 전체 Toast 경고로 에스컬레이트.
- **WebSocket 재연결 전략**:
  - Supabase Realtime 클라이언트는 내장 자동 재연결(exponential backoff)을 수행한다.
  - 채널 상태 변경 감지: `channel.on('system', { event: 'reconnect' }, handler)` 또는 channel status 콜백으로 `SUBSCRIBED` 상태 복구를 감지한다.
  - 재연결 성공(`SUBSCRIBED`) 시 **모든 Zustand 스토어의 refetchAll() 호출**: workshopStore, boardStore, voteStore, processGraphStore 등 각 스토어에서 API 재조회 → 상태 덮어쓰기. 이렇게 하면 재연결 도중 유실된 CDC 이벤트를 복구한다.
  - 재연결 실패 3회 연속 시: Toast "연결이 불안정합니다. 페이지를 새로고침해주세요" (warning 레벨, 7초 표시). 자동 새로고침은 하지 않는다.
  - 구현 패턴:
    ```ts
    const channel = supabase.channel(`workshop:${workshopId}`)
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // 초기 구독 또는 재연결 성공 → 전체 재페치
        workshopStore.getState().refetchAll(workshopId)
        boardStore.getState().refetchAll(workshopId)
        // ...
      }
      if (status === 'CHANNEL_ERROR') {
        reconnectFailCount++
        if (reconnectFailCount >= 3) {
          toast.warning('연결이 불안정합니다. 페이지를 새로고침해주세요')
        }
      }
    })
    ```

### 5. 사이드바 컴포넌트

`src/components/workshop/StageNav.tsx` — 단계 네비게이션:
- 7단계 표시 (프로세스, 수집, 클러스터, 투표, 설계, PRD, 보고서)
- `viewingStage` 하이라이트 (현재 보고 있는 단계). `current_stage` 이하 단계만 클릭 가능
- `current_stage` 초과 단계는 비활성 (아직 도달하지 못한 단계)
- 단계 클릭 시 `setViewingStage()` 호출 (UI 네비게이션만, `current_stage` 불변)
- 퍼실리테이터에게만 "다음 단계로" 버튼 표시
- 단계 전환 버튼은 아직 ConfirmModal을 붙이지 않고, Step 9에서 최종 보완한다.
- UI 가이드의 StageNav 디자인 참조

`src/components/workshop/ParticipantList.tsx` — 참석자 목록:
- 온라인 참석자 표시 (이름 + 역할)
- 온라인 상태 표시 (녹색 dot)
- 퍼실리테이터 표시 (crown 아이콘 등)

### 6. 워크샵 메인 페이지 업데이트

`src/app/workshop/[id]/page.tsx`를 수정하여 **viewingStage**에 따라 적절한 placeholder 컴포넌트를 렌더링하라:

```typescript
// workshopStore.viewingStage 기준 (current_stage가 아님)
switch (viewingStage) {
  case 'context': return <ProcessGraphEditor /> // React Flow BPMN 그래프 에디터
  case 'gather': return <div>포스트잇 보드 (Step 4에서 구현)</div>
  case 'cluster': return <div>클러스터 뷰 (Step 5에서 구현)</div>
  case 'vote': return <div>투표 화면 (Step 6에서 구현)</div>
  case 'design': return <div>AX 설계 (Step 7에서 구현)</div>
  case 'generate': return <div>PRD 생성 (Step 8에서 구현)</div>
  case 'report': return <div>종합 보고서 (Step 8에서 구현)</div>
  case 'completed': return <div>워크샵 완료 (Step 9에서 구현)</div>
}
```

## Acceptance Criteria

```bash
npm run lint    # lint 에러 없음
npm run typecheck # 타입 검사 통과
npm run test    # 테스트 통과
npm run build   # 컴파일 에러 없음
```

- GET /api/workshops/:id가 워크샵 + 참석자 정보를 반환하는지 확인
- PATCH /api/workshops/:id로 단계 전진이 되는지 확인
- 비퍼실리테이터가 단계 전진을 시도하면 403이 반환되는지 확인
- 역방향 단계 전진 (예: vote→gather)이 거부되는지 확인 (전진만 가능. UI 네비게이션은 자유이동이지만 current_stage 전진은 순방향만)
- report→completed 전환이 허용되고 completed 이후 수정이 거부되는지 확인

## 금지사항

- 포스트잇, 투표 등 다른 기능의 API/UI를 이 step에서 구현하지 마라
- Realtime 구독에서 notes, votes 등 다른 테이블을 구독하지 마라. 이 step에서는 workshops + process_steps + process_edges + process_lanes + editing_locks + presence만 구독
- 단계 전진 시 데이터 검증(예: 포스트잇이 있어야 클러스터링 가능)은 이 step에서 하지 마라. 단순 순서 검증만 수행
- **자유 네비게이션**: UI에서 `current_stage` 이하의 단계를 자유롭게 이동 가능하지만, `current_stage` 자체를 전진시키는 PATCH는 순방향만 허용
