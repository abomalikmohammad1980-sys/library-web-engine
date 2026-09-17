/* هيكل التطبيق: AppHeader + BottomNav (الدستور §6 — الهيكل والتنقل) */

import { h, type Child } from './ui'
import { icon, type IconName } from './icons'
import { attachLiveSearch } from './live_search'
import { guestSessionIdentity, identityLabel } from './session_identity'
import { watchConnectivity } from './connectivity'
import { captureRouteResourceScope, routeEventListener, routeTimeout } from './resource_lifecycle'
import { getRuntimeCapabilities, publicRuntimeNoticeText } from './runtime_capabilities'
import { brandMark } from './brand'
import { getSettings, saveSettings, type AppSettings, type AppTheme } from './settings_store'
import { translationButton } from './translation'
import { chooseRemembrance } from './remembrances'
import { visitorCounter } from './visitor_counter'

export type GatewayId = 'read' | 'discover' | 'me'

const GATEWAYS: { id: GatewayId; label: string; icon: IconName; hash: string }[] = [
  { id: 'read', label: 'اقرأ', icon: 'book', hash: '#/' },
  { id: 'discover', label: 'اكتشف', icon: 'compass', hash: '#/browse' },
  { id: 'me', label: 'أنا', icon: 'person', hash: '#/me' },
]

let activeHeaderSearch: HTMLInputElement | undefined
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    activeHeaderSearch?.focus()
  }
})

export function appHeader(currentHash: string): HTMLElement {
  const identity = guestSessionIdentity()
  const accountLabel = identityLabel(identity)
  const header = h('header', { class: 'app-header' })
  const inner = h('div', { class: 'app-header__inner' })

  const logo = h('a', { class: 'app-logo', href: '#/', 'aria-label': 'الخِزانة — الصفحة الرئيسية' })
  const mark = brandMark('app-logo__mark brand-mark')
  logo.appendChild(mark)
  logo.appendChild(h('span', { class: 'app-logo__name' }, 'الخِزانة'))

  const nav = h('nav', { class: 'app-header__nav', 'aria-label': 'التنقل الرئيسي' })
  const tabs: { label: string; hash: string }[] = [
    { label: 'الرئيسية', hash: '#/' },
    { label: 'القرآن', hash: '#/quran' },
    { label: 'السنة', hash: '#/sunnah' },
    { label: 'مكتبتي', hash: '#/library' },
    { label: 'المؤلفون', hash: '#/authors' },
    { label: 'بحث', hash: '#/search' },
  ]
  for (const t of tabs) {
    const active = currentHash === t.hash || (t.hash !== '#/' && currentHash.startsWith(t.hash))
    nav.appendChild(
      h('button', {
        'aria-current': active ? 'true' : undefined,
        onclick: () => {
          location.hash = t.hash
        },
      }, t.label),
    )
  }

  inner.appendChild(logo)
  inner.appendChild(nav)
  inner.appendChild(h('div', { class: 'app-header__spacer' }))

  const search = h('div', { class: 'search-field app-header__search', role: 'search' })
  const searchInput = h('input', { type: 'search', placeholder: 'ابحث في كل كتبك…', 'aria-label': 'بحث في المكتبة' }) as HTMLInputElement
  activeHeaderSearch = searchInput
  search.append(icon('search', 19), searchInput, h('kbd', null, '⌘K'))
  attachLiveSearch(searchInput, search)
  inner.appendChild(search)

  const themeNames: Record<AppTheme, string> = { original: 'أصلي', light: 'أبيض', dark: 'أسود', sepia: 'بني' }
  const selectedTheme = getSettings().theme ?? 'original'
  const theme = h('details', { class: 'app-header__theme', 'aria-label': 'اختيار ألوان الخِزانة' }) as HTMLDetailsElement
  const themeSummary = h('summary', { title: 'ألوان الخِزانة', 'aria-label': `ألوان الخِزانة — ${themeNames[selectedTheme]}` },
    h('span', { class: `app-header__theme-swatch app-header__theme-swatch--${selectedTheme}`, 'aria-hidden': 'true' }),
  )
  const themeMenu = h('div', { class: 'app-header__theme-menu', role: 'menu', 'aria-label': 'ألوان الخِزانة' })
  const updateThemeControl = (value: AppTheme): void => {
    const swatch = themeSummary.querySelector('.app-header__theme-swatch')!
    swatch.className = `app-header__theme-swatch app-header__theme-swatch--${value}`
    themeSummary.setAttribute('aria-label', `ألوان الخِزانة — ${themeNames[value]}`)
    for (const item of themeMenu.querySelectorAll<HTMLElement>('[role="menuitemradio"]')) item.setAttribute('aria-checked', String(item.dataset.theme === value))
  }
  for (const value of ['original', 'light', 'dark', 'sepia'] as AppTheme[]) {
    const choice = h('button', {
      type: 'button', role: 'menuitemradio', 'aria-checked': value === selectedTheme ? 'true' : 'false',
      class: 'app-header__theme-choice', dataset: { theme: value },
      onclick: () => {
        saveSettings({ ...getSettings(), theme: value })
        updateThemeControl(value)
        theme.open = false
      },
    }, h('span', { class: `app-header__theme-swatch app-header__theme-swatch--${value}`, 'aria-hidden': 'true' }), themeNames[value])
    themeMenu.appendChild(choice)
  }
  routeEventListener(window, 'alkhizana:settings-changed', (event: Event) => {
    const next = (event as CustomEvent<AppSettings>).detail?.theme
    updateThemeControl(next === 'light' || next === 'dark' || next === 'sepia' ? next : 'original')
  }, undefined, captureRouteResourceScope())
  theme.append(themeSummary, themeMenu)
  inner.appendChild(theme)
  inner.appendChild(translationButton('app-header__translation'))

  const account = h(
    'a',
    { class: 'app-header__account', href: '#/me', 'aria-label': `مساحتي — ${accountLabel}` },
    icon('person', 20),
    h('span', null, accountLabel),
  )
  const settings = h(
    'a',
    {
      class: 'app-header__settings',
      href: '#/settings',
      title: 'الإعدادات',
      'aria-label': 'فتح الإعدادات',
      'aria-current': currentHash.startsWith('#/settings') ? 'page' : undefined,
    },
    icon('settings', 20),
  )
  inner.appendChild(settings)
  inner.appendChild(account)

  header.appendChild(inner)
  return header
}

