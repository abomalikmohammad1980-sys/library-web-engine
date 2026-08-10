import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { needsPdfRefresh } from './engine/word_pdf'
import { assertBookFormat, invalidBookFormatMessage } from './book_format_validation'
import { publishedBookNeedsRefresh } from './published_library_seed'
import { readFileSync } from 'node:fs'

const root = path.resolve(import.meta.dirname, '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/library/published/manifest.json'), 'utf8')) as { works: Array<{ title: string; status: string; sources: Array<{ format: string; path: string; fileName: string }> }> }

describe('published standalone PDF routing', () => {
  it('refreshes an existing managed published record before choosing PDF.js routing', () => {
    const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
    expect(reader).toContain("if (!stored || stored.managedSource === 'published')")
    expect(reader).toContain('stored = await ensurePublishedWorkSeeded(id) ?? stored')
    expect(reader.indexOf("stored.managedSource === 'published'")).toBeLessThan(reader.indexOf("if (inferBookFormat(stored) === 'pdf')"))
  })

  it('opens the exact Pharaoh PDF as PDF bytes and never requests Word conversion', async () => {
    const work = manifest.works.find(item => item.title === 'فرعون في القرآن')!
    const source = work.sources.find(item => item.format === 'pdf')!
    const bytes = new Uint8Array(fs.readFileSync(path.join(root, 'public', source.path.replace(/^\.\//, ''))))
    expect(work.status).toBe('ready')
    expect(source.fileName).toContain('فرعون في القرا')
    expect(() => assertBookFormat(bytes, 'pdf')).not.toThrow()
    expect(needsPdfRefresh({ sourceFormat: 'pdf', pdfData: bytes, pdfEngine: 'published-original-v1' })).toBe(false)
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false })
    expect(pdf.getPageCount()).toBeGreaterThan(1)
  })

  it('uses centralized format-aware invalid copy', () => {
    expect(() => assertBookFormat(new TextEncoder().encode('PK-not-pdf'), 'pdf')).toThrow('الملف المرسل ليس PDF صالحًا')
    expect(invalidBookFormatMessage('word')).toBe('الملف المرسل ليس DOCX صالحًا')
    expect(invalidBookFormatMessage('shamela-bok')).toContain('BOK')
    expect(invalidBookFormatMessage('epub')).toContain('EPUB')
    expect(invalidBookFormatMessage('text')).toContain('UTF-8')
  })

  it('refreshes a published PDF whose cached bytes were truncated', () => {
    const work = manifest.works.find(item => item.title === 'فرعون في القرآن')!
    const source = work.sources.find(item => item.format === 'pdf')!
    const stale = {
      managedSource: 'published', originalSha256: source.sha256,
      data: new Uint8Array(source.bytes), pdfData: new Uint8Array(source.bytes - 1),
    }
    expect(publishedBookNeedsRefresh(stale as never, work as never)).toBe(true)
  })
})
