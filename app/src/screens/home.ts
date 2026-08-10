import { arabicNum, h, toast } from '../ui'
import { sectionHeader, pageContent } from '../components'
import { icon } from '../icons'
import { listAuthorRecords, listBooks, type StoredBook } from '../engine/library_store'
import { getReadingActivity } from '../activity_store'
import { bookCover } from '../book_cover'
import { addReaderQuote, getReaderQuotes } from '../quote_store'
import { BOOK_CATEGORIES } from '../library_metadata'
import { authorLink, categoryHref, categoryLink, UNCATEGORIZED_CATEGORY } from '../taxonomy_links'
import { stateView } from '../state_view'
import { getReadingPlan, planProgress, readingPosition } from '../reading_plan'
import { recommendUnreadBooks } from '../reading_recommendations'
import { dismissRecommendation, dismissedRecommendationIds, restoreDismissedRecommendations } from '../recommendation_preferences'
import { getAnnotations } from '../annotation_store'
import { dueReviewCount } from '../spaced_review'
import { ensureShamelaCatalogImported } from '../shamela_catalog'
import { brandMark } from '../brand'

export function homeScreen(): HTMLElement {
  const recent = h('section', { class: 'home-recent', 'aria-labelledby': 'recent-heading' })
  recent.appendChild(stateView({ kind: 'loading', icon: 'book', title: 'جارٍ إحضار آخر قراءة', compact: true, titleId: 'recent-heading' }))
  void hydrateRecent(recent)

  const newForYou = h('section', { class: 'home-section', 'aria-labelledby': 'new-for-you-heading' })
  newForYou.append(sectionHeader('جديد يهمك', undefined, 'new-for-you-heading'), h('div', { class: 'home-new-grid' }, stateView({ kind: 'loading', icon: 'book', title: 'جارٍ إحضار الجديد', compact: true })))
  void hydrateNewForYou(newForYou)
  const gateways = h('section', { class: 'home-gateways', 'aria-label': 'تصفح المكتبة بحسب الموضوع أو المؤلف' }, stateView({ kind: 'loading', icon: 'compass', title: 'جارٍ إعداد أبواب المكتبة' }))
  void hydrateGateways(gateways)
  const popular = h('section', { class: 'home-section home-popular', 'aria-labelledby': 'popular-heading' }, sectionHeader('الكتب الأكثر استعمالًا', undefined, 'popular-heading'), stateView({ kind: 'loading', icon: 'book', title: 'جارٍ ترتيب أكثر الكتب استعمالًا', compact: true }))
  void hydratePopular(popular)
  const recommendations = h('section', { class: 'home-section', 'aria-labelledby': 'recommendations-heading' }, sectionHeader('مقترح لك من خزانتك', undefined, 'recommendations-heading'), stateView({ kind: 'loading', icon: 'book', title: 'جارٍ إعداد مقترحات محلية', compact: true }))
  void hydrateRecommendations(recommendations)

  const page = pageContent(
    hero(),
    recent,
    dailyDashboard(),
    newForYou,
    popular,
    recommendations,
    gateways,
  )
  page.classList.add('home-page')
  return page
}

async function hydrateRecommendations(section: HTMLElement): Promise<void> {
  try {
    const books = await listBooks()
    const activity = getReadingActivity()
    const dismissed = new Set(dismissedRecommendationIds())
    const items = recommendUnreadBooks(books, activity.openedBookIds, activity.openCounts, books.length).filter(item => !dismissed.has(item.book.id)).slice(0, 4)
    if (!items.length) {
      const restore = dismissed.size ? { actionLabel: 'استعادة المقترحات المخفية', onAction: () => { restoreDismissedRecommendations(); void hydrateRecommendations(section) } } : {}
      section.querySelector('.state-view, .home-recommendations')?.replaceWith(stateView({ kind: 'empty', icon: 'book', title: 'لا توجد مقترحات جديدة الآن', description: 'افتح بعض الكتب أو أضف كتبًا أخرى؛ المقترحات محلية ولا ترسل سجل قراءتك.', compact: true, ...restore })); return
    }
    const grid = h('div', { class: 'home-new-grid' }, ...items.map(item => {
      const card = homeNewCard(item.book)
      card.appendChild(h('small', { class: 'home-recommendation__reason' }, item.reason))
      const dismiss = h('button', { type: 'button', class: 'home-recommendation__dismiss', 'aria-label': `إخفاء اقتراح ${item.book.title}` }, 'لا تقترح هذا')
      dismiss.addEventListener('click', () => { dismissRecommendation(item.book.id); void hydrateRecommendations(section) })
      card.appendChild(dismiss)
      return card
    }))
    grid.classList.add('home-recommendations')
    section.querySelector('.state-view, .home-recommendations')?.replaceWith(grid)
  } catch { section.querySelector('.state-view')?.replaceWith(stateView({ kind: 'error', title: 'تعذّر إعداد المقترحات', description: 'سجل قراءتك محلي ولم يتغير.', compact: true })) }
}

