# M1 Identity & Access

## 책임

요청자의 신원과 권한을 결정한다. 퍼실리테이터와 참석자의 인증 모델을 분리하고, 모든 API Route가 일관된 권한 경계를 통과하게 한다.

## 소유 범위

- Supabase Auth 기반 퍼실리테이터 회원가입/로그인/로그아웃
- guest participant signed cookie
- `src/lib/session.ts`
- `src/lib/api/middleware.ts`
- `withAuth`, `withFacilitator`
- participant 생성과 세션 복구
- facilitator participant 자동 등록 검증

## 소유 데이터

- `participants`
- guest session cookie
- Supabase Auth session handling

## 소유하지 않는 것

- `projects`, `workshops` 데이터 라이프사이클: M2
- 워크샵 단계 전환 규칙: M2
- Realtime presence 표시 UI: M3/M8
- RLS 세부 SQL 작성: M9 기준, M1/M2와 협업

## 계약

- 참석자는 Supabase Auth를 사용하지 않는다.
- 참석자 쿠키는 `SESSION_SECRET`으로 HMAC 서명한다.
- `SUPABASE_SERVICE_ROLE_KEY`를 세션 서명에 사용하지 않는다.
- `withAuth`는 facilitator Auth 또는 guest signed cookie를 검증한 뒤, 해당 워크샵의 participant 존재까지 확인한다.
- `withFacilitator`는 Supabase Auth 세션과 participants.is_facilitator, workshops.facilitator_id를 함께 확인한다.
- 인증 실패는 401, 권한 실패는 403을 반환한다.

## 확장 포인트

- SSO/Entra ID
- facilitator organization/team 개념
- participant 재참여 병합
- invite code 만료/비활성화
- audit log of admin actions

## 테스트

- signed cookie 생성/검증/위변조 거부
- facilitator login/logout API
- withAuth guest/facilitator 양쪽 경로
- withFacilitator 비퍼실리테이터 403
- completed workshop 신규 참석자 read-only 참여

## 운영 고려사항

- `SESSION_SECRET` rotation은 기존 guest 세션을 무효화할 수 있다.
- Supabase Auth 장애 시 facilitator 작업은 중단되지만, 기존 guest signed cookie 조회는 제한적으로 복구 가능하게 설계한다.
