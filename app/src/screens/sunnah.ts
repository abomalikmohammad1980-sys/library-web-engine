import { h } from '../ui'
import { listBooks, type StoredBook } from '../engine/library_store'
import { pageContent } from '../components'
import { stateView } from '../state_view'
import { bookAuthorLinks, categoryLink } from '../taxonomy_links'
import { HADEETHENC_AR_SOURCE, loadVerifiedSunnahCorpus, sourcePageHref } from '../sunnah_source_registry'
import { searchSunnahCorpus } from '../sunnah_corpus_search'

const SUNNAH_TERMS = [
  'كتب السنة', 'متون الحديث', 'شروح الحديث', 'تخريج', 'الأطراف', 'علل الحديث',
  'علوم الحديث', 'مصطلح الحديث', 'الجرح والتعديل', 'رواة الحديث', 'حديث', 'سنن',
]

const normalize = (value: string): string => value.normalize('NFKD')
  .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase()

export function isSunnahLibraryBook(book: Pick<StoredBook, 'title' | 'category' | 'description' | 'tags'>): boolean {
  const haystack = normalize([
    book.title, book.category, book.description,
    ...(book.tags?.map(tag => tag.name) ?? []),
  ].filter(Boolean).join(' '))
  return SUNNAH_TERMS.some(term => haystack.includes(normalize(term)))
}

export function sunnahBookMatches(book: StoredBook, query: string, category = ''): boolean {
  if (category && book.category !== category) return false
  if (!query) return true
  const searchable = [book.title, book.author, ...(book.authors?.map(author => author.name) ?? []),
    book.category, book.description, ...(book.tags?.map(tag => tag.name) ?? [])]
  return normalize(searchable.filter(Boolean).join(' ')).includes(query)
}

function sunnahBookResult(book: StoredBook): HTMLElement {
  const readingHref = `#/reader/${encodeURIComponent(book.id)}`
  return h('article', { class: 'sunnah-book-result', 'aria-labelledby': `sunnah-book-${book.id}` },
    h('a', { class: 'sunnah-book-result__title', id: `sunnah-book-${book.id}`, href: readingHref }, book.title),
    bookAuthorLinks(book, 'sunnah-book-result__author'),
    book.category
      ? categoryLink(book.category, 'sunnah-book-result__category')
      : h('span', { class: 'sunnah-book-result__category' }, 'من كتب السنة في مكتبتك'),
    h('a', { class: 'sunnah-book-result__read', href: readingHref }, 'افتح في القارئ'),
  )
}

function sunnahCorpusSearchPanel(): HTMLElement {
  const input = h('input', {
    class: 'sunnah-corpus-search__input', type: 'search',
    placeholder: 'ابحث في متون العينة الحديثية الموثقة…',
    'aria-label': 'البحث في متون الأحاديث الموثقة',
    disabled: true,
  }) as HTMLInputElement
  const count = h('strong', { class: 'sunnah-corpus-search__count', 'aria-live': 'polite' }, 'جارٍ التحقق من العينة…')
  const results = h('div', { class: 'sunnah-corpus-results', 'aria-live': 'polite' })

  void loadVerifiedSunnahCorpus().then(({ records }) => {
    input.disabled = false
    const render = (): void => {
      const query = input.value.trim()
      if (!query) {
        count.textContent = `${records.length.toLocaleString('ar')} شاهدًا موثقًا متاحًا للبحث`
        results.replaceChildren(stateView({
          kind: 'empty', title: 'اكتب كلمة من متن الحديث',
          description: 'البحث محصور في العينة الذهبية الحالية، ولا يدّعي تغطية كتب السنة كلها.',
        }))
        return
      }
      const matches = searchSunnahCorpus(records, query)
      count.textContent = `${matches.length.toLocaleString('ar')} شاهد مطابق من ${records.length.toLocaleString('ar')}`
      results.replaceChildren(...(matches.length ? matches.map(({ record }) => h('article', {
        class: 'sunnah-corpus-result', 'aria-labelledby': `sunnah-witness-${record.id}`,
      },
      h('h3', { id: `sunnah-witness-${record.id}` }, record.title),
      h('p', { class: 'sunnah-corpus-result__text' }, record.hadithText),
      record.grade ? h('p', { class: 'sunnah-corpus-result__meta' }, h('strong', null, 'الدرجة في المصدر: '), record.grade) : null,
      record.takhrij ? h('p', { class: 'sunnah-corpus-result__meta' }, h('strong', null, 'التخريج في المصدر: '), record.takhrij) : null,
      )) : [stateView({
        kind: 'empty', title: 'لا شاهد مطابق في العينة الحالية',
        description: `نطاق البحث الحالي ${records.length.toLocaleString('ar')} شاهدًا موثقًا فقط.`,
      })]))
    }
    input.addEventListener('input', render)
    render()
  }).catch(() => {
    input.disabled = true
    count.textContent = 'أُوقف البحث احترازيًا'
    results.replaceChildren(stateView({
      kind: 'error', title: 'لم تجتز العينة التحقق',
      description: 'لن تظهر نتائج حديثية من بيانات ناقصة العزو أو مخالفة البصمة.',
    }))
  })

  return h('section', { class: 'sunnah-corpus-search', 'aria-labelledby': 'sunnah-corpus-search-title' },
    h('header', { class: 'sunnah-corpus-search__head' },
      h('div', null,
        h('p', { class: 'page-eyebrow' }, 'بحث حديث موثق'),
        h('h2', { id: 'sunnah-corpus-search-title' }, 'البحث في متن الحديث'),
      ),
      h('a', { href: sourcePageHref(HADEETHENC_AR_SOURCE.id) }, 'صفحة مصدر العينة'),
    ),
    h('div', { class: 'sunnah-corpus-search__controls', role: 'search' }, input, count),
    results,
  )
}

