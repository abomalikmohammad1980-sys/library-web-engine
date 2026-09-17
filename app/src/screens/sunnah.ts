import { h } from '../ui'
import {captureRouteResourceScope} from '../resource_lifecycle'
import {uiTemplateText,uiTemplateAttribute} from '../ui_template_binding'
import { listBooks, type StoredBook } from '../engine/library_store'
import { pageContent } from '../components'
import { stateView } from '../state_view'
import { bookAuthorLinks, categoryLink, canonicalBookCategory, matchesCategoryFilter } from '../taxonomy_links'
import { HADEETHENC_AR_SOURCE, loadVerifiedSunnahCorpus, verifiedPrimarySources, validateSunnahGoldenRecord } from '../sunnah_source_registry'
import { searchSunnahCorpus } from '../sunnah_corpus_search'
import { bookOrdinal, orderedBooks, sortBooks, BOOK_SORT_OPTIONS, type BookSort } from '../book_ordering'
import {availableAuthorChronology as booksWithAuthorChronology} from '../book_ordering_chronology'
import { shamelaSearchClient } from '../shamela_search_client'
import { augmentSunnahLibraryBooks, buildVerifiedSunnahSearchScope, completeSunnahSearchScope, isKnownSunnahAuthorName, searchAllVerifiedSunnahBooks, VERIFIED_SUNNAH_CATEGORIES } from '../sunnah_global_search'
import { silentSkeleton } from '../silent_skeleton'
import { decorativeImage } from '../safe_image'
import {icon} from '../icons'
import {authorLink} from '../taxonomy_links'
import {appendSearchText} from '../search_presentation'
import {createSunnahResultPager} from '../sunnah_result_order'

const SUNNAH_TERMS = [
  'كتب السنة', 'متون الحديث', 'شروح الحديث', 'تخريج', 'الأطراف', 'علل الحديث',
  'علوم الحديث', 'مصطلح الحديث', 'الجرح والتعديل', 'رواة الحديث', 'حديث', 'سنن',
]
const SUNNAH_WINDOW_SIZE = 40
export const SUNNAH_SCOPE_CACHE_KEY = 'alkhizana:sunnah-scope:v3'

export function sunnahWindow<T>(items: readonly T[], limit = SUNNAH_WINDOW_SIZE): T[] {
  return items.slice(0, Math.max(0, limit))
}

export function sunnahBookHref(bookId: string): string {
  return `#/reader/${encodeURIComponent(bookId)}`
}

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
  if (!matchesCategoryFilter(book.category,category)) return false
  if (!query) return true
  const searchable = [book.title, book.author, ...(book.authors?.map(author => author.name) ?? []),
    canonicalBookCategory(book.category), book.description, ...(book.tags?.map(tag => tag.name) ?? [])]
  return normalize(searchable.filter(Boolean).join(' ')).includes(query)
}

export function hasKnownSunnahAuthor(book: Pick<StoredBook, 'author' | 'authors'>): boolean {
  const names = [book.author, ...(book.authors?.map(author => author.name) ?? [])]
  return names.some(isKnownSunnahAuthorName)
}

export function readCachedSunnahScope(
  storage: Pick<Storage, 'getItem'> = localStorage,
): Awaited<ReturnType<typeof completeSunnahSearchScope>> | undefined {
  try {
    const value = JSON.parse(storage.getItem(SUNNAH_SCOPE_CACHE_KEY) ?? 'null') as Awaited<ReturnType<typeof completeSunnahSearchScope>> | null
    if (!value || value.contract !== 'sunnah-global-search-scope/1' || !Array.isArray(value.books) || !value.books.length) return undefined
    if (value.books.some(book => !book.sourceBookId
      || book.publicId !== `410${book.sourceBookId.padStart(6, '0')}`
      || !VERIFIED_SUNNAH_CATEGORIES.has(book.category)
      || typeof book.author !== 'string' || !book.author.trim())) return undefined
    return value
  } catch {
    return undefined
  }
}

