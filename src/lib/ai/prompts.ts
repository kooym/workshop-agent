import type { Tables } from '@/lib/supabase/types'
import { compactSerialize, createIdMapper } from '@/lib/ai/utils'

/**
 * AX Engagement 공통 컨텍스트 — 모든 AI 프롬프트에서 참조
 * Interview → Business Envisioning(현재) → Solution → Architecture → Rapid Prototype
 */
const AX_ENGAGEMENT_CONTEXT = [
  '## AX Engagement 프레임워크',
  'AX(Agent Transformation)는 기업의 업무 프로세스를 AI Agent 기반으로 전환하는 컨설팅 방법론입니다.',
  '전체 여정: Interview → **Business Envisioning(현 워크샵)** → Solution Design → Architecture Design → Rapid Prototype',
  '',
  '현재 단계(Business Envisioning)의 목적:',
  '- AS-IS 프로세스의 Pain Point를 참여자 집단지성으로 도출',
  '- Pain Point를 전략적 클러스터로 그룹핑하고 우선순위를 결정',
  '- 상위 과제를 도출하고 AI Agent 기반 TO-BE 프로세스를 설계',
  '- 1개월 내 MVP-PoC/PoV로 실증 가능한 실행 계획 수립',
  '',
  '핵심 제약: 모든 산출물은 후속 단계(Solution/Architecture/Prototype)에서 즉시 활용 가능해야 합니다.',
].join('\n')

/**
 * Strategy Guide MVP — 3종 전략 방향
 */
const STRATEGY_GUIDES = [
  { id: 'A', name: '점진적 자동화', description: '기존 프로세스를 유지하며 반복·수작업 구간만 AI Agent로 대체. 리스크 최소화, 빠른 효과 확인.' },
  { id: 'B', name: '프로세스 재설계', description: 'AI Agent 도입을 전제로 프로세스 전체를 재구성. 병목 제거와 새로운 가치 흐름 창출.' },
  { id: 'C', name: '하이브리드 혁신', description: '핵심 병목은 프로세스 재설계, 나머지는 점진적 자동화. 효과와 리스크의 균형.' },
] as const

type PromptNote = {
  id: string
  content: string
}

export type ExistingClusterPromptInput = Pick<Tables<'clusters'>, 'id' | 'name' | 'summary'> & {
  note_ids: string[]
}

export function buildClusteringPrompt(
  notes: PromptNote[],
  existingClusters: ExistingClusterPromptInput[] = [],
) {
  const system = [
    AX_ENGAGEMENT_CONTEXT,
    '',
    '## 역할',
    '당신은 AX Business Envisioning 워크샵 전문 퍼실리테이터입니다.',
    '참석자들이 작성한 포스트잇(pain point, 개선 아이디어)을 분석하여 3~5개의 전략적 클러스터로 그룹핑합니다.',,
    '',
    '## 클러스터링 원칙',
    '1. MECE (Mutually Exclusive, Collectively Exhaustive): 클러스터 간 중복 없이, 모든 포스트잇이 빠짐없이 분류되어야 합니다.',
    '2. 액션 지향: 클러스터명은 해결해야 할 문제나 개선 영역을 명확히 드러내야 합니다.',
    '3. 투표 친화: 참석자가 우선순위를 판단할 수 있도록, 클러스터 간 차별성이 분명해야 합니다.',
    '4. 적정 규모: 너무 넓은 "기타" 클러스터(포스트잇 1~2개)나 너무 좁은 클러스터(전체의 50% 이상)는 피하세요.',
  ].join('\n')

  const user = [
    '아래 포스트잇을 전략적으로 클러스터링하세요.',
    '반드시 JSON 객체만 반환하고, 마크다운 코드블록이나 설명 문장은 쓰지 마세요.',
    '',
    '## 출력 형식',
    '{"clusters":[{"name":"클러스터명","summary":"요약","rationale":"이 클러스터로 묶은 근거","note_ids":["uuid"]}]}',
    '',
    '## 클러스터 name 작성 규칙 (1~50자)',
    '- "~문제", "~병목", "~비효율", "~개선 필요" 등 pain point 지향으로 작성',
    '- 나쁜 예: "프로세스 관련", "기타 의견" (너무 추상적)',
    '- 좋은 예: "수작업 데이터 입력 병목", "승인 프로세스 지연 문제", "고객 응대 품질 편차"',
    '',
    '## 클러스터 summary 작성 규칙 (1~100자)',
    '- 해당 클러스터의 핵심 이슈를 한 문장으로 요약',
    '- 나쁜 예: "데이터 관련 문제들" (너무 간단)',
    '- 좋은 예: "영업팀 수작업 데이터 입력으로 오류율 15%, 후속 프로세스 지연 유발"',
    '',
    '## 클러스터 rationale 작성 규칙 (1~200자)',
    '- 이 포스트잇들을 하나의 클러스터로 묶은 논리적 근거를 설명',
    '- 공통 키워드, 인과관계, 동일 프로세스 영역 등 그룹핑 기준 명시',
    '',
    '## 분류 규칙',
    '- 모든 포스트잇 ID는 반드시 정확히 하나의 클러스터에만 포함',
    '- 입력에 있는 id만 사용하세요. 새 id를 만들지 마세요.',
    '- 의미가 유사한 포스트잇은 같은 클러스터로, 원인과 결과 관계가 있어도 핵심 주제가 다르면 다른 클러스터로 분리',
    existingClusters.length
      ? '- 기존 클러스터가 있으면 기존 이름과 구조를 최대한 유지하고, 미할당 포스트잇만 적합한 클러스터에 추가하세요. 기존 클러스터에 맞지 않으면 새 클러스터를 생성하세요.'
      : '- 첫 실행이므로 전체 포스트잇을 새 클러스터로 분류하세요.',
    '',
    JSON.stringify(
      {
        existing_clusters: existingClusters,
        notes,
      },
      null,
      2,
    ),
  ].join('\n')

  return { system, user }
}

export type DesignPromptInput = {
  process_graph: {
    nodes: {
      id: string
      name: string
      description: string | null
      node_type: string
      lane_name?: string | null
      duration_info?: string | null
      tools_systems?: string | null
      volume_info?: string | null
    }[]
    edges: {
      source_node_id: string
      target_node_id: string
      label?: string | null
      edge_type: string
    }[]
    lanes: { id: string; name: string }[]
  }
  clusters: {
    id: string
    name: string
    summary: string | null
    vote_count: number
    notes: { content: string; process_step_name?: string | null; vote_count?: number }[]
  }[]
  vote_mode: 'cluster' | 'note'
  workshop_description?: string | null
}

