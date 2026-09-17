/* أدوات DOM صغيرة — TS نقي بلا إطار عمل */

export type Child = Node | string | null | undefined | false

export interface Attrs {
  class?: string
  id?: string
  style?: string
  href?: string
  src?: string
  alt?: string
  decoding?: 'sync' | 'async' | 'auto'
  target?: string
  rel?: string
  title?: string
  role?: string
  tabindex?: number
  dir?: 'rtl' | 'ltr'
  type?: string
  placeholder?: string
  value?: string
  min?: string
  max?: string
  step?: string
  selected?: boolean
  readonly?: boolean
  disabled?: boolean
  hidden?: boolean
  accept?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-hidden'?: 'true' | 'false'
  'aria-live'?: 'polite' | 'assertive' | 'off'
  'aria-atomic'?: 'true' | 'false'
  'aria-modal'?: 'true' | 'false'
  'aria-selected'?: 'true' | 'false'
  'aria-current'?: 'true' | 'false' | 'page' | 'step' | 'location' | 'date' | 'time' | undefined
  'aria-expanded'?: 'true' | 'false'
  'aria-checked'?: 'true' | 'false'
  onclick?: (ev: MouseEvent) => void
  dataset?: Record<string, string>
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  // A button outside a form behaves the same either way, while a button later
  // moved into a form must never become an accidental submit control.
  if (tag === 'button') (el as HTMLButtonElement).type = 'button'
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === false) continue
      if (key === 'class') el.className = String(value)
      else if (key === 'style') el.setAttribute('style', String(value))
      else if (key === 'readonly') el.setAttribute('readonly', '')
      else if (key === 'disabled') {
        const b = el as HTMLButtonElement
        b.disabled = true
      } else if (key === 'dataset') {
        for (const [dk, dv] of Object.entries(value as Record<string, string>)) {
          el.dataset[dk] = dv
        }
      } else if (key === 'onclick') {
        el.addEventListener('click', value as EventListener)
      } else if (key.startsWith('aria-')) {
        el.setAttribute(key, String(value))
      } else {
        ;(el as unknown as Record<string, string>)[key] = String(value)
      }
    }
  }
  append(el, ...children)
  return el
}

export function append(el: Node, ...children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)
  }
}

/** رقم مشرقي (٠-٩) */
export function arabicNum(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.charAt(Number(d)))
}

/** فاصل أرقام مشرقي «٤٫٢» */
export function arabicDecimal(num: number, digits = 1): string {
  const s = num.toFixed(digits)
  const [int, frac] = s.split('.')
  return frac ? `${arabicNum(int ?? '0')}٫${arabicNum(frac ?? '0')}` : arabicNum(int ?? '0')
}

export function navigate(hash: string): void {
  if (location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    location.hash = hash
  }
  window.scrollTo({ top: 0 })
}

let toastTimer: number | undefined

export function toast(message: string): void {
  document.querySelector('.toast')?.remove()
  const el = h('div', { class: 'toast', role: 'status' }, message)
  document.body.appendChild(el)
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => el.remove(), 3200)
}

/** محتوى السطر الواحد: نص + مصفوفة صفوف Skeleton */
export function skeletonGrid(covers: number): HTMLElement {
  const grid = h('div', { class: 'card-grid', role: 'status', 'aria-label': 'جارٍ التحميل' })
  for (let i = 0; i < covers; i++) {
    grid.appendChild(h('div', { class: 'skeleton skeleton--cover' }))
  }
  return grid
}
