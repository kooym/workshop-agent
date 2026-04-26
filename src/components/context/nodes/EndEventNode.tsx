'use client'

import type { NodeProps } from '@xyflow/react'
import { BaseBpmnNode } from './BaseBpmnNode'

export function EndEventNode(props: NodeProps) {
  return <BaseBpmnNode {...props} variant="end" />
}
