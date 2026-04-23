# Step 2: auth-invite

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — API 설계 섹션 (POST /api/workshops, POST /api/workshops/join)
- `/docs/ADR.md` — ADR-004 (초대 코드 기반 인증)
- `/docs/PRD.md` — F1(워크샵 생성), F2(초대 코드 접속)
- `/docs/UI_GUIDE.md` — 랜딩 페이지 레이아웃

이전 step에서 만들어진 코드를 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라:

- `/src/lib/supabase/client.ts`
- `/src/lib/supabase/server.ts`
- `/src/types/workshop.ts`
- `/src/types/*.ts` (모든 타입 파일)

## 작업

워크샵 생성 + 초대 코드 참여 흐름을 구현하라.

### 1. 초대 코드 생성 유틸리티

`src/lib/utils.ts`에 6자리 영숫자 초대 코드 생성 함수를 작성하라:

```typescript
export function generateInviteCode(): string
// 6자리, 대문자 + 숫자, 혼동 문자(0/O, 1/I/L) 제외
```

### 2. API Route: 워크샵 생성

`src/app/api/workshops/route.ts` — POST 핸들러:

- 요청: `{ title: string, facilitator_name: string, settings?: { anonymous?: boolean, votes_per_person?: number } }`
- 초대 코드 자동 생성 (generateInviteCode)
- workshops 테이블에 INSERT
- participants 테이블에 퍼실리테이터 INSERT (is_facilitator: true)
- 응답: 생성된 workshop 객체 + participant 정보

### 3. API Route: 초대 코드 참여

`src/app/api/workshops/join/route.ts` — POST 핸들러:

- 요청: `{ invite_code: string, name: string, role?: string }`
- invite_code로 workshops 조회
- 존재하지 않으면 404 응답
- participants 테이블에 INSERT (is_facilitator: false)
- 응답: workshop 객체 + participant 정보

### 4. 세션 관리

Supabase Anonymous Auth를 사용하지 않고, 간단한 쿠키 기반 세션을 구현하라:

- 워크샵 생성/참여 시 participant_id와 workshop_id를 HTTP-only 쿠키에 저장
- `src/lib/session.ts`에 세션 읽기/쓰기 헬퍼 함수:

```typescript
export async function setSession(workshopId: string, participantId: string): Promise<void>
export async function getSession(): Promise<{ workshopId: string, participantId: string } | null>
```

### 5. 랜딩 페이지 UI

`src/app/page.tsx`를 UI 가이드의 랜딩 페이지 레이아웃에 맞게 구현하라:

- "Workshop Agent" 제목
- "워크샵 만들기" 버튼 → 클릭 시 모달 열기 (제목, 퍼실리테이터 이름 입력)
- "초대 코드로 참여" — 코드 입력 + 이름 입력 + 참여 버튼
- 워크샵 생성/참여 성공 시 `/workshop/[id]`로 리다이렉트

### 6. 워크샵 메인 페이지 레이아웃

`src/app/workshop/[id]/layout.tsx` — 기본 레이아웃:

- 세션 검증: 쿠키에 해당 workshop의 participant 정보가 없으면 랜딩으로 리다이렉트
- 워크샵 데이터 서버 컴포넌트에서 fetch
- 사이드바 + 메인 캔버스 레이아웃 골격만 잡기

`src/app/workshop/[id]/page.tsx` — 현재 stage에 따라 적절한 뷰를 표시 (이 step에서는 stage 텍스트만 표시)

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # lint 에러 없음
```

- POST /api/workshops가 워크샵을 생성하고 초대 코드를 반환하는지 확인
- POST /api/workshops/join이 유효한 코드로 참여할 수 있는지 확인
- 잘못된 초대 코드로 참여 시 적절한 에러 응답이 오는지 확인

## 금지사항

- Supabase Auth(signUp/signIn)를 사용하지 마라. 이유: 참석자는 일회성 사용자이므로 회원가입 불필요
- 세션에 민감한 정보(API 키 등)를 저장하지 마라
- 포스트잇, 클러스터, 투표 등 다른 기능의 API를 이 step에서 구현하지 마라
