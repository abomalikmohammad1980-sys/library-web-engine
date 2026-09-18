import {uiTemplateText,uiTemplateAttribute,uiLabelParameter} from '../ui_template_binding'
import { arabicNum, h, toast } from '../ui'
import { sectionHeader, pageContent } from '../components'
import { bindBookDisplayTitle } from '../book_locale_display'
import { icon } from '../icons'
import { listBooks, type StoredBook } from '../engine/library_store'
import { getReadingActivity } from '../activity_store'
import { bookCover, previewCover } from '../book_cover'
import { getReaderQuotes } from '../quote_store'
import {quotePublishForm} from '../quote_publish_form'
import {loadPublicQuotes,publicQuoteHref} from '../public_quotes'
import { captureReadingIdentity } from '../reading_identity_scope'
import { BOOK_CATEGORIES } from '../library_metadata'
import { authorLink, categoryHref, categoryLink, effectiveBookCategory, UNCATEGORIZED_CATEGORY } from '../taxonomy_links'
import { stateView } from '../state_view'
import { getReadingPlan, planProgress, readingPosition } from '../reading_plan'
import { recommendUnreadBooks } from '../reading_recommendations'
import { dismissRecommendation, dismissedRecommendationIds, restoreDismissedRecommendations } from '../recommendation_preferences'
import { getAnnotations } from '../annotation_store'
import { dueReviewCount } from '../spaced_review'
import { brandMark } from '../brand'
import { bookOrdinal, compareBooksByMetric } from '../book_ordering'
import {createPublishedBooksCatalogClient,type PublishedCatalogBook} from '../published_books_catalog_client'
import {captureRouteResourceScope} from '../resource_lifecycle'
import {currentAccountClaims} from '../account_authority'
import {activeEditorialIds,loadEditorialRecommendations} from '../editorial_recommendations'
import { homeQuoteCandidates } from '../home_quote_candidates'
import { whenNearViewport } from '../near_viewport'

type PublicHomeCard=Pick<StoredBook,'id'|'title'|'author'|'authorId'|'category'>&{publicSource:true;addedAt:number}
export type HomeCardDisplay=StoredBook|PublicHomeCard
export function publicHomeCards(rows:readonly PublishedCatalogBook[],knownIds:ReadonlySet<string>=new Set()):PublicHomeCard[]{
  const seen=new Set(knownIds),cards:PublicHomeCard[]=[]
  for(const row of rows){const id=`central-submission:${row.id}`;if(seen.has(id))continue;seen.add(id);cards.push({id,title:row.title,author:row.author,addedAt:Date.parse(row.createdAt.replace(' ','T').replace(/Z?$/,'Z')),...(row.centralAuthorId?{authorId:row.centralAuthorId}:{}),...(row.category?{category:row.category}:{}),publicSource:true})}
  return cards
}

const HOME_BOOK_SNAPSHOT_KEY = 'alkhizana.home-books.v1'
type HomeBookSnapshot = Pick<StoredBook, 'id' | 'title' | 'author' | 'authorId' | 'deathYearHijri' | 'contemporary' | 'category' | 'categoryOverride' | 'addedAt' | 'coverHue' | 'coverTemplate'>

let homeBooksRead: Promise<StoredBook[]> | undefined
let homeBooksIdentity = captureReadingIdentity()
function loadHomeBooks(): Promise<StoredBook[]> {
  if (!homeBooksIdentity.isCurrent()) { homeBooksRead = undefined; homeBooksIdentity = captureReadingIdentity() }
  if (!homeBooksRead) homeBooksRead = listBooks().catch(error => { homeBooksRead = undefined; throw error })
  return homeBooksRead
}
if (typeof window !== 'undefined') window.addEventListener('library-changed', () => { homeBooksRead = undefined })

