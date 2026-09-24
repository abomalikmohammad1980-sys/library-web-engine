/** شاشة المكتبة — عرض الكتب المحفوظة مع حذف */
import {publishedBookControls} from '../published_book_controls'
import {collectionDownloadButton} from '../collection_download_button'
import {downloadAttachmentPanel,attachmentAuthorKey} from '../download_attachment_panel'
import {publishedGridSelection} from '../published_grid_selection'
import {privateBookPublishButton} from '../private_book_publish'
import {independentPdfPanel} from '../independent_pdf_panel'
import {updateAccountBook,accountErrorArabic} from '../account_service'
import {accountBulkMetadata} from '../account_book_bulk'

import { h, toast } from '../ui'
import {uiTemplateText,uiTemplateAttribute,uiLabelParameter,renderBoundUiTemplate} from '../ui_template_binding'
import {bindAuthorDisplayName,currentAuthorName} from '../author_display_names'
import { bindBookDisplayTitle } from '../book_locale_display'
import { shareBiography,biographyShareUrl } from '../biography_share'
import {localAuthorOverrideId} from '../local_author_override_id'
import {setSourceDocumentTitle} from '../translation'
import {biographyFields,mergeBiographyFields,biographyDateLabel} from '../author_structured_fields'
import { authorPlaceMapWidget, authorPlaceSatelliteUrl, resolveAuthorPlaceMap } from '../author_place_map'
import { attachAuthorOverride } from '../author_override_panel'
import { loadAuthorOverride, type AuthorOverrideBaseline } from '../author_override_client'
import {loadCurrentPeopleFacetRecords} from '../people_facet_overrides'
import {watchPeopleFacetRefresh} from '../people_facet_refresh'
import { isCentralAuthorId } from '../central_author_client'
import { centralAuthorPage,centralAuthorForm } from '../central_author_panel'
import { canEditCentralAuthors,loadCentralAuthors,saveCentralAuthor } from '../central_author_client'
import {unifiedAuthorForm} from '../unified_author_form'
import { icon, type IconName } from '../icons'
import { listBooks, getBook, listAuthorRecords, getAuthorRecord, mergeAuthors, saveAuthor, updateAuthor, deleteBook, downloadBytes, updateBookMetadata, restoreBookMetadata, snapshotBookMetadata, replaceBookWord, replaceBookCover, readPrivateLibrarySnapshot, savePrivateLibrarySnapshot, currentLibraryIdentityScope, type StoredBook, type StoredAuthor, type BookMetadataUpdate, type BookMetadataSnapshot } from '../engine/library_store'
import { convertStoredBookToPdf, needsPdfRefresh } from '../engine/word_pdf'
import { getRuntimeCapabilities } from '../runtime_capabilities'
import { sectionHeader, pageContent } from '../components'
import { SUBJECT_CATEGORY_NAMES as BOOK_CATEGORIES } from '../subject_categories'
import { approximateGregorianYear,isWordFile } from '../library_file_identity'
import { bookCover, deterministicCoverHue } from '../book_cover'
import { authorHref, authorLink, categoryLink, effectiveBookCategory, matchesCategoryFilter, UNCATEGORIZED_CATEGORY } from '../taxonomy_links'
import { ensureShamelaCatalogImported } from '../shamela_catalog'
import { mountStateView, stateView } from '../state_view'
import { displayableAuthorDeathYear, filterAuthorEntries, isUnknownAuthorDeathYear, nextAuthorVisibleCount, normalizeArabicAuthorName, sortAuthorDirectoryEntries, type AuthorDirectorySort } from '../author_filter'
import { hasAuthorRelations, parseAuthorRelationNames, relationNamesText } from '../author_relations'
import { auditAuthorRelations, type AuditedAuthorRelation } from '../author_relation_graph'
import { authorPortraitUpdate, validateAuthorPortrait } from '../author_portrait_update'
import { groupAuthorWorksByCategory, mergeAuthorWorkBooks } from '../author_work_groups'
import { currentHashQuery, replaceHashQuery } from '../hash_query_state'
import { libraryCatalogCsv, parseLibraryCatalogCsv } from '../library_catalog_csv'
import { downloadArtifact } from '../artifact_download'
import { makeProgrammaticFileInput } from '../programmatic_file_input'
import { libraryBookActionLabel, libraryBookTitleId } from '../library_card_accessibility'
import { resolveUiLabel } from '../ui_dictionary_loader'
import { formatLabel, inferBookFormat, type BookFormat } from '../book_format'
import { localOriginalAsset } from '../library_card_state'
import { createBookIssueReportButton } from '../book_issue_report'
import { pdfButtonAction } from '../pdf_button_policy'
import { managedBookLock } from '../managed_book_lock'
import { captureRouteResourceScope, createTrackedObjectURL, revokeTrackedObjectURL, routeAnimationFrame, routeEventListener, routeObserver } from '../resource_lifecycle'
import { listShelves, captureShelfStore } from '../shelf_store'
import { reconcileBulkSelection, bulkDeleteBooks, bulkSelectableIds, bulkShelfUpdate } from '../library_bulk'
import { getReadingActivity } from '../activity_store'
import { resolveShamelaAuthor, type ShamelaAuthorIndexEntry } from '../shamela_author_index'
import { loadAuthorPersonBundle, authorPersonPresentationContext } from '../author_person_model'
import { withShamelaBiography } from '../shamela_biography'
import { loadShamelaAuthorMetadata } from '../shamela_author_metadata'
import { authorEntityKind, biographyContentBlocks, biographyDisplayName, biographyForPresentation, biographyFullNameAddsInformation, biographyParagraphs, booksLinkedToPeople, fallbackPeopleEntryFromBooks, filterTarajmFacetRecords, hijriAge, internalRelationPeopleHref, loadLocalTarajmBiography, loadLocalTarajmFacetRecords, localAuthorIdFromPeopleId, localPeopleHref, localStructuredBiography, mergeStructuredBiography, normalizePeopleFacet, peopleFacetHref, peopleHref, peopleIdFromShamelaId, readTarajmBiographyCache, resolvePeopleEntry, shamelaIdFromPeopleId, type BiographyRelation, type PeopleFacetKind, type StructuredBiography } from '../author_people'
import { attachLiveSearch } from '../live_search'
import { bookOrdinal, orderedBooks, sortBooks, compareBooks, BOOK_SORT_OPTIONS, parseBookSort, type BookSort } from '../book_ordering'
import {availableAuthorChronology as booksWithAuthorChronology} from '../book_ordering_chronology'
import { INVALID_LIBRARY_CATEGORY, libraryCategoryRoute } from '../library_category_route'
import { silentSkeleton } from '../silent_skeleton'
import { createPeopleLoadGate } from '../people_load_gate'
import { sectionServiceHero } from '../section_service_hero'
import {localAccountSourceIds,mergePrivateAccountBooks,accountBookStatus} from '../private_account_merge'
import {currentAccountClaims} from '../account_authority'
import {listAccountBooksPage,type AccountBookSubmission} from '../account_service'
import {accountBookActions} from '../account_book_actions'
import { peopleFacetDirectory } from '../people_facet_directory'
import { createLibraryAdminEntry } from '../library_admin_entry'

export function libraryScreen(): HTMLElement {
  const routeScope=captureRouteResourceScope()
  const adminEntry=createLibraryAdminEntry()
  const refreshAdminEntry=adminEntry.refresh
  routeEventListener(window,'alkhizana:account-changed',refreshAdminEntry,undefined,routeScope)
  const query = currentHashQuery()
  const categoryRoute = libraryCategoryRoute(query)
  const importIntent = query.get('import')
  // المسار الافتراضي لإضافات المستخدم فقط. روابط أقسام المكتبة العامة
  // القادمة من الرئيسية تحتفظ بشبكتها المستقلة عبر category.
  const libraryBooks = categoryRoute.requested ? booksSection(categoryRoute) : null
  const standardSections = categoryRoute.requested ? [] : (() => {
    const management = integratedManagementSection()
    const shelves = libraryShelvesPreview()
    const importer = h('section',{'aria-label':'إضافة الكتب'})
    const loadImporter=()=>{
      importer.replaceChildren(silentSkeleton('cards'))
      void import('../book_import').then(({bookImportManager})=>{
        routeAnimationFrame(()=>{
          if(routeScope.disposed||!importer.isConnected)return
          const manager=bookImportManager(()=>window.dispatchEvent(new Event('library-changed')))
          importer.replaceChildren(manager)
          if(importIntent==='book'||importIntent==='folder'){
            manager.scrollIntoView({block:'center'})
            manager.querySelector<HTMLButtonElement>(importIntent==='folder'?'.import-manager__folder':'.import-manager__primary')?.focus()
          }
        },routeScope)
      }).catch(()=>{if(!routeScope.disposed&&importer.isConnected)importer.replaceChildren(stateView({kind:'error',title:'تعذّر تحميل أدوات الإضافة',description:'أعد المحاولة لفتح أدوات إضافة الكتب.',actionLabel:'إعادة المحاولة',onAction:loadImporter}))})
    }
    loadImporter()
    return [
      importer,
      shelves,
      management,
    ]
  })()
  const page = pageContent(
    sectionServiceHero({
      title: 'إدارة المكتبة',
      description: 'تصفح جميع أقسام الخزانة، وأضف كتبك الخاصة، وعدل عليها، ورتب رفوفك، وحمل ما تشاء بكافة الصيغ المقروءة',
      titleId: 'library-title',
      className: 'library-hero',
      variant: 'library',
    }),
    adminEntry.element,
    ...(libraryBooks ? [libraryBooks.filters] : []),
    ...standardSections,
    ...(libraryBooks ? [libraryBooks.books] : []),
  )
  page.classList.add('library-page')
  return page
}

function libraryShelvesPreview(): HTMLElement {
  const scope = captureRouteResourceScope()
  const host = h('section', { class: 'library-shelves-preview', 'aria-labelledby': 'library-shelves-title' }, silentSkeleton('cards'))
  const renderShelves = (books: StoredBook[]): void => {
    const shelves = listShelves()
    const byId = new Map(books.map(book => [book.id, book]))
    const counts = getReadingActivity().openCounts
    const ranked = shelves.map(shelf => ({ shelf, score: shelf.bookIds.reduce((sum, id) => sum + (counts[id] ?? 0), 0) }))
      .sort((a, b) => b.score - a.score || b.shelf.bookIds.length - a.shelf.bookIds.length || a.shelf.createdAt - b.shelf.createdAt)
      .slice(0, 3)
    const cards = ranked.map(({ shelf }) => {
      const shelfBooks = orderedBooks(shelf.bookIds.map(id => byId.get(id)).filter((book): book is StoredBook => Boolean(book)))
      const link=h('a', { class: 'library-shelf-preview', href: `#/shelves?shelf=${encodeURIComponent(shelf.id)}` },
        h('div', { class: 'library-shelf-preview__covers', 'aria-hidden': 'true' }, ...shelfBooks.slice(0, 3).map(book => bookCover(book, 'library-shelf-preview__cover'))),
        h('strong', shelf.system?null:{dataset:{noTranslate:''}}, shelf.name),
        h('span', null, uiTemplateText('bd92467903830d1a',{p1:shelf.bookIds.length})),
      )
      uiTemplateAttribute(link,'aria-label','c696d9b15518185f',{p1:shelf.system?uiLabelParameter(shelf.name):shelf.name})
      return link
    })
    host.replaceChildren(
      h('header', { class: 'section-header' }, h('h2', { id: 'library-shelves-title' }, h('a',{href:'#/shelves'},'رفوفي'))),
      h('div', { class: 'library-shelves-preview__grid' }, ...cards, ...(cards.length ? [] : [h('a', { class: 'library-shelf-preview library-shelf-preview--empty', href: '#/shelves' }, icon('plus', 20), h('strong', null, 'أنشئ رفك الأول'), h('span', null, 'واجمع فيه الكتب التي تريد العودة إليها'))])),
    )
  }
  const renderSnapshot = (): void => {
    try {
      const cached = readPrivateLibrarySnapshot()
      if (cached.length || listShelves().length) renderShelves(cached.map(book => ({
        ...book,
        data: new Uint8Array(),
        mimeType: '',
        fileName: book.fileName || '',
        fileSize: book.fileSize || 0,
        addedAt: book.addedAt || 0,
        originalSha256: '',
        pdfStatus: 'pending',
      } as StoredBook)))
    } catch { /* اللقطة تحسين لأول إطار فقط */ }
  }
  const render = async (): Promise<void> => {
    const identity=currentLibraryIdentityScope(),books=await listBooks()
    if(scope.disposed||identity!==currentLibraryIdentityScope())return
    renderShelves(books)
  }
  renderSnapshot()
  // لا نترك هيكل تحميل لعشر ثوانٍ إذا كانت هذه أول زيارة ولم توجد لقطة بعد.
  if (host.querySelector('.silent-skeleton')) renderShelves([])
  void render().catch(() => host.replaceChildren(stateView({ kind: 'error', title: 'تعذّر عرض الرفوف الآن', description: 'يمكنك فتح صفحة الرفوف والمحاولة مجددًا.', actionLabel: 'فتح الرفوف', href: '#/shelves' })))
  routeEventListener(window, 'shelves-changed', () => { void render() }, undefined, scope)
  routeEventListener(window, 'alkhizana:account-changed', () => { renderShelves([]); renderSnapshot(); void render().catch(()=>undefined) }, undefined, scope)
  return host
}

