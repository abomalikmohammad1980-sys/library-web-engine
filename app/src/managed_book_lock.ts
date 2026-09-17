import { icon } from './icons'
import { h } from './ui'

export const MANAGED_BOOK_LOCK_LABEL = 'كتاب مدمج ومحمي من الحذف داخل الخزانة'

/** علامة الحماية الموحدة للكتاب المنشور؛ لا تحمل نصًا مرئيًا يغيّر هندسة البطاقة. */
export function managedBookLock(className = ''): HTMLElement {
  return h('span', {
    class: ['book-card__managed-lock', className].filter(Boolean).join(' '),
    title: MANAGED_BOOK_LOCK_LABEL,
    'aria-label': MANAGED_BOOK_LOCK_LABEL,
    role: 'img',
  }, icon('lock', 15))
}