export function writeCachedSunnahScope(
  scope: Awaited<ReturnType<typeof completeSunnahSearchScope>>,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  try { storage.setItem(SUNNAH_SCOPE_CACHE_KEY, JSON.stringify(scope)) } catch { /* cache تحسين اختياري */ }
}

export async function resolveSunnahScreenSources(
  booksPromise:Promise<StoredBook[]>=listBooks(),
  corpusPromise:ReturnType<typeof loadVerifiedSunnahCorpus>=loadVerifiedSunnahCorpus(),
  fetcher:typeof fetch=globalThis.fetch,
):Promise<{localBooks:StoredBook[];indexedScope:Awaited<ReturnType<typeof completeSunnahSearchScope>>;verifiedRecords:Awaited<ReturnType<typeof loadVerifiedSunnahCorpus>>['records']}>{
  // لا تحجب ربط مربع البحث بفتح IndexedDB أو عينة التخريج. النطاق المنشور
  // مستقل وصغير، بينما تصل بيانات البطاقات والشواهد إلى المصفوفتين نفسيهما
  // في الخلفية إن سبقت أول عملية رسم أو بحث.
  const localBooks:StoredBook[]=[],verifiedRecords:Awaited<ReturnType<typeof loadVerifiedSunnahCorpus>>['records']=[]
  void booksPromise.then(books=>localBooks.push(...books),error=>console.warn('sunnah_local_books_unavailable_using_catalog',error))
  void corpusPromise.then(corpus=>verifiedRecords.push(...corpus.records),()=>undefined)
  // Cached cards are only a first paint. A prior release's scope must never
  // decide which books the new search excludes.
  const indexedScope=await completeSunnahSearchScope(buildVerifiedSunnahSearchScope([]),fetcher)
  return{localBooks,indexedScope,verifiedRecords}
}

export async function resolveSunnahScreenSourcesWithRetry(
  factory:()=>Promise<Awaited<ReturnType<typeof resolveSunnahScreenSources>>>=()=>resolveSunnahScreenSources(),
):Promise<Awaited<ReturnType<typeof resolveSunnahScreenSources>>>{
  let last:unknown
  for(let attempt=0;attempt<3;attempt++){try{return await factory()}catch(error){last=error;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,80*(attempt+1)))}}
  throw last
}

function sunnahInitialSkeleton(): HTMLElement[] {
  return Array.from({ length: 8 }, (_, index) => h('article', {
    class: 'sunnah-book-result sunnah-book-result--skeleton', 'aria-hidden': 'true',
  }, h('span', { class: 'skeleton-line' }), h('span', { class: 'skeleton-line skeleton-line--short' }),
  h('span', { class: 'sunnah-book-result__ordinal' }, String(index + 1))))
}

function sunnahBookResult(book: StoredBook, index: number): HTMLElement {
  const readingHref = sunnahBookHref(book.id)
  const card=h('article', { class: 'sunnah-book-result', 'aria-labelledby': `sunnah-book-${book.id}` },
    h('a', { class: 'sunnah-book-result__surface', href: readingHref }),
    h('span', { class: 'sunnah-book-result__ordinal' }, String(bookOrdinal(index).number)),
    h('h3', { class: 'sunnah-book-result__title', id: `sunnah-book-${book.id}`, dataset:{noTranslate:''} }, book.title),
    hasKnownSunnahAuthor(book) ? bookAuthorLinks(book, 'sunnah-book-result__author') : null,
    book.category
      ? categoryLink(book.category, 'sunnah-book-result__category')
      : h('span', { class: 'sunnah-book-result__category' }, 'من كتب السنة في مكتبتك'),
  )
  uiTemplateAttribute(card.querySelector('.sunnah-book-result__surface')!,'aria-label','c56b64ed45a736e3',{p1:book.title})
  uiTemplateAttribute(card.querySelector('.sunnah-book-result__ordinal')!,'aria-label','2ad0367328ba34be',{p1:bookOrdinal(index).number})
  return card
}

