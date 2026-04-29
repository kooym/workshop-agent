import type { NextRequest } from 'next/server'
import { generateDesignStep } from '@/lib/ai/design'
import type { DesignStep1Result, DesignStep2Result, DesignStep3Result } from '@/lib/ai/schemas'
import { withFacilitator } from '@/lib/api/middleware'
import { buildDesignInput, applyDesignStepResult } from '@/lib/api/design'
import { isProcessingStale } from '@/lib/api/clusters'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { aiDesignSchema } from '@/lib/api/validators'
import type { Json } from '@/types/common'
import type { createServiceRoleClient } from '@/lib/supabase/server'

type ServiceClient = ReturnType<typeof createServiceRoleClient>

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = aiDesignSchema.safeParse(body)
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '워크샵 정보를 확인해주세요.', 400)
  }

  return withFacilitator(req, async (_request, { service, user }) => {
    const workshopId = parsed.data.workshop_id
    const designStep = parsed.data.design_step
    let processingStarted = false

    const { data: workshop, error: workshopError } = await service
      .from('workshops')
      .select('*')
      .eq('id', workshopId)
      .maybeSingle()

    if (workshopError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, workshopError.message, 500)
    }
    if (!workshop) {
      return error(API_ERROR_CODES.NOT_FOUND, '워크샵을 찾을 수 없습니다.', 404)
    }
    if (workshop.facilitator_id !== user.id) {
      return error(API_ERROR_CODES.FORBIDDEN, '워크샵 퍼실리테이터만 실행할 수 있습니다.', 403)
    }
    if (workshop.current_stage !== 'design') {
      return error(API_ERROR_CODES.CONFLICT, '설계 단계에서만 실행할 수 있습니다.', 409)
    }
    if (workshop.is_processing && !isProcessingStale(workshop.is_processing_since)) {
      return error(API_ERROR_CODES.PROCESSING, '이미 AI가 처리 중입니다.', 409)
    }

    // Validate step ordering: step N requires step N-1 to be completed
    if (designStep > 1 && workshop.design_step < designStep - 1) {
      return error(API_ERROR_CODES.CONFLICT, `Step ${designStep - 1}을(를) 먼저 완료해야 합니다.`, 409)
    }

    // Validate selection gates
    // Step 3 (final task) needs exactly 1 selected (vote winner) non-bundle task
    if (designStep === 3) {
      const { count: selectedCount } = await service
        .from('ax_tasks')
        .select('id', { count: 'exact' })
        .eq('workshop_id', workshopId)
        .eq('is_selected', true)
        .eq('is_bundle', false)
      if (!selectedCount || selectedCount === 0) {
        return error(API_ERROR_CODES.VALIDATION_ERROR, '투표를 통해 과제를 1개 선정해야 합니다.', 400)
      }
    }

    // Step 4 (solution canvas) needs final_task_detail to exist
    if (designStep === 4) {
      const { data: artifact } = await service
        .from('design_artifacts')
        .select('final_task_detail')
        .eq('workshop_id', workshopId)
        .eq('alternative_index', 0)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!artifact?.final_task_detail) {
        return error(API_ERROR_CODES.VALIDATION_ERROR, '최종 과제 확장을 먼저 생성해야 합니다.', 400)
      }
    }

    const { error: lockError } = await service
      .from('workshops')
      .update({
        is_processing: true,
        is_processing_since: new Date().toISOString(),
      })
      .eq('id', workshopId)

    if (lockError) {
      return error(API_ERROR_CODES.INTERNAL_ERROR, lockError.message, 500)
    }
    processingStarted = true

    try {
      const { input, context } = await buildDesignInput(service, workshop)

      // Fetch previous step results from latest design_artifact
      const previousSteps = await loadPreviousSteps(service, workshopId)

      // For step 3 (final task), load the single winning task
      let selectedTasks: { id: string; title: string; description: string | null; core_features: unknown; sub_features: unknown; expected_effect: string | null; kpi_name: string | null }[] | undefined
      if (designStep === 3) {
        const { data: selTasks } = await service
          .from('ax_tasks')
          .select('id, title, description, core_features, sub_features, expected_effect, kpi_name')
          .eq('workshop_id', workshopId)
          .eq('is_selected', true)
          .eq('is_bundle', false)
          .order('order_index', { ascending: true })
        selectedTasks = selTasks ?? []
      }

      // For step 4 (solution canvas), load final_task_detail from artifact
      let finalTaskDetail: Record<string, unknown> | undefined
      if (designStep === 4) {
        const { data: artifact } = await service
          .from('design_artifacts')
          .select('final_task_detail')
          .eq('workshop_id', workshopId)
          .eq('alternative_index', 0)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (artifact?.final_task_detail) {
          // Filter only checked items for canvas generation
          finalTaskDetail = filterCheckedItems(artifact.final_task_detail as Record<string, unknown>)
        }
      }

      const { result, warnings } = await generateDesignStep(designStep, input, context, previousSteps, {
        facilitatorNote: parsed.data.facilitator_note,
        selectedTasks,
        finalTaskDetail,
      })
      const payload = await applyDesignStepResult(service, workshopId, result)

      // Update design_step to track progress
      await service
        .from('workshops')
        .update({ design_step: designStep })
        .eq('id', workshopId)

      return success({ ...payload, warnings: warnings.length ? warnings : undefined })
    } catch (designError) {
      return error(
        API_ERROR_CODES.INTERNAL_ERROR,
        designError instanceof Error ? designError.message : 'AI AX 설계에 실패했습니다.',
        500,
      )
    } finally {
      if (processingStarted) {
        await service
          .from('workshops')
          .update({
            is_processing: false,
            is_processing_since: null,
          })
          .eq('id', workshopId)
      }
    }
  })
}

