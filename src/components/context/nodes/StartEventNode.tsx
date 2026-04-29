'use client'

import type { NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { BaseBpmnNode } from './BaseBpmnNode'

export const StartEventNode = memo(function StartEventNode(props: NodeProps) {
  return <BaseBpmnNode {...props} variant="start" />
})
