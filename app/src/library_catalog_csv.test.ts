import { describe, expect, it } from 'vitest'
import { libraryCatalogCsv, parseLibraryCatalogCsv } from './library_catalog_csv'

describe('library catalog CSV export', () => {
  it('writes an Excel-friendly BOM and safely quotes Arabic metadata', () => {
    const csv = libraryCatalogCsv([{ id: 'b', title: 'كتاب، "العلم"', author: 'أحمد\nبن علي', category: 'الحديث', contemporary: false, deathYearHijri: 300, fileName: 'book.docx' }])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"كتاب، ""العلم"""')
    expect(csv).toContain('"أحمد بن علي"')
    expect(csv).toContain('"300"')
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('round-trips editable metadata and validates the identity columns', () => {
    const csv = libraryCatalogCsv([{ id: 'b', title: 'كتاب، العلم', author: 'أحمد', category: 'الحديث', contemporary: false, deathYearHijri: 300, publisher: 'دار، نشر', edition: 'الثانية', investigator: 'محقق', publicationYearHijri: 1440, seriesName: 'مدارج العلم', seriesOrder: 2, fileName: 'book.docx' }])
    expect(parseLibraryCatalogCsv(csv)).toEqual([{ id: 'b', title: 'كتاب، العلم', author: 'أحمد', category: 'الحديث', contemporary: false, deathYearHijri: 300, publisher: 'دار، نشر', edition: 'الثانية', investigator: 'محقق', publicationYearHijri: 1440, seriesName: 'مدارج العلم', seriesOrder: 2 }])
    expect(() => parseLibraryCatalogCsv('العنوان,المؤلف\nكتاب,أحمد')).toThrow('المعرف')
  })
})
