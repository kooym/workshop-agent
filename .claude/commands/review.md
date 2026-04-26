이 프로젝트의 변경 사항을 리뷰하라.

먼저 다음 문서들을 읽어라:
- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`

그런 다음 변경된 파일들을 확인하고, 아래 체크리스트로 검증하라:

## 체크리스트

1. **아키텍처 준수**: ARCHITECTURE.md에 정의된 디렉토리 구조를 따르고 있는가?
2. **기술 스택 준수**: ADR에 정의된 기술 선택을 벗어나지 않았는가?
3. **테스트 존재**: 새로운 기능에 대한 테스트가 작성되어 있는가? (TDD: 테스트가 구현보다 먼저인가?)
4. **CRITICAL 규칙**: CLAUDE.md의 CRITICAL 규칙을 위반하지 않았는가?
   - AI 호출이 API Route 서버사이드에서만 이루어지는가?
   - 시크릿이 클라이언트 코드에 노출되지 않는가?
   - withAuth/withFacilitator로 권한 검증하는가?
   - API 요청 body가 Zod 스키마로 검증되는가?
   - 환경 변수가 src/lib/env.ts를 경유하는가?
   - 참석자 세션 쿠키가 v1: 포맷으로 서명되어 있는가?
   - dangerouslySetInnerHTML이 사용되지 않았는가?
   - 단계별 쓰기 잠금이 API에서 검증되는가?
   - 이전 단계 수정 시 propagateStale이 호출되는가?
5. **빌드 가능**: `npm run lint && npm run typecheck && npm run test && npm run build` 통과하는가?
6. **보안**: Rate Limiting이 필요한 엔드포인트(join/signup/login)에 적용되었는가?

## 출력 형식

| 항목 | 결과 | 비고 |
|------|------|------|
| 아키텍처 준수 (파일 경로) | ✅/❌ | {상세} |
| 기술 스택 준수 | ✅/❌ | {상세} |
| 테스트 존재 (TDD) | ✅/❌ | {상세} |
| CRITICAL 규칙 | ✅/❌ | {상세} |
| Build Gate (lint/typecheck/test/build) | ✅/❌ | {상세} |
| Docker Build | ✅/❌ | {상세} |
| 보안 (Rate Limit/서명) | ✅/❌ | {상세} |

위반 사항이 있으면 수정 방안을 구체적으로 제시하라.