async function hydrateGateways(root: HTMLElement): Promise<void> {
  root.replaceChildren(stateView({ kind: 'loading', icon: 'compass', title: 'جارٍ إعداد أبواب المكتبة' }))
  try {
    await ensureShamelaCatalogImported()
    const [books, authorRecords] = await Promise.all([listBooks(), listAuthorRecords()])
    const categoryCounts = countMap(books.filter(book => book.category?.trim()), book => book.category!.trim())
    const uncategorizedCount = books.filter(book => !book.category?.trim()).length
    const categories: Array<[string, number, string?]> = BOOK_CATEGORIES.map(name => [name, categoryCounts.get(name) ?? 0, name])
    if (uncategorizedCount) categories.push(['غير مصنف', uncategorizedCount, UNCATEGORIZED_CATEGORY])
    const authorCounts = countMap(books, book => book.authorId || book.author?.trim() || 'غير معروف')
    const authors: Array<[string, number, string?]> = authorRecords
      .map(author => [author.name, authorCounts.get(author.id) ?? authorCounts.get(author.name) ?? 0, author.id] as [string, number, string])
      .sort((a, b) => a[0].localeCompare(b[0], 'ar'))
    root.replaceChildren(
      gatewayPanel('التصنيفات الموضوعية', 'انتقل إلى الفن الذي تريد القراءة فيه', 'compass', categories, (value) => value === UNCATEGORIZED_CATEGORY ? categoryHref() : categoryHref(value), '#/library'),
      gatewayPanel('المؤلفون', 'تصفح دليل المؤلفين الأصلي، ثم افتح ما أضفته من كتبهم', 'person', authors, (id) => `#/author/${encodeURIComponent(id)}`, '#/authors', 50),
    )
  } catch { root.replaceChildren(stateView({ kind: 'error', title: 'تعذّر إعداد أبواب المكتبة', description: 'التصنيفات والمؤلفون محفوظون؛ أعد المحاولة.', actionLabel: 'إعادة المحاولة', onAction: () => void hydrateGateways(root) })) }
}

function countMap(books: StoredBook[], key: (book: StoredBook) => string): Map<string, number> {
  const values = new Map<string, number>()
  for (const book of books) values.set(key(book), (values.get(key(book)) ?? 0) + 1)
  return values
}

