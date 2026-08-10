/** بحث موسع مستمر: إجمالي ثابت، مؤشرات صفحات Word، ونافذة DOM محدودة. */

import { h, toast, arabicNum } from '../ui'
import { icon } from '../icons'
import { pageContent } from '../components'
import { searchAllBooks, type SearchField, type SearchQueryOptions, type SearchResult } from '../engine/search_store'
import { listBooks, type StoredBook } from '../engine/library_store'
import { deriveSearchTerm, normalizeArabic, pageForParagraph, virtualRange, type SearchMode } from '../search_presentation'
import { stateView } from '../state_view'
import { captureRouteResourceScope, routeAnimationFrame, routeEventListener, routeObserver, routeTimeout } from '../resource_lifecycle'
import { authorLink, bookAuthorLinks } from '../taxonomy_links'
import { currentHashQuery, replaceHashQuery } from '../hash_query_state'
import { compareSearchResultsByDeath, groupSearchResultsByBook, numberOrderedSearchResults } from '../search_result_order'

type SearchSort = 'death' | 'relevance' | 'chronological' | 'tree'
interface SearchContext { books: Map<string, StoredBook>; globalNumbers: Map<SearchResult, number> }
interface SearchScope { element: HTMLElement; fieldsElement: HTMLElement; values: () => SearchQueryOptions; clear: () => void; hydrate: (books: StoredBook[]) => void }

export function searchScreen(): HTMLElement {
  const resourceScope = captureRouteResourceScope()
  const root = pageContent(
    h('section', { class: 'search-hero', 'aria-labelledby': 'search-title' },
      h('h1', { class: 'page-title', id: 'search-title' }, 'الباحث الشامل في المكتبة'),
    ),
  )
  const form = h('form', { class: 'search-form', role: 'search' })
  const field = h('div', { class: 'search-form__field' }, icon('search', 21))
  const input = h('input', { type: 'search', placeholder: 'اكتب كلمة أو عبارة…', 'aria-label': 'عبارة البحث الموسع' }) as HTMLInputElement
  const clear = h('button', { class: 'search-form__clear', type: 'button', 'aria-label': 'مسح البحث' }, icon('close', 17))
  clear.hidden = true
  field.append(input, clear)
  const submit = h('button', { class: 'btn btn--primary', type: 'submit' }, 'ابحث')
  const modes = searchModes()
  const scope = searchScope()
  form.append(h('div', { class: 'search-options-row' }, modes.element, scope.fieldsElement), h('div', { class: 'search-form__main' }, field, submit), scope.element)
  root.appendChild(form)

  const results = h('section', { class: 'search-results', 'aria-live': 'polite' })
  results.appendChild(searchWelcome())
  root.appendChild(results)
  let timer: number | undefined
  let request = 0

  const run = async (): Promise<void> => {
    const query = input.value.trim()
    clear.hidden = query.length === 0
    if (query.length < 2) {
      if (query.length) toast('اكتب حرفين على الأقل')
      results.replaceChildren(searchWelcome())
      return
    }
    const current = ++request
    const mode = modes.value()
    const effective = deriveSearchTerm(query, mode)
    replaceHashQuery({ q: query, mode })
    results.replaceChildren(stateView({ kind: 'loading', icon: 'search', title: 'جارٍ البحث في خزانتك', description: 'نفهرس صفحات الكتب ونرتب المطابقات الآن.' }))
    try {
      const options = scope.values()
      const [found, books] = await Promise.all([searchAllBooks(effective, options), listBooks()])
      if (current !== request || resourceScope.disposed) return
      renderSearchResults(results, found, query, effective, mode, books, resourceScope)
    } catch {
      if (current !== request) return
      results.replaceChildren(stateView({ kind: 'error', title: 'تعذّر البحث الآن', description: 'بقيت عبارتك كما هي؛ أعد المحاولة.', actionLabel: 'إعادة المحاولة', onAction: () => void run() }))
    }
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); void run() })
  modes.element.addEventListener('change', () => { if (input.value.trim().length >= 2) void run() })
  input.addEventListener('input', () => {
    clear.hidden = input.value.length === 0
    window.clearTimeout(timer)
    if (input.value.trim().length >= 2) timer = routeTimeout(run, 600, resourceScope)
  })
  clear.addEventListener('click', () => { input.value = ''; clear.hidden = true; scope.clear(); replaceHashQuery({ q: null, mode: null, book: null, author: null, category: null, books: null, authors: null, categories: null, century: null, from: null, to: null, fields: null, sort: null }); results.replaceChildren(searchWelcome()); input.focus() })

  const initialParams = currentHashQuery()
  const initial = initialParams.get('q')
  modes.set((initialParams.get('mode') as SearchMode) || 'exact')
  void listBooks().then(books => scope.hydrate(books))
  if (initial) { input.value = initial; clear.hidden = false; routeTimeout(run, 100, resourceScope) }
  else routeTimeout(() => input.focus(), 100, resourceScope)
  return root
}