export function bottomNav(currentHash: string): HTMLElement {
  const nav = h('nav', { class: 'bottom-nav', 'aria-label': 'التنقل السفلي' })
  const inner = h('div', { class: 'bottom-nav__inner' })
  for (const g of GATEWAYS) {
    const active =
      g.hash === '#/'
        ? currentHash === '#/' || currentHash === '#'
        : currentHash.startsWith(g.hash)
    const btn = h(
      'button',
      { 'aria-current': active ? 'true' : undefined, onclick: () => (location.hash = g.hash) },
      icon(g.icon, 24),
      h('span', null, g.label),
    )
    inner.appendChild(btn)
  }
  nav.appendChild(inner)
  return nav
}

/** الإطار العام للشاشات (باستثناء القارئ الذي له تخطيطه الخاص) */
export function appFrame(content: Child, currentHash: string): HTMLElement {
  const frame = h('div', null)
  frame.appendChild(skipToContent())
  frame.appendChild(appHeader(currentHash))
  frame.appendChild(connectivityBanner())
  frame.appendChild(runtimeEnvironmentNotice())
  frame.appendChild(h('main', { class: 'app-main', id: 'main-content', tabindex: -1 }, content))
  frame.appendChild(siteFooter())
  frame.appendChild(bottomNav(currentHash))
  return frame
}

