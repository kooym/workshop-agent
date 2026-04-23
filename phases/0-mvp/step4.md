# Step 4: realtime-board

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 포스트잇 API, 실시간 동기화 전략, boardStore, Optimistic Updates 패턴
- `/docs/PRD.md` — Stage 1: 수집 (Gather) 전체 기능
- `/docs/UI_GUIDE.md` — 포스트잇(StickyNote) 컴포넌트, 포스트잇 색상, 보드 레이아웃, 애니메이션

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라:

- `/src/app/workshop/[id]/layout.tsx` — Realtime 구독 패턴 참조
- `/src/stores/workshop.ts` — Zustand 스토어 패턴 참조
- `/src/types/note.ts`
- `/src/lib/supabase/server.ts`

## 작업

실시간 포스트잇 보드를 구현하라. Stage 1(수집 단계)의 핵심 기능이다.

### 1. 포스트잇 API Routes

`src/app/api/notes/route.ts`:

- **GET** `?workshop_id=:id` — 워크샵의 모든 포스트잇 조회. 세션 검증 필수.
- **POST** — 포스트잇 생성. 요청: `{ workshop_id, content, color }`. participant_id는 세션에서 추출. position_x/y는 서버에서 랜덤 배치 또는 그리드 기반 자동 배치.

`src/app/api/notes/[id]/route.ts`:

- **PATCH** — 포스트잇 수정. 수정 가능 필드: `content`, `color`, `position_x`, `position_y`. 본인 작성 포스트잇만 수정 가능 (participant_id 검증).
- **DELETE** — 포스트잇 삭제. 본인 작성 포스트잇만 삭제 가능.

`src/app/api/notes/[id]/react/route.ts`:

- **POST** — 좋아요 리액션. notes.reactions 카운트 +1. 중복 방지는 MVP에서 생략 (단순 카운트 증가).

### 2. Zustand 보드 스토어

`src/stores/board.ts`:

```typescript
interface BoardStore {
  notes: Note[]

  // 서버 동기화
  setNotes(notes: Note[]): void
  syncFromRealtime(eventType: string, note: Note): void

  // Optimistic Updates
  addNote(note: Note): void          // 즉시 UI 추가 → API 호출
  updateNote(id: string, data: Partial<Note>): void  // 즉시 UI 수정 → API 호출
  removeNote(id: string): void       // 즉시 UI 삭제 → API 호출
  incrementReaction(id: string): void
}
```

Optimistic Update 규칙:
- addNote: 임시 ID로 UI에 먼저 추가, API 성공 시 실제 ID로 교체, 실패 시 롤백(삭제)
- updateNote: 이전 상태 백업, UI 즉시 수정, 실패 시 백업으로 롤백
- removeNote: UI에서 즉시 제거, 실패 시 다시 추가

### 3. Realtime 구독 추가

`src/app/workshop/[id]/layout.tsx`의 Realtime 설정에 notes 채널 구독을 추가하라:

- `notes:{workshop_id}` 채널: notes 테이블의 INSERT/UPDATE/DELETE 이벤트
- 이벤트 수신 시 boardStore.syncFromRealtime() 호출
- 본인이 방금 생성/수정한 이벤트는 무시 (optimistic update와 중복 방지)

### 4. 보드 UI 컴포넌트

`src/components/board/Board.tsx` — 포스트잇 보드 메인 컴포넌트:
- notes 배열을 렌더링
- 포스트잇이 없을 때 빈 상태 안내 메시지
- 포스트잇 추가 fade-in 애니메이션

`src/components/board/StickyNote.tsx` — 개별 포스트잇 카드:
- UI 가이드의 포스트잇 디자인 정확히 구현
- 카테고리별 배경색 (red/blue/green/yellow)
- 내용 표시 (최대 200자)
- 하단: 작성자 이름 + 리액션 카운트 + 리액션 버튼
- 본인 포스트잇에만 편집/삭제 버튼 표시

`src/components/board/NoteInput.tsx` — 포스트잇 입력 영역:
- 텍스트 입력 (textarea, 최대 200자)
- 색상 선택 (4색 버튼: 빨강/파랑/초록/노랑)
- 등록 버튼
- 하단 고정 (sticky bottom)

### 5. Stage 1 페이지 연결

`src/app/workshop/[id]/board/page.tsx` (또는 메인 page.tsx의 gather 분기):
- 서버 컴포넌트에서 초기 notes fetch
- Board, NoteInput 클라이언트 컴포넌트 렌더링
- boardStore에 초기 데이터 주입

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # lint 에러 없음
```

- 포스트잇 생성 시 다른 브라우저 탭에서 실시간으로 나타나는지 확인 (Supabase Realtime)
- 포스트잇 삭제 시 다른 탭에서 실시간으로 사라지는지 확인
- 본인 포스트잇만 편집/삭제 가능한지 확인
- 색상 선택이 정상 동작하는지 확인

## 금지사항

- 포스트잇 드래그앤드롭 위치 변경은 이 step에서 구현하지 마라. 이유: MVP에서는 자동 배치로 충분
- 클러스터링 관련 로직을 이 step에서 건드리지 마라
- 이미지/파일 첨부 기능을 추가하지 마라
