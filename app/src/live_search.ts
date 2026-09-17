import { normalizeArabicAuthorName } from './author_filter'
import {matchesCategoryFilter} from './taxonomy_links'
import { type ShamelaAuthorIndex } from './shamela_author_index'
import { loadShamelaAuthorMetadata } from './shamela_author_metadata'
import { RETIRED_TEST_BOOK_IDS } from './retired_test_books'
import {uiTemplateText,uiTemplateAttribute,renderBoundUiTemplate} from './ui_template_binding'
import {loadLiveSearchHiddenBooks,invalidateLiveSearchVisibility} from './live_search_visibility'
import {routeEventListener} from './resource_lifecycle'

interface LiveSuggestion {
  kind: 'book'
  label: string
  detail: string
  href: string
  score: number
}

export interface PublishedLiveSearchBook { id: string; title: string; author: string; category?: string }
export interface LiveSearchScope { category?: string }

let publishedMemory: Promise<PublishedLiveSearchBook[]> | undefined
const LIVE_SEARCH_HISTORY_KEY = 'alkhizana:live-search-history-v1'

export function liveSearchHistory(storage: Pick<Storage, 'getItem'> = localStorage): string[] {
  try { const value = JSON.parse(storage.getItem(LIVE_SEARCH_HISTORY_KEY) ?? '[]'); return Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim().length >= 2).slice(0, 8) : [] } catch { return [] }
}

export function rememberLiveSearch(query: string, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): string[] {
  const clean = query.trim().replace(/\s+/gu, ' ').slice(0, 160)
  if (clean.length < 2) return liveSearchHistory(storage)
  const next = [clean, ...liveSearchHistory(storage).filter(item => item !== clean)].slice(0, 8)
  try { storage.setItem(LIVE_SEARCH_HISTORY_KEY, JSON.stringify(next)) } catch { /* Optional local history must never block search. */ }
  return next
}

export function clearLiveSearchHistory(storage: Pick<Storage, 'removeItem'> = localStorage): void { try { storage.removeItem(LIVE_SEARCH_HISTORY_KEY) } catch { /* best effort */ } }

export function nextLiveSearchOptionIndex(current: number, count: number, direction: 1 | -1): number {
  if (count <= 0) return -1
  if (current < 0) return direction === 1 ? 0 : count - 1
  return (current + direction + count) % count
}

/** يحصر Tab داخل لوحة البحث الجوالية، ولا يتدخل في تنقل سطح المكتب. */
export function compactLiveSearchTabTarget<T>(items: readonly T[], active: T | undefined, backwards: boolean): T | undefined {
  if (!items.length) return undefined
  if (backwards && active === items[0]) return items.at(-1)
  if (!backwards && active === items.at(-1)) return items[0]
  return undefined
}

function loadPublishedLiveSearchBooks(): Promise<PublishedLiveSearchBook[]> {
  publishedMemory ??= fetch('./library/published/manifest.json', { cache: 'force-cache' }).then(async response => {
    if (!response.ok) throw new Error(`published_live_search_http_${response.status}`)
    const payload = await response.json() as { works?: Array<{ id?: string; title?: string; author?: string; status?: string; metadata?: { category?: string } }> }
    if (!Array.isArray(payload.works)) throw new Error('published_live_search_invalid')
    return payload.works
      .filter(work => work.status === 'ready' && Boolean(work.id && work.title) && !RETIRED_TEST_BOOK_IDS.has(work.id!))
      .map(work => ({ id: work.id!, title: work.title!, author: work.author?.trim() || 'مؤلف غير معروف', ...(work.metadata?.category ? { category: work.metadata.category } : {}) }))
  }).catch(error => { publishedMemory = undefined; throw error })
  return publishedMemory
}

