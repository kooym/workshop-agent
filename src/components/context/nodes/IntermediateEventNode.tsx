'use client'

import type { NodeProps } from '@xyflow/react'
import { BaseBpmnNode } from './BaseBpmnNode'

export function IntermediateEventNode(props: NodeProps) {
  return <BaseBpmnNode {...props} variant="event" />
}
