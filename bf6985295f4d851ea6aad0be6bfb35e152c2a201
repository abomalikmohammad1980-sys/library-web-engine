import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const MARKDOWN = readFileSync(new URL('./markdown_render.ts', import.meta.url), 'utf8')
const READER = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
const CSS = readFileSync(new URL('./styles/components.css', import.meta.url), 'utf8')

describe('generic Markdown and tafsir reader contract', () => {
  it('justifies Arabic prose without stretching headings or final lines', () => {
    expect(CSS).toContain('text-align: justify; text-align-last: start; hyphens: none')
    expect(CSS).toMatch(/reader__markdown-page h6[^}]+text-align: start; text-align-last: start;/s)
  })

  it('derives exact verse anchors from structured headings and consumes the deep link', () => {
    expect(MARKDOWN).toContain('decorateTafsirAnchors(source)')
    expect(MARKDOWN).toContain("child.dataset.tafsirSurah")
    expect(READER).toContain('requestedTafsirPage')
    expect(READER).toContain('reader-deep-link-target')
  })

  it('hides edit and delete affordances for immutable system books', () => {
    const LIBRARY = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
    expect(LIBRARY).toContain("book.managedSource !== 'published'")
    expect(LIBRARY).toContain('كتاب أصلي مثبّت')
    expect(READER).toContain("book.managedSource !== 'published'")
  })
})
