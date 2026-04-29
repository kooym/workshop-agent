'use client'

import type { NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { BaseBpmnNode } from './BaseBpmnNode'

export const TaskNode = memo(function TaskNode(props: NodeProps) {
  return <BaseBpmnNode {...props} variant="task" />
})
