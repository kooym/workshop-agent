'use client'

import type { NodeProps } from '@xyflow/react'
import { BaseBpmnNode } from './BaseBpmnNode'

export function SubProcessNode(props: NodeProps) {
  return <BaseBpmnNode {...props} variant="subprocess" />
}