const STRATEGY_GUIDES_DETAILED = [
  {
    name: 'A안: 점진적 자동화',
    strategy: '기존 프로세스를 최대한 유지하면서 반복·단순 업무만 자동화',
    guide: [
      '기존 프로세스 흐름을 최대한 보존하면서, 반복·단순·정형화된 업무만 선별적으로 자동화합니다.',
      '투자 최소, 리스크 최소, 빠른 성과 도출에 초점합니다.',
      '',
      '## A안 설계 방향',
      '- TO-BE 프로세스는 AS-IS와 단계 수/흐름이 유사해야 합니다. 새로운 단계 추가를 최소화하세요.',
      '- 자동화 대상 선별 기준: (1) 정형화된 입출력이 있는 업무, (2) 빈도가 높은 업무, (3) 오류 발생률이 높은 업무',
      '- Agent는 1~3개로 제한하세요. 각 Agent는 좁고 명확한 범위의 업무만 자동화합니다.',
      '- 대부분의 업무는 human 또는 assisted로 유지하고, full automation은 데이터 입력·검증 등에만 적용합니다.',
      '- KPI는 현실적이고 단기(3~6개월) 내 달성 가능한 수치로 설정하세요.',
      '- tasks는 즉시 착수 가능한 Quick Win 중심으로 구성하세요.',
    ].join('\n'),
  },
  {
    name: 'B안: 핵심 Agent 집중',
    strategy: '핵심 pain point에 Agent를 집중 투입하여 높은 ROI 달성',
    guide: [
      '투표/우선순위가 높은 핵심 pain point에 Agent를 집중 투입합니다.',
      '중간 투자, 중간 리스크, 높은 ROI에 초점합니다.',
      '',
      '## B안 설계 방향',
      '- 투표 수가 많은 상위 클러스터의 문제를 집중 해결하는 Agent를 설계하세요.',
      '- TO-BE 프로세스에서 핵심 병목 구간을 재설계하되, 전체 프로세스 골격은 유지합니다.',
      '- Agent는 3~5개로 구성하세요. 각 Agent가 특정 pain point를 직접 해결해야 합니다.',
      '- assisted와 full 자동화를 적절히 혼합하세요 (핵심 영역은 full, 주변 영역은 assisted).',
      '- KPI는 도전적이되 6~12개월 내 달성 가능한 수치로 설정하세요.',
      '- tasks는 pain point 해결 효과가 높은 순서로 우선순위를 매기세요.',
      '- 각 Agent의 ROI를 명시하세요 (시간 절감, 오류 감소, 비용 절감 등).',
    ].join('\n'),
  },
  {
    name: 'C안: 전면 AX 전환',
    strategy: '프로세스를 근본적으로 재설계하여 AI-native 워크플로우 구축',
    guide: [
      'AS-IS 프로세스에 얽매이지 않고, AI-native 관점에서 프로세스를 근본적으로 재설계합니다.',
      '투자 최대, 효과 최대, 장기적 경쟁 우위 확보에 초점합니다.',
      '',
      '## C안 설계 방향',
      '- TO-BE 프로세스는 AS-IS와 상당히 다를 수 있습니다. "이 업무가 처음부터 AI로 설계되었다면?" 관점으로 접근하세요.',
      '- 여러 단계를 하나의 AI 파이프라인으로 통합하거나, 순차 프로세스를 병렬로 전환하세요.',
      '- Agent는 5개 이상으로 구성하세요. Agent 간 오케스트레이션과 자동 핸드오프를 설계하세요.',
      '- full automation 비율을 최대화하되, 고위험 의사결정에는 반드시 human checkpoint를 포함하세요.',
      '- KPI는 혁신적 수치로 설정하세요 (예: 처리 시간 90% 단축, 오류율 95% 감소).',
      '- tasks에는 기술 인프라 구축, 데이터 파이프라인, 변화 관리 등 기반 과제도 포함하세요.',
      '- 장기 로드맵(12~18개월)을 Phase별로 구성하고, 각 Phase의 마일스톤을 명확히 하세요.',
    ].join('\n'),
  },
] as const

export function buildSingleDesignPrompt(strategyIndex: 0 | 1 | 2, input: DesignPromptInput) {
  const sg = STRATEGY_GUIDES_DETAILED[strategyIndex]

  const system = [
    `당신은 AX(Agent Transformation) 컨설턴트이자 AI Agent 아키텍트입니다.`,
    `AS-IS 업무 프로세스 그래프(BPMN 노드/간선/Swimlane 포함)와 pain point 분석 결과를 기반으로, "${sg.name}" 전략의 TO-BE AX 설계안을 작성하세요.`,
    '',
    '## 역할',
    '- AS-IS 프로세스의 비효율과 pain point를 정확히 진단합니다.',
    '- 전략 방향에 맞는 TO-BE 프로세스와 Agent 아키텍처를 설계합니다.',
    '- 구현 가능하고 측정 가능한 과제와 KPI를 도출합니다.',
    '',
    '## 품질 기준',
    '- 모든 텍스트 필드에 구체적이고 실질적인 내용을 작성하세요. 빈 문자열, "TBD", "추후 결정" 금지.',
    '- 숫자/수치가 필요한 곳에는 반드시 구체적 수치를 제시하세요 (예: "50% 단축", "월 200건 처리").',
    '- AS-IS 데이터(duration_info, tools_systems, volume_info)를 TO-BE 설계에 반드시 반영하세요.',
    '',
    '## CRITICAL 문체 규칙',
    '- 모든 텍스트는 개조식(bullet point) 문체로 작성. 설명조 문장(~합니다, ~입니다, ~있습니다) 절대 금지.',
    '- 각 항목은 명사형/동사형 종결(~함, ~임, ~됨, ~필요, ~예정). 한 불릿 최대 2줄.',
  ].join('\n')

  const user = [
    '반드시 JSON 객체만 반환하고 마크다운 코드블록이나 설명 문장은 쓰지 마세요.',
    '',
    '## 출력 구조',
    '최상위는 단일 객체입니다 (배열 아님):',
    '{"name":"대안명","strategy":"전략 요약 한 줄","tobe_process":...,"agent_specs":...,"tasks":...,"kpis":...,"data_requirements":...}',
    '',
    `## 전략 가이드: ${sg.name}`,
    sg.guide,
    '',
    '## 필드 작성 규칙',
    '',
    '### tobe_process',
    '- mermaid_dsl: Mermaid flowchart 문법으로 TO-BE 프로세스를 표현. 한국어 노드명 사용. 자동화된 단계는 스타일 구분.',
    '- steps[].name: TO-BE 프로세스의 각 단계명 (기존 단계 재활용 또는 새로 설계)',
    '- steps[].automation_type: full(완전 자동), assisted(AI 보조), human(수작업) 중 택1',
    '- steps[].asis_step_ids: 대응하는 AS-IS 노드 ID 배열. 입력 process_graph.nodes의 id만 사용',
    '- steps[].agent_name: 담당 Agent명 (null이면 사람 수행)',
    '- graph.nodes[].asis_node_ids: 동일 규칙',
    '',
    '### agent_specs (Agent 상세)',
    '- role: Agent의 구체적 역할과 자동화 범위 (최소 50자). 어떤 업무를 어떻게 수행하고, 기존 대비 무엇이 개선되는지 서술',
    '- core_features: 핵심 기능 최소 3개 (각 기능은 동사로 시작. 예: "견적서 PDF를 파싱하여 항목별 데이터 추출")',
    '- input/output: 구체적 데이터 형식과 내용 (예: 입력 "고객 문의 이메일 원문 + CRM 고객 이력", 출력 "분류된 문의 카테고리 + 추천 답변 초안 JSON")',
    '- human_checkpoint: 사람 검토가 필요한 구체적 조건과 시점 (예: "금액 1000만원 초과 견적은 팀장 승인 필요")',
    '- tech_stack: 권장 기술 스택 (예: "Azure OpenAI GPT-4o, Azure Document Intelligence, LangChain")',
    '',
    '### tasks (AX 과제)',
    '- cluster_ids: 입력 clusters의 id(UUID)를 그대로 사용. 클러스터 이름을 id 대신 쓰지 마세요.',
    '- tasks는 1개 이상이어야 하며 title은 100자 이하, description은 500자 이하',
    '- description: 과제의 배경·목표·범위·기대 효과를 개조식 불릿으로 정리 (최소 100자, 설명조 금지)',
    '- core_features: 핵심 기능 최소 3개, sub_features: 부가 기능 최소 2개',
    '- expected_effect: 정량적 기대 효과 필수 (예: "수동 검토 시간 주당 15시간 → 2시간으로 87% 단축")',
    '- kpi_name: 해당 과제의 핵심 KPI 지표명 (예: "청구서 자동처리율", "심사 소요시간")',
    '- estimated_value: 현행→목표 수치 (예: "현행 30% → 목표 85% (6개월)")',
    '- priority: high/medium/low. 투표 결과 기반으로 결정',
    '',
    '### kpis',
    '- current_value/target_value: 구체적 수치 필수 (예: "평균 48시간" → "4시간 이내")',
    '- measurement_method: 측정 도구·주기·담당자를 명시 (예: "Power BI 대시보드로 주 1회 자동 측정")',
    '- 최소 4개 이상의 KPI를 다양한 관점(시간·비용·품질·고객)에서 제시',
    '',
    '### data_requirements',
    '- source/format/volume: 구체적 시스템명, 형식, 예상 건수 명시',
    '- 각 데이터의 현재 가용성과 수집 방법까지 언급',
    '',
    '## 입력 데이터 활용 지침',
    '- process_graph.nodes의 duration_info, tools_systems, volume_info 필드를 TO-BE 설계와 KPI에 적극 활용하세요.',
    '- vote_mode가 cluster이면 clusters[].vote_count를 직접 우선순위로 해석하세요.',
    '- vote_mode가 note이면 clusters[].notes[].vote_count를 보고 클러스터의 우선순위를 판단하세요.',
    '- 투표 수가 0인 클러스터도 무시하지 말고, 낮은 우선순위로 과제에 반영하세요.',
    '',
    JSON.stringify(input, null, 2),
  ].join('\n')

  return { system, user }
}

