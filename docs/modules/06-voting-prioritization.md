# M6 Voting & Prioritization

## 책임

참석자의 중요도 판단을 투표 데이터로 수집하고, 결과 공개 정책에 맞게 집계한다.

## 소유 범위

- `/api/votes`
- `/api/votes/results`
- `voteStore`
- `DotVoting`
- `VotingCard`
- `VoteResult`
- results visibility behavior

## 소유 데이터

- `votes`

## 소유하지 않는 것

- `settings.results_visible` 저장 자체: M2
- vote stage transition: M2/M8
- AI 과제 도출: M5
- task/PRD 산출물: M7

## 계약

- vote 단계에서만 투표 생성/취소 가능하다. 단, 자유 네비게이션에서 `current_stage` ≥ vote이면 투표 가능하며, 이후 단계에서 투표 변경 시 design 이하 stale 전파.
- participant별 투표 수는 `workshops.settings.votes_per_person`을 초과할 수 없다.
- `vote_mode`: 'cluster' (클러스터 단위 투표) 또는 'note' (개별 노트 단위 투표). 기본값 'cluster'. **MVP 범위**.
- 동일 대상 중복 투표는 DB unique constraint와 API에서 방어한다.
- `results_visible=false`이면 투표 진행 중 참석자와 퍼실리테이터 모두 결과 수치를 보지 않는다.
- `vote -> design`은 퍼실리테이터의 투표 마감 확인으로 전환되며 최소 1표는 필수 조건이 아니다.

## 확장 포인트

- weighted voting
- vote timer
- anonymous vote mode
- heatmap visualization
- quorum/participation analytics

## 테스트

- vote limit
- duplicate vote conflict
- own vote cancellation
- result visibility hidden/open
- vote stage lock
- result aggregation ordering

## 운영 고려사항

- 결과 공개 설정 오류는 워크샵 신뢰를 해칠 수 있으므로 UI와 API 양쪽 테스트가 필요하다.
- 집계는 MVP에서 실시간 계산, Post-MVP에서 캐싱 가능하다.
