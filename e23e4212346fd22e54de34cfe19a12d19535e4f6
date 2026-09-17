import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./styles/base.css', import.meta.url), 'utf8')

describe('forced colors accessibility', () => {
  it('keeps controls, cards, focus, and selected state visible without brand colors', () => {
    expect(css).toContain('@media (forced-colors: active)')
    expect(css).toContain('border: 1px solid CanvasText')
    expect(css).toContain('outline: 3px solid Highlight')
    expect(css).toContain('background: Highlight; color: HighlightText')
    expect(css).toContain('.state-view__icon, .offline-banner, .toast')
  })
})