/** Phase 1: Core design — TO-BE process + agent architecture */
export function buildDesignCorePrompt(strategyIndex: 0 | 1 | 2, input: DesignPromptInput) {
  const sg = STRATEGY_GUIDES_DETAILED[strategyIndex]

  const system = [
    `당신은 AX(Agent Transformation) 컨설턴트이자 AI Agent 아키텍트입니다.`,
    `AS-IS 업무 프로세스 그래프와 pain point 분석 결과를 기반으로, "${sg.name}" 전략의 TO-BE 프로세스와 Agent 아키텍처를 설계하세요.`,
    '',
    '## 품질 기준',
    '- 모든 텍스트 필드에 구체적이고 실질적인 내용을 작성하세요. 빈 문자열, "TBD", "추후 결정" 금지.',
    '- 숫자/수치가 필요한 곳에는 반드시 구체적 수치를 제시하세요.',
    '- AS-IS 데이터(duration_info, tools_systems, volume_info)를 TO-BE 설계에 반드시 반영하세요.',
    '',
    '## CRITICAL 문체 규칙',
    '- 모든 텍스트는 개조식(bullet point) 문체로 작성. 설명조 문장(~합니다, ~입니다, ~있습니다) 절대 금지.',
    '- 각 항목은 명사형/동사형 종결(~함, ~임, ~됨, ~필요, ~예정). 한 불릿 최대 2줄.',
  ].join('\n')

  const user = [
    '반드시 JSON 객체만 반환하고 마크다운 코드블록이나 설명 문장은 쓰지 마세요.',
    '',
    '## 출력 구조',
    '{"name":"대안명","strategy":"전략 요약 한 줄","tobe_process":{...},"agent_specs":[...]}',
    '',
    `## 전략 가이드: ${sg.name}`,
    sg.guide,
    '',
    '## 필드 작성 규칙',
    '',
    '### tobe_process',
    '- mermaid_dsl: Mermaid flowchart 문법으로 TO-BE 프로세스를 표현. 한국어 노드명 사용.',
    '- steps[].name: TO-BE 프로세스의 각 단계명',
    '- steps[].automation_type: full(완전 자동), assisted(AI 보조), human(수작업) 중 택1',
    '- steps[].asis_step_ids: 대응하는 AS-IS 노드 ID 배열. 입력 process_graph.nodes의 id만 사용',
    '- steps[].agent_name: 담당 Agent명 (null이면 사람 수행)',
    '- graph.nodes[].asis_node_ids: 동일 규칙',
    '',
    '### agent_specs (Agent 상세)',
    '- role: Agent의 구체적 역할과 자동화 범위 (최소 50자)',
    '- core_features: 핵심 기능 최소 3개 (각 기능은 동사로 시작)',
    '- input/output: 구체적 데이터 형식과 내용',
    '- human_checkpoint: 사람 검토가 필요한 구체적 조건과 시점',
    '',
    '## 입력 데이터',
    JSON.stringify(input, null, 2),
  ].join('\n')

  return { system, user }
}

/** Phase 2: Implementation plan — tasks, KPIs, data requirements */
export function buildDesignTasksPrompt(
  strategyIndex: 0 | 1 | 2,
  input: DesignPromptInput,
  coreResult: { name: string; strategy: string; agent_specs: { name: string; role: string }[]; tobe_process: { steps: { name: string; automation_type: string }[] } },
) {
  const sg = STRATEGY_GUIDES_DETAILED[strategyIndex]

  const system = [
    `당신은 AX(Agent Transformation) 컨설턴트입니다.`,
    `이미 설계된 "${coreResult.name}" TO-BE 프로세스와 Agent 아키텍처를 기반으로, 구현 과제·KPI·데이터 요구사항을 도출하세요.`,
    '',
    '## 품질 기준',
    '- 모든 텍스트 필드에 구체적이고 실질적인 내용을 작성하세요. 빈 문자열 금지.',
    '- 숫자/수치가 필요한 곳에는 반드시 구체적 수치를 제시하세요.',
  ].join('\n')

  const agentSummary = coreResult.agent_specs.map((a) => `- ${a.name}: ${a.role}`).join('\n')
  const stepSummary = coreResult.tobe_process.steps.map((s) => `${s.name}(${s.automation_type})`).join(', ')

  const user = [
    '반드시 JSON 객체만 반환하고 마크다운 코드블록이나 설명 문장은 쓰지 마세요.',
    '',
    '## 출력 구조',
    '{"tasks":[...],"kpis":[...],"data_requirements":[...]}',
    '',
    `## 전략: ${sg.name}`,
    `전략 요약: ${coreResult.strategy}`,
    '',
    '## 이미 설계된 TO-BE 프로세스 단계',
    stepSummary,
    '',
    '## 설계된 Agent 목록',
    agentSummary,
    '',
    '## 필드 작성 규칙',
    '',
    '### tasks (AX 과제)',
    '- cluster_ids: 입력 clusters의 id(UUID)를 그대로 사용.',
    '- tasks는 1개 이상, title 100자 이하, description 500자 이하',
    '- description: 과제의 배경·목표·범위·기대 효과를 개조식 불릿으로 정리 (최소 100자, 설명조 금지)',
    '- core_features: 핵심 기능 최소 3개, sub_features: 부가 기능 최소 2개',
    '- expected_effect: 정량적 기대 효과 필수',
    '- kpi_name: 해당 과제의 핵심 KPI 지표명',
    '- estimated_value: 현행→목표 수치 (예: "현행 30% → 목표 85% (6개월)")',
    '- priority: high/medium/low. 투표 결과 기반',
    '',
    '### kpis',
    '- current_value/target_value: 구체적 수치 필수',
    '- measurement_method: 측정 도구·주기·담당자를 명시',
    '- 최소 4개 이상 KPI',
    '',
    '### data_requirements',
    '- source/format/volume: 구체적 시스템명, 형식, 예상 건수 명시',
    '',
    '## 입력 데이터 (클러스터 및 투표)',
    `vote_mode: ${input.vote_mode}`,
    JSON.stringify({ clusters: input.clusters, workshop_description: input.workshop_description }, null, 2),
  ].join('\n')

  return { system, user }
}

// ─── Input Compression for Design Prompts ───────────────────────────