function sunnahTextResult(hit:{bookId:string;paragraphIndex:number;text:string},title:string):HTMLElement{return h('article',{class:'sunnah-corpus-result'},h('h3',{dataset:{noTranslate:''}},title),h('p',{class:'sunnah-corpus-result__text',dataset:{noTranslate:''}},hit.text),h('a',{class:'btn btn--secondary',href:`#/reader/${410000000+Number(hit.bookId)}?pageIndex=${hit.paragraphIndex}`},'فتح الموضع'))}

export function sunnahPassageResult(row:{ordinal:number;bookTitle:string;authorName:string;authorId?:string|undefined;deathYearHijri?:number|undefined;fullText:string;href:string;pageLabel?:string|undefined;partLabel?:string|undefined}):HTMLElement {
  const text=h('div',{class:'sunnah-corpus-result__text sunnah-passage-text',dataset:{noTranslate:''}})
  appendSearchText(text,row.fullText)
  // Only an explicit numbered entry at the start is a hadith number; never use the page index.
  const number=/^\s*([0-9٠-٩]+)\s*[-–]/u.exec(row.fullText)?.[1]
  const reference=[row.partLabel,row.pageLabel].filter(Boolean).join(' / ')+(number?` - ح ${number}`:'')
  return h('article',{class:'sunnah-corpus-result sunnah-passage-result'},
    h('header',{class:'sunnah-passage-result__heading'},h('span',{class:'sunnah-passage-result__ordinal'},`${row.ordinal}-`),h('a',{href:row.href,dataset:{noTranslate:''}},row.bookTitle),reference?h('bdi',{class:'sunnah-passage-result__reference',dir:'ltr'},`(${reference})`):null,h('span',{'aria-hidden':'true'},'—'),authorLink(row.authorName,'sunnah-passage-result__author',row.authorId),Number.isSafeInteger(row.deathYearHijri)&&row.deathYearHijri!==99999?h('span',{class:'sunnah-passage-result__death',dataset:{noTranslate:''}},`(ت ${row.deathYearHijri} هـ)`):null),text)
}

export function verifiedWitnessResult(record: Awaited<ReturnType<typeof loadVerifiedSunnahCorpus>>['records'][number]): HTMLElement | undefined {
  if (validateSunnahGoldenRecord(record).length) return undefined
  const primarySources = verifiedPrimarySources(record)
  return h('article', { class: 'sunnah-corpus-result sunnah-verdict-summary', 'aria-labelledby': `sunnah-witness-${record.id}` },
    h('div',{class:'sunnah-verdict-summary__eyebrow',dataset:{uiText:''}},icon('book',18),'خلاصة الحديث'),
    h('h3', { id: `sunnah-witness-${record.id}`, dataset:{noTranslate:''} }, record.title),
    h('p', { class: 'sunnah-corpus-result__text', dataset:{noTranslate:''} }, record.hadithText),
    primarySources.length ? h('p', { class: 'sunnah-corpus-result__meta' }, h('strong', null, 'المصادر الأصلية: '),
      ...primarySources.flatMap((source, index) => [index ? document.createTextNode('؛ ') : document.createTextNode(''), h('a', { href: `#/reader/${source.publicId}?sequence=${source.sequence}` }, uiTemplateText('a6df55441da8cbbc',{p1:source.book,p2:source.hadithNumber,p3:source.volume,p4:source.page}))])) : null,
    record.grade ? h('p', { class: 'sunnah-verdict-summary__grade' }, h('strong', null, 'الحكم: '), h('span',{dataset:{noTranslate:''}},record.grade), h('a',{class:'sunnah-verdict-summary__source',href:record.link,target:'_blank',rel:'noopener noreferrer',title:'مصدر الحكم: موسوعة الأحاديث النبوية — HadeethEnc','aria-label':'مصدر الحكم: موسوعة الأحاديث النبوية — HadeethEnc'},icon('book',20))) : null,
    record.takhrij ? h('p', { class: 'sunnah-corpus-result__meta' }, h('strong', null, 'التخريج: '), h('span',{dataset:{noTranslate:''}},record.takhrij)) : null,
    h('details',null,h('summary',null,'الشرح والفوائد من المصدر'),
      ...([['sunnah-explanation',record.explanation],['sunnah-word-meanings',record.wordMeanings],['sunnah-benefits',record.benefits]] as const).filter(([,value])=>Boolean(value)).map(([label,value])=>h('section',null,h('h4',null,uiTemplateText(label,{})),h('p',{dataset:{noTranslate:''},style:'white-space:pre-wrap'},value)))),
  )
}

