'use client'

import type { NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { BaseBpmnNode } from './BaseBpmnNode'

export const ExclusiveGatewayNode = memo(function ExclusiveGatewayNode(props: NodeProps) {
  return <BaseBpmnNode {...props} variant="gateway" />
})
