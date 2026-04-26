'use client'

import type { NodeProps } from '@xyflow/react'
import { BaseBpmnNode } from './BaseBpmnNode'

export function ExclusiveGatewayNode(props: NodeProps) {
  return <BaseBpmnNode {...props} variant="gateway" />
}