export function homeScreen(): HTMLElement {
  const snapshot = readHomeBookSnapshot()
  const recent = h('section', { class: 'home-recent', 'aria-labelledby': 'recent-heading' }, initialRecent(snapshot))
  void hydrateRecent(recent)

  const newForYou = h('section', { class: 'home-section', 'aria-labelledby': 'new-for-you-heading' })
  newForYou.append(linkedHomeHeader('جديد المكتبة','new-for-you-heading','#/new-books'), initialNewForYou(snapshot))
  void hydrateNewForYou(newForYou)
  const gateways = libraryGatewaysSection(snapshot)
  const popular = popularBooksSection(snapshot)
  const recommendations = h('section', { class: 'home-section', 'aria-labelledby': 'recommendations-heading' }, linkedHomeHeader('مقترح لك من خزانتك','recommendations-heading','#/recommendations'), initialRecommendations(snapshot))
  whenNearViewport(recommendations, () => { void hydrateRecommendations(recommendations) })

  const page = pageContent(
    hero(),
    homeLibraryFilterSection(),
    gateways,
    recent,
    popular,
    dailyDashboard(),
    newForYou,
    recommendations,
  )
  page.classList.add('home-page')
  return page
}

function initialRecent(snapshot: HomeBookSnapshot[]): HTMLElement {
  const activity = getReadingActivity()
  const book = snapshot.find(item => item.id === activity.lastBookId) ?? snapshot[0]
  return book ? continueCard(snapshotBook(book)) : emptyRecent()
}

function readHomeBookSnapshot(): HomeBookSnapshot[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(HOME_BOOK_SNAPSHOT_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((book): book is HomeBookSnapshot => Boolean(book && typeof book.id === 'string' && typeof book.title === 'string' && typeof book.author === 'string' && Number.isFinite(book.addedAt)))
      .sort(compareBooksByMetric(book=>book.addedAt)).slice(0,24)
  } catch { return [] }
}

function writeHomeBookSnapshot(books: StoredBook[]): void {
  try {
    localStorage.setItem(HOME_BOOK_SNAPSHOT_KEY, JSON.stringify(books.slice().sort(compareBooksByMetric(book => book.addedAt)).slice(0, 24).map(({ id, title, author, authorId, deathYearHijri, contemporary, category, categoryOverride, addedAt, coverHue, coverTemplate }) => ({ id, title, author, authorId, deathYearHijri, contemporary, category, categoryOverride, addedAt, coverHue, coverTemplate }))))
  } catch { /* IndexedDB remains authoritative; a denied local snapshot is harmless. */ }
}

function snapshotBook(book: HomeBookSnapshot): StoredBook {
  return { ...book, fileName: '', fileSize: 0, data: new Uint8Array(), mimeType: '', originalSha256: '', pdfStatus: 'pending' } as StoredBook
}

function usefulHomeCard(title: string, description: string, href: string): HTMLElement {
  return h('a', { class: 'home-new-card home-new-card--utility', href }, h('span', { class: 'home-new-card__copy' }, h('strong', { class: 'home-card__title' }, title), h('small', null, description)))
}

function initialNewForYou(snapshot: HomeBookSnapshot[]): HTMLElement {
  const grid = h('div', { class: 'home-new-grid' })
  grid.append(...(snapshot.length
    ? snapshot.slice(0, 4).map((book, index) => homeNewCard(snapshotBook(book), index))
    : [usefulHomeCard('تصفح الكتب الجديدة', 'شاهد أحدث ما أضيف إلى الخزانة.', '#/new-books'), usefulHomeCard('افتح مكتبتك', 'تابع القراءة من كتبك المحفوظة.', '#/library')]))
  return grid
}

function initialRecommendations(snapshot: HomeBookSnapshot[]): HTMLElement {
  const grid = h('div', { class: 'home-new-grid home-recommendations' })
  const activity = getReadingActivity()
  const candidates = snapshot.filter(book => !activity.openedBookIds.includes(book.id)).slice(0, 4)
  grid.append(...(candidates.length
    ? candidates.map((book, index) => homeNewCard(snapshotBook(book), index))
    : [usefulHomeCard('استكشف كتابًا من خزانتك', 'اختر كتابًا لم تبدأ قراءته بعد.', '#/library'), usefulHomeCard('راجع فوائدك', 'عُد إلى ملاحظاتك وتظليلاتك المحفوظة.', '#/notes')]))
  return grid
}

