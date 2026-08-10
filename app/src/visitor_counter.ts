import { h } from './ui'

const SESSION_COUNT_KEY = 'khizana:visitor-count:v1'
const VISITORS_ENDPOINT = '/api/visitors'

function validTotal(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 500
}

function renderTotal(element: HTMLElement, total: number): void {
  element.textContent = `${new Intl.NumberFormat('ar').format(total)} زائرًا منذ انطلاق الخِزانة`
  element.hidden = false
}

export function visitorCounter(): HTMLElement {
  const element = h('p', {
    class: 'site-footer__visitor-count',
    hidden: true,
    role: 'status',
    'aria-live': 'polite',
    'aria-label': 'عدد زوار الخِزانة',
  })

  const cached = Number(sessionStorage.getItem(SESSION_COUNT_KEY))
  if (validTotal(cached)) {
    renderTotal(element, cached)
    return element
  }

  void fetch(VISITORS_ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  }).then(async response => {
    if (!response.ok) return
    const payload: unknown = await response.json()
    const total = typeof payload === 'object' && payload !== null ? (payload as { total?: unknown }).total : undefined
    if (!validTotal(total) || !element.isConnected) return
    sessionStorage.setItem(SESSION_COUNT_KEY, String(total))
    renderTotal(element, total)
  }).catch(() => {
    // العداد تحسين شبكي اختياري؛ عند تعذره يبقى مخفيًا ولا نعرض رقمًا تخمينيًا.
  })

  return element
}
