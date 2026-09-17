import { pageContent } from '../components'
import { listBooks } from '../engine/library_store'
import { auditLibraryData, type QualityIssueKind } from '../library_data_quality'
import { mountStateView, stateView } from '../state_view'
import { arabicNum, h } from '../ui'
import { silentSkeleton } from '../silent_skeleton'
import { publicPageHero } from '../public_page_hero'
import { bookOrdinal } from '../book_ordering'
import { authorLink, categoryLink, effectiveBookCategory } from '../taxonomy_links'
import {uiTemplateText,uiTemplateAttribute} from '../ui_template_binding'

export function dataQualityScreen(): HTMLElement {
  const root = pageContent(publicPageHero({ eyebrow: 'إدارة وتوثيق', title: 'جودة بيانات المكتبة', titleId: 'quality-title', description: 'تدقيق محلي صريح للنواقص والتعارضات التي تؤثر في البحث والطبعات والسلاسل.', className: 'quality-hero' }))
  const host = h('section', { 'aria-busy': 'true' }, silentSkeleton('cards')); root.appendChild(host); void hydrate(host); return root
}
async function hydrate(host: HTMLElement): Promise<void> {
  try {
    const books = await listBooks(), byId = new Map(books.map(book => [book.id, book])), issues = auditLibraryData(books), filter = h('select', { 'aria-label': 'تصفية نوع مشكلة البيانات' }, h('option', { value: '' }, 'كل المشكلات'), h('option', { value: 'identity' }, 'هوية المؤلف'), h('option', { value: 'classification' }, 'التصنيف'), h('option', { value: 'edition' }, 'الطبعات'), h('option', { value: 'series' }, 'السلاسل')) as HTMLSelectElement
    const summary = h('strong', { 'aria-live': 'polite' }), list = h('div', { class: 'quality-issues' })
    const render = (): void => {
      const active = filter.value as QualityIssueKind | '', shown = active ? issues.filter(issue => issue.kind === active) : issues
      summary.replaceChildren(uiTemplateText('ec3e7437de6ec7ce',{p1:shown.length})); list.replaceChildren()
      if (!shown.length) { list.appendChild(stateView({ kind: 'empty', icon: 'check', title: active ? 'لا توجد مشكلات من هذا النوع' : 'بيانات المكتبة تجتاز التدقيق الحالي', compact: true })); return }
      for (const [index, issue] of shown.entries()) {
        const book = byId.get(issue.bookId), ordinal = bookOrdinal(index), readerHref = `#/reader/${issue.bookId}`
        const surface=h('a', { class: 'quality-issue__surface', href: readerHref, style: 'position:absolute;inset:0;z-index:1' })
        uiTemplateAttribute(surface,'aria-label','8353b16eaeab196c',{p1:issue.bookTitle})
        const card=h('article', { class: `quality-issue quality-issue--${issue.severity}`, style: 'position:relative' }, surface,
          h('span', { class: 'book-card__ordinal', 'aria-hidden': 'true', style: 'position:relative;z-index:2;pointer-events:none' }, arabicNum(ordinal.number)),
          h('div', { style: 'position:relative;z-index:2;pointer-events:none' }, h('strong', { dataset: { noTranslate: '' } }, issue.bookTitle),
            h('p', null, issue.messageBinding?uiTemplateText(issue.messageBinding.id,issue.messageBinding.parameters):issue.message),
            book ? h('p', { class: 'quality-issue__links', style: 'pointer-events:auto' }, authorLink(book.author, undefined, book.authorId), document.createTextNode(' · '), categoryLink(effectiveBookCategory(book))) : null),
          h('div', { class: 'quality-issue__actions', style: 'position:relative;z-index:2' }, h('a', { class: 'btn btn--secondary', href: readerHref }, 'قراءة الكتاب'), h('a', { class: 'btn btn--primary', href: `#/library?adminQ=${encodeURIComponent(issue.bookTitle)}` }, 'إصلاح في الإدارة')))
        uiTemplateAttribute(card,'aria-label','afecb05314ef7e20',{p1:ordinal.number,p2:issue.bookTitle})
        list.appendChild(card)
      }
    }
    filter.addEventListener('change', render); host.className = 'quality-workspace'; host.removeAttribute('role'); host.removeAttribute('aria-busy'); host.replaceChildren(h('div', { class: 'quality-controls' }, filter, summary), list); render()
  } catch { host.removeAttribute('aria-busy'); mountStateView(host, { kind: 'error', title: 'تعذّر تدقيق بيانات المكتبة', description: 'لم تتغير أي بيانات.', actionLabel: 'إعادة المحاولة', onAction: () => void hydrate(host) }) }
}
