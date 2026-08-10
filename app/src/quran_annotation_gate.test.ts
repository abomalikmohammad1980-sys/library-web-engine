import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')

describe('conservative Quran annotation gate', () => {
  it('does not classify brace candidates as Quran by punctuation alone', () => {
    const section = source.slice(source.indexOf('function decorateTextParagraph'), source.indexOf('function configureReaderSourceLabel'))
    expect(section).not.toContain('﴿[^﴾]+﴾')
    expect(section).not.toContain('{[^{}]')
    expect(section).toContain('quran-annotations')
    expect(section).toContain('corpusVersion/checksum')
  })
})
