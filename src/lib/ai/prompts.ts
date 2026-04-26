import type { Tables } from '@/lib/supabase/types'

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
  const system =
    '당신은 비즈니스 워크샵 퍼실리테이터입니다. 참석자들이 작성한 포스트잇을 의미 기반으로 3~8개의 대주제로 클러스터링하세요.'

  const user = [
    '아래 포스트잇을 의미가 가까운 주제끼리 묶어주세요.',
    '반드시 JSON 객체만 반환하고, 마크다운 코드블록이나 설명 문장은 쓰지 마세요.',
    '출력 형식은 {"clusters":[{"name":"한국어 클러스터명","summary":"한 줄 요약","note_ids":["uuid"]}]} 입니다.',
    '각 클러스터 name은 1~50자, summary는 1~300자로 작성하세요.',
    '모든 포스트잇 ID는 반드시 정확히 하나의 클러스터에만 포함되어야 합니다.',
    '알 수 없는 note_id를 만들지 말고, 입력에 있는 id만 사용하세요.',
    existingClusters.length
      ? '기존 클러스터가 있으면 기존 이름을 최대한 유지하고, 미할당 포스트잇을 가장 적합한 기존 클러스터에 추가하세요. 맞지 않으면 새 클러스터를 생성하세요.'
      : '첫 실행이므로 전체 포스트잇을 새 클러스터로 분류하세요.',
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

export function buildDesignPrompt(input: {
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
}) {
  const system =
    '당신은 AX(Agent Transformation) 컨설턴트이자 AI Agent 아키텍트입니다. AS-IS 업무 프로세스 그래프(BPMN 노드/간선/Swimlane 포함)와 pain point 분석 결과를 기반으로, TO-BE AX 프로세스를 설계하고, Agent 아키텍처, KPI, 데이터·조직 요구사항, AX 과제를 도출하세요. TO-BE 프로세스는 Mermaid flowchart DSL과 구조화된 JSON 모두로 출력하세요.'

  const user = [
    '반드시 JSON 객체만 반환하고 마크다운 코드블록이나 설명 문장은 쓰지 마세요.',
    '출력 최상위 필드는 반드시 tobe_process, agent_specs, tasks, kpis, data_requirements, org_requirements 6개입니다.',
    'tobe_process는 mermaid_dsl, steps, graph를 포함해야 합니다.',
    'tobe_process.steps[].automation_type은 full, assisted, human 중 하나입니다.',
    'tobe_process.steps[].asis_step_ids와 tobe_process.graph.nodes[].asis_node_ids는 입력 process_graph.nodes의 id만 사용하세요.',
    'tasks[].cluster_ids는 입력 clusters의 id(UUID)를 그대로 사용하세요. 클러스터 이름을 id 대신 쓰지 마세요.',
    'tasks는 1개 이상이어야 하며 title은 100자 이하, description은 500자 이하입니다.',
    'vote_mode가 cluster이면 clusters[].vote_count를 직접 우선순위로 해석하세요.',
    'vote_mode가 note이면 clusters[].notes[].vote_count를 보고 클러스터의 우선순위를 판단하세요.',
    JSON.stringify(input, null, 2),
  ].join('\n')

  return { system, user }
}
