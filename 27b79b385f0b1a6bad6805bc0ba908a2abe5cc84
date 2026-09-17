import { groupBookSeries } from '../book_series'
import { pageContent } from '../components'
import { listBooks } from '../engine/library_store'
import { currentHashQuery } from '../hash_query_state'
import { mountStateView, stateView } from '../state_view'
import { arabicNum, h } from '../ui'

export function seriesScreen(): HTMLElement {
  const root = pageContent(h('section', { class: 'series-hero', 'aria-labelledby': 'series-title' }, h('p', { class: 'page-eyebrow' }, 'مسارات العلم'), h('h1', { class: 'page-title', id: 'series-title' }, 'السلاسل العلمية'), h('p', { class: 'page-sub' }, 'كتب مرتبطة بسلسلة موثقة يدويًا، مرتبة كما حددتها في بيانات الكتاب.')))
  const host = stateView({ kind: 'loading', icon: 'book', title: 'جارٍ جمع السلاسل العلمية' }); root.appendChild(host); void hydrate(host); return root
}
async function hydrate(host: HTMLElement): Promise<void> {
  try {
    const requested = currentHashQuery().get('name')?.trim(), all = groupBookSeries(await listBooks()), groups = requested ? all.filter(group => group.name === requested) : all
    host.className = 'series-groups'; host.removeAttribute('role'); host.replaceChildren()
    if (!groups.length) { host.appendChild(stateView({ kind: requested ? 'no-results' : 'empty', icon: 'book', title: requested ? 'السلسلة غير موجودة في الخزانة' : 'لا توجد سلاسل موثقة بعد', description: requested ? 'قد يكون اسم السلسلة تغير في بيانات الكتاب.' : 'أضف اسم السلسلة وترتيب الكتاب من محرر المكتبة، وستظهر هنا.' })); return }
    for (const group of groups) {
      const books = group.books.map(book => h('li', null,
        h('span', { class: 'series-group__order' }, book.seriesOrder ? arabicNum(book.seriesOrder) : '—'),
        h('div', null, h('strong', null, book.title), h('small', null, book.author || 'مؤلف غير معروف')),
        h('a', { class: 'btn btn--secondary', href: `#/reader/${book.id}` }, 'فتح الكتاب')))
      host.appendChild(h('article', { class: 'series-group' }, h('div', { class: 'section-header' }, h('div', null, h('h2', null, group.name), h('p', null, `${arabicNum(group.books.length)} كتب`))), h('ol', { class: 'series-group__books' }, ...books)))
    }
  } catch { mountStateView(host, { kind: 'error', title: 'تعذّر جمع السلاسل', description: 'بيانات الكتب لم تتغير.', actionLabel: 'إعادة المحاولة', onAction: () => void hydrate(host) }) }
}
