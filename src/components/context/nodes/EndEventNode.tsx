'use client'

import type { NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { BaseBpmnNode } from './BaseBpmnNode'

export const EndEventNode = memo(function EndEventNode(props: NodeProps) {
  return <BaseBpmnNode {...props} variant="end" />
})