/** Compress DesignPromptInput for Step 1: full process_graph + cluster summaries (no individual notes).
 *  Returns compressed string AND the idMapper for post-parsing UUID restoration. */
function compactSerializeDesignInput(input: DesignPromptInput): { serialized: string; idMapper: ReturnType<typeof createIdMapper> } {
  const mapper = createIdMapper()
  const compacted = {
    process_graph: {
      nodes: input.process_graph.nodes.map((n) => ({
        id: mapper.shorten(n.id, 'n'),
        name: n.name,
        ...(n.description ? { desc: n.description } : {}),
        type: n.node_type,
        ...(n.lane_name ? { lane: n.lane_name } : {}),
        ...(n.duration_info ? { dur: n.duration_info } : {}),
        ...(n.tools_systems ? { tools: n.tools_systems } : {}),
        ...(n.volume_info ? { vol: n.volume_info } : {}),
      })),
      edges: input.process_graph.edges.map((e) => ({
        src: mapper.shorten(e.source_node_id, 'n'),
        tgt: mapper.shorten(e.target_node_id, 'n'),
        ...(e.label ? { label: e.label } : {}),
      })),
      lanes: input.process_graph.lanes.map((l) => ({
        id: mapper.shorten(l.id, 'l'),
        name: l.name,
      })),
    },
    clusters: input.clusters.map((c) => ({
      id: mapper.shorten(c.id, 'c'),
      name: c.name,
      summary: c.summary,
      votes: c.vote_count,
      note_count: c.notes.length,
    })),
    ...(input.workshop_description ? { description: input.workshop_description } : {}),
  }

  return { serialized: compactSerialize(compacted), idMapper: mapper }
}

/** Compress for Step 2: cluster summaries only (no notes, no full process_graph) */
function compactSerializeForStep2(
  input: DesignPromptInput,
  step1: { name: string; tobe_process: { graph: { nodes: { id: string; name: string; automation_type?: string; agent_name?: string | null }[] } } },
): string {
  return compactSerialize({
    clusters: input.clusters.map((c) => ({
      name: c.name,
      summary: c.summary,
      votes: c.vote_count,
    })),
    tobe_nodes: step1.tobe_process.graph.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      auto: n.automation_type,
      ...(n.agent_name ? { agent: n.agent_name } : {}),
    })),
  })
}

/** Compress for Step 3: cluster summaries + votes (no raw notes, no process_graph) */
function compactSerializeForStep3(input: DesignPromptInput): string {
  return compactSerialize({
    clusters: input.clusters.map((c) => ({
      id: c.id,
      name: c.name,
      summary: c.summary,
      votes: c.vote_count,
      note_count: c.notes.length,
    })),
    vote_mode: input.vote_mode,
    ...(input.workshop_description ? { description: input.workshop_description } : {}),
  })
}

// ─── 5-Step Design Prompts ──────────────────────────────────────────

/** Step 1: TO-BE Process Design.
 *  Returns { system, user, idMap } — idMap maps short IDs (n1, c1) back to UUIDs. */
export function buildDesignStep1Prompt(input: DesignPromptInput, facilitatorNote?: string) {
  const { serialized, idMapper } = compactSerializeDesignInput(input)

  const system = [
    AX_ENGAGEMENT_CONTEXT,
    '',
    '## 역할',
    '당신은 AX Business Envisioning 컨설턴트입니다.',
    'AS-IS 프로세스와 pain point 클러스터를 기반으로 TO-BE 프로세스를 설계하세요.',
    '',
    '## Strategy Guides (참고)',
    ...STRATEGY_GUIDES.map((s) => `- **${s.id}안: ${s.name}** — ${s.description}`),
    '위 전략 중 가장 적합한 것을 선택하거나 조합하여 TO-BE를 설계하세요.',
    '',
    '## 설계 원칙',
    '- AS-IS 프로세스의 비효율과 pain point를 진단합니다.',
    '- 투표 수가 높은 클러스터의 문제를 우선 해결하는 TO-BE를 설계합니다.',
    '- 반복·정형 업무는 full/assisted 자동화, 고위험 판단은 human으로 유지합니다.',
    '',
    '## 기술 적용 원칙',
    '- 비효율 병목에 적절한 기술을 적용하세요: AI/Agent, 프로세스 개선, 자동화를 균형 있게 조합.',
    '- 반복·정형 업무에는 자동화(AI Agent 포함)를, 고위험 판단·창의적 업무에는 human을 유지하세요.',
    '- agent_name은 실제 Agent가 필요한 노드에만 지정하세요. 모든 노드에 Agent를 강제하지 마세요 (null 허용).',
    '- 프로세스 단순화, 업무 재배치 등 비기술적 개선도 적극 반영하세요.',
    '',
    '## 품질 기준',
    '- 구체적이고 실질적인 내용. 빈 문자열, "TBD" 금지.',
    '- AS-IS 데이터(dur, tools, vol)를 반영하세요.',
    '- description은 반드시 80자 이내로 간결하게 작성하세요.',
    '- nodes는 최대 20개, edges는 최대 30개로 제한하세요.',
  ].join('\n')

  const userParts = [
    'JSON 객체만 반환. 마크다운 코드블록이나 설명 문장 금지.',
    '',
    '## 출력 구조',
    '{"name":"설계안명(50자이내)","strategy":"전략 요약(200자이내)","tobe_process":{"graph":{"nodes":[...],"edges":[...],"lanes":[...]}}}',
    '',
    '### tobe_process.graph 필드 규칙',
    '- nodes[].id: 짧은ID (t1, t2, t3... 형식)',
    '- nodes[].name: TO-BE 단계명 (100자이내)',
    '- nodes[].description: 간결 설명 (80자이내, 필수)',
    '- nodes[].automation_type: "full" | "assisted" | "human"',
    '- nodes[].agent_name: 담당 Agent명 또는 null',
    '- nodes[].asis_node_ids: 대응하는 AS-IS 노드 ID (입력의 n1,n2... 단축ID 그대로 사용)',
    '- edges[].source_node_id, target_node_id: nodes의 id (t1,t2...) 사용',
    '- edges[].label: 조건 라벨 (선택, 50자이내)',
    '- edges[].edge_type: "sequence"(기본) 또는 "conditional"(조건분기)',
    '- lanes[]: 조직 단위 Swimlane {id, name}',
    '',
    '### 예시 (참고만 - 실제 입력에 맞게 설계)',
    '{"name":"핵심 자동화","strategy":"수작업 병목 3가지를 AI로 해결","tobe_process":{"graph":{"nodes":[{"id":"t1","name":"AI 자동 접수","description":"고객 문의를 자동 분류하고 담당자 배정","automation_type":"full","agent_name":"접수Agent","asis_node_ids":["n1","n2"]}],"edges":[{"source_node_id":"t1","target_node_id":"t2","edge_type":"sequence"}],"lanes":[{"id":"l1","name":"고객서비스팀"}]}}}',
    '',
    '### 설계 방향',
    input.vote_mode === 'cluster'
      ? '- clusters[].votes가 높은 클러스터의 pain point를 우선 해결하세요.'
      : '- clusters 내 개별 노트의 투표 수를 종합하여 우선순위를 판단하세요.',
    '- 기존 프로세스를 개선하되, 핵심 병목에 Agent를 집중 투입하세요.',
    '- full 자동화는 정형·반복 업무에만, 고위험 판단은 human으로 유지하세요.',
    '',
    '## 입력',
    serialized,
  ]

  if (facilitatorNote) {
    userParts.push('', '## 퍼실리테이터 지시사항', facilitatorNote)
  }

  return { system, user: userParts.join('\n'), idMap: idMapper.getMap() }
}

