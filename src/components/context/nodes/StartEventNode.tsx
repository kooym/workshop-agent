'use client'

import type { NodeProps } from '@xyflow/react'
import { BaseBpmnNode } from './BaseBpmnNode'

export function StartEventNode(props: NodeProps) {
  return <BaseBpmnNode {...props} variant="start" />
}
