import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('Markdown reader contract', () => {
  it('uses GFM, sanitizes HTML, preserves RTL and builds heading navigation', () => {
    const renderer = readFileSync(new URL('./markdown_render.ts', import.meta.url), 'utf8')
    const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
    const css = readFileSync(new URL('./styles/components.css', import.meta.url), 'utf8')
    expect(renderer).toMatch(/marked\.parse\([^\n]+\{ gfm: true, breaks: false, async: false \}\)/)
    expect(renderer).toContain('DOMPurify.sanitize')
    expect(renderer).toContain("FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form']")
    expect(renderer).toContain("source.dir = 'rtl'")
    expect(renderer).toContain("querySelectorAll<HTMLHeadingElement>('h1,h2,h3,h4,h5,h6')")
    expect(renderer).toContain("node.matches('table')")
    expect(renderer).toContain('expandFootnotes(markdown)')
    expect(renderer).toContain("querySelectorAll<HTMLImageElement>('img[src]')")
    expect(renderer).toContain('URL.createObjectURL')
    expect(reader).toContain("format === 'markdown'")
    expect(reader).toContain('URL.revokeObjectURL')
    expect(css).toContain('.reader--markdown .reader__markdown-page table')
    expect(css).toContain('.reader--markdown .reader__markdown-page blockquote')
    expect(css).toContain("font-family: var(--font-textual-book)")
    expect(css).toContain('.reader--markdown .markdown-footnotes')
  })
})