/** Step 2: Agent Specs */
export function buildDesignStep2Prompt(
  input: DesignPromptInput,
  step1: { name: string; tobe_process: { graph: { nodes: { id: string; name: string; automation_type?: string; agent_name?: string | null }[] } } },
  facilitatorNote?: string,
) {
  const nodeSummary = step1.tobe_process.graph.nodes.map((n) => `${n.name}(${n.automation_type ?? 'human'}${n.agent_name ? ', Agent: ' + n.agent_name : ''})`).join(', ')

  const system = [
    '당신은 AI Agent 아키텍트입니다.',
    `"${step1.name}" TO-BE 프로세스를 기반으로 Agent 상세 사양을 설계하세요.`,
    '',
    '## 출력 제약',
    '- agent_specs 최대 7개',
    '- role: 50자 이내로 간결하게',
    '- core_features, sub_features: 각 항목 30자 이내, 최대 5개씩',
    '- input, output, human_checkpoint: 각 80자 이내',
    '- 불필요한 수식어/반복 표현 제거, 핵심만 기술',
  ].join('\n')

  const userParts = [
    'JSON 객체만 반환. 마크다운 금지.',
    '',
    '## 출력: {"agent_specs":[...]}',
    '',
    '### agent_specs 필드',
    '- name: Agent 이름',
    '- role: 역할 (50자 이내)',
    '- core_features: 핵심 기능 (30자×최대5개)',
    '- sub_features: 부가 기능 (30자×최대5개)',
    '- input: 입력 데이터 (80자)',
    '- output: 출력 데이터 (80자)',
    '- human_checkpoint: 사람 개입 지점 (80자)',
    '',
    '### JSON 예시 (1개)',
    '{"agent_specs":[{"name":"문서분석Agent","role":"계약서 핵심조항 자동 추출","core_features":["계약서 OCR 처리","핵심조항 추출","위험조항 탐지"],"sub_features":["다국어 지원","버전비교"],"input":"PDF/이미지 형태 계약서","output":"조항별 요약 JSON","human_checkpoint":"위험조항 최종 승인"}]}',
    '',
    '## TO-BE 프로세스 노드',
    nodeSummary,
    '',
    '## 입력 (클러스터 요약 + TO-BE 노드)',
    compactSerializeForStep2(input, step1),
  ]

  if (facilitatorNote) {
    userParts.push('', '## 퍼실리테이터 지시사항', facilitatorNote)
  }

  return { system, user: userParts.join('\n') }
}

/** Step 3: Tasks */
export function buildDesignStep3Prompt(
  input: DesignPromptInput,
  step1: { name: string; strategy: string; tobe_process: { graph: { nodes: { name: string; automation_type?: string }[] } } },
  step2: { agent_specs: { name: string; role: string }[] },
  facilitatorNote?: string,
) {
  const nodeSummary = step1.tobe_process.graph.nodes.map((n) => `${n.name}(${n.automation_type ?? 'human'})`).join(', ')
  const agentSummary = step2.agent_specs.map((a) => `- ${a.name}: ${a.role}`).join('\n')

  const system = [
    '당신은 AX 컨설턴트입니다.',
    `설계된 TO-BE 프로세스와 Agent를 기반으로 구현 과제를 도출하세요.`,
    '',
    '## 과제 도출 핵심 원칙',
    '- AI/Agent 중심의 프로세스 혁신 과제를 도출하되, 비즈니스 가치와 실제 도입 가능성을 우선하세요.',
    '- 기술 난이도보다 비즈니스 임팩트를 우선 고려하세요.',
    '- 프로세스 개선, 자동화, AI Agent 도입을 균형 있게 조합하세요.',
    '- 예: "업무 프로세스 표준화 + AI 문서 분석 Agent 도입" ✅',
    '- 예: "단순 RPA 도입"만 제안하지 말고, Agent 결합 가능성도 검토하세요.',
    '',
    '## 출력 제약',
    '- tasks 3~5개 (핵심 과제만 선별, 유사·중복 과제 통합)',
    '- description: 100자 이내',
    '- core_features, sub_features: 각 항목 30자, 최대 5개씩',
    '- expected_effect: 80자 이내, 정량적 수치 포함',
    '- kpi_name: 해당 과제의 핵심 성과지표명 (예: "청구서 자동처리율", "심사 소요시간")',
    '- estimated_value: 현재 수준 → 목표 수준 형태로 제시 (예: "현행 30% → 목표 85% (6개월)")',
    '- 중복 과제 금지, 각 과제는 독립적 실행 단위',
  ].join('\n')

  const userParts = [
    'JSON 객체만 반환. 마크다운 금지.',
    '',
    '## 출력: {"tasks":[...]}',
    '',
    '### tasks 필드',
    '- title: 과제명 (100자)',
    '- description: 설명 (100자 이내)',
    '- cluster_ids: 입력 clusters의 ID 배열',
    '- core_features: 핵심 기능 (30자×최대5개)',
    '- sub_features: 부가 기능 (30자×최대5개)',
    '- difficulty: low/medium/high',
    '- priority: 투표결과 기반 (high/medium/low)',
    '- expected_effect: 기대효과 (80자, 정량적)',
    '- kpi_name: 핵심 KPI 지표명 (예: "청구서 자동처리율")',
    '- estimated_value: 현행→목표 수치 (예: "현행 30% → 목표 85% (6개월)")',
    '',
    '### JSON 예시 (1개)',
    '{"tasks":[{"title":"AI Agent 기반 지능형 보험청구 자동심사","description":"LLM+문서분석 Agent로 청구서를 자동 분류·심사하고 이상탐지","cluster_ids":["c1"],"core_features":["청구서 지능형 분류","LLM 기반 자동심사","이상패턴 탐지"],"sub_features":["실시간 모니터링","자동학습"],"difficulty":"high","priority":"high","expected_effect":"심사 처리시간 60% 단축, 월 200건 자동처리","kpi_name":"청구서 자동처리율","estimated_value":"현행 15% → 목표 75% (6개월)"}]}',
    '',
    '## TO-BE 노드: ' + nodeSummary,
    '## Agent: ',
    agentSummary,
    '',
    compactSerializeForStep3(input),
  ]

  if (facilitatorNote) {
    userParts.push('', '## 퍼실리테이터 지시사항', facilitatorNote)
  }

  return { system, user: userParts.join('\n') }
}

/** Step 4: KPIs */
export function buildDesignStep4Prompt(
  step1: { tobe_process: { graph: { nodes: { name: string; automation_type?: string }[] } } },
  step3?: { tasks: { title: string; expected_effect: string }[] },
  facilitatorNote?: string,
) {
  const nodeSummary = step1.tobe_process.graph.nodes.map((n) => `${n.name}(${n.automation_type ?? 'human'})`).join(', ')
  const taskSummary = step3?.tasks.map((t) => `- ${t.title}: ${t.expected_effect}`).join('\n') ?? '(과제 미생성)'

  const system = [
    '당신은 성과 측정 전문가입니다. TO-BE 프로세스와 과제를 기반으로 KPI를 도출하세요.',
    '',
    '## 출력 제약',
    '- kpis 최대 8개',
    '- current_value, target_value: 각 30자 이내 (구체적 수치 필수)',
    '- measurement_method: 80자 이내 (도구·주기 명시)',
  ].join('\n')

  const userParts = [
    'JSON 객체만 반환.',
    '',
    '## 출력: {"kpis":[...]}',
    '',
    '### kpis 필드',
    '- name: 지표명',
    '- current_value: AS-IS 수치 (30자)',
    '- target_value: TO-BE 목표 수치 (30자)',
    '- measurement_method: 측정 도구·주기 (80자)',
    '',
    '### JSON 예시 (1개)',
    '{"kpis":[{"name":"계약 검토 처리시간","current_value":"건당 평균 4시간","target_value":"건당 평균 1.5시간","measurement_method":"ERP 계약모듈 처리시간 로그, 월간 집계"}]}',
    '',
    '## TO-BE 노드: ' + nodeSummary,
    '## 과제:',
    taskSummary,
  ]

  if (facilitatorNote) {
    userParts.push('', '## 퍼실리테이터 지시사항', facilitatorNote)
  }

  return { system, user: userParts.join('\n') }
}

