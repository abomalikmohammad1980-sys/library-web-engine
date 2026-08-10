import { h } from '../ui'
import { pageContent } from '../components'
import { icon } from '../icons'
import { listBooks, type StoredBook } from '../engine/library_store'
import { attachLiveSearch } from '../live_search'
import { bookCover } from '../book_cover'
import { authorLink } from '../taxonomy_links'
import { stateView } from '../state_view'

type Shelf = 'all' | 'recent' | 'pdf'

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
    stateView({ kind: 'loading', icon: 'book', title: 'جارٍ ترتيب رفوف مكتبتك' }),
  )
  root.appendChild(content)
  void hydrate(content)
  return root
}

async function hydrate(root: HTMLElement): Promise<void> {
  root.replaceChildren(stateView({ kind: 'loading', icon: 'book', title: 'جارٍ ترتيب رفوف مكتبتك' }))
  try {
    const books = (await listBooks()).sort((a, b) => b.addedAt - a.addedAt)
    if (!books.length) {
      root.replaceChildren(stateView({ kind: 'empty', icon: 'book', title: 'مكتبتك تنتظر أول كتاب', description: 'أضف كتاب Word من المكتبة ليظهر هنا.', actionLabel: 'إضافة كتاب', href: '#/library' }))
      return
    }
    let shelf: Shelf = 'all'
    const grid = h('div', { class: 'discover-grid' })
    const controls = h('div', { class: 'discover-controls' }, h('h2', { id: 'shelves-title' }, 'رفوفك'))
    const filters = h('div', { class: 'chip-row', role: 'group', 'aria-label': 'تصفية الكتب' })
    const render = (): void => {
      const visible = shelf === 'pdf' ? books.filter((book) => book.pdfStatus === 'ready') : shelf === 'recent' ? books.slice(0, 6) : books
      grid.replaceChildren(...visible.map(discoveryCard))
      if (!visible.length) grid.replaceChildren(stateView({ kind: 'no-results', icon: 'book', title: 'لا توجد كتب في هذا الرف بعد', description: 'اختر رفًا آخر أو أضف كتبًا جديدة إلى مكتبتك.', actionLabel: 'فتح المكتبة', href: '#/library' }))
    }
    for (const item of [{ id: 'all', label: `كل الكتب · ${books.length}` }, { id: 'recent', label: 'المضافة حديثًا' }, { id: 'pdf', label: 'جاهزة للتنزيل PDF' }] as { id: Shelf; label: string }[]) {
      const button = h('button', { class: 'chip', 'aria-current': item.id === shelf ? 'true' : undefined }, item.label)
      button.addEventListener('click', () => {
        shelf = item.id
        for (const child of filters.querySelectorAll('button')) child.removeAttribute('aria-current')
        button.setAttribute('aria-current', 'true')
        render()
      })
      filters.appendChild(button)
    }
    controls.appendChild(filters)
    root.replaceChildren(controls, grid)
    render()
  } catch {
    root.replaceChildren(stateView({ kind: 'error', title: 'تعذّر ترتيب الرفوف الآن', description: 'كتبك محفوظة؛ أعد المحاولة دون إعادة تحميل الصفحة.', actionLabel: 'إعادة المحاولة', onAction: () => void hydrate(root) }))
  }
}

function discoveryCard(book: StoredBook): HTMLElement {
  const status = book.pdfStatus === 'ready' ? 'Word وPDF' : book.pdfStatus === 'failed' ? 'Word محفوظ' : 'جارٍ تجهيز PDF'
  return h('article', { class: 'discover-card' },
    h('a', { class: 'discover-card__mark', href: `#/reader/${book.id}`, 'aria-label': `افتح ${book.title}` }, bookCover(book, 'discover-card__cover-art')),
    h('div', { class: 'discover-card__copy' },
      h('a', { class: 'discover-card__title', href: `#/reader/${book.id}` }, book.title),
      authorLink(book.author),
      h('span', { class: 'discover-card__status' }, status),
    ),
  )
}
