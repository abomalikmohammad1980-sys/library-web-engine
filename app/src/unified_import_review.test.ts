import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./book_import.ts', import.meta.url), 'utf8')
const pdfDraft = readFileSync(new URL('./pdf_import_draft.ts', import.meta.url), 'utf8')
const intakeSource = `${source}\n${pdfDraft}`

describe('unified book intake review contract', () => {
  it('stages every supported format and never saves standalone files before review submit', () => {
    expect(source).toContain('await stage(selected, pickedFolderAuthor)')
    expect(intakeSource).toContain("format: 'pdf'")
    expect(source).toContain("format: 'epub'")
    expect(source).toContain("format: markdown ? 'markdown' : 'text'")
    expect(source).toContain("draft.format === 'text' || draft.format === 'markdown'")
    expect(source).toContain("format: 'shamela-bok'")
    const importSelected = source.slice(source.indexOf('const importSelected'), source.indexOf("filesButton.addEventListener"))
    expect(importSelected).not.toMatch(/save(?:Pdf|Epub|Text|Bok)Book/)
    expect(source.indexOf('saveReviewedDraft')).toBeGreaterThan(source.indexOf("form.addEventListener('submit'"))
  })

  it('offers complete editable metadata and a replaceable local cover', () => {
    for (const label of ['الناشر', 'الطبعة', 'المحقق', 'سنة النشر الهجرية', 'الوصف', 'الرف', 'استبدال الغلاف']) expect(source).toContain(label)
    expect(source).toContain("accept: 'image/png,image/jpeg,image/webp'")
    expect(source).toContain('customCoverData')
    expect(source).toContain('coverTemplate')
    expect(source).toContain('item.keepPdfCover.checked ? item.draft.pdfFirstPageCover')
    expect(source).toContain('uploadedCustom ??')
    expect(source).toContain("setBookOnShelf(item.shelf.value, id, true)")
  })

  it('maps source metadata into dedicated fields rather than raw notes', () => {
    for (const formatField of ['metadata.publisher', 'metadata.edition', 'metadata.investigator', 'metadata.publicationYearHijri', 'parsed.publisher', 'parsed.edition', 'parsed.investigator', 'parsed.publicationYearHijri']) expect(intakeSource).toContain(formatField)
    expect(source).toContain('rawSourceMetadata: parsed.rawBetaka')
    expect(source).not.toContain('description: parsed.rawBetaka')
  })

  it('keeps batch and multipart controls out of the single-file flow', () => {
    expect(source).toContain('shouldShowMultiFileImportControls(drafts.length)')
    expect(source).toContain('&& wordOnly')
  })
})