export function sunnahScreen(): HTMLElement {
  const search = h('input', {
    class: 'sunnah-search__input', type: 'search',
    placeholder: 'ابحث في كتب السنة الموجودة في مكتبتك…',
    'aria-label': 'البحث في قسم السنة',
  }) as HTMLInputElement
  const count = h('strong', { class: 'sunnah-search__count', 'aria-live': 'polite' }, 'جارٍ جرد كتب السنة…')
  const category = h('select', { class: 'sunnah-search__category', 'aria-label': 'تصفية كتب السنة حسب الفن' },
    h('option', { value: '' }, 'كل فنون السنة'),
  ) as HTMLSelectElement
  const results = h('div', { class: 'sunnah-results', 'aria-live': 'polite' }, stateView({ kind: 'loading', title: 'جارٍ تجهيز قسم السنة' }))

  void listBooks().then(allBooks => {
    const sunnahBooks = allBooks.filter(isSunnahLibraryBook)
    const categories = [...new Set(sunnahBooks.map(book => book.category?.trim()).filter((value): value is string => Boolean(value)))]
      .sort((a, b) => a.localeCompare(b, 'ar'))
    category.replaceChildren(h('option', { value: '' }, 'كل فنون السنة'),
      ...categories.map(value => h('option', { value }, value)))
    const render = (): void => {
      const query = normalize(search.value)
      const visible = sunnahBooks.filter(book => sunnahBookMatches(book, query, category.value))
      count.textContent = `${visible.length.toLocaleString('ar')} من ${sunnahBooks.length.toLocaleString('ar')} كتابًا حديثيًّا`
      results.replaceChildren(...(visible.length
        ? visible.map(sunnahBookResult)
        : [stateView({ kind: 'empty', title: query ? 'لا نتيجة في كتب السنة المحلية' : 'لا توجد كتب سنة مصنفة بعد', description: query ? 'جرّب جزءًا أقصر من اسم الكتاب أو المؤلف.' : 'أضف كتب الحديث أو صحّح تصنيفها، فتظهر هنا تلقائيًا.' })]))
    }
    search.addEventListener('input', render)
    category.addEventListener('change', render)
    render()
  }).catch(() => results.replaceChildren(stateView({ kind: 'error', title: 'تعذّر فتح كتب السنة المحلية', description: 'لم تتغير بيانات مكتبتك. أعد فتح الصفحة للمحاولة.' })))

  return pageContent(
    h('section', { class: 'sunnah-hero', 'aria-labelledby': 'sunnah-title' },
      h('img', {
        class: 'sunnah-hero__mark sunnah-hero__mark--muhammad',
        src: '/sunnah/muhammad-seal.png', alt: '', 'aria-hidden': 'true',
      }),
      h('span', { class: 'sunnah-hero__mark sunnah-hero__mark--prophethood', 'aria-hidden': 'true' },
        h('img', { src: '/sunnah/prophethood-seal.png', alt: '' })),
      h('h1', { class: 'page-title', id: 'sunnah-title' }, 'موسوعة السنة النبوية'),
      h('p', { class: 'page-sub' }, 'ابحث في كتب الحديث المحفوظة في الخِزانة، وافتح النتيجة في قارئ الكتاب نفسه.'),
      h('div', { class: 'sunnah-search', role: 'search' }, search,
        h('div', { class: 'sunnah-search__meta' }, category, count)),
    ),
    sunnahCorpusSearchPanel(),
    h('section', { class: 'sunnah-library', 'aria-labelledby': 'sunnah-library-title' },
      h('header', { class: 'sunnah-library__head' },
        h('div', null, h('p', { class: 'page-eyebrow' }, 'المتاح الآن'), h('h2', { id: 'sunnah-library-title' }, 'كتب السنة في مكتبتي')),
        h('a', { class: 'btn btn--secondary', href: '#/library' }, 'إدارة الكتب'),
      ),
      results,
    ),
    h('aside', { class: 'sunnah-roadmap-note', role: 'note' },
      h('strong', null, 'المرحلة التالية'),
      h('p', null, 'توحيد المتون والشواهد والأسانيد والرواة وأحكام العلماء في نتيجة حديث واحدة. لن تُنسب أحكام أو شروح بلا مصدر موثق.'),
      h('a', { href: sourcePageHref(HADEETHENC_AR_SOURCE.id) }, 'مصدر العينة الحديثية الموثقة'),
    ),
  )
}

