'use client'

import type { NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { BaseBpmnNode } from './BaseBpmnNode'

export const SubProcessNode = memo(function SubProcessNode(props: NodeProps) {
  return <BaseBpmnNode {...props} variant="subprocess" />
})
