# Nemotron Persona KO-KR Dataset

## 위치

- 원본: `/Users/youngmokoo/Documents/nemotron-persona-ko-kr-dataset/ko_KR.parquet`
- 프로젝트 등록 경로: `datasets/nemotron-persona-ko-kr/ko_KR.parquet`
- 등록 방식: 원본 파일을 복사하지 않고 symlink로 연결

## 파일 요약

| 항목 | 값 |
|------|----|
| Format | Apache Parquet |
| File size | 2,854,775,231 bytes, 약 2.66 GiB |
| Rows | 1,000,000 |
| Columns | 51 |
| Row groups | 72 |
| Compression | Snappy |
| Created by | parquet-cpp-arrow version 23.0.1 |

## 데이터 성격

한국어 persona/profile 데이터셋으로 보인다. 이름, 성별, 지역, 나이, 결혼/교육/직업/주거/소득/건강 상태, 성격 특성, 관심사, 전문성, 도메인별 persona 텍스트를 포함한다.

실제 사용자 데이터 여부는 파일만으로 확정할 수 없다. 다만 사람처럼 보이는 식별/프로필 필드가 있으므로 개발/테스트 데이터로 사용할 때도 민감 데이터처럼 취급한다.

## 컬럼 그룹

### Identifier & Basic Profile

- `uuid`
- `first_name`
- `middle_name`
- `last_name`
- `sex`
- `age`

### Location

- `street_number`
- `street_name`
- `unit`
- `city`
- `region`
- `district`
- `postcode`
- `country`

### Socioeconomic Profile

- `marital_status`
- `education_level`
- `bachelors_field`
- `occupation`
- `family_type`
- `housing_type`
- `housing_tenure`
- `military_status`
- `economic_activity_status`
- `income_bracket`

### Health & Lifestyle

- `bmi_status`
- `blood_pressure_status`
- `blood_sugar_status`
- `waist_status`
- `smoking_status`
- `drinking_status`

### Personality

- `openness`
- `conscientiousness`
- `extraversion`
- `agreeableness`
- `neuroticism`

### Persona Text

- `cultural_background`
- `skills_and_expertise`
- `skills_and_expertise_list`
- `career_goals_and_ambitions`
- `hobbies_and_interests`
- `hobbies_and_interests_list`
- `professional_persona`
- `finance_persona`
- `healthcare_persona`
- `sports_persona`
- `arts_persona`
- `travel_persona`
- `culinary_persona`
- `persona`
- `detailed_persona`
- `family_persona`

## Workshop Agent에서의 잠재 활용

- 워크샵 참석자/고객 페르소나 샘플 데이터
- AI 출력 품질 테스트용 persona context
- PRD 생성 테스트용 사용자 archetype fixture
- 제품/서비스 시나리오별 synthetic participant seed

## 주의사항

- 원본이 2.66 GiB라 git에 직접 커밋하지 않는다.
- symlink 대상 파일이 이동되면 dataset link가 깨진다.
- Parquet를 읽으려면 `pyarrow`, `duckdb`, `polars` 등 별도 reader가 필요하다.
- 앱 런타임에 직접 로딩하기보다는 필요한 샘플만 별도 fixture로 추출하는 방식을 권장한다.
