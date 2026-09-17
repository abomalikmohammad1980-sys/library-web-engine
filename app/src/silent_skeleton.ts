import { h } from './ui'

/**
 * هيكل بصري صامت للإطار الأول. لا يعلن «تحميلًا» لقارئ الشاشة ولا يعرض
 * رسالة مؤقتة قد تومض قبل المحتوى الحقيقي؛ الخطأ الفعلي وحده يُعلن لاحقًا.
 */
export function silentSkeleton(variant: 'page' | 'cards' | 'reading' = 'page'): HTMLElement {
  return h('div', { class: `silent-skeleton silent-skeleton--${variant}`, 'aria-hidden': 'true' },
    h('span', { class: 'silent-skeleton__line silent-skeleton__line--wide' }),
    h('span', { class: 'silent-skeleton__line' }),
    h('span', { class: 'silent-skeleton__line silent-skeleton__line--short' }),
  )
}