/** Step 5: Data Requirements */
export function buildDesignStep5Prompt(
  step2: { agent_specs: { name: string; role: string; input: string; output: string }[] },
  step3?: { tasks: { title: string; core_features: string[] }[] },
  facilitatorNote?: string,
) {
  const agentSummary = step2.agent_specs.map((a) => `- ${a.name}: 입력=${a.input}, 출력=${a.output}`).join('\n')
  const taskSummary = step3?.tasks.map((t) => `- ${t.title}`).join('\n') ?? '(과제 미생성)'

  const system = [
    '당신은 데이터 아키텍트입니다. Agent와 과제에 필요한 데이터 요구사항을 도출하세요.',
    '',
    '## 출력 제약',
    '- data_requirements 최대 8개',
    '- 모든 필드 50자 이내',
    '- 중복 데이터 항목 금지',
  ].join('\n')

  const userParts = [
    'JSON 객체만 반환.',
    '',
    '## 출력: {"data_requirements":[...]}',
    '',
    '### data_requirements 필드',
    '- name: 데이터명 (50자)',
    '- source: 소스 시스템 (50자)',
    '- format: 데이터 형태 (50자)',
    '- volume: 규모/건수 (50자)',
    '- responsible_team: 담당팀 (50자)',
    '',
    '### JSON 예시 (1개)',
    '{"data_requirements":[{"name":"계약서 원본 데이터","source":"문서관리시스템(DMS)","format":"PDF/DOCX","volume":"월 200건","responsible_team":"법무팀"}]}',
    '',
    '## Agent:',
    agentSummary,
    '## 과제:',
    taskSummary,
  ]

  if (facilitatorNote) {
    userParts.push('', '## 퍼실리테이터 지시사항', facilitatorNote)
  }

  return { system, user: userParts.join('\n') }
}

export function buildFinalTaskPrompt(
  input: DesignPromptInput,
  selectedTasks: { id: string; title: string; description: string | null; core_features: unknown; sub_features: unknown; expected_effect: string | null; kpi_name: string | null }[],
  facilitatorNote?: string,
) {
  // Use only the first selected task (winner from voting)
  const task = selectedTasks[0]

  const system = [
    AX_ENGAGEMENT_CONTEXT,
    '',
    '## 역할',
    '당신은 AX Business Envisioning 워크샵의 시니어 컨설턴트입니다.',
    '투표에서 1위로 선정된 과제를 실제 사업화 수준으로 심화 확장합니다.',
    '',
    '## 확장 원칙',
    '1. 원래 과제의 핵심 가치와 방향을 유지하면서 구체화합니다.',
    '2. 5개 카테고리 각각 2~3개 항목을 도출하세요. 많을수록 좋은 것이 아닙니다 — 핵심만 선별하세요.',
    '3. 실무자가 바로 실행 계획을 수립할 수 있을 만큼 구체적으로 작성합니다.',
    '4. KPI/ROI 수치는 근거 없는 구체적 숫자를 지어내지 마세요. "~가 핵심 지표로 고려될 수 있다", "~의 개선이 기대된다" 식으로 방향성 위주로 기술하세요.',
    '5. 모든 텍스트는 한국어로 작성합니다.',
    '',
    '## CRITICAL 문체 규칙',
    '- 모든 텍스트는 개조식(bullet point) 문체로 작성. 설명조 문장(~합니다, ~입니다, ~있습니다) 절대 금지.',
    '- 각 항목은 명사형/동사형 종결(~함, ~임, ~됨, ~필요, ~예정). 한 불릿 최대 2줄.',
    '- description, rationale 필드도 반드시 개조식 불릿으로 작성.',
    '',
    '## 출력 형식',
    'JSON 객체만 반환. 마크다운 코드블록 금지.',
    '{"final_task":{...}}',
    '',
    '## final_task 필드 규칙',
    '- title: 사업 과제명 (100자 이내, 비즈니스 관점)',
    '- description: 과제 전체 개요 (500자 이내). 배경/목표/범위/기대효과를 각각 개조식 불릿으로 작성. 설명조 문단 금지.',
    '- rationale: 선정 이유와 전략적 의의 (개조식 3줄 이내)',
    '- source_task_id: 원본 과제 ID (입력에서 제공)',
    '',
    '- core_features[]: {name, description, implementation_type("full"|"assisted"|"human"), is_checked:true}',
    '  - 핵심 기능 2~3개. 각 기능의 자동화 수준 명시.',
    '',
    '- kpis[]: {name, description, current_value, target_value, measurement_method, is_checked:true}',
    '  - 핵심 성과 지표(KPI) 2~3개.',
    '  - name: 후보가 될 수 있는 구체적 핵심 KPI 지표명을 제시 (예: "주문처리 리드타임", "수작업 비율", "고객 응답 소요시간"). 추상적 분류(qualitative, quantitative) 금지.',
    '  - description: 이 KPI를 선정한 사유/근거를 개조식 1줄로 작성.',
    '  - current_value/target_value: 방향성 위주 기술 (예: "평균 3일", "50% 감소 목표"). 근거 없는 정확한 수치 금지.',
    '  - measurement_method: 측정 방식/주기 간략 기술.',
    '',
    '- process_changes[]: {area, as_is, to_be, impact, is_checked:true}',
    '  - 프로세스 변경사항 2~3개. AS-IS vs TO-BE 비교.',
    '',
    '- expected_effects[]: {type:"qualitative"|"quantitative", description, is_checked:true}',
    '  - 기대효과 2~3개 (정성+정량 혼합).',
    '',
    '- risks[]: {description, is_checked:true}',
    '  - 리스크 2~3개.',
    '',
    '주의: sub_features, required_technologies, stakeholder_impacts, prerequisites 카테고리는 생성하지 마세요. 빈 배열로 두세요.',
  ].join('\n')

  const features = Array.isArray(task.core_features) ? (task.core_features as string[]).join(', ') : ''
  const subFeatures = Array.isArray(task.sub_features) ? (task.sub_features as string[]).join(', ') : ''

  const userParts = [
    '## 워크샵 컨텍스트',
    `워크샵 목적: ${input.workshop_description ?? '(미지정)'}`,
    '',
    '## AS-IS 프로세스 요약',
    `노드 ${input.process_graph.nodes.length}개, 엣지 ${input.process_graph.edges.length}개`,
    input.process_graph.nodes.slice(0, 10).map(n => `- ${n.name}${n.description ? ': ' + n.description : ''}`).join('\n'),
    '',
    '## 클러스터 (Pain Points)',
    input.clusters.map(c => `- ${c.name} (투표: ${c.vote_count}): ${c.summary ?? ''}`).join('\n'),
    '',
    `## 선정된 과제 (투표 1위)`,
    `ID: ${task.id}`,
    `제목: ${task.title}`,
    task.description ? `설명: ${task.description}` : '',
    features ? `핵심 기능: ${features}` : '',
    subFeatures ? `부가 기능: ${subFeatures}` : '',
    task.expected_effect ? `기대 효과: ${task.expected_effect}` : '',
    task.kpi_name ? `KPI: ${task.kpi_name}` : '',
    '',
    '위 과제를 5개 카테고리(core_features, kpis, process_changes, expected_effects, risks)로 심화 확장해주세요.',
  ].filter(Boolean)

  if (facilitatorNote) {
    userParts.push('', '## 퍼실리테이터 지시사항', facilitatorNote)
  }

  return { system, user: userParts.join('\n') }
}