function integratedManagementSection(): HTMLElement {

  const resourceScope = captureRouteResourceScope()
  const selected = new Set<string>()
  let books: StoredBook[] = []
  let remoteBooks:AccountBookSubmission[]=[]
  let remoteGeneration=0,remotePage=0
  let remoteReady=false
  const accountIds=new Map<string,string[]>()
  const accountNotice=h('div',{'aria-live':'polite'})
  let editableBookCount = 0
  let bulkBusy = false
  let undoSnapshot: BookMetadataSnapshot[] = []
  const usageHint = 'ضع علامة على كتبك المطلوبة، ثم اكتب المؤلف أو اختر التصنيف الذي تريد تغييره فقط، وراجع العدد قبل تطبيق التغييرات. الحقول الفارغة لا تتغير.'
  const info = h('span', {
    class: 'library-private__info',
    role: 'img',
    tabindex: 0,
    title: usageHint,
    'aria-label': `طريقة إدارة كتبي الخاصة: ${usageHint}`,
    dataset: { tooltip: usageHint },
  }, icon('info', 20))
  uiTemplateAttribute(info,'aria-label','54cca6a994838491',{p1:uiLabelParameter(usageHint)})
  const privateBookCount = h('strong', { class: 'library-private__stat-value' }, '0')
  const privateAuthorCount = h('strong', { class: 'library-private__stat-value' }, '0')
  const privateSearch = h('input', {
    class: 'library-private__search-input',
    type: 'search',
    placeholder: 'البحث في كتبي…',
    'aria-label': 'البحث في كتبي الخاصة',
  }) as HTMLInputElement
  privateSearch.autocomplete = 'off'
  const privateSort = h('select', { class: 'library-private__sort', 'aria-label': 'ترتيب كتبي الخاصة' },
    ...BOOK_SORT_OPTIONS.map(({value,label})=>h('option',{value},label)),
    h('option', { value: 'added' }, 'تاريخ الإضافة'),
    h('option', { value: 'category' }, 'التصنيف'),
  ) as HTMLSelectElement
  // أول إطار من اللقطة مرتب بالوفاة كذلك؛ فلا تقفز القائمة إلى ترتيب
  // ألفبائي مختلف عند اكتمال IndexedDB ما لم يختر المستخدم ترتيبًا آخر.
  privateSort.value = 'death'
  const section = h('section', { class: 'library-admin library-private', 'aria-labelledby': 'library-admin-title' },
    h('header', { class: 'library-private__header' },
      h('div', { class: 'library-private__title-row' }, h('h2', { id: 'library-admin-title' }, 'كتبي الخاصة'), info),
      h('p', null, 'الكتب التي أضفتها بنفسك ويمكنك تعديلها أو تنظيم بياناتها.'),
      h('div', { class: 'library-private__overview' },
        h('div', { class: 'library-private__stats', 'aria-label': 'إحصاءات كتبي الخاصة' },
          h('span', { class: 'library-private__stat' }, privateBookCount, h('small', null, 'كتاب')),
          h('span', { class: 'library-private__stat' }, privateAuthorCount, h('small', null, 'مؤلف')),
        ),
        h('form', { class: 'library-private__search', 'aria-label': 'البحث في كتبي الخاصة' }, icon('search', 19), privateSearch),
        h('label', { class: 'library-private__sort-wrap' }, h('span', null, 'الترتيب'), privateSort),
      ),
    ),
  )
  const toolbar = h('form', { class: 'library-admin__bulk' })
  const status = h('strong', { class: 'library-admin__selection-status', 'aria-live': 'polite' }, 'التعديل الجماعي مخصص للكتب التي تضيفها أنت؛ الكتب الأصلية المثبّتة محمية')
  const author = h('input', { type: 'text', placeholder: 'اتركه فارغًا لعدم تغيير المؤلف', 'aria-label': 'المؤلف الجديد للكتب المحددة' }) as HTMLInputElement
  const category = categoryControl('التصنيف الجماعي', undefined, true)
  category.firstElementChild!.textContent = 'لا تغيّر التصنيف'
  const apply = h('button', { class: 'btn btn--primary', type: 'submit', disabled: true }, 'تطبيق التغييرات') as HTMLButtonElement
  const undo = h('button', { class: 'btn btn--secondary', type: 'button' }, 'تراجع عن آخر تطبيق') as HTMLButtonElement
  undo.hidden = true
  const privateGrid = h('div', { class: 'library-grid library-private__grid', 'aria-label': 'الكتب الخاصة القابلة للتعديل' })
  const renderCachedSnapshot = (): void => {
    try {
      const cached = readPrivateLibrarySnapshot()
      if (!cached.length) return
      privateBookCount.textContent = arabicCount(cached.length)
      privateAuthorCount.textContent = arabicCount(new Set(cached.map(book => normalizeArabicAuthorName(book.author)).filter(Boolean)).size)
      const orderedCached = orderedBooks(cached)
      privateGrid.replaceChildren(...orderedCached.map((book, index) => {
        const ordinal = bookOrdinal(index)
        const deathYear = displayableAuthorDeathYear(book.deathYearHijri)
        const death = isUnknownAuthorDeathYear(book.deathYearHijri) ? ' (المؤلف مجهول)' : book.contemporary ? ' (معاصر)' : deathYear ? ` (ت: ${deathYear} هـ)` : ''
        return h('article', { class: 'library-card library-card--compact library-card--snapshot', dataset: { bookId: book.id } },
          h('a', { class: 'book-card__surface', href: `#/reader/${book.id}`, 'aria-label': `قراءة ${book.title}` }),
          formatBadges(book as StoredBook),
          h('div', { class: 'library-card__cover', 'aria-hidden': 'true' }, bookCover({ ...book, data: new Uint8Array(), mimeType: '', originalSha256: '', pdfStatus: 'pending' } as StoredBook, 'library-card__cover-art')),
          h('div', { class: 'library-card__body' },
            h('div', { class: 'library-card__title-row' }, h('small', { class: 'book-card__ordinal', title: ordinal.label }, String(ordinal.number)), bindBookDisplayTitle(h('h3', { class: 'library-card__title', title: book.title, dataset: { noTranslate: '' } }, book.title), book.id, book.title)),
            h('div', { class: 'library-card__author-row' }, h('span', { class: 'library-card__author-name', title: `${book.author}${death}` }, authorLink(book.author, 'book-card__author', book.authorId), death)),
            h('div', { class: 'library-card__taxonomy' }, h('span', book.category ? { dataset: { noTranslate: '' } } : null, categoryLink(book.category || UNCATEGORIZED_CATEGORY))),
            h('small', { class: 'library-card__added-date' }, h('span', null, 'تاريخ الإضافة:'), ` ${new Date(book.addedAt).toLocaleDateString('ar-SA')}`),
          ),
        )
      }))
    } catch { /* IndexedDB remains authoritative */ }
  }
  const syncStatus = (): void => {
    status.textContent = selected.size
      ? `اخترت ${arabicCount(selected.size)} كتاب؛ لا تتغير إلا الحقول التي حددتها هنا`
      : editableBookCount
        ? 'لم تختر أي كتاب بعد — استخدم مربعات التحديد في بطاقات كتبك المضافة أدناه'
        : 'لا توجد كتب شخصية قابلة للتعديل الجماعي بعد — أضف كتابًا أو مجموعة أولًا؛ وتبقى الكتب الأصلية المثبّتة محمية'
    apply.disabled = bulkBusy || selected.size === 0
    apply.textContent = selected.size ? `تطبيق التغييرات على ${arabicCount(selected.size)} كتاب` : 'تطبيق التغييرات'
  }
  const renderPrivateBooks = (): void => {
    const collator = new Intl.Collator('ar', { sensitivity: 'base', numeric: true })
    const allEditable = books.filter(book => book.managedSource !== 'published').sort((a, b) => {
      if (BOOK_SORT_OPTIONS.some(option=>option.value===privateSort.value)) return compareBooks(parseBookSort(privateSort.value))(a,b)
      if (privateSort.value === 'added') return b.addedAt - a.addedAt || collator.compare(a.title, b.title)
      if (privateSort.value === 'author') return collator.compare(a.author, b.author) || collator.compare(a.title, b.title) || a.id.localeCompare(b.id, 'en', { numeric: true })
      if (privateSort.value === 'category') return collator.compare(effectiveBookCategory(a), effectiveBookCategory(b)) || collator.compare(a.title, b.title)
      return collator.compare(a.title, b.title)
    })
    const query = normalizeArabicAuthorName(privateSearch.value)
    const editable = query ? allEditable.filter(book => normalizeArabicAuthorName([
      book.title,
      book.author,
      effectiveBookCategory(book),
      formatLabel(book),
      book.fileName,
    ].filter(Boolean).join(' ')).includes(query)) : allEditable
    const unified=mergePrivateAccountBooks(allEditable,remoteBooks,accountIds)
    const remoteOnly=unified.filter(item=>!item.local).flatMap(item=>item.remote)
    editableBookCount = allEditable.length + remoteOnly.length
    const available = new Set([...allEditable.map(book=>book.id),...remoteOnly.map(book=>'account-book:'+book.id)])
    for (const id of selected) if (!available.has(id)) selected.delete(id)
    syncStatus()
    privateBookCount.textContent = arabicCount(unified.length)
    privateAuthorCount.textContent = arabicCount(new Set([...allEditable.map(book=>book.author),...remoteOnly.map(book=>book.author)].map(normalizeArabicAuthorName).filter(Boolean)).size)
    privateGrid.replaceChildren(...editable.map((book, index) => {
      const card = bookCard(book, index, { compactPrivate: true })
      const copies=unified.find(item=>item.local?.id===book.id)?.remote??[]
      const label=copies.length?[...new Set(copies.map(accountBookStatus))].join('، '):remoteReady?'على هذا الجهاز فقط':'جارٍ التحقق من حالة الحساب'
      const actions=card.querySelector('.library-card__actions')
      actions?.append(h('button',{class:'library-card__icon-action',type:'button',title:label,'aria-label':label,onclick:()=>toast(label)},icon(copies.some(item=>item.reviewStatus==='pending')?'clock':copies.some(item=>item.reviewStatus==='rejected')?'close':copies.length?'check':'info',18)))
      const publishCopy=copies.find(copy=>copy.visibility!=='public')
      if(publishCopy){const publish=privateBookPublishButton(publishCopy,renderPrivateBooks);if(publish)actions?.append(publish)}
      const input = h('input', { class: 'library-card__select', type: 'checkbox', 'aria-label': libraryBookActionLabel('select', book.title) }) as HTMLInputElement
      uiTemplateAttribute(input,'aria-label','414c7bad9cc577a2',{p1:book.title})
      input.checked = selected.has(book.id)
      input.disabled = bulkBusy
      input.addEventListener('change', () => { input.checked ? selected.add(book.id) : selected.delete(book.id); syncStatus() })
      card.prepend(input)
      return card
    }))
    const visibleRemote=remoteOnly.filter(book=>!query||normalizeArabicAuthorName([book.title,book.author,book.category].join(' ')).includes(query))
    for(const book of visibleRemote){
      const label=accountBookStatus(book),href=`#/reader/${encodeURIComponent('account-book:'+book.id)}`
      const selectionId='account-book:'+book.id
      const input=h('input',{class:'library-card__select',type:'checkbox','aria-label':libraryBookActionLabel('select',book.title)}) as HTMLInputElement
      input.checked=selected.has(selectionId);input.disabled=bulkBusy
      input.addEventListener('change',()=>{input.checked?selected.add(selectionId):selected.delete(selectionId);syncStatus()})
      privateGrid.append(h('article',{class:'library-card library-card--compact',dataset:{accountBookId:book.id}},
        input,
        h('a',{class:'book-card__surface',href,'aria-label':`قراءة ${book.title}`}),
        h('div',{class:'library-card__cover','aria-hidden':'true'},bookCover({title:book.title,author:book.author,id:book.id,data:new Uint8Array(),originalSha256:book.id} as StoredBook,'library-card__cover-art')),
        h('div',{class:'library-card__body'},bindBookDisplayTitle(h('h3',{class:'library-card__title',dataset:{noTranslate:''}},book.title),book.id,book.title),h('div',{class:'library-card__author-row',dataset:{noTranslate:''}},book.author),
          h('div',{class:'library-card__taxonomy'},categoryLink(book.category||'غير مصنف')),
          h('div',{class:'library-card__actions'},h('span',{class:'library-card__icon-action',title:label,'aria-label':label,tabindex:0},icon(book.reviewStatus==='pending'?'clock':book.reviewStatus==='rejected'?'close':'check',18)),h('a',{class:'library-card__icon-action',href:`/api/account/books/${encodeURIComponent(book.id)}/file`,title:'تنزيل نسخة الحساب','aria-label':'تنزيل نسخة الحساب'},icon('download',18)),...accountBookActions(book,change=>{if(change)Object.assign(book,change);else remoteBooks=remoteBooks.filter(item=>item.id!==book.id);renderPrivateBooks()})),
          h('small',{class:'library-card__added-date'},new Date(book.createdAt).toLocaleDateString('en-GB')))))
    }
    if (!editable.length&&!visibleRemote.length) privateGrid.replaceChildren(stateView(unified.length
      ? { kind: 'no-results', icon: 'search', title: 'لا توجد نتيجة في كتبك', description: 'غيّر عبارة البحث لتظهر الكتب المطابقة.' }
      : { kind: 'empty', icon: 'book', title: 'لم تضف أي كتاب بعد!', description: 'أضف ما تشاء من الكتب وبأي صيغة تحبها وصنفها في الخزانة كما تُحب.' }))
  }
  privateSearch.addEventListener('input', renderPrivateBooks)
  const loadAccount = async(append=false):Promise<void>=>{
    const generation=++remoteGeneration,claims=currentAccountClaims(),identity=currentLibraryIdentityScope()
    const current=()=>!resourceScope.disposed&&generation===remoteGeneration&&identity===currentLibraryIdentityScope()&&currentAccountClaims()?.sessionId===claims?.sessionId
    if(!claims){remoteBooks=[];remoteReady=true;accountNotice.replaceChildren();renderPrivateBooks();return}
    accountNotice.replaceChildren(h('p',{role:'status'},'جارٍ تحديث حالة كتب الحساب…'))
    try{
      const page=append?remotePage+1:0,result=await listAccountBooksPage(page)
      if(!current())return
      const next=append?[...remoteBooks,...result.books]:result.books
      for(const book of books.filter(book=>book.managedSource!=='published')){
        if(!accountIds.has(book.id)){const ids=await localAccountSourceIds(book,claims.subject);if(!current())return;accountIds.set(book.id,ids)}
      }
      if(!current())return
      remoteBooks=[...new Map(next.map(book=>[book.id,book])).values()];remotePage=page;remoteReady=!result.hasMore
      renderPrivateBooks();accountNotice.replaceChildren(...(result.hasMore?[h('button',{class:'btn btn--secondary',type:'button',onclick:()=>void loadAccount(true)},'تحميل كتب أقدم')]:[]))
    }catch{if(current())accountNotice.replaceChildren(h('p',{role:'status'},'تعذّر تحديث كتب الحساب؛ النسخ المحلية ظاهرة دون تأكيد حالتها.'),h('button',{class:'btn btn--secondary',type:'button',onclick:()=>void loadAccount(append)},'إعادة المحاولة'))}
  }
  privateSort.addEventListener('change', renderPrivateBooks)
  privateSearch.closest('form')?.addEventListener('submit', event => {
    event.preventDefault()
    const query = privateSearch.value.trim()
    if (!query) { privateSearch.focus(); return }
    const privateIds = books.filter(book => book.managedSource !== 'published').map(book => book.id)
    routeLocation.hash = `#/search?q=${encodeURIComponent(query)}&books=${encodeURIComponent(JSON.stringify(privateIds))}`
  })
  const refresh = (): void => { remoteGeneration++;accountIds.clear();remoteReady=false;const identity = currentLibraryIdentityScope();const generation=remoteGeneration; void listBooks().then(booksWithAuthorChronology).then(next => { if (resourceScope.disposed || identity !== currentLibraryIdentityScope() || generation!==remoteGeneration) return; books = next; editableBookCount = bulkSelectableIds(next).size; selected.clear(); syncStatus(); remoteBooks=[];renderPrivateBooks(); savePrivateLibrarySnapshot(next);void loadAccount() }).catch(() => {
    if (resourceScope.disposed || identity !== currentLibraryIdentityScope() || privateGrid.querySelector('.library-card')) return
    privateGrid.replaceChildren(stateView({ kind: 'error', title: 'تعذّر فتح كتبك الآن', description: 'كتبك محفوظة ولم تُحذف. أعد المحاولة لفتحها من التخزين المحلي.', actionLabel: 'إعادة المحاولة', onAction: refresh }));void loadAccount()
  }) }
  toolbar.addEventListener('submit', async event => {
    event.preventDefault()
    if (bulkBusy) return
    const values: BookMetadataUpdate = {}
    if (author.value.trim()) values.author = author.value.trim()
    if (category.value === UNCATEGORIZED_CATEGORY) values.category = null
    else if (category.value) values.category = category.value
    if (!selected.size || !Object.keys(values).length) { toast('حدد كتبًا وأدخل بيانات واحدة على الأقل'); return }
    if ([...selected].some(id=>id.startsWith('account-book:'))) {
      if(!confirm(`تطبيق التغييرات على ${arabicCount(selected.size)} كتاب؟ تعديلات كتب الحساب تعود للمراجعة، ولا يشملها التراجع المحلي.`))return
      const session=currentAccountClaims()?.sessionId,identity=currentLibraryIdentityScope()
      const current=()=>!resourceScope.disposed&&identity===currentLibraryIdentityScope()&&currentAccountClaims()?.sessionId===session
      const targets=[...selected];let succeeded=0;const failures:string[]=[]
      bulkBusy=true;syncStatus();renderPrivateBooks()
      try {
        for(const id of targets){
          if(!current())return
          try{
            if(id.startsWith('account-book:')){
              const book=remoteBooks.find(book=>'account-book:'+book.id===id)
              if(!book)throw Error('account_book_id_invalid')
              const changes=accountBulkMetadata(book,values)
              const result=await updateAccountBook(book.id,changes)
              if(!current())return
              Object.assign(book,changes,{reviewVersion:result.reviewVersion,reviewStatus:'pending'})
            }else{
              await updateBookMetadata(id,values)
              if(!current())return
              const fresh=await getBook(id)
              if(!current())return
              if(fresh)books=books.map(book=>book.id===id?fresh:book)
            }
            selected.delete(id);succeeded++
          }catch(error){if(!current())return;failures.push(accountErrorArabic(error))}
        }
        if(current()){
          undoSnapshot=[];undo.hidden=true
          toast(failures.length?`تم تعديل ${arabicCount(succeeded)} كتاب؛ تعذّر تعديل ${arabicCount(failures.length)} وبقيت محددة. ${failures[0]}`:`طُبقت البيانات المحددة على ${arabicCount(succeeded)} كتاب`)
        }
      }finally{bulkBusy=false;if(current())renderPrivateBooks()}
      return
    }
    const snapshot = books.filter(book => selected.has(book.id)).map(snapshotBookMetadata)
    try {
      await Promise.all([...selected].map(id => updateBookMetadata(id, values)))
      undoSnapshot = snapshot; undo.hidden = false; toast(`طُبقت البيانات المحددة على ${arabicCount(selected.size)} كتاب`)
      window.dispatchEvent(new Event('library-changed'))
    } catch (error) {
      await Promise.allSettled(snapshot.map(restoreBookMetadata))
      toast(error instanceof Error ? error.message : 'تعذّر التطبيق وأعيدت البيانات السابقة')
      window.dispatchEvent(new Event('library-changed'))
    }
  })
  undo.addEventListener('click', async () => {
    if (!undoSnapshot.length) return
    const snapshot = undoSnapshot
    try {
      await Promise.all(snapshot.map(restoreBookMetadata))
      undoSnapshot = []; undo.hidden = true
      toast(`تراجعت عن آخر تطبيق جماعي على ${arabicCount(snapshot.length)} كتاب`)
      window.dispatchEvent(new Event('library-changed'))
    } catch (error) { toast(error instanceof Error ? error.message : 'تعذّر التراجع؛ بقي السجل متاحًا لإعادة المحاولة') }
  })
  toolbar.append(status, h('label', { class: 'library-admin__field' }, h('span', null, 'تغيير المؤلف إلى'), author), h('label', { class: 'library-admin__field' }, h('span', null, 'تغيير التصنيف إلى'), category), apply, undo)
  section.append(toolbar, privateGrid, accountNotice)
  routeEventListener(window, 'library-changed', refresh, undefined, resourceScope)
  routeEventListener(window, 'alkhizana:account-changed', () => { books = [];remoteBooks=[];accountNotice.replaceChildren();accountIds.clear();remoteReady=false; selected.clear(); renderPrivateBooks(); refresh() }, undefined, resourceScope)
  renderCachedSnapshot()
  refresh()
  return section
}

