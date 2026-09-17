import { pageContent } from '../components'
import { bookCover } from '../book_cover'
import { listBooks, type StoredBook } from '../engine/library_store'
import { captureShelfStore, listShelves } from '../shelf_store'
import {captureRouteResourceScope,routeEventListener} from '../resource_lifecycle'
import { icon } from '../icons'
import { arabicNum, h, toast } from '../ui'
import { mountStateView, stateView } from '../state_view'
import { publicPageHero } from '../public_page_hero'
import { bookOrdinal, orderedBooks, sortBooks, BOOK_SORT_OPTIONS, type BookSort } from '../book_ordering'
import {availableAuthorChronology as booksWithAuthorChronology} from '../book_ordering_chronology'
import { authorLink, categoryLink, effectiveBookCategory } from '../taxonomy_links'
import { uiTemplateAttribute, uiTemplateText, renderBoundUiTemplate } from '../ui_template_binding'
import { bindAuthorDisplayName } from '../author_display_names'
import { bindBookDisplayTitle, bindBookDisplayTitleTooltip } from '../book_locale_display'

export function shelvesScreen(): HTMLElement {
  const scope=captureRouteResourceScope()
  let generation=0
  const name = h('input', { type: 'text', placeholder: 'أنشئ رفًا جديدًا…', 'aria-label': 'اسم رف جديد' }) as HTMLInputElement
  const instantShelves = listShelves().map(shelf => h('section', { class: 'shelf-card' },
    h('header', null, h('div', null, h('h2', { dataset: { noTranslate: '' } }, shelf.name), h('p', null, uiTemplateText('bd92467903830d1a',{p1:shelf.bookIds.length})))),
  ))
  const host = h('section', { class: 'shelves-content' },
    h('div', { class: 'shelves-create' }, name, h('a', { class: 'btn btn--primary', href: '#/library' }, 'اختر كتب الرفوف')),
    h('div', { class: 'shelves-grid' }, ...instantShelves),
  )
  const root = pageContent(publicPageHero({ eyebrow: 'مكتبتي', title: 'الرفوف الشخصية', titleId: 'shelves-title', description: 'اختر الكتب وأزلها من كل رف هنا مباشرة؛ ويمكن للكتاب أن يظهر في أكثر من رف.', className: 'library-hero' }), host)
  const refresh=():void=>{
    if(scope.disposed)return
    const request=++generation,editor=captureShelfStore()
    if(request>1)host.replaceChildren(...editor.list().map(shelf=>h('section',{class:'shelf-card'},h('h2',{dataset:{noTranslate:''}},shelf.name))))
    void hydrate(host,editor,()=>!scope.disposed&&request===generation&&editor.isCurrent(),refresh)
  }
  routeEventListener(window,'alkhizana:account-changed',refresh,undefined,scope)
  refresh()
  return root
}

function shelfBookPicker(shelfId: string, shelfName: string, choices: StoredBook[], rerender: () => void, editor: ReturnType<typeof captureShelfStore>, isCurrent:()=>boolean): HTMLElement {
  const input = h('input', { type: 'search', placeholder: 'اكتب جزءًا من اسم الكتاب…' }) as HTMLInputElement
  uiTemplateAttribute(input,'aria-label','a74288aab7d6124d',{p1:shelfName})
  const results = h('div', { class: 'shelf-card__picker-results', role: 'listbox' })
  uiTemplateAttribute(results,'aria-label','24147197ad435b5d',{p1:shelfName})
  const filteredChoices = (): StoredBook[] => {
    const query = normalizeShelfChoice(input.value)
    return choices.filter(book => !query || normalizeShelfChoice(shelfBookChoiceLabel(book)).includes(query)).slice(0, 12)
  }
  const renderResults = (): void => {
    if(!isCurrent())return
    const visible = filteredChoices()
    results.replaceChildren(...visible.map(book => {
      const choice = h('button', { class: 'shelf-card__picker-choice', type: 'button', role: 'option', title: shelfBookChoiceLabel(book) },
        bookCover(book, 'shelf-card__picker-cover'), h('span', null,
          bindBookDisplayTitle(h('strong', { dataset: { noTranslate: '' } }, book.title), book.id, book.title),
          book.author ? bindAuthorDisplayName(h('small', { dataset: { noTranslate: '' } }, book.author), book.authorId, book.author) : h('small', null, 'مؤلف غير معروف')))
      choice.addEventListener('click', () => { if(!isCurrent())return; editor.setBook(shelfId, book.id, true); rerender() })
      return choice
    }), ...(visible.length ? [] : [stateView({ kind: 'no-results', icon: 'search', title: 'لا يوجد كتاب بهذا الاسم', compact: true })]))
  }
  input.addEventListener('input', renderResults)
  input.addEventListener('focus', renderResults)
  const add = h('button', { class: 'btn btn--secondary', type: 'button' }, icon('plus', 16), 'إضافة الكتاب')
  add.addEventListener('click', () => {
    if(!isCurrent())return
    const selected = resolveShelfBookChoice(choices, input.value)
    if (!selected) { toast(input.value.trim() ? 'تابع الكتابة أو اختر كتابًا واحدًا من القائمة' : 'اكتب جزءًا من اسم الكتاب واختره من القائمة'); input.focus(); return }
    editor.setBook(shelfId, selected.id, true); rerender()
  })
  const picker = h('div', { class: 'shelf-card__picker' }, input, add, results)
  renderResults()
  return picker
}

