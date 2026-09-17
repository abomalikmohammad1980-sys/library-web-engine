/** شاشة المكتبة — عرض الكتب المحفوظة مع حذف */

import { h, toast } from '../ui'
import { icon } from '../icons'
import { listBooks, listAuthorRecords, getAuthorRecord, importAuthorCatalog, mergeAuthors, saveAuthor, updateAuthor, deleteBook, downloadBytes, updateBookMetadata, restoreBookMetadata, snapshotBookMetadata, replaceBookWord, replaceBookCover, type StoredBook, type StoredAuthor, type AuthorCatalogRecord, type BookMetadataUpdate, type BookMetadataSnapshot } from '../engine/library_store'
import { convertStoredBookToPdf, needsPdfRefresh } from '../engine/word_pdf'
import { getRuntimeCapabilities } from '../runtime_capabilities'
import { sectionHeader, pageContent } from '../components'
import { bookImportManager } from '../book_import'
import { BOOK_CATEGORIES, approximateGregorianYear, isWordFile } from '../library_metadata'
import { bookCover, deterministicCoverHue, discoverWordCover } from '../book_cover'
import { normalizeLegacyWord } from '../book_import'
import { authorLink, categoryLink, matchesCategoryFilter, UNCATEGORIZED_CATEGORY } from '../taxonomy_links'
import { ensureShamelaCatalogImported } from '../shamela_catalog'
import { mountStateView, stateView } from '../state_view'
import { filterAuthorEntries, nextAuthorVisibleCount, normalizeArabicAuthorName } from '../author_filter'
import { hasAuthorRelations, parseAuthorRelationNames, relationNamesText } from '../author_relations'
import { auditAuthorRelations, type AuditedAuthorRelation } from '../author_relation_graph'
import { authorPortraitUpdate, validateAuthorPortrait } from '../author_portrait_update'
import { currentHashQuery, replaceHashQuery } from '../hash_query_state'
import { libraryCatalogCsv, parseLibraryCatalogCsv } from '../library_catalog_csv'
import { downloadArtifact } from '../artifact_download'
import { authorCatalogCsv } from '../author_catalog_csv'
import { makeProgrammaticFileInput } from '../programmatic_file_input'
import { libraryBookActionLabel, libraryBookTitleId } from '../library_card_accessibility'
import { formatLabel, inferBookFormat } from '../book_format'
import { captureRouteResourceScope, createTrackedObjectURL, revokeTrackedObjectURL, routeAnimationFrame, routeEventListener, routeObserver } from '../resource_lifecycle'
import { listShelves, saveShelves } from '../shelf_store'
import { reconcileBulkSelection, bulkDeleteBooks, bulkSelectableIds, bulkShelfUpdate } from '../library_bulk'
import { getReadingActivity } from '../activity_store'

export function libraryScreen(): HTMLElement {
  const books = booksSection()
  const management = integratedManagementSection(books)
  const shelves = libraryShelvesPreview()
  return pageContent(
    h('section', { class: 'library-hero', 'aria-labelledby': 'library-title' },
      h('p', { class: 'page-eyebrow' }, 'مكتبتي'),
      h('h1', { class: 'page-title', id: 'library-title' }, 'كتبك في مكان واحد'),
      h('p', { class: 'page-sub' }, 'اقرأ الأصل، نزّل Word أو PDF، ورتّب رفوفك بسهولة.'),
    ),
    bookImportManager(() => { window.dispatchEvent(new Event('library-changed')) }),
    shelves,
    management,
    books,
  )
}

function libraryShelvesPreview(): HTMLElement {
  const host = h('section', { class: 'library-shelves-preview', 'aria-labelledby': 'library-shelves-title' }, stateView({ kind: 'loading', icon: 'book', title: 'جارٍ ترتيب رفوفك' }))
  const render = async (): Promise<void> => {
    const [books, shelves] = await Promise.all([listBooks(), Promise.resolve(listShelves())])
    const byId = new Map(books.map(book => [book.id, book]))
    const counts = getReadingActivity().openCounts
    const ranked = shelves.map(shelf => ({ shelf, score: shelf.bookIds.reduce((sum, id) => sum + (counts[id] ?? 0), 0) }))
      .sort((a, b) => b.score - a.score || b.shelf.bookIds.length - a.shelf.bookIds.length || a.shelf.createdAt - b.shelf.createdAt)
      .slice(0, 3)
    const cards = ranked.map(({ shelf }) => {
      const shelfBooks = shelf.bookIds.map(id => byId.get(id)).filter((book): book is StoredBook => Boolean(book))
      return h('a', { class: 'library-shelf-preview', href: `#/shelves?shelf=${encodeURIComponent(shelf.id)}`, 'aria-label': `فتح رف ${shelf.name}` },
        h('div', { class: 'library-shelf-preview__covers', 'aria-hidden': 'true' }, ...shelfBooks.slice(0, 3).map(book => bookCover(book, 'library-shelf-preview__cover'))),
        h('strong', null, shelf.name),
        h('span', null, `${arabicCount(shelfBooks.length)} كتاب`),
      )
    })
    host.replaceChildren(
      h('header', { class: 'section-header' }, h('div', null, h('p', { class: 'page-eyebrow' }, 'تنظيمك الشخصي'), h('h2', { id: 'library-shelves-title' }, 'رفوفي'), h('p', null, 'أكثر ثلاثة رفوف تستعملها؛ افتح أي رف أو انتقل لإدارة جميع الرفوف.')), h('a', { class: 'btn btn--secondary', href: '#/shelves' }, 'عرض كل الرفوف')),
      h('div', { class: 'library-shelves-preview__grid' }, ...cards, ...(cards.length ? [] : [h('a', { class: 'library-shelf-preview library-shelf-preview--empty', href: '#/shelves' }, icon('plus', 20), h('strong', null, 'أنشئ رفك الأول'), h('span', null, 'واجمع فيه الكتب التي تريد العودة إليها'))])),
    )
  }
  void render().catch(() => host.replaceChildren(stateView({ kind: 'error', title: 'تعذّر عرض الرفوف الآن', description: 'يمكنك فتح صفحة الرفوف والمحاولة مجددًا.', actionLabel: 'فتح الرفوف', href: '#/shelves' })))
  const scope = captureRouteResourceScope()
  routeEventListener(window, 'shelves-changed', () => { void render() }, undefined, scope)
  return host
}

