# Datasets

이 디렉토리는 Workshop Agent 개발/테스트/분석에 사용할 로컬 데이터셋 등록 정보를 관리한다.

## 등록된 데이터셋

| Dataset | Path | Format | Rows | Notes |
|---------|------|--------|------|-------|
| Nemotron Persona KO-KR | `datasets/nemotron-persona-ko-kr` | Parquet | 1,000,000 | symlink로 원본 연결 |

## 운영 원칙

- 대용량 원본 파일은 git에 직접 넣지 않는다.
- 원본 파일은 symlink 또는 외부 경로 manifest로 등록한다.
- 실제 사용자처럼 보이는 profile/persona 데이터는 synthetic 여부와 관계없이 민감 데이터처럼 취급한다.
- 앱 코드에서 바로 원본 전체를 읽지 말고, 필요한 샘플 fixture를 별도로 추출해 사용한다.
