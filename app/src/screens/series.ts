import { groupBookSeries } from '../book_series'
import { uiTemplateAttribute, uiTemplateText } from '../ui_template_binding'
import { pageContent } from '../components'
import { listBooks } from '../engine/library_store'
import { currentHashQuery } from '../hash_query_state'
import { mountStateView, stateView } from '../state_view'
import { silentSkeleton } from '../silent_skeleton'
import { arabicNum, h } from '../ui'
import { publicPageHero } from '../public_page_hero'
import { bookOrdinal } from '../book_ordering'
import { authorLink, categoryLink, effectiveBookCategory } from '../taxonomy_links'
import { bindBookDisplayTitle } from '../book_locale_display'

export function seriesScreen(): HTMLElement {
  const root = pageContent(publicPageHero({ eyebrow: 'مسارات العلم', title: 'السلاسل العلمية', titleId: 'series-title', description: 'كتب مرتبطة بسلسلة موثقة يدويًا، مرتبة كما حددتها في بيانات الكتاب.', className: 'series-hero' }))
  const host = h('section', { class: 'series-groups', 'aria-busy': 'true' }, silentSkeleton('cards')); root.appendChild(host); void hydrate(host); return root
}
async function hydrate(host: HTMLElement): Promise<void> {
  try {
    const requested = currentHashQuery().get('name')?.trim(), all = groupBookSeries(await listBooks()), groups = requested ? all.filter(group => group.name === requested) : all
    host.className = 'series-groups'; host.removeAttribute('role'); host.removeAttribute('aria-busy'); host.replaceChildren()
    if (!groups.length) { host.appendChild(stateView({ kind: requested ? 'no-results' : 'empty', icon: 'book', title: requested ? 'السلسلة غير موجودة في الخزانة' : 'لا توجد سلاسل موثقة بعد', description: requested ? 'قد يكون اسم السلسلة تغير في بيانات الكتاب.' : 'أضف اسم السلسلة وترتيب الكتاب من محرر المكتبة، وستظهر هنا.' })); return }
    for (const group of groups) {
      const books = group.books.map((book, index) => {
        const ordinal = bookOrdinal(index)
        const readerHref = `#/reader/${book.id}`
        const card = h('li', { style: 'position:relative' },
        h('a', { class: 'series-group__surface', href: readerHref, style: 'position:absolute;inset:0;z-index:1' }),
        h('span', { class: 'series-group__order', 'aria-hidden': 'true', style: 'position:relative;z-index:2;pointer-events:none' }, arabicNum(book.seriesOrder ?? ordinal.number)),
        h('div', { style: 'position:relative;z-index:2;pointer-events:none' },
          bindBookDisplayTitle(h('strong', { dataset: { noTranslate: '' } }, book.title), book.id, book.title),
          h('small', { class: 'series-group__links', style: 'pointer-events:auto' },
            authorLink(book.author, undefined, book.authorId),
            document.createTextNode(' · '),
            categoryLink(effectiveBookCategory(book)))),
        h('a', { class: 'btn btn--secondary', href: readerHref, style: 'position:relative;z-index:2' }, 'فتح الكتاب'))
        uiTemplateAttribute(card, 'aria-label', 'afecb05314ef7e20', {p1:ordinal.number,p2:book.title})
        uiTemplateAttribute(card.querySelector('.series-group__surface')!, 'aria-label', '8353b16eaeab196c', {p1:book.title})
        return card
      })
      host.appendChild(h('article', { class: 'series-group' }, h('div', { class: 'section-header' }, h('div', null, h('h2', { dataset: { noTranslate: '' } }, group.name), h('p', null, uiTemplateText('d546cb9b56523fa3',{p1:group.books.length})))), h('ol', { class: 'series-group__books' }, ...books)))
    }
  } catch { host.removeAttribute('aria-busy'); mountStateView(host, { kind: 'error', title: 'تعذّر جمع السلاسل', description: 'بيانات الكتب لم تتغير.', actionLabel: 'إعادة المحاولة', onAction: () => void hydrate(host) }) }
}
