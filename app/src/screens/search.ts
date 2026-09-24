/** بحث موسع مستمر: إجمالي ثابت، مؤشرات صفحات Word، ونافذة DOM محدودة. */

import { h, toast, arabicNum } from '../ui'
import {completeSearchPage,fetchOrderedSearchWindow,searchPageReady} from '../search_page_completion'
import {canAutoRefreshSearch} from '../search_refresh_policy'
import {uiTemplateText,uiTemplateAttribute,uiLabelParameter} from '../ui_template_binding'
import { unavailableBooksDescription } from '../search_unavailable_books'
import {unavailableBooksUiDescription} from '../search_unavailable_ui'
import {searchResultIdentity,centralHeadingProvider} from '../central_heading_integration'
import { shouldRetrySearchTransient, isSearchStateInvalidation } from '../search_retry_policy'
import { SearchReadiness, pendingSearchDescription, clearSearchResultSummary } from '../search_readiness'
import { icon } from '../icons'
import { pageContent } from '../components'
import { searchAllBooks, retryFailedLocalSearchIndex, type SearchField, type SearchQueryOptions, type SearchResult } from '../engine/search_store'
import { currentLibraryIdentityScope, listBooks, type StoredBook } from '../engine/library_store'
import {repairSearchBooks} from '../search_index_repair'
import { appendSearchText, cleanSearchText, normalizeArabic, pageForParagraph, type SearchMode } from '../search_presentation'
import { deriveAnalyzedSearchTerm } from '../arabic_morphology'
import { stateView } from '../state_view'
import { captureRouteResourceScope, routeEventListener, routeTimeout } from '../resource_lifecycle'
import { authorLink, bookAuthorLinks, canonicalBookCategory, effectiveBookCategory } from '../taxonomy_links'
import { currentHashQuery, replaceHashQuery } from '../hash_query_state'
import { compareSearchResultsByDeath, groupSearchResultsByBook, numberOrderedSearchResults } from '../search_result_order'
import { shamelaSourceBookId } from '../shamela_public_identity'
import { searchResultsTable, type SearchTableFacet, type SearchTableRow } from '../search_results_table'
import { silentSkeleton } from '../silent_skeleton'
import { sectionServiceHero } from '../section_service_hero'
import { expandedSearchFields, SEARCH_MODE_OPTIONS, SEARCH_PAGE_TITLE, visibleSearchFieldsAfterToggle } from '../search_scope_semantics'
import { setSourceDocumentTitle } from '../translation'
import { orderedBooks } from '../book_ordering'
import { SEARCH_CONTENT_SCOPE_OPTIONS, parseSearchContentScope } from '../search_content_scope_options'
import {searchPagination,updateSearchNextLabel} from '../search_pagination'
import {hasSearchFieldRelease} from '../search_field_release'

type SearchSort = 'death' | 'relevance' | 'chronological' | 'tree'
interface SearchContext { books: Map<string, StoredBook>; globalNumbers: Map<SearchResult, number> }
interface SearchScope { element: HTMLElement; fieldsElement: HTMLElement; values: () => SearchQueryOptions; clear: () => void; hydrate: (books: StoredBook[]) => void; applyFacet:(facet:SearchTableFacet)=>void }

export const SEARCH_PAGE_SIZE = 100
export function nextSearchLoadedCount(loaded: number, available: number, step = SEARCH_PAGE_SIZE): number {
  return Math.min(available, loaded + step)
}

export function searchSentinelNeedsAdvance(rect: Pick<DOMRect, 'top' | 'bottom'>, viewportHeight: number): boolean {
  return rect.top < viewportHeight + 1_000 && rect.bottom > -1_000
}

export function expandedSearchDocumentTitle(query: string): string {
  const normalized = query.trim().replace(/\s+/gu, ' ')
  return normalized ? `${normalized} - الخزانة` : SEARCH_PAGE_TITLE
}

export function searchFacetQueryOptions(current:SearchQueryOptions,facet:SearchTableFacet):SearchQueryOptions{
  if(facet.kind==='author')return{...current,authors:[...new Set([...(current.authors??[]),String(facet.value)])]}
  if(facet.kind==='category')return{...current,categories:[...new Set([...(current.categories??[]),String(facet.value)])]}
  const death=Math.max(1,Math.floor(Number(facet.value)))
  const {deathState:_deathState,...withoutDeathState}=current
  return{...withoutDeathState,deathFrom:death,deathTo:death}
}

// لا نعلن فشل البحث بسبب بطء شبكة المستخدم بعد 15 ثانية فقط. أرشيفات
// الفهرس المجزأة قد تحتاج وقتًا أطول في أول قراءة، ويبقى الإلغاء الفوري
// محفوظًا عند تغيير العبارة عبر activeSearch.abort().
export const SEARCH_UI_DEADLINE_MS = 120_000

export function hasSearchMetadataScope(options:SearchQueryOptions):boolean {
  return Boolean(options.bookIds?.length||options.authors?.length||options.categories?.length||options.deathFrom||options.deathTo||options.deathState)
}
export function searchScopeCountIdentity(options:SearchQueryOptions):string {
  const selection=(values:readonly string[]|undefined)=>[...new Set(values??[])].sort()
  return JSON.stringify([selection(options.bookIds),selection(options.authors),selection(options.categories),options.deathFrom??null,options.deathTo??null,options.deathState??null,options.contentScope??'both',selection(options.fields)])
}