export function sunnahScreen(): HTMLElement {
  const search = h('input', {
    class: 'sunnah-search__input', type: 'search',
    placeholder: 'صفِّ الكتب، أو اكتب حديثًا ثم اضغط بحث الحديث…',
    'aria-label': 'البحث في قسم السنة',
  }) as HTMLInputElement
  const hadithSearch=h('button',{type:'button',class:'btn btn--primary'},'بحث الحديث') as HTMLButtonElement
  let requestedTextSearch=false
  const count = h('strong', { class: 'sunnah-search__count', 'aria-live': 'polite' })
  const category = h('select', { class: 'sunnah-search__category', 'aria-label': 'تصفية كتب السنة حسب الفن' },
    h('option', { value: '' }, 'كل فنون السنة'),
  ) as HTMLSelectElement
  const order = h('select', { class: 'sunnah-search__category', 'aria-label': 'ترتيب الكتب' },
    ...BOOK_SORT_OPTIONS.map(({value,label})=>h('option',{value},label)),
  ) as HTMLSelectElement
  const results = h('div', { class: 'sunnah-results sunnah-results--loading', 'aria-live': 'polite' }, ...sunnahInitialSkeleton())
  results.setAttribute('aria-busy','true')
  const more = h('div', { class: 'sunnah-results__more', role:'status', hidden: true, dataset:{uiText:''} }, 'تابع النزول')
  results.id = 'sunnah-results'
  more.setAttribute('aria-controls', 'sunnah-results')
  const enrichment = h('div', { class: 'sunnah-corpus-results', 'aria-live': 'polite' })
  const cachedScope = readCachedSunnahScope()
  if (cachedScope) {
    const cachedBooks = orderedBooks(augmentSunnahLibraryBooks([], cachedScope))
    results.replaceChildren(...sunnahWindow(cachedBooks).map((book, index) => sunnahBookResult(book, index)))
    results.classList.remove('sunnah-results--loading')
    results.removeAttribute('aria-busy')
    count.replaceChildren(uiTemplateText('sunnah-books-count',{p1:cachedBooks.length}))
    category.replaceChildren(h('option', { value: '' }, 'كل فنون السنة'),
      ...[...new Set(cachedBooks.map(book => canonicalBookCategory(book.category)).filter((value): value is string => Boolean(value)))]
        .sort((a, b) => a.localeCompare(b, 'ar')).map(value => h('option', { value }, value)))
  }

  void resolveSunnahScreenSourcesWithRetry().then(async ({localBooks,indexedScope,verifiedRecords}) => {
    // IndexedDB إثراء محلي فقط؛ سلطة النطاق هي دفعات الكتالوج المنشور.
    const indexedIds = new Set(indexedScope.books.map(book=>book.publicId))
    writeCachedSunnahScope(indexedScope)
    const sunnahBooks = orderedBooks(await booksWithAuthorChronology(augmentSunnahLibraryBooks(localBooks.filter(book=>indexedIds.has(book.id)),indexedScope)))
    const indexedBySource = new Map(indexedScope.books.map(book=>[book.sourceBookId,book]))
    const orderedTextPage=createSunnahResultPager(indexedScope,(query,offset,limit,signal)=>searchAllVerifiedSunnahBooks(shamelaSearchClient(),indexedScope,query,offset,limit,signal))
    const categories = [...new Set(sunnahBooks.map(book => book.category?.trim()).filter((value): value is string => Boolean(value)))]
      .sort((a, b) => a.localeCompare(b, 'ar'))
    category.replaceChildren(h('option', { value: '' }, 'كل فنون السنة'),
      ...categories.map(value => h('option', { value }, value)))
    results.classList.remove('sunnah-results--loading');results.removeAttribute('aria-busy')
    let serial=0, activeSearch:AbortController|undefined, visibleLimit=SUNNAH_WINDOW_SIZE,textOffset=0,textTotal=0,textLoadingRequest=0,textMode=false
    const loadTextPage=async(request:number,offset:number):Promise<void>=>{
      if(request!==serial||!activeSearch||textLoadingRequest===request)return
      textLoadingRequest=request;const controller=activeSearch;more.hidden=true;results.setAttribute('aria-busy','true')
      try{
        const page=await orderedTextPage(search.value.trim(),offset,60,order.value as BookSort,controller.signal)
        if(request!==serial||activeSearch!==controller)return
        if(!page.scopeCoverageComplete)throw Error('sunnah_search_incomplete')
        textOffset=offset;textTotal=page.total
        const rows=page.hits.map((hit,index)=>{const meta=indexedBySource.get(hit.bookId);return{ordinal:offset+index+1,bookTitle:meta?.title??`كتاب السنة ${hit.bookId}`,authorName:meta?.author??hit.author??'المؤلف مجهول',authorId:meta?.authorId?.replace(/^shamela-author-/,'shamela:'),deathYearHijri:meta?.deathYearHijri??hit.deathYearHijri,fullText:hit.text,partLabel:hit.partLabel,pageLabel:hit.pageLabel,href:`#/reader/${410000000+Number(hit.bookId)}?pageIndex=${hit.paragraphIndex}`}})
        results.classList.add('sunnah-results--text')
        // Variable-height passages must not use the former fixed 64px row spacers.
        if(offset===0)results.replaceChildren(...(rows.length?rows.map(sunnahPassageResult):[stateView({kind:'empty',title:'لا نتيجة نصية في كتب السنة الموثقة'})]))
        else results.append(...rows.map(sunnahPassageResult))
        more.hidden=offset+rows.length>=page.total;more.textContent='عرض مواضع أخرى'
        count.replaceChildren(uiTemplateText('sunnah-matching-passages',{p1:page.total,p2:page.scopeBooks}))
      }catch(error){if(request!==serial||error instanceof DOMException&&error.name==='AbortError')return;results.replaceChildren(stateView({kind:'error',title:'توقف البحث النصي احترازيًا',description:'لم تكتمل سلامة نطاق كتب السنة أو فهرسه، لذلك لم تُعرض نتائج ناقصة كتغطية كاملة.'}))}
      finally{if(textLoadingRequest===request)textLoadingRequest=0;if(activeSearch===controller)results.removeAttribute('aria-busy')}
    }
    const render = (): void => {
      const query = normalize(search.value)
      if (query.length < 2) results.classList.remove('sunnah-results--text')
      const visible = sortBooks(sunnahBooks.filter(book => sunnahBookMatches(book, query, category.value)), order.value as BookSort)
      order.disabled = false
      count.replaceChildren(uiTemplateText('sunnah-books-filtered',{p1:visible.length,p2:sunnahBooks.length}))
      results.replaceChildren(...(visible.length
        ? sunnahWindow(visible, visibleLimit).map((book, index) => sunnahBookResult(book, index))
        : [stateView({ kind: 'empty', title: query ? 'لا نتيجة في كتب السنة المحلية' : 'لا توجد كتب سنة مصنفة بعد', description: query ? 'جرّب جزءًا أقصر من اسم الكتاب أو المؤلف.' : 'أضف كتب الحديث أو صحّح تصنيفها، فتظهر هنا تلقائيًا.' })]))
      more.hidden = visibleLimit >= visible.length
      more.textContent = 'تابع النزول'
      const witnesses = requestedTextSearch&&query ? searchSunnahCorpus(verifiedRecords, search.value.trim()).map(({ record }) => verifiedWitnessResult(record)).filter((item): item is HTMLElement => Boolean(item)) : []
      enrichment.replaceChildren(...witnesses)
      const request=++serial
      activeSearch?.abort()
      activeSearch=requestedTextSearch&&query.length>=2?new AbortController():undefined
      textMode=requestedTextSearch&&query.length>=2
      order.hidden=false
      if(textMode){textOffset=0;textTotal=0;count.textContent='البحث في نصوص كتب السنة';results.replaceChildren(silentSkeleton('cards'));void loadTextPage(request,0)}
    }
    const resetAndRender = (): void => { visibleLimit = SUNNAH_WINDOW_SIZE; render() }
    let inputTimer:ReturnType<typeof setTimeout>|undefined
    search.addEventListener('input',()=>{requestedTextSearch=false;activeSearch?.abort();serial++;clearTimeout(inputTimer);inputTimer=setTimeout(resetAndRender,180)})
    hadithSearch.onclick=()=>{if(search.value.trim().length<2){search.focus();return}clearTimeout(inputTimer);requestedTextSearch=true;resetAndRender()}
    search.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();hadithSearch.click()}})
    captureRouteResourceScope().add(()=>{clearTimeout(inputTimer);activeSearch?.abort()})
    category.addEventListener('change', resetAndRender)
    order.addEventListener('change', resetAndRender)
     const autoMore=new IntersectionObserver(entries=>{if(!entries.some(entry=>entry.isIntersecting))return;if(textMode){if(textLoadingRequest!==serial&&textOffset+60<textTotal)void loadTextPage(serial,textOffset+60)}else if(!more.hidden){visibleLimit += SUNNAH_WINDOW_SIZE;render();queueMicrotask(()=>{if(!more.hidden&&more.getBoundingClientRect().top<innerHeight+800){visibleLimit += SUNNAH_WINDOW_SIZE;render()}})}},{rootMargin:'800px 0px'});autoMore.observe(more);window.addEventListener('popstate',()=>autoMore.disconnect(),{once:true})
    render()
  }).catch((error:unknown) => {
    const message=error instanceof Error?error.message:String(error)
    const code=/sunnah_catalog_http_/u.test(message)?'catalog-http':/json|catalog/u.test(message)?'catalog-data':/scope/u.test(message)?'scope':'screen-init'
    console.error('sunnah_screen_init_failed',{code,error})
    const failure=stateView({ kind: 'error', title: 'تعذّر فتح كتب السنة المحلية', description: '' })
    failure.append(h('p',null,uiTemplateText('sunnah-init-diagnostic',{p1:code})))
    results.replaceChildren(failure)
  })

  return pageContent(
    h('section', { class: 'sunnah-hero', 'aria-labelledby': 'sunnah-title' },
      decorativeImage('sunnah-hero__mark sunnah-hero__mark--muhammad','./sunnah/muhammad-seal.png'),
      h('span', { class: 'sunnah-hero__mark sunnah-hero__mark--prophethood', 'aria-hidden': 'true' },
        decorativeImage('sunnah-hero__prophethood-image','./sunnah/prophethood-seal.png')),
      h('h1', { class: 'page-title', id: 'sunnah-title' }, 'موسوعة السنة النبوية'),
      h('p', { class: 'page-sub' }, 'ابحث في نصوص الأحاديث؛ يظهر الحكم حيث توفر مصدر موثّق، مع روابط الكتب الأصلية في الخِزانة.'),
      h('div', { class: 'sunnah-search', role: 'search' }, search, hadithSearch,
        h('div', { class: 'sunnah-search__meta' }, category, order, count)),
    ),
    h('section', { class: 'sunnah-library', 'aria-labelledby': 'sunnah-library-title' },
      h('header', { class: 'sunnah-library__head' },
        h('div', null, h('h2', { id: 'sunnah-library-title' }, 'كتب السنة في مكتبتي')),
        h('a', { class: 'btn btn--secondary', href: '#/library' }, 'إدارة الكتب'),
      ),
      enrichment,
      results,
      more,
    ),
  )
}

