import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
const intake = readFileSync(new URL('./book_import.ts', import.meta.url), 'utf8')
const profile = readFileSync(new URL('./screens/book.ts', import.meta.url), 'utf8')
const css = readFileSync(new URL('./styles/components.css', import.meta.url), 'utf8')

describe('BOK real-corpus reader pipeline', () => {
  it('moves structured Betaka metadata into its dedicated review/profile fields', () => {
    for (const field of ['publisher', 'edition', 'investigator', 'publicationYearHijri']) {
      expect(intake).toContain(`parsed.${field}`)
    }
    for (const label of ['الناشر', 'الطبعة', 'المحقق أو المراجع', 'سنة النشر']) expect(profile).toContain(label)
    expect(intake).toContain('rawSourceMetadata: parsed.rawBetaka')
  })

  it('anchors TOC navigation at the exact heading inside its physical BOK page', () => {
    expect(reader).toContain("bookmark: `bok-toc-${index + 1}`")
    expect(reader).toContain('nav.goToBookmark?.(item.bookmark)')
    expect(reader).toContain("document.getElementById(bookmark)?.scrollIntoView")
    expect(reader).not.toMatch(/nav\.goTo\(Math\.max\([^)]*-\s*[23]/)
  })

  it('keeps RTL text, explicit footnotes, TOC filtering and 390px-safe pages', () => {
    expect(reader).toContain("aria-label': 'حواشي الصفحة'")
    expect(reader).toContain('shamelaTextBlocks(source.text)')
    expect(reader).toContain("search.addEventListener('input', filter)")
    expect(css).toContain('.reader--textual .reader__text-notes')
    expect(css).toContain('@media (max-width: 640px)')
    expect(css).toContain('.reader--textual .reader__text-page.page')
  })
})
