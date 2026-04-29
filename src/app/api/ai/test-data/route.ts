import type { NextRequest } from 'next/server'
import { createChatCompletionJson } from '@/lib/ai/openai'
import { buildTestNotesPrompt, buildTestProcessPrompt } from '@/lib/ai/prompts'
import { parseTestNotesResponse, parseTestProcessResponse } from '@/lib/ai/schemas'
import { withFacilitator } from '@/lib/api/middleware'
import { API_ERROR_CODES, error, success } from '@/lib/api/response'
import { testDataSchema } from '@/lib/api/validators'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = testDataSchema.safeParse(body)
  if (!parsed.success) {
    return error(API_ERROR_CODES.VALIDATION_ERROR, '시나리오와 모드를 확인해주세요.', 400)
  }

  return withFacilitator(req, async (_request, { service, user }) => {
    const { workshop_id: workshopId, scenario, mode } = parsed.data

    // Verify workshop ownership
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
      return error(API_ERROR_CODES.FORBIDDEN, '퍼실리테이터만 테스트 데이터를 생성할 수 있습니다.', 403)
    }

    // Get participant (facilitator's participant record)
    const { data: participant } = await service
      .from('participants')
      .select('id')
      .eq('workshop_id', workshopId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!participant) {
      return error(API_ERROR_CODES.FORBIDDEN, '참가자 레코드를 찾을 수 없습니다.', 403)
    }

    const result: { processSteps?: number; lanes?: number; edges?: number; notes?: number } = {}

    // ── Generate Process ──
    if (mode === 'process' || mode === 'both') {
      const prompt = buildTestProcessPrompt(scenario)
      const raw = await createChatCompletionJson({
        system: prompt.system,
        user: prompt.user,
        maxTokens: 4000,
        timeoutMs: 60_000,
      })

      const processData = parseTestProcessResponse(raw)

      // Insert lanes
      const laneRows = processData.lanes.map((lane) => ({
        workshop_id: workshopId,
        name: lane.name,
        order_index: lane.order_index,
      }))

      const { data: insertedLanes, error: laneError } = await service
        .from('process_lanes')
        .insert(laneRows)
        .select('id, order_index')

      if (laneError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, `레인 생성 실패: ${laneError.message}`, 500)
      }

      const laneIdByIndex = new Map(
        (insertedLanes ?? []).map((l) => [l.order_index, l.id]),
      )

      // Insert nodes — horizontal flow layout (left→right per lane)
      const laneCounts = new Map<number, number>()
      const nodeRows = processData.nodes.map((node, i) => {
        const laneIdx = node.lane_index ?? 0
        const col = laneCounts.get(laneIdx) ?? 0
        laneCounts.set(laneIdx, col + 1)
        return {
          workshop_id: workshopId,
          name: node.name,
          description: node.description ?? null,
          node_type: node.node_type,
          order_index: node.order_index ?? i,
          lane_id: laneIdByIndex.get(node.lane_index) ?? null,
          position_x: 80 + col * 260,
          position_y: 80 + laneIdx * 180,
        }
      })

      const { data: insertedNodes, error: nodeError } = await service
        .from('process_steps')
        .insert(nodeRows)
        .select('id')

      if (nodeError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, `노드 생성 실패: ${nodeError.message}`, 500)
      }

      const nodeIds = (insertedNodes ?? []).map((n) => n.id)

      // Insert edges
      const edgeRows = processData.edges
        .filter((e) => e.source_index < nodeIds.length && e.target_index < nodeIds.length)
        .map((edge) => ({
          workshop_id: workshopId,
          source_node_id: nodeIds[edge.source_index],
          target_node_id: nodeIds[edge.target_index],
          label: edge.label ?? null,
          edge_type: 'sequence' as const,
        }))

      if (edgeRows.length > 0) {
        const { error: edgeError } = await service
          .from('process_edges')
          .insert(edgeRows)

        if (edgeError) {
          return error(API_ERROR_CODES.INTERNAL_ERROR, `간선 생성 실패: ${edgeError.message}`, 500)
        }
      }

      result.processSteps = nodeIds.length
      result.lanes = insertedLanes?.length ?? 0
      result.edges = edgeRows.length
    }

    // ── Generate Notes ──
    if (mode === 'notes' || mode === 'both') {
      // Get existing process nodes for context
      const { data: existingNodes } = await service
        .from('process_steps')
        .select('id, name')
        .eq('workshop_id', workshopId)
        .order('order_index', { ascending: true })

      const nodeNames = (existingNodes ?? []).map((n) => n.name)
      const nodeIds = (existingNodes ?? []).map((n) => n.id)

      const prompt = buildTestNotesPrompt(scenario, nodeNames)
      const raw = await createChatCompletionJson({
        system: prompt.system,
        user: prompt.user,
        maxTokens: 4000,
        timeoutMs: 60_000,
      })

      const notesData = parseTestNotesResponse(raw)

      const noteRows = notesData.notes.map((note) => ({
        workshop_id: workshopId,
        participant_id: participant.id,
        content: note.content.slice(0, 200),
        color: note.color,
        position_x: 0,
        position_y: 0,
        process_step_id:
          note.process_node_index >= 0 && note.process_node_index < nodeIds.length
            ? nodeIds[note.process_node_index]
            : null,
      }))

      const { data: insertedNotes, error: noteError } = await service
        .from('notes')
        .insert(noteRows)
        .select('id')

      if (noteError) {
        return error(API_ERROR_CODES.INTERNAL_ERROR, `포스트잇 생성 실패: ${noteError.message}`, 500)
      }

      result.notes = insertedNotes?.length ?? 0
    }

    return success(result, 201)
  })
}
