import { describe, expect, it } from 'vitest'
import { BOOK_CATEGORIES, approximateGregorianYear, applyFolderAuthor, fileNameTitle, folderAuthorFromRelativePath, isDocxFile, isWordFile, parseBookFileName, shouldShowMultiFileImportControls } from './library_metadata'

describe('library metadata', () => {
  it('uses the documented approximate Hijri conversion', () => {
    expect(approximateGregorianYear(1445)).toBe(Math.round(1445 - 1445 / 33 + 622))
  })

  it('accepts DOCX and rejects unrelated files', () => {
    expect(isDocxFile({ name: 'كتاب.DOCX', type: '' })).toBe(true)
    expect(isDocxFile({ name: 'صورة.png', type: 'image/png' })).toBe(false)
  })

  it('accepts legacy DOC and RTF for normalization', () => {
    expect(isWordFile({ name: 'تراث.doc', type: 'application/msword' })).toBe(true)
    expect(isWordFile({ name: 'بحث.rtf', type: 'application/rtf' })).toBe(true)
  })

  it('falls back to the cleaned file name', () => {
    expect(fileNameTitle('الطريق إلى القرآن.docx')).toBe('الطريق إلى القرآن')
  })

  it('takes a single Arabic book title and author from the file name', () => {
    expect(parseBookFileName('زهر الخمائل ـ إبراهيم القوصي.docx')).toEqual({ title: 'زهر الخمائل', author: 'إبراهيم القوصي' })
    expect(parseBookFileName('تهنئة ومؤازرة — الشيخ إبراهيم القوصي.docx')).toEqual({ title: 'تهنئة ومؤازرة', author: 'إبراهيم القوصي' })
    expect(parseBookFileName('المدخل - محمد بن أحمد.docx')).toEqual({ title: 'المدخل', author: 'محمد بن أحمد' })
    expect(parseBookFileName('توحيد الحاكمية - أبو طلال.docx')).toEqual({ title: 'توحيد الحاكمية', author: 'أبو طلال' })
    expect(parseBookFileName('التشريع الوضعي دراسة عقدية - د. محمد القرني.pdf')).toEqual({ title: 'التشريع الوضعي دراسة عقدية', author: 'د. محمد القرني' })
  })

  it('uses the imported root folder as author only when the file has no author suffix', () => {
    expect(folderAuthorFromRelativePath('أبو طلال/توحيد الحاكمية.docx')).toBe('أبو طلال')
    expect(folderAuthorFromRelativePath('أبو طلال/العقيدة/توحيد الحاكمية.docx')).toBe('أبو طلال')
    expect(folderAuthorFromRelativePath('توحيد الحاكمية.docx')).toBeUndefined()
    expect(applyFolderAuthor({ title: 'توحيد الحاكمية' }, 'أبو طلال')).toEqual({ title: 'توحيد الحاكمية', author: 'أبو طلال' })
    expect(applyFolderAuthor({ title: 'توحيد الحاكمية', author: 'المؤلف الصريح' }, 'مؤلف المجلد')).toEqual({ title: 'توحيد الحاكمية', author: 'المؤلف الصريح' })
  })

  it('does not break compound titles merely because they contain a hyphen', () => {
    expect(parseBookFileName('الأمر بالمعروف - دراسة مقارنة.docx')).toEqual({ title: 'الأمر بالمعروف - دراسة مقارنة' })
    expect(parseBookFileName('فقه السيرة - الجزء الأول - نسخة منقحة.docx')).toEqual({ title: 'فقه السيرة - الجزء الأول - نسخة منقحة' })
  })

  it('shows batch and multipart controls only for a real multi-file selection', () => {
    expect(shouldShowMultiFileImportControls(1)).toBe(false)
    expect(shouldShowMultiFileImportControls(2)).toBe(true)
  })

  it('ships the complete initial Shamela category tree', () => {
    expect(BOOK_CATEGORIES).toContain('العقيدة')
    expect(BOOK_CATEGORIES).toContain('علوم القرآن وأصول التفسير')
    expect(BOOK_CATEGORIES).toContain('السياسة الشرعية والقضاء')
    expect(BOOK_CATEGORIES).toContain('علوم أخرى')
    expect(BOOK_CATEGORIES.length).toBe(40)
  })
})
