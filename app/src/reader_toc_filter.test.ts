import { describe, expect, it } from 'vitest'
import { extractPdfOutline, normalizeTocQuery } from './reader_toc'

describe('unified reader TOC filter', () => {
  it('normalizes Arabic diacritics, alef forms and Arabic digits', () => {
    expect(normalizeTocQuery('إِمَام ١٢')).toBe(normalizeTocQuery('امام 12'))
  })

  it('keeps PDF nested destinations and emits breadcrumbs', async () => {
    const entries = await extractPdfOutline({
      getOutline: async () => [{ title: 'الباب', items: [{ title: 'المسألة', dest: [{ num: 4 }] }] }],
      getDestination: async () => null,
      getPageIndex: async (ref) => (ref as { num: number }).num,
    })
    expect(entries).toEqual([{ num: 5, label: 'الباب ← المسألة' }])
  })

  it('does not invent an outline when PDF has none', async () => {
    expect(await extractPdfOutline({ getOutline: async () => null, getDestination: async () => null, getPageIndex: async () => 0 })).toEqual([])
  })
})