async function loadPreviousSteps(
  service: ServiceClient,
  workshopId: string,
): Promise<{ step1?: DesignStep1Result; step2?: DesignStep2Result; step3?: DesignStep3Result }> {
  const { data: artifact } = await service
    .from('design_artifacts')
    .select('*')
    .eq('workshop_id', workshopId)
    .eq('alternative_index', 0)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!artifact) return {}

  const result: { step1?: DesignStep1Result; step2?: DesignStep2Result; step3?: DesignStep3Result } = {}
  const tobeProcess = artifact.tobe_process as Json
  const agentSpecs = artifact.agent_specs as Json

  if (tobeProcess && typeof tobeProcess === 'object') {
    const tp = tobeProcess as Record<string, unknown>
    // DB stores full tobe_process (mermaid_dsl + steps + graph); extract graph for the new schema
    const graph = tp.graph as DesignStep1Result['tobe_process']['graph'] | undefined
    if (graph && typeof graph === 'object') {
      result.step1 = {
        name: artifact.alternative_name || '설계안',
        strategy: '',
        tobe_process: { graph },
      }
    }
  }

  if (agentSpecs && Array.isArray(agentSpecs) && agentSpecs.length > 0) {
    const selectedAgents = agentSpecs.filter(
      (a) => (a as Record<string, unknown> | null)?.is_selected !== false,
    )
    if (selectedAgents.length > 0) {
      result.step2 = { agent_specs: selectedAgents as DesignStep2Result['agent_specs'] }
    }
  }

  // Load tasks for step3 context (only selected)
  const { data: tasks } = await service
    .from('ax_tasks')
    .select('*')
    .eq('workshop_id', workshopId)
    .eq('is_selected', true)
    .order('order_index', { ascending: true })

  if (tasks && tasks.length > 0) {
    result.step3 = {
      tasks: tasks.map((t) => ({
        title: t.title,
        description: t.description ?? '',
        cluster_ids: (t.pain_points as { cluster_ids?: string[] })?.cluster_ids ?? [],
        core_features: (t.core_features as string[]) ?? [],
        sub_features: (t.sub_features as string[]) ?? [],
        difficulty: (t.difficulty as 'low' | 'medium' | 'high') ?? 'medium',
        priority: (t.priority as 'low' | 'medium' | 'high') ?? 'medium',
        expected_effect: t.expected_effect ?? '',
      })),
    }
  }

  return result
}

/** Filter final_task_detail to only include items with is_checked=true */
function filterCheckedItems(detail: Record<string, unknown>): Record<string, unknown> {
  const filtered: Record<string, unknown> = {
    title: detail.title,
    description: detail.description,
    rationale: detail.rationale,
    source_task_id: detail.source_task_id,
  }

  const arrayKeys = [
    'core_features', 'sub_features', 'kpis', 'process_changes',
    'expected_effects', 'required_technologies', 'stakeholder_impacts',
    'risks', 'prerequisites',
  ]

  for (const key of arrayKeys) {
    const arr = detail[key]
    if (Array.isArray(arr)) {
      filtered[key] = arr.filter((item: Record<string, unknown>) => item.is_checked !== false)
    }
  }

  return filtered
}
