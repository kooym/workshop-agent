import type { NextResponse } from 'next/server'
import { API_ERROR_CODES, error } from '@/lib/api/response'
import { propagateStale } from '@/lib/api/stale'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/types'
import { isStageAfter } from '@/lib/workshop/stage'

type ServiceClient = ReturnType<typeof createServiceRoleClient>

type EditableResult =
  | { ok: true; workshop: Tables<'workshops'> }
  | { ok: false; response: NextResponse }

export async function ensureProcessGraphEditable(
  service: ServiceClient,
  workshopId: string,
  participantId: string,
): Promise<EditableResult> {
  const { data: workshop, error: workshopError } = await service
    .from('workshops')
    .select('*')
    .eq('id', workshopId)
    .single()

  if (workshopError || !workshop) {
    return { ok: false, response: error(API_ERROR_CODES.NOT_FOUND, '워크샵을 찾을 수 없습니다.', 404) }
  }

  if (workshop.current_stage === 'completed') {
    return {
      ok: false,
      response: error(API_ERROR_CODES.FORBIDDEN, '완료된 워크샵은 읽기 전용입니다.', 403),
    }
  }

  const { data: lock, error: lockError } = await service
    .from('editing_locks')
    .select('*')
    .eq('workshop_id', workshopId)
    .eq('resource_type', 'process_graph')
    .maybeSingle()

  if (lockError) {
    return { ok: false, response: error(API_ERROR_CODES.INTERNAL_ERROR, lockError.message, 500) }
  }

  if (!lock || lock.editor_id !== participantId) {
    return {
      ok: false,
      response: error(API_ERROR_CODES.FORBIDDEN, '현재 편집 권한을 가진 참석자만 수정할 수 있습니다.', 403),
    }
  }

  return { ok: true, workshop }
}

export async function propagateContextStaleIfNeeded(
  service: ServiceClient,
  workshop: Tables<'workshops'>,
) {
  if (isStageAfter(workshop.current_stage, 'context')) {
    await propagateStale(service, workshop.id, 'context')
  }
}

export async function getProcessGraph(service: ServiceClient, workshopId: string) {
  const [stepsResult, edgesResult, lanesResult, locksResult] = await Promise.all([
    service
      .from('process_steps')
      .select('*')
      .eq('workshop_id', workshopId)
      .order('order_index', { ascending: true }),
    service.from('process_edges').select('*').eq('workshop_id', workshopId),
    service
      .from('process_lanes')
      .select('*')
      .eq('workshop_id', workshopId)
      .order('order_index', { ascending: true }),
    service.from('editing_locks').select('*').eq('workshop_id', workshopId),
  ])

  const failure = [stepsResult, edgesResult, lanesResult, locksResult].find((result) => result.error)
  if (failure?.error) {
    throw new Error(failure.error.message)
  }

  const steps = stepsResult.data ?? []
  const edges = edgesResult.data ?? []
  const lanes = lanesResult.data ?? []
  const locks = locksResult.data ?? []

  return {
    nodes: steps.map((step) => ({
      id: step.id,
      type: step.node_type,
      position: {
        x: step.position_x ?? 0,
        y: step.position_y ?? 0,
      },
      data: {
        ...step,
        label: step.name,
      },
      parentId: step.lane_id ?? undefined,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source_node_id,
      target: edge.target_node_id,
      type: edge.edge_type,
      label: edge.label ?? undefined,
      data: edge,
    })),
    lanes,
    editingLock: locks.find((lock) => lock.resource_type === 'process_graph') ?? null,
  }
}
