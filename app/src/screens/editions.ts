import { pageContent } from '../components'
import { groupBookEditions } from '../edition_groups'
import { listBooks } from '../engine/library_store'
import { mountStateView, stateView } from '../state_view'
import { arabicNum, h } from '../ui'

export function editionsScreen(): HTMLElement {
  const root = pageContent(h('section', { class: 'editions-hero', 'aria-labelledby': 'editions-title' }, h('p', { class: 'page-eyebrow' }, 'تحقيق وطبعات'), h('h1', { class: 'page-title', id: 'editions-title' }, 'مركز الطبعات'), h('p', { class: 'page-sub' }, 'قارن النسخ المتعددة الموجودة فعلًا في خزانتك بحسب الناشر والطبعة والمحقق والسنة.')))
  const host = stateView({ kind: 'loading', icon: 'book', title: 'جارٍ جمع طبعات الكتب' }); root.appendChild(host); void hydrate(host); return root
}
async function hydrate(host: HTMLElement): Promise<void> {
  try {
    const groups = groupBookEditions(await listBooks())
    host.className = 'edition-groups'; host.removeAttribute('role'); host.replaceChildren()
    if (!groups.length) { host.appendChild(stateView({ kind: 'empty', icon: 'book', title: 'لا توجد طبعات متعددة بعد', description: 'عند إضافة نسختين بالعنوان نفسه ستظهر المقارنة هنا، دون افتراض بيانات ناقصة.' })); return }
    for (const group of groups) {
      const cards = group.books.map(book => h('section', { class: 'edition-book' },
        h('h3', null, book.title), h('p', null, book.author || 'مؤلف غير معروف'),
        h('dl', null,
          ...(book.publisher ? [h('div', null, h('dt', null, 'الناشر'), h('dd', null, book.publisher))] : []),
          ...(book.edition ? [h('div', null, h('dt', null, 'الطبعة'), h('dd', null, book.edition))] : []),
          ...(book.investigator ? [h('div', null, h('dt', null, 'المحقق'), h('dd', null, book.investigator))] : []),
          ...(book.publicationYearHijri ? [h('div', null, h('dt', null, 'السنة'), h('dd', null, `${arabicNum(book.publicationYearHijri)} هـ`))] : []),
        ), h('a', { class: 'btn btn--secondary', href: `#/reader/${book.id}` }, 'قراءة الكتاب')))
      host.appendChild(h('article', { class: 'edition-group' }, h('div', { class: 'section-header' }, h('div', null, h('h2', null, group.workTitle), h('p', null, `${arabicNum(group.books.length)} نسخ في الخزانة`))), h('div', { class: 'edition-group__books' }, ...cards)))
    }
  } catch { mountStateView(host, { kind: 'error', title: 'تعذّر جمع الطبعات', description: 'بيانات الكتب لم تتغير.', actionLabel: 'إعادة المحاولة', onAction: () => void hydrate(host) }) }
}
