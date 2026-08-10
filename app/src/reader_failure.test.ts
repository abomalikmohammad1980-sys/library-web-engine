import { describe, expect, it } from 'vitest'
import { classifyReaderFailure, plainReaderGroups, type ReaderFailureStage } from './reader_failure'

describe('safe reader failures', () => {
  it.each<ReaderFailureStage>(['load', 'parse', 'model', 'preview', 'layout', 'dom', 'unknown'])('returns a stable safe code for %s', stage => {
    const failure = classifyReaderFailure(new Error('private C:\\Users\\name\\book.docx secret text'), stage)
    expect(failure.code).toMatch(/^READER-[A-Z-]+-001$/)
    expect(`${failure.title} ${failure.description}`).not.toContain('C:\\Users')
    expect(`${failure.title} ${failure.description}`).not.toContain('secret text')
  })

  it('promotes font and Word page-map failures to their precise safe stages', () => {
    expect(classifyReaderFailure(new Error('FontFace wasm failed'), 'layout').stage).toBe('font')
    const mapError = new Error('word_page_map mismatch'); mapError.name = 'WordPageMapMismatchError'
    expect(classifyReaderFailure(mapError, 'layout').stage).toBe('page-map')
  })

  it('builds deterministic plain groups without excluded or empty content', () => {
    expect(plainReaderGroups([
      { text: 'الأول' }, { text: 'سري', excluded: true }, { text: ' ' }, { text: 'الثاني' }, { text: 'الثالث' },
    ], 2)).toEqual([['الأول', 'الثاني'], ['الثالث']])
  })
})