function homeLibraryFilterSection(): HTMLElement {
  const query = h('input', { type: 'search', placeholder: 'ابحث عن مسألة في عناوين الكتب وفهارسها…', 'aria-label': 'ابحث في عناوين الأبواب والفصول والفهارس والوسوم والبطاقات' }) as HTMLInputElement
  const form = h('form', { class: 'home-library-filter', 'aria-label': 'البحث المتخصص في مظان المسائل' },
    h('div', { class: 'home-library-filter__copy' }, h('strong', null, 'ابحث في مظان المسائل'), h('p', null, 'يفتش عناوين الأبواب والفصول وشجرة الفهرس وبطاقة الكتاب والوسوم، دون متن الكتاب الكامل.')),
    h('div', { class: 'home-library-filter__controls' }, h('div', { class: 'home-library-filter__search' }, icon('search', 21), query), h('button', { class: 'btn btn--primary', type: 'submit' }, 'بحث متخصص')),
  )
  form.addEventListener('submit', event => {
    event.preventDefault()
    const value = query.value.trim()
    if (!value) { query.focus(); return }
    routeLocation.hash = `#/search?${new URLSearchParams({ q: value, fields: 'heading,tag,category,card', mode: 'exact' }).toString()}`
  })
  return h('section', { class: 'home-library-filter-section', 'aria-label': 'الوصول إلى مظان المسائل في المكتبة' }, form)
}

export function libraryGatewaysSection(snapshot: HomeBookSnapshot[] = readHomeBookSnapshot()): HTMLElement {
  const categoryCounts = new Map<string, number>(), authorCounts = new Map<string, { count: number; id?: string }>()
  for (const book of snapshot) {
    const category = effectiveBookCategory(snapshotBook(book))
    if (category !== UNCATEGORIZED_CATEGORY) categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
    const author = authorCounts.get(book.author) ?? { count: 0, ...(book.authorId ? { id: book.authorId } : {}) }
    author.count += 1; authorCounts.set(book.author, author)
  }
  const categories: Array<[string, number, string?]> = [...categoryCounts].map(([name, count]) => [name, count, name])
  const authors: Array<[string, number, string?]> = [...authorCounts].map(([name, value]) => [name, value.count, value.id ?? name])
  const gateways = h('section', { class: 'home-gateways', 'aria-label': 'تصفح المكتبة بحسب الموضوع أو المؤلف' },
    gatewayPanel('التصنيفات الموضوعية', 'انتقل إلى الفن الذي تريد القراءة فيه', 'compass', categories, value => categoryHref(value), '#/library'),
    gatewayPanel('المؤلفون', 'تصفح المؤلفين الذين توجد كتبهم في خزانتك', 'person', authors, id => `#/author/${encodeURIComponent(id)}`, '#/authors?owners=books', 100),
  )
  void hydrateGateways(gateways)
  return gateways
}

export function popularBooksSection(snapshot: HomeBookSnapshot[] = readHomeBookSnapshot()): HTMLElement {
  const counts = getReadingActivity().openCounts
  const body = h('div', { class: 'home-popular__body' })
  const books = snapshot.map(snapshotBook).filter(book => (counts[book.id] ?? 0) > 0).sort(compareBooksByMetric(book => counts[book.id] ?? 0)).slice(0, 50)
  body.append(h('p', { class: 'home-popular__summary', 'aria-live': 'polite' }, books.length ? uiTemplateText('d2589a932736c84a',{p1:books.length}) : 'افتح كتابًا ليظهر ترتيبه هنا.'), h('div', { class: 'home-popular__grid' }, ...(books.length ? books.map((book, index) => homePopularCard(book, counts[book.id] ?? 0, index)) : [usefulHomeCard('افتح مكتبتك', 'اختر كتابًا وابدأ القراءة الآن.', '#/library')])))
  const popular = h('section', { class: 'home-section home-popular', 'aria-labelledby': 'popular-heading' }, sectionHeader('الكتب الأكثر استعمالًا', undefined, 'popular-heading'), body)
  void hydratePopular(popular)
  return popular
}

