import type { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware'
import {
  ensureProcessGraphEditable,
  propagateContextStaleIfNeeded,
} from '@/lib/api/process-graph'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { processEdgeCreateSchema } from '@/lib/api/validators'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  return withAuth(
    req,
    async (_request, { service }) => {
      const { data: edges, error: edgesError } = await service
        .from('process_edges')
        .select('*')
        .eq('workshop_id', id)

      if (edgesError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, edgesError.message, 500)
      }

      return success(edges)
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
      const parsed = processEdgeCreateSchema.safeParse(body)
      if (!parsed.success) {
        return error(API_ERROR_CODES.VALIDATION_ERROR, '프로세스 간선 정보를 확인해주세요.', 400)
      }

      const { count, error: nodesError } = await service
        .from('process_steps')
        .select('id', { count: 'exact', head: true })
        .eq('workshop_id', id)
        .in('id', [parsed.data.source_node_id, parsed.data.target_node_id])

      if (nodesError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, nodesError.message, 500)
      }

      if (count !== 2) {
        return error(API_ERROR_CODES.VALIDATION_ERROR, '연결할 노드를 찾을 수 없습니다.', 400)
      }

      const { data: edge, error: edgeError } = await service
        .from('process_edges')
        .insert({
          workshop_id: id,
          source_node_id: parsed.data.source_node_id,
          target_node_id: parsed.data.target_node_id,
          label: parsed.data.label ?? null,
          edge_type: parsed.data.edge_type,
        })
        .select('*')
        .single()

      if (edgeError) {
        const status = edgeError.code === '23505' ? 409 : 500
        return error(
          status === 409 ? API_ERROR_CODES.CONFLICT : API_ERROR_CODES.INTERNAL_ERROR,
          edgeError.message,
          status,
        )
      }

      await propagateContextStaleIfNeeded(service, guard.workshop)
      return success(edge, 201)
    },
    { workshopId: id },
  )
}
