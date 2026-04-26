import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import {
  ensureProcessGraphEditable,
  propagateContextStaleIfNeeded,
} from '@/lib/api/process-graph'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { processLaneCreateSchema } from '@/lib/api/validators'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  return withAuth(
    req,
    async (_request, { service }) => {
      const { data: lanes, error: lanesError } = await service
        .from('process_lanes')
        .select('*')
        .eq('workshop_id', id)
        .order('order_index', { ascending: true })

      if (lanesError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, lanesError.message, 500)
      }

      return success(lanes)
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
      const parsed = processLaneCreateSchema.safeParse(body)
      if (!parsed.success) {
        return error(API_ERROR_CODES.VALIDATION_ERROR, 'Swimlane 정보를 확인해주세요.', 400)
      }

      const { count, error: countError } = await service
        .from('process_lanes')
        .select('id', { count: 'exact', head: true })
        .eq('workshop_id', id)

      if (countError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, countError.message, 500)
      }

      if ((count ?? 0) >= 10) {
        return error(API_ERROR_CODES.CONFLICT, 'Swimlane은 최대 10개까지 만들 수 있습니다.', 409)
      }

      const { data: lane, error: laneError } = await service
        .from('process_lanes')
        .insert({
          workshop_id: id,
          name: parsed.data.name,
          order_index: parsed.data.order_index,
          color: parsed.data.color ?? null,
        })
        .select('*')
        .single()

      if (laneError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, laneError.message, 500)
      }

      await propagateContextStaleIfNeeded(service, guard.workshop)
      return success(lane, 201)
    },
    { workshopId: id },
  )
}
