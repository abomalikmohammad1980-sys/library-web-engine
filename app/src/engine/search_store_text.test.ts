import { describe, expect, it } from 'vitest'
import type { StoredBook } from './library_store'
import { indexedBokPages, indexedParagraphs, persistentIndexedParagraphs, isLocalBookSearchIndexReady, sortSearchResultsByDeath } from './search_store'
import { normalizeArabicSearchWithMap } from '../../../packages/search/src/index'

describe('text source search indexing', () => {
  it('indexes UTF-8 paragraphs and never sends them through DOCX extraction', async () => {
    const book = { id: 'text-1', sourceFormat: 'text', fileName: 'علم.txt', mimeType: 'text/plain', data: new TextEncoder().encode('باب العلم\n\nفضل التعلّم'), originalSha256: 'sha' } as StoredBook
    expect(await indexedParagraphs(book)).toEqual([{ index: 0, text: 'باب العلم' }, { index: 1, text: 'فضل التعلّم' }])
  })
  it('indexes extracted HTML prose and question banks without treating markup as search text',async()=>{
    const book={id:'html-1',sourceFormat:'html',fileName:'quiz.html',mimeType:'text/html; charset=utf-8',data:new TextEncoder().encode('<script>danger()</script>'),extractedText:'باب التهجئة\n\nقَالَ — مدّ\n\nرَبِّ — شدّة',originalSha256:'html-sha'} as StoredBook
    expect(await indexedParagraphs(book)).toEqual([{index:0,text:'باب التهجئة'},{index:1,text:'قَالَ — مدّ'},{index:2,text:'رَبِّ — شدّة'}])
    const missing={...book,id:'html-missing',extractedText:''}
    await expect(indexedParagraphs(missing)).rejects.toThrow('local_search_text_unavailable:html')
  })
  it('does not claim searchable paragraphs for image-only PDF', async () => {
    const book = { id: 'pdf-1', sourceFormat: 'pdf', fileName: 'scan.pdf', mimeType: 'application/pdf', data: new Uint8Array([1]), originalSha256: 'pdf-sha' } as StoredBook
    await expect(indexedParagraphs(book)).rejects.toThrow('local_search_text_unavailable:pdf')
    await expect(persistentIndexedParagraphs(book)).rejects.toThrow('local_search_text_unavailable:pdf')
    expect(await isLocalBookSearchIndexReady(book)).toBe(false)
  })
  it('rejects missing EPUB and BOK text instead of caching a complete empty index',async()=>{
    for(const sourceFormat of ['epub','shamela-bok'] as const){
      const book={id:`missing-${sourceFormat}`,sourceFormat,fileName:'missing',data:new Uint8Array(),extractedText:'  '} as StoredBook
      await expect(indexedParagraphs(book)).rejects.toThrow(`local_search_text_unavailable:${sourceFormat}`)
      expect(await isLocalBookSearchIndexReady(book)).toBe(false)
    }
  })
  it('preserves authored BOK part/page and carries the nearest section heading', () => {
    expect(indexedBokPages({
      bokPages: [
        { id: 10, text: 'مطلع الباب', part: 2, page: 17 },
        { id: 11, text: 'تكملة الباب', part: 2, page: 18 },
        { id: 20, text: 'باب تال', part: 3, page: 1 },
      ],
      bokToc: [
        { id: 10, title: 'باب العلم', level: 1, parent: 0 },
        { id: 20, title: 'باب العمل', level: 1, parent: 0 },
      ],
    })).toEqual([
      { index: 0, text: 'مطلع الباب', partLabel: '2', pageLabel: '17', sectionHeading: 'باب العلم' },
      { index: 1, text: 'تكملة الباب', partLabel: '2', pageLabel: '18', sectionHeading: 'باب العلم' },
      { index: 2, text: 'باب تال', partLabel: '3', pageLabel: '1', sectionHeading: 'باب العمل' },
    ])
  })
  it('uses the same punctuation/note-transparent phrase contract for text, EPUB and BOK',async()=>{
    const phrase='مقدمة خُذْنا (٧)، فَيا—تُرى خاتمة',base={fileSize:1,originalSha256:''}
    const books=[
      {...base,id:'txt-golden',sourceFormat:'text',fileName:'a.txt',mimeType:'text/plain',data:new TextEncoder().encode(phrase)},
      {...base,id:'epub-golden',sourceFormat:'epub',fileName:'a.epub',mimeType:'application/epub+zip',data:new Uint8Array(),extractedText:phrase},
      {...base,id:'bok-golden',sourceFormat:'shamela-bok',fileName:'a.bok',mimeType:'application/octet-stream',data:new Uint8Array(),extractedText:phrase},
    ] as StoredBook[]
    for(const book of books){const text=(await indexedParagraphs(book))[0]!.text,mapped=normalizeArabicSearchWithMap(text),index=mapped.text.indexOf('خذنا فيا تري');expect(index).toBeGreaterThanOrEqual(0);expect(mapped.originalOffsets[index]).toBe(text.indexOf('خُ'))}
  })
  it('sorts only by death year, keeps unknown last, and preserves stable ties',()=>{
    const rows=[{id:'unknown'},{id:'late',deathYearHijri:852},{id:'early-a',deathYearHijri:702},{id:'early-b',deathYearHijri:702}]
    expect(sortSearchResultsByDeath(rows).map(x=>x.id)).toEqual(['early-a','early-b','late','unknown'])
  })
})
