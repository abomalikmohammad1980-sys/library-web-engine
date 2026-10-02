import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('home book card destinations', () => {
  it('keeps book, author, and category as independent links without nested anchors', () => {
    const source = readFileSync(new URL('./screens/home.ts', import.meta.url), 'utf8')
    expect(source).toContain('function homePopularCard')
    expect(source).toContain('function homeNewCard')
    expect(source.match(/authorLink\(book\.author, undefined, book\.authorId\)/g)).toHaveLength(2)
    // New-card union includes entries without an audited author identity.
    expect(source).toContain("authorLink(book.author, undefined, 'authorId' in book?book.authorId:undefined)")
    expect(source).toContain('categoryLink(effectiveBookCategory(book))')
    expect(source).toContain("h('article', { class: 'home-popular-card'")
    expect(source).toContain("h('article', { class: 'home-new-card'")
  })

  it('keeps the continue-reading identity legible on its light surface', () => {
    const source = readFileSync(new URL('./screens/home.ts', import.meta.url), 'utf8')
    const screens = readFileSync(new URL('./styles/screens.css', import.meta.url), 'utf8')
    const components = readFileSync(new URL('./styles/components.css', import.meta.url), 'utf8')
    expect(source).toContain("authorLink(book.author, 'continue-card__author', book.authorId)")
    expect(source).toContain("class: 'btn btn--primary continue-card__resume', href: `#/reader/${book.id}`")
    expect(source).toContain("class: 'continue-card__mark', href: `#/reader/${book.id}`")
    expect(source).toContain("bookCover(book, 'continue-card__cover')")
    expect(source).not.toContain("icon('book', 30)")
    expect(source).toContain("'c5e6ec19c82f0d93',{p1:book.title,p2:currentPage}")
    expect(source).toContain("uiTemplateText('3c0e4013692ecf19',{p1:currentPage})")
    expect(source).not.toContain("icon('book', 18), 'متابعة القراءة'")
    expect(source).toContain("'ورد القراءة اليومي'")
    expect(source).toContain("'ورد المراجعة'")
    expect(screens).toMatch(/\.continue-card\s*\{[^}]*color:\s*var\(--ink-strong\)/s)
    expect(screens).toMatch(/\.continue-card__copy h2\s*\{[^}]*color:\s*var\(--ink-strong\)[^}]*font-size:\s*clamp\(24px, 2\.35vw, 34px\)/s)
    expect(screens).toMatch(/\.continue-card__author\s*\{[^}]*color:\s*var\(--brand-primary-dark\)[^}]*font-family:\s*var\(--font-ui\)[^}]*font-size:\s*var\(--step-caption\)/s)
    expect(screens).toMatch(/\.continue-card__cover\s*\{[^}]*block-size:\s*100%[^}]*aspect-ratio:\s*auto/s)
    expect(components).not.toMatch(/\.continue-card\s*\{[^}]*color:\s*#fff/s)
  })

  it('frames every home section heading with mirrored gold ornaments', () => {
    const source = readFileSync(new URL('./screens/home.ts', import.meta.url), 'utf8')
    const screens = readFileSync(new URL('./styles/screens.css', import.meta.url), 'utf8')
    for (const title of ['الكتب الأكثر استعمالًا', 'لوحة اليوم']) {
      expect(source).toContain(`sectionHeader('${title}'`)
    }
    for(const title of ['جديد المكتبة','مقترح لك من خزانتك'])expect(source).toContain(`linkedHomeHeader('${title}'`)
    expect(screens).toMatch(/\.home-page \.section-header h2::before,\s*\.home-page \.section-header h2::after\s*\{/s)
    expect(screens).toContain('background: linear-gradient(90deg, #d8a83e, #f0cc75)')
    expect(screens).toContain('.home-page .section-header h2::after { transform: scaleX(-1); }')
  })
})