function gatewayPanel(title: string, description: string, iconName: 'compass' | 'person', items: Array<[string, number, string?]>, href: (name: string) => string, allHref: string, visibleLimit = Number.POSITIVE_INFINITY): HTMLElement {
  const rail = h('div', { class: 'home-gateway__rail', tabindex: 0, 'aria-label': title, 'aria-live': 'polite' })
  const renderItems = (query = ''): void => {
    const normalized = query.trim().toLocaleLowerCase('ar')
    const matching = items.filter(([name]) => !normalized || name.toLocaleLowerCase('ar').includes(normalized))
    const visible = matching.slice(0, visibleLimit)
    rail.replaceChildren(...visible.map(([name, count, value]) => h('a', { class: 'home-gateway__item', href: href(value ?? name) }, h('span', { class: 'home-gateway__item-icon' }, icon(iconName, 19)), h('span', null, h('strong', null, name), h('small', null, `${count} ${count === 1 ? 'كتاب' : 'كتب'}`)), icon('chevron-left', 16))))
    if (!visible.length) {
      const empty = stateView(items.length
        ? { kind: 'no-results', icon: 'search', title: 'لا يوجد اسم يطابق هذه التصفية', description: 'جرّب كلمة أقصر أو امسح حقل البحث.', compact: true }
        : { kind: 'empty', icon: iconName, title: 'لا توجد بيانات في هذا الباب بعد', description: 'أضف كتابًا مصنفًا لتظهر العناصر هنا.', actionLabel: 'فتح المكتبة', href: '#/library', compact: true })
      rail.appendChild(empty)
    }
  }
  renderItems()
  const filterBar = h('div', { class: 'home-gateway__filter' })
  const filterInput = h('input', { type: 'search', placeholder: `ابحث في ${title}…`, 'aria-label': `تصفية ${title}` }) as HTMLInputElement
  const filterStatus = h('small', { 'aria-live': 'polite' }, `${items.length} عنصرًا`)
  filterInput.addEventListener('input', () => {
    const count = items.filter(([name]) => name.toLocaleLowerCase('ar').includes(filterInput.value.trim().toLocaleLowerCase('ar'))).length
    filterStatus.textContent = `${count} مطابقًا`
    renderItems(filterInput.value)
  })
  filterBar.append(icon('search', 17), filterInput, filterStatus)
  return h('article', { class: 'home-gateway' }, h('header', { class: 'home-gateway__head' }, h('span', { class: 'home-gateway__mark' }, icon(iconName, 23)), h('div', null, h('h2', null, title), h('p', null, description)), h('div', { class: 'home-gateway__actions' }, h('a', { href: allHref }, 'عرض الكل'))), filterBar, rail)
}

function hero(): HTMLElement {
  const hero = h('section', { class: 'home-hero', 'aria-labelledby': 'home-title' })
  hero.appendChild(h('div', { class: 'home-hero__landscape', 'aria-hidden': 'true' }, h('span', null), h('span', null)))
  hero.appendChild(h('div', { class: 'home-hero__brand' }, brandMark('home-hero__logo brand-mark'), h('span', null, 'الخِزانة')))
  hero.appendChild(h('div', { class: 'home-hero__wisdom', 'aria-label': 'وقل رب زدني علمًا. طلب العلم فريضة على كل مسلم' },
    h('p', { class: 'home-hero__ayah' }, '﴿ وَقُل رَّبِّ زِدْنِي عِلْمًا ﴾'),
    h('p', { class: 'home-hero__hadith' }, '«طلب العلم فريضة على كل مسلم»'),
  ))
  hero.appendChild(h('h1', { id: 'home-title' }, 'مرحبًا بك في ', h('span', { class: 'home-hero__title-brand' }, 'الخِزانة')))
  hero.appendChild(h('p', { class: 'home-hero__sub' }, 'تابع قراءتك، راجع محفوظاتك، أنجز بحوثك، وعش وقتك مع خير جليس، وإن علمت فاعمل وانطلق داعيةً مجاهدًا تنشر الهدى في كل مكان.'))
  return hero
}

async function hydrateRecent(root: HTMLElement): Promise<void> {
  try {
    const books = (await listBooks()).sort((a, b) => b.addedAt - a.addedAt)
    const lastBookId = getReadingActivity().lastBookId
    const last = books.find((book) => book.id === lastBookId) ?? books[0]
    root.replaceChildren(last ? continueCard(last) : emptyRecent())
  } catch {
    root.replaceChildren(stateView({ kind: 'error', title: 'تعذّر إحضار آخر قراءة', description: 'يمكنك فتح كتاب من مكتبتك والمحاولة من جديد.', actionLabel: 'إعادة المحاولة', onAction: () => void hydrateRecent(root), compact: true, titleId: 'recent-heading' }))
  }
}

