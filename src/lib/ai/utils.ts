/**
 * AI pipeline utilities: input compression, ID mapping, Mermaid generation.
 */

// ─── Compact Serialization ────────────────────────────────────────

/** Serialize an object as JSON without indentation, stripping null/undefined values. */
export function compactSerialize(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) => {
    if (value === null || value === undefined) return undefined
    return value
  })
}

// ─── UUID Short-ID Mapping ────────────────────────────────────────

export type IdMapper = {
  /** Map a UUID to a short ID (e.g. "n1", "c1"). Returns existing mapping if already mapped. */
  shorten(uuid: string, prefix: string): string
  /** Restore a short ID back to the original UUID. */
  restore(shortId: string): string
  /** Get the short→UUID map for bulk restoration. */
  getMap(): Map<string, string>
}

export function createIdMapper(): IdMapper {
  const uuidToShort = new Map<string, string>()
  const shortToUuid = new Map<string, string>()
  const prefixCounters = new Map<string, number>()

  return {
    shorten(uuid: string, prefix: string): string {
      const existing = uuidToShort.get(uuid)
      if (existing) return existing

      const count = (prefixCounters.get(prefix) ?? 0) + 1
      prefixCounters.set(prefix, count)
      const short = `${prefix}${count}`
      uuidToShort.set(uuid, short)
      shortToUuid.set(short, uuid)
      return short
    },
    restore(shortId: string): string {
      return shortToUuid.get(shortId) ?? shortId
    },
    getMap(): Map<string, string> {
      return new Map(shortToUuid)
    },
  }
}

// ─── Graph → Mermaid DSL Generation ───────────────────────────────

type MermaidNode = {
  id: string
  name: string
  automation_type?: string
}

type MermaidEdge = {
  source_node_id: string
  target_node_id: string
  label?: string | null
}

/** Generate a Mermaid flowchart LR from graph nodes and edges. */
export function graphToMermaid(
  nodes: MermaidNode[],
  edges: MermaidEdge[],
): string {
  if (nodes.length === 0) return 'flowchart LR'

  const lines: string[] = ['flowchart LR']

  // Escape node names for Mermaid (wrap in quotes if contains special chars)
  const escapeName = (name: string) => {
    const sanitized = name.replace(/"/g, "'")
    return `"${sanitized}"`
  }

  // Define nodes
  for (const node of nodes) {
    const suffix = node.automation_type === 'full' ? ' 🤖' : node.automation_type === 'assisted' ? ' 🤝' : ''
    lines.push(`    ${node.id}[${escapeName(node.name + suffix)}]`)
  }

  // Define edges
  for (const edge of edges) {
    const label = edge.label ? `|${edge.label.replace(/"/g, "'")}|` : ''
    lines.push(`    ${edge.source_node_id} -->${label} ${edge.target_node_id}`)
  }

  // Style automation nodes
  const fullNodes = nodes.filter((n) => n.automation_type === 'full').map((n) => n.id)
  const assistedNodes = nodes.filter((n) => n.automation_type === 'assisted').map((n) => n.id)

  if (fullNodes.length > 0) {
    lines.push(`    style ${fullNodes.join(',')} fill:#0066cc,color:#fff`)
  }
  if (assistedNodes.length > 0) {
    lines.push(`    style ${assistedNodes.join(',')} fill:#f5f5f7,color:#1d1d1f,stroke:#0066cc`)
  }

  return lines.join('\n')
}