async function hydrateRecommendations(section: HTMLElement): Promise<void> {
  const identity=captureReadingIdentity()
  try {
    const books = await (await import('../discovery_books')).listDiscoveryBooks()
    if(!identity.isCurrent())return
    const activity = getReadingActivity()
    const dismissed = new Set(dismissedRecommendationIds())
    const editorial=await loadEditorialRecommendations().catch(()=>({revision:0,entries:[]}))
    if(!identity.isCurrent())return
    const featured=activeEditorialIds(editorial.entries).filter(id=>!dismissed.has(id)).flatMap(id=>{const book=books.find(b=>b.id===id);return book?[{book,reason:'من ترشيحات الإدارة',score:0}]:[]}).slice(0,1)
    const items = [...featured,...recommendUnreadBooks(books, activity.openedBookIds, activity.openCounts, books.length).filter(item => !dismissed.has(item.book.id)&&!featured.some(f=>f.book.id===item.book.id))].slice(0, 4)
    if (!items.length) {
      const restore = dismissed.size ? { actionLabel: 'استعادة المقترحات المخفية', onAction: () => { restoreDismissedRecommendations(); void hydrateRecommendations(section) } } : {}
      section.querySelector('.state-view, .home-recommendations')?.replaceWith(stateView({ kind: 'empty', icon: 'book', title: 'لا توجد مقترحات جديدة الآن', description: 'افتح بعض الكتب أو أضف كتبًا أخرى؛ المقترحات محلية ولا ترسل سجل قراءتك.', compact: true, ...restore })); return
    }
    const grid = h('div', { class: 'home-new-grid' }, ...items.map(item => {
      const card = homeNewCard(item.book)
      const dismiss = h('button', { type: 'button', class: 'home-recommendation__dismiss', 'aria-label': '' }, 'لا تقترح هذا')
      uiTemplateAttribute(dismiss,'aria-label','28b7fef7ac8c9028',{p1:item.book.title})
      dismiss.addEventListener('click', () => { dismissRecommendation(item.book.id); void hydrateRecommendations(section) })
      card.appendChild(dismiss)
      return card
    }))
    grid.classList.add('home-recommendations')
    section.querySelector('.state-view, .home-recommendations')?.replaceWith(grid)
  } catch { section.querySelector('.state-view')?.replaceWith(stateView({ kind: 'error', title: 'تعذّر إعداد المقترحات', description: 'سجل قراءتك محلي ولم يتغير.', compact: true })) }
}

async function hydrateGateways(root: HTMLElement): Promise<void> {
  try {
    // لا نحمّل فهرس المؤلفين الكامل (وفيه مراجع 8553 كتابًا) لمجرد رسم
    // بوابتين. النسخة الخفيفة تحفظ الحقول اللازمة للواجهة فقط، فتظهر فورًا.
    const response = await fetch('./data/shamela-gateways.json', { cache: 'force-cache' })
    if (!response.ok) throw new Error(`shamela_gateways_http_${response.status}`)
    const index = await response.json() as {
      categories: Array<{ name: string; count: number }>
      authors: Array<{ id: string; name: string; bookCount: number }>
    }
    if (!Array.isArray(index.categories) || !Array.isArray(index.authors)) throw new Error('shamela_gateways_invalid')
    const categoryCounts = new Map<string,number>()
    for(const category of index.categories){const name=effectiveBookCategory({category:category.name});categoryCounts.set(name,(categoryCounts.get(name)??0)+category.count)}
    const categories: Array<[string, number, string?]> = BOOK_CATEGORIES
      .map((name): [string, number, string?] => [name, Number(categoryCounts.get(name) ?? 0), name])
    const authors: Array<[string, number, string?]> = index.authors.map((author): [string, number, string?] => [author.name, Number(author.bookCount), author.id])
    root.replaceChildren(
      gatewayPanel('التصنيفات الموضوعية', 'انتقل إلى الفن الذي تريد القراءة فيه', 'compass', categories, (value) => value === UNCATEGORIZED_CATEGORY ? categoryHref() : categoryHref(value), '#/library'),
      gatewayPanel('المؤلفون', 'تصفح المؤلفين الذين توجد كتبهم في خزانتك', 'person', authors, (id) => `#/author/${encodeURIComponent(id)}`, '#/authors?owners=books', 100),
    )
  } catch { /* Keep the immediately rendered snapshot; refresh is best effort. */ }
}

