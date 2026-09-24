import { h } from '../ui'
import { pageContent } from '../components'
import { icon } from '../icons'
import { listBooks, type StoredBook } from '../engine/library_store'
import { attachLiveSearch } from '../live_search'
import { bookCover } from '../book_cover'
import { authorLink, categoryLink, effectiveBookCategory } from '../taxonomy_links'
import { bindBookDisplayTitle } from '../book_locale_display'
import { stateView } from '../state_view'
import { arabicNum } from '../ui'
import { bookOrdinal, compareBooksByMetric, sortBooks, BOOK_SORT_OPTIONS, type BookSort } from '../book_ordering'
import {availableAuthorChronology as booksWithAuthorChronology} from '../book_ordering_chronology'
import {uiTemplateText,uiTemplateAttribute} from '../ui_template_binding'

type Shelf = 'all' | 'recent' | 'pdf'
export function selectDiscoveryBooks(books:StoredBook[],shelf:Shelf,order:BookSort='death'):StoredBook[]{
  return shelf==='recent'?[...books].sort(compareBooksByMetric(book=>book.addedAt)).slice(0,6):sortBooks(shelf==='pdf'?books.filter(book=>book.pdfStatus==='ready'):books,order)
}

export function browseScreen(): HTMLElement {
  const root = pageContent()
  const hero = h('section', { class: 'discover-hero', 'aria-labelledby': 'discover-title' },
    h('p', { class: 'page-eyebrow' }, 'اكتشف'),
    h('h1', { class: 'page-title', id: 'discover-title' }, 'افتح بابًا جديدًا للمعرفة'),
    h('p', { class: 'page-sub' }, 'ابحث في محتوى كتبك، أو تصفح رفوفًا تُبنى من مكتبتك الفعلية.'),
  )
  const search = h('div', { class: 'home-search discover-search', role: 'search' })
  const input = h('input', { type: 'search', placeholder: 'موضوع، عبارة، كتاب أو مؤلف…', 'aria-label': 'ابحث في شاشة اكتشف' }) as HTMLInputElement
  search.append(icon('search', 20), input)
  attachLiveSearch(input, search)
  hero.appendChild(search)
  root.appendChild(hero)

  const content = h('section', { class: 'discover-content', 'aria-labelledby': 'shelves-title' },
    h('div', { class: 'discover-controls' }, h('h2', { id: 'shelves-title' }, 'رفوفك'), h('div', { class: 'chip-row' }, h('a', { class: 'chip', href: '#/library' }, 'كل الكتب'), h('a', { class: 'chip', href: '#/new-books' }, 'المضافة حديثًا'), h('a', { class: 'chip', href: '#/shelves' }, 'رفوفي الشخصية'))),
  )
  root.appendChild(content)
  void hydrate(content)
  return root
}

