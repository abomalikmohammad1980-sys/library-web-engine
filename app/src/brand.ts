import { h } from './ui'

/** شعار المشروع الرسمي: الملون هو الأصل، والأسود بديل الطباعة/الألوان القسرية. */
export function brandMark(className = 'brand-mark'): HTMLElement {
  return h('span', { class: className, 'aria-hidden': 'true' },
    h('img', { class: 'brand-mark__color', src: './brand-logo-color.png', alt: '', decoding: 'async' }),
    h('img', { class: 'brand-mark__mono', src: './brand-logo-mono.png', alt: '', decoding: 'async' }),
  )
}
