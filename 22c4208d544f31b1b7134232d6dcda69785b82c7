import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('PDF title authority', () => {
  it('keeps the user filename as the title instead of internal first-page metadata', () => {
    const source = readFileSync(new URL('./pdf_import_draft.ts', import.meta.url), 'utf8')
    expect(source).toContain('title: fromName.title')
    expect(source).toContain('author: fromName.author || metadata.author || fallbackAuthor')
    expect(source).not.toContain('metadata.title || fromName.title')
  })
})