function booksSection(initialCategoryRoute = libraryCategoryRoute(currentHashQuery())): { filters: HTMLElement; books: HTMLElement } {
  const resourceScope = captureRouteResourceScope()
  const wrap = h('section', { class: 'library-section', 'aria-label': 'إدارة الكتب المحفوظة' })
  const controls = h('div', { class: 'library-controls' })
  const search = h('div', { class: 'library-search' }, icon('search', 19))
  const input = h('input', { type: 'search', placeholder: 'ابحث بالعنوان أو المؤلف…', 'aria-label': 'تصفية كتب المكتبة' }) as HTMLInputElement
  search.appendChild(input)
  // لا ننتظر مصالحة آلاف سجلات IndexedDB كي يصبح مربع البحث فعالًا.
  // يعرض الفهرس الخفيف الكتب المطابقة فورًا، بينما تبقى شبكة المكتبة
  // ومرشحاتها متزامنة حالما تصبح السجلات المحلية جاهزة.
  const searchScope = { category: initialCategoryRoute.value }
  attachLiveSearch(input, search, searchScope)
  const categoryFilter = categoryControl('تصفية حسب التصنيف', undefined, true)
  categoryFilter.firstElementChild!.textContent = 'كل التصنيفات'
  if (initialCategoryRoute.requested && !initialCategoryRoute.valid) {
    categoryFilter.appendChild(h('option', { value: INVALID_LIBRARY_CATEGORY }, 'تصنيف غير معروف'))
  }
  categoryFilter.value = initialCategoryRoute.value
  const authorState = h('select', { 'aria-label': 'تصفية حسب حالة المؤلف' },
    h('option', { value: '' }, 'كل المؤلفين'), h('option', { value: 'contemporary' }, 'المعاصرون'), h('option', { value: 'deceased' }, 'المتوفون')) as HTMLSelectElement
  const fromYear = h('input', { type: 'number', min: '1', max: '2000', placeholder: 'من سنة هـ', 'aria-label': 'سنة الوفاة من' }) as HTMLInputElement
  const toYear = h('input', { type: 'number', min: '1', max: '2000', placeholder: 'إلى سنة هـ', 'aria-label': 'سنة الوفاة إلى' }) as HTMLInputElement
  const bookSort = h('select', { 'aria-label': 'ترتيب الكتب' }, ...BOOK_SORT_OPTIONS.map(({value,label})=>h('option',{value},label))) as HTMLSelectElement
  const advanced = h('div', { class: 'library-controls__advanced' }, categoryFilter, authorState, fromYear, toYear, bookSort)
  const clearFilters = h('button', { type: 'button', class: 'btn btn--secondary' }, 'مسح المرشحات')
  const tagFilter = h('div', { class: 'library-tag-filter', hidden: true })
  const grid = h('div', { class: 'library-grid', id: 'library-grid' })
  grid.appendChild(silentSkeleton('cards'))
  controls.append(search, advanced, clearFilters)
  const download=collectionDownloadButton(()=>categoryFilter.value||'المكتبة',async()=>{
    const category=categoryFilter.value
    if(!category||category===INVALID_LIBRARY_CATEGORY)throw Error('collection_category_required')
    const books=await listBooks({requireCompleteCatalog:true})
    return books.filter(book=>matchesCategoryFilter(effectiveBookCategory(book),category)).map(({id,title})=>({id,title}))
  })
  download.hidden=!categoryFilter.value||categoryFilter.value===INVALID_LIBRARY_CATEGORY
  const syncDownload=()=>{download.hidden=!categoryFilter.value||categoryFilter.value===INVALID_LIBRARY_CATEGORY}
  categoryFilter.addEventListener('change',syncDownload)
  clearFilters.addEventListener('click',()=>{download.hidden=true})
  controls.append(download)
  const archiveHost=h('div',null)
  let archiveController:AbortController|undefined
  const refreshArchives=()=>{archiveController?.abort();archiveHost.replaceChildren();if(categoryFilter.value&&categoryFilter.value!==INVALID_LIBRARY_CATEGORY){archiveController=new AbortController();archiveHost.append(downloadAttachmentPanel({category:categoryFilter.value},archiveController.signal))}}
  resourceScope.add(()=>archiveController?.abort())
  categoryFilter.addEventListener('change',refreshArchives)
  clearFilters.addEventListener('click',()=>{archiveController?.abort();archiveHost.replaceChildren()})
  refreshArchives()
  const filters = h('section', { class: 'library-filter-section', 'aria-label': 'البحث وتصفية كتب المكتبة' }, controls)
  const selection=publishedGridSelection()
  wrap.append(tagFilter, selection.host, grid,archiveHost)
  void listBooks().then(booksWithAuthorChronology).then((books) => {
    const params = currentHashQuery()
    const requestedCategory = libraryCategoryRoute(params)
    const requestedAuthor = params.get('author') ?? ''
    const requestedEdit = params.get('edit') ?? ''
    let requestedTag = params.get('tag') ?? ''
    let currentBooks = books
    if (requestedCategory.requested) categoryFilter.value = requestedCategory.value
    input.value = params.get('q') ?? requestedAuthor
    authorState.value = params.get('authorState') ?? ''
    fromYear.value = params.get('from') ?? ''
    toYear.value = params.get('to') ?? ''
    bookSort.value = parseBookSort(params.get('sort'))
    const render = (): void => renderLibraryGrid(grid, currentBooks, input.value, {
      category: categoryFilter.value, authorState: authorState.value, sort: bookSort.value as BookSort,
      fromYear: Number(fromYear.value) || 0, toYear: Number(toYear.value) || Number.POSITIVE_INFINITY, tag: requestedTag,
    },40,selection)
    routeEventListener(window,'alkhizana:account-changed',render,undefined,resourceScope)
    const renderTag = (): void => {
      tagFilter.hidden = !requestedTag
      tagFilter.replaceChildren(...(requestedTag ? [h('span', null, 'الوسم النشط:'), h('strong', null, `#${requestedTag}`), h('button', { type: 'button', class: 'btn btn--secondary', onclick: () => { requestedTag = ''; replaceHashQuery({ tag: null }); renderTag(); render() } }, 'إزالة')] : []))
    }
    const sync = (): void => { searchScope.category = categoryFilter.value; replaceHashQuery({ q: input.value.trim(), author: null, category: categoryFilter.value || null, authorState: authorState.value, from: fromYear.value, to: toYear.value, tag: requestedTag || null, sort: bookSort.value === 'death' ? null : bookSort.value }); render() }
    bookSort.addEventListener('change', sync)
    input.addEventListener('input', sync)
    categoryFilter.addEventListener('change', sync); authorState.addEventListener('change', sync)
    fromYear.addEventListener('input', sync); toYear.addEventListener('input', sync)
    clearFilters.addEventListener('click', () => { requestedTag = ''; renderTag(); input.value = ''; categoryFilter.value = ''; authorState.value = ''; fromYear.value = ''; toYear.value = ''; sync(); input.focus() })
    const refreshBooks = (): void => { void listBooks().then(booksWithAuthorChronology).then((next) => { if (resourceScope.disposed) return; currentBooks = next; render() }) }
    routeEventListener(window, 'library-changed', refreshBooks, undefined, resourceScope)
    renderTag(); render()
    if (requestedEdit) {
      const book = currentBooks.find((item) => item.id === requestedEdit)
      const card = grid.querySelector<HTMLElement>(`[data-book-id="${CSS.escape(requestedEdit)}"]`)
      if (book && card) openLibraryBookEditor(card, book)
    }
  }).catch(() => grid.replaceChildren(stateView({ kind: 'error', title: 'تعذّر فتح المكتبة الآن', description: 'كتبك محفوظة ولم تُحذف.', actionLabel: 'إعادة المحاولة', onAction: () => location.reload() })))
  return { filters, books: wrap }
}

export function selectLibraryGridBooks(books: StoredBook[], query: string, metadata: {
  category: string; authorState: string; fromYear: number; toYear: number; tag?: string; sort?: BookSort;
}): StoredBook[] {
  const q = query.trim().toLocaleLowerCase('ar')
  const visible = books.filter((book) => {
    const matches = (!q || `${book.title} ${book.author} ${(book.authors ?? []).map(author => author.name).join(' ')}`.toLocaleLowerCase('ar').includes(q)) && matchesCategoryFilter(effectiveBookCategory(book), metadata.category)
      && (!metadata.tag || book.tags?.some(tag => tag.name === metadata.tag))
    const year = displayableAuthorDeathYear(book.deathYearHijri) ?? 0
    const matchesMetadata = (!metadata.authorState || (metadata.authorState === 'contemporary' ? book.contemporary : !book.contemporary))
      && (!metadata.fromYear || (!book.contemporary && year >= metadata.fromYear))
      && (!Number.isFinite(metadata.toYear) || (!book.contemporary && year <= metadata.toYear))
    return matches && matchesMetadata
  })
  return sortBooks(visible, metadata.sort)
}

function renderLibraryGrid(grid: HTMLElement, books: StoredBook[], query: string, metadata: Parameters<typeof selectLibraryGridBooks>[2], limit = 40, selection?:ReturnType<typeof publishedGridSelection>): void {
  const ordered = selectLibraryGridBooks(books, query, metadata), visible = ordered
  selection?.reset(ordered)
  grid.replaceChildren(...ordered.slice(0, limit).map((book, index) => {const card=bookCard(book,index);selection?.decorate(card,book);return card}))
  if (visible.length > limit) {
    const more = h('button', { class: 'btn btn--secondary library-load-more', type: 'button' }, `عرض المزيد (${arabicCount(visible.length - limit)} متبقٍ)`)
    more.addEventListener('click', () => renderLibraryGrid(grid, books, query, metadata, limit + 120,selection))
    grid.appendChild(more)
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting) || !more.isConnected) return
        observer.disconnect(); more.click()
      }, { rootMargin: '480px 0px' })
      observer.observe(more)
    }
  }
  if (!visible.length) grid.replaceChildren(stateView(books.length ? { kind: 'no-results', icon: 'search', title: 'لا توجد كتب تطابق التصفية', description: 'غيّر عبارة البحث أو المرشحات.' } : { kind: 'empty', icon: 'book', title: 'لم تضف كتابًا بعد', description: 'أضف ملف Word لتبدأ بناء خزانتك.' }))
}

const FORMAT_MARKS: Record<BookFormat, { short: string; className: string }> = {
  word: { short: 'W', className: 'is-word' },
  pdf: { short: 'PDF', className: 'is-pdf' },
  jpeg: { short: 'JPG', className: 'is-pdf' },
  'shamela-bok': { short: 'BOK', className: 'is-bok' },
  epub: { short: 'e', className: 'is-epub' },
  markdown: { short: 'M↓', className: 'is-markdown' },
  html: { short: 'HTML', className: 'is-epub' },
  text: { short: 'TXT', className: 'is-text' },
}

function originalBookFormats(book: StoredBook): BookFormat[] {
  const formats = new Set<BookFormat>([inferBookFormat(book)])
  // pdfData الناتج من محرك الخزانة نسخة مشتقة، فلا نعرضه بوصفه أصلًا.
  // أما PDF المرفق مع أصل آخر بلا بصمة محرك فهو أصل مستقل رفعه المستخدم.
  if (book.pdfData?.byteLength && !book.pdfEngine && inferBookFormat(book) !== 'pdf') formats.add('pdf')
  return [...formats]
}

function formatBadges(book: StoredBook): HTMLElement {
  const formats = originalBookFormats(book)
  return h('span', { class: 'library-card__format-corner', 'aria-label': 'صيغ الكتاب الأصلية' },
    ...formats.map(format => {
      const mark = FORMAT_MARKS[format]
      const size = format === 'pdf' && inferBookFormat(book) !== 'pdf' ? book.pdfData?.byteLength ?? 0 : book.fileSize
      const tooltip = `${format === inferBookFormat(book) ? formatLabel(book) : 'PDF'} · ${(size / 1024).toFixed(0)} KB`
      const badge=h('span', {
        class: `library-card__format-mark ${mark.className}`,
        role: 'img', tabindex: 0, title: tooltip,
        'aria-label': tooltip, dataset: { tooltip },
      }, format === 'shamela-bok'
        ? h('img', { src: './brand-logo-color.png', alt: '' })
        : mark.short)
      for(const attribute of ['title','aria-label','data-tooltip'] as const)uiTemplateAttribute(badge,attribute,'1a01719a6e0c4657',{p1:uiLabelParameter(format===inferBookFormat(book)?formatLabel(book):'PDF'),p2:(size/1024).toFixed(0)})
      return badge
    }),
  )
}

function bookCard(book: StoredBook, index: number, options: { compactPrivate?: boolean } = {}): HTMLElement {
  const titleId = libraryBookTitleId(book.id)
  const compact = true
  const card = h('article', { class: 'library-card library-card--compact', dataset: { bookId: book.id }, 'aria-labelledby': titleId })
  if (book.managedSource === 'published') card.appendChild(managedBookLock('library-card__managed-lock'))
  const ordinal = bookOrdinal(index)
  if (compact) {
    card.appendChild(formatBadges(book))
  }
  card.appendChild(h('a', { class: 'book-card__surface', href: `#/reader/${book.id}`, 'aria-label': `قراءة ${book.title}` }))
  card.appendChild(h('div', { class: 'library-card__cover', 'aria-hidden': 'true' }, bookCover(book, 'library-card__cover-art')))
  const body = h('div', { class: 'library-card__body' })
  if (!compact) body.appendChild(h('small', { class: 'book-card__ordinal', 'aria-label': ordinal.label }, String(ordinal.number)))

  // العنوان
  const title = bindBookDisplayTitle(h('h3', { class: 'library-card__title', id: titleId, title: book.title, dataset: { noTranslate: '' } }, book.title), book.id, book.title)
  body.appendChild(compact
    ? h('div', { class: 'library-card__title-row' }, h('small', { class: 'book-card__ordinal', 'aria-label': ordinal.label, title: ordinal.label }, String(ordinal.number)), title)
    : title)

  // المؤلف
  const deathYear = displayableAuthorDeathYear(book.deathYearHijri)
  const author = authorLink(book.author, 'book-card__author', book.authorId)
  const deathLabel = isUnknownAuthorDeathYear(book.deathYearHijri) ? 'المؤلف مجهول' : book.contemporary ? 'معاصر' : ''
  const deathText = deathLabel ? uiTemplateText('0f5ff085c5c65ef8',{p1:uiLabelParameter(deathLabel)}) : deathYear ? uiTemplateText('db79c40668a2cb90',{p1:deathYear}) : ''
  const authorRow = h('span', { class: 'library-card__author-name' }, author, ' ', deathText)
  for(const target of [author,authorRow]){
    if(deathLabel)uiTemplateAttribute(target,'title','8619458f120c1f87',{p1:book.author,p2:uiLabelParameter(deathLabel)})
    else if(deathYear)uiTemplateAttribute(target,'title','a635858e0ecffaf3',{p1:book.author,p2:deathYear})
    else uiTemplateAttribute(target,'title','e247c72af5db1232',{p1:book.author})
  }
  body.appendChild(compact
    ? h('div', { class: 'library-card__author-row' }, authorRow)
    : author)

  // حجم وتاريخ
  if (!compact) body.appendChild(h('div', { class: 'book-card__meta' },
    h('span', { class: 'book-format-badge' }, formatLabel(book)),
    h('span', null, `${(book.fileSize / 1024).toFixed(0)} KB`),
    h('span', { class: 'dot' }),
    h('span', null, new Date(book.addedAt).toLocaleDateString('ar-SA')),
  ))
  const category = effectiveBookCategory(book)
  const categoryAnchor = categoryLink(category)
  if (book.category?.trim() || book.categoryOverride?.value?.trim()) categoryAnchor.dataset.noTranslate = ''
  categoryAnchor.title = category
  body.appendChild(h('div', { class: 'library-card__taxonomy' },
    categoryAnchor,
    compact ? null : isUnknownAuthorDeathYear(book.deathYearHijri) ? h('span', null, 'المؤلف مجهول') : book.contemporary ? h('span', null, 'معاصر') : deathYear ? h('span', null, `ت ${deathYear}هـ · نحو ${approximateGregorianYear(deathYear)}م`) : null,
  ))

  const actions = h('div', { class: 'library-card__actions' })
  const compactAction = (element: HTMLElement, label: string, iconName: IconName): HTMLElement => {
    if (!compact) return element
    element.classList.add('library-card__icon-action')
    element.setAttribute('aria-label', label)
    element.setAttribute('title', label)
    element.dataset.tooltip = label
    element.replaceChildren(icon(iconName, 19))
    return element
  }
  const sourceIsPdf = inferBookFormat(book) === 'pdf'
  const sourceIsText = ['text', 'markdown'].includes(inferBookFormat(book))
  const sourceIsEpub = inferBookFormat(book) === 'epub'
  const sourceIsHtml = inferBookFormat(book) === 'html'
  const sourceIsBok = inferBookFormat(book) === 'shamela-bok'
  const originalAsset = localOriginalAsset(book)
  const wordButton = h('button', { class: 'btn btn--secondary library-card__button', type: 'button' }, sourceIsPdf ? 'تحميل PDF' : sourceIsText ? 'تحميل النص الأصلي' : sourceIsEpub ? 'تحميل EPUB الأصلي' : sourceIsHtml ? 'تحميل HTML الأصلي' : sourceIsBok ? 'تحميل BOK الأصلي' : 'تحميل Word')
  wordButton.addEventListener('click', (ev) => {
    ev.preventDefault(); ev.stopPropagation()
    if(originalAsset)downloadBytes(originalAsset.bytes,originalAsset.fileName,originalAsset.mimeType)
  })
  if (originalAsset) actions.appendChild(compactAction(wordButton, wordButton.textContent || 'تحميل الأصل', 'download'))
  const textualPdfAction = pdfButtonAction(book, 'standard')
  if (textualPdfAction === 'original' && (sourceIsText || sourceIsEpub || sourceIsHtml || sourceIsBok)) {
    const originalPdf = h('button', { class: 'btn btn--secondary library-card__button', type: 'button' }, 'فتح PDF')
    originalPdf.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); downloadBytes(book.pdfData!, book.pdfFileName ?? `${book.title}.pdf`, 'application/pdf') })
    actions.appendChild(compactAction(originalPdf, 'فتح PDF الأصلي', 'book'))
  } else if (textualPdfAction === 'formatted') {
    const formattedPdf = h('button', { class: 'btn btn--secondary library-card__button', type: 'button' }, 'فتح PDF') as HTMLButtonElement
    formattedPdf.addEventListener('click', async event => {
      event.preventDefault(); event.stopPropagation(); formattedPdf.disabled = true; formattedPdf.setAttribute('aria-busy', 'true')
      try { toast('جارٍ تجهيز PDF المنسق…'); const { openFormattedBookPdf } = await import('../formatted_book_pdf'); await openFormattedBookPdf(book) }
      catch (error) { toast(error instanceof Error && error.message === 'formatted_pdf_text_unavailable' ? 'لا يتوفر نص صالح لإنشاء PDF لهذا الكتاب' : 'تعذّر إنشاء PDF المنسق الآن') }
      finally { formattedPdf.disabled = false; formattedPdf.removeAttribute('aria-busy') }
    })
    actions.appendChild(compactAction(formattedPdf, 'فتح PDF المنسق', 'book'))
  }
  if (!sourceIsPdf && !sourceIsText && !sourceIsEpub && !sourceIsHtml && !sourceIsBok && !needsPdfRefresh(book)) {
    const pdfButton = h('button', { class: 'btn btn--secondary library-card__button', type: 'button' }, 'تحميل PDF')
    pdfButton.addEventListener('click', (ev) => {
      ev.preventDefault(); ev.stopPropagation()
      downloadBytes(book.pdfData!, book.pdfFileName ?? `${book.title}.pdf`, 'application/pdf')
    })
    actions.appendChild(compactAction(pdfButton, 'تحميل PDF', 'book'))
  } else if (!sourceIsPdf && !sourceIsText && !sourceIsEpub && !sourceIsHtml && !sourceIsBok) {
    const retry = h('button', { class: 'btn btn--secondary library-card__button', type: 'button' },
      'إنشاء PDF') as HTMLButtonElement
    retry.textContent = book.pdfStatus === 'converting' ? 'PDF قيد الإنشاء…' : 'إنشاء PDF'
    retry.disabled = book.pdfStatus === 'converting'
    retry.title = 'إنشاء PDF من عرض المتصفح؛ قد يختلف عن ملف Word الأصلي.'
    retry.addEventListener('click', async (ev) => {
      ev.preventDefault(); ev.stopPropagation()
      retry.disabled = true
      retry.textContent = 'PDF قيد الإنشاء…'
      try {
        await convertStoredBookToPdf(book.id, 'browser')
        toast('تم إنشاء PDF من عرض المتصفح؛ قد يختلف عن ملف Word الأصلي.')
        window.dispatchEvent(new Event('library-changed'))
      } catch (error) {
        retry.disabled = false
        retry.textContent = 'إعادة محاولة PDF'
        toast(`تعذّر إنشاء PDF: ${error instanceof Error ? error.message : String(error)}`)
      }
    })
    actions.appendChild(compactAction(retry, 'إنشاء PDF', 'repeat'))
  }
  if (book.managedSource !== 'published') {
    const editButton = h('button', { class: 'btn btn--secondary library-card__button', type: 'button' }, 'تعديل الكتاب')
    editButton.addEventListener('click', (ev) => {
      ev.preventDefault(); ev.stopPropagation()
      openLibraryBookEditor(card, book)
    })
    actions.appendChild(compactAction(editButton, 'تعديل الكتاب', 'settings'))
  }
  let publishedEditorHost: HTMLElement | undefined
  if (book.managedSource === 'published') {
    actions.appendChild(compactAction(createBookIssueReportButton(book), 'إشارة خطأ', 'info'))
    const editorHost = h('section', { class: 'library-card__editor', hidden: true, 'aria-label': 'تعديل الكتاب' })
    const admin = publishedBookControls(book, editorHost)
    for (const button of admin.querySelectorAll<HTMLButtonElement>('button')) {
      compactAction(button, button.textContent === 'حذف' ? 'حذف الكتاب' : 'تعديل الكتاب', button.textContent === 'حذف' ? 'trash' : 'settings')
    }
    // Keep the controls attached to their lifecycle root; never move buttons out.
    if (admin.childElementCount) { actions.appendChild(admin); publishedEditorHost = editorHost }
  }

  body.appendChild(actions)
  if (options.compactPrivate) body.appendChild(h('small', { class: 'library-card__added-date' }, h('span', null, 'تاريخ الإضافة:'), ` ${new Date(book.addedAt).toLocaleDateString('ar-SA')}`))
  card.appendChild(body)
  if (publishedEditorHost) card.appendChild(publishedEditorHost)

  // زر حذف — فوق الرابط (z-index أعلى)
  const del = book.managedSource !== 'published' ? h('button', {
    class: 'library-card__delete',
    'aria-label': libraryBookActionLabel('delete', book.title),
  }, '✕') : undefined
  del?.addEventListener('click', async (ev) => {
    ev.preventDefault()
    ev.stopPropagation()
    if (!confirm(renderBoundUiTemplate('cd476924eb5da767',{p1:book.title},document.documentElement.lang||'ar'))) return
    await deleteBook(book.id)
    card.remove()
    window.dispatchEvent(new Event('library-changed'))
    toast('حُذف ✓')
  })
  if (del) {uiTemplateAttribute(del,'aria-label','4ddede69b2a201a4',{p1:book.title});card.appendChild(del)}
  uiTemplateAttribute(card.querySelector('.book-card__surface')!,'aria-label','c56b64ed45a736e3',{p1:book.title})
  for(const node of card.querySelectorAll<HTMLElement>('.book-card__ordinal')){
    uiTemplateAttribute(node,'aria-label','2ad0367328ba34be',{p1:ordinal.number})
    if(node.hasAttribute('title'))uiTemplateAttribute(node,'title','2ad0367328ba34be',{p1:ordinal.number})
  }

  return card
}