export function sunnahSourceScreen(sourceId: string): HTMLElement {
  const source = sourceId === HADEETHENC_AR_SOURCE.id ? HADEETHENC_AR_SOURCE : undefined
  const status = h('section', { class: 'sunnah-source__status', 'aria-live': 'polite', 'aria-busy': 'true' },
    silentSkeleton('cards'))
  if (!source) {
    status.removeAttribute('aria-busy')
    status.replaceChildren(stateView({ kind: 'error', title: 'المصدر غير مسجل', description: 'لم تُعرض أي بيانات غير موثقة.' }))
  } else {
    void loadVerifiedSunnahCorpus(source).then(({ manifest, records }) => {
      status.removeAttribute('aria-busy')
      status.replaceChildren(
        h('dl', { class: 'sunnah-source__facts' },
          h('div', null, h('dt', null, 'الناشر'), h('dd', {dataset:{noTranslate:''}}, manifest.publisher)),
          h('div', null, h('dt', null, 'الإصدار العربي'), h('dd', null, manifest.release.version)),
          h('div', null, h('dt', null, 'آخر تحديث للمصدر'), h('dd', null, manifest.release.sourceUpdatedAt.slice(0, 10))),
          h('div', null, h('dt', null, 'العينة المحلية'), h('dd', null, uiTemplateText('sunnah-source-record-count',{p1:records.length}))),
        ),
        h('p', { class: 'sunnah-source__attribution', dataset:{noTranslate:''} }, manifest.attribution),
        h('div', { class: 'sunnah-source__actions' },
          h('a', { class: 'btn btn--secondary', href: manifest.homepage, target: '_blank', rel: 'noopener noreferrer' }, 'فتح المصدر الرسمي'),
          h('a', { class: 'btn btn--secondary', href: manifest.downloadUrl, target: '_blank', rel: 'noopener noreferrer' }, 'تنزيل الإصدار الرسمي'),
          h('a', { class: 'btn btn--secondary', href: manifest.checkForUpdatesUrl, target: '_blank', rel: 'noopener noreferrer' }, 'التحقق من تحديث الإصدار'),
          h('a', { class: 'btn btn--secondary', href: manifest.termsUrl, target: '_blank', rel: 'noopener noreferrer' }, 'شروط الانتفاع بالمصدر'),
        ),
      )
    }).catch(() => { status.removeAttribute('aria-busy'); status.replaceChildren(stateView({
      kind: 'error', title: 'لم يجتز corpus التحقق',
      description: 'أُوقف العرض احترازيًا؛ لم تُعرض سجلات ناقصة العزو أو مخالفة البصمة.',
    })) })
  }
  return pageContent(
    h('section', { class: 'sunnah-source', 'aria-labelledby': 'sunnah-source-title' },
      h('p', { class: 'page-eyebrow' }, source ? 'مصدر موثق' : 'تحقق المصدر'),
      h('h1', { class: 'page-title', id: 'sunnah-source-title', ...(source?{dataset:{noTranslate:''}}:{}) }, source?.name ?? 'مصدر سنة غير مسجل'),
      source ? h('p', { class: 'page-sub', dataset:{noTranslate:''} }, source.attributionLabel) : null,
      status,
      h('a', { class: 'btn btn--secondary', href: '#/sunnah' }, 'العودة إلى موسوعة السنة'),
    ),
  )
}