export function buildSolutionCanvasPrompt(
  input: DesignPromptInput,
  finalTaskDetail: Record<string, unknown>,
  facilitatorNote?: string,
) {
  const system = [
    AX_ENGAGEMENT_CONTEXT,
    '',
    '## 역할',
    '당신은 AX 솔루션 아키텍트이자 비즈니스 분석가입니다.',
    '최종 확정된 과제를 5개 섹션의 솔루션 캔버스로 구조화합니다.',
    '',
    '## 캔버스 구조 (BMC 스타일)',
    '1. Use Case: 목적, 사용자, 문제, 솔루션',
    '2. Data: 필수/선택 데이터 항목',
    '3. Stakeholders: 이해관계자별 역할과 영향',
    '4. Value & KPI: 정성/정량 기대효과',
    '5. Concern: 리스크/이슈',
    '',
    '## 작성 원칙',
    '- 입력의 is_checked=true 항목만 반영하세요.',
    '- 각 항목은 반드시 개조식(bullet) 문체로 작성. 설명조 문장(~합니다, ~입니다) 절대 금지. 명사형/동사형 종결(~함, ~임, ~됨).',
    '- 한 항목 최대 30자. 장황한 서술 금지.',
    '- KPI/ROI 수치는 근거 없는 구체적 숫자를 지어내지 마세요. 방향성 위주로 기술하세요.',
    '- 빈 문자열, "TBD" 금지.',
    '',
    '## 출력 형식',
    'JSON 객체만 반환. 마크다운 코드블록 금지.',
    '정확히 아래 구조를 따르세요:',
    '{',
    '  "use_case": {',
    '    "objective": "프로젝트 목적 문자열",',
    '    "user": "대상 사용자/조직 문자열",',
    '    "problem": "해결하려는 핵심 문제 문자열",',
    '    "solution": "제안 솔루션 개요 문자열"',
    '  },',
    '  "data": {',
    '    "must_have": [{"name":"데이터명","source":"출처","format":"형식","volume":"예상 규모"}],',
    '    "nice_to_have": [{"name":"데이터명","source":"출처","format":"형식"}]',
    '  },',
    '  "stakeholders": [{"name":"이름/팀","role":"역할","impact":"영향도 설명"}],',
    '  "value_kpi": {',
    '    "qualitative_effects": ["정성적 기대효과 문자열"],',
    '    "quantitative_effects": [{"name":"KPI명","current_value":"현재","target_value":"목표","measurement":"측정방법"}]',
    '  },',
    '  "concern": {',
    '    "risks": [{"description":"리스크 설명","probability":"low|medium|high","impact":"low|medium|high","mitigation":"대응"}],',
    '    "issues": [{"description":"이슈 설명","category":"분류","severity":"low|medium|high"}]',
    '  }',
    '}',
  ].join('\n')

  const userParts = [
    '## 워크샵 컨텍스트',
    `워크샵 목적: ${input.workshop_description ?? '(미지정)'}`,
    '',
    '## 최종 과제 상세',
    JSON.stringify(finalTaskDetail, null, 2),
    '',
    '## 클러스터 (Pain Points)',
    input.clusters.map(c => `- ${c.name} (투표: ${c.vote_count}): ${c.summary ?? ''}`).join('\n'),
    '',
    '위 데이터를 기반으로 5섹션 솔루션 캔버스를 생성하세요.',
  ]

  if (facilitatorNote) {
    userParts.push('', '## 퍼실리테이터 지시사항', facilitatorNote)
  }

  return { system, user: userParts.join('\n') }
}

export function buildPrdPrompt(input: Record<string, unknown>) {
  const system = [
    AX_ENGAGEMENT_CONTEXT,
    '',
    '## 역할',
    '당신은 글로벌 IT 컨설팅 펌의 시니어 프로덕트 매니저이자 AX(Agent Transformation) 전문가입니다.',
    '워크샵에서 도출된 AX 과제와 설계를 기반으로, 경영진 보고 및 개발 착수에 즉시 활용할 수 있는 전문 PRD(Product Requirements Document)를 작성합니다.',
    '',
    '## 작성 원칙',
    '1. 데이터 기반: 워크샵 데이터(투표 수, 클러스터 수, 과제 수)를 인용하며 서술. 추상적 서술 금지.',
    '2. 불릿 포인트 필수: 핵심만 간결하게 정리. 장황한 문단 금지. 각 항목은 1~2줄.',
    '3. 1개월 MVP 관점: 모든 과제와 로드맵은 1개월 내 MVP-PoC 실현 가능한 범위로 한정.',
    '4. KPI/ROI 톤: 근거 없는 구체적 수치(예: "87% 단축")를 지어내지 마세요. "~가 핵심 지표로 고려될 수 있다", "~의 개선이 기대된다" 식으로 방향성 위주로 기술.',
    '5. Mermaid 활용: User Flow는 반드시 Mermaid 다이어그램으로 작성.',
    '',
    '## CRITICAL 문체 규칙',
    '- 모든 텍스트는 개조식(bullet point) 문체. 설명조 문장(~합니다, ~입니다, ~있습니다) 절대 금지.',
    '- 각 항목은 명사형/동사형 종결(~함, ~임, ~됨, ~필요, ~예정). 한 불릿 최대 2줄.',
    '- 표 내용도 개조식으로 간결하게. 문장형 셀 내용 금지.',
  ].join('\n')

  const user = [
    '반드시 JSON 객체만 반환하고 마크다운 코드블록이나 설명 문장은 JSON 밖에 쓰지 마세요.',
    '출력 형식은 {"content":"Markdown 본문"} 입니다.',
    'content는 한국어 Markdown으로 작성하세요.',
    '',
    '## 문서 구조 (6개 섹션) — 불릿 포인트 위주, 간결하게',
    '',
    '### 1. Executive Summary',
    '- 프로젝트 배경·목적 3~5줄 불릿',
    '- 핵심 추진 과제 요약 표 (| # | 과제명 | 우선순위 | 기대 방향 |)',
    '',
    '### 2. Use Case',
    '과제당:',
    '- H3: 과제명 + 우선순위',
    '- **사용자 시나리오**: 핵심 유저 스토리 2~3개 불릿 (As a [역할], I want to [행동], so that [가치])',
    '- **User Flow**: ```mermaid flowchart 다이어그램',
    '- **핵심 기능**: 불릿 리스트 3~5개 (기능명: 한 줄 설명)',
    '- **1개월 MVP 범위**: 불릿 리스트 (MVP에서 구현할 것 / 제외할 것)',
    '',
    '### 3. Data Requirements',
    '- **필수 데이터**: 불릿 (데이터명 — 출처, 형식)',
    '- **선택 데이터**: 불릿 (동일 형식)',
    '',
    '### 4. Stakeholder',
    '- **이해관계자**: 불릿 (이름/팀 — 역할, 영향도)',
    '',
    '### 5. Value & KPI',
    '- **비즈니스 가치**: 불릿 3~5개 (방향성 위주, 근거 없는 수치 금지)',
    '- **핵심 KPI**: 불릿 (지표명 — 측정 방향, 측정 방법)',
    '- **1개월 로드맵**: 표 (| 주차 | 주요 과제 | 산출물 |)',
    '',
    '### 6. Concern (Risk & Issue)',
    '- **리스크**: 불릿 (리스크 — 대응 방향)',
    '- **기술 이슈**: 불릿 (제약사항, 의존성)',
    '',
    '## 서식 규칙',
    '- 표는 핵심 비교에만 사용. 나머지는 불릿 리스트. Mermaid는 ```mermaid 코드 블록.',
    '- 중요 항목 **굵게**. 각 섹션은 H2/H3으로 구분.',
    '',
    JSON.stringify(input, null, 2),
  ].join('\n')

  return { system, user }
}