function managementSection(): HTMLElement {
  const resourceScope = captureRouteResourceScope()
  const section = h('section', { class: 'library-admin', 'aria-labelledby': 'library-admin-title' },
    h('div', { class: 'library-admin__intro' }, h('p', { class: 'page-eyebrow' }, 'إدارة مركزية'), h('h2', { id: 'library-admin-title' }, 'الكتب والمؤلفون والتصنيفات'), h('p', null, 'حدّد كتابًا أو عدة كتب، ثم طبّق البيانات المشتركة دفعة واحدة أو عدّل كل سجل منفردًا.')),
  )
  const content = silentSkeleton('cards')
  section.appendChild(content)
  const load = (): void => {
    content.replaceChildren(silentSkeleton('cards'))
    void listBooks().then((books) => renderManagement(content, books)).catch(() => mountStateView(content, { kind: 'error', title: 'تعذّر فتح مركز الإدارة', description: 'لم تتغير بيانات الكتب. أعد المحاولة.', actionLabel: 'إعادة المحاولة', onAction: load }))
  }
  routeEventListener(window, 'library-changed', load, undefined, resourceScope)
  load()
  return section
}

function renderManagement(root: HTMLElement, books: StoredBook[]): void {
  const shelfEditor = captureShelfStore()
  const selected = new Set<string>()
  const filters = h('div', { class: 'library-admin__filters', role: 'search', 'aria-label': 'تصفية الكتب الفورية' })
  const titleFilter = h('input', { type: 'search', placeholder: 'اسم الكتاب…', 'aria-label': 'تصفية باسم الكتاب' }) as HTMLInputElement
  const categoryFilter = categoryControl('تصفية حسب التصنيف', undefined, true)
  categoryFilter.firstElementChild!.textContent = 'كل التصنيفات'
  const stateFilter = h('select', { 'aria-label': 'تصفية حسب حالة المؤلف' },
    h('option', { value: '' }, 'كل المؤلفين'), h('option', { value: 'contemporary' }, 'المعاصرون'), h('option', { value: 'deceased' }, 'المتوفون')) as HTMLSelectElement
  const fromYear = h('input', { type: 'number', min: '1', max: '2000', placeholder: 'من سنة هـ', 'aria-label': 'سنة الوفاة من' }) as HTMLInputElement
  const toYear = h('input', { type: 'number', min: '1', max: '2000', placeholder: 'إلى سنة هـ', 'aria-label': 'سنة الوفاة إلى' }) as HTMLInputElement
  const filterStatus = h('strong', { class: 'library-admin__filter-status', 'aria-live': 'polite' })
  const clearAdminFilters = h('button', { type: 'button', class: 'btn btn--secondary' }, 'مسح مرشحات الإدارة')
  const exportCatalog = h('button', { type: 'button', class: 'btn btn--secondary' }, icon('download', 16), 'تصدير الفهرس CSV')
  exportCatalog.addEventListener('click', () => { downloadArtifact({ fileName: 'alkhizana-library-catalog.csv', mimeType: 'text/csv;charset=utf-8', content: libraryCatalogCsv(books) }); toast(`صُدر فهرس ${arabicCount(books.length)} كتاب`) })
  const importCatalogInput = makeProgrammaticFileInput(h('input', { type: 'file', accept: '.csv,text/csv' }) as HTMLInputElement)
  const importCatalog = h('button', { type: 'button', class: 'btn btn--secondary' }, 'استيراد تعديلات CSV') as HTMLButtonElement
  importCatalog.addEventListener('click', () => importCatalogInput.click())
  importCatalogInput.addEventListener('change', async () => {
    const file = importCatalogInput.files?.[0]; if (!file) return
    importCatalog.disabled = true
    try {
      const rows = parseLibraryCatalogCsv(await file.text()), known = bulkSelectableIds(books), applicable = rows.filter(row => known.has(row.id))
      if (!applicable.length) { toast('لا توجد معرفات كتب مطابقة في الملف'); return }
      await Promise.all(applicable.map(row => updateBookMetadata(row.id, row)))
      toast(`حُدثت بيانات ${arabicCount(applicable.length)} كتاب${rows.length > applicable.length ? ` · تُجاهل ${arabicCount(rows.length - applicable.length)} غير موجود` : ''}`)
      window.dispatchEvent(new CustomEvent('library-changed'))
    } catch (error) { toast(error instanceof Error ? error.message : 'تعذّر استيراد CSV') } finally { importCatalog.disabled = false; importCatalogInput.value = '' }
  })
  const adminParams = currentHashQuery()
  titleFilter.value = adminParams.get('adminQ') ?? ''
  categoryFilter.value = adminParams.get('adminCategory') ?? ''
  stateFilter.value = adminParams.get('adminAuthorState') ?? ''
  fromYear.value = adminParams.get('adminFrom') ?? ''
  toYear.value = adminParams.get('adminTo') ?? ''
  filters.append(titleFilter, categoryFilter, stateFilter, fromYear, toYear, clearAdminFilters, exportCatalog, importCatalog, importCatalogInput, filterStatus)
  const toolbar = h('form', { class: 'library-admin__bulk' })
  const selectionStatus = h('strong', null, 'لم تحدد كتبًا')
  const author = h('input', { type: 'text', placeholder: 'مؤلف موحد (اختياري)', 'aria-label': 'المؤلف الجماعي' }) as HTMLInputElement
  const death = h('input', { type: 'number', placeholder: 'الوفاة هـ', 'aria-label': 'سنة الوفاة الجماعية' }) as HTMLInputElement
  death.min = '1'; death.max = '2000'
  const contemporary = h('input', { type: 'checkbox' }) as HTMLInputElement
  const category = categoryControl('التصنيف الجماعي')
  category.appendChild(h('option', { value: '__clear_category__' }, 'مسح التصنيف'))
  const shelf = h('select', { 'aria-label': 'الرف الجماعي' }, h('option', { value: '' }, 'اختر رفًا…'), ...listShelves().map(item => h('option', { value: item.id }, item.name))) as HTMLSelectElement
  const shelfAction = h('select', { 'aria-label': 'إجراء الرف الجماعي' }, h('option', { value: 'add' }, 'إضافة إلى الرف'), h('option', { value: 'remove' }, 'إزالة من الرف'), h('option', { value: 'move' }, 'نقل إلى الرف')) as HTMLSelectElement
  const master = h('input', { type: 'checkbox', 'aria-label': 'تحديد كل نتائج التصفية' }) as HTMLInputElement
  const selectAll = h('button', { class: 'btn btn--secondary', type: 'button' }, 'تحديد كل نتائج التصفية') as HTMLButtonElement
  const clearSelection = h('button', { class: 'btn btn--secondary', type: 'button' }, 'مسح التحديد') as HTMLButtonElement
  const deleteSelected = h('button', { class: 'btn btn--secondary library-admin__bulk-delete', type: 'button' }, 'حذف المحدد') as HTMLButtonElement
  const apply = h('button', { class: 'btn btn--primary', type: 'submit' }, 'تطبيق على المحدد') as HTMLButtonElement
  toolbar.append(h('label', { class: 'library-admin__master' }, master, h('span', null, 'كل النتائج')), selectionStatus, selectAll, clearSelection, author, death, h('label', { class: 'import-contemporary' }, contemporary, h('span', null, 'معاصر')), category, shelfAction, shelf, apply, deleteSelected)
  const list = h('div', { class: 'library-admin__list' })
  let visibleIds = new Set<string>()
  let protectedVisibleCount = 0
  const updateStatus = (): void => {
    const selectedVisible = [...selected].filter(id => visibleIds.has(id)).length
    selectionStatus.textContent = selected.size
      ? `${arabicCount(selected.size)} كتاب محدد${protectedVisibleCount ? ` · ${arabicCount(protectedVisibleCount)} أصل مثبّت مستثنى` : ''}`
      : protectedVisibleCount ? `لا تحديد · ${arabicCount(protectedVisibleCount)} أصل مثبّت مستثنى` : 'لم تحدد كتبًا'
    apply.disabled = selected.size === 0; deleteSelected.disabled = selected.size === 0; clearSelection.disabled = selected.size === 0
    master.checked = visibleIds.size > 0 && selectedVisible === visibleIds.size
    master.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.size
    selectAll.disabled = visibleIds.size === 0 || selectedVisible === visibleIds.size
  }
  toolbar.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!shelfEditor.isCurrent() || !selected.size) return
    const values: BookMetadataUpdate = {}
    if (author.value.trim()) values.author = author.value.trim()
    if (category.value === '__clear_category__') values.category = null
    else if (category.value) values.category = category.value
    if (contemporary.checked) values.contemporary = true
    else if (Number(death.value) > 0) { values.contemporary = false; values.deathYearHijri = Number(death.value) }
    const hasShelfAction = Boolean(shelf.value)
    if (!Object.keys(values).length && !hasShelfAction) { toast('أدخل بيانات واحدة على الأقل لتطبيقها'); return }
    apply.disabled = true
    if (Object.keys(values).length) await Promise.all([...selected].map((id) => updateBookMetadata(id, values)))
    if (!shelfEditor.isCurrent()) return
    if (hasShelfAction) shelfEditor.save(bulkShelfUpdate(shelfEditor.list(), selected, shelf.value, shelfAction.value as 'add' | 'remove' | 'move'))
    toast(`حُدثت بيانات ${selected.size} كتاب`)
    window.dispatchEvent(new Event('library-changed'))
  })
  const rows: Array<{ book: StoredBook; row: HTMLElement }> = []
  for (const [index, book] of orderedBooks(books).entries()) {
    const ordinal = bookOrdinal(index)
    const check = h('input', { type: 'checkbox', 'aria-label': `تحديد ${book.title}`, ...(book.managedSource === 'published' ? { disabled: true } : {}) }) as HTMLInputElement
    uiTemplateAttribute(check,'aria-label','414c7bad9cc577a2',{p1:book.title})
    check.addEventListener('change', () => { check.checked ? selected.add(book.id) : selected.delete(book.id); updateStatus() })
    const deathLabel = isUnknownAuthorDeathYear(book.deathYearHijri) ? 'المؤلف مجهول' : book.contemporary ? 'معاصر' : displayableAuthorDeathYear(book.deathYearHijri) ? `${book.deathYearHijri}هـ` : 'الوفاة غير مدونة'
    const row = h('article', { class: 'library-admin__row', 'aria-label': `${ordinal.label}: ${book.title}` }, check,
      h('span', { class: 'book-card__ordinal', 'aria-hidden': 'true' }, arabicCount(ordinal.number)),
      h('div', { class: 'library-admin__summary' },
        h('strong', null, h('a', { href: `#/reader/${book.id}`, dataset: { noTranslate: '' } }, book.title)),
        h('small', null,
          authorLink(book.author, 'library-admin__author', book.authorId),
          document.createTextNode(' · '),
          categoryLink(effectiveBookCategory(book), 'library-admin__category'),
          document.createTextNode(` · ${deathLabel}`),
        ),
      ),
    )
    if (book.managedSource !== 'published') {
      const edit = h('button', { class: 'btn btn--secondary library-card__button', type: 'button' }, 'تعديل')
      edit.addEventListener('click', () => openLibraryBookEditor(row, book))
      row.appendChild(edit)
    } else row.appendChild(h('span', { class: 'library-card__managed' }, 'أصل مثبّت'))
    list.appendChild(row)
    rows.push({ book, row })
  }
  const syncChecks = (): void => { for (const { book, row } of rows) { const input = row.querySelector<HTMLInputElement>('input[type="checkbox"]'); if (input) input.checked = selected.has(book.id) } }
  const selectVisible = (): void => { selected.clear(); for (const id of visibleIds) selected.add(id); syncChecks(); updateStatus() }
  master.addEventListener('change', () => { if (master.checked) selectVisible(); else { for (const id of visibleIds) selected.delete(id); syncChecks(); updateStatus() } })
  selectAll.addEventListener('click', selectVisible)
  clearSelection.addEventListener('click', () => { selected.clear(); syncChecks(); updateStatus() })
  deleteSelected.addEventListener('click', async () => {
    if (!selected.size) return
    const chosen = books.filter(book => selected.has(book.id)), sample = chosen.slice(0, 3).map(book => `«${book.title}»`).join('، ')
    const prompt=`حذف ${arabicCount(chosen.length)} كتاب؟ ${sample}${chosen.length > 3 ? '…' : ''} لا يمكن التراجع عن هذا الحذف.`
    if (!confirm(await resolveUiLabel(prompt,document.documentElement.dataset.siteLanguage??'ar'))) return
    deleteSelected.disabled = true
    const report = await bulkDeleteBooks([...selected], deleteBook)
    toast(report.failed.length ? `حُذف ${arabicCount(report.deleted)} وتعذر حذف ${arabicCount(report.failed.length)}` : `حُذف ${arabicCount(report.deleted)} كتاب`)
    if (report.deleted) window.dispatchEvent(new CustomEvent('library-changed'))
  })
  if (!books.length) list.appendChild(stateView({ kind: 'empty', icon: 'book', title: 'لا توجد كتب لإدارتها', description: 'أضف كتاب Word أولًا لتظهر أدوات الإدارة.' }))
  const renderFiltered = (): void => {
    const query = titleFilter.value.trim().toLocaleLowerCase('ar')
    const from = Number(fromYear.value) || 0
    const to = Number(toYear.value) || Number.POSITIVE_INFINITY
    let visible = 0
    const visibleBooks: StoredBook[] = []
    for (const { book, row } of rows) {
      const year = displayableAuthorDeathYear(book.deathYearHijri) ?? 0
      const matches = (!query || book.title.toLocaleLowerCase('ar').includes(query))
        && matchesCategoryFilter(effectiveBookCategory(book), categoryFilter.value)
        && (!stateFilter.value || (stateFilter.value === 'contemporary' ? book.contemporary : !book.contemporary))
        && (!from || (!book.contemporary && year >= from))
        && (!Number.isFinite(to) || (!book.contemporary && year <= to))
      row.hidden = !matches
      if (matches) { visible++; visibleBooks.push(book) }
    }
    const nextVisible = bulkSelectableIds(visibleBooks)
    protectedVisibleCount = visibleBooks.length - nextVisible.size
    reconcileBulkSelection(selected, nextVisible)
    visibleIds = nextVisible
    syncChecks(); updateStatus()
    filterStatus.textContent = `${arabicCount(visible)} من ${arabicCount(books.length)} كتاب${protectedVisibleCount ? ` · ${arabicCount(protectedVisibleCount)} أصل مثبّت` : ''}`
  }
  const syncAdminFilters = (): void => {
    replaceHashQuery({ adminQ: titleFilter.value.trim(), adminCategory: categoryFilter.value, adminAuthorState: stateFilter.value, adminFrom: fromYear.value, adminTo: toYear.value })
    renderFiltered()
  }
  for (const control of [titleFilter, categoryFilter, stateFilter, fromYear, toYear])
    control.addEventListener(control instanceof HTMLInputElement ? 'input' : 'change', syncAdminFilters)
  clearAdminFilters.addEventListener('click', () => { titleFilter.value = ''; categoryFilter.value = ''; stateFilter.value = ''; fromYear.value = ''; toYear.value = ''; syncAdminFilters(); titleFilter.focus() })
  root.className = ''
  root.removeAttribute('role')
  root.replaceChildren(filters, toolbar, list)
  updateStatus()
  renderFiltered()
}