export function sunnahSourceScreen(sourceId: string): HTMLElement {
  const source = sourceId === HADEETHENC_AR_SOURCE.id ? HADEETHENC_AR_SOURCE : undefined
  const status = h('section', { class: 'sunnah-source__status', 'aria-live': 'polite' },
    stateView({ kind: 'loading', title: 'جارٍ التحقق من المصدر المحلي' }))
  if (!source) {
    status.replaceChildren(stateView({ kind: 'error', title: 'المصدر غير مسجل', description: 'لم تُعرض أي بيانات غير موثقة.' }))
  } else {
    void loadVerifiedSunnahCorpus(source).then(({ manifest, records }) => {
      status.replaceChildren(
        h('dl', { class: 'sunnah-source__facts' },
          h('div', null, h('dt', null, 'الناشر'), h('dd', null, manifest.publisher)),
          h('div', null, h('dt', null, 'الإصدار العربي'), h('dd', null, manifest.release.version)),
          h('div', null, h('dt', null, 'آخر تحديث للمصدر'), h('dd', null, manifest.release.sourceUpdatedAt.slice(0, 10))),
          h('div', null, h('dt', null, 'العينة المحلية'), h('dd', null, `${records.length.toLocaleString('ar')} شاهدًا ذهبيًا`)),
        ),
        h('p', { class: 'sunnah-source__attribution' }, manifest.attribution),
        h('div', { class: 'sunnah-source__actions' },
          h('a', { class: 'btn btn--secondary', href: manifest.homepage, target: '_blank', rel: 'noopener noreferrer' }, 'فتح المصدر الرسمي'),
          h('a', { class: 'btn btn--secondary', href: manifest.downloadUrl, target: '_blank', rel: 'noopener noreferrer' }, 'تنزيل الإصدار الرسمي'),
          h('a', { class: 'btn btn--secondary', href: manifest.checkForUpdatesUrl, target: '_blank', rel: 'noopener noreferrer' }, 'التحقق من تحديث الإصدار'),
          h('a', { class: 'btn btn--secondary', href: manifest.termsUrl, target: '_blank', rel: 'noopener noreferrer' }, 'شروط الانتفاع بالمصدر'),
        ),
      )
    }).catch(() => status.replaceChildren(stateView({
      kind: 'error', title: 'لم يجتز corpus التحقق',
      description: 'أُوقف العرض احترازيًا؛ لم تُعرض سجلات ناقصة العزو أو مخالفة البصمة.',
    })))
  }
  return pageContent(
    h('section', { class: 'sunnah-source', 'aria-labelledby': 'sunnah-source-title' },
      h('p', { class: 'page-eyebrow' }, source ? 'مصدر موثق' : 'تحقق المصدر'),
      h('h1', { class: 'page-title', id: 'sunnah-source-title' }, source?.name ?? 'مصدر سنة غير مسجل'),
      source ? h('p', { class: 'page-sub' }, source.attributionLabel) : null,
      status,
      h('a', { class: 'btn btn--secondary', href: '#/sunnah' }, 'العودة إلى موسوعة السنة'),
    ),
  )
}
