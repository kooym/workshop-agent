import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import {
  ensureProcessGraphEditable,
  propagateContextStaleIfNeeded,
} from '@/lib/api/process-graph'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { processStepCreateSchema } from '@/lib/api/validators'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  return withAuth(
    req,
    async (_request, { service }) => {
      const { data: steps, error: stepsError } = await service
        .from('process_steps')
        .select('*')
        .eq('workshop_id', id)
        .order('order_index', { ascending: true })

      if (stepsError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, stepsError.message, 500)
      }

      return success(steps)
    },
    { workshopId: id },
  )
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  return withAuth(
    req,
    async (_request, { service, participant }) => {
      const guard = await ensureProcessGraphEditable(service, id, participant.id)
      if (!guard.ok) {
        return guard.response
      }

      const body = await req.json().catch(() => null)
      const parsed = processStepCreateSchema.safeParse(body)
      if (!parsed.success) {
        return error(API_ERROR_CODES.VALIDATION_ERROR, '프로세스 노드 정보를 확인해주세요.', 400)
      }

      const { count, error: countError } = await service
        .from('process_steps')
        .select('id', { count: 'exact', head: true })
        .eq('workshop_id', id)

      if (countError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, countError.message, 500)
      }

      if ((count ?? 0) >= 50) {
        return error(API_ERROR_CODES.CONFLICT, '프로세스 노드는 최대 50개까지 만들 수 있습니다.', 409)
      }

      const { data: step, error: stepError } = await service
        .from('process_steps')
        .insert({
          workshop_id: id,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          node_type: parsed.data.node_type,
          order_index: parsed.data.order_index,
          position_x: parsed.data.position_x ?? null,
          position_y: parsed.data.position_y ?? null,
          width: parsed.data.width ?? null,
          height: parsed.data.height ?? null,
          lane_id: parsed.data.lane_id ?? null,
          duration_info: parsed.data.duration_info ?? null,
          tools_systems: parsed.data.tools_systems ?? null,
          volume_info: parsed.data.volume_info ?? null,
        })
        .select('*')
        .single()

      if (stepError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, stepError.message, 500)
      }

      await propagateContextStaleIfNeeded(service, guard.workshop)
      return success(step, 201)
    },
    { workshopId: id },
  )
}