/** نافذة تعديل واحدة تُستعمل من المكتبة ومن بطاقة الكتاب داخل القارئ. */
export function openLibraryBookEditor(row: HTMLElement, book: StoredBook, onSaved?: (book: StoredBook) => void): void {
  const opened = document.querySelector<HTMLDialogElement>('.library-book-editor')
  if (opened) { opened.close(); opened.remove() }
  const dialog = h('dialog', { class: 'library-book-editor', 'aria-labelledby': 'library-book-editor-title' }) as HTMLDialogElement
  const form = h('form', { class: 'library-admin__editor' })
  form.append(h('header', { class: 'library-book-editor__header' },
    h('div', null, h('p', { class: 'page-eyebrow' }, 'كتبي الخاصة'), h('h2', { id: 'library-book-editor-title' }, uiTemplateText('bea8f9ea274b5a20',{p1:book.title}))),
    h('button', { class: 'library-book-editor__close', type: 'button', 'aria-label': 'إغلاق', onclick: () => dialog.close() }, icon('close', 20)),
  ))
  const title = h('input', { type: 'text', value: book.title, 'aria-label': 'عنوان الكتاب' }) as HTMLInputElement
  const author = h('input', { type: 'text', value: book.author, 'aria-label': 'المؤلف' }) as HTMLInputElement
  const death = h('input', { type: 'number', value: displayableAuthorDeathYear(book.deathYearHijri) ? String(book.deathYearHijri) : '', placeholder: 'الوفاة هـ', 'aria-label': 'سنة الوفاة الهجرية' }) as HTMLInputElement
  const contemporary = h('input', { type: 'checkbox' }) as HTMLInputElement
  contemporary.checked = Boolean(book.contemporary)
  const category = categoryControl('التصنيف', effectiveBookCategory(book), true)
  const publisher = h('input', { type: 'text', value: book.publisher ?? '', placeholder: 'الناشر', 'aria-label': 'الناشر' }) as HTMLInputElement
  const edition = h('input', { type: 'text', value: book.edition ?? '', placeholder: 'الطبعة', 'aria-label': 'الطبعة' }) as HTMLInputElement
  const investigator = h('input', { type: 'text', value: book.investigator ?? '', placeholder: 'المحقق أو المراجع', 'aria-label': 'المحقق أو المراجع' }) as HTMLInputElement
  const publicationYear = h('input', { type: 'number', min: '1', max: '2000', value: book.publicationYearHijri ? String(book.publicationYearHijri) : '', placeholder: 'سنة النشر هـ', 'aria-label': 'سنة النشر الهجرية' }) as HTMLInputElement
  const description = h('textarea', { placeholder: 'وصف موجز للكتاب', 'aria-label': 'وصف الكتاب' }, book.description ?? '') as HTMLTextAreaElement
  const seriesName = h('input', { type: 'text', value: book.seriesName ?? '', placeholder: 'اسم السلسلة العلمية', 'aria-label': 'اسم السلسلة العلمية' }) as HTMLInputElement
  const seriesOrder = h('input', { type: 'number', min: '1', value: book.seriesOrder ? String(book.seriesOrder) : '', placeholder: 'ترتيب الكتاب في السلسلة', 'aria-label': 'ترتيب الكتاب في السلسلة' }) as HTMLInputElement
  const replacement = makeProgrammaticFileInput(h('input', { type: 'file', accept: '.docx,.doc,.rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/rtf,text/rtf' }) as HTMLInputElement)
  const replacementButton = h('button', { class: 'btn btn--secondary library-card__button', type: 'button' }, 'استبدال ملف Word') as HTMLButtonElement
  const replacementStatus = h('small', { class: 'library-admin__replacement-status' }, 'اختياري — يحتفظ باسم الكتاب وبياناته')
  const coverReplacement = makeProgrammaticFileInput(h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' }) as HTMLInputElement)
  const coverButton = h('button', { class: 'btn btn--secondary library-card__button', type: 'button' }, 'استبدال الغلاف') as HTMLButtonElement
  const removeCover = h('input', { type: 'checkbox', 'aria-label': 'إزالة الغلاف الحالي واستخدام الغلاف المولّد' }) as HTMLInputElement
  const coverStatus = h('small', { class: 'library-admin__replacement-status' }, 'PNG أو JPEG أو WebP حتى 5MB')
  coverButton.addEventListener('click', () => coverReplacement.click())
  coverReplacement.addEventListener('change', () => { coverStatus.textContent = coverReplacement.files?.[0] ? `الغلاف البديل: ${coverReplacement.files[0].name}` : 'PNG أو JPEG أو WebP حتى 5MB' })
  replacementButton.addEventListener('click', () => replacement.click())
  replacement.addEventListener('change', () => {
    const file = replacement.files?.[0]
    if (!file) return
    replacementStatus.textContent = isWordFile(file) ? `البديل: ${file.name}` : 'الملف المختار ليس DOCX أو DOC أو RTF'
  })
  const sync = (): void => { death.disabled = contemporary.checked }
  contemporary.addEventListener('change', sync); sync()
  const save = h('button', { class: 'btn btn--primary library-card__button', type: 'submit' }, 'حفظ') as HTMLButtonElement
  const saveAndReturn = h('button', { class: 'btn btn--secondary library-card__button', type: 'submit', dataset: { saveAndClose: 'true' } }, 'حفظ وعودة') as HTMLButtonElement
  form.append(title, author, death, h('label', { class: 'import-contemporary' }, contemporary, h('span', null, 'معاصر')), category,
    publisher, edition, investigator, publicationYear, seriesName, seriesOrder, description,
    h('div', { class: 'library-admin__replacement' }, replacement, replacementButton, replacementStatus),
    h('div', { class: 'library-admin__replacement' }, coverReplacement, coverButton, coverStatus, h('label', null, removeCover, h('span', null, 'إزالة الغلاف الحالي واستخدام الغلاف المولّد'))),
    independentPdfPanel(book),
    save,
    saveAndReturn,
    h('button', { class: 'btn btn--secondary library-card__button', type: 'button', onclick: () => dialog.close() }, 'إلغاء'))
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const closeAfterSave = (event as SubmitEvent).submitter instanceof HTMLElement
      && (event as SubmitEvent).submitter?.dataset.saveAndClose === 'true'
    if (!title.value.trim() || !author.value.trim() || (!contemporary.checked && !(Number(death.value) > 0))) { toast('العنوان والمؤلف والوفاة أو «معاصر» مطلوبة'); return }
    const values: BookMetadataUpdate = {
      title: title.value, author: author.value, category: category.value === UNCATEGORIZED_CATEGORY ? null : category.value, contemporary: contemporary.checked,
      publisher: publisher.value, edition: edition.value, investigator: investigator.value,
      description: description.value, seriesName: seriesName.value, seriesOrder: Number(seriesOrder.value) > 0 ? Number(seriesOrder.value) : null,
    }
    if (Number(publicationYear.value) > 0) values.publicationYearHijri = Number(publicationYear.value)
    if (!contemporary.checked) values.deathYearHijri = Number(death.value)
    const coverFile = coverReplacement.files?.[0]
    if (removeCover.checked && coverFile) { coverButton.focus(); toast('اختر استبدال الغلاف أو إزالته، لا الخيارين معًا'); return }
    if (coverFile) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(coverFile.type) || !coverFile.size || coverFile.size > 5 * 1024 * 1024) { coverButton.focus(); toast('الغلاف يجب أن يكون PNG أو JPEG أو WebP وألا يتجاوز 5MB'); return }
      await replaceBookCover(book.id, { data: new Uint8Array(await coverFile.arrayBuffer()), mimeType: coverFile.type })
    } else if (removeCover.checked) await replaceBookCover(book.id)
    const file = replacement.files?.[0]
    if (file) {
      if (!isWordFile(file)) { toast('اختر ملف Word صالحًا: DOCX أو DOC أو RTF'); return }
      replacementButton.disabled = true
      replacementButton.setAttribute('aria-busy', 'true')
      replacementStatus.textContent = ''
      try {
        const source = new Uint8Array(await file.arrayBuffer())
        const legacy = /\.(doc|rtf)$/i.test(file.name)
        const data = legacy ? await (await import('../book_import')).normalizeLegacyWord(source, file.name) : source
        const cover = (await import('@library/word-cover')).discoverWordCover(data)
        await replaceBookWord(book.id, {
          fileName: file.name, data,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ...(legacy ? { sourceData: source, sourceMimeType: file.type || (/\.rtf$/i.test(file.name) ? 'application/rtf' : 'application/msword') } : {}),
          ...(cover ? { coverMediaPath: cover.mediaPath } : {}),
          coverHue: deterministicCoverHue(`${title.value.trim()}|${file.name}`),
        })
      } catch (error) {
        replacementButton.disabled = false
        replacementButton.removeAttribute('aria-busy')
        replacementStatus.textContent = 'لم تُستبدل النسخة الحالية'
        toast(`تعذّر استبدال Word: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
    }
    try {
      await updateBookMetadata(book.id, values)
      const saved = await getBook(book.id)
      if (!saved) throw new Error('تعذّر قراءة الكتاب بعد الحفظ')
      // حدّث المرجع الذي تعرضه البطاقة الحالية فورًا، ثم دع حدث المكتبة
      // يعيد بناء الفهارس والعدادات في الخلفية.
      Object.assign(book, saved)
      onSaved?.(saved)
      toast('تم حفظ تعديلات الكتاب')
      window.dispatchEvent(new Event('library-changed'))
      if (closeAfterSave) dialog.close()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذّر حفظ تعديلات الكتاب')
      return
    }
    if (file) void getRuntimeCapabilities().then(capabilities => {
      if (capabilities.wordPdfConversionAvailable) return convertStoredBookToPdf(book.id).then(() => window.dispatchEvent(new Event('library-changed')))
    }).catch(() => undefined)
  })
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close() })
  dialog.addEventListener('close', () => { dialog.remove(); row.focus?.() })
  dialog.appendChild(form)
  document.body.appendChild(dialog)
  dialog.showModal()
  title.focus()
}

function showPublishedCategoryEditor(row: HTMLElement, book: StoredBook): void {
  if (row.querySelector('.library-admin__category-editor')) return
  const form = h('form', { class: 'library-admin__category-editor' })
  const category = categoryControl('تصنيف الكتاب', effectiveBookCategory(book), true)
  form.append(category,
    h('button', { class: 'btn btn--primary', type: 'submit' }, 'حفظ التصنيف'),
    h('button', { class: 'btn btn--secondary', type: 'button', onclick: () => form.remove() }, 'إلغاء'))
  form.addEventListener('submit', event => {
    event.preventDefault()
    void updateBookMetadata(book.id, { category: category.value === UNCATEGORIZED_CATEGORY ? null : category.value }).then(() => {
      toast('حُفظ تصنيف الكتاب'); window.dispatchEvent(new Event('library-changed'))
    }).catch(error => toast(error instanceof Error ? error.message : 'تعذّر حفظ التصنيف'))
  })
  row.appendChild(form)
}

function categoryControl(label: string, selected?: string, allowUncategorized = false): HTMLSelectElement {
  const select = h('select', { 'aria-label': label }) as HTMLSelectElement
  select.appendChild(h('option', { value: '' }, 'اختر التصنيف…'))
  if (allowUncategorized) select.appendChild(h('option', { value: UNCATEGORIZED_CATEGORY, selected: selected === UNCATEGORIZED_CATEGORY || selected === 'غير مصنف' }, 'غير مصنف'))
  for (const value of BOOK_CATEGORIES) select.appendChild(h('option', { value, selected: value === selected }, value))
  return select
}

function arabicCount(value: number): string {
  return value.toLocaleString('ar-SA')
}

// ---------- تصفح المؤلفين ----------

export function authorsScreen(): HTMLElement {
  const resourceScope = captureRouteResourceScope()
  if(currentHashQuery().get('create')==='1'){
    return pageContent(h('a',{href:'#/authors'},'المؤلفون ←'),h('h1',{class:'page-title'},'إضافة مؤلف'),unifiedAuthorForm({canPublish:canEditCentralAuthors(),onCancel:()=>{routeLocation.hash='#/authors'},onSave:async draft=>{
      if(draft.publishPublic){
        if(!canEditCentralAuthors())throw Error('لا تملك صلاحية النشر العام.')
        const result=await saveCentralAuthor({displayName:draft.displayName,biography:draft.biography,fields:draft.fields,deathYearHijri:draft.fields.deathHijri??null,contemporary:draft.contemporary})
        routeLocation.hash='#/people/'+encodeURIComponent(result.authorId)
      }else{
        const id=await saveAuthor({name:draft.displayName,aliases:draft.fields.knownAs??[],biography:draft.biography,structuredFields:draft.fields,...(draft.fields.birthHijri!=null?{birthYearHijri:draft.fields.birthHijri}:{}),...(draft.fields.deathHijri!=null?{deathYearHijri:draft.fields.deathHijri}:{}),contemporary:draft.contemporary,teachers:draft.fields.teachers??[],students:draft.fields.students??[],works:draft.fields.works??[],country:draft.fields.places?.join('، ')??''})
        routeLocation.hash=localPeopleHref(id)??authorHref(id)
      }
    }}))
  }
  const root = pageContent(
    sectionServiceHero({
      title: 'المؤلفون',
      description: 'ابحث في تراجم المؤلفين، ثم افتح كتب كل مؤلف الموجودة فعلًا في خزانتك.',
      titleId: 'authors-title',
      className: 'authors-hero',
      variant: 'authors',
    }),
  )
  const section = h('section', { class: 'authors-section', 'aria-label': 'دليل المؤلفين' })
  const facet = currentHashQuery().get('facet'), facetValue = currentHashQuery().get('value')?.trim() ?? ''
  if (facet === 'place' || facet === 'trait') {
    section.append(silentSkeleton('cards'))
    root.appendChild(section)
    if(facetValue) void loadPeopleFacetResults(section, facet, facetValue)
    else void loadPeopleFacetDirectory(section,facet,resourceScope)
    return root
  }
  section.append(h('div', { class: 'authors-controls' }, h('div', { class: 'authors-controls__filter library-search' }, icon('search', 19), h('input', { type: 'search', placeholder: 'ابحث عن مؤلف…', 'aria-label': 'تصفية المؤلفين', disabled: true }))), h('div', { class: 'authors-summary authors-summary--loading', role: 'status' }, 'جارٍ تحميل دليل المؤلفين…'))
  root.appendChild(section)
  void loadAuthors(section, resourceScope)
  return root
}

async function loadPeopleFacetDirectory(section:HTMLElement,kind:PeopleFacetKind,scope=captureRouteResourceScope()):Promise<void>{
  try{
    const records=await loadCurrentPeopleFacetRecords();if(scope.disposed)return
    let rows=peopleFacetDirectory(records,kind)
    const list=h('ul',{class:'people-facet__list'}),status=h('span',{class:'people-facet__badge',role:'status','aria-live':'polite'}),more=h('button',{type:'button',class:'btn btn--secondary'},'عرض المزيد')
    const input=h('input',{type:'search','aria-label':'البحث في الفهرس',placeholder:'ابحث في الفهرس…'}) as HTMLInputElement
    let limit=100
    const render=()=>{const query=normalizePeopleFacet(input.value),matches=rows.filter(row=>normalizePeopleFacet(row.label).includes(query));list.replaceChildren(...matches.slice(0,limit).map(row=>h('li',null,h('a',{href:peopleFacetHref(kind,row.label)},h('span',{dataset:{noTranslate:''}},row.label),h('small',{class:'people-facet__card-count'},uiTemplateText('255b993e326f5f1c',{p1:row.authorCount}))))));status.replaceChildren(query?uiTemplateText('3c57cd7ed4ada710',{p1:matches.length,p2:rows.length}):uiTemplateText('ee506bb871220daa',{p1:rows.length}));more.hidden=matches.length<=limit}
    routeEventListener(input,'input',()=>{limit=100;render()},undefined,scope)
    routeEventListener(more,'click',()=>{limit+=100;render()},undefined,scope)
    section.classList.add('people-facet')
    watchPeopleFacetRefresh(scope,async()=>{const next=await loadCurrentPeopleFacetRecords();if(!scope.disposed){rows=peopleFacetDirectory(next,kind);render()}},()=>{status.textContent='تعذّر تحديث الفهرس؛ المعروض آخر نسخة محمّلة.'})
    section.replaceChildren(h('div',{class:'people-facet__title-row'},h('h2',null,kind==='place'?'فهرس الأماكن':'فهرس الصفات والتصنيفات'),status),h('div',{class:'library-search'},icon('search',19),input),list,more);render()
  }catch{if(!scope.disposed)section.replaceChildren(stateView({kind:'error',title:'تعذّر تحميل الفهرس',actionLabel:'إعادة المحاولة',onAction:()=>{void loadPeopleFacetDirectory(section,kind,scope)}}))}
}

const facetResultGenerations=new WeakMap<HTMLElement,number>()
async function loadPeopleFacetResults(section: HTMLElement, kind: PeopleFacetKind, value: string, scope=captureRouteResourceScope(),watch=true): Promise<void> {
  const identity=currentLibraryIdentityScope()
  const ticket=(facetResultGenerations.get(section)??0)+1;facetResultGenerations.set(section,ticket)
  const current=()=>!scope.disposed&&facetResultGenerations.get(section)===ticket
  try {
    const [index, records] = await Promise.all([loadShamelaAuthorMetadata(), loadCurrentPeopleFacetRecords()])
    if(!current())return
    const matchingIds = new Set(filterTarajmFacetRecords(records, kind, value).map(record => String(Number(record.shamelaAuthorId))))
    const authors = index.authors.filter(author => matchingIds.has(String(Number(author.authorId))))
    const authorIds = new Set(authors.flatMap(author => [author.id, author.authorId, `shamela-${author.authorId}`]))
    const catalogBooks = authors.flatMap(author => author.books.map(book => ({ id: book.id, title: book.title })))
    const renderResults=(localBooks:StoredBook[])=>{
    const storedBooks = localBooks.filter(book => {
      const refs = book.authors?.length ? book.authors : [{ name: book.author, ...(book.authorId ? { id: book.authorId } : {}) }]
      return refs.some(ref => Boolean(ref.id && authorIds.has(ref.id)))
    }).map(book => ({ id: book.id, title: book.title }))
    const books = [...new Map([...catalogBooks, ...storedBooks].map(book => [book.id, book])).values()]
    const label = kind === 'place' ? 'المكان' : 'الصفة أو التصنيف'
    const summary = h('header', { class: 'people-facet__header' },
      h('a', { href: '#/authors', class: 'page-eyebrow' }, 'المؤلفون ←'),
      h('h2', null, h('span',null,label), ': ', h('span',{dataset:{noTranslate:''}},value)),
      h('div', { class: 'people-facet__counts', role: 'status' },
        h('span', null, h('strong', null, arabicCount(authors.length)), ' مؤلف'),
        h('span', null, h('strong', null, arabicCount(books.length)), ' كتاب')))
    const placeMapId = kind === 'place' ? resolveAuthorPlaceMap(value) : undefined
    if (placeMapId) {
      const heading = h('div', { class: 'people-facet__heading' }, ...Array.from(summary.childNodes))
      summary.classList.add('people-facet__header--mapped')
      summary.replaceChildren(heading, authorPlaceMapWidget(placeMapId))
    }
    const authorList = h('section', { class: 'people-facet__group' }, h('h3', null, 'المؤلفون'),
      authors.length ? h('ul', { class: 'people-facet__list' }, ...authors.map(author => h('li', null, h('a', { href: peopleHref(author.authorId)!, dataset:{noTranslate:''} }, author.name)))) : h('p', null, 'لا يوجد مؤلف مطابق.'))
    const bookList = h('section', { class: 'people-facet__group' }, h('h3', null, 'الكتب'),
      books.length ? h('ul', { class: 'people-facet__list people-facet__list--books' }, ...books.map(book => h('li', null, h('a', { href: `#/book/${encodeURIComponent(book.id)}`, dataset:{noTranslate:''} }, book.title)))) : h('p', null, 'لا توجد كتب مرتبطة بهذه النتيجة.'))
    section.classList.add('people-facet')
    section.replaceChildren(summary, authorList, bookList)
    }
    renderResults([])
    if(watch)watchPeopleFacetRefresh(scope,()=>loadPeopleFacetResults(section,kind,value,scope,false))
    void listBooks().then(localBooks=>{if(current()&&section.isConnected&&identity===currentLibraryIdentityScope())renderResults(localBooks)}).catch(()=>{/* Public results remain usable without local storage. */})
  } catch {
    if(!current())return
    section.replaceChildren(stateView({ kind: 'error', title: 'تعذّر فتح نتائج التصفح', actionLabel: 'دليل المؤلفين', href: '#/authors' }))
  }
}