function continueCard(book: StoredBook): HTMLElement {
  const card = h('article', { class: 'continue-card' })
  const copy = h('div', { class: 'continue-card__copy' })
  const currentPage = readingPosition(book.id) + 1
  copy.appendChild(h('a', { class: 'btn btn--primary continue-card__resume', href: `#/reader/${book.id}` }, icon('book', 18), `أكمل قراءتك — فقد وصلتَ إلى ص ${currentPage}`))
  copy.appendChild(h('h2', { id: 'recent-heading' }, book.title))
  copy.appendChild(authorLink(book.author, 'continue-card__author'))
  const plan = getReadingPlan(book.id)
  if (plan) {
    const progress = planProgress(plan, currentPage - 1)
    copy.appendChild(h('p', { class: 'continue-card__plan' }, progress.remainingPages ? `هدف اليوم حتى صفحة ${arabicNum(progress.targetPageToday)} · أنجزت ${arabicNum(progress.percent)}٪ من الكتاب` : 'أتممت خطة هذا الكتاب بحمد الله'))
  }
  card.appendChild(h('a', { class: 'continue-card__mark', href: `#/reader/${book.id}`, 'aria-label': `متابعة قراءة ${book.title} من الصفحة ${currentPage}` }, icon('book', 30)))
  card.appendChild(copy)
  return card
}

function emptyRecent(): HTMLElement {
  return stateView({ kind: 'empty', icon: 'book', title: 'ابدأ رفّك الأول', titleId: 'recent-heading', description: 'ارفع كتاب Word وسيظهر هنا لتعود إليه مباشرة.', actionLabel: 'فتح المكتبة', href: '#/library', compact: true })
}

function dailyDashboard(): HTMLElement {
  const section = h('section', { class: 'daily-section', 'aria-labelledby': 'daily-heading' })
  section.appendChild(sectionHeader('لوحة اليوم', undefined, 'daily-heading'))
  const grid = h('div', { class: 'daily-grid' })
  const activity = getReadingActivity()
  const dailyPlan = activity.lastBookId ? getReadingPlan(activity.lastBookId) : undefined
  const dailyProgress = dailyPlan ? planProgress(dailyPlan, readingPosition(dailyPlan.bookId)) : undefined
  const annotations = getAnnotations()
  const review = reviewCard(dueReviewCount([...annotations.notes.map(item => item.id), ...annotations.highlights.map(item => item.id)]))
  const quote = h('article', { class: 'daily-card daily-card--quote' }, stateView({ kind: 'loading', icon: 'book', title: 'جارٍ اختيار اقتباس من كتبك', compact: true }))
  void hydrateDailyQuote(quote)
  grid.append(
    dailyCard(
      'clock',
      'ورد القراءة اليومي',
      dailyProgress
        ? dailyProgress.remainingPages
          ? `هدفك المختار اليوم: القراءة حتى صفحة ${arabicNum(dailyProgress.targetPageToday)}`
          : 'أتممت ورد هذا الكتاب بحمد الله'
        : 'اختر مقدارًا ثابتًا تقرؤه كل يوم ونتابع تقدمك',
      dailyProgress ? 'افتح ورد اليوم' : 'حدّد وردك اليومي',
      dailyProgress ? `#/reader/${activity.lastBookId}` : '#/reading-plans',
    ),
    review,
    quote,
  )
  section.appendChild(grid)
  return section
}

async function hydrateDailyQuote(root: HTMLElement): Promise<void> {
  const books = await listBooks()
  const custom = getReaderQuotes()
  const candidates = [
    ...custom.map(quote => ({ text: quote.text, bookId: quote.bookId })),
    ...books.flatMap(book => (book.readerModel?.paragraphs ?? []).map(paragraph => ({ text: paragraph.text.replace(/\s+/g, ' ').trim(), bookId: book.id })).filter(item => item.text.length >= 55 && item.text.length <= 240).slice(0, 18)),
  ]
  const dailyIndex = Math.floor(Date.now() / 86_400_000)
  const selected = candidates.length ? candidates[dailyIndex % candidates.length] : undefined
  const book = selected ? books.find(item => item.id === selected.bookId) : undefined
  const add = h('button', { class: 'daily-quote__add', type: 'button' }, icon('plus', 15), 'أضف اقتباسًا')
  add.addEventListener('click', () => showQuoteForm(root, books))
  root.removeAttribute('role')
  root.replaceChildren(h('div', { class: 'daily-quote__head' }, h('p', { class: 'home-kicker' }, 'اقتباس اليوم'), add), selected ? h('p', { class: 'daily-quote__text' }, `«${selected.text}»`) : h('p', { class: 'daily-quote__text' }, 'افتح كتابًا أو أضف اقتباسك، وسيظهر اقتباس من خزانتك هنا.'), ...(book ? [h('div', { class: 'daily-quote__source' }, h('a', { href: `#/reader/${book.id}` }, book.title), document.createTextNode(' — '), authorLink(book.author))] : []))
}

