import { describe, expect, it } from 'vitest'
import { processStepPatchSchema } from './validators'

describe('processStepPatchSchema', () => {
  it('does not inject default node_type when node_type is omitted', () => {
    const result = processStepPatchSchema.safeParse({ name: 'Updated Name' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('node_type')
    }
  })

  it('preserves explicit node_type when provided', () => {
    const result = processStepPatchSchema.safeParse({
      name: 'Start',
      node_type: 'start_event',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.node_type).toBe('start_event')
    }
  })

  it('does not inject node_type for position-only patches', () => {
    const result = processStepPatchSchema.safeParse({
      position_x: 100,
      position_y: 200,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('node_type')
      expect(result.data.position_x).toBe(100)
    }
  })

  it('rejects empty patch body', () => {
    const result = processStepPatchSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
