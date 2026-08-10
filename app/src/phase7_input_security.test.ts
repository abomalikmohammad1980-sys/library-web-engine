import { readFileSync } from 'node:fs'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { libraryCatalogCsv, parseLibraryCatalogCsv } from './library_catalog_csv'
import { annotationsMarkdown } from './annotations_markdown'
import { researchProjectDocx } from './research_project_docx'

describe('phase 7 imported/user content security', () => {
  it.each(['=CMD()', '+SUM(1)', '-2+3', '@IMPORTXML("x")'])('neutralizes CSV formula %s while preserving round-trip', title => { const csv = libraryCatalogCsv([{ id: 'b', title, author: 'م', fileName: 'b.docx' }]); expect(csv).toMatch(/"'[@=+\-]/); expect(parseLibraryCatalogCsv(csv)[0]?.title).toBe(title) })
  it('escapes Markdown structure and strips bidi controls', () => { const md = annotationsMarkdown({ bookmarks: {}, highlights: [], notes: [{ id: 'n', bookId: 'b', pageIndex: 0, text: '<script>_*\u202E', createdAt: 1 }] }, new Map([['b', { title: '# [x](javascript:alert(1))' }]])); expect(md).not.toContain('\u202E'); expect(md).toContain('\\<script\\>'); expect(md).toContain('\\#') })
  it('escapes DOCX XML user content', () => { const bytes = researchProjectDocx({ id: 'p', title: '<w:evil>&', description: '', annotationIds: [], createdAt: 1, updatedAt: 1 }, []); const xml = strFromU8(unzipSync(bytes)['word/document.xml']!); expect(xml).toContain('&lt;w:evil&gt;&amp;'); expect(xml).not.toContain('<w:evil>') })
  it('keeps user content out of innerHTML sinks', () => { const screens = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8') + readFileSync(new URL('./screens/search.ts', import.meta.url), 'utf8'); expect(screens).not.toContain('.innerHTML ='); expect(screens).not.toContain('insertAdjacentHTML') })
})