function showQuoteForm(root: HTMLElement, books: StoredBook[]): void {
  if (!books.length) { toast('أضف كتابًا إلى مكتبتك أولًا'); return }
  const textarea = h('textarea', { placeholder: 'اكتب الاقتباس كما هو في الكتاب…', 'aria-label': 'نص الاقتباس' }) as HTMLTextAreaElement
  const select = h('select', { 'aria-label': 'مصدر الاقتباس' }) as HTMLSelectElement
  for (const book of books) select.appendChild(h('option', { value: book.id }, `${book.title} — ${book.author}`))
  const form = h('form', { class: 'daily-quote__form' }, textarea, select, h('div', null, h('button', { class: 'btn btn--primary', type: 'submit' }, 'حفظ الاقتباس'), h('button', { class: 'btn btn--secondary', type: 'button', onclick: () => void hydrateDailyQuote(root) }, 'إلغاء')))
  form.addEventListener('submit', (event) => { event.preventDefault(); if (textarea.value.trim().length < 5) { toast('اكتب اقتباسًا صالحًا'); return }; addReaderQuote(textarea.value, select.value); toast('حُفظ الاقتباس'); void hydrateDailyQuote(root) })
  root.replaceChildren(form); textarea.focus()
}

async function hydratePopular(section: HTMLElement): Promise<void> {
  try {
  const books = await listBooks()
  const counts = getReadingActivity().openCounts
  const body = h('div', { class: 'home-popular__body' })
  const search = h('input', { type: 'search', placeholder: 'اسم كتاب أو مؤلف…', 'aria-label': 'تصفية جميع الكتب بالعنوان أو المؤلف' }) as HTMLInputElement
  const category = filterSelect('كل التصنيفات', [...BOOK_CATEGORIES])
  const grid = h('div', { class: 'home-popular__grid' })
  const summary = h('p', { class: 'home-popular__summary', 'aria-live': 'polite' })
  const render = (): void => {
    const query = search.value.trim().toLocaleLowerCase('ar')
    const matching = books.filter(book => {
      const searchable = `${book.title} ${book.author || ''}`.toLocaleLowerCase('ar')
      return (!query || searchable.includes(query)) && (!category.value || book.category === category.value)
    }).sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0) || b.addedAt - a.addedAt)
    const visible = matching.slice(0, 50)
    summary.textContent = matching.length > 50 ? `عرض أول 50 كتابًا من ${matching.length} نتيجة؛ ضيّق البحث للوصول السريع.` : `${matching.length} ${matching.length === 1 ? 'كتاب' : 'كتابًا'}`
    grid.replaceChildren(...visible.map(book => homePopularCard(book, counts[book.id] ?? 0)))
    if (!visible.length) grid.appendChild(stateView(books.length
      ? { kind: 'no-results', icon: 'book', title: 'لا يوجد كتاب يطابق هذه التصفية', description: 'غيّر الاسم أو التصنيف.', compact: true }
      : { kind: 'empty', icon: 'book', title: 'لا توجد كتب في المكتبة بعد', description: 'أضف كتاب Word لتبدأ.', actionLabel: 'فتح المكتبة', href: '#/library', compact: true }))
  }
  search.addEventListener('input', render)
  category.addEventListener('change', render)
  body.append(h('div', { class: 'home-popular__filters' }, h('div', null, icon('search', 17), search), category), summary, grid)
  section.querySelector('.state-view')?.replaceWith(body); render()
  } catch {
    section.querySelector('.state-view, .home-popular__body')?.replaceWith(stateView({ kind: 'error', title: 'تعذّر ترتيب الكتب الأكثر استعمالًا', description: 'كتبك محفوظة؛ أعد المحاولة.', actionLabel: 'إعادة المحاولة', onAction: () => void hydratePopular(section), compact: true }))
  }
}