function normalizeShelfChoice(value: string): string {
  return value.normalize('NFKD').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/gu, '').replace(/ـ/gu, '').replace(/[أإآٱ]/gu, 'ا').replace(/ى/gu, 'ي').replace(/ة/gu, 'ه').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('ar')
}

function shelfBookChoiceLabel(book: Pick<StoredBook, 'title' | 'author'>): string {
  return [book.title, book.author].filter(Boolean).join(' — ')
}

export function resolveShelfBookChoice<T extends Pick<StoredBook, 'id' | 'title' | 'author'>>(choices: readonly T[], value: string): T | undefined {
  const query = normalizeShelfChoice(value)
  if (!query) return undefined
  const exact = choices.filter(book => normalizeShelfChoice(shelfBookChoiceLabel(book)) === query || normalizeShelfChoice(book.title) === query)
  if (exact.length === 1) return exact[0]
  const partial = choices.filter(book => normalizeShelfChoice(shelfBookChoiceLabel(book)).includes(query))
  return partial.length === 1 ? partial[0] : undefined
}

export function selectShelfBooks(books: StoredBook[], ids: readonly string[], order: BookSort = 'death'): StoredBook[] {
  const membership = new Set(ids)
  return sortBooks(books.filter(book => membership.has(book.id)), order)
}

