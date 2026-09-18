import { h } from './ui'
import { decorativeImage } from './safe_image'
import smallColorLogo from './assets/brand-logo-color-small.webp?inline'

/** شعار المشروع الرسمي: الملون هو الأصل، والأسود بديل الطباعة/الألوان القسرية. */
export function brandMark(className = 'brand-mark'): HTMLElement {
  const monochrome = document.createElement('source')
  monochrome.media = 'print, (forced-colors: active)'
  monochrome.srcset = '/brand-logo-mono.png'
  const fullSize = /(?:welcome__hero-mark|reader__text-title-logo)/.test(className)
  return h('span', { class: className, 'aria-hidden': 'true' },
    h('picture', { class: 'brand-mark__picture' },
      monochrome,
      decorativeImage('brand-mark__image', fullSize ? '/brand-logo-color.webp' : smallColorLogo),
    ),
  )
}