export function searchScreen({previewContentScope=false}:{previewContentScope?:boolean}={}): HTMLElement {
  const resourceScope = captureRouteResourceScope()
  const root = pageContent(
    sectionServiceHero({
      variant: 'search',
      title: SEARCH_PAGE_TITLE,
      description: 'ابحث في نصوص الكتب وعناوينها وفهارسها، ثم افتح النتيجة في موضعها.',
      titleId: 'search-title',
      className: 'search-hero',
    }),
  )
  const form = h('form', { class: 'search-form', role: 'search' })
  const field = h('div', { class: 'search-form__field' }, icon('search', 21))
  const input = h('input', { type: 'search', placeholder: 'اكتب كلمة أو عبارة…', 'aria-label': SEARCH_PAGE_TITLE }) as HTMLInputElement
  const clear = h('button', { class: 'search-form__clear', type: 'button', 'aria-label': 'مسح البحث' }, icon('close', 17))
  clear.hidden = true
  field.append(input, clear)
  const submit = h('button', { class: 'btn btn--primary', type: 'submit' }, 'ابحث')
  const modes = searchModes()
  const scope = searchScope()
  // Temporary preview gate. A supplied content URL still reaches the backend
  // fail-closed boundary; hiding an unfinished control must not widen a query.
  ;(scope.element.querySelector('.search-content-scope') as HTMLElement).hidden=!previewContentScope&&!hasSearchFieldRelease()
  form.append(h('div', { class: 'search-options-row' }, modes.element, scope.fieldsElement), h('div', { class: 'search-form__main' }, field, submit), scope.element)
  root.appendChild(form)

  const results = h('section', { class: 'search-results', 'aria-live': 'polite' })
  results.appendChild(searchWelcome())
  root.appendChild(results)
  let timer: number | undefined
  let request = 0
  let activeSearch: AbortController | undefined
  let activeSignature = ''
  let preparation:AbortController|undefined
  const mayRefreshVisibleResults=()=>canAutoRefreshSearch(Number(results.dataset.resultPage??0),Boolean(document.querySelector('.search-workspace__preview:not([hidden])')))
  const autoRepairAttempts=new Set<string>()
  resourceScope.add(()=>{activeSearch?.abort();preparation?.abort()})
  const readiness = new SearchReadiness()
  let transientRetrySignature = ''
  let transientRetryAttempt = 0
  // لا ننزّل الكتالوج لمجرد فتح البحث. يشترك فتح المرشحات والنطاق المحفوظ
  // في طلب واحد مكتمل؛ لا تتحول بيانات محلية جزئية إلى نطاق موثّق.
  let loadedCatalog:StoredBook[]|undefined
  let catalogTask:Promise<StoredBook[]>|undefined
  let publishCatalog!:(books:StoredBook[])=>void
  const catalogBooks=new Promise<StoredBook[]>(resolve=>{publishCatalog=resolve})
  const catalogStatus=h('p',{class:'search-scope__catalog-status',role:'status'})
  scope.element.append(catalogStatus)
  const ensureCatalog=():Promise<StoredBook[]>=>{
    if(loadedCatalog)return Promise.resolve(loadedCatalog)
    if(catalogTask)return catalogTask
    catalogStatus.textContent='جارٍ تحميل خيارات نطاق البحث…'
    const task=listBooks({requireCompleteCatalog:true}).then(books=>{
      if(resourceScope.disposed)throw new DOMException('Search superseded','AbortError')
      loadedCatalog=books;scope.hydrate(books);catalogStatus.textContent='';publishCatalog(books);return books
    }).catch(error=>{
      if(!resourceScope.disposed){
        const retry=h('button',{type:'button',class:'btn'},'إعادة المحاولة')
        retry.addEventListener('click',()=>{void ensureCatalog().catch(()=>undefined)})
        catalogStatus.replaceChildren(uiTemplateText('search-catalog-failure',{}),retry)
      }
      throw error
    }).finally(()=>{if(catalogTask===task)catalogTask=undefined})
    catalogTask=task;return task
  }
  for(const details of scope.element.querySelectorAll<HTMLDetailsElement>('.search-multi'))
    routeEventListener(details,'toggle',()=>{if(details.open)void ensureCatalog().catch(()=>undefined)},undefined,resourceScope)

  const run = async (preserveVisibleResults = false): Promise<void> => {
    const query = input.value.trim()
    clear.hidden = query.length === 0
    if (query.length < 2) {
      ++request; activeSearch?.abort(); activeSignature = ''; clearSearchResultSummary(scope.element)
      setSourceDocumentTitle(expandedSearchDocumentTitle(''))
      if (query.length) toast('اكتب حرفين على الأقل')
      results.replaceChildren(searchWelcome())
      return
    }
    setSourceDocumentTitle(expandedSearchDocumentTitle(query))
    const mode = modes.value()
    const scopedOptions = scope.values()
    const signature = JSON.stringify([query, mode, scopedOptions])
    // كتابة العبارة ثم النقر على «ابحث» كانت تترك مؤقت الإدخال يعمل؛ وبعد
    // 600ms يبدأ الطلب نفسه ثانيةً ويلغي الأول. وكذلك قد تصل إشارة جاهزية
    // الفهرس أثناء الطلب. لا نسمح لهذه المحفزات بإعادة تشغيل العبارة نفسها.
    if (signature === activeSignature) return
    preparation?.abort();preparation=undefined
    const current = ++request
    activeSearch?.abort()
    activeSearch = new AbortController()
    const controller = activeSearch
    activeSignature = signature
    const readinessVersion = readiness.capture()
    let rendered = false
    replaceHashQuery({ q: query, mode })
    if (!preserveVisibleResults) {
      clearSearchResultSummary(scope.element)
      results.setAttribute('aria-busy', 'true')
      results.replaceChildren(silentSkeleton('cards'))
    }
    try {
      if(hasSearchMetadataScope(scopedOptions))await ensureCatalog()
      if(current!==request||resourceScope.disposed)return
      const effective = await deriveAnalyzedSearchTerm(query, mode)
      const options = { ...scopedOptions, resultLimit: SEARCH_PAGE_SIZE, signal: controller.signal }
      // الفهرس البارد قد يحتاج بضع ثوانٍ لقراءة شظايا التخزين المحلي. لا
      // نحوله إلى فشل واجهة مصطنع قبل أن تتاح له فرصة معقولة للاكتمال.
      const timeout=routeTimeout(()=>controller.abort('search_ui_timeout'),SEARCH_UI_DEADLINE_MS,resourceScope)
      const renderStarted=performance.now(),found=await searchAllBooks(effective,options).finally(()=>window.clearTimeout(timeout));if(location.hostname==='localhost'||location.hostname==='127.0.0.1')console.debug(`search_screen_phase ${JSON.stringify({name:'search-return',ms:Math.round(performance.now()-renderStarted),count:found.length})}`)
      // Missing-book names enrich the coverage warning, not the search result.
      // Keep the repair/catalogue retry visible without blocking ready rows.
      if((found.unavailableBookIds?.length||found.headingIndexMissingBookIds?.length)&&!loadedCatalog)void ensureCatalog().catch(()=>undefined)
      const books=loadedCatalog??[]
      if (current !== request || resourceScope.disposed) return
      const loadMore=async(offset:number,limit:number)=>{const rows=await searchAllBooks(effective,{...options,resultOffset:offset,resultLimit:limit});return (options.fields&&!options.fields.includes('body'))||(options.contentScope&&options.contentScope!=='both')?rows:rows.filter(row=>row.sourceKind==='shamela4.1'||row.publicUpload)}
      results.removeAttribute('aria-busy');renderSearchResults(results, found, query, effective, mode, books, resourceScope,loadMore,scope.element,scope.values,catalogBooks,scope.applyFacet,ensureCatalog,options);if(location.hostname==='localhost'||location.hostname==='127.0.0.1')console.debug(`search_screen_phase ${JSON.stringify({name:'render-complete',ms:Math.round(performance.now()-renderStarted)})}`)
      const missing=[...new Set([...(found.headingIndexMissingBookIds??[]),...(found.unavailableBookIds??[]),...(found.pendingBookIds??[]),...(found.unopenedBookIds??[])])].filter(id=>id!=='local-formats')
      if(found.localIndexFailed||missing.length){
        const repair=h('button',{type:'button',class:'btn'},uiTemplateText(missing.length?'search-repair-missing':'search-repair-local',{})) as HTMLButtonElement
        const status=h('p',{role:'status'}),cancel=h('button',{type:'button',class:'btn',hidden:true},'إيقاف') as HTMLButtonElement
        const panel=h('section',{'aria-label':'استكمال فهرسة البحث'},repair,cancel,status)
        let refreshAction:HTMLElement|undefined
        cancel.addEventListener('click',()=>preparation?.abort())
        const startRepair=async()=>{
          if(resourceScope.disposed||current!==request||preparation)return
          refreshAction?.remove()
          const job=new AbortController();preparation=job;repair.disabled=true;cancel.hidden=false;activeSignature=signature
          const identity=currentLibraryIdentityScope()
          const valid=()=>!resourceScope.disposed&&current===request&&currentLibraryIdentityScope()===identity
          try{
            status.textContent=`جارٍ فهرسة ${missing.length} كتاب تلقائيًا… النتائج المعروضة مؤقتة.`
            const catalog=await ensureCatalog()
            const {prepareSearchBook}=await import('../search_index_repair_runtime')
            const failures=await repairSearchBooks(missing,catalog,{signal:job.signal,identity:currentLibraryIdentityScope,
              prepare:(id,signal)=>prepareSearchBook(id,signal,!!options.fields?.includes('heading')&&!options.fields.includes('body')),
              progress:value=>{if(valid())status.textContent=`جارٍ فهرسة الكتب: ${value.completed} من ${value.total}.`},
            })
            if(!valid()||job.signal.aborted)return
            retryFailedLocalSearchIndex();preparation=undefined;activeSignature=''
            status.textContent=failures.length?`تعذّرت فهرسة ${failures.length} كتاب. يمكنك إعادة المحاولة؛ النتائج ما زالت غير شاملة.`:'اكتملت الفهرسة؛ جارٍ تحديث نتائج البحث تلقائيًا…'
            const refresh=h('button',{type:'button',class:'btn btn--primary'},'تحديث النتائج وإعادة البحث')
            refreshAction=refresh
            refresh.addEventListener('click',()=>{if(valid()){activeSignature='';void run()}})
            panel.append(refresh)
            repair.textContent='إعادة محاولة الفهرسة';repair.hidden=failures.length===0
            if(!failures.length)routeTimeout(()=>{if(valid()&&mayRefreshVisibleResults()){activeSignature='';void run()}},0,resourceScope)
          }catch(error){if(valid())status.textContent=job.signal.aborted?'أُوقفت التهيئة. يمكنك استئنافها.':error instanceof DOMException&&error.name==='AbortError'?'أُوقفت التهيئة لتغيّر الجلسة.':'تعذّرت التهيئة؛ أعد المحاولة.'}
          finally{if(preparation===job){preparation=undefined;activeSignature=''}repair.disabled=false;cancel.hidden=true}
        }
        repair.addEventListener('click',()=>{void startRepair()})
        results.append(panel)
        // Once per query/identity/missing set: readiness events must not create
        // an endless download/retry loop when the source itself lacks a TOC.
        const repairKey=JSON.stringify([currentLibraryIdentityScope(),signature,[...missing].sort()])
        if(missing.length&&!autoRepairAttempts.has(repairKey)){
          autoRepairAttempts.add(repairKey)
          routeTimeout(()=>{if(!resourceScope.disposed&&current===request)void startRepair()},0,resourceScope)
        }
      }
      transientRetrySignature = ''
      transientRetryAttempt = 0
      rendered = true
    } catch (error) {
      if (current !== request || resourceScope.disposed || error instanceof DOMException && error.name === 'AbortError' && controller.signal.aborted && controller.signal.reason!=='search_ui_timeout') return
      const invalidated=isSearchStateInvalidation(error,controller.signal)
      const code=controller.signal.reason==='search_ui_timeout'?'search_ui_timeout':invalidated?'search_state_changed':error instanceof Error?error.message:'search_unknown'
      console.error('library_search_failed', code, error)
      const transient = code === 'search_ui_timeout' || /fetch|unavailable|routing|network/i.test(code) || invalidated
      if (transient && current === request && !resourceScope.disposed && shouldRetrySearchTransient(transientRetrySignature, signature, transientRetryAttempt)) {
        if (transientRetrySignature !== signature) { transientRetrySignature = signature; transientRetryAttempt = 0 }
        const delay = [0, 250, 1_000, 3_000, 5_000][Math.min(transientRetryAttempt, 4)]!
        transientRetryAttempt += 1
        results.setAttribute('aria-busy', 'true')
        if (!preserveVisibleResults) results.replaceChildren(silentSkeleton('cards'))
        // لا نطلب من المستخدم الضغط على «إعادة المحاولة» في خطأ شبكي عابر؛
        // تبقى العبارة والنتائج السابقة، ويتعافى البحث تلقائيًا بتراجع محدود.
        routeTimeout(() => { if (current !== request || resourceScope.disposed) return; activeSignature = ''; void run(true) }, delay, resourceScope)
        return
      }
      results.removeAttribute('aria-busy')
      const failure=stateView({ kind: 'error', title: 'تعذّر البحث الآن', description: code==='search_content_scope_index_unavailable'?'فهرس فصل المتن والحاشية غير جاهز بعد. لم يُنفَّذ بحث أوسع بدل النطاق الذي اخترته.':`بقيت عبارتك كما هي؛ أعد المحاولة. رمز التشخيص: ${code}`, actionLabel: 'إعادة المحاولة', onAction: () => { transientRetryAttempt=0; void run() } })
      if(code!=='search_content_scope_index_unavailable')failure.querySelector('p')?.replaceChildren(uiTemplateText('search-body-diagnostic',{p1:code}))
      if(preserveVisibleResults && results.querySelector('[role="table"]')) results.prepend(failure)
      else results.replaceChildren(failure)
    } finally {
      if (current === request) {
        activeSignature = ''
        if (rendered && readiness.needsRefresh(readinessVersion) && !resourceScope.disposed && mayRefreshVisibleResults()) {
          routeTimeout(() => { if (current === request && !resourceScope.disposed) void run(true) }, 0, resourceScope)
        }
      }
    }
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); window.clearTimeout(timer); timer = undefined; void run() })
  const restartContentSearch=():void=>{
    window.clearTimeout(timer);timer=undefined
    ++request;activeSearch?.abort();activeSignature=''
    clearSearchResultSummary(scope.element)
    if(input.value.trim().length>=2)void run()
  }
  routeEventListener(scope.element.querySelector('.search-content-scope select')!,'change',restartContentSearch,undefined,resourceScope)
  routeEventListener(scope.fieldsElement,'change',restartContentSearch,undefined,resourceScope)
  routeEventListener(scope.element,'change',()=>{const fields=scope.values().fields;if(centralHeadingProvider()&&fields?.includes('heading')&&!fields.includes('body')&&input.value.trim().length>=2)void run()},undefined,resourceScope)
  modes.element.addEventListener('change', () => { window.clearTimeout(timer); timer = undefined; if (input.value.trim().length >= 2) void run() })
  input.addEventListener('input', () => {
    preparation?.abort()
    clear.hidden = input.value.length === 0
    window.clearTimeout(timer)
    if (input.value.trim().length >= 2) timer = routeTimeout(run, 600, resourceScope)
  })
  // اكتمال الفهارس المساندة يثري النتائج الموجودة في الخلفية؛ لا نعيد
  // الواجهة إلى skeleton بعد أن ظهرت أول نتائج الشاملة السريعة.
  const refreshReady = () => { readiness.changed(); if(!preparation&&input.value.trim().length>=2&&mayRefreshVisibleResults())void run(true) }
  routeEventListener(window,'alkhizana:local-search-index-ready',refreshReady,undefined,resourceScope)
  routeEventListener(window,'alkhizana:local-search-index-failed',refreshReady,undefined,resourceScope)
  routeEventListener(window,'alkhizana:search-metadata-ready',refreshReady,undefined,resourceScope)
  clear.addEventListener('click', () => {
    preparation?.abort();preparation=undefined
    ++request; activeSearch?.abort(); activeSignature = ''
    window.clearTimeout(timer); timer = undefined
    clearSearchResultSummary(scope.element)
  })
  clear.addEventListener('click', () => { input.value = ''; clear.hidden = true; scope.clear(); setSourceDocumentTitle(expandedSearchDocumentTitle('')); replaceHashQuery({ q: null, mode: null, book: null, author: null, category: null, books: null, authors: null, categories: null, century: null, from: null, to: null, fields: null, sort: null, content:null }); results.replaceChildren(searchWelcome()); input.focus() })

  const initialParams = currentHashQuery()
  const initial = initialParams.get('q')
  modes.set((initialParams.get('mode') as SearchMode) || 'exact')
  if (initial) { input.value = initial; clear.hidden = false; routeTimeout(run, 100, resourceScope) }
  else routeTimeout(() => input.focus(), 100, resourceScope)
  return root
}