async function hydrate(host: HTMLElement,editor:ReturnType<typeof captureShelfStore>,isCurrent:()=>boolean,refresh:()=>void): Promise<void> {
  let books: StoredBook[]
  try { books = await booksWithAuthorChronology(await listBooks()) }
  catch { if(!isCurrent())return; mountStateView(host, { kind: 'error', title: 'تعذّر فتح الرفوف', description: 'كتبك لم تتغير. أعد المحاولة.', actionLabel: 'إعادة المحاولة', onAction: refresh }); return }
  if(!isCurrent())return
  let bookOrder: BookSort = 'death'
  const render = (): void => {
    if(!isCurrent())return
    const shelves = editor.list()
    const name = h('input', { type: 'text', placeholder: 'أنشئ رفًا جديدًا…', 'aria-label': 'اسم رف جديد' }) as HTMLInputElement
    const add = h('button', { class: 'btn btn--primary', type: 'button' }, icon('plus', 17), 'إضافة رف')
    add.addEventListener('click', () => { if(!isCurrent())return; try { editor.create(name.value); render() } catch (error) { toast(error instanceof Error ? error.message : 'تعذّر إنشاء الرف') } })
    const grid = h('div', { class: 'shelves-grid' }, ...shelves.map(shelf => {
      const shelfBooks = selectShelfBooks(books, shelf.bookIds, bookOrder)
      // قائمة الالتقاط نفسها قائمة كتب مرئية؛ تبقى على ترتيب المكتبة الحاكم
      // (وفاة المؤلف فالعنوان، والمجهول/المعاصر أخيرًا) قبل تطبيق البحث والحد.
      const choices = orderedBooks(books.filter(book => !shelf.bookIds.includes(book.id)))
      const remove = h('button', { class: 'shelf-card__remove', type: 'button' }, icon('close', 16))
      uiTemplateAttribute(remove,'aria-label','86c3e21bfbb838a0',{p1:shelf.name})
      remove.addEventListener('click', () => { if(!isCurrent())return; if (confirm(renderBoundUiTemplate('d241d8434203dc6e',{p1:shelf.name},document.documentElement.lang||'ar'))) { editor.remove(shelf.id); render() } })
      const shelfBookCard=(book:StoredBook,index:number):HTMLElement=>{
        const ordinal = bookOrdinal(index)
        const unlink = h('button', { class: 'shelf-card__book-remove', type: 'button' }, icon('close', 14))
        uiTemplateAttribute(unlink,'aria-label','61d92284dd1557f7',{p1:book.title,p2:shelf.name})
        unlink.addEventListener('click', () => { if(!isCurrent())return; editor.setBook(shelf.id, book.id, false); render() })
        const primary = bindBookDisplayTitleTooltip(h('a', { class: 'shelf-card__book-primary', href: '#/reader/' + book.id, title: book.title, dataset: { noTranslate: '' } },
          bookCover(book, 'shelf-card__cover'), bindBookDisplayTitle(h('span', { class: 'shelf-card__book-title', dataset: { noTranslate: '' } }, book.title), book.id, book.title)), book.id, book.title)
        uiTemplateAttribute(primary,'aria-label','afecb05314ef7e20',{p1:ordinal.number,p2:book.title})
        return h('article', { class: 'shelf-card__book' },
          h('span', { class: 'shelf-card__book-ordinal', 'aria-hidden': 'true' }, arabicNum(ordinal.number)),
          primary,
          h('div', { class: 'shelf-card__book-links' },
            authorLink(book.author, 'shelf-card__author', book.authorId),
            categoryLink(effectiveBookCategory(book), 'shelf-card__category'),
          ),
          unlink,
        )
      }
      let visibleBooks=Math.min(24,shelfBooks.length)
      const booksHost=h('div',{class:'shelf-card__books'})
      const renderShelfBooks=():void=>{
        if(!isCurrent())return
        const cards=shelfBooks.slice(0,visibleBooks).map(shelfBookCard)
        const more=visibleBooks<shelfBooks.length?h('button',{class:'btn btn--secondary',type:'button',onclick:()=>{visibleBooks=Math.min(shelfBooks.length,visibleBooks+24);renderShelfBooks()}},uiTemplateText('d5dba0b1e643c40c',{p1:Math.min(24,shelfBooks.length-visibleBooks)})):null
        booksHost.replaceChildren(...cards,...(cards.length?[]:[stateView({ kind: 'empty', icon: 'book', title: 'هذا الرف فارغ', description: 'ابحث في كتب مكتبتك وأضف ما تريد مباشرة.' })]),...(more?[more]:[]))
      }
      renderShelfBooks()
      return h('section', { class: 'shelf-card' },
        h('header', null, h('div', null, h('h2', { dataset: { noTranslate: '' } }, shelf.name), h('p', null, uiTemplateText('bd92467903830d1a',{p1:shelfBooks.length}))), remove),
        booksHost,
        h('details', {class:'shelf-card__manage'}, h('summary',null,icon('plus',16),'إضافة كتب إلى الرف'), shelfBookPicker(shelf.id, shelf.name, choices, render,editor,isCurrent)),
      )
    }))
    host.className = 'shelves-content'
    host.removeAttribute('role')
    const order = h('select', { 'aria-label': 'ترتيب كتب الرفوف' }, ...BOOK_SORT_OPTIONS.map(({value,label})=>h('option',{value},label))) as HTMLSelectElement
    order.value = bookOrder
    order.addEventListener('change', () => { if(!isCurrent())return; bookOrder = order.value as BookSort; render() })
    host.replaceChildren(h('div', { class: 'shelves-create' }, name, add, h('label', null, 'ترتيب الكتب', order)), grid)
  }
  render()
}