function searchModes(): { element: HTMLElement; value: () => SearchMode; set: (mode: SearchMode) => void } {
  const group = h('fieldset', { class: 'search-modes' })
  group.appendChild(h('legend', null, 'نمط المطابقة'))
  const inputs = new Map<SearchMode, HTMLInputElement>()
  const options: Array<[SearchMode, string, string]> = [
    ['exact', 'مطابقة العبارة', 'مطابقة العبارة بعد توحيد الرسم العربي'],
    ['morphological', 'توسيع صرفي تجريبي', 'توسيع محلي تقريبي إلى أن يكتمل المحلل العربي الموثق'],
    ['root', 'جذر تقريبي', 'اقتراح جذري تجريبي؛ سيستبدل بمحلل عربي موثق'],
  ]
  for (const [value, label, title] of options) {
    const radio = h('input', { type: 'radio', value, title }) as HTMLInputElement
    radio.name = 'search-mode'; radio.checked = value === 'exact'
    inputs.set(value, radio)
    group.appendChild(h('label', { class: 'search-mode', title }, radio, h('span', null, label)))
  }
  return {
    element: group,
    value: () => ([...inputs.entries()].find(([, input]) => input.checked)?.[0] ?? 'exact'),
    set: (mode) => { (inputs.get(mode) ?? inputs.get('exact'))!.checked = true },
  }
}