function gatewayPanel(title: string, description: string, iconName: 'compass' | 'person', items: Array<[string, number, string?]>, href: (name: string) => string, allHref: string, visibleLimit = Number.POSITIVE_INFINITY): HTMLElement {
  const rail = h('div', { class: 'home-gateway__rail', tabindex: 0, 'aria-label': title, 'aria-live': 'polite' })
  const renderItems = (query = ''): void => {
    const normalized = query.trim().toLocaleLowerCase('ar')
    const matching = items.filter(([name]) => !normalized || name.toLocaleLowerCase('ar').includes(normalized))
    const visible = matching.slice(0, visibleLimit)
    rail.replaceChildren(...visible.map(([name, count, value]) => h('a', { class: 'home-gateway__item', href: href(value ?? name) }, h('span', { class: 'home-gateway__item-icon' }, icon(iconName, 19)), h('span', null, h('strong', { dataset: { noTranslate: '' } }, name), h('small', null, uiTemplateText(count===1?'bd92467903830d1a':'d546cb9b56523fa3',{p1:count}))), icon('chevron-left', 16))))
    if (!visible.length) {
      const empty = stateView(items.length
        ? { kind: 'no-results', icon: 'search', title: 'لا يوجد اسم يطابق هذه التصفية', description: 'جرّب كلمة أقصر أو امسح حقل البحث.', compact: true }
        : { kind: 'empty', icon: iconName, title: 'لا توجد بيانات في هذا الباب بعد', description: 'أضف كتابًا مصنفًا لتظهر العناصر هنا.', actionLabel: 'فتح المكتبة', href: '#/library', compact: true })
      rail.appendChild(empty)
    }
  }
  renderItems()
  const filterBar = h('div', { class: 'home-gateway__filter' })
  const filterInput = h('input', { type: 'search', placeholder: '', 'aria-label': '' }) as HTMLInputElement
  uiTemplateAttribute(filterInput,'placeholder','fc35bc690205a0f0',{p1:uiLabelParameter(title)})
  uiTemplateAttribute(filterInput,'aria-label','f82f941843022f8a',{p1:uiLabelParameter(title)})
  const filterStatus = h('small', { 'aria-live': 'polite' }, uiTemplateText('e7f34d9b2ec395a1',{p1:items.length}))
  filterInput.addEventListener('input', () => {
    const count = items.filter(([name]) => name.toLocaleLowerCase('ar').includes(filterInput.value.trim().toLocaleLowerCase('ar'))).length
    filterStatus.replaceChildren(uiTemplateText('fb0996e8a9997f68',{p1:count}))
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
    h('p', { class: 'home-hero__ayah', dataset: { noTranslate: '' } }, '﴿ وَقُل رَّبِّ زِدْنِي عِلْمًا ﴾'),
    h('p', { class: 'home-hero__hadith', dataset: { noTranslate: '' } }, '«طلب العلم فريضة على كل مسلم»'),
  ))
  hero.appendChild(h('h1', { id: 'home-title' }, h('span', { class: 'home-hero__title-brand' }, 'الخزانة'), ': المكتبة الإسلامية الذكية'))
  hero.appendChild(h('p', { class: 'home-hero__sub' }, 'تابع قراءتك، راجع محفوظاتك، أنجز بحوثك، وعش وقتك مع خير جليس، وإن علمت فاعمل وانطلق داعيةً مجاهدًا تنشر الهدى في كل مكان.'))
  if(!currentAccountClaims())hero.appendChild(h('nav',{class:'welcome__actions','aria-label':'خيارات التصفح والدخول'},h('a',{class:'btn btn--primary',href:'#/library'},'تصفح الكتب كضيف'),h('a',{class:'btn btn--secondary',href:'#/account/sign-in'},'الدخول بحساب'),h('a',{class:'btn btn--secondary',href:'#/welcome'},'صفحة الاستقبال')))
  return hero
}

