'use client'

import type { NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { BaseBpmnNode } from './BaseBpmnNode'

export const ParallelGatewayNode = memo(function ParallelGatewayNode(props: NodeProps) {
  return <BaseBpmnNode {...props} variant="parallel" />
})
