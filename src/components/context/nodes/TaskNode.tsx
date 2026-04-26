'use client'

import type { NodeProps } from '@xyflow/react'
import { BaseBpmnNode } from './BaseBpmnNode'

export function TaskNode(props: NodeProps) {
  return <BaseBpmnNode {...props} variant="task" />
}