export function liveMetadataSuggestions(index: ShamelaAuthorIndex, rawQuery: string, limit = 200, publishedBooks: readonly PublishedLiveSearchBook[] = [], allowedBookIds?: ReadonlySet<string>, hiddenBookIds:ReadonlySet<string>=new Set()): LiveSuggestion[] {
  const query = normalizeArabicAuthorName(rawQuery)
  if (query.length < 2) return []
  const suggestions: LiveSuggestion[] = []
  const seenBooks = new Set<string>()
  for (const author of index.authors) {
    const authorName = normalizeArabicAuthorName(author.name)
    const authorMatches = authorName.includes(query)
    for (const book of author.books) {
      if(hiddenBookIds.has(book.id)||hiddenBookIds.has(book.sourceBookId))continue
      if (allowedBookIds && !allowedBookIds.has(book.id)) continue
      const title = normalizeArabicAuthorName(book.title)
      const titleMatches = title.includes(query)
      if ((!authorMatches && !titleMatches) || seenBooks.has(book.id)) continue
      seenBooks.add(book.id)
      suggestions.push({
        kind: 'book', label: book.title, detail: author.name,
        href: `#/reader/${encodeURIComponent(book.id)}`,
        score: title.startsWith(query) ? 0 : titleMatches ? 1 : authorName.startsWith(query) ? 2 : 3,
      })
    }
  }
  for (const book of publishedBooks) {
    if(hiddenBookIds.has(book.id))continue
    if (allowedBookIds && !allowedBookIds.has(book.id)) continue
    const title = normalizeArabicAuthorName(book.title)
    const author = normalizeArabicAuthorName(book.author)
    const titleMatches = title.includes(query)
    const authorMatches = author.includes(query)
    if ((!titleMatches && !authorMatches) || seenBooks.has(book.id)) continue
    seenBooks.add(book.id)
    suggestions.push({
      kind: 'book', label: book.title, detail: book.author,
      href: `#/reader/${encodeURIComponent(book.id)}`,
      score: title.startsWith(query) ? 0 : titleMatches ? 1 : author.startsWith(query) ? 2 : 3,
    })
  }
  return suggestions
    .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label, 'ar'))
    .slice(0, Math.max(1, limit))
}

/**
 * أثناء الكتابة: تصفية خفيفة لعناوين الكتب والمؤلفين.
 * عند Enter أو زر «بحث»: انتقال صريح إلى البحث النصي الشامل.
 */
