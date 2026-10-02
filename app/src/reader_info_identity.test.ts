import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('reader book card identity', () => {
  it('keeps unified metadata inside the reader for every source format', () => {
    const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
    expect(reader).toContain('bookInfoAside(id, initialTitle)')
    expect(reader).toContain('bookInfoDialog(initialTitle)')
    expect(reader).toContain("'aria-label': 'بطاقة الكتاب'")
    expect(reader).toContain("bookAuthorLinks(book, 'reader__info-author-link')")
    expect(reader).toContain("const format = inferBookFormat(book)")
    expect(reader).toContain("'إغلاق بطاقة الكتاب'")
    expect(reader).toContain("'aria-label': 'معلومات الكتاب'")
    expect(reader).toContain('effectiveBookCategory(book)')
    expect(reader).toContain("h('dt', null, 'التصنيف')")
    expect(reader).toContain("h('dt', null, 'عدد الصفحات')")
    expect(reader).toContain("h('dt', null, 'عدد الأجزاء')")
    expect(reader).toContain('bookVolumeCount(metadataBook)')
    expect(reader).toContain('bookPageCount(book)')
    expect(reader).toContain("h('dt', null, 'الوسوم')")
    expect(reader).toContain("href: `#/library?tag=${encodeURIComponent(tag.name)}`")
    expect(reader).not.toContain('href: `#/book/${encodeURIComponent(book.id)}`')
  })

  it('keeps the card itself opaque while dimming only the reader behind it', () => {
    const css = readFileSync(new URL('./styles/components.css', import.meta.url), 'utf8')
    const panel = css.match(/\.reader__book-card-panel\s*\{(?<body>[\s\S]*?)\n\}/)?.groups?.body ?? ''
    expect(panel).toContain('background: var(--paper-surface)')
    expect(panel).toContain('color: var(--ink-default)')
    expect(panel).toContain('isolation: isolate')
    expect(panel).not.toMatch(/background[^;]*transparent/)
    expect(panel).not.toMatch(/opacity\s*:/)
    expect(panel).not.toContain('backdrop-filter')
    expect(css).toContain('.reader__book-card .reader__metadata > div')
    expect(css).toContain('background: var(--brand-primary-soft)')
  })
})
