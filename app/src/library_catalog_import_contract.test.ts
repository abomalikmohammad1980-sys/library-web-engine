import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
describe('library catalog CSV import contract', () => {
  it('uses the hidden file picker, matches existing ids and refreshes after persistence', () => {
    const source = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
    expect(source).toContain("'استيراد تعديلات CSV'"); expect(source).toContain('parseLibraryCatalogCsv(await file.text())')
    expect(source).toContain('rows.filter(row => known.has(row.id))'); expect(source).toContain('Promise.all(applicable.map(row => updateBookMetadata(row.id, row)))')
    expect(source).toContain("new CustomEvent('library-changed')")
  })
})
