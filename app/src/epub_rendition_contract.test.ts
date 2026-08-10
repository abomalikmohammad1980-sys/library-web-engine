import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rendition = readFileSync(new URL('./epub_rendition.ts', import.meta.url), 'utf8')
const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
const css = readFileSync(new URL('./styles/components.css', import.meta.url), 'utf8')

describe('EPUB original-fidelity rendition contract', () => {
  it('sanitizes active content while retaining safe publisher markup and local resources', () => {
    expect(rendition).toContain("import DOMPurify from 'dompurify'")
    expect(rendition).toMatch(/FORBID_TAGS:[\s\S]*'script'[\s\S]*'iframe'[\s\S]*'object'/)
    expect(rendition).toContain("URL.createObjectURL")
    expect(rendition).toContain("URL.revokeObjectURL")
    expect(rendition).toContain(".reader__epub-content")
    expect(rendition).toMatch(/javascript\|expression/)
  })

  it('preserves exact chapter/anchor destinations and routes internal links locally', () => {
    expect(rendition).toContain('dataset.epubChapter')
    expect(rendition).toContain('safeId(entry.chapterIndex')
    expect(reader).toContain("closest<HTMLAnchorElement>('a[data-epub-chapter]')")
    expect(reader).toContain('nav.goTo(chapter)')
    expect(reader).toContain('document.getElementById(bookmark)?.scrollIntoView')
  })

  it('uses extracted semantic text for search/translation and remains bounded at 390px', () => {
    expect(reader).toContain('page.dataset.searchText ?? page.textContent')
    expect(css).toContain('@media (max-width: 420px)')
    expect(css).toContain('.reader--epub .reader__epub-page.page')
    expect(css).toMatch(/max-width:\s*100%\s*!important/)
  })
})