function searchModes(): { element: HTMLElement; value: () => SearchMode; set: (mode: SearchMode) => void } {
  const group = h('fieldset', { class: 'search-modes' })
  group.appendChild(h('legend', null, 'نمط المطابقة'))
  const inputs = new Map<SearchMode, HTMLInputElement>()
  for (const [value, label, title] of SEARCH_MODE_OPTIONS) {
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
  const content=selectControl('نطاق النص',SEARCH_CONTENT_SCOPE_OPTIONS.map(([value,label])=>[value,label]),true)
  content.wrap.classList.add('search-content-scope')
  content.select.value=parseSearchContentScope(params.get('content'))
  content.select.addEventListener('change',()=>replaceHashQuery({content:content.select.value==='both'?null:content.select.value}))
  const book = multiChoice('الكتب', 'صفِّ الكتب…',decodeSelection(params.get('books'),params.get('book')))
  const author = multiChoice('المؤلفون', 'صفِّ المؤلفين…',decodeSelection(params.get('authors'),params.get('author')))
  const category = multiChoice('التصنيفات', 'صفِّ التصنيفات…',decodeSelection(params.get('categories'),params.get('category')))
  const century = h('select', { 'aria-label': 'القرن الهجري' }) as HTMLSelectElement
  const from = h('input', { type: 'number', min: '1', max: '2000', placeholder: 'من سنة هـ', 'aria-label': 'سنة وفاة المؤلف من' }) as HTMLInputElement
  const to = h('input', { type: 'number', min: '1', max: '2000', placeholder: 'إلى سنة هـ', 'aria-label': 'سنة وفاة المؤلف إلى' }) as HTMLInputElement
  const fieldOptions: Array<[SearchField, string]> = [['body', 'المتن'], ['heading', 'شجرة العناوين'], ['tag', 'الوسوم'], ['category', 'التصنيفات'], ['card', 'بطاقات الكتب']]
  const checks = new Map<SearchField, HTMLInputElement>()
  const requestedFields = new Set((params.get('fields') ?? '').split(',').filter(Boolean) as SearchField[])
  const fields = h('fieldset', { class: 'search-scope__fields' }, h('legend', null, 'ابحث داخل'))
  for (const [value, label] of fieldOptions) {
    const input = h('input', { type: 'checkbox', value }) as HTMLInputElement
    input.checked = requestedFields.size ? requestedFields.has(value) : value === 'body'
    checks.set(value, input)
    fields.appendChild(h('label', null, input, h('span', null, label)))
  }
  const syncContentAvailability=():void=>{content.select.disabled=!checks.get('body')!.checked}
  syncContentAvailability()
  fields.addEventListener('change', (event) => {
    const changed = event.target as HTMLInputElement
    const changedField = [...checks].find(([, input]) => input === changed)?.[0]
    if (!changedField) return
    const visible = visibleSearchFieldsAfterToggle([...checks].filter(([, input]) => input.checked && input !== changed).map(([field]) => field), changedField, changed.checked)
    checks.forEach((input, field) => { input.checked = visible.includes(field) })
    syncContentAvailability()
  })
  fields.appendChild(h('small', { class: 'search-scope__fields-note' }, '«المتن» بحث شامل في النص والعناوين والوسوم والبطاقات. اختيار نطاق متخصص يستبعد المتن.'))
  const range = h('label', { class: 'search-scope__range' }, h('span', null, 'وفاة المؤلف بين'), h('span', null, from, to))
  const activeFilters = h('div', { class: 'search-scope__active-filters', 'aria-label': 'المرشحات النشطة', 'aria-live': 'polite' })
  const element = h('section', { class: 'search-scope', 'aria-label': 'تحديد نطاق البحث' },
    h('div', { class: 'search-scope__heading' }, h('div', null, h('h2', null, 'أين تريد أن تبحث؟'), h('p', null, 'اترك النطاق على «الكل» للبحث في الخزانة كاملة.')), content.wrap, h('div',{class:'search-scope__badges'})),
    h('div', { class: 'search-scope__grid' }, book.element, author.element, category.element, labeledSelect('القرن الهجري', century), range),
    activeFilters,
  )
  from.value = params.get('from') ?? ''; to.value = params.get('to') ?? ''
  century.appendChild(h('option', { value: '' }, 'كل القرون والحالات'))
  century.appendChild(h('option', { value: 'pre-hijra' }, 'قبل الهجرة'))
  for (let value = 1; value <= 15; value++) century.appendChild(h('option', { value: String(value) }, uiTemplateText('b6793a9b3ef794ba',{p1:value})))
  century.appendChild(h('option', { value: 'contemporary' }, 'معاصر'))
  const selectedCentury = params.get('century') ?? ''
  if ([...century.options].some(option => option.value === selectedCentury)) century.value = selectedCentury
  if(Number(century.value)&&!from.value&&!to.value){from.value=String((Number(century.value)-1)*100+1);to.value=String(Number(century.value)*100)}
  century.addEventListener('change', () => {
    const value = Number(century.value)
    if (value) { from.value = String((value - 1) * 100 + 1); to.value = String(value * 100) }
    else { from.value = ''; to.value = '' }
  })
  const removeButton = (label: string, remove: () => void, kind?:string): HTMLButtonElement => {
    const button = h('button', { type: 'button', class: 'search-scope__filter-chip', 'aria-label': `إزالة مرشح ${label}`, title: `إزالة مرشح ${label}` }, h('span', null, label), h('span', { 'aria-hidden': 'true' }, '×')) as HTMLButtonElement
    if(kind){const parameters={p1:uiLabelParameter(kind),p2:label};button.firstElementChild!.replaceChildren(uiTemplateText('5efbc567bdc05d6e',parameters));uiTemplateAttribute(button,'aria-label','ff3981e7a096c97a',parameters);uiTemplateAttribute(button,'title','ff3981e7a096c97a',parameters)}
    button.addEventListener('click', () => { remove(); sync(); element.dispatchEvent(new Event('change', { bubbles: false })) })
    return button
  }
  const refreshActiveFilters = (): void => {
    const chips: HTMLButtonElement[] = []
    for (const [value, label] of book.entries()) chips.push(removeButton(label, () => book.remove(value), 'الكتاب'))
    for (const [value, label] of author.entries()) chips.push(removeButton(label, () => author.remove(value), 'المؤلف'))
    for (const [value, label] of category.entries()) chips.push(removeButton(label, () => category.remove(value), 'التصنيف'))
    if (century.value) {
      const label = century.value==='pre-hijra'?'قبل الهجرة':century.value==='contemporary'?'معاصر':`القرن ${century.value} هـ`
      const chip=removeButton(label, () => { century.value = ''; from.value = ''; to.value = '' })
      if(Number(century.value)){const parameters={p1:Number(century.value)};chip.firstElementChild!.replaceChildren(uiTemplateText('b6793a9b3ef794ba',parameters));uiTemplateAttribute(chip,'aria-label','87f42ab24f065a19',parameters);uiTemplateAttribute(chip,'title','87f42ab24f065a19',parameters)}
      chips.push(chip)
    } else {
      if (from.value) chips.push(removeButton(`الوفاة من ${from.value} هـ`, () => { from.value = '' }))
      if (to.value) chips.push(removeButton(`الوفاة إلى ${to.value} هـ`, () => { to.value = '' }))
    }
    activeFilters.replaceChildren(...chips)
    activeFilters.hidden = chips.length === 0
  }
  const sync = (): void => { replaceHashQuery({ books: encodeSelection(book.values()), authors: encodeSelection(author.values()), categories: encodeSelection(category.values()), book: null, author: null, category: null, century: century.value || null, from: from.value || null, to: to.value || null, fields: [...checks].filter(([, input]) => input.checked).map(([key]) => key).join(',') || null }); refreshActiveFilters() }
  element.addEventListener('change', sync); fields.addEventListener('change', sync); element.addEventListener('input', event => { if ((event.target as HTMLElement).matches('input[type="number"]')) sync() })
  refreshActiveFilters()
  return {
    element,
    fieldsElement: fields,
    values: () => ({ contentScope:parseSearchContentScope(content.select.value), ...(book.values().length ? { bookIds: book.values() } : {}), ...(author.values().length ? { authors: author.values() } : {}), ...(category.values().length ? { categories: category.values() } : {}), ...(century.value === 'pre-hijra' || century.value === 'contemporary' ? { deathState: century.value } : {}), ...(Number(from.value) ? { deathFrom: Number(from.value) } : {}), ...(Number(to.value) ? { deathTo: Number(to.value) } : {}), fields: expandedSearchFields([...checks].filter(([, input]) => input.checked).map(([key]) => key)) }),
    clear: () => { book.clear(); author.clear(); category.clear(); century.value = ''; from.value = ''; to.value = ''; checks.forEach((input, key) => { input.checked = key === 'body' }); content.select.value='both';syncContentAvailability();refreshActiveFilters() },
    applyFacet: facet => { if(facet.kind==='author')author.select(String(facet.value));else if(facet.kind==='category')category.select(String(facet.value));else{century.value='';from.value=String(facet.value);to.value=String(facet.value)}sync();element.dispatchEvent(new Event('change',{bubbles:false})) },
    hydrate: books => {
      const authors = [...new Set(books.flatMap(item => item.authors?.length ? item.authors.map(value => value.name) : [item.author]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'))
      const categories = [...new Set(books.map(item => canonicalBookCategory(item.category)).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'ar'))
      book.setOptions(orderedBooks(books).map<[string, string]>(item => [item.id, item.title]))
      author.setOptions(authors.map(value => [value, value]))
      category.setOptions(categories.map(value => [value, value]))
      refreshActiveFilters()
    },
  }
}

interface MultiChoice { element: HTMLElement; values: () => string[]; entries: () => Array<[string, string]>; select:(value:string)=>void; remove: (value: string) => void; clear: () => void; setOptions: (options: Array<[string, string]>) => void }

function multiChoice(label: string, placeholder: string, initial:string[]=[]): MultiChoice {
  const details = h('details', { class: 'search-multi' }) as HTMLDetailsElement
  const allLabel=label==='المؤلفون'?'كل المؤلفين':`كل ${label}`
  const summaryText = h('span', null, allLabel)
  const summary = h('summary', { 'aria-label': label }, summaryText, icon('chevron-left', 15))
  const filter = h('input', { type: 'search', placeholder, 'aria-label': `تصفية ${label}` }) as HTMLInputElement
  const list = h('div', { class: 'search-multi__list', role: 'group', 'aria-label': `اختيار ${label}` })
  const selected = new Set<string>(initial)
  let options: Array<[string, string]> = []
  const updateSummary = (): void => { summaryText.textContent = selected.size ? `${label}: ${selected.size}` : allLabel }
  updateSummary()
  const render = (): void => {
    if (!details.open) { list.replaceChildren(); return }
    const query = normalizeArabic(filter.value)
    const matches = options.filter(([, text]) => !query || normalizeArabic(text).includes(query))
    const visible = matches
      .sort(([a], [b]) => Number(selected.has(b)) - Number(selected.has(a)))
      .slice(0, 60)
    list.replaceChildren(...visible.map(([value, text]) => {
      const input = h('input', { type: 'checkbox', value }) as HTMLInputElement
      input.checked = selected.has(value)
      input.addEventListener('change', () => { input.checked ? selected.add(value) : selected.delete(value); updateSummary(); details.dispatchEvent(new Event('change', { bubbles: true })) })
      return h('label', { class: 'search-multi__option' }, input, h('span', null, text))
    }), ...(matches.length > visible.length ? [h('small', { class: 'search-multi__count' }, `تظهر ${visible.length} من ${matches.length}؛ ضيّق العبارة لبقية الخيارات.`)] : []), ...(matches.length ? [] : [h('p', { class: 'search-multi__empty' }, 'لا توجد مطابقة')]))
  }
  filter.addEventListener('input', render)
  details.addEventListener('toggle', () => { if (details.open) { filter.value = ''; render(); routeTimeout(() => filter.focus(), 0) } })
  details.append(summary, h('div', { class: 'search-multi__panel' }, filter, list))
  return {
    element: h('label', { class: 'search-scope__control' }, h('span', null, label), details),
    values: () => [...selected],
    entries: () => [...selected].map(value=>[value,options.find(([candidate])=>candidate===value)?.[1]??value]),
    select:value=>{selected.add(value);updateSummary();if(details.open)render()},
    remove: value => { selected.delete(value); updateSummary(); if (details.open) render() },
    clear: () => { selected.clear(); updateSummary(); if (details.open) render() },
    setOptions: values => { options = values; updateSummary(); if (details.open) render() },
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

function renderSearchResults(root: HTMLElement, all: SearchResult[] & {localIndexFailed?:boolean;unavailableBookIds?:string[];pendingBookIds?:string[];unopenedBookIds?:string[];headingIndexMissingBookIds?:string[];coverageComplete?:boolean;totalOccurrences?:number;totalDocuments?:number}, query: string, effective: string, mode: SearchMode, storedBooks: StoredBook[], resourceScope = captureRouteResourceScope(),loadMore?: (offset:number,limit:number)=>Promise<SearchResult[]>,scopeElement?:HTMLElement,scopeValues?:()=>SearchQueryOptions,catalogBooks?:Promise<StoredBook[]>,applyFacet?:(facet:SearchTableFacet)=>void,ensureCatalog?:()=>Promise<StoredBook[]>,requestOptions?:SearchQueryOptions): void {
  const requestedScope=scopeValues
  let appliedScope=requestedScope?.()??{}
  const countedScope=searchScopeCountIdentity(requestOptions??appliedScope)
  scopeValues=()=>appliedScope
  const hydrateMissingNames=(target:HTMLElement|null,ids:string[]|undefined,headingMissingCount=0):void=>{
    if(!target||!ids?.length||!catalogBooks)return
    const identity=currentLibraryIdentityScope()
    void catalogBooks.then(loadedBooks=>{
      if(!target.isConnected||resourceScope.disposed||currentLibraryIdentityScope()!==identity)return
      target.replaceChildren(unavailableBooksUiDescription(ids,loadedBooks))
    }).catch(()=>{/* Preserve the incomplete-coverage warning on failure. */})
  }
  if(scopeElement)clearSearchResultSummary(scopeElement)
  if (!all.length) {
    if(all.localIndexFailed||all.unavailableBookIds?.length){
      if(all.pendingBookIds?.length)root.setAttribute('aria-busy','true');else root.removeAttribute('aria-busy')
      const failed=stateView({kind:'error',icon:'search',title:all.localIndexFailed?'تعذّر إكمال البحث في الكتب المضافة':'تعذّر إكمال البحث في بعض الكتب',description:all.localIndexFailed&&!all.unavailableBookIds?.length?'تعذّر تجهيز فهرس الكتب المضافة على هذا الجهاز. أعد البحث لإعادة محاولة التجهيز؛ لم تُحذف كتبك، ولا يمكن الجزم بعدم وجود العبارة.':unavailableBooksDescription(all.unavailableBookIds,storedBooks)})
      root.replaceChildren(failed,...(all.pendingBookIds?.length?[silentSkeleton('cards')]:[]))
      if(all.unavailableBookIds?.length)failed.querySelector('p')?.replaceChildren(unavailableBooksUiDescription(all.unavailableBookIds,storedBooks))
      hydrateMissingNames(failed.querySelector('p'),all.unavailableBookIds)
      return
    }
    if (all.headingIndexMissingBookIds?.length) {
      root.removeAttribute('aria-busy')
      root.replaceChildren(stateView({kind:'error',icon:'search',title:'فهرس عناوين بعض الكتب غير متاح',description:unavailableBooksDescription(all.headingIndexMissingBookIds,storedBooks)}))
      root.querySelector('.state-view p')?.replaceChildren(unavailableBooksUiDescription(all.headingIndexMissingBookIds,storedBooks))
      hydrateMissingNames(root.querySelector('.state-view p'),all.headingIndexMissingBookIds)
      return
    }
    if (all.pendingBookIds?.length) {
      root.setAttribute('aria-busy', 'true')
      root.replaceChildren(silentSkeleton('cards'))
      return
    }
    root.removeAttribute('aria-busy')
    if(all.unopenedBookIds?.length){
      root.replaceChildren(stateView({kind:'no-results',icon:'search',title:'لم تظهر نتائج في الكتب المفهرسة',description:'يشمل البحث الفهرس العام والكتب المحمّلة على هذا الجهاز. افتح الكتب الإضافية لإدراج نصوصها في البحث.'}))
      return
    }
    root.replaceChildren(all.coverageComplete===false?stateView({kind:'error',icon:'search',title:'نتائج البحث غير مكتملة بعد',description:'لم تكتمل أرشيفات الفهرس المنشورة، لذلك لا يمكن الجزم بعدم وجود العبارة. أعد المحاولة بعد اكتمال رفع الفهرس.'}):all.unavailableBookIds?.length?stateView({kind:'error',icon:'search',title:'تعذّر إكمال البحث في بعض الكتب',description:`تعذّر البحث في ${arabicNum(all.unavailableBookIds.length)} كتاب؛ لا يمكن الجزم بعدم وجود نتائج حتى تكتمل الفهارس.`}):stateView({ kind: 'no-results', icon: 'search', title: mode === 'exact' ? 'العبارة غير موجودة' : `لا توجد نتائج لـ «${query}»`, description: mode === 'exact' ? `لم توجد العبارة «${query}» في نطاق البحث المكتمل.` : `لم ينتج النمط المختار مواضع لعبارة «${effective}».` }))
    if(all.coverageComplete!==false&&!all.unavailableBookIds?.length){
      if(mode!=='exact')root.querySelector('.state-view strong')?.replaceChildren(uiTemplateText('search-empty-title',{p1:query}))
      root.querySelector('.state-view p')?.replaceChildren(uiTemplateText(mode==='exact'?'search-empty-exact':'search-empty-pattern',{p1:mode==='exact'?query:effective}))
    }
    return
  }
  root.removeAttribute('aria-busy')
  const books = new Map(storedBooks.map((book) => [book.id, book]))
  const context: SearchContext = { books, globalNumbers: new Map() }
  const counts = new Map<string, { title: string; count: number }>()
  for (const result of all) {
    const entry = counts.get(result.bookId)
    counts.set(result.bookId, { title: result.title, count: (entry?.count ?? 0) + 1 })
  }
  const initialParams = currentHashQuery()
  let sort: SearchSort = (initialParams.get('sort') as SearchSort) || 'death'
  const pageSize=SEARCH_PAGE_SIZE
  // Remote offset counts the initial provider batch, not additional local matches.
  let resultPage=0,viewVersion=0,fetchedOffset=SEARCH_PAGE_SIZE,fetching=false,exhausted=false,loadError=''
  const centralPaged=Boolean(centralHeadingProvider()&&scopeValues?.().fields?.includes('heading')&&!scopeValues?.().fields?.includes('body'))
  const scopedLocalPaged=Boolean(scopeValues?.().fields?.includes('body')&&scopeValues?.().contentScope&&scopeValues?.().contentScope!=='both'&&scopeValues?.().bookIds?.length)
  let activeResults = all

  const controls = h('div', { class: 'search-result-order' })
  const sortSelect = selectControl('الترتيب', [['death', 'وفيات المؤلفين'], ['relevance', 'الأقرب صلة'], ['chronological', 'الأحدث إضافة'], ['tree', 'المؤلف ثم الكتاب']],true)
  sortSelect.select.value = sort
  if(centralPaged){for(const option of sortSelect.select.options)option.replaceChildren(uiTemplateText('search-loaded-sort',{p1:uiLabelParameter(option.textContent??'')}));controls.append(h('p',{class:'page-sub',role:'note'},'ترتيب النتائج المحمّلة فقط؛ ليس ترتيبًا شاملًا لجميع نتائج الفهرس.'))}
  controls.append(sortSelect.wrap)
  const summary=h('p',{class:'search-scope__results-summary'},uiTemplateText('search-summary',{p1:all.totalOccurrences??all.length,p2:all.length,p3:counts.size}))
  const modeBadge=h('span',{class:'search-results__mode'},icon(mode==='exact'?'check':'search',14),mode==='exact'?'مطابقة العبارة':uiTemplateText(mode==='morphological'?'search-mode-affixes':'search-mode-root',{p1:effective}))
  const tools=h('div',{class:'search-scope__results-tools'},controls)
  const heading=scopeElement?.querySelector('.search-scope__heading'),badges=heading?.querySelector('.search-scope__badges')
  if(heading)heading.insertBefore(tools,badges??null)
  badges?.append(modeBadge)

  const viewport = h('div', { class: 'search-paged-results', 'aria-label': 'نتائج البحث', tabindex:-1 })
  const list = h('div', { class: 'search-result-list' })
  const {element:pagination,previous,next,pageStatus,jump}=searchPagination(page=>{void goToPage(page)})
  viewport.append(list,pagination)
  const partial=all.unopenedBookIds?.length?h('p',{class:'search-results__partial',role:'status'},'يشمل البحث الفهرس العام والكتب المحمّلة على هذا الجهاز. افتح الكتب الإضافية لإدراج نصوصها في البحث.'):all.headingIndexMissingBookIds?.length?h('p',{class:'search-results__partial',role:'status'},`نتائج جزئية: شجرة العناوين غير متاحة في فهرس البحث لـ ${arabicNum(all.headingIndexMissingBookIds.length)} كتاب. لا يمثل العدد جميع عناوين المكتبة.`):all.unavailableBookIds?.length?h('p',{class:'search-results__partial',role:'status'},`نتائج جزئية: تعذّر البحث في ${arabicNum(all.unavailableBookIds.length)} كتاب، وما يظهر أدناه من الكتب التي اكتمل فهرسها.`):all.pendingBookIds?.length?h('p',{class:'search-results__partial',role:'status'},pendingSearchDescription(all.pendingBookIds,arabicNum)):all.coverageComplete===false?h('p',{class:'search-results__partial',role:'status'},'نتائج جزئية من أرشيفات الفهرس المكتملة؛ قد تظهر نتائج أخرى بعد اكتمال الرفع.'):null
  scopeElement?.querySelector('.search-scope__results-footer')?.remove()
  if(partial&&all.unavailableBookIds?.length&&!all.headingIndexMissingBookIds?.length)partial.replaceChildren(unavailableBooksUiDescription(all.unavailableBookIds,storedBooks))
  if(partial&&all.headingIndexMissingBookIds?.length)partial.replaceChildren(unavailableBooksUiDescription(all.headingIndexMissingBookIds,storedBooks))
  hydrateMissingNames(partial,all.headingIndexMissingBookIds?.length?all.headingIndexMissingBookIds:all.unavailableBookIds,
    all.headingIndexMissingBookIds?.length??0)
  if(all.localIndexFailed&&partial&&!all.unavailableBookIds?.length&&!all.pendingBookIds?.length&&!all.headingIndexMissingBookIds?.length)partial.textContent='نتائج جزئية: تعذّر إكمال البحث في الكتب المضافة. لا يمكن الجزم بعدم وجود العبارة في الكتب التي لم يكتمل البحث فيها.'
  scopeElement?.append(h('div',{class:'search-scope__results-footer'},summary,...(partial?[partial]:[])))
  root.replaceChildren(viewport)
  let renderedStart=-1,renderedEnd=-1

  const filtered = (): SearchResult[] => {
    const options=scopeValues?.()??{},values = all.filter(result=>searchResultMatchesScope(result,books.get(result.bookId),options))
    if (sort === 'death') return values.sort(compareSearchResultsByDeath)
    if (sort === 'chronological') return groupSearchResultsByBook(values, (a, b) => (books.get(b.bookId)?.addedAt ?? 0) - (books.get(a.bookId)?.addedAt ?? 0))
    if (sort === 'tree') return groupSearchResultsByBook(values, (a, b) => `${a.author}\0${a.title}`.localeCompare(`${b.author}\0${b.title}`, 'ar'))
    const firstRelevantBook = new Map<string, number>()
    values.forEach((result, index) => { if (!firstRelevantBook.has(result.bookId)) firstRelevantBook.set(result.bookId, index) })
    return groupSearchResultsByBook(values, (a, b) => (firstRelevantBook.get(a.bookId) ?? 0) - (firstRelevantBook.get(b.bookId) ?? 0))
  }
  const filterIsActive=():boolean=>Boolean((scopeValues?.().bookIds?.length)||(scopeValues?.().authors?.length)||(scopeValues?.().categories?.length)||scopeValues?.().deathFrom||scopeValues?.().deathTo||scopeValues?.().deathState)
  const updateSummary=():void=>{
    if(centralPaged){summary.replaceChildren(uiTemplateText('search-loaded-summary',{p1:all.totalOccurrences??all.length,p2:all.length}))}
    else if(scopedLocalPaged&&all.totalOccurrences!==undefined&&searchScopeCountIdentity(appliedScope)===countedScope&&searchScopeCountIdentity(requestedScope?.()??appliedScope)===countedScope){summary.replaceChildren(uiTemplateText('search-scoped-summary',{p1:all.totalOccurrences,p2:''}),...(all.coverageComplete===false?[uiTemplateText('search-available-coverage',{})]:[]))}
    else if(filterIsActive()||scopedLocalPaged){const occurrences=activeResults.reduce((sum,result)=>sum+(result.occurrenceCount??1),0),bookCount=new Set(activeResults.map(result=>result.bookId)).size;summary.replaceChildren(uiTemplateText('search-filtered-summary',{p1:occurrences,p2:bookCount,p3:''}),...(scopedLocalPaged?[uiTemplateText('search-loaded-only',{})]:[]))}
    else summary.replaceChildren(uiTemplateText('search-summary',{p1:all.totalOccurrences??all.length,p2:all.length,p3:counts.size}))
  }
  const renderWindow = (): void => {
    if (!viewport.isConnected||resourceScope.disposed) return
    resultPage=Math.max(0,Math.min(resultPage,Math.ceil(activeResults.length/pageSize)-1))
    root.dataset.resultPage=String(resultPage)
    const range={start:resultPage*pageSize,end:Math.min(activeResults.length,(resultPage+1)*pageSize)}
if(range.start!==renderedStart||range.end!==renderedEnd){const rows:SearchTableRow[]=activeResults.slice(range.start,range.end).map(result=>{const stored=books.get(result.bookId),categoryName=stored?effectiveBookCategory(stored):canonicalBookCategory(result.category);return{key:searchResultIdentity(result),ordinal:context.globalNumbers.get(result)??0,bookId:result.bookId,...((result.pageIndex??result.paraIndex)>=0?{pageIndex:result.pageIndex??result.paraIndex}:{}),bookTitle:result.title,authorName:result.author,...(result.deathYearHijri!=null?{deathYearHijri:result.deathYearHijri}:{}),...(categoryName?{categoryName}:{}),snippet:result.snippet,fullText:result.matchText,...(result.sectionHeading?{sectionHeading:result.sectionHeading}:{}),...(result.partLabel?{partLabel:result.partLabel}:{}),...(result.pageLabel?{pageLabel:result.pageLabel}:{}),href:searchResultHref(result),...(result.occurrenceCount?{occurrenceCount:result.occurrenceCount}:{})}});list.replaceChildren(searchResultsTable(rows,effective,applyFacet));renderedStart=range.start;renderedEnd=range.end}
    // التصفية محلية؛ جلب دفعة إضافية لا يبدأ إلا بالنقر على التالي.
    const moreRemote=Boolean(loadMore)&&!exhausted&&fetchedOffset<(all.totalDocuments??all.totalOccurrences??all.length)
    const hasNext=range.end<activeResults.length||moreRemote
    updateSummary()
    pageStatus.replaceChildren(loadError?uiTemplateText('search-next-failed',{}):fetching?uiTemplateText('search-next-loading',{}):uiTemplateText(hasNext?'search-pagination-range':'search-pagination-end',{p1:activeResults.length?range.start+1:0,p2:range.end}))
    pagination.toggleAttribute('aria-busy',fetching)
    previous.disabled=resultPage===0||fetching;next.disabled=!hasNext||fetching
    jump.update(resultPage,Math.ceil((exhausted?activeResults.length:Math.max(activeResults.length,all.totalDocuments??all.totalOccurrences??0))/pageSize),fetching)
    updateSearchNextLabel(next,Boolean(loadError))
  }
  const reset = (preservePage=false): void => {
    viewVersion++;activeResults = filtered();if(!preservePage)resultPage=0;loadError=''
    context.globalNumbers = numberOrderedSearchResults(activeResults);renderedStart=-1;renderedEnd=-1
    renderWindow()
  }
  sortSelect.select.addEventListener('change', () => { sort = sortSelect.select.value as SearchSort; replaceHashQuery({ sort: sort === 'death' ? null : sort }); reset() })

  // Never replace rows or guess their height on scroll. Mobile cards have natural,
  // variable heights; a bounded explicit page avoids the old scroll/clamp feedback loop.
  const focusPage=()=>{if(!viewport.isConnected||resourceScope.disposed)return;viewport.focus({preventScroll:true});viewport.scrollIntoView({block:'start',behavior:'instant'})}
  previous.onclick=()=>{if(fetching||resultPage===0)return;resultPage--;loadError='';renderWindow();focusPage()}
  const advance=async():Promise<void>=>{
    if(resourceScope.disposed||!viewport.isConnected||fetching)return
    const target=resultPage+1,more=()=>Boolean(loadMore)&&!exhausted&&fetchedOffset<(all.totalDocuments??all.totalOccurrences??all.length)
    if(searchPageReady(target,pageSize,activeResults.length,more())){resultPage=target;loadError='';renderWindow();focusPage();return}
    if(!more())return
    // Fetch only the next visible page. Prefetching five pages made one click
    // wait for many unrelated row ranges and magnified transient failures.
    fetching=true;loadError='';renderWindow();const fetchedLimit=pageSize,version=viewVersion;let moved=false
    await completeSearchPage(target,pageSize,()=>({loaded:activeResults.length,more:more(),current:version===viewVersion&&!resourceScope.disposed&&viewport.isConnected}),async()=>{
      const requestedOffset=fetchedOffset
      const batch=await loadMore!(requestedOffset,fetchedLimit)
      fetchedOffset=requestedOffset+fetchedLimit
      if(resourceScope.disposed||!viewport.isConnected)return
      const byKey=new Map(all.map(row=>[searchResultIdentity(row),row]))
      for(const row of batch){const key=searchResultIdentity(row),existing=byKey.get(key);if(existing){if(row.field==='body')existing.occurrenceCount=(existing.occurrenceCount??1)+(row.occurrenceCount??1)}else{all.push(row);byKey.set(key,row)}}
      if(batch.length===0)exhausted=true
      const values=filtered(),known=new Set(activeResults.map(searchResultIdentity))
      // Keep pages already read stable when the next server batch sorts before them.
      activeResults=version===viewVersion?[...activeResults,...values.filter(row=>!known.has(searchResultIdentity(row)))]:values
      context.globalNumbers=numberOrderedSearchResults(activeResults);renderedStart=-1;renderedEnd=-1
    }).then(ready=>{if(ready){resultPage=target;moved=true}}).catch(()=>{if(version===viewVersion)loadError='تعذّر تحميل النتائج التالية؛ النتائج الحالية محفوظة.'}).finally(()=>{fetching=false;if(resourceScope.disposed||!viewport.isConnected)return;renderWindow();if(moved)focusPage()})
  }
  const goToPage=async(target:number):Promise<void>=>{
    if(fetching||resourceScope.disposed)return
    const more=Boolean(loadMore)&&!exhausted&&fetchedOffset<(all.totalDocuments??all.totalOccurrences??all.length)
    if(searchPageReady(target,pageSize,activeResults.length,more)){resultPage=target;renderWindow();focusPage();return}
    const version=viewVersion
    if(centralPaged&&!filterIsActive()&&target>resultPage+1&&loadMore){
      fetching=true;loadError='';renderWindow();let moved=false
      try{
        while(version===viewVersion&&!resourceScope.disposed&&viewport.isConnected){
          const total=all.totalDocuments??all.totalOccurrences??all.length
          if(searchPageReady(target,pageSize,activeResults.length,!exhausted&&fetchedOffset<total)||exhausted||fetchedOffset>=total)break
          const offsets:number[]=[],windowSize=Math.min(3,Math.max(1,Math.ceil(((target+1)*pageSize-activeResults.length)/pageSize)))
          for(let offset=fetchedOffset;offset<total&&offsets.length<windowSize;offset+=pageSize)offsets.push(offset)
          if(!offsets.length)break
          const byKey=new Map(all.map(row=>[searchResultIdentity(row),row]))
          await fetchOrderedSearchWindow(offsets,offset=>loadMore(offset,pageSize),(offset,batch)=>{
            if(version!==viewVersion||resourceScope.disposed||!viewport.isConnected)return
            if(exhausted)return
            fetchedOffset=offset+pageSize
            if(!batch.length){exhausted=true;return}
            for(const row of batch){const key=searchResultIdentity(row),existing=byKey.get(key);if(existing){if(row.field==='body')existing.occurrenceCount=(existing.occurrenceCount??1)+(row.occurrenceCount??1)}else{all.push(row);byKey.set(key,row)}}
          })
          if(version!==viewVersion||resourceScope.disposed||!viewport.isConnected)break
          const values=filtered(),known=new Set(activeResults.map(searchResultIdentity))
          activeResults=[...activeResults,...values.filter(row=>!known.has(searchResultIdentity(row)))]
          context.globalNumbers=numberOrderedSearchResults(activeResults);renderedStart=-1;renderedEnd=-1
        }
        const remaining=Boolean(loadMore)&&!exhausted&&fetchedOffset<(all.totalDocuments??all.totalOccurrences??all.length)
        if(version===viewVersion&&searchPageReady(target,pageSize,activeResults.length,remaining)){resultPage=target;moved=true}
      }catch{if(version===viewVersion)loadError='تعذّر تحميل النتائج التالية؛ النتائج الحالية محفوظة.'}
      finally{fetching=false;if(!resourceScope.disposed&&viewport.isConnected){renderWindow();if(moved)focusPage()}}
      return
    }
    // Cache intermediate batches so returning to an earlier page never loses
    // rows. Stop on failure/disposal; do not silently present a partial jump.
    while(resultPage<target&&!resourceScope.disposed&&version===viewVersion){
      const before=resultPage
      await advance()
      if(resultPage===before)break
    }
  }
  next.onclick=()=>{void advance()}
  if(scopeElement){const version=String(Date.now()+Math.random());scopeElement.dataset.searchFilterVersion=version
    let filterGeneration=0
    const applyLocalFilter=(event:Event):void=>{
      if(scopeElement.dataset.searchFilterVersion!==version||(event.target as HTMLElement).closest('.search-scope__results-tools, .search-content-scope'))return
      const generation=++filterGeneration,next=requestedScope?.()??{}
      void (async()=>{
        try{
          if(hasSearchMetadataScope(next)&&ensureCatalog){const loaded=await ensureCatalog();if(resourceScope.disposed)return;for(const book of loaded)books.set(book.id,book)}
          if(generation!==filterGeneration||resourceScope.disposed||!root.isConnected||scopeElement.dataset.searchFilterVersion!==version)return
          appliedScope=next;reset()
        }catch{/* Keep the previous result set; the catalog control reports failure, never a false zero. */}
      })()
    }
    const applyLocalRangeFilter=(event:Event):void=>{if((event.target as HTMLElement).matches('input[type="number"]'))applyLocalFilter(event)}
    scopeElement.addEventListener('change',applyLocalFilter);scopeElement.addEventListener('input',applyLocalRangeFilter)
    resourceScope.add(()=>{scopeElement.removeEventListener('change',applyLocalFilter);scopeElement.removeEventListener('input',applyLocalRangeFilter)})
  }
  reset()
  // قد تصل أول صفحة النص قبل كتالوج 8k كتاب. عند اكتمال الكتالوج نحدّث
  // metadata ونطبق المرشح الحالي محليًا؛ لا يُستدعى loadMore ولا searchAllBooks.
  if(catalogBooks)void catalogBooks.then(loadedBooks=>{
    if(!viewport.isConnected||resourceScope.disposed)return
    for(const book of loadedBooks)books.set(book.id,book)
    reset(true)
  }).catch(()=>{/* تبقى نتائج النص صالحة ويظهر تنبيه التغطية الجزئية */})
}

export function searchResultMatchesScope(result:SearchResult,book:StoredBook|undefined,options:SearchQueryOptions):boolean{
  if(options.bookIds?.length&&!options.bookIds.includes(result.bookId))return false
  const authors=result.authors?.length?result.authors:[result.author]
  if(options.authors?.length&&!options.authors.some(author=>authors.includes(author)))return false
  const category=book?effectiveBookCategory(book):canonicalBookCategory(result.category)
  if(options.categories?.length&&(!category||!options.categories.map(canonicalBookCategory).includes(category)))return false
  const contemporary=result.contemporary??book?.contemporary??false,death=result.deathYearHijri??book?.deathYearHijri
  if(options.deathState==='contemporary'&&!contemporary)return false
  if(options.deathState==='pre-hijra'&&(contemporary||(death??0)>=1))return false
  if(options.deathFrom&&(contemporary||(death??0)<options.deathFrom))return false
  if(options.deathTo&&(contemporary||(death??Number.POSITIVE_INFINITY)>options.deathTo))return false
  return true
}

function selectControl(label: string, options: string[][],hideVisibleLabel=false): { wrap: HTMLElement; select: HTMLSelectElement } {
  const select = h('select', { 'aria-label': label }) as HTMLSelectElement
  for (const option of options) select.appendChild(h('option', { value: option[0] ?? '' }, option[1] ?? ''))
  return { select, wrap: h('label', { class: 'search-select' }, ...(hideVisibleLabel ? [] : [h('span', null, label)]), select) }
}

function resultCard(result: SearchResult, query: string, context: SearchContext): HTMLElement {
  const book = context.books.get(result.bookId)
  const page = pageForParagraph(book?.wordPageMap, result.paraIndex)
  const globalNumber = context.globalNumbers.get(result) ?? 0
  const href = searchResultHref(result)
  const card = h('article', { class: 'search-result-card search-result-table__row', role:'row', tabindex:0, 'aria-label': `النتيجة ${globalNumber}` })
  const number = h('span', { class: 'search-result-card__number', title: 'الترقيم العام للنتيجة' }, arabicNum(globalNumber))
  const link = h('a', { class: 'search-result-card__book', href, target: '_blank', rel: 'noopener', title: 'فتح موضع المطابقة في تبويب مستقل' }, icon('book', 18), h('span', { dataset: { noTranslate: '' } }, result.title), icon('chevron-left', 16))
  const snippet = h('p', { class: 'search-result-card__snippet' }), snippetText = h('span', { dataset: { noTranslate: '' } })
  appendHighlighted(snippetText, result.snippet, query);snippet.append(snippetText);if((result.occurrenceCount??1)>1)snippet.append(h('small',{class:'search-result-table__occurrences'},` · تكررت ${arabicNum(result.occurrenceCount!)} مرات في هذه الفقرة`))
  const meta = [
    result.field === 'heading' ? 'من شجرة العناوين' : result.field === 'tag' ? 'من الوسوم' : result.field === 'category' ? 'من التصنيف' : result.field === 'card' ? 'من بطاقة الكتاب' : 'من متن الكتاب',
    result.contemporary ? 'مؤلف معاصر' : result.deathYearHijri ? `توفي سنة ${arabicNum(result.deathYearHijri)} هـ` : 'سنة الوفاة غير مدونة',
    ...(result.category ? [result.category] : []),
    ...(result.tags.length ? [result.tags.slice(0, 3).map(tag => `#${tag}`).join(' ')] : []),
    page ? `الصفحة ${arabicNum(page)}` : result.paraIndex >= 0 ? `الفقرة ${arabicNum(result.paraIndex + 1)}` : 'بيانات الكتاب',
  ]
  const storedBook = context.books.get(result.bookId)
  const authorCell=h('span',{class:'search-result-table__author',role:'cell'},storedBook ? bookAuthorLinks(storedBook) : authorLink(result.author),result.deathYearHijri?` (وفاته ${arabicNum(result.deathYearHijri)} هـ)`:'')
  const heading=result.field==='heading'?'من شجرة العناوين':'—',pageText=page?arabicNum(page):result.paraIndex>=0?arabicNum(result.paraIndex+1):'—'
  number.setAttribute('role','cell');link.setAttribute('role','cell');snippet.setAttribute('role','cell')
  card.append(number,link,authorCell,snippet,h('span',{role:'cell'},heading),h('span',{role:'cell'},pageText),h('div',{class:'search-result-card__meta',dataset:{noTranslate:''}},...meta.slice(2).map(value=>h('span',null,value))))
  return card
}

export function searchResultHref(result: Pick<SearchResult,'bookId'|'paraIndex'|'pageIndex'|'volumeIndex'>):string {return `#/reader/${result.bookId}${result.pageIndex!==undefined?`?pageIndex=${result.pageIndex}`:result.paraIndex<0?'':shamelaSourceBookId(result.bookId)?`?pageIndex=${result.paraIndex}`:`?para=${result.paraIndex}${result.volumeIndex===undefined?'':`&volumeIndex=${result.volumeIndex}`}`}`}

function appendHighlighted(target: HTMLElement, text: string, query: string): void {
  const folded = foldWithMap(text)
  const wanted = foldWithMap(query).value
  const index = folded.value.indexOf(wanted)
  const clean = cleanSearchText(text).text
  if (clean !== text) { appendHighlighted(target, clean, query); return }
  if (index < 0 || !wanted) { appendSearchText(target, text); return }
  const start = folded.map[index] ?? 0
  const end = (folded.map[index + wanted.length - 1] ?? start) + 1
  appendSearchText(target, text, start, end)
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
