import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('home book card destinations', () => {
  it('keeps book, author, and category as independent links without nested anchors', () => {
    const source = readFileSync(new URL('./screens/home.ts', import.meta.url), 'utf8')
    expect(source).toContain('function homePopularCard')
    expect(source).toContain('function homeNewCard')
    expect(source).toContain('authorLink(book.author)')
    expect(source).toContain('categoryLink(book.category)')
    expect(source).toContain("h('article', { class: 'home-popular-card'")
    expect(source).toContain("h('article', { class: 'home-new-card'")
  })

  it('keeps the continue-reading identity legible on its light surface', () => {
    const source = readFileSync(new URL('./screens/home.ts', import.meta.url), 'utf8')
    const screens = readFileSync(new URL('./styles/screens.css', import.meta.url), 'utf8')
    const components = readFileSync(new URL('./styles/components.css', import.meta.url), 'utf8')
    expect(source).toContain("authorLink(book.author, 'continue-card__author')")
    expect(source).toContain("class: 'btn btn--primary continue-card__resume', href: `#/reader/${book.id}`")
    expect(source).toContain("class: 'continue-card__mark', href: `#/reader/${book.id}`")
    expect(source).toContain("'aria-label': `متابعة قراءة ${book.title} من الصفحة ${currentPage}`")
    expect(source).toContain("`أكمل قراءتك — فقد وصلتَ إلى ص ${currentPage}`")
    expect(source).not.toContain("icon('book', 18), 'متابعة القراءة'")
    expect(source).toContain("'ورد القراءة اليومي'")
    expect(source).toContain("'ورد المراجعة'")
    expect(screens).toMatch(/\.continue-card\s*\{[^}]*color:\s*var\(--ink-strong\)/s)
    expect(screens).toMatch(/\.continue-card__copy h2\s*\{[^}]*color:\s*var\(--ink-strong\)[^}]*font-size:\s*clamp\(24px, 2\.35vw, 34px\)/s)
    expect(screens).toMatch(/\.continue-card__author\s*\{[^}]*color:\s*var\(--brand-primary-dark\)[^}]*font-family:\s*var\(--font-ui\)[^}]*font-size:\s*var\(--step-caption\)/s)
    expect(components).not.toMatch(/\.continue-card\s*\{[^}]*color:\s*#fff/s)
  })
})
