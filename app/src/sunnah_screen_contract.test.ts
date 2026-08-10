import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const screen = readFileSync(fileURLToPath(new URL('./screens/sunnah.ts', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('./styles/screens.css', import.meta.url)), 'utf8')

describe('sunnah library screen contract', () => {
  it('keeps reading, author, and category as separate non-nested links', () => {
    expect(screen).toContain("h('article', { class: 'sunnah-book-result'")
    expect(screen).toContain("bookAuthorLinks(book, 'sunnah-book-result__author')")
    expect(screen).toContain("categoryLink(book.category, 'sunnah-book-result__category')")
    expect(screen).toContain("h('a', { class: 'sunnah-book-result__read', href: readingHref }, 'افتح في القارئ')")
  })

  it('filters the real local sunnah catalog by category and searchable metadata', () => {
    expect(screen).toContain("class: 'sunnah-search__category'")
    expect(screen).toContain("category.addEventListener('change', render)")
    expect(screen).toContain('book.tags?.map(tag => tag.name)')
    expect(screen).toContain('book.description')
  })

  it('stacks the category filter on narrow phones', () => {
    expect(styles).toMatch(/@media \(max-width:\s*540px\)[^{]*\{[^}]*\.sunnah-results[\s\S]*?\.sunnah-search__meta\s*\{[^}]*flex-direction:\s*column/s)
    expect(styles).toMatch(/@media \(max-width:\s*540px\)[^{]*\{[^}]*\[data-app-theme='dark'\] \.sunnah-hero__mark--muhammad\s*\{[^}]*width:\s*48px;[^}]*opacity:\s*\.26/s)
  })

  it('uses one compact title and two decorative historical marks', () => {
    expect(screen).not.toContain("h('p', { class: 'page-eyebrow' }, 'السنة النبوية')")
    expect(screen).toContain("'موسوعة السنة النبوية'")
    expect(screen).toContain("class: 'sunnah-hero__mark sunnah-hero__mark--muhammad'")
    expect(screen).toContain("src: '/sunnah/muhammad-seal.png'")
    expect(screen).toContain("class: 'sunnah-hero__mark sunnah-hero__mark--prophethood'")
    expect(screen).toContain("src: '/sunnah/prophethood-seal.png'")
    expect(styles).toMatch(/\.sunnah-hero__mark--prophethood img\s*\{[^}]*filter:\s*invert\(1\)/s)
    expect(styles).toMatch(/\.sunnah-hero__mark--muhammad\s*\{[^}]*inset-inline-end:[^}]*inset-block-start:/s)
    expect(styles).toMatch(/\.sunnah-hero__mark--prophethood\s*\{[^}]*inset-inline-start:[^}]*inset-block-start:/s)
    expect(styles).not.toMatch(/\.sunnah-hero__mark--prophethood\s*\{[^}]*inset-block-end:/s)
    expect(styles).toMatch(/\.sunnah-hero\s*\{[^}]*width:\s*min\(100%,\s*980px\);[^}]*padding:\s*20px/s)
  })

  it('fails closed without misnaming an unknown source', () => {
    expect(screen).toContain("const source = sourceId === HADEETHENC_AR_SOURCE.id ? HADEETHENC_AR_SOURCE : undefined")
    expect(screen).toContain("source?.name ?? 'مصدر سنة غير مسجل'")
    expect(screen).toContain("if (!source)")
    expect(screen).toContain("loadVerifiedSunnahCorpus(source)")
    expect(screen).toContain("source ? 'مصدر موثق' : 'تحقق المصدر'")
  })

  it('keeps attribution, update, download, and terms links on the verified source page', () => {
    expect(screen).toContain('manifest.checkForUpdatesUrl')
    expect(screen).toContain('manifest.downloadUrl')
    expect(screen).toContain('manifest.termsUrl')
    expect(screen).toContain("`${records.length.toLocaleString('ar')} شاهدًا ذهبيًا`")
  })

  it('keeps canonical witness search separate from the local book catalog', () => {
    expect(screen).toContain('sunnahCorpusSearchPanel()')
    expect(screen).toContain('searchSunnahCorpus(records, query)')
    expect(screen).toContain("'البحث محصور في العينة الذهبية الحالية، ولا يدّعي تغطية كتب السنة كلها.'")
    expect(screen).toContain("`${matches.length.toLocaleString('ar')} شاهد مطابق من ${records.length.toLocaleString('ar')}`")
    expect(styles).toMatch(/\.sunnah-corpus-search__controls\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/s)
    expect(styles).toMatch(/\.sunnah-corpus-search__controls\s*\{[^}]*grid-template-columns:\s*1fr/s)
    expect(screen).not.toContain('href: record.link')
    expect(screen).toContain("'صفحة مصدر العينة'")
  })
})