export function attachLiveSearch(input: HTMLInputElement, host: HTMLElement, scope: LiveSearchScope = {}): void {
  const panelId = `live-search-${Math.random().toString(36).slice(2)}`
  const panel = document.createElement('div')
  panel.id = panelId
  panel.className = 'live-search'
  panel.setAttribute('role', 'listbox')
  panel.setAttribute('aria-label', 'اقتراحات الكتب والمؤلفين')
  panel.hidden = true
  host.appendChild(panel)
  input.setAttribute('aria-controls', panelId)
  input.setAttribute('aria-autocomplete', 'list')
  input.setAttribute('aria-expanded', 'false')

  let request = 0
  let activeOption = -1
  const close = (): void => {
    activeOption = -1
    panel.hidden = true
    input.setAttribute('aria-expanded', 'false')
    input.removeAttribute('aria-activedescendant')
  }
  const openCentralSearch = (): void => {
    const query = input.value.trim()
    if (query.length < 2) {
      input.focus()
      input.setCustomValidity(renderBoundUiTemplate(query?'live-minimum-query':'live-empty-query',{},document.documentElement.lang||'ar'))
      input.reportValidity()
      return
    }
    input.setCustomValidity('')
    rememberLiveSearch(query)
    close()
    const params = new URLSearchParams({ q: query })
    if (scope.category) params.set('category', scope.category)
    routeLocation.hash = `#/search?${params.toString()}`
  }
  const render = (items: LiveSuggestion[], query: string): void => {
    panel.setAttribute('role', 'listbox')
    panel.replaceChildren()
    const head = document.createElement('div')
    head.className = 'live-search__head'
    head.append(Object.assign(document.createElement('strong'), { textContent: 'اختر كتابًا' }), Object.assign(document.createElement('span'), { textContent: scope.category ? 'Enter للبحث داخل هذا القسم' : 'Enter للبحث في النصوص كلها' }))
    panel.appendChild(head)
    if (!items.length) {
      const empty = document.createElement('div')
      empty.className = 'live-search__empty'
      empty.dataset.uiText=''
      empty.replaceChildren(uiTemplateText('live-no-metadata',{p1:query}))
      panel.appendChild(empty)
    } else {
      const list = document.createElement('div')
      list.className = 'live-search__list'
      items.forEach((item, index) => {
        const link = document.createElement('a')
        link.id = `${panelId}-option-${index}`
        link.className = 'live-search__result'
        link.href = item.href
        link.setAttribute('role', 'option')
        const label = document.createElement('span')
        label.className = 'live-search__book'
        const ordinal = document.createElement('span')
        ordinal.className = 'live-search__ordinal'
        uiTemplateAttribute(ordinal,'aria-label','live-book-ordinal',{p1:index+1})
        ordinal.textContent = (index + 1).toLocaleString('ar')
        const storedLabel=document.createElement('span');storedLabel.dataset.noTranslate='';storedLabel.textContent=item.label
        label.append(ordinal, storedLabel)
        const detail = document.createElement('span')
        detail.className = 'live-search__snippet'
        detail.replaceChildren(uiTemplateText('live-book-detail',{p1:item.detail}))
        link.append(label, detail)
        list.appendChild(link)
      })
      panel.appendChild(list)
    }
    const more = document.createElement('button')
    more.type = 'button'
    more.className = 'live-search__more'
    more.replaceChildren(uiTemplateText(scope.category?'live-search-category':'live-search-all',{p1:query,...(scope.category?{p2:scope.category}:{})}))
    more.addEventListener('click', openCentralSearch)
    panel.appendChild(more)
    panel.hidden = false
    input.setAttribute('aria-expanded', 'true')
  }
  const renderHistory = (): void => {
    const history = liveSearchHistory()
    if (!history.length) { close(); return }
    panel.replaceChildren(); panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'عمليات البحث الأخيرة')
    const head = document.createElement('div'); head.className = 'live-search__head'
    head.append(Object.assign(document.createElement('strong'), { textContent: 'عمليات البحث الأخيرة' }))
    const clearHistory = Object.assign(document.createElement('button'), { type: 'button', textContent: 'مسح السجل' }); clearHistory.className = 'live-search__more'
    clearHistory.addEventListener('click', () => { clearLiveSearchHistory(); close(); input.focus() })
    head.append(clearHistory); panel.append(head)
    const list = document.createElement('div'); list.className = 'live-search__list'
    history.forEach(query => { const button = Object.assign(document.createElement('button'), { type: 'button', textContent: query }); button.className = 'live-search__result'; button.dataset.noTranslate=''; button.addEventListener('click', () => { input.value = query; openCentralSearch() }); list.append(button) })
    panel.append(list); panel.hidden = false; input.setAttribute('aria-expanded', 'true')
  }

  const moveActive = (direction: 1 | -1): void => {
    const options = [...panel.querySelectorAll<HTMLElement>('[role="option"]')]
    activeOption = nextLiveSearchOptionIndex(activeOption, options.length, direction)
    options.forEach((option, index) => option.setAttribute('aria-selected', String(index === activeOption)))
    const active = options[activeOption]
    if (active) input.setAttribute('aria-activedescendant', active.id)
  }

  input.placeholder = 'اختر كتابًا أو ابحث عن معلومة'
  input.addEventListener('input', () => {
    input.setCustomValidity('')
    const query = input.value.trim()
    const current = ++request
    if (query.length < 2) { close(); return }
    void Promise.all([loadShamelaAuthorMetadata(), loadPublishedLiveSearchBooks(),loadLiveSearchHiddenBooks()]).then(([index, publishedBooks,hiddenBookIds]) => {
      if (current !== request || input.value.trim() !== query) return
      const scopedPublished = scope.category ? publishedBooks.filter(book => matchesCategoryFilter(book.category,scope.category!)) : publishedBooks
      const allowedBookIds = scope.category ? new Set(scopedPublished.map(book => book.id)) : undefined
      render(liveMetadataSuggestions(index, query, 200, scopedPublished, allowedBookIds,hiddenBookIds), query)
    }).catch(() => { if (current === request) close() })
  })
  input.addEventListener('focus', () => { if (!input.value.trim()) renderHistory();else{invalidateLiveSearchVisibility();input.dispatchEvent(new Event('input'))} })
  routeEventListener(window,'alkhizana:central-book-mutated',()=>{invalidateLiveSearchVisibility();request++;const visible=!panel.hidden;close();if(visible&&input.isConnected)input.dispatchEvent(new Event('input'))})
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (!panel.hidden) moveActive(event.key === 'ArrowDown' ? 1 : -1); return }
    if (event.key === 'Enter') { event.preventDefault(); const active = panel.querySelector<HTMLElement>(`#${panelId}-option-${activeOption}`); active ? active.click() : openCentralSearch(); return }
    if (event.key === 'Escape') { request++; input.setCustomValidity(''); if (!panel.hidden) { close(); return } input.value = ''; input.blur() }
  })
  input.addEventListener('blur', () => window.setTimeout(() => { if (!panel.contains(document.activeElement)) close() }, 120))
  host.addEventListener('click', event => {
    const target = event.target as Element
    if (target.closest('.app-header__search-button') && input.value.trim().length >= 2) openCentralSearch()
    else if (target.closest('svg') && !target.closest('button, a')) openCentralSearch()
  })
}
import {routeLocation} from "./path_location"
