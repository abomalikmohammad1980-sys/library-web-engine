import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')

describe('PDF reader download identity', () => {
  it('keeps one clearly named PDF action for standalone PDF sources', () => {
    expect(reader).toContain("label.textContent = format === 'pdf' ? 'تحميل PDF'")
    expect(reader).toContain("if (format === 'pdf')")
    expect(reader).toContain("'[data-reader-pdf-action=\"download\"]')?.remove()")
    expect(reader).toContain("'[data-reader-pdf-action=\"beside\"]')?.remove()")
  })

  it('retains distinct source and derived PDF controls for Word books', () => {
    expect(reader).toContain("'Word الأصلي'")
    expect(reader).toContain("downloadPdf.dataset.readerPdfAction = 'download'")
    expect(reader).toContain("sourceDownload.dataset.readerSourceAction = 'download'")
  })
})
