'use client'

import type { NodeProps } from '@xyflow/react'
import { BaseBpmnNode } from './BaseBpmnNode'

export function ParallelGatewayNode(props: NodeProps) {
  return <BaseBpmnNode {...props} variant="parallel" />
}
