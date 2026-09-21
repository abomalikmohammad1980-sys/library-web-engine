import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'
const reader=readFileSync(new URL('./screens/reader.ts',import.meta.url),'utf8')
const info=reader.slice(reader.indexOf('function renderBookInfo('),reader.indexOf('function isTechnicalSourceCitation'))
it('places original download beside the format and never fabricates a BOK source',()=>{
 expect(info).toContain('const original = localOriginalAsset(book)')
 expect(info).toContain("class:'reader__format-actions'")
 expect(info).toContain('...(source ? [source] : [])')
 expect(info).toContain('downloadBytes(original!.bytes, original!.fileName, original!.mimeType)')
})
it('reuses the bottom toolbar PDF handlers for all text formats',()=>{
 expect(info).toContain('downloadConvertedPdf(book.id)')
 expect(info).toContain("if (format !== 'pdf')")
 expect(info).toContain("pdfButtonAction(book,'standard')==='formatted'")
 expect(info).toContain("pdfButtonAction(book,'pdf-text')==='original'")
 expect(info).toContain('togglePdfBesideBook(book.id,panel)')
})
it('retains admin authority and private deletion identity fences with accessible icons',()=>{
 expect(info).toContain('publishedBookControls(book, editorHost)')
 expect(info).toContain('!identity.isCurrent()')
 expect(info).toContain("button.setAttribute('aria-label', label)")
 expect(info).toContain('button.replaceChildren(icon(name, 24))')
 expect(info).toContain('independentPdfPanel(book,false,true)')
 expect(info).not.toContain('independentPdfPanel(book,false),')
})
it('places larger actions directly below the cover and makes compact facts accessible',()=>{
 expect(info).toMatch(/bookCover\(book, 'reader__book-cover'\),\s*actions,\s*h\('dl'/)
 expect(info).toContain("label.setAttribute('aria-label', title)")
 expect(info).toContain('label.title = title')
 expect(info).toContain('label.tabIndex = 0')
 expect(info).toContain('`${arabicNum(pageCount)} صفحة`')
})
