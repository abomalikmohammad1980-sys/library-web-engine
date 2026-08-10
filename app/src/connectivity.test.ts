import { describe, expect, it } from 'vitest'
import { connectivityState } from './connectivity'

describe('connectivity presentation', () => {
  it('keeps local reading explicitly available while offline', () => {
    const state = connectivityState(false)
    expect(state.online).toBe(false)
    expect(state.message).toContain('بياناتك المحلية متاحة')
    expect(state.message).toContain('عودة الاتصال')
  })

  it('announces a recovered connection without alarming the reader', () => {
    expect(connectivityState(true)).toEqual({ online: true, message: 'عاد الاتصال بالإنترنت.' })
  })
})

