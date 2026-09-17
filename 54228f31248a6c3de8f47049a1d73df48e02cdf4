import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')

describe('authoritative Word pagination action', () => {
  it('labels estimated reading without claiming printed fidelity', () => {
    expect(reader).toContain('نسخة قراءة تقديرية')
    expect(reader).toContain('لم تُوثق بعد من Word')
    expect(reader).toContain("live.dataset.status = 'approximate'")
  })

  it('feature-gates reprocessing and sends bytes only after an explicit click', () => {
    const notice = reader.slice(reader.indexOf('function readerFidelityNotice'), reader.indexOf('async function reprocessReaderFromOriginal'))
    expect(notice).toContain('getRuntimeCapabilities()')
    expect(notice).toContain('capabilities.wordPdfConversionAvailable')
    expect(notice).toContain("action.addEventListener('click'")
    expect(notice).toContain('await onReprocess()')
    expect(reader).not.toContain('startBookArtifactRefresh')
  })

  it('limits Word processing to Word sources', () => {
    expect(reader).toContain("if (inferBookFormat(stored) !== 'word')")
    expect(reader).toContain('await convertStoredBookToPdf(id)')
  })
})