export function siteFooter(): HTMLElement {
  const internal = [
    ['مكتبتي', '#/library'], ['البحث', '#/search'], ['المؤلفون', '#/authors'],
    ['رفوفي', '#/shelves'], ['الإعدادات', '#/settings'],
  ] as const
  return h('footer', { class: 'site-footer', 'aria-label': 'تذييل موقع الخِزانة' },
    h('div', { class: 'site-footer__inner' },
      h('a', { class: 'site-footer__brand', href: '#/', 'aria-label': 'الخِزانة — الصفحة الرئيسية' }, brandMark('site-footer__mark brand-mark'), h('span', null, h('strong', null, 'الخِزانة'), h('small', null, 'مكتبة عربية للقراءة والبحث والتنظيم'))),
      h('nav', { class: 'site-footer__links', 'aria-label': 'خدمات الخِزانة' }, ...internal.map(([label, href]) => h('a', { href }, label))),
      h('nav', { class: 'site-footer__social', 'aria-label': 'متابعة مشروع الخِزانة والتواصل' },
        h('a', { href: 'https://t.me/khezana1448', target: '_blank', rel: 'noopener noreferrer' }, 'قناة المتابعة'),
        h('a', { href: 'https://t.me/khezaana', target: '_blank', rel: 'noopener noreferrer' }, 'التواصل'),
      ),
      h('div', { class: 'site-footer__bottom' },
        h('p', { class: 'site-footer__rights' }, 'حقوق النشر محفوظة لكل مسلم، وكل خدماتنا مجانية في سبيل الله: طلب العلم فريضة، فانشر تُؤجر'),
        visitorCounter(),
      ),
    ),
  )
}

/** تذكير وجيز في أول صفحة من جلسة التصفح؛ يختفي تلقائيًا بعد عشر ثوان. */
export function globalRemembrance(): HTMLElement {
  const sessionKey = 'khizana:remembrance-shown:v2'
  if (sessionStorage.getItem(sessionKey)) return h('span', { hidden: true, 'aria-hidden': 'true' })
  sessionStorage.setItem(sessionKey, '1')
  const scope = captureRouteResourceScope(), selected = chooseRemembrance()
  const reminder = h('aside', {
    class: 'global-remembrance', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true',
    'aria-label': selected.kind === 'authentic-remembrance' ? 'تذكير بذكر مأثور' : 'دعاء عام', dir: 'rtl',
    dataset: { remembranceId: selected.id, remembranceKind: selected.kind, sourceUrl: selected.sourceUrl ?? '' },
  }, selected.text)
  routeTimeout(() => { reminder.classList.add('is-leaving'); routeTimeout(() => reminder.remove(), 260, scope) }, 10_000, scope)
  return reminder
}

export function runtimeEnvironmentNotice(): HTMLElement {
  const notice = h('aside', { class: 'runtime-environment-notice', role: 'status', 'aria-live': 'polite', hidden: true })
  void getRuntimeCapabilities().then(capabilities => {
    if (!capabilities.publicHosted || !notice.isConnected) return
    notice.hidden = false
    notice.replaceChildren(
      icon('globe', 17),
      h('span', null, publicRuntimeNoticeText()),
      h('a', { href: '#/settings' }, 'صدّر نسخة احتياطية'),
    )
  })
  return notice
}

export function skipToContent(): HTMLButtonElement {
  return h('button', { class: 'skip-link', type: 'button', onclick: () => document.getElementById('main-content')?.focus({ preventScroll: false }) }, 'تجاوز إلى المحتوى') as HTMLButtonElement
}

function connectivityBanner(): HTMLElement {
  const resourceScope = captureRouteResourceScope()
  const banner = h('div', { class: 'connectivity-banner', role: 'status', 'aria-live': 'polite', hidden: true })
  let hasBeenOffline = false
  const stop = watchConnectivity(state => {
    if (!state.online) hasBeenOffline = true
    banner.hidden = state.online && !hasBeenOffline
    banner.classList.toggle('connectivity-banner--online', state.online)
    banner.replaceChildren(icon(state.online ? 'check' : 'globe', 17), h('span', null, state.message))
    if (state.online && hasBeenOffline) routeTimeout(() => { banner.hidden = true; hasBeenOffline = false }, 3500, resourceScope)
  })
  resourceScope.add(stop)
  return banner
}