async function hydrateRecent(root: HTMLElement): Promise<void> {
  try {
    const books = (await loadHomeBooks()).slice().sort((a, b) => b.addedAt - a.addedAt)
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
  copy.appendChild(h('a', { class: 'btn btn--primary continue-card__resume', href: `#/reader/${book.id}` }, icon('book', 18), uiTemplateText('3c0e4013692ecf19',{p1:currentPage})))
  copy.appendChild(bindBookDisplayTitle(h('h2', { id: 'recent-heading', dataset: { noTranslate: '' } }, book.title), book.id, book.title))
  copy.appendChild(authorLink(book.author, 'continue-card__author', book.authorId))
  const plan = getReadingPlan(book.id)
  if (plan) {
    const progress = planProgress(plan, currentPage - 1)
    copy.appendChild(h('p', { class: 'continue-card__plan' }, progress.remainingPages ? uiTemplateText('c37a49e31a53edd1',{p1:progress.targetPageToday,p2:progress.percent}) : 'أتممت خطة هذا الكتاب بحمد الله'))
  }
  card.appendChild(homeBoundAria(h('a', { class: 'continue-card__mark', href: `#/reader/${book.id}` }, bookCover(book, 'continue-card__cover')),'c5e6ec19c82f0d93',{p1:book.title,p2:currentPage}))
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
  const customQuote = getReaderQuotes()[0]
const quote = h('article', { class: 'daily-card daily-card--quote' }, h('div', { class: 'daily-quote__head' }, h('a', { class: 'home-kicker', href:'#/quotes' }, 'اقتباس اليوم')), h('p', { class: 'daily-quote__text', ...(customQuote ? { dataset: { noTranslate: '' } } : {}) }, customQuote ? `«${customQuote.text}»` : 'افتح كتابًا أو أضف اقتباسك، وسيظهر اقتباس من خزانتك هنا.'))
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
  const identity = captureReadingIdentity()
try{const {quotes}=await loadPublicQuotes(0,20);if(!identity.isCurrent())return;if(quotes.length){const selected=quotes[Math.floor(Date.now()/86_400_000)%quotes.length]!;root.replaceChildren(h('div',{class:'daily-quote__head'},h('a',{class:'home-kicker',href:'#/quotes'},'اقتباس اليوم'),h('a',{href:'#/quotes'},'كل الاقتباسات')),h('strong',{dataset:{noTranslate:''}},selected.displayName),h('p',{class:'daily-quote__text',dataset:{noTranslate:''}},selected.text),h('a',{href:publicQuoteHref(selected),dataset:{noTranslate:''}},`${selected.bookTitle} — موضع ${selected.pageIndex+1}`));const add=h('button',{class:'daily-quote__add',onclick:()=>{void loadHomeBooks().then(books=>{if(identity.isCurrent())showQuoteForm(root,books,identity)})}},'أضف اقتباسًا');root.querySelector('.daily-quote__head')?.append(add);return}}catch{/* Private local quotes remain available without publishing them. */}
  const books = await loadHomeBooks()
  if (!identity.isCurrent()) return
  const custom = getReaderQuotes(identity)
  const candidates = [
    ...custom.map(quote => ({ text: quote.text, bookId: quote.bookId })),
    ...homeQuoteCandidates(books),
  ]
  const dailyIndex = Math.floor(Date.now() / 86_400_000)
  const selected = candidates.length ? candidates[dailyIndex % candidates.length] : undefined
  const book = selected ? books.find(item => item.id === selected.bookId) : undefined
  const add = h('button', { class: 'daily-quote__add', type: 'button' }, icon('plus', 15), 'أضف اقتباسًا')
  add.addEventListener('click', () => { if (identity.isCurrent()) showQuoteForm(root, books, identity) })
  root.removeAttribute('role')
  root.replaceChildren(h('div', { class: 'daily-quote__head' }, h('a', { class: 'home-kicker', href:'#/quotes' }, 'اقتباس اليوم'), add), selected ? h('p', { class: 'daily-quote__text', dataset: { noTranslate: '' } }, `«${selected.text}»`) : h('p', { class: 'daily-quote__text' }, 'افتح كتابًا أو أضف اقتباسك، وسيظهر اقتباس من خزانتك هنا.'), ...(book ? [h('div', { class: 'daily-quote__source' }, h('a', { href: `#/reader/${book.id}`, dataset: { noTranslate: '' } }, book.title), document.createTextNode(' — '), authorLink(book.author, undefined, book.authorId))] : []))
}

function showQuoteForm(root: HTMLElement, books: StoredBook[], identity = captureReadingIdentity()): void {
 if(!identity.isCurrent())return
 if(!books.length){toast('أضف كتابًا إلى مكتبتك أولًا');return}
 const select=h('select',{'aria-label':'مصدر الاقتباس'},...books.map(book=>h('option',{value:book.id,dataset:{noTranslate:''}},book.title))) as HTMLSelectElement
 const body=h('div',null)
 const render=()=>{body.replaceChildren(quotePublishForm({text:'',bookId:select.value,onSaved:()=>void hydrateDailyQuote(root)}))}
 select.onchange=render;render()
 root.replaceChildren(select,body,h('button',{class:'btn btn--secondary',onclick:()=>void hydrateDailyQuote(root)},'إلغاء'))
}

async function hydratePopular(section: HTMLElement): Promise<void> {
  const identity=captureReadingIdentity(),scope=captureRouteResourceScope()
  const current=()=>identity.isCurrent()&&!scope.disposed
  try {
  const books = await loadHomeBooks()
  if(!current())return
  const counts = getReadingActivity().openCounts
  const body = h('div', { class: 'home-popular__body' })
  const grid = h('div', { class: 'home-popular__grid' })
  const summary = h('p', { class: 'home-popular__summary', 'aria-live': 'polite' })
  const render = (): void => {
    if(!current())return
    const matching = books.filter(book => (counts[book.id] ?? 0) > 0).sort(compareBooksByMetric(book => counts[book.id] ?? 0))
    const visible = matching.slice(0, 50)
    summary.replaceChildren(uiTemplateText(matching.length>50?'home-popular-limit':matching.length===1?'home-popular-single':'home-popular-count',{p1:matching.length}))
    grid.replaceChildren(...visible.map((book, index) => homePopularCard(book, counts[book.id] ?? 0, index)))
    if (!visible.length) grid.appendChild(stateView(books.length
      ? { kind: 'no-results', icon: 'book', title: 'لا توجد بيانات استعمال بعد', description: 'افتح كتابًا ليظهر ترتيبه هنا.', compact: true }
      : { kind: 'empty', icon: 'book', title: 'لا توجد كتب في المكتبة بعد', description: 'أضف كتاب Word لتبدأ.', actionLabel: 'فتح المكتبة', href: '#/library', compact: true }))
  }
  body.append(summary, grid)
  section.querySelector('.home-popular__body, .state-view')?.replaceWith(body); render()
  } catch {
    if(!current())return
    section.querySelector('.state-view, .home-popular__body')?.replaceWith(stateView({ kind: 'error', title: 'تعذّر ترتيب الكتب الأكثر استعمالًا', description: 'كتبك محفوظة؛ أعد المحاولة.', actionLabel: 'إعادة المحاولة', onAction: () => void hydratePopular(section), compact: true }))
  }
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
  const scope=captureRouteResourceScope(),identity=captureReadingIdentity(),abort=new AbortController()
  scope.add(()=>abort.abort())
  const current=()=>!scope.disposed&&identity.isCurrent()
  const initial=[...grid.childNodes],client=createPublishedBooksCatalogClient()
  let local:StoredBook[]|undefined,pages=0,busy=false
  const status=h('p',{role:'status','aria-live':'polite'})
  const render=()=>{
    if(!current())return
    const state=client.snapshot(),cards=publicHomeCards(state.books,new Set(local?.map(book=>book.id)??[]))
    const shown=[...(local??[]),...cards].sort((a,b)=>b.addedAt-a.addedAt).slice(0,4)
    grid.replaceChildren(...(shown.length?shown.map((book,index)=>homeNewCard(book,index)):initial))
    status.replaceChildren(state.error?uiTemplateText('home-public-load-failed',{}):busy?uiTemplateText('home-public-loading',{}):'')
  }
  const load=async()=>{if(!current()||busy||pages>=3)return;busy=true;render();await client.next(abort.signal);pages++;busy=false;render()}
  section.append(status)
  void load()
  try {
    const allBooks = await loadHomeBooks()
    if(!current())return
    writeHomeBookSnapshot(allBooks)
    local = allBooks.slice().sort(compareBooksByMetric(book => book.addedAt)).slice(0, 4)
    grid.removeAttribute('role')
    render()
  } catch { /* Keep the useful synchronous snapshot visible while refresh can be retried on revisit. */ }
}

function homePopularCard(book: StoredBook, openCount: number, index: number): HTMLElement {
  const titleId = `popular-${book.id}-title`
  const ordinal = bookOrdinal(index)
  return h('article', { class: 'home-popular-card', 'aria-labelledby': titleId },
    homeBoundAria(h('a', { class: 'book-card__surface', href: `#/reader/${book.id}` }),'c56b64ed45a736e3',{p1:book.title}),
    h('div', { 'aria-hidden': 'true' }, bookCover(book, 'home-popular-card__cover')),
    h('span', null,
      homeBoundAria(h('small', { class: 'book-card__ordinal' }, String(ordinal.number)),'2ad0367328ba34be',{p1:ordinal.number}),
      bindBookDisplayTitle(h('strong', { id: titleId, class: 'home-card__title', dataset: { noTranslate: '' } }, book.title), book.id, book.title),
      h('small', { class: 'home-card__taxonomy' }, authorLink(book.author, undefined, book.authorId), document.createTextNode(' · '), categoryLink(effectiveBookCategory(book))),
      h('em', null, uiTemplateText('154c2a782e0d8938',{p1:openCount})),
    ),
  )
}

export function homeNewCard(book: HomeCardDisplay, index = 0): HTMLElement {
  const titleId = `new-${book.id}-title`
  const artwork='data' in book?bookCover(book,'home-new-card__cover'):previewCover(book.title,book.author,0).element
  if(!('data' in book))artwork.className='home-new-card__cover book-cover'
  const ordinal = bookOrdinal(index)
  return h('article', { class: 'home-new-card', 'aria-labelledby': titleId },
    homeBoundAria(h('a', { class: 'book-card__surface', href: `#/reader/${book.id}` }),'c56b64ed45a736e3',{p1:book.title}),
    h('div', { 'aria-hidden': 'true' }, artwork),
    h('span', { class: 'home-new-card__copy' },
      homeBoundAria(h('small', { class: 'book-card__ordinal' }, String(ordinal.number)),'2ad0367328ba34be',{p1:ordinal.number}),
      bindBookDisplayTitle(h('strong', { id: titleId, class: 'home-card__title', dataset: { noTranslate: '' } }, book.title), book.id, book.title),
      authorLink(book.author, undefined, 'authorId' in book?book.authorId:undefined),
      categoryLink(effectiveBookCategory(book)),
    ),
  )
}


function linkedHomeHeader(title:string,id:string,href:string):HTMLElement{return h('div',{class:'section-header'},h('h2',{id},h('a',{href},title)))}
function homeBoundAria<T extends Element>(element:T,id:string,parameters:Parameters<typeof uiTemplateText>[1]):T{uiTemplateAttribute(element,'aria-label',id,parameters);return element}
import {routeLocation} from "../path_location"