async function hydrate(root: HTMLElement): Promise<void> {
  try {
    const books = await booksWithAuthorChronology(await listBooks())
    if (!books.length) {
      root.replaceChildren(stateView({ kind: 'empty', icon: 'book', title: 'مكتبتك تنتظر أول كتاب', description: 'أضف كتاب Word من المكتبة ليظهر هنا.', actionLabel: 'إضافة كتاب', href: '#/library' }))
      return
    }
    if(!root.isConnected)return
    let shelf: Shelf = 'all'
    let page=0
    const pageSize=40
    const grid = h('div', { class: 'discover-grid' })
    const pagination=h('nav',{class:'discover-pagination chip-row','aria-label':'صفحات الكتب'})
    const controls = h('div', { class: 'discover-controls' }, h('h2', { id: 'shelves-title' }, 'رفوفك'))
    const filters = h('div', { class: 'chip-row', role: 'group', 'aria-label': 'تصفية الكتب' })
    const order = h('select', { 'aria-label': 'ترتيب الكتب' }, ...BOOK_SORT_OPTIONS.map(({value,label})=>h('option',{value},label))) as HTMLSelectElement
    const render = (): void => {
      order.disabled = shelf === 'recent'
      const visible = selectDiscoveryBooks(books,shelf,order.value as BookSort)
      page=Math.min(page,Math.max(0,Math.ceil(visible.length/pageSize)-1))
      const start=page*pageSize
      grid.replaceChildren(...visible.slice(start,start+pageSize).map((book,index)=>discoveryCard(book,start+index)))
      pagination.replaceChildren()
      if(visible.length>pageSize){
        const move=(next:number)=>{page=next;render();grid.scrollIntoView({block:'start',behavior:'instant'})}
        pagination.append(h('button',{class:'btn btn--secondary',disabled:page===0,onclick:()=>move(page-1)},'السابق'),h('span',{'aria-live':'polite'},`${arabicNum(start+1)}–${arabicNum(Math.min(start+pageSize,visible.length))} / ${arabicNum(visible.length)}`),h('button',{class:'btn btn--secondary',disabled:start+pageSize>=visible.length,onclick:()=>move(page+1)},'التالي'))
      }
      if (!visible.length) grid.replaceChildren(stateView({ kind: 'no-results', icon: 'book', title: 'لا توجد كتب في هذا الرف بعد', description: 'اختر رفًا آخر أو أضف كتبًا جديدة إلى مكتبتك.', actionLabel: 'فتح المكتبة', href: '#/library' }))
    }
    for (const item of [{ id: 'all', label: `كل الكتب · ${books.length}` }, { id: 'recent', label: 'المضافة حديثًا' }, { id: 'pdf', label: 'جاهزة للتنزيل PDF' }] as { id: Shelf; label: string }[]) {
      const button = h('button', { class: 'chip', 'aria-current': item.id === shelf ? 'true' : undefined }, item.id==='all'?uiTemplateText('50d1a3e6c8623145',{p1:books.length}):item.label)
      button.addEventListener('click', () => {
        shelf = item.id; page=0
        for (const child of filters.querySelectorAll('button')) child.removeAttribute('aria-current')
        button.setAttribute('aria-current', 'true')
        render()
      })
      filters.appendChild(button)
    }
    order.addEventListener('change',()=>{page=0;render()})
    controls.append(filters,h('label',null,'ترتيب الكتب',order))
    root.replaceChildren(controls, grid, pagination)
    render()
  } catch {
    root.replaceChildren(stateView({ kind: 'error', title: 'تعذّر ترتيب الرفوف الآن', description: 'كتبك محفوظة؛ أعد المحاولة دون إعادة تحميل الصفحة.', actionLabel: 'إعادة المحاولة', onAction: () => void hydrate(root) }))
  }
}

function discoveryCard(book: StoredBook, index: number): HTMLElement {
  const status = book.pdfStatus === 'ready' ? 'Word وPDF' : 'Word محفوظ'
  const ordinal = bookOrdinal(index)
  const ordinalNode=h('small', { class: 'book-card__ordinal' }, arabicNum(ordinal.number))
  uiTemplateAttribute(ordinalNode,'aria-label','2ad0367328ba34be',{p1:ordinal.number})
  const surface=h('a', { class: 'discover-card__surface', href: `#/reader/${book.id}` })
  uiTemplateAttribute(surface,'aria-label','8353b16eaeab196c',{p1:book.title})
  const card=h('article', { class: 'discover-card' },
    surface,
    h('div', { class: 'discover-card__mark', 'aria-hidden': 'true' }, bookCover(book, 'discover-card__cover-art')),
    h('div', { class: 'discover-card__copy' },
      ordinalNode,
      bindBookDisplayTitle(h('strong', { class: 'discover-card__title', dataset: { noTranslate: '' } }, book.title), book.id, book.title),
      h('div', { class: 'discover-card__links' },
        authorLink(book.author, undefined, book.authorId),
        categoryLink(effectiveBookCategory(book)),
      ),
      h('span', { class: 'discover-card__status' }, status),
    ),
  )
  uiTemplateAttribute(card,'aria-label','afecb05314ef7e20',{p1:ordinal.number,p2:book.title})
  return card
}
