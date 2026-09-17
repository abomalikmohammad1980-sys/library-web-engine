import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
describe('data quality center contract', () => {
  it('routes an actionable audit with kind filters and repair links', () => {
    const router = readFileSync(new URL('./router.ts', import.meta.url), 'utf8'), screen = readFileSync(new URL('./screens/data_quality.ts', import.meta.url), 'utf8')
    expect(router).toContain("first === 'data-quality'"); expect(screen).toContain('auditLibraryData(await listBooks())')
    expect(screen).toContain("value: 'identity'"); expect(screen).toContain("value: 'series'")
    expect(screen).toContain('`#/library?adminQ=${encodeURIComponent(issue.bookTitle)}`')
  })
})
