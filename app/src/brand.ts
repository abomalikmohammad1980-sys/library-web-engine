import { h } from './ui'
import { decorativeImage } from './safe_image'

/** شعار المشروع الرسمي: الملون هو الأصل، والأسود بديل الطباعة/الألوان القسرية. */
export function brandMark(className = 'brand-mark'): HTMLElement {
  return h('span', { class: className, 'aria-hidden': 'true' },
    decorativeImage('brand-mark__color','./brand-logo-color.webp'),
    decorativeImage('brand-mark__mono','./brand-logo-mono.png'),
  )
}
