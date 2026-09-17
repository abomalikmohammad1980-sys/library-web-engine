import { describe, expect, it } from 'vitest'
import { prefersReducedMotion, readerScrollBehavior } from './motion_preference'

const scope = (matches: boolean) => ({ matchMedia: () => ({ matches }) } as Pick<Window, 'matchMedia'>)
const root = (enabled: boolean) => ({
  documentElement: { classList: { contains: (name: string) => enabled && name === 'a11y-reduce-motion' } },
} as Pick<Document, 'documentElement'>)

describe('motion preference', () => {
  it('uses instant reader navigation when reduced motion is requested', () => {
    expect(prefersReducedMotion(scope(true))).toBe(true)
    expect(readerScrollBehavior(scope(true))).toBe('auto')
  })

  it('keeps smooth navigation for the default preference', () => {
    expect(readerScrollBehavior(scope(false), root(false))).toBe('smooth')
  })

  it('honors the in-app reduced-motion setting even when the operating system allows motion', () => {
    expect(prefersReducedMotion(scope(false), root(true))).toBe(true)
    expect(readerScrollBehavior(scope(false), root(true))).toBe('auto')
  })
})
