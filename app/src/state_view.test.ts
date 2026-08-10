import { describe, expect, it } from 'vitest'
import { stateSemantics } from './state_view'

describe('unified screen-state semantics', () => {
  it('marks loading as a polite busy status', () => {
    expect(stateSemantics('loading')).toEqual({ role: 'status', live: 'polite', busy: true })
  })

  it('announces errors assertively without leaving a busy flag behind', () => {
    expect(stateSemantics('error')).toEqual({ role: 'alert', live: 'assertive', busy: false })
  })

  it('keeps empty and no-results states polite', () => {
    expect(stateSemantics('empty')).toEqual({ role: 'status', live: 'polite', busy: false })
    expect(stateSemantics('no-results')).toEqual({ role: 'status', live: 'polite', busy: false })
  })
})
