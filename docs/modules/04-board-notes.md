# M4 Board & Notes

## 책임

참석자 의견을 tldraw 캔버스와 `notes` 테이블에 동시에 저장하고, AI 파이프라인이 사용할 정규 데이터를 제공한다.

## 소유 범위

- `WhiteboardCanvas`
- `StickyNoteShape`
- `BoardToolbar`
- `boardStore`
- `/api/notes*`
- notes CRUD
- reactions
- tldraw shape id와 note id 매핑
- Yjs/y-supabase provider integration

## 소유 데이터

- `notes`
- Yjs board document

## 소유하지 않는 것

- 클러스터 생성과 note.cluster_id 배정 알고리즘: M5
- 투표: M6
- stage transition: M2
- canvas-level connection recovery policy: M3

## 계약

- shape.id = note.id를 유지한다.
- notes 테이블은 AI 파이프라인의 정규 데이터 소스다.
- gather 단계에서만 notes 생성/수정/삭제 가능하다.
- 작성자만 수정 가능하다.
- 작성자 또는 퍼실리테이터만 삭제 가능하다.
- cluster 이후에는 read-only board로 렌더링한다.
- 사용자 입력 텍스트는 텍스트 노드로 렌더링한다.

## 확장 포인트

- note categories 확장
- comment/thread on note
- manual cluster drag and drop
- import/export board snapshot
- board minimap
- note templates

## 테스트

- create/update/delete API stage lock
- author/facilitator permission
- 200 note limit
- boardStore optimistic rollback
- Yjs provider cleanup
- shape/note id consistency

## 운영 고려사항

- Yjs document와 notes 테이블이 불일치하면 notes 테이블을 기준으로 AI를 수행한다.
- 복구 도구를 만들 때는 note id와 shape id 매핑을 우선 점검한다.
