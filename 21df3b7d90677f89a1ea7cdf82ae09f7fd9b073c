import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const importer = readFileSync(new URL('./book_import.ts', import.meta.url), 'utf8')
const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
const library = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
const book = readFileSync(new URL('./screens/book.ts', import.meta.url), 'utf8')
const css = readFileSync(new URL('./styles/components.css', import.meta.url), 'utf8')
const tokens = readFileSync(new URL('./styles/tokens.css', import.meta.url), 'utf8')
const metadata = readFileSync(new URL('./library_metadata.ts', import.meta.url), 'utf8')

describe('multi-format mobile 390 contract', () => {
  it('exposes one unified intake for every declared book format', () => {
    expect(importer).toContain('إضافة ملفات')
    expect(importer).toContain('إضافة مجلد')
    expect(importer).toContain('Word وPDF وEPUB وBOK والنصوص')
    expect(importer).not.toContain("'إضافة PDF'")
    expect(importer).not.toContain("'إضافة نص UTF-8'")
    expect(importer).not.toContain("'إضافة EPUB'")
    for (const extension of ['.docx', '.doc', '.rtf', '.pdf', '.epub', '.bok', '.txt', '.md']) expect(importer).toContain(extension)
    // Unified intake + directory intake + the optional PDF attachment inside Word review.
    expect(importer.match(/makeProgrammaticFileInput/g)?.length).toBe(3)
    expect(importer).toContain("if (/\\.pdf$/i.test(file.name))")
    expect(importer).toContain("if (/\\.epub$/i.test(file.name))")
    expect(importer).toContain("if (/\\.(txt|md)$/i.test(file.name))")
    expect(importer).toContain('parseBok(data, file.name)')
    expect(importer.indexOf('runtime.process ??=')).toBeLessThan(importer.indexOf("import('./bok_import')"))
  })

  it('keeps batch and multipart panels out of a single-file review', () => {
    expect(metadata).toContain('return Number.isInteger(fileCount) && fileCount > 1')
    expect(importer).toContain('if (shouldShowMultiFileImportControls(drafts.length)) form.append(batch)')
    expect(importer).toContain('if (shouldShowMultiFileImportControls(drafts.length) && wordOnly) form.append(multipart)')
  })

  it('shows format badges and source-accurate download names', () => {
    expect(library).toContain("class: 'book-format-badge'")
    expect(book).toContain("class: 'book-format-badge'")
    for (const label of ['تحميل PDF', 'تحميل النص الأصلي', 'تحميل EPUB الأصلي', 'تحميل BOK الأصلي']) expect(library + book).toContain(label)
    expect(css).toContain('.book-format-badge')
    expect(css).toContain('white-space: nowrap')
  })

  it('uses one rich textual reading system for BOK, EPUB and UTF-8 text', () => {
    expect(reader).toContain("reader.classList.add('reader--textual')")
    expect(reader).toContain('reader__text-verse')
    expect(reader).toContain('reader__text-paragraph--hadith')
    expect(reader).toContain('reader__text-folio')
    expect(reader).toContain("stored.bokTextVersion !== 3")
    expect(reader).toContain('updateBokDerivedText')
    expect(reader).toContain('shamelaTextBlocks')
    expect(reader).toContain('reader__text-footnote-rule')
    expect(reader).toContain('reader__text-verse-ref')
    expect(reader).toContain('indent: 0')
    expect(css).toContain('font-family: var(--font-textual-book), serif !important')
    expect(css).not.toContain("reader__text-paragraph[data-indent=")
    expect(css).not.toMatch(/reader__text-paragraph--hadith[^\n]*padding-inline/)
    expect(tokens).toContain("font-family: 'Adwa Assalaf'")
    expect(tokens).toContain("--font-textual-book: 'Adwa Assalaf', serif")
  })

  it('has safe reader recovery and never sends non-Word sources to Word rebuild', () => {
    expect(reader).toContain("inferBookFormat(stored) !== 'word'")
    for (const action of ['إعادة المحاولة', 'إعادة معالجة الأصل', 'عرض نصي احتياطي', 'تنزيل Word الأصلي']) expect(reader).toContain(action)
    for (const sourceLabel of ['PDF الأصلي', 'النص الأصلي', 'EPUB الأصلي', 'BOK الأصلي', 'Word الأصلي']) expect(reader).toContain(sourceLabel)
  })

  it('uses bounded responsive rules rather than a fixed desktop width', () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*640px\)/)
    expect(css).not.toMatch(/\.import-manager__actions\s*\{[^}]*min-width:\s*[4-9]\d{2}px/s)
  })
})
