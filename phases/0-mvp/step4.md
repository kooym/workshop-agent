# Step 4: realtime-board

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — tldraw/Yjs 동기화 전략, 포스트잇 API, boardStore 패턴
- `/docs/ADR.md` — ADR-012 (tldraw 화이트보드 선택)
- `/docs/PRD.md` — Stage 1: 수집 (Gather) 전체 기능
- `/docs/UI_GUIDE.md` — StickyNoteShape, 화이트보드 레이아웃, 포스트잇 색상
- `/docs/SPEC_AUDIT.md` — tldraw/Yjs와 DB 이중 저장 정합성 결정
- `/docs/MODULE_MAP.md`
- `/docs/modules/03-realtime-collaboration.md`
- `/docs/modules/04-board-notes.md`
- `/docs/modules/08-ui-experience-system.md`

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라:

- `/src/app/workshop/[id]/layout.tsx` — Realtime 구독 패턴 참조
- `/src/stores/workshop.ts` — Zustand 스토어 패턴 참조
- `/src/types/note.ts`
- `/src/lib/api/middleware.ts`
- `/src/lib/api/validators.ts`
- `/src/lib/supabase/server.ts`

## 작업

tldraw + Yjs 기반 실시간 포스트잇 화이트보드를 구현하라. Stage 1(수집 단계)의 핵심 기능이다.

이 step은 새 기능 구현이므로 테스트를 먼저 작성한다. API stage lock, 소유권 검증, boardStore의 Realtime 동기화 동작을 구현 전에 테스트로 고정하라.

### 1. tldraw/Yjs 의존성 확인

Step 0에서 설치한 `tldraw`, `yjs`, `y-supabase`를 사용한다. 누락되어 있으면 이 step에서 설치하되, 새 보드/CRDT 라이브러리를 임의로 추가하지 마라.

`y-supabase`는 안정성 리스크가 있으므로 직접 사용부를 여러 파일에 흩뿌리지 말고 provider adapter 모듈로 감싼다. 향후 다른 Yjs/Supabase provider로 교체할 수 있어야 한다.

### 2. 포스트잇 API Routes

`src/app/api/notes/route.ts`:

- **GET** `?workshop_id=:id` — 워크샵의 모든 포스트잇 조회. query를 Zod로 검증하고 `withAuth` 미들웨어로 세션을 검증한다.
- **POST** — 포스트잇 생성. 요청 body를 `createNoteSchema`로 Zod 검증: `{ workshop_id, id?, content, color, position_x, position_y }`.
  - `id`는 tldraw shape.id = note.id 매핑을 위해 클라이언트가 생성한 UUID를 허용한다. 없으면 서버에서 생성한다.
  - participant_id는 세션에서 추출한다.
  - 현재 워크샵 stage가 `gather`가 아니면 403 또는 409를 반환한다.
  - 워크샵당 포스트잇 200개 제한을 INSERT 전 트랜잭션으로 검증한다.

`src/app/api/notes/[id]/route.ts`:

- **PATCH** — 포스트잇 수정. 수정 가능 필드: `content`, `color`, `position_x`, `position_y`.
  - gather 단계에서만 허용한다.
  - 원래 작성자만 수정 가능하다. 퍼실리테이터도 타인의 포스트잇 수정은 불가하다.
- **DELETE** — 포스트잇 삭제.
  - gather 단계에서만 허용한다.
  - 작성자 본인 또는 퍼실리테이터만 삭제 가능하다.

`src/app/api/notes/[id]/react/route.ts`:

- **POST** — 좋아요 리액션. notes.reactions 카운트 +1.
- 중복 리액션 방지는 MVP에서 생략하지만, gather 이후에도 반응을 허용할지 여부를 API에서 명확히 결정하라. 기본값은 gather 단계에서만 허용한다.

### 3. Zustand 보드 스토어

`src/stores/board.ts`:

```typescript
interface BoardStore {
  notes: Note[]
  pendingNoteIds: Set<string>

  setNotes(notes: Note[]): void
  syncFromRealtime(eventType: string, note: Note): void
  markPending(id: string): void
  clearPending(id: string): void
  addNote(note: Note): void
  updateNote(id: string, data: Partial<Note>): void
  removeNote(id: string): void
  incrementReaction(id: string): void
}
```

