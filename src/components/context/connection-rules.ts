import type { Connection, Edge, Node } from '@xyflow/react'

/**
 * BPMN connection validation rules.
 * - start_event: outgoing only (no incoming)
 * - end_event: incoming only (no outgoing)
 * - gateways & tasks: both directions allowed
 * - No self-loops
 * - No duplicate edges between same source→target
 */
export function isValidConnection(
  connection: Edge | Connection,
  nodes: Node[],
  edges: { source: string; target: string }[],
): boolean {
  const { source, target } = connection
  if (!source || !target) return false

  // No self-loops
  if (source === target) return false

  // No duplicate edges
  if (edges.some((e) => e.source === source && e.target === target)) return false

  const sourceNode = nodes.find((n) => n.id === source)
  const targetNode = nodes.find((n) => n.id === target)
  if (!sourceNode || !targetNode) return false

  // end_event cannot be source
  if (sourceNode.type === 'end_event') return false

  // start_event cannot be target
  if (targetNode.type === 'start_event') return false

  return true
}