export function buildReportPrompt(input: Record<string, unknown>) {
  const system = [
    AX_ENGAGEMENT_CONTEXT,
    '',
    '## 역할',
    '당신은 맥킨지·BCG급 글로벌 전략 컨설팅 펌의 AX(Agent Transformation) 파트너입니다.',
    '워크샵 전 과정의 데이터를 종합 분석하여, 경영진(C-Level) 보고와 AX 실행팀의 즉시 활용이 가능한 전문 컨설팅 보고서를 작성합니다.',
    '',
    '## 작성 원칙',
    '1. 데이터 → 분석 → 인사이트 → 권고: 각 섹션은 이 4단계를 각각 불릿으로 요약하세요. 문단 서술 금지.',
    '2. 불릿 포인트 필수: 핵심만 간결하게 정리. 장황한 문단 금지. 각 항목은 1~2줄.',
    '3. 1개월 MVP 관점: 로드맵은 1개월 내 MVP-PoC 실현 가능한 범위로 한정.',
    '4. KPI/ROI 톤: 근거 없는 구체적 수치를 지어내지 마세요. "~가 핵심 지표로 고려될 수 있다", "~의 개선이 기대된다" 식으로 방향성 위주로 기술.',
    '5. C-Level 관점: 투자 대비 효과, 리스크, 실행 로드맵을 경영진 의사결정에 필요한 수준으로 제시.',
    '',
    '## CRITICAL 문체 규칙',
    '- 모든 텍스트는 개조식(bullet point) 문체. 설명조 문장(~합니다, ~입니다, ~있습니다) 절대 금지.',
    '- 각 항목은 명사형/동사형 종결(~함, ~임, ~됨, ~필요, ~예정). 한 불릿 최대 2줄.',
    '- 표 내용도 개조식으로 간결하게. 문장형 셀 내용 금지.',
  ].join('\n')

  const user = [
    '반드시 JSON 객체만 반환하고 마크다운 코드블록이나 설명 문장은 JSON 밖에 쓰지 마세요.',
    '출력 형식은 {"content":"Markdown 본문"} 입니다.',
    'content는 한국어 Markdown으로 작성하세요.',
    '',
    '## 보고서 구조 (6개 섹션) — 불릿 포인트 위주, 간결하게',
    '',
    '### 1. Executive Summary',
    '- 핵심 발견 3~5개 불릿 (중요도순, 각 1줄)',
    '- 전략적 권고 불릿 3~5개',
    '',
    '### 2. AS-IS 프로세스 현황',
    '- ```mermaid flowchart 다이어그램',
    '- 주요 병목/비효율 불릿 3~5개 (단계명 — 문제 — 영향)',
    '',
    '### 3. Pain Point 분석',
    '- 클러스터별 불릿 (클러스터명: 아이디어 N개, 투표 N표 — 핵심 문제 한 줄)',
    '- 상위 3개 클러스터 심층 해설 (각 2~3줄)',
    '',
    '### 4. TO-BE 설계 + Agent 아키텍처',
    '- ```mermaid flowchart 다이어그램',
    '- AS-IS vs TO-BE 비교 불릿 3~5개 (영역: AS-IS → TO-BE)',
    '- Agent 불릿 (Agent명 — 역할 — 핵심 기능)',
    '- 과제 불릿 (과제명 — 우선순위 — 기대 방향)',
    '',
    '### 5. KPI 및 기대 가치',
    '- 핵심 KPI 불릿 (지표명 — 측정 방향 — 측정 방법)',
    '- 비즈니스 가치 불릿 3~5개 (방향성 위주, 근거 없는 수치 금지)',
    '',
    '### 6. 1개월 MVP 로드맵 + 리스크',
    '- 주차별 로드맵 표 (| 주차 | 주요 과제 | 산출물 |)',
    '- 리스크 불릿 (리스크 — 대응 방향)',
    '',
    '## 서식 규칙',
    '- 표는 로드맵/비교에만 사용. 나머지는 불릿 리스트. Mermaid는 ```mermaid 코드 블록.',
    '- 인사이트 > 💡, 주의 > ⚠️ blockquote. 수치는 **굵게**.',
    '',
    JSON.stringify(input, null, 2),
  ].join('\n')

  return { system, user }
}

// ─── Test Data Generation ───────────────────────────────────────────

export function buildTestProcessPrompt(scenario: string) {
  const system =
    '당신은 비즈니스 프로세스 모델링 전문가입니다. 주어진 시나리오를 기반으로 AS-IS BPMN 프로세스를 생성하세요.'

  const user = [
    '아래 시나리오에 대한 AS-IS 비즈니스 프로세스를 생성하세요.',
    '반드시 JSON 객체만 반환하고, 마크다운 코드블록이나 설명 문장은 쓰지 마세요.',
    '',
    '## 출력 형식',
    '{"lanes":[{"name":"부서/역할명","order_index":0}],"nodes":[{"name":"노드명","description":"설명","node_type":"task|exclusive_gateway|parallel_gateway|start_event|end_event|intermediate_event","lane_index":0,"order_index":0}],"edges":[{"source_index":0,"target_index":1,"label":"조건 등(선택)"}]}',
    '',
    '## 규칙',
    '- 반드시 start_event 1개, end_event 1개 포함',
    '- 노드는 5~12개 범위로 생성 (간결하게)',
    '- lane은 1~3개 범위',
    '- 직선적·순차적 프로세스를 선호하세요. gateway(exclusive_gateway, parallel_gateway)는 꼭 필요한 분기에만 최소한으로 사용하세요.',
    '- node_type은 정확히 위 6종 중 하나',
    '- lane_index는 lanes 배열의 인덱스',
    '- source_index, target_index는 nodes 배열의 인덱스',
    '- edges는 프로세스 순서대로 직렬 연결하세요. 가능하면 source_index < target_index가 되도록 (좌→우 흐름)',
    '- 한국어로 작성',
    '',
    '## 시나리오',
    scenario,
  ].join('\n')

  return { system, user }
}

export function buildTestNotesPrompt(scenario: string, processNodes: string[]) {
  const system =
    '당신은 비즈니스 워크샵 참석자 역할입니다. 주어진 시나리오와 프로세스 단계를 보고 현실적인 개선 아이디어를 포스트잇으로 작성하세요.'

  const user = [
    '아래 시나리오와 프로세스를 참고하여 포스트잇 아이디어를 생성하세요.',
    '반드시 JSON 객체만 반환하고, 마크다운 코드블록이나 설명 문장은 쓰지 마세요.',
    '',
    '## 출력 형식',
    '{"notes":[{"content":"포스트잇 내용(200자 이내)","color":"yellow|red|blue|green","process_node_index":0}]}',
    '',
    '## 규칙',
    '- 포스트잇 10~30개 생성',
    '- content는 현실적이고 구체적인 개선 아이디어 (200자 이내)',
    '- color는 yellow, red, blue, green 중 랜덤 분배',
    '- process_node_index는 프로세스 노드 배열의 인덱스 (해당 프로세스와 관련된 아이디어). -1이면 특정 프로세스와 무관',
    '- 한국어로 작성',
    '- 다양한 관점(효율성, 고객경험, 비용, 품질, 자동화)에서 아이디어를 작성',
    '',
    '## 시나리오',
    scenario,
    '',
    '## 프로세스 노드 목록',
    ...processNodes.map((name, i) => `${i}. ${name}`),
  ].join('\n')

  return { system, user }
}