async function loadAuthors(section: HTMLElement, resourceScope = captureRouteResourceScope()): Promise<void> {
  try {
    const index = await loadShamelaAuthorMetadata()
    if (resourceScope.disposed) return
    const entries = index.authors.map(entry => ({ author: indexAuthorRecord(entry), bookCount: entry.bookCount }))
    const canonicalIds = new Set(entries.flatMap(entry => [entry.author.id, entry.author.shamelaId].filter((id): id is string => Boolean(id))))
    const canonicalNames = new Set(entries.map(entry => entry.author.canonicalName))
    const controls = h('div', { class: 'authors-controls' })
    const search = h('div', { class: 'library-search' }, icon('search', 19))
    const input = h('input', { type: 'search', placeholder: 'ابحث عن مؤلف…', 'aria-label': 'تصفية المؤلفين' }) as HTMLInputElement
    const authorParams = currentHashQuery()
    input.value = authorParams.get('name') ?? ''
    search.appendChild(input)
    const ownersOnly = h('input', { type: 'checkbox', 'aria-label': 'عرض أصحاب الكتب فقط' }) as HTMLInputElement
    ownersOnly.checked = authorParams.get('owners') === 'books'
    const ownersFilter = h('label', { class: 'authors-owners-filter' }, ownersOnly, h('span', null, 'عرض أصحاب الكتب فقط'))
    const summary = h('div', { class: 'authors-summary', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' })
    const addAuthorButton = h('button', { class: 'btn btn--primary', type: 'button' }, icon('plus', 17), 'إضافة مؤلف')
    const sort = h('select', { class: 'authors-sort-select', 'aria-label': 'ترتيب المؤلفين' },
      h('option', { value: 'death-asc' }, 'الوفاة: الأقدم أولًا'),
      h('option', { value: 'death-desc' }, 'الوفاة: الأحدث أولًا'),
      h('option', { value: 'name' }, 'الاسم هجائيًا'),
    ) as HTMLSelectElement
    sort.value = authorParams.get('sort') ?? 'death-asc'
    addAuthorButton.addEventListener('click', () => {
      routeLocation.hash='#/authors?create=1'
    })
    const grid = h('div', { class: 'authors-grid' })
    const addButtons=h('div',{class:'authors-add-actions'},addAuthorButton)
    const syncPublicAdd=()=>{
      addButtons.querySelector('[data-public-author-add]')?.remove()
    }
    syncPublicAdd();routeEventListener(window,'alkhizana:account-changed',syncPublicAdd,undefined,resourceScope)
    controls.append(h('div', { class: 'authors-controls__filter' }, search, ownersFilter, sort), h('div', { class: 'authors-controls__actions' }, summary, addButtons))
    const BATCH_SIZE = 80
    let visibleCount = BATCH_SIZE
    let observer: IntersectionObserver | undefined
    resourceScope.add(() => observer?.disconnect())
    const render = (reset = false): void => {
      if (reset) visibleCount = BATCH_SIZE
      observer?.disconnect()
      const matching = filterAuthorEntries(entries.map(entry => ({ value: entry, name: entry.author.name, aliases: entry.author.aliases, bookCount: entry.bookCount })), input.value, ownersOnly.checked).map(entry => entry.value)
      const ordered = sortAuthorDirectoryEntries(matching, sort.value as AuthorDirectorySort, entry => entry.author)
      const visible = ordered.slice(0, visibleCount)
      const totalBooks = matching.reduce((sum, entry) => sum + Math.max(0,entry.bookCount), 0)
      const sortLabel = sort.value === 'name' ? 'مرتب هجائيًا' : sort.value === 'death-desc' ? 'الوفيات: الأحدث أولًا' : 'الوفيات: الأقدم أولًا'
      uiTemplateAttribute(summary, 'aria-label', '22b0f5eda25014ed', { p1: matching.length, p2: totalBooks, p3: visible.length, p4: matching.length, p5: uiLabelParameter(sortLabel) })
      summary.replaceChildren(
        h('span', { class: 'authors-summary__chip' }, h('strong', null, arabicCount(matching.length)), h('small', null, 'مؤلف')),
        h('span', { class: 'authors-summary__chip' }, h('strong', null, arabicCount(totalBooks)), h('small', null, 'كتاب')),
        h('span', { class: 'authors-summary__chip' }, h('strong', null, `${arabicCount(visible.length)} / ${arabicCount(matching.length)}`), h('small', null, 'ظاهر')),
      )
      grid.replaceChildren(...visible.map(({ author, bookCount }) => authorCard(author, bookCount)))
      if (!visible.length) {
        const hasQuery = Boolean(input.value.trim())
        grid.replaceChildren(stateView(entries.length ? {
          kind: 'no-results', icon: 'search',
          title: hasQuery ? 'لا يوجد اسم مؤلف يحتوي هذا الجزء' : 'لا يوجد مؤلف له كتب ضمن الفهرس الحالي',
          description: hasQuery ? 'جرّب جزءًا آخر من الاسم أو كنية مسجلة.' : 'ألغِ «عرض أصحاب الكتب فقط» لإظهار جميع سجلات المؤلفين.',
        } : { kind: 'empty', icon: 'person', title: 'لا توجد بيانات مؤلفين بعد', description: 'ستظهر السجلات عند إضافة الكتب أو استيراد الفهرس.' }))
      } else if (visible.length < matching.length) {
        const more = h('button', { class: 'authors-load-more btn btn--secondary', type: 'button' }, `عرض المزيد (${matching.length - visible.length} متبقٍ)`)
        more.addEventListener('click', () => { visibleCount = nextAuthorVisibleCount(visibleCount, matching.length, BATCH_SIZE); render() })
        const sentinel = h('div', { class: 'authors-load-sentinel', 'aria-label': 'تحميل المزيد من المؤلفين' }, more)
        grid.appendChild(sentinel)
        if ('IntersectionObserver' in window) {
          observer = routeObserver(new IntersectionObserver(records => {
            if (records.some(record => record.isIntersecting)) { observer?.disconnect(); visibleCount = nextAuthorVisibleCount(visibleCount, matching.length, BATCH_SIZE); render() }
          }, { rootMargin: '320px' }), resourceScope)
          observer.observe(sentinel)
        }
      }
    }
    const syncAuthorFilters = (): void => { replaceHashQuery({ name: input.value.trim(), owners: ownersOnly.checked ? 'books' : null, sort: sort.value === 'death-asc' ? null : sort.value }); render(true) }
    input.addEventListener('input', syncAuthorFilters)
    ownersOnly.addEventListener('change', syncAuthorFilters)
    sort.addEventListener('change', syncAuthorFilters)
    if (resourceScope.disposed) return
    section.replaceChildren(controls, grid)
    const centralController=new AbortController();resourceScope.add(()=>centralController.abort())
    let centralPage=0
    const centralMore=h('button',{type:'button',class:'btn btn--secondary'},'عرض مزيد من المؤلفين') as HTMLButtonElement
const enrichCentral=async()=>{centralMore.disabled=true;try{const result=await loadCentralAuthors(centralPage,centralController.signal);if(resourceScope.disposed||!section.contains(controls))return;for(const row of result.authors){if(canonicalIds.has(row.authorId))continue;entries.push({author:{id:row.authorId,name:row.displayName,canonicalName:normalizeArabicAuthorName(row.displayName),aliases:[],createdAt:0,updatedAt:0,...(row.deathYearHijri!==null?{deathYearHijri:row.deathYearHijri}:{}),contemporary:row.contemporary},bookCount:-1});canonicalIds.add(row.authorId)}centralPage++;centralMore.hidden=!result.hasMore;render()}catch{centralMore.hidden=false;centralMore.textContent='إعادة تحميل بقية المؤلفين'}finally{centralMore.disabled=false}}
    centralMore.hidden=true;centralMore.onclick=()=>void enrichCentral();section.append(centralMore);void enrichCentral()
    render()
    // The complete public author index is already usable. Never hold its first
    // render behind IndexedDB or synchronization of the full book catalog.
    void Promise.all([listAuthorRecords(false), listBooks()]).then(([localAuthors, localBooks]) => {
      if (resourceScope.disposed || !section.isConnected) return
      if (!section.contains(controls)) return
      for (const author of localAuthors) {
        if (canonicalIds.has(author.id) || (author.shamelaId && canonicalIds.has(author.shamelaId)) || canonicalNames.has(author.canonicalName)) continue
        const bookCount = localBooks.filter(book => (book.authors?.some(ref => ref.id === author.id) ?? false) || book.authorId === author.id || (!book.authorId && normalizeArabicAuthorName(book.author) === author.canonicalName)).length
        entries.push({ author, bookCount })
        canonicalIds.add(author.id); canonicalNames.add(author.canonicalName)
      }
      render()
    }).catch(error => {
      console.warn('authors_local_enrichment_failed', error)
      if (resourceScope.disposed || !section.isConnected) return
      if (!section.contains(controls)) return
      section.append(h('p', { role: 'status' }, 'تعذّر تحديث بيانات المؤلفين المحليين؛ بقي الفهرس العام ظاهرًا.'))
    })
  } catch (error) {
    console.error('authors_directory_failed', error)
    const code = error instanceof Error && /^shamela_author_index_[a-z0-9_]+$/u.test(error.message) ? error.message.replace('shamela_author_index_', 'فهرس-') : 'دليل-المؤلفين'
    if (!resourceScope.disposed) section.replaceChildren(stateView({ kind: 'error', title: 'تعذّر إعداد دليل المؤلفين', description: `أعد المحاولة دون فقد بياناتك. رمز التشخيص: ${code}`, actionLabel: 'إعادة المحاولة', onAction: () => void loadAuthors(section, resourceScope) }))
  }
}

function authorMergePanel(authors: StoredAuthor[], section: HTMLElement): HTMLElement {
  section.querySelector('.author-merge')?.remove()
  const option = (author: StoredAuthor): HTMLOptionElement => bindAuthorDisplayName(h('option', { value: author.id }, author.name) as HTMLOptionElement,author.id,author.name)
  const primary = h('select', { 'aria-label': 'السجل الأساس الذي سيبقى' }, ...authors.map(option)) as HTMLSelectElement
  const duplicate = h('select', { 'aria-label': 'السجل المكرر الذي سيُدمج' }, ...authors.map(option)) as HTMLSelectElement
  if (authors[1]) duplicate.value = authors[1].id
  const status = h('p', { class: 'author-merge__status', 'aria-live': 'polite' }, 'ستُنقل الكتب والأسماء البديلة والبيانات إلى السجل الأساس.')
  const form = h('form', { class: 'author-merge' },
    h('div', { class: 'author-merge__head' }, h('div', null, h('h2', null, 'دمج مؤلفين متكررين'), status), h('button', { type: 'button', class: 'btn btn--secondary', onclick: () => form.remove() }, 'إلغاء')),
    h('div', { class: 'author-merge__fields' }, authorField('السجل الأساس (يبقى)', primary), authorField('السجل المكرر (يُحذف)', duplicate)),
    h('button', { type: 'submit', class: 'btn btn--primary' }, 'مراجعة ثم دمج'),
  )
  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (primary.value === duplicate.value) { toast('اختر سجلين مختلفين'); return }
    const primaryName = authors.find(author => author.id === primary.value)?.name ?? ''
    const duplicateName = authors.find(author => author.id === duplicate.value)?.name ?? ''
    if (!confirm(renderBoundUiTemplate('6f78704dbd925377',{p1:primaryName,p2:duplicateName},document.documentElement.lang||'ar'))) return
    const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement
    submit.disabled = true; submit.setAttribute('aria-busy', 'true'); status.textContent = ''
    try {
      await mergeAuthors(primary.value, duplicate.value)
      toast('دُمج سجلا المؤلف ونُقلت الكتب بنجاح')
      await loadAuthors(section)
      window.dispatchEvent(new Event('library-changed'))
    } catch (error) {
      submit.disabled = false; submit.removeAttribute('aria-busy')
      status.textContent = error instanceof Error ? error.message : 'تعذّر دمج السجلين'
    }
  })
  return form
}

function indexAuthorRecord(author: ShamelaAuthorIndexEntry): StoredAuthor {
  return { id: author.id, shamelaId: author.authorId, get name(){return author.name}, get canonicalName(){return normalizeArabicAuthorName(author.name)}, aliases: [], ...(author.deathYearHijri != null ? { deathYearHijri: author.deathYearHijri } : {}), ...(author.contemporary != null ? { contemporary: author.contemporary } : {}), ...(author.biography ? { biography: author.biography } : {}), ...(author.biographyProvenance ? { sourceUrl: author.biographyProvenance.sourceUrl } : {}), shamelaBookCount: author.bookCount, shamelaBooks: author.books.map(book => ({ id: book.sourceBookId, title: book.title })), createdAt: 0, updatedAt: 0 }
}

function authorCard(author: StoredAuthor, bookCount: number): HTMLElement {
  const era = isUnknownAuthorDeathYear(author.deathYearHijri) ? 'المؤلف مجهول' : author.contemporary ? 'معاصر' : displayableAuthorDeathYear(author.deathYearHijri) ? uiTemplateText('741b41208543f504', { p1: author.deathYearHijri! }) : 'الوفاة غير موثقة'
  const card = h('a', { class: 'author-card', href: isCentralAuthorId(author.id)?'#/people/'+encodeURIComponent(author.id):peopleHref(author.shamelaId || '') || localPeopleHref(author.id) || '#/authors' },
    authorAvatar(author, 52, 'author-card__avatar'),
    h('span', { class: 'author-card__copy' }, bindAuthorDisplayName(h('strong', { dataset: { noTranslate: '' } }, author.name),author.id,author.name), h('small', null, era, ...(bookCount<0?[]:[' · ',uiTemplateText('3a35fec055ff569c', { p1: bookCount })]))),
    icon('chevron-left', 18),
  ) as HTMLAnchorElement
  card.addEventListener('click', () => {
    if (!author.shamelaId) return
    try { localStorage.setItem(`alkhizana:people-summary:v1:${peopleIdFromShamelaId(author.shamelaId)}`, JSON.stringify({ authorId: author.shamelaId, name: author.name, deathYearHijri: author.deathYearHijri, contemporary: author.contemporary })) } catch { /* optional first-frame summary */ }
  })
  return card
}

export function sortAuthorShelfRefs<T extends {id:string;title:string}>(refs:T[],author:string,deathYearHijri:number|undefined,order:BookSort):T[]{
  const enriched=refs.map(ref=>({...ref,author,...(deathYearHijri!==undefined?{deathYearHijri}:{})}))
  return sortBooks(enriched,order)
}

