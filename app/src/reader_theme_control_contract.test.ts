import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')

describe('reader theme control contract', () => {
  it('uses the global header theme control without a duplicate reader toolbar switch', () => {
    expect(source).not.toContain("class: 'theme-switch'")
    expect(source).not.toContain("aria-label': 'سمة القراءة'")
    expect(source).not.toContain('function setTheme(')
    expect(source).toContain('appHeader(')
  })
})
