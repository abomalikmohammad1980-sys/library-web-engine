import { h } from './ui'
import { icon } from './icons'
import { pageJump } from './page_jump'

export function updateSearchNextLabel(next:HTMLButtonElement,retry:boolean):void{
  const label=retry?'إعادة محاولة تحميل النتائج':'النتائج التالية'
  next.title=label
  next.setAttribute('aria-label',label)
}

export function searchPagination(onPage: (page: number) => void) {
  const previous = h('button', { type: 'button', class: 'btn btn--secondary', title: 'النتائج السابقة', 'aria-label': 'النتائج السابقة' }, icon('chevron-right', 18)) as HTMLButtonElement
  const next = h('button', { type: 'button', class: 'btn btn--primary', title: 'النتائج التالية', 'aria-label': 'النتائج التالية' }, icon('chevron-left', 18)) as HTMLButtonElement
  const pageStatus = h('p', { class: 'search-pagination__status', role: 'status', 'aria-live': 'polite' })
  const jump = pageJump('نتائج البحث', onPage, true)
  const element = h('nav', { class: 'search-pagination', 'aria-label': 'صفحات نتائج البحث' }, previous, jump.element, next, pageStatus)
  return { element, previous, next, pageStatus, jump }
}