export function authorBooksScreen(author: string): HTMLElement {
  const root = pageContent()
  const content = h('section', { class: 'author-page author-page--loading' },
    h('section', { class: 'author-hero author-hero--skeleton', 'aria-hidden': 'true' }),
    h('div', { class: 'library-grid', id: 'author-books', 'aria-hidden': 'true' }))
  content.setAttribute('aria-busy', 'true')
  root.appendChild(content)
  const snapshotKey = `alkhizana:author-shelf:v1:${author}`
  let bookOrder: BookSort = 'death'
  const readSnapshot = (): ShamelaAuthorIndexEntry | undefined => {
    try {
      const value = JSON.parse(localStorage.getItem(snapshotKey) ?? 'null') as ShamelaAuthorIndexEntry | null
      return value?.id && value.name?.trim() && value.bookCount === value.books?.length ? value : undefined
    } catch { return undefined }
  }
  const writeSnapshot = (entry: ShamelaAuthorIndexEntry): void => { try { localStorage.setItem(snapshotKey, JSON.stringify(entry)) } catch { /* optional */ } }
  const render = (entry: ShamelaAuthorIndexEntry, localRecord?: StoredAuthor, localBooks: StoredBook[] = [], authors: StoredAuthor[] = []): void => {
    const indexed = indexAuthorRecord(entry)
    // The lightweight canonical index is the only trusted biography source here.
    // Older IndexedDB records may contain an entire Shamela search/UI page after
    // the genuine biography, so never let that field leak back into the shelf.
    const record: StoredAuthor = localRecord ? { ...indexed, ...localRecord } : indexed
    delete record.biography
    delete record.sourceUrl
    if (indexed.biography) record.biography = indexed.biography
    if (indexed.sourceUrl) record.sourceUrl = indexed.sourceUrl
    const localById = new Map(localBooks.map(book => [book.id, book]))
    // الوفاة ثابتة داخل رف المؤلف؛ لذا يكون المفتاح الحتمي التالي عنوان
    // الكتاب، لا ترتيب وصول السجلات من snapshot أو الكتالوج.
    const shelfBooks=sortAuthorShelfRefs(entry.books,record.name,record.deathYearHijri,bookOrder)
    const hero = h('section', { class: 'author-hero', 'aria-labelledby': 'author-title' },
      h('a', { class: 'page-eyebrow', href: '#/authors' }, 'المؤلفون ←'),
      h('div', { class: 'author-hero__main' }, authorAvatar(record, 72), h('div', null, h('h1', { class: 'page-title', id: 'author-title', dataset: { noTranslate: '' } }, record.name), h('p', { class: 'page-sub' }, authorEra(record)))),
      h('div', { class: 'author-stats', 'aria-label': 'إحصاءات رف المؤلف' }, h('span', null, h('strong', null, String(entry.bookCount)), ' كتاب')),
    )
    hero.append(collectionDownloadButton(()=>record.name,async()=>shelfBooks))
    hero.append(downloadAttachmentPanel({authorKey:attachmentAuthorKey(entry.authorId)}))
    const grid = h('div', { class: 'library-grid author-shelf-grid', id: 'author-books' }, ...shelfBooks.map((ref, index) => {
      const local = localById.get(ref.id)
      if (local) return bookCard(local, index)
      const ordinal = bookOrdinal(index)
      return h('article', { class: 'library-card author-shelf-card', 'aria-labelledby': `author-shelf-book-${ref.id}` },
        h('a', { class: 'book-card__surface', href: `#/reader/${ref.id}`, 'aria-label': `قراءة ${ref.title}` }),
        h('div', { class: 'library-card__cover', 'aria-hidden': 'true' }, icon('book', 34)),
        h('div', { class: 'library-card__body' }, h('small', { class: 'book-card__ordinal', 'aria-label': ordinal.label }, String(ordinal.number)), h('h3', { class: 'library-card__title', id: `author-shelf-book-${ref.id}`, dataset: { noTranslate: '' } }, ref.title), authorLink(record.name, 'book-card__author', record.id)),
      )
    }))
    const biography = record.biography ? h('details', { class: 'author-biography' }, h('summary', null, 'ترجمة المؤلف'), h('p', { dataset: { noTranslate: '' } }, record.biography)) : undefined
    const relations = hasAuthorRelations(record) ? authorRelationsPanel(record, authors) : undefined
    const editButton = localRecord ? h('button', { class: 'btn btn--secondary author-edit-button', type: 'button' }, 'تحرير بيانات المؤلف') : undefined
    const editorHost = h('div', { class: 'author-editor-host' })
    editButton?.addEventListener('click', () => editorHost.replaceChildren(authorEditor(record)))
    content.className = 'author-page'; content.removeAttribute('role'); content.removeAttribute('aria-busy')
    const order=h('select',{'aria-label':'ترتيب كتب المؤلف'},...BOOK_SORT_OPTIONS.map(({value,label})=>h('option',{value},label))) as HTMLSelectElement
    order.value=bookOrder
    order.addEventListener('change',()=>{bookOrder=order.value as BookSort;render(entry,localRecord,localBooks,authors)})
    content.replaceChildren(hero, ...(biography ? [biography] : []), ...(relations ? [relations] : []), ...(editButton ? [editButton] : []), editorHost, h('label',null,'ترتيب الكتب',order), grid)
  }
  // Old metadata snapshots are not a verified biography generation.
  const cached = undefined
  void loadShamelaAuthorMetadata().then(async index => {
    const metadataEntry = resolveShamelaAuthor(index, author)
    const entry = metadataEntry ? await withShamelaBiography(metadataEntry) : undefined
    if (!entry) {
      if (!cached) content.replaceChildren(stateView({ kind: 'empty', icon: 'person', title: 'المؤلف غير موجود في الفهرس الموثق', actionLabel: 'دليل المؤلفين', href: '#/authors' }))
      return
    }
    const canonicalHref = peopleHref(entry.authorId)
    if (canonicalHref && routeLocation.hash !== canonicalHref) { navigatePath(legacyHashToPath(canonicalHref),true); return }
    writeSnapshot(entry); render(entry)
    const [booksResult, recordResult, authorsResult] = await Promise.allSettled([listBooks(), getAuthorRecord(entry.id), listAuthorRecords()])
    const books = booksResult.status === 'fulfilled' ? booksResult.value.filter(book => entry.books.some(ref => ref.id === book.id)) : []
    render(entry, recordResult.status === 'fulfilled' ? recordResult.value : undefined, books, authorsResult.status === 'fulfilled' ? authorsResult.value : [])
  }).catch(error => {
    console.error('author_shelf_index_failed', error)
    if (!cached) content.replaceChildren(stateView({ kind: 'error', title: 'تعذّر فتح فهرس المؤلفين', description: 'رمز التشخيص: author-index', actionLabel: 'دليل المؤلفين', href: '#/authors' }))
  })
  return root
}

export function peopleScreen(peopleId: string): HTMLElement {
  const root = pageContent()
  const resourceScope = captureRouteResourceScope()
  if(isCentralAuthorId(peopleId)){const controller=new AbortController();resourceScope.add(()=>controller.abort());root.append(centralAuthorPage(peopleId,controller.signal));return root}
  const content = h('section', { class: 'author-page author-page--loading' }, h('section', { class: 'author-hero author-hero--skeleton', 'aria-label': 'بيانات المؤلف محفوظة محليًا وتُحدّث الآن' }), h('div', { class: 'person-page__body person-page__body--skeleton', 'aria-hidden': 'true' }, h('section', { class: 'person-section' }), h('section', { class: 'person-section' })))
  content.setAttribute('aria-busy', 'true')
  root.appendChild(content)
  const loadGate=createPeopleLoadGate(resourceScope)
  content.prepend(h('p',{class:'people-loading-status',role:'status'},'جارٍ تحميل ترجمة المؤلف والتحقق من أحدث بياناتها…'))
  const failPeople=(error:unknown)=>{
    loadGate.finish()
    if(resourceScope.disposed)return
    content.className='author-page';content.removeAttribute('aria-busy')
    const code=error instanceof Error?error.message:'people_load_failed'
    content.replaceChildren(stateView({kind:'error',title:'تعذّر إكمال تحميل صفحة المؤلف',description:`لم تُعرض ترجمة قديمة أو غير مكتملة. أعد المحاولة. رمز التشخيص: ${code}`,actionLabel:'إعادة المحاولة',onAction:()=>{if(!resourceScope.disposed)root.replaceWith(peopleScreen(peopleId))}}))
  }
  const canonicalShamelaId = shamelaIdFromPeopleId(peopleId)
  const localAuthorId = localAuthorIdFromPeopleId(peopleId)
  if (!canonicalShamelaId && !localAuthorId) { loadGate.finish();content.className='author-page';content.removeAttribute('aria-busy');content.replaceChildren(stateView({ kind: 'empty', icon: 'person', title: 'رابط المؤلف غير صالح', actionLabel: 'دليل المؤلفين', href: '#/authors' })); return root }
  if (localAuthorId && !canonicalShamelaId) {
    const central=localAuthorOverrideId(localAuthorId).then(async id=>({id,baseline:await loadAuthorOverride(id,{signal:loadGate.signal}).then(row=>({row}),()=>({unavailable:true})) as AuthorOverrideBaseline}))
    void loadGate.wait(Promise.all([getAuthorRecord(localAuthorId, false), listBooks(),central])).then(([record, books, override]) => {
      if(!loadGate.active())return
      loadGate.finish();content.className='author-page';content.removeAttribute('aria-busy')
      if (!record) {
        const row='row' in override.baseline?override.baseline.row:null
        const fallback = fallbackPeopleEntryFromBooks(peopleId, books)??(row?{id:localAuthorId,authorId:localAuthorId,name:row.displayName,bookCount:0,books:[]}:undefined)
        if (fallback) { renderPeoplePage(content, fallback, [], undefined, undefined, new Map(), booksLinkedToPeople(fallback, undefined, books),override.baseline,override.id); return }
        content.replaceChildren(stateView({ kind: 'empty', icon: 'person', title: 'لا تتوفر بيانات لهذا المؤلف بعد', actionLabel: 'دليل المؤلفين', href: '#/authors' })); return
      }
      const authorBooks = books.filter(book => {
        const refs = book.authors?.length ? book.authors : [{ name: book.author, ...(book.authorId ? { id: book.authorId } : {}) }]
        return refs.some(ref => ref.id === record.id || (!ref.id && normalizeArabicAuthorName(ref.name) === record.canonicalName))
      })
      const entry: ShamelaAuthorIndexEntry = { id: record.id, authorId: record.shamelaId || record.id, name: record.name, bookCount: authorBooks.length, books: authorBooks.map(book => ({ id: book.id, sourceBookId: book.sourceBookId || book.id, title: book.title, batchId: 'local' })) }
      renderPeoplePage(content, entry, [], record, undefined, new Map(), authorBooks,override.baseline,override.id)
    }).catch(failPeople)
    return root
  }
  // A metadata-only snapshot is not a final biography. The pinned person
  // bundle and latest central baseline must both succeed before presentation.
  const storedBooksTask = listBooks().catch(() => [])
  const centralController = new AbortController()
  loadGate.signal.addEventListener('abort',()=>centralController.abort(),{once:true})
  resourceScope.add(() => centralController.abort())
  void loadGate.wait(Promise.all([
    loadAuthorPersonBundle(canonicalShamelaId!,loadGate.signal),
    loadAuthorOverride(`shamela:${Number(canonicalShamelaId)}`,{signal:centralController.signal}).then(row=>({row}),()=>({unavailable:true})),
  ])).then(async ([bundle, centralBaseline]) => {
    if(!loadGate.active())return
    if('unavailable'in centralBaseline)throw Error('people_central_baseline_unavailable')
    if(!bundle){
      const storedBooks=await loadGate.wait(storedBooksTask),fallback=fallbackPeopleEntryFromBooks(peopleId,storedBooks)
      if(!loadGate.active())return
      loadGate.finish();content.className='author-page';content.removeAttribute('aria-busy')
      if(fallback)renderPeoplePage(content,fallback,[],undefined,undefined,new Map(),booksLinkedToPeople(fallback,undefined,storedBooks))
      else content.replaceChildren(stateView({ kind: 'empty', icon: 'person', title: 'لا تتوفر بيانات لهذا المؤلف بعد', actionLabel: 'دليل المؤلفين', href: '#/authors' }))
      return
    }
    const entry=bundle.entry
    const record=await loadGate.wait(getAuthorRecord(peopleId.startsWith('local:') ? peopleId.slice(6) : entry.id, false).then(record=>record??(peopleId.startsWith('local:')?getAuthorRecord(entry.id, false):undefined)).catch(() => undefined))
    const presentation=await loadGate.wait(authorPersonPresentationContext(bundle, record))
    if (!loadGate.active()) return
    loadGate.finish()
    try { localStorage.setItem(`alkhizana:people:v1:${peopleId}`, JSON.stringify(entry)) } catch { /* optional snapshot */ }
    try { localStorage.setItem(`alkhizana:people-summary:v1:${peopleId}`, JSON.stringify({ authorId: entry.authorId, name: entry.name, deathYearHijri: entry.deathYearHijri, contemporary: entry.contemporary })) } catch { /* optional summary */ }
    const updateBooks = renderPeoplePage(content, entry, presentation.catalog, record, presentation.biography, presentation.peopleHrefByTarajmId, [], centralBaseline)
    void storedBooksTask.then(storedBooks => { if (!resourceScope.disposed) updateBooks(booksLinkedToPeople(entry, record, storedBooks)) })
  }).catch(failPeople)
  return root
}

function renderPeoplePage(content: HTMLElement, entry: ShamelaAuthorIndexEntry, catalog: ReadonlyArray<Pick<ShamelaAuthorIndexEntry,'authorId'|'name'>>, record?: StoredAuthor, importedTarajm?: StructuredBiography, peopleHrefByTarajmId: ReadonlyMap<string, string> = new Map(), localBooks: StoredBook[] = [], centralBaseline?:AuthorOverrideBaseline,localOverrideId?:string): (books: StoredBook[]) => void {
  const entityKind = authorEntityKind(entry.name)
  const person = entityKind === 'person'
  const localBiography = mergeBiographyFields(localStructuredBiography(entry, record),record?.structuredFields)
  if(record?.structuredFields&&record.biography)localBiography.sections=[{title:'الترجمة',paragraphs:biographyParagraphs(record.biography),source:{provider:'local',sourceUrl:'local:author',verifiedAt:''}}]
  const tarajmBiography = importedTarajm ?? (record?.tarajmExternalId ? readTarajmBiographyCache(record.tarajmExternalId) : undefined)
  // ترجمة Tarajm المدققة هي الأغنى عند وجودها. وإلا نعرض نص الشاملة
  // المنظف المرتبط بمصدره، ولا نرفع الملاحظات المحلية غير المسندة.
  const biography: StructuredBiography = mergeBiographyFields({...biographyForPresentation(mergeStructuredBiography(tarajmBiography,localBiography)),contemporary:localBiography.contemporary??record?.contemporary??entry.contemporary??false},centralBaseline&&'row' in centralBaseline?centralBaseline.row?.fields:undefined)
  const displayName = currentAuthorName(entry.authorId,biographyDisplayName(biography, entry.name))
  setSourceDocumentTitle(`${centralBaseline&&'row' in centralBaseline&&centralBaseline.row?centralBaseline.row.displayName:displayName} — الخِزانة`)
  const unknownAuthor = person && (isUnknownAuthorDeathYear(record?.deathYearHijri) || isUnknownAuthorDeathYear(entry.deathYearHijri))
  const fullName = biography.fullName?.value
  const field = (title: string | Text, body: HTMLElement | undefined, className = ''): HTMLElement | undefined => body
    ? h('section', { class: `person-section ${className}`.trim() }, h('h2', null, title==='الأماكن'||title==='الصفات والتصنيفات'?h('a',{href:`#/authors?facet=${title==='الأماكن'?'place':'trait'}`},title):title), body) : undefined
  const list = (values?: string[]): HTMLElement | undefined => values?.length ? h('ul', { class: 'person-list', dataset: { noTranslate: '' } }, ...values.map(value => h('li', null, value))) : undefined
  const sourcedList = (value?: { value: string[] }): HTMLElement | undefined => list(value?.value)
  const relationList = (value?: { value: string[] }, links?: { value: BiographyRelation[] }): HTMLElement | undefined => value?.value.length
    ? h('div', { class: 'person-relations__list', dataset: { noTranslate: '' } }, ...value.value.map(name => {
      const normalized = normalizePeopleFacet(name)
      const imported = links?.value.find(link => normalizePeopleFacet(link.name) === normalized)
      const href = internalRelationPeopleHref(catalog, name, imported, peopleHrefByTarajmId)
      if (href) return h('a', { href }, name)
      return h('span', { class: 'person-relation person-relation--unlinked' }, name)
    })) : undefined
  const birthLabel=biographyDateLabel(biography.birth?.value),deathLabel=biographyDateLabel(biography.death?.value)
  const dateRow = (label:string,value:NonNullable<StructuredBiography['birth']>['value']):HTMLElement => {
    const date=value.hijri!=null?(value.gregorian!=null?uiTemplateText('40588a52a5e1d555',{p1:value.hijri,p2:value.gregorian}):uiTemplateText('d96dd32818403c90',{p1:value.hijri})):value.gregorian!=null?uiTemplateText('d77077887e94c16e',{p1:value.gregorian}):undefined
    return h('span',null,h('span',null,label),': ',date,...(value.place?[(date?' — ':''),h('span',{dataset:{noTranslate:''}},value.place)]:[]))
  }
  const birth = birthLabel ? dateRow('الميلاد',biography.birth!.value) : undefined
  const death = biography.contemporary ? h('span',null,'معاصر') : deathLabel ? dateRow('الوفاة',biography.death!.value) : undefined
  const age = hijriAge(biography.birth?.value.hijri, biography.death?.value.hijri)
  const ageLabel = age != null ? uiTemplateText('e5cf74875dfeb509',{p1:age}) : biography.reportedAge ? (biography.reportedAge.value.approximate?uiTemplateText('ecaeec07233d72b9',{p1:biography.reportedAge.value.years}):uiTemplateText('e5cf74875dfeb509',{p1:biography.reportedAge.value.years})) : undefined
  const lifeRows = [birth, death, ageLabel].filter(Boolean)
  const hero = h('section', { class: 'author-hero person-hero', 'aria-labelledby': 'person-title' },
    h('a', { class: 'page-eyebrow', href: '#/authors' }, person ? 'المؤلفون ←' : 'الجهات والمجموعات ←'),
    h('div', { class: 'author-hero__main' }, authorAvatar(record || indexAuthorRecord(entry), 72), h('div', null,
      unknownAuthor ? h('p', { class: 'page-eyebrow' }, 'المؤلف مجهول') : deathLabel ? h('p', { class: 'page-eyebrow' }, dateRow('الوفاة',biography.death!.value)) : undefined,
      bindAuthorDisplayName(h('h1', { class: 'page-title', id: 'person-title', dataset: { noTranslate: '' } }, displayName),entry.authorId,displayName),
      biographyFullNameAddsInformation(displayName, fullName) ? h('p', { class: 'page-sub person-hero__full-name', dataset: { noTranslate: '' } }, fullName!) : undefined,
      biography.knownAs?.value.length ? h('p', { class: 'page-sub' },h('span',null,'اشتهر أيضًا بـ'),' ',h('span',{dataset:{noTranslate:''}},biography.knownAs.value.join('، '))) : undefined,
      )),
    h('div', { class: 'person-hero__actions', role: 'group', 'aria-label': 'إجراءات صفحة المؤلف' },
      h('button', { type: 'button', class: 'btn btn--secondary person-share', 'aria-label': 'مشاركة الترجمة', title:'مشاركة الترجمة', onclick: async () => {
        const url=biographyShareUrl(entry.authorId,location.origin+location.pathname)
        const outcome=await shareBiography(displayName,url,{share:navigator.share?.bind(navigator),copy:navigator.clipboard?.writeText.bind(navigator.clipboard)})
        if(!content.isConnected)return
        if(outcome==='copied')toast('نُسخ رابط الترجمة')
        else if(outcome==='failed')toast('تعذّرت المشاركة؛ يمكنك نسخ رابط الصفحة من شريط العنوان')
      } },icon('share',21))),
  )
  const buildWorks = (localBooks: StoredBook[]): HTMLElement | undefined => {
  const linkedBooks = mergeAuthorWorkBooks(entry.books, localBooks)
  const linkedWorkNames = new Set(linkedBooks.map(book => normalizeArabicAuthorName(book.title)))
  const unlinkedWorks = biography.works?.value.filter(work => !linkedWorkNames.has(normalizeArabicAuthorName(work))) ?? []
  const workGroups = groupAuthorWorksByCategory([
    ...linkedBooks.map(book => ({ ...book, available: true })),
    ...unlinkedWorks.map(title => ({ title, available: false })),
  ])
  const works = workGroups.length ? h('div', { class: 'person-work-groups' }, ...workGroups.map(group =>
    h('section', { class: 'person-work-group' }, h('h3', { dataset: { noTranslate: '' } }, group.category), h('ul', { class: 'person-works person-works--merged', dataset: { noTranslate: '' } },
      ...group.works.map(work => h('li', { class: `person-work ${work.available ? 'person-work--available' : 'person-work--listed'}` },
        work.available && work.id ? h('a', { href: `#/book/${encodeURIComponent(work.id)}` }, work.title) : work.title)))))) : undefined
  const section=field(uiTemplateText('96d68a2e259efc38',{p1:linkedBooks.length}), works, 'person-section--works person-books')
  if(section)section.querySelector('h2')?.append(collectionDownloadButton(()=>displayName,async()=>linkedBooks))
  return section
  }
  const facetList = (kind: PeopleFacetKind, values?: string[]): HTMLElement | undefined => values?.length
    ? h('ul', { class: 'person-list person-list--facets', dataset: { noTranslate: '' } }, ...values.map(value => {
      const placeMapId = kind === 'place' ? resolveAuthorPlaceMap(value) : undefined
      return h('li', { class: placeMapId ? 'person-place-row' : '' }, h('a', { href: peopleFacetHref(kind, value) }, value), placeMapId ? h('a', { class: 'person-place-map-link', href: authorPlaceSatelliteUrl(placeMapId), target: '_blank', rel: 'noopener noreferrer', 'aria-label': `فتح ${value} بالقمر الصناعي في Google Maps`, title: 'فتح الموقع في Google Maps' }, icon('globe', 18)) : undefined)
    })) : undefined
  const sections = [
    field('الاسم والتعريف', biography.lineage?.value ? h('p',{dataset:{noTranslate:''}},biography.lineage.value) : undefined),
    field('الحياة والتاريخ', person && lifeRows.length ? h('dl', { class: 'person-life' }, ...lifeRows.map(row => h('div', null, h('dd', null, row)))) : undefined),
    field('الأماكن', facetList('place', biography.places?.value), 'person-section--facets'),
    field('الصفات والتصنيفات', facetList('trait', [...new Set([...(biography.traits?.value??[]),...(biography.categories?.value??[])])]), 'person-section--facets'),
    field('العلاقات العلمية', biography.teachers || biography.students ? h('div', { class: 'person-relations' },
      biography.teachers ? h('div', null, h('h3', null, 'شيوخه'), relationList(biography.teachers, biography.teacherLinks)) : undefined,
      biography.students ? h('div', null, h('h3', null, 'تلاميذه'), relationList(biography.students, biography.studentLinks)) : undefined) : undefined, 'person-section--relations'),
    field('المناصب', sourcedList(biography.positions)),
    buildWorks(localBooks),
    field(person ? 'الترجمة المفصلة' : 'نبذة موثقة', record?.structuredFields&&record.biography?h('div',{class:'person-biography',dataset:{noTranslate:''}},...biographyParagraphs(record.biography).map(text=>h('p',null,text))):detailedBiography(biography)),
  ].filter((section): section is HTMLElement => Boolean(section))
  content.className = 'author-page person-page'; content.removeAttribute('aria-busy'); content.replaceChildren(hero, h('div', { class: 'person-page__body' }, ...sections))
  content.append(downloadAttachmentPanel({authorKey:attachmentAuthorKey(entry.authorId)}))
  // Only canonical catalog identity is editable; never infer from a local name.
  if (catalog.some(author => author.authorId === entry.authorId) && /^\d{1,6}$/.test(entry.authorId)) attachAuthorOverride(content, `shamela:${Number(entry.authorId)}`, displayName, centralBaseline,biographyFields(biography))
  else if(localOverrideId)attachAuthorOverride(content,localOverrideId,displayName,centralBaseline,biographyFields(biography))
  const updateWorks = (books:StoredBook[]) => {
    if (!content.isConnected) return
    if (content.querySelector('.author-inline-toolbar')) return
    const previous = content.querySelector('.person-books'), next = buildWorks(books)
    if (previous && next) previous.replaceWith(next)
    else if (previous) previous.remove()
    else if (next) content.querySelector('.person-page__body')?.appendChild(next)
  }
  const worksScope=captureRouteResourceScope()
  let worksGeneration=0
  routeEventListener(window,'library-changed',()=>{
    const generation=++worksGeneration,identity=currentLibraryIdentityScope()
    void listBooks().then(books=>{
      if(worksScope.disposed||!content.isConnected||generation!==worksGeneration||identity!==currentLibraryIdentityScope())return
      updateWorks(booksLinkedToPeople(entry,record,books))
    }).catch(()=>{/* Keep the last usable list on a transient local read failure. */})
  },undefined,worksScope)
  return updateWorks
}

