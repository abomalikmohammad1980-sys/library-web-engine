import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { orderedBooks } from './book_ordering'

const screen = readFileSync(fileURLToPath(new URL('./screens/sunnah.ts', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('./styles/screens.css', import.meta.url)), 'utf8')

describe('sunnah library screen contract', () => {
  it('orders books by author death before numbering filtered cards', () => {
    const books = orderedBooks([
      { id: 'late', title: 'المتأخر', author: 'مؤلف متأخر', deathYearHijri: 900 },
      { id: 'unknown', title: 'المعاصر', author: 'مؤلف معاصر', contemporary: true },
      { id: 'early', title: 'المتقدم', author: 'مؤلف متقدم', deathYearHijri: 250 },
    ])
    expect(books.map(book => book.id)).toEqual(['early', 'late', 'unknown'])
    expect(screen).toMatch(/(?:const|let) sunnahBooks = orderedBooks\(/)
    expect(screen).toContain('sunnahWindow(visible, visibleLimit).map((book, index) => sunnahBookResult(book, index))')
  })
  it('makes the whole book card readable while keeping author and category as independent links', () => {
    expect(screen).toContain("h('article', { class: 'sunnah-book-result'")
    expect(screen).toContain("class: 'sunnah-book-result__surface'")
    expect(screen).toContain("hasKnownSunnahAuthor(book) ? bookAuthorLinks(book, 'sunnah-book-result__author') : null")
    expect(screen).toContain("categoryLink(book.category, 'sunnah-book-result__category')")
    expect(screen).not.toContain('افتح في القارئ')
    expect(screen).toContain('bookOrdinal(index)')
    expect(screen).toContain('orderedBooks(')
  })

  it('filters the real local sunnah catalog by category and searchable metadata', () => {
    expect(screen).toContain("class: 'sunnah-search__category'")
    expect(screen).toContain("category.addEventListener('change', resetAndRender)")
    expect(screen).toContain('book.tags?.map(tag => tag.name)')
    expect(screen).toContain('book.description')
  })

  it('bounds initial cards while retaining the full count and accessible incremental loading', () => {
    expect(screen).toContain('const SUNNAH_WINDOW_SIZE = 40')
    expect(screen).toContain('sunnahWindow(visible, visibleLimit).map')
    expect(screen).toContain("more.setAttribute('aria-controls', 'sunnah-results')")
    expect(screen).toContain('visibleLimit = SUNNAH_WINDOW_SIZE')
    expect(screen).toContain('visibleLimit += SUNNAH_WINDOW_SIZE')
    expect(screen).toContain("uiTemplateText('sunnah-books-filtered',{p1:visible.length,p2:sunnahBooks.length})")
  })

  it('renders variable-height passages and resets every new query to result one', () => {
    expect(screen).toContain("results.classList.add('sunnah-results--text')")
    expect(screen).toContain('if(offset===0)results.replaceChildren(')
    expect(screen).toContain('else results.append(...rows.map(sunnahPassageResult))')
    expect(screen).toContain('if(textMode){textOffset=0;textTotal=0;')
    expect(screen).toContain('ordinal:offset+index+1')
    expect(styles).toMatch(/\.sunnah-results--text\s*\{[^}]*display:\s*block;[^}]*width:\s*100%/s)
    expect(styles).toMatch(/\.sunnah-results--text\s*>\s*\.search-results-table\s*\{[^}]*width:\s*min\(86rem/s)
  })

  it('stacks the category filter on narrow phones', () => {
    expect(styles).toMatch(/@media \(max-width:\s*540px\)[^{]*\{[^}]*\.sunnah-results[\s\S]*?\.sunnah-search__meta\s*\{[^}]*flex-direction:\s*column/s)
    expect(styles).toMatch(/@media \(max-width:\s*540px\)[^{]*\{[^}]*\[data-app-theme='dark'\] \.sunnah-hero__mark--muhammad\s*\{[^}]*width:\s*48px;[^}]*opacity:\s*\.26/s)
  })

  it('uses one compact title and two decorative historical marks', () => {
    expect(screen).not.toContain("h('p', { class: 'page-eyebrow' }, 'السنة النبوية')")
    expect(screen).toContain("'موسوعة السنة النبوية'")
    expect(screen).toContain("decorativeImage('sunnah-hero__mark sunnah-hero__mark--muhammad','./sunnah/muhammad-seal.png')")
    expect(screen).toContain("class: 'sunnah-hero__mark sunnah-hero__mark--prophethood'")
    expect(screen).toContain("decorativeImage('sunnah-hero__prophethood-image','./sunnah/prophethood-seal.png')")
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
    expect(screen).toContain("uiTemplateText('sunnah-source-record-count',{p1:records.length})")
  })

  it('uses one search and shows only validated corpus enrichment after an explicit text search', () => {
    expect(screen).not.toContain('sunnahCorpusSearchPanel()')
    expect(screen).not.toContain('شاهدًا موثقًا متاحًا للبحث')
    expect(screen).toContain('searchSunnahCorpus(verifiedRecords, search.value.trim())')
    expect(screen).toContain('loadVerifiedSunnahCorpus()')
    expect(screen).toContain("h('strong', null, 'المصادر الأصلية: ')")
    expect(screen).toContain('verifiedPrimarySources(record)')
    expect(screen).toContain('if (validateSunnahGoldenRecord(record).length) return undefined')
    expect(screen).toContain('requestedTextSearch&&query ? searchSunnahCorpus')
    expect(screen).toContain('`#/reader/${source.publicId}?sequence=${source.sequence}`')
    expect(screen).toContain("h('strong', null, 'الحكم: ')")
    expect(screen).toContain("href:record.link,target:'_blank',rel:'noopener noreferrer'")
    expect(screen).not.toContain("h('strong', null, 'العزو إلى الكتب المسندة: ')")
    expect(screen).not.toContain('الدرجة في المصدر: ')
    expect(screen).not.toContain('التخريج في المصدر: ')
    expect(screen).not.toContain('صفحة مزوّد بيانات العينة')
  })

  it('renders cached cards in the first frame and has no preparation or coverage banner', () => {
    expect(screen).toContain('const cachedScope = readCachedSunnahScope()')
    expect(screen).toContain('results.replaceChildren(...sunnahWindow(cachedBooks)')
    expect(screen).toContain('writeCachedSunnahScope(indexedScope)')
    expect(screen).not.toContain('جارٍ تجهيز قسم السنة')
    expect(screen).not.toContain('sunnah-search__coverage')
    expect(screen).not.toContain('sunnah-roadmap-note')
    expect(screen).not.toContain('منهج التوثيق')
  })

  it('keeps the verified hadith judgment DOM fail-closed and links only verified originals to our reader', () => {
    expect(screen).toContain("const primarySources = verifiedPrimarySources(record)")
    expect(screen).toContain('if (validateSunnahGoldenRecord(record).length) return undefined')
    expect(screen).toContain("class: 'sunnah-corpus-result sunnah-verdict-summary'")
    expect(screen).toContain("'الحكم: '")
    expect(screen).toContain("primarySources.length ? h('p'")
    expect(screen).toContain('`#/reader/${source.publicId}?sequence=${source.sequence}`')
    expect(screen).toContain("`#/reader/${source.publicId}?sequence=${source.sequence}`, target: '_blank', rel: 'noopener noreferrer'")
  })
})
