import { describe, expect, it } from 'vitest'
import { authorCatalogCsv } from './author_catalog_csv'

describe('author catalog CSV export', () => {
  it('exports sourced relations and safely flattens multiline biography', () => {
    const csv = authorCatalogCsv([{ id: 'a', name: 'أحمد', aliases: ['أبو حامد'], biography: 'سطر أول\nسطر "ثان"', teachers: ['محمد'], students: ['علي'], sourceUrl: 'https://example.test/a' }])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"أبو حامد"')
    expect(csv).toContain('"سطر أول سطر ""ثان"""')
    expect(csv).toContain('"محمد","علي","https://example.test/a"')
    expect(csv).not.toContain('معرف الشاملة')
    expect(csv).not.toContain('عدد الكتب')
  })
})