function detailedBiography(biography: StructuredBiography): HTMLElement | undefined {
  const sections = biography.sections?.filter(section => section.source.provider === 'tarajm.com' || section.source.provider === 'shamela.ws')
  const blocks = (paragraphs: readonly string[]) => biographyContentBlocks(paragraphs).map(block => block.kind === 'heading' ? h('h3', { class: 'person-biography__subheading' }, block.text) : h('p', null, block.text))
  if (sections?.length) return h('div', { class: 'person-biography', dataset: { noTranslate: '' } }, ...sections.map(section => h('section', null,
    normalizePeopleFacet(section.title) === normalizePeopleFacet('الترجمة') ? undefined : h('h3', null, section.title), ...blocks(section.paragraphs))))
  return biography.summary && (biography.summary.provider === 'tarajm.com' || biography.summary.provider === 'shamela.ws')
    ? h('div', { class: 'person-biography', dataset: { noTranslate: '' } }, ...blocks(biographyParagraphs(biography.summary.value))) : undefined
}

function arabicBookCount(count: number): string {
  if (count === 1) return '1 كتاب'
  if (count === 2) return 'كتابان'
  if (count >= 3 && count <= 10) return `${count} كتب`
  return `${count} كتابًا`
}

function authorAvatar(author: StoredAuthor | undefined, size: number, className = 'author-hero__avatar'): HTMLElement {
  const holder = h('span', { class: className, style: `width:${size}px;height:${size}px` })
  if (!author?.imageData?.length) { holder.appendChild(icon('person', Math.round(size * .44))); return holder }
  const url = createTrackedObjectURL(new Blob([new Uint8Array(author.imageData)], { type: author.imageMimeType || 'image/jpeg' }))
  const image = h('img', { src: url, alt: `صورة ${author.name}` }) as HTMLImageElement
  image.addEventListener('load', () => revokeTrackedObjectURL(url), { once: true })
  image.addEventListener('error', () => { revokeTrackedObjectURL(url); holder.replaceChildren(icon('person', Math.round(size * .44))) }, { once: true })
  holder.appendChild(image)
  return holder
}

function authorEditor(author: StoredAuthor): HTMLElement {
  const country = h('input', { value: author.country ?? '', placeholder: 'البلد' }) as HTMLInputElement
  const madhhab = h('input', { value: author.madhhab ?? '', placeholder: 'المذهب أو المدرسة العلمية' }) as HTMLInputElement
  const biography = h('textarea', { placeholder: 'ترجمة موجزة موثقة للمؤلف' }, author.biography ?? '') as HTMLTextAreaElement
  const teachers = h('textarea', { placeholder: 'اسم شيخ في كل سطر', 'aria-label': 'شيوخ المؤلف' }, relationNamesText(author.teachers)) as HTMLTextAreaElement
  const students = h('textarea', { placeholder: 'اسم تلميذ في كل سطر', 'aria-label': 'تلاميذ المؤلف' }, relationNamesText(author.students)) as HTMLTextAreaElement
  const death = h('input', { type: 'number', min: '1', max: '2000', value: author.deathYearHijri ? String(author.deathYearHijri) : '', placeholder: 'سنة الوفاة الهجرية' }) as HTMLInputElement
  const tarajmExternalId = h('input', { type: 'text', value: author.tarajmExternalId ?? '', placeholder: 'رقم الشخصية في tarajm.com' }) as HTMLInputElement
  const contemporary = h('input', { type: 'checkbox' }) as HTMLInputElement
  contemporary.checked = Boolean(author.contemporary)
  const imageInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' }) as HTMLInputElement
  const removeImage = h('input', { type: 'checkbox' }) as HTMLInputElement
  const removeImageField = author.imageData?.length
    ? h('label', { class: 'import-contemporary' }, removeImage, h('span', null, 'إزالة الصورة الحالية'))
    : undefined
  const form = h('form', { class: 'author-editor' },
    h('div', { class: 'author-editor__head' }, h('div', null, h('h2', null, 'بيانات المؤلف'), h('p', null, 'حدّث الترجمة، ويمكن إرفاق صورة للمؤلف المعاصر.')), h('button', { type: 'button', class: 'btn btn--secondary', onclick: () => form.remove() }, 'إلغاء')),
    h('div', { class: 'author-editor__fields' }, authorField('البلد', country), authorField('المذهب', madhhab), authorField('سنة الوفاة (هـ)', death), authorField('معرف تراجم المستقل', tarajmExternalId), h('label', { class: 'import-contemporary' }, contemporary, h('span', null, 'مؤلف معاصر')), authorField('صورة المؤلف المعاصر', imageInput), ...(removeImageField ? [removeImageField] : []), authorField('ملاحظات محلية (لا تظهر ترجمة مفصلة)', biography), authorField('شيوخه (اسم في كل سطر)', teachers), authorField('تلاميذه (اسم في كل سطر)', students)),
    h('button', { type: 'submit', class: 'btn btn--primary' }, 'حفظ بيانات المؤلف'),
  )
  contemporary.addEventListener('change', () => { death.disabled = contemporary.checked; if (contemporary.checked) death.value = '' })
  death.disabled = contemporary.checked
  form.addEventListener('submit', async event => {
    event.preventDefault()
    const file = imageInput.files?.[0]
    const imageError = file ? validateAuthorPortrait(file) : undefined
    if (imageError) { toast(imageError); imageInput.focus(); return }
    const portrait = authorPortraitUpdate(removeImage.checked, file ? { data: new Uint8Array(await file.arrayBuffer()), mimeType: file.type } : undefined)
    const verifiedTarajmId = /^\d+$/u.test(tarajmExternalId.value.trim()) ? tarajmExternalId.value.trim() : undefined
    await updateAuthor(author.id, {
      country: country.value.trim(), madhhab: madhhab.value.trim(), biography: biography.value.trim(), contemporary: contemporary.checked,
      ...(verifiedTarajmId ? { tarajmExternalId: verifiedTarajmId } : {}),
      teachers: parseAuthorRelationNames(teachers.value), students: parseAuthorRelationNames(students.value),
      ...(contemporary.checked || !death.value ? {} : { deathYearHijri: Number(death.value) }),
      ...portrait,
    })
    toast('حُفظت بيانات المؤلف')
    form.remove()
  })
  return form
}

function authorCreatePanel(onSaved: () => void): HTMLElement {
  const name = h('input', { placeholder: 'الاسم الكامل أو الأشهر' }) as HTMLInputElement
  name.required = true; name.autocomplete = 'off'
  const aliases = h('textarea', { placeholder: 'اسم أو كنية في كل سطر' }) as HTMLTextAreaElement
  const country = h('input', { placeholder: 'البلد' }) as HTMLInputElement
  const madhhab = h('input', { placeholder: 'المذهب أو المدرسة العلمية' }) as HTMLInputElement
  const birth = h('input', { type: 'number', min: '1', max: '2000', placeholder: 'سنة الميلاد هـ' }) as HTMLInputElement
  const death = h('input', { type: 'number', min: '1', max: '2000', placeholder: 'سنة الوفاة هـ' }) as HTMLInputElement
  const contemporary = h('input', { type: 'checkbox' }) as HTMLInputElement
  const biography = h('textarea', { placeholder: 'ترجمة موجزة موثقة' }) as HTMLTextAreaElement
  const teachers = h('textarea', { placeholder: 'اسم شيخ في كل سطر' }) as HTMLTextAreaElement
  const students = h('textarea', { placeholder: 'اسم تلميذ في كل سطر' }) as HTMLTextAreaElement
  const works = h('textarea', { placeholder: 'اسم مؤلَّف في كل سطر' }) as HTMLTextAreaElement
  const sourceUrl = h('input', { type: 'url', placeholder: 'https://…' }) as HTMLInputElement
  const imageInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' }) as HTMLInputElement
  const form = h('form', { class: 'author-editor author-create' },
    h('div', { class: 'author-editor__head' }, h('div', null, h('p', { class: 'page-eyebrow' }, 'سجل جديد'), h('h2', null, 'إضافة مؤلف إلى دليل الخزانة'), h('p', null, 'الاسم مطلوب، وما عداه قابل للإكمال أو التعديل لاحقًا.')), h('button', { type: 'button', class: 'btn btn--secondary', onclick: () => form.remove() }, 'إلغاء')),
    h('div', { class: 'author-editor__fields' },
      authorField('اسم المؤلف *', name), authorField('الأسماء والكنى الأخرى', aliases), authorField('البلد', country), authorField('المذهب أو المدرسة', madhhab),
      authorField('سنة الميلاد (هـ)', birth), authorField('سنة الوفاة (هـ)', death), h('label', { class: 'import-contemporary' }, contemporary, h('span', null, 'مؤلف معاصر')),
      authorField('صورة المؤلف المعاصر', imageInput), authorField('الترجمة', biography), authorField('شيوخه', teachers), authorField('تلاميذه', students), authorField('أشهر مؤلفاته', works), authorField('مصدر الترجمة', sourceUrl),
    ),
    h('button', { type: 'submit', class: 'btn btn--primary' }, 'حفظ المؤلف'),
  )
  contemporary.addEventListener('change', () => { death.disabled = contemporary.checked; if (contemporary.checked) death.value = '' })
  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (!name.value.trim()) { toast('اكتب اسم المؤلف'); name.focus(); return }
    const file = imageInput.files?.[0]
    const imageError = file ? validateAuthorPortrait(file) : undefined
    if (imageError) { toast(imageError); imageInput.focus(); return }
    const portrait = file ? { imageData: new Uint8Array(await file.arrayBuffer()), imageMimeType: file.type } : {}
    try {
      const id = await saveAuthor({
        name: name.value.trim(), aliases: parseAuthorRelationNames(aliases.value), country: country.value.trim(), madhhab: madhhab.value.trim(),
        ...(birth.value ? { birthYearHijri: Number(birth.value) } : {}), ...(contemporary.checked ? { contemporary: true } : death.value ? { deathYearHijri: Number(death.value), contemporary: false } : {}),
        biography: biography.value.trim(), teachers: parseAuthorRelationNames(teachers.value), students: parseAuthorRelationNames(students.value), works: parseAuthorRelationNames(works.value),
        ...(sourceUrl.value.trim() ? { sourceUrl: sourceUrl.value.trim() } : {}), ...portrait,
      })
      toast('أُضيف المؤلف إلى دليل الخزانة')
      form.remove(); onSaved(); routeLocation.hash = authorHref(id)
    } catch (error) { toast(error instanceof Error ? error.message : 'تعذّر حفظ المؤلف') }
  })
  routeAnimationFrame(() => name.focus())
  return form
}

function authorRelationsPanel(author: StoredAuthor, catalog: StoredAuthor[]): HTMLElement {
  const audited = auditAuthorRelations(author, catalog)
  const group = (title: string, role: AuditedAuthorRelation['role']): HTMLElement | undefined => {
    const relations = audited.filter(item => item.role === role)
    return relations.length
    ? h('section', { class: 'author-relations__group' }, h('h3', null, title), h('div', { class: 'author-relations__names' }, ...relations.map(relation => h('span', { class: `author-relation${relation.reciprocal ? ' is-reciprocal' : ''}` }, h('a', { href: relation.targetId ? authorHref(relation.targetId) : `#/authors?name=${encodeURIComponent(relation.name)}` }, relation.name), h('small', null, relation.reciprocal ? 'صلة متبادلة' : relation.targetId ? 'تحتاج توثيق الجهة الأخرى' : 'سجل غير مرتبط')))))
    : undefined
  }
  const teachers = group('شيوخه', 'teacher')
  const students = group('تلاميذه', 'student')
  return h('section', { class: 'author-relations', 'aria-labelledby': 'author-relations-title' },
    h('div', { class: 'section-header' }, h('div', null, h('h2', { id: 'author-relations-title' }, 'العلاقات العلمية'), h('p', null, 'الشيوخ والتلاميذ المثبتون في سجل المؤلف.'))),
    ...(teachers ? [teachers] : []), ...(students ? [students] : []),
  )
}

function authorField(label: string, control: HTMLElement): HTMLElement {
  return h('label', { class: 'import-field' }, h('span', null, label), control)
}

function authorEra(author?: StoredAuthor): string {
  if (!author) return 'رف المؤلف في مكتبتك المحلية'
  if (isUnknownAuthorDeathYear(author.deathYearHijri)) return [author.country, 'المؤلف مجهول'].filter(Boolean).join(' · ')
  if (author.contemporary) return [author.country, 'مؤلف معاصر'].filter(Boolean).join(' · ')
  if (displayableAuthorDeathYear(author.deathYearHijri)) return [`توفي سنة ${author.deathYearHijri} هـ`, author.country, author.madhhab].filter(Boolean).join(' · ')
  return [author.country, author.madhhab, 'بيانات المؤلف قابلة للاستكمال'].filter(Boolean).join(' · ')
}
import {routeLocation,navigatePath,legacyHashToPath} from "../path_location"