Optimistic Update 규칙:
- tldraw shape 생성 시 UUID를 먼저 만들고, 같은 id로 notes API에 POST한다.
- API 성공 전에는 `pendingNoteIds`로 자체 Realtime 이벤트 중복 반영을 막는다.
- API 실패 시 tldraw shape와 boardStore note를 모두 롤백하고 Toast 에러를 표시한다.
- DB는 AI 파이프라인의 정규 데이터 소스이므로, tldraw shape만 있고 notes row가 없는 상태를 방치하지 마라.

### 4. Realtime/Yjs 구독 추가

`src/app/workshop/[id]/layout.tsx`의 Realtime 설정에 notes 채널 구독을 추가하라:

- `notes:{workshop_id}` 채널: notes 테이블의 INSERT/UPDATE/DELETE 이벤트
- 이벤트 수신 시 boardStore.syncFromRealtime() 호출
- 본인이 방금 생성/수정한 이벤트는 pending id로 무시한다.

Yjs 문서 동기화는 WhiteboardCanvas 내부에서 y-supabase 어댑터로 설정한다:
- 채널 이름은 워크샵 id 기반으로 안정적으로 생성한다.
- Yjs provider cleanup을 컴포넌트 언마운트에서 수행한다.
- WebSocket 재연결 후 notes API 재조회로 DB 정규 데이터와 보드 상태를 다시 맞춘다.

### 5. 보드 UI 컴포넌트

`src/components/board/WhiteboardCanvas.tsx`:
- `tldraw`를 dynamic import 또는 client component boundary 안에서만 로딩한다.
- `tldraw/tldraw.css`를 import하고, 부모 컨테이너에 명시적인 크기를 준다.
- tldraw asset hosting은 MVP에서는 기본 CDN을 허용하되, 운영 hardening 시 self-hosting을 검토한다.
- Yjs/y-supabase provider를 연결한다.
- gather 단계가 아니거나 completed 상태면 read-only 모드로 렌더링한다.
- tldraw shape create/change/delete 이벤트를 notes API로 비동기 동기화한다.

`src/components/board/StickyNoteShape.tsx`:
- UI 가이드의 포스트잇 디자인을 tldraw 커스텀 shape로 구현한다.
- shape props는 최소 `noteId`, `content`, `color`, `participantId`, `participantName`, `reactions`를 포함한다.
- 사용자 입력 텍스트는 텍스트 노드로만 렌더링하고 `dangerouslySetInnerHTML`을 사용하지 않는다.

`src/components/board/BoardToolbar.tsx`:
- 포스트잇 색상 선택(red/blue/green/yellow)
- 새 포스트잇 생성 버튼
- 현재 권한/단계가 쓰기 불가이면 비활성화
- 아이콘은 lucide-react를 사용하고, alert()는 사용하지 않는다.

`src/components/board/Board.tsx`:
- 서버에서 받은 초기 notes를 boardStore에 주입한다.
- notes가 없을 때 EmptyState를 표시한다.
- tldraw 캔버스가 비어 보이지 않도록 초기 viewport와 기본 안내 상태를 안정적으로 설정한다.

### 6. Stage 1 페이지 연결

`src/app/workshop/[id]/board/page.tsx` 또는 메인 `page.tsx`의 gather 분기:
- 서버 컴포넌트에서 초기 notes fetch
- WhiteboardCanvas, BoardToolbar 렌더링
- 현재 participant와 isFacilitator 정보를 전달

## Acceptance Criteria

```bash
npm run lint    # lint 에러 없음
npm run typecheck # 타입 검사 통과
npm run test    # 테스트 통과
npm run build   # 컴파일 에러 없음
```

- tldraw 캔버스에서 포스트잇 생성/수정/이동/삭제가 가능하고 notes 테이블에도 동기화되는지 확인
- 다른 브라우저 탭에서 Yjs를 통해 포스트잇 shape가 실시간으로 나타나는지 확인
- notes Realtime 이벤트가 boardStore에 반영되고, optimistic update와 중복되지 않는지 확인
- 본인 포스트잇만 수정 가능하고, 본인 또는 퍼실리테이터만 삭제 가능한지 확인
- cluster 단계 이후 포스트잇 CRUD가 API에서 차단되는지 확인

## 금지사항

- tldraw/Yjs 대신 단순 div 카드 보드로 대체하지 마라. 이유: Gather 단계 멀티플레이어 캔버스가 MVP 핵심이다.
- 클러스터링 관련 로직을 이 step에서 구현하지 마라.
- 이미지/파일 첨부 기능을 추가하지 마라.