function searchScope(): SearchScope {
  const params = currentHashQuery()
  const book = multiChoice('الكتب', 'صفِّ الكتب…')
  const author = multiChoice('المؤلفون', 'صفِّ المؤلفين…')
  const category = multiChoice('التصنيفات', 'صفِّ التصنيفات…')
  const century = h('select', { 'aria-label': 'القرن الهجري' }) as HTMLSelectElement
  const from = h('input', { type: 'number', min: '1', max: '2000', placeholder: 'من سنة هـ', 'aria-label': 'سنة وفاة المؤلف من' }) as HTMLInputElement
  const to = h('input', { type: 'number', min: '1', max: '2000', placeholder: 'إلى سنة هـ', 'aria-label': 'سنة وفاة المؤلف إلى' }) as HTMLInputElement
  const fieldOptions: Array<[SearchField, string]> = [['body', 'المتن'], ['heading', 'شجرة العناوين'], ['tag', 'الوسوم'], ['card', 'بطاقات الكتب']]
  const checks = new Map<SearchField, HTMLInputElement>()
  const requestedFields = new Set((params.get('fields') ?? '').split(',').filter(Boolean) as SearchField[])
  const fields = h('fieldset', { class: 'search-scope__fields' }, h('legend', null, 'ابحث داخل'))
  for (const [value, label] of fieldOptions) {
    const input = h('input', { type: 'checkbox', value }) as HTMLInputElement
    input.checked = requestedFields.size ? requestedFields.has(value) : true
    checks.set(value, input)
    fields.appendChild(h('label', null, input, h('span', null, label)))
  }
  fields.addEventListener('change', () => {
    // لا نترك نطاق البحث فارغًا. اختيار المتن وحده يشمل العناوين بطبيعته،
    // أما اختيار شجرة العناوين وحدها فيقصر البحث عليها دون المتن.
    if (![...checks.values()].some(input => input.checked)) checks.get('body')!.checked = true
  })
  fields.appendChild(h('small', { class: 'search-scope__fields-note' }, 'المتن يشمل العناوين؛ اختيار «شجرة العناوين» وحدها يقصر البحث عليها.'))
  const range = h('label', { class: 'search-scope__range' }, h('span', null, 'وفاة المؤلف بين'), h('span', null, from, to))
  const element = h('section', { class: 'search-scope', 'aria-label': 'تحديد نطاق البحث' },
    h('div', { class: 'search-scope__heading' }, h('div', null, h('h2', null, 'أين تريد أن تبحث؟'), h('p', null, 'اترك النطاق على «الكل» للبحث في الخزانة كاملة.')), h('span', { class: 'search-scope__local' }, icon('box', 15), 'يعمل محليًا')),
    h('div', { class: 'search-scope__grid' }, book.element, author.element, category.element, labeledSelect('القرن الهجري', century), range),
  )
  from.value = params.get('from') ?? ''; to.value = params.get('to') ?? ''
  century.appendChild(h('option', { value: '' }, 'كل القرون والحالات'))
  century.appendChild(h('option', { value: 'pre-hijra' }, 'قبل الهجرة'))
  for (let value = 1; value <= 15; value++) century.appendChild(h('option', { value: String(value) }, `القرن ${value} هـ`))
  century.appendChild(h('option', { value: 'contemporary' }, 'معاصر'))
  const selectedCentury = params.get('century') ?? ''
  if ([...century.options].some(option => option.value === selectedCentury)) century.value = selectedCentury
  century.addEventListener('change', () => {
    const value = Number(century.value)
    if (value) { from.value = String((value - 1) * 100 + 1); to.value = String(value * 100) }
    else { from.value = ''; to.value = '' }
  })
  const sync = (): void => replaceHashQuery({ books: encodeSelection(book.values()), authors: encodeSelection(author.values()), categories: encodeSelection(category.values()), book: null, author: null, category: null, century: century.value || null, from: from.value || null, to: to.value || null, fields: [...checks].filter(([, input]) => input.checked).map(([key]) => key).join(',') || null })
  element.addEventListener('change', sync); fields.addEventListener('change', sync); element.addEventListener('input', event => { if ((event.target as HTMLElement).matches('input[type="number"]')) sync() })
  return {
    element,
    fieldsElement: fields,
    values: () => ({ ...(book.values().length ? { bookIds: book.values() } : {}), ...(author.values().length ? { authors: author.values() } : {}), ...(category.values().length ? { categories: category.values() } : {}), ...(century.value === 'pre-hijra' || century.value === 'contemporary' ? { deathState: century.value } : {}), ...(Number(from.value) ? { deathFrom: Number(from.value) } : {}), ...(Number(to.value) ? { deathTo: Number(to.value) } : {}), fields: [...checks].filter(([, input]) => input.checked).map(([key]) => key) }),
    clear: () => { book.clear(); author.clear(); category.clear(); century.value = ''; from.value = ''; to.value = ''; checks.forEach(input => { input.checked = true }) },
    hydrate: books => {
      const authors = [...new Set(books.flatMap(item => item.authors?.length ? item.authors.map(value => value.name) : [item.author]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'))
      const categories = [...new Set(books.map(item => item.category).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'ar'))
      book.setOptions(books.map<[string, string]>(item => [item.id, item.title]).sort((a, b) => a[1].localeCompare(b[1], 'ar')), decodeSelection(params.get('books'), params.get('book')))
      author.setOptions(authors.map(value => [value, value]), decodeSelection(params.get('authors'), params.get('author')))
      category.setOptions(categories.map(value => [value, value]), decodeSelection(params.get('categories'), params.get('category')))
    },
  }
}

interface MultiChoice { element: HTMLElement; values: () => string[]; clear: () => void; setOptions: (options: Array<[string, string]>, selected: string[]) => void }

function multiChoice(label: string, placeholder: string): MultiChoice {
  const details = h('details', { class: 'search-multi' }) as HTMLDetailsElement
  const summaryText = h('span', null, `كل ${label}`)
  const summary = h('summary', { 'aria-label': label }, summaryText, icon('chevron-left', 15))
  const filter = h('input', { type: 'search', placeholder, 'aria-label': `تصفية ${label}` }) as HTMLInputElement
  const list = h('div', { class: 'search-multi__list', role: 'group', 'aria-label': `اختيار ${label}` })
  const selected = new Set<string>()
  let options: Array<[string, string]> = []
  const updateSummary = (): void => { summaryText.textContent = selected.size ? `${label}: ${selected.size}` : `كل ${label}` }
  const render = (): void => {
    const query = normalizeArabic(filter.value)
    const visible = options.filter(([, text]) => !query || normalizeArabic(text).includes(query))
    list.replaceChildren(...visible.map(([value, text]) => {
      const input = h('input', { type: 'checkbox', value }) as HTMLInputElement
      input.checked = selected.has(value)
      input.addEventListener('change', () => { input.checked ? selected.add(value) : selected.delete(value); updateSummary(); details.dispatchEvent(new Event('change', { bubbles: true })) })
      return h('label', { class: 'search-multi__option' }, input, h('span', null, text))
    }), ...(visible.length ? [] : [h('p', { class: 'search-multi__empty' }, 'لا توجد مطابقة')]))
  }
  filter.addEventListener('input', render)
  details.addEventListener('toggle', () => { if (details.open) { filter.value = ''; render(); routeTimeout(() => filter.focus(), 0) } })
  details.append(summary, h('div', { class: 'search-multi__panel' }, filter, list))
  return {
    element: h('label', { class: 'search-scope__control' }, h('span', null, label), details),
    values: () => [...selected],
    clear: () => { selected.clear(); updateSummary(); render() },
    setOptions: (values, active) => { options = values; selected.clear(); active.filter(value => options.some(([candidate]) => candidate === value)).forEach(value => selected.add(value)); updateSummary(); render() },
  }
}

function encodeSelection(values: string[]): string | null { return values.length ? JSON.stringify(values) : null }
function decodeSelection(value: string | null, legacy: string | null): string[] {
  if (!value) return legacy ? [legacy] : []
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [] } catch { return [] }
}

function labeledSelect(label: string, select: HTMLSelectElement): HTMLElement {
  return h('label', { class: 'search-scope__control' }, h('span', null, label), select)
}

function searchWelcome(): HTMLElement {
  return h('div', { class: 'search-welcome' }, icon('search', 28), h('h2', null, 'الوصول إلى النص، لا مجرد اسم الكتاب'), h('p', null, 'اكتب عبارتك وحدد النطاق والحقول. تظهر النتائج متتابعة مع المؤلف والتصنيف والصفحة، وتفتح كل مطابقة في موضعها.'))
}

function renderSearchResults(root: HTMLElement, all: SearchResult[], query: string, effective: string, mode: SearchMode, storedBooks: StoredBook[], resourceScope = captureRouteResourceScope()): void {
  if (!all.length) {
    root.replaceChildren(stateView({ kind: 'no-results', icon: 'search', title: `لا توجد نتائج لـ «${query}»`, description: mode === 'exact' ? 'جرّب الاشتقاق الصرفي أو عبارة أقصر.' : `لم ينتج النمط المختار مواضع لعبارة «${effective}».` }))
    return
  }
  const books = new Map(storedBooks.map((book) => [book.id, book]))
  const context: SearchContext = { books, globalNumbers: new Map() }
  const counts = new Map<string, { title: string; count: number }>()
  for (const result of all) {
    const entry = counts.get(result.bookId)
    counts.set(result.bookId, { title: result.title, count: (entry?.count ?? 0) + 1 })
  }
  const initialParams = currentHashQuery()
  let sort: SearchSort = (initialParams.get('sort') as SearchSort) || 'death'
  let loaded = Math.min(40, all.length)
  let activeResults = all

  const head = h('div', { class: 'search-results__head' },
    h('div', null, h('h2', null, `نتائج «${query}»`), h('p', null, `${arabicNum(all.length)} نتيجة إجمالًا في ${arabicNum(counts.size)} كتاب · العدد ثابت أثناء التصفح`)),
    h('span', { class: 'search-results__mode' }, mode === 'exact' ? 'مطابقة العبارة' : mode === 'morphological' ? `اشتقاق: ${effective}` : `جذر تقريبي: ${effective}`),
  )
  const controls = h('div', { class: 'search-result-order' }, h('p', null, 'ترتيب النتائج'))
  const sortSelect = selectControl('الترتيب', [['death', 'وفيات المؤلفين: الأقدم أولًا'], ['relevance', 'الأقرب صلة'], ['chronological', 'الأحدث إضافة'], ['tree', 'شجري: المؤلف ثم الكتاب']])
  sortSelect.select.value = sort
  controls.append(sortSelect.wrap)

  const viewport = h('div', { class: 'search-virtual', role: 'feed', 'aria-label': 'نتائج البحث المتتابعة' })
  const topSpacer = h('div', { class: 'search-virtual__spacer', 'aria-hidden': 'true' })
  const list = h('div', { class: 'search-result-list' })
  const bottomSpacer = h('div', { class: 'search-virtual__spacer', 'aria-hidden': 'true' })
  const sentinel = h('div', { class: 'search-sentinel', role: 'status' }, 'مرّر لعرض مزيد من النتائج')
  viewport.append(topSpacer, list, bottomSpacer, sentinel)
  root.replaceChildren(head, controls, viewport)

  const filtered = (): SearchResult[] => {
    const values = [...all]
    if (sort === 'death') return values.sort(compareSearchResultsByDeath)
    if (sort === 'chronological') return groupSearchResultsByBook(values, (a, b) => (books.get(b.bookId)?.addedAt ?? 0) - (books.get(a.bookId)?.addedAt ?? 0))
    if (sort === 'tree') return groupSearchResultsByBook(values, (a, b) => `${a.author}\0${a.title}`.localeCompare(`${b.author}\0${b.title}`, 'ar'))
    const firstRelevantBook = new Map<string, number>()
    values.forEach((result, index) => { if (!firstRelevantBook.has(result.bookId)) firstRelevantBook.set(result.bookId, index) })
    return groupSearchResultsByBook(values, (a, b) => (firstRelevantBook.get(a.bookId) ?? 0) - (firstRelevantBook.get(b.bookId) ?? 0))
  }
  const renderWindow = (): void => {
    if (!root.isConnected) return
    const listTop = viewport.getBoundingClientRect().top + window.scrollY
    const range = virtualRange(window.scrollY - listTop, loaded)
    topSpacer.style.height = `${range.start * 174}px`
    bottomSpacer.style.height = `${Math.max(0, loaded - range.end) * 174}px`
    list.replaceChildren(...activeResults.slice(range.start, range.end).map((result) => resultCard(result, effective, context)))
    sentinel.textContent = loaded < activeResults.length ? `عُرض ${arabicNum(loaded)} من ${arabicNum(activeResults.length)} — تابع النزول` : `اكتملت ${arabicNum(activeResults.length)} نتيجة`
    sentinel.dataset.complete = String(loaded >= activeResults.length)
  }
  const reset = (): void => {
    activeResults = filtered(); loaded = Math.min(40, activeResults.length)
    context.globalNumbers = numberOrderedSearchResults(activeResults)
    renderWindow()
  }
  sortSelect.select.addEventListener('change', () => { sort = sortSelect.select.value as SearchSort; replaceHashQuery({ sort: sort === 'death' ? null : sort }); reset() })

  let frame = 0
  const onScroll = (): void => {
    if (!root.isConnected) { window.removeEventListener('scroll', onScroll); return }
    if (frame) return
    frame = routeAnimationFrame(() => { frame = 0; renderWindow() }, resourceScope)
  }
  routeEventListener(window, 'scroll', onScroll, { passive: true }, resourceScope)
  const observer = routeObserver(new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting) || loaded >= activeResults.length) return
    loaded = Math.min(activeResults.length, loaded + 40)
    renderWindow()
  }, { rootMargin: '1000px 0px' }), resourceScope)
  observer.observe(sentinel)
  resourceScope.add(() => {
    window.removeEventListener('scroll', onScroll)
    if (frame) cancelAnimationFrame(frame)
    observer.disconnect()
  })
  reset()
}