function filterSelect(first: string, values: string[]): HTMLSelectElement {
  const select = h('select', null, h('option', { value: '' }, first)) as HTMLSelectElement
  for (const value of values.sort((a, b) => a.localeCompare(b, 'ar'))) select.appendChild(h('option', { value }, value))
  return select
}

function reviewCard(dueCount: number): HTMLElement {
  const done = dueCount === 0
  const card = h('article', { class: `daily-card${done ? ' daily-card--done' : ''}` })
  card.append(h('div', { class: 'daily-card__icon', 'aria-hidden': 'true' }, icon('check', 22)), h('div', null, h('p', { class: 'home-kicker' }, 'ورد المراجعة'), h('h3', null, done ? 'لا توجد اليوم ملاحظات أو تظليلات حان تذكّرها' : `حان وقت مراجعة ${arabicNum(dueCount)} من فوائدك المحفوظة`), h('a', { class: 'daily-card__action', href: '#/notes?kind=review' }, done ? 'تصفح فوائدك المحفوظة' : 'ابدأ مراجعة فوائدك')))
  return card
}

function dailyCard(iconName: 'clock' | 'check', title: string, text: string, action: string, href: string): HTMLElement {
  return h('article', { class: 'daily-card' },
    h('div', { class: 'daily-card__icon', 'aria-hidden': 'true' }, icon(iconName, 22)),
    h('div', null, h('p', { class: 'home-kicker' }, title), h('h3', null, text), h('a', { href }, action)),
  )
}

async function hydrateNewForYou(section: HTMLElement): Promise<void> {
  const grid = section.querySelector<HTMLElement>('.home-new-grid')
  if (!grid) return
  try {
    const books = (await listBooks()).sort((a, b) => b.addedAt - a.addedAt).slice(0, 4)
    grid.removeAttribute('role')
    if (!books.length) {
      grid.replaceChildren(stateView({ kind: 'empty', icon: 'book', title: 'لا توجد إضافات حديثة', description: 'سيظهر هنا أحدث ما تضيفه إلى مكتبتك.', actionLabel: 'فتح المكتبة', href: '#/library', compact: true }))
      return
    }
    grid.replaceChildren(...books.map(homeNewCard))
  } catch {
    grid.replaceChildren(stateView({ kind: 'error', title: 'تعذّر إحضار الجديد الآن', description: 'أعد المحاولة دون فقد كتبك.', actionLabel: 'إعادة المحاولة', onAction: () => void hydrateNewForYou(section), compact: true }))
  }
}

function homePopularCard(book: StoredBook, openCount: number): HTMLElement {
  const titleId = `popular-${book.id}-title`
  return h('article', { class: 'home-popular-card', 'aria-labelledby': titleId },
    h('a', { href: `#/reader/${book.id}`, 'aria-label': `قراءة ${book.title}` }, bookCover(book, 'home-popular-card__cover')),
    h('span', null,
      h('a', { href: `#/reader/${book.id}`, id: titleId, class: 'home-card__title' }, book.title),
      h('small', { class: 'home-card__taxonomy' }, authorLink(book.author), ...(book.category ? [document.createTextNode(' · '), categoryLink(book.category)] : [])),
      h('em', null, openCount ? `فُتح ${openCount} مرة` : 'افتحه الآن'),
    ),
  )
}

function homeNewCard(book: StoredBook): HTMLElement {
  const titleId = `new-${book.id}-title`
  return h('article', { class: 'home-new-card', 'aria-labelledby': titleId },
    h('a', { href: `#/reader/${book.id}`, 'aria-label': `قراءة ${book.title}` }, bookCover(book, 'home-new-card__cover')),
    h('span', { class: 'home-new-card__copy' },
      h('a', { href: `#/reader/${book.id}`, id: titleId, class: 'home-card__title' }, book.title),
      authorLink(book.author),
      h('span', null, 'ابدأ القراءة'),
    ),
  )
}