function integratedManagementSection(booksHost: HTMLElement): HTMLElement {
  const resourceScope = captureRouteResourceScope()
  const selected = new Set<string>()
  let books: StoredBook[] = []
  let undoSnapshot: BookMetadataSnapshot[] = []
  const section = h('section', { class: 'library-admin', 'aria-labelledby': 'library-admin-title' },
    h('div', { class: 'library-admin__intro' }, h('p', { class: 'page-eyebrow' }, 'تعديل جماعي اختياري'), h('h2', { id: 'library-admin-title' }, 'غيّر بيانات عدة كتب دفعة واحدة'), h('p', null, 'استخدم هذه الأداة فقط عندما تريد توحيد مؤلف أو تصنيف لعدة كتب؛ ولا يتغير أي حقل تتركه فارغًا.')),
    h('ol', { class: 'library-admin__steps', 'aria-label': 'طريقة التعديل الجماعي' },
      h('li', null, h('strong', null, '1'), h('span', null, 'ضع علامة على الكتب المطلوبة من بطاقاتها أدناه.')),
      h('li', null, h('strong', null, '2'), h('span', null, 'اكتب المؤلف أو اختر التصنيف الذي تريد تغييره فقط.')),
      h('li', null, h('strong', null, '3'), h('span', null, 'راجع عدد الكتب ثم اضغط «تطبيق التغييرات».')),
    ),
  )
  const toolbar = h('form', { class: 'library-admin__bulk' })
  const status = h('strong', { class: 'library-admin__selection-status', 'aria-live': 'polite' }, 'لم تختر أي كتاب بعد — استخدم مربعات التحديد في البطاقات أدناه')
  const author = h('input', { type: 'text', placeholder: 'اتركه فارغًا لعدم تغيير المؤلف', 'aria-label': 'المؤلف الجديد للكتب المحددة' }) as HTMLInputElement
  const category = categoryControl('التصنيف الجماعي', undefined, true)
  category.firstElementChild!.textContent = 'لا تغيّر التصنيف'
  const apply = h('button', { class: 'btn btn--primary', type: 'submit', disabled: true }, 'تطبيق التغييرات') as HTMLButtonElement
  const undo = h('button', { class: 'btn btn--secondary', type: 'button' }, 'تراجع عن آخر تطبيق') as HTMLButtonElement
  undo.hidden = true
  const syncStatus = (): void => {
    status.textContent = selected.size ? `اخترت ${arabicCount(selected.size)} كتاب؛ لا تتغير إلا الحقول التي حددتها هنا` : 'لم تختر أي كتاب بعد — استخدم مربعات التحديد في البطاقات أدناه'
    apply.disabled = selected.size === 0
    apply.textContent = selected.size ? `تطبيق التغييرات على ${arabicCount(selected.size)} كتاب` : 'تطبيق التغييرات'
  }
  const decorate = (): void => {
    for (const card of booksHost.querySelectorAll<HTMLElement>('.library-card[data-book-id]')) {
      if (card.querySelector('.library-card__select')) continue
      const id = card.dataset.bookId!
      if (books.find(book => book.id === id)?.managedSource === 'published') continue
      const input = h('input', { class: 'library-card__select', type: 'checkbox', 'aria-label': libraryBookActionLabel('select', books.find(book => book.id === id)?.title ?? 'الكتاب') }) as HTMLInputElement
      input.checked = selected.has(id)
      input.addEventListener('change', () => { input.checked ? selected.add(id) : selected.delete(id); syncStatus() })
      card.prepend(input)
    }
  }
  const refresh = (): void => { void listBooks().then(next => { if (resourceScope.disposed) return; books = next; selected.clear(); syncStatus(); routeAnimationFrame(decorate, resourceScope) }) }
  toolbar.addEventListener('submit', async event => {
    event.preventDefault()
    const values: BookMetadataUpdate = {}
    if (author.value.trim()) values.author = author.value.trim()
    if (category.value === UNCATEGORIZED_CATEGORY) values.category = null
    else if (category.value) values.category = category.value
    if (!selected.size || !Object.keys(values).length) { toast('حدد كتبًا وأدخل بيانات واحدة على الأقل'); return }
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
  section.appendChild(toolbar)
  routeEventListener(window, 'library-changed', refresh, undefined, resourceScope)
  const observer = routeObserver(new MutationObserver(decorate), resourceScope); observer.observe(booksHost, { childList: true, subtree: true })
  refresh()
  return section
}

function booksSection(): HTMLElement {
  const resourceScope = captureRouteResourceScope()
  const wrap = h('section', { class: 'library-section', 'aria-label': 'إدارة الكتب المحفوظة' })
  const controls = h('div', { class: 'library-controls' })
  const search = h('div', { class: 'library-search' }, icon('search', 19))
  const input = h('input', { type: 'search', placeholder: 'ابحث بالعنوان أو المؤلف…', 'aria-label': 'تصفية كتب المكتبة' }) as HTMLInputElement
  search.appendChild(input)
  const categoryFilter = categoryControl('تصفية حسب التصنيف', undefined, true)
  categoryFilter.firstElementChild!.textContent = 'كل التصنيفات'
  const authorState = h('select', { 'aria-label': 'تصفية حسب حالة المؤلف' },
    h('option', { value: '' }, 'كل المؤلفين'), h('option', { value: 'contemporary' }, 'المعاصرون'), h('option', { value: 'deceased' }, 'المتوفون')) as HTMLSelectElement
  const fromYear = h('input', { type: 'number', min: '1', max: '2000', placeholder: 'من سنة هـ', 'aria-label': 'سنة الوفاة من' }) as HTMLInputElement
  const toYear = h('input', { type: 'number', min: '1', max: '2000', placeholder: 'إلى سنة هـ', 'aria-label': 'سنة الوفاة إلى' }) as HTMLInputElement
  const advanced = h('div', { class: 'library-controls__advanced' }, categoryFilter, authorState, fromYear, toYear)
  const clearFilters = h('button', { type: 'button', class: 'btn btn--secondary' }, 'مسح المرشحات')
  const tagFilter = h('div', { class: 'library-tag-filter', hidden: true })
  const grid = h('div', { class: 'library-grid', id: 'library-grid' })
  grid.appendChild(stateView({ kind: 'loading', icon: 'book', title: 'جارٍ فتح مكتبتك' }))
  controls.append(search, advanced, clearFilters)
  wrap.append(controls, tagFilter, grid)
  void listBooks().then((books) => {
    const params = currentHashQuery()
    const requestedCategory = params.get('category') ?? ''
    const requestedAuthor = params.get('author') ?? ''
    const requestedEdit = params.get('edit') ?? ''
    let requestedTag = params.get('tag') ?? ''
    let currentBooks = books
    if (requestedCategory) categoryFilter.value = requestedCategory
    input.value = params.get('q') ?? requestedAuthor
    authorState.value = params.get('authorState') ?? ''
    fromYear.value = params.get('from') ?? ''
    toYear.value = params.get('to') ?? ''
    const render = (): void => renderLibraryGrid(grid, currentBooks, input.value, {
      category: categoryFilter.value, authorState: authorState.value,
      fromYear: Number(fromYear.value) || 0, toYear: Number(toYear.value) || Number.POSITIVE_INFINITY, tag: requestedTag,
    })
    const renderTag = (): void => {
      tagFilter.hidden = !requestedTag
      tagFilter.replaceChildren(...(requestedTag ? [h('span', null, 'الوسم النشط:'), h('strong', null, `#${requestedTag}`), h('button', { type: 'button', class: 'btn btn--secondary', onclick: () => { requestedTag = ''; replaceHashQuery({ tag: null }); renderTag(); render() } }, 'إزالة')] : []))
    }
    const sync = (): void => { replaceHashQuery({ q: input.value.trim(), author: null, category: categoryFilter.value, authorState: authorState.value, from: fromYear.value, to: toYear.value, tag: requestedTag || null }); render() }
    input.addEventListener('input', sync)
    categoryFilter.addEventListener('change', sync); authorState.addEventListener('change', sync)
    fromYear.addEventListener('input', sync); toYear.addEventListener('input', sync)
    clearFilters.addEventListener('click', () => { requestedTag = ''; renderTag(); input.value = ''; categoryFilter.value = ''; authorState.value = ''; fromYear.value = ''; toYear.value = ''; sync(); input.focus() })
    const refreshBooks = (): void => { void listBooks().then((next) => { if (resourceScope.disposed) return; currentBooks = next; render() }) }
    routeEventListener(window, 'library-changed', refreshBooks, undefined, resourceScope)
    renderTag(); render()
    if (requestedEdit) {
      const book = currentBooks.find((item) => item.id === requestedEdit)
      const card = grid.querySelector<HTMLElement>(`[data-book-id="${CSS.escape(requestedEdit)}"]`)
      if (book && card) showInlineEditor(card, book)
    }
  }).catch(() => grid.replaceChildren(stateView({ kind: 'error', title: 'تعذّر فتح المكتبة الآن', description: 'كتبك محفوظة ولم تُحذف.', actionLabel: 'إعادة المحاولة', onAction: () => location.reload() })))
  return wrap
}

function renderLibraryGrid(grid: HTMLElement, books: StoredBook[], query: string, metadata: {
  category: string; authorState: string; fromYear: number; toYear: number; tag?: string;
}, limit = 120): void {
  const q = query.trim().toLocaleLowerCase('ar')
  const visible = books.filter((book) => {
    const matches = (!q || `${book.title} ${book.author} ${(book.authors ?? []).map(author => author.name).join(' ')}`.toLocaleLowerCase('ar').includes(q)) && matchesCategoryFilter(book.category, metadata.category)
      && (!metadata.tag || book.tags?.some(tag => tag.name === metadata.tag))
    const year = book.deathYearHijri ?? 0
    const matchesMetadata = (!metadata.authorState || (metadata.authorState === 'contemporary' ? book.contemporary : !book.contemporary))
      && (!metadata.fromYear || (!book.contemporary && year >= metadata.fromYear))
      && (!Number.isFinite(metadata.toYear) || (!book.contemporary && year <= metadata.toYear))
    return matches && matchesMetadata
  }).sort((a, b) => b.addedAt - a.addedAt)
  grid.replaceChildren(...visible.slice(0, limit).map(bookCard))
  if (visible.length > limit) { const more = h('button', { class: 'btn btn--secondary library-load-more', type: 'button' }, `عرض المزيد (${arabicCount(visible.length - limit)} متبقٍ)`); more.addEventListener('click', () => renderLibraryGrid(grid, books, query, metadata, limit + 120)); grid.appendChild(more) }
  if (!visible.length) grid.replaceChildren(stateView(books.length ? { kind: 'no-results', icon: 'search', title: 'لا توجد كتب تطابق التصفية', description: 'غيّر عبارة البحث أو المرشحات.' } : { kind: 'empty', icon: 'book', title: 'لم تضف كتابًا بعد', description: 'أضف ملف Word لتبدأ بناء خزانتك.' }))
}

function bookCard(book: StoredBook): HTMLElement {
  const titleId = libraryBookTitleId(book.id)
  const card = h('article', { class: 'library-card', dataset: { bookId: book.id }, 'aria-labelledby': titleId })
  card.appendChild(h('a', { class: 'library-card__cover', href: `#/reader/${book.id}`, 'aria-label': `قراءة ${book.title}` }, bookCover(book, 'library-card__cover-art')))
  const body = h('div', { class: 'library-card__body' })

  // العنوان
  const title = h('a', { class: 'library-card__title', id: titleId, href: `#/reader/${book.id}` }, book.title)
  body.appendChild(title)

  // المؤلف
  body.appendChild(authorLink(book.author, 'book-card__author'))

  // حجم وتاريخ
  body.appendChild(h('div', { class: 'book-card__meta' },
    h('span', { class: 'book-format-badge' }, formatLabel(book)),
    h('span', null, `${(book.fileSize / 1024).toFixed(0)} KB`),
    h('span', { class: 'dot' }),
    h('span', null, new Date(book.addedAt).toLocaleDateString('ar-SA')),
  ))
  if (book.category || book.deathYearHijri || book.contemporary) body.appendChild(h('div', { class: 'library-card__taxonomy' },
    book.category ? categoryLink(book.category) : null,
    book.contemporary ? h('span', null, 'معاصر') : book.deathYearHijri ? h('span', null, `ت ${book.deathYearHijri}هـ · نحو ${approximateGregorianYear(book.deathYearHijri)}م`) : null,
  ))

  const actions = h('div', { class: 'library-card__actions' })
  const sourceIsPdf = inferBookFormat(book) === 'pdf'
  const sourceIsText = ['text', 'markdown'].includes(inferBookFormat(book))
  const sourceIsEpub = inferBookFormat(book) === 'epub'
  const sourceIsBok = inferBookFormat(book) === 'shamela-bok'
  const wordButton = h('button', { class: 'btn btn--secondary library-card__button', type: 'button' }, sourceIsPdf ? 'تحميل PDF' : sourceIsText ? 'تحميل النص الأصلي' : sourceIsEpub ? 'تحميل EPUB الأصلي' : sourceIsBok ? 'تحميل BOK الأصلي' : 'تحميل Word')
  wordButton.addEventListener('click', (ev) => {
    ev.preventDefault(); ev.stopPropagation()
    downloadBytes(book.sourceData ?? book.data, book.fileName, book.sourceMimeType || book.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  })
  actions.appendChild(wordButton)
  if (sourceIsEpub || sourceIsBok) actions.appendChild(h('a', { class: 'btn btn--secondary library-card__button', href: `#/reader/${book.id}?print=1`, onclick: (ev: Event) => ev.stopPropagation() }, 'حفظ PDF منسق'))
  if (!sourceIsPdf && !sourceIsText && !sourceIsEpub && !sourceIsBok && !needsPdfRefresh(book)) {
    const pdfButton = h('button', { class: 'btn btn--secondary library-card__button', type: 'button' }, 'تحميل PDF')
    pdfButton.addEventListener('click', (ev) => {
      ev.preventDefault(); ev.stopPropagation()
      downloadBytes(book.pdfData!, book.pdfFileName ?? `${book.title}.pdf`, 'application/pdf')
    })
    actions.appendChild(pdfButton)
  } else if (!sourceIsPdf && !sourceIsText && !sourceIsEpub && !sourceIsBok) {
    const retry = h('button', { class: 'btn btn--secondary library-card__button', type: 'button' },
      'جارٍ التحقق من PDF…') as HTMLButtonElement
    retry.disabled = true
    void getRuntimeCapabilities().then(capabilities => {
      if (!retry.isConnected) return
      if (!capabilities.wordPdfConversionAvailable) {
        retry.textContent = 'إنشاء PDF — يتطلب التطبيق المحلي'
        retry.title = 'القراءة والاستيراد متاحان؛ التحويل المطابق يحتاج خدمة Word المحلية.'
        return
      }
      retry.textContent = book.pdfStatus === 'converting' ? 'PDF قيد الإنشاء…' : 'إنشاء PDF'
      retry.disabled = book.pdfStatus === 'converting'
    })
    retry.addEventListener('click', async (ev) => {
      ev.preventDefault(); ev.stopPropagation()
      retry.disabled = true
      retry.textContent = 'PDF قيد الإنشاء…'
      try {
        await convertStoredBookToPdf(book.id)
        toast('تم إنشاء نسخة PDF من ملف Word الأصلي')
        window.dispatchEvent(new Event('library-changed'))
      } catch (error) {
        retry.disabled = false
        retry.textContent = 'إعادة محاولة PDF'
        toast(`تعذّر إنشاء PDF: ${error instanceof Error ? error.message : String(error)}`)
      }
    })
    actions.appendChild(retry)
  }
  if (book.managedSource !== 'published') {
    const editButton = h('button', { class: 'btn btn--secondary library-card__button', type: 'button' }, 'تعديل الكتاب')
    editButton.addEventListener('click', (ev) => {
      ev.preventDefault(); ev.stopPropagation()
      showInlineEditor(card, book)
    })
    actions.appendChild(editButton)
  } else actions.appendChild(h('span', { class: 'library-card__managed', title: 'يبقى أصل الكتاب ثابتًا، وتظل ملاحظاتك وتظليلاتك محفوظة.' }, 'كتاب أصلي مثبّت'))
  body.appendChild(actions)
  card.appendChild(body)

  // زر حذف — فوق الرابط (z-index أعلى)
  const del = book.managedSource !== 'published' ? h('button', {
    class: 'library-card__delete',
    'aria-label': libraryBookActionLabel('delete', book.title),
  }, '✕') : undefined
  del?.addEventListener('click', async (ev) => {
    ev.preventDefault()
    ev.stopPropagation()
    if (!confirm(`حذف "${book.title}"؟`)) return
    await deleteBook(book.id)
    card.remove()
    window.dispatchEvent(new Event('library-changed'))
    toast('حُذف ✓')
  })
  if (del) card.appendChild(del)

  return card
}

function managementSection(): HTMLElement {
  const resourceScope = captureRouteResourceScope()
  const section = h('section', { class: 'library-admin', 'aria-labelledby': 'library-admin-title' },
    h('div', { class: 'library-admin__intro' }, h('p', { class: 'page-eyebrow' }, 'إدارة مركزية'), h('h2', { id: 'library-admin-title' }, 'الكتب والمؤلفون والتصنيفات'), h('p', null, 'حدّد كتابًا أو عدة كتب، ثم طبّق البيانات المشتركة دفعة واحدة أو عدّل كل سجل منفردًا.')),
  )
  const content = stateView({ kind: 'loading', icon: 'settings', title: 'جارٍ إعداد مركز الإدارة' })
  section.appendChild(content)
  const load = (): void => {
    mountStateView(content, { kind: 'loading', icon: 'settings', title: 'جارٍ إعداد مركز الإدارة' })
    void listBooks().then((books) => renderManagement(content, books)).catch(() => mountStateView(content, { kind: 'error', title: 'تعذّر فتح مركز الإدارة', description: 'لم تتغير بيانات الكتب. أعد المحاولة.', actionLabel: 'إعادة المحاولة', onAction: load }))
  }
  routeEventListener(window, 'library-changed', load, undefined, resourceScope)
  load()
  return section
}

function renderManagement(root: HTMLElement, books: StoredBook[]): void {
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
    if (!selected.size) return
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
    if (hasShelfAction) saveShelves(bulkShelfUpdate(listShelves(), selected, shelf.value, shelfAction.value as 'add' | 'remove' | 'move'))
    toast(`حُدثت بيانات ${selected.size} كتاب`)
    window.dispatchEvent(new Event('library-changed'))
  })
  const rows: Array<{ book: StoredBook; row: HTMLElement }> = []
  for (const book of books.sort((a, b) => a.title.localeCompare(b.title, 'ar'))) {
    const check = h('input', { type: 'checkbox', 'aria-label': `تحديد ${book.title}`, ...(book.managedSource === 'published' ? { disabled: true } : {}) }) as HTMLInputElement
    check.addEventListener('change', () => { check.checked ? selected.add(book.id) : selected.delete(book.id); updateStatus() })
    const row = h('article', { class: 'library-admin__row' }, check,
      h('div', { class: 'library-admin__summary' }, h('strong', null, book.title), h('small', null, `${book.author || 'مؤلف غير معروف'} · ${book.category || 'بلا تصنيف'} · ${book.contemporary ? 'معاصر' : book.deathYearHijri ? `${book.deathYearHijri}هـ` : 'الوفاة غير مدونة'}`)),
    )
    if (book.managedSource !== 'published') {
      const edit = h('button', { class: 'btn btn--secondary library-card__button', type: 'button' }, 'تعديل')
      edit.addEventListener('click', () => showInlineEditor(row, book))
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
    if (!confirm(`حذف ${arabicCount(chosen.length)} كتاب؟ ${sample}${chosen.length > 3 ? '…' : ''} لا يمكن التراجع عن هذا الحذف.`)) return
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
      const year = book.deathYearHijri ?? 0
      const matches = (!query || book.title.toLocaleLowerCase('ar').includes(query))
        && matchesCategoryFilter(book.category, categoryFilter.value)
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

function showInlineEditor(row: HTMLElement, book: StoredBook): void {
  if (row.querySelector('.library-admin__editor')) return
  const form = h('form', { class: 'library-admin__editor' })
  const title = h('input', { type: 'text', value: book.title, 'aria-label': 'عنوان الكتاب' }) as HTMLInputElement
  const author = h('input', { type: 'text', value: book.author, 'aria-label': 'المؤلف' }) as HTMLInputElement
  const death = h('input', { type: 'number', value: book.deathYearHijri ? String(book.deathYearHijri) : '', placeholder: 'الوفاة هـ', 'aria-label': 'سنة الوفاة الهجرية' }) as HTMLInputElement
  const contemporary = h('input', { type: 'checkbox' }) as HTMLInputElement
  contemporary.checked = Boolean(book.contemporary)
  const category = categoryControl('التصنيف', book.category ?? UNCATEGORIZED_CATEGORY, true)
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
  form.append(title, author, death, h('label', { class: 'import-contemporary' }, contemporary, h('span', null, 'معاصر')), category,
    publisher, edition, investigator, publicationYear, seriesName, seriesOrder, description,
    h('div', { class: 'library-admin__replacement' }, replacement, replacementButton, replacementStatus),
    h('div', { class: 'library-admin__replacement' }, coverReplacement, coverButton, coverStatus, h('label', null, removeCover, h('span', null, 'إزالة الغلاف الحالي واستخدام الغلاف المولّد'))),
    h('button', { class: 'btn btn--primary library-card__button', type: 'submit' }, 'حفظ'),
    h('button', { class: 'btn btn--secondary library-card__button', type: 'button', onclick: () => form.remove() }, 'إلغاء'))
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
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
      replacementStatus.textContent = 'جارٍ فحص النسخة البديلة…'
      try {
        const source = new Uint8Array(await file.arrayBuffer())
        const legacy = /\.(doc|rtf)$/i.test(file.name)
        const data = legacy ? await normalizeLegacyWord(source, file.name) : source
        const cover = discoverWordCover(data)
        await replaceBookWord(book.id, {
          fileName: file.name, data,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ...(legacy ? { sourceData: source, sourceMimeType: file.type || (/\.rtf$/i.test(file.name) ? 'application/rtf' : 'application/msword') } : {}),
          ...(cover ? { coverMediaPath: cover.mediaPath } : {}),
          coverHue: deterministicCoverHue(`${title.value.trim()}|${file.name}`),
        })
      } catch (error) {
        replacementButton.disabled = false
        replacementStatus.textContent = 'لم تُستبدل النسخة الحالية'
        toast(`تعذّر استبدال Word: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
    }
    await updateBookMetadata(book.id, values)
    toast('حُفظت بيانات الكتاب')
    window.dispatchEvent(new Event('library-changed'))
    if (file) void getRuntimeCapabilities().then(capabilities => {
      if (capabilities.wordPdfConversionAvailable) return convertStoredBookToPdf(book.id).then(() => window.dispatchEvent(new Event('library-changed')))
    }).catch(() => undefined)
  })
  row.appendChild(form)
}

function categoryControl(label: string, selected?: string, allowUncategorized = false): HTMLSelectElement {
  const select = h('select', { 'aria-label': label }) as HTMLSelectElement
  select.appendChild(h('option', { value: '' }, 'اختر التصنيف…'))
  if (allowUncategorized) select.appendChild(h('option', { value: UNCATEGORIZED_CATEGORY, selected: selected === UNCATEGORIZED_CATEGORY }, 'بلا تصنيف'))
  for (const value of BOOK_CATEGORIES) select.appendChild(h('option', { value, selected: value === selected }, value))
  return select
}

function arabicCount(value: number): string {
  return value.toLocaleString('ar-SA')
}

// ---------- تصفح المؤلفين ----------

export function authorsScreen(): HTMLElement {
  const resourceScope = captureRouteResourceScope()
  const root = pageContent(
    h('section', { class: 'authors-hero', 'aria-labelledby': 'authors-title' },
      h('p', { class: 'page-eyebrow' }, 'المؤلفون'),
      h('h1', { class: 'page-title', id: 'authors-title' }, 'دليل مؤلفي الخزانة'),
      h('p', { class: 'page-sub' }, 'ابحث في تراجم المؤلفين، ثم افتح كتب كل مؤلف الموجودة فعلًا في خزانتك.'),
    ),
  )
  const section = h('section', { class: 'authors-section', 'aria-label': 'دليل المؤلفين' })
  section.appendChild(stateView({ kind: 'loading', icon: 'person', title: 'جارٍ ترتيب دليل المؤلفين' }))
  root.appendChild(section)
  void loadAuthors(section, resourceScope)
  return root
}

async function loadAuthors(section: HTMLElement, resourceScope = captureRouteResourceScope()): Promise<void> {
  try {
    await ensureShamelaCatalogImported()
    if (resourceScope.disposed) return
    const books = await listBooks()
    const authors = await listAuthorRecords()
    if (resourceScope.disposed) return
    const groupedById = new Map<string, StoredBook[]>()
    const groupedByName = new Map<string, StoredBook[]>()
    for (const book of books) {
      if (book.authorId) groupedById.set(book.authorId, [...(groupedById.get(book.authorId) ?? []), book])
      const author = normalizeArabicAuthorName(book.author?.trim() || 'غير معروف')
      groupedByName.set(author, [...(groupedByName.get(author) ?? []), book])
    }
    const entries = authors.map(author => {
      const matches = [...(groupedById.get(author.id) ?? []), ...(groupedByName.get(normalizeArabicAuthorName(author.name)) ?? [])]
      const authorBooks = [...new Map(matches.map(book => [book.id, book])).values()]
      // رف المؤلف يصف الخزانة الحالية فقط. بيانات المصدر الخارجية
      // تفيد في الترجمة، لكنها لا تعني أن كتب ذلك المصدر موجودة عند المستخدم.
      return { author, books: authorBooks, bookCount: authorBooks.length }
    })
    const controls = h('div', { class: 'authors-controls' })
    const search = h('div', { class: 'library-search' }, icon('search', 19))
    const input = h('input', { type: 'search', placeholder: 'ابحث عن مؤلف…', 'aria-label': 'تصفية المؤلفين' }) as HTMLInputElement
    const authorParams = currentHashQuery()
    input.value = authorParams.get('name') ?? ''
    search.appendChild(input)
    const ownersOnly = h('input', { type: 'checkbox', 'aria-label': 'عرض أصحاب الكتب فقط' }) as HTMLInputElement
    ownersOnly.checked = authorParams.get('owners') === 'books'
    const ownersFilter = h('label', { class: 'authors-owners-filter' }, ownersOnly, h('span', null, 'عرض أصحاب الكتب فقط'))
    const summary = h('p', { class: 'authors-summary' })
    const catalogInput = makeProgrammaticFileInput(h('input', { type: 'file', accept: 'application/json,.json' }) as HTMLInputElement)
    const catalogButton = h('button', { class: 'btn btn--secondary', type: 'button' }, icon('plus', 17), 'استيراد فهرس مؤلفين')
    const addAuthorButton = h('button', { class: 'btn btn--primary', type: 'button' }, icon('plus', 17), 'إضافة مؤلف')
    const exportAuthors = h('button', { class: 'btn btn--secondary', type: 'button' }, icon('download', 16), 'تصدير المؤلفين CSV')
    exportAuthors.addEventListener('click', () => { downloadArtifact({ fileName: 'alkhizana-authors.csv', mimeType: 'text/csv;charset=utf-8', content: authorCatalogCsv(authors) }); toast(`صُدر دليل ${authors.length} مؤلف`) })
    const mergeButton = h('button', { class: 'btn btn--secondary', type: 'button' }, 'دمج سجلين')
    catalogButton.addEventListener('click', () => catalogInput.click())
    catalogInput.addEventListener('change', async () => {
      const file = catalogInput.files?.[0]
      if (!file) return
      catalogButton.setAttribute('disabled', '')
      try {
        const parsed = JSON.parse(await file.text()) as AuthorCatalogRecord[] | { authors?: AuthorCatalogRecord[] }
        const records = Array.isArray(parsed) ? parsed : parsed.authors
        if (!Array.isArray(records)) throw new Error('ينبغي أن يحتوي الملف على مصفوفة authors')
        const result = await importAuthorCatalog(records)
        toast(`أضيف ${result.imported} مؤلفًا ودُمج ${result.merged} ورُفض ${result.rejected}`)
        await loadAuthors(section, resourceScope)
      } catch (error) {
        toast(`تعذّر استيراد الفهرس: ${error instanceof Error ? error.message : String(error)}`)
      } finally { catalogButton.removeAttribute('disabled'); catalogInput.value = '' }
    })
    mergeButton.addEventListener('click', () => section.prepend(authorMergePanel(authors, section)))
    addAuthorButton.addEventListener('click', () => {
      section.querySelector('.author-create')?.remove()
      section.prepend(authorCreatePanel(() => void loadAuthors(section, resourceScope)))
    })
    const grid = h('div', { class: 'authors-grid' })
    controls.append(h('div', { class: 'authors-controls__filter' }, search, ownersFilter), h('div', { class: 'authors-controls__actions' }, summary, addAuthorButton, mergeButton, exportAuthors, catalogButton, catalogInput))
    const BATCH_SIZE = 80
    let visibleCount = BATCH_SIZE
    let observer: IntersectionObserver | undefined
    resourceScope.add(() => observer?.disconnect())
    const render = (reset = false): void => {
      if (reset) visibleCount = BATCH_SIZE
      observer?.disconnect()
      const matching = filterAuthorEntries(entries.map(entry => ({ value: entry, name: entry.author.name, aliases: entry.author.aliases, bookCount: entry.bookCount })), input.value, ownersOnly.checked).map(entry => entry.value)
      const visible = matching.slice(0, visibleCount)
      const totalBooks = matching.reduce((sum, entry) => sum + entry.bookCount, 0)
      summary.textContent = `${matching.length} مؤلف · ${totalBooks} كتاب · يظهر ${visible.length} من ${matching.length} · مرتّب بالوفيات`
      grid.replaceChildren(...visible.map(({ author, books }) => authorCard(author, books)))
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
    const syncAuthorFilters = (): void => { replaceHashQuery({ name: input.value.trim(), owners: ownersOnly.checked ? 'books' : null }); render(true) }
    input.addEventListener('input', syncAuthorFilters)
    ownersOnly.addEventListener('change', syncAuthorFilters)
    if (resourceScope.disposed) return
    section.replaceChildren(controls, grid)
    render()
  } catch {
    if (!resourceScope.disposed) section.replaceChildren(stateView({ kind: 'error', title: 'تعذّر إعداد دليل المؤلفين', description: 'أعد المحاولة دون فقد بياناتك.', actionLabel: 'إعادة المحاولة', onAction: () => void loadAuthors(section, resourceScope) }))
  }
}

function authorMergePanel(authors: StoredAuthor[], section: HTMLElement): HTMLElement {
  section.querySelector('.author-merge')?.remove()
  const option = (author: StoredAuthor): HTMLOptionElement => h('option', { value: author.id }, author.name) as HTMLOptionElement
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
    if (!confirm(`سيبقى «${primaryName}»، وتُنقل إليه كتب وبيانات «${duplicateName}». هل تريد المتابعة؟`)) return
    const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement
    submit.disabled = true; status.textContent = 'جارٍ نقل الكتب ودمج البيانات…'
    try {
      await mergeAuthors(primary.value, duplicate.value)
      toast('دُمج سجلا المؤلف ونُقلت الكتب بنجاح')
      await loadAuthors(section)
      window.dispatchEvent(new Event('library-changed'))
    } catch (error) {
      submit.disabled = false
      status.textContent = error instanceof Error ? error.message : 'تعذّر دمج السجلين'
    }
  })
  return form
}

function authorCard(author: StoredAuthor, books: StoredBook[]): HTMLElement {
  const ready = books.filter((book) => !needsPdfRefresh(book)).length
  const era = author.contemporary ? 'معاصر' : author.deathYearHijri ? `ت ${author.deathYearHijri} هـ` : 'الوفاة غير موثقة'
  return h('a', { class: 'author-card', href: `#/author/${encodeURIComponent(author.id)}` },
    authorAvatar(author, 52, 'author-card__avatar'),
    h('span', { class: 'author-card__copy' }, h('strong', null, author.name), h('small', null, `${era} · ${books.length} كتاب في الخزانة${books.length ? ` · ${ready} جاهز` : ''}`)),
    icon('chevron-left', 18),
  )
}

export function authorBooksScreen(author: string): HTMLElement {
  const root = pageContent()
  const content = stateView({ kind: 'loading', icon: 'person', title: 'جارٍ فتح رف المؤلف' })
  root.appendChild(content)
  void ensureShamelaCatalogImported().then(() => Promise.all([listBooks(), getAuthorRecord(author), listAuthorRecords()])).then(([all, record, authors]) => {
    const authorName = record?.name ?? author
    const books = all.filter((book) => book.authorId === record?.id || (book.author?.trim() || 'غير معروف') === authorName).sort((a, b) => b.addedAt - a.addedAt)
    const ready = books.filter((book) => !needsPdfRefresh(book)).length
    const size = books.reduce((sum, book) => sum + book.fileSize, 0)
    const hero = h('section', { class: 'author-hero', 'aria-labelledby': 'author-title' },
      h('a', { class: 'page-eyebrow', href: '#/authors' }, 'المؤلفون ←'),
      h('div', { class: 'author-hero__main' }, authorAvatar(record, 72), h('div', null, h('h1', { class: 'page-title', id: 'author-title' }, authorName), h('p', { class: 'page-sub' }, authorEra(record)))),
      h('div', { class: 'author-stats', 'aria-label': 'إحصاءات رف المؤلف' },
        h('span', null, h('strong', null, String(books.length)), ' كتاب'),
        h('span', null, h('strong', null, String(ready)), ' PDF جاهز'),
        h('span', null, h('strong', null, size < 1024 * 1024 ? `${Math.round(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`), ' حجم الرف'),
      ),
    )
    const grid = h('div', { class: 'library-grid', id: 'author-books' }, ...books.map(bookCard))
    const biography = record?.biography ? h('details', { class: 'author-biography' }, h('summary', null, 'ترجمة المؤلف'), h('p', null, record.biography)) : undefined
    const relations = record && hasAuthorRelations(record) ? authorRelationsPanel(record, authors) : undefined
    const editButton = record ? h('button', { class: 'btn btn--secondary author-edit-button', type: 'button' }, 'تحرير بيانات المؤلف') : undefined
    const editorHost = h('div', { class: 'author-editor-host' })
    editButton?.addEventListener('click', () => editorHost.replaceChildren(authorEditor(record!)))
    content.className = 'author-page'
    content.removeAttribute('role')
    content.replaceChildren(hero, ...(biography ? [biography] : []), ...(relations ? [relations] : []), ...(editButton ? [editButton] : []), editorHost, grid)
    if (!books.length) grid.replaceChildren(stateView({ kind: 'empty', icon: 'book', title: 'لا توجد كتب لهذا المؤلف في الخزانة', description: 'أضف أحد كتبه إلى خزانتك ليظهر هنا.', actionLabel: 'فتح المكتبة', href: '#/library' }))
  }).catch(() => content.replaceChildren(stateView({ kind: 'error', title: 'تعذّر فتح رف المؤلف', description: 'أعد فتح الصفحة أو ارجع إلى دليل المؤلفين.', actionLabel: 'دليل المؤلفين', href: '#/authors' })))
  return root
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
  const contemporary = h('input', { type: 'checkbox' }) as HTMLInputElement
  contemporary.checked = Boolean(author.contemporary)
  const imageInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' }) as HTMLInputElement
  const removeImage = h('input', { type: 'checkbox' }) as HTMLInputElement
  const removeImageField = author.imageData?.length
    ? h('label', { class: 'import-contemporary' }, removeImage, h('span', null, 'إزالة الصورة الحالية'))
    : undefined
  const form = h('form', { class: 'author-editor' },
    h('div', { class: 'author-editor__head' }, h('div', null, h('h2', null, 'بيانات المؤلف'), h('p', null, 'حدّث الترجمة، ويمكن إرفاق صورة للمؤلف المعاصر.')), h('button', { type: 'button', class: 'btn btn--secondary', onclick: () => form.remove() }, 'إلغاء')),
    h('div', { class: 'author-editor__fields' }, authorField('البلد', country), authorField('المذهب', madhhab), authorField('سنة الوفاة (هـ)', death), h('label', { class: 'import-contemporary' }, contemporary, h('span', null, 'مؤلف معاصر')), authorField('صورة المؤلف المعاصر', imageInput), ...(removeImageField ? [removeImageField] : []), authorField('الترجمة', biography), authorField('شيوخه (اسم في كل سطر)', teachers), authorField('تلاميذه (اسم في كل سطر)', students)),
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
    await updateAuthor(author.id, {
      country: country.value.trim(), madhhab: madhhab.value.trim(), biography: biography.value.trim(), contemporary: contemporary.checked,
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
      form.remove(); onSaved(); location.hash = `#/author/${encodeURIComponent(id)}`
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
    ? h('section', { class: 'author-relations__group' }, h('h3', null, title), h('div', { class: 'author-relations__names' }, ...relations.map(relation => h('span', { class: `author-relation${relation.reciprocal ? ' is-reciprocal' : ''}` }, h('a', { href: relation.targetId ? `#/author/${encodeURIComponent(relation.targetId)}` : `#/authors?name=${encodeURIComponent(relation.name)}` }, relation.name), h('small', null, relation.reciprocal ? 'صلة متبادلة' : relation.targetId ? 'تحتاج توثيق الجهة الأخرى' : 'سجل غير مرتبط')))))
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
  if (author.contemporary) return [author.country, 'مؤلف معاصر'].filter(Boolean).join(' · ')
  if (author.deathYearHijri) return [`توفي سنة ${author.deathYearHijri} هـ`, author.country, author.madhhab].filter(Boolean).join(' · ')
  return [author.country, author.madhhab, 'بيانات المؤلف قابلة للاستكمال'].filter(Boolean).join(' · ')
}