function selectControl(label: string, options: string[][]): { wrap: HTMLElement; select: HTMLSelectElement } {
  const select = h('select', { 'aria-label': label }) as HTMLSelectElement
  for (const option of options) select.appendChild(h('option', { value: option[0] ?? '' }, option[1] ?? ''))
  return { select, wrap: h('label', { class: 'search-select' }, h('span', null, label), select) }
}

function resultCard(result: SearchResult, query: string, context: SearchContext): HTMLElement {
  const book = context.books.get(result.bookId)
  const page = pageForParagraph(book?.wordPageMap, result.paraIndex)
  const globalNumber = context.globalNumbers.get(result) ?? 0
  const href = `#/reader/${result.bookId}${result.paraIndex >= 0 ? `?para=${result.paraIndex}` : ''}`
  const card = h('article', { class: 'search-result-card', 'aria-label': `النتيجة ${globalNumber}` })
  const number = h('span', { class: 'search-result-card__number', title: 'الترقيم العام للنتيجة' }, arabicNum(globalNumber))
  const link = h('a', { class: 'search-result-card__book', href, target: '_blank', rel: 'noopener', title: 'فتح موضع المطابقة في تبويب مستقل' }, icon('book', 18), h('span', null, result.title), icon('chevron-left', 16))
  const snippet = h('p', { class: 'search-result-card__snippet' })
  appendHighlighted(snippet, result.snippet, query)
  const meta = [
    result.field === 'heading' ? 'من شجرة العناوين' : result.field === 'tag' ? 'من الوسوم' : result.field === 'card' ? 'من بطاقة الكتاب' : 'من متن الكتاب',
    result.contemporary ? 'مؤلف معاصر' : result.deathYearHijri ? `توفي سنة ${arabicNum(result.deathYearHijri)} هـ` : 'سنة الوفاة غير مدونة',
    ...(result.category ? [result.category] : []),
    ...(result.tags.length ? [result.tags.slice(0, 3).map(tag => `#${tag}`).join(' ')] : []),
    page ? `الصفحة ${arabicNum(page)}` : result.paraIndex >= 0 ? `الفقرة ${arabicNum(result.paraIndex + 1)}` : 'بيانات الكتاب',
  ]
  const storedBook = context.books.get(result.bookId)
  card.append(number, link, snippet, h('div', { class: 'search-result-card__meta' }, storedBook ? bookAuthorLinks(storedBook) : authorLink(result.author), ...meta.map((value) => h('span', null, value))))
  return card
}

function appendHighlighted(target: HTMLElement, text: string, query: string): void {
  const folded = foldWithMap(text)
  const wanted = foldWithMap(query).value
  const index = folded.value.indexOf(wanted)
  if (index < 0 || !wanted) { target.textContent = text; return }
  const start = folded.map[index] ?? 0
  const end = (folded.map[index + wanted.length - 1] ?? start) + 1
  target.append(document.createTextNode(text.slice(0, start)), h('mark', null, text.slice(start, end)), document.createTextNode(text.slice(end)))
}

export function foldWithMap(text: string): { value: string; map: number[] } {
  let value = ''
  const map: number[] = []
  let previousSpace = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index] ?? ''
    const folded = /\s/u.test(char) ? ' ' : normalizeArabic(char)
    for (const output of folded) { if (output === ' ') { if (previousSpace || !value) continue; previousSpace = true } else previousSpace = false; value += output; map.push(index) }
  }
  if (value.endsWith(' ')) { value = value.slice(0, -1); map.pop() }
  return { value, map }
}
