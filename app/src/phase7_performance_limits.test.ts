import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CATALOG_CSV_LIMITS, parseLibraryCatalogCsv } from './library_catalog_csv'
import { ARCHIVE_LIMITS } from './library_archive_restore'
import { virtualRange } from './search_presentation'

describe('phase 7 deterministic performance and boundary gate', () => {
  it('keeps search DOM windows bounded independently of result count', () => {
    for (const total of [1_000, 100_000, 10_000_000]) { const range = virtualRange(total * 80, total); expect(range.end - range.start).toBeLessThanOrEqual(36) }
  })
  it('keeps the first, middle and last windows of 5000 results bounded and reachable', () => {
    const total = 5_000
    const first = virtualRange(0, total, 64, 60, 8)
    const middle = virtualRange(2_500 * 64, total, 64, 60, 8)
    const last = virtualRange((total - 1) * 64, total, 64, 60, 8)
    for (const range of [first, middle, last]) expect(range.end - range.start).toBeLessThanOrEqual(60)
    expect(first.start).toBe(0)
    expect(middle.start).toBeLessThanOrEqual(2_500)
    expect(middle.end).toBeGreaterThan(2_500)
    expect(last.end).toBe(total)
  })
  it('caps CSV bytes, rows, columns and cells before applying records', () => {
    expect(() => parseLibraryCatalogCsv('x'.repeat(CATALOG_CSV_LIMITS.bytes + 1))).toThrow('حجم')
    const header = 'المعرف,العنوان,المؤلف\n', rows = Array.from({ length: CATALOG_CSV_LIMITS.rows + 1 }, (_, i) => `${i},ع,م`).join('\n')
    expect(() => parseLibraryCatalogCsv(header + rows)).toThrow('عدد')
    expect(() => parseLibraryCatalogCsv(`${header}1,${'x'.repeat(CATALOG_CSV_LIMITS.cellCharacters + 1)},م`)).toThrow('بنية')
  })
  it('declares finite ZIP expansion, file, book and per-file ceilings', () => {
    expect(ARCHIVE_LIMITS.compressedBytes).toBeLessThan(ARCHIVE_LIMITS.expandedBytes)
    expect(ARCHIVE_LIMITS.files).toBeLessThanOrEqual(50_000); expect(ARCHIVE_LIMITS.books).toBeLessThanOrEqual(10_000); expect(ARCHIVE_LIMITS.fileBytes).toBeLessThanOrEqual(ARCHIVE_LIMITS.compressedBytes)
  })
  it('bounds library card construction and retains an explicit continuation control', () => {
    const source = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
    expect(source).toContain('ordered.slice(0, limit)'); expect(source).toContain('if (visible.length > limit)'); expect(source).toContain('limit + 120')
  })
  it('keeps stale search cancellation and import failure recovery contracts', () => {
    const search = readFileSync(new URL('./screens/search.ts', import.meta.url), 'utf8'), settings = readFileSync(new URL('./screens/settings.ts', import.meta.url), 'utf8')
    expect(search).toContain('const current = ++request'); expect(search.match(/current !== request/g)?.length).toBeGreaterThanOrEqual(2)
    expect(settings).toContain("finally { archiveImport.disabled = false; archiveInput.value = '' }")
  })
})
